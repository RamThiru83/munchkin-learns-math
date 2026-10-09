/**
 * Game: Which Room Is Larger?  (id: which-room-larger, level 3)
 *
 * Idea: area is "how many squares of floor"; compare two floor plans by counting squares, not by how big they look.
 * Rounds (every round draws a fresh random puzzle; the child taps squares to count 1, 2, 3...):
 *   1. Two rectangles of the same height, different widths: which is larger?
 *   2. An L-shaped room against a rectangle (counts differ by 2-7): which is larger?
 *   3. A tidy rectangle against a sprawling room with a tail, same area ("They are the same" button appears);
 *      afterwards a "Slide the piece" button moves the tail into the gap to prove it.
 *   4. Two bent (L) rooms of at least 10 squares each, counts differing by 0-3 (sometimes equal).
 *   5. A staircase room (1+2+..+n squares, n = 4 or 5) against a rectangle 0-2 squares away (more, fewer or same).
 * Watch demo: restarts the current round (same puzzle), counts both rooms aloud, glows the answer and, for equal
 *   rooms with a piece, slides the piece; then resets the round for the child to play.
 * Notes:
 *   - Puzzles come from pure generators (genRects, genL, genEqual, genL2, genStair), each verified by checkPuzzle()
 *     (connected cells, independent area recount, answer, slide geometry for round 3); FALLBACK[] after 60 failed tries.
 *     No test hooks are exported.
 *   - layout() picks a square size so the two cards sit side by side, else stacks them; it also runs on resize.
 *   - First wrong answer glows the "Count for me" buttons; a second miss counts both rooms and glows the answer.
 *   - `tok` is bumped on every round (re)start so stale async work (counting, slide, demo) stops itself.
 */
import { h, sleep, shuffle, rand, pick, sfx, resumeRound } from '../lib/core.js';

const ID = 'which-room-larger';

// ---------- constants ----------
const U = 100; // one floor square, in SVG units
const PAD = 12; // margin around a floor plan, in SVG units
const CARD_MIN_W = 190; // narrowest room card in px
const CARD_GAP = 14; // gap between the two cards in px
const SQ_MAX = 56; // largest floor-square size in px
const SQ_MIN_SIDE = 40; // smallest square size that still keeps the cards side by side
const SQ_MIN_STACK = 26; // smallest square size when the cards are stacked
const THEMES = [
  { name: 'blue', label: 'Blue room', emoji: '🧸', floor: '#d3f0fb', strong: '#118ab2' },
  { name: 'pink', label: 'Pink room', emoji: '🎀', floor: '#ffdce8', strong: '#d6336c' },
];
const PROMPTS = [
  'Which room is larger? Tap the squares to count.',
  'One room is bent. Which room is larger?',
  'Which room is larger? Or are they the same?',
  'Both rooms are bent. Which is larger?',
  'Stairs! Which room has more squares?',
];
const ROUNDS = PROMPTS.length;
// Card width for a room that is `cols` squares wide drawn with squares of `s` px.
const cardW = (cols, s) => Math.max(CARD_MIN_W, (cols + 0.2) * s + 30);

