/**
 * Game: Builder Team  (id: construction-foreman, level 4)
 *
 * Idea: scheduling with precedence — a block must wait for every block it rests on, but
 * independent blocks can be built in the same turn by different builders (parallel work).
 * Rounds (the child drags numbered block cards into a builders × turns grid, then taps "Build it"):
 *   1. One builder, 4 turns: the house or the gate (random per session), 4 blocks in order (4 turns).
 *   2. Two builders, 4 turns: the other structure: gate + 2-block tower, or house + tree (best 3 turns).
 *   3. Three builders, 5 turns: pyramid or bridge + 4-block tower (maybe mirrored); must reach the fastest plan (4 turns).
 *   4. Two builders, only 4 turns: round-1 structure + 4-block tower (maybe mirrored); every square filled, tower starts in turn 1.
 *   5. Three builders, only 4 turns: two-storey house + 4-block tower + shed (maybe mirrored); turn 2 is fully booked.
 * Watch demo: clears the plan, flies the cards into the solver's fastest plan turn by turn,
 *   plays the build animation, then clears the grid so the child tries the same round.
 * Notes:
 *   - Block dependencies ("rests on") are derived from geometry in finalize(); changing a
 *     structure's coordinates changes the puzzle. Colours and the numbers on blocks are shuffled.
 *   - solve() is an exact bitmask search (≤ 11 blocks). Verified optimum for every variant:
 *     4 / 3 / 4 / 4 / 4 turns for rounds 1–5. Rounds 4–5 have T equal to the optimum ("tight").
 *   - Round 3 ("fast") is the only round that rejects a slower complete plan: 1st time a nudge,
 *     from the 2nd time a tip and a "Next" button that skips the round.
 *   - After 2 wrong drops in a row, strongHint() glows the next block of a fastest plan that
 *     still fits around the current plan (or the block to take back if none fits).
 *   - Tap-to-select works as well as drag (tap card, then tap square). No exported test hooks.
 */
import { h, sleep, shuffle, pick, range, drag, flyTo, sfx, resumeRound } from '../lib/core.js';

const ID = 'construction-foreman';
const U = 30; // px per building unit in the scene
const SCENE_LEFT = 3.3; // units of free ground left of the structures (where the builders stand)
const WALK_UNITS_PER_S = 7; // builder walking speed in the build animation
const LIFT_MS = 520; // a carried block grows into its place
const CHEER_PAUSE_MS = 2600; // pause after the round cheer before the next round
const INK = '#2b2d42';
const PAL = [
  '#ffd166',
  '#90e0ef',
  '#b5e48c',
  '#ffb4a2',
  '#cdb4db',
  '#f4a261',
  '#a2d2ff',
  '#ffc8dd',
  '#e9c46a',
  '#caffbf',
];
const CREW = [
  { hat: '#ffd166', suit: '#118ab2', skin: '#f1c27d' },
  { hat: '#ff9f1c', suit: '#2a9d8f', skin: '#c68642' },
  { hat: '#4cc9f0', suit: '#9b5de5', skin: '#e0ac69' },
];
const LET = ['A', 'B', 'C'];
const ROUNDS = 5; // round settings live in makeCfg(); PROMPTS and DEMO_SAY have one line per round
const PROMPTS = [
  'One builder. Drag the blocks into building order!',
  'Two builders! Who can work at the same time?',
  'Three builders! Plan the fastest build.',
  'Only four turns! Two builders, fill every square.',
  'Three builders, only four turns. Plan it well!',
];
const DEMO_SAY = [
  'Watch. Bottom blocks first, then what sits on them.',
  'Watch. Two builders can work at the same time.',
  'Watch. Start the tall tower early, and keep everyone busy.',
  'Watch. The tall tower starts in turn one, or it will not finish.',
  'Watch. Tower first, and turn two is just for walls and tower.',
];

// ---------- structures (units; y = bottom edge, 0 = ground) ----------
const P = (id, x, y, w, hh, shape = 'rect', color = null) => ({ id, x, y, w, h: hh, shape, color });
const HOUSE = () => [
  P('floor', 0, 0, 6, 1, 'rect', '#d4a373'),
  P('wl', 0.5, 1, 1.5, 2.5),
  P('wr', 4, 1, 1.5, 2.5),
  P('roof', -0.25, 3.5, 6.5, 2, 'roof', '#f28482'),
];
const GATE = () => [
  P('pl', 0.5, 0, 1.5, 3),
  P('pr', 4, 0, 1.5, 3),
  P('beam', 0, 3, 6, 1, 'rect', '#d4a373'),
  P('flag', 2.4, 4, 1.2, 2, 'flag', '#ff8fab'),
];
const TREE = () => [P('tree', 7.5, 0, 2, 3, 'tree', '#95d5b2')];
const TOWER = (k, hh) => range(k).map((j) => P('t' + j, 7.5, j * hh, 2, hh));
const PYRAMID = () => [
  P('a', 0, 0, 2, 1),
  P('b', 2, 0, 2, 1),
  P('c', 4, 0, 2, 1),
  P('d', 1, 1, 2, 1),
  P('e', 3, 1, 2, 1),
  P('f', 2, 2, 2, 1),
];
const HOUSE2 = () => [
  P('floor', 0, 0, 6, 1, 'rect', '#d4a373'),
  P('wl', 0.5, 1, 1.5, 1.5),
  P('wr', 4, 1, 1.5, 1.5),
  P('slab', 0, 2.5, 6, 1, 'rect', '#e9c46a'),
  P('roof', -0.25, 3.5, 6.5, 2, 'roof', '#f28482'),
];
const SHED = (x) => [P('s1', x + 0.25, 0, 1.5, 1.2), P('s2', x, 1.2, 2, 1.2, 'roof', '#b5838d')];
const BRIDGE = () => [
  P('p1', 0, 0, 1.5, 1),
  P('p2', 0, 1, 1.5, 1),
  P('q1', 4.5, 0, 1.5, 1),
  P('q2', 4.5, 1, 1.5, 1),
  P('deck', 0, 2, 6, 1, 'rect', '#d4a373'),
  P('flag', 2.4, 3, 1.2, 2, 'flag', '#ff8fab'),
];

