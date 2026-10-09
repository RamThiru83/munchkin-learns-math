/**
 * Game: The Ant on the Band  (id: ant-on-band, level 2)
 *
 * Idea: a plain paper ring has two sides, but a strip glued with a half twist (a Möbius band) has
 * only one, and cutting the two bands lengthwise gives surprising results.
 * Rounds:
 *   1. A picture shows a band (plain or twisted); pick "No twist" / "Twist" to build it. Both bands, random order.
 *   2. An ant walks two laps on the yellow face: guess, watch, then answer "footprints on blue?" (ring, then twisty band).
 *   3. Drag to paint the yellow inside: the ring stays blue outside; the twisty band needs two laps,
 *      then "how many sides?" (answer 1).
 *   4. Guess, then drag to cut along the middle: ring → 2 pieces, twisty band → 1 long loop.
 *   5. Cut the twisty band near the edge (two laps of scissors) → 2 linked pieces; then "how many times round?" (2).
 * Watch demo: waits for each choice or drag in the current round and plays it correctly (glowing the
 *   right button and clicking it, or moving the brush/scissors), until the round ends.
 * Notes: the band is pseudo-3D SVG redrawn every animation frame (painter's algorithm over N quads), so
 *   keep the per-frame work small. Every step of a round waits on `pending` (a choice or a drag goal);
 *   its .demo() is what Watch runs. The cut results in cutResult() are hand-tuned drawings, not a
 *   simulation. No exported test hooks.
 */
import { h, sleep, shuffle, pick, sfx, resumeRound } from '../lib/core.js';

const ID = 'ant-on-band';
const ROUND_COUNT = 5;
const LAP_SECONDS = 5; // the ant walks one lap in this many seconds
const DRAG_PX_PER_RADIAN = 85; // drag distance (svg units) that moves the brush one radian along the band
const EDGE_CUT = 0.36; // round 5 cut line, as a fraction of the half-width from the middle

// ---------- geometry of a paper strip (pseudo-3D, drawn as quads) ----------
// The strip has two coloured faces: yellow and blue. Parameter u runs 0..2π along the strip.
// cu = curl (0 straight strip, 1 closed loop), tw = twist progress, k = 0 plain ring, 1 half twist (Möbius).
const N = 96,
  R = 100,
  HW = 28,
  TAU = Math.PI * 2,
  DU = TAU / N;
const EL = 0.42,
  CE = Math.cos(EL),
  SE = Math.sin(EL); // camera elevation (looking slightly down)
const YEL = [255, 206, 92],
  BLU = [116, 186, 236];
const PAINTS = [
  [255, 112, 166],
  [72, 199, 142],
  [167, 112, 238],
];
const STEPS = ['#c2185b', '#6a1b9a', '#d84315'];
const INK = '#2b2d42';

// button icons for round 1
const ICON_FLAT =
  '<svg viewBox="0 0 64 28" width="58" height="26" aria-hidden="true"><rect x="3" y="6" width="58" height="16" rx="2" fill="#ffce5c" stroke="#2b2d42" stroke-width="2.5"/></svg>';
const ICON_TWIST =
  '<svg viewBox="0 0 64 28" width="58" height="26" aria-hidden="true"><path d="M3 4 L32 14 L3 24Z" fill="#ffce5c" stroke="#2b2d42" stroke-width="2.5" stroke-linejoin="round"/><path d="M61 4 L32 14 L61 24Z" fill="#74baec" stroke="#2b2d42" stroke-width="2.5" stroke-linejoin="round"/></svg>';

const add = (a, b, k = 1) => [a[0] + b[0] * k, a[1] + b[1] * k, a[2] + b[2] * k];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const rgb = (c, k) => `rgb(${c.map((v) => Math.round(Math.min(255, v * k))).join(',')})`;
const f1 = (n) => Math.round(n * 10) / 10;
const pts = (...ps) => ps.map((p) => f1(p[0]) + ',' + f1(p[1])).join(' ');
const ease = (p) => (p < 0.5 ? 2 * p * p : 1 - (-2 * p + 2) ** 2 / 2);