// ---------- puzzle generators (pure) ----------
const key = (r, c) => r + ',' + c;
const rect = (w, h) => {
  const o = [];
  for (let r = 0; r < h; r++) for (let c = 0; c < w; c++) o.push([r, c]);
  return o;
};
const transpose = (cs) => cs.map(([r, c]) => [c, r]);
const flipH = (cs, w) => cs.map(([r, c]) => [r, w - 1 - c]);
function norm(groups) {
  let mr = 1e9,
    mc = 1e9;
  groups.flat().forEach(([r, c]) => {
    mr = Math.min(mr, r);
    mc = Math.min(mc, c);
  });
  return groups.map((g) => g.map(([r, c]) => [r - mr, c - mc]));
}
// Independent recount of the area: paint a grid, then count painted squares.
function areaOf(cells) {
  let R = 0,
    C = 0;
  cells.forEach(([r, c]) => {
    R = Math.max(R, r + 1);
    C = Math.max(C, c + 1);
  });
  const g = Array.from({ length: R }, () => Array(C).fill(0));
  cells.forEach(([r, c]) => {
    g[r][c] = 1;
  });
  return g.reduce((s, row) => s + row.reduce((a, b) => a + b, 0), 0);
}
function validRoom(cells) {
  const set = new Set(cells.map(([r, c]) => key(r, c)));
  if (set.size !== cells.length || cells.some(([r, c]) => r < 0 || c < 0)) return false;
  const seen = new Set([key(...cells[0])]);
  const q = [cells[0]];
  while (q.length) {
    const [r, c] = q.pop();
    for (const [dr, dc] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      const k = key(r + dr, c + dc);
      if (set.has(k) && !seen.has(k)) {
        seen.add(k);
        q.push([r + dr, c + dc]);
      }
    }
  }
  return seen.size === set.size;
}
const verdict = (a, b) => (a === b ? 'same' : a > b ? 0 : 1);
const lShape = (a, b, na, nb, corner) =>
  rect(a, b).filter(([r, c]) => {
    const inR = corner & 1 ? c >= a - na : c < na;
    const inB = corner & 2 ? r >= b - nb : r < nb;
    return !(inR && inB);
  });
