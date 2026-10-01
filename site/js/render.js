// SVG construction: axis, lab bands, model rows, segments, markers.

import { el, Defs } from './defs.js';
import { ticks, precisionDays, parseDate, DAY_MS } from './scale.js';
import { segmentsOf, hasUnknownInternal, statusOf, eventsByType } from './model.js';

export const LAYOUT = {
  rowHeight: 26,
  barHeight: 12,
  labGap: 14,
  labHeaderHeight: 22,
  axisHeight: 34,
  gutter: 250,
  paddingRight: 24,
  paddingTop: 8,
  ellipsisWidth: 18,
};

const MIN_SEGMENT_PX = 1.5;

export class Chart {
  constructor(container, data) {
    this.container = container;
    this.data = data;
    this.labById = Object.fromEntries(data.labs.map((l) => [l.id, l]));
    this.now = Date.now();

    this.svg = el('svg', { class: 'chart', xmlns: 'http://www.w3.org/2000/svg' });
    this.defs = new Defs(this.svg);
    this.gAxis = el('g', { class: 'axis-layer' });
    this.gRows = el('g', { class: 'rows-layer' });
    this.gOverlay = el('g', { class: 'overlay-layer' });
    this.svg.append(this.gAxis, this.gRows, this.gOverlay);
    container.appendChild(this.svg);

    this.rowIndex = [];   // {model, y} for hit-testing
  }

  labColor(labId) {
    const token = this.labById[labId]?.color || 'lab-8';
    return getComputedStyle(document.documentElement).getPropertyValue(`--${token}`).trim() || '#888';
  }

  /** Compute row layout for the visible models, grouped by lab. */
  layout(models) {
    const byLab = new Map();
    for (const m of models) {
      if (!byLab.has(m.lab)) byLab.set(m.lab, []);
      byLab.get(m.lab).push(m);
    }
    const groups = [];
    let y = LAYOUT.paddingTop;
    for (const lab of this.data.labs) {
      const list = byLab.get(lab.id);
      if (!list || !list.length) continue;
      const headerY = y;
      y += LAYOUT.labHeaderHeight;
      const rows = list.map((model) => {
        const row = { model, y };
        y += LAYOUT.rowHeight;
        return row;
      });
      groups.push({ lab, headerY, rows, endY: y });
      y += LAYOUT.labGap;
    }
    return { groups, height: y };
  }

  render(scale, models) {
    this.scale = scale;
    this.defs.clearGradients();
    this.gAxis.textContent = '';
    this.gRows.textContent = '';
    this.gOverlay.textContent = '';
    this.rowIndex = [];

    const { groups, height } = this.layout(models);
    const totalHeight = height + LAYOUT.axisHeight;
    const totalWidth = LAYOUT.gutter + scale.width + LAYOUT.paddingRight;
    this.svg.setAttribute('viewBox', `0 0 ${totalWidth} ${totalHeight}`);
    this.svg.setAttribute('width', totalWidth);
    this.svg.setAttribute('height', totalHeight);

    this.renderAxis(scale, height, totalWidth);
    for (const group of groups) this.renderGroup(group, scale);
    this.renderNowRule(scale, height);
    return { height: totalHeight, groups };
  }

  renderAxis(scale, plotHeight, totalWidth) {
    const g = this.gAxis;
    for (const t of ticks(scale)) {
      const x = LAYOUT.gutter + scale.x(t.ms);
      if (x < LAYOUT.gutter - 1 || x > totalWidth) continue;
      g.appendChild(el('line', {
        class: `gridline gridline-${t.level}`,
        x1: x, y1: LAYOUT.paddingTop, x2: x, y2: plotHeight,
      }));
      const label = el('text', {
        class: `axis-label axis-label-${t.level}`,
        x, y: plotHeight + 16, 'text-anchor': 'middle',
      });
      label.textContent = t.label;
      g.appendChild(label);
    }
    g.appendChild(el('line', {
      class: 'axis-baseline',
      x1: LAYOUT.gutter, y1: plotHeight, x2: totalWidth - LAYOUT.paddingRight, y2: plotHeight,
    }));
  }

