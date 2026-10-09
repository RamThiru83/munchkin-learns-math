/**
 * Game: All the Labels Are Wrong  (id: wrong-labels, level 5)
 *
 * Idea: every tag is wrong, so peeking in one well-chosen box and eliminating the impossible tells you every box.
 * Rounds:
 *   1. Two boxes (apples, pears), both tags wrong: tap a box, one fruit comes out, then drag the 2 new tags.
 *   2. Three boxes (apples, pears, mixed), one fruit per peek: the "mixed" box solves it; other boxes may need a 2nd peek.
 *   3. Same as round 2 with new boxes and a random fruit set ("Can you fix them with just one peek?").
 *   4. Three single kinds (e.g. oranges, lemons, strawberries): any one peek settles it, then tag by elimination.
 *   5. Three two-kind boxes (ap, pb, ab): a peek lifts the lid and shows both kinds; one peek settles it.
 * Watch demo: rebuilds the same boxes silently and narrates the solution (round 1: peek box 1; rounds 2-3:
 *   peek the mixed box, then the chain; rounds 4-5: peek box 1, then chainOrder()), opens every box,
 *   then starts fresh boxes on the same round.
 * Notes:
 *   - Rounds 1-2 use apples/pears; round 3 a random fruit set; rounds 4-5 two different random sets.
 *   - Hints: re-peeking a box nudges; in mixed rounds after 2 peeks the unpeeked mixed box glows;
 *     2 wrong tag drops in a row make the correct slot glow.
 *   - `ep` is an epoch counter: build() and destroy() bump it, so stale awaits (cheer, demo) stop via live(e).
 *   - place() resets the drag helper's private _dragBase/_dragPos on the tag; keep in step with lib/drag.
 *   - Exported pure helpers for brute-force checks: derangements, consistent, possible, drawFrom, ROUNDS,
 *     arrangement, chainOrder. Verified by brute force over every tag order: round 1 has exactly 1 possible
 *     arrangement, rounds 2-5 exactly 2; one peek in the mixed box (rounds 2-3) or in any box (rounds 1, 4, 5)
 *     leaves exactly 1; chainOrder() always matches the truth.
 */
import { h, sleep, shuffle, pick, drag, flyTo, sfx, settings, resumeRound } from '../lib/core.js';

// A key lists the fruit kinds in a box: 'a', 'p', 'b' = one kind only; 'ap' = mixed
// apples+pears (rounds 1-3), 'ap' / 'pb' / 'ab' = two-kind boxes (round 5).
// labels[i] = tag on box i; contents[i] = what is really inside. Every tag is wrong.
// Round set-ups: kinds on the tags, and how a peek works.
export const ROUNDS = [
  { kinds: ['a', 'p'], view: 'one' },
  { kinds: ['a', 'p', 'ap'], view: 'one' },
  { kinds: ['a', 'p', 'ap'], view: 'one' },
  { kinds: ['a', 'p', 'b'], view: 'one' },
  { kinds: ['ap', 'pb', 'ab'], view: 'all' },
];
// Pause after the "all tags right" cheer before the next round starts.
const NEXT_ROUND_MS = 1600;

const FRUITS = [
  { a: '🍎', p: '🍐', b: '🍌', an: 'apples', pn: 'pears', bn: 'bananas', a1: 'An apple', p1: 'A pear', b1: 'A banana' },
  {
    a: '🍊',
    p: '🍋',
    b: '🍓',
    an: 'oranges',
    pn: 'lemons',
    bn: 'strawberries',
    a1: 'An orange',
    p1: 'A lemon',
    b1: 'A strawberry',
  },
  {
    a: '🍑',
    p: '🍇',
    b: '🍒',
    an: 'peaches',
    pn: 'grapes',
    bn: 'cherries',
    a1: 'A peach',
    p1: 'A grape',
    b1: 'A cherry',
  },
];
const PROMPTS = [
  'Both tags are wrong! Tap a box to peek inside.',
  'All three tags are wrong. Which box should we peek in?',
  'New boxes! Can you fix them with just one peek?',
  'Three kinds of fruit now! Every tag is wrong. Peek!',
  'Each box has two kinds. Every tag is still wrong!',
];
const CHEERS = ['Yes!', 'That’s right!', 'Good thinking!', 'Spot on!', 'Clever!'];
const DONE = ['All the tags are right now!', 'Every box has its true tag!', 'You fixed them all!'];
const RIBBON = ['#ff8fab', '#4cc9f0', '#9b5de5'];

