/**
 * Game: A Day in Order  (id: morning-order, level 1)
 *
 * Idea: putting events in a sensible order is early logical thinking: some steps must come
 *   before others ("a partial order"), while independent steps may swap.
 * Rounds (drag picture cards into numbered slots; any order that obeys the rules is accepted):
 *   1. Three cards (sleep/wake/eat, or wake/wash/eat): one chain.
 *   2. Four cards: wake, wash, eat plus dress or bed (the extra card is free after waking).
 *   3. Six cards: dress, shoes, go chain plus eat and bed or teeth (teeth after eating).
 *   4. Seven cards: sleep to go, with a dressing chain and a washing-then-eating chain.
 *   5. Eight cards: adds teeth after eating, plus hair (after dressing) or bag (after waking).
 * Watch demo: rebuilds the current round, flies the cards into one valid random order, plays the
 *   story, then rebuilds fresh cards for the child.
 * Notes: no test hooks are exported. Each round is a function returning { cards, rules } where a
 *   rule [a, b] means "a before b"; analyse() closes the rules transitively and lists every valid
 *   order. Wrong drops give the "why" sentence first, a glow on valid slots from the 2nd miss.
 *   Slot/tray cards are moved by sync(), which also resets drag transforms.
 */
import { h, sleep, shuffle, pick, drag, flyTo, sfx, resumeRound } from '../lib/core.js';

const CARDS = {
  sleep: { v: 'sleeps in her bed', cap: 'Sleeping', pic: '🛌', corner: '🌙', bg: '#d9dcff' },
  wake: { v: 'wakes up', cap: 'Wakes up', pic: '🥱', corner: '☀️', bg: '#fff0a8' },
  wash: { v: 'washes her hands', cap: 'Washes hands', pic: '🧼', corner: '💦', bg: '#cdf1ff' },
  eat: { v: 'eats breakfast', cap: 'Breakfast', pic: '🥣', corner: '🥛', bg: '#ffe0c2' },
  dress: { v: 'gets dressed', cap: 'Gets dressed', pic: '👗', corner: '✨', bg: '#ffd6e7' },
  bed: { v: 'makes her bed', cap: 'Makes her bed', pic: '🛏️', corner: '✨', bg: '#e3d9ff' },
  teeth: { v: 'brushes her teeth', cap: 'Brushes teeth', pic: '🦷', corner: '✨', bg: '#d8f7ea' },
  shoes: { v: 'puts on her shoes', cap: 'Puts on shoes', pic: '👟', corner: '🧦', bg: '#ffeaa0' },
  hair: { v: 'ties her hair', cap: 'Ties hair', pic: '🎀', corner: '✨', bg: '#ffd9ec' },
  bag: { v: 'packs her bag', cap: 'Packs bag', pic: '📚', corner: '✏️', bg: '#e0f0c8' },
  go: { v: 'walks off to school', cap: 'Off to school', pic: '🎒', corner: '🏫', bg: '#cfe8ff' },
};

