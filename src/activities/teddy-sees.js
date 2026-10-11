/**
 * Game: What Does Teddy See?  (id: teddy-sees, level 2)
 *
 * Idea: other people see the same toys differently from where they sit (perspective taking), and position words
 * (in front of, behind, left, right) and maps describe where things are. Book theme: "What does the other person see?".
 * Rounds (every round draws a fresh random scene on a 3×3 table; she always sits at the front):
 *   1. Teddy sits across; 2 toys in one row. Pick Teddy's view of 3 pictures (it is left-right reversed).
 *   2. Teddy sits at her left or right side; 3 toys in different rows and columns (never one behind another). Pick of 3.
 *   3. Teddy sits across or at a side; 3 toys, some in one line for Teddy, so a toy can hide. Pick of 4; her own view
 *      is always one of the wrong pictures.
 *   4. Position words from her seat: two pre-placed toys (tower, box); drag the ball "in front of"/"behind" one, then
 *      the party hat "to the left/right of" one. Hand icons show left and right. Any cell on that side counts.
 *   5. Map: follow a top-down map to put 3 toys on the table, then pick which of 4 pictures Teddy sees.
 * Watch demo: restarts the current round on the same scene, explains Teddy's seat, glows the right picture (or flies
 *   the toys to right cells), then restarts the round for her to play.
 * Notes:
 *   - Views are computed, never drawn by hand: seen() turns a table cell into (u = place from the viewer's left,
 *     d = rows away) for each seat; a toy is hidden when a box or tower at least as tall stands nearer in the same
 *     line (the ball and the cone-shaped hat never hide anything: TOYS[].hides).
 *     Pictures are compared by sig(): the left-to-right order of non-empty lines, each listed front to back.
 *   - Verified in Node (_test, 20 000 draws per round): every pick round has exactly one option whose sig equals
 *     Teddy's view, all option sigs differ, her own view is an option (rounds 1-3, 5), no toy hides in rounds 1-2,
 *     Teddy sees a toy behind or hidden by another in round 3, only a box or tower ever hides a toy, and round 4 always has an empty cell for clue 1 and a
 *     left/right clue 2 for every possible ball cell. One try succeeds 63-100% of the time (300 tries are allowed), and
 *     the FALLBACK puzzles pass the same checks. Two toys in different rows and columns give only two distinct
 *     pictures, which is why round 2 always has 3 toys.
 *   - Toy heights (ball < hat < box < tower) also order their widths, and only the wide box and tower hide, so an
 *     omitted hidden toy would really be covered.
 *   - Test hooks (read by tests/playthrough/teddy-sees.spec.js, no answers exposed): scene toys `.toyg[data-toy]
 *     [data-x][data-y]`, `.teddy[data-seat]`, cells `.cell[data-x][data-y]`, option items `.opt [data-u][data-d]`,
 *     map icons `.map [data-toy]`, tray toys `.toy[data-toy]`, `.actions .btn.primary` for Next.
 *     `_test` exports the pure generators for the Node check only.
 *   - Fragile: the table's rows are 63 units apart and the tallest toy on it is 58, so no toy hides another in the
 *     scene; keep that if T or the toy scale changes. On phones (≤ 600 px) the scene is capped at 30vh and the pictures at 15vh
 *     (2×2) so all options fit a 390×780 screen without scrolling; round 5 puts map and tray side by side so
 *     the table stays in view while dragging; tapping a toy and then a cell also works.
 *   - `tok` is bumped on every round (re)start so stale async work (the demo) stops itself.
 */
import { h, sleep, rand, pick, shuffle, drag, flyTo, sfx, COLORS, resumeRound } from '../lib/core.js';

const ID = 'teddy-sees';
const ROUNDS = 5;
const N = 3; // the table is N×N cells: x = 0..2 from her left, y = 0 (back row) .. 2 (front row, next to her)

