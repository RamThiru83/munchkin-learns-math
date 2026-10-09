/**
 * Game: Odd One Out  (id: odd-one-out, level 1)
 *
 * Idea: any card in a small group can be "the odd one" if she can give a reason (colour, size,
 * shape or how many). Reasons are generated from the card attributes, so every answer is computed
 * from the data and never hand-written.
 * Rounds:
 *   1. Three cards, one differs in colour, shape or size: tap it.
 *   2. Four cards with one random distractor attribute: tap the odd one, then pick the reason chip.
 *   3. Four cards, each odd for its own reason: tap any not-yet-used card, then pick its reason (4 stars).
 *   4. Five cards, two distractor attributes: tap the odd one, then pick the reason chip.
 *   5. Reverse: given the reason ("Find the only red one"), find the card; one per card, in random order.
 * Watch demo: hand points at every card (rounds 1-2) or walks through each odd card and its reason
 *   (rounds 3-5); the player's state is saved and restored afterwards.
 * Notes: `PLAN` rows are [mode, puzzles, cards, distractor attributes]; mode = puzzle type above
 *   (1 = round 1, 2 = rounds 2 and 4, 3 = round 3, 4 = round 5). `gen2` falls back to a fixed puzzle
 *   after 600 failed tries. Test hook: `_test = { gen1, gen2, gen3, cands, valid }`.
 */
import { h, sleep, shuffle, rand, pick, sfx, flyTo, resumeRound } from '../lib/core.js';

const CSS = `
.a-odd-one-out{position:relative;width:100%;max-width:640px;display:flex;flex-direction:column;align-items:center;gap:12px}
.a-odd-one-out .board{display:grid;gap:12px;width:100%;justify-content:center;padding-top:20px}
.a-odd-one-out .board.n3{grid-template-columns:repeat(3,minmax(0,160px))}
.a-odd-one-out .board.n4{grid-template-columns:repeat(4,minmax(0,140px))}
.a-odd-one-out .board.n5{grid-template-columns:repeat(5,minmax(0,116px))}
@media (max-width:560px){.a-odd-one-out .board.n4{grid-template-columns:repeat(2,minmax(0,128px))}.a-odd-one-out .board.n5{grid-template-columns:repeat(3,minmax(0,104px))}}
.a-odd-one-out .card{position:relative;aspect-ratio:1;min-width:0;border:3px solid var(--ink);border-radius:22px;background:#fff;box-shadow:var(--shadow);padding:6px;cursor:pointer;font:inherit;transition:transform .25s cubic-bezier(.3,1.4,.5,1),background .25s,border-color .25s}
.a-odd-one-out .card svg{width:100%;height:100%;display:block;pointer-events:none}
.a-odd-one-out .card.sel{background:#fff3c4;transform:translateY(-8px) scale(1.04)}
.a-odd-one-out .card.odd{background:#ffe3b0;border-color:var(--orange);transform:translateY(-10px) scale(1.06)}
.a-odd-one-out .card.mate,.a-odd-one-out .card.done{background:#e6f9f1}
.a-odd-one-out .card.glow{box-shadow:0 0 0 6px rgba(255,209,102,.95)}
.a-odd-one-out .badge{position:absolute;right:-9px;top:-9px;width:42px;height:42px;border-radius:50%;background:#fff;border:3px solid var(--ink);display:none;padding:2px}
.a-odd-one-out .badge svg{width:100%;height:100%;display:block}
.a-odd-one-out .card.done .badge{display:block}
.a-odd-one-out .cap{min-height:1.5em;font-weight:800;text-align:center;font-size:clamp(1rem,3.4vw,1.2rem)}
.a-odd-one-out .why{display:flex;flex-direction:column;align-items:center;gap:8px;animation:a-ooo-in .3s both}
.a-odd-one-out .why[hidden],.a-odd-one-out .stars[hidden]{display:none}
.a-odd-one-out .why b{font-size:1.05rem}
.a-odd-one-out .reasons{display:flex;gap:10px;flex-wrap:wrap;justify-content:center}
.a-odd-one-out .reason{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:0;width:100px;min-height:96px;padding:4px;font:inherit}
.a-odd-one-out .reason svg{width:56px;height:56px;display:block;pointer-events:none}
.a-odd-one-out .reason small{font-size:1rem;font-weight:800;line-height:1.1}
.a-odd-one-out .stars{display:flex;gap:8px;font-size:1.8rem;min-height:2.2rem}
.a-odd-one-out .stars span{filter:grayscale(1);opacity:.45;transition:all .3s}
.a-odd-one-out .stars span.on{filter:none;opacity:1;transform:scale(1.15)}
.a-odd-one-out .hand{position:absolute;left:calc(50% - 22px);top:34%;font-size:2.4rem;line-height:1;pointer-events:none;z-index:30;opacity:0}
.a-odd-one-out .hand.on{opacity:1}
@keyframes a-ooo-in{from{opacity:0}}
`;

