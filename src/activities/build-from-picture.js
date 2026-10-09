/**
 * Game: Build the Picture  (id: build-from-picture, level 3)
 *
 * Idea: flat shapes combine into new shapes, and a turned shape is still the same shape
 *   (tangram-like fitting on a square grid).
 * Rounds (one picture is picked at random per round, never the same one twice in a row):
 *   1. 3 shapes (house / boat / ice cream); each spot is drawn in its shape's colour and the shapes
 *      start already turned the right way; a shape only snaps onto its own spot.
 *   2. 4–5 shapes (rocket / fish / tree); each spot is a dashed grey outline and the shapes start at
 *      random turns; a shape only snaps onto a matching outline.
 *   3. Silhouette only, 5–6 shapes (crown / sailboat / cat / robot); any exact cover is accepted.
 *   4. Silhouette only, 6 shapes + 1 spare shape in the tray (castle / train / bird).
 *   5. Bigger silhouette, 7 shapes + 1 spare shape (big house / ship / big rocket).
 *   Drag a shape to place it, tap it to turn it 90°. "💡 Hint" shows a blinking ghost spot and a
 *   glowing shape; after 2 misses in a row the hint comes automatically and the shape is turned for
 *   the child. In rounds 3–5 a dead end is undone by lifting off the last-placed shapes.
 * Watch demo: sends every shape home, then turns each needed shape to the stored solution and glides
 *   it into place while counting aloud, glows the spare shape, and finally puts every shape back in
 *   the tray at its starting turn so the child can try.
 * Notes:
 *   - Geometry: each unit cell is cut by both diagonals into 4 quarter-triangles
 *     (q: 0 = top, 1 = right, 2 = bottom, 3 = left). Pieces and silhouettes are sets of "x,y,q" keys,
 *     so "does it fit?" and "is it full?" are exact set checks.
 *   - Puzzles store one solution as [type, rot, x, y]; the silhouette is the union of the pieces.
 *     Verified with __test.checkPuzzles() (no overlaps; solutions counted with the spare on offer):
 *     house 2, boat 1, ice cream 2 | rocket 2, fish 2, tree 2 | crown 12, sailboat 2, cat 12,
 *     robot 4 | castle 4, train 13, bird 2 | big house 64, ship 17, big rocket 5.
 *   - Layout tries cell sizes from CELL_MAX down to CELL_MIN px until board + tray fit without
 *     sideways scrolling; it re-runs on resize (not while dragging or during the demo).
 *   - Test hooks: `export const __test` (checkPuzzles, solve, keysAt, SH, POOL, fillD, outlineD) and
 *     `wrap.__bfp` on the game element (st, cell, origin(), findHint(), M, same(pid, rot)).
 */
import { h, sleep, shuffle, rand, pick, sfx, COLORS, resumeRound } from '../lib/core.js';

const ID = 'build-from-picture';
const PAD = 0.5; // board margin around the silhouette, in cells
const M = 8; // extra hit margin around each piece, in px
const CELL_MAX = 64; // largest cell size tried by layout(), px
const CELL_MIN = 30; // smallest cell size, px
const DRAG_START = 7; // px of pointer travel before a press becomes a drag (otherwise a tap = turn)
const SNAP_DIST = 0.9; // max distance (cells) from the drop point to a snap position
const WIN_PAUSE = 2600; // ms between the win cheer and the next round

// ---- shapes: [x, y, quarters] per cell, in the starting turn ----
const ALL = [0, 1, 2, 3];
const BASE = {
  sq: [[0, 0, ALL]],
  dom: [
    [0, 0, ALL],
    [1, 0, ALL],
  ],
  bar3: [
    [0, 0, ALL],
    [1, 0, ALL],
    [2, 0, ALL],
  ],
  big: [
    [0, 0, ALL],
    [1, 0, ALL],
    [0, 1, ALL],
    [1, 1, ALL],
  ],
  tri: [[0, 0, [3, 2]]], // right angle bottom-left
  btri: [
    [0, 0, [3, 2]],
    [0, 1, ALL],
    [1, 1, [3, 2]],
  ], // legs of 2, right angle bottom-left
  roof: [
    [0, 0, [1, 2]],
    [1, 0, [3, 2]],
  ], // 2 wide, 1 tall, point up
};
const TYPE_COL = {
  roof: COLORS.orange,
  dom: COLORS.sky,
  btri: COLORS.pink,
  bar3: COLORS.green,
  tri: COLORS.purple,
  big: COLORS.yellow,
  sq: COLORS.green,
};
const PALETTE = [
  COLORS.red,
  COLORS.yellow,
  COLORS.green,
  COLORS.sky,
  COLORS.purple,
  COLORS.orange,
  COLORS.pink,
  COLORS.blue,
];
const NAMES = {
  sq: 'square',
  dom: 'rectangle',
  bar3: 'long rectangle',
  big: 'big square',
  tri: 'small triangle',
  btri: 'big triangle',
  roof: 'pointy triangle',
};
const WORDS = ['One', 'Two', 'Three', 'Four', 'Five', 'Six'];
const FIT = ['It fits!', 'Snap!', 'Yes, just right!', 'Good fit!', 'Lovely!'];
const WIN = ['Wonderful!', 'Perfect fit!', 'Hooray!', 'You did it!'];

