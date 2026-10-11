/**
 * Game: Number Path Race  (id: number-path-race, level 1)
 *
 * Idea: a straight numbered path is a number line you can walk on. Counting on from the square you stand on
 *   (not from 1) tells you where you land, and further along means a bigger number (dice chip races, Zvonkin Ch. 4).
 * Rounds (her token is the bunny; she taps one square per hop and each number is said aloud):
 *   1. Path 1–10, a die with 1–3 dots, bunny alone: roll, hop, reach 10.
 *   2. Path 1–10, normal die, bunny and owl take 3 turns each; then "Who is ahead? Which number is bigger?"
 *   3. Path 1–20, normal die, race the owl to 20.
 *   4. Path 1–20, bunny alone: after each roll she first taps where she will land, then hops to check.
 *   5. Empty 0–20 number line (only 0, 10, 20 marked): drag the flag to 3 numbers; within 1 counts as right,
 *      and the true spot is then shown.
 * Watch demo: restarts the round and plays it through (rolls, "I am on 4, I count on", predictions, the
 *   "bigger" answer, all three flags), then restarts the round for the child.
 * Notes:
 *   - Verified by brute force in Node over every reachable round-2 state (via the exported _test): the owl's
 *     rolls are always 1–6, never pass 10 and never end level with the bunny, so "which is bigger" always has
 *     exactly one answer. pickTargets() always gives 3 different numbers from 2–8 / 12–18, at least 3 apart, so
 *     the ±1 windows never touch 0, 10, 20 or each other. Landing = min(square + roll, end); in round 4 the die
 *     only offers faces that do not pass 20 (predictFaces), so the landing is always square + roll.
 *   - Round 5 reads the number under the flag's pole tip (15% of its width, bottom edge), not the pointer.
 *   - The path stays one straight row when squares can be ≥ 44 px (desktop: 20 squares ≈ 47 px); otherwise it
 *     wraps into rows of 10 or 5 that read left to right (phones: rows of 5, 64 px squares). See layout().
 *   - Test hooks (DOM only): wrap[data-phase] = roll | rolling | predict | hop | wait | owl | ask | done | place |
 *     check; squares .sq[data-n]; tokens .tok.me / .tok.owl; die .die[data-v]; round-2 answer chips .ask [data-n];
 *     round 5 .goal[data-target], .flag, .axis (0 at its left edge, 20 at its right edge).
 *   - `tok` is bumped on every round (re)start so stale async work (owl turns, demo, pauses) stops itself.
 */
import { h, sleep, pick, shuffle, range, sfx, resumeRound } from '../lib/core.js';

const ID = 'number-path-race';
const ME = '🐰';
const OWL = '🦉';
const D3 = [1, 2, 3];
const D6 = [1, 2, 3, 4, 5, 6];
const ROUNDS = [
  { kind: 'race', n: 10, faces: D3, prompt: 'Tap the die. Then hop one square at a time!' },
  { kind: 'race', n: 10, faces: D6, owl: true, turns: 3, ask: true, prompt: 'Race the owl! Three turns each.' },
  { kind: 'race', n: 20, faces: D6, owl: true, prompt: 'A long path to 20! Race the owl.' },
  { kind: 'race', n: 20, faces: D6, predict: true, prompt: 'Roll, then tap where you will land.' },
  { kind: 'line' },
];
const TALK = [
  ['Which number is just before 7?', 'How many more to get to 10?'],
  ['Who is ahead? How do you know?', 'How many squares is Owl behind?'],
  ['Who is closer to the end? How do you know?', 'Which number comes just after 13?'],
  ['How did you know where you would land?', 'If you roll 6, where will you be?'],
  ['Is 7 nearer to 0 or to 10?', 'Where would 5 go? Why there?'],
];
const PRAISE = ['Lovely hopping!', 'Good counting!', 'Yes!', 'Nice!'];
const LINE_MAX = 20;
const AXIS_L = 6; // the number-line axis runs from 6% to 94% of its box
const AXIS_W = 88;
const GAP = 3; // px between path squares
const S_MAX = 72; // largest square, px
const S_STRAIGHT = 44; // smallest square that keeps the whole path in one row
const S_WRAP_MIN = 52; // smallest square when the path wraps into rows

