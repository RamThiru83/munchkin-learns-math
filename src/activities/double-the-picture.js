/**
 * Game: Make It Twice as Big  (id: double-the-picture, level 4)
 *
 * Idea: scaling a picture means every line gets k times longer (a line 1 across and 2 up becomes 2 across and 4 up).
 * Rounds (each round picks one shape at random from its list; the child taps grid dots on the big grid):
 *   1. Twice as big (k=2), 3x3 model: open L / stairs / chair shapes; start at the green dot.
 *   2. Twice as big (k=2), 4x4 model: closed house / boat / arrow.
 *   3. Three times as big (k=3), 3x3 model: tiny house / flag / mountain.
 *   4. Twice as big (k=2), 4x4 model: trickier closed crown / castle / rocket.
 *   5. Four times as big (k=4), 2x2 model: little house / kite / lightning / steps.
 * Watch demo: clears the drawing, then for each line says the model vector and its k-times vector and draws it.
 * Notes:
 *   - Test hook: `candidates(pts, k)` is exported (all accepted drawing orders in big-grid coordinates).
 *     Open shapes are accepted from either end; closed shapes from any corner, either direction.
 *   - A tap is accepted if it matches the next point of any still-possible candidate; `R.cands[0]` is the
 *     reference path used for hints, the demo and the finished fill.
 *   - Hints: 1st miss = text + flashing model line; 2nd miss in a row = vector words + glowing target dot.
 *   - `layout()` switches between side-by-side and stacked grids by available width/height; keep it in sync with the CSS.
 */
import { h, sleep, pick, sfx, COLORS, resumeRound } from '../lib/core.js';

// ---------- constants ----------
const ID = 'double-the-picture';
const U = 40; // viewBox units per grid cell
const P = 18; // viewBox padding around a grid
const INK = '#2b2d42';