// A piece rests on every piece whose top touches its bottom and overlaps it sideways.
function finalize(raw) {
  const ps = raw.map((p) => ({ ...p, on: [] }));
  for (const a of ps)
    for (const b of ps) {
      if (a !== b && Math.abs(b.y + b.h - a.y) < 1e-6 && Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x) > 0.05)
        a.on.push(b.id);
    }
  const pal = shuffle(PAL);
  const nums = shuffle(range(ps.length, 1));
  let k = 0;
  ps.forEach((p, i) => {
    p.num = nums[i];
    if (!p.color) p.color = pal[k++ % pal.length];
  });
  return ps;
}
// Flip a whole scene left-right (so the tower is sometimes on the left).
const mirror = (raw) => {
  const lo = Math.min(...raw.map((p) => p.x)),
    hi = Math.max(...raw.map((p) => p.x + p.w));
  return raw.map((p) => ({ ...p, x: lo + hi - p.x - p.w }));
};
// Round i settings: m builders, T turns in the grid, and the pieces. `first` ('house' | 'gate')
// is picked once per session and decides which structure rounds 1, 2 and 4 use.
// fast: the plan must be the quickest one. tight: the grid has only as many turns as the quickest plan.
function makeCfg(i, first) {
  if (i === 0) return { m: 1, T: 4, pieces: finalize(first === 'house' ? HOUSE() : GATE()) };
  if (i === 1)
    return {
      m: 2,
      T: 4,
      pieces: finalize(first === 'house' ? [...GATE(), ...TOWER(2, 1.5)] : [...HOUSE(), ...TREE()]),
    };
  let raw = [...(Math.random() < 0.5 ? PYRAMID() : BRIDGE()), ...TOWER(4, 1)];
  if (i === 2) {
    if (Math.random() < 0.5) raw = mirror(raw);
    return { m: 3, T: 5, fast: true, pieces: finalize(raw) };
  }
  if (i === 3) {
    raw = [...(first === 'house' ? HOUSE() : GATE()), ...TOWER(4, 1)];
    if (Math.random() < 0.5) raw = mirror(raw);
    return { m: 2, T: 4, tight: true, pieces: finalize(raw) };
  }
  raw = [...HOUSE2(), ...TOWER(4, 1.2).map((p) => ({ ...p, x: 7 })), ...SHED(10)];
  if (Math.random() < 0.5) raw = mirror(raw);
  return { m: 3, T: 4, tight: true, pieces: finalize(raw) };
}

// ---------- scheduler: fewest turns for unit-time tasks, m builders, at most T turns ----------
// `fixed` (Map id -> turn) pins already-planned blocks. Returns { len, turnOf } or null.
// State = (turn, bitmask of finished blocks); each turn tries every subset of the ready blocks
// that fits the free builders, after the pinned blocks of that turn. Memoised, so it is exact.
function solve(ps, m, T, fixed) {
  const n = ps.length,
    ix = {};
  ps.forEach((p, i) => {
    ix[p.id] = i;
  });
  const pre = ps.map((p) => p.on.reduce((a, id) => a | (1 << ix[id]), 0));
  const fixedAt = new Array(T + 2).fill(0);
  let fixedMask = 0;
  if (fixed)
    for (const [id, t] of fixed) {
      fixedAt[t] |= 1 << ix[id];
      fixedMask |= 1 << ix[id];
    }
  const full = (1 << n) - 1,
    memo = new Map();
  const bits = (x) => {
    let c = 0;
    while (x) {
      x &= x - 1;
      c++;
    }
    return c;
  };
  function rec(t, done) {
    if (done === full) return { len: t - 1, picks: [] };
    if (t > T) return null;
    const key = t * (full + 1) + done;
    if (memo.has(key)) return memo.get(key);
    let best = null;
    const must = fixedAt[t];
    let ok = true;
    for (let i = 0; i < n; i++) if ((must >> i) & 1 && (pre[i] & done) !== pre[i]) ok = false;
    const cap = m - bits(must);
    if (ok && cap >= 0) {
      let ready = 0;
      for (let i = 0; i < n; i++) if (!(((done | fixedMask) >> i) & 1) && (pre[i] & done) === pre[i]) ready |= 1 << i;
      for (let sub = ready; ; sub = (sub - 1) & ready) {
        if (bits(sub) <= cap) {
          const r = rec(t + 1, done | must | sub);
          if (r && (!best || r.len < best.len)) best = { len: r.len, picks: [must | sub, ...r.picks] };
        }
        if (sub === 0) break;
      }
    }
    memo.set(key, best);
    return best;
  }
  const r = rec(1, 0);
  if (!r) return null;
  const turnOf = new Map();
  r.picks.forEach((mask, k) => {
    for (let i = 0; i < n; i++) if ((mask >> i) & 1) turnOf.set(ps[i].id, k + 1);
  });
  return { len: r.len, turnOf };
}