// ---------- toys and seats ----------
// h = height in drawing units. Only solid, wide toys (hides: true) can hide a toy that is not taller than them;
// the ball and the cone-shaped party hat never hide anything (a cone would not really cover a ball).
const TOYS = {
  ball: { name: 'ball', h: 34, hides: false },
  hat: { name: 'party hat', h: 49, hides: false },
  box: { name: 'box', h: 60, hides: true },
  tower: { name: 'tower', h: 99, hides: true },
};
const hidesBehind = (front, back) => TOYS[front].hides && TOYS[front].h >= TOYS[back].h;
const TOY_IDS = Object.keys(TOYS);
const SEAT_HINT = {
  N: 'Teddy sits across from you. Your left is his right.',
  E: 'Teddy sits on your right. Your front row is on his left.',
  W: 'Teddy sits on your left. Your front row is on his right.',
};
const REL = {
  front: { words: 'in front of', hint: 'In front means nearer to you.', ok: (c, a) => c.x === a.x && c.y > a.y },
  behind: { words: 'behind', hint: 'Behind means further away from you.', ok: (c, a) => c.x === a.x && c.y < a.y },
  left: { words: 'to the left of', hint: 'Left is the 👈 side.', ok: (c, a) => c.y === a.y && c.x < a.x },
  right: { words: 'to the right of', hint: 'Right is the 👉 side.', ok: (c, a) => c.y === a.y && c.x > a.x },
};
const PICK = [
  { toys: [2], seats: ['N'], opts: 3, layout: 'row' },
  { toys: [3], seats: ['E', 'W'], opts: 3, layout: 'spread' },
  { toys: [3], seats: ['N', 'E', 'W'], opts: 4, layout: 'line' },
];
const PROMPTS = [
  'Teddy sits across. Which picture shows what Teddy sees?',
  'Teddy sits at the side. Which picture shows his view?',
  'Teddy moved! Which picture shows what Teddy sees?',
  '', // round 4 speaks its clues
  'Follow the map. Put each toy in its place.',
];
const TALK = [
  ['Is the ball on your left or Teddy’s left?', 'What would you see from Teddy’s chair?'],
  ['Which toy is nearest to Teddy?', 'Is the ball on Teddy’s left or right?'],
  ['What can Teddy see that you can’t?', 'Where would you sit to see the box behind the tower?'],
  ['Which hand is your left?', 'What is behind the box? What is in front of it?'],
  ['How does the map show where things are?', 'What can Teddy see that you can’t?'],
];
const CHEERS = ['Yes!', 'You got it!', 'Lovely thinking!', 'Well spotted!'];

// ---------- pure helpers: views ----------
const cellsAll = () => Array.from({ length: N * N }, (_, i) => ({ x: i % N, y: Math.floor(i / N) }));
// Where table cell (x, y) appears to someone in `seat`: u = place from their left, d = rows away (0 = nearest).
function seen(seat, x, y) {
  if (seat === 'S') return { u: x, d: N - 1 - y };
  if (seat === 'N') return { u: N - 1 - x, d: y };
  if (seat === 'E') return { u: N - 1 - y, d: N - 1 - x }; // facing west: her front row is on his left
  return { u: y, d: x }; // W, facing east: the back row is on his left
}
// What `seat` sees: the toys left visible, each with its place u and distance d.
function viewFrom(scene, seat) {
  const items = scene.map((t) => ({ toy: t.toy, ...seen(seat, t.x, t.y) }));
  return items.filter((a) => !items.some((b) => b !== a && b.u === a.u && b.d < a.d && hidesBehind(b.toy, a.toy)));
}
const mirror = (view) => view.map((t) => ({ ...t, u: N - 1 - t.u }));
// A picture's identity as a child reads it: lines from left to right, each listed front to back.
function sig(view) {
  const cols = [];
  for (let u = 0; u < N; u++) {
    const col = view.filter((t) => t.u === u).sort((a, b) => a.d - b.d);
    if (col.length) cols.push(col.map((t) => t.toy).join('+'));
  }
  return cols.join('|');
}
// Teddy's view plus n-1 wrong pictures: her own view first, then the mirror, then other seats. null if too few differ.
function buildOptions(scene, seat, n) {
  const right = viewFrom(scene, seat);
  const others = shuffle(['N', 'E', 'W'].filter((s) => s !== seat));
  const pool = [viewFrom(scene, 'S'), mirror(right), ...others.map((s) => viewFrom(scene, s))];
  pool.push(...others.map((s) => mirror(viewFrom(scene, s))), mirror(viewFrom(scene, 'S')));
  const used = new Set([sig(right)]);
  if (used.has(sig(pool[0]))) return null;
  const opts = [{ view: right, ok: true }];
  for (const v of pool) {
    if (opts.length === n) break;
    if (!used.has(sig(v))) {
      used.add(sig(v));
      opts.push({ view: v, ok: false });
    }
  }
  return opts.length === n ? shuffle(opts) : null;
}
const hasLine = (view) => view.length < 2 || new Set(view.map((t) => t.u)).size < view.length;
function placeToys(toys, layout) {
  const cells = shuffle(cellsAll());
  if (layout === 'row') {
    const y = 1 + rand(2);
    return shuffle(cellsAll().filter((c) => c.y === y))
      .slice(0, toys.length)
      .map((c, i) => ({ toy: toys[i], ...c }));
  }
  if (layout === 'spread') {
    const xs = shuffle([0, 1, 2]),
      ys = shuffle([0, 1, 2]);
    return toys.map((toy, i) => ({ toy, x: xs[i], y: ys[i] }));
  }
  return toys.map((toy, i) => ({ toy, ...cells[i] }));
}
function makePick(cfg) {
  const toys = shuffle(TOY_IDS).slice(0, pick(cfg.toys));
  const scene = placeToys(toys, cfg.layout);
  const seat = pick(cfg.seats);
  const right = viewFrom(scene, seat);
  if (cfg.layout !== 'line' && right.length !== scene.length) return null;
  if (cfg.layout === 'line' && !hasLine(scene.map((t) => seen(seat, t.x, t.y)))) return null;
  const options = buildOptions(scene, seat, cfg.opts);
  return options && { kind: 'pick', scene, seat, options };
}

