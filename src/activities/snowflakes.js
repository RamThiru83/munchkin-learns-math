/**
 * Game: Fold, Cut, Unfold  (id: snowflakes, level 2)
 *
 * Idea: a snip through folded paper goes through every layer, so unfolding copies it mirrored across each fold line.
 * Rounds:
 *   1. Square paper folded in half: pick a triangle / half-circle / square stamp, tap (or drag) to snip (1–6 snips), Unfold shows the mirror pattern.
 *   2. Square folded twice (quarter): at least 2 snips, Unfold shows copies across both folds.
 *   3. Round paper folded into a 30° snowflake wedge; the game makes 2 snips, child picks which of 3 open snowflakes it becomes (correct / shapes swapped / 1 or 4 copies only).
 *   4. Quarter-folded paper: snip to match a target picture (2 different shapes at 2 of: up fold, side fold, middle); a mismatch folds back up with a hint.
 *   5. An open snowflake with 3 snips: pick which of 3 folded wedges made it (correct / two shapes swapped / one snip missing), then it folds back to check.
 * Watch demo: rounds 1, 2, 4 – scissors pick each stamp, snip the demo (or target) spots, unfold, then fold back with no cuts;
 *   rounds 3, 5 – point at the paper, glow the right choice, unfold/fold to check, and leave the round unsolved.
 * Notes: every paper layer is an SVG <use> of one masked wedge moved by a 2×2 fold map (cfg.pieces); render(t) with t = 0 is
 *   fully folded, t = nseg() fully open, and cfg.boxes gives the viewBox for each stage. Taps snap onto a fold within
 *   SNAP_FOLD units, else onto a paper edge within SNAP_EDGE, else become a hole ('in'). Round 3 PAIRS are hand-checked and
 *   round 5 TRIPLES brute-force checked (cuts ≥ 5.9 units apart, inside the wedge). Shapes, pairs/triples and target spots
 *   are random each round. No exported test hooks. The drag ghost (.snf-ghost) is position:fixed and removed in destroy().
 */
import { h, sleep, shuffle, rand, pick, sfx, resumeRound } from '../lib/core.js';

// ---------- tiny SVG helper (core.h has no <mask>) ----------
// The SVG namespace is borrowed from core.h's <svg> (a literal URL would trip the no-external-URLs check).
let NS = null;
function s(tag, attrs = {}, ...kids) {
  NS ??= h('svg').namespaceURI;
  const el = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) if (v != null) el.setAttribute(k, v);
  for (const c of kids.flat()) if (c) el.append(c);
  return el;
}
let UID = 0;
const uid = (p) => `snf${++UID}${p}`;

// ---------- 2x2 linear maps [a,b,c,d]: x' = a x + c y, y' = b x + d y (all fold lines pass through 0,0) ----------
const I = [1, 0, 0, 1];
const mul = (M, N) => [
  M[0] * N[0] + M[2] * N[1],
  M[1] * N[0] + M[3] * N[1],
  M[0] * N[2] + M[2] * N[3],
  M[1] * N[2] + M[3] * N[3],
];
// Partial flip about the line through 0 with unit normal n: the normal component is scaled by c = cos(angle).
// c = 1: untouched, c = -1: the true mirror image (reflection across the fold line).
const flip = ([nx, ny], c) => [1 + (c - 1) * nx * nx, (c - 1) * nx * ny, (c - 1) * nx * ny, 1 + (c - 1) * ny * ny];
const rot = (deg) => {
  const r = (deg * Math.PI) / 180,
    co = Math.cos(r),
    si = Math.sin(r);
  return [co, si, -si, co];
};
const mstr = (M) => `matrix(${M.map((v) => v.toFixed(5)).join(',')},0,0)`;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const pol = (deg, r) => [r * Math.cos((deg * Math.PI) / 180), r * Math.sin((deg * Math.PI) / 180)];
const f3 = (v) => v.toFixed(3);
// SVG path of a pie slice from angle a0 to a1 (degrees, clockwise on screen).
const sector = (a0, a1, r) => {
  const p = pol(a0, r),
    q = pol(a1, r);
  return `M0,0L${f3(p[0])},${f3(p[1])}A${r},${r} 0 0,1 ${f3(q[0])},${f3(q[1])}Z`;
};

const NX = [1, 0],
  NY = [0, 1];
const RX = flip(NX, -1),
  RY = flip(NY, -1);
const FULL_BOX = [-112, -112, 224, 224];
// Tap/drop placement (model units): how far off the paper a tap still counts, cut size, snap distances.
const TAP_TOL = 14;
const CUT_SIZE = 16;
const SNAP_FOLD = 20;
const SNAP_EDGE = 13;
const MS_PER_FOLD = 1150; // animation time for one fold step

// Pieces for real paper folds, unfolded one fold at a time (steps listed in unfold order).
// flags[k] = 1 when that layer swings over during step k. Final map = product of reflections.
function physical(steps, flagsList) {
  return flagsList.map((fl) => (p) => {
    let M = I,
      sh = 0;
    steps.forEach((n, k) => {
      if (!fl[k]) return;
      const c = Math.cos(Math.PI * p[k]);
      M = mul(flip(n, c), M);
      sh = Math.max(sh, 1 - Math.abs(c));
    });
    return [M, sh];
  });
}
// Snowflake: a 30 degree wedge (between rays at -90 and -60). The 12 layers are the dihedral group D6:
// rot(60k) and rot(60k) after the mirror in the vertical fold. Step 1 flips the mirrored layers, step 2 fans out.
function snowPieces() {
  const out = [];
  [0, 60, 120, 180, -120, -60].forEach((phi) => {
    out.push((p) => [rot(phi * p[1]), 0]);
    out.push((p) => {
      const c = Math.cos(Math.PI * p[0]);
      return [mul(rot(phi * p[1]), flip(NX, c)), 1 - Math.abs(c)];
    });
  });
  return out;
}

