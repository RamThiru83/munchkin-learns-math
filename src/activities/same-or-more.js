/**
 * Game: Same or More?  (id: same-or-more, level 1)
 *
 * Idea: number conservation. Moving or spreading things does not change how many there are; pairing
 * one berry with one basket shows whether the rows are the same or one has more.
 * Rounds:
 *   1. Equal rows (3-4); the app spreads one row out by itself, then asks same or more.
 *   2. Equal rows (5-6); the child taps a button to spread one row out, then answers.
 *   3. One more in a row (5-6 vs 6-7); one row starts spread, the other squeezed; no button, just answer.
 *   4. Equal rows (7-8); one row starts spread out and the child squeezes it together, then answers.
 *   5. One more in a row (6-7 vs 7-8); "Mix them up" spreads the shorter row and squeezes the longer one.
 * Watch demo: does the move step if pending, pairs berries to baskets while counting, glows the answer.
 * Notes: the pairing button and every wrong answer fly berries onto baskets (flyTo) so the leftover
 *   glows. Layout is computed in JS from the field width (gapFor/place) and re-run on window resize.
 *   Each round uses a token (tok) so stale timers and awaits do nothing after a round change or destroy().
 *   No test hooks are exported.
 */
import { h, sleep, pick, flyTo, sfx, resumeRound } from '../lib/core.js';

const ID = 'same-or-more';
const TOTAL = 5; // rounds
const OPTS = [
  { key: 'berries', icon: '🍓', label: 'More berries', aria: 'More berries' },
  { key: 'same', icon: '🍓=🧺', label: 'Same', aria: 'The same' },
  { key: 'baskets', icon: '🧺', label: 'More baskets', aria: 'More baskets' },
];
const ASK = 'Same number of berries and baskets, or more?';
const CHEERS = ['Yes! Well spotted!', 'You got it!', 'Lovely thinking!', 'That is right!', 'Great looking!'];
const RESULT = {
  same: 'Every berry has a basket. They are the same!',
  berries: 'One berry has no basket. More berries!',
  baskets: 'One basket has no berry. More baskets!',
};

// Round setup (pure, no DOM). r is the zero-based round. Returns
// { nB berries, nK baskets, start: layout modes before, transform: [{row, mode}] applied by the button,
//   ask/btn/demo: button wording (absent when there is no transform) }.
// R1-2: equal rows, spread one out. R3: unequal, rows start spread/squeezed (no button).
// R4: equal, squeeze a spread row. R5: unequal, the fewer row spreads while the other squeezes.
const T = (row, mode) => [{ row, mode }];
function makeCfg(r) {
  const rowName = (x) => (x === 'berry' ? 'berries' : 'baskets');
  if (r === 0 || r === 1) {
    const n = r === 0 ? pick([3, 4]) : pick([5, 6]),
      row = pick(['berry', 'basket']);
    return {
      nB: n,
      nK: n,
      transform: T(row, 'spread'),
      start: { berry: 'neat', basket: 'neat' },
      ask: `Tap the button to spread out the ${rowName(row)}.`,
      btn: `↔ Spread the ${rowName(row)}`,
      demo: `First, I spread out the ${rowName(row)}.`,
    };
  }
  if (r === 2) {
    const f = pick([5, 6]),
      fewerRow = pick(['berry', 'basket']);
    const start =
      fewerRow === 'berry' ? { berry: 'spread', basket: 'squeeze' } : { berry: 'squeeze', basket: 'spread' };
    return { nB: fewerRow === 'berry' ? f : f + 1, nK: fewerRow === 'berry' ? f + 1 : f, transform: [], start };
  }
  if (r === 3) {
    // bigger and reversed: one row starts spread out, then gets squeezed together
    const n = pick([7, 8]),
      row = pick(['berry', 'basket']),
      other = row === 'berry' ? 'basket' : 'berry';
    return {
      nB: n,
      nK: n,
      transform: T(row, 'squeeze'),
      start: { [row]: 'spread', [other]: 'neat' },
      ask: `Tap the button to squeeze the ${rowName(row)} together.`,
      btn: `⇥ Squeeze the ${rowName(row)}`,
      demo: `First, I squeeze the ${rowName(row)} together.`,
    };
  }
  // hardest: one more in a row, and the rows swap how they look
  const f = pick([6, 7]),
    fewerRow = pick(['berry', 'basket']),
    moreRow = fewerRow === 'berry' ? 'basket' : 'berry';
  return {
    nB: fewerRow === 'berry' ? f : f + 1,
    nK: fewerRow === 'berry' ? f + 1 : f,
    transform: [
      { row: fewerRow, mode: 'spread' },
      { row: moreRow, mode: 'squeeze' },
    ],
    start: { berry: 'neat', basket: 'neat' },
    ask: 'Tap the button to mix up both rows.',
    btn: '🔀 Mix them up',
    demo: 'First, I mix up both rows.',
  };
}

