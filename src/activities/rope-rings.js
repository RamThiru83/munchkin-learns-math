/**
 * Game: Rope Rings  (id: rope-rings, level 2)
 *
 * Idea: two ropes make a Venn diagram; a block can fit both ropes (AND), either (OR), neither, or "not" one.
 * Blocks are judged by attributes (colour, shape, size), so every placement is checked by the rule, not a fixed answer.
 * Rounds:
 *   1. Two separate ropes (red / blue): sort 5 big blocks; the one that fits neither stays outside.
 *   2. The ropes slide together (intro animation); sort 6 big blocks, one fits both (red + a shape).
 *   3. Sort 8 blocks (colour rope + shape rope, or 40% of the time a size rope: then 8-9 blocks), all sizes; then "A or B", "not A", "how many in both?".
 *   4. Sort 9 blocks (colour + shape, all sizes); then "only A", "neither", "how many outside?".
 *   5. Colour + size ropes: sort 10 blocks (3 in the middle); then "only B", "not in both", "how many A in all?".
 * Watch demo: re-sets the current round, sorts every block with a spoken reason, then answers any questions by tapping.
 * Notes: rounds are random each play (rules and blocks are drawn at random, never repeating a block), so block
 *   counts per zone are set only in makeRound(). Layout is in board units (geom); portrait (<560px wide) stacks the
 *   ropes vertically. makeSlots() needs room for every block in each zone: if a round's counts change, re-check
 *   at 360px width. Count buttons are 1-4 (rounds 1-3) or 1-6. No test hooks are exported.
 */
import { h, sleep, shuffle, rand, pick, drag, flyTo, sfx, resumeRound } from '../lib/core.js';

const ID = 'rope-rings';
const TOTAL = 5; // rounds
const COL = { red: '#ef476f', blue: '#118ab2', yellow: '#ffd166', green: '#06d6a0', grey: '#d5d8ea' };
const COLORS4 = ['red', 'blue', 'yellow', 'green'];
const SHAPES = ['circle', 'square', 'triangle'];
const SIZES = ['big', 'small'];
const ROPE = {
  A: { main: '#c8743a', light: '#f6d2a4', tint: 'rgba(240,170,90,.20)' },
  B: { main: '#6f5bb0', light: '#d3c8f3', tint: 'rgba(130,105,220,.18)' },
};
const LENS = 'rgba(255,143,171,.38)';
const D = 56; // footprint of one block on the board (board units)
// every distinct block: 4 colours x 3 shapes x 2 sizes = 24
const ALL = [];
for (const color of COLORS4) for (const shape of SHAPES) for (const size of SIZES) ALL.push({ color, shape, size });
const CHEERS = ['Lovely!', 'Yes, that fits!', 'Nice one!', 'Great sorting!', 'Just right!', 'Well done!'];
const SHAPE_ADJ = { circle: 'round', square: 'square', triangle: 'triangle' };
const ruleWord = (r) => (r.kind === 'shape' ? SHAPE_ADJ[r.val] : r.val);
const ruleIs = (r) => (r.kind === 'shape' && r.val === 'triangle' ? 'a triangle' : ruleWord(r));
const matches = (r, it) => it[r.kind] === r.val;
const up1 = (s) => s.charAt(0).toUpperCase() + s.slice(1);
// questions asked after the sort, keyed by round index (2, 3, 4 = rounds 3, 4, 5)
const QS = {
  2: [
    ['pick', 'or'],
    ['pick', 'not'],
    ['count', 'both'],
  ],
  3: [
    ['pick', 'onlyA'],
    ['pick', 'none'],
    ['count', 'out'],
  ],
  4: [
    ['pick', 'onlyB'],
    ['pick', 'notboth'],
    ['count', 'allA'],
  ],
};
const ease = (p) => (p < 0.5 ? 2 * p * p : 1 - 2 * (1 - p) * (1 - p));
const lerp = (a, b, p) => a + (b - a) * p;