const QUARTER = {
  full: 'M-100,-100H100V100H-100Z',
  D: 'M0,-100H100V0H0Z',
  Dx: 'M-1.5,-101.5H101.5V1.5H-1.5Z',
  rect: [0, -100, 100, 0],
  boxes: [[-10, -110, 120, 120], [-10, -110, 120, 220], FULL_BOX],
  pieces: physical(
    [NY, NX],
    [
      [0, 0],
      [1, 0],
      [0, 1],
      [1, 1],
    ],
  ),
  folds: [
    { a: [0, -100], b: [0, 0], n: [1, 0] },
    { a: [0, 0], b: [100, 0], n: [0, -1] },
  ],
  edges: [
    { a: [0, -100], b: [100, -100], n: [0, 1] },
    { a: [100, -100], b: [100, 0], n: [-1, 0] },
  ],
  maxCuts: 6,
  hintPt: [0, -50],
};
const SNOW = {
  full: null,
  D: sector(-90, -60, 100),
  Dx: sector(-91.2, -58.8, 114),
  boxes: [[-10, -110, 70, 120], [-60, -110, 120, 120], FULL_BOX],
  pieces: snowPieces(),
  folds: [
    { a: [0, 0], b: [0, -100] },
    { a: [0, 0], b: pol(-60, 100) },
  ],
};
// Round 4 targets: one spot per kind of place on the quarter-folded paper (f0 = up fold, f1 = side fold, in = middle).
const MAKE_PTS = { f0: [0, -50], f1: [50, 0], in: [60, -60] };

const ROUNDS = [
  {
    full: 'M-100,-100H100V100H-100Z',
    D: 'M0,-100H100V100H0Z',
    Dx: 'M-1.5,-101.5H101.5V101.5H-1.5Z',
    rect: [0, -100, 100, 100],
    boxes: [[-10, -110, 120, 220], FULL_BOX],
    pieces: physical([NX], [[0], [1]]),
    folds: [{ a: [0, -100], b: [0, 100], n: [1, 0] }],
    edges: [
      { a: [0, -100], b: [100, -100], n: [0, 1] },
      { a: [100, -100], b: [100, 100], n: [-1, 0] },
      { a: [0, 100], b: [100, 100], n: [0, -1] },
    ],
    minCuts: 1,
    maxCuts: 6,
    paper: '#ffd166',
    hintPt: [0, -40],
    demo: [
      ['half', [0, -50]],
      ['tri', [0, 45]],
    ],
    intro: 'Let us fold the paper in half.',
    ask: 'Pick a shape. Tap the fold to snip!',
    yay: ['Look! Both sides match!', 'A mirror pattern! Lovely!', 'Wow! The fold made a twin!'],
    demoEnd: 'See? The fold copies every cut, like a mirror.',
  },
  {
    ...QUARTER,
    minCuts: 2,
    paper: '#ff8fab',
    demo: [
      ['half', [0, -55]],
      ['tri', [55, 0]],
    ],
    intro: 'Now we fold it two times!',
    ask: 'Snip on the folds, then tap Unfold.',
    yay: ['Look! It matches both ways!', 'Beautiful! Every fold made a mirror.', 'Wow! Copies on every side!'],
    demoEnd: 'Two folds, so the cuts are copied across both lines.',
  },
  {
    ...SNOW,
    paper: '#ffffff',
    predict: true,
    intro: 'A round paper, folded like a snowflake!',
    ask: 'Which snowflake will it open into? Tap one!',
  },
  {
    ...QUARTER,
    minCuts: 1,
    paper: '#90e0a8',
    make: true,
    intro: 'Can you snip a paper to match a picture?',
    ask: 'Make this pattern! Snip, then tap Unfold.',
    yay: ['It matches the picture!', 'Exactly the same! Clever snipping!', 'A perfect match! Well done!'],
    demoEnd: 'It matches the picture! Same shapes, same folds.',
  },
  {
    ...SNOW,
    paper: '#fff3b0',
    reverse: true,
    intro: 'Here is an open snowflake.',
    ask: 'Which folded paper made this snowflake? Tap it!',
  },
];

// ---------- cut shapes ----------
// A cut sits with its flat base at (x,y) and grows in the inward direction (nx,ny).
function cutPts(c) {
  const { type, x, y, nx, ny, s: z } = c;
  const tx = ny,
    ty = -nx;
  const e = c.edge ? 3 : 0;
  let loc;
  if (type === 'tri')
    loc = [
      [-z, -e],
      [z, -e],
      [0, 1.5 * z],
    ];
  else if (type === 'sq')
    loc = [
      [-0.8 * z, -e],
      [0.8 * z, -e],
      [0.8 * z, 1.6 * z],
      [-0.8 * z, 1.6 * z],
    ];
  else {
    loc = [[-z, -e]];
    for (let i = 0; i <= 24; i++) {
      const a = (Math.PI * i) / 24;
      loc.push([-z * Math.cos(a), z * Math.sin(a)]);
    }
    loc.push([z, -e]);
  }
  return loc.map(([a, b]) => [x + a * tx + b * nx, y + a * ty + b * ny]);
}
const ptsStr = (P) => P.map((p) => `${p[0].toFixed(2)},${p[1].toFixed(2)}`).join(' ');
const cutPoly = (c, attrs = { fill: '#000' }) => s('polygon', { points: ptsStr(cutPts(c)), ...attrs });
const HT = { tri: 1.5, sq: 1.6, half: 1 };