// ---------- pure puzzle logic (exported for brute-force tests) ----------
// A key lists the fruit kinds in a box: 'a', 'p', 'b' = one kind only; 'ap' = mixed
// apples+pears (rounds 1-3), 'ap' / 'pb' / 'ab' = two-kind boxes (round 5).
// labels[i] = tag on box i; contents[i] = what is really inside. Every tag is wrong.
export function derangements(labels) {
  const out = [];
  const rec = (cur, rest) => {
    if (!rest.length) {
      if (cur.every((k, i) => k !== labels[i])) out.push(cur);
      return;
    }
    rest.forEach((k, j) =>
      rec(
        [...cur, k],
        rest.filter((_, q) => q !== j),
      ),
    );
  };
  rec([], labels.slice());
  return out;
}
// A peek {i, f} means "we saw the kinds f in box i": box i must hold every kind in f.
export const consistent = (arr, peeks) => peeks.every((p) => [...p.f].every((c) => arr[p.i].includes(c)));
export const possible = (labels, peeks) => derangements(labels).filter((a) => consistent(a, peeks));
// 'one': a single fruit comes out (random kind). 'all': lift the lid and see every kind.
export const drawFrom = (content, view = 'one') => (view === 'all' ? content : pick([...content]));
export function arrangement(r) {
  const labels = shuffle(ROUNDS[r].kinds.slice());
  return { labels, truth: pick(derangements(labels)) };
}
// Demo chain for rounds with no 'mixed' box: after peeking box 0, the box whose own tag
// is one of the kinds still to place must hold the other one (its tag is wrong).
export function chainOrder(labels, truth) {
  const rest = truth.filter((_, q) => q !== 0);
  const j = [1, 2].find((q) => rest.includes(labels[q]));
  const k = 3 - j;
  return [
    { i: 0, key: truth[0] },
    { i: j, key: rest.find((x) => x !== labels[j]) },
    { i: k, key: truth[k] },
  ];
}
// ---------- end pure logic ----------