function wrapPuzzle(rooms) {
  rooms = rooms.map((r) => ({ ...r }));
  return { rooms, answer: verdict(areaOf(rooms[0].cells), areaOf(rooms[1].cells)) };
}
function genRects() {
  const hh = pick([2, 3, 4]);
  let wa, wb;
  do {
    wa = 2 + rand(5);
    wb = 2 + rand(5);
  } while (Math.abs(wa - wb) < 2);
  return wrapPuzzle([{ cells: rect(wa, hh) }, { cells: rect(wb, hh) }]);
}
function genL() {
  for (let t = 0; t < 400; t++) {
    const a = 3 + rand(4),
      b = 3 + rand(3),
      na = 1 + rand(a - 1),
      nb = 1 + rand(b - 1);
    const w = 2 + rand(5),
      hh = 2 + rand(4);
    const L = lShape(a, b, na, nb, rand(4));
    const d = Math.abs(L.length - w * hh);
    if (d >= 2 && d <= 7) return wrapPuzzle(shuffle([{ cells: L }, { cells: rect(w, hh) }]));
  }
  return wrapPuzzle([{ cells: lShape(4, 4, 2, 2, 3) }, { cells: rect(3, 2) }]);
}
// A tidy rectangle vs a sprawling room: a w×h block with a k-square strip taken from one corner and
// stuck on as a tail elsewhere. Same area; the sprawling one looks bigger. Sliding the tail back fills the gap.
function genEqual(fixed) {
  const [w, hh, k] =
    fixed ||
    pick([
      [4, 3, 2],
      [5, 3, 2],
      [4, 4, 2],
      [3, 4, 2],
    ]);
  const notch = Array.from({ length: k }, (_, i) => [i, w - 1]);
  const nk = new Set(notch.map(([r, c]) => key(r, c)));
  let base = rect(w, hh).filter(([r, c]) => !nk.has(key(r, c)));
  let tail = Array.from({ length: k }, (_, i) => [hh + i, 0]);
  let nt = notch;
  if (rand(2)) {
    base = flipH(base, w);
    tail = flipH(tail, w);
    nt = flipH(nt, w);
  }
  if (rand(2)) {
    base = transpose(base);
    tail = transpose(tail);
    nt = transpose(nt);
  }
  [base, tail, nt] = norm([base, tail, nt]);
  const lo = (cs) => cs.slice().sort((p, q) => p[0] - q[0] || p[1] - q[1])[0];
  const dr = lo(nt)[0] - lo(tail)[0],
    dc = lo(nt)[1] - lo(tail)[1];
  const A = rand(2) ? rect(w, hh) : rect(hh, w);
  const B = { cells: base.concat(tail), piece: tail, target: nt, move: [dr, dc], merged: base.concat(nt) };
  return wrapPuzzle(shuffle([{ cells: A }, B]));
}
function genL2() {
  const tgt = pick([0, 1, 1, 2, 3]);
  for (let t = 0; t < 800; t++) {
    const mk = () => {
      const a = 4 + rand(3),
        b = 4 + rand(2);
      return lShape(a, b, 1 + rand(a - 1), 1 + rand(b - 1), rand(4));
    };
    const A = mk(),
      B = mk();
    if (A.length >= 10 && B.length >= 10 && Math.abs(A.length - B.length) === tgt)
      return wrapPuzzle([{ cells: A }, { cells: B }]);
  }
  return wrapPuzzle([{ cells: lShape(5, 4, 2, 2, 3) }, { cells: lShape(4, 4, 1, 2, 0) }]);
}
// A staircase room (1+2+..+n squares) against a rectangle that is 0, 1 or 2 squares away.
function genStair() {
  const n = pick([4, 5]),
    tri = (n * (n + 1)) / 2,
    opts = [];
  for (let w = 2; w <= 7; w++)
    for (let hh = 2; hh <= 7; hh++) {
      const d = w * hh - tri;
      if (Math.abs(d) <= 2) opts.push([w, hh, d === 0]);
    }
  const eq = rand(5) < 2,
    pool = opts.filter((o) => o[2] === eq);
  const [w, hh] = pick(pool.length ? pool : opts);
  let S = [];
  for (let r = 0; r < n; r++) for (let c = 0; c <= r; c++) S.push([r, c]);
  if (rand(2)) S = flipH(S, n);
  if (rand(2)) S = transpose(S);
  return wrapPuzzle(shuffle([{ cells: S }, { cells: rand(2) ? rect(w, hh) : rect(hh, w) }]));
}
const FALLBACK = [
  () => wrapPuzzle([{ cells: rect(3, 3) }, { cells: rect(5, 3) }]),
  () => wrapPuzzle([{ cells: lShape(4, 4, 2, 2, 3) }, { cells: rect(3, 2) }]),
  () => genEqual([4, 3, 2]),
  () => wrapPuzzle([{ cells: lShape(5, 4, 2, 2, 3) }, { cells: lShape(4, 4, 1, 2, 0) }]),
  () => wrapPuzzle([{ cells: rect(5, 2) }, { cells: rect(4, 4).filter(([r, c]) => c <= r) }]),
];
function checkPuzzle(p, i) {
  const [x, y] = p.rooms;
  const a = areaOf(x.cells),
    b = areaOf(y.cells);
  if (!p.rooms.every((r) => validRoom(r.cells) && areaOf(r.cells) === r.cells.length)) return false;
  if (p.answer !== verdict(a, b)) return false;
  if (i === 2) {
    const B = p.rooms.find((r) => r.piece);
    const A = p.rooms.find((r) => !r.piece);
    const moved = new Set(B.piece.map(([r, c]) => key(r + B.move[0], c + B.move[1])));
    if (a !== b || !B.target.every(([r, c]) => moved.has(key(r, c))) || B.merged.length !== A.cells.length)
      return false;
    if (!validRoom(B.merged)) return false;
  }
  return true;
}
function makePuzzle(i) {
  for (let t = 0; t < 60; t++) {
    const p = [genRects, genL, genEqual, genL2, genStair][i]();
    if (checkPuzzle(p, i)) return p;
  }
  return FALLBACK[i]();
}

