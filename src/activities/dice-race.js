/**
 * Game: Dice Race  (id: dice-race, level 3)
 *
 * Idea: some totals come up more often than others because there are more ways to make them
 * (two faces on one die; 7 with two dice can be made six ways, 2 and 12 only one way).
 * Rounds:
 *   1. One die, two animals race: "1 or 2" vs "6", 4 steps. Pick an animal, then roll (×1 or ×10).
 *   2. Two dice, three animals own 2, 7 and 12, 4 steps. Pick, roll; the ways panel appears after a race.
 *   3. 6×6 dice-sum table: tap every box that makes 7 (six of them), then answer "how many?" (4/5/6).
 *   4. Build every ordered white+pink pair for a random target from 4, 5, 6, 8, 9, 10 (3+5 ≠ 5+3).
 *   5. Pick two numbers (2–12, rival's excluded) whose ways together beat a rival number (7, 6 or 8),
 *      then watch a 5-step race; "New team" or "Finish ⭐".
 * Watch demo: rounds 1–2 pick the most-ways animal and fast-roll until someone wins; round 3 reveals and
 *   counts the six 7s; round 4 builds every pair; round 5 picks the two best numbers and races.
 *   Every demo resets the round afterwards so the child plays it themselves.
 * Notes: rolls use real randomness, so an upset win is possible and is described honestly ("usually",
 *   not "always"). `epoch`/`ok(e)` invalidates async work from a previous round; `busy`/`waitIdle()`
 *   stop taps while something animates. Round 5 always offers a beating pair (rival ≤ 6 ways, best
 *   two others ≥ 10). Rounds advance only via the "Next"/"Finish" buttons. No exported test hooks.
 */
import { h, sleep, shuffle, rand, flyTo, sfx, resumeRound } from '../lib/core.js';

const ID = 'dice-race';
// 1-die race, 2-dice race, ways table, build pairs, pick a team (see ROUNDS inside start()).
const ROUND_COUNT = 5;

// Race rounds 1–2: each lane owns one or more totals and needs `steps` hits to finish.
const RACES = [
  { twoDice: false, steps: 4, owners: [[1, 2], [6]] },
  { twoDice: true, steps: 4, owners: [[2], [7], [12]] },
];
const PAIR_TARGETS = [4, 5, 6, 8, 9, 10]; // round 4 target (2, 3, 7, 11, 12 left out)
const RIVAL_NUMBERS = [7, 6, 8]; // round 5 rival number
const TEAM_STEPS = 5; // round 5 race length
const DEMO_MAX_ROLLS = 200; // safety cap for the race-round demo
const TEAM_MAX_ROLLS = 300; // safety cap for the round-5 race
const WHITE = '#fff';
const PINK = '#fff1f4'; // second die colour

const ANIMALS = [
  ['🐰', 'bunny'],
  ['🐢', 'turtle'],
  ['🐥', 'chick'],
  ['🐱', 'kitten'],
  ['🐶', 'puppy'],
  ['🦊', 'fox'],
  ['🐼', 'panda'],
  ['🐨', 'koala'],
  ['🐸', 'frog'],
  ['🐷', 'piglet'],
  ['🐭', 'mouse'],
  ['🦔', 'hedgehog'],
];
const LANE_TINT = ['#ff8fab', '#4cc9f0', '#ffd166'];
const PIPS = {
  1: [[50, 50]],
  2: [
    [28, 28],
    [72, 72],
  ],
  3: [
    [28, 28],
    [50, 50],
    [72, 72],
  ],
  4: [
    [28, 28],
    [72, 28],
    [28, 72],
    [72, 72],
  ],
  5: [
    [28, 28],
    [72, 28],
    [50, 50],
    [28, 72],
    [72, 72],
  ],
  6: [
    [28, 26],
    [72, 26],
    [28, 50],
    [72, 50],
    [28, 74],
    [72, 74],
  ],
};