// ---------- drawing ----------
// SVG elements for one piece plus its number label. solid = the built block; otherwise the
// dashed "ghost" outline of the finished building. X/Y map building units to SVG px.
function shapeEls(p, solid, X, Y) {
  const st = solid
    ? { fill: p.color, stroke: INK, 'stroke-width': 2.5 }
    : { fill: p.color, 'fill-opacity': 0.3, stroke: '#8d8270', 'stroke-width': 2, 'stroke-dasharray': '5 4' };
  const els = [];
  const cx = X(p.x + p.w / 2);
  let ly = Y(p.y + p.h / 2);
  let fs = 17;
  if (p.shape === 'roof') {
    els.push(
      h('polygon', {
        points: `${X(p.x)},${Y(p.y) - 1} ${X(p.x + p.w)},${Y(p.y) - 1} ${cx},${Y(p.y + p.h)}`,
        'stroke-linejoin': 'round',
        ...st,
      }),
    );
    ly = Y(p.y + p.h * 0.33);
  } else if (p.shape === 'flag') {
    els.push(
      h('rect', {
        x: X(p.x + 0.12),
        y: Y(p.y + p.h),
        width: 4,
        height: p.h * U - 1,
        rx: 2,
        fill: solid ? '#8d6e63' : '#bcae96',
      }),
    );
    els.push(
      h('polygon', {
        points: `${X(p.x + 0.12) + 4},${Y(p.y + p.h) + 1} ${X(p.x + p.w)},${Y(p.y + p.h * 0.78)} ${X(p.x + 0.12) + 4},${Y(p.y + p.h * 0.55)}`,
        ...st,
      }),
    );
    ly = Y(p.y + p.h * 0.78);
    fs = 13;
    return [
      ...els,
      h(
        'text',
        {
          x: X(p.x + 0.12) + 13,
          y: ly,
          'text-anchor': 'middle',
          'dominant-baseline': 'central',
          'font-size': fs,
          'font-weight': 900,
          fill: solid ? INK : '#6b6252',
        },
        String(p.num),
      ),
    ];
  } else if (p.shape === 'tree') {
    els.push(
      h('rect', {
        x: cx - 5,
        y: Y(p.y + p.h * 0.45),
        width: 10,
        height: p.h * 0.45 * U - 1,
        rx: 3,
        fill: solid ? '#8d6e63' : '#bcae96',
      }),
    );
    const r = Math.min(p.w / 2, p.h * 0.33) * U - 1;
    els.push(h('circle', { cx, cy: Y(p.y + p.h) + r + 1, r, ...st }));
    ly = Y(p.y + p.h) + r + 1;
  } else {
    els.push(h('rect', { x: X(p.x) + 1, y: Y(p.y + p.h) + 1, width: p.w * U - 2, height: p.h * U - 2, rx: 5, ...st }));
  }
  els.push(
    h(
      'text',
      {
        x: cx,
        y: ly,
        'text-anchor': 'middle',
        'dominant-baseline': 'central',
        'font-size': fs,
        'font-weight': 900,
        fill: solid ? INK : '#6b6252',
      },
      String(p.num),
    ),
  );
  return els;
}
// Builder head with hard hat, drawn around (0, 0) = the builder's feet.
function headEls(c) {
  return [
    h('circle', { cx: 0, cy: -43, r: 9, fill: c.skin, stroke: INK, 'stroke-width': 1.5 }),
    h('circle', { cx: -3, cy: -43, r: 1.4, fill: INK }),
    h('circle', { cx: 3, cy: -43, r: 1.4, fill: INK }),
    h('path', {
      d: 'M-3.5,-39.5 Q0,-36.5 3.5,-39.5',
      stroke: INK,
      'stroke-width': 1.4,
      fill: 'none',
      'stroke-linecap': 'round',
    }),
    h('path', { d: 'M-9.5,-46 A9.5,9.5 0 0 1 9.5,-46 Z', fill: c.hat, stroke: INK, 'stroke-width': 1.5 }),
    h('rect', { x: -13, y: -47.5, width: 26, height: 3.5, rx: 1.75, fill: c.hat, stroke: INK, 'stroke-width': 1.2 }),
  ];
}
function avatar(r) {
  return h('svg', { viewBox: '-14 -58 28 26', 'aria-hidden': 'true' }, ...headEls(CREW[r]));
}