// Closest point to q on segment ed, with its distance.
function proj(q, ed) {
  const dx = ed.b[0] - ed.a[0],
    dy = ed.b[1] - ed.a[1];
  const t = clamp(((q[0] - ed.a[0]) * dx + (q[1] - ed.a[1]) * dy) / (dx * dx + dy * dy), 0, 1);
  const pt = [ed.a[0] + t * dx, ed.a[1] + t * dy];
  return { pt, d: Math.hypot(q[0] - pt[0], q[1] - pt[1]), ed };
}
// Turn a tap (model coords) into a cut: snap onto a nearby fold (or paper edge), else a hole punched inside.
function placeAt(cfg, p, type) {
  const [x0, y0, x1, y1] = cfg.rect;
  const tol = TAP_TOL,
    z = CUT_SIZE;
  if (p[0] < x0 - tol || p[0] > x1 + tol || p[1] < y0 - tol || p[1] > y1 + tol) return null;
  const q = [clamp(p[0], x0, x1), clamp(p[1], y0, y1)];
  const near = (E) => E.map((ed) => proj(q, ed)).sort((a, b) => a.d - b.d)[0];
  const f = near(cfg.folds),
    o = near(cfg.edges);
  const mk = (pt, n, edge, loc) => ({ type, x: pt[0], y: pt[1], nx: n[0], ny: n[1], s: z, edge, loc });
  if (f.d < SNAP_FOLD) return mk(f.pt, f.ed.n, true, 'f' + cfg.folds.indexOf(f.ed));
  if (o.d < SNAP_EDGE) return mk(o.pt, o.ed.n, true, 'e' + cfg.edges.indexOf(o.ed));
  const hh = (HT[type] * z) / 2,
    n = f.ed.n;
  return mk([q[0] - n[0] * hh, q[1] - n[1] * hh], n, false, 'in');
}

// ---------- snowflake puzzle cuts (round 3) ----------
const LA = { dir: [0, -1], n: [1, 0] };
const LB = { dir: [0.5, -0.8660254], n: [-0.8660254, -0.5] };
const onLine = (L, r, type, z) => ({
  type,
  x: L.dir[0] * r,
  y: L.dir[1] * r,
  nx: L.n[0],
  ny: L.n[1],
  s: z,
  edge: true,
});
const rim = (type, z = 15) => ({ type, x: 25.882, y: -96.593, nx: -0.258819, ny: 0.9659258, s: z, edge: true });
// Hand-checked pairs: the two cuts never touch, for every shape type.
const PAIRS = [
  (a, b) => [onLine(LA, 50, a, 12), rim(b)],
  (a, b) => [onLine(LB, 50, a, 12), rim(b)],
  (a, b) => [onLine(LA, 50, a, 12), onLine(LB, 78, b, 15)],
  (a, b) => [onLine(LB, 50, a, 12), onLine(LA, 78, b, 15)],
];
// Round 5: three snips. Brute-force checked (all 6 shape orders): cuts stay >= 5.9 units apart and inside the wedge.
const TRIPLES = [
  (a, b, c) => [onLine(LA, 65, a, 10), onLine(LB, 50, b, 10), rim(c, 13)],
  (a, b, c) => [onLine(LA, 50, a, 10), onLine(LB, 65, b, 10), rim(c, 13)],
];
const HINTS = {
  miss: 'Count the kinds of shapes. Are they all there?',
  swap: 'Look at each shape. Where is it on the fold?',
  one: 'Every layer gets snipped. So there are many copies!',
  four: 'A snowflake has six arms. Count them!',
};

// A finished (unfolded) pattern: the cuts in the folded wedge, copied by every map in `mats`.
function patternSVG(cfg, cuts, mats) {
  const id = uid('p');
  const mask = s(
    'mask',
    { id: id + 'k', maskUnits: 'userSpaceOnUse', x: -130, y: -130, width: 260, height: 260 },
    s('rect', { x: -130, y: -130, width: 260, height: 260, fill: '#fff' }),
    mats.map((M) =>
      s(
        'g',
        { transform: mstr(M) },
        s(
          'g',
          { 'clip-path': `url(#${id}c)` },
          cuts.map((c) => cutPoly(c)),
        ),
      ),
    ),
  );
  return s(
    'svg',
    { viewBox: '-108 -108 216 216', class: 'thumb', 'aria-hidden': 'true' },
    s('defs', {}, s('clipPath', { id: id + 'c' }, s('path', { d: cfg.Dx })), mask),
    cfg.full
      ? s('path', { d: cfg.full, fill: cfg.paper, mask: `url(#${id}k)` })
      : s('circle', { cx: 0, cy: 0, r: 100, fill: cfg.paper, mask: `url(#${id}k)` }),
  );
}
// The folded snowflake wedge with its snips (round 5 choices).
function wedgeSVG(cfg, cuts) {
  const id = uid('w');
  const mask = s(
    'mask',
    { id: id + 'k', maskUnits: 'userSpaceOnUse', x: -130, y: -130, width: 260, height: 260 },
    s('rect', { x: -130, y: -130, width: 260, height: 260, fill: '#fff' }),
    s(
      'g',
      { 'clip-path': `url(#${id}c)` },
      cuts.map((c) => cutPoly(c)),
    ),
  );
  return s(
    'svg',
    { viewBox: '-31 -108 112 112', class: 'thumb', 'aria-hidden': 'true' },
    s('defs', {}, s('clipPath', { id: id + 'c' }, s('path', { d: cfg.Dx })), mask),
    s('path', { d: cfg.D, fill: cfg.paper, mask: `url(#${id}k)` }),
    cfg.folds.map((f) =>
      s('line', {
        x1: f.a[0],
        y1: f.a[1],
        x2: f.b[0],
        y2: f.b[1],
        stroke: '#2b2d42',
        'stroke-opacity': 0.4,
        'stroke-width': 2,
        'stroke-dasharray': '5 4',
      }),
    ),
  );
}