// centre c, half-width vector d, unit normal n of the YELLOW face at parameter u
// optional piece fields (used after cutting): r length factor, hw half-width, sz scale, tilt (about x), off offset
function section(b, u) {
  const t = Math.max(b.cu, 1e-4),
    sc = 0.5 + 0.5 * b.cu,
    RR = R * (b.r || 1),
    z = b.sz || 1;
  const th = (u - Math.PI) * t,
    st = Math.sin(th),
    ct = Math.cos(th);
  let c = [(RR / t) * st * sc, ((RR / t) * (ct - 1) + RR * b.cu) * sc, 0];
  const T = [ct, -st, 0];
  // strip direction turns by k half turns along the strip (k = 1: Möbius band)
  const phi = Math.PI / 2 + (b.k * b.tw * (u - Math.PI)) / 2;
  const dh = [Math.cos(phi) * st, Math.cos(phi) * ct, Math.sin(phi)];
  let d = dh.map((x) => x * (b.hw || HW) * sc * z),
    n = cross(T, dh);
  if (b.tilt) {
    const co = Math.cos(b.tilt),
      si = Math.sin(b.tilt),
      rx = (v) => [v[0], v[1] * co - v[2] * si, v[1] * si + v[2] * co];
    c = rx(c);
    d = rx(d);
    n = rx(n);
  }
  c = c.map((x) => x * z);
  if (b.off) c = add(c, b.off);
  return { c, d, n };
}
// rotate point p by angle a about the vertical axis, tilt by the camera elevation and apply a mild
// perspective; returns [screen x, screen y, depth] (larger depth = nearer the viewer)
function proj(p, a) {
  const ca = Math.cos(a),
    sa = Math.sin(a);
  const x = p[0] * ca - p[1] * sa,
    y = p[0] * sa + p[1] * ca;
  const up = y * SE + p[2] * CE,
    dep = -y * CE + p[2] * SE,
    f = 900 / (900 - dep);
  return [x * f, -up * f, dep];
}
// > 0 when a face with normal n looks towards the viewer
const facing = (n, a) => -(n[0] * Math.sin(a) + n[1] * Math.cos(a)) * CE + n[2] * SE;

function antSvg(p, ang, ghost) {
  return `<g transform="translate(${f1(p[0])},${f1(p[1])}) rotate(${f1(ang)}) scale(1.25)" opacity="${ghost ? 0.33 : 1}">
<path d="M-5,-1 L-9,-7 M-5,1 L-9,7 M0,-1 L-1,-8 M0,1 L-1,8 M3,-1 L7,-7 M3,1 L7,7 M7.5,-1.5 Q11,-6 13.5,-5 M7.5,1.5 Q11,6 13.5,5" stroke="#3a2618" stroke-width="1.5" fill="none" stroke-linecap="round"/>
<g fill="#4a2c1a" stroke="#fff" stroke-width="1" paint-order="stroke"><ellipse cx="-7" cy="0" rx="5.5" ry="4"/><ellipse cx="0" cy="0" rx="3.2" ry="2.6"/><circle cx="5.8" cy="0" r="3.2"/></g></g>`;
}
function brushSvg(p, col, ghost, t) {
  const r = f1(13 + 3 * Math.sin(t * 5));
  return `<g transform="translate(${f1(p[0])},${f1(p[1])})" opacity="${ghost ? 0.5 : 1}">
<circle r="${r}" fill="none" stroke="${col}" stroke-width="3" opacity=".6"/>
<g transform="rotate(28)"><path d="M-5,-15 Q0,-2 0,0 Q0,-2 5,-15 Z" fill="${col}" stroke="${INK}" stroke-width="1.5"/>
<rect x="-5.5" y="-22" width="11" height="8" rx="1.5" fill="#b8c0cc" stroke="${INK}" stroke-width="1.5"/>
<rect x="-3.5" y="-52" width="7" height="31" rx="3" fill="#b5651d" stroke="${INK}" stroke-width="1.5"/></g></g>`;
}

function scissorsSvg(p, ghost, t) {
  const o = f1(14 * Math.abs(Math.sin(t * 7)));
  return `<g transform="translate(${f1(p[0])},${f1(p[1])}) rotate(-35)" opacity="${ghost ? 0.5 : 1}" stroke="${INK}" stroke-width="2" stroke-linejoin="round">
<circle r="15" fill="none" stroke="#fff" stroke-width="3" opacity=".8"/>
<g transform="rotate(${o})"><path d="M0,0 L30,-3 L30,1Z" fill="#dfe6ee"/><circle cx="-12" cy="6" r="6" fill="none" stroke="#e5484d" stroke-width="3.5"/><path d="M0,0 L-8,4" stroke="#e5484d" stroke-width="3.5"/></g>
<g transform="rotate(${-o})"><path d="M0,0 L30,3 L30,-1Z" fill="#dfe6ee"/><circle cx="-12" cy="-6" r="6" fill="none" stroke="#e5484d" stroke-width="3.5"/><path d="M0,0 L-8,-4" stroke="#e5484d" stroke-width="3.5"/></g>
<circle r="2" fill="${INK}"/></g>`;
}

