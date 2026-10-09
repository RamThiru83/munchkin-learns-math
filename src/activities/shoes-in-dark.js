/**
 * Game: Shoes in the Dark  (id: shoes-in-dark, level 5)
 *
 * Idea: pigeonhole principle. Grabbing from a dark sack, how many grabs make you SURE of a pair?
 *   Only the unluckiest case counts: with c colours of socks it is c + 1; with shoes a pair needs a left AND a
 *   right of one colour, so all lefts (2 per colour) can be pair-less and it is 2c + 1.
 * Rounds (colours are random except round 1; "sure" = answer, found by brute force in analyse()):
 *   1. 2 colours (red, blue) x 4 socks: sure = 3.
 *   2. 3 colours x 3 socks: sure = 4.
 *   3. 2 colours of shoes (2 lefts + 2 rights each): sure = 5.
 *   4. 4 colours x 3 socks: sure = 5.
 *   5. 3 colours of shoes (2 lefts + 2 rights each): sure = 7.
 *   Each round: tap the sack to grab (as often as you like, "Again" returns everything), then "Be SURE" and
 *   pick the number of grabs; a wrong pick gives a hint, the 2nd miss (or "Show me") plays the unluckiest grabs.
 * Watch demo: rebuilds the current round, makes one random try, then plays the unluckiest way and glows the answer.
 * Notes:
 *   - The sack, shelf slots and hand are drawn with inline SVG; the hand/held-item positions (Y, .held top) and
 *     the scene size (220x270, CSS zoom on small screens) are tuned together - change them as a set.
 *   - `ep` (episode counter) invalidates in-flight async work when a round is rebuilt or the game is destroyed;
 *     always test `live(e)` after an await.
 *   - Test hooks (named exports, brute-force checked in node): matchSock, matchShoe, analyse(items, match),
 *     makeRound(roundIndex) -> { sure, worst, ... }.
 */
import { h, sleep, shuffle, pick, flyTo, sfx, settings, resumeRound } from '../lib/core.js';

const ID = 'shoes-in-dark';

// ---------- constants / round data ----------
const PAL = { red: '#ef476f', blue: '#118ab2', yellow: '#ffd166', green: '#06d6a0', purple: '#9b5de5' };
const NAMES = Object.keys(PAL);
// Per round: number of colours, shoes or socks, socks per colour (shoes: 2 lefts + 2 rights per colour).
const ROUNDS = [
  { n: 2, shoes: false, per: 4 },
  { n: 3, shoes: false, per: 3 },
  { n: 2, shoes: true },
  { n: 4, shoes: false, per: 3 },
  { n: 3, shoes: true },
];
const TOTAL = ROUNDS.length;
// Per round: largest number offered on the answer chips, and the width of the chip block (px).
const MAXCHIP = [5, 6, 8, 8, 9];
const CHIP_WIDTH = [340, 200, 270, 340, 340];
// Per round: instruction shown and spoken when the round starts.
const INTRO = [
  'Grab socks in the dark. Two the same make a pair!',
  'Three colours now! Grab until you get a pair.',
  'Shoes! A pair is a left and a right, same colour.',
  'Four colours of socks! Grab until you get a pair.',
  'Three colours of shoes! Left and right, same colour.',
];
const CHEERS = ['Yes!', 'Right!', 'Clever thinking!', 'You got it!'];
// Vertical position (px, relative to the scene) of the hand: out of sight, deep in the sack, lifted with the item.
const HAND_Y = { rest: -330, deep: -70, up: -165 };

// ---------- pure logic (exported so it can be brute-force tested in node) ----------
// Items: socks {c} match on colour; shoes {c, s:'L'|'R'} match when same colour and opposite sides.
export const matchSock = (a, b) => a.c === b.c;
export const matchShoe = (a, b) => a.c === b.c && a.s !== b.s;

