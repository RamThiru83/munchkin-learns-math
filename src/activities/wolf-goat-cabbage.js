/**
 * Game: Wolf, Goat and Cabbage  (id: wolf-goat-cabbage, level 5)
 *
 * Idea: river-crossing planning puzzles; the key insight is that a good plan can include going backwards
 * (bringing a passenger back). Classic puzzle tradition (Alcuin's river crossings).
 * Rounds:
 *   1. No farmer: two kids or one grown-up (Grandma/Grandpa, weight 2) fit in the boat; get all three across.
 *   2. Farmer + one passenger: goat and cabbage must not be left alone together.
 *   3. The classic: wolf, goat, cabbage; wolf-goat and goat-cabbage must not be left alone (7 crossings).
 *   4. Bigger boat (farmer + two): wolf, goat, cabbage plus flowers or apples, which the goat also eats.
 *   5. Bigger boat, five passengers: wolf/goat/cabbage plus a second chasing pair (cat/mouse or fox/hen).
 * Watch demo: replays the current round from the start, sailing the BFS-shortest solution with a spoken
 *   line per crossing, then resets the round for the child.
 * Notes:
 *   - Each round randomly mirrors the banks (R.flip) and shuffles the passenger order on the bank (R.order);
 *     round 1 kids, the grown-up, the round-4 treat and the round-5 pair are also picked at random per visit.
 *   - Passengers move by drag (onto the boat/river or back to the boat's bank) or by tap/keyboard click.
 *     Moves are animated with flipAll() (FLIP), which also resets drag()'s _dragBase/_dragPos internals.
 *   - Leaving a bad pair alone is allowed: the pair wobbles, a bubble shows, and Sail is locked until Undo.
 *   - Hints: Hint taps 1-2 only ask a question; the move glows after MISSES_FOR_HINT misses or a 3rd tap.
 *   - No exported test hooks. Verified shortest solutions (Node BFS with solve()): rounds 1-5 take
 *     5, 3, 7, 5, 5 crossings for every random variant.
 */
import { h, sleep, shuffle, pick, drag, sfx, resumeRound } from '../lib/core.js';

const ID = 'wolf-goat-cabbage';
const SAIL_MS = 950;
const ROUND_COUNT = 5; // length of buildRounds()
const MISSES_FOR_HINT = 2; // misses in a row before the next move glows by itself

const ANIMALS = {
  wolf: { id: 'wolf', e: '🐺', w: 1, name: 'wolf' },
  goat: { id: 'goat', e: '🐐', w: 1, name: 'goat' },
  cabbage: { id: 'cabbage', e: '🥬', w: 1, name: 'cabbage' },
};
// Round 4: the goat has three things it must not be left with (plus a bigger boat).
const TREATS = [
  { id: 'flowers', e: '🌷', w: 1, name: 'flowers' },
  { id: 'apples', e: '🍎', w: 1, name: 'apples' },
];
// Round 5: a second, separate chasing pair joins the trio.
const PAIRS = [
  [
    { id: 'cat', e: '🐱', w: 1, name: 'cat' },
    { id: 'mouse', e: '🐭', w: 1, name: 'mouse' },
  ],
  [
    { id: 'fox', e: '🦊', w: 1, name: 'fox' },
    { id: 'hen', e: '🐔', w: 1, name: 'hen' },
  ],
];
const MISCHIEF = {
  'wolf,goat': { pic: '🐺💨🐐', say: 'Oh no, the wolf chases the goat! Tap Undo.' },
  'goat,cabbage': { pic: '🐐😋🥬', say: 'Oops, the goat nibbles the cabbage! Tap Undo.' },
  'goat,flowers': { pic: '🐐😋🌷', say: 'Oops, the goat munches the flowers! Tap Undo.' },
  'goat,apples': { pic: '🐐😋🍎', say: 'Oops, the goat munches the apples! Tap Undo.' },
  'cat,mouse': { pic: '🐱💨🐭', say: 'Oh no, the cat chases the mouse! Tap Undo.' },
  'fox,hen': { pic: '🦊💨🐔', say: 'Oh no, the fox chases the hen! Tap Undo.' },
};

