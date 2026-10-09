/**
 * Game: Robot Walks to the Wall  (id: robot-walks, level 4)
 *
 * Idea: a first taste of programming: the robot runs a strip of cards exactly, in order; a loop
 * ("until wall") card is needed when one program must fit paths of different lengths.
 * Rounds:
 *   1. Straight corridor, step cards only: put 2–4 "step" cards to reach the flag.
 *   2. L-shaped path (2–3 steps, one left/right turn, 1–3 steps): step + turn cards to the flag.
 *   3. Two L-paths of different sizes, same turn: one program for both stars needs loop, turn, loop.
 *   4. Zig-zag with two opposite turns; the strip starts with a buggy program (wrong turn, or one leg
 *      a step short/long) to fix so the robot reaches the present.
 *   5. Two zig-zags (two opposite turns, different first and last legs): loop, turn, loop, turn, loop.
 * Watch demo: clears the strip, adds the solution cards one by one (counting the steps aloud),
 *   presses Go, then restores the round's starting strip (the bug in round 4, empty otherwise).
 * Notes:
 *   - Exported pure helpers simulate(grid, prog), zPath(legs, turns, cols, rows) and makeRound(i)
 *     are test hooks for Node checks; wrap.dataset.sol holds the current solution (comma-separated).
 *   - Rounds are randomised from small fixed lists; in rounds 3 and 5 the two paths always differ in
 *     displacement, so no fixed-step program solves both (the loop card is required).
 *   - After 2 failed runs the palette cards in the solution glow; in rounds 1, 2 and 4 numbered
 *     footprints and turn icons are also drawn on the board.
 *   - Drag uses its own pointer code with a fixed-position ghost (removed in destroy()); tap adds or
 *     removes a card. The program strip holds at most MAX_CARDS cards.
 */
import { h, sleep, pick, rand, sfx, resumeRound } from '../lib/core.js';

// ---------- constants ----------
const ID = 'robot-walks';
const ROUNDS = 5; // number of rounds (see makeRound)
const S = 100; // SVG units per grid cell
const DX = [0, 1, 0, -1],
  DY = [-1, 0, 1, 0]; // 0 = up, 1 = right, 2 = down, 3 = left
const STEP_MS = 430,
  TURN_MS = 380,
  MAX_CARDS = 12;
const LOOP_GUARD = 60; // safety cap on steps taken by one "until wall" card
const WIN_PAUSE_MS = 2200; // pause after a successful run before the next round
const INK = '#2b2d42';
const chev = (y) =>
  `<polyline points="11,${y + 7} 20,${y} 29,${y + 7}" fill="none" stroke="${INK}" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round"/>`;
const CARDS = {
  fwd: {
    label: 'step',
    color: '#8be8c4',
    say: 'Step forward',
    icon: `<path d="M20 4 L33 18 H25 V35 H15 V18 H7 Z" fill="${INK}"/>`,
  },
  left: {
    label: 'turn left',
    color: '#9adcf8',
    say: 'Turn left',
    icon: `<path d="M28 36 V22 Q28 12 18 12 H14" fill="none" stroke="${INK}" stroke-width="5" stroke-linecap="round"/><polygon points="16,3 5,12 16,21" fill="${INK}"/>`,
  },
  right: {
    label: 'turn right',
    color: '#dcc3ff',
    say: 'Turn right',
    icon: `<path d="M12 36 V22 Q12 12 22 12 H26" fill="none" stroke="${INK}" stroke-width="5" stroke-linecap="round"/><polygon points="24,3 35,12 24,21" fill="${INK}"/>`,
  },
  loop: {
    label: 'until wall',
    color: '#ffc879',
    say: 'Keep stepping until the wall',
    icon: `<rect x="4" y="1" width="32" height="7" rx="2" fill="#b5651d" stroke="${INK}" stroke-width="2"/>${chev(12)}${chev(20)}${chev(28)}`,
  },
};
const CHEERS = [
  'The robot made it!',
  'Great program!',
  'Beep boop, hooray!',
  'You are a clever coder!',
  'Yay! Just right!',
];
const NUM = ['One', 'Two', 'Three', 'Four', 'Five', 'Six'];

// ---------- pure logic (deterministic) ----------
// Runs a program on a grid. Returns the trace of what the robot does, card by card.
// A "fwd" into a wall is a bump and stops the program; "loop" steps until the next cell is a wall
// (that ends the loop without a bump). ok = no bump and the robot stands on the goal.
export function simulate(grid, prog) {
  let { x, y, d } = grid.start;
  const trace = [];
  let bumped = -1;
  const free = (cx, cy) => grid.open.has(cx + ',' + cy);
  for (let i = 0; i < prog.length && bumped < 0; i++) {
    const c = prog[i];
    if (c === 'left' || c === 'right') {
      d = (d + (c === 'right' ? 1 : 3)) % 4;
      trace.push({ i, t: c, x, y, d });
    } else if (c === 'fwd') {
      if (free(x + DX[d], y + DY[d])) {
        x += DX[d];
        y += DY[d];
        trace.push({ i, t: 'move', x, y, d });
      } else {
        bumped = i;
        trace.push({ i, t: 'bump', x, y, d });
      }
    } else if (c === 'loop') {
      trace.push({ i, t: 'look', x, y, d });
      let guard = 0;
      while (free(x + DX[d], y + DY[d]) && guard++ < LOOP_GUARD) {
        x += DX[d];
        y += DY[d];
        trace.push({ i, t: 'move', x, y, d });
      }
      trace.push({ i, t: 'stop', x, y, d }); // the wall is in front: the loop ends, no bump
    }
  }
  return { trace, bumped, x, y, d, ok: bumped < 0 && x === grid.goal.x && y === grid.goal.y };
}