// Shapes live on a small model grid (m x m cells). The child draws the same shape k times as big on a (k*m) grid.
// pts = corners in drawing order. If the last point equals the first the shape is closed.
const ROUNDS = [
  {
    k: 2,
    m: 3,
    shapes: [
      {
        name: 'L',
        pts: [
          [0, 0],
          [0, 3],
          [2, 3],
        ],
      },
      {
        name: 'stairs',
        pts: [
          [0, 3],
          [1, 3],
          [1, 1],
          [3, 1],
        ],
      },
      {
        name: 'chair',
        pts: [
          [0, 0],
          [0, 3],
          [2, 3],
          [2, 2],
        ],
      },
    ],
  },
  {
    k: 2,
    m: 4,
    shapes: [
      {
        name: 'house',
        emoji: '🏠',
        pts: [
          [0, 4],
          [0, 2],
          [2, 0],
          [4, 2],
          [4, 4],
          [0, 4],
        ],
      },
      {
        name: 'boat',
        emoji: '⛵',
        pts: [
          [0, 3],
          [1, 4],
          [3, 4],
          [4, 3],
          [3, 3],
          [2, 0],
          [1, 3],
          [0, 3],
        ],
      },
      {
        name: 'arrow',
        emoji: '➡️',
        pts: [
          [0, 1],
          [2, 1],
          [2, 0],
          [4, 2],
          [2, 4],
          [2, 3],
          [0, 3],
          [0, 1],
        ],
      },
    ],
  },
  {
    k: 3,
    m: 3,
    shapes: [
      {
        name: 'tiny house',
        emoji: '🏠',
        pts: [
          [0, 3],
          [0, 1],
          [1, 0],
          [2, 1],
          [2, 3],
          [0, 3],
        ],
      },
      {
        name: 'flag',
        pts: [
          [0, 3],
          [0, 0],
          [3, 1],
          [0, 2],
        ],
      },
      {
        name: 'mountain',
        pts: [
          [0, 3],
          [1, 1],
          [2, 2],
          [3, 0],
        ],
      },
    ],
  },
  {
    k: 2,
    m: 4,
    shapes: [
      {
        name: 'crown',
        emoji: '👑',
        pts: [
          [0, 4],
          [0, 1],
          [1, 2],
          [2, 0],
          [3, 2],
          [4, 1],
          [4, 4],
          [0, 4],
        ],
      },
      {
        name: 'castle',
        emoji: '🏰',
        pts: [
          [0, 4],
          [0, 0],
          [1, 0],
          [1, 1],
          [2, 1],
          [2, 0],
          [3, 0],
          [3, 1],
          [4, 1],
          [4, 4],
          [0, 4],
        ],
      },
      {
        name: 'rocket',
        emoji: '🚀',
        pts: [
          [2, 0],
          [3, 1],
          [3, 3],
          [4, 4],
          [3, 4],
          [2, 3],
          [1, 4],
          [0, 4],
          [1, 3],
          [1, 1],
          [2, 0],
        ],
      },
    ],
  },
  {
    k: 4,
    m: 2,
    shapes: [
      {
        name: 'little house',
        emoji: '🏠',
        pts: [
          [0, 2],
          [0, 1],
          [1, 0],
          [2, 1],
          [2, 2],
          [0, 2],
        ],
      },
      {
        name: 'kite',
        emoji: '🪁',
        pts: [
          [1, 0],
          [2, 1],
          [1, 2],
          [0, 1],
          [1, 0],
        ],
      },
      {
        name: 'lightning',
        pts: [
          [1, 0],
          [0, 1],
          [1, 1],
          [0, 2],
        ],
      },
      {
        name: 'steps',
        pts: [
          [0, 2],
          [0, 1],
          [1, 1],
          [1, 0],
          [2, 0],
        ],
      },
    ],
  },
];
const CHEERS = [
  'Just right! Twice as big!',
  'Wonderful drawing!',
  'You copied it perfectly!',
  'Hooray, a big picture!',
  'Beautiful and big!',
];
const CHEERS4 = ['Four times as big. Amazing!', 'Wow, a giant picture!', 'Every line is four times longer!'];
const CHEERS3 = ['Three times as big. Superb!', 'You did it, big artist!', 'Perfect! Every line is longer!'];

// ---------- pure logic ----------
const same = (a, b) => a[0] === b[0] && a[1] === b[1];

// All acceptable drawing orders (in big-grid coordinates). Open shapes: from either end.
// Closed shapes: from any corner, either way round.
export function candidates(pts, k) {
  const sc = pts.map(([x, y]) => [x * k, y * k]);
  if (!same(sc[0], sc[sc.length - 1])) return [sc, sc.slice().reverse()];
  const ring = sc.slice(0, -1);
  const n = ring.length;
  const out = [];
  for (let s = 0; s < n; s++)
    for (const dir of [1, -1]) {
      const path = [];
      for (let i = 0; i < n; i++) path.push(ring[(((s + dir * i) % n) + n) % n]);
      path.push(path[0]);
      out.push(path);
    }
  return out;
}

// Words for a model vector, e.g. [1,-2] -> "1 square right and 2 squares up".
const sq = (n) => `${n} square${n === 1 ? '' : 's'}`;
function describe(v) {
  const parts = [];
  if (v[0]) parts.push(`${sq(Math.abs(v[0]))} ${v[0] > 0 ? 'right' : 'left'}`);
  if (v[1]) parts.push(`${sq(Math.abs(v[1]))} ${v[1] > 0 ? 'down' : 'up'}`);
  return parts.join(' and ');
}
const kWord = (k) => (k === 2 ? 'twice' : k === 3 ? 'three times' : 'four times');
const cap = (t) => t[0].toUpperCase() + t.slice(1);