// ---- puzzles: [type, rot, x, y] — the union of the pieces is the silhouette ----
const P = (name, emoji, sol, extra = []) => ({
  name,
  emoji,
  extra,
  sol: sol.map(([type, rot, x, y]) => ({ type, rot, x, y })),
});
const POOL = [
  [
    // round 1: 3 pieces, colour-matched outlines
    P('house', '🏠', [
      ['roof', 0, 0, 0],
      ['dom', 1, 0, 1],
      ['dom', 1, 1, 1],
    ]),
    P('boat', '⛵', [
      ['btri', 0, 1, 0],
      ['bar3', 0, 0, 2],
      ['tri', 1, 3, 2],
    ]),
    P('ice cream', '🍦', [
      ['dom', 0, 0, 0],
      ['dom', 0, 0, 1],
      ['roof', 2, 0, 2],
    ]),
  ],
  [
    // round 2: 4-5 pieces, outlines only
    P('rocket', '🚀', [
      ['roof', 0, 1, 0],
      ['big', 0, 1, 1],
      ['dom', 0, 1, 3],
      ['tri', 3, 0, 3],
      ['tri', 0, 3, 3],
    ]),
    P('fish', '🐟', [
      ['roof', 1, 0, 0],
      ['dom', 1, 1, 0],
      ['dom', 1, 2, 0],
      ['roof', 1, 3, 0],
    ]),
    P('tree', '🌲', [
      ['roof', 0, 1, 0],
      ['tri', 3, 0, 1],
      ['dom', 0, 1, 1],
      ['tri', 0, 3, 1],
      ['dom', 0, 1, 2],
    ]),
  ],
  [
    // round 3: silhouette only, any exact cover is accepted
    P('crown', '👑', [
      ['roof', 0, 0, 0],
      ['roof', 0, 2, 0],
      ['bar3', 0, 0, 1],
      ['sq', 0, 3, 1],
      ['dom', 0, 0, 2],
      ['dom', 0, 2, 2],
    ]),
    P('sailboat', '⛵', [
      ['btri', 0, 1, 0],
      ['btri', 0, 3, 0],
      ['tri', 2, 0, 2],
      ['dom', 0, 1, 2],
      ['sq', 0, 3, 2],
      ['tri', 1, 4, 2],
    ]),
    P('cat', '🐱', [
      ['tri', 0, 0, 0],
      ['tri', 3, 2, 0],
      ['bar3', 0, 0, 1],
      ['dom', 0, 0, 2],
      ['sq', 0, 2, 2],
      ['bar3', 0, 0, 3],
    ]),
    P('robot', '🤖', [
      ['sq', 0, 1, 0],
      ['bar3', 0, 0, 1],
      ['bar3', 0, 0, 2],
      ['sq', 0, 0, 3],
      ['sq', 0, 2, 3],
    ]),
  ],
  [
    // round 4: silhouette only, one extra shape in the tray that is not needed
    P(
      'castle',
      '🏰',
      [
        ['roof', 0, 0, 0],
        ['roof', 0, 2, 0],
        ['big', 0, 0, 1],
        ['big', 0, 2, 1],
        ['bar3', 0, 0, 3],
        ['sq', 0, 3, 3],
      ],
      ['btri'],
    ),
    P(
      'train',
      '🚂',
      [
        ['big', 0, 0, 0],
        ['sq', 0, 3, 0],
        ['dom', 0, 2, 1],
        ['tri', 0, 4, 1],
        ['dom', 0, 0, 2],
        ['bar3', 0, 2, 2],
      ],
      ['roof'],
    ),
    P(
      'bird',
      '🐦',
      [
        ['sq', 0, 3, 0],
        ['tri', 0, 4, 0],
        ['tri', 3, 0, 1],
        ['bar3', 0, 1, 1],
        ['sq', 0, 4, 1],
        ['roof', 2, 2, 2],
      ],
      ['big'],
    ),
  ],
  [
    // round 5: bigger silhouette, more shapes, one extra shape
    P(
      'big house',
      '🏡',
      [
        ['btri', 3, 0, 0],
        ['btri', 0, 2, 0],
        ['big', 0, 0, 2],
        ['dom', 1, 2, 2],
        ['dom', 1, 3, 2],
        ['bar3', 0, 0, 4],
        ['sq', 0, 3, 4],
      ],
      ['tri'],
    ),
    P(
      'ship',
      '🚢',
      [
        ['sq', 0, 3, 0],
        ['dom', 0, 1, 1],
        ['dom', 0, 3, 1],
        ['tri', 2, 0, 2],
        ['bar3', 0, 1, 2],
        ['tri', 1, 4, 2],
        ['sq', 0, 0, 1],
      ],
      ['btri'],
    ),
    P(
      'big rocket',
      '🚀',
      [
        ['roof', 0, 2, 0],
        ['big', 0, 2, 1],
        ['dom', 1, 2, 3],
        ['dom', 1, 3, 3],
        ['btri', 3, 0, 3],
        ['btri', 0, 4, 3],
        ['roof', 2, 2, 5],
      ],
      ['tri'],
    ),
  ],
];

// ---- quarter keys and shape turns ----
const K = (x, y, q) => `${x},${y},${q}`;
const parseK = (k) => k.split(',').map(Number);
// reading order: row, then column, then quarter
const cmpK = (a, b) => {
  const [ax, ay, aq] = parseK(a),
    [bx, by, bq] = parseK(b);
  return ay - by || ax - bx || aq - bq;
};

