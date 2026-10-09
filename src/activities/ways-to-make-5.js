/**
 * Game: Ways to Make Five  (id: ways-to-make-5, level 4)
 *
 * Idea: one total can be paid in several different coin mixes, and the same coins in another order are
 * the same way (2+1+2 is 2+2+1). Finding them all needs a plan: biggest coin first. "Pay the Turnstile":
 * a garden gate takes exactly N in coins worth 1, 2 (and 3).
 * Rounds:
 *   1. Make 4 with 1- and 2-coins (3 ways); the total is shown from the start.
 *   2. Make 5 with 1s and 2s (3 ways); the total is shown from the start.
 *   3. Make 5 with 1, 2, 3 (5 ways); the total is hidden until two ways are found.
 *   4. Make 6 with exactly 3 coins (2 ways: 3+2+1 and 2+2+2); the total is shown.
 *   5. Make 6 with 1, 2, 3 and any number of coins (7 ways); the total is hidden until two ways are found.
 * Watch demo: resets the round, flies coins (biggest first) from the coin box into the slot, counts
 *   them through the gate for the first one or two ways, then hands the round back to the child.
 * Notes:
 *   - The list of ways is computed by partitions() (not hard-coded); the counts above were checked by hand
 *     and match: 3, 3, 5, 2, 7.
 *   - Fragile: the slot width is --u * target (see --n and --u in the CSS); coin widths are v * --u.
 *   - Fragile: the demo resets the dragged coin's internal state (_dragBase, _dragPos) so glideBack()
 *     returns it to the box; this depends on lib/core.js drag().
 *   - Gate sounds use a private Web Audio context (clink), closed in destroy().
 *   - No test hooks are exported.
 */
import { h, sleep, pick, drag, flyTo, glideBack, say, settings, resumeRound } from '../lib/core.js';

const ID = 'ways-to-make-5';
const HINT_DELAY = 1800; // ms before the stronger hint after a second miss in a row
const WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six'];
const ANIMALS = ['🐰', '🦊', '🐻', '🐼', '🐨', '🐸', '🦔', '🐥'];
const CHEERS = ['Clink! A new way!', 'Lovely! Another way!', 'Yes! The gate is open!', 'Ooh, a different way!'];
const ROUNDS = [
  { target: 4, coins: [1, 2], showCount: true, demoCount: 2, prompt: 'Drag coins into the slot. Make exactly 4.' },
  { target: 5, coins: [1, 2], showCount: true, demoCount: 2, prompt: 'The gate wants exactly 5. Find all the ways!' },
  { target: 5, coins: [1, 2, 3], showCount: false, demoCount: 2, prompt: 'Use 1, 2 and 3. Find ways to make 5.' },
  { target: 6, coins: [1, 2, 3], count: 3, showCount: true, demoCount: 1, prompt: 'Make 6 with exactly 3 coins.' },
  { target: 6, coins: [1, 2, 3], showCount: false, demoCount: 2, prompt: 'Make 6 with 1, 2 and 3. Find all ways!' },
];

// Pure helper. All different ways (order does not matter) to write `total` with the given coin values; biggest coin first.
function partitions(total, vals) {
  const out = [];
  const rec = (rem, idx, cur) => {
    if (rem === 0) {
      out.push(cur.slice());
      return;
    }
    for (let i = idx; i >= 0; i--) {
      if (vals[i] <= rem) {
        cur.push(vals[i]);
        rec(rem - vals[i], i, cur);
        cur.pop();
      }
    }
  };
  rec(total, vals.length - 1, []);
  return out;
}
// Canonical key for a mix of coins, e.g. [1,2,2] -> '2+2+1', so the same coins in any order match.
const keyOf = (arr) => [...arr].sort((a, b) => b - a).join('+');