function stampIcon(type) {
  return s(
    'svg',
    { viewBox: '-20 -20 40 40', width: 40, height: 40, 'aria-hidden': 'true' },
    cutPoly({ type, x: 0, y: 10, nx: 0, ny: -1, s: 12, edge: false }, { fill: '#2b2d42' }),
    s('line', { x1: -18, y1: 10, x2: 18, y2: 10, stroke: '#9b5de5', 'stroke-width': 3.5, 'stroke-dasharray': '4 3' }),
  );
}
const STAMPS = [
  ['tri', 'Triangle snip'],
  ['half', 'Half circle snip'],
  ['sq', 'Square snip'],
];
const SHAPE_NAME = { tri: 'triangle', half: 'half circle', sq: 'square' };

const CSS = `
.a-snowflakes{position:relative;width:100%;max-width:760px;display:flex;flex-direction:column;align-items:center;gap:12px;padding-bottom:8px}
.a-snowflakes .board{width:min(440px,94%,52vh);aspect-ratio:1/1;border:3px solid #2b2d42;border-radius:26px;overflow:hidden;box-shadow:0 6px 0 rgba(43,45,66,.15);
  background:radial-gradient(circle,rgba(255,255,255,.32) 0 3px,transparent 4px) 0 0/26px 26px,linear-gradient(135deg,#4cc9f0,#7b6cf6 60%,#9b5de5)}
.a-snowflakes.small .board{width:min(360px,78%,40vh)}
.a-snowflakes .goal{display:flex;align-items:center;gap:12px;background:#fff;border:3px solid #2b2d42;border-radius:20px;padding:6px 14px 6px 6px;box-shadow:0 4px 0 rgba(43,45,66,.15);max-width:100%}
.a-snowflakes .goal:empty{display:none}
.a-snowflakes .goal .tb{width:min(120px,28vw);aspect-ratio:1/1;border-radius:14px;background:linear-gradient(135deg,#4cc9f0,#7b6cf6 60%,#9b5de5)}
.a-snowflakes .goal b{font-size:1.25rem}
.a-snowflakes svg.paper{display:block;width:100%;height:100%;filter:drop-shadow(0 4px 0 rgba(43,45,66,.3));cursor:crosshair;touch-action:manipulation}
.a-snowflakes .tools .chip{width:64px;height:64px;padding:0}
.a-snowflakes .tools .chip:disabled,.a-snowflakes .choice:disabled{opacity:.55;cursor:default}
.a-snowflakes .unfold{font-size:1.15rem;min-height:60px;padding:.4em 1.4em}
.a-snowflakes .undo{font-size:1.6rem}
.a-snowflakes .choices .choice{width:min(172px,27vw);height:auto;aspect-ratio:1/1;padding:5px;border-radius:22px;transition:transform .15s}
.a-snowflakes .choice .tb{width:100%;height:100%;border-radius:15px;background:linear-gradient(135deg,#4cc9f0,#7b6cf6 60%,#9b5de5)}
.a-snowflakes svg.thumb{display:block;width:100%;height:100%;filter:drop-shadow(0 2px 0 rgba(43,45,66,.3))}
.a-snowflakes .choice.right{background:#06d6a0;transform:scale(1.06)}
.a-snowflakes .hintmark{animation:snfPulse 1s ease-in-out infinite}
@keyframes snfPulse{50%{opacity:.2}}
.a-snowflakes .scissors{position:absolute;left:50%;top:40%;font-size:2.6rem;line-height:1;pointer-events:none;z-index:20;display:none;transform:translate(-20%,-30%);filter:drop-shadow(0 3px 2px rgba(0,0,0,.3))}
.a-snowflakes .scissors.on{display:block}
.snf-ghost{position:fixed;z-index:2000;pointer-events:none;transform:translate(-50%,-50%) scale(1.4);opacity:.85;display:none}
@media (max-width:420px){.a-snowflakes .tools{gap:8px}.a-snowflakes .tools .chip{width:58px;height:58px}}
`;

