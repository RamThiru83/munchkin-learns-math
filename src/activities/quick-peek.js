/**
 * Game: Quick Peek  (id: quick-peek, level 1)
 *
 * Idea: subitizing, seeing small amounts at a glance, and seeing 5 and 10 as units (a full row of a ten-frame
 *   is five). Inspired by the dice-face game "Flip the Dice"; ten-frames as in early-years number-sense guides.
 * Rounds (each round is a short run of cards; a card flips open for PEEK_MS, then turns face down and she taps a
 *   number chip; "👀 Peek again" opens it again at any time with no penalty):
 *   1. Three dice faces showing 1, 2 and 3 (in random order). Chips 1-5.
 *   2. Three cards of 2-5 dots: one dice face and two scattered (non-dice) arrangements. Chips 1-5.
 *   3. Two five-frames (a row of 5 squares, 1-4 filled from the left): "How many dots?" then "How many empty?".
 *   4. Three ten-frames with 6-10 dots (top row full, then "and 2 more"): how many altogether? Chips 1-10.
 *   5. Three ten-frames with 3-9 dots: "How many more to make 10?" (the missing part). Chips 1-10.
 * Watch demo: opens the current card, lights up its groups while saying what it sees ("A full row is five... and
 *   two more makes seven"), glows the right chip, then turns the card back over and peeks again for the child.
 * Notes:
 *   - Cards come from the pure makeRound(i); answerOf(card, ask) recounts from the drawn cells/pips. Verified in
 *     Node by brute force over 20 000 rounds per level: answers always on a chip, distinct values within a round,
 *     scattered pips never form a dice pattern (turned-around 2 and 3 included) and never overlap (min centre gap 66 > 2r = 48 SVG units).
 *     The same checks are exported as `_test` (makeRound, answerOf, checkRound).
 *   - Test hooks (plain state, no special test code): .board[data-ask] is total | empty | missing; the drawn card
 *     has .pip (dots) and .cell (frame squares, .cell.on when filled); chips are buttons named by their numeral.
 *   - First miss: gentle nudge and the Peek button hops. Second miss in a row: the card stays open, its groups light
 *     up and the right chip glows (.glow). Nothing is ever lost.
 *   - `tok` is bumped whenever a card (re)starts, so stale peek timers and demo steps stop themselves.
 */
import { h, sleep, shuffle, pick, rand, range, sfx, resumeRound } from '../lib/core.js';

const ID = 'quick-peek';
const ROUNDS = 5;
const PEEK_MS = 1500; // how long the card stays open on each peek
const READY_MS = 600; // pause before the first peek of a card
const WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];

// ---------- card data (pure) ----------
// Dice and scattered cards use a 3x3 grid of pip spots (index 0..8, row by row) in a 300x300 face.
const SPOT = (i) => [60 + (i % 3) * 90, 60 + Math.floor(i / 3) * 90];
const DICE = { 1: [4], 2: [2, 6], 3: [2, 4, 6], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8] };
const PIP_R = 24;
const JITTER = 12; // scattered pips move up to this far from their spot (spots are 90 apart)
// Dice patterns, including the turned-around versions (a 2 or 3 on the other diagonal still looks like a die).
const DICE_LIKE = {
  2: [
    [2, 6],
    [0, 8],
  ],
  3: [
    [2, 4, 6],
    [0, 4, 8],
  ],
  4: [[0, 2, 6, 8]],
  5: [[0, 2, 4, 6, 8]],
};
const sameSet = (a, b) => a.length === b.length && [...a].sort().join() === [...b].sort().join();

const dice = (n) => ({ kind: 'dice', n, pips: DICE[n].map(SPOT) });
function scatter(n) {
  let spots;
  do spots = shuffle(range(9)).slice(0, n);
  while (DICE_LIKE[n].some((d) => sameSet(spots, d)));
  const j = () => rand(2 * JITTER + 1) - JITTER;
  return { kind: 'scatter', n, spots, pips: spots.map(SPOT).map(([x, y]) => [x + j(), y + j()]) };
}
// Frames are filled in reading order: the top row first, then the next row.
const frame = (size, n) => ({ kind: size === 5 ? 'five' : 'ten', n, cells: range(size).map((i) => i < n) });