// shift a list of [x, y, q] so its top-left is at (0, 0), and sort it (so equal shapes compare equal)
function normQ(qs) {
  const mx = Math.min(...qs.map((t) => t[0])),
    my = Math.min(...qs.map((t) => t[1]));
  return qs.map(([x, y, q]) => [x - mx, y - my, q]).sort((a, b) => a[1] - b[1] || a[0] - b[0] || a[2] - b[2]);
}
// 90 degrees clockwise on screen (y down): (x, y) -> (-y, x); top->right->bottom->left.
const rotQ = (qs) => normQ(qs.map(([x, y, q]) => [-y - 1, x, (q + 1) % 4]));

// SH[type]: the 4 turns as quarter lists, which turns are distinct (uniq), their sizes, and the longest side
const SH = {};
for (const [type, def] of Object.entries(BASE)) {
  const rots = [normQ(def.flatMap(([x, y, qs]) => qs.map((q) => [x, y, q])))];
  for (let i = 1; i < 4; i++) rots.push(rotQ(rots[i - 1]));
  const sig = rots.map((r) => JSON.stringify(r));
  const uniq = [0, 1, 2, 3].filter((i) => sig.indexOf(sig[i]) === i);
  const dims = rots.map((r) => ({ w: Math.max(...r.map((t) => t[0])) + 1, h: Math.max(...r.map((t) => t[1])) + 1 }));
  SH[type] = { rots, uniq, dims, max: Math.max(dims[0].w, dims[0].h) };
}
// true if two turns of a shape look the same (e.g. a square turned any way)
const sameRot = (type, a, b) => a === b || JSON.stringify(SH[type].rots[a]) === JSON.stringify(SH[type].rots[b]);
// quarter keys covered by a shape at turn `rot` with its top-left at (x, y)
const keysAt = (type, rot, x, y) => SH[type].rots[rot].map(([a, b, q]) => K(a + x, b + y, q));

// ---- geometry -> SVG (units: 1 = one cell) ----
// the three corners of a quarter-triangle: two cell corners and the cell centre
function quarterPts(x, y, q) {
  const TL = [x, y],
    TR = [x + 1, y],
    BR = [x + 1, y + 1],
    BL = [x, y + 1],
    C = [x + 0.5, y + 0.5];
  const [a, b] = [
    [TL, TR],
    [TR, BR],
    [BR, BL],
    [BL, TL],
  ][q];
  return [a, b, C];
}
// SVG path filling every quarter in `keys`
function fillD(keys) {
  return keys
    .map(
      (k) =>
        'M' +
        quarterPts(...parseK(k))
          .map((p) => p.join(','))
          .join('L') +
        'Z',
    )
    .join('');
}
// SVG path of the outer outline: triangle edges used exactly once are boundary edges,
// which are then chained into continuous lines
function outlineD(keys) {
  const cnt = new Map();
  for (const k of keys) {
    const [a, b, c] = quarterPts(...parseK(k));
    for (const [p, r] of [
      [a, b],
      [b, c],
      [c, a],
    ]) {
      const e = [p.join(','), r.join(',')].sort().join('|');
      cnt.set(e, (cnt.get(e) || 0) + 1);
    }
  }
  const adj = new Map();
  const edges = [];
  for (const [e, n] of cnt) if (n === 1) edges.push(e.split('|'));
  edges.forEach(([p, r], i) => {
    for (const v of [p, r]) {
      if (!adj.has(v)) adj.set(v, []);
      adj.get(v).push(i);
    }
  });
  const used = new Set();
  let d = '';
  for (let i = 0; i < edges.length; i++) {
    if (used.has(i)) continue;
    used.add(i);
    const [start, first] = edges[i];
    let cur = first;
    d += `M${start}L${cur}`;
    for (;;) {
      const nx = (adj.get(cur) || []).find((j) => !used.has(j));
      if (nx == null) break;
      used.add(nx);
      cur = edges[nx][0] === cur ? edges[nx][1] : edges[nx][0];
      d += `L${cur}`;
      if (cur === start) {
        d += 'Z';
        break;
      }
    }
  }
  return d;
}

// ---- exact-cover solver (hints in rounds 3–5, self-check) ----
// Cover target set T (minus already occupied occ0) with pieces rem [{pid, type}]. Always fills the
// first empty quarter in reading order; tries each piece type once per step and each distinct turn.
// all: count every solution instead of returning the first; spare: leftover pieces are allowed.
// Returns the first solution [{pid, rot, x, y}] (or null), or the count when `all`.
function solve(T, occ0, rem, all = false, spare = false) {
  const occ = new Set(occ0);
  const keys = [...T].sort(cmpK);
  const out = [];
  let count = 0;
  let first = null;
  const rec = (list) => {
    const k = keys.find((x) => !occ.has(x));
    if (!k) {
      if (list.length && !spare) return false;
      count++;
      if (!first) first = out.slice();
      return !all;
    }
    const [tx, ty, tq] = parseK(k);
    const tried = new Set();
    for (let i = 0; i < list.length; i++) {
      const pc = list[i];
      if (tried.has(pc.type)) continue;
      tried.add(pc.type);
      for (const r of SH[pc.type].uniq) {
        for (const [qx, qy, qq] of SH[pc.type].rots[r]) {
          if (qq !== tq) continue;
          const ks = keysAt(pc.type, r, tx - qx, ty - qy);
          if (!ks.every((x) => T.has(x) && !occ.has(x))) continue;
          ks.forEach((x) => occ.add(x));
          out.push({ pid: pc.pid, rot: r, x: tx - qx, y: ty - qy });
          if (rec(list.filter((_, j) => j !== i))) return true;
          out.pop();
          ks.forEach((x) => occ.delete(x));
        }
      }
    }
    return false;
  };
  rec(rem);
  return all ? count : first;
}