// The building-site SVG: ghost outline, hidden solid blocks, and one walking builder per row.
// Layout: x = 0 is SCENE_LEFT units left of the structures; GY is the ground line in px,
// leaving at least 1.1 units of sky above the tallest piece. Returns the scene controller S.
function makeScene(cfg, tween, isAlive) {
  const ps = cfg.pieces;
  const OX = SCENE_LEFT;
  const maxR = Math.max(...ps.map((p) => p.x + p.w)),
    maxT = Math.max(...ps.map((p) => p.y + p.h));
  const SW = (OX + maxR + 0.5) * U,
    GY = Math.max(maxT + 1.1, 3.4) * U,
    VH = GY + 0.8 * U;
  const X = (u) => (OX + u) * U,
    Y = (u) => GY - u * U;
  const svg = h('svg', {
    viewBox: `0 0 ${SW} ${VH}`,
    preserveAspectRatio: 'xMidYMax meet',
    role: 'img',
    'aria-label': 'Building site',
  });
  svg.append(h('circle', { cx: SW - 22, cy: 18, r: 11, fill: '#ffd166' }));
  svg.append(
    h('rect', { x: -2000, y: GY, width: SW + 4000, height: 0.8 * U, fill: '#d8b47a' }),
    h('rect', { x: -2000, y: GY, width: SW + 4000, height: 5, fill: '#7cc576' }),
  );
  for (const [bx, by] of [
    [3, 0],
    [23, 0],
    [13, 1],
  ])
    svg.append(
      h('rect', {
        x: bx,
        y: GY - 11 - by * 11,
        width: 18,
        height: 10,
        rx: 2,
        fill: '#e9a17a',
        stroke: INK,
        'stroke-width': 1.2,
      }),
    );
  // TODO(bug): turnText is never appended to the svg, so "Turn n" / "Done in n turns!" set
  // during the build animation are never shown in the scene.
  const turnText = h('text', { x: 10, y: 22, 'font-size': 18, 'font-weight': 900, fill: INK }, '');
  const ghost = h('g', {});
  const real = h('g', {});
  const realEl = {};
  for (const p of ps) {
    ghost.append(...shapeEls(p, false, X, Y));
    const g = h('g', { opacity: 0 }, ...shapeEls(p, true, X, Y));
    realEl[p.id] = g;
    real.append(g);
  }
  svg.append(ghost, real);
  const crew = range(cfg.m).map((r) => {
    const c = CREW[r];
    const block = h('rect', {
      x: -13,
      y: -70,
      width: 26,
      height: 16,
      rx: 3,
      stroke: INK,
      'stroke-width': 2,
      fill: '#fff',
      visibility: 'hidden',
    });
    const armsDown = h(
      'g',
      {},
      h('rect', { x: -15, y: -32, width: 5, height: 14, rx: 2.5, fill: c.skin }),
      h('rect', { x: 10, y: -32, width: 5, height: 14, rx: 2.5, fill: c.skin }),
    );
    const armsUp = h(
      'g',
      { visibility: 'hidden' },
      h('rect', { x: -14, y: -55, width: 5, height: 23, rx: 2.5, fill: c.skin }),
      h('rect', { x: 9, y: -55, width: 5, height: 23, rx: 2.5, fill: c.skin }),
    );
    const up = h(
      'g',
      { class: 'cf-up' },
      h('rect', { x: -11, y: -34, width: 22, height: 21, rx: 6, fill: c.suit, stroke: INK, 'stroke-width': 2 }),
      h(
        'text',
        {
          x: 0,
          y: -23,
          'text-anchor': 'middle',
          'dominant-baseline': 'central',
          'font-size': 11,
          'font-weight': 900,
          fill: '#fff',
        },
        LET[r],
      ),
      armsDown,
      armsUp,
      ...headEls(c),
      block,
    );
    const g = h(
      'g',
      {},
      h('rect', { class: 'lg1', x: -8, y: -15, width: 6, height: 15, rx: 2, fill: '#6b4f3a' }),
      h('rect', { class: 'lg2', x: 2, y: -15, width: 6, height: 15, rx: 2, fill: '#6b4f3a' }),
      up,
    );
    const home = (0.75 + r * 0.85) * U;
    const b = { g, block, armsDown, armsUp, home, x: home };
    svg.append(g);
    return b;
  });
  const setPos = (b) => b.g.setAttribute('transform', `translate(${b.x.toFixed(1)},${GY})`);
  const carry = (b, color) => {
    b.block.setAttribute('fill', color || '#fff');
    b.block.setAttribute('visibility', color ? 'visible' : 'hidden');
    b.armsUp.setAttribute('visibility', color ? 'visible' : 'hidden');
    b.armsDown.setAttribute('visibility', color ? 'hidden' : 'visible');
  };
  const S = {
    svg,
    turnText,
    reset() {
      for (const p of ps) {
        realEl[p.id].setAttribute('opacity', 0);
        realEl[p.id].removeAttribute('transform');
      }
      crew.forEach((b) => {
        b.x = b.home;
        setPos(b);
        carry(b, null);
        b.g.classList.remove('walk');
      });
      turnText.textContent = '';
    },
    async walk(r, tx) {
      const b = crew[r];
      const x0 = b.x;
      const ms = Math.max(300, (Math.abs(tx - x0) / (WALK_UNITS_PER_S * U)) * 1000);
      b.g.classList.add('walk');
      sfx('step');
      await tween(ms, (k) => {
        b.x = x0 + (tx - x0) * k;
        setPos(b);
      });
      b.g.classList.remove('walk');
    },
    centerX: (p) => X(p.x + p.w / 2),
    carry: (r, color) => carry(crew[r], color),
    home: (r) => crew[r].home,
    async lift(r, p) {
      const b = crew[r];
      carry(b, null);
      const g = realEl[p.id];
      const cx = X(p.x + p.w / 2),
        cy = Y(p.y + p.h / 2);
      const dx = b.x - cx,
        dy = GY - 62 - cy;
      g.setAttribute('opacity', 1);
      // Grow the block from 35 % size at the builder's raised hands (dx, dy) into its place;
      // the cx/cy * (1 - s) terms keep the scale centred on the block's own centre.
      await tween(LIFT_MS, (k) => {
        const s = 0.35 + 0.65 * k;
        g.setAttribute(
          'transform',
          `translate(${(dx * (1 - k) + cx * (1 - s)).toFixed(1)},${(dy * (1 - k) + cy * (1 - s)).toFixed(1)}) scale(${s.toFixed(3)})`,
        );
      });
      if (isAlive()) g.removeAttribute('transform');
    },
  };
  S.reset();
  return S;
}