// ---------- pure helpers: position words (round 4) and map (round 5) ----------
const free = (scene, c) => !scene.some((t) => t.x === c.x && t.y === c.y);
const validCells = (scene, clue) => {
  const a = scene.find((t) => t.toy === clue.anchor);
  return cellsAll().filter((c) => free(scene, c) && REL[clue.rel].ok(c, a));
};
function makePlace() {
  const [p, q] = shuffle(cellsAll());
  const scene = [
    { toy: 'tower', ...p },
    { toy: 'box', ...q },
  ];
  const clue = { toy: 'ball', rel: pick(['front', 'behind']), anchor: pick(['tower', 'box']) };
  return validCells(scene, clue).length ? { kind: 'place', scene, clues: [clue] } : null;
}
// Clue 2 is chosen after the ball is down: a left/right clue with a free cell, preferring the other anchor.
function nextClue(scene, first) {
  const anchors = first.anchor === 'tower' ? ['box', 'tower'] : ['tower', 'box'];
  const tries = [];
  for (const anchor of anchors) for (const rel of shuffle(['left', 'right'])) tries.push({ toy: 'hat', rel, anchor });
  tries.push(...anchors.flatMap((anchor) => ['front', 'behind'].map((rel) => ({ toy: 'hat', rel, anchor }))));
  return tries.find((c) => validCells(scene, c).length) || null;
}
function makeMap() {
  const scene = placeToys(shuffle(TOY_IDS).slice(0, 3), 'any');
  const seat = pick(['N', 'E', 'W']);
  const options = buildOptions(scene, seat, 4);
  return options && { kind: 'map', scene, seat, options };
}
// Fixed puzzles in case a generator keeps failing (it never did in the Node check, which also checks these).
const pickOf = (kind, seat, scene, n) => ({ kind, seat, scene, options: buildOptions(scene, seat, n) });
const at = (toy, x, y) => ({ toy, x, y });
const FALLBACK = [
  () => pickOf('pick', 'N', [at('ball', 0, 2), at('tower', 2, 2)], 3),
  () => pickOf('pick', 'E', [at('box', 0, 0), at('ball', 1, 2), at('hat', 2, 1)], 3),
  () => pickOf('pick', 'W', [at('ball', 0, 1), at('tower', 2, 1), at('hat', 1, 2)], 4),
  () => ({
    kind: 'place',
    scene: [at('tower', 1, 1), at('box', 2, 0)],
    clues: [{ toy: 'ball', rel: 'front', anchor: 'tower' }],
  }),
  () => pickOf('map', 'E', [at('box', 0, 0), at('ball', 1, 0), at('tower', 2, 2)], 4),
];
function makeRound(i) {
  for (let t = 0; t < 300; t++) {
    const p = i < 3 ? makePick(PICK[i]) : i === 3 ? makePlace() : makeMap();
    if (p) return p;
  }
  return FALLBACK[i]();
}
// A short sentence about what Teddy sees, for the cheer and the demo.
function explain(scene, seat) {
  const v = viewFrom(scene, seat);
  const hidden = scene.find((t) => !v.some((s) => s.toy === t.toy));
  const name = (t) => TOYS[t].name;
  if (hidden) {
    const me = seen(seat, hidden.x, hidden.y);
    const front = v.find((s) => s.u === me.u && s.d < me.d);
    return `For Teddy, the ${name(hidden.toy)} hides behind the ${name(front.toy)}.`;
  }
  const lefts = v.filter((s) => s.u === Math.min(...v.map((t) => t.u))).sort((a, b) => a.d - b.d);
  if (lefts.length > 1) return `Teddy sees the ${name(lefts[1].toy)} behind the ${name(lefts[0].toy)}.`;
  return `Teddy sees the ${name(lefts[0].toy)} on his left.`;
}

// Pure parts, for the Node brute-force check (see Notes in the header).
export const _test = {
  seen,
  viewFrom,
  sig,
  makeRound,
  nextClue,
  validCells,
  cellsAll,
  tryOnce: (i) => (i < 3 ? makePick(PICK[i]) : i === 3 ? makePlace() : makeMap()),
  fallback: (i) => FALLBACK[i](),
};

