#!/usr/bin/env node
// Validates the dataset against the rules in data/SCHEMA.md.
// Run: node scripts/validate.mjs   (exit 1 on any error)

import { readFileSync, readdirSync, existsSync } from 'fs';
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

export const EDGE_TYPES = ['finetune', 'distill', 'quantized', 'variant', 'influence'];
const MODALITIES = ['text', 'image', 'audio', 'video'];
// Closed set so a typo ("license", "modality") fails loudly instead of silently
// dropping out of the build.
const MODEL_KEYS = [
  'id', 'name', 'family', 'product_line', 'org', 'api_name', 'tags', 'notes', 'events',
  'context_window', 'params', 'open_weights', 'licence', 'modalities', 'hf_id', 'epoch_id',
];
const EDGE_KEYS = ['from', 'to', 'type', 'confidence', 'basis', 'source'];
const SCORE_KEYS = ['model', 'eci', 'ci_low', 'ci_high', 'note'];
const KEBAB_RE = /^[a-z0-9][a-z0-9-.]*$/;
const HF_ID_RE = /^[\w.-]+\/[\w.-]+$/;

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
  const readOptional = (rel) => {
    const path = join(DATA, rel);
    return existsSync(path) ? parseYaml(readFileSync(path, 'utf8')) : null;
  };
  return { labs, modelFiles, lineage: readOptional('lineage.yaml'), scores: readOptional('scores/eci.yaml') };
}