const CSS = `
.a-${ID}{width:100%;max-width:680px;display:flex;flex-direction:column;align-items:center;gap:14px}
.a-${ID} .field{--s:clamp(32px,9.5vw,54px);position:relative;width:100%;height:calc(var(--s)*3.85);background:#fff;border:3px solid var(--ink);border-radius:22px;box-shadow:var(--shadow);overflow:hidden}
.a-${ID} .field.nt .it{transition:none}
.a-${ID} .shelf{position:absolute;left:3%;right:3%;height:calc(var(--s)*.16);border-radius:99px;background:#efe6cf}
.a-${ID} .shelf.t{top:calc(var(--s)*1.42)}
.a-${ID} .shelf.b{top:calc(var(--s)*3.32)}
.a-${ID} .it{position:absolute;width:var(--s);height:var(--s);display:grid;place-items:center;font-size:calc(var(--s)*.8);line-height:1;border-radius:50%;transition:left .9s cubic-bezier(.4,.1,.2,1),background .3s;pointer-events:none;animation:a-som-in .5s both}
.a-${ID} .it.berry{top:calc(var(--s)*.4);z-index:2}
.a-${ID} .it.basket{top:calc(var(--s)*2.3);z-index:1}
.a-${ID} .it.basket.full{background:rgba(6,214,160,.28)}
.a-${ID} .it.left{animation:a-som-pulse .9s ease-in-out infinite;background:rgba(255,159,28,.3);box-shadow:0 0 0 3px #ff9f1c}
@keyframes a-som-in{from{opacity:0}}
@keyframes a-som-pulse{50%{filter:drop-shadow(0 0 7px #ff9f1c)}}
.a-${ID} .choices{width:100%;display:flex;gap:10px;justify-content:center;flex-wrap:nowrap}
.a-${ID} .opt{flex:1 1 90px;max-width:170px;min-width:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;min-height:92px;padding:8px 4px;font-size:1.9rem;line-height:1.1}
.a-${ID} .opt .ic{font-size:clamp(1.3rem,5.5vw,1.9rem);white-space:nowrap}
.a-${ID} .opt small{font-size:.95rem;font-weight:800}
.a-${ID} .opt.glow{background:var(--yellow)}
.a-${ID} .actions{min-height:58px}
.a-${ID} .actions .btn{min-height:56px;font-size:1.1rem}
.a-${ID} [hidden]{display:none!important}
`;

