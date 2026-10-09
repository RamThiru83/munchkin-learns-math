/**
 * Game: Pour the Same  (id: pour-the-same, level 3)
 *
 * Idea: pouring changes the shape of the juice, not the amount (conservation of volume), and water
 * always lies flat, even in a tilted container.
 * Rounds:
 *   1. Pour a glass into a tall or wide glass (random): same or more? Pour it back to check.
 *   2. Tall glass vs wide glass (same / wide has more / tall has more, random): pour both into twin glasses.
 *   3. Two tilted containers (bottle, then cup): tap the picture where the water line is flat.
 *   4. Same line / lower line in a tall and a wide glass: which has more? Pour both into twin glasses.
 *   5. Two glasses go into one tall thin glass: pick the picture of how high the juice will reach.
 * Watch demo: replays the current round from the start (fresh random setup) and plays the correct
 *   solution via cur.play (pour / tip / glow the right answer), then restarts the round.
 * Notes:
 *   - The liquid is real geometry: the container polygon cut by a line (fillRegion), area = volume,
 *     conserved while pouring. Everything between GEOM-START and GEOM-END is pure maths.
 *   - Rounds 1, 2, 4, 5 share the ask() question UI and pour() animation; round 3 has its own.
 *   - Round 3 tilt angles are lowered until the flat water still fits (fitsAt), so nothing spills.
 *   - Round state is guarded by a token (tok / live(t)) so stale timers do nothing after a round
 *     change; destroy() cancels the animation frame.
 *   - No exported test hooks.
 */
import { h, sleep, shuffle, rand, pick, sfx, COLORS, resumeRound } from '../lib/core.js';

// Number of rounds; must equal the length of the ROUNDS list of round builders inside start().
const ROUND_COUNT = 5;

const CSS = `
.a-pour-the-same{width:100%;max-width:560px;display:flex;flex-direction:column;align-items:center;gap:12px}
.a-pour-the-same .card{width:100%;background:#eaf7fb;border:3px solid var(--ink);border-radius:22px;box-shadow:var(--shadow);overflow:hidden;display:flex;justify-content:center}
.a-pour-the-same .card svg{display:block;width:100%;height:auto;max-height:52vh}
.a-pour-the-same .scene path.tap{cursor:pointer}
.a-pour-the-same .scene path.nudgeme{animation:a-pts-pulse 1.1s ease-in-out infinite}
@keyframes a-pts-pulse{50%{opacity:.55}}
.a-pour-the-same .acts{min-height:60px}
.a-pour-the-same .acts .btn{min-height:56px;font-size:1.1rem}
.a-pour-the-same .choices,.a-pour-the-same .pics{width:100%;display:flex;gap:10px;justify-content:center}
.a-pour-the-same .opt{flex:1 1 0;max-width:176px;min-width:0;min-height:84px;padding:8px 4px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;line-height:1.1}
.a-pour-the-same .opt .ic{font-size:clamp(1.5rem,6vw,2.1rem);white-space:nowrap}
.a-pour-the-same .opt small{font-size:.95rem;font-weight:800}
.a-pour-the-same .opt.glow,.a-pour-the-same .pic.glow{background:var(--yellow)}
.a-pour-the-same .pic{flex:1 1 0;max-width:180px;min-width:0;padding:4px;border:3px solid var(--ink);border-radius:18px;background:#fff;box-shadow:0 3px 0 rgba(43,45,66,.15);cursor:pointer;display:block}
.a-pour-the-same .pic svg{display:block;width:100%;height:auto}
.a-pour-the-same .pics.tallpics .pic svg{height:clamp(84px,15vh,128px);width:auto;margin:0 auto}
.a-pour-the-same .card.short svg{max-height:36vh}
.a-pour-the-same .pic.good{background:#c9f5e4;border-color:#05a67a}
@media (max-width:420px){.a-pour-the-same .opt small{font-size:.82rem}}
`;

// GEOM-START
const rot = (p, deg) => {
  const r = (deg * Math.PI) / 180,
    c = Math.cos(r),
    s = Math.sin(r);
  return { x: p.x * c - p.y * s, y: p.x * s + p.y * c };
};
const xf = (pts, pose) =>
  pts.map((p) => {
    const q = rot(p, pose.rot || 0);
    return { x: q.x + pose.x, y: q.y + pose.y };
  });
