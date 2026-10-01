// Bootstrap: load data, wire filters, handle pan/zoom and URL hash state.

import { createScale } from './scale.js';
import { Chart, LAYOUT } from './render.js';
import { statusOf } from './model.js';
import { Tooltip, DetailPanel, segmentTooltipHtml, buildLegend, buildTable } from './ui.js';

const state = {
  labs: new Set(),
  showRetired: true,
  view: 'chart',
};

async function loadData() {
  // data.js sets window.TIMELINE_DATA and is loaded first, so opening the page
  // from file:// works even though fetch() is blocked there.
  if (window.TIMELINE_DATA) return window.TIMELINE_DATA;
  const res = await fetch('data.json');
  if (!res.ok) throw new Error(`failed to load data.json (${res.status})`);
  return res.json();
}

function readHash() {
  const params = new URLSearchParams(location.hash.slice(1));
  if (params.has('labs')) state.labs = new Set(params.get('labs').split(',').filter(Boolean));
  if (params.has('retired')) state.showRetired = params.get('retired') !== '0';
  if (params.has('view')) state.view = params.get('view');
}

function writeHash() {
  const params = new URLSearchParams();
  if (state.labs.size) params.set('labs', [...state.labs].join(','));
  if (!state.showRetired) params.set('retired', '0');
  if (state.view !== 'chart') params.set('view', state.view);
  const next = params.toString();
  history.replaceState(null, '', next ? `#${next}` : location.pathname);
}

function visibleModels(data) {
  return data.models.filter((m) => {
    if (state.labs.size && !state.labs.has(m.lab)) return false;
    if (!state.showRetired && statusOf(m) === 'retired') return false;
    return true;
  });
}

