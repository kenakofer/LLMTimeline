// Time <-> pixel mapping and axis tick generation.
// A Gantt chart needs only a linear time scale, so this is deliberately ~60 lines
// rather than a d3-scale/d3-time dependency.

export const DAY_MS = 86400000;

/** Parse an ISO YYYY-MM-DD as UTC midnight. Avoids local-timezone drift. */
export function parseDate(iso) {
  return new Date(iso + 'T00:00:00Z').getTime();
}

export function formatDate(iso) {
  const d = new Date(iso + 'T00:00:00Z');
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
}

export function createScale({ start, end, width, padDays = 30 }) {
  let domainStart = parseDate(start) - padDays * DAY_MS;
  let domainEnd = parseDate(end) + padDays * DAY_MS;

  const api = {
    get domain() { return [domainStart, domainEnd]; },
    setDomain(s, e) { domainStart = s; domainEnd = e; return api; },
    setWidth(w) { width = w; return api; },
    get width() { return width; },
    /** ms -> px */
    x(ms) { return ((ms - domainStart) / (domainEnd - domainStart)) * width; },
    /** ISO -> px */
    xd(iso) { return api.x(parseDate(iso)); },
    /** px -> ms */
    invert(px) { return domainStart + (px / width) * (domainEnd - domainStart); },
    /** Width in px of a duration in days — used for precision fades. */
    days(n) { return (n * DAY_MS / (domainEnd - domainStart)) * width; },
    get spanDays() { return (domainEnd - domainStart) / DAY_MS; },
  };
  return api;
}

/**
 * Year and quarter ticks across the domain. Quarters are dropped when the
 * domain is wide enough that they would collide.
 */
export function ticks(scale) {
  const [s, e] = scale.domain;
  const startYear = new Date(s).getUTCFullYear();
  const endYear = new Date(e).getUTCFullYear();
  const spanYears = (e - s) / (DAY_MS * 365);
  const showQuarters = spanYears < 8;
  const showMonths = spanYears < 2;

  const out = [];
  for (let y = startYear; y <= endYear; y++) {
    for (let m = 0; m < 12; m++) {
      const ms = Date.UTC(y, m, 1);
      if (ms < s || ms > e) continue;
      const isYear = m === 0;
      const isQuarter = m % 3 === 0;
      if (isYear) out.push({ ms, label: String(y), level: 'year' });
      else if (isQuarter && showQuarters) out.push({ ms, label: `Q${m / 3 + 1}`, level: 'quarter' });
      else if (showMonths) {
        out.push({ ms, label: new Date(ms).toLocaleDateString('en-GB', { month: 'short', timeZone: 'UTC' }), level: 'month' });
      }
    }
  }
  return out;
}

/**
 * How many days of uncertainty a precision level implies. Drives the width of
 * the gradient fade at a segment edge, so the ink covers exactly the interval
 * the source supports.
 */
export function precisionDays(precision) {
  switch (precision) {
    case 'day': return 0;
    case 'month': return 30;
    case 'quarter': return 90;
    case 'year': return 365;
    default: return 0;
  }
}