// ---------- geometry (board units) ----------
// Rope circles A and B and label positions; `over` = ropes overlap, `portrait` = stacked vertically (phones).
function geom(over, portrait) {
  let W, H, A, B;
  if (!portrait) {
    W = 640;
    H = 390;
    A = over ? { x: 255, y: 225, r: 130 } : { x: 175, y: 225, r: 118 };
    B = over ? { x: 385, y: 225, r: 130 } : { x: 465, y: 225, r: 118 };
  } else {
    W = 360;
    H = 480;
    A = over ? { x: 180, y: 190, r: 115 } : { x: 180, y: 140, r: 92 };
    B = over ? { x: 180, y: 300, r: 115 } : { x: 180, y: 340, r: 92 };
  }
  const la = { x: A.x, y: A.y - A.r - 24 };
  const lb = portrait ? { x: B.x, y: B.y + B.r + 24 } : { x: B.x, y: B.y - B.r - 24 };
  return { W, H, A, B, la, lb, lo: portrait ? { x: 48, y: 18 } : { x: 56, y: 20 } };
}
const lerpG = (g0, g1, p) => {
  const c = (a, b) => ({
    x: lerp(a.x, b.x, p),
    y: lerp(a.y, b.y, p),
    r: a.r === undefined ? undefined : lerp(a.r, b.r, p),
  });
  return { W: g1.W, H: g1.H, A: c(g0.A, g1.A), B: c(g0.B, g1.B), la: c(g0.la, g1.la), lb: c(g0.lb, g1.lb), lo: g1.lo };
};
// zone of a point; with margin m, points closer than m to a rope belong to no zone (null)
function zoneAt(g, x, y, m = 0) {
  const dA = Math.hypot(x - g.A.x, y - g.A.y) - g.A.r;
  const dB = Math.hypot(x - g.B.x, y - g.B.y) - g.B.r;
  if (Math.abs(dA) < m || Math.abs(dB) < m) return null;
  return dA < 0 ? (dB < 0 ? 'AB' : 'A') : dB < 0 ? 'B' : 'OUT';
}
// Tidy resting places for blocks, per zone: grid-scan the board for points clear of labels and rope lines,
// then greedily thin them (nearest the zone centre first), shrinking the spacing until `need` slots fit.
function makeSlots(g, need) {
  const labs = [
    { ...g.la, w: 140, h: 42 },
    { ...g.lb, w: 140, h: 42 },
    { ...g.lo, w: 90, h: 28 },
  ];
  const pad = D / 2 + 4;
  const cand = { A: [], B: [], AB: [], OUT: [] };
  for (let y = pad; y <= g.H - pad; y += 6)
    for (let x = pad; x <= g.W - pad; x += 6) {
      if (labs.some((l) => Math.abs(x - l.x) < l.w / 2 + 12 && Math.abs(y - l.y) < l.h / 2 + 12)) continue;
      const z = zoneAt(g, x, y, 30);
      if (z) cand[z].push({ x, y });
    }
  let slots;
  for (const sep of [60, 52, 46, 40]) {
    slots = { A: [], B: [], AB: [], OUT: [] };
    let ok = true;
    for (const z of Object.keys(slots)) {
      const c = cand[z];
      if (!c.length) {
        if (need[z]) ok = false;
        continue;
      }
      const mx = c.reduce((s, p) => s + p.x, 0) / c.length;
      const my = c.reduce((s, p) => s + p.y, 0) / c.length;
      const sorted = c.slice().sort((a, b) => Math.hypot(a.x - mx, a.y - my) - Math.hypot(b.x - mx, b.y - my));
      for (const p of sorted)
        if (slots[z].every((s) => Math.hypot(s.x - p.x, s.y - p.y) >= sep)) slots[z].push({ ...p });
      if (slots[z].length < (need[z] || 0)) ok = false;
    }
    if (ok) return slots;
  }
  for (const z of Object.keys(slots))
    while (cand[z].length && slots[z].length < (need[z] || 0)) slots[z].push({ ...pick(cand[z]) });
  return slots;
}