// asks: what she is asked about each card, in order.
function makeRound(i) {
  if (i === 0) return { chips: 5, cards: shuffle([1, 2, 3]).map((n) => ({ ...dice(n), asks: ['total'] })) };
  if (i === 1) {
    const ns = shuffle([2, 3, 4, 5]).slice(0, 3);
    const kinds = shuffle(['dice', 'scatter', 'scatter']);
    return {
      chips: 5,
      cards: ns.map((n, k) => ({ ...(kinds[k] === 'dice' ? dice(n) : scatter(n)), asks: ['total'] })),
    };
  }
  if (i === 2)
    return {
      chips: 5,
      cards: shuffle([1, 2, 3, 4])
        .slice(0, 2)
        .map((n) => ({ ...frame(5, n), asks: ['total', 'empty'] })),
    };
  if (i === 3)
    return {
      chips: 10,
      cards: shuffle([6, 7, 8, 9, 10])
        .slice(0, 3)
        .map((n) => ({ ...frame(10, n), asks: ['total'] })),
    };
  return {
    chips: 10,
    cards: shuffle(range(7, 3))
      .slice(0, 3)
      .map((n) => ({ ...frame(10, n), asks: ['missing'] })),
  };
}

// The answer, recounted from what is actually drawn (not from card.n).
function answerOf(card, ask) {
  if (card.pips) return card.pips.length;
  const on = card.cells.filter(Boolean).length;
  return ask === 'total' ? on : card.cells.length - on;
}

function checkRound(r) {
  const vals = r.cards.map((c) => c.n);
  if (new Set(vals).size !== vals.length) return false;
  return r.cards.every((c) => {
    if (c.pips) {
      if (c.pips.length !== c.n) return false;
      if (c.kind === 'scatter' && (DICE_LIKE[c.n].some((d) => sameSet(c.spots, d)) || new Set(c.spots).size !== c.n))
        return false;
      for (let a = 0; a < c.pips.length; a++)
        for (let b = a + 1; b < c.pips.length; b++)
          if (Math.hypot(c.pips[a][0] - c.pips[b][0], c.pips[a][1] - c.pips[b][1]) <= 2 * PIP_R) return false;
    }
    return c.asks.every((ask) => {
      const v = answerOf(c, ask);
      return v >= 1 && v <= r.chips;
    });
  });
}

// What a quick looker "sees": used for praise, the stronger hint and the demo.
function seeText(card, ask) {
  const n = answerOf(card, 'total');
  if (ask === 'missing') return `${n} dots and ${10 - n} empty. ${n} and ${10 - n} make 10.`;
  if (ask === 'empty') return `${n} dots and ${5 - n} empty make 5.`;
  if (card.kind === 'ten')
    return n === 10 ? 'Two full rows of five make ten.' : `A full row is five, and ${n - 5} more makes ${n}.`;
  if (card.kind === 'five') return n === 1 ? 'Just one dot.' : `${n} dots in a row.`;
  if (card.kind === 'dice')
    return {
      1: 'One dot in the middle.',
      2: 'Two dots, corner to corner.',
      3: 'Three in a line.',
      4: 'Two and two make four.',
      5: 'Four corners and one in the middle: five.',
    }[n];
  return n <= 3 ? `I see ${WORDS[n]} at once.` : `I see ${n > 4 ? 'three and two' : 'two and two'}: ${n}.`;
}
// The groups lit up, in order, by the demo and the stronger hint: arrays of pip / cell indexes.
function groupsOf(card, ask) {
  if (card.pips) {
    const idx = range(card.pips.length);
    if (card.kind === 'dice' && card.n === 5) return [[0, 1, 3, 4], [2]]; // four corners, then the middle
    if (card.n <= 3) return [idx];
    // scattered 4 or 5: split into a left group and a right group, so the lit groups are neighbours in space
    const byX = [...idx].sort((a, b) => card.pips[a][0] - card.pips[b][0] || card.pips[a][1] - card.pips[b][1]);
    return [byX.slice(0, 2), byX.slice(2)];
  }
  const on = range(card.cells.length).filter((k) => card.cells[k]);
  const off = range(card.cells.length).filter((k) => !card.cells[k]);
  if (ask !== 'total') return [on, off];
  return card.kind === 'ten' ? [on.slice(0, 5), on.slice(5)].filter((g) => g.length) : [on];
}