// Draw a band as depth-sorted quads (painter's algorithm). Returns SVG markup.
function bandItems(b, a) {
  const S = [];
  for (let i = 0; i <= N; i++) {
    const s = section(b, i * DU);
    s.p = proj(add(s.c, s.d), a);
    s.q = proj(add(s.c, s.d, -1), a);
    S.push(s);
  }
  const closed = b.cu > 0.999,
    items = [];
  for (let i = 0; i < N; i++) {
    const A = S[i],
      B = S[i + 1];
    const fc = facing(add(A.n, B.n), a) / 2,
      vs = fc > 0 ? 0 : 1,
      lit = Math.min(1, Math.abs(fc));
    const col = rgb(vs ? BLU : YEL, 0.64 + 0.4 * lit);
    let s = `<polygon points="${pts(A.p, B.p, B.q, A.q)}" fill="${col}" stroke="${col}" stroke-width="0.9" stroke-linejoin="round"/>`;
    const pf = b.paint ? b.paint[vs][i] : 0;
    if (pf > 0) {
      const E = pf >= 1 ? B : section(b, (i + pf) * DU),
        k = 0.94,
        pc = rgb(b.paintCol, 0.72 + 0.32 * lit);
      s += `<polygon points="${pts(proj(add(A.c, A.d, k), a), proj(add(E.c, E.d, k), a), proj(add(E.c, E.d, -k), a), proj(add(A.c, A.d, -k), a))}" fill="${pc}" stroke="${pc}" stroke-width="0.9" stroke-linejoin="round"/>`;
    }
    s += `<path d="M${pts(A.p)}L${pts(B.p)}M${pts(A.q)}L${pts(B.q)}" stroke="${INK}" stroke-opacity=".55" stroke-width="1.3" fill="none"/>`;
    if (!closed && i === 0)
      s += `<path d="M${pts(A.p)}L${pts(A.q)}" stroke="${INK}" stroke-opacity=".55" stroke-width="1.3"/>`;
    if (!closed && i === N - 1)
      s += `<path d="M${pts(B.p)}L${pts(B.q)}" stroke="${INK}" stroke-opacity=".55" stroke-width="1.3"/>`;
    if (closed && i === 0)
      s += `<path d="M${pts(A.p)}L${pts(A.q)}" stroke="${INK}" stroke-opacity=".35" stroke-width="1.6" stroke-dasharray="3 3"/>`;
    if (b.trail && b.trail[vs][i] >= 0.5) {
      const off = i % 2 ? 0.22 : -0.22;
      const m = add(add(add(A.c, B.c), add(A.d, B.d), off), add(A.n, B.n), vs ? -1 : 1).map((x) => x / 2);
      const pm = proj(m, a);
      s += `<circle cx="${f1(pm[0])}" cy="${f1(pm[1])}" r="2.9" fill="${b.stepCol}"/>`;
    }
    for (let side = 0; b.cut && side < 2; side++) {
      // cut line, seen through the paper from both faces
      const cf = b.cut[side][i];
      if (!(cf > 0)) continue;
      const v = b.cutV * (side ? -1 : 1),
        E = cf >= 1 ? B : section(b, (i + cf) * DU);
      const l = `M${pts(proj(add(A.c, A.d, v), a))}L${pts(proj(add(E.c, E.d, v), a))}`;
      s += `<path d="${l}" stroke="#fff" stroke-width="4.5" stroke-linecap="round"/><path d="${l}" stroke="${INK}" stroke-width="2.2" stroke-linecap="round"/>`;
    }
    items.push({ z: (A.p[2] + B.p[2] + A.q[2] + B.q[2]) / 4, s });
  }
  return items;
}
function renderBand(b, a, ex = {}) {
  const items = bandItems(b, a);
  if (ex.ant) {
    const an = ex.ant,
      sc = section(b, an.u),
      sg = an.s ? -1 : 1;
    const p = proj(add(sc.c, sc.n, 1.5 * sg), a),
      p2 = proj(section(b, an.u + 0.03).c, a);
    const seg = Math.min(N - 1, Math.floor(an.u / DU));
    items.push({
      z: items[seg].z + 0.01,
      s: antSvg(p, (Math.atan2(p2[1] - p[1], p2[0] - p[0]) * 180) / Math.PI, facing(sc.n, a) * sg <= 0),
    });
  }
  for (const pc of ex.more || []) items.push(...bandItems(pc, a));
  items.sort((x, y) => x.z - y.z);
  let out = items.map((x) => x.s).join('');
  if (ex.brush) {
    const br = ex.brush,
      sc = section(b, br.u),
      sg = br.s ? -1 : 1,
      gh = facing(sc.n, a) * sg <= 0;
    if (br.cut) out += scissorsSvg(proj(add(add(sc.c, sc.d, b.cutV * sg), sc.n, 1.5 * sg), a), gh, ex.t || 0);
    else out += brushSvg(proj(add(sc.c, sc.n, 1.5 * sg), a), rgb(b.paintCol, 1), gh, ex.t || 0);
  }
  if (ex.flash != null && ex.flash < 0.7) {
    const p = proj(section(b, 0).c, a),
      q = ex.flash / 0.7;
    out += `<circle cx="${f1(p[0])}" cy="${f1(p[1])}" r="${f1(8 + 30 * q)}" fill="none" stroke="#fff" stroke-width="${f1(6 * (1 - q))}" opacity="${f1(1 - q)}"/>`;
  }
  return out;
}