// Die face as SVG markup on a 100×100 viewBox (pip centres in PIPS).
function dieHTML(n, color = WHITE, pip = '#2b2d42') {
  return (
    `<rect x="5" y="5" width="90" height="90" rx="20" fill="${color}" stroke="#2b2d42" stroke-width="6"/>` +
    PIPS[n].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="9" fill="${pip}"/>`).join('')
  );
}
function die(n, cls = 'die', color, pip) {
  const s = h('svg', { viewBox: '0 0 100 100', class: cls, 'aria-hidden': 'true' });
  s.innerHTML = dieHTML(n, color, pip);
  return s;
}
function setDie(s, n, color, pip) {
  s.innerHTML = dieHTML(n, color, pip);
}

// Number of ways the totals in `nums` can come up: faces of one die, or ordered pairs of two dice.
function waysOf(nums, two) {
  if (!two) return nums.length;
  let c = 0;
  for (let a = 1; a <= 6; a++) for (let b = 1; b <= 6; b++) if (nums.includes(a + b)) c++;
  return c;
}

const CSS = `
.a-dice-race{width:100%;max-width:640px;display:flex;flex-direction:column;gap:10px;align-items:stretch;position:relative}
.a-dice-race .lanes{display:flex;flex-direction:column;gap:8px;background:#fff;border:3px solid var(--ink);border-radius:20px;padding:8px}
.a-dice-race .lane{display:flex;align-items:center;gap:6px}
.a-dice-race .who{flex:0 0 108px;width:108px;min-width:0;box-sizing:border-box;min-height:62px;display:flex;align-items:center;justify-content:center;gap:3px;border:3px solid var(--ink);border-radius:16px;background:#fff;font:inherit;color:inherit;cursor:pointer;padding:2px 4px;position:relative;box-shadow:0 3px 0 rgba(43,45,66,.15)}
.a-dice-race .who .ani{font-size:1.9rem;line-height:1}
.a-dice-race .who .mini{width:22px;height:22px;flex:0 0 22px}
.a-dice-race .who .num{min-width:30px;height:30px;border-radius:50%;border:3px solid var(--ink);display:grid;place-items:center;font-weight:900;font-size:1rem;background:#fff}
.a-dice-race .who.sel{background:var(--yellow)}
.a-dice-race .who .pk{position:absolute;top:-12px;right:-10px;font-size:1.2rem}
.a-dice-race .who .wins{position:absolute;bottom:-11px;left:50%;transform:translateX(-50%);font-size:.75rem;font-weight:900;background:#fff;border:2px solid var(--ink);border-radius:99px;padding:0 5px;white-space:nowrap}
.a-dice-race .track{flex:1;display:flex;gap:3px;min-width:0}
.a-dice-race .cell{flex:1;min-width:0;height:58px;border-radius:12px;background:#f4eedd;display:grid;place-items:center;font-size:clamp(1.4rem,5vw,2rem);line-height:1}
.a-dice-race .runner{display:inline-block}
.a-dice-race .cell.fin{background:repeating-conic-gradient(#d9d2c0 0 25%,#fff 0 50%) 0 0/18px 18px;border:2px dashed var(--ink)}
.a-dice-race .lane.won .cell.fin{background:#d9fbe9}
.a-dice-race .tray{display:flex;align-items:center;justify-content:center;gap:12px;flex-wrap:wrap;min-height:86px}
.a-dice-race .die{width:76px;height:76px}
.a-dice-race .die.roll{animation:dr-tumble .5s ease-out}
.a-dice-race .die.fast{animation-duration:.2s}
@keyframes dr-tumble{0%{transform:rotate(0) translateY(0)}35%{transform:rotate(140deg) translateY(-18px)}70%{transform:rotate(290deg) translateY(0)}100%{transform:rotate(360deg)}}
.a-dice-race .sum{font-size:clamp(1.3rem,5vw,1.9rem);font-weight:900;min-width:70px;text-align:center}
.a-dice-race .info{text-align:center;font-weight:800;min-height:1.5em;color:#5c5a52}
.a-dice-race .btns{display:flex;gap:10px;justify-content:center;flex-wrap:wrap}
.a-dice-race .btns .btn{min-height:58px;font-size:1.1rem}
.a-dice-race .ways{display:flex;flex-wrap:wrap;gap:8px 16px;justify-content:center;background:#fff;border:3px dashed var(--line);border-radius:16px;padding:8px 10px;font-weight:800}
.a-dice-race .ways>span{display:inline-flex;align-items:center;gap:4px}
.a-dice-race .ways .dotw{width:14px;height:14px;border-radius:50%;background:var(--green);border:2px solid var(--ink)}
.a-dice-race .ways .mini{width:22px;height:22px}
.a-dice-race .finger{position:absolute;left:0;top:0;font-size:2.4rem;pointer-events:none;z-index:50;opacity:0;transition:opacity .2s}
.a-dice-race .finger.on{opacity:1}
.a-dice-race .grid{display:grid;grid-template-columns:minmax(18px,.3fr) repeat(6,minmax(0,1fr));gap:2px 3px;width:100%;max-width:max(344px,min(470px,calc(100dvh - 330px)));align-self:center}
.a-dice-race .hd{display:grid;place-items:center;font-weight:900;font-size:1.4rem}
.a-dice-race .hd svg{width:92%;max-width:46px;height:auto}
.a-dice-race .gc{aspect-ratio:1;min-height:48px;border:3px solid var(--ink);border-radius:12px;background:#fff;font:inherit;font-weight:900;font-size:clamp(1rem,4.6vw,1.6rem);color:var(--ink);cursor:pointer;padding:0;transition:background .2s}
.a-dice-race .gc.seen{background:#f1ecdf;color:#8a8577}
.a-dice-race .gc.seven{background:var(--green);color:#fff}
.a-dice-race .gc.one{outline:3px dashed var(--orange);outline-offset:-6px}
.a-dice-race .count{display:flex;gap:12px;justify-content:center;flex-wrap:wrap}
.a-dice-race .count .chip{font-weight:900}
.a-dice-race .goal{display:flex;align-items:center;justify-content:center;gap:10px;font-weight:900;font-size:clamp(1.4rem,6vw,2rem)}
.a-dice-race .goal .big{min-width:60px;height:60px;border-radius:50%;border:4px solid var(--ink);background:var(--yellow);display:grid;place-items:center}
.a-dice-race .slots{display:flex;flex-wrap:wrap;gap:8px;justify-content:center}
.a-dice-race .slot{display:flex;align-items:center;gap:2px;min-width:72px;height:46px;justify-content:center;border:3px dashed var(--line);border-radius:14px;background:#fff;font-weight:900;color:#a39e90}
.a-dice-race .slot.full{border-style:solid;border-color:var(--green);background:#e8fbf3}
.a-dice-race .slot svg{width:30px;height:30px}
.a-dice-race .pickers{display:flex;flex-wrap:wrap;gap:10px 18px;justify-content:center;align-items:center}
.a-dice-race .pk3{display:grid;grid-template-columns:repeat(3,62px);gap:6px;padding:8px;border-radius:18px;border:3px solid var(--ink)}
.a-dice-race .pk3.w{background:#fff}.a-dice-race .pk3.p{background:#ffe3ea}
.a-dice-race .face{width:62px;height:62px;padding:3px;border:3px solid transparent;border-radius:16px;background:transparent;cursor:pointer}
.a-dice-race .face svg{width:100%;height:100%;display:block}
.a-dice-race .face.sel{border-color:var(--ink);background:var(--yellow)}
.a-dice-race .plus{font-size:2rem;font-weight:900}
.a-dice-race .nums{display:flex;flex-wrap:wrap;gap:8px;justify-content:center;max-width:420px;align-self:center}
.a-dice-race .nb{width:62px;min-height:74px;border:3px solid var(--ink);border-radius:16px;background:#fff;font:inherit;font-weight:900;font-size:1.5rem;color:var(--ink);cursor:pointer;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;padding:4px 2px;box-shadow:0 3px 0 rgba(43,45,66,.15)}
.a-dice-race .nb.sel{background:var(--yellow)}
.a-dice-race .nb .dts{display:flex;flex-wrap:wrap;justify-content:center;gap:2px;max-width:46px}
.a-dice-race .nb .dts i,.a-dice-race .tally i{width:9px;height:9px;border-radius:50%;background:var(--green);border:1.5px solid var(--ink);display:inline-block}
.a-dice-race .vs{display:flex;flex-wrap:wrap;gap:8px 12px;justify-content:center;align-items:center;font-weight:900;font-size:1.15rem}
.a-dice-race .tally{display:inline-flex;align-items:center;gap:6px;padding:6px 10px;border:3px solid var(--ink);border-radius:16px;background:#fff;min-height:48px}
.a-dice-race .tally .ani{font-size:1.7rem}
.a-dice-race .tally .dd{display:inline-flex;flex-wrap:wrap;gap:2px;max-width:66px}
.a-dice-race .team .num{min-width:28px;height:28px;font-size:.9rem}
`;

export default {
  id: ID,
  rounds: ROUND_COUNT,
  parentNote:
    'Each animal owns a number and steps forward when its number is rolled; with two dice, 7 can be made six ways but 2 and 12 only one way each. Later rounds ask her to build every dice pair for a number (3 and 5 is different from 5 and 3) and to choose two numbers whose ways beat a rival’s. Children often think every number is equally likely, and a few rolls can still surprise, so talk about “usually”, not “always”.',
  async start(api) {
    let alive = true;
    let epoch = 0;
    let busy = false;
    let round = 0;
    api.css(CSS);
    const wrap = h('div', { class: `a-${ID}` });
    api.root.append(wrap);
    const finger = h('div', { class: 'finger', 'aria-hidden': 'true' }, '👆');
    // Each round builder bumps `epoch`; async work from an older round checks ok(e) and stops.
    const ok = (e) => alive && e === epoch;

    // Demo pointer: fly the 👆 finger onto an element.
    async function pointAt(el, dur = 450) {
      if (!el) return;
      finger.classList.add('on');
      await flyTo(finger, el, { duration: dur, offset: { x: 10, y: 22 } });
    }
    const hideFinger = () => finger.classList.remove('on');
    async function waitIdle() {
      while (busy && alive) await sleep(60);
    }

    // ---------------- rounds 1–2: race ----------------
    // Lanes are shuffled; `best` is the lane with the most ways (the expected winner).
    function buildRace(ri) {
      const e = ++epoch;
      busy = false;
      const cfg = RACES[ri];
      const animals = shuffle(ANIMALS).slice(0, cfg.owners.length);
      const lanes = shuffle(cfg.owners).map((nums, i) => ({
        nums,
        ani: animals[i][0],
        name: animals[i][1],
        ways: waysOf(nums, cfg.twoDice),
        tint: LANE_TINT[i],
        wins: 0,
      }));
      const best = lanes.reduce((b, l, i) => (l.ways > lanes[b].ways ? i : b), 0);
      const st = { pick: null, pos: lanes.map(() => 0), rolls: 0, done: false };

      wrap.replaceChildren(finger);
      const lanesBox = h('div', { class: 'lanes' });
      lanes.forEach((l, i) => {
        const who = h(
          'button',
          { class: 'who', style: { borderColor: l.tint }, 'aria-label': `${l.name}, number ${l.nums.join(' or ')}` },
          h('span', { class: 'ani' }, l.ani),
          cfg.twoDice
            ? h('span', { class: 'num', style: { background: l.tint } }, String(l.nums[0]))
            : l.nums.map((n) => die(n, 'mini')),
        );
        who.addEventListener('click', () => choose(i));
        const cells = Array.from({ length: cfg.steps + 1 }, (_, k) =>
          h('div', { class: 'cell' + (k === cfg.steps ? ' fin' : '') }),
        );
        const runner = h('span', { class: 'runner' }, l.ani);
        cells[0].append(runner);
        const lane = h('div', { class: 'lane' }, who, h('div', { class: 'track' }, cells));
        Object.assign(l, { who, cells, runner, lane });
        lanesBox.append(lane);
      });
      const dice = cfg.twoDice ? [die(1 + rand(6)), die(1 + rand(6), 'die', PINK)] : [die(1 + rand(6))];
      const sum = h('div', { class: 'sum' }, '');
      const tray = h('div', { class: 'tray' }, dice, sum);
      const info = h('div', { class: 'info' }, '');
      const roll1 = h(
        'button',
        { class: 'btn primary', 'aria-label': 'Roll the dice' },
        cfg.twoDice ? '🎲🎲 Roll' : '🎲 Roll',
      );
      const roll10 = h('button', { class: 'btn', 'aria-label': 'Roll ten times' }, '🎲 ×10');
      const rollRow = h('div', { class: 'btns' }, roll1, roll10);
      const waysBox = h('div', { class: 'ways', hidden: true });
      const again = h('button', { class: 'btn' }, '↻ Race again');
      const next = h('button', { class: 'btn primary' }, ri === 0 ? 'Next: two dice ➜' : 'Next: the dice table ➜');
      const afterRow = h('div', { class: 'btns', hidden: true }, again, next);
      wrap.append(lanesBox, tray, info, rollRow, waysBox, afterRow);

      // ways panel (shown after the first finished race)
      lanes.forEach((l) => {
        waysBox.append(
          h(
            'span',
            {},
            l.ani,
            cfg.twoDice ? h('b', {}, `${l.nums[0]}:`) : l.nums.map((n) => die(n, 'mini')),
            Array.from({ length: l.ways }, () => h('i', { class: 'dotw' })),
            `${l.ways} ${l.ways === 1 ? 'way' : 'ways'}`,
          ),
        );
      });

      function choose(i) {
        if (!ok(e) || busy) return;
        if (st.done) return;
        if (st.rolls > 0) {
          api.nudge('The race has started. Keep rolling!');
          return;
        }
        st.pick = i;
        sfx('pop');
        lanes.forEach((l, k) => {
          l.who.classList.toggle('sel', k === i);
          l.who.querySelector('.pk')?.remove();
          if (k === i) l.who.append(h('span', { class: 'pk', 'aria-hidden': 'true' }, '⭐'));
        });
        lanes[i].who.classList.add('hop');
        setTimeout(() => lanes[i].who.classList.remove('hop'), 500);
        api.prompt(`You picked the ${lanes[i].name}. Now roll!`);
      }

      // Tumble animation: flicker random faces for ~ms, then land on `vals`.
      async function animateDice(vals, speed) {
        const ms = speed === 'slow' ? 520 : speed === 'fast' ? 220 : 150;
        dice.forEach((d) => {
          d.classList.remove('roll', 'fast');
          void d.getBoundingClientRect();
          d.classList.add('roll');
          if (speed !== 'slow') d.classList.add('fast');
        });
        sfx('flip');
        const t0 = performance.now();
        while (performance.now() - t0 < ms - 60) {
          dice.forEach((d, k) => setDie(d, 1 + rand(6), k ? PINK : WHITE));
          await sleep(70);
          if (!ok(e)) return;
        }
        dice.forEach((d, k) => setDie(d, vals[k], k ? PINK : WHITE));
        await sleep(60);
      }

      async function rollOnce(speed) {
        const vals = dice.map(() => 1 + rand(6));
        await animateDice(vals, speed);
        if (!ok(e)) return;
        const s = vals.reduce((a, b) => a + b, 0);
        st.rolls++;
        sum.textContent = cfg.twoDice ? `= ${s}` : '';
        const li = lanes.findIndex((l) => l.nums.includes(s));
        if (li < 0) {
          info.textContent = `${s}: nobody has ${s}. · Rolls: ${st.rolls}`;
          sfx('tick');
          return;
        }
        const l = lanes[li];
        st.pos[li]++;
        l.cells[st.pos[li]].append(l.runner);
        l.runner.classList.remove('hop');
        void l.runner.offsetWidth;
        l.runner.classList.add('hop');
        sfx('step');
        info.textContent = `${s}: the ${l.name} steps! · Rolls: ${st.rolls}`;
        if (st.pos[li] >= cfg.steps) await finishRace(li);
      }

      async function finishRace(li) {
        st.done = true;
        const l = lanes[li];
        l.wins++;
        l.lane.classList.add('won');
        l.who.classList.add('glow');
        l.who.querySelector('.wins')?.remove();
        l.who.append(h('span', { class: 'wins' }, `🏆 ${l.wins}`));
        rollRow.hidden = true;
        waysBox.hidden = false;
        afterRow.hidden = false;
        afterRow.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' });
        if (li === best) {
          if (st.pick === li)
            api.cheer(pickPhrase([`The ${l.name} won! Good thinking!`, `Yes! The ${l.name} won the race!`]));
          else api.cheer(`The ${l.name} won! More ways means more steps.`);
        } else {
          api.prompt(`The ${l.name} got lucky this time! Race again?`);
        }
      }

      async function rollMany(n, speed) {
        if (!ok(e) || busy || st.done) return;
        if (st.pick == null) {
          api.nudge('First tap the animal you think will win.');
          lanes.forEach((l) => l.who.classList.add('shake'));
          setTimeout(() => lanes.forEach((l) => l.who.classList.remove('shake')), 420);
          return;
        }
        busy = true;
        for (let k = 0; k < n && ok(e) && !st.done; k++) {
          await rollOnce(speed);
          if (n > 1) await sleep(120);
        }
        if (ok(e)) busy = false;
      }
      roll1.addEventListener('click', () => rollMany(1, 'slow'));
      roll10.addEventListener('click', () => rollMany(10, 'fast'));

      function resetRace() {
        st.pick = null;
        st.pos = lanes.map(() => 0);
        st.rolls = 0;
        st.done = false;
        lanes.forEach((l) => {
          l.runner.classList.remove('hop');
          l.cells[0].append(l.runner);
          l.lane.classList.remove('won');
          l.who.classList.remove('sel', 'glow');
          l.who.querySelector('.pk')?.remove();
        });
        sum.textContent = '';
        info.textContent = '';
        rollRow.hidden = false;
        afterRow.hidden = true;
      }
      again.addEventListener('click', () => {
        if (!ok(e)) return;
        sfx('tap');
        resetRace();
        api.prompt('Who will win this time? Tap an animal.');
      });
      next.addEventListener('click', () => {
        if (!ok(e)) return;
        sfx('tap');
        goRound(ri + 1);
      });

      api.setDemo(async () => {
        await waitIdle();
        if (!ok(e)) return;
        resetRace();
        waysBox.hidden = false;
        const b = lanes[best];
        await api.say(
          cfg.twoDice
            ? 'Seven can be made in six ways. Two and twelve, only one way.'
            : 'One or two is two faces. Six is just one face.',
        );
        if (!ok(e)) return;
        await pointAt(b.who);
        if (!ok(e)) return;
        choose(best);
        await sleep(700);
        if (!ok(e)) return;
        await pointAt(roll10);
        if (!ok(e)) return;
        hideFinger();
        api.prompt(
          cfg.twoDice ? '7 has the most ways. Lots of quick rolls!' : 'Two faces, not one. Lots of quick rolls!',
        );
        busy = true;
        for (let k = 0; k < DEMO_MAX_ROLLS && ok(e) && !st.done; k++) {
          await rollOnce('demo');
          await sleep(40);
        }
        if (!ok(e)) return;
        busy = false;
        await sleep(1800);
        if (!ok(e)) return;
        const winner = lanes.findIndex((l, i) => st.pos[i] >= cfg.steps);
        await api.say(
          winner === best ? 'More ways usually wins. Not always!' : 'A surprise! Lucky rolls happen sometimes.',
        );
        if (!ok(e)) return;
        await sleep(600);
        if (!ok(e)) return;
        resetRace();
        waysBox.hidden = true;
        api.prompt('Your turn! Who will win? Tap an animal.');
      });

      api.prompt(ri === 0 ? 'Who will win the race? Tap an animal.' : 'Two dice now! Who will win? Tap one.');
    }

    let lastPhrase = '';
    function pickPhrase(list) {
      const opts = list.filter((p) => p !== lastPhrase);
      lastPhrase = opts[rand(opts.length)];
      return lastPhrase;
    }

    // ---------------- round 3: the ways table ----------------
    // Phases: 'find' (tap the 7s) → 'wave' (reveal all) → 'count' (how many?) → 'done'; 'demo' while Watch runs.
    function buildTable() {
      const e = ++epoch;
      busy = false;
      const st = { found: 0, misses: 0, phase: 'find', countMiss: 0 };
      wrap.replaceChildren(finger);
      const grid = h('div', { class: 'grid' });
      const cells = [];
      grid.append(h('div', { class: 'hd', 'aria-hidden': 'true' }, '+'));
      for (let c = 1; c <= 6; c++) grid.append(h('div', { class: 'hd' }, die(c, 'hdie', PINK)));
      for (let r = 1; r <= 6; r++) {
        grid.append(h('div', { class: 'hd' }, die(r, 'hdie', WHITE)));
        for (let c = 1; c <= 6; c++) {
          const b = h('button', { class: 'gc', 'aria-label': `${r} and ${c}` }, '');
          b._r = r;
          b._c = c;
          b._s = r + c;
          b._open = false;
          b.addEventListener('click', () => tapCell(b));
          grid.append(b);
          cells.push(b);
        }
      }
      const status = h('div', { class: 'info' }, 'Found: 0');
      const countRow = h('div', { class: 'count', hidden: true });
      wrap.append(grid, status, countRow);
      const sevens = () => cells.filter((b) => b._s === 7);

      function reveal(b) {
        b._open = true;
        b.textContent = String(b._s);
        b.classList.add(b._s === 7 ? 'seven' : 'seen');
      }
      async function tapCell(b) {
        if (!ok(e) || busy || st.phase !== 'find') return;
        if (b._open) {
          api.say(`${b._r} and ${b._c} make ${b._s}.`);
          return;
        }
        reveal(b);
        if (b._s === 7) {
          st.found++;
          st.misses = 0;
          sfx('pop');
          cells.forEach((x) => x.classList.remove('glow'));
          b.classList.add('hop');
          status.textContent = `Found: ${st.found}`;
          if (st.found >= 6) {
            await allFound();
            return;
          }
          api.cheer(pickPhrase([`${b._r} and ${b._c} make 7!`, 'Yes, that makes 7!', `Seven! ${b._r} and ${b._c}.`]));
        } else {
          st.misses++;
          b.classList.add('shake');
          setTimeout(() => b.classList.remove('shake'), 420);
          if (st.misses >= 2) {
            const left = sevens().find((x) => !x._open);
            left?.classList.add('glow');
            api.nudge('Try the shining box. Count all the dots.');
          } else api.nudge(`${b._r} and ${b._c} make ${b._s}. Find a 7.`);
        }
      }
      async function allFound() {
        st.phase = 'wave';
        busy = true;
        api.cheer('You found them all! Look at the line!');
        for (const x of cells) {
          if (!ok(e)) return;
          if (!x._open) {
            reveal(x);
            await sleep(25);
          }
        }
        cells.filter((x) => x._s === 2 || x._s === 12).forEach((x) => x.classList.add('one'));
        await sleep(900);
        if (!ok(e)) return;
        busy = false;
        st.phase = 'count';
        showCount();
      }
      function showCount() {
        countRow.replaceChildren();
        shuffle([4, 5, 6]).forEach((n) => {
          const c = h('button', { class: 'chip choice', 'aria-label': String(n) }, String(n));
          c._n = n;
          c.addEventListener('click', () => answer(c));
          countRow.append(c);
        });
        countRow.hidden = false;
        countRow.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' });
        api.prompt('How many green boxes make 7? Count them!');
      }
      async function answer(c) {
        if (!ok(e) || busy || st.phase !== 'count') return;
        if (c._n === 6) {
          st.phase = 'done';
          busy = true;
          c.classList.add('sel', 'hop');
          await api.cheer('Six ways to make 7! Only one way for 2.');
          await sleep(1200);
          if (!ok(e)) return;
          busy = false;
          goRound(round + 1);
        } else {
          st.countMiss++;
          c.classList.add('shake');
          setTimeout(() => c.classList.remove('shake'), 420);
          if (st.countMiss >= 2) {
            [...countRow.children].find((x) => x._n === 6)?.classList.add('glow');
            api.nudge('Touch each green box and count slowly.');
          } else api.nudge('Let us count the green boxes again.');
        }
      }

      api.setDemo(async () => {
        await waitIdle();
        if (!ok(e)) return;
        if (st.phase === 'done') return;
        busy = true;
        cells.forEach((x) => {
          x._open = false;
          x.textContent = '';
          x.className = 'gc';
        });
        countRow.hidden = true;
        st.phase = 'demo';
        await api.say('Which boxes make seven? Add the two dice.');
        const words = ['one', 'two', 'three', 'four', 'five', 'six'];
        const list = sevens();
        for (const b of list) {
          if (!ok(e)) return;
          await pointAt(b, 380);
          if (!ok(e)) return;
          reveal(b);
          sfx('pop');
          status.textContent = `Found: ${list.indexOf(b) + 1}`;
          await api.say(`${b._r} and ${b._c} make seven.`);
          await sleep(350);
        }
        if (!ok(e)) return;
        for (let i = 0; i < list.length; i++) {
          await pointAt(list[i], 260);
          if (!ok(e)) return;
          list[i].classList.add('hop');
          setTimeout(() => list[i].classList.remove('hop'), 500);
          await api.say(words[i]);
          await sleep(250);
        }
        if (!ok(e)) return;
        await api.say('Six ways to make seven!');
        await sleep(900);
        hideFinger();
        if (!ok(e)) return;
        cells.forEach((x) => {
          x._open = false;
          x.textContent = '';
          x.className = 'gc';
        });
        st.found = 0;
        st.misses = 0;
        st.countMiss = 0;
        st.phase = 'find';
        status.textContent = 'Found: 0';
        busy = false;
        api.prompt('Your turn! Tap every box that makes 7.');
      });

      api.prompt('Tap every box where the dice make 7.');
    }

    // ---------------- round 4: build every pair for a target ----------------
    // `pairs` = every ordered (white, pink) pair summing to T; a pick is complete once both dice are chosen.
    function buildPairs() {
      const e = ++epoch;
      busy = false;
      const T = shuffle(PAIR_TARGETS)[0];
      const pairs = [];
      for (let w = 1; w <= 6; w++) {
        const p = T - w;
        if (p >= 1 && p <= 6) pairs.push([w, p]);
      }
      const st = { w: null, p: null, found: new Set(), misses: 0, done: false };
      wrap.replaceChildren(finger);
      const goal = h(
        'div',
        { class: 'goal' },
        die(1 + rand(6), 'mini'),
        die(1 + rand(6), 'mini', PINK),
        'make',
        h('span', { class: 'big' }, String(T)),
      );
      goal.querySelectorAll('svg').forEach((x) => {
        x.style.width = '40px';
        x.style.height = '40px';
      });
      const slots = pairs.map(() => h('div', { class: 'slot' }, '?'));
      const slotRow = h('div', { class: 'slots' }, slots);
      const mkPicker = (kind) => {
        const btns = [1, 2, 3, 4, 5, 6].map((n) => {
          const b = h(
            'button',
            { class: 'face', 'aria-label': `${kind === 'w' ? 'white' : 'pink'} ${n}` },
            die(n, 'fd', kind === 'w' ? WHITE : PINK),
          );
          b._n = n;
          b.addEventListener('click', () => {
            if (ok(e) && !busy && !st.done) choose(kind, n);
          });
          return b;
        });
        return { btns, box: h('div', { class: 'pk3 ' + kind }, btns) };
      };
      const W = mkPicker('w');
      const P = mkPicker('p');
      const status = h('div', { class: 'info' }, '');
      const next = h('button', { class: 'btn primary' }, 'Next: pick a team ➜');
      const afterRow = h('div', { class: 'btns', hidden: true }, next);
      next.addEventListener('click', () => {
        if (!ok(e)) return;
        sfx('tap');
        goRound(round + 1);
      });
      wrap.append(
        goal,
        slotRow,
        h('div', { class: 'pickers' }, W.box, h('span', { class: 'plus', 'aria-hidden': 'true' }, '+'), P.box),
        status,
        afterRow,
      );
      const showStatus = () => {
        status.textContent = `${st.w ?? '?'} + ${st.p ?? '?'}  ·  Found ${st.found.size} of ${pairs.length}`;
      };
      const paint = () => {
        W.btns.forEach((b) => b.classList.toggle('sel', b._n === st.w));
        P.btns.forEach((b) => b.classList.toggle('sel', b._n === st.p));
        showStatus();
      };
      const clearGlow = () => [...W.btns, ...P.btns].forEach((b) => b.classList.remove('glow'));
      function reset() {
        st.w = null;
        st.p = null;
        st.found = new Set();
        st.misses = 0;
        st.done = false;
        slots.forEach((x) => {
          x.className = 'slot';
          x.replaceChildren('?');
        });
        clearGlow();
        afterRow.hidden = true;
        paint();
      }
      // Called after each face tap; checks the pair once both a white and a pink face are chosen.
      async function choose(kind, n) {
        st[kind] = n;
        sfx('pop');
        paint();
        if (st.w == null || st.p == null) return;
        busy = true;
        const [w, p] = [st.w, st.p];
        const s = w + p;
        const key = w + '-' + p;
        await sleep(350);
        if (!ok(e)) return;
        if (s === T && !st.found.has(key)) {
          st.found.add(key);
          st.misses = 0;
          clearGlow();
          const slot = slots[st.found.size - 1];
          slot.className = 'slot full hop';
          slot.replaceChildren(die(w, 'sd'), die(p, 'sd', PINK));
          if (st.found.size === pairs.length) {
            st.done = true;
            st.w = st.p = null;
            paint();
            api.cheer(`All ${pairs.length} ways to make ${T}!`);
            afterRow.hidden = false;
            afterRow.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' });
            busy = false;
            return;
          }
          api.cheer(pickPhrase([`${w} and ${p} make ${T}!`, 'Yes! Another way!', `Good! ${w} and ${p}.`]));
        } else {
          st.misses++;
          if (st.misses >= 2) {
            const nx = pairs.find(([a, b]) => !st.found.has(a + '-' + b));
            clearGlow();
            W.btns[nx[0] - 1].classList.add('glow');
            P.btns[nx[1] - 1].classList.add('glow');
            api.nudge('Try the shining dice.');
          } else if (s === T) api.nudge('Found that one! Try swapping the colours.');
          else api.nudge(`${w} and ${p} make ${s}. We need ${T}.`);
        }
        st.w = st.p = null;
        paint();
        busy = false;
      }
      api.setDemo(async () => {
        await waitIdle();
        if (!ok(e)) return;
        reset();
        busy = true;
        await api.say(`Let us find every way to make ${T}.`);
        if (!ok(e)) return;
        for (const [w, p] of pairs) {
          await pointAt(W.btns[w - 1], 380);
          if (!ok(e)) return;
          st.w = w;
          sfx('pop');
          paint();
          await pointAt(P.btns[p - 1], 380);
          if (!ok(e)) return;
          st.p = p;
          sfx('pop');
          paint();
          const slot = slots[st.found.size];
          st.found.add(w + '-' + p);
          slot.className = 'slot full';
          slot.replaceChildren(die(w, 'sd'), die(p, 'sd', PINK));
          await api.say(`${w} and ${p}.`);
          if (!ok(e)) return;
          st.w = st.p = null;
          paint();
          await sleep(200);
        }
        if (!ok(e)) return;
        hideFinger();
        await api.say(`${pairs.length} ways to make ${T}!`);
        await sleep(900);
        if (!ok(e)) return;
        reset();
        busy = false;
        api.prompt(`Your turn! Find every way to make ${T}.`);
      });
      paint();
      api.prompt(`Pick a white and a pink die to make ${T}.`);
    }

    // ---------------- round 5: pick a team of two numbers ----------------
    // The child picks two totals whose ways (dots) together beat the rival's; then a quick auto race.
    function buildTeam() {
      const e = ++epoch;
      busy = false;
      const rv = shuffle(RIVAL_NUMBERS)[0];
      const ways = (n) => waysOf([n], true);
      const [me, them] = shuffle(ANIMALS).slice(0, 2);
      const st = { picks: [], misses: 0, phase: 'pick', pos: [0, 0] };
      wrap.replaceChildren(finger);
      const dots = (k) => Array.from({ length: k }, () => h('i', {}));
      const myDots = h('span', { class: 'dd' });
      const vsRow = h(
        'div',
        { class: 'vs' },
        h('span', { class: 'tally' }, h('span', { class: 'ani' }, me[0]), myDots),
        'vs',
        h(
          'span',
          { class: 'tally' },
          h('span', { class: 'ani' }, them[0]),
          h('b', {}, String(rv)),
          h('span', { class: 'dd' }, dots(ways(rv))),
        ),
      );
      const nums = [];
      for (let n = 2; n <= 12; n++) {
        if (n === rv) continue;
        const b = h(
          'button',
          { class: 'nb', 'aria-label': `${n}, ${ways(n)} ${ways(n) === 1 ? 'way' : 'ways'}` },
          String(n),
          h('span', { class: 'dts' }, dots(ways(n))),
        );
        b._n = n;
        b.addEventListener('click', () => {
          if (ok(e) && !busy && st.phase === 'pick') toggle(b);
        });
        nums.push(b);
      }
      const numBox = h('div', { class: 'nums' }, nums);
      const raceBtn = h('button', { class: 'btn primary', disabled: true }, '🏁 Race!');
      const pickRow = h('div', { class: 'btns' }, raceBtn);
      const lanesBox = h('div', { class: 'lanes', hidden: true });
      const dice = [die(1 + rand(6)), die(1 + rand(6), 'die', PINK)];
      const sum = h('div', { class: 'sum' }, '');
      const tray = h('div', { class: 'tray', hidden: true }, dice, sum);
      const info = h('div', { class: 'info' }, '');
      const again = h('button', { class: 'btn' }, '↻ New team');
      const fin = h('button', { class: 'btn primary' }, 'Finish ⭐');
      const afterRow = h('div', { class: 'btns', hidden: true }, again, fin);
      wrap.append(vsRow, numBox, pickRow, lanesBox, tray, info, afterRow);
      const best = () =>
        nums
          .slice()
          .sort((a, b) => ways(b._n) - ways(a._n))
          .slice(0, 2);
      const total = () => st.picks.reduce((a, n) => a + ways(n), 0);
      function paint() {
        nums.forEach((b) => b.classList.toggle('sel', st.picks.includes(b._n)));
        myDots.replaceChildren(...(st.picks.length ? dots(total()) : ['?']));
        raceBtn.disabled = st.picks.length !== 2;
        info.textContent = st.picks.length
          ? `${st.picks.join(' and ')}: ${total()} ways · ${rv}: ${ways(rv)} ways`
          : 'Pick two numbers.';
      }
      function toggle(b) {
        sfx('pop');
        if (st.picks.includes(b._n)) st.picks = st.picks.filter((n) => n !== b._n);
        else {
          st.picks.push(b._n);
          if (st.picks.length > 2) st.picks.shift();
        }
        paint();
      }
      function reset() {
        st.picks = [];
        st.misses = 0;
        st.phase = 'pick';
        st.pos = [0, 0];
        nums.forEach((b) => b.classList.remove('glow'));
        numBox.hidden = false;
        pickRow.hidden = false;
        lanesBox.hidden = true;
        tray.hidden = true;
        afterRow.hidden = true;
        sum.textContent = '';
        paint();
      }
      function buildLanes() {
        const L = [
          { ani: me[0], name: me[1], nums: st.picks.slice().sort((a, b) => a - b), tint: LANE_TINT[0] },
          { ani: them[0], name: them[1], nums: [rv], tint: LANE_TINT[1] },
        ];
        lanesBox.replaceChildren();
        L.forEach((l) => {
          const who = h(
            'div',
            { class: 'who team', style: { borderColor: l.tint } },
            h('span', { class: 'ani' }, l.ani),
            l.nums.map((n) => h('span', { class: 'num', style: { background: l.tint } }, String(n))),
          );
          const cells = Array.from({ length: TEAM_STEPS + 1 }, (_, k) =>
            h('div', { class: 'cell' + (k === TEAM_STEPS ? ' fin' : '') }),
          );
          const runner = h('span', { class: 'runner' }, l.ani);
          cells[0].append(runner);
          const lane = h('div', { class: 'lane' }, who, h('div', { class: 'track' }, cells));
          Object.assign(l, { who, cells, runner, lane });
          lanesBox.append(lane);
        });
        return L;
      }
      // Auto-rolls two dice until one lane reaches TEAM_STEPS; resolves to the winning lane (0 = child) or -1 if cancelled.
      async function runRace() {
        st.phase = 'race';
        busy = true;
        st.pos = [0, 0];
        const L = buildLanes();
        numBox.hidden = true;
        pickRow.hidden = true;
        lanesBox.hidden = false;
        tray.hidden = false;
        info.textContent = '';
        let rolls = 0;
        let winner = -1;
        for (let k = 0; k < TEAM_MAX_ROLLS && winner < 0; k++) {
          const vals = [1 + rand(6), 1 + rand(6)];
          dice.forEach((d) => {
            d.classList.remove('roll', 'fast');
            void d.getBoundingClientRect();
            d.classList.add('roll', 'fast');
          });
          dice.forEach((d, i) => setDie(d, vals[i], i ? PINK : WHITE));
          const s = vals[0] + vals[1];
          rolls++;
          sum.textContent = `= ${s}`;
          const li = L.findIndex((l) => l.nums.includes(s));
          if (li >= 0) {
            st.pos[li]++;
            L[li].cells[st.pos[li]].append(L[li].runner);
            sfx('step');
            if (st.pos[li] >= TEAM_STEPS) winner = li;
          }
          info.textContent = `Rolls: ${rolls}`;
          await sleep(260);
          if (!ok(e)) return -1;
        }
        L[winner].lane.classList.add('won');
        L[winner].who.classList.add('glow');
        st.phase = 'done';
        busy = false;
        return winner;
      }
      raceBtn.addEventListener('click', async () => {
        if (!ok(e) || busy || st.phase !== 'pick' || st.picks.length !== 2) return;
        const t = total();
        const r = ways(rv);
        if (t > r) {
          sfx('tap');
          nums.forEach((b) => b.classList.remove('glow'));
          api.cheer(`${t} ways beats ${r} ways. Let us race!`);
          const w = await runRace();
          if (!ok(e) || w < 0) return;
          if (w === 0) api.cheer(pickPhrase([`The ${me[1]} won! Great team!`, `Your team won the race!`]));
          else api.prompt(`The ${them[1]} got lucky! Your team still had more ways.`);
          afterRow.hidden = false;
          afterRow.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' });
          return;
        }
        st.misses++;
        numBox.classList.add('shake');
        setTimeout(() => numBox.classList.remove('shake'), 420);
        if (st.misses >= 2) {
          best().forEach((b) => b.classList.add('glow'));
          api.nudge('Try the shining numbers. They have lots of dots.');
        } else if (t === r) api.nudge('Same dots is a tie. Pick more dots!');
        else api.nudge(`Only ${t} dots. Try numbers near 7.`);
      });
      again.addEventListener('click', () => {
        if (!ok(e)) return;
        sfx('tap');
        reset();
        api.prompt(`Pick two numbers to beat the ${them[1]}.`);
      });
      fin.addEventListener('click', () => {
        if (!ok(e)) return;
        sfx('tap');
        fin.disabled = true;
        api.finish();
      });
      api.setDemo(async () => {
        await waitIdle();
        if (!ok(e)) return;
        reset();
        busy = true;
        await api.say(`The ${them[1]} has ${ways(rv)} dots. We need more.`);
        if (!ok(e)) return;
        for (const b of best()) {
          await pointAt(b, 420);
          if (!ok(e)) return;
          st.picks.push(b._n);
          sfx('pop');
          paint();
          await api.say(`${b._n} has ${ways(b._n)}.`);
          if (!ok(e)) return;
        }
        await api.say(`${total()} dots beats ${ways(rv)}!`);
        if (!ok(e)) return;
        await pointAt(raceBtn, 380);
        if (!ok(e)) return;
        hideFinger();
        const w = await runRace();
        if (!ok(e) || w < 0) return;
        busy = true;
        await api.say(w === 0 ? 'More ways usually wins.' : 'A lucky surprise! More ways still usually wins.');
        await sleep(1200);
        if (!ok(e)) return;
        reset();
        busy = false;
        api.prompt('Your turn! Pick two numbers with lots of dots.');
      });
      paint();
      api.prompt(`Pick two numbers to beat the ${them[1]}.`);
    }

    // Round builders; keep in step with ROUND_COUNT.
    const ROUNDS = [() => buildRace(0), () => buildRace(1), buildTable, buildPairs, buildTeam];
    function goRound(i) {
      if (!alive) return;
      round = Math.min(i, ROUNDS.length - 1);
      api.stage(round, ROUNDS.length);
      hideFinger();
      ROUNDS[round]();
    }
    goRound(resumeRound(api, ROUNDS.length));

    return {
      destroy() {
        alive = false;
        epoch++;
      },
    };
  },
};
