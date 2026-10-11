/**
 * Game: Equal Towers & Bars  (id: equal-towers, level 3)
 *
 * Idea: comparing and combining amounts within 10, moving from real-looking things to pictures to bars
 * (concrete -> pictorial -> abstract). Towers of equal height: pp. 267-268 and 279-280 of the book.
 * Rounds (fresh random numbers every time):
 *   1. Bear's and Bunny's towers (2-6 blocks, 1-3 apart): tap + on the shorter tower until both are
 *      the same height, then "How many more did we need?" (chips 1-6).
 *   2. Towers of 2-9 blocks, 2-5 apart, with + and -: add to the shorter or take off the taller, then
 *      "How many more...?" or "How many fewer...?" (whichever she did).
 *   3. A picture story: two groups of 2-6 things (total 5-10), "Count the ... How many apples?" (chips 1-10);
 *      the prompt has no numbers and each group's count badge appears only after she answers.
 *   4. Part-whole bars in units, two steps: two parts slide together, "How many in all?" (total 6-10);
 *      then the whole and one part are given, "How many are blue?" (missing part).
 *   5. Comparison bars, two steps: Lion 5-10 vs Mouse (2-5 fewer), the extra piece highlighted as the last
 *      cells of Lion's bar (Mouse's bar stays short, so objects always match each character's number),
 *      "How many more does Lion have?"; then Lion and "3 more than Mouse" are given, find Mouse.
 *   Rounds 4-5 have a "Show objects" toggle so the grown-up can step back to countable things (CPA).
 * Watch demo: replays the current step with the same numbers, counting on aloud (towers: adds or takes
 *   off blocks; story and bars: numbers the units), glows the right chip, then resets the step.
 * Notes:
 *   - All numbers come from makeRound(); checkStep() re-derives every answer and bound. Brute-forced in Node
 *     (200 000 rounds each): always solvable, answers 1-5 (towers) / 1-10 (others), every prompt <= 12 words.
 *   - Strong hint (2nd miss in a row): the cells that make up the answer are numbered 1..n and glow
 *     (rounds 4-5 also switch objects on). Tower building: 2 misses glow the right + / - buttons.
 *   - Test hooks (plain markup, no exports used by tests): .tw[data-who] .blk(.new/.gone) .pm button,
 *     .chips .chip[data-n], .grp .item, .seg(.unk/.extra) .cell, .row[data-who], .objbtn, .next.
 *   - `tok` is bumped whenever a step is (re)drawn so stale async work (demo, cheers) stops itself.
 */
import { h, sleep, rand, say, sfx, resumeRound } from '../lib/core.js';

const ID = 'equal-towers';
const ROUNDS = 5;
const FOLK = [
  { who: 'bear', name: 'Bear', emoji: '🐻', color: '#ffb36b' },
  { who: 'bunny', name: 'Bunny', emoji: '🐰', color: '#8fd8f5' },
];
const STORIES = [
  { a: '🍎', b: '🍏', wa: 'red apples', wb: 'green apples', all: 'apples' },
  { a: '🌷', b: '🌻', wa: 'tulips', wb: 'sunflowers', all: 'flowers' },
  { a: '🐥', b: '🦆', wa: 'chicks', wb: 'ducks', all: 'birds' },
];
const TALK = [
  ['Which tower is taller? How many more?', 'Could we make them the same another way?'],
  ['Which tower has fewer? How many fewer?', 'Is "3 more" the same as "3 fewer"?'],
  ['Can you tell the story another way?', 'What if one more came along?'],
  ['What does the long bar stand for?', 'Can you tell a story for these bars?'],
  ['Who has more? How many more?', 'How many fewer does Mouse have?'],
];
const CHEERS = ['Yes!', 'Lovely!', 'You got it!', 'Well spotted!'];

// ---------- round data (pure) ----------
const between = (lo, hi) => lo + rand(hi - lo + 1);
const words = (s) => s.trim().split(/\s+/).length;

