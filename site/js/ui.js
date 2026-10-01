// Tooltip, detail panel, legend, filters, and the table view.

import { formatDate } from './scale.js';
import {
  PHASE_LABELS, CONFIDENCE_LABELS, PRECISION_LABELS,
  eventsByType, statusOf, segmentsOf,
} from './model.js';

const EVENT_LABELS = {
  training_cutoff: 'Training cutoff',
  internal: 'Internal',
  limited: 'Limited access',
  announced: 'Announced',
  available: 'Generally available',
  deprecated: 'Deprecated',
  retired: 'Retired',
};

export function eventLabel(type) { return EVENT_LABELS[type] || type; }

/* ------------------------------------------------------------------ tooltip */

export class Tooltip {
  constructor(root) {
    this.node = document.createElement('div');
    this.node.className = 'tooltip';
    this.node.setAttribute('role', 'status');
    this.node.hidden = true;
    root.appendChild(this.node);
  }

  show(html, x, y) {
    this.node.innerHTML = html;
    this.node.hidden = false;
    const rect = this.node.getBoundingClientRect();
    const maxX = window.innerWidth - rect.width - 12;
    this.node.style.left = `${Math.max(8, Math.min(x + 14, maxX))}px`;
    this.node.style.top = `${y + 16}px`;
  }

  hide() { this.node.hidden = true; }
}

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export function segmentTooltipHtml(model, segment) {
  if (!segment) return `<div class="tt-title">${esc(model.name)}</div>`;
  const { startEv, endEv } = segment;
  const rows = [];
  rows.push(`<div class="tt-phase">${esc(PHASE_LABELS[segment.phase] || segment.phase)}</div>`);
  rows.push(tooltipEventRow(startEv));
  if (endEv) rows.push(tooltipEventRow(endEv));
  else rows.push('<div class="tt-event"><span class="tt-ev-name">ongoing</span></div>');
  return `<div class="tt-title">${esc(model.name)}</div>${rows.join('')}`;
}

function tooltipEventRow(ev) {
  const bits = [
    `<span class="tt-ev-name">${esc(eventLabel(ev.type))}</span>`,
    `<span class="tt-ev-date">${esc(formatDate(ev.date))}</span>`,
    `<span class="tt-badge tt-${esc(ev.confidence)}">${esc(ev.confidence)}</span>`,
  ];
  if (ev.precision !== 'day') {
    bits.push(`<span class="tt-precision">${esc(PRECISION_LABELS[ev.precision] || ev.precision)}</span>`);
  }
  let out = `<div class="tt-event">${bits.join(' ')}</div>`;
  // The basis text is the payload — the honest hedging lives here, so it is
  // shown verbatim rather than summarised.
  if (ev.basis) out += `<div class="tt-basis">${esc(ev.basis.trim())}</div>`;
  if (ev.bounds) {
    const b = [];
    if (ev.bounds.earliest) b.push(`no earlier than ${formatDate(ev.bounds.earliest)}`);
    if (ev.bounds.latest) b.push(`no later than ${formatDate(ev.bounds.latest)}`);
    out += `<div class="tt-bounds">${esc(b.join(' · '))}</div>`;
  }
  return out;
}

/* ------------------------------------------------------------- detail panel */

export class DetailPanel {
  constructor(root, onClose) {
    this.node = document.createElement('aside');
    this.node.className = 'detail-panel';
    this.node.hidden = true;
    this.node.setAttribute('aria-label', 'Model detail');
    root.appendChild(this.node);
    this.onClose = onClose;
    this.node.addEventListener('click', (e) => {
      if (e.target.closest('[data-close]')) this.hide();
    });
  }