export default {
  id: 'snowflakes',
  rounds: ROUNDS.length,
  parentNote:
    'Folding makes copies: each snip goes through every layer, so it comes back mirrored across each fold line; a half circle on the fold opens into a whole circle. Before she taps Unfold, ask "What will we see, and where?" Rounds 4 and 5 run it backwards: she snips a paper to match a picture, then works out which folded paper made a finished snowflake.',
  async start(api) {
    let alive = true;
    api.css(CSS);
    const wrap = h('div', { class: 'a-snowflakes' });
    api.root.append(wrap);
    const board = h('div', { class: 'board' });
    const tools = h('div', { class: 'tools act-row' });
    const choicesRow = h('div', { class: 'choices act-row' });
    const goalRow = h('div', { class: 'goal' });
    const nextRow = h('div', { class: 'act-row' });
    const scissors = h('div', { class: 'scissors', 'aria-hidden': 'true' }, '✂️');
    const ghost = h('div', { class: 'snf-ghost', 'aria-hidden': 'true' });
    wrap.append(goalRow, board, tools, choicesRow, nextRow, scissors, ghost);

    let R = null;
    let busy = false;
    let wrongs = 0;
    let selType = 'half';
    let svg,
      cutsG,
      uses,
      hintG,
      stampBtns = {},
      undoBtn,
      unfoldBtn,
      choiceBtns = [];

    // ---------- main paper ----------
    function buildPaper(cfg) {
      const id = uid('m');
      cutsG = s('g', { fill: '#000' });
      const mask = s(
        'mask',
        { id: id + 'k', maskUnits: 'userSpaceOnUse', x: -130, y: -130, width: 260, height: 260 },
        s('rect', { x: -130, y: -130, width: 260, height: 260, fill: '#fff' }),
        cutsG,
      );
      const creases = cfg.folds.map((f) =>
        s('line', {
          x1: f.a[0],
          y1: f.a[1],
          x2: f.b[0],
          y2: f.b[1],
          stroke: '#2b2d42',
          'stroke-opacity': 0.4,
          'stroke-width': 3,
          'stroke-dasharray': '6 5',
          fill: 'none',
        }),
      );
      // One folded layer. Every layer of the paper is a <use> of it, moved by its fold map.
      const content = s(
        'g',
        { id: id + 'g', 'clip-path': `url(#${id}c)` },
        s(
          'g',
          { mask: `url(#${id}k)` },
          s('path', { d: cfg.D, fill: cfg.paper, 'fill-opacity': 1 }),
          s('path', { d: cfg.D, fill: '#2b2d42' }), // shading: inherits fill-opacity from the <use>
          creases,
        ),
      );
      uses = cfg.pieces.map(() => s('use', { href: `#${id}g`, 'fill-opacity': 0 }));
      hintG = s('g', { 'clip-path': `url(#${id}c)` });
      svg = s(
        'svg',
        { class: 'paper', viewBox: cfg.boxes[0].join(' '), role: 'img', 'aria-label': 'Folded paper. Tap it to snip.' },
        s('defs', {}, s('clipPath', { id: id + 'c' }, s('path', { d: cfg.D })), mask, content),
        s('g', {}, uses),
        hintG,
      );
      svg.addEventListener('click', (e) => tryPlace(e.clientX, e.clientY));
      board.replaceChildren(svg);
    }
    const nseg = () => R.cfg.boxes.length - 1;
    // Draw fold progress t (0 = fully folded .. nseg() = fully open): step k runs over t in [k, k+1].
    // Each layer gets its fold map and a shade while it swings; the viewBox eases between cfg.boxes.
    function render(t) {
      const cfg = R.cfg,
        n = nseg();
      const p = Array.from({ length: n }, (_, k) => ease(clamp(t - k, 0, 1)));
      cfg.pieces.forEach((f, i) => {
        const [M, sh] = f(p);
        uses[i].setAttribute('transform', mstr(M));
        uses[i].setAttribute('fill-opacity', (sh * 0.3).toFixed(3));
      });
      t = clamp(t, 0, n);
      const k = Math.min(n - 1, Math.floor(t));
      const u = ease(clamp(t - k, 0, 1));
      const A = cfg.boxes[k],
        B = cfg.boxes[k + 1];
      svg.setAttribute('viewBox', A.map((v, j) => lerp(v, B[j], u).toFixed(2)).join(' '));
    }
    function animate(from, to, msPer = MS_PER_FOLD) {
      busy = true;
      const dur = Math.abs(to - from) * msPer;
      const t0 = performance.now();
      return new Promise((res) => {
        const step = (now) => {
          if (!alive) return res();
          const u = clamp((now - t0) / dur, 0, 1);
          render(lerp(from, to, u));
          if (u < 1) requestAnimationFrame(step);
          else {
            busy = false;
            res();
          }
        };
        requestAnimationFrame(step);
      });
    }
    // Screen (client) <-> paper model coordinates.
    const toModel = (cx, cy) => {
      const p = new DOMPoint(cx, cy).matrixTransform(svg.getScreenCTM().inverse());
      return [p.x, p.y];
    };
    const toClient = (pt) => {
      const p = new DOMPoint(pt[0], pt[1]).matrixTransform(svg.getScreenCTM());
      return [p.x, p.y];
    };

    function addCut(c) {
      R.cuts.push(c);
      cutsG.append(cutPoly(c));
    }
    function clearCuts() {
      R.cuts = [];
      cutsG.replaceChildren();
    }
    function clearHint() {
      hintG.replaceChildren();
      Object.values(stampBtns).forEach((b) => b.classList.remove('glow'));
      unfoldBtn?.classList.remove('glow');
      undoBtn?.classList.remove('glow');
    }

    // ---------- feedback ----------
    function wrong(msg, strong) {
      wrongs++;
      api.nudge(msg);
      if (wrongs >= 2) strong?.();
    }
    function hintFold() {
      clearHint();
      const c = placeAt(R.cfg, R.cfg.hintPt, selType);
      hintG.append(
        cutPoly(c, {
          class: 'hintmark',
          fill: 'rgba(255,255,255,.55)',
          stroke: '#2b2d42',
          'stroke-width': 2.5,
          'stroke-dasharray': '5 4',
        }),
      );
      stampBtns[selType]?.classList.add('glow');
    }
    function shake(el) {
      el.classList.remove('shake');
      void el.offsetWidth;
      el.classList.add('shake');
    }

    // ---------- rounds 1-2: cutting ----------
    function select(type) {
      selType = type;
      for (const [t, b] of Object.entries(stampBtns)) {
        b.classList.toggle('sel', t === type);
        b.setAttribute('aria-pressed', String(t === type));
      }
    }
    let dragSt = null;
    function buildTools() {
      stampBtns = {};
      for (const [type, label] of STAMPS) {
        const b = h('button', { class: 'chip', 'aria-label': label, 'aria-pressed': 'false' }, stampIcon(type));
        b.addEventListener('pointerdown', (e) => {
          if (busy || b.disabled) return;
          select(type);
          sfx('tap');
          dragSt = { sx: e.clientX, sy: e.clientY, moved: false };
          b.setPointerCapture?.(e.pointerId);
        });
        b.addEventListener('pointermove', (e) => {
          if (!dragSt) return;
          if (!dragSt.moved && Math.hypot(e.clientX - dragSt.sx, e.clientY - dragSt.sy) > 10) {
            dragSt.moved = true;
            ghost.replaceChildren(stampIcon(type));
            ghost.style.display = 'block';
          }
          if (dragSt.moved) {
            ghost.style.left = e.clientX + 'px';
            ghost.style.top = e.clientY + 'px';
          }
        });
        const end = (e, drop) => {
          const st = dragSt;
          dragSt = null;
          ghost.style.display = 'none';
          b.releasePointerCapture?.(e.pointerId);
          if (drop && st?.moved) tryPlace(e.clientX, e.clientY, true);
        };
        b.addEventListener('pointerup', (e) => end(e, true));
        b.addEventListener('pointercancel', (e) => end(e, false));
        b.style.touchAction = 'none';
        stampBtns[type] = b;
      }
      undoBtn = h(
        'button',
        {
          class: 'chip undo',
          'aria-label': 'Undo last snip',
          onclick: () => {
            if (busy || !R.cuts.length) return;
            R.cuts.pop();
            cutsG.lastChild?.remove();
            sfx('drop');
          },
        },
        '↩️',
      );
      unfoldBtn = h('button', { class: 'btn primary unfold', onclick: doUnfold }, 'Unfold ✨');
      tools.replaceChildren(...Object.values(stampBtns), undoBtn, unfoldBtn);
      select(pick(['tri', 'half', 'sq']));
    }
    function setTools(on) {
      tools.querySelectorAll('button').forEach((b) => {
        b.disabled = !on;
      });
    }

    function tryPlace(cx, cy, dropped) {
      if (busy || !R || !R.ready || R.cfg.predict || R.cfg.reverse || R.unfolded) return;
      const r = svg.getBoundingClientRect();
      if (dropped && (cx < r.left || cx > r.right || cy < r.top || cy > r.bottom)) {
        wrong('Drop the shape on the paper.', hintFold);
        return;
      }
      if (R.cuts.length >= R.cfg.maxCuts) {
        wrong('So many snips! Now tap Unfold.', () => unfoldBtn.classList.add('glow'));
        return;
      }
      const c = placeAt(R.cfg, toModel(cx, cy), selType);
      if (!c) {
        wrong('Tap right on the paper to snip.', hintFold);
        return;
      }
      addCut(c);
      wrongs = 0;
      clearHint();
      sfx('pop');
      const n = R.cuts.length;
      if (n < R.cfg.minCuts) api.prompt('One more snip, please!');
      else if (n === R.cfg.minCuts) api.prompt('Snip more, or tap Unfold!');
    }

    async function doUnfold() {
      if (busy || !R.ready || R.unfolded) return;
      if (R.cuts.length < R.cfg.minCuts) {
        wrong(R.cuts.length ? 'Snip one more shape first.' : 'First snip a shape on the paper.', hintFold);
        return;
      }
      R.unfolded = true;
      clearHint();
      setTools(false);
      sfx('whoosh');
      await animate(0, nseg());
      if (!alive) return;
      if (R.cfg.make) {
        const miss = makeMismatch();
        if (miss) {
          busy = true;
          wrongs++;
          api.nudge(miss);
          await sleep(2600);
          if (!alive) return;
          sfx('flip');
          await animate(nseg(), 0);
          if (!alive) return;
          R.unfolded = false;
          setTools(true);
          if (wrongs >= 2) hintTarget();
          return;
        }
      }
      wrongs = 0;
      api.cheer(pick(R.cfg.yay));
      showNext();
    }
    function showNext() {
      nextRow.replaceChildren(
        h(
          'button',
          {
            class: 'btn primary',
            onclick: (e) => {
              e.currentTarget.disabled = true;
              sfx('tap');
              startRound(R.i + 1);
            },
          },
          'Next paper ▶',
        ),
      );
    }

    // ---------- round 4: make the pattern ----------
    const keyOf = (c) => c.type + '@' + c.loc;
    function buildTarget() {
      const locs = shuffle(Object.keys(MAKE_PTS)).slice(0, 2),
        types = shuffle(['tri', 'half', 'sq']).slice(0, 2);
      R.target = locs.map((loc, k) => {
        const c = placeAt(R.cfg, MAKE_PTS[loc], types[k]);
        return { type: types[k], pt: MAKE_PTS[loc], cut: c, key: keyOf(c) };
      });
      const finals = R.cfg.pieces.map((f) => f([1, 1])[0]);
      goalRow.replaceChildren(
        h(
          'div',
          { class: 'tb' },
          patternSVG(
            R.cfg,
            R.target.map((t) => t.cut),
            finals,
          ),
        ),
        h('b', {}, 'Make this!'),
      );
    }
    function missingTargets() {
      const have = R.cuts.map(keyOf);
      return R.target.filter((t) => {
        const i = have.indexOf(t.key);
        if (i < 0) return true;
        have.splice(i, 1);
        return false;
      });
    }
    // '' when the cuts match the target exactly (same shape at the same kind of place), else a hint message.
    function makeMismatch() {
      const want = R.target
          .map((t) => t.key)
          .sort()
          .join(),
        got = R.cuts.map(keyOf).sort().join();
      if (want === got) return '';
      if (R.cuts.length !== R.target.length) return 'The picture has two kinds of shapes. Snip two.';
      const tw = R.target
          .map((t) => t.type)
          .sort()
          .join(),
        tg = R.cuts
          .map((c) => c.type)
          .sort()
          .join();
      if (tw !== tg) return 'Look closely at the shapes in the picture.';
      return 'Look where each shape sits. On which fold?';
    }
    function hintTarget() {
      clearHint();
      const t = missingTargets()[0];
      if (!t) {
        undoBtn.classList.add('glow');
        return;
      }
      hintG.append(
        cutPoly(t.cut, {
          class: 'hintmark',
          fill: 'rgba(255,255,255,.55)',
          stroke: '#2b2d42',
          'stroke-width': 2.5,
          'stroke-dasharray': '5 4',
        }),
      );
      stampBtns[t.type]?.classList.add('glow');
      if (R.cuts.length >= R.target.length) undoBtn.classList.add('glow');
    }

    // ---------- round 3: predict ----------
    function buildChoices() {
      const pi = rand(PAIRS.length);
      const [t1, t2] = shuffle(['tri', 'half', 'sq']);
      const cuts = PAIRS[pi](t1, t2);
      const finals = R.cfg.pieces.map((f) => f([1, 1])[0]);
      const other = pick(['one', 'four']);
      const opts = shuffle([
        { kind: 'ok', cuts, mats: finals },
        { kind: 'swap', cuts: PAIRS[pi](t2, t1), mats: finals },
        { kind: other, cuts, mats: other === 'one' ? [I] : [I, RX, RY, mul(RX, RY)] },
      ]);
      choiceBtns = opts.map((o, i) => {
        const b = h(
          'button',
          { class: 'chip choice', 'aria-label': `Snowflake ${i + 1}` },
          h('div', { class: 'tb' }, patternSVG(R.cfg, o.cuts, o.mats)),
        );
        b._opt = o;
        b.addEventListener('click', () => choose(b));
        return b;
      });
      return cuts;
    }
    // ---------- round 5: which folded paper made it? ----------
    function buildReverse() {
      const T = pick(TRIPLES);
      const [a, b, c] = shuffle(['tri', 'half', 'sq']);
      const cuts = T(a, b, c);
      const swapped = pick([T(b, a, c), T(c, b, a), T(a, c, b)]);
      const drop = rand(3);
      const opts = shuffle([
        { kind: 'ok', cuts },
        { kind: 'swap', cuts: swapped },
        { kind: 'miss', cuts: cuts.filter((_, k) => k !== drop) },
      ]);
      choiceBtns = opts.map((o, i) => {
        const btn = h(
          'button',
          { class: 'chip choice', 'aria-label': `Folded paper ${i + 1}` },
          h('div', { class: 'tb' }, wedgeSVG(R.cfg, o.cuts)),
        );
        btn._opt = o;
        btn.addEventListener('click', () => choose(btn));
        return btn;
      });
      return cuts;
    }
    async function choose(b) {
      if (busy || !R.ready || R.solved) return;
      const o = b._opt;
      if (o.kind !== 'ok') {
        shake(b);
        sfx('drop');
        wrong(HINTS[o.kind], () => choiceBtns.find((x) => x._opt.kind === 'ok').classList.add('glow'));
        return;
      }
      R.solved = true;
      wrongs = 0;
      b.classList.add('right');
      b.classList.remove('glow');
      choiceBtns.forEach((x) => {
        if (x !== b) x.disabled = true;
      });
      busy = true;
      if (R.cfg.reverse) {
        api.cheer(
          pick([
            'Yes! Let us fold it back and check.',
            'Good thinking! Let us fold it up.',
            'I think so too! Let us see.',
          ]),
        );
        await sleep(1400);
        if (!alive) return;
        sfx('flip');
        await animate(nseg(), 0);
        if (!alive) return;
        api.cheer('It folds right back into that paper!');
      } else {
        api.cheer(
          pick(['Yes! Let us open it and check.', 'Good thinking! Let us unfold it.', 'I think so too! Let us see.']),
        );
        await sleep(1400);
        if (!alive) return;
        sfx('whoosh');
        await animate(0, nseg());
        if (!alive) return;
        api.cheer('It matches! A real snowflake!');
      }
      if (R.i < ROUNDS.length - 1) {
        showNext();
        return;
      }
      busy = true;
      await sleep(2800);
      if (!alive) return;
      api.finish();
    }

    // ---------- round flow ----------
    async function startRound(i) {
      if (!alive) return;
      const cfg = ROUNDS[i];
      R = { i, cfg, cuts: [], unfolded: false, solved: false, ready: false };
      api.stage(i, ROUNDS.length);
      wrongs = 0;
      wrap.classList.toggle('small', !!(cfg.predict || cfg.reverse || cfg.make));
      tools.replaceChildren();
      choicesRow.replaceChildren();
      nextRow.replaceChildren();
      goalRow.replaceChildren();
      choiceBtns = [];
      buildPaper(cfg);
      render(nseg());
      api.prompt(cfg.intro);
      if (cfg.reverse) {
        busy = true;
        buildReverse().forEach(addCut);
        sfx('flip');
        await sleep(1800);
        if (!alive) return;
        choicesRow.replaceChildren(...choiceBtns);
        busy = false;
        R.ready = true;
        api.prompt(cfg.ask);
        return;
      }
      if (cfg.make) buildTarget();
      busy = true;
      await sleep(1100);
      if (!alive) return;
      if (i > 0) sfx('flip');
      await animate(nseg(), 0);
      if (!alive) return;
      if (!cfg.predict) {
        buildTools();
        api.prompt(cfg.ask);
        R.ready = true;
        return;
      }
      busy = true;
      api.prompt('Look! I snipped the folded paper.');
      const cuts = buildChoices();
      for (const c of cuts) {
        await sleep(700);
        if (!alive) return;
        addCut(c);
        sfx('pop');
      }
      await sleep(700);
      if (!alive) return;
      choicesRow.replaceChildren(...choiceBtns);
      busy = false;
      R.ready = true;
      api.prompt(cfg.ask);
    }

    // ---------- Watch demo ----------
    async function scissorsTo(x, y, ms = 650) {
      const r = wrap.getBoundingClientRect();
      scissors.classList.add('on');
      scissors.style.transition = `left ${ms}ms ease-in-out, top ${ms}ms ease-in-out`;
      scissors.style.left = x - r.left + 'px';
      scissors.style.top = y - r.top + 'px';
      await sleep(ms + 60);
    }
    const centre = (el) => {
      const r = el.getBoundingClientRect();
      return [r.left + r.width / 2, r.top + r.height / 2];
    };
    const hideScissors = () => scissors.classList.remove('on');

    // Demo for the snipping rounds: refold if needed, snip the demo/target spots, unfold, then refold and clear.
    async function demoCut() {
      const cfg = R.cfg;
      if (R.unfolded) {
        nextRow.replaceChildren();
        await animate(nseg(), 0);
        if (!alive) return;
        R.unfolded = false;
      }
      clearCuts();
      clearHint();
      setTools(true);
      const steps = cfg.make ? R.target.map((t) => [t.type, t.pt]) : cfg.demo;
      for (const [k, [type, pt]] of steps.entries()) {
        await scissorsTo(...centre(stampBtns[type]));
        if (!alive) return;
        select(type);
        sfx('tap');
        api.say(`${k ? 'Now' : 'First,'} pick the ${SHAPE_NAME[type]}.`);
        await sleep(1300);
        if (!alive) return;
        await scissorsTo(...toClient(pt));
        if (!alive) return;
        const c = placeAt(cfg, pt, type);
        addCut(c);
        sfx('pop');
        api.say(c.loc === 'in' ? 'Snip, in the middle of the paper.' : 'Snip, right on the fold!');
        await sleep(1400);
        if (!alive) return;
      }
      await scissorsTo(...centre(unfoldBtn));
      if (!alive) return;
      api.say('Now, unfold!');
      setTools(false);
      sfx('whoosh');
      await animate(0, nseg());
      if (!alive) return;
      api.say(cfg.demoEnd);
      await sleep(3000);
      if (!alive) return;
      hideScissors();
      sfx('flip');
      await animate(nseg(), 0);
      if (!alive) return;
      clearCuts();
      setTools(true);
      api.prompt('Your turn! ' + cfg.ask);
    }
    async function demoPredict() {
      const ok = choiceBtns.find((x) => x._opt.kind === 'ok');
      await scissorsTo(...centre(board));
      if (!alive) return;
      api.say('Every layer gets the same snips.');
      await sleep(1800);
      if (!alive) return;
      await scissorsTo(...centre(ok));
      if (!alive) return;
      ok.classList.add('glow');
      api.say('So this snowflake matches.');
      await sleep(1800);
      if (!alive) return;
      hideScissors();
      api.say('Let us unfold and check.');
      sfx('whoosh');
      await animate(0, nseg());
      if (!alive) return;
      await sleep(2500);
      if (!alive) return;
      sfx('flip');
      await animate(nseg(), 0);
      if (!alive) return;
      ok.classList.remove('glow');
      api.prompt('Your turn! Tap the matching snowflake.');
    }
    async function demoReverse() {
      const ok = choiceBtns.find((x) => x._opt.kind === 'ok');
      await scissorsTo(...centre(board));
      if (!alive) return;
      api.say('Look at the shapes on each arm.');
      await sleep(2000);
      if (!alive) return;
      await scissorsTo(...centre(ok));
      if (!alive) return;
      ok.classList.add('glow');
      api.say('This folded paper has the same shapes, in the same places.');
      await sleep(2400);
      if (!alive) return;
      hideScissors();
      api.say('Let us fold it up and check.');
      sfx('flip');
      await animate(nseg(), 0);
      if (!alive) return;
      await sleep(2500);
      if (!alive) return;
      sfx('whoosh');
      await animate(0, nseg());
      if (!alive) return;
      ok.classList.remove('glow');
      api.prompt('Your turn! Tap the paper that made it.');
    }
    api.setDemo(async () => {
      for (let k = 0; k < 200 && alive && (busy || !R || !R.ready); k++) await sleep(100);
      if (!alive || !R || !R.ready || R.solved) return;
      try {
        if (R.cfg.reverse) await demoReverse();
        else if (R.cfg.predict) await demoPredict();
        else await demoCut();
      } finally {
        if (alive) hideScissors();
      }
    });

    startRound(resumeRound(api, ROUNDS.length));
    return {
      destroy() {
        alive = false;
        ghost.remove();
      },
    };
  },
};
