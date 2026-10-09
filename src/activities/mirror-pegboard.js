/**
 * Game: Mirror Pegboard  (id: mirror-pegboard, level 2)
 *
 * Idea: a mirror turns every point into a twin the same distance away on the other side, level with the
 * original (reflection / line symmetry on a grid).
 * Rounds (a 7 x 7 pegboard; tap pegs on the far side of the mirror to build the twin of a coloured shape):
 *   1. Small triangles, standing (vertical) mirror, no corner on the mirror.
 *   2. Bigger 5-6 corner shapes, some corners sitting on the (vertical) mirror (they stay put).
 *   3. The mirror lies flat (horizontal); shapes are away from it.
 *   4. Six corners, vertical mirror, nothing on the mirror.
 *   5. Up to seven corners, some on the mirror, mirror randomly vertical or horizontal.
 *   Each round picks one of three shapes at random, a random side and a random flip along the mirror.
 *   Wrong taps bounce back with a spoken hint; after 2 misses a dashed ghost of the answer appears.
 *   Tapping a placed peg again removes it; "Start again" clears the pegs.
 * Watch demo: lights the mirror, flips a copy of the shape over it, then places each twin peg while
 *   counting the steps from the mirror aloud.
 * Notes:
 *   - The 'orient' field is 'v' (mirror runs down column M) or 'h' (mirror runs along row M).
 *   - Every shape in SHAPES is a simple polygon, listed in rubber-band order, as
 *     [along-the-mirror, steps-from-the-mirror]; steps 0 = on the mirror.
 *   - Async work (flip animation, demo, round completion) is guarded by `gen`/`ok(g)`; startRound()
 *     and destroy() bump `gen` so stale animations stop. `busy` blocks taps while animating.
 *   - No test hooks are exported.
 */
import { h, sleep, rand, pick, sfx, COLORS, resumeRound } from '../lib/core.js';

// 7 x 7 pegboard. The mirror runs through the middle column (rounds 1, 2, 4), middle row (round 3) or either (round 5).
const N = 7; // pegs per side
const S = 60; // size of one cell, in SVG units
const M = 3; // index of the middle column / row (where the mirror is)
const W = N * S; // board size
const AX = (M + 0.5) * S; // mirror axis position, in SVG units
const FLIP_MS = 1300; // duration of the flip animation
const SHADES = { pink: '#d6456f', orange: '#c76a00', purple: '#6d3bbf', blue: '#0b6f94', green: '#04865f' };
const PALETTE = ['pink', 'orange', 'purple', 'blue', 'green'];

// Shapes as [along-the-mirror, steps-from-the-mirror], listed in rubber-band order.
// Steps 0 = the peg sits on the mirror and stays put. Every polygon is simple (no crossing edges).
const SHAPES = [
  [
    // round 1: small triangles
    [
      [2, 1],
      [4, 1],
      [3, 3],
    ],
    [
      [2, 1],
      [2, 3],
      [4, 2],
    ],
    [
      [1, 2],
      [3, 1],
      [3, 3],
    ],
  ],
  [
    // round 2: bigger shapes, touching the mirror
    [
      [2, 0],
      [1, 2],
      [2, 3],
      [4, 3],
      [5, 2],
      [4, 0],
    ],
    [
      [1, 0],
      [1, 2],
      [3, 3],
      [5, 2],
      [5, 0],
    ],
    [
      [1, 0],
      [1, 3],
      [3, 3],
      [3, 2],
      [5, 2],
      [5, 0],
    ],
  ],
  [
    // round 3: flat mirror, shapes away from it
    [
      [1, 1],
      [3, 3],
      [5, 1],
      [3, 2],
    ],
    [
      [1, 2],
      [2, 1],
      [4, 1],
      [5, 2],
      [3, 3],
    ],
    [
      [1, 1],
      [1, 3],
      [3, 2],
      [5, 3],
      [5, 1],
    ],
  ],
  [
    // round 4: more corners, nothing on the mirror
    [
      [1, 1],
      [1, 3],
      [3, 3],
      [3, 2],
      [5, 2],
      [5, 1],
    ],
    [
      [0, 1],
      [2, 3],
      [4, 3],
      [6, 1],
      [4, 2],
      [2, 2],
    ],
    [
      [1, 1],
      [2, 3],
      [3, 2],
      [4, 3],
      [5, 1],
    ],
  ],
  [
    // round 5: seven corners, some on the mirror, mirror may lie either way
    [
      [0, 0],
      [1, 2],
      [2, 3],
      [3, 1],
      [4, 3],
      [5, 2],
      [6, 0],
    ],
    [
      [3, 0],
      [0, 2],
      [2, 3],
      [3, 2],
      [4, 3],
      [6, 2],
    ],
    [
      [1, 0],
      [0, 2],
      [2, 3],
      [3, 1],
      [4, 3],
      [6, 2],
      [5, 0],
    ],
  ],
];
const TOTAL = SHAPES.length; // number of rounds
const PROMPTS = [
  'Build the mirror twin! Tap pegs on the other side.',
  'Make the twin. Count the steps from the mirror.',
  'The mirror lies flat now. Build the twin across it.',
  'More corners now! Build the whole twin.',
  'The biggest shape yet. Find every twin peg.',
];
const PRAISE = ['Yes! That peg fits.', 'Nice, same distance!', 'Great spot!', 'Just right!', 'You found it!'];
const WORDS = ['zero', 'one', 'two', 'three'];