// Round data. The random picks (kid emojis, grown-up, round-4 treat, round-5 pair) are made in start()
// so every visit varies; this function only assembles them. Must return ROUND_COUNT rounds.
function buildRounds({ kids, elderE, elderName, treat, chaser, runner }) {
  return [
    {
      farmer: false,
      cap: 2,
      bad: [],
      prompt: 'Two kids or one grown-up fit. Get everyone across!',
      items: [
        { id: 'kid1', e: kids[0], w: 1, cls: 'kid', name: 'kid', label: 'kid' },
        { id: 'kid2', e: kids[1], w: 1, cls: 'kid', name: 'kid', label: 'kid' },
        { id: 'big', e: elderE, w: 2, cls: 'big', name: elderName, label: elderName },
      ],
    },
    {
      farmer: true,
      cap: 1,
      bad: [['goat', 'cabbage']],
      prompt: 'Take the goat and cabbage across. Never leave them alone!',
      items: [ANIMALS.goat, ANIMALS.cabbage],
    },
    {
      farmer: true,
      cap: 1,
      bad: [
        ['wolf', 'goat'],
        ['goat', 'cabbage'],
      ],
      prompt: 'The wolf chases the goat. Get all three across!',
      items: [ANIMALS.wolf, ANIMALS.goat, ANIMALS.cabbage],
    },
    {
      farmer: true,
      cap: 2,
      bad: [
        ['wolf', 'goat'],
        ['goat', 'cabbage'],
        ['goat', treat.id],
      ],
      prompt: 'Bigger boat! The farmer takes two. Mind the goat!',
      items: [ANIMALS.wolf, ANIMALS.goat, ANIMALS.cabbage, treat],
    },
    {
      farmer: true,
      cap: 2,
      bad: [
        ['wolf', 'goat'],
        ['goat', 'cabbage'],
        [chaser.id, runner.id],
      ],
      prompt: `Five friends! Watch the goat and the ${chaser.name}.`,
      items: [ANIMALS.wolf, ANIMALS.goat, ANIMALS.cabbage, chaser, runner],
    },
  ];
}

// --- logic --- (pure: no DOM). A state is { side: {id: 0|1}, boat: 0|1 }; 0 = start bank, 1 = goal bank.
function stateKey(s) {
  return (
    Object.keys(s.side)
      .sort()
      .map((k) => k + s.side[k])
      .join(',') +
    '|' +
    s.boat
  );
}
function cloneState(s) {
  return { side: { ...s.side }, boat: s.boat };
}
// The pair that gets into mischief when left without the farmer, or null.
function trouble(R, s) {
  if (!R.farmer) return null;
  for (const [a, b] of R.bad) if (s.side[a] === s.side[b] && s.side[a] !== s.boat) return [a, b];
  return null;
}
function isGoal(R, s) {
  return R.items.every((it) => s.side[it.id] === 1);
}
function movesFrom(R, s) {
  const here = R.items.filter((it) => s.side[it.id] === s.boat);
  const out = [];
  for (let m = 0; m < 1 << here.length; m++) {
    const sub = here.filter((_, i) => (m >> i) & 1);
    if (sub.reduce((a, it) => a + it.w, 0) > R.cap) continue;
    if (!R.farmer && !sub.length) continue; // without a farmer somebody must row
    out.push(sub.map((it) => it.id));
  }
  return out;
}
function applyMove(s, ids) {
  const n = { side: { ...s.side }, boat: 1 - s.boat };
  ids.forEach((id) => {
    n.side[id] = n.boat;
  });
  return n;
}
// Shortest list of moves (each a list of passenger ids) from s to the goal, or null.
function solve(R, s) {
  if (isGoal(R, s)) return [];
  const seen = new Set([stateKey(s)]);
  const q = [[s, []]];
  while (q.length) {
    const [c, path] = q.shift();
    for (const m of movesFrom(R, c)) {
      const n = applyMove(c, m);
      if (trouble(R, n)) continue;
      const k = stateKey(n);
      if (seen.has(k)) continue;
      seen.add(k);
      const p = [...path, m];
      if (isGoal(R, n)) return p;
      q.push([n, p]);
    }
  }
  return null;
}
// --- end logic ---