  show(model, lab) {
    const by = eventsByType(model);
    const status = statusOf(model);
    const meta = [];
    if (model.api_name) meta.push(`<code>${esc(model.api_name)}</code>`);
    if (model.context_window) meta.push(`${(model.context_window / 1000).toLocaleString()}K context`);
    if (model.params) meta.push(esc(model.params));
    if (model.open_weights) meta.push('open weights');

    const events = model.events.slice().sort((a, b) => a.date.localeCompare(b.date));
    const rows = events.map((ev) => `
      <li class="dp-event">
        <div class="dp-event-head">
          <span class="dp-ev-name">${esc(eventLabel(ev.type))}</span>
          <span class="dp-ev-date">${esc(formatDate(ev.date))}</span>
        </div>
        <div class="dp-ev-meta">
          <span class="tt-badge tt-${esc(ev.confidence)}">${esc(ev.confidence)}</span>
          <span class="dp-ev-precision">${esc(PRECISION_LABELS[ev.precision] || ev.precision)}</span>
          ${ev.source ? `<a class="dp-ev-source" href="${esc(ev.source)}" target="_blank" rel="noopener noreferrer">source ↗</a>` : ''}
        </div>
        ${ev.basis ? `<p class="dp-ev-basis">${esc(ev.basis.trim())}</p>` : ''}
        ${ev.bounds ? `<p class="dp-ev-bounds">${esc([
          ev.bounds.earliest ? `no earlier than ${formatDate(ev.bounds.earliest)}` : '',
          ev.bounds.latest ? `no later than ${formatDate(ev.bounds.latest)}` : '',
        ].filter(Boolean).join(' · '))}</p>` : ''}
      </li>`).join('');

    this.node.innerHTML = `
      <div class="dp-head">
        <div>
          <div class="dp-lab">${esc(lab?.name || model.lab)}</div>
          <h2 class="dp-title">${esc(model.name)}</h2>
          <div class="dp-status dp-status-${esc(status)}">${esc(status)}</div>
        </div>
        <button class="dp-close" data-close aria-label="Close detail panel">×</button>
      </div>
      ${meta.length ? `<div class="dp-meta">${meta.join(' · ')}</div>` : ''}
      ${model.notes ? `<p class="dp-notes">${esc(model.notes.trim())}</p>` : ''}
      <h3 class="dp-sub">Lifecycle</h3>
      <ol class="dp-events">${rows}</ol>
      ${!by.internal ? '<p class="dp-gap">No sourced internal-development date. Internal dates are rarely disclosed; see the project notes on why this field is sparse.</p>' : ''}
    `;
    this.node.hidden = false;
  }

  hide() { this.node.hidden = true; this.onClose?.(); }
}

/* -------------------------------------------------------------------- legend */

export function buildLegend(container) {
  container.innerHTML = `
    <div class="legend-group">
      <span class="legend-heading">Phase</span>
      <span class="legend-item"><span class="lg-swatch lg-pre"></span>internal</span>
      <span class="legend-item"><span class="lg-swatch lg-restricted"></span>limited</span>
      <span class="legend-item"><span class="lg-swatch lg-live"></span>available</span>
      <span class="legend-item"><span class="lg-swatch lg-sunset"></span>deprecated</span>
      <span class="legend-item"><span class="lg-swatch lg-ellipsis">···</span>unknown start</span>
      <span class="legend-item"><span class="lg-swatch lg-future"></span>projected (after today)</span>
    </div>
    <div class="legend-group">
      <span class="legend-heading">Date precision</span>
      <span class="legend-item"><span class="lg-swatch lg-exact"></span>exact day</span>
      <span class="legend-item"><span class="lg-swatch lg-fuzzy"></span>month or wider</span>
    </div>
    <div class="legend-group">
      <span class="legend-heading">Confidence</span>
      <span class="legend-item"><span class="lg-mark lg-confirmed"></span>confirmed</span>
      <span class="legend-item"><span class="lg-mark lg-likely"></span>likely</span>
      <span class="legend-item"><span class="lg-mark lg-estimated"></span>estimated</span>
      <span class="legend-item"><span class="lg-mark lg-rumored"></span>rumored</span>
    </div>`;
}

/* --------------------------------------------------------------- table view */

export function buildTable(container, models, labById) {
  const rows = models.map((m) => {
    const by = eventsByType(m);
    const cell = (t) => {
      const ev = by[t];
      if (!ev) return '<td class="t-none">—</td>';
      const cls = ev.confidence === 'confirmed' ? '' : ` class="t-${ev.confidence}"`;
      const title = ev.basis ? ` title="${esc(ev.basis.trim())}"` : '';
      return `<td${cls}${title}>${esc(formatDate(ev.date))}</td>`;
    };
    return `<tr>
      <th scope="row">${esc(m.name)}</th>
      <td>${esc(labById[m.lab]?.name || m.lab)}</td>
      <td>${esc(statusOf(m))}</td>
      ${cell('internal')}${cell('limited')}${cell('announced')}${cell('available')}${cell('deprecated')}${cell('retired')}
    </tr>`;
  }).join('');

  container.innerHTML = `
    <table class="data-table">
      <caption>Every date in the chart, with non-confirmed dates marked. Hover a date for its basis.</caption>
      <thead><tr>
        <th scope="col">Model</th><th scope="col">Lab</th><th scope="col">Status</th>
        <th scope="col">Internal</th><th scope="col">Limited</th><th scope="col">Announced</th>
        <th scope="col">Available</th><th scope="col">Deprecated</th><th scope="col">Retired</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>`;
}
