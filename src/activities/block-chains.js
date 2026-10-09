/**
 * Game: Chain of Blocks  (id: block-chains, level 4)
 *
 * Idea: attribute blocks (colour x shape x size) are chained so that next-door blocks differ in exactly
 *   one feature; the eight blocks are the corners of a cube and a chain is a walk along its edges.
 * Rounds:
 *   1. Chain of 4: first block given; fill the next slots left to right from a tray of 3 + 2 decoys.
 *   2. Two parts: (a) a 5-chain (4 on phones) with one gap, picked from all spare blocks;
 *      (b) a 4-ring with three blocks given: close the ring so the last block fits both neighbours.
 *   3. Ring of all eight blocks, one given; fill the other seven in any order.
 *   4. Twist: chain of 4 where neighbours differ in exactly TWO features (same-parity blocks; 3 decoys).
 *   5. 2 x 4 grid, two opposite corners given; every across and up-down neighbour differs in one feature.
 * Watch demo: redraws the current puzzle, flies each solution block into place saying what changed,
 *   then redraws the empty puzzle and says "Your turn!".
 * Notes:
 *   - Block id is a 3-bit number: bit0 colour (red/blue), bit1 shape (circle/square), bit2 size (big/small).
 *   - Puzzles are random each time. Any placement is accepted if the solver can still finish the board
 *     with the remaining tray blocks (so alternative answers are fine); otherwise it bounces with a "?".
 *   - 2 misses in a row -> strong hint (glowing block + feature tip). Hint button: level 1 then 2.
 *   - Rounds 1-5 map to 6 puzzle steps (ROUND_OF); ROUNDS is the round count, not an array.
 *   - Round 2a picks the chain length from window.innerWidth at round start (PHONE_MAX_W).
 *   - Ring layout is positioned in % around the centre; for the 8-ring the Hint button sits in the middle.
 *   - No exported test hooks. Solvability: an 8-ring (Gray code) and a 2 x 4 grid both embed in the cube
 *     from any starting block, and solve() builds the reference solution, so every puzzle is solvable.
 */
import { h, sleep, shuffle, rand, pick, drag, flyTo, sfx, COLORS, resumeRound } from '../lib/core.js';

const ID = 'block-chains';
const ATTR = ['colour', 'shape', 'size'];
const ALL_BLOCKS = [0, 1, 2, 3, 4, 5, 6, 7];
const PHONE_MAX_W = 440; // below this width a 5-block chain does not fit one row
const BUBBLE_MS = 2200; // how long the "what changed" bubble stays after a miss
const STRONG_HINT_DELAY_MS = 1600; // pause before the automatic hint after 2 misses
const diffs = (a, b) => ATTR.filter((_, i) => ((a ^ b) >> i) & 1);
const dist = (a, b) => diffs(a, b).length;
const FILL = [COLORS.red, COLORS.blue];
const EDGE = ['#b02a4c', '#0b5f7c'];
const ICON = {
  colour: `<path d="M12 3a9 9 0 0 0 0 18z" fill="${COLORS.red}"/><path d="M12 3a9 9 0 0 1 0 18z" fill="${COLORS.blue}"/>`,
  shape: '<circle cx="6" cy="12" r="5" fill="#2b2d42"/><rect x="13" y="7" width="10" height="10" fill="#2b2d42"/>',
  size: '<circle cx="8" cy="12" r="7" fill="#2b2d42"/><circle cx="19.5" cy="14" r="3.5" fill="#2b2d42"/>',
};

// ----- pure helpers -----
const nameOf = (id) =>
  `${['big', 'small'][(id >> 2) & 1]} ${['red', 'blue'][id & 1]} ${['circle', 'square'][(id >> 1) & 1]}`;