// [mode, puzzles, cards, distractor attributes]; one row per round.
const PLAN = [
  [1, 2],
  [2, 2],
  [3, 1],
  [2, 2, 5, 2],
  [4, 1],
];

const ATTRS = ['colour', 'size', 'shape', 'count'];
const VALS = {
  colour: ['red', 'blue', 'green', 'yellow', 'purple'],
  size: ['big', 'small'],
  shape: ['circle', 'square', 'triangle', 'star'],
  count: [1, 2, 3],
};
const FILL = { red: '#ef476f', blue: '#118ab2', green: '#06d6a0', yellow: '#ffd166', purple: '#9b5de5' };
const INK = '#2b2d42';
const GREY = '#d9d4c5';
const NUM = { 1: 'one', 2: 'two', 3: 'three' };
const YES = ['Yes!', 'Well spotted!', 'You found it!', 'Lovely looking!', 'Good thinking!'];

// ---------- wording, always generated from the attributes ----------
const cntPhrase = (n) => (n === 1 ? 'one shape' : `${NUM[n]} shapes`);
function reasonPhrase(a, v) {
  if (a === 'colour' || a === 'size') return `the only ${v} one`;
  if (a === 'shape') return `the only ${v}`;
  return `the only one with ${cntPhrase(v)}`;
}
function othersPhrase(a, v) {
  if (a === 'colour' || a === 'size') return `The others are all ${v}.`;
  if (a === 'shape') return `The others are all ${v}s.`;
  return `The others all have ${cntPhrase(v)}.`;
}
function tooPhrase(a, v, all) {
  const lead = all ? 'The others' : 'Some of the others';
  if (a === 'colour' || a === 'size') return `${lead} are ${v} too.`;
  if (a === 'shape') return `${lead} are ${v}s too.`;
  return `${lead} have ${cntPhrase(v)} too.`;
}
const chipLabel = (a, v) => (a === 'count' ? NUM[v] : v);
const describe = (it) => `${NUM[it.count]} ${it.size} ${it.colour} ${it.shape}${it.count > 1 ? 's' : ''}`;

// ---------- the logic: who can be odd, and why ----------
// Item i is odd by attribute a when every other item shares one value and item i differs.
function valid(items, i, a) {
  const others = items.filter((_, j) => j !== i);
  return others.every((o) => o[a] === others[0][a]) && items[i][a] !== others[0][a];
}
function cands(items) {
  const out = [];
  items.forEach((_, i) =>
    ATTRS.forEach((a) => {
      if (valid(items, i, a)) out.push({ i, a });
    }),
  );
  return out;
}
const otherVal = (items, i, a) => items[(i + 1) % items.length][a];