const CSS = `
.a-${ID}{--u:min(64px,calc((100vw - 96px) / var(--n,5)));width:100%;max-width:760px;display:flex;flex-direction:column;align-items:center;gap:10px;padding-bottom:8px}
.a-${ID} .gatezone{width:100%;display:flex;flex-direction:column;align-items:center}
.a-${ID} .scene{position:relative;width:100%;height:clamp(104px,24vw,142px);perspective:700px;overflow:hidden;border:3px solid var(--ink);border-radius:22px 22px 0 0;background:linear-gradient(#bfe9ff 0,#eafaff 56%,#9fe3ad 56%,#6fcf86);box-sizing:border-box}
.a-${ID} .hedge{position:absolute;bottom:0;width:23%;height:74%;background:radial-gradient(circle at 30% 20%,#5fd48a,#2fa35b);border:3px solid var(--ink);box-sizing:border-box;font-size:20px;line-height:1;display:flex;align-items:flex-start;justify-content:space-around;flex-wrap:wrap;padding:6px}
.a-${ID} .hedge.l{left:-3px;border-radius:0 26px 0 0}.a-${ID} .hedge.r{right:-3px;border-radius:26px 0 0 0}
.a-${ID} .gate{position:absolute;left:24%;right:24%;top:30%;bottom:0}
.a-${ID} .door{position:absolute;top:0;bottom:0;width:50%;box-sizing:border-box;border:3px solid var(--ink);background:repeating-linear-gradient(90deg,#d79a5b 0 11px,#b57a42 11px 13px);transition:transform .8s cubic-bezier(.4,.1,.2,1);z-index:2}
.a-${ID} .door.l{left:0;transform-origin:left center;border-radius:16px 0 0 0}.a-${ID} .door.r{right:0;transform-origin:right center;border-radius:0 16px 0 0}
.a-${ID} .door::after{content:'';position:absolute;left:0;right:0;top:46%;height:7px;background:#8a5a2b;border-top:2px solid var(--ink);border-bottom:2px solid var(--ink)}
.a-${ID} .scene.open .door.l{transform:rotateY(78deg)}.a-${ID} .scene.open .door.r{transform:rotateY(-78deg)}
.a-${ID} .sign{position:absolute;left:50%;top:5px;transform:translateX(-50%);z-index:4;background:#fff3c4;border:3px solid var(--ink);border-radius:14px;padding:1px 14px;font-weight:900;font-size:1.05rem;white-space:nowrap;box-shadow:0 3px 0 rgba(43,45,66,.18)}
.a-${ID} .sign b{font-size:1.6rem;vertical-align:-2px;margin:0 3px}
.a-${ID} .walker{position:absolute;left:50%;top:34%;font-size:34px;line-height:1;opacity:0;transform:translate(-50%,0) scale(.5);z-index:3;pointer-events:none}
.a-${ID} .walker.go{animation:w5-walk 1.25s ease-in forwards}
@keyframes w5-walk{0%{opacity:0;transform:translate(-50%,0) scale(.5)}20%{opacity:1}80%{opacity:1}100%{opacity:0;transform:translate(-50%,30px) scale(1.2)}}
.a-${ID} .paybox{width:100%;box-sizing:border-box;background:linear-gradient(#f6e3c4,#efd5ab);border:3px solid var(--ink);border-top:0;border-radius:0 0 22px 22px;padding:8px 8px 10px;display:flex;flex-direction:column;align-items:center;gap:6px;transition:box-shadow .2s}
.a-${ID} .gatezone.over .paybox{box-shadow:0 0 0 6px rgba(255,209,102,.9)}
.a-${ID} .paylabel{display:flex;gap:12px;align-items:center;font-weight:900}
.a-${ID} .sum{background:#fff;border:3px solid var(--ink);border-radius:999px;padding:0 14px;font-size:1.15rem;min-width:84px;text-align:center}
.a-${ID} .tray{display:grid;max-width:100%;box-sizing:border-box;padding:8px;background:#7a5a3a;border:3px solid var(--ink);border-radius:18px}
.a-${ID} .tray>*{grid-area:1/1}
.a-${ID} .cells,.a-${ID} .placed{display:flex;align-items:center}
.a-${ID} .cells i{width:var(--u);height:56px;box-sizing:border-box;border:2px dashed #d9bf92;border-radius:14px;transition:background .25s}
.a-${ID} .cells i.full{background:rgba(255,209,102,.5);border-style:solid;border-color:#ffd166}
.a-${ID} .cells i.ping{background:#fff6b0;border-color:#fff;transform:scale(1.07);box-shadow:0 0 12px #fff6b0}
.a-${ID} .coin{--v:1;position:relative;flex:none;width:calc(var(--v) * var(--u) - 6px);height:56px;margin:0 3px;padding:0;border:3px solid var(--ink);border-radius:999px;box-sizing:border-box;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;font:inherit;font-weight:900;color:var(--ink);cursor:grab;touch-action:none;user-select:none;box-shadow:0 3px 0 rgba(43,45,66,.25),inset 0 0 0 3px rgba(255,255,255,.45);background:radial-gradient(circle at 30% 25%,#ffe0c2,#e9955a 55%,#c9783a)}
.a-${ID} .coin[data-v="2"]{background:radial-gradient(circle at 30% 25%,#ffffff,#cfd8e4 55%,#a2afc2)}
.a-${ID} .coin[data-v="3"]{background:radial-gradient(circle at 30% 25%,#fff6c9,#ffd75e 55%,#e0a800)}
.a-${ID} .coin .d{font-size:1.45rem;line-height:1}
.a-${ID} .coin .st{display:flex;gap:calc(var(--u) * .28)}.a-${ID} .coin .st s{width:7px;height:7px;border-radius:50%;background:rgba(43,45,66,.55)}
.a-${ID} .coin.placed{cursor:pointer}
.a-${ID} .coin.pop{animation:w5-pop .4s cubic-bezier(.3,1.6,.5,1)}
@keyframes w5-pop{0%{transform:scale(.4)}100%{transform:scale(1)}}
.a-${ID} .binrow{display:flex;gap:12px;flex-wrap:wrap;justify-content:center;align-items:center;padding:8px 12px;background:#e9f6ff;border:3px dashed #4cc9f0;border-radius:20px;width:100%;box-sizing:border-box}
.a-${ID} .binrow .coin{margin:0}
.a-${ID} .binrow .tag{font-weight:900;width:100%;text-align:center;font-size:.95rem}
.a-${ID} .coin.dragging{z-index:1000}
.a-${ID} .shelf{width:100%;box-sizing:border-box;background:linear-gradient(#fff,#fff6dc);border:3px solid var(--ink);border-radius:20px;padding:8px 10px 12px}
.a-${ID} .shelf.done{background:linear-gradient(#e2f9ec,#c8f1da)}
.a-${ID} .shelf-head{font-weight:900;margin:0 4px 8px;display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap;align-items:center}
.a-${ID} .shelf-head .count{background:#fff;border:3px solid var(--ink);border-radius:999px;padding:2px 12px}
.a-${ID} .cards{display:flex;flex-wrap:wrap;gap:8px;justify-content:center}
.a-${ID} .card{display:flex;flex-direction:column;align-items:center;gap:3px;background:#fff;border:3px solid var(--ink);border-radius:14px;padding:6px 8px;box-sizing:border-box;min-width:76px}
.a-${ID} .card.new{animation:w5-pop .55s cubic-bezier(.3,1.6,.5,1)}
.a-${ID} .card.again{animation:w5-wig .7s}
@keyframes w5-wig{20%{transform:rotate(-5deg) scale(1.1);background:#fff6b0}60%{transform:rotate(4deg) scale(1.1);background:#fff6b0}}
.a-${ID} .card .mrow{display:flex;gap:2px}
.a-${ID} .mc{--v:1;width:calc(var(--v) * 19px - 2px);height:22px;border:2px solid var(--ink);border-radius:999px;box-sizing:border-box;display:grid;place-items:center;font-size:.8rem;font-weight:900;background:#e9955a}
.a-${ID} .mc[data-v="2"]{background:#cfd8e4}.a-${ID} .mc[data-v="3"]{background:#ffd75e}
.a-${ID} .card .eq{font-size:.82rem;font-weight:800;opacity:.75;white-space:nowrap}
.a-${ID} .card.ph{border-style:dashed;background:rgba(255,255,255,.5);color:rgba(43,45,66,.45);justify-content:center;font-weight:900;font-size:1.5rem;min-height:56px}
.a-${ID} .controls .btn{font-size:1.02rem}
@media (max-width:420px){.a-${ID} .controls .btn{font-size:.95rem;padding:.5em .9em}.a-${ID} .sign{font-size:.9rem}}
`;