// ---------- pure helpers ----------
const landing = (pos, roll, end) => Math.min(pos + roll, end);
// Round 4 (predict): only faces that do not pass the end, so "you are on 17, you rolled 6" never happens.
const predictFaces = (pos, end, faces = D6) => faces.filter((f) => pos + f <= end);
// Round 2: the owl may reach at most 6, 8, then 10 after turns 1, 2, 3 and never ends level with the bunny.
function owlRollR2(owl, me, turn) {
  const top = [6, 8, 10][turn - 1];
  const opts = D6.filter((r) => owl + r <= top && (turn < 3 || owl + r !== me));
  return opts.length ? pick(opts) : 1;
}
// Round 5: one number from 2–8, one from 12–18, one more from either, all at least 3 apart.
function pickTargets() {
  const lo = range(7, 2);
  const hi = range(7, 12);
  const a = pick(lo);
  const b = pick(hi);
  const c = pick([...lo, ...hi].filter((x) => Math.abs(x - a) >= 3 && Math.abs(x - b) >= 3));
  return shuffle([a, b, c]);
}
const isClose = (v, t) => Math.abs(v - t) <= 1;
const pct = (v) => `${AXIS_L + (v / LINE_MAX) * AXIS_W}%`;

// ---------- drawings ----------
// Pip centres per face, as "x y" pairs on a 100 × 100 die.
const PIPS = {
  1: '50 50',
  2: '28 28,72 72',
  3: '28 28,50 50,72 72',
  4: '28 28,72 28,28 72,72 72',
  5: '28 28,72 28,50 50,28 72,72 72',
  6: '28 25,72 25,28 50,72 50,28 75,72 75',
};
const dieFace = (v) =>
  h(
    'svg',
    { viewBox: '0 0 100 100', 'aria-hidden': 'true' },
    h('rect', { class: 'df', x: 5, y: 5, width: 90, height: 90, rx: 18 }),
    v ? null : h('text', { class: 'q', x: 50, y: 68 }, '?'), // not rolled yet
    ...(PIPS[v] || '')
      .split(',')
      .filter(Boolean)
      .map((p) => h('circle', { class: 'pip', cx: p.split(' ')[0], cy: p.split(' ')[1], r: 9 })),
  );
// A flag whose pole bottom sits at 15% of its width (pins are shifted by that much).
const flagSvg = () =>
  h(
    'svg',
    { viewBox: '0 0 40 60', 'aria-hidden': 'true' },
    h('rect', { x: 4, y: 2, width: 4, height: 58, rx: 2, fill: '#2b2d42' }),
    h('polygon', { points: '8,4 37,14 8,25', fill: '#ef476f', stroke: '#2b2d42', 'stroke-width': 2 }),
  );