// Exhaustive search over every subset of the sack. `sure` = fewest grabs that ALWAYS contain a pair
// (smallest k with no pair-less k-subset). `worst` = every pair-less subset of size sure-1 (the unluckiest grabs).
export function analyse(items, match) {
  const n = items.length;
  const N = 1 << n;
  const hasPair = (m) => {
    for (let i = 0; i < n; i++)
      if ((m >> i) & 1) for (let j = i + 1; j < n; j++) if ((m >> j) & 1 && match(items[i], items[j])) return true;
    return false;
  };
  const sizes = new Set();
  const bySize = {};
  for (let m = 0; m < N; m++) {
    if (hasPair(m)) continue;
    let k = 0;
    for (let x = m; x; x >>= 1) k += x & 1;
    sizes.add(k);
    (bySize[k] = bySize[k] || []).push(m);
  }
  let sure = 1;
  while (sizes.has(sure)) sure++;
  const worst = (bySize[sure - 1] || []).map((m) => items.map((_, i) => i).filter((i) => (m >> i) & 1));
  return { sure, worst };
}

// Build round `ri`: the sack contents, the answer (`sure`) and one random unluckiest grab sequence (`worst`).
export function makeRound(ri) {
  const cfg = ROUNDS[ri];
  const shoes = cfg.shoes;
  const cols = ri === 0 ? ['red', 'blue'] : shuffle(NAMES).slice(0, cfg.n);
  const per = cfg.per;
  const items = [];
  for (const c of cols) {
    if (shoes) for (const s of ['L', 'R']) for (let k = 0; k < 2; k++) items.push({ c, s, k: 'shoe' });
    else for (let k = 0; k < per; k++) items.push({ c, k: 'sock' });
  }
  items.forEach((it, i) => {
    it.id = i;
  });
  const match = shoes ? matchShoe : matchSock;
  const { sure, worst } = analyse(items, match);
  return { ri, cols, items, shoes, match, sure, worst: pick(worst).map((i) => items[i]) };
}

// ---------- text helpers ----------
const cap = (s) => s[0].toUpperCase() + s.slice(1);
const sideName = (s) => (s === 'L' ? 'left' : 'right');
const desc = (it) => (it.k === 'sock' ? `a ${it.c} sock` : `a ${it.c} ${sideName(it.s)} shoe`);

// ---------- drawings (inline SVG; shoes are drawn as a left shoe and mirrored for the right) ----------
function sockSvg(c) {
  return `<svg viewBox="0 0 64 72" aria-hidden="true"><path d="M14 7 Q14 3 18 3 H38 Q42 3 42 7 V37 Q42 42 47 45 L57 51 Q63 56 60 62 Q56 68 48 67 L26 65 Q14 63 14 51 Z" fill="${PAL[c]}" stroke="#2b2d42" stroke-width="3" stroke-linejoin="round"/><path d="M14 10 H42" stroke="#fff" stroke-width="8" opacity=".8"/><ellipse cx="24" cy="55" rx="8" ry="7" fill="#fff" opacity=".5"/><ellipse cx="54" cy="59" rx="6" ry="5" fill="#fff" opacity=".5"/></svg>`;
}
function shoeSvg(c, s) {
  const body = `<path d="M30 4 C41 6 45 18 44 30 C43 44 38 52 36 62 C35 73 31 77 23 77 C14 77 10 71 11 62 C12 50 7 42 8 30 C9 14 18 3 30 4 Z" fill="${PAL[c]}" stroke="#2b2d42" stroke-width="3" stroke-linejoin="round"/><ellipse cx="27" cy="31" rx="9" ry="12" fill="#fff" opacity=".55" transform="rotate(8 27 31)"/><path d="M20 26 h14 M20 32 h14 M20 38 h13" stroke="#2b2d42" stroke-width="2" stroke-linecap="round" opacity=".6"/>`;
  const g = s === 'L' ? `<g>${body}</g>` : `<g transform="translate(52 0) scale(-1 1)">${body}</g>`;
  return `<svg viewBox="0 0 52 80" aria-hidden="true">${g}<circle cx="26" cy="64" r="8.5" fill="#fff" stroke="#2b2d42" stroke-width="2"/><text x="26" y="68.5" text-anchor="middle" font-size="12" font-weight="900" fill="#2b2d42" font-family="sans-serif">${s}</text></svg>`;
}
const itemSvg = (it) => (it.k === 'sock' ? sockSvg(it.c) : shoeSvg(it.c, it.s));

