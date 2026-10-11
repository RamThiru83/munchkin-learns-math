/**
 * Game: Hidden Beads  (id: hidden-beads, level 2)
 *
 * Idea: a whole is made of two parts (number bonds to 10). If we know the whole and the part we can see,
 * we can work out the part that is hiding. Inspired by the "ways to make 5" turnstile and Make Ten.
 * Rounds (each round draws fresh random numbers; first the child taps every bead to count the whole):
 *   1. 3 or 4 beads; the cup hides some twice (two different splits). How many are hiding?
 *   2. 5 beads; three different splits of 5 in a row, each added to the "Ways to make 5" list.
 *   3. 6 or 7 beads; three different splits.
 *   4. 10 beads grouped 5 + 5 in two colours; the cup hides 1-9 beads, three different splits.
 *   5. 8 or 10 beads (5 + rest): "Make the cup hide X" - she drags beads under the cup until it hides X
 *      (Done lifts the cup to check), then finds two more splits not yet in the list and says how many hide.
 * The number-bond picture (whole on top, "showing" and "hiding" parts below) fills in as she goes.
 * Watch demo: restarts the current round (same numbers), counts the beads, solves the first question
 *   (counting on from the beads that show, or dragging X beads under the cup), then hands the round back.
 * Notes:
 *   - Round data comes from makeRound(); checkRound() verifies it. Exported as `_test`. Brute-forced in
 *     Node over 20 000 draws per round: hides always distinct and in 1..n-1, R5 target in 2..n-2, and at
 *     least 5 unused splits remain for the two free splits (n = 8 leaves 6, n = 10 leaves 8).
 *   - R1-R4: the hidden beads are always the LAST k beads; the cup is placed over them by measuring
 *     offsetLeft/offsetWidth (placeCup), so it must be re-run on resize. R5: hidden beads are moved to the
 *     end of the row and get display:none; the cup sits on a fixed "pocket" at the right end.
 *   - Bead pitch --p is computed in layout() from the scene width (24-60 px). When 8-10 beads in one row
 *     would be smaller than 40 px (phones, rounds 4-5), the row becomes a grid of two rows of 5 (.tworow,
 *     matching the 5 + 5 colours); in round 5 the pocket then sits to the right of both rows. In round 4
 *     with more than 5 hidden, a second cup (.cup2, mirrors the main cup's classes) covers the top-row part.
 *     Tapping a bead in round 5 also slides it under the cup.
 *   - Test hooks (markup only): .bond [data-part=whole|show|hide], .row .bead[data-i] (.under when hidden),
 *     .cup, .chips .chip[data-n], .tools .back / .done, .ways .way[data-split="S+K"].
 *   - `epoch` is bumped on every round (re)start so stale async work (reveal, demo) stops itself.
 */
import { h, sleep, pick, shuffle, range, drag, flyTo, say, resumeRound } from '../lib/core.js';

const ID = 'hidden-beads';
const MIN_P = 46; // smallest bead pitch in one row (bead = pitch - 6 px, so >= 40 px)
const HINT_DELAY = 1500; // ms before the stronger hint after a second miss in a row
const SPECS = [
  { sizes: [3, 4], asks: 2, colors: ['#ff8fab'] },
  { sizes: [5], asks: 3, colors: ['#4cc9f0'] },
  { sizes: [6, 7], asks: 3, colors: ['#9b5de5'] },
  { sizes: [10], asks: 3, colors: ['#ef476f', '#4cc9f0'] }, // grouped 5 + 5
  { sizes: [8, 10], make: true, free: 2, colors: ['#ef476f', '#4cc9f0'] },
];
const TALK = [
  ['If 1 is showing, how many are hiding?', 'How did you know without lifting the cup?'],
  ['Can you make 5 a different way?', 'If 3 are showing, how many are hiding?', 'Is 2 and 3 the same as 3 and 2?'],
  ['How many more to make 7?', 'Why is it easier to count on from the bigger part?'],
  ['Can you see the five red beads?', 'What two numbers make 10?', 'If 6 are showing, how many hide?'],
  ['What two numbers make 10?', 'How do you know you found a new way?', 'How many ways can we split 10?'],
];
const CHEERS = ['Yes!', 'You found it!', 'Lovely thinking!', 'Spot on!'];