// self-test: no overlaps, solvable, number of solutions (with the extra shape on offer)
function checkPuzzles() {
  return POOL.flat().map((pz) => {
    const all = pz.sol.flatMap((s) => keysAt(s.type, s.rot, s.x, s.y));
    const T = new Set(all);
    const rem = [...pz.sol.map((s) => s.type), ...pz.extra].map((type, i) => ({ pid: i, type }));
    return { name: pz.name, overlap: all.length !== T.size, solutions: solve(T, [], rem, true, pz.extra.length > 0) };
  });
}
export const __test = { checkPuzzles, solve, keysAt, SH, POOL, fillD, outlineD };

const CSS = `
.a-${ID}{width:100%;max-width:100%;display:flex;flex-direction:column;align-items:center;gap:8px}
.a-${ID} .hintb{min-height:56px;min-width:56px;font-size:1.05rem;align-self:center}
.a-${ID} .reveal{position:absolute;right:-14px;top:-22px;line-height:1;font-size:2.4rem;font-weight:900;display:flex;align-items:center;gap:4px;opacity:0;transition:opacity .3s;background:#fff;border:3px solid ${COLORS.green};border-radius:999px;padding:4px 12px;pointer-events:none;z-index:45}
.a-${ID} .reveal span{font-size:1.1rem}
.a-${ID} .reveal.on{opacity:1;animation:hop .6s}
.a-${ID} .play{position:relative;margin-top:16px;display:flex;flex-wrap:wrap;justify-content:center;align-items:center;gap:14px;width:100%;max-width:100%}
.a-${ID} .board{position:relative;background:#fff;border:3px solid ${COLORS.ink};border-radius:20px;padding:6px;line-height:0;box-shadow:0 5px 0 rgba(43,45,66,.12)}
.a-${ID} .board svg{display:block;max-width:none}
.a-${ID} .board.won{border-color:${COLORS.green};box-shadow:0 0 0 5px rgba(6,214,160,.35)}
.a-${ID} .tray{display:flex;flex-wrap:wrap;gap:8px;justify-content:center;align-content:center;padding:8px;border-radius:20px;background:#fff1cc;border:3px dashed #e3cf9a}
.a-${ID} .slot{flex:none}
.a-${ID} .pc{position:absolute;left:0;top:0;z-index:5;touch-action:none;user-select:none;pointer-events:none;-webkit-user-select:none}
.a-${ID} .pc svg{display:block;overflow:visible;position:absolute;left:${M}px;top:${M}px}
.a-${ID} .pc .body,.a-${ID} .pc .hit{pointer-events:all;cursor:grab}
.a-${ID} .pc.on{z-index:4}.a-${ID} .pc.on .hit{pointer-events:none}
.a-${ID} .pc.lift{z-index:40}.a-${ID} .pc.lift svg{filter:drop-shadow(0 8px 6px rgba(0,0,0,.25))}
.a-${ID} .pc.glowing svg{animation:bfpglow 1s ease-in-out infinite alternate}
@keyframes bfpglow{from{filter:drop-shadow(0 0 2px #ffb703)}to{filter:drop-shadow(0 0 9px #ffb703) drop-shadow(0 0 4px #ffd166)}}
.a-${ID} .ghost{animation:bfpblink 1.1s ease-in-out infinite alternate}
@keyframes bfpblink{from{opacity:.35}to{opacity:1}}
`;