// ---------- styles ----------
const CSS = `
.a-${ID}{width:100%;max-width:1000px;display:flex;flex-direction:column;align-items:center;gap:14px}
.a-${ID} .board{width:100%;display:flex;flex-direction:column;align-items:center;gap:14px}
.a-${ID} .ctrl{display:flex;align-items:center;justify-content:center;gap:16px;flex-wrap:wrap}
.a-${ID} .start{min-width:96px;min-height:76px;border:3px dashed var(--ink);border-radius:18px;background:#fff;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:4px 8px;font-weight:800}
.a-${ID} .start .toks{font-size:1.9rem;min-height:1.2em;display:flex;gap:2px}
.a-${ID} .die{width:88px;height:88px;padding:0;border:none;background:none;cursor:pointer;border-radius:20px}
.a-${ID} .die svg{width:100%;height:100%;display:block}
.a-${ID} .die .df{fill:#fff;stroke:var(--ink);stroke-width:6}
.a-${ID} .die .pip{fill:var(--ink)}
.a-${ID} .die .q{fill:var(--line);font-size:52px;font-weight:800;text-anchor:middle}
.a-${ID} .die:disabled{cursor:default}
.a-${ID} .die:not(:disabled){animation:a-npr-ask 1.6s ease-in-out infinite}
.a-${ID} .die.rolling{animation:a-npr-wob .2s linear infinite}
.a-${ID} .hops{display:flex;gap:6px;min-width:60px;min-height:28px;align-items:center;flex-wrap:wrap;max-width:110px}
.a-${ID} .hops i{width:22px;height:22px;border-radius:50%;border:3px solid var(--ink);background:#fff}
.a-${ID} .hops i.on{background:var(--green)}
.a-${ID} .path{display:grid;gap:${GAP}px;justify-content:center;--s:56px}
.a-${ID} .sq{position:relative;width:var(--s);height:calc(var(--s) * 1.45);padding:2px 0 0;margin:0;border:3px solid var(--ink);border-radius:12px;background:#fff3c4;color:var(--ink);font:inherit;display:flex;flex-direction:column;align-items:center;gap:2px;cursor:pointer;touch-action:manipulation}
.a-${ID} .sq.g1{background:#d3f0fb}
.a-${ID} .sq.end{background:#c9f5e6}
.a-${ID} .sq .num{font-weight:800;font-size:calc(var(--s) * .42);line-height:1.1}
.a-${ID} .sq .toks{display:flex;font-size:calc(var(--s) * .4);line-height:1}
.a-${ID} .sq.aim{outline:4px dashed var(--orange);outline-offset:-8px}
.a-${ID} .glow{background:var(--yellow) !important;box-shadow:0 0 0 5px rgba(255,209,102,.9)}
.a-${ID} .tok{display:inline-block}
.a-${ID} .actions{min-height:64px}
.a-${ID} .actions .btn{min-height:56px;font-size:1.1rem}
.a-${ID} .ask .chip{min-width:120px;padding:0 14px;font-size:1.8rem;font-weight:800;gap:.3em;display:inline-flex}
.a-${ID} .goal{min-width:110px;min-height:76px;padding:0 18px;display:grid;place-items:center;background:#fff;border:3px solid var(--ink);border-radius:18px;font-size:2.6rem;font-weight:800}
.a-${ID} .home{width:84px;height:84px;border:3px dashed var(--ink);border-radius:18px;background:#fff;display:grid;place-items:center}
.a-${ID} .flag{width:56px;height:76px;padding:0;border:none;background:none;cursor:grab;touch-action:none;position:relative;z-index:5}
.a-${ID} .flag svg,.a-${ID} .pin svg{width:100%;height:100%;display:block;pointer-events:none}
.a-${ID} .nl{position:relative;width:100%;height:150px;background:#fff;border:3px solid var(--ink);border-radius:22px;cursor:pointer;touch-action:manipulation;overflow:hidden}
.a-${ID} .axis{position:absolute;left:${AXIS_L}%;right:${100 - AXIS_L - AXIS_W}%;top:80px;height:6px;margin-top:-3px;background:var(--ink);border-radius:3px}
.a-${ID} .mark{position:absolute;top:64px;width:4px;height:32px;margin-left:-2px;background:var(--ink);border-radius:2px;pointer-events:none}
.a-${ID} .mark span{position:absolute;top:36px;left:50%;transform:translateX(-50%);font-weight:800;font-size:1.4rem}
.a-${ID} .mark.help{top:70px;height:20px;background:var(--purple)}
.a-${ID} .mark.help span{top:24px;color:var(--purple);font-size:1.1rem}
.a-${ID} .zone{position:absolute;top:58px;height:44px;border-radius:10px;background:rgba(255,209,102,.7);pointer-events:none}
.a-${ID} .pin{position:absolute;top:20px;width:40px;height:60px;transform:translateX(-15%);pointer-events:none}
.a-${ID} .pin.try{opacity:.55}
.a-${ID} .truth{position:absolute;top:70px;width:20px;height:20px;margin-left:-10px;border-radius:50%;background:var(--green);border:3px solid var(--ink);pointer-events:none}
.a-${ID} .truth span{position:absolute;bottom:22px;left:50%;transform:translateX(-50%);font-weight:800;font-size:1.3rem;background:#fff;border-radius:8px;padding:0 3px}
@keyframes a-npr-ask{50%{box-shadow:0 0 0 7px rgba(76,201,240,.55)}}
@keyframes a-npr-wob{25%{transform:rotate(-12deg)}75%{transform:rotate(12deg)}}
`;