// Scoped CSS; P is the '.a-wolf-goat-cabbage' prefix. Under 600px the scene stacks banks above/below the river.
const CSS = (P) => `
${P}{width:100%;max-width:880px;display:flex;flex-direction:column;align-items:center;gap:12px;margin:auto 0}
${P} .scene{width:100%;display:flex;align-items:stretch;min-height:280px;border:3px solid #2b2d42;border-radius:22px;overflow:hidden;background:#5bc0eb}
${P} .bank{position:relative;flex:0 0 96px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;padding:34px 6px 12px;background:linear-gradient(160deg,#a7e889,#6cc04a)}
${P} .bank.goal{background:linear-gradient(200deg,#b9ef9d,#7acb57)}
${P} .deco{position:absolute;top:4px;left:6px;font-size:1.35rem;pointer-events:none;line-height:1}
${P} .river{position:relative;flex:1;min-width:0;background-color:#5bc0eb;background-image:radial-gradient(ellipse 14px 4px at 50% 50%,rgba(255,255,255,.55) 0 60%,transparent 70%);background-size:60px 34px;animation:wgc-flow 7s linear infinite}
@keyframes wgc-flow{to{background-position:0 340px}}
${P} .boat{position:absolute;width:150px;height:84px;top:50%;left:8px;margin-top:-42px;transition:left ${SAIL_MS}ms ease-in-out,top ${SAIL_MS}ms ease-in-out}
${P} .boat.at-b{left:calc(100% - 158px)}
${P} .boat.wide{width:206px}
${P} .boat.wide.at-b{left:calc(100% - 214px)}
${P} .scene.many .bank{flex-basis:144px;flex-direction:row;flex-wrap:wrap;align-content:center}
${P} .hull{width:100%;height:100%;display:flex;align-items:center;justify-content:center;gap:4px;padding:4px;background:#c98a4b;border:3px solid #2b2d42;border-radius:12px 12px 52px 52px;box-shadow:inset 0 -10px 0 #a86d34}
${P} .boat.sailing .hull{animation:wgc-rock .45s ease-in-out infinite alternate}
@keyframes wgc-rock{from{rotate:-3deg}to{rotate:3deg}}
${P} .who{position:relative;width:60px;height:60px;flex:0 0 auto;border:3px solid #2b2d42;border-radius:18px;background:#fff;font-size:2.1rem;line-height:1;display:grid;place-items:center;padding:0;cursor:pointer;box-shadow:0 3px 0 rgba(43,45,66,.18)}
${P} .who.kid{font-size:1.6rem}
${P} .who.big{width:72px;height:72px;font-size:2.8rem}
${P} .farmer{order:-1;width:50px;height:58px;font-size:2.3rem;line-height:1;display:grid;place-items:center}
${P} .glow{box-shadow:0 0 0 6px #ffd166,0 0 18px 6px rgba(255,209,102,.9)!important;animation:wgc-glow 1s ease-in-out infinite alternate}
@keyframes wgc-glow{to{box-shadow:0 0 0 3px #ffd166,0 0 6px 2px rgba(255,209,102,.6)}}
${P} .trouble{animation:wgc-wob .5s ease-in-out infinite}
${P} .nope{animation:wgc-wob .4s ease-in-out 1}
@keyframes wgc-wob{0%,100%{rotate:0deg}25%{rotate:-12deg}75%{rotate:12deg}}
${P} .bubble{position:absolute;z-index:5;top:2px;left:50%;translate:-50% 0;white-space:nowrap;background:#fff;border:3px solid #2b2d42;border-radius:16px;padding:2px 6px;font-size:1.15rem;line-height:1.3;pointer-events:none;animation:wgc-bob .6s ease-in-out infinite alternate}
@keyframes wgc-bob{to{translate:-50% -4px}}
${P} .ctrl{display:flex;flex-wrap:wrap;gap:10px;justify-content:center}
${P} .ctrl .btn{min-height:56px;min-width:56px;font-size:1.1rem}
${P} .rules{display:flex;flex-wrap:wrap;gap:8px;justify-content:center;align-items:center;font-weight:800;font-size:1rem}
${P} .pair{background:#fff;border:2px dashed #2b2d42;border-radius:14px;padding:2px 10px;font-size:1.5rem;line-height:1.4}
@media (max-width:600px){
  ${P} .scene{flex-direction:column;min-height:0}
  ${P} .bank{flex:0 0 auto;min-height:90px;flex-direction:row;flex-wrap:wrap;padding:8px 8px 8px 36px}
  ${P} .river{flex:0 0 176px;animation-name:wgc-flow-x}
  ${P} .ctrl{gap:8px}
  ${P} .ctrl .btn{padding:.4em .75em;font-size:1rem}
  ${P} .boat{left:50%;margin-left:-75px;top:8px;margin-top:0}
  ${P} .boat.at-b{left:50%;top:calc(100% - 92px)}
  ${P} .scene.many .bank{flex:0 0 auto}
  ${P} .boat.wide{margin-left:-103px}
}
@keyframes wgc-flow-x{to{background-position:600px 0}}
`;