// L-shaped corridor: walk right a cells, then turn and walk b cells.
// For a left turn the corridor starts on row b so the vertical leg fits above it.
function lPath(a, b, turn, cols, rows) {
  const sy = turn === 'left' ? b : 0;
  const open = new Set();
  for (let x = 0; x <= a; x++) open.add(x + ',' + sy);
  for (let k = 1; k <= b; k++) open.add(a + ',' + (turn === 'left' ? sy - k : sy + k));
  return { cols, rows, open, start: { x: 0, y: sy, d: 1 }, goal: { x: a, y: turn === 'left' ? sy - b : sy + b } };
}

// Zig-zag corridor: walk legs[0] to the right, turn turns[0], walk legs[1], turn turns[1], ...
// Cells are traced from (0,0) and then shifted down so the top row is 0; cols/rows default to a tight fit.
export function zPath(legs, turns, cols, rows) {
  let x = 0,
    y = 0,
    d = 1;
  const cells = [[0, 0]];
  legs.forEach((n, k) => {
    for (let s = 0; s < n; s++) {
      x += DX[d];
      y += DY[d];
      cells.push([x, y]);
    }
    if (k < turns.length) d = (d + (turns[k] === 'right' ? 1 : 3)) % 4;
  });
  const minY = Math.min(...cells.map((c) => c[1]));
  const open = new Set(cells.map(([cx, cy]) => cx + ',' + (cy - minY)));
  return {
    cols: cols || x + 1,
    rows: rows || Math.max(...cells.map((c) => c[1])) - minY + 1,
    open,
    start: { x: 0, y: -minY, d: 1 },
    goal: { x, y: y - minY },
  };
}
const other = (t) => (t === 'left' ? 'right' : 'left');
// Step/turn program for a zig-zag: legs[0] steps, turns[0], legs[1] steps, ...
const fixedSol = (legs, turns) =>
  legs.flatMap((n, k) => [...Array(n).fill('fwd'), ...(k < turns.length ? [turns[k]] : [])]);

// Builds round i (0-based): grids, goal icon, palette card types, solution, and (round 4) the buggy start.
// Branch order is 0, 1, 3, 4; round 3 (i === 2) is the fall-through at the end.
export function makeRound(i) {
  if (i === 0) {
    const n = pick([2, 3, 4]);
    const cols = n + 2;
    const open = new Set();
    for (let x = 0; x < cols; x++) open.add(x + ',0');
    const grid = { cols, rows: 1, open, start: { x: 0, y: 0, d: 1 }, goal: { x: n, y: 0 } };
    return { i, n, grids: [grid], goal: '🚩', palette: ['fwd'], sol: Array(n).fill('fwd') };
  }
  if (i === 1) {
    const a = pick([2, 3]),
      b = pick([1, 2, 3]),
      turn = pick(['left', 'right']);
    return {
      i,
      legs: [a, b],
      turns: [turn],
      grids: [lPath(a, b, turn, a + 1, b + 1)],
      goal: '🚩',
      palette: ['fwd', 'left', 'right'],
      sol: [...Array(a).fill('fwd'), turn, ...Array(b).fill('fwd')],
    };
  }
  if (i === 3) {
    // Round 4: a zig-zag with two turns, and the program already has one bug to fix.
    const t1 = pick(['left', 'right']);
    const turns = [t1, other(t1)];
    const legs = pick([
      [2, 1, 2],
      [2, 2, 1],
      [1, 2, 2],
      [3, 1, 2],
      [2, 1, 3],
      [2, 2, 2],
      [3, 2, 1],
      [1, 2, 3],
    ]);
    const sol = fixedSol(legs, turns);
    const kind = pick(['turn', 'short', 'long']);
    let bug;
    if (kind === 'turn') {
      const k = pick([0, 1]);
      bug = fixedSol(
        legs,
        turns.map((t, j) => (j === k ? other(t) : t)),
      );
    } else {
      const k = rand(3);
      const l2 = legs.slice();
      l2[k] += kind === 'short' ? -1 : 1;
      bug = fixedSol(l2, turns);
    }
    return { i, legs, turns, grids: [zPath(legs, turns)], goal: '🎁', palette: ['fwd', 'left', 'right'], sol, bug };
  }
  if (i === 4) {
    // Round 5: two zig-zags of different sizes, same turns. Only the loop card fits both.
    const t1 = pick(['left', 'right']);
    const turns = [t1, other(t1)];
    const sets = [
      [1, 1, 1],
      [1, 2, 3],
      [2, 1, 2],
      [3, 2, 1],
      [1, 1, 3],
      [2, 2, 1],
      [3, 1, 1],
      [1, 2, 2],
      [2, 1, 1],
    ];
    let L1, L2;
    do {
      L1 = pick(sets);
      L2 = pick(sets);
    } while (L1[0] === L2[0] || L1[2] === L2[2]);
    return {
      i,
      turns,
      grids: [zPath(L1, turns, 5, 3), zPath(L2, turns, 5, 3)],
      goal: '🌟',
      palette: ['fwd', 'left', 'right', 'loop'],
      sol: ['loop', turns[0], 'loop', turns[1], 'loop'],
    };
  }
  // Round 3: two L-paths of different lengths (both legs differ), same turn direction.
  // No fixed list of steps can solve both (same moves give the same displacement), so the loop card is needed.
  const turn = pick(['left', 'right']);
  let [a1, a2] = pick([
    [1, 3],
    [2, 4],
    [2, 3],
    [3, 4],
    [1, 4],
  ]);
  const [b1, b2] = pick([
    [1, 2],
    [2, 1],
  ]);
  if (pick([0, 1])) {
    [a1, a2] = [a2, a1];
  }
  return {
    i,
    turn,
    grids: [lPath(a1, b1, turn, 5, 3), lPath(a2, b2, turn, 5, 3)],
    goal: '⭐',
    palette: ['fwd', 'left', 'right', 'loop'],
    sol: ['loop', turn, 'loop'],
  };
}