// ---------- styles ----------
const CSS = `
.a-${ID}{width:100%;max-width:1100px;margin:0 auto;display:flex;flex-direction:column;align-items:center;gap:10px;padding:4px 8px 12px}
.a-${ID} .dp-wrap{width:100%;display:flex;flex-direction:row;justify-content:center;align-items:flex-start;gap:16px}
.a-${ID} .dp-wrap.stack{flex-direction:column;align-items:center;gap:8px}
.a-${ID} .dp-panel{display:flex;flex-direction:column;align-items:center;gap:4px;max-width:100%}
.a-${ID} .dp-cap{font-weight:800;font-size:1rem;color:${INK}}
.a-${ID} .dp-box{border:3px solid ${INK};border-radius:16px;background:#fffdf5;box-shadow:0 4px 0 rgba(43,45,66,.15);overflow:hidden;line-height:0;max-width:100%}
.a-${ID} .dp-box.model{background:#eaf7ff}
.a-${ID} svg{display:block;max-width:100%;touch-action:manipulation;user-select:none;-webkit-user-select:none}
.a-${ID} .dp-big{cursor:crosshair}
.a-${ID} .dp-row{display:flex;gap:12px;flex-wrap:wrap;justify-content:center}
.a-${ID} .dp-row .btn{min-height:56px;min-width:56px;font-size:1.05rem}
.a-${ID} .dp-hi{animation:dpblink .55s ease-in-out 3;stroke-linecap:round}
@keyframes dpblink{0%,100%{opacity:.15}50%{opacity:1}}
.a-${ID} .dp-glow{animation:dpglow .8s ease-in-out infinite;transform-box:fill-box;transform-origin:center}
@keyframes dpglow{0%,100%{transform:scale(.8);opacity:.7}50%{transform:scale(1.25);opacity:1}}
.a-${ID} .dp-oops{animation:dpoops .7s ease-out forwards;transform-box:fill-box;transform-origin:center}
@keyframes dpoops{0%{transform:scale(.6);opacity:1}100%{transform:scale(1.6);opacity:0}}
.a-${ID} .dp-pop{animation:dppop .35s ease-out;transform-box:fill-box;transform-origin:center}
@keyframes dppop{0%{transform:scale(.3)}70%{transform:scale(1.4)}100%{transform:scale(1)}}
.a-${ID} .dp-fill{animation:dpfade .6s ease-out}
@keyframes dpfade{from{opacity:0}to{opacity:1}}
`;