const TOWER_PROMPTS = [
  'Make the towers the same height. Tap + to add.',
  'Make them the same. Add blocks, or take some off.',
];
// Towers: [lo, hi] heights, [dLo, dHi] difference. The shorter tower is random.
function genTowers(i) {
  const [lo, hi, dLo, dHi] = i === 0 ? [2, 6, 1, 3] : [2, 9, 2, 5];
  const s = between(lo, hi - dLo);
  const d = between(dLo, Math.min(dHi, hi - s));
  const hs = rand(2) ? [s, s + d] : [s + d, s];
  return { kind: 'tower', canTake: i === 1, hs, ans: d, chips: 6, prompt: TOWER_PROMPTS[i] };
}
const mk = (kind, fields, prompt) => ({ kind, chips: 10, ...fields, prompt });
function genStory() {
  const st = STORIES[rand(STORIES.length)];
  const a = between(2, 6);
  const b = between(Math.max(2, 5 - a), Math.min(6, 10 - a));
  // Pictorial step: the prompt names no numbers, she counts the pictures (badges appear after she answers).
  return mk('story', { st, a, b, ans: a + b }, `Count the ${st.wa} and ${st.wb}. How many ${st.all}?`);
}
// Part-whole bars: parts are red and blue marbles; `unk` is 'whole' (step 1) or 'blue' (step 2).
function genPartWhole(step) {
  if (step === 0) {
    const r = between(2, 7);
    const b = between(Math.max(2, 6 - r), 10 - r);
    const fields = { r, b, w: r + b, unk: 'whole', ans: r + b };
    return mk('bar', fields, `${r} red marbles and ${b} blue. How many marbles in all?`);
  }
  const w = between(6, 10);
  const r = between(2, w - 2);
  return mk(
    'bar',
    { r, b: w - r, w, unk: 'blue', ans: w - r },
    `${w} marbles in all. ${r} are red. How many are blue?`,
  );
}
// Comparison bars: Lion has `big`, Mouse has `small`; `unk` is 'extra' (step 1) or 'small' (step 2).
function genCompare(step) {
  if (step === 0) {
    const big = between(5, 10);
    const d = between(2, Math.min(5, big - 2));
    const fields = { big, small: big - d, d, unk: 'extra', ans: d };
    return mk('cmp', fields, `Lion has ${big} berries, Mouse ${big - d}. How many more does Lion have?`);
  }
  const big = between(6, 10);
  const d = between(2, 4);
  const fields = { big, small: big - d, d, unk: 'small', ans: big - d };
  return mk('cmp', fields, `Lion has ${big} berries, ${d} more than Mouse. Mouse has how many?`);
}
function makeRound(i) {
  if (i < 2) return [genTowers(i)];
  if (i === 2) return [genStory()];
  if (i === 3) return [genPartWhole(0), genPartWhole(1)];
  return [genCompare(0), genCompare(1)];
}
// Independent re-check of one step: bounds, the answer, the chips and the prompt length.
function checkStep(s) {
  const inR = (x, lo, hi) => Number.isInteger(x) && x >= lo && x <= hi;
  let ok;
  if (s.kind === 'tower') ok = s.hs.every((x) => inR(x, 2, 9)) && s.ans === Math.abs(s.hs[0] - s.hs[1]) && s.ans > 0;
  else if (s.kind === 'story') ok = inR(s.a, 2, 6) && inR(s.b, 2, 6) && inR(s.ans, 5, 10) && s.ans === s.a + s.b;
  else if (s.kind === 'bar')
    ok =
      s.r >= 2 && s.b >= 1 && s.r + s.b === s.w && inR(s.w, 6, 10) && s.ans === (s.unk === 'whole' ? s.w : s.w - s.r);
  else
    ok =
      s.small >= 2 &&
      s.big <= 10 &&
      s.big - s.small === s.d &&
      s.d >= 2 &&
      s.ans === (s.unk === 'extra' ? s.big - s.small : s.big - s.d);
  return ok && inR(s.ans, 1, s.chips) && words(s.prompt) <= 12;
}
export const _test = { makeRound, checkStep, TOWER_PROMPTS };