const area = (poly) => {
  let s = 0;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i],
      b = poly[(i + 1) % poly.length];
    s += a.x * b.y - b.x * a.y;
  }
  return Math.abs(s) / 2;
};
// keep the part of poly where p.n >= c
const clip = (poly, n, c) => {
  const out = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i],
      b = poly[(i + 1) % poly.length];
    const da = a.x * n.x + a.y * n.y - c,
      db = b.x * n.x + b.y * n.y - c;
    if (da >= 0) out.push(a);
    if (da >= 0 !== db >= 0) {
      const t = da / (da - db);
      out.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
    }
  }
  return out;
};
// liquid of volume V in polygon; the surface line has normal angle a (0 = flat, level with the ground)
const fillRegion = (poly, V, a) => {
  if (V <= 0.5) return [];
  if (V >= area(poly) - 0.5) return poly;
  const n = { x: Math.sin((a * Math.PI) / 180), y: Math.cos((a * Math.PI) / 180) };
  let lo = Infinity,
    hi = -Infinity;
  for (const p of poly) {
    const d = p.x * n.x + p.y * n.y;
    lo = Math.min(lo, d);
    hi = Math.max(hi, d);
  }
  for (let i = 0; i < 40; i++) {
    const m = (lo + hi) / 2;
    if (area(clip(poly, n, m)) > V) lo = m;
    else hi = m;
  }
  return clip(poly, n, (lo + hi) / 2);
};
const dOf = (pts) => (pts.length ? 'M' + pts.map((p) => p.x.toFixed(1) + ' ' + p.y.toFixed(1)).join('L') + 'Z' : '');
const P = (arr) => arr.map(([x, y]) => ({ x, y }));
// containers for the tilt round (origin = centre; y down); V = water volume
const SHAPES = {
  bottle: {
    pts: P([
      [-28, 40],
      [-28, -28],
      [-11, -46],
      [-11, -70],
      [11, -70],
      [11, -46],
      [28, -28],
      [28, 40],
    ]),
    cap: P([
      [-13, -70],
      [13, -70],
      [13, -78],
      [-13, -78],
    ]),
    V: 1900,
    name: 'bottle',
  },
  cup: {
    pts: P([
      [-34, -34],
      [34, -34],
      [24, 36],
      [-24, 36],
    ]),
    cap: null,
    V: 1100,
    name: 'cup',
  },
};
// the lowest rim point decides when water spills; true if the flat water fits at this tilt
const fitsAt = (shape, deg) => {
  const S = SHAPES[shape],
    wp = xf(S.pts, { x: 0, y: 0, rot: deg });
  const rim = shape === 'bottle' ? [S.pts[3], S.pts[4]] : [S.pts[0], S.pts[1]];
  const rimY = Math.max(...xf(rim, { x: 0, y: 0, rot: deg }).map((p) => p.y));
  return area(clip(wp, { x: 0, y: 1 }, rimY)) >= S.V * 1.04;
};
// GEOM-END

// Glass scene: BASE is the shelf's y; VB is the SVG viewBox shared by all glass scenes.
const BASE = 300,
  VB = '0 -12 420 338';
const INK = COLORS.ink;
const JUICE = ['#ff9f1c', '#ef476f', '#9b5de5'];
const CHEERS = ['Yes! Well spotted!', 'You got it!', 'Lovely thinking!', 'That is right!', 'Great looking!'];
// Easing and interpolation for the pour / tip animations.
const ease = (u) => (u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2);
const lerp = (a, b, u) => a + (b - a) * u;