/** Earliest lifecycle date (training_cutoff excluded), or null. */
export function firstLifecycleDate(model) {
  const dates = (model.events || [])
    .filter((e) => e.type !== 'training_cutoff' && e.date)
    .map((e) => e.date)
    .sort();
  return dates[0] ?? null;
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

function validateMetadata(f, model, labId) {
  const id = model.id;
  for (const k of Object.keys(model)) {
    if (!MODEL_KEYS.includes(k)) err(f, `${id}: unknown field "${k}"`);
  }
  if (model.product_line !== undefined && !KEBAB_RE.test(String(model.product_line))) {
    err(f, `${id}: product_line must be lowercase kebab-case`);
  }
  if (model.tags !== undefined && !Array.isArray(model.tags)) err(f, `${id}: tags must be a list`);
  if (model.open_weights !== undefined && typeof model.open_weights !== 'boolean') {
    err(f, `${id}: open_weights must be true or false`);
  }
  if (model.context_window !== undefined && !Number.isInteger(model.context_window)) {
    err(f, `${id}: context_window must be an integer token count`);
  }
  // Models in the catch-all lane need their real organisation for the label.
  if (labId === 'other' && !model.org) warn(f, `${id}: lab "other" without an "org"`);
  if (model.licence !== undefined && model.open_weights !== true) {
    warn(f, `${id}: licence recorded on a model not marked open_weights`);
  }
  if (model.hf_id !== undefined) {
    if (!HF_ID_RE.test(String(model.hf_id))) err(f, `${id}: hf_id must look like "owner/repo"`);
    if (model.open_weights !== true) warn(f, `${id}: hf_id on a model not marked open_weights`);
  }

  const mod = model.modalities;
  if (mod !== undefined) {
    if (mod === null || typeof mod !== 'object' || Array.isArray(mod)) {
      err(f, `${id}: modalities must be a map with "input" and "output" lists`);
      return;
    }
    for (const k of Object.keys(mod)) {
      if (!['input', 'output'].includes(k)) err(f, `${id}: unknown modalities key "${k}"`);
    }
    for (const dir of ['input', 'output']) {
      const list = mod[dir];
      if (!Array.isArray(list) || list.length === 0) {
        err(f, `${id}: modalities.${dir} must be a non-empty list`);
        continue;
      }
      for (const m of list) {
        if (!MODALITIES.includes(m)) err(f, `${id}: modalities.${dir} "${m}" not in ${MODALITIES.join('|')}`);
      }
    }
  }
}

function validateSourcing(file, where, item) {
  if (!item.confidence) err(file, `${where}: missing "confidence"`);
  else if (!CONFIDENCES.includes(item.confidence)) {
    err(file, `${where}: confidence "${item.confidence}" not in ${CONFIDENCES.join('|')}`);
  }
  const hasBasis = typeof item.basis === 'string' && item.basis.trim() !== '';
  if (NEEDS_BASIS.includes(item.confidence) && !hasBasis) {
    err(file, `${where}: confidence "${item.confidence}" requires a "basis" explaining the inference`);
  }
  if (item.source && !/^https?:\/\//.test(item.source)) err(file, `${where}: source must be an http(s) URL`);
  return hasBasis;
}

function validateLineage(doc, modelsById) {
  const f = 'data/lineage.yaml';
  const edges = doc.edges || [];
  if (!Array.isArray(edges)) { err(f, '"edges" must be a list'); return 0; }

  const seen = new Set();
  const children = new Map(); // from -> [to], for cycle detection
  for (const e of edges) {
    const where = `edge ${e.from ?? '?'} -> ${e.to ?? '?'} (${e.type ?? '?'})`;
    for (const k of Object.keys(e)) {
      if (!EDGE_KEYS.includes(k)) err(f, `${where}: unknown field "${k}"`);
    }
    for (const end of ['from', 'to']) {
      if (!e[end]) err(f, `${where}: missing "${end}"`);
      else if (!modelsById.has(e[end])) err(f, `${where}: "${end}" model "${e[end]}" not found`);
    }
    if (e.from && e.from === e.to) err(f, `${where}: edge points at itself`);
    if (!e.type) err(f, `${where}: missing "type"`);
    else if (!EDGE_TYPES.includes(e.type)) err(f, `${where}: type not in ${EDGE_TYPES.join('|')}`);

    // Lines are claims about where a model came from; every one must be citable,
    // including rumors — that is what makes a dashed line defensible.
    validateSourcing(f, where, e);
    if (!e.source) err(f, `${where}: missing "source" (every lineage edge must cite one)`);

    const key = `${e.from}|${e.to}|${e.type}`;
    if (seen.has(key)) err(f, `${where}: duplicate edge`);
    seen.add(key);

    const parent = modelsById.get(e.from);
    const child = modelsById.get(e.to);
    if (parent && child) {
      const pd = firstLifecycleDate(parent);
      const cd = firstLifecycleDate(child);
      // A warning, not an error: month/quarter precision can legitimately put a
      // child's estimated first date a little before its parent's.
      if (pd && cd && cd < pd) warn(f, `${where}: child first appears (${cd}) before parent (${pd})`);
      if (!children.has(e.from)) children.set(e.from, []);
      children.get(e.from).push(e.to);
    }
  }

  // Provenance must be acyclic, whatever the dates say.
  const state = new Map(); // id -> 1 visiting, 2 done
  const visit = (id, path) => {
    if (state.get(id) === 2) return;
    if (state.get(id) === 1) { err(f, `lineage cycle: ${[...path, id].join(' -> ')}`); return; }
    state.set(id, 1);
    for (const c of children.get(id) || []) visit(c, [...path, id]);
    state.set(id, 2);
  };
  for (const id of children.keys()) visit(id, []);

  return edges.length;
}

function validateScores(doc, modelsById) {
  const f = 'data/scores/eci.yaml';
  const scores = doc.scores || [];
  if (!Array.isArray(scores)) { err(f, '"scores" must be a list'); return 0; }
  if (scores.length) {
    if (!doc.source || !/^https?:\/\//.test(doc.source)) err(f, 'missing http(s) "source" for the score dataset');
    if (!doc.retrieved || !isValidDate(doc.retrieved)) err(f, 'missing valid "retrieved" date');
  }
  const seen = new Set();
  for (const s of scores) {
    const where = `score ${s.model ?? '?'}`;
    for (const k of Object.keys(s)) {
      if (!SCORE_KEYS.includes(k)) err(f, `${where}: unknown field "${k}"`);
    }
    if (!s.model) err(f, `${where}: missing "model"`);
    else if (!modelsById.has(s.model)) err(f, `${where}: model not found`);
    if (seen.has(s.model)) err(f, `${where}: duplicate score`);
    seen.add(s.model);
    if (typeof s.eci !== 'number') { err(f, `${where}: "eci" must be a number`); continue; }
    for (const k of ['ci_low', 'ci_high']) {
      if (s[k] !== undefined && typeof s[k] !== 'number') err(f, `${where}: "${k}" must be a number`);
    }
    if (typeof s.ci_low === 'number' && s.ci_low > s.eci) err(f, `${where}: ci_low above eci`);
    if (typeof s.ci_high === 'number' && s.ci_high < s.eci) err(f, `${where}: ci_high below eci`);
  }
  return scores.length;
}

function validateModel(file, model, labId, globalIds) {
  const f = file;
  if (!model.id) { err(f, `model missing "id": ${JSON.stringify(model).slice(0, 80)}`); return; }
  if (!model.name) err(f, `${model.id}: missing "name"`);
  if (!KEBAB_RE.test(model.id)) err(f, `${model.id}: id must be lowercase kebab-case`);
  if (globalIds.has(model.id)) err(f, `duplicate model id "${model.id}" (ids must be unique across all files)`);
  globalIds.add(model.id);

  validateMetadata(f, model, labId);

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
  const { labs, modelFiles, lineage, scores } = loadDataset();
  const labIds = validateLabs(labs);
  const globalIds = new Set();
  let modelCount = 0;

  for (const { file, doc } of modelFiles) {
    if (!doc.lab) err(file, 'missing top-level "lab"');
    else if (!labIds.has(doc.lab)) err(file, `lab "${doc.lab}" not defined in labs.yaml`);
    const models = doc.models || [];
    if (!models.length) warn(file, 'no models defined');
    for (const m of models) validateModel(file, m, doc.lab, globalIds);
    modelCount += models.length;
  }

  const modelsById = new Map(
    modelFiles.flatMap(({ doc }) => (doc.models || []).filter((m) => m.id).map((m) => [m.id, m]))
  );
  const edgeCount = lineage ? validateLineage(lineage, modelsById) : 0;
  const scoreCount = scores ? validateScores(scores, modelsById) : 0;

  for (const w of warnings) console.warn(`  warn  ${w}`);
  for (const e of errors) console.error(`  ERROR ${e}`);

  const summary = `${modelCount} models across ${modelFiles.length} file(s), ${labs.length} labs, ` +
    `${edgeCount} lineage edge(s), ${scoreCount} score(s)`;
  if (errors.length) {
    console.error(`\n✗ ${errors.length} error(s), ${warnings.length} warning(s) — ${summary}`);
    process.exit(1);
  }
  console.log(`✓ dataset valid — ${summary}${warnings.length ? `, ${warnings.length} warning(s)` : ''}`);
}

main();
