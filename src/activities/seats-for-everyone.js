/**
 * Game: Seats for Everyone  (id: seats-for-everyone, level 1)
 *
 * Idea: one-to-one matching (one friend, one chair) is the oldest way to compare two groups, before counting.
 * Rounds:
 *   1. 3-4 friends and the same number of chairs: drag each friend onto a chair.
 *   2. One friend too many or one chair too many: say "need more / too many / just enough", then bring or put away a chair.
 *   3. Hidden count: put a star on every chair (4-6), a cloth hides them, match the friends to the stars, answer, then lift the cloth.
 *   4. Hidden count with 5-6 chairs and a gap of 0-2, then fix the gap (bring or put away chairs one at a time).
 *   5. Hidden count with 7-8 chairs and a gap of 2-3, then fix the gap.
 * Watch demo: re-sets the current round (same puzzle) and plays a correct solution, including the fix, then resets it.
 * Notes:
 *   - Puzzles are random each time; the round's puzzle (cfg) is kept while the demo runs and afterwards.
 *   - Rounds 1-2 use `animals` directly; rounds 3-5 first drag stars onto chairs (phase 'mark'), then 'match'.
 *   - Phases: setup, seat, ask, fixAdd, fixMore, fixSpare, mark, match, busy, done; only MOVABLE phases accept moves.
 *   - `tok` is a round token: async steps compare it with live(t) so a restarted round cancels old steps.
 *   - CSS classes are scoped as `.a-seats` (not `.a-seats-for-everyone`).
 *   - No exported test hooks.
 */
import { h, sleep, shuffle, pick, drag, flyTo, sfx, resumeRound } from '../lib/core.js';

const ID = 'seats-for-everyone';

const FACES = [
  ['🐻', 'Bear'],
  ['🐰', 'Rabbit'],
  ['🐱', 'Cat'],
  ['🐶', 'Dog'],
  ['🐼', 'Panda'],
  ['🦊', 'Fox'],
  ['🐸', 'Frog'],
  ['🐵', 'Monkey'],
  ['🐷', 'Pig'],
  ['🦁', 'Lion'],
  ['🐮', 'Cow'],
  ['🐯', 'Tiger'],
];
// Chair colours, cycled by chair index.
const PAL = ['#ff8fab', '#4cc9f0', '#ffd166', '#06d6a0', '#b794f4', '#ff9f68', '#7bd389'];
const NUM = ['One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven'];
const CHEERS = ['Yes! Well spotted!', 'You got it!', 'Lovely thinking!', 'That is right!', 'Great looking!'];
const TOTAL = 5; // number of rounds
const PROMPTS = [
  'Give every friend a chair. Drag them over!',
  'Can every friend find a chair? Try it!',
  'Put one star on each chair. Watch what happens!',
  'Star every chair. Then fix any gap!',
  'Many chairs! Star each one, then match.',
];
// Reveal message for the hidden-count rounds; `d` is how many are left out (1-3).
const result3 = (key, d) =>
  key === 'enough'
    ? 'Every friend has a chair. Just enough!'
    : key === 'more'
      ? `${d === 1 ? 'One friend has' : NUM[d - 1] + ' friends have'} no chair. We need more chairs!`
      : `${d === 1 ? 'One chair has' : NUM[d - 1] + ' chairs have'} no friend. Too many chairs!`;
const OPTS = [
  { key: 'enough', icon: '👍', label: 'Just enough', aria: 'Just enough chairs' },
  { key: 'more', icon: '🪑➕', label: 'Need more chairs', aria: 'We need more chairs' },
  { key: 'spare', icon: '🪑➖', label: 'Too many chairs', aria: 'There are too many chairs' },
];