  renderNowRule(scale, plotHeight) {
    const nowIso = new Date(this.now).toISOString().slice(0, 10);
    const x = LAYOUT.gutter + scale.xd(nowIso);
    if (x < LAYOUT.gutter || x > LAYOUT.gutter + scale.width) return;
    this.gOverlay.appendChild(el('line', {
      class: 'now-rule', x1: x, y1: LAYOUT.paddingTop, x2: x, y2: plotHeight,
    }));
    const label = el('text', { class: 'now-label', x: x + 4, y: LAYOUT.paddingTop + 9 });
    label.textContent = 'today';
    this.gOverlay.appendChild(label);
  }

  renderGroup(group, scale) {
    const { lab, headerY, rows } = group;
    const color = this.labColor(lab.id);
    this.defs.ensureLab(lab.id, color);

    const header = el('g', { class: 'lab-header' });
    header.appendChild(el('rect', {
      class: 'lab-swatch', x: 12, y: headerY + 4, width: 10, height: 10, rx: 2, fill: color,
    }));
    const name = el('text', { class: 'lab-name', x: 28, y: headerY + 13 });
    name.textContent = lab.name;
    header.appendChild(name);
    this.gRows.appendChild(header);

    for (const row of rows) this.renderRow(row, scale, color, lab);
  }

  renderRow(row, scale, color, lab) {
    const { model, y } = row;
    const barY = y + (LAYOUT.rowHeight - LAYOUT.barHeight) / 2;
    const status = statusOf(model, this.now);

    const g = el('g', {
      class: `row row-${status}`,
      'data-model': model.id,
      tabindex: 0,
      role: 'listitem',
      'aria-label': this.rowAriaLabel(model, status),
    });

    // Full-width hit area: keeps hover targets well above the 24px minimum
    // even though the bar itself is 12px.
    g.appendChild(el('rect', {
      class: 'row-hit', x: 0, y, width: LAYOUT.gutter + scale.width, height: LAYOUT.rowHeight,
    }));

    const label = el('text', { class: 'model-name', x: LAYOUT.gutter - 12, y: y + 17, 'text-anchor': 'end' });
    label.textContent = model.name;
    g.appendChild(label);

    const segments = segmentsOf(model, this.now);

    if (hasUnknownInternal(model) && segments.length) {
      this.renderUnknownEllipsis(g, LAYOUT.gutter + scale.x(segments[0].startMs), barY, color);
    }

    for (const seg of segments) this.renderSegment(g, seg, scale, color, lab, barY);
    for (const ev of model.events) {
      if (ev.type === 'training_cutoff') continue;
      this.renderMarker(g, ev, scale, barY);
    }

    this.gRows.appendChild(g);
    this.rowIndex.push({ model, y, height: LAYOUT.rowHeight, segments });
  }

  rowAriaLabel(model, status) {
    const by = eventsByType(model);
    const parts = [`${model.name}, ${status}`];
    if (by.available) parts.push(`available ${by.available.date}`);
    else if (by.announced) parts.push(`announced ${by.announced.date}`);
    else if (by.limited) parts.push(`limited access ${by.limited.date}`);
    if (by.retired) parts.push(`retired ${by.retired.date}`);
    else if (by.deprecated) parts.push(`deprecated ${by.deprecated.date}`);
    return parts.join(', ');
  }

  /**
   * Three fading dots at fixed pixel width before the bar. Deliberately NOT
   * scaled to a duration: the point is that the duration is unknown.
   */
  renderUnknownEllipsis(g, barStartX, barY, color) {
    const cy = barY + LAYOUT.barHeight / 2;
    const gap = 5;
    const ell = el('g', { class: 'unknown-internal' });
    for (let i = 0; i < 3; i++) {
      ell.appendChild(el('circle', {
        cx: barStartX - 6 - i * gap, cy, r: 1.5, fill: color,
        'fill-opacity': 0.42 - i * 0.12,
      }));
    }
    const title = el('title');
    title.textContent = 'Internal development period unknown — no sourced date';
    ell.appendChild(title);
    g.appendChild(ell);
  }

