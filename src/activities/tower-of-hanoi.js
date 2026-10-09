/**
 * Game: Tower of Hanoi  (id: tower-of-hanoi, level 4)
 *
 * Idea: a stack can only be moved by parking smaller pieces out of the way (recursive planning); never a big pancake on a small one.
 * Rounds:
 *   1. 2 pancakes, all on one random peg, move to the star plate.
 *   2. 3 pancakes, same task.
 *   3. 4 pancakes, same task.
 *   4. 3 pancakes starting mixed up (best solution 5-6 moves), stack them on the star.
 *   5. 4 pancakes starting mixed up (best solution 10-12 moves); the best move count is shown.
 * Watch demo: resets the round to its start, then plays the optimal plan with narration, then resets so the child can try.
 * Notes:
 *   - Test hooks: `planMoves`, `topOf`, `mixedStart` are exported pure helpers (between the SOLVER-START / SOLVER-END
 *     markers; keep them free of DOM). pos[s] = peg (0..2) of disc s, s = 0 is the smallest disc.
 *   - planMoves(pos, goal) gives the fewest-moves solution from any legal position.
 *   - mixedStart retries randomly until the fewest-moves length is in the round's [lo, hi] range.
 *   - Input: drag the top pancake, or tap a peg then tap a peg. A move onto a smaller pancake bounces back;
 *     the second miss in a row gives a glowing hint.
 *   - Layout is measured from the board width (ResizeObserver); G holds the geometry.
 */
import { h, sleep, shuffle, rand, pick, sfx, COLORS, resumeRound } from '../lib/core.js';

// ---------- pure helpers (kept free of DOM so they can be tested) ----------
// pos[s] = peg (0..2) of disc s, where s = 0 is the smallest disc.
// SOLVER-START
export function planMoves(posIn, target) {
  const pos = posIn.slice();
  const out = [];
  const go = (k, t) => {
    if (k < 0) return;
    if (pos[k] === t) {
      go(k - 1, t);
      return;
    }
    const other = 3 - pos[k] - t;
    go(k - 1, other);
    out.push([pos[k], t]);
    pos[k] = t;
    go(k - 1, t);
  };
  go(pos.length - 1, target);
  return out;
}
// smallest disc on peg, or -1
export function topOf(pos, peg) {
  return pos.indexOf(peg);
}
// random legal mixed start + goal peg whose fewest-moves solution lies in [lo, hi]
export function mixedStart(n, lo, hi, rnd = Math.random) {
  for (;;) {
    const pos = Array.from({ length: n }, () => Math.floor(rnd() * 3));
    const goal = Math.floor(rnd() * 3);
    if (new Set(pos).size < 2) continue; // must look mixed, not a tower
    const k = planMoves(pos, goal).length;
    if (k >= lo && k <= hi) return { pos, goal };
  }
}
// SOLVER-END

const ID = 'tower-of-hanoi';
// mixed: start from a scrambled (but legal) position; [lo, hi] = allowed fewest-moves range.
const ROUNDS = [{ n: 2 }, { n: 3 }, { n: 4 }, { n: 3, mixed: [5, 6] }, { n: 4, mixed: [10, 12] }];
const PEG_WORD = ['left', 'middle', 'right'];
const SIZE_WORDS = { 2: ['small', 'big'], 3: ['small', 'medium', 'big'], 4: ['tiny', 'small', 'medium', 'big'] };
const ROUND_PROMPT = [
  'Move the pancakes to the star plate.',
  'Three pancakes now. Never big on small!',
  'Four pancakes! One at a time to the star.',
  'Pancakes got mixed up! Stack them all on the star.',
  'Four mixed pancakes! Best is {B} moves. Can you?',
];
const CHEERS = ['Yummy! You did it!', 'Wonderful stacking!', 'The whole tower moved!', 'Super chef!'];
const OOPS = [
  'Oops! A big pancake can’t sit on a small one.',
  'That one is too big for there. Try another peg.',
  'Bigger pancakes go underneath. Try again!',
];
const FACE =
  '<circle cx="7" cy="4" r="2.2" fill="#2b2d42"/><circle cx="19" cy="4" r="2.2" fill="#2b2d42"/><path d="M9 8 Q13 12 17 8" stroke="#2b2d42" stroke-width="2" fill="none" stroke-linecap="round"/>';