// ---------- drawing (SVG) ----------
const INK = COLORS.ink;
const lerp = (a, b, t) => a + (b - a) * t;
// A toy drawn standing on (0, 0), growing upwards.
function toyArt(toy) {
  const s = { stroke: INK, 'stroke-width': 3, 'stroke-linejoin': 'round' };
  if (toy === 'ball')
    return [
      h('circle', { cx: 0, cy: -17, r: 16, fill: COLORS.sky, ...s }),
      h('path', { d: 'M-15 -21 Q0 -11 15 -21', fill: 'none', stroke: '#fff', 'stroke-width': 5 }),
      h('path', { d: 'M-12 -8 Q0 -2 12 -8', fill: 'none', stroke: COLORS.red, 'stroke-width': 4 }),
    ];
  if (toy === 'hat')
    return [
      h('polygon', { points: '-21,0 21,0 0,-43', fill: COLORS.purple, ...s }),
      h('circle', { cx: -6, cy: -12, r: 3.5, fill: COLORS.yellow }),
      h('circle', { cx: 7, cy: -20, r: 3.5, fill: COLORS.yellow }),
      h('circle', { cx: 0, cy: -44, r: 5, fill: COLORS.yellow, ...s }),
    ];
  if (toy === 'box')
    return [
      h('rect', { x: -28, y: -60, width: 56, height: 60, rx: 4, fill: COLORS.red, ...s }),
      h('rect', { x: -5, y: -59, width: 10, height: 58, fill: COLORS.yellow }),
      h('rect', { x: -27, y: -35, width: 54, height: 10, fill: COLORS.yellow }),
    ];
  return [COLORS.green, COLORS.yellow, COLORS.blue].map((fill, i) =>
    h('rect', { x: -27, y: -33 * (i + 1), width: 54, height: 33, rx: 3, fill, ...s }),
  );
}
const toyG = (toy, x, y, k, attrs = {}) =>
  h('g', { transform: `translate(${x} ${y}) scale(${k})`, 'data-toy': toy, ...attrs }, toyArt(toy));
function teddyArt(seat, x, y, k) {
  const fur = '#c68b59',
    pale = '#f1d3b3',
    s = { stroke: INK, 'stroke-width': 3 };
  return h(
    'g',
    { class: 'teddy', 'data-seat': seat, transform: `translate(${x} ${y}) scale(${k})` },
    h('ellipse', { cx: 0, cy: 22, rx: 22, ry: 18, fill: fur, ...s }),
    h('circle', { cx: -17, cy: -20, r: 9, fill: fur, ...s }),
    h('circle', { cx: 17, cy: -20, r: 9, fill: fur, ...s }),
    h('circle', { cx: 0, cy: -6, r: 21, fill: fur, ...s }),
    h('ellipse', { cx: 0, cy: 2, rx: 9, ry: 7, fill: pale }),
    h('circle', { cx: 0, cy: -1, r: 3, fill: INK }),
    h('circle', { cx: -8, cy: -11, r: 3, fill: INK }),
    h('circle', { cx: 8, cy: -11, r: 3, fill: INK }),
  );
}