// Every selector is scoped under .a-construction-foreman (the ID).
const CSS = `
.a-construction-foreman{width:100%;max-width:1040px;display:flex;flex-wrap:wrap;gap:12px;justify-content:center;align-items:flex-start}
.a-construction-foreman.busy .cf-plan{pointer-events:none}
.a-construction-foreman .cf-scene{flex:1 1 360px;max-width:540px;min-width:0;border:3px solid ${INK};border-radius:20px;overflow:hidden;background:linear-gradient(#dff3ff,#fff8e7 88%)}
.a-construction-foreman .cf-scene svg{display:block;width:100%;height:auto;max-height:40vh}
.a-construction-foreman .cf-plan{flex:1 1 320px;max-width:470px;min-width:0;display:flex;flex-direction:column;align-items:center;gap:8px}
.a-construction-foreman .cf-grid{display:grid;gap:4px;align-items:center;justify-content:center;width:100%}
.a-construction-foreman .cf-hd{text-align:center;font-weight:900;font-size:.95rem;border-radius:10px;padding:1px 0}
.a-construction-foreman .cf-hd.cf-corner{font-size:.65rem;opacity:.7}
.a-construction-foreman .cf-hd.now{background:var(--yellow)}
.a-construction-foreman .cf-who{display:flex;flex-direction:column;align-items:center;font-weight:900;font-size:.8rem;line-height:1}
.a-construction-foreman .cf-who svg{width:30px;height:28px}
.a-construction-foreman .cf-cell{aspect-ratio:1/1;min-height:44px;border:3px dashed #c4b89c;border-radius:14px;background:#fffdf6;display:flex;padding:2px;transition:background .2s}
.a-construction-foreman .cf-cell.now{background:#fff1b8;border-style:solid;border-color:#f4b400}
.a-construction-foreman .cf-card{width:56px;height:56px;flex:none;border:3px solid ${INK};border-radius:14px;font-size:1.6rem;font-weight:900;line-height:1;display:grid;place-items:center;position:relative;padding:0;color:${INK};box-shadow:0 3px 0 rgba(43,45,66,.18)}
.a-construction-foreman .cf-cell .cf-card{width:100%;height:100%;font-size:1.35rem;border-radius:10px;box-shadow:none}
.a-construction-foreman .cf-card.glow,.a-construction-foreman .cf-cell.glow{box-shadow:0 0 0 5px rgba(255,190,40,.95)}
.a-construction-foreman .cf-card.cf-sel{outline:4px solid #ff9f1c;outline-offset:2px}
.a-construction-foreman .cf-yard{width:100%;display:flex;flex-wrap:wrap;gap:8px;justify-content:center;align-content:center;min-height:76px;padding:8px;border:3px solid ${INK};border-radius:18px;background:#fdf0d5}
.a-construction-foreman .cf-yard:empty::before{content:'All planned!';font-weight:800;opacity:.6;align-self:center}
.a-construction-foreman .cf-act{display:flex;gap:8px;align-items:center;justify-content:center;flex-wrap:wrap;min-height:50px}
.a-construction-foreman .cf-info{font-weight:800}
.a-construction-foreman .cf-build:not([hidden]){animation:cfPulse 1.4s ease-in-out infinite}
@keyframes cfPulse{50%{transform:scale(1.06)}}
.a-construction-foreman .walk .lg1{animation:cfLeg .26s ease-in-out infinite alternate}
.a-construction-foreman .walk .lg2{animation:cfLeg .26s ease-in-out infinite alternate-reverse}
.a-construction-foreman .walk .cf-up{animation:cfBob .26s ease-in-out infinite alternate}
@keyframes cfLeg{from{transform:translateY(0)}to{transform:translateY(-4px)}}
@keyframes cfBob{to{transform:translateY(-2px)}}
`;