// Picks the nudge text after a failed run. Round 1 counts steps; rounds 2 and 4 (data.legs) walk the
// legs in order and report the first leg or turn that is off; loop rounds 3 and 5 check the cards used.
function hintFor(data, prog, results) {
  const nF = (arr) => arr.filter((c) => c === 'fwd').length;
  if (data.i === 0) {
    const k = nF(prog);
    if (k < data.n) return 'More steps! Add a step card.';
    if (k === data.n + 1) return 'Too far! Take one step card away.';
    return 'Bump! Too many steps. Take some away.';
  }
  if (data.legs) {
    const ts = prog.map((c, k) => (c === 'left' || c === 'right' ? k : -1)).filter((k) => k >= 0);
    const two = data.turns.length > 1;
    for (let k = 0; k < data.legs.length; k++) {
      if (k < data.turns.length && ts[k] === undefined)
        return k ? 'The path turns again. Add another turn!' : 'The path turns. Add a turn card!';
      const seg = nF(prog.slice(k ? ts[k - 1] + 1 : 0, k < ts.length ? ts[k] : prog.length));
      const where =
        k === 0
          ? 'before the turn'
          : k < data.turns.length
            ? 'between the turns'
            : two
              ? 'after the last turn'
              : 'after the turn';
      if (seg < data.legs[k])
        return k === data.legs.length - 1 ? `Almost! Add steps ${where}.` : `Walk more steps ${where}.`;
      if (seg > data.legs[k]) return k === 0 ? 'Bump! Turn sooner, at the corner.' : `Bump! Fewer steps ${where}.`;
      if (k < data.turns.length && prog[ts[k]] !== data.turns[k])
        return "Turn the other way! Look at the robot's nose.";
    }
    if (ts.length > data.turns.length) return 'Too many turns! Take a turn card out.';
    return 'Watch the robot, then fix one card.';
  }
  const okc = results.filter((r) => r.ok).length;
  if (!prog.includes('loop'))
    return okc
      ? 'Only one path worked. Try the until-wall card!'
      : data.i === 2
        ? 'Try the new card: until the wall!'
        : 'Try the until-wall card!';
  const turns = data.turns || [data.turn];
  const tl = prog.filter((c) => c === 'left' || c === 'right');
  if (tl.length < turns.length)
    return turns.length > 1 ? 'The path turns two times. Add turn cards!' : 'The path turns. Add a turn card!';
  if (turns.some((x, k) => tl[k] !== x))
    return turns.length > 1 ? "Check each turn. Look at the robot's nose." : 'Turn the other way at the corner!';
  if (tl.length > turns.length) return 'Too many turns! Take a turn card out.';
  if (results.some((r) => r.bumped >= 0)) return 'Bump! Take away the extra step cards.';
  if (okc) return 'One star! Make it work for both paths.';
  return turns.length > 1
    ? 'Until wall, turn, until wall, turn, until wall.'
    : 'Walk to the wall, turn, then walk to the wall.';
}