export default {
  id: ID,
  rounds: ROUNDS.length,
  parentNote:
    'Copy the picture on the small grid, but make every line twice as long (later three and even four times, with trickier pictures). Ask: "How many squares is this line? So how many on the big one?" Common slip: copying the same size, or doubling only some lines. A line that goes 1 across and 2 up becomes 2 across and 4 up.',
  async start(api) {
    let alive = true;
    let demoRunning = false;
    let ro = null;
    api.css(CSS);
    const wrap = h('div', { class: `a-${ID}` });
    api.root.append(wrap);

    // ----- per-round state -----
    let R = null; // { k, m, shape, closed, cands, taken, tries, busy, nodes... }

    const pxy = (x, y) => ({ x: x * U, y: y * U });

    function makeGrid(cols, rows, label) {
      const W = cols * U + 2 * P,
        H = rows * U + 2 * P;
      const svg = h('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': label });
      const g = h('g', { transform: `translate(${P},${P})` });
      const grid = h('g', {});
      const lines = h('g', {});
      const over = h('g', {});
      for (let x = 0; x <= cols; x++)
        grid.append(h('line', { x1: x * U, y1: 0, x2: x * U, y2: rows * U, stroke: '#b8c4d6', 'stroke-width': 1.5 }));
      for (let y = 0; y <= rows; y++)
        grid.append(h('line', { x1: 0, y1: y * U, x2: cols * U, y2: y * U, stroke: '#b8c4d6', 'stroke-width': 1.5 }));
      for (let x = 0; x <= cols; x++)
        for (let y = 0; y <= rows; y++) grid.append(h('circle', { cx: x * U, cy: y * U, r: 3, fill: '#8d9bb3' }));
      g.append(grid, lines, over);
      svg.append(g);
      return { svg, g, grid, lines, over, cols, rows, W, H };
    }

    // Draw-on effect: dash the line to its full length, then animate the offset to 0.
    function animateLine(line, len) {
      line.style.strokeDasharray = len;
      line.style.strokeDashoffset = len;
      line.getBoundingClientRect();
      line.style.transition = 'stroke-dashoffset .32s ease-out';
      line.style.strokeDashoffset = 0;
    }

    function addDot(layer, p, color, r, cls) {
      const c = h('circle', { cx: p.x, cy: p.y, r, fill: color, stroke: '#fff', 'stroke-width': 2, class: cls || '' });
      layer.append(c);
      return c;
    }

    // Build both grids for round i (random shape from the round's list) and reset the per-round state R.
    function buildRound(i) {
      const cfg = ROUNDS[i];
      const shape = pick(cfg.shapes);
      const k = cfg.k,
        m = cfg.m;
      const closed = same(shape.pts[0], shape.pts[shape.pts.length - 1]);
      wrap.replaceChildren();
      const model = makeGrid(m, m, `Small picture of a ${shape.name} on a grid`);
      const big = makeGrid(m * k, m * k, 'Big empty grid to draw on');
      big.svg.classList.add('dp-big');
      // model drawing
      for (let s = 0; s < shape.pts.length - 1; s++) {
        const a = pxy(...shape.pts[s]),
          b = pxy(...shape.pts[s + 1]);
        model.lines.append(
          h('line', {
            x1: a.x,
            y1: a.y,
            x2: b.x,
            y2: b.y,
            stroke: COLORS.blue,
            'stroke-width': 5,
            'stroke-linecap': 'round',
          }),
        );
      }
      const mhi = h('g', {});
      model.over.append(mhi);
      shape.pts.forEach((p, s) => {
        if (!(closed && s === shape.pts.length - 1) && s > 0) addDot(model.over, pxy(...p), COLORS.blue, 5.5);
      });
      addDot(model.over, pxy(...shape.pts[0]), COLORS.green, 9);
      // big overlay layers
      const fillL = h('g', {}),
        segL = h('g', {}),
        dotL = h('g', {}),
        hintL = h('g', {});
      big.over.append(fillL, segL, dotL, hintL);
      const ring = h('circle', {
        r: 13,
        fill: 'none',
        stroke: COLORS.orange,
        'stroke-width': 3,
        opacity: 0,
        'pointer-events': 'none',
      });
      big.over.append(ring);

      const mBox = h('div', { class: 'dp-box model' }, model.svg);
      const bBox = h('div', { class: 'dp-box' }, big.svg);
      const mPanel = h('div', { class: 'dp-panel' }, h('div', { class: 'dp-cap' }, '🖼️ The model'), mBox);
      const bPanel = h(
        'div',
        { class: 'dp-panel' },
        h('div', { class: 'dp-cap' }, `✏️ Your picture: ${kWord(k)} as big`),
        bBox,
      );
      const row = h(
        'div',
        { class: 'dp-row' },
        h(
          'button',
          {
            class: 'btn',
            'aria-label': 'Undo last line',
            onclick: () => {
              if (!demoRunning) undo();
            },
          },
          '↶ Undo',
        ),
        h(
          'button',
          {
            class: 'btn',
            'aria-label': 'Start again',
            onclick: () => {
              if (!demoRunning) {
                sfx('tap');
                clearDrawing();
              }
            },
          },
          '↻ Start again',
        ),
      );
      const body = h('div', { class: 'dp-wrap' }, mPanel, bPanel);
      wrap.append(body, row);

      R = {
        i,
        k,
        m,
        shape,
        closed,
        model,
        big,
        mhi,
        fillL,
        segL,
        dotL,
        hintL,
        ring,
        bBox,
        body,
        cands: candidates(shape.pts, k),
        taken: [],
        tries: 0,
        busy: false,
        done: null,
        glowEl: null,
        wrongRun: 0,
      };
      big.svg.addEventListener('pointerdown', (e) => onPointer(e));
      big.svg.addEventListener('pointermove', (e) => {
        if (e.pointerType !== 'mouse' || R.busy || demoRunning) return;
        const q = toGrid(e);
        const c = pxy(q[0], q[1]);
        ring.setAttribute('cx', c.x);
        ring.setAttribute('cy', c.y);
        ring.setAttribute('opacity', 0.9);
      });
      big.svg.addEventListener('pointerleave', () => ring.setAttribute('opacity', 0));
      layout();
    }

    // ----- layout: side by side if both fit with good cells (>= 40px per cell), else stacked -----
    function layout() {
      if (!R || !alive) return;
      const { model, big, body } = R;
      const W = Math.max(280, wrap.clientWidth - 16);
      const sum = model.W + big.W;
      const sSide = (W - 16 - 8) / sum;
      let scale;
      let stacked;
      if (sSide * U >= 40) {
        stacked = false;
        scale = Math.min(1.25, sSide);
      } else {
        stacked = true;
        const budget = (window.innerHeight || 800) - 330; // room for both grids after banner, captions and buttons
        scale = Math.min(1.25, (W - 8) / big.W, Math.max(0.8, budget / (model.H + big.H)));
      }
      body.classList.toggle('stack', stacked);
      model.svg.style.width = Math.round(model.W * scale) + 'px';
      model.svg.style.height = Math.round(model.H * scale) + 'px';
      big.svg.style.width = Math.round(big.W * scale) + 'px';
      big.svg.style.height = Math.round(big.H * scale) + 'px';
    }
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(() => layout());
      ro.observe(wrap);
    }

    // ----- input -----
    // Pointer position -> nearest grid dot [gx, gy] on the big grid (clamped to the grid).
    function toGrid(e) {
      const { big } = R;
      const r = big.svg.getBoundingClientRect();
      const vx = ((e.clientX - r.left) / r.width) * big.W - P;
      const vy = ((e.clientY - r.top) / r.height) * big.H - P;
      const gx = Math.max(0, Math.min(big.cols, Math.round(vx / U)));
      const gy = Math.max(0, Math.min(big.rows, Math.round(vy / U)));
      return [gx, gy];
    }
    function onPointer(e) {
      if (!R || R.busy || demoRunning) return;
      e.preventDefault();
      tap(toGrid(e));
    }

    function clearHints() {
      R.mhi.replaceChildren();
      if (R.glowEl) {
        R.glowEl.remove();
        R.glowEl = null;
      }
    }
    function clearDrawing() {
      clearHints();
      R.segL.replaceChildren();
      R.dotL.replaceChildren();
      R.fillL.replaceChildren();
      R.taken = [];
      R.cands = candidates(R.shape.pts, R.k);
      R.tries = 0;
      R.busy = false;
    }
    function undo() {
      if (!R || R.busy || !R.taken.length) return;
      sfx('tap');
      clearHints();
      R.taken.pop();
      R.segL.lastChild?.remove();
      R.dotL.lastChild?.remove();
      if (R.taken.length === 0) R.dotL.replaceChildren();
      // recompute alive candidates for the prefix
      R.cands = candidates(R.shape.pts, R.k).filter((c) => R.taken.every((p, s) => same(c[s], p)));
      R.tries = 0;
    }

    // Flash the model line matching the big-grid segment a->b (a, b in big coordinates).
    function highlightModel(a, b) {
      const k = R.k;
      const pa = pxy(a[0] / k, a[1] / k),
        pb = pxy(b[0] / k, b[1] / k);
      R.mhi.append(
        h('line', {
          class: 'dp-hi',
          x1: pa.x,
          y1: pa.y,
          x2: pb.x,
          y2: pb.y,
          stroke: COLORS.yellow,
          'stroke-width': 13,
          opacity: 0.9,
        }),
      );
      R.mhi.append(
        h('line', { class: 'dp-hi', x1: pa.x, y1: pa.y, x2: pb.x, y2: pb.y, stroke: COLORS.orange, 'stroke-width': 4 }),
      );
    }
    function showGlow(p) {
      if (R.glowEl) R.glowEl.remove();
      const c = pxy(p[0], p[1]);
      R.glowEl = h('circle', {
        class: 'dp-glow',
        cx: c.x,
        cy: c.y,
        r: 13,
        fill: 'rgba(255,209,102,.55)',
        stroke: COLORS.orange,
        'stroke-width': 3,
      });
      R.hintL.append(R.glowEl);
    }

    // accept a correct point (shared by child taps and the demo)
    function accept(p) {
      const step = R.taken.length;
      R.cands = R.cands.filter((c) => same(c[step], p));
      const prev = step ? R.taken[step - 1] : null;
      R.taken.push(p);
      R.tries = 0;
      R.wrongRun = 0;
      clearHints();
      const c = pxy(p[0], p[1]);
      if (prev) {
        const a = pxy(prev[0], prev[1]);
        const ln = h('line', {
          x1: a.x,
          y1: a.y,
          x2: c.x,
          y2: c.y,
          stroke: COLORS.orange,
          'stroke-width': 6,
          'stroke-linecap': 'round',
        });
        R.segL.append(ln);
        animateLine(ln, Math.hypot(c.x - a.x, c.y - a.y));
        highlightModel(prev, p);
      }
      addDot(R.dotL, c, step === 0 ? COLORS.green : COLORS.orange, step === 0 ? 10 : 7, 'dp-pop');
      sfx('pop');
      return R.taken.length === R.cands[0].length;
    }

    // Wrong tap: show a ring, shake, and pick a hint (2nd miss in a row adds the vector words and a glowing target dot).
    function wrong(p) {
      R.tries++;
      const step = R.taken.length;
      const exp = R.cands[0][step];
      const k = R.k;
      const c = pxy(p[0], p[1]);
      R.hintL.append(
        h('circle', {
          class: 'dp-oops',
          cx: c.x,
          cy: c.y,
          r: 14,
          fill: 'none',
          stroke: COLORS.orange,
          'stroke-width': 4,
        }),
      );
      setTimeout(() => R.hintL.querySelector('.dp-oops')?.remove(), 800);
      R.bBox.classList.remove('shake');
      void R.bBox.offsetWidth; // force reflow so the shake animation restarts
      R.bBox.classList.add('shake');
      let msg;
      if (step === 0) {
        const s0 = R.shape.pts[0];
        highlightModel([s0[0] * k, s0[1] * k], [s0[0] * k, s0[1] * k]);
        msg = R.tries >= 2 ? 'Tap the glowing dot to start.' : 'Start in the same place as the green dot.';
      } else {
        const prev = R.taken[step - 1];
        const m = [(exp[0] - prev[0]) / k, (exp[1] - prev[1]) / k]; // model vector
        const g = [p[0] - prev[0], p[1] - prev[1]]; // child's vector
        const want = [m[0] * k, m[1] * k];
        highlightModel(prev, exp);
        const cross = g[0] * want[1] - g[1] * want[0];
        const dot = g[0] * want[0] + g[1] * want[1];
        if (g[0] === m[0] && g[1] === m[1]) msg = `That is the same size. Make it ${kWord(k)} as big!`;
        else if (cross === 0 && dot > 0)
          msg = Math.hypot(...g) < Math.hypot(...want) ? 'Nearly! A bit longer.' : 'Nearly! A bit shorter.';
        else msg = 'Look at the model line. Which way does it go?';
        if (R.tries >= 2) msg = `The model goes ${describe(m)}. You go ${describe(want)}!`;
      }
      if (R.tries >= 2) showGlow(exp);
      api.nudge(msg);
    }

    function tap(p) {
      const step = R.taken.length;
      if (step && same(R.taken[step - 1], p)) return;
      if (R.cands.some((c) => c[step] && same(c[step], p))) {
        const finished = accept(p);
        if (finished) complete();
      } else wrong(p);
    }

    function decorateDone() {
      const { shape, k, cands, fillL } = R;
      const path = cands[0];
      if (R.closed) {
        const poly = h('polygon', {
          class: 'dp-fill',
          points: path
            .slice(0, -1)
            .map((q) => `${q[0] * U},${q[1] * U}`)
            .join(' '),
          fill: 'rgba(255,159,28,.25)',
        });
        fillL.append(poly);
        if (shape.emoji) {
          const ring = path.slice(0, -1);
          const cx = ring.reduce((s, q) => s + q[0], 0) / ring.length;
          const cy = ring.reduce((s, q) => s + q[1], 0) / ring.length;
          fillL.append(
            h(
              'text',
              {
                class: 'dp-fill',
                x: cx * U,
                y: cy * U,
                'font-size': Math.min(60, 20 * k),
                'text-anchor': 'middle',
                'dominant-baseline': 'central',
              },
              shape.emoji,
            ),
          );
        }
      }
    }

    // ----- round loop -----
    function complete() {
      R.busy = true;
      decorateDone();
      if (R.done) R.done();
    }
    async function runRound(i) {
      api.stage(i, ROUNDS.length);
      buildRound(i);
      const k = R.k;
      api.prompt(
        i === 0
          ? 'Draw it twice as big. Start at the green dot.'
          : i === 1
            ? 'Tap the dots in order. Make it twice as big!'
            : i === 2
              ? 'Now three times as big! Tap the dots in order.'
              : i === 3
                ? 'A trickier picture. Make it twice as big!'
                : 'The last one! Four times as big. Tap the dots.',
      );
      await new Promise((res) => {
        R.done = res;
      });
      if (!alive) return;
      await api.cheer(pick(k === 4 ? CHEERS4 : k === 3 ? CHEERS3 : CHEERS));
      if (!alive) return;
      await sleep(1100);
    }

    // ----- demo -----
    api.setDemo(async () => {
      demoRunning = true;
      try {
        const keep = R; // same round
        clearDrawing();
        R.busy = false;
        const k = R.k;
        const path = R.cands[0];
        await api.say(`Watch! Each line will be ${kWord(k)} as long.`);
        if (!alive || R !== keep) return;
        await sleep(300);
        highlightModel([path[0][0], path[0][1]], [path[0][0], path[0][1]]);
        await api.say('We start at the green dot.');
        if (!alive) return;
        accept(path[0]);
        await sleep(500);
        for (let s = 1; s < path.length; s++) {
          if (!alive || R !== keep) return;
          const a = path[s - 1],
            b = path[s];
          const m = [(b[0] - a[0]) / k, (b[1] - a[1]) / k];
          highlightModel(a, b);
          await api.say(`This line goes ${describe(m)}.`);
          if (!alive || R !== keep) return;
          await sleep(250);
          await api.say(`${cap(kWord(k))} as long: ${describe([m[0] * k, m[1] * k])}.`);
          if (!alive || R !== keep) return;
          accept(b);
          await sleep(700);
        }
        if (!alive || R !== keep) return;
        decorateDone();
        await api.cheer('See? Every line is longer!');
        await sleep(1200);
        if (!alive || R !== keep) return;
        clearDrawing();
        R.fillL.replaceChildren();
        api.prompt(R.i === 0 ? 'Now you try! Start at the green dot.' : 'Now you try! Tap the dots in order.');
      } finally {
        demoRunning = false;
      }
    });

    (async () => {
      const startAt = resumeRound(api, ROUNDS.length);
      for (let i = startAt; i < ROUNDS.length; i++) {
        if (!alive) return;
        await runRound(i);
      }
      if (alive) api.finish();
    })();

    return {
      destroy() {
        alive = false;
        try {
          ro?.disconnect();
        } catch {
          /* ignore */
        }
        R && (R.done = null);
      },
    };
  },
};
