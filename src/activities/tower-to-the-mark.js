/**
 * Game: Tower to the Mark  (id: tower-to-the-mark, level 3)
 *
 * Idea: length is measured by laying equal units end to end, with no gaps and no overlaps; a bigger unit
 * gives a smaller number for the same length (book: "tower to the mark", pp. 97–99).
 * Rounds (every round draws a fresh random puzzle):
 *   1. One wall with a line 3–5 blocks high: stack blocks (tap + to add, tap the top block to take it off);
 *      the tower stops when it reaches the line exactly, then "How many blocks tall?".
 *   2. Two walls with the same line (4, 6 or 8 small blocks): small blocks on one, big (double) blocks on the
 *      other. Then "The big blocks needed fewer. Why?" (three answers).
 *   3. Drag paper clips end to end along a ribbon 3–6 clips long; a drop that leaves a gap or overlaps gets a
 *      gentle nudge and glides back. Then "How many clips long?".
 *   4. Two ribbons (3–8 clips, 1–3 apart; the shorter one starts further right, so looking at the right-hand
 *      ends misleads): measure both, then "Which is longer?" and "Longer by how many clips?".
 *   5. Predict whether small or big clips (big = 2 small) give the bigger number for one ribbon (6 or 8 small),
 *      measure it both ways to check, say which number is bigger; then pick the ribbon that is 6 small clips
 *      long from three (6 and two of 4, 5, 7, 8; a 📎 button measures any ribbon for her).
 * Watch demo: rebuilds the current puzzle, stacks/lays the units while counting aloud, glows the answers,
 *   then resets the round for the child.
 * Notes:
 *   - Puzzles come from makeRound(i) and are checked by checkRound(); `_test` exports both. Brute-forced in Node
 *     (20 000 puzzles per round): every puzzle passes; small = 2 × big in rounds 2 and 5; the 6-clip ribbon is
 *     the only one of length 6; ribbons always fit the 9-clip lane; every line is a whole number of blocks (so a
 *     tower can never pass it). Round 4: the shorter ribbon's end sticks out past the longer one's in ~32% of
 *     puzzles and lines up with it in ~40%.
 *   - Misses: gentle nudge; the 2nd miss in a row glows the right answer (or a dashed "ghost" spot for a clip).
 *   - Clip lanes are sized by the CSS variable --cw (one small clip, set from the stage width and on resize);
 *     drops are judged from the dragged clip's centre against the next free spot (tolerance TOL small clips).
 *   - Test hooks (read by tests/playthrough/tower-to-the-mark.spec.js): .wall[data-mark][data-unit], .add, .blk,
 *     .lane[data-i] .ribbon[data-len], .placed[data-size], .src[data-size], .qa button[data-v], .pick, .measure.
 *   - `epoch` is bumped on every round (re)start so stale async work (demo, auto-advance) stops itself.
 */
import { h, sleep, rand, pick, shuffle, range, drag, flyTo, glideBack, say, resumeRound } from '../lib/core.js';

const ID = 'tower-to-the-mark';
const N = 5; // rounds
const SLOTS = 9; // a clip lane is at most 9 small clips wide
const TOL = 0.55; // drop tolerance, in small clips, around the next free spot
const WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];
const RIBBONS = [
  { name: 'red', color: '#ef476f' },
  { name: 'blue', color: '#4cc9f0' },
  { name: 'green', color: '#06d6a0' },
];
const PRAISE = ['Yes!', 'Lovely measuring!', 'Just right!', 'You got it!'];
const TALK = [
  ['Why must the tower stop at the line?', 'What if we used bigger blocks?'],
  ['Why did the big blocks need fewer?', 'How many small blocks make one big one?'],
  ['What would happen if we left a gap?', 'What else could we measure with clips?'],
  ['How do you know which is longer?', 'Why not just look at the ends?'],
  ['Why do small clips give a bigger number?', 'Would a pencil be more or fewer clips?'],
];