// ---------- styles ----------
const CSS = `
.a-${ID}{--u:min(44px,calc((100vw - 130px) / 10));--bh:30px;width:100%;max-width:760px;display:flex;flex-direction:column;align-items:center;gap:12px}
.a-${ID} .board{width:100%;display:flex;flex-direction:column;align-items:center;gap:10px}
.a-${ID} .towers{display:flex;gap:clamp(24px,10vw,90px);justify-content:center;align-items:flex-end}
.a-${ID} .tw{display:flex;flex-direction:column;align-items:center;gap:6px}
.a-${ID} .col{display:flex;flex-direction:column-reverse;align-items:center;height:calc(var(--bh) * 9 + 6px);justify-content:flex-start;border-bottom:5px solid var(--ink);padding:0 10px;min-width:84px;box-sizing:border-box}
.a-${ID} .blk{position:relative;width:64px;height:var(--bh);box-sizing:border-box;border:3px solid var(--ink);border-radius:7px;margin-top:-3px;display:grid;place-items:center;font-weight:900}
.a-${ID} .blk.new{background:#9be8c6 !important;border-style:dashed}
.a-${ID} .blk.gone{background:transparent !important;border-style:dashed;opacity:.55}
.a-${ID} .blk.pop{animation:et-pop .3s}
.a-${ID} .who{display:flex;align-items:center;gap:6px;font-weight:900;font-size:1.1rem}
.a-${ID} .who .em{font-size:2rem;line-height:1}
.a-${ID} .badge{font-weight:900;background:#fff;border:3px solid var(--ink);border-radius:999px;padding:0 12px;min-width:2.2em;text-align:center}
.a-${ID} .pm{display:flex;gap:8px}
.a-${ID} .pm button{width:56px;height:56px;border-radius:50%;border:3px solid var(--ink);background:#fff;font-size:1.8rem;font-weight:900;line-height:1;cursor:pointer;box-shadow:0 3px 0 rgba(43,45,66,.18)}
.a-${ID} .pm button:disabled{opacity:.4;cursor:default}
.a-${ID} .story{display:flex;flex-wrap:wrap;gap:12px;justify-content:center;align-items:center}
.a-${ID} .grp{display:flex;flex-direction:column;align-items:center;gap:6px;background:#fff;border:3px solid var(--ink);border-radius:20px;padding:10px 12px}
.a-${ID} .items{display:grid;grid-template-columns:repeat(3,48px);gap:4px}
.a-${ID} .item{position:relative;font-size:2.2rem;line-height:48px;text-align:center}
.a-${ID} .plus{font-size:2rem;font-weight:900}
.a-${ID} .grp .badge{visibility:hidden}
.a-${ID} .story.done .badge{visibility:visible;animation:et-pop .3s}
.a-${ID} .bars{display:flex;flex-direction:column;gap:6px;background:#fff;border:3px solid var(--ink);border-radius:20px;padding:12px 14px;max-width:100%;box-sizing:border-box}
.a-${ID} .row{display:flex;align-items:center;gap:8px}
.a-${ID} .row .em{width:40px;font-size:1.9rem;text-align:center;flex:none}
.a-${ID} .track{display:flex}
/* Bars: the outline is a box-shadow so it takes no width; a bar of n units is exactly n * --u wide and lines up. */
.a-${ID} .seg{display:flex;height:44px;box-shadow:0 0 0 3px var(--ink);border-radius:4px;transition:margin .6s cubic-bezier(.4,.1,.2,1)}
.a-${ID} .track{padding:3px}
.a-${ID} .track.apart .seg+.seg{margin-left:30px}
.a-${ID} .cell{position:relative;width:var(--u);flex:none;box-sizing:border-box;border-right:2px solid rgba(43,45,66,.35);display:grid;place-items:center}
.a-${ID} .cell:last-child{border-right:0}
.a-${ID} .unk .cell{border-right-color:transparent}
.a-${ID}.objs .unk .cell{border-right-color:rgba(43,45,66,.2)}
.a-${ID} .ob{display:none;font-size:calc(var(--u) * .62);line-height:1}
.a-${ID} .ob.dot{width:calc(var(--u) * .6);height:calc(var(--u) * .6);border-radius:50%;background:var(--dc);border:2px solid var(--ink);box-sizing:border-box}
.a-${ID}.objs .ob{display:block}
.a-${ID} .red{background:#ffc9d6;--dc:#ef476f}.a-${ID} .blue{background:#c9ecfb;--dc:#118ab2}
.a-${ID} .lion{background:#ffd8a8}.a-${ID} .mouse{background:#e3d9f7}
.a-${ID} .seg.extra{background:#fff3c4;box-shadow:0 0 0 3px #e0a800,0 0 0 7px rgba(255,209,102,.5)}
.a-${ID} .labs{display:flex;padding:0 3px;font-weight:900;font-size:1.25rem}
.a-${ID} .labs span{text-align:center;flex:none}
.a-${ID} .whole{box-sizing:border-box;border:3px solid var(--ink);border-bottom:0;height:16px;border-radius:10px 10px 0 0;position:relative;margin:26px 3px 0;transition:opacity .4s}
.a-${ID} .whole b{position:absolute;left:50%;top:-30px;transform:translateX(-50%);background:#fff;border:3px solid var(--ink);border-radius:999px;padding:0 10px;font-size:1.15rem}
.a-${ID} .whole.hide{opacity:0}
.a-${ID} .num{position:absolute;left:50%;top:50%;z-index:2;--s:min(24px,calc(var(--u) - 2px));width:var(--s);height:var(--s);margin:calc(var(--s) / -2) 0 0 calc(var(--s) / -2);border-radius:50%;background:var(--ink);color:#fff;font-size:.8rem;font-weight:900;display:grid;place-items:center;pointer-events:none;animation:et-pop .3s}
.a-${ID} .cell.glow{box-shadow:inset 0 0 0 3px var(--yellow);background:rgba(255,209,102,.4)}
.a-${ID} .chips{display:flex;flex-wrap:wrap;gap:8px;justify-content:center;max-width:420px}
.a-${ID} .chips .chip{font-size:1.6rem;font-weight:900;font-family:inherit;color:var(--ink)}
.a-${ID} .tools{display:flex;flex-wrap:wrap;gap:10px;justify-content:center;min-height:56px}
.a-${ID} .tools .btn{min-height:56px;font-size:1rem}
.a-${ID} .objbtn[aria-pressed=true]{background:var(--yellow)}
.a-${ID} .glow{box-shadow:0 0 0 5px rgba(255,209,102,.95)}
@keyframes et-pop{0%{transform:scale(.5)}60%{transform:scale(1.15)}100%{transform:scale(1)}}
@media (max-width:420px){.a-${ID}{--bh:24px}.a-${ID} .blk{width:54px}.a-${ID} .grp{padding:8px}.a-${ID} .story{gap:6px}.a-${ID} .items{grid-template-columns:repeat(3,32px)}.a-${ID} .item{font-size:1.55rem;line-height:36px}}
`;