export default {
  id: ID,
  rounds: ROUNDS.length,
  parentNote:
    'Move the whole stack of pancakes to the star plate: one pancake at a time, and never a bigger one on a smaller one. Ask "Where must the little one go first so the big one can move?" — children often try to move the big one too early, or forget they can use the empty middle peg as a parking place. Rounds 4 and 5 start from a mixed-up pile: ask "Which pancake must reach the star first?" (the biggest) and try to match the best number of moves, though extra moves are always fine.',

  async start(api) {
    let alive = true;
    let ro = null;
    const C = '.a-' + ID;
    api.css(`
${C}{width:100%;max-width:660px;display:flex;flex-direction:column;align-items:center;gap:10px;margin:0 auto}
${C} .board{position:relative;width:100%;touch-action:none;user-select:none;-webkit-user-select:none}
${C} .zone{position:absolute;top:0;bottom:0;border-radius:22px;transition:background .2s}
${C} .zone.glow{background:rgba(255,209,102,.28)}
${C} .zone.sel{background:rgba(76,201,240,.12)}
${C} .rod{position:absolute;width:14px;margin-left:-7px;border:3px solid ${COLORS.ink};border-bottom:0;border-radius:10px 10px 0 0;background:#c8a27a}
${C} .base{position:absolute;height:18px;border:3px solid ${COLORS.ink};border-radius:12px;background:#e9d5b7;box-sizing:border-box}
${C} .base.goal{background:#fff3c4}
${C} .lbl{position:absolute;text-align:center;font-size:1.5rem;line-height:1;pointer-events:none}
${C} .disc{position:absolute;left:0;top:0;pointer-events:none;will-change:transform}
${C} .disc .cake{box-sizing:border-box;width:100%;height:100%;border:3px solid ${COLORS.ink};border-radius:999px;display:grid;place-items:center;box-shadow:inset 0 5px 0 rgba(255,255,255,.45),inset 0 -5px 0 rgba(0,0,0,.10);transition:box-shadow .2s}
${C} .disc.up .cake{box-shadow:inset 0 5px 0 rgba(255,255,255,.45),0 10px 8px rgba(0,0,0,.18)}
${C} .disc .cake.glow{box-shadow:0 0 0 5px rgba(255,209,102,.95),inset 0 5px 0 rgba(255,255,255,.45)}
${C} .disc svg{width:26px;height:14px}
${C} .info{display:flex;gap:10px;flex-wrap:wrap;justify-content:center;align-items:center}
${C} .moves{font-weight:800;color:#6b6f80;font-size:1.05rem;padding:0 6px;text-align:center}
${C} .info .btn{min-height:56px}
`);
    const wrap = h('div', { class: 'a-' + ID });
    api.root.append(wrap);
    const board = h('div', { class: 'board', role: 'application', 'aria-label': 'Three pegs with pancakes' });
    const movesEl = h('div', { class: 'moves', 'aria-live': 'polite' });
    const hintBtn = h('button', { class: 'btn', type: 'button', 'aria-label': 'Hint' }, '\u{1F4A1} Hint');
    const undoBtn = h('button', { class: 'btn', type: 'button', 'aria-label': 'Undo last move' }, '↩ Undo');
    wrap.append(board, h('div', { class: 'info' }, movesEl, hintBtn, undoBtn));

    const palette = shuffle([COLORS.pink, COLORS.yellow, COLORS.green, COLORS.sky, COLORS.purple, COLORS.orange]);
    // ---------- round state ----------
    let round = 0,
      n = 2,
      startPos = [],
      best = 3,
      goal = 2,
      pos = [],
      discs = [],
      zones = [],
      rods = [],
      bases = [],
      lbls = [];
    let moves = 0,
      history = [],
      wrongStreak = 0,
      busy = false,
      selected = -1,
      grab = null,
      demoing = false,
      solved = false;
    const G = { W: 300, colW: 100, dH: 40, lift: 10, baseTop: 200 };

    // ---------- geometry ----------
    // measure(): board size from its width; baseTop = y of the plate tops (room for lift + n discs).
    function measure() {
      const W = Math.max(240, board.clientWidth || 300);
      const dH = W < 480 ? 36 : 44;
      G.W = W;
      G.colW = W / 3;
      G.dH = dH;
      G.lift = 8;
      G.baseTop = G.lift + dH + 26 + n * dH;
      board.style.height = G.baseTop + 18 + 40 + 'px';
    }
    const pegX = (p) => G.colW * (p + 0.5);
    function discW(s) {
      const maxW = G.colW * 0.94,
        minW = Math.max(G.colW * 0.4, 48);
      return n === 1 ? maxW : minW + ((maxW - minW) * s) / (n - 1);
    }
    const levelOf = (s) => pos.filter((p, i) => p === pos[s] && i > s).length; // discs below s
    const restY = (s, peg, lvl) => G.baseTop - (lvl + 1) * G.dH;
    const stackHeight = (peg, except = -1) => pos.filter((p, i) => p === peg && i !== except).length;
    const topY = (peg, except = -1) => G.baseTop - (stackHeight(peg, except) + 1) * G.dH; // where a new disc would land

    function setXY(s, x, y, ms = 0, ease = 'cubic-bezier(.4,.1,.2,1)') {
      const d = discs[s];
      d._x = x;
      d._y = y;
      d.style.transition = ms ? `transform ${ms}ms ${ease}` : 'none';
      d.style.transform = `translate(${x}px, ${y}px)`;
      return ms ? sleep(ms) : Promise.resolve();
    }
    function layout() {
      measure();
      zones.forEach((z, p) => {
        z.style.left = p * G.colW + 4 + 'px';
        z.style.width = G.colW - 8 + 'px';
      });
      rods.forEach((r, p) => {
        r.style.left = pegX(p) + 'px';
        r.style.top = G.lift + G.dH + 6 + 'px';
        r.style.height = G.baseTop - G.lift - G.dH - 6 + 'px';
      });
      bases.forEach((b, p) => {
        b.style.left = p * G.colW + G.colW * 0.02 + 'px';
        b.style.width = G.colW * 0.96 + 'px';
        b.style.top = G.baseTop + 'px';
      });
      lbls.forEach((l, p) => {
        l.style.left = p * G.colW + 'px';
        l.style.width = G.colW + 'px';
        l.style.top = G.baseTop + 24 + 'px';
      });
      discs.forEach((d, s) => {
        d.style.width = discW(s) + 'px';
        d.style.height = G.dH - 2 + 'px';
        if (grab && grab.s === s) return;
        if (selected >= 0 && topOf(pos, selected) === s) setXY(s, pegX(pos[s]) - discW(s) / 2, G.lift);
        else setXY(s, pegX(pos[s]) - discW(s) / 2, restY(s, pos[s], levelOf(s)));
      });
    }

    function buildRound(i) {
      round = i;
      n = ROUNDS[i].n;
      if (ROUNDS[i].mixed) {
        const m = mixedStart(n, ...ROUNDS[i].mixed);
        startPos = m.pos;
        goal = m.goal;
      } else {
        const sp = rand(3);
        goal = pick([0, 1, 2].filter((p) => p !== sp));
        startPos = Array(n).fill(sp);
      }
      pos = startPos.slice();
      best = planMoves(pos, goal).length;
      moves = 0;
      history = [];
      wrongStreak = 0;
      selected = -1;
      grab = null;
      busy = false;
      solved = false;
      board.replaceChildren();
      zones = [0, 1, 2].map((p) => h('div', { class: 'zone' }));
      rods = [0, 1, 2].map(() => h('div', { class: 'rod' }));
      bases = [0, 1, 2].map((p) => h('div', { class: 'base' + (p === goal ? ' goal' : '') }));
      lbls = [0, 1, 2].map((p) => h('div', { class: 'lbl', 'aria-hidden': 'true' }, p === goal ? '⭐' : ''));
      discs = Array.from({ length: n }, (_, s) =>
        h(
          'div',
          { class: 'disc', style: { zIndex: 10 + (n - s) } },
          h(
            'div',
            { class: 'cake', style: { background: palette[s % palette.length] } },
            h('svg', { viewBox: '0 0 26 14', html: FACE }),
          ),
        ),
      );
      board.append(...zones, ...rods, ...bases, ...lbls, ...discs);
      layout();
      updateMoves();
      clearGlow();
    }

    function updateMoves(final = false) {
      if (!final) movesEl.textContent = ROUNDS[round].mixed ? `moves: ${moves} (best: ${best})` : `moves: ${moves}`;
      else
        movesEl.textContent =
          moves === best ? `moves: ${moves} — the best possible!` : `moves: ${moves} — best possible ${best}`;
      undoBtn.disabled = !history.length || solved;
      hintBtn.disabled = solved;
    }
    function clearGlow() {
      zones.forEach((z) => z.classList.remove('glow', 'sel'));
      discs.forEach((d) => d.firstChild.classList.remove('glow'));
    }
    function wiggle(s, cls) {
      const c = discs[s].firstChild;
      c.classList.remove(cls);
      void c.offsetWidth;
      c.classList.add(cls);
      setTimeout(() => c.classList.remove(cls), 520);
    }
    const describe = (mv) =>
      `the ${SIZE_WORDS[n][topOf(pos, mv[0])]} pancake to the ${mv[1] === goal ? 'star plate' : PEG_WORD[mv[1]] + ' peg'}`;

    // ---------- animated moves ----------
    // flyDisc: lift, slide across, drop (quick scales the durations). bounce: carry over a too-small disc, shake, return.
    async function flyDisc(s, to, landY, quick = 1) {
      const d = discs[s];
      d.classList.add('up');
      d.style.zIndex = 100;
      const x2 = pegX(to) - discW(s) / 2;
      if (d._y > G.lift + 2) await setXY(s, d._x, G.lift, 200 * quick);
      if (!alive) return;
      if (Math.abs(d._x - x2) > 1) await setXY(s, x2, G.lift, 300 * quick);
      if (!alive) return;
      await setXY(s, x2, landY, 220 * quick, 'cubic-bezier(.5,0,.6,1.4)');
      d.classList.remove('up');
      d.style.zIndex = 10 + (n - s);
    }
    async function doMove(from, to, { count = true, quick = 1 } = {}) {
      const s = topOf(pos, from);
      const landY = topY(to, s);
      busy = true;
      await flyDisc(s, to, landY, quick);
      pos[s] = to;
      sfx('drop');
      if (count) {
        moves++;
        history.push([from, to]);
      }
      busy = false;
      updateMoves();
    }
    async function bounce(from, to) {
      const s = topOf(pos, from);
      const d = discs[s];
      busy = true;
      d.classList.add('up');
      d.style.zIndex = 100;
      const x2 = pegX(to) - discW(s) / 2;
      if (d._y > G.lift + 2 || Math.abs(d._x - x2) > 1) await setXY(s, x2, G.lift, 260);
      if (!alive) return;
      await setXY(s, x2, Math.min(topY(to) - G.dH * 0.35, G.lift + G.dH), 140);
      if (!alive) return;
      wiggle(s, 'shake');
      await setXY(s, x2, G.lift, 220, 'cubic-bezier(.3,1.6,.5,1)');
      if (!alive) return;
      await flyDisc(s, from, restY(s, from, levelOf(s)));
      busy = false;
    }

    async function attempt(from, to) {
      clearGlow();
      const s = topOf(pos, from);
      if (from === to) {
        busy = true;
        await flyDisc(s, from, restY(s, from, levelOf(s)));
        busy = false;
        return;
      }
      const t = topOf(pos, to);
      if (t >= 0 && t < s) {
        wrongStreak++;
        sfx('oops');
        await bounce(from, to);
        if (!alive) return;
        if (wrongStreak >= 2) showHint(true);
        else api.nudge(OOPS[(wrongStreak + rand(OOPS.length)) % OOPS.length]);
        return;
      }
      wrongStreak = 0;
      await doMove(from, to);
      if (!alive) return;
      if (pos.every((p) => p === goal)) roundDone();
    }

    function showHint(strong) {
      if (solved || demoing) return;
      clearGlow();
      const mv = planMoves(pos, goal)[0];
      if (!mv) return;
      const s = topOf(pos, mv[0]);
      discs[s].firstChild.classList.add('glow');
      zones[mv[1]].classList.add('glow');
      wiggle(s, 'hop');
      const text = `Try ${describe(mv)}.`;
      if (strong) api.nudge(text);
      else api.prompt(text);
    }

    async function roundDone() {
      solved = true;
      selected = -1;
      clearGlow();
      updateMoves(true);
      discs.forEach((d, s) => setTimeout(() => alive && wiggle(s, 'hop'), s * 120));
      api.cheer(pick(CHEERS));
      await sleep(2600);
      if (!alive) return;
      if (round + 1 < ROUNDS.length) startRound(round + 1);
      else api.finish();
    }

    // ---------- pointer handling: drag the top disc, or tap peg then tap peg ----------
    const colAt = (clientX) => {
      const r = board.getBoundingClientRect();
      return Math.max(0, Math.min(2, Math.floor((clientX - r.left) / (r.width / 3))));
    };
    board.addEventListener('pointerdown', (e) => {
      if (!alive || busy || demoing || solved || grab || (e.button != null && e.button > 0)) return;
      e.preventDefault();
      const c = colAt(e.clientX);
      try {
        board.setPointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
      if (selected >= 0) {
        grab = { tapTarget: true, c, id: e.pointerId };
        return;
      }
      const s = topOf(pos, c);
      if (s < 0) {
        grab = { empty: true, id: e.pointerId };
        return;
      }
      const r = board.getBoundingClientRect();
      const d = discs[s];
      grab = {
        s,
        c,
        id: e.pointerId,
        sx: e.clientX,
        sy: e.clientY,
        ox: e.clientX - r.left - d._x,
        oy: e.clientY - r.top - d._y,
        moved: false,
      };
    });
    board.addEventListener('pointermove', (e) => {
      if (!grab || grab.s == null || grab.id !== e.pointerId) return;
      if (!grab.moved && Math.abs(e.clientX - grab.sx) + Math.abs(e.clientY - grab.sy) < 8) return;
      if (!grab.moved) {
        grab.moved = true;
        clearGlow();
        discs[grab.s].classList.add('up');
        discs[grab.s].style.zIndex = 100;
        sfx('pop');
      }
      const r = board.getBoundingClientRect();
      setXY(grab.s, e.clientX - r.left - grab.ox, e.clientY - r.top - grab.oy);
      zones.forEach((z, p) => z.classList.toggle('sel', p === colAt(e.clientX)));
    });
    const release = (e, cancelled) => {
      if (!grab || grab.id !== e.pointerId) return;
      const g = grab;
      grab = null;
      try {
        board.releasePointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
      if (g.empty) {
        api.nudge('That peg is empty. Pick one with a pancake.');
        return;
      }
      if (g.tapTarget) {
        const from = selected;
        selected = -1;
        attempt(from, g.c);
        return;
      }
      const to = cancelled ? g.c : colAt(e.clientX);
      if (g.moved) {
        attempt(g.c, to);
        return;
      }
      // a tap: lift the pancake and wait for a second tap on a peg
      selected = g.c;
      sfx('pop');
      clearGlow();
      zones[g.c].classList.add('sel');
      const d = discs[g.s];
      d.classList.add('up');
      d.style.zIndex = 100;
      setXY(g.s, d._x, G.lift, 200);
    };
    board.addEventListener('pointerup', (e) => release(e, false));
    board.addEventListener('pointercancel', (e) => release(e, true));

    hintBtn.addEventListener('click', async () => {
      if (busy || demoing || solved) return;
      sfx('tap');
      if (selected >= 0) {
        const p = selected;
        selected = -1;
        await attempt(p, p);
        if (!alive) return;
      }
      showHint(false);
    });
    undoBtn.addEventListener('click', async () => {
      if (busy || demoing || solved || !history.length) return;
      sfx('tap');
      if (selected >= 0) {
        const p = selected;
        selected = -1;
        await attempt(p, p);
        if (!alive) return;
      }
      clearGlow();
      const [from, to] = history.pop();
      await doMove(to, from, { count: false });
      if (!alive) return;
      moves = Math.max(0, moves - 1);
      wrongStreak = 0;
      updateMoves();
    });

    function startRound(i) {
      api.stage(i, ROUNDS.length);
      buildRound(i);
      api.prompt(roundPrompt());
    }
    const roundPrompt = () => ROUND_PROMPT[round].replace('{B}', best);

    // ---------- demo: reset, then auto-solve with narration ----------
    const talk = (text, cap = 2600) => Promise.race([api.prompt(text), sleep(cap)]);
    api.setDemo(async () => {
      if (solved) return;
      demoing = true;
      while (busy && alive) await sleep(50);
      if (!alive) return;
      grab = null;
      selected = -1;
      clearGlow();
      // put the tower back at the start
      pos = startPos.slice();
      moves = 0;
      history = [];
      wrongStreak = 0;
      layout();
      updateMoves();
      await talk(
        ROUNDS[round].mixed
          ? 'Watch! Biggest pancake goes to the star first.'
          : 'Watch! One pancake at a time. Never big on small.',
        3200,
      );
      if (!alive) return;
      const plan = planMoves(pos, goal);
      for (const mv of plan) {
        if (!alive) return;
        const s = topOf(pos, mv[0]);
        const where = mv[1] === goal ? 'the star' : `the ${PEG_WORD[mv[1]]}`;
        api.prompt(`${SIZE_WORDS[n][s][0].toUpperCase() + SIZE_WORDS[n][s].slice(1)} pancake to ${where}.`);
        await sleep(450);
        if (!alive) return;
        await doMove(mv[0], mv[1]);
        if (!alive) return;
        await sleep(350);
      }
      if (!alive) return;
      updateMoves(true);
      await talk(`Done in ${plan.length} moves! Now you try.`, 3000);
      if (!alive) return;
      await sleep(600);
      if (!alive) return;
      // back to the start so the child can do it
      pos = startPos.slice();
      moves = 0;
      history = [];
      wrongStreak = 0;
      selected = -1;
      discs.forEach((d) => {
        d.style.transition = 'none';
      });
      layout();
      updateMoves();
      demoing = false;
      api.prompt(roundPrompt());
    });

    startRound(resumeRound(api, ROUNDS.length));
    if (typeof ResizeObserver !== 'undefined') {
      let last = 0;
      ro = new ResizeObserver(() => {
        const w = board.clientWidth;
        if (alive && w !== last && !busy) {
          last = w;
          layout();
        }
      });
      ro.observe(board);
    }
    return {
      destroy() {
        alive = false;
        try {
          ro?.disconnect();
        } catch {
          /* ignore */
        }
      },
    };
  },
};