// Backtracking solver: fill every empty slot from `pool` (each block once) so that every edge's two
// blocks differ in exactly `need` features. Returns the filled assignment, or null if impossible.
function solve(assign, edges, pool, need = 1) {
  const nb = assign.map(() => []);
  edges.forEach(([a, b]) => {
    nb[a].push(b);
    nb[b].push(a);
  });
  const empty = assign.map((v, i) => (v == null ? i : -1)).filter((i) => i >= 0);
  const cur = assign.slice();
  const used = new Set();
  const rec = (k) => {
    if (k === empty.length) return true;
    const s = empty[k];
    for (const b of pool) {
      if (used.has(b)) continue;
      if (nb[s].every((t) => cur[t] == null || dist(cur[t], b) === need)) {
        cur[s] = b;
        used.add(b);
        if (rec(k + 1)) return true;
        cur[s] = null;
        used.delete(b);
      }
    }
    return false;
  };
  return rec(0) ? cur : null;
}
// Random walk along cube edges (one feature changes per step) that never revisits a block;
// restarts until it reaches `len` blocks.
function randomPath(len) {
  for (;;) {
    const p = [rand(8)];
    while (p.length < len) {
      const last = p[p.length - 1];
      const opts = [0, 1, 2].map((i) => last ^ (1 << i)).filter((x) => !p.includes(x));
      if (!opts.length) break;
      p.push(pick(opts));
    }
    if (p.length === len) return p;
  }
}
const chainEdges = (n) => Array.from({ length: n - 1 }, (_, i) => [i, i + 1]);
const ringEdges = (n) => Array.from({ length: n }, (_, i) => [i, (i + 1) % n]);
const others = (used) => shuffle(ALL_BLOCKS.filter((x) => !used.includes(x)));

// ----- the four puzzles (round 2 has two parts) -----
function cfgChain() {
  const p = randomPath(4);
  const extra = others(p).slice(0, 2);
  return {
    kind: 'chain',
    n: 4,
    seq: true,
    edges: chainEdges(4),
    prefill: [p[0], null, null, null],
    tray: shuffle([p[1], p[2], p[3], ...extra]),
    sol: p,
    prompt: 'Make a chain! Change just one thing each time.',
    done: 'A lovely chain! One change each time.',
  };
}
function cfgGap() {
  const n = window.innerWidth < PHONE_MAX_W ? 4 : 5; // a 5-chain does not fit a phone row
  const p = randomPath(n);
  const pre = p.slice();
  pre[n === 5 ? 2 : 1 + rand(2)] = null;
  return {
    kind: 'chain',
    n,
    seq: false,
    edges: chainEdges(n),
    prefill: pre,
    tray: others(pre.filter((x) => x != null)),
    sol: p,
    prompt: 'One block is missing. Which one fits both sides?',
    done: 'Yes! It fits on both sides.',
  };
}
function cfgLoop() {
  const v = rand(8);
  const [i, j] = shuffle([0, 1, 2]);
  const c = [v, v ^ (1 << i), v ^ (1 << i) ^ (1 << j), v ^ (1 << j)];
  return {
    kind: 'ring',
    n: 4,
    seq: false,
    edges: ringEdges(4),
    prefill: [c[0], c[1], c[2], null],
    tray: others(c.slice(0, 3)),
    sol: c,
    prompt: 'Close the ring! The last block must fit both neighbours.',
    done: 'The ring is closed! Well done!',
  };
}
function cfgRing() {
  const pre = [rand(8), null, null, null, null, null, null, null];
  const tray = others([pre[0]]);
  const sol = solve(pre, ringEdges(8), shuffle(tray));
  return {
    kind: 'ring',
    n: 8,
    seq: false,
    edges: ringEdges(8),
    prefill: pre,
    tray,
    sol,
    prompt: 'Use all eight blocks. Neighbours change just one thing.',
    done: 'All eight in a ring! Wonderful!',
  };
}
// Round 4 twist: neighbours differ in exactly TWO features. The four blocks with the
// same parity (even/odd number of bits) all differ from each other in exactly two.
function cfgTwo() {
  const v = rand(8);
  const par = (x) => (x ^ (x >> 1) ^ (x >> 2)) & 1;
  const same = shuffle(ALL_BLOCKS.filter((x) => x !== v && par(x) === par(v)));
  const p = [v, ...same];
  const extra = shuffle(ALL_BLOCKS.filter((x) => par(x) !== par(v))).slice(0, 3);
  return {
    kind: 'chain',
    n: 4,
    seq: true,
    need: 2,
    edges: chainEdges(4),
    prefill: [v, null, null, null],
    tray: shuffle([...same, ...extra]),
    sol: p,
    prompt: 'New rule! Change exactly two things each time.',
    turn: 'Change exactly two things each time.',
    done: 'Two changes every time! Clever!',
  };
}
// Round 5: all eight blocks in a 2 x 4 grid; across AND up-down neighbours change one thing.
const gridEdges = (rows, cols) => {
  const e = [];
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols - 1; c++) e.push([r * cols + c, r * cols + c + 1]);
  for (let r = 0; r < rows - 1; r++) for (let c = 0; c < cols; c++) e.push([r * cols + c, (r + 1) * cols + c]);
  return e;
};
function cfgGrid() {
  const rows = 2;
  const cols = 4;
  const edges = gridEdges(rows, cols);
  const start = [rand(8), null, null, null, null, null, null, null];
  const sol = solve(start, edges, shuffle(others([start[0]])));
  const pre = start.slice();
  pre[7] = sol[7]; // two opposite corners given
  return {
    kind: 'grid',
    n: 8,
    rows,
    cols,
    seq: false,
    edges,
    prefill: pre,
    tray: others([pre[0], pre[7]]),
    sol,
    prompt: 'Fill the grid! Across and up-down: one change.',
    done: 'The whole grid fits! Amazing!',
  };
}
// Puzzle steps in play order, and which round (progress dot) each step belongs to.
const PLAN = [cfgChain, cfgGap, cfgLoop, cfgRing, cfgTwo, cfgGrid];
const ROUND_OF = [0, 1, 1, 2, 3, 4];
const ROUNDS = ROUND_OF[ROUND_OF.length - 1] + 1;