const CSS = `
.a-wrong-labels{width:100%;max-width:640px;display:flex;flex-direction:column;align-items:center;gap:10px;margin:auto 0}
.a-wrong-labels .boxes{display:flex;gap:10px;justify-content:center;width:100%}
.a-wrong-labels .col{flex:1 1 0;min-width:0;max-width:190px;display:flex;flex-direction:column;align-items:center;border-radius:18px;padding:2px}
.a-wrong-labels .peekzone{height:60px;display:flex;align-items:flex-start;padding-top:2px;justify-content:center;font-size:clamp(1.5rem,6vw,2.1rem);white-space:nowrap;line-height:1}
.a-wrong-labels .peekzone .all{font-size:clamp(1.05rem,4.6vw,1.6rem)}
.a-wrong-labels .boxbtn{position:relative;display:block;width:100%;background:none;border:0;padding:0;cursor:pointer;min-height:56px;border-radius:14px}
.a-wrong-labels .boxbtn svg{display:block;width:100%;height:auto;overflow:visible}
.a-wrong-labels .lid{transition:transform .45s cubic-bezier(.3,1.4,.5,1);transform-box:view-box;transform-origin:4px 34px}
.a-wrong-labels .col.open .lid{transform:translateY(-2px) rotate(-9deg)}
.a-wrong-labels .oldtag{position:absolute;left:50%;top:64%;transform:translate(-50%,-50%);background:#fff8e7;border:2px solid #2b2d42;border-radius:8px;padding:1px 6px;font-size:clamp(.95rem,4.2vw,1.45rem);white-space:nowrap;line-height:1.2}
.a-wrong-labels .oldtag::after{content:'';position:absolute;left:-5px;right:-5px;top:48%;height:3px;border-radius:2px;background:rgba(43,45,66,.55);transform:rotate(-12deg)}
.a-wrong-labels .slot{width:100%;min-height:66px;margin-top:6px;border:3px dashed #c9b48a;border-radius:14px;display:grid;place-items:center;background:rgba(255,255,255,.55)}
.a-wrong-labels .slot .q{color:#c9b48a;font-weight:800;font-size:1.4rem}
.a-wrong-labels .tag{position:relative;min-width:58px;min-height:56px;padding:4px 10px 4px 20px;border:3px solid #2b2d42;border-radius:10px 18px 18px 10px;background:#fffdf5;font-size:clamp(1.2rem,5vw,1.6rem);box-shadow:0 3px 0 rgba(43,45,66,.15);white-space:nowrap;line-height:1}
.a-wrong-labels .tag::before{content:'';position:absolute;left:6px;top:50%;width:8px;height:8px;margin-top:-4px;border-radius:50%;border:2px solid #2b2d42;background:#fff8e7}
.a-wrong-labels .tray{display:flex;gap:12px;flex-wrap:wrap;justify-content:center;align-items:center;min-height:80px;padding:8px 12px;border-radius:20px;background:rgba(255,255,255,.7);border:3px solid #e8dfc8;transition:opacity .3s}
.a-wrong-labels .tray:empty{opacity:0}
.a-wrong-labels .tray.off{visibility:hidden;opacity:0}
.a-wrong-labels .maybe{display:flex;flex-direction:column;align-items:center;gap:4px;font-weight:800}
.a-wrong-labels .maybe:empty{display:none}
.a-wrong-labels .mrow{display:flex;gap:6px}
.a-wrong-labels .mini{min-width:52px;padding:4px 6px;text-align:center;border:2px solid #2b2d42;border-radius:8px;background:#e7b46e;font-size:1.15rem}
.a-wrong-labels .or{font-size:.9rem;opacity:.7}
.a-wrong-labels .fruit{display:inline-block}
@media (max-width:420px){.a-wrong-labels .boxes{gap:7px}.a-wrong-labels .tag{padding:4px 7px 4px 17px}}
`;

// Cardboard box drawing; the ribbon colour tells the three boxes apart.
function boxSvg(color) {
  return h('svg', {
    viewBox: '0 0 120 96',
    'aria-hidden': 'true',
    html: `
    <rect x="12" y="24" width="96" height="14" rx="3" fill="#6b4423"/>
    <rect x="10" y="30" width="100" height="62" rx="7" fill="#e7b46e" stroke="#2b2d42" stroke-width="3"/>
    <rect x="53" y="31.5" width="14" height="59" fill="${color}" opacity=".75"/>
    <path d="M16 40 h20 M84 40 h20" stroke="#c98f45" stroke-width="3" stroke-linecap="round"/>
    <g class="lid"><rect x="4" y="18" width="112" height="16" rx="5" fill="#d99a50" stroke="#2b2d42" stroke-width="3"/>
    <rect x="53" y="19.5" width="14" height="13" fill="${color}"/></g>`,
  });
}