// ---------- puzzles (pure) ----------
const between = (a, b) => a + rand(b - a + 1);
function makeRound(i) {
  if (i === 0) return { kind: 'towers', towers: [{ unit: 1, mark: between(3, 5) }] };
  if (i === 1) {
    const mark = pick([4, 6, 8]);
    return { kind: 'towers', towers: shuffle([1, 2].map((unit) => ({ unit, mark }))) };
  }
  if (i === 2) return { kind: 'clips', ribbons: [{ len: between(3, 6), off: 0, size: 1 }] };
  if (i === 3) {
    let a, b;
    do {
      a = between(3, 8);
      b = between(3, 8);
    } while (Math.abs(a - b) < 1 || Math.abs(a - b) > 3);
    // the shorter ribbon starts further right, so its end may stick out past the longer one
    const short = Math.min(a, b);
    const long = Math.max(a, b);
    const offLong = rand(Math.min(2, SLOTS - long) + 1);
    const offShort = Math.min(SLOTS - short, offLong + 1 + rand(3));
    const r = (len) => ({ len, off: len === long ? offLong : offShort, size: 1 });
    return { kind: 'clips', ribbons: [r(a), r(b)] };
  }
  const len = pick([6, 8]);
  const lens = shuffle([6, ...shuffle([4, 5, 7, 8]).slice(0, 2)]);
  return {
    kind: 'units',
    ribbons: [1, 2].map((size) => ({ len, off: 0, size })),
    choose: lens.map((l) => ({ len: l, off: rand(SLOTS - l + 1), size: 1 })),
    target: 6,
  };
}
function checkRound(i, p) {
  const fits = (r) => r.off >= 0 && r.off + r.len <= SLOTS && r.len % r.size === 0;
  if (i <= 1) {
    if (!p.towers.every((t) => t.mark % t.unit === 0 && t.mark <= 8)) return false;
    if (i === 0) return p.towers.length === 1 && p.towers[0].mark >= 3 && p.towers[0].mark <= 5;
    const [s, b] = [...p.towers].sort((x, y) => x.unit - y.unit);
    return s.mark === b.mark && s.mark / s.unit === 2 * (b.mark / b.unit);
  }
  if (!p.ribbons.every(fits)) return false;
  if (i === 2) return p.ribbons[0].len >= 3 && p.ribbons[0].len <= 6;
  if (i === 3) {
    const [short, long] = [...p.ribbons].sort((x, y) => x.len - y.len);
    return short.len >= 3 && long.len - short.len >= 1 && long.len - short.len <= 3 && short.off > long.off;
  }
  const [s, b] = p.ribbons;
  return (
    s.len === b.len &&
    s.len / s.size === 2 * (b.len / b.size) &&
    p.choose.every(fits) &&
    p.choose.filter((r) => r.len === p.target).length === 1 &&
    new Set(p.choose.map((r) => r.len)).size === 3
  );
}
export const _test = { makeRound, checkRound };

const button = (cls, label, attrs = {}) => h('button', { class: cls, type: 'button', ...attrs }, label);
const cap = (w) => w[0].toUpperCase() + w.slice(1);
// Five consecutive numbers (1 or more) that include `ans`, starting at a random place.
const chipRange = (ans) => range(5, Math.max(1, ans - rand(5)));

// A paper clip drawn as two nested rounded loops; `size` small clips long.
function clipSvg(size) {
  const w = 100 * size;
  return `<svg viewBox="0 0 ${w} 40" preserveAspectRatio="none" aria-hidden="true"><rect x="4" y="7" width="${w - 8}" height="26" rx="13" fill="none" stroke="currentColor" stroke-width="5"/><path d="M${w - 18} 14 H22 a6 6 0 0 0 0 12 H${w - 30}" fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round"/></svg>`;
}