// ---------- round data (pure) ----------
/** Numbers for round i: whole n and a list of questions ({ kind: 'ask'|'make'|'free', k }). */
function makeRound(i) {
  const s = SPECS[i];
  const n = pick(s.sizes);
  if (!s.make)
    return {
      n,
      qs: shuffle(range(n - 1, 1))
        .slice(0, s.asks)
        .map((k) => ({ kind: 'ask', k })),
    };
  const k = 2 + Math.floor(Math.random() * (n - 3)); // 2..n-2
  return { n, qs: [{ kind: 'make', k }, ...Array.from({ length: s.free }, () => ({ kind: 'free' }))] };
}
/** True when round data for round i is playable and every answer is a real split of n. */
function checkRound(i, rd) {
  const s = SPECS[i];
  if (!s.sizes.includes(rd.n)) return false;
  const ks = rd.qs.filter((q) => q.k != null).map((q) => q.k);
  if (new Set(ks).size !== ks.length) return false;
  if (!s.make) return rd.qs.length === s.asks && ks.every((k) => Number.isInteger(k) && k >= 1 && k <= rd.n - 1);
  const [m] = rd.qs;
  const freeLeft = rd.n - 1 - 1; // splits with 1..n-1 hiding, minus the one already made
  return m.kind === 'make' && m.k >= 2 && m.k <= rd.n - 2 && freeLeft >= s.free;
}
export const _test = { makeRound, checkRound, SPECS };