  renderSegment(g, seg, scale, color, lab, barY) {
    const x0 = LAYOUT.gutter + scale.x(seg.startMs);
    const x1 = LAYOUT.gutter + scale.x(seg.endMs);
    const w = Math.max(x1 - x0, MIN_SEGMENT_PX);

    // 2px surface gap between adjacent phases rather than a stroke around each.
    const inset = 1;
    const drawW = Math.max(w - inset, MIN_SEGMENT_PX);

    let fill = color;
    let fillOpacity = seg.opacity;
    const cls = ['seg', `seg-${seg.phase}`];

    if (seg.phase === 'pre') {
      fill = `url(#hatch-pre-${lab.id})`;
    } else if (seg.phase === 'sunset') {
      fill = `url(#hatch-sunset-${lab.id})`;
    } else if (seg.phase === 'restricted' || seg.phase === 'announced') {
      fillOpacity = seg.opacity * 0.5;
    }

    // Precision fade on the leading edge. Only for solid fills — a gradient over
    // a pattern fill is not expressible in one rect, and the hatch already reads
    // as uncertain.
    const fadeDays = precisionDays(seg.startEv.precision);
    if (fadeDays > 0 && seg.phase !== 'pre' && seg.phase !== 'sunset') {
      const fadeW = Math.min(scale.days(fadeDays), drawW);
      if (fadeW > 2) {
        fill = this.defs.edgeFade(lab.id, color, 'start', x0, x0 + fadeW);
      }
    }

    const rect = el('rect', {
      class: cls.join(' '),
      x: x0, y: barY, width: drawW, height: LAYOUT.barHeight,
      rx: 2, fill, 'fill-opacity': fillOpacity,
    });
    g.appendChild(rect);

    // Anything past today is a projection, not a record. 23 models carry future
    // retirement dates — some scheduled, most "not sooner than" floors that will
    // be exceeded — and drawing them like observed history overstates what is
    // known. Overlay the future portion with the surface colour so it reads as
    // provisional while keeping the bar's true extent legible.
    const nowX = LAYOUT.gutter + scale.x(this.now);
    if (nowX > x0 && nowX < x0 + drawW) {
      g.appendChild(el('rect', {
        class: 'seg-future',
        x: nowX, y: barY, width: x0 + drawW - nowX, height: LAYOUT.barHeight,
        rx: 2,
      }));
    }

    // An open-ended live phase gets a soft trailing edge: the model has not
    // ended, so a hard stop at "today" would be a false claim.
    if (seg.openEnded && seg.phase === 'live') {
      const fadeW = Math.min(scale.days(45), drawW);
      if (fadeW > 2) {
        g.appendChild(el('rect', {
          class: 'seg-open-end',
          x: x0 + drawW - fadeW, y: barY, width: fadeW, height: LAYOUT.barHeight,
          fill: this.defs.edgeFade(lab.id, color, 'end', x0 + drawW - fadeW, x0 + drawW),
          'fill-opacity': fillOpacity,
        }));
      }
    }
  }

  /** Confidence glyph above the bar at each event date. */
  renderMarker(g, ev, scale, barY) {
    const x = LAYOUT.gutter + scale.xd(ev.date);
    const y = barY - 3;
    const cls = `marker marker-${ev.confidence}`;

    if (ev.confidence === 'confirmed') {
      g.appendChild(el('line', { class: cls, x1: x, y1: y - 4, x2: x, y2: y }));
    } else if (ev.confidence === 'likely') {
      g.appendChild(el('line', { class: cls, x1: x, y1: y - 4, x2: x, y2: y, 'stroke-dasharray': '2 1.5' }));
    } else if (ev.confidence === 'estimated') {
      g.appendChild(el('circle', { class: cls, cx: x, cy: y - 2, r: 2 }));
    } else {
      g.appendChild(el('line', { class: cls, x1: x, y1: y - 4, x2: x, y2: y, 'stroke-dasharray': '1 2' }));
    }
  }

  /** Find the row + segment under a chart-space point, for tooltips. */
  hitTest(px, py) {
    const row = this.rowIndex.find((r) => py >= r.y && py < r.y + r.height);
    if (!row) return null;
    const ms = this.scale.invert(px - LAYOUT.gutter);
    const seg = row.segments.find((s) => ms >= s.startMs && ms <= s.endMs);
    return { model: row.model, segment: seg || null, ms };
  }
}