// The table seen from her seat, a little from above. Cells are drop targets in the placing rounds.
// Rows are further apart (63 units) than the tallest toy drawn on the table (58), so no toy ever hides another here.
const T = { farY: 100, nearY: 290, farL: 145, farR: 295, nearL: 45, nearR: 395 };
function pt(s, t) {
  const l = lerp(T.farL, T.nearL, t),
    r = lerp(T.farR, T.nearR, t);
  return [lerp(l, r, s), lerp(T.farY, T.nearY, t)];
}
const TEDDY_AT = { N: [220, 60, 0.9], E: [408, 195, 0.85], W: [32, 195, 0.85] };
function drawScene({ toys, seat, hands }) {
  const poly = (ps) => ps.map((p) => p.join(',')).join(' ');
  const cells = cellsAll().map(({ x, y }) =>
    h('polygon', {
      class: 'cell',
      'data-x': x,
      'data-y': y,
      points: poly([pt(x / N, y / N), pt((x + 1) / N, y / N), pt((x + 1) / N, (y + 1) / N), pt(x / N, (y + 1) / N)]),
    }),
  );
  const toyLayer = h('g', { class: 'lay' });
  // Back row first so nearer toys are drawn in front.
  [...toys]
    .sort((a, b) => a.y - b.y)
    .forEach((t) => {
      const [cx, cy] = pt((t.x + 0.5) / N, (t.y + 0.5) / N);
      const k = lerp(0.42, 0.62, (t.y + 0.5) / N);
      toyLayer.append(toyG(t.toy, cx, cy + 18, k, { class: 'toyg', 'data-x': t.x, 'data-y': t.y }));
    });
  const svg = h(
    'svg',
    { viewBox: '0 0 440 345', role: 'img', 'aria-label': 'A table with toys, seen from your seat' },
    seat ? h('g', { class: 'lay' }, teddyArt(seat, ...TEDDY_AT[seat])) : null,
    h('polygon', { points: '45,290 395,290 389,306 51,306', fill: '#d9a066', stroke: INK, 'stroke-width': 4 }),
    h('polygon', {
      points: poly([pt(0, 0), pt(1, 0), pt(1, 1), pt(0, 1)]),
      fill: '#f4d6a6',
      stroke: INK,
      'stroke-width': 4,
    }),
    cells,
    toyLayer,
    h('text', { x: 220, y: 336, class: 'lbl', 'text-anchor': 'middle' }, '🙂 You'),
    hands ? h('text', { x: 14, y: 336, class: 'lbl' }, '👈 left') : null,
    hands ? h('text', { x: 426, y: 336, class: 'lbl', 'text-anchor': 'end' }, 'right 👉') : null,
  );
  return { svg, cells };
}
// One picture: toys at eye level, nearer toys lower and in front. Items carry data-u / data-d.
function drawView(view, label) {
  const items = [...view]
    .sort((a, b) => b.d - a.d)
    .map((t) => toyG(t.toy, 45 + 75 * t.u, 140 - 14 * t.d, 1 - 0.1 * t.d, { 'data-u': t.u, 'data-d': t.d }));
  return h(
    'svg',
    { viewBox: '0 0 240 160', 'aria-hidden': 'true' },
    h('rect', { x: 2, y: 2, width: 236, height: 156, rx: 14, fill: '#eaf6ff' }),
    h('polygon', { points: '8,146 232,146 214,102 26,102', fill: '#f4d6a6', stroke: INK, 'stroke-width': 3 }),
    h('rect', { x: 8, y: 146, width: 224, height: 9, fill: '#d9a066', stroke: INK, 'stroke-width': 3 }),
    items,
    label ? h('text', { x: 14, y: 28, class: 'lbl' }, label) : null,
  );
}
// The map for round 5: a flat grid seen from straight above, her seat at the bottom.
function drawMap(scene, seat) {
  const C = 48,
    X0 = 48,
    Y0 = 40;
  const sq = cellsAll().map(({ x, y }) =>
    h('rect', { x: X0 + x * C, y: Y0 + y * C, width: C, height: C, fill: '#fffdf5', stroke: INK, 'stroke-width': 2 }),
  );
  const icons = scene.map((t) =>
    toyG(t.toy, X0 + (t.x + 0.5) * C, Y0 + (t.y + 1) * C - 5, 0.4, { 'data-x': t.x, 'data-y': t.y }),
  );
  const tp = { N: [120, 20], E: [220, 112], W: [20, 112] }[seat];
  return h(
    'svg',
    { viewBox: '0 0 240 236', role: 'img', 'aria-label': 'A map of where the toys go' },
    sq,
    icons,
    teddyArt(seat, tp[0], tp[1], 0.42),
    h('text', { x: 120, y: 222, class: 'lbl', 'text-anchor': 'middle' }, '🙂 You'),
  );
}
const trayToy = (toy) =>
  h(
    'button',
    { class: 'toy', type: 'button', 'data-toy': toy, 'aria-label': `The ${TOYS[toy].name}` },
    h('svg', { viewBox: '-38 -106 76 112', 'aria-hidden': 'true' }, toyArt(toy)),
  );