function gen1(avoid) {
  const A = pick(['colour', 'shape', 'size'].filter((a) => a !== avoid));
  const base = { colour: pick(VALS.colour), size: 'big', shape: pick(VALS.shape), count: 1 };
  const odd = { ...base };
  if (A === 'size') {
    base.size = pick(VALS.size);
    odd.size = base.size === 'big' ? 'small' : 'big';
  } else odd[A] = pick(VALS[A].filter((v) => v !== base[A]));
  const list = [{ ...base }, { ...base }, odd];
  const order = shuffle([0, 1, 2]);
  return { items: order.map((k) => ({ ...list[k] })), attr: A };
}
// Exactly one odd card (verified with cands()); n cards; nz = how many other attributes vary at random (distractors).
function gen2(avoid, n = 4, nz = 1) {
  for (let tries = 0; tries < 600; tries++) {
    const A = pick(ATTRS.filter((a) => a !== avoid));
    const a = pick(VALS[A]);
    const b = pick(VALS[A].filter((v) => v !== a));
    const noises = shuffle(ATTRS.filter((x) => x !== A)).slice(0, nz);
    const base = {};
    ATTRS.forEach((x) => {
      base[x] = pick(VALS[x]);
    });
    const oddIdx = rand(n);
    const items = Array.from({ length: n }, (_, k) => {
      const it = { ...base, [A]: k === oddIdx ? b : a };
      noises.forEach((x) => {
        it[x] = pick(VALS[x]);
      });
      return it;
    });
    if (noises.some((x) => new Set(items.map((it) => it[x])).size < 2)) continue;
    const c = cands(items);
    if (c.length === 1 && c[0].i === oddIdx && c[0].a === A) return { items, attr: A };
  }
  const items = Array.from({ length: n }, (_, k) => ({
    colour: 'blue',
    size: 'big',
    shape: 'circle',
    count: 1,
    ...(k === 0 ? { colour: 'red' } : {}),
  }));
  return { items, attr: 'colour' };
}
// Every one of the four is odd for its own, different reason.
function gen3() {
  for (let tries = 0; tries < 200; tries++) {
    const own = shuffle(ATTRS);
    const major = {},
      minor = {};
    ATTRS.forEach((a) => {
      major[a] = pick(VALS[a]);
      minor[a] = pick(VALS[a].filter((v) => v !== major[a]));
    });
    const items = own.map((mine) => {
      const it = {};
      ATTRS.forEach((a) => {
        it[a] = a === mine ? minor[a] : major[a];
      });
      return it;
    });
    const c = cands(items);
    if (c.length === 4 && new Set(c.map((x) => x.i)).size === 4) return { items, attr: null };
  }
  return { items: [], attr: null };
}

