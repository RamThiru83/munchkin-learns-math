/**
 * Game: Necklace Makers  (id: necklaces, level 5)
 *
 * Idea: systematic listing: find every different row of blue/white beads and know you have them all
 * (choose k places out of n; later, count mirror twins once).
 * Rounds (tap beads blue on the workbench, "Add to shelf"; the round ends when every pattern is on the shelf):
 *   1. 3 beads, exactly 1 blue: 3 necklaces (clasp and heart fix the ends, so order matters).
 *   2. 4 beads, exactly 2 blue: 6 necklaces.
 *   3. 5 beads, exactly 2 blue: 10 necklaces.
 *   4. 3 beads, any number of blue (none to all): 2^3 = 8 necklaces.
 *   5. 5 beads, 2 blue, no clasp: a necklace and its reversal are the same, (10 + 2 palindromes) / 2 = 6;
 *      a Flip button turns the workbench over, and adding a mirror twin flips the bench to show it.
 * Watch demo: restarts the current round and a hand makes every necklace in plan order (blue beads slide
 *   along); in round 5 it also tries the first necklace's mirror twin to show it does not count. It then
 *   resets the round empty for the child ("Your turn!").
 * Notes: after 3 finds (REVEAL_AFTER) the shelf shows "?" slots and "Found x of N". Two misses in a row light
 *   the first missing pattern's beads (.tip). Hint button cycles through the plan in a hint card and stops at
 *   the first missing one. startRound() throws if patternsFor() does not give R.expect (and C(n,k) for the
 *   fixed-k rounds): counts are verified at runtime. `token` invalidates pending async work when a round
 *   (re)starts. No exported test hooks.
 */
import { h, sleep, pick, sfx, resumeRound } from '../lib/core.js';

const ID = 'necklaces';
const ROUNDS = [
  { n: 3, k: 1, expect: 3, prompt: 'Tap a bead to make it blue. Use one blue!' },
  { n: 4, k: 2, expect: 6, prompt: 'Four beads, two blue. Make every different necklace!' },
  { n: 5, k: 2, expect: 10, prompt: 'Five beads, two blue. How many different ones?' },
  { n: 3, k: null, expect: 8, prompt: 'Any number of blue beads, even none! Make them all.' },
  { n: 5, k: 2, flip: true, expect: 6, prompt: 'No clasp now! A flipped necklace is the same one.' },
];
const FRIENDS = ['🐰', '🦊', '🐻', '🐼', '🐨', '🐯', '🐸', '🦔'];
const CHEERS = [
  'A new one!',
  'Lovely, that one is new!',
  'Ooh, another one!',
  'Pretty! Keep going.',
  'Yes, a new necklace!',
];
const WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];
// show the "Found x of N" total once this many necklaces are on the shelf
const REVEAL_AFTER = 3;
// workbench width: each bead slot (78 px bead + gap) plus the clasp/heart padding
const BEAD_SLOT_PX = 82;
const BENCH_PAD_PX = 46;

const BLUE = 'radial-gradient(circle at 34% 30%,#bde9ff 0 12%,#3fb3e6 34%,#118ab2 62%,#0a5d7a)';
const WHITE = 'radial-gradient(circle at 34% 30%,#ffffff 0 30%,#f3eee3 62%,#d9d1bf)';

const word = (n) => WORDS[n] || String(n);
const cap = (t) => t[0].toUpperCase() + t.slice(1);