// ---------- styles ----------
const CSS = `
.a-${ID}{width:100%;max-width:980px;display:flex;flex-direction:column;align-items:center;gap:12px}
.a-${ID} .board{width:100%;display:flex;flex-wrap:wrap;justify-content:center;align-items:flex-start;gap:14px}
.a-${ID} .scene{flex:1 1 320px;max-width:470px;background:#fff;border:3px solid var(--ink);border-radius:22px;box-shadow:var(--shadow);padding:6px}
.a-${ID} svg{display:block;width:100%;height:auto}
.a-${ID} .side{flex:1 1 300px;max-width:470px;display:flex;flex-direction:column;gap:12px}
.a-${ID} .opts{display:flex;flex-wrap:wrap;justify-content:center;gap:10px}
.a-${ID} .opt{flex:0 1 calc(50% - 5px);background:#fff;border:3px solid var(--ink);border-radius:18px;padding:3px;cursor:pointer;box-shadow:0 4px 0 rgba(43,45,66,.18);min-height:56px;transition:opacity .3s}
.a-${ID} .opt svg{pointer-events:none}
.a-${ID} .opt.dim{opacity:.45}
.a-${ID} .opt.right{background:#c9f5e6;border-color:#06a77d}
.a-${ID} .opt.glow{box-shadow:0 0 0 6px rgba(255,209,102,.95)}
.a-${ID} .map{background:#fff;border:3px solid var(--ink);border-radius:18px;padding:6px}
.a-${ID} .map svg{max-width:240px;margin:0 auto}
.a-${ID} .map.glow{box-shadow:0 0 0 6px rgba(255,209,102,.95)}
.a-${ID} .cap{font-weight:800;text-align:center;margin:0 0 2px}
.a-${ID} .tray{display:flex;gap:10px;justify-content:center;flex-wrap:wrap;background:#fff8e7;border:3px dashed var(--ink);border-radius:18px;padding:8px;min-height:96px}
.a-${ID} .toy{width:72px;height:80px;border:3px solid var(--ink);border-radius:16px;background:#fff;padding:2px;position:relative}
@media (max-width:600px){
  .a-${ID}{gap:8px}
  .a-${ID} .board{gap:10px}
  .a-${ID} .scene{padding:2px}
  .a-${ID} .scene svg{max-height:30vh}
  .a-${ID} .opts{gap:8px}
  .a-${ID} .opt{flex:0 1 calc(50% - 4px);padding:2px}
  .a-${ID} .opt svg{max-height:15vh}
  .a-${ID} .map{padding:2px 4px}
  .a-${ID} .map svg{max-height:27vh}
  .a-${ID} .side.mapside{flex-direction:row;align-items:flex-start;gap:8px}
  .a-${ID} .mapside .map{flex:1 1 0;min-width:0}
  .a-${ID} .mapside .tray{flex:none;flex-direction:column;flex-wrap:nowrap;padding:6px;gap:6px}
  .a-${ID} .mapside .toy{width:62px;height:64px}
}
.a-${ID} .toy svg{width:100%;height:100%;pointer-events:none}
.a-${ID} .toy.sel{background:var(--yellow)}
.a-${ID} .cell{fill:transparent;stroke:rgba(43,45,66,.28);stroke-width:2}
.a-${ID} .placing .cell{cursor:pointer}
.a-${ID} .cell.glow{fill:rgba(255,209,102,.8)}
.a-${ID} .lay{pointer-events:none}
.a-${ID} .teddy.glow{filter:drop-shadow(0 0 6px #ffb703) drop-shadow(0 0 3px #ffb703)}
.a-${ID} .lbl{font-weight:800;font-size:20px;fill:var(--ink)}
.a-${ID} .actions{min-height:60px}
.a-${ID} .actions .btn{min-height:56px;font-size:1.05rem}
`;

