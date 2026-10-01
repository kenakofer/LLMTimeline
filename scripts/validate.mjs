#!/usr/bin/env node
// Validates the dataset against the rules in data/SCHEMA.md.
// Run: node scripts/validate.mjs   (exit 1 on any error)

import { readFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { parseYaml } from './yaml.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DATA = join(ROOT, 'data');

export const EVENT_TYPES = [
  'training_cutoff', 'internal', 'limited', 'announced', 'available', 'deprecated', 'retired',
];
// Chronological rank. Equal dates are fine; going backwards is not.
const ORDER = Object.fromEntries(EVENT_TYPES.map((t, i) => [t, i]));

const PRECISIONS = ['day', 'month', 'quarter', 'year'];
const CONFIDENCES = ['confirmed', 'likely', 'estimated', 'rumored'];
const NEEDS_BASIS = ['estimated', 'rumored'];
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const errors = [];
const warnings = [];
const err = (file, msg) => errors.push(`${file}: ${msg}`);
const warn = (file, msg) => warnings.push(`${file}: ${msg}`);

function isValidDate(s) {
  if (!DATE_RE.test(s)) return false;
  const d = new Date(s + 'T00:00:00Z');
  return !isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

export function loadDataset() {
  const labsDoc = parseYaml(readFileSync(join(DATA, 'labs.yaml'), 'utf8'));
  const labs = labsDoc.labs || [];
  const files = readdirSync(join(DATA, 'models')).filter((f) => f.endsWith('.yaml')).sort();
  const modelFiles = files.map((f) => ({
    file: `data/models/${f}`,
    doc: parseYaml(readFileSync(join(DATA, 'models', f), 'utf8')),
  }));
  return { labs, modelFiles };
}

function validateLabs(labs) {
  const f = 'data/labs.yaml';
  if (!labs.length) err(f, 'no labs defined');
  const ids = new Set();
  for (const lab of labs) {
    for (const k of ['id', 'name', 'color', 'order']) {
      if (lab[k] === undefined || lab[k] === null) err(f, `lab ${lab.id || '?'} missing "${k}"`);
    }
    if (ids.has(lab.id)) err(f, `duplicate lab id "${lab.id}"`);
    ids.add(lab.id);
  }
  return ids;
}

function validateEvent(file, modelId, ev, seenTypes) {
  const where = `${modelId} event "${ev.type ?? '?'}"`;

  if (!ev.type) { err(file, `${where}: missing "type"`); return; }
  if (!EVENT_TYPES.includes(ev.type)) {
    err(file, `${where}: unknown type (expected one of ${EVENT_TYPES.join(', ')})`);
  }
  if (seenTypes.has(ev.type)) err(file, `${where}: duplicate event type on one model`);
  seenTypes.add(ev.type);

  if (!ev.date) err(file, `${where}: missing "date"`);
  else if (!isValidDate(ev.date)) err(file, `${where}: date "${ev.date}" is not a valid ISO YYYY-MM-DD`);

  if (!ev.precision) err(file, `${where}: missing "precision"`);
  else if (!PRECISIONS.includes(ev.precision)) {
    err(file, `${where}: precision "${ev.precision}" not in ${PRECISIONS.join('|')}`);
  }

  if (!ev.confidence) err(file, `${where}: missing "confidence"`);
  else if (!CONFIDENCES.includes(ev.confidence)) {
    err(file, `${where}: confidence "${ev.confidence}" not in ${CONFIDENCES.join('|')}`);
  }

  // SCHEMA.md: basis required for inferred dates; source required otherwise.
  const hasBasis = typeof ev.basis === 'string' && ev.basis.trim() !== '';
  if (NEEDS_BASIS.includes(ev.confidence) && !hasBasis) {
    err(file, `${where}: confidence "${ev.confidence}" requires a "basis" explaining the inference`);
  }
  if (!ev.source && !hasBasis) {
    err(file, `${where}: missing "source" (required unless confidence is estimated/rumored with a basis)`);
  }
  if (ev.source && !/^https?:\/\//.test(ev.source)) {
    err(file, `${where}: source must be an http(s) URL`);
  }

  if (ev.bounds) {
    for (const k of Object.keys(ev.bounds)) {
      if (!['earliest', 'latest'].includes(k)) err(file, `${where}: unknown bounds key "${k}"`);
      else if (!isValidDate(ev.bounds[k])) err(file, `${where}: bounds.${k} is not a valid ISO date`);
    }
    const { earliest, latest } = ev.bounds;
    if (earliest && latest && earliest > latest) err(file, `${where}: bounds.earliest is after bounds.latest`);
    if (ev.date && earliest && ev.date < earliest) {
      err(file, `${where}: date ${ev.date} is before bounds.earliest ${earliest}`);
    }
    if (ev.date && latest && ev.date > latest) {
      err(file, `${where}: date ${ev.date} is after bounds.latest ${latest}`);
    }
  }

  // A day-precision date asserted from a month-granularity source is the most
  // likely way false precision enters the dataset.
  if (ev.precision === 'day' && hasBasis && /\b(assumed|midpoint|approximately|~|roughly|some ?weeks|months)\b/i.test(ev.basis)) {
    warn(file, `${where}: precision "day" but basis reads as an approximation — should this be month?`);
  }
}

function validateModel(file, model, labIds, globalIds) {
  const f = file;
  if (!model.id) { err(f, `model missing "id": ${JSON.stringify(model).slice(0, 80)}`); return; }
  if (!model.name) err(f, `${model.id}: missing "name"`);
  if (!/^[a-z0-9][a-z0-9-.]*$/.test(model.id)) err(f, `${model.id}: id must be lowercase kebab-case`);
  if (globalIds.has(model.id)) err(f, `duplicate model id "${model.id}" (ids must be unique across all files)`);
  globalIds.add(model.id);

  const events = model.events;
  if (!Array.isArray(events) || events.length === 0) {
    err(f, `${model.id}: must have at least one event`);
    return;
  }

  const seenTypes = new Set();
  for (const ev of events) validateEvent(f, model.id, ev, seenTypes);

  // Chronology: sort by the vocabulary's lifecycle order, then check dates
  // never go backwards. training_cutoff is excluded — it describes the training
  // data, not the lifecycle, and legitimately precedes everything.
  const lifecycle = events
    .filter((e) => e.type && e.type !== 'training_cutoff' && e.date && isValidDate(e.date))
    .sort((a, b) => ORDER[a.type] - ORDER[b.type]);

  for (let i = 1; i < lifecycle.length; i++) {
    const prev = lifecycle[i - 1];
    const cur = lifecycle[i];
    if (cur.date < prev.date) {
      err(f, `${model.id}: "${cur.type}" (${cur.date}) precedes "${prev.type}" (${prev.date}) — lifecycle order violated`);
    }
  }

  const cutoff = events.find((e) => e.type === 'training_cutoff');
  const first = lifecycle[0];
  if (cutoff && first && cutoff.date > first.date) {
    err(f, `${model.id}: training_cutoff (${cutoff.date}) is after "${first.type}" (${first.date})`);
  }

  // A retired model that was never deprecated is legal but unusual.
  if (seenTypes.has('retired') && !seenTypes.has('deprecated')) {
    const retired = events.find((e) => e.type === 'retired');
    if (retired.confidence === 'confirmed') {
      warn(f, `${model.id}: retired without a deprecated event — verify against the deprecation page`);
    }
  }
}

function main() {
  const { labs, modelFiles } = loadDataset();
  const labIds = validateLabs(labs);
  const globalIds = new Set();
  let modelCount = 0;

  for (const { file, doc } of modelFiles) {
    if (!doc.lab) err(file, 'missing top-level "lab"');
    else if (!labIds.has(doc.lab)) err(file, `lab "${doc.lab}" not defined in labs.yaml`);
    const models = doc.models || [];
    if (!models.length) warn(file, 'no models defined');
    for (const m of models) validateModel(file, m, labIds, globalIds);
    modelCount += models.length;
  }

  for (const w of warnings) console.warn(`  warn  ${w}`);
  for (const e of errors) console.error(`  ERROR ${e}`);

  const summary = `${modelCount} models across ${modelFiles.length} file(s), ${labs.length} labs`;
  if (errors.length) {
    console.error(`\n✗ ${errors.length} error(s), ${warnings.length} warning(s) — ${summary}`);
    process.exit(1);
  }
  console.log(`✓ dataset valid — ${summary}${warnings.length ? `, ${warnings.length} warning(s)` : ''}`);
}

main();