// ----- drawings -----
function blockSvg(id) {
  const small = (id >> 2) & 1;
  const square = (id >> 1) & 1;
  const c = id & 1;
  const st = `fill="${FILL[c]}" stroke="${EDGE[c]}" stroke-width="4"`;
  const shape = square
    ? small
      ? `<rect x="30" y="30" width="40" height="40" rx="4" ${st}/>`
      : `<rect x="14" y="14" width="72" height="72" rx="6" ${st}/>`
    : `<circle cx="50" cy="50" r="${small ? 22 : 40}" ${st}/>`;
  return h('svg', { viewBox: '0 0 100 100', 'aria-hidden': 'true', html: shape });
}
const icon = (a, cls = 'ic') =>
  h('svg', { viewBox: '0 0 24 24', class: cls, 'data-a': a, 'aria-hidden': 'true', html: ICON[a] });

const CSS = `
.a-block-chains{--s:clamp(56px,15vw,84px);width:100%;max-width:980px;display:flex;flex-direction:column;align-items:center;gap:14px;padding-bottom:12px}
.a-block-chains .board{width:100%;display:flex;justify-content:center}
.a-block-chains .chain{display:flex;flex-wrap:wrap;justify-content:center;align-items:center;gap:10px 3px;max-width:100%;padding-bottom:30px}
.a-block-chains .slot{width:var(--s);height:var(--s);border:3px dashed #c9c3b2;border-radius:18px;background:rgba(255,255,255,.55);display:grid;place-items:center;position:relative;flex:none;transition:background .2s,border-color .2s}
.a-block-chains .slot.open{border-color:#2b2d42;background:#fffbe9}
.a-block-chains .slot.filled{border-color:transparent;background:transparent}
.a-block-chains .blk{width:calc(var(--s) - 4px);height:calc(var(--s) - 4px);border-radius:16px;background:#fff;border:2px solid #e6dfcb;box-shadow:0 3px 0 rgba(43,45,66,.14);position:relative;display:grid;place-items:center;flex:none}
.a-block-chains .blk svg{width:92%;height:92%;pointer-events:none}
.a-block-chains .blk.dragging{box-shadow:0 10px 18px rgba(43,45,66,.25)}
.a-block-chains .conn{display:flex;flex-direction:column;gap:2px;padding:3px;border-radius:12px;background:#fff;border:2px solid #e6dfcb;flex:none}
.a-block-chains .ic{width:16px;height:16px;padding:1px;border-radius:50%;opacity:.28;transition:opacity .2s,background .2s;display:block}
.a-block-chains .ic.on{opacity:1;background:#ffe08a;box-shadow:0 0 0 2px #ffd166}
.a-block-chains .ic.peek{opacity:1;background:#ffe08a;animation:bc-pulse .9s ease-in-out infinite}
@keyframes bc-pulse{50%{box-shadow:0 0 0 5px rgba(255,209,102,.9);transform:scale(1.25)}}
.a-block-chains .grid{display:grid;gap:3px;align-items:center;justify-items:center;max-width:100%;padding-bottom:30px}
.a-block-chains .ring{position:relative;width:min(100%,440px);aspect-ratio:1/1;flex:none}
.a-block-chains .ring.n4{width:min(100%,300px)}
.a-block-chains .ring .slot{position:absolute}
.a-block-chains .ring .conn{position:absolute;transform:translate(-50%,-50%)}
.a-block-chains .ring .conn{flex-direction:row}
.a-block-chains .ring .mid{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%)}
.a-block-chains .ring.spin{animation:bc-spin 1.4s cubic-bezier(.5,0,.3,1)}
@keyframes bc-spin{to{rotate:360deg}}
.a-block-chains .bub{position:absolute;top:calc(100% + 5px);left:50%;transform:translateX(-50%);display:flex;gap:3px;align-items:center;background:#fff;border:2px solid #f4a261;border-radius:12px;padding:2px 5px;z-index:30;pointer-events:none;animation:bc-in .25s ease-out}
.a-block-chains .bub .ic,.a-block-chains .tip .ic{opacity:1;width:20px;height:20px;background:#ffe9c7}
.a-block-chains .bub b{font-size:.8rem}
.a-block-chains .tip{position:absolute;top:-14px;right:-10px;display:flex;background:#fff;border:2px solid #ffd166;border-radius:12px;padding:1px;z-index:5;pointer-events:none;animation:bc-pulse .9s ease-in-out infinite}
@keyframes bc-in{from{opacity:0;margin-top:-6px}}
.a-block-chains .tray{display:flex;flex-wrap:wrap;gap:10px;justify-content:center;align-content:center;padding:12px;border-radius:24px;background:rgba(255,255,255,.6);border:3px solid rgba(43,45,66,.1);width:min(100%,560px);min-height:calc(var(--s) + 30px)}
.a-block-chains .tray .blk{cursor:grab}
.a-block-chains .tools{display:flex;gap:10px;justify-content:center}
.a-block-chains .hint{min-height:48px}
.a-block-chains .glow{box-shadow:0 0 0 5px rgba(255,209,102,.95)}
.a-block-chains .slot.glow{border-color:#f4a261;background:#fff3d6}
`;