// ---------- styles ----------
const CSS = `
.a-which-room-larger{width:100%;max-width:960px;display:flex;flex-direction:column;align-items:center;gap:14px}
.a-which-room-larger .board{width:100%;display:flex;justify-content:center;align-items:stretch;gap:14px}
.a-which-room-larger .board.stack{flex-direction:column;align-items:center}
.a-which-room-larger .rm{background:#fff;border:3px solid var(--ink);border-radius:22px;box-shadow:var(--shadow);padding:10px 12px 12px;display:flex;flex-direction:column;align-items:center;gap:8px;min-width:190px}
.a-which-room-larger .hd{width:100%;display:flex;align-items:center;justify-content:space-between;gap:8px;font-weight:800;font-size:1.05rem}
.a-which-room-larger .bd{display:inline-flex;align-items:center;gap:.3em;background:#fff8e7;border:3px solid var(--ink);border-radius:999px;padding:2px 12px;min-height:44px;font-weight:800;font-size:1.25rem;white-space:nowrap}
.a-which-room-larger .bd b{min-width:1.3em;text-align:center}
.a-which-room-larger .bd.full{background:#c9f5e6}
.a-which-room-larger .bd.bump{animation:a-wrl-pop .35s}
.a-which-room-larger svg{display:block;max-width:100%;height:auto;touch-action:manipulation}
.a-which-room-larger .cl{cursor:pointer}
.a-which-room-larger .fl{stroke:rgba(43,45,66,.28);stroke-width:2}
.a-which-room-larger .piece{transition:transform 1.3s cubic-bezier(.4,.1,.2,1)}
.a-which-room-larger .piece.hl .fl{fill:#ffc078}
.a-which-room-larger .walls{fill:none;stroke:#2b2d42;stroke-width:9;stroke-linecap:round;stroke-linejoin:round;transition:opacity .3s;pointer-events:none}
.a-which-room-larger .mk{pointer-events:none;transform-box:fill-box;transform-origin:center;animation:a-wrl-pop .35s}
.a-which-room-larger .mk text{font-weight:800;fill:#fff;font-size:50px;text-anchor:middle}
.a-which-room-larger .foot{margin-top:auto;display:flex;flex-wrap:wrap;gap:8px;justify-content:center}
.a-which-room-larger .foot .btn,.a-which-room-larger .actions .btn{min-height:56px;font-size:1rem}
.a-which-room-larger .actions{min-height:60px}
.a-which-room-larger .glow{background:var(--yellow)}
@keyframes a-wrl-pop{0%{transform:scale(.4)}60%{transform:scale(1.25)}100%{transform:scale(1)}}
`;