const PROMPTS = {
  total: 'Quick peek! How many dots?',
  empty: 'How many squares are empty?',
  missing: 'How many more dots to make 10?',
};
const TALK = [
  ['How did you see it so fast?', 'Which dice face looks like this?'],
  ['How did you see it so fast?', 'Did you see small groups inside?'],
  ['Can you see the five?', 'How many dots and how many empty make five?'],
  ['Can you see the five?', 'How did you know without counting?'],
  ['How many more make ten?', 'Which two numbers make ten?'],
];
const CHEERS = ['Yes!', 'You saw it!', 'Quick eyes!', 'Lovely looking!'];

// ---------- styles ----------
const CSS = `
.a-${ID}{width:100%;max-width:720px;display:flex;flex-direction:column;align-items:center;gap:14px;padding-bottom:8px}
.a-${ID} .board{display:flex;flex-direction:column;align-items:center;gap:12px;width:100%}
.a-${ID} .trail{display:flex;gap:8px;min-height:18px}
.a-${ID} .trail i{width:14px;height:14px;border-radius:50%;border:3px solid var(--ink);background:#fff}
.a-${ID} .trail i.done{background:var(--green)}.a-${ID} .trail i.now{background:var(--yellow)}
.a-${ID} .flip{position:relative;display:grid;perspective:900px;width:min(240px,64vw)}
.a-${ID} .flip.wide{width:min(460px,calc(100vw - 48px))}
.a-${ID} .inner{display:grid;transform-style:preserve-3d;transition:transform .35s ease}
.a-${ID} .flip.shut .inner{transform:rotateY(180deg)}
.a-${ID} .face,.a-${ID} .back{grid-area:1/1;backface-visibility:hidden;-webkit-backface-visibility:hidden;border:4px solid var(--ink);border-radius:24px;box-shadow:var(--shadow);box-sizing:border-box}
.a-${ID} .face{background:#fff;padding:10px;display:grid;place-items:center}
.a-${ID} .face svg{display:block;width:100%;height:auto}
.a-${ID} .back{transform:rotateY(180deg);display:grid;place-items:center;font-size:3rem;background:repeating-linear-gradient(45deg,#9b5de5 0 18px,#8a4fd6 18px 36px)}
.a-${ID} .back span{background:#fff;border:3px solid var(--ink);border-radius:50%;width:84px;height:84px;display:grid;place-items:center}
.a-${ID} .pip{fill:var(--ink);transition:fill .2s}
.a-${ID} .cell{fill:#fff8e7;stroke:var(--ink);stroke-width:5}
.a-${ID} .dot{fill:#ef476f;transition:fill .2s}
.a-${ID} .lit .pip,.a-${ID} .lit.dot{fill:#118ab2}
.a-${ID} .lit2 .pip,.a-${ID} .lit2.dot{fill:#9b5de5}
.a-${ID} .cell.lit{fill:#ffd166}
.a-${ID} .cell.lit2{fill:#c9f5e6}
.a-${ID} .nums{max-width:430px}
.a-${ID} .nums.ten{max-width:400px}
.a-${ID} .num{min-width:64px;min-height:64px;font-weight:900;font-size:2rem;color:var(--ink);font-family:inherit}
.a-${ID} .num.sel{background:var(--green)}
.a-${ID} .peek{min-height:56px;font-size:1.05rem}
@media (max-width:420px){.a-${ID} .num{min-width:58px;min-height:58px;font-size:1.8rem}.a-${ID} .act-row{gap:8px}}
`;