// ---------- drawing ----------
function robotSvg() {
  return `<rect x="-39" y="-20" width="9" height="40" rx="4" fill="${INK}"/><rect x="30" y="-20" width="9" height="40" rx="4" fill="${INK}"/>
    <polygon points="-13,-27 13,-27 0,-45" fill="#ffd166" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/>
    <rect x="-31" y="-29" width="62" height="58" rx="16" fill="#4cc9f0" stroke="${INK}" stroke-width="5"/>
    <circle cx="-12" cy="-9" r="9" fill="#fff" stroke="${INK}" stroke-width="3"/><circle cx="12" cy="-9" r="9" fill="#fff" stroke="${INK}" stroke-width="3"/>
    <circle cx="-12" cy="-12" r="4" fill="${INK}"/><circle cx="12" cy="-12" r="4" fill="${INK}"/>
    <path d="M-11 11 Q0 20 11 11" fill="none" stroke="${INK}" stroke-width="4" stroke-linecap="round"/>
    <circle cx="-20" cy="8" r="4" fill="#ff8fab"/><circle cx="20" cy="8" r="4" fill="#ff8fab"/>`;
}

// One room: SVG grid (open floor tiles, brick walls), goal icon, footprints layer, robot and effects
// layer, plus a corner badge (✅ per board in two-board rounds). Returns the board state object.
function makeBoard(grid, goalIcon) {
  const W = grid.cols * S,
    H = grid.rows * S;
  const svg = h('svg', {
    viewBox: `0 0 ${W + 20} ${H + 20}`,
    class: 'rw-svg',
    role: 'img',
    'aria-label': 'Robot room with a goal',
  });
  const g = h('g', { transform: 'translate(10,10)' });
  svg.append(g);
  for (let y = 0; y < grid.rows; y++)
    for (let x = 0; x < grid.cols; x++) {
      if (grid.open.has(x + ',' + y))
        g.append(h('rect', { x: x * S, y: y * S, width: S, height: S, fill: (x + y) % 2 ? '#ffeccb' : '#fffaf0' }));
      else
        g.append(
          h('g', {
            html: `<rect x="${x * S}" y="${y * S}" width="${S}" height="${S}" fill="#c98d5a"/>
      <path d="M${x * S} ${y * S + 33}h${S}M${x * S} ${y * S + 66}h${S}M${x * S + 50} ${y * S}v33M${x * S + 25} ${y * S + 33}v33M${x * S + 75} ${y * S + 33}v33M${x * S + 50} ${y * S + 66}v34" stroke="#9c6234" stroke-width="4"/>`,
          }),
        );
    }
  g.append(
    h('rect', { x: -4, y: -4, width: W + 8, height: H + 8, rx: 10, fill: 'none', stroke: INK, 'stroke-width': 8 }),
  );
  g.append(
    h(
      'text',
      {
        x: grid.goal.x * S + S / 2,
        y: grid.goal.y * S + S / 2 + 4,
        'font-size': 62,
        'text-anchor': 'middle',
        'dominant-baseline': 'central',
      },
      goalIcon,
    ),
  );
  const feet = h('g', { class: 'rw-feet' });
  const fx = h('g');
  g.append(feet);
  const bot = h('g', { class: 'rw-bot', html: robotSvg() });
  g.append(bot, fx);
  const badge = h('div', { class: 'rw-badge', 'aria-hidden': 'true' });
  const el = h('div', { class: 'rw-board' }, svg, badge);
  const bd = { grid, el, svg, bot, feet, fx, badge, pos: null };
  bd.pos = startPos(bd);
  draw(bd, bd.pos);
  return bd;
}
const cellPos = (x, y) => ({ px: x * S + S / 2, py: y * S + S / 2 });
// Start pose of the robot. The angle accumulates across turns (it is never wrapped to 0..359), so when
// returning to start pick the start heading's equivalent angle nearest the current one.
function startPos(bd, cur) {
  const { x, y, d } = bd.grid.start;
  const base = d * 90;
  const a = cur ? base + 360 * Math.round((cur.a - base) / 360) : base; // shortest way back
  return { ...cellPos(x, y), a };
}
function draw(bd, p) {
  bd.bot.setAttribute('transform', `translate(${p.px.toFixed(1)},${p.py.toFixed(1)}) rotate(${p.a.toFixed(1)})`);
}
// Animates the robot to pose `to` over ms with ease-in-out. bd.pos is set to the target at once.
// A setTimeout fallback resolves the promise even if requestAnimationFrame is paused (hidden tab).
function tween(bd, to, ms) {
  const from = { ...bd.pos };
  bd.pos = { ...to };
  return new Promise((res) => {
    if (!ms) {
      draw(bd, to);
      res();
      return;
    }
    let done = false;
    const t0 = performance.now();
    const fin = () => {
      if (done) return;
      done = true;
      draw(bd, to);
      res();
    };
    const f = (now) => {
      if (done) return;
      const k = Math.min(1, (now - t0) / ms);
      const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
      draw(bd, {
        px: from.px + (to.px - from.px) * e,
        py: from.py + (to.py - from.py) * e,
        a: from.a + (to.a - from.a) * e,
      });
      if (k < 1) requestAnimationFrame(f);
      else fin();
    };
    requestAnimationFrame(f);
    setTimeout(fin, ms + 250);
  });
}