// ---------- drawing ----------
function shapeEl(kind, cx, cy, r, fill) {
  const a = { fill, stroke: INK, 'stroke-width': 3, 'stroke-linejoin': 'round' };
  if (kind === 'circle') return h('circle', { cx, cy, r, ...a });
  if (kind === 'square')
    return h('rect', { x: cx - r * 0.88, y: cy - r * 0.88, width: r * 1.76, height: r * 1.76, rx: r * 0.2, ...a });
  if (kind === 'triangle')
    return h('polygon', { points: `${cx},${cy - r} ${cx + r},${cy + r * 0.8} ${cx - r},${cy + r * 0.8}`, ...a });
  const pts = [];
  for (let i = 0; i < 10; i++) {
    const ang = -Math.PI / 2 + (i * Math.PI) / 5;
    const rad = i % 2 ? r * 0.45 : r * 1.05;
    pts.push(`${(cx + Math.cos(ang) * rad).toFixed(1)},${(cy + Math.sin(ang) * rad).toFixed(1)}`);
  }
  return h('polygon', { points: pts.join(' '), ...a });
}
// Centres of n (1-3) shapes of radius r inside the 100x100 viewBox.
function spots(n, r) {
  if (n === 1) return [[50, 50]];
  if (n === 2)
    return [
      [50 - r * 1.12, 50],
      [50 + r * 1.12, 50],
    ];
  return [
    [50, 50 - r * 0.95],
    [50 - r * 1.15, 50 + r * 0.8],
    [50 + r * 1.15, 50 + r * 0.8],
  ];
}
// One card's picture: `count` shapes of the item's colour/shape; radius depends on count and size.
function itemSvg(it) {
  const r = { 1: [30, 15], 2: [20, 11], 3: [17, 9.5] }[it.count][it.size === 'big' ? 0 : 1];
  return h(
    'svg',
    { viewBox: '0 0 100 100', 'aria-hidden': 'true' },
    spots(it.count, r).map(([x, y]) => shapeEl(it.shape, x, y, r, FILL[it.colour])),
  );
}
// A small picture of one attribute value (used on reason chips and badges).
function valueSvg(a, v) {
  const kids = [];
  if (a === 'colour') kids.push(shapeEl('circle', 50, 50, 34, FILL[v]));
  else if (a === 'size') kids.push(shapeEl('circle', 50, 50, v === 'big' ? 38 : 15, GREY));
  else if (a === 'shape') kids.push(shapeEl(v, 50, 50, 32, GREY));
  else spots(v, 15).forEach(([x, y]) => kids.push(shapeEl('circle', x, y, 15, GREY)));
  return h('svg', { viewBox: '0 0 100 100', 'aria-hidden': 'true' }, kids);
}