const CSS = `
.a-${ID}{--p:56px;width:100%;max-width:760px;display:flex;flex-direction:column;align-items:center;gap:10px;padding-bottom:8px}
.a-${ID} .bond{border-radius:20px;padding:2px 6px}
.a-${ID} .bond svg{display:block;width:min(230px,62vw);height:auto}
.a-${ID} .bond line{stroke:var(--ink);stroke-width:3}
.a-${ID} .bond circle{fill:#fff;stroke:var(--ink);stroke-width:3;transition:fill .3s}
.a-${ID} .bond circle.on{fill:#fff3c4}.a-${ID} .bond circle.s.on{fill:#d3f0fb}.a-${ID} .bond circle.k.on{fill:#ffe0b8}
.a-${ID} .bond text{font-weight:900;font-size:27px;text-anchor:middle;dominant-baseline:central;fill:var(--ink)}
.a-${ID} .bond text.ic{font-size:22px}
.a-${ID} .scene{position:relative;width:100%;box-sizing:border-box;padding:calc(var(--p) * 1.55) 8px 14px;background:linear-gradient(#eaf6ff,#fdfdff 75%,#f3e6cf 75%);border:3px solid var(--ink);border-radius:22px;overflow:hidden}
.a-${ID} .row{display:flex;align-items:center;justify-content:center;min-height:var(--p);background:linear-gradient(transparent calc(50% - 2px),#8a5a2b calc(50% - 2px),#8a5a2b calc(50% + 2px),transparent calc(50% + 2px))}
.a-${ID}.pocketmode .row{justify-content:flex-start}
.a-${ID} .bead{--bc:#ff8fab;position:relative;z-index:1;flex:none;width:calc(var(--p) - 6px);height:calc(var(--p) - 6px);margin:0 3px;padding:0;border:3px solid var(--ink);border-radius:50%;box-sizing:border-box;display:grid;place-items:center;cursor:pointer;background:radial-gradient(circle at 32% 28%,#fff 0 10%,var(--bc) 42%);box-shadow:inset -3px -4px 0 rgba(43,45,66,.22);transition:box-shadow .2s}
.a-${ID} .bead .num{background:#fff;border-radius:999px;padding:0 4px;font-weight:900;font-size:max(13px,calc(var(--p) * .34));line-height:1.2}
.a-${ID} .bead.counted{box-shadow:0 0 0 4px #ffd166,inset -3px -4px 0 rgba(43,45,66,.22)}
.a-${ID} .bead.was{box-shadow:0 0 0 4px #ff9f1c,inset -3px -4px 0 rgba(43,45,66,.22)}
.a-${ID}.pocketmode .bead.under{display:none}
.a-${ID}.pocketmode.peeking .bead.under{display:grid;opacity:.5;border-style:dashed}
.a-${ID} .pocket{flex:none;width:calc(var(--p) * 2.6);height:var(--p);margin-left:auto}
.a-${ID} :is(.cup,.cup2){position:absolute;z-index:3;box-sizing:border-box;border:3px solid var(--ink);border-radius:44% 44% 10px 10px / 34% 34% 10px 10px;background:repeating-linear-gradient(90deg,#ff9f1c 0 14px,#ffb347 14px 24px);box-shadow:inset 0 -9px 0 #e07f00;pointer-events:none;transition:transform .7s cubic-bezier(.4,.1,.2,1),opacity .3s}
.a-${ID} :is(.cup,.cup2)::before{content:'';position:absolute;left:30%;right:30%;top:-9px;height:9px;border:3px solid var(--ink);border-bottom:0;border-radius:10px 10px 0 0;background:#ffb347}
.a-${ID} :is(.cup,.cup2).away{transform:translateX(120vw)}
.a-${ID} :is(.cup,.cup2).lift{transform:translateY(calc(var(--p) * -1)) rotate(-7deg)}
.a-${ID} :is(.cup,.cup2).peek{opacity:.35}
.a-${ID}.pocketmode .cup{pointer-events:auto}
.a-${ID} .cup.over{box-shadow:inset 0 -9px 0 #e07f00,0 0 0 6px rgba(255,209,102,.95)}
.a-${ID} .ask{min-height:64px;display:flex;flex-direction:column;align-items:center;gap:8px;width:100%}
.a-${ID} .chips{display:flex;flex-wrap:wrap;gap:8px;justify-content:center;max-width:430px}
.a-${ID} .chips .chip{font-size:1.6rem;font-weight:900}
.a-${ID} .tools .btn{min-height:56px}
.a-${ID} .ways{width:100%;box-sizing:border-box;background:linear-gradient(#fff,#fff6dc);border:3px solid var(--ink);border-radius:20px;padding:6px 10px 10px}
.a-${ID} .ways h3{margin:0 4px 6px;font-size:1rem}
.a-${ID} .ways .list{display:flex;flex-wrap:wrap;gap:8px;justify-content:center;min-height:52px}
.a-${ID} .way{display:flex;flex-direction:column;align-items:center;gap:2px;background:#fff;border:3px solid var(--ink);border-radius:14px;padding:5px 8px;font-weight:900}
.a-${ID} .way.new{animation:hb-pop .5s cubic-bezier(.3,1.6,.5,1)}
.a-${ID} .way .mini{display:flex;gap:2px}
.a-${ID} .way .mini i{width:11px;height:11px;border-radius:50%;border:2px solid var(--ink);background:#d3f0fb}
.a-${ID} .way .mini i.k{background:#ff9f1c}
.a-${ID}.tworow .row{display:grid;grid-template-columns:repeat(5,var(--p));grid-auto-rows:var(--p);justify-content:center;align-items:center;background-size:100% var(--p)}
.a-${ID}.tworow .bead{justify-self:center}
.a-${ID}.tworow.pocketmode .row{grid-template-columns:repeat(5,var(--p)) calc(var(--p) * 2)}
.a-${ID}.tworow .pocket{grid-column:6;grid-row:1 / span 2;width:calc(var(--p) * 2);margin:0}
.a-${ID}.tworow:not(.pocketmode) .cup.lift{transform:translateY(calc(var(--p) * -2.1)) rotate(-7deg)}
.a-${ID} .cup2.lift{opacity:0}
.a-${ID}.tworow:not(.pocketmode) :is(.cup,.cup2){border-radius:18px 18px 10px 10px}
@keyframes hb-pop{0%{transform:scale(.4)}100%{transform:scale(1)}}
`;