// Every pattern with k blue beads out of n, in the "systematic" order:
// first blue as far left as possible, the next blue slides along, then the first moves one step.
function combos(n, k) {
  const out = [];
  const rec = (start, chosen) => {
    if (chosen.length === k) {
      out.push(Array.from({ length: n }, (_, i) => (chosen.includes(i) ? 'B' : 'W')).join(''));
      return;
    }
    for (let i = start; i < n; i++) rec(i + 1, [...chosen, i]);
  };
  rec(0, []);
  return out;
}
const rev = (p) => [...p].reverse().join('');
const nBlue = (p) => [...p].filter((c) => c === 'B').length;
// same necklace? with flip allowed a pattern equals its reversal
const keyOf = (p, flip) => (flip && rev(p) < p ? rev(p) : p);
// The round's full list in plan order (k = null: none blue, then one, two, ... all blue).
// With flip, only the first pattern of each mirror pair is kept.
function patternsFor(R) {
  let list = R.k == null ? Array.from({ length: R.n + 1 }, (_, j) => combos(R.n, j)).flat() : combos(R.n, R.k);
  if (R.flip) {
    const seen = new Set();
    list = list.filter((p) => {
      const key = keyOf(p, true);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }
  return list;
}
// n choose k, used only to cross-check patternsFor() in startRound()
const binom = (n, k) => {
  let r = 1;
  for (let i = 1; i <= k; i++) r = (r * (n - k + i)) / i;
  return r;
};

const CSS = `
.a-necklaces{width:100%;max-width:920px;display:flex;flex-direction:column;align-items:center;gap:12px;padding-bottom:8px}
.a-necklaces .goal{display:flex;align-items:center;gap:10px;flex-wrap:wrap;justify-content:center;font-weight:800;font-size:1.05rem;background:#fff;border:3px solid var(--ink);border-radius:18px;padding:6px 14px;transition:box-shadow .2s}
.a-necklaces .need{display:inline-flex;gap:5px;align-items:center}
.a-necklaces .need i{width:24px;height:24px;border-radius:50%;border:3px dashed #118ab2;display:inline-block;box-sizing:border-box;transition:background .2s}
.a-necklaces .need i.on{border:3px solid var(--ink);background:${BLUE}}
.a-necklaces .need i.over{border:3px solid var(--ink);background:${BLUE};opacity:.55;transform:scale(.85)}
.a-necklaces .bench{position:relative;display:flex;align-items:center;gap:3px;padding:6px 20px;width:100%;box-sizing:border-box;background:#fdf0dc;border:3px solid var(--ink);border-radius:999px}
.a-necklaces .bench::before,.a-necklaces .mini::before{content:'';position:absolute;left:10px;right:10px;top:50%;height:5px;margin-top:-2.5px;background:#b07d4f;border-radius:3px}
.a-necklaces .clasp{position:absolute;left:3px;top:50%;width:12px;height:12px;margin-top:-6px;border-radius:50%;border:3px solid #e0a800;box-sizing:border-box;background:#fdf0dc}
.a-necklaces .charm{position:absolute;right:3px;top:50%;transform:translateY(-52%);color:#ff5c8a;font-size:15px;line-height:1;font-weight:900}
.a-necklaces .bead{position:relative;flex:1 1 0;min-width:0;max-width:78px;aspect-ratio:1/1;border-radius:50%;border:3px solid var(--ink);padding:0;margin:0 auto;cursor:pointer;background:${WHITE};box-shadow:0 3px 0 rgba(43,45,66,.18);transition:transform .12s;-webkit-tap-highlight-color:transparent}
.a-necklaces .bead.blue{background:${BLUE}}
.a-necklaces .bead:active{transform:scale(.92)}
.a-necklaces .bead.tip{box-shadow:0 0 0 6px rgba(255,209,102,.95);animation:nk-pulse 1s ease-in-out infinite}
.a-necklaces .bead.tap{transform:scale(.88)}
@keyframes nk-pulse{50%{box-shadow:0 0 0 10px rgba(255,209,102,.55)}}
.a-necklaces .controls .btn{font-size:1.05rem}
.a-necklaces .hintcard{display:flex;align-items:center;gap:12px;flex-wrap:wrap;justify-content:center;background:#fffbe8;border:3px dashed var(--orange);border-radius:18px;padding:8px 12px;font-weight:800;max-width:100%;box-sizing:border-box}
.a-necklaces .hintcard[hidden]{display:none}
.a-necklaces .shelf{width:100%;box-sizing:border-box;background:linear-gradient(#f6e3c4,#efd5ab);border:3px solid var(--ink);border-radius:20px;padding:8px 10px 12px}
.a-necklaces .shelf.done{background:linear-gradient(#e2f9ec,#c8f1da)}
.a-necklaces .shelf-head{display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap;font-weight:900;margin:0 4px 8px}
.a-necklaces .shelf-head .count{background:#fff;border:3px solid var(--ink);border-radius:999px;padding:2px 12px;font-size:1.05rem}
.a-necklaces .shelf-row{display:flex;flex-wrap:wrap;gap:8px;justify-content:center;min-height:40px}
.a-necklaces .shelf-row .empty-note{opacity:.6;font-weight:700;align-self:center}
.a-necklaces .mini{position:relative;display:inline-flex;align-items:center;gap:3px;padding:5px 17px;background:#fff;border:3px solid var(--ink);border-radius:999px;box-sizing:border-box}
.a-necklaces .mini i{position:relative;width:20px;height:20px;border-radius:50%;border:2px solid var(--ink);background:${WHITE};box-sizing:border-box;transition:background .25s}
.a-necklaces .mini i.b{background:${BLUE}}
.a-necklaces .mini .clasp{width:9px;height:9px;margin-top:-4.5px;border-width:2px;left:3px;background:#fff}
.a-necklaces .mini .charm{font-size:11px;right:3px}
.a-necklaces .mini.big{padding:7px 22px;gap:5px}
.a-necklaces .mini.big i{width:32px;height:32px;border-width:3px}
.a-necklaces .mini.empty{border-style:dashed;background:rgba(255,255,255,.45);color:rgba(43,45,66,.45);justify-content:center;font-weight:900}
.a-necklaces .mini.empty::before{display:none}
.a-necklaces .mini.new{animation:nk-new .6s cubic-bezier(.3,1.5,.5,1)}
@keyframes nk-new{0%{transform:scale(.6)}60%{transform:scale(1.15)}}
.a-necklaces .nk-hand{position:fixed;left:0;top:0;font-size:42px;line-height:1;pointer-events:none;z-index:46;transition:transform .3s cubic-bezier(.4,.1,.2,1);filter:drop-shadow(0 3px 2px rgba(0,0,0,.25))}
.a-necklaces .btn.press{transform:translateY(3px);box-shadow:none}
.a-necklaces.flipround .clasp,.a-necklaces.flipround .charm{display:none}
.a-necklaces .bench.flipping{transition:transform .55s cubic-bezier(.4,.1,.2,1);transform:scaleX(-1)}
.a-necklaces .need em{font-style:normal;font-size:.95rem;opacity:.75}
@media (max-width:420px){.a-necklaces .mini i{width:18px;height:18px}.a-necklaces .mini.big i{width:28px;height:28px}.a-necklaces .controls .btn{font-size:.98rem;padding:.5em .9em}}
`;

// A small shelf necklace for pattern `pat` ('B'/'W' string); `big` is the hint-card size.
function mini(pat, big = false) {
  const blues = [...pat].map((c, i) => (c === 'B' ? i + 1 : 0)).filter(Boolean);
  return h(
    'div',
    {
      class: 'mini' + (big ? ' big' : ''),
      role: 'img',
      'aria-label': `Necklace with blue beads at places ${blues.join(' and ')}`,
    },
    h('span', { class: 'clasp' }),
    [...pat].map((c) => h('i', { class: c === 'B' ? 'b' : '' })),
    h('span', { class: 'charm' }, '♥'),
  );
}

export default {
  id: ID,
  rounds: ROUNDS.length,
  parentNote:
    'Each necklace is a row of beads with a clasp end and a heart end, so order matters: 5 beads with 2 blue make exactly 10, found by keeping one blue still and sliding the other along. Ask "How do you know you have them all?" — children stop when they run out of ideas, not when there are none left. Round 4 lets any number be blue (none to all: 8), and round 5 removes the clasp so a necklace may be flipped over: mirror twins now count as one, leaving 6.',
  async start(api) {
    let alive = true;
    let token = 0;
    const timers = new Set();
    const later = (fn, ms) => {
      const t = setTimeout(() => {
        timers.delete(t);
        if (alive) fn();
      }, ms);
      timers.add(t);
    };
    // speak/show a line, but never wait longer than the line needs (speech may be missing or off)
    const talk = (text, fn = api.prompt) => Promise.race([fn(text), sleep(900 + text.length * 60)]);

    api.css(CSS);
    const wrap = h('div', { class: 'a-necklaces' });
    api.root.append(wrap);
    const goal = h('div', { class: 'goal' });
    const bench = h('div', { class: 'bench', role: 'group', 'aria-label': 'Your necklace' });
    const btnClear = h('button', { class: 'btn', type: 'button', 'aria-label': 'Make all beads white' }, '⚪ Clear');
    const btnAdd = h('button', { class: 'btn primary', type: 'button' }, '➕ Add to shelf');
    const btnFlip = h(
      'button',
      { class: 'btn', type: 'button', 'aria-label': 'Flip the necklace over', hidden: true },
      '🔄 Flip',
    );
    const btnHint = h('button', { class: 'btn', type: 'button', 'aria-label': 'Hint: show me a plan' }, '💡 Hint');
    const btnNext = h('button', { class: 'btn primary', type: 'button', hidden: true }, 'Next ➜');
    const controls = h('div', { class: 'act-row controls' }, btnClear, btnFlip, btnAdd, btnHint, btnNext);
    const hintCard = h('div', { class: 'hintcard', hidden: true, 'aria-live': 'polite' });
    const shelfTitle = h('span', {});
    const countEl = h('span', { class: 'count' });
    const shelfRow = h('div', { class: 'shelf-row' });
    const shelf = h(
      'section',
      { class: 'shelf', 'aria-label': 'Shelf of necklaces' },
      h('div', { class: 'shelf-head' }, shelfTitle, countEl),
      shelfRow,
    );
    wrap.append(goal, bench, controls, hintCard, shelf);

    let round = 0;
    let R = ROUNDS[0];
    let all = [];
    let found = [];
    const items = new Map();
    const made = new Map();
    let beads = [];
    let state = [];
    let busy = false;
    let wrongRow = 0;
    let revealed = false;
    let needEl = null;

    const pattern = () => state.map((b) => (b ? 'B' : 'W')).join('');
    const blueCount = () => state.filter(Boolean).length;
    const firstMissing = () => all.find((p) => !found.includes(p));
    // replay a CSS animation class (forced reflow in between), removed again after ms
    function restartAnim(el, cls, ms) {
      el.classList.remove(cls);
      void el.offsetWidth;
      el.classList.add(cls);
      later(() => el.classList.remove(cls), ms);
    }

    function updateNeed() {
      const b = blueCount();
      if (R.k == null) {
        needEl.replaceChildren(
          ...Array.from({ length: b }, () => h('i', { class: 'on' })),
          h('em', {}, b ? `${word(b)} blue` : 'no blue'),
        );
        return;
      }
      const dots = [];
      for (let i = 0; i < R.k; i++) dots.push(h('i', { class: i < b ? 'on' : '' }));
      for (let i = R.k; i < b; i++) dots.push(h('i', { class: 'over' }));
      needEl.replaceChildren(...dots);
    }
    function paintBead(i) {
      const el = beads[i];
      el.classList.toggle('blue', state[i]);
      el.setAttribute('aria-pressed', String(state[i]));
      el.setAttribute('aria-label', `Bead ${i + 1}, ${state[i] ? 'blue' : 'white'}`);
    }
    function toggle(i) {
      state[i] = !state[i];
      paintBead(i);
      updateNeed();
      sfx(state[i] ? 'pop' : 'tap');
    }
    function clearTips() {
      beads.forEach((b) => b.classList.remove('tip'));
    }
    // turn the necklace over: the bench mirrors, then the beads really swap ends
    async function flipBench() {
      const t = token;
      sfx('flip');
      bench.classList.add('flipping');
      await sleep(620);
      if (!alive || t !== token) return;
      state.reverse();
      beads.forEach((_, i) => paintBead(i));
      bench.style.transition = 'none';
      bench.classList.remove('flipping');
      bench.getBoundingClientRect();
      bench.style.transition = '';
    }

    function renderBench() {
      beads = state.map((_, i) =>
        h('button', {
          class: 'bead',
          type: 'button',
          onclick: () => {
            if (!busy) toggle(i);
          },
        }),
      );
      bench.style.maxWidth = R.n * BEAD_SLOT_PX + BENCH_PAD_PX + 'px';
      bench.replaceChildren(
        h('span', { class: 'clasp', 'aria-hidden': 'true' }),
        ...beads,
        h('span', { class: 'charm', 'aria-hidden': 'true' }, '♥'),
      );
      beads.forEach((_, i) => paintBead(i));
    }
    function renderShelf() {
      const kids = found.map((p) => items.get(p));
      if (revealed)
        for (let i = found.length; i < all.length; i++)
          kids.push(h('div', { class: 'mini empty', 'aria-hidden': 'true' }, '?'));
      if (!kids.length) kids.push(h('span', { class: 'empty-note' }, 'Your necklaces go here.'));
      shelfRow.replaceChildren(...kids);
      countEl.textContent = revealed ? `Found ${found.length} of ${all.length}` : `Found ${found.length}`;
    }

    // a copy of the shelf necklace flies from the workbench into its place
    function flyInto(fromEl, toEl, ms = 480) {
      toEl.scrollIntoView({ block: 'nearest' });
      const a = fromEl.getBoundingClientRect();
      const b = toEl.getBoundingClientRect();
      const c = toEl.cloneNode(true);
      Object.assign(c.style, {
        position: 'fixed',
        left: b.left + 'px',
        top: b.top + 'px',
        width: b.width + 'px',
        height: b.height + 'px',
        margin: '0',
        zIndex: '45',
        pointerEvents: 'none',
        visibility: 'visible',
        transition: 'none',
      });
      const s = Math.max(1, Math.min(a.width / b.width, 2.4));
      c.style.transform = `translate(${a.left + a.width / 2 - (b.left + b.width / 2)}px, ${a.top + a.height / 2 - (b.top + b.height / 2)}px) scale(${s})`;
      wrap.append(c);
      c.getBoundingClientRect();
      c.style.transition = `transform ${ms}ms cubic-bezier(.4,.1,.2,1)`;
      c.style.transform = 'none';
      return sleep(ms).then(() => c.remove());
    }

    function showTip() {
      const m = firstMissing();
      if (!m) return;
      clearTips();
      [...m].forEach((c, i) => {
        if (c === 'B') beads[i].classList.add('tip');
      });
    }
    function wrong(msg, tipMsg) {
      wrongRow++;
      restartAnim(bench, 'shake', 450);
      if (wrongRow >= 2) {
        showTip();
        api.nudge(tipMsg);
      } else api.nudge(msg);
    }

    async function tryAdd(fromDemo = false) {
      if (busy && !fromDemo) return;
      const t = token;
      const b = blueCount();
      const pat = pattern();
      if (R.k != null && b !== R.k) {
        restartAnim(goal, 'glow', 1200);
        const msg =
          b < R.k
            ? R.k === 1
              ? 'Make one bead blue first.'
              : `This needs ${word(R.k)} blue beads. Tap ${word(R.k - b)} more.`
            : `Only ${word(R.k)} blue, please. Make ${word(b - R.k)} white again.`;
        wrong(msg, `Use ${word(R.k)} blue. Try the shining spots!`);
        return;
      }
      const key = keyOf(pat, R.flip);
      if (found.includes(key)) {
        const twin = items.get(key);
        twin.scrollIntoView({ block: 'nearest' });
        twin.classList.add('glow');
        restartAnim(twin, 'hop', 600);
        later(() => twin.classList.remove('glow'), 1800);
        if (made.get(key) !== pat) {
          // a mirror twin: show it by flipping the necklace over
          wrongRow++;
          busy = true;
          api.nudge(
            wrongRow >= 2
              ? 'Flipped, it is the same! Try the shining spots.'
              : 'Flip it over. It is the same as this one!',
          );
          await flipBench();
          if (!alive || t !== token) return;
          if (wrongRow >= 2) showTip();
          if (!fromDemo) busy = false;
          return;
        }
        wrong('You already made that one! Try moving one blue bead.', 'You made that one. Try the shining spots!');
        return;
      }
      wrongRow = 0;
      clearTips();
      hintCard.hidden = true;
      const justRevealed = !revealed && found.length + 1 >= Math.min(REVEAL_AFTER, all.length);
      found.push(key);
      made.set(key, pat);
      const el = mini(pat);
      items.set(key, el);
      if (justRevealed) revealed = true;
      renderShelf();
      el.style.visibility = 'hidden';
      busy = true;
      sfx('whoosh');
      restartAnim(btnAdd, 'press', 150);
      await flyInto(bench, el);
      if (!alive || t !== token) return;
      el.style.visibility = '';
      restartAnim(el, 'new', 650);
      sfx('drop');
      if (found.length === all.length) {
        await roundDone(fromDemo);
        return;
      }
      if (!fromDemo) {
        busy = false;
        api.cheer(justRevealed ? `Great! There are ${word(all.length)} different ones. Find them all!` : pick(CHEERS));
      }
    }

    async function roundDone(fromDemo) {
      const t = token;
      busy = true;
      btnClear.hidden = btnAdd.hidden = btnHint.hidden = btnFlip.hidden = true;
      const last = round === ROUNDS.length - 1;
      api.cheer(
        last
          ? `All ${word(all.length)}! You are a super necklace maker!`
          : `You found all ${word(all.length)}! Every single one!`,
      );
      await sleep(1100);
      if (!alive || t !== token) return;
      // line them up in the plan's order: no gaps, no repeats
      found = all.slice();
      all.forEach((p) => items.set(p, mini(p)));
      renderShelf();
      shelf.classList.add('done');
      sfx('flip');
      found.forEach((p, i) =>
        later(() => {
          if (t === token) restartAnim(items.get(p), 'hop', 520);
        }, i * 110),
      );
      if (fromDemo) return;
      await sleep(900 + all.length * 110);
      if (!alive || t !== token) return;
      btnNext.textContent = last ? 'All done! 🎉' : 'Next necklaces ➜';
      btnNext.hidden = false;
      btnNext.disabled = false;
      api.prompt(
        last ? `Look! All ${word(all.length)} in order. No twins!` : 'Look! In order, from left to right. Tap Next.',
      );
    }

    async function showHint() {
      if (busy) return;
      const t = token;
      busy = true;
      const ghost = mini(all[0], true);
      const label = h('span', {}, '');
      hintCard.replaceChildren(h('span', { 'aria-hidden': 'true' }, '💡'), ghost, label);
      hintCard.hidden = false;
      hintCard.scrollIntoView({ block: 'nearest' });
      await talk(
        R.k == null
          ? 'A plan: no blue, then one blue, then two, then three.'
          : R.flip
            ? 'Flipped twins count once. Keep one blue still, slide the other.'
            : R.k === 1
              ? 'A plan: blue at the start, then slide it along.'
              : 'A plan: keep one blue still, slide the other along.',
      );
      if (!alive || t !== token) return;
      for (const p of all) {
        [...ghost.querySelectorAll('i')].forEach((el, i) => el.classList.toggle('b', p[i] === 'B'));
        sfx('tick');
        await sleep(700);
        if (!alive || t !== token) return;
        if (found.includes(p)) {
          label.textContent = '✓ on the shelf';
          const tw = items.get(p);
          tw.classList.add('glow');
          await sleep(550);
          tw.classList.remove('glow');
          if (!alive || t !== token) return;
        } else {
          label.textContent = 'Not on the shelf yet!';
          ghost.classList.add('glow');
          api.prompt('This one is missing. Can you make it?');
          break;
        }
      }
      busy = false;
    }

    function startRound(i, quiet = false) {
      token++;
      round = i;
      R = ROUNDS[i];
      all = patternsFor(R);
      if (all.length !== R.expect || (R.k != null && !R.flip && all.length !== binom(R.n, R.k)))
        throw new Error('necklace count mismatch');
      found = [];
      items.clear();
      made.clear();
      state = Array(R.n).fill(false);
      busy = false;
      wrongRow = 0;
      revealed = false;
      api.stage(i, ROUNDS.length);
      needEl = h('span', { class: 'need', 'aria-hidden': 'true' });
      wrap.classList.toggle('flipround', !!R.flip);
      const goalText =
        R.k == null
          ? `${cap(word(R.n))} beads, any number blue:`
          : `${cap(word(R.n))} beads, ${R.flip ? '' : 'use '}${word(R.k)} blue${R.flip ? ', can flip 🔄' : ''}:`;
      goal.replaceChildren(h('span', {}, goalText), needEl);
      renderBench();
      updateNeed();
      shelfTitle.textContent = `${pick(FRIENDS)} Necklace shelf`;
      shelf.classList.remove('done');
      hintCard.hidden = true;
      btnClear.hidden = btnAdd.hidden = btnHint.hidden = false;
      btnNext.hidden = true;
      btnFlip.hidden = !R.flip;
      renderShelf();
      if (!quiet) api.prompt(R.prompt);
    }

    btnClear.addEventListener('click', () => {
      if (busy) return;
      state.fill(false);
      beads.forEach((_, i) => paintBead(i));
      updateNeed();
      sfx('tap');
    });
    btnAdd.addEventListener('click', () => tryAdd(false));
    btnFlip.addEventListener('click', async () => {
      if (busy) return;
      const t = token;
      busy = true;
      restartAnim(btnFlip, 'press', 150);
      await flipBench();
      if (alive && t === token) busy = false;
    });
    btnHint.addEventListener('click', () => showHint());
    btnNext.addEventListener('click', () => {
      if (btnNext.disabled) return;
      btnNext.disabled = true;
      sfx('tap');
      if (round < ROUNDS.length - 1) startRound(round + 1);
      else api.finish();
    });

    // Watch: make every necklace in the plan's order, sliding the blue beads along.
    api.setDemo(async () => {
      startRound(round, true);
      const t = token;
      busy = true;
      const ok = () => alive && t === token;
      const hand = h('div', { class: 'nk-hand', 'aria-hidden': 'true' }, '👆');
      wrap.append(hand);
      const moveHand = async (el, ms = 300) => {
        const r = el.getBoundingClientRect();
        hand.style.transitionDuration = ms + 'ms';
        hand.style.transform = `translate(${r.left + r.width / 2 - 14}px, ${r.top + r.height / 2 - 4}px)`;
        await sleep(ms);
      };
      // tap only the beads that differ from p (whites first, then blues), then press Add
      const makeAndAdd = async (p) => {
        const offs = [];
        const ons = [];
        state.forEach((s, i) => {
          if (s && p[i] === 'W') offs.push(i);
          if (!s && p[i] === 'B') ons.push(i);
        });
        for (const i of [...offs, ...ons]) {
          await moveHand(beads[i]);
          if (!ok()) return false;
          beads[i].classList.add('tap');
          toggle(i);
          await sleep(170);
          beads[i].classList.remove('tap');
        }
        await moveHand(btnAdd, 280);
        if (!ok()) return false;
        await tryAdd(true);
        return ok();
      };
      try {
        bench.scrollIntoView({ block: 'nearest' });
        const r0 = bench.getBoundingClientRect();
        hand.style.transition = 'none';
        hand.style.transform = `translate(${r0.left + r0.width / 2}px, ${r0.bottom + 30}px)`;
        hand.getBoundingClientRect();
        hand.style.transition = '';
        await talk(R.flip ? 'No clasp, so it can flip. Watch me.' : 'Watch me make them all, in order.');
        if (!ok()) return;
        for (let idx = 0; idx < all.length; idx++) {
          const p = all[idx];
          const prev = idx ? all[idx - 1] : null;
          if (R.k == null) {
            if (idx === 0) await talk('No blue at all. That counts too!');
            else if (nBlue(p) !== nBlue(prev))
              await talk(nBlue(p) === R.n ? 'And all of them blue!' : `Now ${word(nBlue(p))} blue. Slide along.`);
          } else if (idx === 0) await talk(R.k === 1 ? 'Blue at the very start.' : 'Two blue at the very start.');
          else if (R.k === 2 && prev.indexOf('B') !== p.indexOf('B')) await talk('Now the first blue moves one step.');
          else if (idx === 1 || (R.k === 2 && all[idx - 2] && all[idx - 2].indexOf('B') !== prev.indexOf('B')))
            await talk('Slide it one step along.');
          if (!ok()) return;
          if (!(await makeAndAdd(p))) return;
          await sleep(220);
          if (R.flip && idx === 0) {
            // show the twin rule once: the mirror copy is the same necklace
            await talk('Is the flipped one new? Let us see.');
            if (!ok() || !(await makeAndAdd(rev(p)))) return;
            await sleep(900);
            if (!ok()) return;
            await talk('Same necklace! So it does not count.');
            if (!ok()) return;
          }
        }
        hand.style.opacity = '0';
        await sleep(1600 + all.length * 110);
        if (!ok()) return;
        startRound(round, true);
        api.prompt('Your turn! Can you find them all?');
      } finally {
        hand.remove();
      }
    });

    startRound(resumeRound(api, ROUNDS.length));
    return {
      destroy() {
        alive = false;
        token++;
        timers.forEach(clearTimeout);
        timers.clear();
      },
    };
  },
};