function main(data) {
  const labById = Object.fromEntries(data.labs.map((l) => [l.id, l]));
  const chartHost = document.getElementById('chart');
  const chart = new Chart(chartHost, data);
  const tooltip = new Tooltip(document.body);
  const panel = new DetailPanel(document.body, () => {
    chartHost.querySelectorAll('.row-selected').forEach((n) => n.classList.remove('row-selected'));
  });

  buildLegend(document.getElementById('legend'));

  // --- filters ---------------------------------------------------------
  const labFilter = document.getElementById('lab-filter');
  const present = new Set(data.models.map((m) => m.lab));
  labFilter.innerHTML = data.labs.filter((l) => present.has(l.id)).map((l) => `
    <label class="filter-chip">
      <input type="checkbox" value="${l.id}" ${state.labs.size === 0 || state.labs.has(l.id) ? 'checked' : ''}>
      <span class="chip-swatch" style="background:var(--${l.color})"></span>${l.name}
    </label>`).join('');

  labFilter.addEventListener('change', () => {
    const boxes = [...labFilter.querySelectorAll('input')];
    const checked = boxes.filter((b) => b.checked).map((b) => b.value);
    state.labs = checked.length === boxes.length ? new Set() : new Set(checked);
    writeHash();
    draw();
  });

  const retiredToggle = document.getElementById('show-retired');
  retiredToggle.checked = state.showRetired;
  retiredToggle.addEventListener('change', () => {
    state.showRetired = retiredToggle.checked;
    writeHash();
    draw();
  });

  // --- view switch -----------------------------------------------------
  const viewButtons = [...document.querySelectorAll('[data-view]')];
  const applyView = () => {
    document.getElementById('chart-view').hidden = state.view !== 'chart';
    document.getElementById('table-view').hidden = state.view !== 'table';
    viewButtons.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.view === state.view)));
  };
  viewButtons.forEach((b) => b.addEventListener('click', () => {
    state.view = b.dataset.view;
    writeHash();
    applyView();
    draw();
  }));

  // --- scale + zoom ----------------------------------------------------
  const measure = () => Math.max(320, chartHost.clientWidth - LAYOUT.gutter - LAYOUT.paddingRight);
  const scale = createScale({ start: data.domain.start, end: data.domain.end, width: measure() });
  const homeDomain = scale.domain.slice();

  function draw() {
    const models = visibleModels(data);
    if (state.view === 'table') {
      buildTable(document.getElementById('table-view'), models, labById);
      return;
    }
    scale.setWidth(measure());
    chart.render(scale, models);
    document.getElementById('count').textContent =
      `${models.length} model${models.length === 1 ? '' : 's'}`;
  }

  // --- interaction -----------------------------------------------------
  const svgPoint = (evt) => {
    const rect = chart.svg.getBoundingClientRect();
    const vb = chart.svg.viewBox.baseVal;
    return {
      x: (evt.clientX - rect.left) * (vb.width / rect.width),
      y: (evt.clientY - rect.top) * (vb.height / rect.height),
    };
  };

  chartHost.addEventListener('mousemove', (evt) => {
    if (state.view !== 'chart') return;
    const { x, y } = svgPoint(evt);
    const hit = chart.hitTest(x, y);
    if (hit && hit.segment) tooltip.show(segmentTooltipHtml(hit.model, hit.segment), evt.clientX, evt.clientY);
    else tooltip.hide();
  });
  chartHost.addEventListener('mouseleave', () => tooltip.hide());

  const openRow = (modelId) => {
    const model = data.models.find((m) => m.id === modelId);
    if (!model) return;
    chartHost.querySelectorAll('.row-selected').forEach((n) => n.classList.remove('row-selected'));
    chartHost.querySelector(`[data-model="${CSS.escape(modelId)}"]`)?.classList.add('row-selected');
    panel.show(model, labById[model.lab]);
  };

  chartHost.addEventListener('click', (evt) => {
    const row = evt.target.closest('[data-model]');
    if (row) openRow(row.dataset.model);
  });

  chartHost.addEventListener('keydown', (evt) => {
    const row = evt.target.closest('[data-model]');
    if (!row) return;
    if (evt.key === 'Enter' || evt.key === ' ') {
      evt.preventDefault();
      openRow(row.dataset.model);
    }
  });

  // Focus shows the same information as hover, per the interaction rules.
  chartHost.addEventListener('focusin', (evt) => {
    const row = evt.target.closest('[data-model]');
    if (!row) return;
    const entry = chart.rowIndex.find((r) => r.model.id === row.dataset.model);
    if (!entry) return;
    const seg = entry.segments.find((s) => s.phase === 'live') || entry.segments[0];
    if (!seg) return;
    const box = row.getBoundingClientRect();
    tooltip.show(segmentTooltipHtml(entry.model, seg), box.left + 200, box.top);
  });
  chartHost.addEventListener('focusout', () => tooltip.hide());

  document.addEventListener('keydown', (evt) => {
    if (evt.key === 'Escape') { panel.hide(); tooltip.hide(); }
  });

  // Wheel zoom around the cursor; drag to pan.
  chartHost.addEventListener('wheel', (evt) => {
    if (state.view !== 'chart') return;
    evt.preventDefault();
    const { x } = svgPoint(evt);
    const anchor = scale.invert(x - LAYOUT.gutter);
    const [s, e] = scale.domain;
    const factor = evt.deltaY > 0 ? 1.15 : 1 / 1.15;
    const ns = anchor - (anchor - s) * factor;
    const ne = anchor + (e - anchor) * factor;
    if ((ne - ns) / 86400000 < 60) return;
    scale.setDomain(ns, ne);
    draw();
  }, { passive: false });

  let drag = null;
  chartHost.addEventListener('mousedown', (evt) => {
    if (state.view !== 'chart') return;
    drag = { x: evt.clientX, domain: scale.domain.slice(), moved: false };
  });
  window.addEventListener('mousemove', (evt) => {
    if (!drag) return;
    const dx = evt.clientX - drag.x;
    if (Math.abs(dx) > 3) drag.moved = true;
    const [s, e] = drag.domain;
    const shift = (dx / scale.width) * (e - s);
    scale.setDomain(s - shift, e - shift);
    draw();
  });
  window.addEventListener('mouseup', () => { drag = null; });

  document.getElementById('reset-zoom').addEventListener('click', () => {
    scale.setDomain(homeDomain[0], homeDomain[1]);
    draw();
  });

  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(draw, 120);
  });

  readHash();
  applyView();
  draw();
}

loadData().then(main).catch((err) => {
  document.getElementById('chart').innerHTML =
    `<p class="error">Could not load the dataset: ${err.message}</p>`;
  console.error(err);
});