export default {
  id: ID,
  rounds: POOL.length,
  parentNote:
    'She fits flat shapes into an outline, turning them until they match: shapes combine into new shapes, and a turned triangle is still the same triangle. Ask "Which shape could fill this corner? What if you turn it?" — the last two pictures are bigger and add one spare shape, so she must choose which pieces belong. Many children think a turned piece no longer fits; nudge her to fill the pointy corners first.',
  async start(api) {
    let alive = true;
    let round = resumeRound(api, POOL.length);
    let st = null; // state of the current round (see newRound)
    let cell = CELL_MAX; // current cell size in px, set by layout()
    let drag = null;
    let demoRunning = false;
    let locked = false;
    let wrongs = 0;
    let resizeT = 0;
    const lastPuz = [];
    api.css(CSS);
    const wrap = h('div', { class: `a-${ID}` });
    api.root.append(wrap);
    const timers = new Set();
    const later = (fn, ms) => {
      const t = setTimeout(() => {
        timers.delete(t);
        if (alive) fn();
      }, ms);
      timers.add(t);
    };

    function newRound(i) {
      round = i;
      locked = false;
      wrongs = 0;
      api.stage(i, POOL.length);
      const pool = POOL[i].filter((p) => p !== lastPuz[i]);
      const puz = pick(pool);
      lastPuz[i] = puz;
      const T = new Set(puz.sol.flatMap((s) => keysAt(s.type, s.rot, s.x, s.y)));
      const cols = Math.max(...[...T].map((k) => parseK(k)[0])) + 1;
      const rows = Math.max(...[...T].map((k) => parseK(k)[1])) + 1;
      const cols2 = shuffle(PALETTE);
      const pieces = [...puz.sol, ...puz.extra.map((type) => ({ type, rot: 0, extra: true }))].map((s, k) => {
        const startRot = i === 0 ? s.rot : rand(4);
        return {
          id: k,
          type: s.type,
          extra: !!s.extra,
          color: i === 0 ? TYPE_COL[s.type] : cols2[k % cols2.length],
          rot: startRot,
          startRot,
          placed: null,
          keys: null,
        };
      });
      const slots = puz.sol.map((s, k) => ({
        ...s,
        id: k,
        sig: keysAt(s.type, s.rot, s.x, s.y).sort().join(';'),
        by: null,
      }));
      st = {
        puz,
        T,
        cols,
        rows,
        pieces,
        order: shuffle(pieces.map((p) => p.id)),
        slots,
        occ: new Map(),
        stack: [],
        ghost: null,
      };
      build();
      const n = puz.name;
      api.prompt(
        [
          `Put each shape on its colour. Build the ${n}!`,
          `Build the ${n}. Tap a shape to turn it.`,
          `Fill the whole ${n}. Many ways can work!`,
          `Build the ${n}. One shape is not needed!`,
          `Build the big ${n.replace(/^big /, '')}. One shape is spare.`,
        ][i],
      );
    }

    // ---------- DOM ----------
    let play, boardBox, boardSvg, tray, reveal, hintBtn;
    function build() {
      wrap.replaceChildren();
      hintBtn = h(
        'button',
        {
          class: 'btn hintb',
          'aria-label': 'Show me a hint',
          onclick: () => {
            if (!locked && !demoRunning) {
              sfx('tap');
              hint(false);
            }
          },
        },
        '💡 Hint',
      );
      reveal = h('div', { class: 'reveal', 'aria-hidden': 'true' });
      boardBox = h('div', { class: 'board' });
      tray = h('div', { class: 'tray', 'aria-label': 'Shapes' });
      play = h('div', { class: 'play' }, boardBox, tray);
      boardBox.append(reveal);
      wrap.append(play);
      for (const p of st.pieces) {
        p.el = h('div', { class: 'pc', role: 'button', 'aria-label': `${NAMES[p.type]}, drag it or tap to turn` });
        p.slotEl = h('div', { class: 'slot' });
        bindPiece(p);
        play.append(p.el);
      }
      for (const id of st.order) tray.append(st.pieces[id].slotEl);
      tray.append(hintBtn);
      layout();
    }
    // Shrink the cell size step by step until nothing scrolls sideways and the game fits the stage height.
    function layout() {
      if (!st || !alive) return;
      const H = (api.root.clientHeight || innerHeight * 0.7) - 26;
      st.pieces.forEach((p) => {
        p.el.style.display = 'none';
      });
      let c = CELL_MAX;
      for (; c > CELL_MIN; c -= 2) {
        cell = c;
        sizeAll();
        if (play.scrollWidth <= play.clientWidth + 1 && wrap.offsetHeight <= H) break;
      }
      if (c <= CELL_MIN) {
        cell = CELL_MIN;
        sizeAll();
      }
      st.pieces.forEach((p) => {
        p.el.style.display = '';
        renderPiece(p);
        posPiece(p, false);
      });
    }
    // Size board and tray slots for the current cell size; the tray sits beside the board if two
    // slot columns fit there, otherwise it wraps below at full width.
    function sizeAll() {
      drawBoard();
      const trayW = Math.max(...st.pieces.map((p) => Math.max(SH[p.type].max, 1.5))) * cell + 16;
      for (const p of st.pieces) {
        const s = Math.max(SH[p.type].max, 1.5) * cell + 8;
        p.slotEl.style.width = s + 'px';
        p.slotEl.style.height = s + 'px';
      }
      const bw = (st.cols + 2 * PAD) * cell + 18;
      const avail = (api.root.clientWidth || innerWidth) - 26;
      const side = avail - bw - 14; // room for the tray next to the board
      tray.style.maxWidth = (side >= 2 * (trayW + 8) + 22 ? side : avail) + 'px';
    }
    // Board SVG: dot grid, shaded silhouette (rounds 2+), per-piece spots (rounds 1–2), outline, hint ghost.
    function drawBoard() {
      const { T, cols, rows } = st;
      const vw = cols + 2 * PAD,
        vh = rows + 2 * PAD;
      const svg = h('svg', {
        viewBox: `${-PAD} ${-PAD} ${vw} ${vh}`,
        width: vw * cell,
        height: vh * cell,
        role: 'img',
        'aria-label': `Outline of a ${st.puz.name}`,
      });
      let html = '';
      for (let y = 0; y <= rows; y++)
        for (let x = 0; x <= cols; x++) html += `<circle cx="${x}" cy="${y}" r="0.04" fill="#cfc6b0"/>`;
      const tk = [...T];
      if (round > 0) html += `<path d="${fillD(tk)}" fill="#e4def3"/>`;
      if (round < 2) {
        for (const s of st.slots) {
          const ks = keysAt(s.type, s.rot, s.x, s.y);
          const col = round === 0 ? TYPE_COL[s.type] : COLORS.ink;
          if (round === 0) html += `<path d="${fillD(ks)}" fill="${col}" fill-opacity="0.4"/>`;
          html += `<path d="${outlineD(ks)}" fill="none" stroke="${col}" stroke-width="${round === 0 ? 3 : 2}" stroke-dasharray="7 5" stroke-linecap="round" vector-effect="non-scaling-stroke" opacity="${round === 0 ? 1 : 0.55}"/>`;
        }
      }
      html += `<path d="${outlineD(tk)}" fill="none" stroke="${COLORS.ink}" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke"/>`;
      if (st.ghost) {
        const g = st.ghost;
        const ks = keysAt(st.pieces[g.pid].type, g.rot, g.x, g.y);
        html += `<g class="ghost"><path d="${fillD(ks)}" fill="${st.pieces[g.pid].color}" fill-opacity="0.7"/><path d="${outlineD(ks)}" fill="none" stroke="${COLORS.ink}" stroke-width="3" stroke-dasharray="5 4" vector-effect="non-scaling-stroke"/></g>`;
      }
      svg.innerHTML = html;
      boardSvg?.remove();
      boardSvg = svg;
      boardBox.prepend(svg);
    }
    // Piece SVG at its current turn, with a transparent hit rect M px larger on every side.
    function renderPiece(p) {
      const { w, h: hh } = SH[p.type].dims[p.rot];
      const ks = keysAt(p.type, p.rot, 0, 0);
      p.el.style.width = w * cell + 2 * M + 'px';
      p.el.style.height = hh * cell + 2 * M + 'px';
      p.el.innerHTML =
        `<svg viewBox="0 0 ${w} ${hh}" width="${w * cell}" height="${hh * cell}" aria-hidden="true">` +
        `<rect class="hit" x="${-M / cell}" y="${-M / cell}" width="${w + (2 * M) / cell}" height="${hh + (2 * M) / cell}" fill="transparent"/>` +
        `<path class="body" d="${fillD(ks)}" fill="${p.color}"/>` +
        `<path d="${outlineD(ks)}" fill="none" stroke="${COLORS.ink}" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke" pointer-events="none"/></svg>`;
    }
    function origin() {
      // board cell (0,0) top-left, in play coordinates
      const pr = play.getBoundingClientRect(),
        br = boardSvg.getBoundingClientRect();
      return { x: br.left - pr.left + PAD * cell, y: br.top - pr.top + PAD * cell };
    }
    // piece box position (play coordinates) that centres the piece in its tray slot
    function homeXY(p) {
      const pr = play.getBoundingClientRect(),
        sr = p.slotEl.getBoundingClientRect();
      const { w, h: hh } = SH[p.type].dims[p.rot];
      return {
        x: sr.left - pr.left + (sr.width - w * cell) / 2 - M,
        y: sr.top - pr.top + (sr.height - hh * cell) / 2 - M,
      };
    }
    // piece box position (play coordinates) for a piece whose top-left is at board cell (x, y)
    function boardXY(x, y) {
      const o = origin();
      return { x: o.x + x * cell - M, y: o.y + y * cell - M };
    }
    function posPiece(p, animate, ms = 280) {
      const t = p.placed ? boardXY(p.placed.x, p.placed.y) : homeXY(p);
      p.el.style.transition = animate
        ? `left ${ms}ms cubic-bezier(.3,1.25,.5,1), top ${ms}ms cubic-bezier(.3,1.25,.5,1)`
        : 'none';
      p.el.style.transform = '';
      p.el.style.left = t.x + 'px';
      p.el.style.top = t.y + 'px';
      p.x = t.x;
      p.y = t.y;
      p.el.classList.toggle('on', !!p.placed);
    }

    // ---------- model ----------
    function unplace(p) {
      if (!p.placed) return;
      (p.keys || []).forEach((k) => st.occ.delete(k));
      const s = st.slots.find((x) => x.by === p.id);
      if (s) s.by = null;
      p.placed = null;
      p.keys = null;
      st.stack = st.stack.filter((id) => id !== p.id);
    }
    // Can piece p go with its top-left at (x, y)? Rounds 1–2 also require a free matching spot.
    function test(p, x, y) {
      const ks = keysAt(p.type, p.rot, x, y);
      if (!ks.every((k) => st.T.has(k))) return { why: 'out' };
      if (ks.some((k) => st.occ.has(k))) return { why: 'overlap' };
      if (round < 2) {
        const sig = ks.slice().sort().join(';');
        const s = st.slots.find((q) => q.by == null && q.type === p.type && q.sig === sig);
        if (!s) return { why: 'slot' };
        return { ok: true, ks, slot: s };
      }
      return { ok: true, ks };
    }
    function commit(p, x, y, r) {
      p.placed = { x, y };
      p.keys = r.ks;
      r.ks.forEach((k) => st.occ.set(k, p.id));
      if (r.slot) r.slot.by = p.id;
      st.stack.push(p.id);
    }
    const full = () => st.occ.size === st.T.size;

    // ---------- pointer handling ----------
    function bindPiece(p) {
      p.el.addEventListener('pointerdown', (e) => {
        if (locked || demoRunning || drag || (e.button != null && e.button > 0)) return;
        e.preventDefault();
        drag = { p, id: e.pointerId, sx: e.clientX, sy: e.clientY, dx: 0, dy: 0, moved: false };
        p.el.classList.add('lift');
        p.el.style.transition = 'none';
        window.addEventListener('pointermove', onMove);
        window.addEventListener('pointerup', onUp);
        window.addEventListener('pointercancel', onUp);
      });
    }
    function stopListening() {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    }
    function onMove(e) {
      if (!drag || e.pointerId !== drag.id) return;
      drag.dx = e.clientX - drag.sx;
      drag.dy = e.clientY - drag.sy;
      if (Math.abs(drag.dx) + Math.abs(drag.dy) > DRAG_START) drag.moved = true;
      if (drag.moved) drag.p.el.style.transform = `translate(${drag.dx}px, ${drag.dy}px) scale(1.05)`;
    }
    function onUp(e) {
      if (!drag || e.pointerId !== drag.id) return;
      const d = drag;
      drag = null;
      stopListening();
      d.p.el.classList.remove('lift');
      if (!alive || demoRunning || locked) {
        posPiece(d.p, true);
        return;
      }
      if (!d.moved || e.type === 'pointercancel') {
        d.p.el.style.transform = '';
        if (!d.moved) turn(d.p);
        else posPiece(d.p, true);
        return;
      }
      drop(d.p, d.dx, d.dy);
    }
    // Tap = turn 90° clockwise. A placed piece stays on the board (re-centred) if the new turn still fits.
    function turn(p) {
      sfx('flip');
      const old = SH[p.type].dims[p.rot];
      const wasPlaced = p.placed;
      unplace(p);
      p.rot = (p.rot + 1) % 4;
      const nw = SH[p.type].dims[p.rot];
      renderPiece(p);
      if (wasPlaced) {
        const nx = wasPlaced.x + Math.round((old.w - nw.w) / 2),
          ny = wasPlaced.y + Math.round((old.h - nw.h) / 2);
        const r = test(p, nx, ny);
        if (r.ok) {
          commit(p, nx, ny, r);
          posPiece(p, false);
          clearGhost();
          if (full()) win();
          return;
        }
      }
      posPiece(p, false);
      if (st.ghost && st.ghost.pid === p.id && sameRot(p.type, st.ghost.rot, p.rot)) sfx('tick');
    }
    // Drop after a drag: snap to the nearest grid position within SNAP_DIST that fits, otherwise
    // bounce home with a nudge (2 misses in a row -> strong hint). Dropping off the board just
    // returns the piece to the tray.
    function drop(p, dx, dy) {
      const vx = p.x + dx,
        vy = p.y + dy; // visual top-left of the piece box
      p.el.style.transition = 'none';
      p.el.style.transform = '';
      p.el.style.left = vx + 'px';
      p.el.style.top = vy + 'px';
      void p.el.offsetWidth;
      const o = origin();
      const { w, h: hh } = SH[p.type].dims[p.rot];
      const gx = (vx + M - o.x) / cell,
        gy = (vy + M - o.y) / cell;
      const cx = gx + w / 2,
        cy = gy + hh / 2;
      const over = cx > -PAD - 0.3 && cx < st.cols + PAD + 0.3 && cy > -PAD - 0.3 && cy < st.rows + PAD + 0.3;
      const wasPlaced = !!p.placed;
      unplace(p);
      if (!over) {
        sfx('tap');
        posPiece(p, true);
        return;
      }
      const cands = [];
      for (const x of new Set([Math.floor(gx), Math.ceil(gx)]))
        for (const y of new Set([Math.floor(gy), Math.ceil(gy)])) {
          const dist = Math.hypot(x - gx, y - gy);
          if (dist <= SNAP_DIST) cands.push({ x, y, dist });
        }
      cands.sort((a, b) => a.dist - b.dist);
      let firstWhy = 'out';
      for (const [n, c] of cands.entries()) {
        const r = test(p, c.x, c.y);
        if (r.ok) {
          commit(p, c.x, c.y, r);
          posPiece(p, true, 180);
          placedOk();
          return;
        }
        if (n === 0) firstWhy = r.why;
      }
      posPiece(p, true, 380);
      later(() => {
        p.el.classList.remove('shake');
        void p.el.offsetWidth;
        p.el.classList.add('shake');
      }, 380);
      later(() => p.el.classList.remove('shake'), 800);
      if (wasPlaced && firstWhy === 'out') {
        sfx('tap');
        return;
      } // just lifting it off
      wrongs++;
      if (wrongs >= 2) {
        wrongs = 0;
        api.nudge('Look! The blinking shape shows where it fits.');
        hint(true);
        return;
      }
      api.nudge(
        {
          out: 'Oops, that pokes outside. Try turning it.',
          overlap: 'Another shape is already there. Try a new spot.',
          slot:
            round === 0 ? 'Find the spot with the same colour and shape.' : 'Look for an outline just like this shape.',
        }[firstWhy],
      );
    }
    function placedOk() {
      sfx('drop');
      wrongs = 0;
      clearGhost();
      if (full()) {
        win();
        return;
      }
      api.cheer(pick(FIT));
    }
    function clearGhost() {
      st.pieces.forEach((q) => q.el.classList.remove('glowing'));
      if (st.ghost) {
        st.ghost = null;
        drawBoard();
      }
    }

    // ---------- hints ----------
    // Next move {pid, rot, x, y}; null if no loose pieces; false if the board is a dead end (rounds 3–5).
    function findHint() {
      const loose = st.pieces.filter((p) => !p.placed);
      if (!loose.length) return null;
      if (round < 2) {
        for (const p of shuffle(loose)) {
          const s = st.slots.find((q) => q.by == null && q.type === p.type);
          if (s) return { pid: p.id, rot: s.rot, x: s.x, y: s.y };
        }
        return null;
      }
      const sol = solve(
        st.T,
        [...st.occ.keys()],
        loose.map((p) => ({ pid: p.id, type: p.type })),
        false,
        st.puz.extra.length > 0,
      );
      return sol ? sol[0] : false;
    }
    // Show the ghost spot and glow the piece; strong = also turn the piece for the child.
    function hint(strong) {
      let g = findHint();
      const stuck = g === false;
      if (stuck) {
        // silhouette rounds dead end: lift pieces off until it can be finished again
        while (g === false && st.stack.length) {
          const p = st.pieces[st.stack[st.stack.length - 1]];
          unplace(p);
          posPiece(p, true, 400);
          g = findHint();
        }
        api.nudge('Let us move that one back. Now try again!');
      }
      if (!g) return;
      st.ghost = g;
      drawBoard();
      const p = st.pieces[g.pid];
      st.pieces.forEach((q) => q.el.classList.toggle('glowing', q === p));
      if (strong && !sameRot(p.type, p.rot, g.rot)) {
        p.rot = g.rot;
        renderPiece(p);
        posPiece(p, false);
        sfx('flip');
      }
      if (!strong && !stuck)
        api.prompt(
          sameRot(p.type, p.rot, g.rot)
            ? 'This glowing shape fits in the blinking spot.'
            : 'This glowing shape fits there. Tap to turn it.',
        );
    }

    // ---------- round end ----------
    async function win() {
      if (locked) return;
      locked = true;
      clearGhost();
      const r = round;
      boardBox.classList.add('won');
      reveal.replaceChildren(st.puz.emoji, h('span', {}, st.puz.name));
      reveal.classList.add('on');
      st.pieces.forEach((p, k) =>
        later(() => {
          p.el.classList.add('hop');
        }, k * 90),
      );
      api.cheer(`${pick(WIN)} You built the ${st.puz.name}!`);
      await sleep(WIN_PAUSE);
      if (!alive || r !== round) return;
      if (r < POOL.length - 1) newRound(r + 1);
      else api.finish();
    }

    // ---------- demo ----------
    // Choreography: cancel any drag, send all pieces home, then for each needed piece (tray order):
    // glow, turn step by step to the stored solution, glide in while counting; glow the spare;
    // cheer; finally return every piece to the tray at its starting turn.
    api.setDemo(async () => {
      if (locked || !st || demoRunning) return;
      demoRunning = true;
      if (drag) {
        const d = drag;
        drag = null;
        stopListening();
        d.p.el.classList.remove('lift');
      }
      const me = st;
      clearGhost();
      me.pieces.forEach((p) => {
        unplace(p);
        posPiece(p, true);
      });
      api.prompt('Watch me fit the shapes, one by one.');
      await sleep(900);
      if (!alive || st !== me) return;
      let n = 0;
      for (const id of me.order) {
        const p = me.pieces[id];
        const s = me.puz.sol[id];
        if (p.extra) continue; // the spare shape stays in the tray
        p.el.classList.add('glowing');
        await sleep(350);
        if (!alive || st !== me) return;
        while (!sameRot(p.type, p.rot, s.rot)) {
          p.rot = (p.rot + 1) % 4;
          renderPiece(p);
          posPiece(p, false);
          sfx('flip');
          await sleep(420);
          if (!alive || st !== me) return;
        }
        const r = test(p, s.x, s.y);
        if (r.ok) commit(p, s.x, s.y, r);
        else p.placed = { x: s.x, y: s.y };
        p.el.style.zIndex = 30;
        posPiece(p, true, 650);
        sfx('whoosh');
        api.say(WORDS[n++] || '');
        await sleep(700);
        if (!alive || st !== me) return;
        p.el.style.zIndex = '';
        p.el.classList.remove('glowing');
        sfx('drop');
        await sleep(350);
        if (!alive || st !== me) return;
      }
      const spare = me.pieces.filter((p) => p.extra);
      if (spare.length) {
        spare.forEach((p) => p.el.classList.add('glowing'));
        api.say('This shape was not needed.');
        await sleep(1800);
        if (!alive || st !== me) return;
        spare.forEach((p) => p.el.classList.remove('glowing'));
      }
      api.cheer('All filled, no gaps! Now you try.');
      await sleep(2200);
      if (!alive || st !== me) return;
      me.pieces.forEach((p) => {
        unplace(p);
        p.placed = null;
        p.rot = p.startRot;
        renderPiece(p);
        posPiece(p, true, 450);
      });
      await sleep(500);
      if (!alive || st !== me) return;
      demoRunning = false;
      api.prompt(round === 0 ? 'Your turn! Put each shape on its colour.' : 'Your turn! Tap a shape to turn it.');
    });

    // re-layout (debounced) when the stage size really changes
    let lastSize = '';
    const onResize = () => {
      clearTimeout(resizeT);
      resizeT = setTimeout(() => {
        const sz = `${api.root.clientWidth}x${api.root.clientHeight}`;
        if (alive && !drag && !demoRunning && sz !== lastSize) {
          lastSize = sz;
          layout();
        }
      }, 120);
    };
    window.addEventListener('resize', onResize);
    const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(onResize) : null;
    ro?.observe(api.root);
    wrap.__bfp = {
      // test hook: lets an automated check read the current state
      get st() {
        return st;
      },
      get cell() {
        return cell;
      },
      origin: () => origin(),
      findHint: () => findHint(),
      M,
      same: (pid, r) => sameRot(st.pieces[pid].type, st.pieces[pid].rot, r),
    };
    newRound(round);
    return {
      destroy() {
        alive = false;
        stopListening();
        drag = null;
        timers.forEach((t) => clearTimeout(t));
        timers.clear();
        clearTimeout(resizeT);
        window.removeEventListener('resize', onResize);
        ro?.disconnect();
      },
    };
  },
};