export default {
  id: ID,
  rounds: ROUNDS,
  parentNote:
    'Each block has three features: colour, shape and size; next-door blocks must differ in exactly one, so ask “what changed?” at every step. The usual slip is changing two things at once, and in the ring of all eight the last block must also fit the first. Later rounds flip the rule to exactly two changes, then fill a grid where each block must fit its neighbours across and up-down.',
  async start(api) {
    const startAt = resumeRound(api, ROUNDS);
    let alive = true;
    let gen = 0;
    let step = ROUND_OF.indexOf(startAt);
    let demoOn = false;
    const timers = new Set();
    const later = (fn, ms) => {
      const t = setTimeout(() => {
        timers.delete(t);
        if (alive) fn();
      }, ms);
      timers.add(t);
    };
    api.css(CSS);
    const wrap = h('div', { class: `a-${ID}` });
    const board = h('div', { class: 'board' });
    const tray = h('div', { class: 'tray', 'aria-label': 'Blocks to choose from' });
    const hintBtn = h('button', { class: 'btn small hint', 'aria-label': 'Hint' }, '💡 Hint');
    wrap.append(board, tray, h('div', { class: 'tools' }, hintBtn));
    api.root.append(wrap);

    let S = null; // current board state

    function clearHints() {
      wrap.querySelectorAll('.glow').forEach((e) => e.classList.remove('glow'));
      wrap.querySelectorAll('.peek').forEach((e) => e.classList.remove('peek'));
      wrap.querySelectorAll('.tip').forEach((e) => e.remove());
    }
    function setOpen() {
      const { assign, cfg, slots } = S;
      const firstEmpty = assign.findIndex((v) => v == null);
      slots.forEach((el, i) => {
        const open = assign[i] == null && (!cfg.seq || i === firstEmpty);
        el.classList.toggle('open', open);
        el.classList.toggle('filled', assign[i] != null);
      });
    }
    function updateLights() {
      S.cfg.edges.forEach(([a, b], k) => {
        const d = S.assign[a] != null && S.assign[b] != null ? diffs(S.assign[a], S.assign[b]) : [];
        S.lights[k].querySelectorAll('.ic').forEach((ic) => ic.classList.toggle('on', d.includes(ic.dataset.a)));
      });
    }
    function makeBlock(id) {
      return h('div', { class: 'blk', 'data-id': id, role: 'img', 'aria-label': nameOf(id) }, blockSvg(id));
    }
    const remainingTray = () => [...tray.querySelectorAll('.blk')].map((e) => +e.dataset.id);
    const edgeIndex = (s, t) => S.cfg.edges.findIndex(([a, b]) => (a === s && b === t) || (a === t && b === s));
    const filledNbrs = (s) =>
      S.cfg.edges
        .filter(([a, b]) => a === s || b === s)
        .map(([a, b]) => (a === s ? b : a))
        .filter((t) => S.assign[t] != null);

    function render(cfg) {
      gen++;
      clearHints();
      board.replaceChildren();
      tray.replaceChildren();
      S = { cfg, assign: cfg.prefill.slice(), slots: [], lights: [], streak: 0, hintLevel: 0 };
      const { n } = cfg;
      const slotEl = (i) => {
        const el = h('div', { class: 'slot', 'data-i': i, 'aria-label': `Place ${i + 1}` });
        if (cfg.prefill[i] != null) el.append(makeBlock(cfg.prefill[i]));
        S.slots.push(el);
        return el;
      };
      const connEl = (k = S.lights.length) => {
        const c = h(
          'div',
          { class: 'conn', 'aria-hidden': 'true' },
          ATTR.map((a) => icon(a)),
        );
        S.lights[k] = c;
        return c;
      };
      const at = (el, r, c) => {
        el.style.gridRow = r;
        el.style.gridColumn = c;
        return el;
      };
      if (cfg.kind === 'grid') {
        // Slots sit on odd grid lines; connectors on the even line between two slots.
        const { cols } = cfg;
        const grid = h('div', { class: 'grid' });
        for (let i = 0; i < n; i++) grid.append(at(slotEl(i), 2 * Math.floor(i / cols) + 1, 2 * (i % cols) + 1));
        cfg.edges.forEach(([a, b], k) => {
          const ra = Math.floor(a / cols);
          const ca = a % cols;
          grid.append(b === a + 1 ? at(connEl(k), 2 * ra + 1, 2 * ca + 2) : at(connEl(k), 2 * ra + 2, 2 * ca + 1));
        });
        board.append(grid);
      } else if (cfg.kind === 'chain') {
        const row = h('div', { class: 'chain' });
        for (let i = 0; i < n; i++) {
          row.append(slotEl(i));
          if (i < n - 1) row.append(connEl());
        }
        board.append(row);
      } else {
        // Ring: slots on a circle of radius r% around the centre; each connector sits on the chord
        // midpoint between two slots, rotated along the ring with its icons rotated back upright.
        const ring = h('div', { class: `ring n${n}` });
        const off = n === 4 ? -135 : -90;
        const r = n === 4 ? 33 : 39;
        const ang = (i) => ((off + (i * 360) / n) * Math.PI) / 180;
        for (let i = 0; i < n; i++) {
          const el = slotEl(i);
          el.style.left = `calc(${50 + r * Math.cos(ang(i))}% - var(--s) / 2)`;
          el.style.top = `calc(${50 + r * Math.sin(ang(i))}% - var(--s) / 2)`;
          ring.append(el);
        }
        for (let i = 0; i < n; i++) {
          const c = connEl();
          const m = ang(i) + Math.PI / n;
          const rc = r * Math.cos(Math.PI / n);
          const deg = (m * 180) / Math.PI;
          c.style.left = `${50 + rc * Math.cos(m)}%`;
          c.style.top = `${50 + rc * Math.sin(m)}%`;
          c.style.transform = `translate(-50%,-50%) rotate(${deg}deg)`;
          c.querySelectorAll('.ic').forEach((ic) => {
            ic.style.transform = `rotate(${-deg}deg)`;
          });
          ring.append(c);
        }
        if (n > 4) ring.append(h('div', { class: 'mid' }, hintBtn));
        board.append(ring);
      }
      if (cfg.kind !== 'ring' || n <= 4) wrap.querySelector('.tools').append(hintBtn);
      for (const id of cfg.tray) {
        const el = makeBlock(id);
        el._h = drag(el, {
          dropSelector: '.a-block-chains .slot.open',
          onDrop: (slot, b) => tryPlace(+slot.dataset.i, b),
        });
        tray.append(el);
      }
      setOpen();
      updateLights();
    }

    // Put tray block `el` into slot `s`; with `flip`, animate it from where it was dropped (FLIP).
    function place(s, el, flip) {
      const first = el.getBoundingClientRect();
      el._h?.disable();
      el.style.cursor = 'default';
      S.slots[s].append(el);
      el.style.transition = 'none';
      el.style.transform = '';
      el._dragBase = null;
      el._dragPos = null;
      if (flip) {
        const last = el.getBoundingClientRect();
        el.style.transform = `translate(${first.left - last.left}px, ${first.top - last.top}px)`;
        void el.offsetWidth;
        el.style.transition = 'transform .25s ease-out';
        el.style.transform = '';
        later(() => {
          el.style.transition = '';
          el.classList.add('hop');
        }, 270);
      }
      S.assign[s] = +el.dataset.id;
      S.streak = 0;
      S.hintLevel = 0;
      wrap.querySelectorAll('.bub').forEach((e) => e.remove());
      clearHints();
      setOpen();
      updateLights();
      sfx('pop');
    }

    function showBubble(s, d, text) {
      wrap.querySelectorAll('.bub').forEach((e) => e.remove());
      const bub = h(
        'div',
        { class: 'bub', 'aria-hidden': 'true' },
        d.map((a) => icon(a)),
        text ? h('b', {}, text) : null,
      );
      S.slots[s].append(bub);
      const g = gen;
      later(() => {
        if (g === gen) bub.remove();
      }, BUBBLE_MS);
    }

    const need = () => S.cfg.need || 1;
    const both = (d) => `${d[0]} and ${d[1]}`;
    // Drop handler: accept only if every filled neighbour differs by need() features AND the rest
    // of the board can still be completed from the tray (solver look-ahead); otherwise bounce back.
    function tryPlace(s, el) {
      if (demoOn) return false;
      const b = +el.dataset.id;
      for (const t of filledNbrs(s)) {
        const d = diffs(S.assign[t], b);
        if (d.length !== need()) {
          wrong(s, d);
          return false;
        }
      }
      const tmp = S.assign.slice();
      tmp[s] = b;
      if (
        !solve(
          tmp,
          S.cfg.edges,
          remainingTray().filter((x) => x !== b),
          need(),
        )
      ) {
        wrong(s, null);
        return false;
      }
      const nbd = filledNbrs(s).map((t) => diffs(S.assign[t], b));
      const nb = nbd.map((d) => d[0]);
      place(s, el, true);
      if (S.assign.every((v) => v != null)) {
        complete();
        return true;
      }
      const a = nb[0];
      const lines =
        need() === 2
          ? [`Yes! The ${both(nbd[0])} changed.`, `Lovely! Two changes: ${both(nbd[0])}.`]
          : new Set(nb).size > 1
            ? [`Yes! Every neighbour changes just one thing.`, `Lovely! One change to each neighbour.`]
            : [
                `Yes! Only the ${a} changed.`,
                `Lovely! Just the ${a} is different.`,
                `Good! One change: the ${a}.`,
                `Right! The ${a} changed, nothing else.`,
              ];
      api.cheer(pick(lines));
      return true;
    }
    const cap = (w) => w[0].toUpperCase() + w.slice(1);

    function wrong(s, d) {
      S.streak++;
      const sl = S.slots[s];
      sl.classList.remove('shake');
      void sl.offsetWidth;
      sl.classList.add('shake');
      if (d && need() === 2) {
        showBubble(s, d, `${d.length}`);
        api.nudge(
          d.length === 3
            ? 'That changes all three! Change just two.'
            : `That changes only the ${d[0]}. Change two things!`,
        );
      } else if (d) {
        showBubble(s, d, `${d.length}`);
        api.nudge(
          d.length === 3
            ? 'That one changes everything! Change just one thing.'
            : `That changes ${d[0]} and ${d[1]}. Change just one thing!`,
        );
      } else {
        showBubble(s, [], '?');
        api.nudge('That fits here, but then we get stuck. Try another!');
      }
      if (S.streak >= 2) {
        const g = gen;
        later(() => {
          if (g === gen) showHint(2, true);
        }, STRONG_HINT_DELAY_MS);
      }
    }

    // Hint: highlight a good slot and the changed attribute; level 2 also glows the block.
    function showHint(level, quiet) {
      if (!S || demoOn) return;
      clearHints();
      const pool = remainingTray();
      const sol = solve(S.assign, S.cfg.edges, pool, need());
      if (!sol) return;
      const empties = S.assign.map((v, i) => (v == null ? i : -1)).filter((i) => i >= 0);
      const s = S.cfg.seq ? empties[0] : (empties.find((i) => filledNbrs(i).length) ?? empties[0]);
      const b = sol[s];
      const t = filledNbrs(s)[0];
      const d = t != null ? diffs(S.assign[t], b) : [];
      const a = d.length === 2 ? both(d) : d[0];
      S.slots[s].classList.add('glow');
      if (d.length) {
        const k = edgeIndex(s, t);
        d.forEach((x) => S.lights[k].querySelector(`.ic[data-a="${x}"]`).classList.add('peek'));
      }
      if (level >= 2) {
        const el = tray.querySelector(`.blk[data-id="${b}"]`);
        if (el) {
          el.classList.add('glow');
          if (d.length)
            el.append(
              h(
                'div',
                { class: 'tip', 'aria-hidden': 'true' },
                d.map((x) => icon(x)),
              ),
            );
        }
      }
      if (!quiet || level >= 2)
        api.nudge(
          a
            ? level >= 2
              ? `Try the glowing block. The ${a} change${d.length === 2 ? '' : 's'}.`
              : `Here! Change only the ${a}.`
            : 'Try this place!',
        );
    }
    hintBtn.addEventListener('click', () => {
      sfx('tap');
      S.hintLevel = Math.min(2, S.hintLevel + 1);
      showHint(S.hintLevel);
    });

    async function complete() {
      const g = gen;
      clearHints();
      const ring = board.querySelector('.ring');
      if (ring) {
        ring.classList.remove('spin');
        void ring.offsetWidth;
        ring.classList.add('spin');
      }
      sfx('win');
      await Promise.all([api.cheer(S.cfg.done), sleep(1700)]);
      if (!alive || g !== gen) return;
      step++;
      if (step >= PLAN.length) {
        api.finish();
        return;
      }
      startStep();
    }

    function startStep() {
      api.stage(ROUND_OF[step], ROUNDS);
      const cfg = PLAN[step]();
      render(cfg);
      api.prompt(cfg.prompt);
    }

    api.setDemo(async () => {
      const cfg = S.cfg;
      demoOn = true;
      render(cfg);
      const g = gen;
      const ok = () => alive && g === gen;
      try {
        await Promise.all([
          api.prompt(
            cfg.need === 2 ? 'Watch me. Exactly two changes each time.' : 'Watch me. Just one change each time.',
          ),
          sleep(1200),
        ]);
        if (!ok()) return;
        const order = cfg.prefill.map((v, i) => (v == null ? i : -1)).filter((i) => i >= 0);
        for (const s of order) {
          const b = cfg.sol[s];
          const el = tray.querySelector(`.blk[data-id="${b}"]`);
          if (!el) return;
          el.classList.add('glow');
          el.style.zIndex = 50;
          await sleep(350);
          if (!ok()) return;
          await flyTo(el, S.slots[s], { duration: 750 });
          if (!ok()) return;
          el.classList.remove('glow');
          el.style.zIndex = '';
          const nbd = filledNbrs(s).map((t) => diffs(S.assign[t], b));
          const nb = nbd.map((d) => d[0]);
          place(s, el, false);
          // Narrate what changed against the already-filled neighbours.
          const line =
            cfg.need === 2
              ? `The ${both(nbd[0])} change.`
              : nb.length > 2
                ? 'One change to each of its neighbours.'
                : nb.length > 1 && nb[1] !== nb[0]
                  ? `${cap(nb[0])} changes on one side, ${nb[1]} on the other.`
                  : nb.length > 1
                    ? `Differs by ${nb[0]} only, on both sides.`
                    : `Differs by ${nb[0]} only.`;
          await Promise.all([api.prompt(line), sleep(1300)]);
          if (!ok()) return;
        }
        const ring = board.querySelector('.ring');
        if (ring) {
          ring.classList.add('spin');
        }
        const end = ring
          ? 'The ring closes. Every neighbour: one change!'
          : cfg.kind === 'grid'
            ? 'Across and up-down: one change each!'
            : cfg.need === 2
              ? 'See? Two changes each time.'
              : 'See? One change each time.';
        await Promise.all([api.prompt(end), sleep(1700)]);
        if (!ok()) return;
        await sleep(500);
        if (!ok()) return;
        render(cfg);
        api.prompt('Your turn! ' + (cfg.turn || cfg.prompt.split('.')[0].split('!')[0] + '.'));
      } finally {
        demoOn = false;
      }
    });

    startStep();
    return {
      destroy() {
        alive = false;
        timers.forEach(clearTimeout);
        timers.clear();
      },
    };
  },
};