// ---------- CSS ----------
const CSS = `
.a-${ID}{--u:34px;--cw:44px;width:100%;max-width:760px;display:flex;flex-direction:column;align-items:center;gap:12px}
.a-${ID} .walls{display:flex;gap:18px;justify-content:center;flex-wrap:wrap}
.a-${ID} .col{display:flex;flex-direction:column;align-items:center;gap:8px}
.a-${ID} .tag{font-weight:900;min-height:1.4em}
.a-${ID} .wall{position:relative;width:140px;box-sizing:content-box;background:linear-gradient(#fff9ea,#fbe7bd);border:3px solid var(--ink);border-bottom-width:8px;border-radius:14px 14px 4px 4px;display:flex;flex-direction:column-reverse;align-items:center}
.a-${ID} .mark{position:absolute;left:-3px;right:-3px;border-top:4px dashed #ff9f1c;pointer-events:none}
.a-${ID} .mark::after{content:'🎯';position:absolute;right:2px;top:-30px;font-size:22px}
.a-${ID} .wall.hit .mark{border-top-style:solid;border-color:#06d6a0}
.a-${ID} .blk{width:64px;padding:0;border:3px solid var(--ink);border-radius:6px;box-sizing:border-box;background:#4cc9f0;box-shadow:inset 0 -5px 0 rgba(0,0,0,.12);cursor:pointer;flex:none}
.a-${ID} .blk.big{width:96px;background:#9b5de5}
.a-${ID} .blk.pop{animation:ttm-pop .3s cubic-bezier(.3,1.6,.5,1)}
@keyframes ttm-pop{0%{transform:translateY(-24px) scale(.8)}100%{transform:none}}
.a-${ID} .add{min-height:56px;min-width:88px;display:inline-flex;gap:8px;align-items:center;justify-content:center}
.a-${ID} .mini{width:22px;height:13px;border:2px solid var(--ink);border-radius:3px;background:#4cc9f0}
.a-${ID} .mini.big{width:30px;height:26px;background:#9b5de5}
.a-${ID} .lanes{display:flex;flex-direction:column;gap:6px;width:max-content;max-width:100%}
.a-${ID} .lhead{display:flex;gap:8px;align-items:center;flex-wrap:wrap;font-weight:900}
.a-${ID} .lhead .btn{min-height:48px;padding:.3em .8em;font-size:.95rem}
.a-${ID} .lane{position:relative;height:58px;width:calc(var(--cw) * var(--slots));border-radius:10px}
.a-${ID} .ribbon{position:absolute;top:20px;height:18px;left:calc(var(--cw) * var(--off));width:calc(var(--cw) * var(--len));border-radius:3px;border:2px solid var(--ink);box-sizing:border-box}
.a-${ID} .lane.sel .ribbon{box-shadow:0 0 0 5px rgba(255,209,102,.9)}
.a-${ID} .clip{width:calc(var(--cw) * var(--s));height:44px;padding:0;border:0;background:none;color:#118ab2;box-sizing:border-box}
.a-${ID} .clip[data-size="2"]{color:#e76f00}
.a-${ID} .clip svg{width:100%;height:100%;display:block}
.a-${ID} .placed,.a-${ID} .ghost{position:absolute;top:7px;left:calc(var(--cw) * var(--x))}
.a-${ID} .ghost{width:calc(var(--cw) * var(--s));height:44px;border:3px dashed #ff9f1c;border-radius:12px;box-sizing:border-box;pointer-events:none}
.a-${ID} .tray{display:flex;gap:14px;align-items:center;justify-content:center;flex-wrap:wrap;padding:6px 14px;background:#e9f6ff;border:3px dashed #4cc9f0;border-radius:18px;font-weight:900}
.a-${ID} .src{min-height:56px;cursor:grab;touch-action:none;position:relative}
.a-${ID} .qa{display:flex;gap:10px;flex-wrap:wrap;justify-content:center;min-height:60px}
.a-${ID} .qa .btn{min-height:56px}
.a-${ID} .qa .chip{font-size:1.6rem;font-weight:900}
@media (max-width:420px){.a-${ID}{--u:30px}.a-${ID} .wall{width:116px}.a-${ID} .blk.big{width:84px}}
`;