const BACK = `<svg viewBox="0 0 220 270" aria-hidden="true"><g fill="#fff"><circle cx="30" cy="30" r="2.2"/><circle cx="68" cy="58" r="1.6"/><circle cx="150" cy="24" r="2"/><circle cx="196" cy="86" r="1.8"/><circle cx="22" cy="92" r="1.6"/><circle cx="118" cy="48" r="1.4"/></g><path d="M178 16 a15 15 0 1 0 14 22 a12 12 0 1 1 -14 -22z" fill="#ffd166"/><ellipse cx="110" cy="112" rx="56" ry="17" fill="#0d0e22" stroke="#6e4524" stroke-width="5"/></svg>`;
const FRONT = `<svg viewBox="0 0 220 270" aria-hidden="true"><path d="M54 114 Q110 142 166 114 C206 150 214 218 192 246 Q110 276 28 246 C6 218 14 150 54 114 Z" fill="#b8814f" stroke="#2b2d42" stroke-width="4" stroke-linejoin="round"/><path d="M54 114 Q110 142 166 114" fill="none" stroke="#8a5a30" stroke-width="9" stroke-linecap="round"/><path d="M82 176 h56 v44 h-56 z" fill="#d9a066" stroke="#8a5a30" stroke-width="3" stroke-dasharray="6 4" transform="rotate(-4 110 198)"/><text x="110" y="209" text-anchor="middle" font-size="40" font-weight="900" fill="#2b2d42" opacity=".55" font-family="sans-serif">?</text></svg>`;
const HAND = `<svg viewBox="0 0 60 260" width="60" height="260" aria-hidden="true"><rect x="12" y="0" width="36" height="178" fill="#ff8fab" stroke="#2b2d42" stroke-width="3"/><path d="M12 36h36M12 76h36M12 116h36" stroke="#fff" stroke-width="6" opacity=".45"/><rect x="8" y="170" width="44" height="16" rx="6" fill="#fff" stroke="#2b2d42" stroke-width="3"/><g class="g-open" fill="#ffd9b3" stroke="#2b2d42" stroke-width="3" stroke-linejoin="round"><rect x="10" y="206" width="9" height="34" rx="4.5" transform="rotate(14 14 210)"/><rect x="20" y="210" width="9" height="38" rx="4.5" transform="rotate(5 24 214)"/><rect x="31" y="210" width="9" height="38" rx="4.5" transform="rotate(-5 36 214)"/><rect x="41" y="206" width="9" height="34" rx="4.5" transform="rotate(-14 46 210)"/><ellipse cx="30" cy="202" rx="19" ry="16"/></g><g class="g-fist" fill="#ffd9b3" stroke="#2b2d42" stroke-width="3" stroke-linecap="round"><ellipse cx="30" cy="210" rx="20" ry="22"/><path d="M15 218 q15 9 30 0 M17 208 q13 7 26 0" fill="none"/></g></svg>`;