// Cell (column, row) -> centre of that peg hole in SVG units; and a point as an SVG 'x,y' string.
const xy = (c, r) => [(c + 0.5) * S, (r + 0.5) * S];
const fmt = (p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`;

const CSS = `
.a-mirror-pegboard{display:flex;flex-direction:column;align-items:center;gap:10px;width:100%;max-width:100%;padding:6px 8px 10px;box-sizing:border-box}
.a-mirror-pegboard svg.mp-board{width:100%;max-width:540px;height:auto;max-height:62vh;touch-action:manipulation;display:block}
.a-mirror-pegboard .mp-hit{fill:transparent;cursor:pointer;outline:none}
@media (hover:hover){.a-mirror-pegboard .mp-hit:hover{fill:rgba(255,255,255,.4)}}
.a-mirror-pegboard .mp-hit:focus-visible{stroke:#2b2d42;stroke-width:4}
.a-mirror-pegboard .mp-peg,.a-mirror-pegboard .mp-ghost,.a-mirror-pegboard .mp-ring{transform-box:fill-box;transform-origin:center}
.a-mirror-pegboard .mp-pop{animation:mpPop .45s cubic-bezier(.3,1.6,.5,1)}
.a-mirror-pegboard .mp-oops{animation:mpOops .7s ease-in forwards}
.a-mirror-pegboard .mp-ghost{animation:mpGhost 1.3s ease-in-out infinite}
.a-mirror-pegboard .mp-ring{animation:mpRing .9s ease-in-out infinite}
.a-mirror-pegboard .mp-fade{animation:mpFade 2.2s ease-out forwards}
.a-mirror-pegboard .mp-strip{animation:mpShine 3s ease-in-out infinite}
.a-mirror-pegboard .mp-bright{animation:mpBright .8s ease-in-out 2}
.a-mirror-pegboard .mp-tray{display:flex;gap:8px;align-items:center;justify-content:center;min-height:30px;flex-wrap:wrap}
.a-mirror-pegboard .mp-dot{width:26px;height:26px;border-radius:50%;border:3px solid #2b2d42;background:#fff;transition:background .2s,transform .2s}
.a-mirror-pegboard .mp-dot.on{transform:scale(1.15)}
.a-mirror-pegboard .mp-cap{font-weight:800;font-size:.95rem;margin-right:4px}
.a-mirror-pegboard .mp-actions{display:flex;gap:10px;flex-wrap:wrap;justify-content:center}
.a-mirror-pegboard .mp-actions .btn{min-height:56px}
@keyframes mpPop{0%{transform:scale(.2)}100%{transform:scale(1)}}
@keyframes mpOops{0%{transform:translateX(0)}15%{transform:translateX(-7px)}30%{transform:translateX(7px)}45%{transform:translateX(-5px)}60%{transform:translateX(4px)}100%{transform:translateX(0);opacity:0}}
@keyframes mpGhost{0%,100%{opacity:.25;transform:scale(.9)}50%{opacity:.6;transform:scale(1.08)}}
@keyframes mpRing{0%,100%{opacity:.3;transform:scale(.85)}50%{opacity:1;transform:scale(1.15)}}
@keyframes mpFade{0%{opacity:.9}70%{opacity:.7}100%{opacity:0}}
@keyframes mpShine{0%,100%{opacity:.8}50%{opacity:1}}
@keyframes mpBright{0%,100%{filter:none}50%{filter:brightness(1.2) drop-shadow(0 0 8px #fff)}}
`;

export default {
  id: 'mirror-pegboard',
  rounds: TOTAL,
  parentNote:
    'A mirror turns every point into a twin the same distance away on the other side, level with the original. Ask "how many steps is this corner from the mirror?" and "where is its twin?". Later rounds add more corners and corners sitting on the mirror (they stay put), and the last one may lie the mirror flat or upright. Typical slips: sliding a copy to the other side instead of flipping it, or matching the distance but not the height.',

  async start(api) {
    let alive = true,
      gen = 0,
      busy = false;
    api.css(CSS);
    const wrap = h('div', { class: 'a-mirror-pegboard' });
    api.root.append(wrap);

    let R = null; // current round
    let L = null; // layers
    let trayEl = null;
    const ok = (g) => alive && g === gen;

    // ---------- round geometry ----------
    const onMir = (v) => (R.orient === 'v' ? v.c === M : v.r === M);
    const twinOf = (v) => (R.orient === 'v' ? { c: 2 * M - v.c, r: v.r } : { c: v.c, r: 2 * M - v.r });
    const steps = (v) => Math.abs(R.orient === 'v' ? v.c - M : v.r - M);
    const sameCell = (a, b) => a.c === b.c && a.r === b.r;

    // Builds a round: random shape, side of the mirror, and flip along the mirror (round 5 also picks the orientation).
    function makeCfg(i) {
      const orient = i === 2 ? 'h' : i === 4 ? pick(['h', 'v']) : 'v';
      const side = pick([-1, 1]);
      const flipA = rand(2) === 1;
      const verts = pick(SHAPES[i]).map(([a, d]) => {
        const al = flipA ? N - 1 - a : a;
        return orient === 'v' ? { c: M + side * d, r: al } : { c: al, r: M + side * d };
      });
      const color = pick(PALETTE);
      return { i, orient, side, verts, color, placed: new Set(), misses: 0, hint: false };
    }

    // ---------- drawing helpers ----------
    function peg(x, y, color, cls = '') {
      return h(
        'g',
        { class: 'mp-peg ' + cls },
        h('circle', { cx: x, cy: y, r: 16, fill: COLORS[color] || color, stroke: '#fff', 'stroke-width': 3 }),
        h('circle', { cx: x - 5, cy: y - 5, r: 4.5, fill: '#fff', 'fill-opacity': 0.55 }),
      );
    }
    const pts = (list) => list.map((v) => fmt(xy(v.c, v.r))).join(' ');
    const colorOf = () => COLORS[R.color];
    const shadeOf = () => SHADES[R.color];

    function buildBoard() {
      R.twins = R.verts.map((v) => (onMir(v) ? null : twinOf(v)));
      const vertical = R.orient === 'v';
      const svg = h('svg', {
        class: 'mp-board',
        viewBox: `0 0 ${W} ${W}`,
        role: 'group',
        'aria-label': vertical
          ? 'Pegboard with a standing mirror in the middle'
          : 'Pegboard with a flat mirror in the middle',
      });
      svg.append(
        h(
          'defs',
          {},
          h(
            'linearGradient',
            { id: 'mpGrad', x1: 0, y1: 0, x2: vertical ? 1 : 0, y2: vertical ? 0 : 1 },
            h('stop', { offset: '0', 'stop-color': '#9fdcff' }),
            h('stop', { offset: '.5', 'stop-color': '#f2fbff' }),
            h('stop', { offset: '1', 'stop-color': '#9fdcff' }),
          ),
        ),
      );
      svg.append(
        h('rect', {
          x: 3,
          y: 3,
          width: W - 6,
          height: W - 6,
          rx: 26,
          fill: '#fff1d0',
          stroke: '#2b2d42',
          'stroke-width': 4,
        }),
      );
      const holes = h('g', {});
      for (let r = 0; r < N; r++)
        for (let c = 0; c < N; c++) {
          const [x, y] = xy(c, r);
          holes.append(h('circle', { cx: x, cy: y, r: 6.5, fill: '#e0bf84' }));
        }
      svg.append(holes);
      // the mirror
      const strip = vertical
        ? h('rect', {
            x: AX - 13,
            y: 14,
            width: 26,
            height: W - 28,
            rx: 13,
            fill: 'url(#mpGrad)',
            stroke: '#2b2d42',
            'stroke-width': 3,
          })
        : h('rect', {
            x: 14,
            y: AX - 13,
            width: W - 28,
            height: 26,
            rx: 13,
            fill: 'url(#mpGrad)',
            stroke: '#2b2d42',
            'stroke-width': 3,
          });
      strip.setAttribute('class', 'mp-strip');
      L = { svg, strip };
      svg.append(strip);
      const silver = h('g', {});
      for (let k = 0; k < N; k++) {
        const [x, y] = vertical ? xy(M, k) : xy(k, M);
        silver.append(h('circle', { cx: x, cy: y, r: 11, fill: '#d5dde8', stroke: '#8793a6', 'stroke-width': 3 }));
      }
      svg.append(silver);
      // original shape
      L.orig = h('g', {});
      L.orig.append(
        h('polygon', {
          points: pts(R.verts),
          fill: colorOf(),
          'fill-opacity': 0.28,
          stroke: shadeOf(),
          'stroke-width': 7,
          'stroke-linejoin': 'round',
        }),
      );
      R.verts.forEach((v) => {
        const [x, y] = xy(v.c, v.r);
        L.orig.append(peg(x, y, R.color));
      });
      svg.append(L.orig);
      // layers on top of the original
      L.guide = h('g', { 'pointer-events': 'none' });
      L.ghost = h('g', { 'pointer-events': 'none' });
      L.band = h('g', { 'pointer-events': 'none' });
      L.pegs = h('g', { 'pointer-events': 'none' });
      L.flip = h('g', { 'pointer-events': 'none' });
      L.oops = h('g', { 'pointer-events': 'none' });
      svg.append(L.guide, L.ghost, L.band, L.pegs, L.flip, L.oops);
      // tap targets
      const hits = h('g', {});
      for (let r = 0; r < N; r++)
        for (let c = 0; c < N; c++) {
          const [x, y] = xy(c, r);
          const fire = () => tap(c, r);
          hits.append(
            h('circle', {
              class: 'mp-hit',
              cx: x,
              cy: y,
              r: S / 2,
              tabindex: 0,
              role: 'button',
              'aria-label': `Peg ${c + 1} across, ${r + 1} down`,
              onClick: fire,
              onKeydown: (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  fire();
                }
              },
            }),
          );
        }
      svg.append(hits);
      return svg;
    }

    function buildTray() {
      const need = R.verts.filter((v) => !onMir(v)).length;
      trayEl = h('div', { class: 'mp-tray', 'aria-live': 'polite' }, h('span', { class: 'mp-cap' }, 'Pegs to place:'));
      R.dots = Array.from({ length: need }, () => h('span', { class: 'mp-dot' }));
      trayEl.append(...R.dots);
    }
    function updateTray() {
      R.dots.forEach((d, k) => {
        const on = k < R.placed.size;
        d.classList.toggle('on', on);
        d.style.background = on ? colorOf() : '#fff';
      });
      trayEl.setAttribute('aria-label', `${R.placed.size} of ${R.dots.length} pegs placed`);
    }

    const ready = (i) => onMir(R.verts[i]) || R.placed.has(i);
    const mine = (i) => (onMir(R.verts[i]) ? R.verts[i] : R.twins[i]);
    function allDone() {
      return R.verts.every((_, i) => ready(i));
    }

    // Rubber band: the full twin polygon when done; otherwise only edges between two ready corners
    // (edges joining two on-mirror corners are skipped, the original shape already shows them).
    function redrawBand() {
      L.band.replaceChildren();
      const n = R.verts.length;
      if (allDone()) {
        L.band.append(
          h('polygon', {
            points: pts(R.verts.map((_, i) => mine(i))),
            fill: colorOf(),
            'fill-opacity': 0.28,
            stroke: shadeOf(),
            'stroke-width': 7,
            'stroke-linejoin': 'round',
          }),
        );
        return;
      }
      let d = '';
      for (let i = 0; i < n; i++) {
        const j = (i + 1) % n;
        if (!ready(i) || !ready(j) || (onMir(R.verts[i]) && onMir(R.verts[j]))) continue;
        const a = xy(mine(i).c, mine(i).r),
          b = xy(mine(j).c, mine(j).r);
        d += `M${fmt(a)}L${fmt(b)}`;
      }
      if (d)
        L.band.append(h('path', { d, fill: 'none', stroke: shadeOf(), 'stroke-width': 7, 'stroke-linecap': 'round' }));
    }

    function guideLine(i) {
      const a = xy(R.verts[i].c, R.verts[i].r),
        b = xy(R.twins[i].c, R.twins[i].r);
      const ln = h('line', {
        x1: a[0],
        y1: a[1],
        x2: b[0],
        y2: b[1],
        stroke: shadeOf(),
        'stroke-width': 4,
        'stroke-dasharray': '2 10',
        'stroke-linecap': 'round',
        class: 'mp-fade',
      });
      L.guide.append(ln);
      setTimeout(() => ln.remove(), 2300);
    }

    function drawGhost() {
      L.ghost.replaceChildren();
      if (!R.hint) return;
      const all = R.verts.map((_, i) => mine(i));
      L.ghost.append(
        h('polygon', {
          points: pts(all),
          fill: 'none',
          stroke: shadeOf(),
          'stroke-opacity': 0.4,
          'stroke-width': 5,
          'stroke-dasharray': '10 9',
          'stroke-linejoin': 'round',
        }),
      );
      let first = -1;
      R.verts.forEach((v, i) => {
        if (onMir(v) || R.placed.has(i)) return;
        if (first < 0) first = i;
        const [x, y] = xy(R.twins[i].c, R.twins[i].r);
        L.ghost.append(
          h('circle', {
            class: 'mp-ghost',
            cx: x,
            cy: y,
            r: 16,
            fill: colorOf(),
            'fill-opacity': 0.45,
            stroke: shadeOf(),
            'stroke-width': 3,
            'stroke-dasharray': '4 4',
          }),
        );
      });
      if (first >= 0) {
        const a = xy(R.verts[first].c, R.verts[first].r),
          b = xy(R.twins[first].c, R.twins[first].r);
        L.ghost.append(
          h('line', {
            x1: a[0],
            y1: a[1],
            x2: b[0],
            y2: b[1],
            stroke: shadeOf(),
            'stroke-opacity': 0.5,
            'stroke-width': 4,
            'stroke-dasharray': '2 10',
            'stroke-linecap': 'round',
          }),
        );
      }
    }

    function clearPlaced() {
      R.placed.clear();
      R.misses = 0;
      R.hint = false;
      L.pegs.replaceChildren();
      L.guide.replaceChildren();
      L.flip.replaceChildren();
      L.oops.replaceChildren();
      redrawBand();
      drawGhost();
      updateTray();
    }

    function placePeg(i, quiet) {
      R.placed.add(i);
      const [x, y] = xy(R.twins[i].c, R.twins[i].r);
      const g = peg(x, y, R.color, 'mp-pop');
      g.dataset.i = i;
      L.pegs.append(g);
      guideLine(i);
      redrawBand();
      drawGhost();
      updateTray();
      sfx('pop');
      if (!quiet) R.misses = 0;
    }

    function removePeg(i) {
      R.placed.delete(i);
      L.pegs.querySelector(`[data-i="${i}"]`)?.remove();
      redrawBand();
      drawGhost();
      updateTray();
      sfx('tap');
    }

    // The flip: a copy of the shape swings over the mirror by scaling it from +1 to -1 about the mirror axis.
    async function flipAnim(g, hold = 600) {
      const copy = L.orig.cloneNode(true);
      copy.setAttribute('opacity', '0.7');
      L.flip.append(copy);
      sfx('flip');
      const t0 = performance.now(),
        dur = FLIP_MS;
      for (;;) {
        const t = Math.min(1, (performance.now() - t0) / dur);
        const e = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
        const sc = Math.cos(Math.PI * e);
        copy.setAttribute(
          'transform',
          R.orient === 'v'
            ? `translate(${AX} 0) scale(${sc} 1) translate(${-AX} 0)`
            : `translate(0 ${AX}) scale(1 ${sc}) translate(0 ${-AX})`,
        );
        if (t >= 1) break;
        await sleep(16);
        if (!ok(g)) return false;
      }
      await sleep(hold);
      if (!ok(g)) return false;
      copy.remove();
      return true;
    }

    // ---------- tapping ----------
    // Picks the hint for a wrong tap: wrong side, then right height/column, then right distance.
    function missMsg(c, r) {
      const rel = R.orient === 'v' ? c - M : r - M;
      if (rel === 0) return 'The mirror is in the middle. Try the other side.';
      if (Math.sign(rel) === R.side) return 'That is the first side. Cross over the mirror!';
      const rem = R.verts.map((v, i) => (onMir(v) || R.placed.has(i) ? null : R.twins[i])).filter(Boolean);
      const along = R.orient === 'v' ? r : c;
      if (rem.some((t) => (R.orient === 'v' ? t.r : t.c) === along))
        return R.orient === 'v'
          ? 'Same height, yes! Now count the steps from the mirror.'
          : 'Same column, yes! Now count the steps from the mirror.';
      if (rem.some((t) => Math.abs(R.orient === 'v' ? t.c - M : t.r - M) === Math.abs(rel)))
        return R.orient === 'v'
          ? 'Right distance! Is it level with the corner?'
          : 'Right distance! Is it in line with the corner?';
      return 'Find the spot straight across from a corner.';
    }

    function tap(c, r) {
      if (busy || !R) return;
      const cell = { c, r };
      const idx = R.twins.findIndex((t) => t && sameCell(t, cell));
      if (idx >= 0) {
        if (R.placed.has(idx)) {
          removePeg(idx);
          return;
        }
        placePeg(idx, false);
        if (allDone()) complete();
        else api.cheer(pick(PRAISE));
        return;
      }
      if (R.verts.some((v) => onMir(v) && sameCell(v, cell))) {
        sfx('tap');
        api.prompt('This peg is on the mirror. It stays put!');
        return;
      }
      // a wrong spot: bounce back gently
      R.misses++;
      const [x, y] = xy(c, r);
      const ghost = peg(x, y, '#c9d3de', 'mp-oops');
      L.oops.append(ghost);
      setTimeout(() => ghost.remove(), 750);
      api.nudge(missMsg(c, r));
      if (R.misses >= 2 && !R.hint) {
        R.hint = true;
        drawGhost();
      }
    }

    async function complete() {
      const g = gen;
      busy = true;
      R.hint = false;
      drawGhost();
      await sleep(350);
      if (!ok(g)) return;
      const done = await flipAnim(g, 700);
      if (!done) return;
      api.cheer('A perfect mirror twin!');
      sfx('win');
      await sleep(1700);
      if (!ok(g)) return;
      if (R.i < TOTAL - 1) startRound(R.i + 1);
      else api.finish();
    }

    // ---------- rounds ----------
    function startRound(i, cfg) {
      gen++;
      R = cfg || makeCfg(i);
      busy = false;
      api.stage(i, TOTAL);
      const svg = buildBoard();
      buildTray();
      updateTray();
      const again = h(
        'button',
        {
          class: 'btn',
          type: 'button',
          'aria-label': 'Take my pegs off and start again',
          onClick: () => {
            if (!busy) {
              clearPlaced();
              sfx('tap');
            }
          },
        },
        '↺ Start again',
      );
      wrap.replaceChildren(svg, trayEl, h('div', { class: 'mp-actions' }, again));
      api.prompt(PROMPTS[i]);
    }

    // ---------- the Watch demo ----------
    // Demo choreography: flip a copy over the mirror, then place each twin peg while counting the steps.
    api.setDemo(async () => {
      const g = gen;
      const talk = async (t, min = 1200) => {
        await Promise.all([api.say(t), sleep(min)]);
        return ok(g);
      };
      busy = true;
      clearPlaced();
      L.strip.classList.add('mp-bright');
      if (!(await talk('This is the mirror. Watch the shape flip over it.'))) return;
      L.strip.classList.remove('mp-bright');
      if (!(await flipAnim(g, 300))) return;
      R.hint = true;
      drawGhost();
      if (!(await talk('The twin lands on the other side. Now I put a peg on each corner.', 1500))) return;
      for (let i = 0; i < R.verts.length; i++) {
        if (onMir(R.verts[i])) continue;
        const [x, y] = xy(R.verts[i].c, R.verts[i].r);
        const ring = h('circle', {
          class: 'mp-ring',
          cx: x,
          cy: y,
          r: 24,
          fill: 'none',
          stroke: shadeOf(),
          'stroke-width': 5,
        });
        L.guide.append(ring);
        const d = steps(R.verts[i]);
        const count = Array.from({ length: d }, (_, k) => WORDS[k + 1]).join(', ');
        const talked = await talk(`${count}. Same steps on this side.`, 900 + d * 450);
        ring.remove();
        if (!talked) return;
        placePeg(i, true);
        if (!(await talk('', 700))) return;
      }
      if (!(await talk('Same shape, flipped. A mirror twin!', 1800))) return;
      clearPlaced();
      busy = false;
      api.prompt(PROMPTS[R.i]);
    });

    startRound(resumeRound(api, TOTAL));

    return {
      destroy() {
        alive = false;
        gen++;
        busy = true;
      },
    };
  },
};