export default {
  id: ID,
  rounds: ROUNDS,
  parentNote:
    'Children of this age often think everyone sees what they see. Teddy sits in another chair, and she picks the picture of his view: across the table left and right swap, from the side the nearest toy looks closest, and a tall toy can hide a small one. Later rounds practise "in front of", "behind", "left" and "right" from her own seat, and reading a simple map. If she is stuck, let her walk round and sit in Teddy\'s place.',
  talkPrompts: [
    'What can Teddy see that you can’t?',
    'Is the ball on Teddy’s left or right?',
    'Where would you sit to see the box behind the tower?',
  ],

  async start(api) {
    let alive = true,
      round = resumeRound(api, ROUNDS),
      tok = 0,
      wrong = 0,
      pz = null, // the round's puzzle from makeRound()
      onTable = [], // toys on the table now
      step = 0, // round 4: which clue; round 5: 0 = placing, 1 = picking
      done = false,
      selected = null; // tray toy chosen by a tap (tap a toy, then a cell)
    api.css(CSS);

    const wrap = h('div', { class: `a-${ID}` });
    const board = h('div', { class: 'board' });
    const sceneBox = h('div', { class: 'scene' });
    const side = h('div', { class: 'side' });
    const nextBtn = h('button', { class: 'btn primary', type: 'button', onclick: () => next() }, 'Next ▶');
    const actions = h('div', { class: 'act-row actions' }, nextBtn);
    board.append(sceneBox, side);
    wrap.append(board, actions);
    api.root.append(wrap);

    let scene = null; // { svg, cells } of the drawn table
    let mapBox = null,
      tray = null,
      opts = null;
    const live = (t) => alive && t === tok;
    const unglow = () => wrap.querySelectorAll('.glow').forEach((e) => e.classList.remove('glow'));
    // Speak a line and let it finish (capped generously), then pause a little. Demo only.
    const spoken = (p, text) => Promise.race([p, sleep(1500 + 90 * text.length)]);
    const narr = async (text, ms = 500) => {
      await spoken(api.prompt(text), text);
      await sleep(ms);
    };
    const cellEl = (x, y) => scene.cells.find((c) => +c.dataset.x === x && +c.dataset.y === y);

    // ---------- drawing the round ----------
    function redrawScene() {
      const teddy = pz.kind === 'pick' || pz.kind === 'map' ? pz.seat : null;
      scene = drawScene({ toys: onTable, seat: teddy, hands: pz.kind !== 'pick' });
      scene.cells.forEach((c) => c.addEventListener('click', () => tapCell(+c.dataset.x, +c.dataset.y)));
      sceneBox.classList.toggle('placing', isPlacing());
      sceneBox.replaceChildren(scene.svg);
    }
    const isPlacing = () => pz.kind === 'place' || (pz.kind === 'map' && step === 0);

    function showOptions() {
      opts = h(
        'div',
        { class: `opts n${pz.options.length}` },
        pz.options.map((o, i) => {
          const b = h(
            'button',
            { class: 'opt', type: 'button', 'aria-label': `Picture ${i + 1}` },
            drawView(o.view, String(i + 1)),
          );
          o.btn = b;
          b.addEventListener('click', () => choose(o));
          return b;
        }),
      );
      side.append(opts);
    }
    function fillTray(toys) {
      tray = h('div', { class: 'tray', 'aria-label': 'Toys to place' });
      toys.forEach((toy) => tray.append(makeTrayToy(toy)));
      side.append(tray);
    }
    function makeTrayToy(toy) {
      const b = trayToy(toy);
      let down = null;
      b.addEventListener('pointerdown', (e) => (down = [e.clientX, e.clientY]));
      b.addEventListener('click', (e) => {
        // A tap (not the end of a drag) selects the toy; then she taps a cell.
        if (down && Math.abs(e.clientX - down[0]) + Math.abs(e.clientY - down[1]) > 8) return;
        tray
          .querySelectorAll('.toy')
          .forEach((t) => t.classList.toggle('sel', t === b && !b.classList.contains('sel')));
        selected = b.classList.contains('sel') ? toy : null;
        sfx('tap');
      });
      drag(b, {
        dropSelector: `.a-${ID} .cell`,
        onDrop: (cell) => tryPlace(toy, +cell.dataset.x, +cell.dataset.y),
      });
      return b;
    }

    function startRound(i, keep) {
      tok++;
      round = i;
      wrong = 0;
      step = 0;
      done = false;
      selected = null;
      api.stage(i, ROUNDS);
      api.setTalk(TALK[i]);
      if (!keep || !pz) pz = makeRound(i);
      if (pz.kind === 'place') pz.clues.length = 1; // clue 2 depends on where the ball goes
      onTable = pz.kind === 'map' ? [] : pz.scene.map((t) => ({ ...t }));
      side.replaceChildren();
      side.classList.toggle('mapside', pz.kind === 'map');
      mapBox = tray = opts = null;
      redrawScene();
      nextBtn.hidden = true;
      nextBtn.textContent = i < ROUNDS - 1 ? 'Next ▶' : 'Finish ⭐';
      if (pz.kind === 'pick') showOptions();
      if (pz.kind === 'map') {
        mapBox = h('div', { class: 'map' }, h('p', { class: 'cap' }, '🗺️ Map'), drawMap(pz.scene, pz.seat));
        side.append(mapBox);
        fillTray(pz.scene.map((t) => t.toy));
      }
      // The prompt never blocks play; its promise is returned so the demo can wait for it before narrating.
      if (pz.kind === 'place') {
        fillTray([pz.clues[0].toy]);
        return api.prompt(clueText(pz.clues[0]));
      }
      return api.prompt(PROMPTS[i]);
    }
    const clueText = (c) => `Put the ${TOYS[c.toy].name} ${REL[c.rel].words} the ${TOYS[c.anchor].name}.`;

    function next() {
      sfx('tap');
      if (round < ROUNDS - 1) startRound(round + 1);
      else api.finish();
    }
    function roundDone(text) {
      done = true;
      api.cheer(text);
      nextBtn.hidden = false;
    }

    // ---------- picking a picture ----------
    function choose(o) {
      if (done || (pz.kind === 'map' && step === 0)) return;
      sfx('tap');
      unglow();
      if (o.ok) {
        o.btn.classList.add('right');
        pz.options.forEach((x) => x !== o && x.btn.classList.add('dim'));
        roundDone(`${pick(CHEERS)} ${explain(pz.scene, pz.seat)}`);
        return;
      }
      wrong++;
      o.btn.classList.add('shake', 'dim');
      setTimeout(() => o.btn.classList.remove('shake'), 450);
      if (wrong === 1) {
        api.nudge('Not quite. Imagine you sit in Teddy’s chair.');
        return;
      }
      api.nudge(SEAT_HINT[pz.seat]);
      scene.svg.querySelector('.teddy')?.classList.add('glow');
      pz.options.find((x) => x.ok).btn.classList.add('glow');
    }

    // ---------- placing toys ----------
    function tapCell(x, y) {
      if (!selected || !isPlacing()) return;
      const b = tray.querySelector(`.toy[data-toy="${selected}"]`);
      if (tryPlace(selected, x, y) === false) b?.classList.add('shake');
      setTimeout(() => b?.classList.remove('shake'), 450);
    }
    // Put a toy on the table (no checks). Removes it from the tray.
    function putDown(toy, x, y) {
      onTable.push({ toy, x, y });
      tray.querySelector(`.toy[data-toy="${toy}"]`)?.remove();
      selected = null;
      sfx('drop');
      redrawScene();
    }
    function tryPlace(toy, x, y) {
      if (!isPlacing() || done) return false;
      unglow();
      if (!free(onTable, { x, y })) {
        api.nudge('That spot is taken. Try another one!');
        return false;
      }
      if (pz.kind === 'place') {
        const clue = pz.clues[step];
        if (toy !== clue.toy) return false;
        const a = onTable.find((t) => t.toy === clue.anchor);
        if (!REL[clue.rel].ok({ x, y }, a)) {
          missed(REL[clue.rel].hint, validCells(onTable, clue));
          return false;
        }
        putDown(toy, x, y);
        wrong = 0;
        if (step === 0) advanceClue(true);
        else roundDone('Lovely! You followed both clues!');
        return true;
      }
      const goal = pz.scene.find((t) => t.toy === toy);
      if (goal.x !== x || goal.y !== y) {
        missed('Look at the map again. Which row? Which side?', [goal], true);
        return false;
      }
      putDown(toy, x, y);
      wrong = 0;
      if (onTable.length === pz.scene.length) startPicking(true);
      else api.cheer(pick(['Yes, just like the map!', 'Right spot!', 'Good map reading!']));
      return true;
    }
    function missed(hint, cells, map) {
      wrong++;
      if (wrong === 1) {
        api.nudge(`${hint} Try again!`);
        return;
      }
      api.nudge(map ? 'Try the glowing spot. Find it on the map too.' : `${hint} Try a glowing spot!`);
      cells.forEach((c) => cellEl(c.x, c.y)?.classList.add('glow'));
      if (map) mapBox.classList.add('glow');
    }
    // Round 4: after the ball, choose and show clue 2 (hat to the left/right of a toy).
    function advanceClue(speak) {
      step = 1;
      pz.clues[1] = nextClue(onTable, pz.clues[0]);
      tray.replaceChildren(makeTrayToy('hat'));
      const text = clueText(pz.clues[1]);
      if (speak) api.cheer(`Yes! ${text}`);
      return text;
    }
    // Round 5: all toys follow the map; now pick Teddy's view.
    function startPicking(speak) {
      step = 1;
      side.replaceChildren(); // the table now matches the map, so the pictures take its place
      side.classList.remove('mapside');
      mapBox = tray = null;
      redrawScene();
      showOptions();
      if (speak) api.cheer('Just like the map! Which picture shows what Teddy sees?');
    }

    // ---------- watch demo ----------
    api.setDemo(async () => {
      const intro = startRound(round, true);
      const t = tok,
        ok = () => live(t);
      // Let the round's own prompt finish before the demo starts talking.
      await spoken(intro, PROMPTS[round] || clueText(pz.clues[0]));
      await sleep(300);
      if (!ok()) return;
      const fly = async (toy, c) => {
        const b = tray.querySelector(`.toy[data-toy="${toy}"]`);
        await flyTo(b, cellEl(c.x, c.y), { duration: 700 });
        if (ok()) putDown(toy, c.x, c.y);
      };
      const showPick = async () => {
        await narr(SEAT_HINT[pz.seat], 300);
        if (!ok()) return;
        scene.svg.querySelector('.teddy')?.classList.add('glow');
        await sleep(700);
        if (!ok()) return;
        const right = pz.options.find((o) => o.ok);
        right.btn.classList.add('glow');
        await narr(`This picture! ${explain(pz.scene, pz.seat)}`, 1200);
      };
      if (pz.kind === 'pick') await showPick();
      else if (pz.kind === 'place') {
        for (let s = 0; s < 2 && ok(); s++) {
          const clue = pz.clues[s];
          if (s === 1) await narr(clueText(clue), 200); // clue 1 was spoken when the round started
          if (!ok()) return;
          await narr(REL[clue.rel].hint, 200);
          if (!ok()) return;
          const a = onTable.find((x) => x.toy === clue.anchor);
          const cells = validCells(onTable, clue);
          // The cell right next to the anchor reads best.
          const c = cells.sort(
            (p, q) => Math.abs(p.x - a.x) + Math.abs(p.y - a.y) - Math.abs(q.x - a.x) - Math.abs(q.y - a.y),
          )[0];
          await fly(clue.toy, c);
          if (ok() && s === 0) advanceClue(false);
          await sleep(500);
        }
      } else {
        await narr('The map shows each toy from above. You sit at the bottom.', 300);
        for (const goal of pz.scene) {
          if (!ok()) return;
          await fly(goal.toy, goal);
          await sleep(400);
        }
        if (!ok()) return;
        startPicking(false);
        await showPick();
      }
      if (ok()) {
        await sleep(600);
        if (ok()) startRound(round, true);
      }
    });

    startRound(round);
    return {
      destroy() {
        alive = false;
      },
    };
  },
};