// ---------- styles (scoped under .a-robot-walks) ----------
const CSS = `
.a-robot-walks{width:100%;max-width:980px;display:flex;flex-direction:column;align-items:center;gap:10px}
.a-robot-walks .rw-boards{display:flex;gap:12px;justify-content:center;width:100%}
.a-robot-walks .rw-board{position:relative;flex:1 1 0;min-width:0;max-width:560px;display:flex;justify-content:center}
.a-robot-walks .rw-boards.one .rw-board{max-width:640px}
.a-robot-walks .rw-svg{width:100%;height:auto;max-height:36vh;display:block}
.a-robot-walks .rw-badge{position:absolute;top:-8px;right:-4px;font-size:1.7rem;line-height:1}
.a-robot-walks .rw-strip{width:100%;max-width:780px;min-height:92px;border:3px dashed ${INK};border-radius:20px;background:#fff;display:flex;flex-wrap:wrap;gap:8px;padding:10px;align-items:center;transition:background .2s}
.a-robot-walks .rw-strip.over{background:#fff6d6}
.a-robot-walks .rw-empty{flex:1;text-align:center;font-weight:800;opacity:.55;pointer-events:none}
.a-robot-walks .rw-tag{font-weight:900;font-size:.85rem;width:100%;max-width:780px;margin:-2px 0 -4px;padding-left:8px;opacity:.8}
.a-robot-walks .rw-row{display:flex;gap:10px;flex-wrap:wrap;justify-content:center;align-items:center;width:100%}
.a-robot-walks .rw-card{position:relative;width:78px;height:82px;border:3px solid ${INK};border-radius:16px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;padding:4px;cursor:grab;touch-action:none;user-select:none;-webkit-user-select:none;box-shadow:0 4px 0 rgba(43,45,66,.18);font-weight:900;font-size:.74rem;line-height:1;color:${INK};transition:transform .15s,opacity .2s}
.a-robot-walks .rw-card.sm{width:62px;height:68px;font-size:.66rem}
.a-robot-walks .rw-ico{width:36px;height:36px;pointer-events:none}
.a-robot-walks .rw-card.sm .rw-ico{width:30px;height:30px}
.a-robot-walks .rw-lab{pointer-events:none;white-space:nowrap}
.a-robot-walks .rw-card.now{outline:5px solid #ffd166;outline-offset:2px;transform:translateY(-6px) scale(1.06)}
.a-robot-walks .rw-card.bumped{outline:5px dashed #ff9f1c;outline-offset:2px;animation:rwshake .45s 2}
.a-robot-walks .rw-card.lift{opacity:.3}
.a-robot-walks .rw-ghost{position:fixed;margin:0;pointer-events:none;z-index:1000;filter:drop-shadow(0 8px 6px rgba(0,0,0,.25));transition:none}
.a-robot-walks .rw-ctrl{min-height:56px}
.a-robot-walks .rw-sep{width:2px;height:56px;background:#e8dfc8;border-radius:2px}
.a-robot-walks .rw-bump{font-weight:900;font-size:34px;fill:#ff6b6b;stroke:#fff;stroke-width:6px;paint-order:stroke;animation:rwrise 1s ease-out forwards}
.a-robot-walks .rw-foot{font-weight:900;font-size:28px;fill:#f08c00;stroke:#fff;stroke-width:6px;paint-order:stroke}
@keyframes rwrise{from{opacity:1;transform:translateY(0)}to{opacity:0;transform:translateY(-36px)}}
@keyframes rwshake{25%{transform:translateX(-5px)}75%{transform:translateX(5px)}}
@media (max-width:560px){.a-robot-walks .rw-strip{padding:8px 5px;gap:6px;min-height:80px}.a-robot-walks .rw-card{width:66px;height:72px;font-size:.66rem}.a-robot-walks .rw-card.sm{width:56px;height:62px;font-size:.6rem}.a-robot-walks .rw-svg{max-height:30vh}.a-robot-walks .rw-sep{display:none}}
`;