export default {
  id: ID,
  rounds: ROUND_COUNT,
  parentNote:
    'A planning puzzle: the boat carries the farmer and only one passenger, and some pairs cannot be left alone together. The surprising key move is taking the goat back again; children rarely think of going backwards, so ask "What could the farmer bring back?" before showing. Rounds 4 and 5 use a bigger boat (farmer plus two) but add more passengers: first a goat with three things it cannot be left with, then five passengers with two separate pairs to keep apart.',
  async start(api) {
    let alive = true;
    let busy = false;
    let demoOn = false;
    let finished = false;
    const P = '.a-' + ID;
    api.css(CSS(P));
    const wrap = h('div', { class: 'a-' + ID });
    api.root.append(wrap);

    const kids = shuffle(['👧', '👦', '🧒']);
    const [elderE, elderName] = pick([
      ['👵', 'Grandma'],
      ['👴', 'Grandpa'],
    ]);
    const treat = pick(TREATS);
    const [chaser, runner] = pick(PAIRS);
    const ROUNDS = buildRounds({ kids, elderE, elderName, treat, chaser, runner });
    const N = ROUNDS.length;
    ROUNDS.forEach((R) => {
      R.flip = Math.random() < 0.5;
      R.order = shuffle(R.items.map((i) => i.id));
    });

    const sailBtn = h('button', { class: 'btn primary', type: 'button', onclick: () => sail() }, '⛵ Sail');
    const undoBtn = h('button', { class: 'btn', type: 'button', onclick: () => undo() }, '↩️ Undo');
    const hintBtn = h('button', { class: 'btn', type: 'button', onclick: () => showHint() }, '💡 Hint');
    const sceneBox = h('div', { style: { width: '100%' } });
    const rules = h('div', { class: 'rules' });
    wrap.append(sceneBox, h('div', { class: 'ctrl' }, sailBtn, undoBtn, hintBtn), rules);

    let ri = 0;
    let R = ROUNDS[0];
    let state;
    let history = [];
    let invalid = false;
    let wrong = 0;
    let asks = 0;
    let els = {};
    let banks = [];
    let boatEl;
    let hull;
    let bubble = null;

    const item = (id) => R.items.find((i) => i.id === id);
    const theName = (id) => (R.farmer ? 'the ' + item(id).name : id === 'big' ? elderName : 'a kid');
    const isRight = (side) => (side === 1) !== R.flip;
    const load = () => R.items.map((i) => i.id).filter((id) => els[id].parentNode === hull);
    const placeBoat = () => boatEl.classList.toggle('at-b', isRight(state.boat));
    function updateBtns() {
      sailBtn.disabled = busy || invalid;
      undoBtn.disabled = busy || !history.length;
      hintBtn.disabled = busy;
    }

    function render(i, quiet = false) {
      ri = i;
      R = ROUNDS[i];
      api.stage(i, N);
      state = { side: Object.fromEntries(R.items.map((it) => [it.id, 0])), boat: 0 };
      history = [];
      invalid = false;
      wrong = 0;
      asks = 0;
      bubble = null;
      els = {};
      banks = [
        h('div', { class: 'bank start dz' }, h('span', { class: 'deco', 'aria-hidden': 'true' }, '🌳')),
        h('div', { class: 'bank goal dz' }, h('span', { class: 'deco', 'aria-hidden': 'true' }, '🏡')),
      ];
      hull = h(
        'div',
        { class: 'hull dz' },
        R.farmer ? h('span', { class: 'farmer', role: 'img', 'aria-label': 'farmer' }, '👨‍🌾') : null,
      );
      boatEl = h('div', { class: 'boat' + (R.cap > 1 && R.farmer ? ' wide' : '') }, hull);
      const river = h('div', { class: 'river dz' }, boatEl);
      for (const it of R.items) {
        const el = h(
          'button',
          { class: `who ${it.cls || ''}`, type: 'button', 'data-id': it.id, 'aria-label': it.label || it.name },
          it.e,
        );
        el.style.order = R.order.indexOf(it.id);
        // Keyboard activation (detail 0); pointer taps arrive through drag()'s onDrop with moved = false.
        el.addEventListener('click', (e) => {
          if (e.detail === 0) tap(it.id);
        });
        drag(el, {
          dropSelector: `${P} .dz`,
          onDrop: (t, _el, moved) => {
            onDrop(it.id, t, moved);
            return true;
          },
        });
        els[it.id] = el;
        banks[0].append(el);
      }
      sceneBox.replaceChildren(
        h(
          'div',
          { class: 'scene' + (R.items.length > 3 ? ' many' : '') },
          R.flip ? banks[1] : banks[0],
          river,
          R.flip ? banks[0] : banks[1],
        ),
      );
      placeBoat();
      rules.replaceChildren(
        ...(R.farmer
          ? [
              h('span', { class: 'pair', 'aria-label': `boat fits farmer and ${R.cap}` }, '⛵ 👨‍🌾 + ' + R.cap),
              h('span', {}, 'Not alone together:'),
              ...R.bad.map(([a, b]) => h('span', { class: 'pair bad' }, item(a).e + ' ' + item(b).e)),
            ]
          : [
              h('span', {}, 'The boat fits:'),
              h('span', { class: 'pair' }, kids[0] + ' ' + kids[1]),
              h('span', {}, 'or'),
              h('span', { class: 'pair' }, elderE),
            ]),
      );
      busy = false;
      updateBtns();
      if (!quiet) api.prompt(R.prompt);
    }

    // Move elements between containers with a smooth FLIP animation.
    function flipAll(fn) {
      const all = Object.values(els);
      const first = new Map(all.map((e) => [e, e.getBoundingClientRect()]));
      all.forEach((e) => {
        e.style.transition = 'none';
        e.style.transform = '';
        e._dragBase = null;
        e._dragPos = null;
      });
      fn();
      all.forEach((e) => {
        const a = first.get(e);
        const b = e.getBoundingClientRect();
        const dx = a.left - b.left;
        const dy = a.top - b.top;
        if (Math.abs(dx) + Math.abs(dy) > 0.5) e.style.transform = `translate(${dx}px, ${dy}px)`;
      });
      void wrap.offsetWidth;
      all.forEach((e) => {
        e.style.transition = 'transform .38s cubic-bezier(.4,.1,.2,1)';
        e.style.transform = '';
      });
    }
    function bounce(el) {
      el.style.transition = 'transform .28s cubic-bezier(.3,1.4,.5,1)';
      el.style.transform = '';
      el._dragBase = null;
      el._dragPos = null;
      el.classList.remove('nope');
      void el.offsetWidth;
      el.classList.add('nope');
      setTimeout(() => el.classList.remove('nope'), 450);
    }
    const glowEls = new Set();
    function glow(el) {
      el.classList.add('glow');
      glowEls.add(el);
    }
    function clearHint() {
      glowEls.forEach((e) => e.classList.remove('glow'));
      glowEls.clear();
    }
    function wrongTry(msg, later = false) {
      wrong++;
      api.nudge(msg);
      if (wrong >= MISSES_FOR_HINT && !later)
        setTimeout(() => {
          if (alive && !busy && !demoOn) showHint(true);
        }, 1400);
    }
    function remindUndo() {
      glow(undoBtn);
      api.nudge('Tap Undo to go back.');
    }

    function onDrop(id, target, moved) {
      const el = els[id];
      if (demoOn || busy || invalid) {
        bounce(el);
        if (invalid && !demoOn) remindUndo();
        return;
      }
      if (!moved) {
        el.style.transform = '';
        tap(id);
        return;
      }
      const inBoat = load().includes(id);
      if (target.closest('.hull, .river')) {
        if (inBoat) bounce(el);
        else board(id);
        return;
      }
      if (target === banks[state.boat]) {
        if (inBoat) unboard(id);
        else bounce(el);
        return;
      }
      bounce(el); // dropped on the far bank
      if (state.side[id] === state.boat) api.nudge('Put it in the boat, then press Sail.');
    }
    function tap(id) {
      if (demoOn || busy) return;
      if (invalid) return remindUndo();
      if (load().includes(id)) unboard(id);
      else board(id);
    }
    function board(id) {
      const el = els[id];
      if (state.side[id] !== state.boat) {
        bounce(el);
        api.nudge('The boat is over on the other side.');
        return;
      }
      const w = load().reduce((a, x) => a + item(x).w, 0) + item(id).w;
      if (w > R.cap) {
        bounce(el);
        wrongTry(
          !R.farmer
            ? 'Too heavy! Two kids, or one grown-up.'
            : R.cap === 1
              ? 'Only one friend fits next to the farmer.'
              : 'Only two friends fit with the farmer.',
        );
        return;
      }
      clearHint();
      flipAll(() => hull.append(el));
      sfx('pop');
    }
    function unboard(id) {
      clearHint();
      flipAll(() => banks[state.boat].append(els[id]));
      sfx('drop');
    }

    async function cross(ids) {
      busy = true;
      updateBtns();
      state.boat = 1 - state.boat;
      ids.forEach((id) => {
        state.side[id] = state.boat;
      });
      sfx('whoosh');
      boatEl.classList.add('sailing');
      placeBoat();
      await sleep(SAIL_MS + 50);
      if (!alive) return;
      boatEl.classList.remove('sailing');
      flipAll(() => ids.forEach((id) => banks[state.boat].append(els[id])));
      if (ids.length) sfx('drop');
      await sleep(400);
      if (!alive) return;
      busy = false;
      updateBtns();
    }

    async function sail() {
      if (busy || demoOn) return;
      if (invalid) return remindUndo();
      const ids = load();
      if (!R.farmer && !ids.length) {
        wrongTry('Someone has to row the boat!');
        return;
      }
      clearHint();
      history.push(cloneState(state));
      await cross(ids);
      if (!alive) return;
      const bad = trouble(R, state);
      if (bad) {
        invalid = true;
        updateBtns();
        const m = MISCHIEF[bad.join(',')];
        bad.forEach((id) => els[id].classList.add('trouble'));
        bubble = h('span', { class: 'bubble', 'aria-hidden': 'true' }, m.pic);
        banks[state.side[bad[0]]].append(bubble);
        glow(undoBtn);
        wrongTry(m.say, true);
        return;
      }
      if (isGoal(R, state)) return roundWon();
      wrong = 0;
      asks = 0;
      // TODO(bug): never true - after one crossing the boat is on side 1 (probably meant history.length === 2).
      if (state.boat === 0 && history.length === 1) api.prompt('The boat is back. Who goes next?');
    }

    async function undo() {
      if (busy || demoOn || !history.length) return;
      clearHint();
      busy = true;
      updateBtns();
      Object.values(els).forEach((e) => e.classList.remove('trouble'));
      if (bubble) {
        bubble.remove();
        bubble = null;
      }
      if (load().length) {
        flipAll(() => load().forEach((id) => banks[state.boat].append(els[id])));
        await sleep(380);
        if (!alive) return;
      }
      const prev = history.pop();
      const ids = R.items.map((i) => i.id).filter((id) => prev.side[id] !== state.side[id]);
      if (ids.length) {
        flipAll(() => ids.forEach((id) => hull.append(els[id])));
        sfx('pop');
        await sleep(420);
        if (!alive) return;
      }
      await cross(ids);
      if (!alive) return;
      invalid = false;
      updateBtns();
      if (wrong >= MISSES_FOR_HINT) showHint(true);
      else api.prompt(pick(['Back again! Try another way.', 'All better. What could you try instead?']));
    }

    function moveText(m, toGoal) {
      const dir = toGoal ? 'across' : 'back';
      if (R.farmer) {
        if (!m.length) return `the farmer rows ${dir} alone.`;
        const who = m.map(theName).join(' and ');
        return toGoal ? `take ${who} across.` : `bring ${who} back with you.`;
      }
      if (m.length === 2) return `both kids row ${dir} together.`;
      return `${theName(m[0])} rows ${dir}.`;
    }
    // Progressive hints: Hint taps 1-2 only ask a question (the second also lights up the rules);
    // the move itself glows only after 2 misses in a row (auto) or a third Hint tap.
    function showHint(auto = false) {
      if (busy || demoOn) return;
      clearHint();
      if (invalid) {
        glow(undoBtn);
        api.nudge('First, tap Undo to go back.');
        return;
      }
      const path = solve(R, state);
      if (!path || !path.length) return;
      const m = path[0];
      const L = load();
      if (!auto) asks++;
      if (!auto && wrong < MISSES_FOR_HINT && asks < 3) return askHint(m, L);
      const extra = L.filter((id) => !m.includes(id));
      if (extra.length) {
        extra.forEach((id) => glow(els[id]));
        api.prompt(`Hint: take ${theName(extra[0])} out of the boat.`);
        return;
      }
      const need = m.filter((id) => !L.includes(id));
      if (!need.length) {
        glow(sailBtn);
        api.prompt('Hint: now press Sail!');
        return;
      }
      need.forEach((id) => glow(els[id]));
      api.prompt('Hint: ' + moveText(m, state.boat === 0));
    }

    function askHint(m, L) {
      const toGoal = state.boat === 0;
      const ready = L.length === m.length && m.every((id) => L.includes(id));
      if (ready) {
        api.prompt('Hint: looks good! Ready to sail?');
        return;
      }
      if (asks >= 2) {
        rules.querySelectorAll(R.farmer ? '.pair.bad' : '.pair').forEach(glow);
        api.prompt(
          R.farmer ? 'Hint: check the pairs. Who is left behind?' : 'Hint: the boat fits two kids, or one grown-up.',
        );
        return;
      }
      if (!R.farmer)
        api.prompt(toGoal ? 'Hint: who can fit in the boat together?' : 'Hint: someone must row back. Who?');
      else if (toGoal) api.prompt('Hint: who is safe to leave behind together?');
      else if (m.length) api.prompt('Hint: could the farmer bring someone back?');
      else api.prompt('Hint: does the farmer need to bring anyone back?');
    }

    async function roundWon() {
      busy = true;
      updateBtns();
      api.cheer(
        pick(['Everyone made it across!', 'Wonderful rowing, captain!', 'Hooray, all safe on the other side!']),
      );
      Object.values(els).forEach((e) => e.classList.add('hop'));
      await sleep(2000);
      if (!alive) return;
      if (ri < ROUNDS.length - 1) render(ri + 1);
      else {
        finished = true;
        api.stage(N, N);
        api.finish();
      }
    }

    api.setDemo(async () => {
      while (alive && busy && !finished) await sleep(100);
      if (!alive || finished) return;
      demoOn = true;
      clearHint();
      render(ri, true);
      const path = solve(R, state);
      await Promise.all([api.prompt('Watch me get everyone across.'), sleep(900)]);
      for (let k = 0; k < path.length; k++) {
        if (!alive) return;
        const m = path[k];
        const toGoal = state.boat === 0;
        const pre = k === 0 ? 'First, ' : k === path.length - 1 ? 'Last, ' : pick(['Then ', 'Next, ']);
        let line = moveText(m, toGoal);
        if (R.farmer && m.length) {
          const who = m.map((id) => 'the ' + item(id).name).join(' and ');
          const v = m.length > 1 ? 'ride' : 'rides';
          line = toGoal ? `${who} ${v} across.` : `${who} ${m.length > 1 ? 'come' : 'comes'} back. Tricky!`;
        }
        const sp = api.prompt(pre + line);
        await sleep(700);
        if (!alive) return;
        if (m.length) {
          flipAll(() => m.forEach((id) => hull.append(els[id])));
          sfx('pop');
          await sleep(650);
          if (!alive) return;
        }
        history.push(cloneState(state));
        await cross(m);
        if (!alive) return;
        await Promise.race([sp, sleep(4000)]);
        await sleep(350);
        if (!alive) return;
      }
      Object.values(els).forEach((e) => e.classList.add('hop'));
      api.cheer('Everyone is across! Now you try.');
      await sleep(2200);
      if (!alive) return;
      render(ri);
      demoOn = false;
    });

    render(resumeRound(api, N));
    return {
      destroy() {
        alive = false;
      },
    };
  },
};