const CSS = `
.a-ant-on-band{width:100%;max-width:780px;display:flex;flex-direction:column;align-items:center;gap:10px}
.a-ant-on-band .view{width:100%;max-width:620px;background:#fff;border:3px solid var(--ink);border-radius:24px;box-shadow:var(--shadow);overflow:hidden}
.a-ant-on-band svg.main{display:block;width:100%;height:auto;max-height:48vh;touch-action:none;user-select:none}
.a-ant-on-band .tools{display:flex;gap:10px;align-items:center;justify-content:center;flex-wrap:wrap;font-weight:800;font-size:.95rem}
.a-ant-on-band .sw{display:inline-block;width:18px;height:18px;border:2px solid var(--ink);border-radius:5px;vertical-align:-3px;margin:0 4px 0 8px}
.a-ant-on-band .sw.y{background:#ffce5c}.a-ant-on-band .sw.b{background:#74baec}
.a-ant-on-band .lap{background:var(--yellow);border:2px solid var(--ink);border-radius:999px;padding:2px 12px}
.a-ant-on-band .lap:empty{display:none}
.a-ant-on-band .ctl{min-height:72px}
.a-ant-on-band .ch{min-height:64px;min-width:120px;font-size:1.2rem;flex-direction:column;gap:2px;padding:.4em 1em}
.a-ant-on-band .ch.big{font-size:1.5rem}
.a-ant-on-band .ch.picked:disabled{opacity:1;background:var(--yellow)}
.a-ant-on-band .thumb{background:#fff;border:3px dashed var(--ink);border-radius:18px;padding:4px 6px;text-align:center;font-weight:800;font-size:.95rem}
.a-ant-on-band .thumb svg{display:block;width:150px;height:auto}
@media (max-width:480px){.a-ant-on-band .thumb svg{width:112px}.a-ant-on-band .ch{min-width:100px;padding:.4em .6em}.a-ant-on-band .act-row{gap:8px}}
`;