export default {
  id: ID,
  rounds: N,
  parentNote:
    'The child builds towers up to a line and lays paper clips along ribbons, then counts the units. Measuring needs equal units placed end to end with no gaps or overlaps, and a bigger unit gives a smaller number for the same length. That last idea surprises many 5–7-year-olds: ask "Why did the big clips need fewer?" and let them explain.',
  talkPrompts: [
    'Why did the big blocks need fewer?',
    'What would happen if we left a gap?',
    'What else could we measure with clips?',
  ],

  async start(api) {
    let alive = true;
    let round = resumeRound(api, N);
    let P = null; // the current puzzle
    let epoch = 0;
    let busy = false;
    let demoOn = false;
    let misses = 0;
    const timers = new Set();
    const later = (fn, ms) => {
      const t = setTimeout(() => {
        timers.delete(t);
        if (alive) fn();
      }, ms);
      timers.add(t);
    };
    // Speech may be off or never finish (headless): never wait longer than a length-based cap.
    const capped = (p, text) => Promise.race([p, sleep(700 + text.length * 55)]);
    // talk() also lasts at least 450 ms so counting and the demo stay watchable with the voice off.
    const talk = (text) => Promise.all([capped(say(text), text), sleep(450)]);
    const glow = (el) => {
      el?.classList.add('glow', 'hop');
      later(() => el?.classList.remove('glow', 'hop'), 2600);
    };
    const shake = (el) => {
      el.classList.remove('shake');
      void el.offsetWidth; // restart the animation
      el.classList.add('shake');
      later(() => el.classList.remove('shake'), 450);
    };

    api.css(CSS);
    const board = h('div', { class: 'board col' });
    const qa = h('div', { class: 'qa', 'aria-live': 'polite' });
    const wrap = h('div', { class: `a-${ID}` }, board, qa);
    api.root.append(wrap);
    // Lanes are as wide as the round's ribbons need (`slots` small clips); one small clip is 30–56 px.
    let slots = SLOTS;
    const fitClips = () =>
      wrap.style.setProperty('--cw', `${Math.max(30, Math.min(56, Math.floor((wrap.clientWidth - 8) / slots)))}px`);
    const useLanes = (ribbons) => {
      slots = Math.max(...ribbons.map((r) => r.off + r.len));
      wrap.style.setProperty('--slots', slots);
      fitClips();
    };
    window.addEventListener('resize', fitClips);

    const miss = (text, hintEl) => {
      misses += 1;
      api.nudge(text);
      if (misses >= 2) glow(hintEl);
    };

    // Ask a question with answer buttons (numbers become chips); resolves when the right one is tapped.
    // A restarted round bumps `epoch`, which leaves the old promise unresolved on purpose.
    function ask(prompt, options, answer, hints = {}, fallback = 'Not that one. Look again!') {
      const ep = epoch;
      misses = 0;
      api.prompt(prompt);
      const opts = options.map((o) => (typeof o === 'object' ? o : { v: o, label: String(o), chip: true }));
      return new Promise((resolve) => {
        const btns = opts.map((o) =>
          button(o.chip ? 'chip' : 'btn', o.label, { 'data-v': o.v, onclick: () => tap(o.v) }),
        );
        const right = btns[opts.findIndex((o) => o.v === answer)];
        async function tap(v) {
          if (busy || demoOn || ep !== epoch) return;
          if (v !== answer) return miss(hints[v] || fallback, right);
          busy = true;
          btns.forEach((x) => (x.disabled = true));
          right.classList.add('sel');
          await capped(api.cheer(pick(PRAISE)), 'Lovely measuring!');
          busy = false;
          if (alive && ep === epoch) resolve(true);
        }
        qa.replaceChildren(...btns);
      });
    }

    // ---------- towers ----------
    let towers = [];
    function renderTowers() {
      const units = Math.max(...P.towers.map((x) => x.mark)) + 1; // wall height, one spare block above the line
      towers = P.towers.map((t, i) => {
        const wall = h('div', { class: 'wall', 'data-mark': t.mark, 'data-unit': t.unit, 'data-i': i });
        wall.style.height = `calc(var(--u) * ${units})`;
        wall.append(h('div', { class: 'mark', style: { bottom: `calc(var(--u) * ${t.mark})` } }));
        const tag = h('div', { class: 'tag' }, t.unit === 2 ? 'Big blocks' : 'Small blocks');
        const add = button('btn add', ['➕', h('span', { class: 'mini' + (t.unit === 2 ? ' big' : '') })], {
          'aria-label': `Add a ${t.unit === 2 ? 'big' : 'small'} block`,
        });
        const T = { ...t, wall, tag, add, count: 0, done: false };
        add.addEventListener('click', () => addBlock(T));
        return T;
      });
      const cols = towers.map((T) => h('div', { class: 'col' }, T.tag, T.wall, T.add));
      board.replaceChildren(h('div', { class: 'walls' }, cols));
    }
    const topBlock = (T) => T.wall.querySelector('.blk:last-of-type');
    function addBlock(T, demo = false) {
      if ((!demo && (busy || demoOn)) || T.done) return;
      const blk = h('button', {
        class: 'blk pop' + (T.unit === 2 ? ' big' : ''),
        type: 'button',
        'aria-label': 'Take the top block off',
      });
      blk.style.height = `calc(var(--u) * ${T.unit})`;
      blk.addEventListener('click', () => removeBlock(T, blk));
      T.wall.append(blk);
      T.count += 1;
      if (!demo) say(WORDS[T.count] || String(T.count));
      // Every line is a whole number of blocks, so the tower can never pass it: it stops exactly there.
      if (T.count * T.unit === T.mark) {
        T.done = true;
        T.wall.classList.add('hit');
        T.add.disabled = true;
        if (P.towers.length > 1) T.tag.textContent = `${T.count} ${T.unit === 2 ? 'big' : 'small'}`;
        if (!demo) towerReached();
      }
    }
    function removeBlock(T, blk) {
      if (busy || demoOn || T.done) return;
      if (blk !== topBlock(T)) return api.nudge('Tap the top block to take it off.');
      blk.remove();
      T.count -= 1;
      api.prompt('Off it comes. Is it at the line now?');
    }
    async function towerReached() {
      if (!towers.every((T) => T.done)) return api.cheer('It reaches the line! Now the other one.');
      const ep = epoch;
      if (round === 0) {
        await ask(
          'How many blocks tall is the tower?',
          chipRange(towers[0].count),
          towers[0].count,
          {},
          'Count the blocks again.',
        );
      } else {
        await ask(
          'The big blocks needed fewer. Why?',
          shuffle([
            { v: 'taller', label: '📏 Each big block is taller' },
            { v: 'lower', label: '🧱 The big tower is lower' },
            { v: 'count', label: '🔢 We made a mistake counting' },
          ]),
          'taller',
          { lower: 'Look: both towers reach the same line.', count: 'The counting was right. Look at one block.' },
        );
      }
      if (ep === epoch) nextRound();
    }

    // ---------- clips ----------
    let lanes = [];
    const lanesBox = (list) =>
      h(
        'div',
        { class: 'lanes' },
        list.flatMap((L) => [L.head, L.el]),
      );
    function laneEl(r, i, color) {
      const lane = h('div', { class: 'lane', 'data-i': i });
      lane.append(h('div', { class: 'ribbon', 'data-len': r.len, style: { background: color } }));
      lane.style.setProperty('--off', r.off);
      lane.querySelector('.ribbon').style.setProperty('--len', r.len);
      return lane;
    }
    function renderClips(ribbons, sizesLabel) {
      lanes = ribbons.map((r, i) => {
        const c = RIBBONS[i];
        const count = h('span', { class: 'count' });
        const what = r.size === 2 ? 'big clips' : 'small clips';
        // Round 5 measures one ribbon twice: one colour, labelled by clip size.
        const title = sizesLabel ? `🎀 Same ribbon: ${what}` : `🎀 ${cap(c.name)} ribbon`;
        const color = sizesLabel ? RIBBONS[0].color : c.color;
        const head = h('div', { class: 'lhead' }, title, count);
        return { ...r, name: c.name, el: laneEl(r, i, color), head, count, used: 0, done: false };
      });
      const sizes = [...new Set(ribbons.map((r) => r.size))];
      const srcs = sizes.map((s) => {
        const el = h('div', {
          class: 'clip src',
          'data-size': s,
          role: 'img',
          'aria-label': s === 2 ? 'Big clip' : 'Small clip',
          html: clipSvg(s),
        });
        el.style.setProperty('--s', s);
        drag(el, {
          dropSelector: '.lane',
          onDrop: (lane) => {
            dropClip(lane, el, s);
            return false; // the box clip glides home; a new clip is placed on the ribbon
          },
        });
        return el;
      });
      board.replaceChildren(lanesBox(lanes), h('div', { class: 'tray' }, '📎 Drag a clip', ...srcs));
      useLanes(ribbons);
    }
    // Judge a drop from the dragged clip's centre, in small-clip units from the ribbon start.
    function dropClip(laneNode, el, size) {
      if (busy || demoOn) return;
      const L = lanes[+laneNode.dataset.i];
      if (!L || L.done) return api.nudge('That ribbon is done. Try another one.');
      if (L.size !== size) return miss(`Use ${L.size === 2 ? 'big' : 'small'} clips on this ribbon.`, srcOf(L.size));
      const rib = L.el.querySelector('.ribbon').getBoundingClientRect();
      const cw = rib.width / L.len;
      const box = el.getBoundingClientRect();
      const c = (box.left + box.width / 2 - rib.left) / cw;
      const want = L.used + size / 2;
      if (Math.abs(c - want) <= TOL) return placeClip(L);
      shake(L.el);
      if (c < want) miss('No overlap! Start where the last clip ends.', ghost(L));
      else if (L.used) miss('Oops, a gap! Put it right next to the last clip.', ghost(L));
      else miss('Start at the very end of the ribbon.', ghost(L));
    }
    const srcOf = (s) => board.querySelector(`.src[data-size="${s}"]`);
    function ghost(L) {
      L.el.querySelector('.ghost')?.remove();
      const g = h('div', { class: 'ghost' });
      g.style.setProperty('--x', L.off + L.used);
      g.style.setProperty('--s', L.size);
      L.el.append(g);
      return g;
    }
    function placeClip(L, demo = false) {
      L.el.querySelector('.ghost')?.remove();
      const c = h('button', {
        class: 'clip placed',
        type: 'button',
        'data-size': L.size,
        'aria-label': 'Take this clip off',
        html: clipSvg(L.size),
      });
      c.style.setProperty('--x', L.off + L.used);
      c.style.setProperty('--s', L.size);
      c.addEventListener('click', () => {
        if (busy || demoOn || L.done || c !== L.el.querySelector('.placed:last-of-type')) return;
        c.remove();
        L.used -= L.size;
      });
      L.el.append(c);
      L.used += L.size;
      misses = 0;
      const n = L.used / L.size;
      if (!demo) say(WORDS[n] || String(n));
      if (L.used === L.len) {
        L.done = true;
        if (P.kind !== 'clips' || round === 3) L.count.textContent = `= ${n} ${L.size === 2 ? 'big' : 'small'} clips`;
        if (!demo) clipsDone();
      }
    }
    async function clipsDone() {
      if (!lanes.every((L) => L.done)) return api.cheer('All the way! Now the other ribbon.');
      const ep = epoch;
      const go = () => ep === epoch;
      if (round === 2) {
        const n = lanes[0].len;
        await ask('How many clips long is the ribbon?', chipRange(n), n, {}, 'Count the clips again.');
      } else if (round === 3) {
        const [a, b] = lanes;
        const long = a.len > b.len ? a : b;
        const short = long === a ? b : a;
        await ask(
          'Which ribbon is longer?',
          lanes.map((L) => ({ v: L.name, label: `🎀 The ${L.name} one` })),
          long.name,
          { [short.name]: 'Look at the numbers of clips.' },
        );
        if (!go()) return;
        const d = long.len - short.len;
        await ask('Longer by how many clips?', range(4, 1), d, {}, 'Compare the two numbers of clips.');
      } else {
        const [s, b] = lanes.map((L) => L.used / L.size);
        await ask('Which number is bigger?', shuffle([s, b]), s);
        if (!go()) return;
        const why =
          predicted === 'small'
            ? 'You predicted it! Small clips, bigger number.'
            : 'Small clips are shorter, so we need more.';
        await capped(api.prompt(why), why);
        if (!go()) return;
        renderChoose();
        return;
      }
      if (go()) nextRound();
    }

    // ---------- round 5 ----------
    let predicted = null;
    async function startUnits() {
      // A preview: the ribbon and one clip of each size (nothing to drag yet).
      const sample = (s) => {
        const c = h('span', { class: 'clip', 'data-size': s, html: clipSvg(s) });
        c.style.setProperty('--s', s);
        return c;
      };
      const lane = laneEl(P.ribbons[0], 0, RIBBONS[0].color);
      board.replaceChildren(
        h('div', { class: 'lanes' }, lane),
        h('div', { class: 'tray' }, sample(1), 'small · big', sample(2)),
      );
      useLanes(P.ribbons);
      const ep = epoch;
      misses = 0;
      api.prompt('Small or big clips: which gives the bigger number?');
      predicted = await new Promise((resolve) => {
        const opt = (v, label) =>
          h('button', { class: 'btn', type: 'button', 'data-v': v, onclick: () => !demoOn && resolve(v) }, label);
        qa.replaceChildren(opt('small', '📎 Small clips'), opt('big', '🖇️ Big clips'), opt('same', '🟰 The same'));
      });
      if (!alive || ep !== epoch) return;
      qa.replaceChildren();
      renderClips(P.ribbons, true);
      api.prompt('Now measure the ribbon both ways to check!');
    }
    function renderChoose() {
      lanes = P.choose.map((r, i) => {
        const c = RIBBONS[i];
        const count = h('span', { class: 'count' });
        const L = { ...r, name: c.name, el: laneEl(r, i, c.color), count, used: 0, done: false };
        const measure = button('btn measure', '📎 Measure', { 'aria-label': `Measure the ${c.name} ribbon` });
        const pickB = button('btn pick', 'This one', { 'aria-label': `Pick the ${c.name} ribbon`, 'data-len': r.len });
        measure.addEventListener('click', () => measureAll(L));
        pickB.addEventListener('click', () => choose(L, pickB));
        L.head = h('div', { class: 'lhead' }, `🎀 ${cap(c.name)}`, measure, pickB, count);
        return L;
      });
      board.replaceChildren(lanesBox(lanes));
      useLanes(P.choose);
      qa.replaceChildren();
      misses = 0;
      api.prompt(`Find the ribbon that is ${P.target} small clips long.`);
    }
    // The 📎 button lays small clips along a ribbon, counting; taps elsewhere wait until it is done.
    async function measureAll(L) {
      if (busy || demoOn || L.done) return;
      busy = true;
      const ep = epoch;
      while (!L.done && ep === epoch && alive) {
        placeClip(L, true); // sets L.done and the "= n small clips" label on the last clip
        const said = talk(WORDS[L.used] || String(L.used));
        if (!L.done) await said;
      }
      if (ep === epoch) busy = false;
    }
    async function choose(L, btn) {
      if (busy || demoOn) return;
      if (L.len !== P.target) {
        miss(`Not that one. Find ${P.target} small clips.`, board.querySelector(`.pick[data-len="${P.target}"]`));
        return measureAll(L);
      }
      busy = true;
      L.el.classList.add('sel');
      btn.classList.add('sel');
      const ep = epoch;
      await capped(api.cheer(`Yes! ${WORDS[P.target]} small clips long!`), 'Yes! six small clips long!');
      busy = false;
      if (ep === epoch) nextRound();
    }

    // ---------- rounds ----------
    function setupRound(i, fresh = true, intro = true) {
      epoch += 1;
      round = i;
      busy = false;
      misses = 0;
      if (fresh || !P) P = makeRound(i);
      api.stage(i, N);
      api.setTalk(TALK[i]);
      qa.replaceChildren();
      if (P.kind === 'towers') {
        renderTowers();
        if (intro)
          api.prompt(i === 0 ? 'Add blocks until the tower reaches the line.' : 'Build both towers up to the line.');
      } else if (P.kind === 'clips') {
        renderClips(P.ribbons, false);
        if (intro) api.prompt(i === 2 ? 'Lay clips along the ribbon. No gaps!' : 'Measure both ribbons with clips.');
      } else if (intro) startUnits();
    }
    async function nextRound() {
      const ep = epoch;
      await sleep(900);
      if (!alive || ep !== epoch) return;
      if (round < N - 1) setupRound(round + 1);
      else api.finish();
    }

    // ---------- Watch demo ----------
    api.setDemo(async () => {
      demoOn = true;
      const ep0 = epoch + 1;
      const ok = () => alive && epoch === ep0;
      setupRound(round, false, false);
      const show = async (v, text) => {
        qa.replaceChildren(h('button', { class: 'btn glow', type: 'button', tabindex: -1 }, String(v)));
        await talk(text);
      };
      await talk('Watch me measure!');
      if (P.kind === 'towers') {
        for (const T of towers) {
          while (!T.done && ok()) {
            addBlock(T, true);
            await talk(WORDS[T.count]);
          }
          if (!ok()) return;
        }
        if (round === 0) await show(towers[0].count, `${WORDS[towers[0].count]} blocks reach the line.`);
        else
          await show('📏 Each big block is taller', 'Each big block is as tall as two small ones. So we need fewer.');
      } else {
        if (P.kind === 'units') {
          renderClips(P.ribbons, true);
          await talk('I will measure it with small clips, then big clips.');
        }
        for (const L of lanes) {
          while (!L.done && ok()) {
            const src = srcOf(L.size);
            await flyTo(src, ghost(L), { duration: 550 });
            if (!ok()) return;
            placeClip(L, true);
            src._dragBase = { x: 0, y: 0 };
            src._dragPos = null;
            glideBack(src);
            await talk(WORDS[L.used / L.size]);
          }
          if (!ok()) return;
        }
        const n = lanes.map((L) => L.used / L.size);
        if (round === 2) await show(n[0], `${WORDS[n[0]]} clips, no gaps.`);
        else if (round === 3)
          await show(Math.abs(n[0] - n[1]), `${WORDS[Math.max(...n)]} is more than ${WORDS[Math.min(...n)]}.`);
        else await show(n[0], `Small clips: ${WORDS[n[0]]}. Big clips: only ${WORDS[n[1]]}.`);
      }
      if (!ok()) return;
      await sleep(900);
      if (!ok()) return;
      demoOn = false;
      setupRound(round, false);
    });

    setupRound(round);
    return {
      destroy() {
        alive = false;
        timers.forEach(clearTimeout);
        timers.clear();
        window.removeEventListener('resize', fitClips);
      },
    };
  },
};