export default {
  id: ID,
  rounds: ROUNDS,
  parentNote:
    'A room\'s size is how many floor squares it covers. Let her guess first, then count the squares to check; the last two rounds use bigger, bent and staircase rooms where the counts are close or equal. The common misconception is that the room that is longer, more spread out or turned a different way must be bigger. Ask "How do you know?" and in the last round let her slide the piece to see the rooms are equal.',

  async start(api) {
    let alive = true,
      round = resumeRound(api, ROUNDS),
      tok = 0,
      wrong = 0,
      answered = false,
      busy = false,
      slid = false;
    let puz = null,
      rooms = [];
    api.css(CSS);

    const wrap = h('div', { class: 'a-which-room-larger' });
    const board = h('div', { class: 'board' });
    const actions = h('div', { class: 'act-row actions' });
    const sameBtn = h(
      'button',
      { class: 'btn', type: 'button', onclick: () => choose('same') },
      '🟰 They are the same',
    );
    const slideBtn = h('button', { class: 'btn', type: 'button', onclick: () => doSlide() }, '✂️ Slide the piece');
    const nextBtn = h('button', { class: 'btn primary', type: 'button', onclick: () => next() }, 'Next ▶');
    actions.append(sameBtn, slideBtn, nextBtn);
    wrap.append(board, actions);
    api.root.append(wrap);

    const live = (t) => alive && t === tok;
    const unglow = () => wrap.querySelectorAll('.glow').forEach((e) => e.classList.remove('glow'));
    const nameOf = (r) => THEMES[r.idx].label;
    const narr = async (txt, ms = 500) => {
      await Promise.race([api.prompt(txt), sleep(9000)]);
      await sleep(ms);
    };

    // ---------- drawing ----------
    // SVG path for the walls: a line on every cell edge that has no neighbouring cell.
    function wallsD(cells) {
      const set = new Set(cells.map(([r, c]) => key(r, c)));
      let d = '';
      for (const [r, c] of cells) {
        const x = PAD + c * U,
          y = PAD + r * U;
        if (!set.has(key(r - 1, c))) d += `M${x} ${y}H${x + U}`;
        if (!set.has(key(r + 1, c))) d += `M${x} ${y + U}H${x + U}`;
        if (!set.has(key(r, c - 1))) d += `M${x} ${y}V${y + U}`;
        if (!set.has(key(r, c + 1))) d += `M${x + U} ${y}V${y + U}`;
      }
      return d;
    }

    // One room card: floor-plan SVG (cells are tappable), count badge, "Count for me" and "This one is larger".
    function buildRoom(spec, idx) {
      const th = THEMES[idx];
      const cols = Math.max(...spec.cells.map((c) => c[1])) + 1,
        nrows = Math.max(...spec.cells.map((c) => c[0])) + 1;
      const svg = h('svg', {
        viewBox: `0 0 ${cols * U + 2 * PAD} ${nrows * U + 2 * PAD}`,
        role: 'img',
        'aria-label': `Floor plan of the ${th.label.toLowerCase()} on a square grid`,
      });
      const baseG = h('g'),
        pieceG = h('g', { class: 'piece' });
      const pk = new Set((spec.piece || []).map(([r, c]) => key(r, c)));
      const room = { spec, idx, svg, pieceG, cols, count: 0, counting: false, cells: [] };
      for (const [r, c] of spec.cells) {
        const g = h(
          'g',
          { class: 'cl' },
          h('rect', { class: 'fl', x: PAD + c * U, y: PAD + r * U, width: U, height: U, fill: th.floor }),
        );
        const cell = { r, c, g, n: 0 };
        g.addEventListener('click', () => tapCell(room, cell));
        room.cells.push(cell);
        (pk.has(key(r, c)) ? pieceG : baseG).append(g);
      }
      room.walls = h('path', { class: 'walls', d: wallsD(spec.cells) });
      svg.append(baseG, pieceG, room.walls);
      room.num = h('b', {}, '0');
      room.badge = h('span', { class: 'bd', 'aria-live': 'polite' }, '🔢 ', room.num);
      room.countBtn = h(
        'button',
        {
          class: 'btn',
          type: 'button',
          'aria-label': `Count the squares of the ${th.label.toLowerCase()} for me`,
          onclick: () => countBtn(room),
        },
        '🔢 Count for me',
      );
      room.pickBtn = h(
        'button',
        {
          class: 'btn',
          type: 'button',
          style: { background: th.floor },
          'aria-label': `The ${th.label.toLowerCase()} is larger`,
          onclick: () => choose(idx),
        },
        'This one is larger',
      );
      room.card = h(
        'div',
        { class: 'rm' },
        h('div', { class: 'hd' }, h('span', {}, `${th.emoji} ${th.label}`), room.badge),
        svg,
        h('div', { class: 'foot' }, room.countBtn, room.pickBtn),
      );
      return room;
    }

    function syncBadge(room, bump) {
      room.num.textContent = room.count;
      const full = room.count === room.cells.length;
      room.badge.classList.toggle('full', full);
      room.countBtn.textContent = full ? '↺ Clear' : '🔢 Count for me';
      if (bump) {
        room.badge.classList.remove('bump');
        void room.badge.offsetWidth;
        room.badge.classList.add('bump');
      }
    }
    function markCell(room, cell, speak) {
      if (cell.n) return;
      cell.n = ++room.count;
      const cx = PAD + cell.c * U + U / 2,
        cy = PAD + cell.r * U + U / 2;
      cell.g.append(
        h(
          'g',
          { class: 'mk' },
          h('circle', { cx, cy, r: 38, fill: THEMES[room.idx].strong }),
          h('text', { x: cx, y: cy + 18 }, String(cell.n)),
        ),
      );
      sfx('tick');
      syncBadge(room, true);
      if (speak) api.say(String(cell.n));
    }
    function clearRoom(room) {
      room.cells.forEach((c) => {
        c.n = 0;
        c.g.querySelector('.mk')?.remove();
      });
      room.count = 0;
      syncBadge(room, false);
    }
    function tapCell(room, cell) {
      if (busy) return;
      if (cell.n) {
        const m = cell.g.querySelector('.mk');
        m.style.animation = 'none';
        void m.getBoundingClientRect();
        m.style.animation = '';
        return;
      }
      markCell(room, cell, true);
      if (room.count === room.cells.length) api.say(`${room.count} squares`);
    }
    async function autoCount(room, { delay = 150, speak = false, t = tok } = {}) {
      room.counting = true;
      const todo = room.cells.filter((c) => !c.n).sort((a, b) => a.r - b.r || a.c - b.c);
      for (const c of todo) {
        if (!live(t)) {
          room.counting = false;
          return false;
        }
        if (!c.n) markCell(room, c, speak);
        await sleep(delay);
      }
      room.counting = false;
      return live(t);
    }
    function countBtn(room) {
      if (busy || room.counting || answered) return;
      if (room.count === room.cells.length) {
        clearRoom(room);
        return;
      }
      unglow();
      autoCount(room, { delay: 260, speak: true });
    }

    // ---------- layout ----------
    // Largest square size s (px) at which both cards fit side by side; otherwise stack them and shrink to fit.
    function layout() {
      if (!rooms.length) return;
      const W = wrap.clientWidth || 340;
      const [a, b] = rooms.map((r) => r.cols);
      let s = 0,
        stacked = false;
      for (let x = SQ_MAX; x >= SQ_MIN_SIDE && !s; x -= 2) if (cardW(a, x) + cardW(b, x) + CARD_GAP <= W) s = x;
      if (!s) {
        stacked = true;
        for (let x = SQ_MAX; x >= SQ_MIN_STACK && !s; x -= 2) if (cardW(Math.max(a, b), x) <= W) s = x;
        s = s || SQ_MIN_STACK;
      }
      board.classList.toggle('stack', stacked);
      rooms.forEach((r) => {
        r.svg.style.width = `${(r.cols + 0.2) * s}px`;
      });
    }
    const onResize = () => layout();
    window.addEventListener('resize', onResize);

    // ---------- rounds ----------
    function startRound(i, keep) {
      tok++;
      round = i;
      wrong = 0;
      answered = false;
      slid = false;
      busy = false;
      api.stage(i, ROUNDS);
      if (!keep || !puz) puz = makePuzzle(i);
      rooms = puz.rooms.map((spec, idx) => buildRoom(spec, idx));
      board.replaceChildren(...rooms.map((r) => r.card));
      sameBtn.hidden = i < 2;
      sameBtn.disabled = false;
      slideBtn.hidden = true;
      slideBtn.textContent = '✂️ Slide the piece';
      nextBtn.hidden = true;
      nextBtn.textContent = i < ROUNDS - 1 ? 'Next ▶' : 'Finish ⭐';
      unglow();
      layout();
      api.prompt(PROMPTS[i]);
    }
    function next() {
      sfx('tap');
      if (round < ROUNDS - 1) startRound(round + 1);
      else api.finish();
    }

    async function choose(which) {
      if (busy || answered) return;
      sfx('tap');
      unglow();
      const t = tok;
      if (which === puz.answer) {
        answered = true;
        busy = true;
        rooms.forEach((r) => {
          r.pickBtn.disabled = true;
          r.countBtn.disabled = true;
        });
        sameBtn.disabled = true;
        await Promise.all(rooms.map((r) => autoCount(r, { delay: 60, t })));
        if (!live(t)) return;
        busy = false;
        const [a, b] = rooms.map((r) => r.count);
        const hi = Math.max(a, b),
          lo = Math.min(a, b);
        if (puz.answer === 'same') {
          if (rooms.some((r) => r.spec.piece)) {
            api.cheer(`Yes! Both have ${a} squares. Slide the piece to see!`);
            slideBtn.hidden = false;
            slideBtn.classList.add('glow');
          } else api.cheer(pick([`Yes! Both have ${a} squares.`, `Lovely! They are the same: ${a}.`]));
        } else {
          api.cheer(
            pick([
              `Yes! ${hi} is more than ${lo}!`,
              `You got it! ${hi} and ${lo}.`,
              `Lovely! ${hi} is more than ${lo}.`,
            ]),
          );
        }
        nextBtn.hidden = false;
        sameBtn.hidden = true;
        return;
      }
      wrong++;
      (which === 'same' ? sameBtn : rooms[which].card).classList.add('shake');
      setTimeout(() => (which === 'same' ? sameBtn : rooms[which].card).classList.remove('shake'), 450);
      if (wrong === 1) {
        rooms.forEach((r) => r.countBtn.classList.add('glow'));
        api.nudge(round >= 2 ? 'It can look big, but count the squares!' : 'Not yet. Tap the squares to count them!');
        return;
      }
      busy = true;
      await api.nudge('Let us count together.');
      if (!live(t)) return;
      await Promise.all(rooms.map((r) => autoCount(r, { delay: 200, t })));
      if (!live(t)) return;
      busy = false;
      const [a, b] = rooms.map((r) => r.count);
      if (puz.answer === 'same') {
        api.nudge(`Both have ${a}. Are they the same?`);
        sameBtn.classList.add('glow');
      } else {
        api.nudge(`${nameOf(rooms[0])} has ${a}. ${nameOf(rooms[1])} has ${b}. Which is more?`);
        rooms[puz.answer].pickBtn.classList.add('glow');
      }
    }

    // Round 3: slide the tail piece into the gap (and back); the walls are redrawn for the new shape.
    async function doSlide() {
      const r = rooms.find((x) => x.spec.piece);
      if (!r || busy) return;
      busy = true;
      unglow();
      sfx('whoosh');
      const t = tok,
        fwd = !slid,
        [dr, dc] = r.spec.move;
      r.walls.style.opacity = 0;
      r.pieceG.classList.add('hl');
      await sleep(350);
      if (!live(t)) return;
      r.pieceG.style.transform = fwd ? `translate(${dc * U}px, ${dr * U}px)` : 'translate(0px, 0px)';
      await sleep(1450);
      if (!live(t)) return;
      slid = fwd;
      r.walls.setAttribute('d', wallsD(fwd ? r.spec.merged : r.spec.cells));
      r.walls.style.opacity = 1;
      slideBtn.textContent = slid ? '↩ Put it back' : '✂️ Slide the piece';
      sfx('drop');
      busy = false;
      if (slid && !busy && !nextBtn.hidden) api.prompt('The piece fits. The same number of squares!');
    }

    // ---------- watch demo ----------
    // Restart the current round on the same puzzle, narrate while counting both rooms, then reset it.
    api.setDemo(async () => {
      startRound(round, true);
      const t = tok;
      busy = true;
      const [x, y] = rooms;
      const ok = () => live(t);
      await narr(`Let us count the ${x.idx === 0 ? 'blue' : 'pink'} room.`, 200);
      if (!ok() || !(await autoCount(x, { delay: 400, speak: true, t }))) return;
      await narr(`${x.count} squares.`, 300);
      if (!ok()) return;
      await narr(`Now the ${y.idx === 0 ? 'blue' : 'pink'} room.`, 200);
      if (!ok() || !(await autoCount(y, { delay: 400, speak: true, t }))) return;
      await narr(`${y.count} squares.`, 300);
      if (!ok()) return;
      if (puz.answer === 'same') {
        sameBtn.classList.add('glow');
        await narr(`Both have ${x.count}. They are the same!`, 400);
        if (!ok()) return;
        busy = false;
        if (rooms.some((r) => r.spec.piece)) {
          await narr('Watch the piece slide into the gap.', 100);
          if (!ok()) return;
          await doSlide();
          if (!ok()) return;
          await narr('Same squares, just in a new place!', 900);
        } else await narr('Different shapes, same squares!', 900);
      } else {
        const w = rooms[puz.answer];
        w.pickBtn.classList.add('glow');
        await narr(`${w.count} is more than ${rooms[1 - puz.answer].count}. ${nameOf(w)} is larger!`, 1000);
      }
      if (ok()) startRound(round);
    });

    startRound(round);
    return {
      destroy() {
        alive = false;
        window.removeEventListener('resize', onResize);
      },
    };
  },
};