// ---------- activity ----------
export default {
  id: ID,
  rounds: ROUNDS,
  parentNote:
    'A first taste of programming: the robot does exactly what the cards say, one card at a time, in order. Ask her to “be the robot” and walk the program with her body before pressing Go, and to check which way the robot’s nose points before choosing left or right (her left is not always the robot’s left). In round 3 a fixed number of steps fits one path but not the other, so “until wall” (a loop) is needed; round 4 asks her to find and fix one wrong card in a ready-made program, and round 5 uses loops on two zig-zag paths with two turns.',
  async start(api) {
    let alive = true;
    let busy = false;
    let round = 0;
    let data = null;
    let prog = [];
    let fails = 0;
    let boards = [];
    let ghost = null;
    api.css(CSS);
    const wrap = h('div', { class: `a-${ID}` });
    api.root.append(wrap);
    const boardsEl = h('div', { class: 'rw-boards' });
    const strip = h('div', { class: 'rw-strip', role: 'list', 'aria-label': 'Robot program' });
    const palette = h('div', { class: 'rw-row rw-pal' });
    const goBtn = h('button', { class: 'btn primary rw-ctrl rw-go', 'aria-label': 'Go' }, '▶ Go');
    const resetBtn = h('button', { class: 'btn rw-ctrl', 'aria-label': 'Robot back to start' }, '↩ Start');
    const clearBtn = h('button', { class: 'btn rw-ctrl', 'aria-label': 'Clear all cards' }, '🧹 Clear');
    const controls = h('div', { class: 'rw-row' }, goBtn, resetBtn, clearBtn);
    wrap.append(boardsEl, h('div', { class: 'rw-tag' }, '🤖 Program'), strip, palette, controls);

    function cardEl(type, small) {
      const c = CARDS[type];
      return h(
        'button',
        {
          class: 'rw-card' + (small ? ' sm' : ''),
          type: 'button',
          'data-type': type,
          'aria-label': c.say + (small ? ' (tap to take out)' : ''),
          style: { background: c.color },
        },
        h('svg', { viewBox: '0 0 40 40', class: 'rw-ico', 'aria-hidden': 'true', html: c.icon }),
        h('span', { class: 'rw-lab' }, c.label),
      );
    }
    const stripCards = () => [...strip.querySelectorAll('.rw-card')];
    function renderStrip() {
      strip.replaceChildren();
      if (!prog.length) strip.append(h('span', { class: 'rw-empty' }, 'Drag or tap cards to put them here'));
      prog.forEach((t, i) => {
        const c = cardEl(t, true);
        c.setAttribute('role', 'listitem');
        grab(c, true, i);
        strip.append(c);
      });
    }
    // FLIP animation: slide el from fromRect to where it now sits in the layout.
    function flipFrom(el, fromRect) {
      const b = el.getBoundingClientRect();
      el.style.transition = 'none';
      el.style.transform = `translate(${fromRect.left - b.left}px,${fromRect.top - b.top}px)`;
      void el.offsetWidth;
      el.style.transition = 'transform .4s cubic-bezier(.3,1.2,.5,1)';
      el.style.transform = '';
      setTimeout(() => {
        el.style.transition = '';
      }, 450);
    }
    function addCard(type, idx, fromRect) {
      if (prog.length >= MAX_CARDS) {
        api.nudge('The program is full! Try Go.');
        return false;
      }
      clearMarks();
      prog.splice(idx, 0, type);
      renderStrip();
      sfx('drop');
      const el = stripCards()[idx];
      if (el && fromRect) flipFrom(el, fromRect);
      return true;
    }
    function dropIndex(under, cx) {
      const c = under && under.closest('.rw-strip .rw-card');
      if (!c) return prog.length;
      const i = stripCards().indexOf(c);
      const r = c.getBoundingClientRect();
      return cx > r.left + r.width / 2 ? i + 1 : i;
    }
    // own pointer drag: palette cards make copies (unlimited), strip cards move or leave the strip
    function grab(el, inStrip, index) {
      el.addEventListener('click', (e) => {
        if (e.detail === 0 && !busy) tap();
      }); // keyboard
      const tap = () => {
        if (inStrip) {
          clearMarks();
          prog.splice(index, 1);
          renderStrip();
          sfx('pop');
        } else {
          addCard(el.dataset.type, prog.length, el.getBoundingClientRect());
        }
      };
      el.addEventListener('pointerdown', (e) => {
        if (busy || !alive || (e.button != null && e.button > 0)) return;
        e.preventDefault();
        const sx = e.clientX,
          sy = e.clientY,
          r = el.getBoundingClientRect();
        let g = null;
        try {
          el.setPointerCapture(e.pointerId);
        } catch {
          /* ignore */
        }
        const move = (ev) => {
          const dx = ev.clientX - sx,
            dy = ev.clientY - sy;
          if (!g && Math.abs(dx) + Math.abs(dy) > 10) {
            g = el.cloneNode(true);
            g.classList.add('rw-ghost');
            g.classList.remove('now', 'bumped');
            Object.assign(g.style, {
              left: r.left + 'px',
              top: r.top + 'px',
              width: r.width + 'px',
              height: r.height + 'px',
            });
            wrap.append(g);
            ghost = g;
            if (inStrip) el.classList.add('lift');
          }
          if (g) {
            g.style.transform = `translate(${dx}px,${dy}px) scale(1.08)`;
            const u = document.elementFromPoint(ev.clientX, ev.clientY);
            strip.classList.toggle('over', !!(u && u.closest('.rw-strip')));
          }
        };
        const up = (ev) => {
          el.removeEventListener('pointermove', move);
          el.removeEventListener('pointerup', up);
          el.removeEventListener('pointercancel', up);
          strip.classList.remove('over');
          if (!g) {
            if (ev.type === 'pointerup' && !busy) tap();
            return;
          }
          const under = document.elementFromPoint(ev.clientX, ev.clientY);
          const inS = !!(under && under.closest('.rw-strip'));
          const gr = g.getBoundingClientRect();
          const kill = () => {
            g.remove();
            if (ghost === g) ghost = null;
          };
          if (busy) {
            kill();
            el.classList.remove('lift');
            return;
          }
          if (inStrip) {
            if (inS) {
              let to = dropIndex(under, ev.clientX);
              const t = prog.splice(index, 1)[0];
              if (to > index) to--;
              prog.splice(to, 0, t);
              clearMarks();
              renderStrip();
              sfx('drop');
              const ne = stripCards()[to];
              if (ne) flipFrom(ne, gr);
              kill();
            } else {
              clearMarks();
              prog.splice(index, 1);
              renderStrip();
              sfx('pop');
              g.style.transition = 'opacity .25s, transform .25s';
              g.style.opacity = '0';
              setTimeout(kill, 260);
            }
          } else if (inS) {
            addCard(el.dataset.type, dropIndex(under, ev.clientX), gr);
            kill();
          } else {
            g.style.transition = 'transform .28s cubic-bezier(.3,1.4,.5,1)';
            g.style.transform = 'translate(0,0)';
            setTimeout(kill, 300);
          }
        };
        el.addEventListener('pointermove', move);
        el.addEventListener('pointerup', up);
        el.addEventListener('pointercancel', up);
      });
    }

    function setBusy(b) {
      busy = b;
      [goBtn, resetBtn, clearBtn].forEach((x) => {
        x.disabled = b;
      });
    }
    function clearMarks() {
      stripCards().forEach((c) => c.classList.remove('now', 'bumped'));
      boards.forEach((bd) => {
        bd.badge.textContent = '';
      });
    }
    function highlight(i) {
      stripCards().forEach((c, k) => c.classList.toggle('now', k === i));
    }
    async function resetBots(ms) {
      await Promise.all(boards.map((bd) => tween(bd, startPos(bd, bd.pos), ms)));
    }

    // Bump animation: nudge toward the wall, float a "bump!" label, spring back.
    async function bump(bd, st) {
      sfx('drop');
      const fwd = { px: bd.pos.px + DX[st.d] * 26, py: bd.pos.py + DY[st.d] * 26, a: bd.pos.a };
      const back = { ...bd.pos };
      const tx = h(
        'text',
        { x: bd.pos.px + DX[st.d] * 40, y: bd.pos.py + DY[st.d] * 40 - 24, 'text-anchor': 'middle', class: 'rw-bump' },
        'bump! ✨',
      );
      bd.fx.append(tx);
      setTimeout(() => tx.remove(), 1100);
      await tween(bd, fwd, 140);
      await tween(bd, back, 260);
    }

    // Runs the program on every board in turn, highlighting the active card. In demo mode it only
    // reports success; otherwise it cheers and advances, or nudges with a hint (strong hint after 2 misses).
    async function run(demo = false) {
      if (busy) return false;
      if (!prog.length) {
        api.nudge('Put some cards in the strip first!');
        return false;
      }
      setBusy(true);
      clearMarks();
      const myRound = round;
      const results = [];
      for (const bd of boards) {
        await resetBots(250);
        if (!alive || myRound !== round) return false;
        await sleep(200);
        if (!alive) return false;
        const r = simulate(bd.grid, prog);
        results.push(r);
        for (const st of r.trace) {
          highlight(st.i);
          if (st.t === 'move') {
            sfx('step');
            await tween(bd, { ...cellPos(st.x, st.y), a: bd.pos.a }, STEP_MS);
          } else if (st.t === 'left' || st.t === 'right') {
            sfx('tick');
            await tween(bd, { ...bd.pos, a: bd.pos.a + (st.t === 'right' ? 90 : -90) }, TURN_MS);
          } else if (st.t === 'bump') await bump(bd, st);
          else await sleep(st.t === 'look' ? 200 : 260);
          if (!alive) return false;
          await sleep(120);
          if (!alive) return false;
        }
        highlight(-1);
        if (r.bumped >= 0) stripCards()[r.bumped]?.classList.add('bumped');
        if (boards.length > 1) bd.badge.textContent = r.ok ? '✅' : '';
        await sleep(350);
        if (!alive) return false;
      }
      const allOk = results.every((r) => r.ok);
      if (demo) {
        setBusy(false);
        return allOk;
      }
      if (allOk) {
        fails = 0;
        api.cheer(pick(CHEERS));
        sfx('win');
        await sleep(WIN_PAUSE_MS);
        if (!alive || myRound !== round) return true;
        if (round >= ROUNDS - 1) {
          api.finish();
          return true;
        }
        setBusy(false);
        startRound(round + 1);
        return true;
      }
      fails++;
      setBusy(false);
      api.nudge(hintFor(data, prog, results));
      if (fails >= 2) strongHint();
      return false;
    }

    // Strong hint: glow the needed palette cards; in non-loop rounds also draw numbered footprints
    // (reset to 1 after each turn) and turn icons along the solution path.
    function strongHint() {
      const need = new Set(data.sol);
      palette.querySelectorAll('.rw-card').forEach((c) => c.classList.toggle('glow', need.has(c.dataset.type)));
      if (data.sol.includes('loop')) return; // in the loop rounds the glowing cards are the hint
      for (const bd of boards) {
        bd.feet.replaceChildren();
        let k = 0;
        for (const st of simulate(bd.grid, data.sol).trace) {
          if (st.t === 'move') {
            k++;
            const p = cellPos(st.x, st.y);
            bd.feet.append(
              h(
                'text',
                {
                  x: p.px + 32,
                  y: p.py + 30,
                  class: 'rw-foot',
                  'text-anchor': 'middle',
                  'dominant-baseline': 'central',
                },
                String(k),
              ),
            );
          } else if (st.t === 'left' || st.t === 'right') {
            k = 0;
            const p = cellPos(st.x, st.y);
            bd.feet.append(
              h('svg', {
                x: p.px + 10,
                y: p.py - 48,
                width: 38,
                height: 38,
                viewBox: '0 0 40 40',
                opacity: 0.75,
                html: CARDS[st.t].icon,
              }),
            );
          }
        }
      }
    }

    goBtn.addEventListener('click', () => {
      if (!busy) run();
    });
    resetBtn.addEventListener('click', async () => {
      if (busy) return;
      sfx('whoosh');
      clearMarks();
      setBusy(true);
      await resetBots(300);
      if (alive) setBusy(false);
    });
    clearBtn.addEventListener('click', () => {
      if (busy) return;
      sfx('whoosh');
      prog = [];
      clearMarks();
      renderStrip();
      resetBots(300);
    });

    async function startRound(i) {
      round = i;
      data = makeRound(i);
      prog = data.bug ? data.bug.slice() : [];
      fails = 0;
      api.stage(i, ROUNDS);
      wrap.dataset.sol = data.sol.join(',');
      boards = data.grids.map((g) => makeBoard(g, data.goal));
      boardsEl.className = 'rw-boards' + (boards.length === 1 ? ' one' : '');
      boardsEl.replaceChildren(...boards.map((b) => b.el));
      palette.replaceChildren(
        ...data.palette.map((t) => {
          const c = cardEl(t, false);
          grab(c, false);
          return c;
        }),
      );
      renderStrip();
      if (i === 0) api.prompt('Give the robot step cards to reach the flag.');
      else if (i === 1) api.prompt('The path turns! Use a turn card to reach the flag.');
      else if (i === 3) {
        await api.prompt('Oops, a bug! Fix the program to reach the present.');
        if (alive && round === 3 && !busy) stripCards().forEach((c) => c.classList.add('hop'));
        await sleep(1000);
        stripCards().forEach((c) => c.classList.remove('hop'));
      } else if (i === 4) api.prompt('Two turns now! One program for both stars.');
      else {
        const lc = palette.querySelector('[data-type="loop"]');
        lc.classList.add('hop');
        await api.prompt('New card! It keeps stepping until the wall.');
        await sleep(900);
        lc.classList.remove('hop');
        if (alive && round === 2 && !busy) api.prompt('One program for both paths. Reach both stars!');
      }
    }

    // Watch demo: wait for any run to end, build the solution card by card (counting steps aloud),
    // run it, then restore the round's starting strip so the child can try.
    api.setDemo(async () => {
      while (busy && alive) await sleep(100);
      if (!alive) return;
      const myRound = round;
      const sol = data.sol.slice();
      prog = [];
      clearMarks();
      renderStrip();
      await resetBots(200);
      await Promise.all([api.prompt('Watch me make a program!'), sleep(900)]);
      let k = 0;
      for (const t of sol) {
        if (!alive || myRound !== round) return;
        const from = palette.querySelector(`[data-type="${t}"]`);
        addCard(t, prog.length, from.getBoundingClientRect());
        k = t === 'fwd' ? k + 1 : 0;
        const words =
          t === 'fwd' ? NUM[k - 1] || 'Step' : t === 'loop' && prog.length > 1 ? 'Until the wall again' : CARDS[t].say;
        await Promise.all([api.say(words), sleep(800)]);
      }
      if (!alive || myRound !== round) return;
      goBtn.classList.add('glow');
      await Promise.all([api.say('Now press Go!'), sleep(800)]);
      goBtn.classList.remove('glow');
      if (!alive || myRound !== round) return;
      const ok = await run(true);
      if (!alive || myRound !== round) return;
      await Promise.all([api.say(ok ? 'It works!' : 'Hmm.'), sleep(900)]);
      if (!alive || myRound !== round) return;
      prog = data.bug ? data.bug.slice() : [];
      clearMarks();
      renderStrip();
      await resetBots(300);
      if (alive) api.prompt(data.bug ? 'Now you fix the bug!' : 'Now you try!');
    });

    startRound(resumeRound(api, ROUNDS));
    return {
      destroy() {
        alive = false;
        if (ghost) ghost.remove();
      },
    };
  },
};