export default {
  id: ID,
  rounds: ROUNDS,
  parentNote:
    'First she makes two towers the same height and says how many more (or fewer) one had; then the same ideas come back as a picture story and as bars made of units. "How many more?" is the hard question for young children: they often just name the bigger number. Use "Show objects" in the bar rounds whenever she needs to step back to things she can count, and ask her to tell the story the bars stand for.',
  talkPrompts: [
    'Which tower is taller? How many more?',
    'Can you tell the story another way?',
    'What does the long bar stand for?',
  ],

  async start(api) {
    let alive = true;
    let round = resumeRound(api, ROUNDS);
    let steps = [];
    let si = 0; // step within the round
    let S = null; // current step data
    let tok = 0;
    let miss = 0;
    let asked = false; // chips are showing
    let objs = false; // "Show objects" is on
    let towers = []; // tower state: { f, base, added, removed, el }
    api.css(CSS);

    const board = h('div', { class: 'board' });
    const chips = h('div', { class: 'chips', role: 'group', 'aria-label': 'Answers' });
    const objBtn = h(
      'button',
      { class: 'btn objbtn', type: 'button', 'aria-pressed': 'false', onclick: () => setObjs(!objs) },
      '🔵 Show objects',
    );
    const nextBtn = h('button', { class: 'btn primary next', type: 'button', onclick: () => next() }, 'Next ▶');
    const wrap = h('div', { class: `a-${ID}` }, board, chips, h('div', { class: 'tools' }, objBtn, nextBtn));
    api.root.append(wrap);

    const live = (t) => alive && t === tok;
    const capped = (p, ms = 6000) => Promise.race([p, sleep(ms)]);
    const unglow = () => wrap.querySelectorAll('.glow').forEach((e) => e.classList.remove('glow'));
    const clearNums = () => wrap.querySelectorAll('.num').forEach((e) => e.remove());
    function setObjs(on) {
      objs = on;
      wrap.classList.toggle('objs', on);
      objBtn.setAttribute('aria-pressed', String(on));
      objBtn.textContent = on ? '🔢 Hide objects' : '🔵 Show objects';
    }
    // Put a little number badge on each cell, one by one (optionally spoken), starting at `from`.
    async function numberCells(cells, from = 1, { delay = 0, speak = false, glow = false, t = tok } = {}) {
      for (let k = 0; k < cells.length; k++) {
        if (!live(t)) return false;
        cells[k].querySelector('.num')?.remove();
        cells[k].append(h('span', { class: 'num' }, String(from + k)));
        if (glow) cells[k].classList.add('glow');
        if (delay) {
          sfx('tick');
          if (speak) say(String(from + k));
          await sleep(delay);
        }
      }
      return live(t);
    }

    // ---------- towers (rounds 1-2) ----------
    const height = (T) => T.base - T.removed + T.added;
    function drawTower(T, pop) {
      const blocks = [];
      for (let k = 0; k < T.base; k++) {
        const gone = k >= T.base - T.removed;
        blocks.push(h('div', { class: 'blk' + (gone ? ' gone' : ''), style: { background: T.f.color } }));
      }
      for (let k = 0; k < T.added; k++) blocks.push(h('div', { class: 'blk new' }));
      if (pop) blocks[pop === 'top' ? blocks.length - 1 : T.base - T.removed]?.classList.add('pop');
      T.col.replaceChildren(...blocks);
      T.badge.textContent = height(T);
    }
    function renderTowers() {
      towers = S.hs.map((n, k) => {
        const f = FOLK[k];
        const T = { f, base: n, added: 0, removed: 0 };
        T.col = h('div', { class: 'col', role: 'img', 'aria-label': `${f.name}'s tower` });
        T.badge = h('span', { class: 'badge', 'aria-live': 'polite' });
        T.plus = h(
          'button',
          { type: 'button', 'aria-label': `Add a block to ${f.name}'s tower`, onclick: () => plus(T) },
          '+',
        );
        T.minus = h(
          'button',
          {
            type: 'button',
            'aria-label': `Take a block off ${f.name}'s tower`,
            hidden: !S.canTake,
            onclick: () => minus(T),
          },
          '−',
        );
        T.el = h(
          'div',
          { class: 'tw', 'data-who': f.who },
          T.col,
          h('div', { class: 'who' }, h('span', { class: 'em', 'aria-hidden': 'true' }, f.emoji), f.name, T.badge),
          h('div', { class: 'pm' }, T.minus, T.plus),
        );
        drawTower(T);
        return T;
      });
      board.replaceChildren(
        h(
          'div',
          { class: 'towers' },
          towers.map((T) => T.el),
        ),
      );
    }
    const tookOff = () => towers.some((T) => T.removed > 0);
    const other = (T) => towers[1 - towers.indexOf(T)];
    function towerMiss(text) {
      miss++;
      api.nudge(text);
      if (miss >= 2) {
        const [lo, hi] = height(towers[0]) < height(towers[1]) ? towers : [towers[1], towers[0]];
        lo.plus.classList.add('glow');
        if (S.canTake) hi.minus.classList.add('glow');
      }
    }
    // + restores a block taken off this tower, else adds a new one if this tower is the shorter one.
    function plus(T, demo = false) {
      if (asked || (!demo && busy())) return;
      if (T.removed) T.removed--;
      else if (height(T) < height(other(T))) T.added++;
      else return towerMiss('That tower is taller. Add to the shorter one.');
      return afterMove(T, 'top');
    }
    // - takes back a new block, else takes a block off this tower if it is the taller one (round 2 only).
    function minus(T, demo = false) {
      if (asked || (!demo && busy())) return;
      if (T.added) T.added--;
      else if (height(T) > height(other(T))) T.removed++;
      else return towerMiss('That tower is shorter. Take from the taller one.');
      return afterMove(T, 'gone');
    }
    // Says the new height; when the towers become equal, waits for that number and then asks.
    // Resolves when the question has been spoken (the demo awaits it).
    async function afterMove(T, pop) {
      miss = 0;
      unglow();
      sfx('pop');
      drawTower(T, pop);
      const equal = height(towers[0]) === height(towers[1]);
      if (equal) towers.forEach((x) => (x.plus.disabled = x.minus.disabled = true));
      const t = tok;
      await say(String(height(T)));
      if (!equal || !live(t)) return;
      await towersEqual();
    }
    function towersEqual() {
      const lo = S.hs[0] < S.hs[1] ? towers[0] : towers[1];
      // If any block was taken off, "how many fewer" still means the first difference; "how many more did
      // she need" would not (she may have added only some).
      const q = tookOff()
        ? `Same height! How many fewer blocks did ${lo.f.name} have?`
        : `Same height! How many more did ${lo.f.name} need?`;
      return ask(q);
    }

    // ---------- story (round 3) ----------
    function renderStory() {
      const grp = (n, em, lab) =>
        h(
          'div',
          { class: 'grp', role: 'img', 'aria-label': lab },
          h(
            'div',
            { class: 'items' },
            Array.from({ length: n }, () => h('span', { class: 'item' }, em)),
          ),
          h('span', { class: 'badge' }, n),
        );
      board.replaceChildren(
        h(
          'div',
          { class: 'story' },
          grp(S.a, S.st.a, S.st.wa),
          h('span', { class: 'plus', 'aria-hidden': 'true' }, '+'),
          grp(S.b, S.st.b, S.st.wb),
        ),
      );
    }

    // ---------- bars (rounds 4-5) ----------
    const seg = (n, cls, o) =>
      h(
        'div',
        { class: 'seg ' + cls },
        Array.from({ length: n }, () =>
          h('span', { class: 'cell' }, h('span', { class: 'ob' + (o ? '' : ' dot'), 'aria-hidden': 'true' }, o || '')),
        ),
      );
    const labs = (items) =>
      h(
        'div',
        { class: 'labs' },
        items.map(([n, txt]) => h('span', { style: { width: `calc(var(--u) * ${n})` } }, txt)),
      );
    function renderBars() {
      if (S.kind === 'bar') {
        const track = h(
          'div',
          { class: 'track' + (S.unk === 'whole' ? ' apart' : '') },
          seg(S.r, 'red'),
          seg(S.b, 'blue' + (S.unk === 'blue' ? ' unk' : '')),
        );
        const whole = h(
          'div',
          { class: 'whole' + (S.unk === 'whole' ? ' hide' : ''), style: { width: `calc(var(--u) * ${S.w})` } },
          h('b', {}, S.unk === 'whole' ? '?' : S.w),
        );
        board.replaceChildren(
          h(
            'div',
            { class: 'bars', role: 'img', 'aria-label': 'A bar in two parts, red and blue' },
            whole,
            track,
            labs([
              [S.r, S.r],
              [S.b, S.unk === 'blue' ? '?' : S.b],
            ]),
          ),
        );
        if (S.unk === 'whole') {
          const t = tok;
          sleep(700).then(() => {
            if (!live(t)) return;
            track.classList.remove('apart');
            sfx('whoosh');
            sleep(650).then(() => live(t) && whole.classList.remove('hide'));
          });
        }
        return;
      }
      const row = (who, em, ...kids) =>
        h(
          'div',
          { class: 'row', 'data-who': who },
          h('span', { class: 'em', 'aria-hidden': 'true' }, em),
          h('div', {}, ...kids),
        );
      // Lion's bar = Mouse's amount + the extra piece (its last d cells), so every bar shows exactly its
      // character's number of objects; Mouse's bar stays short.
      const sm = S.unk === 'small';
      const lionWhole = h('div', { class: 'whole', style: { width: `calc(var(--u) * ${S.big})` } }, h('b', {}, S.big));
      board.replaceChildren(
        h(
          'div',
          { class: 'bars', role: 'img', 'aria-label': 'Two bars: Lion and Mouse' },
          row(
            'lion',
            '🦁',
            lionWhole,
            h('div', { class: 'track' }, seg(S.small, 'lion', '🍓'), seg(S.d, 'lion extra' + (sm ? '' : ' unk'), '🍓')),
            labs([
              [S.small, ''],
              [S.d, sm ? `${S.d} more` : '?'],
            ]),
          ),
          row(
            'mouse',
            '🐭',
            h('div', { class: 'track' }, seg(S.small, 'mouse' + (sm ? ' unk' : ''), '🍓')),
            labs([[S.small, sm ? '?' : S.small]]),
          ),
        ),
      );
    }

    // ---------- asking and answering ----------
    function ask(text) {
      asked = true;
      chips.replaceChildren(
        ...Array.from({ length: S.chips }, (_, k) =>
          h('button', { class: 'chip', type: 'button', 'data-n': k + 1, onclick: () => answer(k + 1) }, String(k + 1)),
        ),
      );
      chips.hidden = false;
      return api.prompt(text);
    }
    // The cells whose count is the answer (numbered by the strong hint and the demo).
    function answerCells() {
      const q = (sel) => [...board.querySelectorAll(sel)];
      if (S.kind === 'tower') return q('.blk.new, .blk.gone');
      if (S.kind === 'story') return q('.item');
      if (S.kind === 'bar') return q(S.unk === 'whole' ? '.cell' : '.seg.unk .cell');
      return q(S.unk === 'extra' ? '.seg.extra .cell' : '[data-who=mouse] .mouse .cell');
    }
    function hint1() {
      if (S.kind === 'tower') {
        if (!tookOff()) return 'Count the new green blocks.';
        return towers.some((T) => T.added)
          ? 'Count the new blocks and the empty ones.'
          : 'Count the blocks we took off.';
      }
      if (S.kind === 'story') return `Count them all. Start with the ${S.st.wa}.`;
      if (S.kind === 'bar')
        return S.unk === 'whole' ? 'Put both parts together. Count them all.' : `Start at ${S.r}. Count on to ${S.w}.`;
      return S.unk === 'extra'
        ? 'Look at the yellow piece. How long is it?'
        : `Lion's ${S.big}, but take away the ${S.d} extra.`;
    }
    const busy = () => wrap.closest('.demo-running') !== null;
    let lastCheer = '';
    const pickCheer = () => {
      const opts = CHEERS.filter((c) => c !== lastCheer);
      lastCheer = opts[rand(opts.length)];
      return lastCheer;
    };
    async function answer(n) {
      if (!asked || busy()) return;
      sfx('tap');
      if (n !== S.ans) {
        miss++;
        const chip = chips.querySelector(`[data-n="${n}"]`);
        chip.classList.add('shake');
        setTimeout(() => chip.classList.remove('shake'), 450);
        if (miss < 2) return api.nudge(hint1());
        if (S.kind === 'bar' || S.kind === 'cmp') setObjs(true);
        clearNums();
        numberCells(answerCells(), 1, { glow: true });
        return api.nudge('Look! Count the glowing ones.');
      }
      asked = false;
      chips.querySelectorAll('.chip').forEach((c) => (c.disabled = true));
      chips.querySelector(`[data-n="${n}"]`).classList.add('sel');
      const t = tok;
      const last = si === steps.length - 1;
      const word = pickCheer();
      if (!last) {
        await capped(api.cheer(`${word} ${n}! Now another one.`), 4000);
        if (live(t)) startStep(si + 1);
        return;
      }
      board.querySelector('.story')?.classList.add('done');
      api.cheer(`${word} It is ${n}!`);
      nextBtn.hidden = false;
    }
    function next() {
      sfx('tap');
      if (round < ROUNDS - 1) startRound(round + 1);
      else api.finish();
    }

    // ---------- rounds and steps ----------
    function startStep(i) {
      tok++;
      si = i;
      S = steps[i];
      miss = 0;
      asked = false;
      chips.replaceChildren();
      chips.hidden = true;
      nextBtn.hidden = true;
      nextBtn.textContent = round < ROUNDS - 1 ? 'Next ▶' : 'Finish ⭐';
      objBtn.hidden = round < 3;
      unglow();
      if (S.kind === 'tower') {
        renderTowers();
        api.prompt(S.prompt);
        return;
      }
      if (S.kind === 'story') renderStory();
      else renderBars();
      ask(S.prompt);
    }
    function startRound(i) {
      round = i;
      api.stage(i, ROUNDS);
      api.setTalk(TALK[i]);
      steps = makeRound(i);
      startStep(0);
    }

    // ---------- watch demo: replay the current step, count on aloud, then hand it back ----------
    const narr = async (text, ms = 300) => {
      await capped(api.prompt(text), 7000);
      await sleep(ms);
    };
    api.setDemo(async () => {
      const keepObjs = objs;
      startStep(si);
      const t = tok;
      const ok = () => live(t);
      if (S.kind === 'tower') {
        const [lo, hi] = S.hs[0] < S.hs[1] ? towers : [towers[1], towers[0]];
        const take = S.canTake;
        await narr(`${lo.f.name} has ${lo.base}. ${hi.f.name} has ${hi.base}.`);
        if (!ok()) return;
        await narr(take ? `Take blocks off ${hi.f.name}'s tower.` : `Add blocks to ${lo.f.name}'s tower.`, 200);
        while (ok() && height(lo) !== height(hi)) {
          // Each move says the height; the last one also asks the question. Wait for it.
          await (take ? minus(hi, true) : plus(lo, true));
          await sleep(height(lo) === height(hi) ? 400 : 300);
        }
      } else if (S.kind === 'bar' || S.kind === 'cmp') {
        setObjs(true);
        await sleep(S.unk === 'whole' ? 1500 : 400);
      }
      if (!ok()) return;
      const cells = answerCells();
      if (S.kind === 'story' || (S.kind === 'bar' && S.unk === 'whole')) {
        const a = S.kind === 'story' ? S.a : S.r;
        await narr(`${a}... and count on.`, 100);
        if (
          !ok() ||
          !(await numberCells(cells.slice(0, a), 1)) ||
          !(await numberCells(cells.slice(a), a + 1, { delay: 750, speak: true, t }))
        )
          return;
      } else if (S.kind === 'bar') {
        await narr(`Start at ${S.r}. Count on to ${S.w}.`, 100);
        if (!(await numberCells(cells, S.r + 1, { delay: 750, speak: true, t }))) return;
        await narr(`${S.ans} are blue.`, 100);
      } else if (S.kind === 'cmp') {
        await narr(
          S.unk === 'extra' ? 'Count the extra piece.' : `Take away Lion's extra ${S.d}. Count Mouse's part.`,
          100,
        );
        if (!(await numberCells(cells, 1, { delay: 750, speak: true, t }))) return;
      } else {
        await narr('Count the blocks that changed.', 100);
        if (!(await numberCells(cells, 1, { delay: 750, speak: true, t }))) return;
      }
      if (!ok()) return;
      const chip = chips.querySelector(`[data-n="${S.ans}"]`);
      chip?.classList.add('glow');
      await narr(`It is ${S.ans}!`, 1200);
      if (!ok()) return;
      setObjs(keepObjs);
      startStep(si);
    });

    startRound(round);
    return {
      destroy() {
        alive = false;
      },
    };
  },
};