export default {
  id: ID,
  rounds: ROUNDS,
  parentNote:
    'Some jobs must wait for others: a roof needs both walls under it, but the two walls can go up at the same time if there are two builders. Ask "What does this block rest on?" and "Who could be working on something else meanwhile?" The last two rounds give only four turns, so the tall tower must start at once and no turn can be wasted; a common slip is starting the tower late or filling a turn with a job that could wait.',
  start(api) {
    let alive = true;
    let busy = false;
    let R = null;
    api.css(CSS);
    const wrap = h('div', { class: `a-${ID}` });
    api.root.append(wrap);
    const first = pick(['house', 'gate']);
    const cheers = shuffle([
      'Great planning!',
      'Super foreman!',
      'Brilliant building!',
      'Well planned!',
      'What a team!',
    ]);
    let ci = 0;
    const cheerTxt = () => cheers[ci++ % cheers.length];
    const isAlive = () => alive;
    // Promise-based rAF tween with ease-in-out; resolves early once the game is closed.
    const ease = (k) => (k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2);
    function tween(ms, fn) {
      return new Promise((res) => {
        const t0 = performance.now();
        const step = (now) => {
          if (!alive) return res();
          const k = Math.min(1, (now - t0) / ms);
          fn(ease(k));
          if (k < 1) requestAnimationFrame(step);
          else res();
        };
        requestAnimationFrame(step);
      });
    }
    const setBusy = (b) => {
      busy = b;
      wrap.classList.toggle('busy', b);
    };
    const clearGlow = () => wrap.querySelectorAll('.glow').forEach((e) => e.classList.remove('glow'));
    const shake = (el) => {
      el.classList.remove('shake');
      void el.offsetWidth;
      el.classList.add('shake');
      setTimeout(() => el.classList.remove('shake'), 450);
    };
    const resetCard = (c) => {
      c.style.transform = '';
      c.style.transition = '';
      c.style.zIndex = '';
      c._dragBase = { x: 0, y: 0 };
      c._dragPos = null;
    };

    // ---------- one round ----------
    // Build the scene, the builders × turns grid and the yard of shuffled block cards for round i.
    // `done` resolves the round loop at the bottom of start(). R holds all state of the current round.
    function setupRound(i, done) {
      api.stage(i, ROUNDS);
      const cfg = makeCfg(i, first);
      const ps = cfg.pieces;
      const byId = Object.fromEntries(ps.map((p) => [p.id, p]));
      const deps = Object.fromEntries(ps.map((p) => [p.id, ps.filter((q) => q.on.includes(p.id)).map((q) => q.id)]));
      R = {
        i,
        cfg,
        ps,
        byId,
        deps,
        done,
        opt: solve(ps, cfg.m, cfg.T).len,
        placed: new Map(),
        cards: {},
        cells: [],
        heads: [],
        sel: null,
        wrongs: 0,
        tries: 0,
      };
      R.scene = makeScene(cfg, tween, isAlive);
      const grid = h('div', {
        class: 'cf-grid',
        style: { gridTemplateColumns: `34px repeat(${cfg.T}, minmax(44px, 62px))` },
      });
      grid.append(h('div', { class: 'cf-hd cf-corner' }, 'turn'));
      for (let t = 1; t <= cfg.T; t++) {
        const hd = h('div', { class: 'cf-hd' }, String(t));
        R.heads[t] = hd;
        grid.append(hd);
      }
      for (let r = 0; r < cfg.m; r++) {
        grid.append(h('div', { class: 'cf-who', 'aria-label': `Builder ${LET[r]}` }, avatar(r), LET[r]));
        R.cells[r] = [];
        for (let t = 1; t <= cfg.T; t++) {
          const cell = h('div', {
            class: 'cf-cell',
            'data-r': r,
            'data-t': t,
            'aria-label': `Builder ${LET[r]}, turn ${t}`,
            onclick: (e) => {
              if (!e.target.closest('.cf-card')) cellTap(r, t);
            },
          });
          R.cells[r][t] = cell;
          grid.append(cell);
        }
      }
      R.yard = h('div', { class: 'cf-yard' });
      for (const p of shuffle(ps)) {
        const card = h(
          'button',
          {
            class: 'cf-card',
            type: 'button',
            'aria-label': `Block ${p.num}`,
            'data-id': p.id,
            'data-on': p.on.join(' '),
            style: { background: p.color },
          },
          String(p.num),
        );
        R.cards[p.id] = card;
        R.yard.append(card);
        drag(card, {
          dropSelector: `.a-${ID} .cf-cell, .a-${ID} .cf-yard`,
          onDrop: (tgt, el, moved) => onDrop(p.id, tgt, moved),
        });
      }
      R.info = h('div', { class: 'cf-info' });
      R.buildBtn = h(
        'button',
        { class: 'btn primary cf-build', type: 'button', hidden: true, onclick: onBuild },
        '🔨 Build it!',
      );
      R.nextBtn = h(
        'button',
        {
          class: 'btn cf-next',
          type: 'button',
          hidden: true,
          onclick: () => {
            if (!busy) endRound(null);
          },
        },
        'Next ➜',
      );
      const plan = h(
        'div',
        { class: 'cf-plan' },
        grid,
        h('div', { class: 'cf-act' }, R.info, R.buildBtn, R.nextBtn),
        R.yard,
      );
      wrap.replaceChildren(h('div', { class: 'cf-scene' }, R.scene.svg), plan);
      refresh();
      setBusy(false);
      api.prompt(PROMPTS[i]);
    }

    const occupant = (r, t) => {
      for (const [id, v] of R.placed) if (v.row === r && v.turn === t) return id;
      return null;
    };
    const planLen = () => Math.max(0, ...[...R.placed.values()].map((v) => v.turn));
    function refresh() {
      const n = R.ps.length,
        cnt = R.placed.size;
      R.buildBtn.hidden = cnt < n || busy;
      const len = planLen();
      R.info.textContent = cnt < n ? `${cnt} of ${n} planned` : `${len} turns`;
    }
    function select(id) {
      if (R.sel) R.cards[R.sel].classList.remove('cf-sel');
      R.sel = id;
      if (id) {
        R.cards[id].classList.add('cf-sel');
        sfx('tap');
      }
    }
    // Why block `id` cannot go to builder r in turn t (a hint sentence), or null if it can.
    function check(id, r, t) {
      const occ = occupant(r, t);
      if (occ && occ !== id) return `Builder ${LET[r]} is busy then. Try an empty square.`;
      const p = R.byId[id];
      for (const s of p.on) {
        const ps = R.placed.get(s);
        const sn = R.byId[s].num;
        if (!ps) return `Block ${p.num} sits on block ${sn}. Plan ${sn} first.`;
        if (ps.turn === t) return `Not at the same time! Block ${sn} must be finished first.`;
        if (ps.turn > t)
          return ps.turn >= R.cfg.T
            ? `No turn is left after block ${sn}. Move ${sn} earlier.`
            : `Block ${sn} must be done before ${p.num} goes on top.`;
      }
      for (const d of R.deps[id]) {
        const pd = R.placed.get(d);
        if (pd && pd.turn <= t) return `Block ${R.byId[d].num} rests on it, so it must come earlier.`;
      }
      return null;
    }
    function place(id, r, t) {
      const wasDone = R.placed.size === R.ps.length;
      R.placed.set(id, { row: r, turn: t });
      const card = R.cards[id];
      R.cells[r][t].append(card);
      resetCard(card);
      sfx('pop');
      R.wrongs = 0;
      clearGlow();
      select(null);
      refresh();
      if (!wasDone && R.placed.size === R.ps.length && !busy) api.prompt('All planned! Tap "Build it" to watch.');
    }
    // Return a planned block to the yard, together with every planned block resting on it.
    function takeBack(id) {
      const out = new Set([id]);
      let grew = true;
      while (grew) {
        grew = false;
        for (const [d] of R.placed)
          if (!out.has(d) && R.byId[d].on.some((s) => out.has(s))) {
            out.add(d);
            grew = true;
          }
      }
      for (const x of out) {
        if (!R.placed.has(x)) continue;
        R.placed.delete(x);
        const c = R.cards[x];
        R.yard.append(c);
        resetCard(c);
        c.classList.remove('hop');
        void c.offsetWidth;
        c.classList.add('hop');
      }
      sfx('whoosh');
      clearGlow();
      refresh();
    }
    function wrong(msg, cell) {
      R.wrongs++;
      api.nudge(msg);
      if (cell) shake(cell);
      if (R.wrongs >= 2) strongHint();
    }
    function attempt(id, r, t) {
      const why = check(id, r, t);
      if (why) {
        wrong(why, R.cells[r][t]);
        return false;
      }
      place(id, r, t);
      return true;
    }
    // Glow the next block of the fastest plan that still fits around what she has planned.
    function strongHint() {
      clearGlow();
      const fixed = new Map([...R.placed].map(([id, v]) => [id, v.turn]));
      const s = solve(R.ps, R.cfg.m, R.cfg.T, fixed);
      if (!s) {
        const culprit = blocker(fixed);
        if (culprit) {
          R.cards[culprit].classList.add('glow');
          api.nudge(`Tap block ${R.byId[culprit].num} to take it back.`);
        } else api.nudge('Tap a block to take it back, then try again.');
        return;
      }
      let best = null;
      for (const p of R.ps)
        if (!R.placed.has(p.id)) {
          const t = s.turnOf.get(p.id);
          if (!best || t < best.t) best = { id: p.id, t };
        }
      if (!best) return;
      R.cards[best.id].classList.add('glow');
      for (let r = 0; r < R.cfg.m; r++)
        if (!occupant(r, best.t)) {
          R.cells[r][best.t].classList.add('glow');
          break;
        }
    }
    // A planned block whose removal (with what rests on it) lets the plan fit again.
    function blocker(fixed) {
      const order = [...fixed.keys()].reverse();
      for (const id of order) {
        const out = new Set([id]);
        let grew = true;
        while (grew) {
          grew = false;
          for (const [d] of fixed)
            if (!out.has(d) && R.byId[d].on.some((x) => out.has(x))) {
              out.add(d);
              grew = true;
            }
        }
        const f2 = new Map([...fixed].filter(([d]) => !out.has(d)));
        if (solve(R.ps, R.cfg.m, R.cfg.T, f2)) return id;
      }
      return null;
    }
    // Drag end. A tap (not moved) selects a yard card, or takes back a planned one
    // (or, with another card selected, tries to place that card on this square).
    function onDrop(id, tgt, moved) {
      if (busy || !R.cards[id]) return false;
      const pl = R.placed.get(id);
      if (!moved) {
        if (pl) {
          if (R.sel && R.sel !== id) cellTap(pl.row, pl.turn);
          else takeBack(id);
        } else select(R.sel === id ? null : id);
        return true;
      }
      if (!tgt) return false;
      if (tgt.classList.contains('cf-yard')) {
        if (pl) {
          takeBack(id);
          return true;
        }
        return false;
      }
      const r = +tgt.dataset.r,
        t = +tgt.dataset.t;
      if (pl && pl.row === r && pl.turn === t) return false;
      return attempt(id, r, t);
    }
    function cellTap(r, t) {
      if (busy) return;
      if (!R.sel) {
        if (!occupant(r, t)) api.nudge('Pick a block first, then tap a square.');
        return;
      }
      attempt(R.sel, r, t);
    }
    // Tip after a 2nd slow plan in the "fast" round: start the tallest stack in turn 1.
    function tipText() {
      const height = (id) => 1 + Math.max(0, ...R.deps[id].map(height));
      const src = R.ps.filter((p) => !p.on.length);
      const top = Math.max(...src.map((p) => height(p.id)));
      const late = src.find((p) => height(p.id) === top && R.placed.get(p.id)?.turn !== 1);
      if (late) {
        R.cards[late.id].classList.add('glow');
        return `Start block ${late.num} in turn 1! Or tap Next.`;
      }
      return 'Keep every builder busy early. Or tap Next.';
    }

    // ---------- animated construction ----------
    // Play the plan turn by turn: the builders of each turn walk to their blocks, lift them, walk home.
    async function buildAnim(sched, len) {
      const S = R.scene;
      S.reset();
      S.svg.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' });
      for (let t = 1; t <= len; t++) {
        if (!alive) return;
        R.heads.forEach((x) => x && x.classList.remove('now'));
        R.cells.forEach((row) => row.forEach((c) => c && c.classList.remove('now')));
        R.heads[t].classList.add('now');
        R.cells.forEach((row) => row[t].classList.add('now'));
        S.turnText.textContent = `Turn ${t}`;
        sfx('tick');
        const jobs = sched.filter((j) => j.turn === t);
        jobs.forEach((j) => S.carry(j.row, R.byId[j.id].color));
        await Promise.all(jobs.map((j) => S.walk(j.row, S.centerX(R.byId[j.id]) + (j.row - 1) * 3)));
        if (!alive) return;
        await Promise.all(jobs.map((j) => S.lift(j.row, R.byId[j.id])));
        if (!alive) return;
        sfx('drop');
        await Promise.all(jobs.map((j) => S.walk(j.row, S.home(j.row))));
      }
      if (!alive) return;
      R.heads.forEach((x) => x && x.classList.remove('now'));
      R.cells.forEach((row) => row.forEach((c) => c && c.classList.remove('now')));
      S.turnText.textContent = `Done in ${len} turns!`;
    }
    const schedule = () => [...R.placed].map(([id, v]) => ({ id, row: v.row, turn: v.turn }));

    async function onBuild() {
      if (busy || R.placed.size < R.ps.length) return;
      const myR = R;
      const len = planLen();
      setBusy(true);
      refresh();
      clearGlow();
      select(null);
      api.prompt('Builders, go!');
      await buildAnim(schedule(), len);
      if (!alive || R !== myR) return;
      if (R.cfg.fast && len > R.opt) {
        R.tries++;
        await sleep(600);
        if (!alive) return;
        if (R.tries === 1) api.nudge(`That took ${len} turns. Can it be faster? Try ${R.opt}.`);
        else {
          api.nudge(tipText());
          R.nextBtn.hidden = false;
        }
        R.scene.reset();
        setBusy(false);
        refresh();
        return;
      }
      endRound(len);
    }
    async function endRound(len) {
      const myR = R;
      setBusy(true);
      refresh();
      R.nextBtn.hidden = true;
      const n = R.ps.length;
      let msg = cheerTxt();
      if (len == null) msg = 'Good building! On to the next one.';
      else if (R.i === 0) msg = `One builder, ${len} turns. ${msg}`;
      else if (R.i === 1) msg = `Two builders: ${len} turns, not ${n}! ${msg}`;
      else if (R.i === 2) msg = `Fastest plan! Just ${len} turns. ${msg}`;
      else msg = `All built in ${len} turns! ${msg}`;
      api.cheer(msg);
      await sleep(CHEER_PAUSE_MS);
      if (!alive || R !== myR) return;
      myR.done();
    }

    // ---------- Watch demo ----------
    // Clear the plan, fly the cards into the solver's fastest plan (k-th block of a turn → builder k),
    // play the build, then clear the plan again so the child plays the same round.
    api.setDemo(async () => {
      if (busy || !R) return;
      const myR = R;
      setBusy(true);
      const gone = () => !alive || R !== myR;
      for (const id of [...R.placed.keys()]) if (R.placed.has(id)) takeBack(id);
      select(null);
      clearGlow();
      R.scene.reset();
      refresh();
      const s = solve(R.ps, R.cfg.m, R.cfg.T);
      api.say(DEMO_SAY[R.i]);
      await sleep(1400);
      if (gone()) return;
      for (let t = 1; t <= s.len; t++) {
        const ids = R.ps.filter((p) => s.turnOf.get(p.id) === t).map((p) => p.id);
        api.say(`Turn ${t}`);
        for (let k = 0; k < ids.length; k++) {
          await flyTo(R.cards[ids[k]], R.cells[k][t], { duration: 650 });
          if (gone()) return;
          R.placed.set(ids[k], { row: k, turn: t });
          const c = R.cards[ids[k]];
          R.cells[k][t].append(c);
          resetCard(c);
          sfx('pop');
          refresh();
          await sleep(250);
          if (gone()) return;
        }
        await sleep(300);
        if (gone()) return;
      }
      refresh();
      R.buildBtn.hidden = true;
      api.say('Now the builders get to work!');
      await sleep(900);
      if (gone()) return;
      await buildAnim(schedule(), s.len);
      if (gone()) return;
      api.say(`Done in ${s.len} turns. Now you try!`);
      await sleep(1600);
      if (gone()) return;
      for (const id of [...R.placed.keys()]) if (R.placed.has(id)) takeBack(id);
      R.scene.reset();
      setBusy(false);
      refresh();
      api.prompt(PROMPTS[R.i]);
    });

    (async () => {
      const startAt = resumeRound(api, ROUNDS);
      for (let i = startAt; i < ROUNDS; i++) {
        await new Promise((res) => setupRound(i, res));
        if (!alive) return;
      }
      api.finish();
    })();

    return {
      destroy() {
        alive = false;
      },
    };
  },
};