export default {
  id: ID,
  rounds: SPECS.length,
  parentNote:
    'Beads on a string are counted together, then a cup hides some. Knowing the whole and the part that shows, the child works out the hidden part: a number bond (part + part = whole) up to 10. Encourage counting on from the beads that show ("6... 7, 8, 9, 10") instead of guessing, and notice together that 3 + 7 and 7 + 3 are two different ways to split 10.',
  talkPrompts: [
    'If 3 are showing, how many are hiding?',
    'Can you make 5 a different way?',
    'What two numbers make 10?',
  ],

  async start(api) {
    let alive = true;
    const timers = new Set();
    const later = (fn, ms) => {
      const t = setTimeout(() => {
        timers.delete(t);
        if (alive) fn();
      }, ms);
      timers.add(t);
    };
    // Speak, but never wait longer than a length-based cap (speech may be off or slow).
    const talk = (text) => Promise.race([say(text), sleep(600 + text.length * 50)]);

    api.css(CSS);
    const wrap = h('div', { class: `a-${ID}` });
    api.root.append(wrap);

    // ----- number-bond picture -----
    const circ = { whole: null, show: null, hide: null };
    const txt = { whole: null, show: null, hide: null };
    const bondSvg = h(
      'svg',
      { viewBox: '0 0 240 150', role: 'img', 'aria-label': 'Number bond' },
      h('line', { x1: 120, y1: 40, x2: 62, y2: 110 }),
      h('line', { x1: 120, y1: 40, x2: 178, y2: 110 }),
    );
    for (const [part, x, y, cls] of [
      ['whole', 120, 36, 'w'],
      ['show', 62, 112, 's'],
      ['hide', 178, 112, 'k'],
    ]) {
      circ[part] = h('circle', { cx: x, cy: y, r: 29, class: cls });
      txt[part] = h('text', { x, y, 'data-part': part });
      bondSvg.append(circ[part], txt[part]);
    }
    bondSvg.append(h('text', { x: 20, y: 112, class: 'ic' }, '👀'), h('text', { x: 222, y: 112, class: 'ic' }, '🥤'));
    const bond = h('div', { class: 'bond' }, bondSvg);
    const setBond = (part, v) => {
      txt[part].textContent = v == null ? '?' : String(v);
      circ[part].classList.toggle('on', v != null);
    };

    // ----- scene: beads on a wire and the cup -----
    const row = h('div', { class: 'row', role: 'group', 'aria-label': 'Beads' });
    const cup = h('div', { class: 'cup away', role: 'img', 'aria-label': 'Cup' });
    // Second cup, only used when 10 beads sit in two rows of 5 and the hidden beads reach into the top row.
    // It copies the main cup's state classes, so the code below only ever talks to `cup`.
    const cup2 = h('div', { class: 'cup2 away', 'aria-hidden': 'true' });
    cup2.style.display = 'none';
    const mirror = new MutationObserver(() => {
      void cup2.offsetWidth;
      cup2.className = cup.className.replace(/\bcup\b/, 'cup2');
    });
    mirror.observe(cup, { attributes: true, attributeFilter: ['class'] });
    const scene = h('div', { class: 'scene' }, row, cup, cup2);
    const askLbl = h('strong', {});
    const chips = h('div', { class: 'chips' });
    const btnBack = h('button', { class: 'btn back', type: 'button' }, '↩ One back');
    const btnDone = h('button', { class: 'btn primary done', type: 'button' }, '✅ Done');
    const tools = h('div', { class: 'act-row tools', hidden: true }, btnBack, btnDone);
    const ask = h('div', { class: 'ask' }, askLbl, chips, tools);
    const waysHead = h('h3', {});
    const waysList = h('div', { class: 'list' });
    const ways = h('section', { class: 'ways', 'aria-label': 'Ways we found' }, waysHead, waysList);
    wrap.append(bond, scene, ask, ways);

    // ----- state -----
    let round = resumeRound(api, SPECS.length);
    const data = []; // round data, kept until the round changes so Watch and the child play the same numbers
    let rd = null;
    let q = 0; // question index within the round
    let phase = 'count'; // count | busy | ask | move
    let beads = [];
    let drags = [];
    let counted = 0;
    let hidden = 0; // beads under the cup now
    let found = []; // hidden counts found this round, in order
    let wrong = 0;
    let demoOn = false;
    let epoch = 0;
    const make = () => !!SPECS[round].make;
    const Q = () => rd.qs[q];

    // Bead pitch from the scene width. 8-10 beads that would get small (bead < 40 px) go in two rows of 5.
    function layout() {
      const W = scene.clientWidth - 22;
      const one = Math.floor(W / (rd.n + (make() ? 2.8 : 0)));
      const two = rd.n > 5 && one < MIN_P;
      wrap.classList.toggle('tworow', two);
      const p = two ? Math.floor(W / (5 + (make() ? 2 : 0))) : one;
      wrap.style.setProperty('--p', Math.max(24, Math.min(60, p)) + 'px');
      placeCup();
    }
    // Put the cup over the last `hidden` beads (R1-R4) or over the pocket (R5). Measured, not computed.
    // In two rows, hidden beads in the top row get the second cup.
    function placeCup() {
      const shown = make() ? [row.querySelector('.pocket')] : beads.slice(rd.n - Math.max(hidden, 1));
      if (!shown[0]) return;
      const bh = beads[0].offsetHeight;
      const ch = bh * (wrap.classList.contains('tworow') && !make() ? 1.25 : 1.55); // two rows: no overlap
      const lines = [];
      for (const el of shown) {
        const line = lines.find((l) => Math.abs(l[0].offsetTop - el.offsetTop) < bh / 2);
        if (line) line.push(el);
        else lines.push([el]);
      }
      lines.sort((x, y) => y[0].offsetTop - x[0].offsetTop); // bottom row (the last beads) first
      [cup, cup2].forEach((c, j) => {
        const line = lines[j];
        if (c === cup2) c.style.display = line ? '' : 'none';
        if (!line) return;
        const a = line[0];
        const b = line[line.length - 1];
        Object.assign(c.style, {
          left: a.offsetLeft - 5 + 'px',
          width: b.offsetLeft + b.offsetWidth - a.offsetLeft + 10 + 'px',
          height: ch + 'px',
          top: a.offsetTop + a.offsetHeight / 2 + bh / 2 + bh * 0.12 - ch + 'px',
        });
      });
    }
    const onResize = () => rd && layout();
    window.addEventListener('resize', onResize);

    function buildBeads() {
      const cols = SPECS[round].colors;
      beads = range(rd.n).map((i) => {
        const b = h('button', { class: 'bead', type: 'button', 'data-i': i, 'aria-label': `Bead ${i + 1}` });
        b.style.setProperty('--bc', cols[i < 5 ? 0 : cols.length - 1]);
        b.addEventListener('click', () => tapBead(b));
        return b;
      });
      row.replaceChildren(...beads);
      if (make()) row.append(h('div', { class: 'pocket', 'aria-hidden': 'true' }));
      drags = make() ? beads.map(addDrag) : [];
      drags.forEach((d) => d.disable());
    }
    function resetBeads() {
      beads.forEach((b) => {
        b.classList.remove('under', 'was', 'counted');
        b.replaceChildren();
        b.style.transform = '';
        b._dragBase = null;
        b._dragPos = null;
        b.removeAttribute('aria-hidden');
      });
      if (make()) row.prepend(...beads); // original order (5 red, then the rest)
      hidden = 0;
    }
    const label = (b, n) => b.replaceChildren(h('span', { class: 'num' }, n));

    function renderWays() {
      waysHead.textContent = `📋 Ways to make ${rd.n}`;
      waysList.replaceChildren(
        ...found.map((k, idx) => {
          const s = rd.n - k;
          return h(
            'div',
            {
              class: 'way' + (idx === found.length - 1 ? ' new' : ''),
              'data-split': `${s}+${k}`,
              role: 'img',
              'aria-label': `${s} showing and ${k} hiding`,
            },
            h(
              'div',
              { class: 'mini' },
              range(rd.n).map((i) => h('i', { class: i < s ? '' : 'k' })),
            ),
            `${s} + ${k}`,
          );
        }),
      );
    }

    // ----- round and question flow -----
    function startRound(i, intro = true) {
      epoch++;
      if (i !== round || !data[i]) data[i] = makeRound(i);
      round = i;
      rd = data[i];
      q = 0;
      found = [];
      wrong = 0;
      counted = 0;
      phase = 'count';
      wrap.classList.toggle('pocketmode', make());
      cup.className = 'cup' + (make() ? '' : ' away');
      buildBeads();
      resetBeads();
      ['whole', 'show', 'hide'].forEach((p) => setBond(p, null));
      chips.replaceChildren();
      tools.hidden = true;
      askLbl.textContent = '';
      renderWays();
      api.stage(i, SPECS.length);
      api.setTalk(TALK[i]);
      layout();
      if (intro) api.prompt(i === 0 ? 'Tap each bead to count them.' : `Count the beads. Tap each one.`);
    }

    async function tapBead(b) {
      if (demoOn) return;
      if (phase === 'count' && !b.classList.contains('counted')) return countBead(b);
      if (phase === 'move' && !b.classList.contains('under') && !b._moved) hideBead(b);
      b._moved = false;
    }
    function countBead(b) {
      counted++;
      b.classList.add('counted');
      label(b, counted);
      say(String(counted));
      if (counted === rd.n) onCounted();
    }
    async function onCounted() {
      phase = 'busy';
      const ep = epoch;
      setBond('whole', rd.n);
      await Promise.race([api.cheer(`${rd.n} beads in all!`), sleep(1400)]);
      if (alive && ep === epoch && !demoOn) startQuestion();
    }

    async function startQuestion(intro = true) {
      const ep = epoch;
      const ok = () => alive && ep === epoch;
      phase = 'busy';
      wrong = 0;
      chips.replaceChildren();
      tools.hidden = true;
      askLbl.textContent = '';
      setBond('show', null);
      setBond('hide', null);
      wrap.classList.remove('peeking');
      if (make()) {
        cup.classList.remove('lift', 'peek');
        resetBeads();
        layout();
        if (Q().kind === 'make') setBond('hide', Q().k);
        tools.hidden = false;
        phase = 'move';
        drags.forEach((d) => d.enable());
        if (intro)
          api.prompt(
            Q().kind === 'make'
              ? `Make the cup hide ${Q().k}. Then tap Done.`
              : 'Hide a new number of beads. Tap Done.',
          );
        return true;
      }
      // R1-R4: cup slides away, beads reset, cup slides back over the last k beads.
      cup.classList.remove('lift', 'peek');
      cup.classList.add('away');
      await sleep(q === 0 ? 50 : 700);
      if (!ok()) return false;
      resetBeads();
      hidden = Q().k;
      placeCup();
      void cup.offsetWidth;
      cup.classList.remove('away');
      await sleep(750);
      if (!ok()) return false;
      beads.slice(rd.n - hidden).forEach((b) => {
        b.classList.add('under');
        b.setAttribute('aria-hidden', 'true');
      });
      setBond('show', rd.n - hidden);
      showChips();
      if (intro) api.prompt(q === 0 ? 'The cup hides some. How many are hiding?' : 'How many are hiding now?');
      return true;
    }
    function showChips() {
      phase = 'ask';
      askLbl.textContent = '🥤 How many are hiding?';
      chips.replaceChildren(
        ...range(rd.n, 1).map((v) =>
          h(
            'button',
            { class: 'chip', type: 'button', 'data-n': v, 'aria-label': `${v} hiding`, onclick: () => answer(v) },
            v,
          ),
        ),
      );
    }

    function answer(v) {
      if (phase !== 'ask' || demoOn) return;
      const s = rd.n - hidden;
      if (v === hidden) return success();
      wrong++;
      const chip = chips.querySelector(`[data-n="${v}"]`);
      chip?.classList.add('shake');
      later(() => chip?.classList.remove('shake'), 450);
      if (v === s) api.nudge(`${s} are showing. How many hide?`);
      else if (v === rd.n) api.nudge(`That is all ${rd.n}. Some are showing!`);
      else api.nudge(`Count on from ${s} up to ${rd.n}.`);
      if (wrong >= 2) later(strongHint, HINT_DELAY);
    }
    // After two misses: the cup turns see-through so the hidden beads can be counted.
    function strongHint() {
      if (phase !== 'ask') return;
      cup.classList.add('peek', 'glow');
      bond.classList.add('glow');
      wrap.classList.add('peeking'); // round 5: hidden beads show faintly in the row
      later(() => bond.classList.remove('glow'), 2600);
      api.nudge('Peek! Count the beads under the cup.');
    }

    // Lift the cup and count on from the beads that show. Resolves when the counting is finished.
    async function reveal() {
      const ep = epoch;
      const ok = () => alive && ep === epoch;
      phase = 'busy';
      drags.forEach((d) => d.disable());
      chips.replaceChildren();
      tools.hidden = true;
      askLbl.textContent = '';
      const s = rd.n - hidden;
      const under = make() ? beads.filter((b) => b.classList.contains('under')) : beads.slice(s);
      under.forEach((b) => {
        b.classList.remove('under');
        b.removeAttribute('aria-hidden');
        b.classList.add('was');
      });
      if (make()) layout();
      cup.classList.remove('peek', 'glow');
      wrap.classList.remove('peeking');
      cup.classList.add('lift');
      setBond('show', s);
      await sleep(700);
      if (!ok()) return false;
      await talk(`${s} showing...`);
      for (let j = 0; j < under.length; j++) {
        label(under[j], s + j + 1);
        await Promise.all([sleep(380), talk(String(s + j + 1))]);
        if (!ok()) return false;
      }
      return true;
    }

    async function success() {
      const ep = epoch;
      const ok = () => alive && ep === epoch;
      const k = hidden;
      if (!(await reveal())) return;
      setBond('hide', k);
      found.push(k);
      renderWays();
      api.cheer(`${pick(CHEERS)} ${rd.n - k} and ${k} make ${rd.n}.`);
      await sleep(2200);
      if (!ok()) return;
      q++;
      if (q < rd.qs.length) startQuestion();
      else if (round < SPECS.length - 1) startRound(round + 1);
      else api.finish();
    }

    // ----- round 5: dragging beads under the cup -----
    function addDrag(b) {
      let sx = 0;
      let sy = 0;
      b.addEventListener('pointerdown', (e) => {
        sx = e.clientX;
        sy = e.clientY;
        b._moved = false;
      });
      b.addEventListener('pointermove', (e) => {
        if (Math.abs(e.clientX - sx) + Math.abs(e.clientY - sy) > 10) b._moved = true;
        cup.classList.toggle('over', b.classList.contains('dragging'));
      });
      return drag(b, {
        dropSelector: `.a-${ID} .cup, .a-${ID} .pocket`,
        onDrop: () => {
          if (phase !== 'move' || demoOn) return false;
          hideBead(b);
          return true;
        },
        onEnd: () => cup.classList.remove('over'),
      });
    }
    function hideBead(b) {
      b.style.transform = '';
      b._dragBase = null;
      b._dragPos = null;
      b.classList.add('under');
      b.setAttribute('aria-hidden', 'true');
      row.insertBefore(b, row.querySelector('.pocket')); // visible beads first, hidden ones last
      hidden++;
      cup.classList.remove('hop');
      void cup.offsetWidth;
      cup.classList.add('hop');
      if (hidden === rd.n && !demoOn) api.nudge('All hidden! Bring some back.');
    }
    btnBack.addEventListener('click', () => {
      if (phase !== 'move' || demoOn || !hidden) return;
      const b = beads.filter((x) => x.classList.contains('under')).pop();
      b.classList.remove('under');
      b.removeAttribute('aria-hidden');
      hidden--;
      api.prompt(`One came back. ${rd.n - hidden} are showing.`);
    });
    btnDone.addEventListener('click', () => {
      if (phase !== 'move' || demoOn) return;
      if (hidden === 0) return void api.nudge('Drag some beads under the cup first.');
      if (hidden === rd.n) return void api.nudge('Leave some beads showing.');
      if (Q().kind === 'make') return checkMake();
      if (found.includes(hidden)) {
        const card = waysList.querySelector(`[data-split="${rd.n - hidden}+${hidden}"]`);
        card?.classList.add('shake');
        later(() => card?.classList.remove('shake'), 450);
        return void api.nudge('We found that way. Move some beads.');
      }
      drags.forEach((d) => d.disable());
      tools.hidden = true;
      setBond('show', rd.n - hidden);
      showChips();
      api.prompt(`${rd.n - hidden} are showing. How many are hiding?`);
    });
    async function checkMake() {
      if (hidden === Q().k) return success();
      // Show what the cup really hides, then put it back for another try.
      const ep = epoch;
      const ok = () => alive && ep === epoch;
      wrong++;
      const k = hidden;
      if (!(await reveal())) return;
      api.nudge(`The cup hides ${k}. We need ${Q().k}.`);
      await sleep(1600);
      if (!ok()) return;
      for (const b of beads) {
        if (b.classList.contains('was')) b.classList.add('under');
        b.classList.remove('was', 'counted');
        b.replaceChildren();
      }
      cup.classList.remove('lift');
      setBond('show', null);
      phase = 'move';
      tools.hidden = false;
      drags.forEach((d) => d.enable());
      if (wrong >= 2) {
        setBond('show', rd.n - Q().k);
        bond.classList.add('glow');
        later(() => bond.classList.remove('glow'), 2600);
        api.prompt(`Leave ${rd.n - Q().k} showing. Then the cup hides ${Q().k}.`);
      } else api.prompt(Q().k > k ? 'Hide some more. Then tap Done.' : 'Bring some back. Then tap Done.');
    }

    // ----- Watch: count, then solve the first question of this round -----
    let demoRun = 0; // id of the latest Watch run; only that run may switch demoOn off
    api.setDemo(async () => {
      const me = ++demoRun;
      demoOn = true;
      try {
        await runDemo();
      } finally {
        if (me === demoRun) demoOn = false;
      }
    });
    async function runDemo() {
      startRound(round, false);
      const ep = epoch;
      const ok = () => alive && ep === epoch;
      await talk('Watch! First we count the beads.');
      for (const b of beads) {
        if (!ok()) return;
        counted++;
        b.classList.add('counted');
        label(b, counted);
        await Promise.all([sleep(350), talk(String(counted))]);
      }
      setBond('whole', rd.n);
      await talk(`${rd.n} in all.`);
      if (!ok() || !(await startQuestion(false))) return;
      if (make()) {
        await talk(`I put ${Q().k} beads under the cup.`);
        for (let t = 0; t < Q().k; t++) {
          const b = beads.find((x) => !x.classList.contains('under'));
          await flyTo(b, cup, { duration: 450 });
          if (!ok()) return;
          hideBead(b);
          await talk(String(t + 1));
        }
        if (!ok()) return;
        await talk('Done! Lift the cup.');
      } else {
        const s = rd.n - hidden;
        await talk(`${s} are showing. ${rd.n} in all.`);
        if (!ok()) return;
        const chip = chips.querySelector(`[data-n="${hidden}"]`);
        chip?.classList.add('glow');
        await talk(`So ${hidden} are hiding.`);
      }
      if (!ok() || !(await reveal())) return;
      setBond('hide', hidden);
      await talk(`${rd.n - hidden} and ${hidden} make ${rd.n}. Now you try!`);
      if (!ok()) return;
      demoOn = false;
      startRound(round);
    }

    startRound(round);
    return {
      destroy() {
        alive = false;
        mirror.disconnect();
        timers.forEach(clearTimeout);
        timers.clear();
        window.removeEventListener('resize', onResize);
      },
    };
  },
};