export default {
  id: 'wrong-labels',
  rounds: ROUNDS.length,
  parentNote:
    'Every tag is wrong, so a box can never hold what its tag says. The clever peek is the box tagged “mixed”: it must hold only one kind, so one fruit tells you what is inside and the rest follow by elimination. Later rounds use three kinds of fruit, then two-kind tags, so the elimination chain gets longer; ask “How do you know?” at each step.',
  async start(api) {
    let alive = true;
    let ep = 0;
    let R = null;
    const N = ROUNDS.length;
    let ri = resumeRound(api, N);
    const late = shuffle(FRUITS.slice());
    // Fruit set per round: 1-2 fixed, 3 random, 4-5 two different random sets.
    const roundFruit = [FRUITS[0], FRUITS[0], pick(FRUITS), late[0], late[1]];
    api.css(CSS);
    const wrap = h('div', { class: 'a-wrong-labels' });
    api.root.append(wrap);
    const live = (e) => alive && e === ep;
    const em = (k) => [...k].map((c) => R.fr[c]).join('');
    // 'ap' is "mixed" in rounds 1-3; in round 5 every box has two kinds, so name both.
    const nm = (k) =>
      k.length === 1 ? R.fr[k + 'n'] : R.pairs ? `${R.fr[k[0] + 'n']} and ${R.fr[k[1] + 'n']}` : 'mixed';
    const other = (k) => (k === 'a' ? 'p' : 'a');
    // Restart a CSS animation class (forces a reflow between remove and add).
    const retrigger = (el, cls) => {
      el.classList.remove(cls);
      void el.getBoundingClientRect();
      el.classList.add(cls);
    };

    // Draw round ri (random boxes, or the given arrangement for the demo); returns its epoch.
    function build(arr, silent = false) {
      ep++;
      const e = ep;
      wrap.replaceChildren();
      api.stage(ri, N);
      const { labels, truth } = arr || arrangement(ri);
      const { view } = ROUNDS[ri];
      R = {
        e,
        labels,
        truth,
        view,
        pairs: labels.every((k) => k.length === 2),
        mixed: labels.includes('ap') && !labels.every((k) => k.length === 2),
        fr: roundFruit[ri],
        peeks: [],
        resolved: false,
        placed: 0,
        miss: 0,
        cols: [],
        tags: [],
        ctl: [],
        demo: false,
      };
      const boxes = h('div', { class: 'boxes' });
      labels.forEach((L, i) => {
        const peek = h('div', { class: 'peekzone' });
        const btn = h(
          'button',
          { class: 'boxbtn', 'aria-label': `Box with a ${nm(L)} tag. Peek inside.`, onclick: () => onPeek(i) },
          boxSvg(RIBBON[i]),
          h('span', { class: 'oldtag' }, em(L)),
        );
        const slot = h('div', { class: 'slot' }, h('span', { class: 'q', 'aria-hidden': 'true' }, '?'));
        const col = h('div', { class: 'col', 'data-i': String(i) }, peek, btn, slot);
        R.cols.push({ col, peek, btn, slot, done: false });
        boxes.append(col);
      });
      R.maybe = h('div', { class: 'maybe', 'aria-live': 'polite' });
      R.tray = h('div', { class: 'tray off', role: 'group', 'aria-label': 'New tags' });
      for (const k of shuffle(labels)) {
        const t = h(
          'button',
          {
            class: 'tag',
            'data-k': k,
            'aria-label': `Tag: ${R.mixed && k === 'ap' ? `mixed ${R.fr.an} and ${R.fr.pn}` : nm(k)}`,
          },
          em(k),
        );
        R.tray.append(t);
        R.tags.push(t);
        R.ctl.push(drag(t, { dropSelector: '.a-wrong-labels .col', onDrop: (col, el) => onDropTag(col, el) }));
      }
      wrap.append(boxes, R.maybe, R.tray);
      if (!silent) api.prompt(PROMPTS[ri]);
      return e;
    }

    function doPeek(i, f) {
      R.peeks.push({ i, f });
      const c = R.cols[i];
      c.col.classList.add('open');
      c.btn.classList.remove('glow');
      c.btn.setAttribute(
        'aria-label',
        `Box with a ${nm(R.labels[i])} tag. ${f.length === 1 ? `${R.fr[f + '1']} came out.` : `${nm(f)} inside.`}`,
      );
      const fr = h('span', { class: 'fruit' }, em(f));
      c.peek.replaceChildren(fr);
      retrigger(fr, 'hop');
      sfx('pop');
    }

    // Lists the arrangements still possible after the peeks so far.
    function showMaybe(poss) {
      R.maybe.replaceChildren(
        h('div', {}, 'It could be…'),
        ...poss
          .flatMap((a, j) => [
            j ? h('div', { class: 'or' }, 'or') : null,
            h(
              'div',
              { class: 'mrow' },
              a.map((k) => h('span', { class: 'mini' }, em(k))),
            ),
          ])
          .filter(Boolean),
      );
    }

    function onPeek(i) {
      if (!R || R.demo) return;
      sfx('tap');
      if (R.resolved) {
        if (!R.cols[i].done) api.prompt('Drag a new tag onto this box.');
        return;
      }
      if (R.peeks.some((p) => p.i === i)) {
        api.nudge('We peeked there. Try a different box.');
        return;
      }
      const f = drawFrom(R.truth[i], R.view);
      doPeek(i, f);
      const poss = possible(R.labels, R.peeks);
      const L = R.labels[i];
      if (poss.length === 1) {
        let msg = 'Now we know which box is which!';
        if (R.peeks.length === 1) {
          if (!R.mixed) msg = `It says ${nm(L)}, but it has ${nm(poss[0][i])}!`;
          else if (L === 'ap') msg = `It says mixed, but that’s wrong. Only ${nm(f)}!`;
          else if (L === f) msg = `It says ${nm(L)}, but that’s wrong. So it’s mixed!`;
          else msg = `${R.fr[f + '1']}! So this is the ${nm(f)} box.`;
        }
        resolve(msg);
      } else {
        showMaybe(poss);
        api.nudge(`Only ${nm(f)}, or mixed? Not sure yet. Peek again!`);
        const m = R.labels.indexOf('ap');
        if (R.peeks.length >= 2 && m >= 0 && !R.peeks.some((p) => p.i === m)) R.cols[m].btn.classList.add('glow');
      }
    }

    async function resolve(msg) {
      const e = R.e;
      R.resolved = true;
      R.maybe.replaceChildren();
      R.cols.forEach((c) => c.btn.classList.remove('glow'));
      await api.cheer(msg);
      if (!live(e)) return;
      await sleep(350);
      if (!live(e)) return;
      R.tray.classList.remove('off');
      api.prompt(
        R.mixed || R.labels.length < 3
          ? 'Now drag the new tags onto the right boxes.'
          : 'Tag the box we peeked in. Then think!',
      );
    }

    function onDropTag(col, el) {
      if (!R || !R.resolved || R.demo) return false;
      const i = +col.dataset.i;
      const k = el.dataset.k;
      const c = R.cols[i];
      if (c.done) {
        api.nudge('That box has its new tag already.');
        return false;
      }
      if (R.truth[i] === k) {
        place(el, i);
        return true;
      }
      R.miss++;
      retrigger(c.col, 'shake');
      if (R.miss >= 2) {
        R.cols[R.truth.indexOf(k)].slot.classList.add('glow');
        api.nudge('Try the glowing box!');
      } else if (R.labels[i] === k) api.nudge('That was its old tag. Old tags are wrong!');
      else if (!R.mixed && R.labels.length === 3 && R.placed === 1)
        api.nudge('Not there. Look at the old tags: each one is wrong!');
      else api.nudge('Hmm. Think about the fruit we found.');
      return false;
    }

    // Snap a tag into box i's slot and lock it.
    function place(el, i) {
      const c = R.cols[i];
      c.slot.replaceChildren(el);
      el.style.transition = 'none';
      el.style.transform = '';
      el._dragBase = { x: 0, y: 0 };
      el._dragPos = null;
      R.ctl[R.tags.indexOf(el)].disable();
      c.done = true;
      R.miss = 0;
      R.placed++;
      R.cols.forEach((x) => x.slot.classList.remove('glow'));
      sfx('drop');
      retrigger(el, 'hop');
      if (R.demo) return;
      if (R.placed === R.labels.length) finishRound();
      else api.cheer(pick(CHEERS));
    }

    function openAll() {
      R.cols.forEach((c, i) => {
        const k = R.truth[i];
        c.col.classList.add('open');
        const s = h('span', { class: 'all' }, k.length === 2 ? em(k) + R.fr[k[0]] : R.fr[k].repeat(3));
        c.peek.replaceChildren(s);
        retrigger(s, 'hop');
      });
    }

    async function finishRound() {
      const e = R.e;
      openAll();
      await api.cheer(pick(DONE));
      if (!live(e)) return;
      await sleep(NEXT_ROUND_MS);
      if (!live(e)) return;
      ri++;
      if (ri < N) build();
      else api.finish();
    }

    // ---------- Watch: narrated reasoning on the same boxes ----------
    api.setDemo(async () => {
      const e = build({ labels: R.labels.slice(), truth: R.truth.slice() }, true);
      R.demo = true;
      const ok = () => live(e);
      const tell = async (t, ms = 700) => {
        await api.prompt(t);
        if (!ok()) return false;
        await sleep(ms + (settings.voice ? 0 : 800 + t.length * 22));
        return ok();
      };
      const moveTag = async (k, i) => {
        const t = R.tags.find((x) => x.dataset.k === k);
        R.cols[i].slot.classList.add('glow');
        await flyTo(t, R.cols[i].slot, { duration: 750 });
        if (!ok()) return false;
        place(t, i);
        return true;
      };
      const { labels, truth } = R;
      if (labels.length === 2) {
        if (!(await tell('Both tags are wrong. Let’s peek in this box.'))) return;
        R.cols[0].btn.classList.add('glow');
        await sleep(500);
        if (!ok()) return;
        doPeek(0, truth[0]);
        if (!(await tell(`It says ${nm(labels[0])}. That’s wrong, so it has ${nm(truth[0])}!`))) return;
        R.tray.classList.remove('off');
        await sleep(300);
        if (!ok()) return;
        if (!(await moveTag(truth[0], 0))) return;
        if (!(await tell(`So the other box has ${nm(truth[1])}.`, 300))) return;
        if (!(await moveTag(truth[1], 1))) return;
      } else if (R.mixed) {
        const m = labels.indexOf('ap');
        const X = truth[m];
        const Y = other(X);
        const yi = labels.indexOf(Y);
        const xi = labels.indexOf(X);
        R.cols[m].btn.classList.add('glow');
        if (!(await tell('Every tag is wrong. Peek in the box that says mixed!'))) return;
        doPeek(m, X);
        if (!(await tell(`It says mixed, but that’s wrong. So: only ${nm(X)}!`))) return;
        R.tray.classList.remove('off');
        await sleep(300);
        if (!ok()) return;
        if (!(await moveTag(X, m))) return;
        R.cols[yi].btn.classList.add('glow');
        if (!(await tell(`This one says ${nm(Y)}. Wrong, and ${nm(X)} are taken. Mixed!`, 300))) return;
        R.cols[yi].btn.classList.remove('glow');
        if (!(await moveTag('ap', yi))) return;
        if (!(await tell(`So the last box has only ${nm(Y)}.`, 300))) return;
        if (!(await moveTag(Y, xi))) return;
      } else {
        // Rounds 4-5: any box works; then a chain of eliminations.
        const [s0, s1, s2] = chainOrder(labels, truth);
        R.cols[0].btn.classList.add('glow');
        if (
          !(await tell(
            R.pairs ? 'Two kinds in each box. Let’s peek in this one.' : 'Every tag is wrong. Let’s peek in this box.',
          ))
        )
          return;
        doPeek(0, drawFrom(truth[0], R.view));
        if (!(await tell(`It says ${nm(labels[0])}, but it has ${nm(s0.key)}!`))) return;
        R.tray.classList.remove('off');
        await sleep(300);
        if (!ok()) return;
        if (!(await moveTag(s0.key, 0))) return;
        R.cols[s1.i].btn.classList.add('glow');
        if (!(await tell(`This says ${nm(labels[s1.i])}. Wrong! So it gets ${nm(s1.key)}.`, 300))) return;
        R.cols[s1.i].btn.classList.remove('glow');
        if (!(await moveTag(s1.key, s1.i))) return;
        if (!(await tell(`The last box gets the last tag: ${nm(s2.key)}.`, 300))) return;
        if (!(await moveTag(s2.key, s2.i))) return;
      }
      openAll();
      if (!(await tell('Now every tag is right!', 1400))) return;
      if (!(await tell('Now you try, with new boxes!', 500))) return;
      build(null, false);
    });

    build();
    return {
      destroy() {
        alive = false;
        ep++;
      },
    };
  },
};