// ---------- blocks ----------
function tokSvg(it) {
  const s = it.size === 'big' ? 25 : 15;
  const fill = COL[it.color];
  const a = { fill, stroke: '#2b2d42', 'stroke-width': 3, 'stroke-linejoin': 'round' };
  let shape;
  if (it.shape === 'circle') shape = h('circle', { cx: 30, cy: 30, r: s, ...a });
  else if (it.shape === 'square') shape = h('rect', { x: 30 - s, y: 30 - s, width: 2 * s, height: 2 * s, rx: 5, ...a });
  else
    shape = h('polygon', {
      points: `30,${30 - s * 1.05} ${30 + s * 1.1},${30 + s * 0.85} ${30 - s * 1.1},${30 + s * 0.85}`,
      ...a,
    });
  return h(
    'svg',
    { viewBox: '0 0 60 60', 'aria-hidden': 'true' },
    shape,
    h('ellipse', {
      cx: 30 - s * 0.38,
      cy: 30 - s * 0.38,
      rx: s * 0.2,
      ry: s * 0.12,
      fill: '#fff',
      opacity: 0.55,
      transform: `rotate(-35 ${30 - s * 0.38} ${30 - s * 0.38})`,
    }),
  );
}
// Pick distinct random blocks for each zone count (A, B, AB, OUT) according to the two rope rules.
function genItems(counts, A, B, bigOnly) {
  const used = new Set();
  const out = [];
  const zof = (c) => (matches(A, c) ? (matches(B, c) ? 'AB' : 'A') : matches(B, c) ? 'B' : 'OUT');
  for (const z of ['AB', 'A', 'B', 'OUT']) {
    for (let k = 0; k < (counts[z] || 0); k++) {
      const c = ALL.filter(
        (x) => zof(x) === z && !used.has(x.color + x.shape + x.size) && (!bigOnly || x.size === 'big'),
      );
      if (!c.length) break;
      const it = { ...pick(c) };
      used.add(it.color + it.shape + it.size);
      out.push(it);
    }
  }
  return shuffle(out);
}
// Random rules and blocks for round index i (0-4); round 1 is fixed red/blue.
function makeRound(i) {
  let A;
  let B;
  let counts;
  let bigOnly = true;
  if (i === 0) {
    A = { kind: 'color', val: 'red' };
    B = { kind: 'color', val: 'blue' };
    counts = { A: 2, B: 2, OUT: 1 };
  } else {
    A = { kind: 'color', val: pick(COLORS4) };
    if (i === 2 && Math.random() < 0.4) B = { kind: 'size', val: pick(SIZES) };
    else B = { kind: 'shape', val: pick(SHAPES) };
    if (i === 1) counts = { AB: 1, A: 2, B: 2, OUT: 1 };
    else if (i === 3) {
      bigOnly = false;
      counts = { AB: 2, A: 2, B: 3, OUT: 2 };
    } else if (i === 4) {
      B = { kind: 'size', val: pick(SIZES) };
      bigOnly = false;
      counts = { AB: 3, A: 2, B: 2, OUT: 3 };
    } else {
      bigOnly = false;
      counts = { AB: B.kind === 'size' ? 2 + rand(2) : 2, A: 2, B: 2, OUT: 2 };
    }
  }
  return { A, B, over: i > 0, items: genItems(counts, A, B, bigOnly), counts };
}

const CSS = `
.a-rope-rings{width:100%;max-width:760px;display:flex;flex-direction:column;align-items:center;gap:10px;padding-bottom:6px}
.a-rope-rings .rr-board{position:relative;width:100%;box-sizing:border-box;border:3px solid var(--ink);border-radius:22px;overflow:hidden;background:radial-gradient(circle at 30% 20%,#fffaf0 0,#fff0d6 60%,#f7e2bd)}
.a-rope-rings .rr-svg{position:absolute;inset:0;width:100%;height:100%;pointer-events:none}
.a-rope-rings .rr-lens.hint{animation:rr-lens .9s ease-in-out infinite}
@keyframes rr-lens{50%{fill:rgba(255,209,102,.95)}}
.a-rope-rings .rr-label{position:absolute;transform:translate(-50%,-50%);display:flex;align-items:center;gap:6px;background:#fff;border:3px solid;border-radius:999px;padding:2px 12px 2px 6px;font-weight:900;font-size:1rem;white-space:nowrap;z-index:4;pointer-events:none}
.a-rope-rings .rr-label svg{width:24px;height:24px}
.a-rope-rings .rr-label .dot{width:20px;height:20px;border-radius:50%;border:3px solid var(--ink);box-sizing:border-box}
.a-rope-rings .rr-label.out{border-style:dashed;border-color:#a89b82;color:#7a6f5b;font-size:.82rem;padding:1px 10px}
.a-rope-rings .rr-tray{display:flex;flex-wrap:wrap;gap:10px;justify-content:center;align-items:center;min-height:76px;width:100%;box-sizing:border-box;padding:8px;background:#fff;border:3px dashed #b9a98a;border-radius:20px}
.a-rope-rings .rr-tray.gone{display:none}
.a-rope-rings .rr-tray.locked{pointer-events:none;opacity:.6}
.a-rope-rings .rr-tok{position:relative;width:60px;height:60px;padding:0;border:0;background:transparent;cursor:grab;z-index:5;-webkit-tap-highlight-color:transparent}
.a-rope-rings .rr-tok svg{width:100%;height:100%;display:block;pointer-events:none;filter:drop-shadow(0 3px 2px rgba(43,45,66,.25))}
.a-rope-rings .rr-tok.placed{position:absolute;height:auto;aspect-ratio:1/1;z-index:3;cursor:default}
.a-rope-rings .rr-tok.pickable{cursor:pointer}
.a-rope-rings .rr-tok.ok svg{filter:drop-shadow(0 0 6px #06d6a0) drop-shadow(0 0 3px #06d6a0)}
.a-rope-rings .rr-tok.ok::after{content:'\\2713';position:absolute;right:-2px;top:-4px;width:20px;height:20px;line-height:20px;text-align:center;font-weight:900;font-size:.8rem;border-radius:50%;background:#06d6a0;color:#fff;border:2px solid var(--ink)}
.a-rope-rings .rr-tok.tip svg{filter:drop-shadow(0 0 7px #ff9f1c) drop-shadow(0 0 4px #ff9f1c);animation:rr-hop .7s ease-in-out infinite}
.a-rope-rings .rr-tok.wob svg{animation:rr-wob .4s}
.a-rope-rings .rr-tok.hopx svg{animation:rr-hop .5s}
.a-rope-rings .rr-tok.dragging{z-index:1000}
@keyframes rr-wob{25%{transform:translateX(-6px)}75%{transform:translateX(6px)}}
@keyframes rr-hop{40%{transform:translateY(-10px) scale(1.12)}}
.a-rope-rings .rr-slot{position:absolute;transform:translate(-50%,-50%);aspect-ratio:1/1;pointer-events:none;opacity:0}
.a-rope-rings .rr-hint{position:absolute;transform:translate(-50%,-50%);aspect-ratio:1/1;border:4px dashed #ff9f1c;border-radius:50%;box-sizing:border-box;pointer-events:none;z-index:2;animation:rr-pulse 1s ease-in-out infinite}
@keyframes rr-pulse{50%{transform:translate(-50%,-50%) scale(1.15);background:rgba(255,209,102,.4)}}
.a-rope-rings .rr-num{font-weight:900;font-size:2rem}
@media (max-width:420px){.a-rope-rings .rr-label{font-size:.9rem}.a-rope-rings .rr-tray{gap:6px;padding:6px}.a-rope-rings .rr-tok:not(.placed){width:54px;height:54px}}
`;

