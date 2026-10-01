// Turns a model's events[] into the segments the renderer draws.
//
// The mapping is the heart of the design: a bar is not one fill but a sequence of
// phases, each carrying its own opacity/texture, and each edge carrying the
// precision of the event that defines it.

import { parseDate } from './scale.js';

/**
 * A phase starts at one lifecycle event and runs until the next one present on
 * the model — whatever that is. Deriving the end from the actual event sequence,
 * rather than a per-phase whitelist, is what keeps phases from overlapping when
 * a model skips stages (Claude Mythos 5 is announced and limited-access on the
 * same day and never becomes generally available).
 *
 * Stages are ordered by DATE, not by this list; the list only breaks ties when
 * two events share a date. `limited` sorts after `announced` so that a same-day
 * pair collapses the zero-width announcement and keeps the restricted-access
 * phase, which is the more informative of the two. The order is not the
 * canonical lifecycle sequence — `limited` genuinely precedes `announced` for
 * Mythos Preview, and sorting by date handles that correctly.
 */
const TIE_ORDER = ['internal', 'announced', 'limited', 'available', 'deprecated', 'retired'];

const PHASE_FOR_START = {
  internal: 'pre',
  limited: 'restricted',
  announced: 'announced',
  available: 'live',
  deprecated: 'sunset',
};

/** Phases that terminate a bar: after them the model is gone, so nothing runs on. */
const TERMINAL = new Set(['retired']);

const CONFIDENCE_OPACITY = {
  confirmed: 1,
  likely: 1,
  estimated: 0.55,
  rumored: 0.55,
};

export function eventsByType(model) {
  const map = {};
  for (const ev of model.events) map[ev.type] = ev;
  return map;
}

/** Derived status — never stored, per SCHEMA.md. */
export function statusOf(model, now = Date.now()) {
  const by = eventsByType(model);
  const t = (e) => (e ? parseDate(e.date) : null);
  if (by.retired && t(by.retired) <= now) return 'retired';
  if (by.deprecated && t(by.deprecated) <= now) return 'deprecated';
  if (by.available && t(by.available) <= now) return 'active';
  if (by.limited && t(by.limited) <= now) return 'limited';
  if (by.announced && t(by.announced) <= now) return 'announced';
  return 'upcoming';
}

/**
 * Build drawable segments. Returns [] for a model with no lifecycle events
 * (training_cutoff alone draws nothing).
 *
 * `openEnded` marks a bar with no retirement date: it runs to "now" and is drawn
 * with a soft trailing edge rather than a hard stop, since the model has not ended.
 */
export function segmentsOf(model, now = Date.now()) {
  const by = eventsByType(model);
  const segments = [];

  // Stages this model actually has, ordered by date; TIE_ORDER breaks same-day ties.
  const present = TIE_ORDER
    .filter((t) => by[t])
    .sort((a, b) => by[a].date.localeCompare(by[b].date) || TIE_ORDER.indexOf(a) - TIE_ORDER.indexOf(b));

  for (let i = 0; i < present.length; i++) {
    const type = present[i];
    if (TERMINAL.has(type)) continue; // `retired` ends the previous phase; it starts none
    const phaseId = PHASE_FOR_START[type];
    if (!phaseId) continue;

    const startEv = by[type];
    const endEv = i + 1 < present.length ? by[present[i + 1]] : null;

    // No following event: the phase is still running. Extend to now, unless the
    // start is itself in the future (an announced-but-unreleased model).
    const startMs = parseDate(startEv.date);
    const openEnded = !endEv;
    const endMs = endEv ? parseDate(endEv.date) : Math.max(startMs, now);

    if (endMs < startMs) continue; // guarded by the validator, but never trust it here
    // A zero-width phase (announced and available on the same day) is not drawn;
    // the following phase covers the span. Keeping it would stack two fades.
    if (endMs === startMs && endEv) continue;

    segments.push({
      phase: phaseId,
      startEv,
      endEv,
      startMs,
      endMs,
      openEnded,
      // Opacity is the weaker of the two bounding events: a segment is only as
      // trustworthy as its least certain edge.
      opacity: Math.min(
        CONFIDENCE_OPACITY[startEv.confidence] ?? 1,
        endEv ? (CONFIDENCE_OPACITY[endEv.confidence] ?? 1) : 1
      ),
    });
  }

  return segments;
}

/**
 * True when the model has lifecycle events but no `internal` one — the common
 * case. The renderer draws a fixed-pixel-width ellipsis before the bar to show
 * that something preceded it without implying a duration.
 */
export function hasUnknownInternal(model) {
  const by = eventsByType(model);
  if (by.internal) return false;
  return Boolean(by.limited || by.announced || by.available);
}

/** Earliest and latest lifecycle timestamps, for row sorting and hit-testing. */
export function extentOf(model, now = Date.now()) {
  const segs = segmentsOf(model, now);
  if (!segs.length) {
    const ms = model.events.map((e) => parseDate(e.date));
    return ms.length ? [Math.min(...ms), Math.max(...ms)] : null;
  }
  return [segs[0].startMs, segs[segs.length - 1].endMs];
}

export const PHASE_LABELS = {
  pre: 'Internal development',
  restricted: 'Limited / partner access',
  announced: 'Announced, awaiting general availability',
  live: 'Generally available',
  sunset: 'Deprecated — retirement scheduled',
};

export const CONFIDENCE_LABELS = {
  confirmed: 'Confirmed by first-party source',
  likely: 'Likely — hedged or secondary source',
  estimated: 'Estimated from indirect evidence',
  rumored: 'Rumored — unconfirmed',
};

export const PRECISION_LABELS = {
  day: 'exact date',
  month: 'month known',
  quarter: 'quarter known',
  year: 'year known',
};