export default {
  id: ID,
  rounds: ROUNDS.length,
  parentNote:
    'A straight numbered path works like a number line: she hops one square per dot and says each number, counting on from the square she is on rather than starting again at 1. Ask who is ahead and how she knows; further along the path means a bigger number. In the last round there is no path to count, so she places numbers on an empty 0–20 line by thinking "less than 10" or "nearly 20".',
  talkPrompts: [
    'Which number is just before 7?',
    'How many more to get to 10?',
    'Who is closer to the end? How do you know?',
  ],

  async start(api) {
    let alive = true;
    let round = resumeRound(api, ROUNDS.length);
    let tok = 0;
    let st = null; // state of the current round (see startRound)
    api.css(CSS);

    const wrap = h('div', { class: `a-${ID}` });
    const board = h('div', { class: 'board' });
    const actions = h('div', { class: 'act-row actions' });
    const nextBtn = h('button', { class: 'btn primary next', type: 'button', onclick: () => next() }, 'Next ▶');
    wrap.append(board, actions);
    api.root.append(wrap);

    const live = (t) => alive && t === tok;
    const setPhase = (p) => {
      st.phase = p;
      wrap.dataset.phase = p;
    };
    const unglow = () => wrap.querySelectorAll('.glow').forEach((e) => e.classList.remove('glow'));
    const restart = (el, cls) => {
      el.classList.remove(cls);
      void el.offsetWidth;
      el.classList.add(cls);
    };
    const narr = async (txt, ms = 300) => {
      await Promise.race([api.prompt(txt), sleep(2600)]);
      await sleep(ms);
    };

    // ---------- path rounds ----------
    function buildRace(r) {
      const sq = range(r.n, 1).map((n) =>
        h(
          'button',
          {
            class: `sq g${Math.floor((n - 1) / 5) % 2}${n === r.n ? ' end' : ''}`,
            type: 'button',
            'data-n': n,
            'aria-label': `Square ${n}`,
            onclick: () => tapSquare(n),
          },
          h('span', { class: 'num' }, String(n)),
          h('span', { class: 'toks' }),
        ),
      );
      const path = h('div', { class: 'path' }, sq);
      const start = h('div', { class: 'start' }, h('span', {}, 'Start'), h('span', { class: 'toks' }));
      const die = h('button', { class: 'die', type: 'button', 'aria-label': 'Roll the die', onclick: () => myRoll() });
      die.append(dieFace(0));
      const hops = h('div', { class: 'hops', 'aria-hidden': 'true' });
      const me = h('span', { class: 'tok me', 'aria-hidden': 'true' }, ME);
      const owl = r.owl ? h('span', { class: 'tok owl', 'aria-hidden': 'true' }, OWL) : null;
      board.replaceChildren(h('div', { class: 'ctrl' }, start, die, hops), path);
      return { sq, path, start, die, hops, me, owl };
    }

    // One straight row if the squares can be ≥ S_STRAIGHT px, else rows of 10 or 5 (read left to right).
    function layout() {
      if (!st || st.r.kind !== 'race') return;
      const n = st.r.n;
      const W = Math.max(280, wrap.clientWidth);
      const fit = (cols) => Math.floor((W - (cols - 1) * GAP) / cols);
      const cols = fit(n) >= S_STRAIGHT ? n : [10, 5].find((c) => c < n && fit(c) >= S_WRAP_MIN) || 5;
      st.path.style.setProperty('--s', `${Math.min(S_MAX, fit(cols))}px`);
      st.path.style.gridTemplateColumns = `repeat(${cols}, var(--s))`;
    }
    const onResize = () => layout();
    window.addEventListener('resize', onResize);

    function put(tokEl, p) {
      (p === 0 ? st.start : st.sq[p - 1]).querySelector('.toks').append(tokEl);
      restart(tokEl, 'hop');
    }
    function showHops() {
      st.hops.replaceChildren(...range(st.total).map((i) => h('i', { class: i < st.total - st.left ? 'on' : '' })));
    }

    async function spin(t, value) {
      st.die.disabled = true;
      st.die.classList.add('rolling');
      sfx('tap');
      for (let i = 0; i < 6; i++) {
        st.die.replaceChildren(dieFace(pick(st.r.faces)));
        await sleep(75);
        if (!live(t)) return 0;
      }
      st.die.replaceChildren(dieFace(value));
      st.die.dataset.v = value;
      st.die.classList.remove('rolling');
      sfx('drop');
      return value;
    }

    async function myRoll() {
      if (st.phase !== 'roll') return;
      const t = tok;
      unglow();
      setPhase('rolling');
      st.miss = 0;
      st.turn += 1;
      // Round 4 never rolls past the end, so the landing square is always pos + roll.
      const faces = st.r.predict ? predictFaces(st.pos, st.r.n, st.r.faces) : st.r.faces;
      const v = await spin(t, pick(faces));
      if (!live(t)) return;
      const end = landing(st.pos, v, st.r.n);
      st.left = st.total = end - st.pos;
      showHops();
      if (st.r.predict) {
        setPhase('predict');
        api.prompt(
          st.pos
            ? `You rolled ${v}. You are on ${st.pos}. Where will you land?`
            : `You rolled ${v}. Where will you land?`,
        );
      } else {
        setPhase('hop');
        if (st.left < v) api.prompt(`You rolled ${v}. Only ${st.left} more to ${st.r.n}!`);
        else api.prompt(st.pos ? `You rolled ${v}. You are on ${st.pos}. Count on!` : `You rolled ${v}. Hop ${v}!`);
      }
    }

    function tapSquare(n) {
      if (!st || st.r.kind !== 'race') return;
      const el = st.sq[n - 1];
      if (st.phase === 'roll') {
        st.miss += 1;
        restart(el, 'shake');
        if (st.miss >= 2) st.die.classList.add('glow');
        api.nudge('Tap the die first!');
      } else if (st.phase === 'predict') predict(n, el);
      else if (st.phase === 'hop') {
        if (n === st.pos + 1) hopTo(n);
        else if (n === st.pos) api.say(`You are on ${n}.`);
        else {
          st.miss += 1;
          restart(el, 'shake');
          if (st.miss >= 2) {
            st.sq[st.pos].classList.add('glow');
            api.nudge(`Next comes ${st.pos + 1}. Tap it!`);
          } else api.nudge(st.pos ? `One square at a time. You are on ${st.pos}.` : 'Start with square 1.');
        }
      }
    }

    function predict(n, el) {
      const land = st.pos + st.left;
      if (n === land) {
        st.miss = 0;
        unglow();
        el.classList.add('aim');
        setPhase('hop');
        api.cheer(`Good thinking! Now hop to check.`);
        return;
      }
      st.miss += 1;
      restart(el, 'shake');
      if (st.miss >= 2) {
        st.sq[land - 1].classList.add('glow');
        api.nudge(`${st.pos} and ${st.left} more. Count on in your head.`);
      } else
        api.nudge(
          st.pos ? `Start at ${st.pos}. Count on ${st.left} more.` : `Count ${st.left} squares from the start.`,
        );
    }

    function hopTo(n) {
      st.miss = 0;
      unglow();
      st.pos = n;
      st.left -= 1;
      put(st.me, n);
      sfx('tick');
      api.say(String(n));
      showHops();
      if (st.left === 0) endTurn();
    }

    async function endTurn() {
      const t = tok;
      const r = st.r;
      setPhase('wait');
      await sleep(450);
      if (!live(t)) return;
      const aim = wrap.querySelector('.sq.aim');
      aim?.classList.remove('aim');
      if (st.pos === r.n)
        return r.ask ? ask() : won(pick([`You reached ${r.n}!`, `Hooray, ${r.n}! The end of the path!`]));
      api.cheer(aim ? `Yes, ${st.pos}! Just as you said.` : `${pick(PRAISE)} You are on ${st.pos}.`);
      if (r.owl) {
        await sleep(900);
        if (!live(t)) return;
        await owlTurn(t);
        if (!live(t)) return;
        if (st.owlPos === r.n && !r.ask) return won('What a race! Owl just made it.');
      }
      if (r.ask && (st.turn >= r.turns || st.owlPos === r.n)) return ask();
      setPhase('roll');
      st.die.disabled = false;
      if (r.owl) api.prompt('Your turn. Tap the die!');
    }

    async function owlTurn(t) {
      setPhase('owl');
      st.hops.replaceChildren();
      await narr("Owl's turn.", 100);
      if (!live(t)) return;
      const r = st.r;
      const v = await spin(t, r.ask ? owlRollR2(st.owlPos, st.pos, st.turn) : pick(r.faces));
      if (!live(t)) return;
      const end = landing(st.owlPos, v, r.n);
      api.prompt(st.owlPos ? `Owl rolled ${v}. Owl is on ${st.owlPos}…` : `Owl rolled ${v}.`);
      await sleep(800);
      for (let p = st.owlPos + 1; p <= end; p++) {
        if (!live(t)) return;
        st.owlPos = p;
        put(st.owl, p);
        sfx('tick');
        api.say(String(p));
        await sleep(600);
      }
    }

    function ask() {
      setPhase('ask');
      st.die.disabled = true;
      st.hops.replaceChildren();
      api.prompt('Who is ahead? Which number is bigger?');
      const opts = shuffle([
        [ME, st.pos],
        [OWL, st.owlPos],
      ]);
      actions.replaceChildren(
        h(
          'div',
          { class: 'act-row ask' },
          opts.map(([who, n]) => {
            const b = h(
              'button',
              { class: 'chip', type: 'button', 'data-n': n, 'aria-label': String(n) },
              `${who} ${n}`,
            );
            b.addEventListener('click', () => answer(n, b));
            return b;
          }),
        ),
      );
    }

    function answer(n, btn) {
      if (st.phase !== 'ask') return;
      const hi = Math.max(st.pos, st.owlPos);
      const lo = Math.min(st.pos, st.owlPos);
      if (n === hi) {
        unglow();
        setPhase('done');
        api.cheer(`Yes! ${hi} is bigger than ${lo}. ${hi === st.pos ? 'You are' : 'Owl is'} ahead!`);
        showNext();
        return;
      }
      st.miss += 1;
      restart(btn, 'shake');
      if (st.miss >= 2) {
        actions.querySelector(`[data-n="${hi}"]`).classList.add('glow');
        st.sq[hi - 1].classList.add('glow');
        api.nudge(`Look: ${hi} comes later on the path.`);
      } else api.nudge('Look at the path. Who is further along?');
    }

    function won(text) {
      setPhase('done');
      st.die.disabled = true;
      api.cheer(text);
      showNext();
    }

    // ---------- round 5: empty number line ----------
    function buildLine() {
      const goal = h('div', { class: 'goal', 'aria-live': 'polite' });
      const flag = h('button', { class: 'flag', type: 'button', 'aria-label': 'Flag. Drag it onto the line.' });
      flag.append(flagSvg());
      const axis = h('div', { class: 'axis' });
      const zone = h('div', { class: 'zone', hidden: true });
      const helps = [5, 15].map((v) =>
        h('div', { class: 'mark help', hidden: true, style: { left: pct(v) } }, h('span', {}, String(v))),
      );
      const marks = [0, 10, 20].map((v) =>
        h('div', { class: 'mark', style: { left: pct(v) } }, h('span', {}, String(v))),
      );
      const nl = h(
        'div',
        { class: 'nl', role: 'img', 'aria-label': 'Number line from 0 to 20' },
        axis,
        zone,
        marks,
        helps,
      );
      nl.addEventListener('click', (e) => place(valueAt(e.clientX, e.clientY)));
      board.replaceChildren(h('div', { class: 'ctrl' }, goal, h('div', { class: 'home' }, flag)), nl);
      dragFlag(flag);
      return { goal, flag, axis, zone, helps, nl };
    }

    // Whole number under a point on the line, or null when the point is not near the line.
    function valueAt(x, y) {
      const a = st.axis.getBoundingClientRect();
      const b = st.nl.getBoundingClientRect();
      if (y < b.top - 40 || y > b.bottom + 40 || x < a.left - 30 || x > a.right + 30) return null;
      return Math.max(0, Math.min(LINE_MAX, Math.round(((x - a.left) / a.width) * LINE_MAX)));
    }

    // The flag follows the pointer; on release the number under its pole tip (15% of its width, bottom edge) is
    // used, not the pointer, so a careful placement counts wherever she grabbed the flag.
    function dragFlag(flag) {
      let from = null;
      flag.addEventListener('pointerdown', (e) => {
        if (st.phase !== 'place') return;
        e.preventDefault();
        from = { x: e.clientX, y: e.clientY };
        flag.setPointerCapture?.(e.pointerId);
        flag.classList.add('dragging');
        flag.style.transition = 'none';
      });
      flag.addEventListener('pointermove', (e) => {
        if (from) flag.style.transform = `translate(${e.clientX - from.x}px, ${e.clientY - from.y}px) scale(1.1)`;
      });
      const up = (e) => {
        if (!from) return;
        from = null;
        const f = flag.getBoundingClientRect();
        const v = valueAt(f.left + f.width * 0.15, f.bottom);
        flag.classList.remove('dragging');
        flag.style.transition = 'transform .25s';
        flag.style.transform = '';
        place(v);
      };
      flag.addEventListener('pointerup', up);
      flag.addEventListener('pointercancel', up);
    }

    function nextTarget() {
      const t = st.targets[st.idx];
      st.goal.textContent = String(t);
      st.goal.dataset.target = t;
      st.miss = 0;
      setPhase('place');
      api.prompt(`Where does ${t} live? Drag the flag.`);
    }

    async function place(v) {
      if (st.phase !== 'place' || v == null) return;
      const t = tok;
      const goal = st.targets[st.idx];
      setPhase('check');
      const pin = h('div', { class: 'pin', style: { left: pct(v) } });
      pin.append(flagSvg());
      st.nl.append(pin);
      sfx('drop');
      if (isClose(v, goal)) {
        unglow();
        st.zone.hidden = true;
        st.helps.forEach((m) => (m.hidden = true));
        st.nl.append(h('div', { class: 'truth', style: { left: pct(goal) } }, h('span', {}, String(goal))));
        api.cheer(v === goal ? `Spot on! ${goal} lives right here.` : `So close! ${goal} is right here.`);
        await sleep(1500);
        if (!live(t)) return;
        pin.remove();
        st.idx += 1;
        if (st.idx < st.targets.length) nextTarget();
        else {
          setPhase('done');
          api.cheer('All three numbers found their places!');
          showNext();
        }
        return;
      }
      st.miss += 1;
      pin.classList.add('try');
      api.nudge(v > goal ? `A bit too far. ${goal} comes before ${v}.` : `Not far enough. ${goal} comes after ${v}.`);
      if (st.miss >= 2) {
        // Stronger hint: show the halfway marks 5 and 15 and glow the right stretch of line.
        st.helps.forEach((m) => (m.hidden = false));
        Object.assign(st.zone.style, { left: pct(goal - 1), width: `${(2 / LINE_MAX) * AXIS_W}%` });
        st.zone.hidden = false;
        st.zone.classList.add('glow');
      }
      await sleep(900);
      if (!live(t)) return;
      pin.remove();
      setPhase('place');
    }

    // ---------- rounds ----------
    function showNext() {
      nextBtn.textContent = round < ROUNDS.length - 1 ? 'Next ▶' : 'Finish ⭐';
      actions.replaceChildren(nextBtn);
    }
    function next() {
      sfx('tap');
      if (round < ROUNDS.length - 1) startRound(round + 1);
      else api.finish();
    }

    function startRound(i) {
      tok += 1;
      round = i;
      api.stage(i, ROUNDS.length);
      api.setTalk(TALK[i]);
      actions.replaceChildren();
      const r = ROUNDS[i];
      st = { r, phase: '', miss: 0 };
      if (r.kind === 'race') {
        Object.assign(st, buildRace(r), { pos: 0, owlPos: 0, turn: 0, left: 0, total: 0 });
        put(st.me, 0);
        if (st.owl) put(st.owl, 0);
        layout();
        setPhase('roll');
        api.prompt(r.prompt);
      } else {
        Object.assign(st, buildLine(), { targets: pickTargets(), idx: 0 });
        nextTarget();
      }
    }

    // ---------- watch demo ----------
    // Restart the round, play it through with the real handlers, then restart it for the child.
    async function demoRace(t) {
      const ok = () => live(t);
      while (ok()) {
        const p = st.phase;
        if (p === 'roll') {
          await narr('I tap the die.', 100);
          if (ok()) await myRoll();
        } else if (p === 'predict') {
          const land = st.pos + st.left;
          st.sq[land - 1].classList.add('glow');
          await narr(
            st.pos ? `I am on ${st.pos}. ${st.left} more is ${land}.` : `${st.left} from the start is ${land}.`,
          );
          if (ok()) predict(land, st.sq[land - 1]);
          await sleep(500);
        } else if (p === 'hop') {
          if (st.pos) await narr(`I am on ${st.pos}. I count on.`, 100);
          while (ok() && st.phase === 'hop') {
            tapSquare(st.pos + 1);
            await sleep(650);
          }
        } else if (p === 'ask') {
          const hi = Math.max(st.pos, st.owlPos);
          actions.querySelector(`[data-n="${hi}"]`)?.classList.add('glow');
          await narr(`${hi} is further along the path. ${hi} is bigger!`, 1200);
          return;
        } else if (p === 'done') {
          await sleep(1500);
          return;
        } else await sleep(120); // rolling, wait or owl: let it play
      }
    }
    async function demoLine(t) {
      while (live(t) && st.phase === 'place') {
        const goal = st.targets[st.idx];
        await narr(
          goal < 10 ? `${goal} is less than 10. It goes before 10.` : `${goal} is more than 10. It goes after 10.`,
        );
        if (!live(t)) return;
        const a = st.axis.getBoundingClientRect();
        const f = st.flag.getBoundingClientRect();
        const x = a.left + (goal / LINE_MAX) * a.width;
        st.flag.style.transition = 'transform .8s ease-in-out';
        st.flag.style.transform = `translate(${x - (f.left + f.width * 0.15)}px, ${a.top - f.bottom}px)`;
        await sleep(850);
        if (!live(t)) return;
        st.flag.style.transition = 'none';
        st.flag.style.transform = '';
        await place(goal);
      }
      if (live(t)) await sleep(1200);
    }
    api.setDemo(async () => {
      startRound(round);
      const t = tok;
      await (st.r.kind === 'race' ? demoRace(t) : demoLine(t));
      if (live(t)) startRound(round);
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

// Pure helpers for a Node brute-force check (not used by the app).
export const _test = { landing, predictFaces, owlRollR2, pickTargets, isClose, ROUNDS };