export default {
  id: 'odd-one-out',
  rounds: PLAN.length,
  parentNote:
    'Any one of a small group can be "the odd one" as long as she can give a reason: colour, size, shape or how many. Later rounds add a fifth card with more distractors, and finally turn the question round: she is given the reason and must find the card. Ask "Why is that one different?" and then "Can a different one be odd, for another reason?" The usual misconception is that there is only one right answer, or that "it is just different" is enough: help her name what is the same in the others.',

  async start(api) {
    let alive = true;
    let tok = 0;
    let demoing = false;
    let st = null;
    let chipsFor = null;
    let lastPrompt = '';
    api.css(CSS);

    const wrap = h('div', { class: 'a-odd-one-out' });
    const board = h('div', { class: 'board' });
    const cap = h('div', { class: 'cap', 'aria-live': 'polite' });
    const reasons = h('div', { class: 'reasons' });
    const why = h('div', { class: 'why', hidden: true }, h('b', {}, 'Why is it odd?'), reasons);
    const stars = h(
      'div',
      { class: 'stars', hidden: true, 'aria-label': 'Turns to be odd' },
      [0, 1, 2, 3].map(() => h('span', { 'aria-hidden': 'true' }, '⭐')),
    );
    const hand = h('div', { class: 'hand', 'aria-hidden': 'true' }, '👆');
    wrap.append(board, cap, why, stars, hand);
    api.root.append(wrap);

    const live = (t) => alive && t === tok;
    const say = (text) => {
      lastPrompt = text;
      return api.prompt(text);
    };
    let cards = [];

    // ---------- view ----------
    function sync() {
      if (!st) return;
      cards.forEach((c, i) => {
        c.classList.toggle('sel', st.sel === i && st.view.odd !== i);
        c.classList.toggle('odd', st.view.odd === i);
        c.classList.toggle('mate', st.view.mates && st.view.odd !== i);
        c.classList.toggle('done', st.done.has(i));
        c.classList.toggle('glow', st.view.glowCard === i);
      });
      stars.querySelectorAll('span').forEach((s, k) => s.classList.toggle('on', k < st.done.size));
      if (st.mode >= 2 && st.sel != null) {
        if (chipsFor !== st.sel) buildChips(st.sel);
      } else {
        chipsFor = null;
        why.hidden = true;
      }
      cap.textContent = st.cap || '';
    }
    function buildChips(i) {
      chipsFor = i;
      const it = st.items[i];
      const ok = ATTRS.filter((a) => valid(st.items, i, a));
      let list;
      if (st.mode === 3) list = ATTRS.slice();
      else list = shuffle([ok[0], ...shuffle(ATTRS.filter((a) => !ok.includes(a))).slice(0, 2)]);
      reasons.replaceChildren(
        ...list.map((a) => {
          const b = h(
            'button',
            {
              class: 'chip choice reason',
              type: 'button',
              'data-attr': a,
              'aria-label': `Reason: ${a} ${chipLabel(a, it[a])}`,
              onclick: () => onChip(a, b),
            },
            valueSvg(a, it[a]),
            h('small', {}, chipLabel(a, it[a])),
          );
          return b;
        }),
      );
      why.hidden = false;
      st.wrongChip = 0;
    }
    const chipBtn = (a) => reasons.querySelector(`[data-attr="${a}"]`);

    function buildBoard() {
      board.className = `board n${st.items.length}`;
      cards = st.items.map((it, i) =>
        h(
          'button',
          { class: 'card', type: 'button', 'aria-label': describe(it), onclick: () => onCard(i) },
          itemSvg(it),
          h('span', { class: 'badge' }),
        ),
      );
      board.replaceChildren(...cards);
      stars.hidden = st.mode < 3;
      why.hidden = true;
      chipsFor = null;
      cap.textContent = '';
    }
    function mark(i, a) {
      const badge = cards[i].querySelector('.badge');
      badge.replaceChildren(valueSvg(a, st.items[i][a]));
      st.done.add(i);
    }

    // ---------- play ----------
    function wrongItem(i) {
      st.wrongItem++;
      cards[i].classList.remove('shake');
      void cards[i].offsetWidth;
      cards[i].classList.add('shake');
      if (st.wrongItem >= 2) {
        const hit = st.mode === 4 ? st.target.i : st.cands[0].i;
        st.view.glowCard = hit;
        sync();
        api.nudge('Look at the one that is glowing.');
      } else {
        api.nudge(
          pick(['Hmm, look again. Which one is not like the rest?', 'Not this one. Find the one that is different.']),
        );
      }
    }
    const targetText = () => `Find ${reasonPhrase(st.target.a, st.items[st.target.i][st.target.a])}.`;
    async function onCard(i) {
      if (!st || st.locked || demoing) return;
      sfx('tap');
      const ok = ATTRS.filter((a) => valid(st.items, i, a));
      if (st.mode >= 3 && st.done.has(i)) {
        cards[i].classList.remove('hop');
        void cards[i].offsetWidth;
        cards[i].classList.add('hop');
        api.nudge('This one had its turn. Pick another one!');
        return;
      }
      if (st.mode === 4) {
        if (i === st.target.i) {
          await solve(i, st.target.a);
          return;
        }
        if (ok.length) {
          st.wrongItem++;
          cards[i].classList.remove('shake');
          void cards[i].offsetWidth;
          cards[i].classList.add('shake');
          if (st.wrongItem >= 2) {
            st.view.glowCard = st.target.i;
            sync();
          }
          api.nudge(`That one is odd for another reason. ${targetText()}`);
        } else wrongItem(i);
        return;
      }
      if (!ok.length) {
        wrongItem(i);
        return;
      }
      if (st.mode === 1) {
        await solve(i, ok[0]);
        return;
      }
      st.sel = i;
      st.view.glowCard = null;
      st.wrongItem = 0;
      sync();
      cards[i].classList.remove('hop');
      void cards[i].offsetWidth;
      cards[i].classList.add('hop');
      say(st.mode === 2 ? 'Why is it odd? Pick the reason.' : 'Why can this one be odd? Pick the reason.');
    }
    function chipTried(a, btn) {
      const i = st.sel;
      const it = st.items[i];
      btn.classList.remove('shake');
      void btn.offsetWidth;
      btn.classList.add('shake');
      const same = st.items.filter((o, j) => j !== i && o[a] === it[a]).length;
      const total = st.items.length - 1;
      st.wrongChip++;
      let text = tooPhrase(a, it[a], same === total) + ' Try another reason.';
      if (same === 0) text = 'Not that reason. Look at what the others share.';
      if (st.wrongChip >= 2) {
        const good = ATTRS.find((x) => valid(st.items, i, x));
        chipBtn(good)?.classList.add('glow');
        text = 'Try the one that is glowing.';
      }
      api.nudge(text);
    }
    async function onChip(a, btn) {
      if (!st || st.locked || demoing || st.sel == null) return;
      const i = st.sel;
      if (!valid(st.items, i, a)) {
        chipTried(a, btn);
        return;
      }
      await solve(i, a);
    }
    // item i has been shown to be odd for reason a
    async function solve(i, a) {
      const t = tok;
      const it = st.items[i];
      st.locked = true;
      sfx('pop');
      const rest = otherVal(st.items, i, a);
      st.cap = othersPhrase(a, rest);
      st.view.glowCard = null;
      reasons.querySelectorAll('.glow').forEach((b) => b.classList.remove('glow'));
      let text = `${pick(YES)} It is ${reasonPhrase(a, it[a])}.`;
      if (st.mode >= 3) {
        mark(i, a);
        st.sel = null;
        const left = st.items.length - st.done.size;
        if (!left) text = 'Wonderful! Every one had a turn to be odd!';
      } else {
        st.view.odd = i;
        st.view.mates = true;
        if (st.mode === 2) {
          st.sel = i;
        }
      }
      sync();
      cards[i].classList.add('hop');
      const left = st.mode >= 3 ? st.items.length - st.done.size : 0;
      await Promise.all([api.cheer(text), sleep(st.mode >= 3 && left ? 1700 : 2300)]);
      if (!live(t)) return;
      if (st.mode >= 3 && left) {
        st.locked = false;
        if (st.mode === 4) {
          st.target = st.order[++st.step];
          st.wrongItem = 0;
          st.cap = '';
          sync();
          say(targetText());
        } else say('Now find another way. Who else can be odd?');
        return;
      }
      st.resolve?.();
    }

    async function playPuzzle(mode, avoid, n = 4, nz = 1) {
      const t = ++tok;
      const g = mode === 1 ? gen1(avoid) : mode === 2 ? gen2(avoid, n, nz) : gen3();
      st = {
        mode,
        items: g.items,
        attr: g.attr,
        sel: null,
        done: new Set(),
        wrongItem: 0,
        wrongChip: 0,
        cap: '',
        locked: false,
        view: { odd: -1, mates: false, glowCard: null },
        cands: cands(g.items),
        resolve: null,
      };
      if (mode === 4) {
        st.order = shuffle(st.cands);
        st.step = 0;
        st.target = st.order[0];
      }
      buildBoard();
      sync();
      say(
        mode === 4
          ? targetText()
          : mode === 1
            ? pick(['Tap the one that is different.', 'Which one is different? Tap it.'])
            : mode === 2
              ? 'Tap the odd one out.'
              : 'Any one can be odd! Tap one, then say why.',
      );
      await new Promise((res) => {
        st.resolve = res;
      });
      return live(t) ? st.attr : null;
    }

    async function run() {
      const startAt = resumeRound(api, PLAN.length);
      for (let r = startAt; r < PLAN.length; r++) {
        api.stage(r, PLAN.length);
        let avoid = null;
        for (let k = 0; k < PLAN[r][1]; k++) {
          const attr = await playPuzzle(PLAN[r][0], avoid, PLAN[r][2], PLAN[r][3]);
          if (!alive) return;
          avoid = attr;
        }
      }
      api.finish();
    }

    // ---------- demo ----------
    const narrate = async (text, ms) => {
      say(text);
      await sleep(ms);
    };
    async function point(el, t, duration = 650) {
      await flyTo(hand, el, { duration, offset: { x: 8, y: 34 } });
      return live(t);
    }
    // Demo choreography: wait for any reveal to finish, blank the board state, walk the hand through the
    // solution for the current mode, then restore the saved state in `finally`.
    api.setDemo(async () => {
      while (alive && st && st.locked) await sleep(120);
      if (!alive || !st) return;
      const t = tok;
      demoing = true;
      const saved = { sel: st.sel, done: new Set(st.done), cap: st.cap, view: { ...st.view }, prompt: lastPrompt };
      const wasLocked = st.locked;
      const clear = () => {
        st.sel = null;
        st.done = new Set();
        st.cap = '';
        st.view = { odd: -1, mates: false, glowCard: null };
      };
      clear();
      sync();
      reasons.querySelectorAll('.glow').forEach((b) => b.classList.remove('glow'));
      hand.style.transition = 'none';
      hand.style.transform = '';
      hand._dragBase = null;
      hand._dragPos = null;
      void hand.offsetWidth;
      hand.classList.add('on');
      try {
        await narrate('Look at all of them.', 500);
        if (st.mode < 3) {
          for (const c of cards) {
            if (!(await point(c, t, 500))) return;
            c.classList.add('hop');
            await sleep(250);
            c.classList.remove('hop');
          }
          const { i: o, a } = st.cands[0];
          await narrate('Which one is not like the others?', 900);
          if (!live(t)) return;
          st.view.mates = true;
          st.view.odd = -1;
          sync();
          st.cap = othersPhrase(a, otherVal(st.items, o, a));
          sync();
          await narrate(st.cap, 1500);
          if (!live(t) || !(await point(cards[o], t))) return;
          st.view.odd = o;
          sync();
          await narrate(`This one is different. It is ${reasonPhrase(a, st.items[o][a])}.`, 2000);
          if (!live(t)) return;
          if (st.mode === 2) {
            st.sel = o;
            sync();
            await sleep(300);
            const chip = chipBtn(a);
            if (!(await point(chip, t))) return;
            chip.classList.add('glow');
            await narrate('That is the reason!', 1400);
          }
        } else if (st.mode === 4) {
          for (const { i, a } of st.order) {
            await narrate(`Find ${reasonPhrase(a, st.items[i][a])}.`, 1500);
            if (!live(t) || !(await point(cards[i], t))) return;
            cards[i].classList.add('hop');
            mark(i, a);
            st.cap = othersPhrase(a, otherVal(st.items, i, a));
            sync();
            await narrate('Found it!', 1300);
            if (!live(t)) return;
            st.cap = '';
            sync();
          }
          await narrate('Every one is odd for its own reason!', 1800);
        } else {
          for (const { i, a } of st.cands) {
            if (!(await point(cards[i], t))) return;
            st.sel = i;
            sync();
            await sleep(300);
            const chip = chipBtn(a);
            if (!(await point(chip, t))) return;
            chip.classList.add('glow');
            await narrate(`This one is odd. It is ${reasonPhrase(a, st.items[i][a])}.`, 2100);
            if (!live(t)) return;
            chip.classList.remove('glow');
            mark(i, a);
            st.sel = null;
            st.cap = othersPhrase(a, otherVal(st.items, i, a));
            sync();
            await sleep(300);
          }
          await narrate('Every one gets a turn to be odd!', 1800);
        }
      } finally {
        hand.classList.remove('on');
        if (live(t)) {
          st.sel = saved.sel;
          st.done = saved.done;
          st.cap = saved.cap;
          st.view = saved.view;
          chipsFor = null;
          sync();
          if (!wasLocked && st.sel == null) say(saved.prompt);
        }
        demoing = false;
      }
    });

    run();
    return {
      destroy() {
        alive = false;
        tok++;
      },
    };
  },
};

export const _test = { gen1, gen2, gen3, cands, valid };