export default {
  id: ID,
  rounds: TOTAL,
  parentNote:
    'Young children often think the longer, more spread-out row has more, even when they can count both rows correctly. Ask "Why do you think so?" and let her pair one berry with one basket: if nobody is left over, the rows are the same however they look. Moving things around never changes how many there are. Later rounds use bigger rows, squeezing instead of spreading, and finally a row with one extra that looks shorter after the move: pairing always settles it.',

  async start(api) {
    let alive = true;
    let phase = 'idle'; // intro | spread | moving | ask | done
    let round = resumeRound(api, TOTAL),
      tok = 0,
      wrong = 0;
    let paired = false,
      busy = false;
    let cfg = null,
      berries = [],
      baskets = [];
    const modes = { berry: 'neat', basket: 'neat' };
    api.css(CSS);

    const wrap = h('div', { class: `a-${ID}` });
    const field = h('div', { class: 'field' });
    const actions = h('div', { class: 'act-row actions' });
    const choices = h('div', { class: 'choices' });
    wrap.append(field, actions, choices);
    api.root.append(wrap);

    const optBtns = {};
    for (const o of OPTS) {
      const b = h(
        'button',
        { class: 'chip choice opt', type: 'button', 'aria-label': o.aria, onclick: () => choose(o.key, b) },
        h('span', { class: 'ic' }, o.icon),
        h('small', {}, o.label),
      );
      optBtns[o.key] = b;
      choices.append(b);
    }
    choices.hidden = true;

    const S = () => (berries[0] || baskets[0]).offsetWidth || 40;
    const W = () => field.clientWidth || 320;
    const answer = () => (cfg.nB === cfg.nK ? 'same' : cfg.nB > cfg.nK ? 'berries' : 'baskets');
    const live = (t) => alive && t === tok;

    // ---------- layout ----------
    // Distance between item centres, in px, for n items. 'spread' fills the field (capped at 5.5 item widths),
    // 'squeeze' packs them touching, 'neat' sits in between. Items are centred on the field.
    function gapFor(n, mode) {
      const s = S();
      const spread = Math.min(s * 5.5, Math.max(s * 1.05, (W() - 1.3 * s) / Math.max(1, n - 1)));
      if (mode === 'spread') return spread;
      if (mode === 'squeeze') return s * 1.05;
      return Math.max(s * 1.05, Math.min(s * 1.5, spread * 0.72));
    }
    function place(items, mode) {
      const n = items.length,
        s = S(),
        g = gapFor(n, mode),
        w = W();
      items.forEach((el, i) => {
        el.style.left = `${w / 2 + (i - (n - 1) / 2) * g - s / 2}px`;
      });
    }
    function layoutAll(instant) {
      if (instant) field.classList.add('nt');
      place(berries, modes.berry);
      place(baskets, modes.basket);
      if (instant) {
        void field.offsetWidth;
        field.classList.remove('nt');
      }
    }
    const onResize = () => {
      if (!berries.length) return;
      clearPairsInstant();
      layoutAll(true);
    };
    window.addEventListener('resize', onResize);

    // ---------- pairing ----------
    function clearPairsInstant() {
      for (const el of berries) {
        el.style.transition = '';
        el.style.transform = '';
        el._dragBase = null;
        el._dragPos = null;
        el.classList.remove('left');
      }
      for (const el of baskets) el.classList.remove('full', 'left');
      paired = false;
      syncPairBtn();
    }
    async function pairUp(counting) {
      busy = true;
      const t = tok;
      if (paired) await unpair();
      const m = Math.min(berries.length, baskets.length);
      for (let i = 0; i < m; i++) {
        if (!live(t)) return;
        sfx('pop');
        if (counting) api.say(String(i + 1));
        await flyTo(berries[i], baskets[i], { duration: 450, offset: { x: 0, y: -S() * 0.1 } });
        if (!live(t)) return;
        baskets[i].classList.add('full');
        await sleep(counting ? 380 : 140);
      }
      if (!live(t)) return;
      berries.slice(m).forEach((el) => el.classList.add('left'));
      baskets.slice(m).forEach((el) => el.classList.add('left'));
      paired = true;
      busy = false;
      syncPairBtn();
    }
    async function unpair() {
      const t = tok;
      busy = true;
      for (const el of berries) {
        el.classList.remove('left');
        el.style.transition = 'transform .5s ease';
        el.style.transform = 'translate(0px, 0px)';
        el._dragBase = null;
      }
      for (const el of baskets) el.classList.remove('full', 'left');
      await sleep(540);
      if (!live(t)) return;
      for (const el of berries) {
        el.style.transition = '';
        el.style.transform = '';
      }
      paired = false;
      busy = false;
      syncPairBtn();
    }

    // ---------- controls ----------
    let pairBtn = null;
    function syncPairBtn() {
      if (!pairBtn) return;
      pairBtn.textContent = paired ? '↩ Back' : '🔗 Pair them up';
      pairBtn.setAttribute('aria-label', paired ? 'Put them back' : 'Pair them up');
    }
    function showPairBtn() {
      pairBtn = h('button', {
        class: 'btn',
        type: 'button',
        onclick: async () => {
          if (busy || phase !== 'ask') return;
          sfx('tap');
          if (paired) await unpair();
          else {
            api.prompt('One berry for each basket.');
            await pairUp(false);
          }
        },
      });
      actions.replaceChildren(pairBtn);
      syncPairBtn();
    }
    function askNow() {
      phase = 'ask';
      choices.hidden = false;
      showPairBtn();
      api.prompt(ASK);
    }

    // ---------- the "moving" step ----------
    async function transform() {
      if (phase !== 'spread' && phase !== 'intro') return;
      const t = tok,
        trs = cfg.transform;
      phase = 'moving';
      actions.replaceChildren();
      sfx('whoosh');
      for (const tr of trs) modes[tr.row] = tr.mode;
      layoutAll(false);
      await sleep(1100);
      if (!live(t)) return;
      askNow();
    }

    // ---------- answering ----------
    async function choose(key, btn) {
      if (phase !== 'ask' || busy) return;
      sfx('tap');
      const t = tok;
      if (key === answer()) {
        phase = 'done';
        choices.hidden = false;
        Object.values(optBtns).forEach((b) => b.classList.remove('glow'));
        api.cheer(pick(CHEERS));
        if (!paired) await pairUp(false);
        if (!live(t)) return;
        await sleep(600);
        if (!live(t)) return;
        api.prompt(RESULT[key]);
        await sleep(2600);
        if (!live(t)) return;
        if (round < TOTAL - 1) {
          actions.replaceChildren(
            h(
              'button',
              {
                class: 'btn primary',
                type: 'button',
                onclick: () => {
                  sfx('tap');
                  round++;
                  startRound();
                },
              },
              'Next ➜',
            ),
          );
        } else {
          api.finish();
        }
        return;
      }
      wrong++;
      btn.classList.add('shake');
      setTimeout(() => btn.classList.remove('shake'), 450);
      if (wrong >= 2) optBtns[answer()].classList.add('glow');
      api.nudge(
        wrong === 1 ? 'Hmm, let us check! One berry for each basket.' : 'Look at the pairs. Is anyone left over?',
      );
      await pairUp(false);
      if (!live(t)) return;
      api.prompt(wrong >= 2 ? 'Tap the glowing one.' : 'Now look. Same, or more?');
    }

    // ---------- rounds ----------
    async function startRound() {
      const t = ++tok;
      wrong = 0;
      paired = false;
      busy = false;
      pairBtn = null;
      cfg = makeCfg(round);
      Object.assign(modes, cfg.start);
      Object.values(optBtns).forEach((b) => b.classList.remove('glow', 'shake'));
      choices.hidden = true;
      actions.replaceChildren();
      berries = Array.from({ length: cfg.nB }, () => h('div', { class: 'it berry', 'aria-hidden': 'true' }, '🍓'));
      baskets = Array.from({ length: cfg.nK }, () => h('div', { class: 'it basket', 'aria-hidden': 'true' }, '🧺'));
      field.replaceChildren(h('div', { class: 'shelf t' }), h('div', { class: 'shelf b' }), ...berries, ...baskets);
      layoutAll(true);
      api.stage(round, TOTAL);
      if (round === 0) {
        phase = 'intro';
        api.prompt('Berries on top, baskets below. Watch!');
        await sleep(2600);
        if (!live(t)) return;
        await transform();
      } else if (cfg.transform.length) {
        phase = 'spread';
        api.prompt(cfg.ask);
        actions.replaceChildren(
          h(
            'button',
            {
              class: 'btn primary',
              type: 'button',
              'aria-label': cfg.btn.replace(/^\S+\s/, ''),
              onclick: () => {
                sfx('tap');
                transform();
              },
            },
            cfg.btn,
          ),
        );
      } else {
        askNow();
      }
    }

    // ---------- watch demo ----------
    async function narrate(text, ms = 1100) {
      if (!alive) return;
      await Promise.all([api.prompt(text), sleep(ms)]);
    }
    api.setDemo(async () => {
      const t = tok;
      while (alive && t === tok && (phase === 'intro' || phase === 'moving')) await sleep(150);
      if (!live(t)) return;
      if (phase === 'spread') {
        await narrate(cfg.demo, 800);
        if (!live(t)) return;
        await transform();
        if (!live(t)) return;
      }
      const wasDone = phase === 'done';
      if (busy) return;
      if (paired) {
        await unpair();
        if (!live(t)) return;
      }
      await narrate('Which has more? Let us check!', 800);
      if (!live(t)) return;
      await narrate('One berry for each basket.', 700);
      if (!live(t)) return;
      await pairUp(true);
      if (!live(t)) return;
      await sleep(500);
      const key = answer();
      if (!wasDone) optBtns[key].classList.add('glow');
      await narrate(RESULT[key], 2000);
      if (!live(t)) return;
      await sleep(600);
      if (!wasDone) {
        optBtns[key].classList.remove('glow');
        await unpair();
        if (!live(t)) return;
        if (phase === 'ask') api.prompt(ASK);
      }
    });

    startRound();
    return {
      destroy() {
        alive = false;
        tok++;
        window.removeEventListener('resize', onResize);
      },
    };
  },
};