export default {
  id: ID,
  rounds: ROUNDS,
  parentNote:
    'A card opens for a quick look and then turns over, so she has to see the amount at once rather than count one by one. Later rounds use five- and ten-frames: a full row is five, so seven is "five and two more", and the empty squares tell how many more make ten. Peeking again is always allowed; ask "How did you see it so fast?" and listen for groups.',
  talkPrompts: ['How did you see it so fast?', 'Can you see the five?', 'How many more make ten?'],

  async start(api) {
    let alive = true,
      round = resumeRound(api, ROUNDS),
      R = null, // the current round's data from makeRound()
      ci = 0, // card index within the round
      qi = 0, // question index within the card
      tok = 0,
      wrong = 0,
      busy = false;
    api.css(CSS);

    const trail = h('div', { class: 'trail', 'aria-hidden': 'true' });
    const flip = h('div', { class: 'flip shut' });
    const peekBtn = h('button', { class: 'btn peek', type: 'button', onclick: () => peek() }, '👀 Peek again');
    const nums = h('div', { class: 'act-row nums', role: 'group', 'aria-label': 'Numbers' });
    const board = h('div', { class: 'board' }, trail, flip, peekBtn, nums);
    const wrap = h('div', { class: `a-${ID}` }, board);
    api.root.append(wrap);

    const live = (t) => alive && t === tok;
    const card = () => R.cards[ci];
    const ask = () => card().asks[qi];
    const say = (txt, ms = 400) => Promise.race([api.prompt(txt), sleep(700 + txt.length * 60)]).then(() => sleep(ms));
    const unglow = () =>
      wrap.querySelectorAll('.glow,.sel,.lit,.lit2').forEach((e) => e.classList.remove('glow', 'sel', 'lit', 'lit2'));
    const chip = (n) => nums.querySelector(`[data-n="${n}"]`);

    // ---------- drawing ----------
    let marks = []; // the SVG elements groupsOf() indexes refer to (pips or cells)
    let dots = []; // frame dots, same index as cells (null where empty)
    function drawCard(c) {
      let svg;
      if (c.pips) {
        svg = h('svg', { viewBox: '0 0 300 300' });
        marks = c.pips.map(([x, y]) => h('g', {}, h('circle', { class: 'pip', cx: x, cy: y, r: PIP_R })));
        svg.append(...marks);
        dots = [];
      } else {
        const rows = c.cells.length / 5;
        svg = h('svg', { viewBox: `0 0 520 ${rows * 100 + 20}` });
        marks = c.cells.map((on, k) =>
          h('rect', {
            class: 'cell' + (on ? ' on' : ''),
            x: 10 + (k % 5) * 100,
            y: 10 + Math.floor(k / 5) * 100,
            width: 100,
            height: 100,
            rx: 6,
          }),
        );
        dots = c.cells.map((on, k) =>
          on ? h('circle', { class: 'dot', cx: 60 + (k % 5) * 100, cy: 60 + Math.floor(k / 5) * 100, r: 34 }) : null,
        );
        svg.append(...marks, ...dots.filter(Boolean));
      }
      const face = h('div', { class: 'face' }, svg);
      const back = h('div', { class: 'back', 'aria-hidden': 'true' }, h('span', {}, '✨'));
      flip.classList.toggle('wide', !c.pips);
      flip.replaceChildren(h('div', { class: 'inner' }, face, back));
    }
    function setOpen(open) {
      flip.classList.toggle('shut', !open);
      flip.querySelector('.face')?.setAttribute('aria-hidden', String(!open));
      peekBtn.disabled = open;
    }
    // Light up group g: the first group gets .lit, later groups .lit2 (a second colour), so "five and two more"
    // or "dots and empty squares" show as two parts. Pips are lit on their <g>, frames on cell and dot.
    function light(groups, g) {
      for (const k of groups[g]) {
        const cls = g === 0 ? 'lit' : 'lit2';
        marks[k].classList.add(cls);
        dots[k]?.classList.add(cls);
      }
    }
    function drawChips() {
      nums.classList.toggle('ten', R.chips === 10);
      nums.replaceChildren(
        ...range(R.chips, 1).map((n) =>
          h('button', { class: 'chip num', type: 'button', 'data-n': n, onclick: () => choose(n) }, String(n)),
        ),
      );
    }
    function drawTrail() {
      trail.replaceChildren(...R.cards.map((_, k) => h('i', { class: k < ci ? 'done' : k === ci ? 'now' : '' })));
    }

    // ---------- flow ----------
    async function peek(t = tok) {
      if (!live(t) || !flip.classList.contains('shut')) return;
      sfx('flip');
      setOpen(true);
      await sleep(PEEK_MS);
      if (!live(t) || busy) return;
      setOpen(false);
    }
    // (Re)start question qi of card ci: draw it face down, say the question, then flip it open for a peek.
    async function startQuestion() {
      const t = ++tok;
      busy = false;
      wrong = 0;
      unglow();
      board.dataset.ask = ask();
      drawTrail();
      if (qi === 0) drawCard(card());
      setOpen(false);
      api.prompt(PROMPTS[ask()]);
      await sleep(READY_MS);
      if (live(t)) peek(t);
    }
    function startRound(i) {
      round = i;
      api.stage(i, ROUNDS);
      api.setTalk(TALK[i]);
      R = makeRound(i);
      ci = 0;
      qi = 0;
      drawChips();
      startQuestion();
    }

    async function choose(n) {
      if (busy) return;
      sfx('tap');
      const right = answerOf(card(), ask());
      if (n !== right) {
        wrong++;
        const b = chip(n);
        b.classList.add('shake');
        setTimeout(() => b.classList.remove('shake'), 450);
        if (wrong === 1) {
          peekBtn.classList.remove('hop');
          void peekBtn.offsetWidth;
          peekBtn.classList.add('hop');
          api.nudge('Not quite. Peek again and look for groups!');
          return;
        }
        // Stronger hint: keep the card open, light its groups and glow the right chip.
        tok++;
        setOpen(true);
        const gs = groupsOf(card(), ask());
        gs.forEach((_, g) => light(gs, g));
        chip(right).classList.add('glow');
        api.nudge(`Look! ${seeText(card(), ask())}`);
        return;
      }
      const t = ++tok;
      busy = true;
      unglow();
      chip(n).classList.add('sel');
      setOpen(true);
      const gs = groupsOf(card(), ask());
      gs.forEach((_, g) => light(gs, g));
      await Promise.race([api.cheer(`${pick(CHEERS)} ${seeText(card(), ask())}`), sleep(4500)]);
      await sleep(500);
      if (!live(t)) return;
      if (qi + 1 < card().asks.length) qi++;
      else if (ci + 1 < R.cards.length) {
        ci++;
        qi = 0;
      } else if (round + 1 < ROUNDS) return startRound(round + 1);
      else {
        busy = true;
        return api.finish();
      }
      startQuestion();
    }

    // ---------- watch demo ----------
    // Open the current card, light its groups while saying what we see, glow the answer, then hand it back.
    api.setDemo(async () => {
      const t = ++tok;
      busy = true;
      unglow();
      setOpen(true);
      const c = card(),
        a = ask(),
        gs = groupsOf(c, a);
      await say(a === 'total' ? 'I take a quick look.' : PROMPTS[a], 200);
      for (let g = 0; g < gs.length; g++) {
        if (!live(t)) return;
        light(gs, g);
        sfx('pop');
        await sleep(500);
      }
      if (!live(t)) return;
      await say(seeText(c, a), 300);
      if (!live(t)) return;
      chip(answerOf(c, a)).classList.add('glow');
      await say(`So I tap ${answerOf(c, a)}. Now you try!`, 900);
      if (!live(t)) return;
      startQuestion();
    });

    startRound(round);
    return {
      destroy() {
        alive = false;
        tok++;
      },
    };
  },
};

export const _test = { makeRound, answerOf, checkRound, seeText, groupsOf, DICE };