// Scene (sack + hand) is a fixed 220x270 box; `zoom` shrinks it on short or narrow screens.
const CSS = `
.a-shoes-in-dark{width:100%;max-width:520px;display:flex;flex-direction:column;align-items:center;gap:8px;margin:auto 0}
.a-shoes-in-dark .cap{display:flex;align-items:center;justify-content:center;gap:8px;flex-wrap:wrap;font-weight:800;font-size:clamp(.95rem,3.6vw,1.15rem);text-align:center;min-height:36px}
.a-shoes-in-dark .dotc{display:inline-block;width:20px;height:20px;border-radius:50%;border:3px solid #2b2d42}
.a-shoes-in-dark .legend span.pic{display:inline-block;width:26px;height:40px}
.a-shoes-in-dark .legend{display:inline-flex;align-items:center;gap:4px;margin-right:6px}
.a-shoes-in-dark .scene{position:relative;box-sizing:content-box;width:220px;height:270px;max-width:100%;padding:0;border:3px solid #2b2d42;border-radius:26px;overflow:hidden;cursor:pointer;background:radial-gradient(circle at 50% 28%,#4b4f93,#1d1f45);box-shadow:0 5px 0 rgba(43,45,66,.18);flex:none}
.a-shoes-in-dark .scene>svg,.a-shoes-in-dark .scene>.bk,.a-shoes-in-dark .scene>.fr{position:absolute;left:0;top:0;width:100%;height:100%;display:block;pointer-events:none}
.a-shoes-in-dark .scene.off{cursor:default;filter:saturate(.6) brightness(.85)}
.a-shoes-in-dark .scene.pulse{animation:sid-pulse 1.3s ease-in-out infinite}
@keyframes sid-pulse{50%{transform:scale(1.035)}}
.a-shoes-in-dark .hand{position:absolute;left:50%;top:0;width:60px;height:330px;pointer-events:none;transform:translate(-50%,-330px);transition:transform .46s cubic-bezier(.4,.1,.3,1);z-index:2}
.a-shoes-in-dark .hand .in{position:relative;width:60px;height:330px;transform-origin:30px 0}
.a-shoes-in-dark .hand svg{position:relative;z-index:2;display:block}
.a-shoes-in-dark .hand:not(.fist) .g-fist,.a-shoes-in-dark .hand.fist .g-open{display:none}
.a-shoes-in-dark .held{position:absolute;left:50%;top:216px;width:54px;height:66px;margin-left:-27px;z-index:1}
.a-shoes-in-dark .held .pic,.a-shoes-in-dark .item .pic{display:block;width:100%;height:100%}
.a-shoes-in-dark .held svg,.a-shoes-in-dark .item svg{width:100%;height:100%;display:block}
.a-shoes-in-dark .fr{z-index:3}
.a-shoes-in-dark .scene.rum .in{animation:sid-rum .2s ease-in-out 3}
.a-shoes-in-dark .scene.rum .fr{animation:sid-jig .2s ease-in-out 3}
@keyframes sid-rum{25%{transform:translateX(-7px) rotate(-5deg)}75%{transform:translateX(7px) rotate(5deg)}}
@keyframes sid-jig{25%{transform:translateX(-3px) rotate(-1deg)}75%{transform:translateX(3px) rotate(1deg)}}
.a-shoes-in-dark .tapme{position:absolute;left:50%;bottom:10px;transform:translateX(-50%);z-index:4;background:#fff;border:3px solid #2b2d42;border-radius:999px;padding:2px 12px;font-weight:900;font-size:1rem;white-space:nowrap;pointer-events:none}
.a-shoes-in-dark .shelf{display:flex;gap:5px;justify-content:center;width:100%;padding-bottom:7px;border-bottom:7px solid #c98f45;border-radius:0 0 6px 6px}
.a-shoes-in-dark .slot{position:relative;flex:1 1 0;min-width:0;max-width:76px;aspect-ratio:4/5;border:3px dashed #d3c08f;border-radius:14px;background:rgba(255,255,255,.55)}
.a-shoes-in-dark .slot .no{position:absolute;left:4px;top:1px;font-size:.8rem;font-weight:900;color:#a8935f;z-index:1}
.a-shoes-in-dark .slot.full{border-style:solid;border-color:transparent;background:none}
.a-shoes-in-dark .item{position:absolute;inset:0;padding:3px;border-radius:14px;z-index:2}
.a-shoes-in-dark .item.pair{background:#fff3b8;box-shadow:0 0 0 4px rgba(255,209,102,.95)}
.a-shoes-in-dark .item.back .pic{transition:transform .5s,opacity .5s;transform:scale(.25);opacity:0}
.a-shoes-in-dark .ctl{display:flex;gap:10px;flex-wrap:wrap;justify-content:center;align-items:center;min-height:62px;width:100%}
.a-shoes-in-dark .chips{display:flex;gap:8px;flex-wrap:wrap;justify-content:center;max-width:340px}
.a-shoes-in-dark .chip.choice{min-width:58px;min-height:58px;font-size:1.9rem;font-weight:900;font-family:inherit;color:#2b2d42}
.a-shoes-in-dark .chip.ok{background:#06d6a0}
.a-shoes-in-dark .hist{display:flex;gap:6px;align-items:center;justify-content:center;flex-wrap:wrap;min-height:34px;font-weight:800;font-size:.95rem}
.a-shoes-in-dark .pill{display:inline-grid;place-items:center;min-width:30px;height:30px;border-radius:15px;background:#ffd166;border:2px solid #2b2d42;font-weight:900}
@media (max-height:820px){.a-shoes-in-dark .scene{zoom:.85}}
@media (max-width:480px){.a-shoes-in-dark .scene{zoom:.72}.a-shoes-in-dark .slot{aspect-ratio:1/1.1}.a-shoes-in-dark .chip.choice{min-width:52px;min-height:52px}.a-shoes-in-dark .ctl{min-height:56px}.a-shoes-in-dark{gap:6px}}
`;