// Each round returns { cards, rules:[[a,b]...] } meaning "a must come before b".
const ROUNDS = [
  () =>
    pick([
      {
        cards: ['sleep', 'wake', 'eat'],
        rules: [
          ['sleep', 'wake'],
          ['wake', 'eat'],
        ],
      },
      {
        cards: ['wake', 'wash', 'eat'],
        rules: [
          ['wake', 'wash'],
          ['wash', 'eat'],
        ],
      },
    ]),
  () => {
    const x = pick(['dress', 'bed']);
    return {
      cards: ['wake', 'wash', 'eat', x],
      rules: [
        ['wake', 'wash'],
        ['wake', 'eat'],
        ['wake', x],
        ['wash', 'eat'],
      ],
    };
  },
  () => {
    const x = pick(['bed', 'teeth']);
    const rules = [
      ['wake', 'dress'],
      ['wake', 'eat'],
      ['wake', x],
      ['dress', 'shoes'],
      ['shoes', 'go'],
      ['eat', 'go'],
      [x, 'go'],
    ];
    if (x === 'teeth') rules.push(['eat', 'teeth']);
    return { cards: ['wake', 'dress', 'eat', x, 'shoes', 'go'], rules };
  },
  () => ({
    cards: ['sleep', 'wake', 'wash', 'eat', 'dress', 'shoes', 'go'],
    rules: [
      ['sleep', 'wake'],
      ['wake', 'wash'],
      ['wake', 'dress'],
      ['wash', 'eat'],
      ['dress', 'shoes'],
      ['shoes', 'go'],
      ['eat', 'go'],
    ],
  }),
  () => {
    const x = pick(['hair', 'bag']);
    const rules = [
      ['wake', 'wash'],
      ['wake', 'dress'],
      ['wash', 'eat'],
      ['eat', 'teeth'],
      ['dress', 'shoes'],
      ['shoes', 'go'],
      ['teeth', 'go'],
      [x, 'go'],
    ];
    rules.push(x === 'hair' ? ['dress', 'hair'] : ['wake', 'bag']);
    return { cards: ['wake', 'wash', 'eat', 'teeth', 'dress', x, 'shoes', 'go'], rules };
  },
];
const PROMPTS = [
  'Put the pictures in order. What happens first?',
  'Four pictures. Put her morning in order.',
  'A longer morning. Put every picture in order.',
  'Seven pictures. Start with sleeping.',
  'Eight pictures. The biggest morning yet!',
];
const PHRASES = ['That makes sense!', 'Lovely order!', 'Just right!', 'Yes, that is how it goes!', 'Well done!'];

// Transitive "before" (anc) and "after" (desc) sets per card, plus every valid full order.
function analyse(spec) {
  const anc = {};
  const desc = {};
  spec.cards.forEach((c) => {
    anc[c] = new Set();
    desc[c] = new Set();
  });
  spec.rules.forEach(([a, b]) => {
    anc[b].add(a);
    desc[a].add(b);
  });
  for (let again = true; again;) {
    // transitive closure
    again = false;
    spec.cards.forEach((c) =>
      [...anc[c]].forEach((a) =>
        anc[a].forEach((z) => {
          if (!anc[c].has(z)) {
            anc[c].add(z);
            desc[z].add(c);
            again = true;
          }
        }),
      ),
    );
  }
  const orders = [];
  const rec = (cur, left) => {
    if (!left.length) {
      orders.push(cur);
      return;
    }
    left.forEach((c) => {
      if ([...anc[c]].every((a) => cur.includes(a)))
        rec(
          [...cur, c],
          left.filter((x) => x !== c),
        );
    });
  };
  rec([], spec.cards);
  return { anc, desc, orders };
}