export default {
  id: ID,
  rounds: ROUNDS.length,
  parentNote:
    'The gate takes an exact amount in coins, and the child looks for every different way to pay. The same coins in another order are the same way (2+1+2 is 2+2+1), which is the hard part: young children repeat ways without noticing. Round 4 adds a rule (exactly 3 coins) and round 5 goes up to 6 with seven ways. Ask "How do you know you have them all?" and show the plan: start with the biggest coin, then the next biggest, and so on.',
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
    const talk = (text) => Promise.race([say(text), sleep(700 + text.length * 55)]);
    let ac = null;
    // Two-partial coin 'clink'; pitch rises with i (the i-th count at the gate).
    function clink(i) {
      if (!settings.sound) return;
      try {
        ac = ac || new (window.AudioContext || window.webkitAudioContext)();
        if (ac.state === 'suspended') ac.resume().catch(() => {});
        const t = ac.currentTime;
        [2100, 3150].forEach((f, k) => {
          const o = ac.createOscillator();
          const g = ac.createGain();
          o.type = 'sine';
          o.frequency.value = f * (1 + i * 0.07);
          g.gain.setValueAtTime(0.0001, t);
          g.gain.exponentialRampToValueAtTime(0.09 / (k + 1), t + 0.01);
          g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
          o.connect(g).connect(ac.destination);
          o.start(t);
          o.stop(t + 0.32);
        });
      } catch {
        /* sound is optional */
      }
    }

    api.css(CSS);
    const wrap = h('div', { class: `a-${ID}` });
    api.root.append(wrap);
    const signN = h('b', {});
    const sign = h('div', { class: 'sign' }, 'Exactly', signN);
    const door = (c) => h('div', { class: 'door ' + c });
    const walker = h('div', { class: 'walker', 'aria-hidden': 'true' });
    const scene = h(
      'div',
      { class: 'scene' },
      h('div', { class: 'hedge l', 'aria-hidden': 'true' }, '🌷', '🌼'),
      h('div', { class: 'hedge r', 'aria-hidden': 'true' }, '🌸', '🌻'),
      h('div', { class: 'gate' }, door('l'), door('r')),
      sign,
      walker,
    );
    const cellsEl = h('div', { class: 'cells', 'aria-hidden': 'true' });
    const placed = h('div', { class: 'placed' });
    const tray = h('div', { class: 'tray', role: 'group', 'aria-label': 'Coin slot' }, cellsEl, placed);
    const sumEl = h('span', { class: 'sum', 'aria-live': 'polite' });
    const slotLbl = h('span', {}, '🪙 Slot');
    const paybox = h('div', { class: 'paybox' }, h('div', { class: 'paylabel' }, slotLbl, sumEl), tray);
    const zone = h('div', { class: 'gatezone' }, scene, paybox);
    const bins = h('div', { class: 'binrow' });
    const btnClear = h(
      'button',
      { class: 'btn', type: 'button', 'aria-label': 'Take all coins out of the slot' },
      '🧺 Empty',
    );
    const btnHint = h('button', { class: 'btn', type: 'button', 'aria-label': 'Hint' }, '💡 Hint');
    const controls = h('div', { class: 'act-row controls' }, btnClear, btnHint);
    const headEl = h('span', {});
    const countEl = h('span', { class: 'count' });
    const cardsEl = h('div', { class: 'cards' });
    const shelf = h(
      'section',
      { class: 'shelf', 'aria-label': 'Ways we found' },
      h('div', { class: 'shelf-head' }, headEl, countEl),
      cardsEl,
    );
    wrap.append(zone, bins, controls, shelf);

    let round = resumeRound(api, ROUNDS.length);
    let R = ROUNDS[round];
    let ways = [];
    let found = [];
    let foundOrder = {};
    let coins = [];
    let busy = false;
    let demoOn = false;
    let wrong = 0;
    let revealed = false;
    let epoch = 0;
    let justAdded = null;
    const sum = () => coins.reduce((a, b) => a + b, 0);
    const glow = (el) => {
      el.classList.add('glow', 'hop');
      later(() => el.classList.remove('glow', 'hop'), 2600);
    };
    const restart = (el, cls, ms) => {
      el.classList.remove(cls);
      void el.offsetWidth;
      el.classList.add(cls);
      later(() => el.classList.remove(cls), ms);
    };

    function coinEl(v, extra = '') {
      const b = h(
        'button',
        {
          class: 'coin ' + extra,
          type: 'button',
          'data-v': v,
          'aria-label': extra.includes('placed') ? `Take the ${v} coin out` : `${v} coin`,
        },
        h('span', { class: 'd' }, v),
        h(
          'span',
          { class: 'st' },
          Array.from({ length: v }, () => h('s', {})),
        ),
      );
      b.style.setProperty('--v', v);
      return b;
    }
    function miniCoin(v) {
      const m = h('span', { class: 'mc', 'data-v': v }, v);
      m.style.setProperty('--v', v);
      return m;
    }

    function renderTray(popLast = false) {
      const s = sum();
      [...cellsEl.children].forEach((c, i) => c.classList.toggle('full', i < s));
      const els = coins.map((v, idx) => {
        const c = coinEl(v, 'placed' + (popLast && idx === coins.length - 1 ? ' pop' : ''));
        c.addEventListener('click', () => removeCoin(idx));
        return c;
      });
      placed.replaceChildren(...els);
      sumEl.textContent = `${s} of ${R.target}`;
    }
    function renderShelf() {
      const n = found.length;
      const N = ways.length;
      headEl.textContent = '📋 Ways we found';
      countEl.textContent = revealed ? `${n} of ${N}` : String(n);
      shelf.classList.toggle('done', n === N);
      const cards = found.map((k) => {
        const arr = k.split('+').map(Number);
        return h(
          'div',
          {
            class: 'card' + (k === justAdded ? ' new' : ''),
            'data-key': k,
            role: 'img',
            'aria-label': arr.join(' plus '),
          },
          h('div', { class: 'mrow' }, arr.map(miniCoin)),
          h('div', { class: 'eq' }, arr.join(' + ')),
        );
      });
      justAdded = null;
      if (revealed) for (let i = n; i < N; i++) cards.push(h('div', { class: 'card ph', 'aria-hidden': 'true' }, '?'));
      else if (n < N) cards.push(h('div', { class: 'card ph', 'aria-hidden': 'true' }, '?'));
      cardsEl.replaceChildren(...cards);
    }

    // Reset every piece of per-round state and redraw. intro=false is used by the demo (no spoken prompt).
    function setupRound(i, intro = true) {
      epoch++;
      round = i;
      R = ROUNDS[i];
      ways = partitions(R.target, R.coins).filter((w) => !R.count || w.length === R.count);
      found = [];
      foundOrder = {};
      coins = [];
      busy = false;
      wrong = 0;
      revealed = R.showCount;
      justAdded = null;
      wrap.style.setProperty('--n', R.target);
      scene.classList.remove('open');
      walker.classList.remove('go');
      signN.textContent = R.target;
      slotLbl.textContent = R.count ? `🪙 ${R.count} coins` : '🪙 Slot';
      cellsEl.replaceChildren(...Array.from({ length: R.target }, () => h('i', {})));
      bins.replaceChildren(h('div', { class: 'tag' }, 'Coin box: take as many as you like'), ...R.coins.map(makeBin));
      renderTray();
      renderShelf();
      shelf.classList.remove('done');
      api.stage(i, ROUNDS.length);
      if (intro) api.prompt(R.prompt);
    }

    // ----- dragging / tapping coins from the box -----
    function makeBin(v) {
      const b = coinEl(v, 'bin');
      b.style.position = 'relative';
      let moved = false;
      let sx = 0;
      let sy = 0;
      b.addEventListener('pointerdown', (e) => {
        moved = false;
        sx = e.clientX;
        sy = e.clientY;
      });
      b.addEventListener('pointermove', (e) => {
        if (Math.abs(e.clientX - sx) + Math.abs(e.clientY - sy) > 10) moved = true;
        zone.classList.toggle('over', b.classList.contains('dragging'));
      });
      b.addEventListener('click', () => {
        if (moved) {
          moved = false;
          return;
        }
        if (addCoin(v)) restart(b, 'hop', 500);
      });
      drag(b, {
        dropSelector: '.gatezone',
        onDrop: () => {
          addCoin(v);
          return false;
        }, // the coin in the box glides home; a new one lands in the slot
        onEnd: () => zone.classList.remove('over'),
      });
      return b;
    }
    function addCoin(v, { demo = false } = {}) {
      if (!demo && (busy || demoOn)) return false;
      if (sum() + v > R.target) {
        wrong++;
        restart(tray, 'shake', 450);
        const room = R.target - sum();
        api.nudge(`Too big! Only ${room} more fits.`);
        if (wrong >= 2) later(giveHint, HINT_DELAY);
        return false;
      }
      if (!demo && R.count && coins.length >= R.count) {
        wrong++;
        restart(tray, 'shake', 450);
        glow(btnClear);
        api.nudge(`Only ${R.count} coins this time. Take one out.`);
        if (wrong >= 2) later(giveHint, HINT_DELAY);
        return false;
      }
      coins.push(v);
      renderTray(true);
      if (demo) return true;
      if (sum() === R.target) onFull();
      else if (R.count && coins.length === R.count) {
        wrong++;
        restart(tray, 'shake', 450);
        glow(btnClear);
        api.nudge(`${R.count} coins, but not ${R.target} yet. Swap one!`);
        if (wrong >= 2) later(giveHint, HINT_DELAY);
      }
      return true;
    }
    function removeCoin(idx) {
      if (busy || demoOn) return;
      coins.splice(idx, 1);
      renderTray();
      api.prompt(`Now you have ${sum()}. The gate wants ${R.target}.`);
    }
    btnClear.addEventListener('click', () => {
      if (busy || demoOn) return;
      coins = [];
      renderTray();
      api.prompt(`Empty slot. Make ${R.target}!`);
    });

    // ----- hints -----
    function giveHint() {
      if (!alive || busy || demoOn) return;
      const cur = [...coins].sort((a, b) => b - a);
      const fits = (w) => {
        const rest = w.slice();
        for (const c of cur) {
          const i = rest.indexOf(c);
          if (i < 0) return null;
          rest.splice(i, 1);
        }
        return rest;
      };
      const open = ways.filter((w) => !found.includes(keyOf(w)));
      const w = open.map(fits).find((r) => r && r.length);
      if (!w) {
        glow(btnClear);
        api.nudge('Let us empty the slot and try a new mix.');
        return;
      }
      const bin = bins.querySelector(`[data-v="${w[0]}"]`);
      if (bin) glow(bin);
      api.nudge(cur.length ? `Try a ${w[0]} coin next.` : `Try starting with a ${w[0]} coin.`);
    }
    btnHint.addEventListener('click', giveHint);

    // ----- the gate: counted clink, open, a friend walks through, close -----
    async function clinkAndOpen(onOpen) {
      const ep = epoch;
      const ok = () => alive && ep === epoch;
      const cells = [...cellsEl.children];
      for (let i = 0; i < R.target; i++) {
        cells[i].classList.add('ping');
        clink(i);
        await Promise.all([sleep(430), Promise.race([say(WORDS[i + 1], { cancel: true }), sleep(900)])]);
        if (!ok()) return false;
      }
      scene.classList.add('open');
      walker.textContent = pick(ANIMALS);
      restart(walker, 'go', 1300);
      onOpen?.();
      await sleep(1500);
      if (!ok()) return false;
      scene.classList.remove('open');
      cells.forEach((c) => c.classList.remove('ping'));
      await sleep(550);
      return ok();
    }

    async function onFull() {
      if (R.count && coins.length !== R.count) {
        wrong++;
        restart(tray, 'shake', 450);
        glow(btnClear);
        api.nudge(`That is ${R.target}, but with ${WORDS[coins.length]} coins. Use ${WORDS[R.count]}!`);
        if (wrong >= 2) later(giveHint, HINT_DELAY);
        return;
      }
      busy = true;
      const ep = epoch;
      const ok = () => alive && ep === epoch;
      const order = coins.join('+');
      const key = keyOf(coins);
      const isNew = !found.includes(key);
      let line = '';
      const done = await clinkAndOpen(() => {
        if (isNew) {
          found.push(key);
          foundOrder[key] = order;
          justAdded = key;
          wrong = 0;
          if (!revealed && found.length >= 2) {
            revealed = true;
            line = `Clink! There are ${ways.length} ways in all.`;
          } else line = pick(CHEERS);
          renderShelf();
          if (found.length === ways.length) line = `All ${ways.length} ways! Wonderful!`;
          api.cheer(line);
        } else {
          wrong++;
          const card = cardsEl.querySelector(`[data-key="${key}"]`);
          if (card) restart(card, 'again', 750);
          api.prompt(
            foundOrder[key] !== order
              ? 'Same coins, new order. That is the same way!'
              : 'The gate opens! But you had that way.',
          );
        }
      });
      if (!done || !ok()) return;
      coins = [];
      renderTray();
      if (found.length === ways.length) {
        await sleep(2300);
        if (!ok()) return;
        if (round < ROUNDS.length - 1) setupRound(round + 1);
        else api.finish();
        return;
      }
      busy = false;
      await sleep(isNew ? 1700 : 900);
      if (!ok()) return;
      if (!isNew && wrong >= 2) {
        api.prompt('Try different coins this time.');
        later(giveHint, 1400);
        return;
      }
      const left = ways.length - found.length;
      api.prompt(
        revealed ? `${left} more to find. Make ${R.target} a new way!` : `Can you make ${R.target} a different way?`,
      );
    }

    // ----- "Watch": the walk-through of the task, same elements, biggest coin first -----
    api.setDemo(async () => {
      demoOn = true;
      setupRound(round, false);
      const ep = epoch;
      const ok = () => alive && ep === epoch;
      await talk('Watch! I will pay the gate.');
      if (!ok()) return;
      const list = ways.slice(0, R.demoCount);
      for (let w = 0; w < list.length; w++) {
        for (const v of list[w]) {
          await talk(WORDS[v] + '.');
          if (!ok()) return;
          const b = bins.querySelector(`[data-v="${v}"]`);
          b.style.position = 'relative';
          b.style.zIndex = 50;
          await flyTo(b, tray, { duration: 650 });
          if (!ok()) return;
          coins.push(v);
          renderTray(true);
          b._dragBase = { x: 0, y: 0 };
          b._dragPos = null;
          b.style.zIndex = '';
          glideBack(b);
          await sleep(450);
          if (!ok()) return;
        }
        const key = keyOf(list[w]);
        const done = await clinkAndOpen(() => {
          found.push(key);
          justAdded = key;
          renderShelf();
          api.cheer('Clink!');
        });
        if (!done) return;
        coins = [];
        renderTray();
        await sleep(300);
        if (!ok()) return;
        if (w < list.length - 1) {
          await talk('Now another way!');
          if (!ok()) return;
        }
      }
      await talk('There are more ways. Now you try!');
      if (!ok()) return;
      demoOn = false;
      setupRound(round);
    });

    setupRound(round);
    return {
      destroy() {
        alive = false;
        timers.forEach(clearTimeout);
        timers.clear();
        try {
          ac?.close();
        } catch {
          /* ignore */
        }
      },
    };
  },
};