// Builds one puzzle: nC chairs, nA friends, and the right answer.
// Friends minus chairs: R1 none, R2 +-1, R3 0/+-1, R4 0..+-2, R5 +-2..3.
function makeCfg(r) {
  let nC, nA;
  if (r === 0) nC = nA = pick([3, 4]);
  else if (r === 1) {
    const b = pick([4, 5]);
    if (Math.random() < 0.5) {
      nC = b;
      nA = b + 1;
    } else {
      nC = b + 1;
      nA = b;
    }
  } else if (r === 2) {
    nC = pick([4, 5, 6]);
    const o = pick(['enough', 'more', 'spare']);
    nA = o === 'more' ? nC + 1 : o === 'spare' ? nC - 1 : nC;
  } else if (r === 3) {
    nC = pick([5, 6]);
    nA = nC + pick([-2, -1, 0, 1, 2]);
  } else {
    nC = pick([7, 8]);
    nA = nC + pick([-3, -2, 2, 3]);
  }
  return { nC, nA, faces: shuffle(FACES).slice(0, nA), answer: nA > nC ? 'more' : nA < nC ? 'spare' : 'enough' };
}

// Draws one chair in colour `c` as an inline SVG.
function chairSvg(c) {
  const st = { stroke: '#2b2d42', 'stroke-width': 3 };
  return h(
    'svg',
    { viewBox: '0 0 80 90', class: 'chair', 'aria-hidden': 'true' },
    h('rect', { x: 14, y: 55, width: 9, height: 31, rx: 3, fill: '#a1785f', ...st }),
    h('rect', { x: 57, y: 55, width: 9, height: 31, rx: 3, fill: '#a1785f', ...st }),
    h('rect', { x: 16, y: 3, width: 48, height: 42, rx: 9, fill: c, ...st }),
    h('rect', { x: 24, y: 10, width: 32, height: 26, rx: 5, fill: 'rgba(255,255,255,.4)' }),
    h('rect', { x: 9, y: 41, width: 62, height: 15, rx: 6, fill: c, ...st }),
  );
}

const CSS = `
.a-seats{--s:clamp(56px,12.5vw,88px);width:100%;max-width:720px;display:flex;flex-direction:column;align-items:center;gap:12px}
.a-seats [hidden]{display:none!important}
.a-seats .panel{width:100%;box-sizing:border-box;border:3px solid var(--ink);border-radius:22px;padding:10px;box-shadow:var(--shadow)}
.a-seats .room{background:linear-gradient(#fff3d6,#ffe6b0)}
.a-seats .tray{background:#eaf6ff}
.a-seats .waiting{background:#e7f9f2;min-height:calc(var(--s) + 22px)}
.a-seats .grid{display:grid;grid-template-columns:repeat(var(--cols,4),var(--s));justify-content:center;gap:8px;width:100%}
.a-seats .cwrap{position:relative;overflow:hidden;padding:6px;border-radius:14px}
.a-seats .slot{position:relative;display:block;width:100%;height:calc(var(--s)*1.12);padding:0;border:0;background:transparent;cursor:default}
.a-seats .slot.glow{box-shadow:none}
.a-seats .slot .chair{width:100%;height:100%;display:block;pointer-events:none}
.a-seats .slot::after{content:'';position:absolute;inset:-2px;border:4px solid transparent;border-radius:16px;pointer-events:none;z-index:3}
.a-seats .slot.left::after{border-color:#ff9f1c;animation:a-seats-ring 1s ease-in-out infinite}
.a-seats .slot.glow::after{border-color:#ffb703;box-shadow:0 0 0 4px rgba(255,209,102,.8)}
.a-seats .slot.tappable{cursor:pointer}
.a-seats .slot.new{animation:a-seats-in .5s cubic-bezier(.3,1.5,.5,1)}
.a-seats .slot.away{transform:scale(0);opacity:0;transition:transform .5s,opacity .5s}
.a-seats .home{position:relative;width:100%;aspect-ratio:1;animation:a-seats-in .4s backwards}
.a-seats .tok{position:relative;z-index:5;width:100%;height:100%;padding:0;border:0;background:none;display:grid;place-items:center;font-size:calc(var(--s)*.6);line-height:1;border-radius:50%;cursor:grab}
.a-seats .tok.star{font-size:calc(var(--s)*.55)}
.a-seats .tok .face{display:block;line-height:1;pointer-events:none}
.a-seats .tok.left{box-shadow:0 0 0 4px #ff9f1c;animation:a-seats-glow 1s ease-in-out infinite}
.a-seats .tok.happy .face{animation:a-seats-hop .6s ease var(--d,0ms) 2}
.a-seats .mark{position:absolute;left:50%;top:66%;transform:translate(-50%,-50%);font-size:calc(var(--s)*.45);line-height:1;z-index:4;pointer-events:none;transition:opacity .7s}
.a-seats .slot.unmark .mark{opacity:0}
.a-seats .cloth{position:absolute;inset:0;z-index:2;border-radius:14px;border:3px solid var(--ink);pointer-events:none;
  background:repeating-linear-gradient(0deg,rgba(239,71,111,.28) 0 14px,transparent 14px 28px),repeating-linear-gradient(90deg,rgba(239,71,111,.28) 0 14px,transparent 14px 28px),#fff0f4;
  transform:translateY(-118%);transition:transform .9s cubic-bezier(.3,1.2,.5,1)}
.a-seats .cloth.on{transform:none}
.a-seats .actions{min-height:58px}
.a-seats .actions .btn{min-height:56px;font-size:1.1rem}
.a-seats .choices{width:100%;display:flex;gap:10px;justify-content:center}
.a-seats .opt{flex:1 1 100px;max-width:200px;min-width:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;min-height:92px;padding:8px 4px;line-height:1.1}
.a-seats .opt .ic{font-size:clamp(1.5rem,6vw,2.1rem);white-space:nowrap}
.a-seats .opt small{font-size:.95rem;font-weight:800;text-align:center}
.a-seats .opt.glow{background:var(--yellow)}
@keyframes a-seats-in{from{transform:scale(.4);opacity:0}}
@keyframes a-seats-hop{40%{transform:translateY(-14px) scale(1.12)}}
@keyframes a-seats-ring{50%{opacity:.35}}
@keyframes a-seats-glow{50%{box-shadow:0 0 0 9px rgba(255,159,28,.3)}}
`;