export default {
  id: ID,
  rounds: ROUND_COUNT,
  parentNote:
    'A plain ring has two sides, but a strip given a half twist before gluing (a Möbius band) has only one; the ant and the paint show it. The last rounds cut the bands lengthwise: the ring falls into two rings, the twisty band cut down the middle stays one long loop, and cut near the edge it gives two linked loops. Let her guess first each time, then try it with real paper and scissors.',
  async start(api) {
    let alive = true,
      raf = 0,
      last = performance.now(),
      T = 0;
    // pending: what the round is waiting for ({ res, demo } for a choice, plus kind/goal for a drag)
    let pending = null,
      thumbOn = false,
      turning = false,
      follow = false;
    let baseA = 0,
      flashT = -9,
      ant = null,
      brush = null,
      pieces = [];
    const startAt = resumeRound(api, ROUND_COUNT);
    let roundIdx = startAt;
    const waiters = []; // resolved once per animation frame with dt (seconds)
    const frame = () => new Promise((r) => waiters.push(r));
    const talk = (p, max = 3500) => Promise.race([p, sleep(max)]);
    const band = { k: 0, tw: 0, cu: 0, trail: null, paint: null, paintCol: pick(PAINTS), stepCol: pick(STEPS) };
    const tband = { k: 0, tw: 1, cu: 1 };

    api.css(CSS);
    const wrap = h('div', { class: `a-${ID}` });
    const svg = h('svg', { class: 'main', viewBox: '-185 -135 370 240', role: 'img', 'aria-label': 'A paper band' });
    const thumbSvg = h('svg', { viewBox: '-150 -95 300 190', 'aria-hidden': 'true' });
    const thumb = h('div', { class: 'thumb' }, 'Make this one:', thumbSvg);
    const lap = h('span', { class: 'lap' });
    const turnBtn = h(
      'button',
      {
        class: 'btn small',
        'aria-label': 'Turn the band around',
        hidden: true,
        onclick: () => {
          if (!turning && !follow) {
            sfx('whoosh');
            turn(TAU, 3000);
          }
        },
      },
      '🔄 Turn',
    );
    const ctl = h('div', { class: 'ctl act-row' });
    wrap.append(
      h('div', { class: 'view' }, svg),
      h(
        'div',
        { class: 'tools' },
        h('span', {}, h('i', { class: 'sw y' }), 'yellow side', h('i', { class: 'sw b' }), 'blue side'),
        lap,
        turnBtn,
      ),
      ctl,
    );
    api.root.append(wrap);

    // ---------- animation loop ----------
    function loop(now) {
      if (!alive) return;
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      T += dt;
      if (follow && brush) {
        // camera keeps the brush where its face can be seen
        const target = brush.a0 + brush.trav + (brush.s ? Math.PI : 0);
        baseA += (target - baseA) * Math.min(1, dt * 4);
      }
      const a = baseA + (follow ? 0 : 0.2 * Math.sin(T * 0.5));
      svg.innerHTML = renderBand(band, a, { ant, brush, more: pieces, t: T, flash: T - flashT });
      if (thumbOn) thumbSvg.innerHTML = renderBand(tband, T * 0.6);
      waiters.splice(0).forEach((r) => r(dt));
      raf = requestAnimationFrame(loop);
    }
    raf = requestAnimationFrame(loop);

    async function tween(ms, fn) {
      let t = 0;
      while (alive && t < ms) {
        t += (await frame()) * 1000;
        if (alive) fn(Math.min(1, t / ms));
      }
    }
    async function turn(by, ms) {
      turning = true;
      turnBtn.disabled = true;
      const a0 = baseA;
      await tween(ms, (p) => {
        baseA = a0 + by * ease(p);
      });
      turning = false;
      turnBtn.disabled = false;
    }
    // turn the band so the face that obj (ant) stands on can be seen
    async function reveal(obj) {
      const n = section(band, obj.u).n,
        sg = obj.s ? -1 : 1;
      if (facing(n, baseA) * sg > 0.3) return;
      let best = 0,
        bv = -9;
      for (let j = 1; j < 36; j++) {
        const v = facing(n, baseA + (j * TAU) / 36) * sg;
        if (v > bv) {
          bv = v;
          best = (j * TAU) / 36;
        }
      }
      sfx('whoosh');
      await turn(best, 1800);
    }
    // move along the middle of the strip; crossing the glue line of a Möbius band lands on the other face
    function advance(obj, du, arr) {
      while (du > 1e-9) {
        const step = Math.min(du, TAU - obj.u);
        if (arr) mark(arr[obj.s], obj.u, obj.u + step);
        obj.u += step;
        du -= step;
        obj.trav += step;
        if (obj.u >= TAU - 1e-9) {
          obj.u = 0;
          if (band.k) obj.s ^= 1;
        }
      }
    }
    function mark(a, u0, u1) {
      for (let i = Math.floor(u0 / DU); i < N && i * DU < u1; i++)
        a[i] = Math.max(a[i], Math.min(1, (Math.min(u1, (i + 1) * DU) - i * DU) / DU));
    }
    function setBand(k) {
      Object.assign(band, {
        k,
        tw: 1,
        cu: 1,
        trail: [new Float32Array(N), new Float32Array(N)],
        paint: [new Float32Array(N), new Float32Array(N)],
        cut: null,
        r: 1,
        hw: HW,
        sz: 1,
        tilt: 0,
        off: null,
      });
      baseA = 0;
      ant = null;
      brush = null;
      follow = false;
      lap.textContent = '';
      pieces = [];
    }

    // ---------- choices ----------
    function ask(opts, cfg = {}) {
      return new Promise((res) => {
        const btns = opts.map((o) => {
          const b = h(
            'button',
            {
              class: 'btn ch' + (o.big ? ' big' : ''),
              'aria-label': o.aria || null,
              onclick: () => {
                if (!pending || pending.res !== res) return;
                pending = null;
                sfx('tap');
                btns.forEach((x) => {
                  x.disabled = true;
                });
                b.classList.add('picked');
                res(o.v);
              },
            },
            ...o.kids,
          );
          b._v = o.v;
          if (cfg.glow === o.v) b.classList.add('glow');
          return b;
        });
        ctl.replaceChildren(...(cfg.lead ? [cfg.lead] : []), ...btns);
        pending = {
          res,
          demo: async () => {
            const b = btns.find((x) => x._v === cfg.answer) || btns[0];
            if (cfg.say) api.say(cfg.say);
            b.classList.add('glow');
            await sleep(1300);
            if (alive) b.click();
          },
        };
      });
    }
    const YES = { v: 'yes', aria: 'Yes', kids: [h('span', {}, '👍'), h('span', {}, 'Yes')] },
      NO = { v: 'no', aria: 'No', kids: [h('span', {}, '👎'), h('span', {}, 'No')] };
    async function askUntil(opts, answer, question, hints) {
      let miss = 0;
      for (;;) {
        api.prompt(question);
        const v = await ask(opts, { answer, glow: miss >= 2 ? answer : null, say: hints[1] });
        if (!alive || v === answer) return;
        miss++;
        await talk(api.nudge(hints[0]));
        await sleep(700);
        if (!alive) return;
      }
    }

    // ---------- round 1: build the band that matches the picture ----------
    async function build(k) {
      band.k = k;
      band.tw = 0;
      band.cu = 0;
      sfx('flip');
      if (k)
        await tween(1300, (p) => {
          band.tw = ease(p);
        });
      await tween(1800, (p) => {
        band.cu = ease(p);
      });
      if (!alive) return;
      flashT = T;
      sfx('pop');
    }
    async function unbuild() {
      sfx('whoosh');
      await tween(1200, (p) => {
        band.cu = 1 - ease(p);
      });
      if (band.k)
        await tween(900, (p) => {
          band.tw = 1 - ease(p);
        });
      band.k = 0;
    }
    async function round1() {
      roundIdx = 0;
      api.stage(0, ROUND_COUNT);
      const order = shuffle([0, 1]);
      for (let j = 0; j < 2 && alive; j++) {
        const k = order[j];
        Object.assign(band, { k: 0, tw: 0, cu: 0, trail: null, paint: null });
        baseA = 0;
        tband.k = k;
        thumbOn = true;
        api.prompt(j === 0 ? 'Make a band like this one. Twist or no twist?' : 'Now make the other band!');
        let miss = 0;
        for (;;) {
          const v = await ask(
            [
              { v: 0, aria: 'No twist', kids: [h('span', { html: ICON_FLAT }), 'No twist'] },
              { v: 1, aria: 'Twist', kids: [h('span', { html: ICON_TWIST }), 'Twist'] },
            ],
            {
              lead: thumb,
              answer: k,
              glow: miss >= 2 ? k : null,
              say: k
                ? 'This band has a twist. Twist one end, then glue.'
                : 'This band has no twist. Just bend it and glue.',
            },
          );
          if (!alive) return;
          await build(v);
          if (!alive) return;
          if (v === k) {
            await talk(api.cheer(pick(['Just like the picture!', 'You made it!', 'A perfect band!'])));
            await sleep(600);
            break;
          }
          miss++;
          await talk(api.nudge(k ? 'Hmm, the picture band has a twist.' : 'Hmm, the picture band has no twist.'));
          if (!alive) return;
          await unbuild();
          if (!alive) return;
          api.prompt('Look at the picture again. Twist or no twist?');
        }
      }
      thumbOn = false;
    }

    // ---------- round 2: predict, then watch the ant walk ----------
    async function walkLap() {
      const goal = ant.trav + TAU;
      let tk = 0;
      while (alive && ant.trav < goal - 1e-9) {
        const dt = await frame();
        if (!alive) return;
        advance(ant, Math.min((dt * TAU) / LAP_SECONDS, goal - ant.trav), band.trail);
        tk += dt;
        if (tk > 0.35) {
          tk = 0;
          sfx('step');
        }
      }
    }
    async function antBand(k) {
      setBand(k);
      turnBtn.hidden = false;
      ant = { u: Math.PI, s: 0, trav: 0 }; // starts on the yellow face, at the back of the band
      await talk(
        api.prompt(k ? 'Now the twisty band. The ant walks on yellow.' : 'Here is the ring. The ant walks on yellow.'),
      );
      if (!alive) return;
      api.prompt('Will its footprints reach the other side, the blue side?');
      const guess = await ask([YES, NO], {
        answer: k ? 'yes' : 'no',
        say: k ? 'I think yes. Let us see.' : 'I think no. Let us see.',
      });
      if (!alive) return;
      api.prompt(guess === 'yes' ? 'You think yes. Let us watch!' : 'You think no. Let us watch!');
      await ask([{ v: 'go', kids: [h('span', {}, '🐜'), h('span', {}, 'Walk!')] }], { answer: 'go' });
      if (!alive) return;
      ctl.replaceChildren();
      lap.textContent = 'Lap 1';
      api.prompt('Walk, little ant, walk!');
      await walkLap();
      if (!alive) return;
      await reveal(ant);
      if (!alive) return;
      api.prompt(k ? 'Back at the start... but on the blue side!' : 'Back at the start. Still on yellow.');
      await ask([{ v: 'go', kids: [h('span', {}, '🐜'), h('span', {}, 'Keep walking')] }], { answer: 'go' });
      if (!alive) return;
      ctl.replaceChildren();
      lap.textContent = 'Lap 2';
      await walkLap();
      if (!alive) return;
      api.prompt('Two laps! Let us turn the band and look.');
      await turn(TAU, 3600);
      if (!alive) return;
      const ans = k ? 'yes' : 'no';
      await askUntil(
        [YES, NO],
        ans,
        'Are there footprints on the blue side?',
        k
          ? ['Look at the blue parts. Can you see dots?', 'Yes! Dots on blue and on yellow.']
          : ['Look at the blue outside. Is it clean?', 'No. The blue side is clean.'],
      );
      if (!alive) return;
      await talk(api.cheer(k ? 'Yes! The ant went everywhere!' : 'Right! On the ring, blue stays clean.'));
      await sleep(700);
    }
    async function round2() {
      roundIdx = 1;
      api.stage(1, ROUND_COUNT);
      await antBand(0);
      if (!alive) return;
      await antBand(1);
      ant = null;
    }

    // ---------- round 3: paint the inside of each band ----------
    function brushMove(du) {
      if (!pending || pending.kind !== 'paint') return;
      advance(brush, Math.min(du, pending.goal - brush.trav), brush.cut ? band.cut : band.paint);
      if (Math.random() < 0.08) sfx('tick');
      if (brush.cut && pending.goal > TAU + 1) lap.textContent = '✂️ Lap ' + (brush.trav < TAU - 1e-6 ? 1 : 2);
      if (brush.trav >= pending.goal - 1e-9) {
        const p = pending;
        pending = null;
        p.res();
      }
    }
    function paintUntil(goal) {
      return new Promise((res) => {
        pending = {
          kind: 'paint',
          goal,
          res,
          demo: async () => {
            api.say(brush && brush.cut ? 'Snip, snip, along the line.' : 'Round and round we paint.');
            while (alive && pending && pending.res === res) brushMove((await frame()) * 2);
          },
        };
      });
    }
    let dragPt = null;
    const toSvg = (e) => {
      const m = svg.getScreenCTM();
      return m ? new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse()) : null;
    };
    svg.addEventListener('pointerdown', (e) => {
      if (!pending || pending.kind !== 'paint') return;
      e.preventDefault();
      svg.setPointerCapture?.(e.pointerId);
      dragPt = toSvg(e);
    });
    svg.addEventListener('pointermove', (e) => {
      if (!dragPt) return;
      const p = toSvg(e);
      if (!p) return;
      const d = Math.hypot(p.x - dragPt.x, p.y - dragPt.y);
      dragPt = p;
      brushMove(d / DRAG_PX_PER_RADIAN); // any drag on the band moves the brush along (forgiving for small hands)
    });
    const endDrag = () => {
      dragPt = null;
    };
    svg.addEventListener('pointerup', endDrag);
    svg.addEventListener('pointercancel', endDrag);

    async function round3() {
      roundIdx = 2;
      api.stage(2, ROUND_COUNT);
      for (const k of [0, 1]) {
        setBand(k);
        turnBtn.hidden = false;
        brush = { u: Math.PI, s: 0, trav: 0, a0: 0 };
        follow = true; // yellow inside, at the back
        ctl.replaceChildren();
        lap.textContent = 'Drag to paint';
        api.prompt(k ? 'Now paint the inside of the twisty band!' : 'Paint the yellow inside of the ring. Drag along!');
        await paintUntil(TAU);
        if (!alive) return;
        if (!k) {
          follow = false;
          lap.textContent = '';
          await talk(api.cheer('The whole inside is painted!'));
          if (!alive) return;
          api.prompt('Is the blue outside painted? Let us turn and see.');
          await turn(TAU, 3400);
          if (!alive) return;
          await talk(api.cheer('No paint outside. The ring has two sides!'));
          await sleep(800);
        } else {
          api.prompt('Back at the start... but now on blue! Keep painting!');
          await paintUntil(2 * TAU);
          if (!alive) return;
          follow = false;
          lap.textContent = '';
          await talk(api.cheer('Paint everywhere! Yellow and blue!'));
          if (!alive) return;
          await turn(TAU, 3400);
          if (!alive) return;
          await askUntil(
            [
              { v: 1, big: true, kids: ['1 side'] },
              { v: 2, big: true, kids: ['2 sides'] },
            ],
            1,
            'How many sides does the twisty band have?',
            ['The paint went all over, never over an edge.', 'Just one side!'],
          );
          if (!alive) return;
          await talk(api.cheer('Just one side! A magic band!'));
          await sleep(600);
        }
      }
    }

    // ---------- rounds 4 and 5: cut the band lengthwise ----------
    const PIECES = [
      { v: 1, big: true, aria: 'One piece', kids: ['1 piece'] },
      { v: 2, big: true, aria: 'Two pieces', kids: ['2 pieces'] },
    ];
    const pc = (o) => ({
      k: 0,
      tw: 1,
      cu: 1,
      r: 1,
      hw: HW,
      sz: 1,
      tilt: 0,
      off: null,
      trail: null,
      paint: null,
      cut: null,
      ...o,
    });
    // what the band falls into after the cut; anim(p) opens the pieces out (p: 0..1)
    function cutResult(k, v) {
      if (!k) {
        // plain ring: two rings, one above the other
        const top = (1 - v) / 2,
          bot = (1 + v) / 2; // half-widths (in HW units) of the two strips
        const A = pc({ hw: HW * top }),
          B = pc({ hw: HW * bot });
        return {
          list: [A, B],
          anim: (p) => {
            A.off = [0, 0, HW * (1 - top) + 34 * p];
            B.off = [0, 0, -HW * (1 - bot) - 34 * p];
          },
        };
      }
      const L = pc({ k: 4, r: 2, hw: HW * (v ? 0.62 : 0.8) }); // one long loop with two full twists
      if (!v)
        return {
          list: [L],
          anim: (p) => {
            L.sz = 0.42 + 0.18 * p;
          },
        };
      const M = pc({ k: 1, hw: HW * 0.62, tilt: Math.PI / 2 }); // short Möbius band from the middle, hooked through the long loop
      return {
        list: [L, M],
        anim: (p) => {
          L.sz = M.sz = 0.38 + 0.12 * p;
          M.off = [R * 2 * L.sz, 0, 0];
        },
      };
    }
    async function cutBand(k, v, o) {
      setBand(k);
      turnBtn.hidden = false;
      ctl.replaceChildren();
      band.cut = [new Float32Array(N), new Float32Array(N)];
      band.cutV = v;
      await talk(api.prompt(o.intro));
      if (!alive) return;
      api.prompt(o.guessQ);
      const g = await ask(PIECES, {
        answer: o.ans,
        say: o.ans === 1 ? 'I think one piece. Let us see.' : 'I think two pieces. Let us see.',
      });
      if (!alive) return;
      api.prompt(g === 1 ? 'You think one piece. Let us cut!' : 'You think two pieces. Let us cut!');
      await sleep(1200);
      if (!alive) return;
      brush = { u: Math.PI, s: 0, trav: 0, a0: 0, cut: true };
      follow = true;
      ctl.replaceChildren();
      lap.textContent = o.laps > 1 ? '✂️ Lap 1' : 'Drag to cut';
      api.prompt(o.cutQ);
      await paintUntil(TAU);
      if (!alive) return;
      if (o.laps > 1) {
        await talk(api.prompt('Back at the start, but the cut did not meet!'));
        if (!alive) return;
        api.prompt('Keep cutting, one more time round!');
        await paintUntil(2 * TAU);
        if (!alive) return;
      }
      follow = false;
      lap.textContent = '';
      brush = null;
      api.prompt('The cut meets itself. Snip! Let us pull it open.');
      sfx('pop');
      flashT = T;
      await sleep(500);
      if (!alive) return;
      const res = cutResult(k, v),
        [first, ...rest] = res.list;
      res.anim(0);
      Object.keys(band).forEach((key) => {
        if (!['paintCol', 'stepCol'].includes(key)) delete band[key];
      });
      Object.assign(band, first);
      pieces = rest;
      sfx('whoosh');
      await tween(1600, (p) => {
        res.anim(ease(p));
        Object.assign(band, { off: first.off, sz: first.sz });
      });
      if (!alive) return;
      await turn(TAU, 3600);
      if (!alive) return;
      await askUntil(PIECES, o.ans, 'How many pieces now?', o.hints);
      if (!alive) return;
      await talk(api.cheer(o.yay));
      await sleep(600);
    }
    async function round4() {
      roundIdx = 3;
      api.stage(3, ROUND_COUNT);
      await cutBand(0, 0, {
        ans: 2,
        laps: 1,
        intro: 'Now we cut! Scissors go along the middle.',
        guessQ: 'Cut the ring along the middle. How many pieces?',
        cutQ: 'Drag along the band to cut the ring.',
        hints: ['Count the rings. Turn it to look.', 'Two rings, one up, one down.'],
        yay: 'Two rings! Just as you might think.',
      });
      if (!alive) return;
      await cutBand(1, 0, {
        ans: 1,
        laps: 1,
        intro: 'Now the twisty band. Cut along the middle.',
        guessQ: 'Cut the twisty band. How many pieces?',
        cutQ: 'Drag along the band to cut the middle.',
        hints: ['Follow the loop with your finger. Does it end?', 'Just one long loop!'],
        yay: 'Still one piece! A big twisty loop!',
      });
    }
    async function round5() {
      roundIdx = 4;
      api.stage(4, ROUND_COUNT);
      await cutBand(1, EDGE_CUT, {
        ans: 2,
        laps: 2,
        intro: 'A new twisty band. Cut near the edge this time.',
        guessQ: 'Cut near the edge. How many pieces?',
        cutQ: 'Drag along the band to cut near the edge.',
        hints: ['Look for a small band and a big band.', 'Two pieces: a small one and a big one.'],
        yay: 'Two pieces, hooked together like a chain!',
      });
      if (!alive) return;
      await askUntil(
        [
          { v: 1, big: true, aria: 'Once', kids: ['1 time'] },
          { v: 2, big: true, aria: 'Twice', kids: ['2 times'] },
        ],
        2,
        'How many times round did the scissors go?',
        ['Remember the lap sign: Lap 1, then...', 'Two times round!'],
      );
      if (!alive) return;
      await talk(api.cheer('Yes! Twice round, and one magic band.'));
      await sleep(600);
    }

    // ---------- Watch: play the current round correctly ----------
    api.setDemo(async () => {
      const r = roundIdx;
      while (alive && roundIdx === r) {
        while (alive && roundIdx === r && !pending) await sleep(150);
        if (!alive || roundIdx !== r) break;
        const p = pending;
        await p.demo();
        while (alive && roundIdx === r && pending === p) await sleep(100);
      }
    });

    (async () => {
      try {
        const plays = [round1, round2, round3, round4, round5];
        for (let i = startAt; i < ROUND_COUNT; i++) {
          await plays[i]();
          if (!alive) return;
        }
        roundIdx = ROUND_COUNT;
        pending = null;
        ctl.replaceChildren();
        api.finish();
      } catch (e) {
        if (alive) console.error(e);
      }
    })();

    return {
      destroy() {
        alive = false;
        cancelAnimationFrame(raf);
        pending = null;
        waiters.splice(0).forEach((r) => r(0));
      },
    };
  },
};
