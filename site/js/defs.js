// SVG <defs>: hatch patterns for pre-release/sunset phases, and the edge-fade
// gradients that encode date precision.
//
// Gradients are generated per (lab, side, widthPx) because an SVG gradient in
// objectBoundingBox units would stretch with the segment; the fade must instead
// cover a fixed number of DAYS, which is a fixed pixel width at a given zoom.
// They are rebuilt on zoom.

const SVG_NS = 'http://www.w3.org/2000/svg';

export function el(name, attrs = {}) {
  const node = document.createElementNS(SVG_NS, name);
  for (const [k, v] of Object.entries(attrs)) {
    if (v !== null && v !== undefined) node.setAttribute(k, String(v));
  }
  return node;
}

/**
 * Diagonal hatch, used for the pre-release phase (45°) and the sunset phase
 * (135°). Direction distinguishes "not yet released" from "on the way out"
 * without relying on colour, which matters under CVD and in forced-colors mode.
 */
function hatchPattern(id, color, angle) {
  const p = el('pattern', {
    id, width: 6, height: 6, patternUnits: 'userSpaceOnUse',
    patternTransform: `rotate(${angle})`,
  });
  p.appendChild(el('rect', { width: 6, height: 6, fill: color, 'fill-opacity': 0.18 }));
  p.appendChild(el('line', { x1: 0, y1: 0, x2: 0, y2: 6, stroke: color, 'stroke-width': 2, 'stroke-opacity': 0.75 }));
  return p;
}

/**
 * Horizontal fade from transparent to solid (side='start') or solid to
 * transparent (side='end'), in userSpaceOnUse so the fade width is exact.
 */
function edgeGradient(id, color, side, x0, x1) {
  const g = el('linearGradient', { id, gradientUnits: 'userSpaceOnUse', x1: x0, y1: 0, x2: x1, y2: 0 });
  const stops = side === 'start'
    ? [[0, 0], [1, 1]]
    : [[0, 1], [1, 0]];
  for (const [offset, opacity] of stops) {
    g.appendChild(el('stop', { offset, 'stop-color': color, 'stop-opacity': opacity }));
  }
  return g;
}

export class Defs {
  constructor(svg) {
    this.node = el('defs');
    svg.appendChild(this.node);
    this.gradientCache = new Map();
    this.staticDone = new Set();
  }

  /** Per-lab hatch patterns. Idempotent. */
  ensureLab(labId, color) {
    if (this.staticDone.has(labId)) return;
    this.staticDone.add(labId);
    this.node.appendChild(hatchPattern(`hatch-pre-${labId}`, color, 45));
    this.node.appendChild(hatchPattern(`hatch-sunset-${labId}`, color, 135));
  }

  /**
   * A fade gradient spanning [x0, x1] in chart pixel space. Returns the url(#id)
   * reference. Cached by rounded coordinates so panning reuses gradients.
   */
  edgeFade(labId, color, side, x0, x1) {
    const key = `${labId}-${side}-${Math.round(x0)}-${Math.round(x1)}`;
    if (!this.gradientCache.has(key)) {
      const id = `fade-${key}`;
      this.node.appendChild(edgeGradient(id, color, side, x0, x1));
      this.gradientCache.set(key, `url(#${id})`);
    }
    return this.gradientCache.get(key);
  }

  /** Gradients are position-dependent, so they are discarded when the domain moves. */
  clearGradients() {
    for (const ref of this.gradientCache.values()) {
      const id = ref.slice(5, -1);
      const node = this.node.querySelector(`#${CSS.escape(id)}`);
      if (node) node.remove();
    }
    this.gradientCache.clear();
  }
}