export default {
  id: ID,
  rounds: TOTAL,
  parentNote:
    'Matching one friend to one chair is the oldest way to compare two groups, long before counting. Ask "Is anybody left out? Why?" and let her find that rearranging never fixes one extra. In the hidden round the stars stand in for the chairs: a group matched to the stars is exactly as big as the group of chairs, even though she cannot see them. The last two rounds use more chairs and a gap of up to three, so she also fixes it by bringing or putting away chairs one at a time.',

  async start(api) {
    const startAt = resumeRound(api, TOTAL);
    let alive = true,
      tok = 0,
      round = startAt,
      phase = 'idle',
      locked = false,
      demoMode = false;
    let wrong = 0,
      wrongSeat = 0,
      hinted = false;
    let cfg = null,
      slots = [],
      animals = [],
      stars = [];
    api.css(CSS);

    const wrap = h('div', { class: 'a-seats' });
    const chairs = h('div', { class: 'grid chairs' });
    const cloth = h('div', { class: 'cloth', 'aria-hidden': 'true' });
    const room = h('div', { class: 'panel room' }, h('div', { class: 'cwrap' }, chairs, cloth));
    const tray = h('div', { class: 'panel tray grid' });
    const waiting = h('div', { class: 'panel waiting grid' });
    const actions = h('div', { class: 'act-row actions' });
    const choices = h('div', { class: 'choices' });
    wrap.append(room, tray, waiting, actions, choices);
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

    const live = (t) => alive && t === tok;
    const S = () => slots[0]?.el.offsetWidth || 64;
    const MOVABLE = ['seat', 'mark', 'match', 'ask', 'fixMore'];
    const canMove = () => !locked && MOVABLE.includes(phase);
    const narrate = async (text, ms = 1100) => {
      if (alive) await Promise.all([api.prompt(text), sleep(ms)]);
    };
    const clearGlow = () => slots.forEach((s) => s.el.classList.remove('glow'));
    const markLeft = (on) => {
      animals.forEach((a) => a.el.classList.toggle('left', on && !a.slot));
      slots.forEach((s) => {
        s.el.classList.toggle('left', on && !s.occ);
        s.el.classList.toggle('tappable', phase === 'fixSpare' && !s.occ);
      });
    };

    // ---------- layout ----------
    // Pick a column count that fits the row width and balances rows (e.g. 7 -> 4+3, not 6+1).
    function gridCols(el, n) {
      const cell = el.firstElementChild;
      const sz = cell ? cell.offsetWidth : 64,
        gap = 8,
        avail = el.clientWidth || 300;
      const fit = Math.max(1, Math.floor((avail + gap) / (sz + gap)));
      const rows = Math.ceil(Math.max(1, n) / fit);
      el.style.setProperty('--cols', Math.ceil(Math.max(1, n) / rows));
    }
    // Where a token rests on a chair: stars sit low on the seat, animals sit up on it.
    const off = (t, s) => ({ x: 0, y: (t.kind === 'star' ? 0.16 : -0.1) * s.el.offsetHeight });
    // After a resize, re-place seated tokens on their chairs instantly (no animation).
    function resnap() {
      for (const t of [...animals, ...stars]) {
        t.el.style.transition = 'none';
        t.el.style.transform = '';
        t.el._dragBase = null;
        t.el._dragPos = null;
        if (t.slot) flyTo(t.el, t.slot.el, { duration: 0, offset: off(t, t.slot) });
      }
    }
    function layout() {
      gridCols(chairs, slots.length);
      if (!tray.hidden) gridCols(tray, stars.length);
      if (!waiting.hidden) gridCols(waiting, animals.length);
    }
    const onResize = () => {
      layout();
      resnap();
    };
    window.addEventListener('resize', onResize);

    // ---------- pieces ----------
    function makeSlot(i) {
      const s = { el: null, occ: null };
      s.el = h(
        'button',
        { class: 'slot', type: 'button', 'aria-label': 'Chair', onclick: () => slotTap(s) },
        chairSvg(PAL[i % PAL.length]),
      );
      return s;
    }
    function makeTok(kind, face, label, parent) {
      const home = h('div', { class: 'home' });
      const el = h(
        'button',
        { class: `tok ${kind}`, type: 'button', 'aria-label': `${label}. Drag to a chair, or tap.` },
        h('span', { class: 'face' }, face),
      );
      home.append(el);
      parent.append(home);
      const t = { el, home, kind, slot: null, area: parent };
      drag(el, { onDrop: (_d, _e, moved) => drop(t, moved) });
      el.addEventListener('click', (e) => {
        if (e.detail === 0) tap(t);
      }); // keyboard
      return t;
    }
    const seat = (t, s, dur = 380) => {
      if (t.slot) t.slot.occ = null;
      t.slot = s;
      s.occ = t;
      sfx('pop');
      return flyTo(t.el, s.el, { duration: dur, offset: off(t, s) });
    };
    const unseat = (t, dur = 380) => {
      if (t.slot) t.slot.occ = null;
      t.slot = null;
      sfx('tap');
      return flyTo(t.el, t.home, { duration: dur });
    };

    // ---------- child's moves ----------
    // Drop handler: snap to the nearest chair if close enough, or send back to the tray if dropped on its own area.
    function drop(t, moved) {
      if (!moved) {
        tap(t);
        return true;
      }
      if (!canMove()) return false;
      const r = t.el.getBoundingClientRect();
      const cx = r.left + r.width / 2,
        cy = r.top + r.height / 2;
      let best = null,
        bd = 1e9;
      for (const s of slots) {
        const q = s.el.getBoundingClientRect();
        const d = Math.hypot(cx - (q.left + q.width / 2), cy - (q.top + q.height / 2));
        if (d < bd) {
          bd = d;
          best = s;
        }
      }
      if (best && bd < Math.max(S() * 0.95, 56)) return tryPlace(t, best);
      const a = t.area.getBoundingClientRect();
      if (t.slot && cx > a.left - 20 && cx < a.right + 20 && cy > a.top - 20 && cy < a.bottom + 20) {
        unseat(t);
        evaluate();
        return true;
      }
      return false;
    }
    function tryPlace(t, s) {
      if (s.occ && s.occ !== t) {
        s.el.classList.add('shake');
        setTimeout(() => s.el.classList.remove('shake'), 450);
        wrongSeat++;
        api.nudge(
          t.kind === 'star' ? 'That chair has a star. Try another one.' : 'That chair is taken. Try an empty one.',
        );
        if (wrongSeat >= 2) {
          clearGlow();
          slots.find((x) => !x.occ)?.el.classList.add('glow');
        }
        return false;
      }
      wrongSeat = 0;
      clearGlow();
      seat(t, s);
      evaluate();
      return true;
    }
    function tap(t) {
      if (!canMove()) return;
      if (t.slot) unseat(t);
      else {
        const f = slots.find((s) => !s.occ);
        if (!f) return;
        seat(t, f);
      }
      clearGlow();
      evaluate();
    }
    function slotTap(s) {
      if (phase === 'fixSpare' && !s.occ) removeSlot(s);
    }

    // ---------- what has happened so far? ----------
    function evaluate() {
      if (locked || !MOVABLE.includes(phase)) return;
      const set = phase === 'mark' ? stars : animals;
      const allSeated = set.every((t) => t.slot),
        allFull = slots.every((s) => s.occ);
      if (phase === 'mark') {
        if (allFull) coverUp();
        return;
      }
      if (phase === 'fixMore') {
        markLeft(false);
        if (allSeated) finishRound('Now every friend has a chair!');
        else if (allFull) {
          markLeft(true);
          fixStep('more', true);
        }
        return;
      }
      if (!(allSeated || allFull)) {
        markLeft(false);
        if (phase === 'ask') {
          phase = round >= 2 ? 'match' : 'seat';
          choices.hidden = true;
          api.prompt(round >= 2 ? 'Sit each friend on a star.' : 'Keep going. Try another way!');
        }
        return;
      }
      if (round === 0) {
        markLeft(false);
        finishRound('Every friend has a chair! Just right!');
        return;
      }
      markLeft(round < 2 || hinted);
      if (phase !== 'ask') enterAsk();
    }
    function enterAsk() {
      phase = 'ask';
      wrong = 0;
      choices.hidden = false;
      Object.values(optBtns).forEach((b) => b.classList.remove('glow'));
      const left = animals.some((a) => !a.slot);
      api.prompt(
        round >= 2
          ? 'Is there a chair for every friend?'
          : left
            ? 'One friend is left standing. Are there enough chairs?'
            : 'One chair has no friend. Are there enough chairs?',
      );
    }
    async function choose(key, btn) {
      if (phase !== 'ask' || locked) return;
      sfx('tap');
      const t = tok;
      if (key === cfg.answer) {
        phase = 'busy';
        choices.hidden = true;
        markLeft(round < 2);
        api.cheer(pick(CHEERS));
        await sleep(1200);
        if (!live(t)) return;
        if (round === 1) fixStep(key);
        else await reveal(key);
        return;
      }
      wrong++;
      hinted = true;
      markLeft(true);
      btn.classList.add('shake');
      setTimeout(() => btn.classList.remove('shake'), 450);
      if (wrong >= 2) optBtns[cfg.answer].classList.add('glow');
      api.nudge(
        wrong === 1
          ? round >= 2
            ? 'Look at the stars. Is anyone left out?'
            : 'Look closely. Does everyone have a chair?'
          : 'Tap the glowing one.',
      );
    }

    // ---------- round 2: fix it ----------
    function fixStep(key, again) {
      if (key === 'more') {
        phase = 'fixAdd';
        api.prompt(
          again ? 'Another friend is standing. Bring one more chair.' : 'Not enough chairs! Bring one more chair.',
        );
        actions.replaceChildren(
          h(
            'button',
            {
              class: 'btn primary glow',
              type: 'button',
              'aria-label': 'Bring a chair',
              onclick: () => {
                sfx('tap');
                if (phase === 'fixAdd') bringChair();
              },
            },
            '🪑 Bring a chair',
          ),
        );
      } else {
        phase = 'fixSpare';
        api.prompt('Too many chairs! Tap the empty chair to put it away.');
        markLeft(true);
        slots.filter((s) => !s.occ).forEach((s) => s.el.classList.add('glow'));
      }
    }
    function bringChair() {
      phase = 'busy';
      actions.replaceChildren();
      const s = makeSlot(slots.length);
      s.el.classList.add('new');
      slots.push(s);
      chairs.append(s.el);
      layout();
      resnap();
      sfx('pop');
      s.el.classList.add('glow');
      api.prompt('Now the standing friend can sit down.');
      phase = 'fixMore';
    }
    async function removeSlot(s) {
      const t = tok;
      phase = 'busy';
      clearGlow();
      markLeft(false);
      s.el.classList.add('away');
      sfx('whoosh');
      await sleep(550);
      if (!live(t)) return;
      slots.splice(slots.indexOf(s), 1);
      s.el.remove();
      layout();
      resnap();
      if (slots.some((x) => !x.occ)) {
        phase = 'fixSpare';
        markLeft(true);
        slots.filter((x) => !x.occ).forEach((x) => x.el.classList.add('glow'));
        api.prompt('Another empty chair. Put it away too.');
      } else finishRound('Now every chair has a friend!');
    }
    async function finishRound(msg, keepMark) {
      const t = tok;
      phase = 'done';
      locked = true;
      markLeft(!!keepMark);
      clearGlow();
      animals.forEach((a, i) => {
        a.el.style.setProperty('--d', `${i * 90}ms`);
        a.el.classList.add('happy');
      });
      api.cheer(msg);
      await sleep(1400);
      if (!live(t) || demoMode) return;
      if (round >= TOTAL - 1) {
        api.finish();
        return;
      }
      actions.replaceChildren(
        h(
          'button',
          {
            class: 'btn primary',
            type: 'button',
            onclick: () => {
              sfx('tap');
              round++;
              setupRound();
            },
          },
          'Next ➜',
        ),
      );
    }

    // ---------- round 3: the hidden count ----------
    async function coverUp() {
      const t = tok;
      phase = 'busy';
      api.cheer('Every chair has a star!');
      await sleep(1300);
      if (!live(t)) return;
      for (const st of stars) {
        if (!st.slot) continue;
        st.slot.el.append(h('span', { class: 'mark', 'aria-hidden': 'true' }, '⭐'));
        st.slot.occ = null;
      }
      stars = [];
      tray.replaceChildren();
      tray.hidden = true;
      cloth.classList.add('on');
      sfx('whoosh');
      api.prompt('Whoosh! A cloth hides the chairs.');
      await sleep(1900);
      if (!live(t)) return;
      waiting.hidden = false;
      animals = cfg.faces.map((f) => makeTok('animal', f[0], f[1], waiting));
      layout();
      phase = 'match';
      api.prompt('Friends are here! Sit each friend on a star.');
    }
    async function reveal(key) {
      const t = tok;
      phase = 'busy';
      locked = true;
      api.prompt('Let us lift the cloth and look!');
      await sleep(1000);
      if (!live(t)) return;
      cloth.classList.remove('on');
      slots.forEach((s) => s.el.classList.add('unmark'));
      sfx('whoosh');
      await sleep(1300);
      if (!live(t)) return;
      markLeft(true);
      animals.forEach((a, i) => {
        if (a.slot) {
          a.el.style.setProperty('--d', `${i * 90}ms`);
          a.el.classList.add('happy');
        }
      });
      const msg = result3(key, Math.abs(cfg.nA - cfg.nC));
      if (round === 2 || key === 'enough') {
        await finishRound(msg, true);
        return;
      }
      api.cheer(msg);
      await sleep(2400);
      if (!live(t)) return;
      locked = false;
      animals.forEach((a) => a.el.classList.remove('happy'));
      fixStep(key);
    }

    // ---------- rounds ----------
    function setupRound(keep, quiet) {
      ++tok;
      wrong = 0;
      wrongSeat = 0;
      hinted = false;
      locked = false;
      phase = 'setup';
      if (!keep || !cfg) cfg = makeCfg(round);
      chairs.replaceChildren();
      waiting.replaceChildren();
      tray.replaceChildren();
      actions.replaceChildren();
      choices.hidden = true;
      cloth.classList.remove('on');
      Object.values(optBtns).forEach((b) => b.classList.remove('glow', 'shake'));
      slots = Array.from({ length: cfg.nC }, (_, i) => makeSlot(i));
      chairs.append(...slots.map((s) => s.el));
      animals = [];
      stars = [];
      tray.hidden = round < 2;
      waiting.hidden = round >= 2;
      if (round < 2) animals = cfg.faces.map((f) => makeTok('animal', f[0], f[1], waiting));
      else stars = Array.from({ length: cfg.nC + 2 }, () => makeTok('star', '⭐', 'Star', tray));
      layout();
      api.stage(round, TOTAL);
      phase = round >= 2 ? 'mark' : 'seat';
      if (!quiet) api.prompt(PROMPTS[round]);
    }

    // ---------- watch demo ----------
    // Replays the current round's puzzle with the real handlers (seat, choose, bringChair, removeSlot).
    api.setDemo(async () => {
      demoMode = true;
      let t;
      try {
        setupRound(true, true);
        t = tok;
        await sleep(500);
        if (!live(t)) return;
        const m = Math.min(cfg.nA, cfg.nC);
        if (round === 0) {
          await narrate('One chair for each friend.', 900);
          for (let i = 0; i < m; i++) {
            if (!live(t)) return;
            api.say(NUM[i]);
            await seat(animals[i], slots[i]);
            await sleep(450);
          }
          if (!live(t)) return;
          evaluate();
          await sleep(2600);
        } else if (round === 1) {
          await narrate('Let us sit the friends down.', 900);
          for (let i = 0; i < m; i++) {
            if (!live(t)) return;
            api.say(NUM[i]);
            await seat(animals[i], slots[i]);
            await sleep(400);
          }
          if (!live(t)) return;
          evaluate();
          await sleep(2600);
          if (!live(t)) return;
          const key = cfg.answer;
          optBtns[key].classList.add('glow');
          await narrate(
            key === 'more' ? 'This friend has no chair. We need more!' : 'This chair has no friend. Too many!',
            1800,
          );
          if (!live(t)) return;
          await choose(key, optBtns[key]);
          if (!live(t)) return;
          await sleep(1200);
          if (key === 'more') {
            bringChair();
            await sleep(900);
            if (!live(t)) return;
            await seat(
              animals.find((a) => !a.slot),
              slots[slots.length - 1],
            );
            evaluate();
          } else {
            await removeSlot(slots.find((s) => !s.occ));
          }
          if (!live(t)) return;
          await sleep(2200);
        } else {
          await narrate('First, a star on every chair.', 1000);
          for (let i = 0; i < cfg.nC; i++) {
            if (!live(t)) return;
            await seat(stars[i], slots[i]);
            await sleep(350);
          }
          evaluate();
          while (live(t) && phase !== 'match') await sleep(150);
          if (!live(t)) return;
          await narrate('Now match each friend with a star.', 1400);
          for (let i = 0; i < m; i++) {
            if (!live(t)) return;
            api.say(NUM[i]);
            await seat(animals[i], slots[i]);
            await sleep(400);
          }
          if (!live(t)) return;
          evaluate();
          await sleep(2200);
          if (!live(t)) return;
          const key = cfg.answer,
            d = Math.abs(cfg.nA - cfg.nC);
          optBtns[key].classList.add('glow');
          await narrate(
            key === 'enough'
              ? 'Every friend has a star. Just enough!'
              : key === 'more'
                ? d > 1
                  ? 'Some friends have no star. Not enough!'
                  : 'One friend has no star. Not enough!'
                : d > 1
                  ? 'Some stars have no friend. Too many!'
                  : 'One star has no friend. Too many!',
            2000,
          );
          if (!live(t)) return;
          await choose(key, optBtns[key]);
          if (!live(t)) return;
          await sleep(500);
          if (round >= 3 && key === 'more') {
            while (live(t) && animals.some((a) => !a.slot)) {
              while (live(t) && phase !== 'fixAdd') await sleep(150);
              if (!live(t)) return;
              await narrate('Bring a chair for the standing friend.', 900);
              if (!live(t)) return;
              bringChair();
              await sleep(800);
              if (!live(t)) return;
              await seat(
                animals.find((a) => !a.slot),
                slots[slots.length - 1],
              );
              evaluate();
              await sleep(700);
            }
            if (!live(t)) return;
            await sleep(1800);
          } else if (round >= 3 && key === 'spare') {
            while (live(t) && slots.some((x) => !x.occ)) {
              while (live(t) && phase !== 'fixSpare') await sleep(150);
              if (!live(t)) return;
              await narrate('Put the empty chair away.', 900);
              if (!live(t)) return;
              await removeSlot(slots.find((x) => !x.occ));
              await sleep(500);
            }
            if (!live(t)) return;
            await sleep(1800);
          }
        }
      } finally {
        demoMode = false;
      }
      if (live(t)) setupRound(true, false);
    });

    setupRound();
    return {
      destroy() {
        alive = false;
        tok++;
        window.removeEventListener('resize', onResize);
      },
    };
  },
};