export default {
  id: ID,
  rounds: TOTAL,
  parentNote:
    'Two ropes make two groups, and a block can belong to both at once: a red round block is red AND round, so it goes where the ropes cross. Ask "Is it red? Is it round?" before each block. Later rounds ask "red but NOT round", "neither", "how many are outside?" and "how many red in all?" (middle included). Common slips: forcing every block into just one rope, and forgetting that blocks which fit neither rope still belong somewhere (outside).',
  async start(api) {
    let alive = true;
    let token = 0;
    let demoRun = false;
    let cur = 0;
    const portrait = (api.root.clientWidth || window.innerWidth) < 560;
    api.css(CSS);
    const wrap = h('div', { class: `a-${ID}` });
    api.root.append(wrap);
    const live = (t) => alive && t === token;
    const P = (t) => api.prompt(t);
    const C = (t) => (demoRun ? Promise.resolve() : api.cheer(t));
    const N = (t) => api.nudge(t);
    // show a line and give it time to be read/heard, but never wait too long
    const say = (text, fn = P) => {
      const ms = 800 + text.length * 55;
      return Promise.all([Promise.race([fn(text), sleep(ms + 4000)]), sleep(ms)]);
    };
    const until = async (cond, t) => {
      while (live(t) && !cond()) await sleep(80);
      return live(t);
    };
    let S = {};

    function tween(ms, fn) {
      const tk = token;
      return new Promise((res) => {
        const t0 = performance.now();
        const step = (now) => {
          if (!alive || tk !== token) return res();
          const p = Math.min(1, (now - t0) / ms);
          fn(ease(p));
          if (p < 1) requestAnimationFrame(step);
          else res();
        };
        requestAnimationFrame(step);
      });
    }
    const zoneOf = (it) => (matches(S.A, it) ? (matches(S.B, it) ? 'AB' : 'A') : matches(S.B, it) ? 'B' : 'OUT');
    const pct = (v, tot) => (v / tot) * 100 + '%';

    // ----- board -----
    function applyGeom(g) {
      for (const k of ['A', 'B']) {
        const c = g[k];
        const p = S.parts[k];
        for (const el of p.rings) {
          el.setAttribute('cx', c.x);
          el.setAttribute('cy', c.y);
          el.setAttribute('r', c.r);
        }
        const ang = -0.9;
        p.knot.setAttribute('cx', c.x + c.r * Math.cos(ang));
        p.knot.setAttribute('cy', c.y + c.r * Math.sin(ang));
        p.knot2.setAttribute('cx', c.x + c.r * Math.cos(ang) + 2);
        p.knot2.setAttribute('cy', c.y + c.r * Math.sin(ang) - 2);
      }
      for (const el of S.clipCs) {
        el.setAttribute('cx', g.A.x);
        el.setAttribute('cy', g.A.y);
        el.setAttribute('r', g.A.r);
      }
      S.lens.setAttribute('cx', g.B.x);
      S.lens.setAttribute('cy', g.B.y);
      S.lens.setAttribute('r', g.B.r);
      for (const [el, pt] of [
        [S.labelEls.A, g.la],
        [S.labelEls.B, g.lb],
      ]) {
        el.style.left = pct(pt.x, g.W);
        el.style.top = pct(pt.y, g.H);
      }
    }
    const labelFor = (r, k) => {
      let icon;
      if (r.kind === 'color') icon = h('span', { class: 'dot', style: { background: COL[r.val] } });
      else if (r.kind === 'shape') icon = tokSvg({ shape: r.val, color: 'grey', size: 'big' });
      else icon = tokSvg({ shape: 'circle', color: 'grey', size: r.val });
      return h('div', { class: 'rr-label', style: { borderColor: ROPE[k].main } }, icon, ruleWord(r));
    };
    function setup(i, intro) {
      const cfg = makeRound(i);
      const gEnd = geom(cfg.over, portrait);
      const g0 = intro ? geom(false, portrait) : gEnd;
      S = { ...cfg, i, gEnd, g0, g: intro ? g0 : gEnd, intro, wrongRun: 0, locked: false, pick: null, count: null };
      S.slots = makeSlots(gEnd, cfg.counts);
      const id = 'rrc' + Math.random().toString(36).slice(2, 7);
      const mk = (tag, at) => h(tag, at);
      const clipC = mk('circle', {});
      S.clipCs = [clipC];
      S.lens = mk('circle', { class: 'rr-lens', fill: LENS, 'clip-path': `url(#${id})` });
      S.parts = {};
      const svg = h(
        'svg',
        { class: 'rr-svg', viewBox: `0 0 ${gEnd.W} ${gEnd.H}`, 'aria-hidden': 'true' },
        h('defs', {}, h('clipPath', { id }, clipC)),
      );
      const tints = [];
      const ropes = [];
      for (const k of ['A', 'B']) {
        const R = ROPE[k];
        const tint = mk('circle', { fill: R.tint });
        const outline = mk('circle', { fill: 'none', stroke: 'rgba(43,45,66,.45)', 'stroke-width': 19 });
        const base = mk('circle', { fill: 'none', stroke: R.main, 'stroke-width': 14 });
        const twist = mk('circle', {
          fill: 'none',
          stroke: R.light,
          'stroke-width': 14,
          'stroke-dasharray': '4 11',
          opacity: 0.7,
        });
        const knot = mk('circle', { r: 11, fill: R.main, stroke: 'rgba(43,45,66,.6)', 'stroke-width': 3 });
        const knot2 = mk('circle', { r: 4, fill: R.light, opacity: 0.8 });
        S.parts[k] = { rings: [tint, outline, base, twist], knot, knot2 };
        tints.push(tint);
        ropes.push(outline, base, twist, knot, knot2);
      }
      svg.append(...tints, S.lens, ...ropes);
      S.labelEls = { A: labelFor(S.A, 'A'), B: labelFor(S.B, 'B') };
      const outLabel = h(
        'div',
        { class: 'rr-label out', style: { left: pct(gEnd.lo.x, gEnd.W), top: pct(gEnd.lo.y, gEnd.H) } },
        'outside',
      );
      S.board = h(
        'div',
        {
          class: 'rr-board',
          role: 'group',
          'aria-label': `Two ropes. Left: ${ruleWord(S.A)}. Right: ${ruleWord(S.B)}.`,
          style: {
            maxWidth: portrait ? 'max(280px, min(400px, calc((100vh - 360px) * 0.75)))' : '720px',
            aspectRatio: `${gEnd.W} / ${gEnd.H}`,
          },
        },
        svg,
        S.labelEls.A,
        S.labelEls.B,
        outLabel,
      );
      applyGeom(S.g);
      S.tray = h('div', { class: 'rr-tray', 'aria-label': 'Blocks to sort' });
      S.toks = S.items.map((it) => {
        const b = h(
          'button',
          { class: 'rr-tok', type: 'button', 'aria-label': `${it.size} ${it.color} ${it.shape}` },
          tokSvg(it),
        );
        b._it = it;
        b._drag = drag(b, { dropSelector: '.rr-board', onDrop: (d, el) => onDrop(el) });
        return b;
      });
      S.tray.append(...S.toks);
      S.remaining = S.toks.length;
      S.sortDone = new Promise((res) => {
        S.sortRes = res;
      });
      wrap.replaceChildren(S.board, S.tray);
    }
    function clearHint() {
      S.hintEl?.remove();
      S.hintEl = null;
      S.lens.classList.remove('hint');
    }
    function showHint(it) {
      clearHint();
      const z = zoneOf(it);
      const s = S.slots[z].find((q) => !q.used) || S.slots[z][0];
      if (!s) return;
      S.hintEl = h('div', {
        class: 'rr-hint',
        style: { left: pct(s.x, S.g.W), top: pct(s.y, S.g.H), width: pct(D + 8, S.g.W) },
      });
      S.board.append(S.hintEl);
      if (z === 'AB') S.lens.classList.add('hint');
    }
    function takeSlot(z, pt) {
      const free = S.slots[z].filter((q) => !q.used);
      const list = free.length ? free : S.slots[z];
      let best = list[0];
      if (pt)
        best = list.reduce(
          (b, q) => (Math.hypot(q.x - pt.x, q.y - pt.y) < Math.hypot(b.x - pt.x, b.y - pt.y) ? q : b),
          list[0],
        );
      if (!best) best = { x: S.g.W / 2, y: S.g.H / 2 };
      best.used = true;
      return best;
    }
    const slotStyle = (s) => ({ left: pct(s.x, S.g.W), top: pct(s.y, S.g.H), width: pct(D, S.g.W) });
    const wob = (el) => {
      el.classList.remove('wob');
      void el.offsetWidth;
      el.classList.add('wob');
      setTimeout(() => el.classList.remove('wob'), 450);
    };

    // ----- sorting -----
    function wrongMsg(it, dz) {
      const inZone = { A: [S.A], B: [S.B], AB: [S.A, S.B], OUT: [] }[dz];
      const bad = inZone.find((r) => !matches(r, it));
      if (bad) return `Is it ${ruleIs(bad)}? Look again!`;
      const missed = [S.A, S.B].find((r) => matches(r, it) && !inZone.includes(r));
      return missed ? `It is ${ruleIs(missed)}! Where does that go?` : 'Hmm, try another spot!';
    }
    function onDrop(tok) {
      if (S.locked || demoRun || (S.intro && S.g !== S.gEnd)) return false;
      const it = tok._it;
      const r = tok.getBoundingClientRect();
      const b = S.board.getBoundingClientRect();
      const pt = {
        x: ((r.left + r.width / 2 - b.left) / b.width) * S.g.W,
        y: ((r.top + r.height / 2 - b.top) / b.height) * S.g.H,
      };
      const dz = zoneAt(S.g, pt.x, pt.y, 0);
      const right = zoneOf(it);
      if (dz === right) {
        tok._drag.disable();
        S.wrongRun = 0;
        clearHint();
        place(tok, pt);
        return true;
      }
      S.wrongRun++;
      sfx('oops');
      if (S.wrongRun >= 2) {
        showHint(it);
        N('Try the shining spot!');
      } else N(wrongMsg(it, dz));
      return false;
    }
    async function place(tok, pt) {
      const t = token;
      const s = takeSlot(zoneOf(tok._it), pt);
      const slotEl = h('div', { class: 'rr-slot', style: slotStyle(s) });
      S.board.append(slotEl);
      tok._drag.disable();
      sfx('pop');
      await flyTo(tok, slotEl, { duration: demoRun ? 650 : 280 });
      slotEl.remove();
      if (!live(t)) return;
      tok.classList.add('placed');
      tok.style.transition = 'none';
      tok.style.zIndex = '';
      Object.assign(tok.style, {
        left: pct(s.x, S.g.W),
        top: pct(s.y, S.g.H),
        width: pct(D, S.g.W),
        transform: 'translate(-50%,-50%)',
      });
      S.board.append(tok);
      tok.addEventListener('click', () => onTok(tok));
      sfx('drop');
      tok.classList.add('hopx');
      setTimeout(() => tok.classList.remove('hopx'), 550);
      S.remaining--;
      if (S.remaining > 0) {
        if (!demoRun) C(pick(CHEERS));
      } else S.sortRes();
    }

    // ----- round 3 questions: tap blocks, then count -----
    async function phasePick(t, mode) {
      const keep = {
        or: (z) => z !== 'OUT',
        not: (z, it) => !matches(S.A, it),
        onlyA: (z) => z === 'A',
        onlyB: (z) => z === 'B',
        none: (z) => z === 'OUT',
        notboth: (z) => z !== 'AB',
      }[mode];
      const targets = new Set(S.toks.filter((k) => keep(zoneOf(k._it), k._it)));
      S.toks.forEach((k) => {
        k.classList.remove('ok', 'tip');
        k.classList.add('pickable');
      });
      S.pick = { mode, targets, left: targets.size, wrong: 0 };
      P(
        {
          or: `Tap every block that is ${ruleIs(S.A)} or ${ruleIs(S.B)}.`,
          not: `Tap every block that is not ${ruleIs(S.A)}.`,
          onlyA: `Tap blocks that are ${ruleIs(S.A)} but not ${ruleIs(S.B)}.`,
          onlyB: `Tap blocks that are ${ruleIs(S.B)} but not ${ruleIs(S.A)}.`,
          none: `Tap blocks that are neither ${ruleIs(S.A)} nor ${ruleIs(S.B)}.`,
          notboth: 'Tap every block that is not in both ropes.',
        }[mode],
      );
      await new Promise((res) => {
        S.pick.res = res;
      });
      if (!live(t)) return false;
      S.toks.forEach((k) => k.classList.remove('pickable', 'tip'));
      await say(pick(['You found them all!', 'Yes, that is every one!']), C);
      await sleep(500);
      return live(t);
    }
    function onTok(tok) {
      const p = S.pick;
      if (!p || tok.classList.contains('ok')) return;
      if (p.targets.has(tok)) {
        tok.classList.remove('tip');
        tok.classList.add('ok');
        sfx('good');
        p.wrong = 0;
        p.left--;
        if (p.left === 0) {
          S.pick = null;
          p.res();
        }
      } else {
        p.wrong++;
        wob(tok);
        sfx('oops');
        if (p.wrong >= 2) {
          const m = [...p.targets].find((k) => !k.classList.contains('ok'));
          m?.classList.add('tip');
          N('Look at the shining one!');
        } else {
          const z = zoneOf(tok._it);
          const fit = matches(S.A, tok._it) ? S.A : S.B;
          N(
            {
              or: `Is it ${ruleIs(S.A)} or ${ruleIs(S.B)}? Not this one.`,
              not: `That one is ${ruleIs(S.A)}. Find the others.`,
              onlyA: z === 'AB' ? `That one is ${ruleIs(S.B)} too. Look again!` : `Is it ${ruleIs(S.A)}? Not this one.`,
              onlyB: z === 'AB' ? `That one is ${ruleIs(S.A)} too. Look again!` : `Is it ${ruleIs(S.B)}? Not this one.`,
              none: `That one is ${ruleIs(fit)}. Find one outside.`,
              notboth: 'That one is in both ropes. Find the others.',
            }[p.mode],
          );
        }
      }
    }
    async function phaseCount(t, mode) {
      const inSet = { both: (z) => z === 'AB', out: (z) => z === 'OUT', allA: (z) => z === 'A' || z === 'AB' }[mode];
      const n = S.toks.filter((k) => inSet(zoneOf(k._it))).length;
      S.toks.forEach((k) => k.classList.remove('ok'));
      const row = h('div', { class: 'act-row' });
      const btns = (S.i < 3 ? [1, 2, 3, 4] : [1, 2, 3, 4, 5, 6]).map((v) =>
        h(
          'button',
          { class: 'chip choice rr-num', type: 'button', 'aria-label': String(v), onclick: () => answer(v) },
          String(v),
        ),
      );
      row.append(...btns);
      S.tray.replaceChildren(row);
      S.tray.classList.remove('gone');
      S.count = { n, wrong: 0, btns };
      const ab = S.toks.filter((k) => inSet(zoneOf(k._it)));
      function answer(v) {
        const c = S.count;
        if (!c) return;
        if (v === c.n) {
          S.count = null;
          clearHint();
          c.res();
          return;
        }
        c.wrong++;
        sfx('oops');
        btns[v - 1].classList.add('shake');
        setTimeout(() => btns[v - 1].classList.remove('shake'), 450);
        if (mode === 'both') S.lens.classList.add('hint');
        if (c.wrong >= 2) {
          ab.forEach((k) => k.classList.add('tip'));
          N(
            {
              both: 'Count the blocks where the ropes cross.',
              out: 'Count the blocks outside the ropes.',
              allA: 'Count the whole rope, middle too.',
            }[mode],
          );
        } else
          N(
            {
              both: 'Look where the ropes cross. Count again!',
              out: 'Look outside the ropes. Count again!',
              allA: `Count every ${ruleWord(S.A)} block. Try again!`,
            }[mode],
          );
      }
      P(
        {
          both: 'How many blocks are in both ropes?',
          out: 'How many blocks are outside the ropes?',
          allA: `How many blocks are ${ruleIs(S.A)} in all?`,
        }[mode],
      );
      await new Promise((res) => {
        S.count.res = res;
      });
      if (!live(t)) return false;
      S.lens.classList.remove('hint');
      ab.forEach((k) => k.classList.remove('tip'));
      for (let k = 0; k < ab.length; k++) {
        ab[k].classList.add('hopx');
        sfx('tick');
        api.say(String(k + 1));
        await sleep(700);
        if (!live(t)) return false;
        ab[k].classList.remove('hopx');
      }
      await say(
        {
          both: `Yes! ${n} in both ropes.`,
          out: `Yes! ${n} outside the ropes.`,
          allA: `Yes! ${n} ${ruleWord(S.A)} blocks in all.`,
        }[mode],
        C,
      );
      await sleep(600);
      return live(t);
    }

    // ----- round flow (shared by real play and the demo) -----
    const sortLine = () =>
      S.i === 0
        ? 'Sort the blocks into the ropes. Others stay outside.'
        : S.i === 1
          ? `Is it ${ruleIs(S.A)}? Is it ${ruleIs(S.B)}? Both goes in the middle!`
          : `${up1(ruleWord(S.A))}, ${ruleWord(S.B)}, both, or neither? Sort them all!`;
    async function flow(t) {
      await S.sortDone;
      if (!live(t)) return false;
      S.wrongRun = 0;
      clearHint();
      if (S.i < 2) {
        await say(S.i === 0 ? 'All sorted! Great ropes work.' : 'Everything is in the right place!', C);
        return live(t);
      }
      await say('All sorted! Now some questions.', C);
      if (!live(t)) return false;
      S.tray.classList.add('gone');
      for (const [kind, mode] of QS[S.i]) {
        if (!(await (kind === 'pick' ? phasePick(t, mode) : phaseCount(t, mode)))) return false;
      }
      return true;
    }
    async function runRound(i, noIntro = false) {
      const t = ++token;
      cur = i;
      setup(i, i === 1 && !noIntro && !demoRun);
      api.stage(i, TOTAL);
      if (S.intro) {
        S.tray.classList.add('locked');
        await say('Look! The ropes slide together.');
        if (!live(t)) return;
        sfx('whoosh');
        const sg = S;
        await tween(1000, (p) => applyGeom(lerpG(sg.g0, sg.gEnd, p)));
        if (!live(t)) return;
        S.g = S.gEnd;
        S.intro = false;
        await sleep(300);
        if (!live(t)) return;
        S.tray.classList.remove('locked');
      }
      P(sortLine());
      const ok = await flow(t);
      if (!ok || !live(t)) return;
      await sleep(900);
      if (!live(t)) return;
      if (i < TOTAL - 1) runRound(i + 1);
      else api.finish();
    }

    // ----- demo -----
    function explain(it, z) {
      const a = ruleWord(S.A);
      const b = ruleWord(S.B);
      if (!S.over)
        return z === 'OUT'
          ? `${up1(it.color)} fits neither rope. Outside!`
          : `${up1(it.color)}! Into the ${it.color} rope.`;
      if (z === 'AB') return `${up1(a)} and ${b}. Both ropes!`;
      if (z === 'A') return `${up1(a)}, but not ${b}. Just the ${a} rope.`;
      if (z === 'B') return `${up1(b)}, but not ${a}. Just the ${b} rope.`;
      return `Not ${a}, not ${b}. Outside!`;
    }
    api.setDemo(async () => {
      const i = cur;
      const t = ++token;
      demoRun = true;
      try {
        setup(i, false);
        api.stage(i, TOTAL);
        await say('Watch how I sort the blocks.');
        if (!live(t)) return;
        const fl = flow(t);
        for (const tok of S.toks.slice()) {
          await say(explain(tok._it, zoneOf(tok._it)));
          if (!live(t)) return;
          await place(tok, null);
          if (!live(t)) return;
        }
        for (const [kind, mode] of QS[i] || []) {
          if (kind === 'pick') {
            if (!(await until(() => S.pick && S.pick.mode === mode, t))) return;
            await sleep(1600);
            for (const k of [...S.pick.targets]) {
              if (!live(t)) return;
              k.click();
              await sleep(500);
            }
          } else {
            if (!(await until(() => S.count, t))) return;
            await sleep(1400);
            if (!live(t)) return;
            S.count.btns[S.count.n - 1].click();
          }
        }
        await fl;
        if (!live(t)) return;
        await sleep(500);
      } finally {
        demoRun = false;
      }
      if (alive && t === token) runRound(cur, true);
    });

    const startAt = resumeRound(api, TOTAL);
    runRound(startAt);
    return {
      destroy() {
        alive = false;
        token++;
      },
    };
  },
};