export default {
  id: ID,
  rounds: ROUNDS.length,
  parentNote:
    'Pull things from a dark sack one at a time: how many must you take to be SURE of a matching pair? Luck can give a pair after 2 grabs, but only the unluckiest case counts: with 2 colours the first two can differ, so the 3rd must match (3 colours: 4th). With shoes a pair needs a left AND a right of one colour, so the unlucky grabs can be all lefts (or all rights) of each colour. Rounds 4 and 5 add four sock colours (5 grabs) and three shoe colours (7 grabs). Ask “Could it take more?” and watch for children who answer with the lucky number.',
  async start(api) {
    let alive = true;
    let ep = 0;
    let ri = resumeRound(api, TOTAL);
    let R = null;
    api.css(CSS);
    const wrap = h('div', { class: `a-${ID}` });
    api.root.append(wrap);
    const live = (e) => alive && e === ep;
    const retrigger = (el, c) => {
      el.classList.remove(c);
      void el.getBoundingClientRect();
      el.classList.add(c);
    };
    // Speak/show a line, then wait long enough to read it (longer when voice is off). False if superseded.
    const tell = async (e, t, ms = 500) => {
      await api.prompt(t);
      if (!live(e)) return false;
      await sleep(ms + (settings.voice ? 0 : 700 + t.length * 22));
      return live(e);
    };
    const putHand = (y) => {
      R.ui.hand.style.transform = `translate(-50%, ${y}px)`;
    };
    const pic = (it) => h('span', { class: 'pic', html: itemSvg(it) });

    // Spoken summary of the unluckiest grabs so far (all different colours, or one side only per colour).
    function noPairMsg() {
      if (!R.shoes) return `${R.shelf.map((x) => cap(x.c)).join(', ')}. All different! No pair yet.`;
      return (
        R.cols
          .map((c) => {
            const m = R.shelf.filter((x) => x.c === c);
            return `${cap(c)} has ${m.length} ${sideName(m[0].s)}s.`;
          })
          .join(' ') + ' No pair yet!'
      );
    }
    const nextMsg = () =>
      R.shoes
        ? `Every shoe left makes a pair. Grab ${R.shelf.length + 1}!`
        : `Only ${R.cols.length} colours, so grab ${R.shelf.length + 1} must match!`;

    // Start (or restart) the current round: new random sack, fresh scene; returns the new episode id.
    function build() {
      ep++;
      const e = ep;
      wrap.replaceChildren();
      api.stage(ri, TOTAL);
      R = makeRound(ri);
      Object.assign(R, {
        e,
        sack: R.items.slice(),
        shelf: [],
        tries: [],
        phase: 'grab',
        busy: false,
        demo: false,
        pairFound: false,
        miss: 0,
        glowed: false,
      });
      const dots = R.cols.map((c) => h('span', { class: 'dotc', style: { background: PAL[c] } }));
      const capEl = R.shoes
        ? h(
            'div',
            { class: 'cap' },
            h(
              'span',
              { class: 'legend' },
              h('span', { class: 'pic', html: shoeSvg(R.cols[0], 'L') }),
              h('span', { class: 'pic', html: shoeSvg(R.cols[0], 'R') }),
              '= a pair',
            ),
            `${R.cols.join(' and ')} shoes`,
          )
        : h(
            'div',
            { class: 'cap' },
            ...dots,
            `Lots of ${R.cols.length === 2 ? R.cols.join(' and ') : R.cols.slice(0, -1).join(', ') + ' and ' + R.cols[R.cols.length - 1]} socks inside`,
          );
      const hand = h(
        'div',
        { class: 'hand' },
        h('div', { class: 'in' }, h('span', { class: 'held' }), h('span', { html: HAND })),
      );
      const tapme = h('span', { class: 'tapme' }, '👆 Tap to grab');
      const scene = h(
        'button',
        { class: 'scene pulse', 'aria-label': 'Reach into the dark sack and grab one', onclick: onGrab },
        h('span', { class: 'bk', html: BACK }),
        hand,
        h('span', { class: 'fr', html: FRONT }),
        tapme,
      );
      const slots = Array.from({ length: R.sure }, (_, i) =>
        h('div', { class: 'slot' }, h('span', { class: 'no' }, i + 1)),
      );
      const shelf = h('div', { class: 'shelf', role: 'group', 'aria-label': 'Shelf of grabbed things' }, ...slots);
      const ctl = h('div', { class: 'ctl' });
      const hist = h('div', { class: 'hist', 'aria-live': 'polite' });
      wrap.append(capEl, scene, shelf, ctl, hist);
      R.ui = { scene, hand, held: hand.querySelector('.held'), tapme, slots, ctl, hist, chips: {} };
      api.prompt(INTRO[ri]);
      return e;
    }

    function renderHist() {
      R.ui.hist.replaceChildren(
        ...(R.tries.length ? ['Grabs it took:', ...R.tries.map((n) => h('span', { class: 'pill' }, n))] : []),
      );
    }

    // One grab: the hand dips into the dark sack, rummages, comes out holding the item, which hops onto the shelf.
    async function grabInto(e, item) {
      const U = R.ui;
      U.tapme.hidden = true;
      U.scene.classList.remove('pulse');
      sfx('whoosh');
      putHand(HAND_Y.deep);
      await sleep(480);
      if (!live(e)) return false;
      U.scene.classList.add('rum');
      [0, 180, 360].forEach((t) =>
        setTimeout(() => {
          if (live(e)) sfx('tick');
        }, t),
      );
      await sleep(620);
      if (!live(e)) return false;
      U.hand.classList.add('fist');
      U.held.replaceChildren(pic(item));
      U.scene.classList.remove('rum');
      await sleep(100);
      if (!live(e)) return false;
      sfx('pop');
      putHand(HAND_Y.up);
      await sleep(500);
      if (!live(e)) return false;
      const from = U.held.firstChild.getBoundingClientRect();
      R.sack = R.sack.filter((x) => x !== item);
      R.shelf.push(item);
      const slot = U.slots[R.shelf.length - 1];
      const el = h('div', { class: 'item', role: 'img', 'aria-label': cap(desc(item)) }, pic(item));
      slot.append(el);
      slot.classList.add('full');
      const to = el.getBoundingClientRect();
      el.style.transition = 'none';
      el.style.transform = `translate(${from.left + from.width / 2 - (to.left + to.width / 2)}px, ${from.top + from.height / 2 - (to.top + to.height / 2)}px) scale(1.1)`;
      void el.offsetWidth;
      el.style.transition = 'transform .5s cubic-bezier(.3,1.3,.5,1)';
      el.style.transform = '';
      U.held.replaceChildren();
      U.hand.classList.remove('fist');
      putHand(HAND_Y.rest);
      await sleep(560);
      return live(e);
    }

    // Highlight the grabbed item and every shelf item it pairs with.
    function markPair(item) {
      const mates = R.shelf.filter((x) => x !== item && R.match(x, item));
      [item, ...mates].forEach((x) => {
        const el = R.ui.slots[R.shelf.indexOf(x)].querySelector('.item');
        el.classList.add('pair');
        retrigger(el, 'hop');
      });
      sfx('good');
    }

    // Fly everything on the shelf back into the sack and reset the shelf.
    async function returnItems(e) {
      const U = R.ui;
      const els = U.slots.map((s) => s.querySelector('.item')).filter(Boolean);
      if (els.length) {
        sfx('whoosh');
        els.forEach((el) => {
          el.classList.remove('pair', 'hop');
          el.classList.add('back');
          flyTo(el, U.scene, { duration: 500 });
        });
        await sleep(560);
        if (!live(e)) return false;
      }
      U.slots.forEach((s) => {
        s.replaceChildren(h('span', { class: 'no' }, U.slots.indexOf(s) + 1));
        s.classList.remove('full');
      });
      R.sack = R.items.slice();
      R.shelf = [];
      R.pairFound = false;
      return true;
    }

    async function onGrab() {
      if (!R || R.busy || R.demo || R.phase !== 'grab' || R.pairFound) return;
      const e = R.e;
      R.busy = true;
      sfx('tap');
      const item = pick(R.sack);
      if (!(await grabInto(e, item))) return;
      const mate = R.shelf.slice(0, -1).find((x) => R.match(x, item));
      if (!mate) {
        api.prompt(`${cap(desc(item))}. No pair yet. Grab again!`);
        R.busy = false;
        return;
      }
      markPair(item);
      R.pairFound = true;
      const n = R.shelf.length;
      R.tries.push(n);
      renderHist();
      showTryButtons();
      api.cheer(n === 2 ? 'Lucky! A pair in 2 grabs!' : `A pair after ${n} grabs!`);
      R.busy = false;
    }

    function showTryButtons() {
      const again = h(
        'button',
        {
          class: 'btn',
          'aria-label': 'Grab again',
          onclick: async () => {
            if (R.busy || R.demo) return;
            const e = R.e;
            R.busy = true;
            sfx('tap');
            if (!(await returnItems(e))) return;
            R.ui.ctl.replaceChildren();
            R.busy = false;
            api.prompt('Grab again!');
          },
        },
        '🔁 Again',
      );
      const sure = h(
        'button',
        {
          class: `btn primary${R.tries.length >= 2 ? ' glow' : ''}`,
          'aria-label': 'How many grabs to be sure of a pair?',
          onclick: async () => {
            if (R.busy || R.demo) return;
            const e = R.e;
            R.busy = true;
            sfx('tap');
            if (!(await returnItems(e))) return;
            showAsk();
            R.busy = false;
          },
        },
        '💡 Be SURE',
      );
      R.ui.ctl.replaceChildren(again, sure);
    }

    function showAsk() {
      const U = R.ui;
      R.phase = 'ask';
      U.scene.classList.add('off');
      const chips = h('div', {
        class: 'chips',
        role: 'group',
        'aria-label': 'Number of grabs',
        style: { maxWidth: `${CHIP_WIDTH[ri]}px` },
      });
      for (let n = 1; n <= MAXCHIP[ri]; n++) {
        const b = h(
          'button',
          { class: 'chip choice', 'aria-label': `${n} grabs`, onclick: () => onChip(n, b) },
          String(n),
        );
        U.chips[n] = b;
        chips.append(b);
      }
      const show = h(
        'button',
        {
          class: 'btn small',
          'aria-label': 'Show me the unluckiest way',
          onclick: () => {
            if (!R.busy && !R.demo && !R.glowed) hintShow(R.e);
          },
        },
        '🙈 Show me',
      );
      U.ctl.replaceChildren(chips, show);
      api.prompt('How many grabs, to be SURE of a pair?');
    }

    // The unluckiest scenario: grabs that avoid any pair for as long as possible, then the next grab must match.
    async function runWorst(e, intro) {
      R.busy = true;
      if (R.shelf.length && !(await returnItems(e))) return false;
      if (!(await tell(e, intro, 300))) return false;
      for (const it of shuffle(R.worst)) {
        if (!(await grabInto(e, it))) return false;
        if (!(await tell(e, `${cap(desc(it))}.`, 120))) return false;
      }
      if (!(await tell(e, noPairMsg(), 500))) return false;
      if (!(await tell(e, nextMsg(), 400))) return false;
      const last = pick(R.sack.filter((x) => R.shelf.some((y) => R.match(x, y))));
      if (!(await grabInto(e, last))) return false;
      markPair(last);
      await api.cheer(`A pair! ${R.sure} grabs make sure.`);
      if (!live(e)) return false;
      await sleep(settings.voice ? 700 : 1500);
      return live(e);
    }

    async function hintShow(e) {
      R.busy = true;
      R.glowed = true;
      await api.nudge('Let me show you the unluckiest way.');
      if (!live(e)) return;
      if (!(await runWorst(e, 'Unlucky on purpose!'))) return;
      R.ui.chips[R.sure].classList.add('glow');
      api.prompt('Now tap the glowing number.');
      R.busy = false;
    }

    async function onChip(n, btn) {
      if (!R || R.busy || R.demo || R.phase !== 'ask') return;
      const e = R.e;
      sfx('tap');
      if (n === R.sure) {
        R.busy = true;
        R.phase = 'done';
        btn.classList.remove('glow');
        btn.classList.add('ok');
        retrigger(btn, 'hop');
        await api.cheer(`${pick(CHEERS)} ${n} grabs.`);
        if (!live(e)) return;
        if (!(await runWorst(e, 'Here is the unluckiest way.'))) return;
        ri++;
        if (ri < TOTAL) build();
        else api.finish();
        return;
      }
      R.miss++;
      retrigger(btn, 'shake');
      if (R.glowed) {
        api.nudge('Try the glowing number!');
        return;
      }
      if (R.miss >= 2) {
        hintShow(e);
        return;
      }
      api.nudge(
        n < 2
          ? 'One grab cannot make a pair.'
          : n < R.sure
            ? 'You might be unlucky and have no pair yet.'
            : 'That works! But can you be sure with fewer?',
      );
    }

    // ---------- Watch: one real random try, then the unluckiest way, then the answer ----------
    api.setDemo(async () => {
      const e = build();
      R.demo = true;
      R.busy = true;
      if (!(await tell(e, 'Let’s reach into the dark sack.', 300))) return;
      let item;
      do {
        item = pick(R.sack);
        if (!(await grabInto(e, item))) return;
        if (!(await tell(e, `${cap(desc(item))}.`, 150))) return;
      } while (!R.shelf.slice(0, -1).some((x) => R.match(x, item)));
      markPair(item);
      const n = R.shelf.length;
      if (
        !(await tell(
          e,
          n === R.sure ? `A pair after ${n} grabs. That was unlucky!` : `A pair after ${n} grabs. Lucky!`,
          600,
        ))
      )
        return;
      if (!(await tell(e, 'But luck can change. How many grabs to be SURE?', 500))) return;
      if (!(await runWorst(e, 'Let’s be unlucky on purpose.'))) return;
      showAsk();
      R.busy = true;
      const b = R.ui.chips[R.sure];
      b.classList.add('glow');
      if (!(await tell(e, `So ${R.sure} grabs make sure!`, 900))) return;
      b.classList.remove('glow');
      b.classList.add('ok');
      if (!(await tell(e, 'Now you try, with a new sack!', 500))) return;
      build();
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