export default {
  id: 'morning-order',
  rounds: ROUNDS.length,
  parentNote:
    'Putting events in a sensible order is early logical thinking: "what must happen before what?" Ask "Why does this one come first?" and "Could any two swap?" — for example, getting dressed and eating breakfast can go either way, but waking up must come first. Rounds 4 and 5 grow to seven and eight pictures, with two separate chains (dressing, and washing then eating then teeth) that can be mixed together. Children often say "that is how mum does it"; gently show that some steps depend on others (shoes after dressing) and some are free.',

  async start(api) {
    let alive = true;
    api.css(`
.a-morning-order{--cw:112px;--ch:136px;width:100%;max-width:880px;display:flex;flex-direction:column;align-items:center;gap:14px;padding-bottom:10px}
.a-morning-order .mo-strip{display:flex;flex-wrap:wrap;gap:10px 12px;justify-content:center;align-items:flex-start}
.a-morning-order .mo-cell{display:flex;flex-direction:column;align-items:center;gap:4px;padding:6px;border-radius:22px;outline:none}
.a-morning-order .mo-cell:focus-visible{box-shadow:0 0 0 4px var(--blue)}
.a-morning-order .mo-num{width:34px;height:34px;border-radius:50%;background:var(--yellow);border:3px solid var(--ink);display:grid;place-items:center;font-weight:900;font-size:1.1rem}
.a-morning-order .mo-slot{position:relative;width:var(--cw);height:var(--ch);border:3px dashed #b9a98a;border-radius:20px;background:rgba(255,255,255,.65)}
.a-morning-order .mo-cell.glow .mo-slot{border-color:var(--orange);background:#fff3c9}
.a-morning-order .mo-cell.glow{box-shadow:0 0 0 5px rgba(255,209,102,.9)}
.a-morning-order .solved .mo-slot{border-style:solid;border-color:var(--green)}
.a-morning-order .mo-tray{display:flex;flex-wrap:wrap;gap:12px;justify-content:center;align-items:center;width:100%;min-height:calc(var(--ch) + 28px);padding:12px;border:3px dotted #c9b98f;border-radius:26px;background:rgba(255,255,255,.5)}
.a-morning-order .mo-card{position:relative;display:flex;flex-direction:column;width:var(--cw);height:var(--ch);padding:0;border:3px solid var(--ink);border-radius:20px;background:#fff;overflow:hidden;cursor:grab;box-shadow:0 4px 0 rgba(43,45,66,.18);font:inherit;color:var(--ink);flex:none}
.a-morning-order .mo-card.in-slot{margin:-3px;box-shadow:none}
.a-morning-order .mo-card.sel{outline:5px solid var(--orange);outline-offset:2px}
.a-morning-order .mo-card.playing{outline:5px solid var(--green);outline-offset:2px;animation:hop .6s}
.a-morning-order .mo-pic{position:relative;flex:1;display:grid;place-items:center;font-size:calc(var(--cw) * .48);line-height:1}
.a-morning-order .mo-corner{position:absolute;top:4px;right:6px;font-style:normal;font-size:calc(var(--cw) * .22)}
.a-morning-order .mo-cap{display:grid;place-items:center;min-height:36px;padding:2px 4px;background:#fff;border-top:3px solid var(--ink);font-weight:800;font-size:.76rem;line-height:1.1}
.a-morning-order .mo-actions{display:flex;gap:12px;justify-content:center;min-height:58px;align-items:center;flex-wrap:wrap}
@media (max-width:560px){
  .a-morning-order{--cw:82px;--ch:102px;gap:10px}
  .a-morning-order .mo-cap{font-size:.64rem;min-height:30px}
  .a-morning-order .mo-strip[data-n="4"]{max-width:calc(2 * (var(--cw) + 30px))}
  .a-morning-order .mo-strip[data-n="5"],.a-morning-order .mo-strip[data-n="6"],.a-morning-order .mo-strip[data-n="7"],.a-morning-order .mo-strip[data-n="8"]{max-width:calc(3 * (var(--cw) + 30px))}
  .a-morning-order .mo-tray{padding:8px;gap:8px}
}`);
    const wrap = h('div', { class: 'a-morning-order' });
    api.root.append(wrap);

    let roundIdx = 0;
    let rid = 0;
    let R = null;
    let timers = [];
    const later = (fn, ms) => {
      timers.push(setTimeout(fn, ms));
    };

    // ----- building a round -----
    function build(i, spec) {
      rid++;
      const sp = spec || ROUNDS[i]();
      const an = analyse(sp);
      let trayIds = shuffle(sp.cards);
      for (let t = 0; t < 20 && an.orders.some((o) => o.join() === trayIds.join()); t++) trayIds = shuffle(sp.cards);
      const n = sp.cards.length;
      R = {
        i,
        spec: sp,
        ...an,
        n,
        order: Array(n).fill(null),
        trayIds,
        els: {},
        cells: [],
        slots: [],
        handles: [],
        solved: false,
        selected: null,
        wrongs: 0,
        playing: false,
      };
      const strip = h('div', { class: 'mo-strip', 'data-n': n });
      for (let k = 0; k < n; k++) {
        const slot = h('div', { class: 'mo-slot' });
        const cell = h(
          'div',
          { class: 'mo-cell', 'data-k': k, role: 'button', tabindex: 0, 'aria-label': `Place number ${k + 1}` },
          h('span', { class: 'mo-num' }, k + 1),
          slot,
        );
        cell.addEventListener('click', (e) => {
          if (e.target.closest('.mo-card') || R.solved || !R.selected) return;
          const id = R.selected;
          setSelected(null);
          tryPlace(id, k);
        });
        cell.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            cell.click();
          }
        });
        R.cells.push(cell);
        R.slots.push(slot);
        strip.append(cell);
      }
      const tray = h('div', { class: 'mo-tray', 'aria-label': 'Picture cards' });
      tray.addEventListener('click', (e) => {
        if (e.target.closest('.mo-card') || R.solved || !R.selected) return;
        const id = R.selected;
        setSelected(null);
        toTray(id);
      });
      R.tray = tray;
      R.actions = h('div', { class: 'mo-actions' });
      R.strip = strip;
      trayIds.forEach((id) => {
        const c = CARDS[id];
        const el = h(
          'button',
          { class: 'mo-card', type: 'button', 'data-id': id, 'aria-label': c.cap },
          h('span', { class: 'mo-pic', style: { background: c.bg } }, c.pic, h('i', { class: 'mo-corner' }, c.corner)),
          h('span', { class: 'mo-cap' }, c.cap),
        );
        el.addEventListener('click', (e) => {
          if (e.detail === 0 && !R.solved) setSelected(R.selected === id ? null : id);
        });
        R.handles.push(
          drag(el, {
            dropSelector: '.mo-cell, .mo-tray',
            onDrop: (dropEl, node, moved) => {
              if (R.solved) return false;
              if (!moved) {
                setSelected(R.selected === id ? null : id);
                return false;
              }
              if (dropEl.classList.contains('mo-tray')) return toTray(id);
              return tryPlace(id, +dropEl.dataset.k);
            },
          }),
        );
        R.els[id] = el;
      });
      wrap.replaceChildren(strip, tray, R.actions);
      sync();
      return rid;
    }

    function resetPos(el) {
      el.style.transition = '';
      el.style.transform = '';
      el.style.zIndex = '';
      el._dragBase = { x: 0, y: 0 };
      el._dragPos = null;
    }
    function sync() {
      R.spec.cards.forEach((id) => {
        const el = R.els[id];
        resetPos(el);
        const k = R.order.indexOf(id);
        el.classList.toggle('in-slot', k >= 0);
        if (k >= 0) R.slots[k].append(el);
      });
      R.trayIds.forEach((id) => {
        if (R.order.indexOf(id) < 0) R.tray.append(R.els[id]);
      });
    }
    function setSelected(id) {
      R.selected = id;
      R.spec.cards.forEach((c) => R.els[c].classList.toggle('sel', c === id));
      if (id) sfx('tap');
    }

    // ----- rules -----
    // feasible: can this partly filled strip (null = empty slot) still become a valid order?
    // trial: the strip after dropping card `id` on slot k (swapping with any occupant).
    // why: the hint sentence naming one broken "before" rule.
    const feasible = (order) => R.orders.some((o) => order.every((c, k) => c == null || c === o[k]));
    const sentence = (a, b) => `First she ${CARDS[a].v}. Then she ${CARDS[b].v}.`;
    function why(order, id, k) {
      for (const x of R.spec.cards) {
        const px = order.indexOf(x);
        if (x === id || px < 0) continue;
        if (R.anc[id].has(x) && px > k) return sentence(x, id);
        if (R.desc[id].has(x) && px < k) return sentence(id, x);
      }
      if (R.anc[id].size > k) return sentence([...R.anc[id]][0], id);
      if (R.desc[id].size > R.n - 1 - k) return sentence(id, [...R.desc[id]][0]);
      return 'Hmm, think about what comes before and after.';
    }
    function trial(id, k) {
      const from = R.order.indexOf(id);
      const next = R.order.slice();
      if (from >= 0) next[from] = null;
      const occ = next[k];
      if (occ && from >= 0) next[from] = occ;
      next[k] = id;
      return next;
    }

    function tryPlace(id, k) {
      if (R.order[k] === id) return false;
      const next = trial(id, k);
      if (!feasible(next)) {
        R.wrongs++;
        const cell = R.cells[k];
        cell.classList.add('shake');
        later(() => cell.classList.remove('shake'), 450);
        if (R.wrongs >= 2) {
          const ok = R.cells.filter((_, j) => feasible(trial(id, j)));
          ok.forEach((c) => c.classList.add('glow'));
          later(() => ok.forEach((c) => c.classList.remove('glow')), 3000);
          api.nudge('Try the glowing spot.');
        } else api.nudge(why(next, id, k));
        return false;
      }
      R.wrongs = 0;
      R.order = next;
      R.cells.forEach((c) => c.classList.remove('glow'));
      setSelected(null);
      sync();
      sfx('drop');
      if (R.order.every(Boolean)) complete(rid);
      return true;
    }
    function toTray(id) {
      const k = R.order.indexOf(id);
      if (k < 0) return false;
      R.order[k] = null;
      R.wrongs = 0;
      setSelected(null);
      sync();
      sfx('pop');
      return true;
    }

    // ----- story playback & finishing -----
    const say1 = (t, ms = 1100) => Promise.all([api.prompt(t), sleep(ms)]);
    async function playStory(my) {
      R.playing = true;
      const ord = R.order.slice();
      for (let k = 0; k < ord.length; k++) {
        if (!alive || my !== rid) return;
        const el = R.els[ord[k]];
        const lead = k === 0 ? 'First' : k === ord.length - 1 ? 'Finally' : 'Then';
        el.classList.add('playing');
        sfx('step');
        await say1(`${lead}, she ${CARDS[ord[k]].v}.`, 1200);
        if (!alive || my !== rid) return;
        el.classList.remove('playing');
      }
      R.playing = false;
    }
    async function complete(my) {
      R.solved = true;
      R.handles.forEach((d) => d.disable());
      R.strip.classList.add('solved');
      R.spec.cards.forEach((c) => {
        R.els[c].style.cursor = 'default';
      });
      api.cheer(pick(PHRASES));
      await sleep(900);
      if (!alive || my !== rid) return;
      await playStory(my);
      if (!alive || my !== rid) return;
      api.cheer(R.orders.length > 1 ? 'Other orders can work too!' : 'That is how her morning goes!');
      const last = roundIdx === ROUNDS.length - 1;
      R.actions.append(
        h(
          'button',
          {
            class: 'btn',
            type: 'button',
            onclick: async () => {
              if (!R.playing) {
                const m = rid;
                await playStory(m);
              }
            },
          },
          '▶ Play again',
        ),
        h(
          'button',
          {
            class: 'btn primary',
            type: 'button',
            onclick: () => {
              sfx('tap');
              if (last) api.finish();
              else startRound(roundIdx + 1);
            },
          },
          last ? 'Finish ⭐' : 'Next ➜',
        ),
      );
    }

    function startRound(i) {
      roundIdx = i;
      api.stage(i, ROUNDS.length);
      build(i);
      api.prompt(PROMPTS[i]);
    }

    // ----- Watch: a correct run on the current round, then hand it back -----
    api.setDemo(async () => {
      const spec = R.spec;
      const i = roundIdx;
      const my = build(i, spec);
      const ord = pick(R.orders);
      await say1('Watch. What happens first?', 1200);
      for (let k = 0; k < ord.length; k++) {
        if (!alive || my !== rid) return;
        const el = R.els[ord[k]];
        const lead = k === 0 ? 'Number one:' : `Number ${k + 1}:`;
        api.prompt(`${lead} she ${CARDS[ord[k]].v}.`);
        await flyTo(el, R.slots[k], { duration: 650 });
        if (!alive || my !== rid) return;
        R.order[k] = ord[k];
        sync();
        sfx('drop');
        await sleep(450);
      }
      if (!alive || my !== rid) return;
      R.solved = true;
      await playStory(my);
      if (!alive || my !== rid) return;
      if (R.orders.length > 1) await say1('Some pictures can swap. Other orders work too.', 1800);
      if (!alive || my !== rid) return;
      await sleep(500);
      if (!alive || my !== rid) return;
      build(i, spec); // fresh cards, your turn
      api.prompt('Now you try!');
    });

    const startAt = resumeRound(api, ROUNDS.length);
    startRound(startAt);
    return {
      destroy() {
        alive = false;
        timers.forEach(clearTimeout);
        timers = [];
      },
    };
  },
};