export default {
  id: 'pour-the-same',
  rounds: ROUND_COUNT,
  parentNote:
    'Young children often think a tall, thin glass holds more than a wide, short one, even when they watched the same juice being poured. Ask "Why do you think so?" and then pour it back into twin glasses: when the level matches, the amount was never changed. A second idea: water always lies flat (level), even in a tilted bottle, so the line is never tilted with the bottle. Later rounds: a higher line does not always mean more juice (the glass can be thinner), and when two glasses are poured into one thin glass the level climbs high.',

  async start(api) {
    let alive = true,
      raf = 0,
      tok = 0,
      round = 0,
      busy = false;
    let cur = {};
    api.css(CSS);
    const wrap = h('div', { class: 'a-pour-the-same' });
    const card = h('div', { class: 'card' });
    const acts = h('div', { class: 'act-row acts' });
    const opts = h('div', { class: 'opts', style: { width: '100%' } });
    wrap.append(card, acts, opts);
    api.root.append(wrap);
    const live = (t) => alive && t === tok;

    function anim(ms, f) {
      return new Promise((res) => {
        const t0 = performance.now();
        const step = (now) => {
          if (!alive) return res();
          const u = Math.min(1, (now - t0) / ms);
          f(u);
          if (u < 1) raf = requestAnimationFrame(step);
          else res();
        };
        raf = requestAnimationFrame(step);
      });
    }
    const btn = (label, aria, fn, cls = 'btn primary') =>
      h('button', { class: cls, type: 'button', 'aria-label': aria, onclick: fn }, label);

    // ---------- glass scene (rounds 1 and 2) ----------
    function makeScene() {
      const svg = h('svg', { viewBox: VB, class: 'scene', role: 'img', 'aria-label': 'Glasses of juice on a shelf' });
      svg.append(
        h('rect', { x: -400, y: -12, width: 1220, height: 338, fill: '#eaf7fb' }),
        h('rect', { x: -400, y: BASE, width: 1220, height: 26, fill: '#e7c9a0' }),
        h('rect', { x: -400, y: BASE, width: 1220, height: 5, fill: '#d4b183' }),
      );
      const layer = h('g');
      const guide = h('line', { stroke: INK, 'stroke-width': 2.5, 'stroke-dasharray': '7 6', opacity: 0 });
      svg.append(layer, guide);
      card.replaceChildren(svg);
      return { svg, layer, guide };
    }
    function setDir(g, dir) {
      const { w, H } = g;
      g.dir = dir;
      g.local = P(
        dir > 0
          ? [
              [-w, 0],
              [0, 0],
              [0, H],
              [-w, H],
            ]
          : [
              [0, 0],
              [w, 0],
              [w, H],
              [0, H],
            ],
      );
      g.pose = { x: g.cx + (dir * w) / 2, y: BASE - H, rot: 0 };
    }
    function draw(g) {
      const wp = xf(g.local, g.pose),
        d = dOf(wp);
      g.back.setAttribute('d', d);
      g.out.setAttribute('d', d);
      const liq = fillRegion(wp, g.V, 0);
      g.liq.setAttribute('d', dOf(liq));
      g.top = liq.length ? Math.min(...liq.map((p) => p.y)) : BASE;
    }
    function addGlass(sc, def) {
      const g = { ...def, V: def.V || 0 };
      g.back = h('path', { fill: 'rgba(255,255,255,.55)' });
      g.liq = h('path', { fill: g.color });
      g.out = h('path', { fill: 'none', stroke: INK, 'stroke-width': 4, 'stroke-linejoin': 'round' });
      sc.layer.append(g.back, g.liq, g.out);
      setDir(g, 1);
      draw(g);
      return g;
    }
    const mark = (sc, cx, txt) =>
      sc.svg.append(h('text', { x: cx, y: BASE + 19, 'text-anchor': 'middle', 'font-size': 16 }, txt));
    function line(sc, y, x1, x2) {
      sc.guide.setAttribute('x1', x1);
      sc.guide.setAttribute('x2', x2);
      sc.guide.setAttribute('y1', y);
      sc.guide.setAttribute('y2', y);
      sc.guide.setAttribute('opacity', 1);
    }

    // pour src into tgt (dir +1 = target on the right). Volume moves as the glass tips: nothing is lost.
    async function pour(sc, src, tgt, dir) {
      setDir(src, dir);
      draw(src);
      sc.layer.append(src.back, src.liq, src.out);
      const home = { ...src.pose },
        pose = src.pose;
      const lift = src.H * 0.85 + 12;
      const px = tgt.cx - dir * tgt.w * 0.25,
        py = BASE - tgt.H - lift;
      sfx('whoosh');
      await anim(550, (u) => {
        pose.y = lerp(home.y, py, ease(u));
        draw(src);
      });
      await anim(600, (u) => {
        pose.x = lerp(home.x, px, ease(u));
        draw(src);
      });
      if (!alive) return;
      const stream = h('path', {
        fill: 'none',
        stroke: src.color,
        'stroke-width': 5,
        'stroke-linecap': 'round',
        opacity: 0,
      });
      sc.svg.append(stream);
      await anim(2300, (u) => {
        pose.rot = dir * 95 * ease(u);
        const cap = area(clip(xf(src.local, pose), { x: 0, y: 1 }, pose.y));
        let flowing = false;
        if (src.V > cap) {
          tgt.V += src.V - cap;
          src.V = cap;
          flowing = true;
        }
        draw(src);
        draw(tgt);
        stream.setAttribute('opacity', flowing ? 0.9 : 0);
        if (flowing)
          stream.setAttribute(
            'd',
            `M${pose.x.toFixed(1)} ${pose.y.toFixed(1)}L${pose.x.toFixed(1)} ${tgt.top.toFixed(1)}`,
          );
      });
      if (!alive) return;
      tgt.V += src.V;
      src.V = 0;
      stream.remove();
      draw(src);
      draw(tgt);
      const r0 = pose.rot;
      await anim(650, (u) => {
        pose.rot = lerp(r0, 0, ease(u));
        pose.x = lerp(px, home.x, ease(u));
        draw(src);
      });
      await anim(450, (u) => {
        pose.y = lerp(py, home.y, ease(u));
        draw(src);
      });
      setDir(src, 1);
      draw(src);
    }

    // ---------- shared question UI for rounds 1 and 2 ----------
    function ask(t, list, correct, ctx) {
      let wrong = 0,
        done = false;
      const btns = {};
      const row = h('div', { class: 'choices' });
      for (const o of list) {
        const b = h(
          'button',
          { class: 'chip choice opt', type: 'button', 'aria-label': o.aria, onclick: () => on(o.key, b) },
          h('span', { class: 'ic' }, o.icon),
          h('small', {}, o.label),
        );
        btns[o.key] = b;
        row.append(b);
      }
      opts.replaceChildren(row);
      async function on(key, b) {
        if (busy || done || !live(t)) return;
        sfx('tap');
        if (key === correct) {
          done = true;
          busy = true;
          Object.values(btns).forEach((x) => x.classList.remove('glow'));
          api.cheer(pick(CHEERS));
          await sleep(1200);
          if (!live(t)) return;
          if (!ctx.checked()) {
            api.prompt(ctx.checkSay);
            await sleep(600);
            if (!live(t)) return;
            await ctx.check();
            if (!live(t)) return;
            await sleep(500);
          }
          api.prompt(ctx.result);
          busy = false;
          acts.replaceChildren(
            btn('Next ➜', 'Next', () => {
              sfx('tap');
              next();
            }),
          );
        } else {
          wrong++;
          b.classList.add('shake');
          setTimeout(() => b.classList.remove('shake'), 450);
          if (wrong >= 2) btns[correct].classList.add('glow');
          if (!ctx.checked()) {
            busy = true;
            api.nudge(ctx.hint1);
            await sleep(1700);
            if (!live(t)) return;
            await ctx.check();
            busy = false;
            if (live(t)) api.prompt(ctx.again);
          } else api.nudge(ctx.hint2);
        }
      }
      return btns;
    }

    // ---------- round 1: one glass poured into a tall or wide glass ----------
    function r1(t) {
      const color = pick(JUICE),
        tall = Math.random() < 0.5,
        word = tall ? 'tall' : 'wide';
      const sc = makeScene();
      const A = addGlass(sc, { cx: 62, w: 60, H: 110, V: 3600, color });
      const B = addGlass(sc, { cx: 172, w: 60, H: 110, V: 3600, color });
      const C = addGlass(sc, tall ? { cx: 322, w: 36, H: 140, color } : { cx: 322, w: 100, H: 70, color });
      mark(sc, A.cx, '⭐');
      mark(sc, C.cx, '🌙');
      let poured = false,
        checked = false;
      const check = async () => {
        if (checked) return;
        checked = true;
        acts.replaceChildren();
        await pour(sc, C, B, -1);
        if (live(t)) line(sc, A.top, 14, 400);
      };
      const doPour = async () => {
        if (busy || poured || !live(t)) return;
        poured = true;
        busy = true;
        acts.replaceChildren();
        B.back.classList.remove('nudgeme');
        sfx('pop');
        await pour(sc, B, C, 1);
        busy = false;
        if (!live(t)) return;
        api.prompt('Same juice, or does one have more?');
        ask(
          t,
          [
            { key: 'a', icon: '⭐', label: 'has more', aria: 'The star glass has more' },
            { key: 'same', icon: '🟰', label: 'Same', aria: 'The same' },
            { key: 'c', icon: '🌙', label: 'has more', aria: 'The moon glass has more' },
          ],
          'same',
          {
            checked: () => checked,
            check,
            checkSay: 'Let us pour it back to check.',
            hint1: 'Hmm, let us pour it back and see.',
            again: 'Is it the same line as the star glass?',
            hint2: 'Look at the dotted line. Is it the same?',
            result: 'Pouring changes the shape, not how much.',
          },
        );
        acts.replaceChildren(
          btn(
            '↩ Pour it back',
            'Pour it back to check',
            async () => {
              if (busy || checked) return;
              busy = true;
              await check();
              busy = false;
            },
            'btn',
          ),
        );
      };
      B.back.classList.add('tap', 'nudgeme');
      B.back.addEventListener('click', doPour);
      acts.replaceChildren(btn('🫗 Pour', `Pour into the ${word} glass`, doPour));
      api.prompt('Two glasses with the same juice.');
      sleep(2300).then(() => {
        if (live(t) && !poured) api.prompt(`Pour one into the ${word} glass.`);
      });
      cur.play = async () => {
        await sleep(2300);
        if (!live(t)) return;
        api.prompt(`Pour one into the ${word} glass.`);
        await sleep(1500);
        if (!live(t)) return;
        poured = true;
        B.back.classList.remove('nudgeme');
        acts.replaceChildren();
        await pour(sc, B, C, 1);
        if (!live(t)) return;
        api.prompt('Is it still the same juice?');
        await sleep(2200);
        if (!live(t)) return;
        api.prompt('Pour it back to check.');
        await sleep(1200);
        if (!live(t)) return;
        await check();
        if (!live(t)) return;
        api.prompt('The same line! The same juice.');
        await sleep(3000);
      };
    }

    // ---------- round 2: tall glass vs wide glass, check with twin glasses ----------
    function r2(t) {
      const color = pick(JUICE),
        mode = pick(['same', 'wide', 'tall']);
      const Vw = mode === 'same' ? 3600 : mode === 'wide' ? 5040 : 2520;
      const sc = makeScene();
      const T = addGlass(sc, { cx: 60, w: 36, H: 140, V: 3600, color });
      const tT = addGlass(sc, { cx: 165, w: 60, H: 110, color });
      const W = addGlass(sc, { cx: 275, w: 100, H: 70, V: Vw, color });
      const tW = addGlass(sc, { cx: 380, w: 60, H: 110, color });
      let checked = false;
      const check = async () => {
        if (checked) return;
        checked = true;
        acts.replaceChildren();
        await Promise.all([pour(sc, T, tT, 1), pour(sc, W, tW, 1)]);
        if (!live(t)) return;
        line(sc, tT.top, tT.cx - 38, tW.cx + 38);
      };
      const RES = {
        same: 'Both twins fill to the same line. The same!',
        wide: 'The wide glass filled its twin higher. It had more!',
        tall: 'The tall glass filled its twin higher. It had more!',
      };
      const btns = ask(
        t,
        [
          { key: 'tall', icon: '🥤', label: 'Tall glass', aria: 'The tall glass has more' },
          { key: 'same', icon: '🟰', label: 'Same', aria: 'The same' },
          { key: 'wide', icon: '🥣', label: 'Wide glass', aria: 'The wide glass has more' },
        ],
        mode,
        {
          checked: () => checked,
          check,
          checkSay: 'Let us pour them into the twin glasses.',
          hint1: 'Hmm. Let us pour them into twin glasses.',
          again: 'Look at the twins. Which is fuller?',
          hint2: 'The twins are the same. Look at the line.',
          result: RES[mode],
        },
      );
      acts.replaceChildren(
        btn(
          '🫗 Pour into the twins',
          'Pour both into the twin glasses',
          async () => {
            if (busy || checked) return;
            busy = true;
            await check();
            busy = false;
            if (live(t)) api.prompt('Which glass had more juice?');
          },
          'btn',
        ),
      );
      api.prompt('Which glass has more juice?');
      cur.play = async () => {
        await sleep(2400);
        if (!live(t)) return;
        api.prompt('Pour them into twin glasses.');
        await sleep(1600);
        if (!live(t)) return;
        await check();
        if (!live(t)) return;
        api.prompt(RES[mode]);
        btns[mode].classList.add('glow');
        await sleep(3200);
      };
    }

    // ---------- round 3: tilted containers ----------
    function mkCont(shape) {
      const S = SHAPES[shape];
      const R = Math.ceil(Math.max(...S.pts.concat(S.cap || []).map((p) => Math.hypot(p.x, p.y)))) + 8;
      const svg = h('svg', {
        viewBox: `${-R} ${-R} ${2 * R} ${2 * R}`,
        role: 'img',
        'aria-label': `A tilted ${S.name}`,
      });
      const c = {
        S,
        svg,
        ghost: h('path', { fill: 'none', stroke: '#9aa3b8', 'stroke-width': 2, 'stroke-dasharray': '5 5' }),
        back: h('path', { fill: 'rgba(255,255,255,.6)' }),
        liq: h('path', { fill: COLORS.sky }),
        surf: h('path', { fill: 'none', stroke: '#fff', 'stroke-width': 2.5, 'stroke-linecap': 'round', opacity: 0.8 }),
        out: h('path', { fill: 'none', stroke: INK, 'stroke-width': 4, 'stroke-linejoin': 'round' }),
        cap: S.cap
          ? h('path', { fill: COLORS.pink, stroke: INK, 'stroke-width': 3, 'stroke-linejoin': 'round' })
          : null,
      };
      svg.append(c.ghost, c.back, c.liq, c.surf, c.out);
      if (c.cap) svg.append(c.cap);
      return c;
    }
    function setCont(c, deg, a) {
      const S = c.S,
        wp = xf(S.pts, { x: 0, y: 0, rot: deg }),
        d = dOf(wp);
      c.back.setAttribute('d', d);
      c.out.setAttribute('d', d);
      const liq = fillRegion(wp, S.V, a);
      c.liq.setAttribute('d', dOf(liq));
      if (c.cap) c.cap.setAttribute('d', dOf(xf(S.cap, { x: 0, y: 0, rot: deg })));
      // white line along the water's top edge (the two cut points on the wall)
      const s = Math.sin((a * Math.PI) / 180),
        co = Math.cos((a * Math.PI) / 180);
      let sd = '';
      if (liq.length > 2 && liq.length < wp.length + 3) {
        const dd = liq.map((p) => p.x * s + p.y * co),
          mn = Math.min(...dd);
        const e = liq.filter((p, i) => dd[i] - mn < 0.05);
        if (e.length >= 2) sd = dOf([e[0], e[e.length - 1]]).replace('Z', '');
      }
      c.surf.setAttribute('d', sd);
    }
    function r3(t) {
      const sgn = () => (Math.random() < 0.5 ? -1 : 1);
      const bShape = 'bottle';
      const pickTilt = (shape, lo, hi) => {
        let d = lo + rand(hi - lo + 1);
        while (!fitsAt(shape, d) && d > 10) d -= 2;
        return d;
      };
      const QS = [
        {
          shape: bShape,
          th: sgn() * pickTilt(bShape, 30, 40),
          third: 'vert',
          say: `The ${bShape} tips over. Where is the water?`,
        },
        {
          shape: 'cup',
          th: sgn() * pickTilt('cup', 50, 58),
          third: 'mirror',
          say: 'Now the cup tips a lot. Where is the water?',
        },
      ];
      let qi = 0,
        wrong = 0,
        done = false,
        tipped = false,
        big = null;
      const tip = async (up) => {
        const Q = QS[qi],
          from = tipped ? Q.th : 0,
          to = up === false ? 0 : Q.th,
          b = big;
        tipped = to !== 0;
        sfx('whoosh');
        await anim(1500, (u) => setCont(b, lerp(from, to, ease(u)), 0));
        b.ghost.setAttribute('opacity', tipped ? 1 : 0);
      };
      function startQ() {
        const Q = QS[qi];
        wrong = 0;
        done = false;
        tipped = false;
        busy = false;
        big = mkCont(Q.shape);
        big.ghost.setAttribute('d', dOf(xf(big.S.pts, { x: 0, y: 0, rot: 0 })));
        big.ghost.setAttribute('opacity', 0);
        setCont(big, 0, 0);
        big.svg.style.maxHeight = '40vh';
        card.replaceChildren(big.svg);
        const th = Q.th;
        const aThird = Q.third === 'vert' ? -Math.sign(th) * 90 : th;
        const list = shuffle([{ a: 0, ok: true }, { a: -th }, { a: aThird }]);
        const pics = h('div', { class: 'pics' });
        list.forEach((o, i) => {
          const c = mkCont(Q.shape);
          setCont(c, th, o.a);
          c.ghost.setAttribute('opacity', 0);
          const b = h(
            'button',
            { class: 'pic', type: 'button', 'aria-label': `Picture ${i + 1}`, onclick: () => on(o, b) },
            c.svg,
          );
          o.btn = b;
          pics.append(b);
        });
        opts.replaceChildren(pics);
        const tipBtn = btn(
          '🫗 Tip it',
          'Tip the container over',
          async () => {
            if (busy || done) return;
            busy = true;
            await tip(!tipped ? true : false);
            busy = false;
            if (!live(t)) return;
            tipBtn.textContent = tipped ? '↩ Stand it up' : '🫗 Tip it';
          },
          'btn',
        );
        acts.replaceChildren(tipBtn);
        api.prompt(Q.say);
        cur.q = { list, tipBtn };
      }
      async function on(o, b) {
        if (busy || done || !live(t)) return;
        sfx('tap');
        if (o.ok) {
          done = true;
          busy = true;
          b.classList.add('good');
          cur.q.list.forEach((x) => x.btn.classList.remove('glow'));
          api.cheer(pick(CHEERS));
          await sleep(900);
          if (!live(t)) return;
          if (!tipped) await tip(true);
          if (!live(t)) return;
          api.prompt('Water always lies flat, even when it tips.');
          busy = false;
          acts.replaceChildren(
            btn('Next ➜', 'Next', () => {
              sfx('tap');
              if (qi < QS.length - 1) {
                qi++;
                startQ();
              } else next();
            }),
          );
        } else {
          wrong++;
          b.classList.add('shake');
          setTimeout(() => b.classList.remove('shake'), 450);
          if (wrong === 1) api.nudge('Hmm. Water lies flat, like a calm pond.');
          else {
            cur.q.list.find((x) => x.ok).btn.classList.add('glow');
            api.nudge('Tip it and watch the top of the water.');
            if (!tipped) {
              busy = true;
              await sleep(1500);
              if (!live(t)) return;
              await tip(true);
              busy = false;
            }
          }
        }
      }
      startQ();
      cur.play = async () => {
        await sleep(1800);
        if (!live(t)) return;
        api.prompt('Watch the water when it tips.');
        await sleep(900);
        if (!live(t)) return;
        await tip(true);
        if (!live(t)) return;
        api.prompt('The top of the water stays flat.');
        await sleep(2200);
        if (!live(t)) return;
        const ok = cur.q.list.find((x) => x.ok).btn;
        ok.classList.add('glow', 'hop');
        api.prompt('This picture is the flat one.');
        sfx('pop');
        await sleep(3000);
      };
    }

    // ---------- round 4: same line / lower line, which glass has more? ----------
    function r4(t) {
      const color = pick(JUICE),
        mode = pick(['line', 'equal', 'lower']);
      const lw = { line: 90, equal: 45, lower: 65 }[mode]; // tall: 35 wide x level 90 = 3150; wide: 70 wide x level lw
      const ans = mode === 'equal' ? 'same' : 'wide';
      const specT = { w: 35, H: 130, V: 3150 },
        specW = { w: 70, H: 105, V: 70 * lw };
      const swap = Math.random() < 0.5,
        p1 = swap ? specW : specT,
        p2 = swap ? specT : specW;
      const sc = makeScene();
      const S1 = addGlass(sc, { cx: 60, ...p1, color }),
        t1 = addGlass(sc, { cx: 165, w: 60, H: 120, color });
      const S2 = addGlass(sc, { cx: 275, ...p2, color }),
        t2 = addGlass(sc, { cx: 380, w: 60, H: 120, color });
      if (mode === 'line') line(sc, BASE - 90, 20, 320);
      let checked = false;
      const check = async () => {
        if (checked) return;
        checked = true;
        acts.replaceChildren();
        sc.guide.setAttribute('opacity', 0);
        await Promise.all([pour(sc, S1, t1, 1), pour(sc, S2, t2, 1)]);
        if (!live(t)) return;
        line(sc, t1.top, t1.cx - 38, t2.cx + 38);
      };
      const RES = {
        same: 'Both twins fill to the same line. The same!',
        wide: 'The wide glass filled its twin higher. It had more!',
      };
      const ask0 = mode === 'line' ? 'Same line in both. Which has more juice?' : 'Which glass has more juice?';
      const btns = ask(
        t,
        [
          { key: 'tall', icon: '🥤', label: 'Tall glass', aria: 'The tall glass has more' },
          { key: 'same', icon: '🟰', label: 'Same', aria: 'The same' },
          { key: 'wide', icon: '🥣', label: 'Wide glass', aria: 'The wide glass has more' },
        ],
        ans,
        {
          checked: () => checked,
          check,
          checkSay: 'Let us pour them into the twin glasses.',
          hint1: 'Hmm. A line can fool us. Pour into twins.',
          again: 'Look at the twins. Which is fuller?',
          hint2: 'The twins are the same. Look at the line.',
          result: RES[ans],
        },
      );
      acts.replaceChildren(
        btn(
          '🫗 Pour into the twins',
          'Pour both into the twin glasses',
          async () => {
            if (busy || checked) return;
            busy = true;
            await check();
            busy = false;
            if (live(t)) api.prompt('Which glass had more juice?');
          },
          'btn',
        ),
      );
      api.prompt(ask0);
      cur.play = async () => {
        await sleep(2600);
        if (!live(t)) return;
        api.prompt('Pour them into twin glasses.');
        await sleep(1600);
        if (!live(t)) return;
        await check();
        if (!live(t)) return;
        api.prompt(RES[ans]);
        btns[ans].classList.add('glow');
        await sleep(3200);
      };
    }

    // ---------- round 5: two glasses into one tall thin glass ----------
    function r5(t) {
      const color = pick(JUICE),
        Lc = pick([70, 100, 130]),
        V = 36 * Lc;
      const VA = Math.round(V * 0.6),
        VB = V - VA;
      const sc = makeScene();
      card.classList.add('short');
      const A = addGlass(sc, { cx: 75, w: 100, H: 70, V: VA, color });
      const B = addGlass(sc, { cx: 175, w: 60, H: 80, V: VB, color });
      const T = addGlass(sc, { cx: 330, w: 36, H: 140, color });
      let poured = false,
        wrong = 0,
        done = false;
      const doPour = async () => {
        poured = true;
        acts.replaceChildren();
        await pour(sc, A, T, 1);
        if (!live(t)) return;
        await sleep(250);
        if (!live(t)) return;
        await pour(sc, B, T, 1);
        if (!live(t)) return;
        line(sc, T.top, T.cx - 34, T.cx + 34);
      };
      const tall = P([
        [-18, 0],
        [18, 0],
        [18, 140],
        [-18, 140],
      ]);
      const pics = h('div', { class: 'pics tallpics' }),
        list = [];
      shuffle([70, 100, 130]).forEach((L, i) => {
        const svg = h('svg', { viewBox: '-24 -6 48 152', role: 'img', 'aria-label': 'Tall glass picture' });
        svg.append(
          h('path', { d: dOf(fillRegion(tall, 36 * L, 0)), fill: color }),
          h('path', { d: dOf(tall), fill: 'none', stroke: INK, 'stroke-width': 3, 'stroke-linejoin': 'round' }),
        );
        const o = { L, ok: L === Lc };
        o.btn = h(
          'button',
          { class: 'pic', type: 'button', 'aria-label': `Picture ${i + 1}`, onclick: () => on(o) },
          svg,
        );
        list.push(o);
        pics.append(o.btn);
      });
      opts.replaceChildren(pics);
      async function on(o) {
        if (busy || done || !live(t)) return;
        sfx('tap');
        if (o.ok) {
          done = true;
          busy = true;
          o.btn.classList.add('good');
          list.forEach((x) => x.btn.classList.remove('glow'));
          api.cheer(pick(CHEERS));
          await sleep(1200);
          if (!live(t)) return;
          if (!poured) {
            api.prompt('Let us pour and see.');
            await sleep(600);
            if (!live(t)) return;
            await doPour();
            if (!live(t)) return;
            await sleep(500);
          }
          api.prompt('Thin glasses make the juice climb high.');
          busy = false;
          acts.replaceChildren(
            btn('Next ➜', 'Next', () => {
              sfx('tap');
              next();
            }),
          );
        } else {
          wrong++;
          o.btn.classList.add('shake');
          setTimeout(() => o.btn.classList.remove('shake'), 450);
          if (wrong >= 2) list.find((x) => x.ok).btn.classList.add('glow');
          if (!poured) {
            busy = true;
            api.nudge('Hmm. Let us pour and watch.');
            await sleep(1700);
            if (!live(t)) return;
            await doPour();
            busy = false;
            if (live(t)) api.prompt('Which picture matches the tall glass?');
          } else api.nudge('Look at the tall glass. Which picture?');
        }
      }
      acts.replaceChildren(
        btn(
          '🫗 Pour to check',
          'Pour both glasses into the tall glass',
          async () => {
            if (busy || poured) return;
            busy = true;
            await doPour();
            busy = false;
            if (live(t)) api.prompt('Which picture matches the tall glass?');
          },
          'btn',
        ),
      );
      api.prompt('Both go in the tall glass. How high?');
      cur.play = async () => {
        await sleep(2500);
        if (!live(t)) return;
        api.prompt('Pour both into the tall glass.');
        await sleep(1500);
        if (!live(t)) return;
        await doPour();
        if (!live(t)) return;
        const ok = list.find((x) => x.ok).btn;
        api.prompt('This picture matches the tall glass.');
        ok.classList.add('glow', 'hop');
        sfx('pop');
        await sleep(3200);
      };
    }

    // ---------- rounds ----------
    const ROUNDS = [r1, r2, r3, r4, r5];
    const next = () => {
      if (round + 1 < ROUNDS.length) startRound(round + 1);
      else api.finish();
    };
    function startRound(r) {
      tok++;
      round = r;
      busy = false;
      cur = {};
      api.stage(r, ROUNDS.length);
      card.classList.remove('short');
      card.replaceChildren();
      acts.replaceChildren();
      opts.replaceChildren();
      ROUNDS[r](tok);
      return tok;
    }
    api.setDemo(async () => {
      const r = round,
        t = startRound(r);
      busy = true;
      try {
        await cur.play(t);
      } finally {
        if (live(t)) startRound(r);
      }
    });
    startRound(resumeRound(api, ROUNDS.length));

    return {
      destroy() {
        alive = false;
        cancelAnimationFrame(raf);
      },
    };
  },
};
