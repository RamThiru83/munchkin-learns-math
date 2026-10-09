/**
 * Game: Squares That Grow  (id: squares-grow, level 3)
 *
 * Idea: odd numbers build squares: 1, +3 = 4, +5 = 9, +7 = 16, +9 = 25. Each new square is the old one plus an
 * L-shaped border (down the right side, along the bottom, AND the corner).
 * Rounds:
 *   1. Drag 3 tiles, then 5 tiles, onto dashed L's to grow a 1x1 square into 2x2, then 3x3.
 *   2. Count the dashed L (tap the squares) and pick how many tiles it needs; twice (start 2x2 or 3x3), then it auto-fills.
 *   3. Three questions on a 2x2 start: "how many tiles will the next L need?" or "how many in the NxN square?"; then build the L to check.
 *   4. Reversed: "We have 9 tiles, we want 16: how many more?"; then build the L to check; twice.
 *   5. Two L's at once (2x2 to 4x4: 5 + 7 = 12), build both, then predict the 5x5 total (25) and build it.
 * Watch demo: runs the current round's script with the answers picked and tiles dragged automatically, then play continues.
 * Notes: layer k (1-based) is the L of 2k-1 cells, all with max(row, col) = k-1 (see cellsOf). Every round runs inside a
 * "run" token; starting a new run (Watch, destroy) cancels the old one via the CANCEL symbol thrown from wait/until.
 * The tile drop snaps to the nearest unclaimed dashed cell. Wrong-answer options are built from the classic slips
 * (forgetting the corner, giving the whole square). No test hooks are exported.
 */
import { h, sleep, shuffle, rand, pick, drag, flyTo, sfx, resumeRound } from '../lib/core.js';

const CANCEL = Symbol('cancel');
const TOTAL = 5; // number of rounds
const LAYER = ['#ffd166', '#ff8fab', '#4cc9f0', '#06d6a0', '#b794f4'];
const PRAISE = ['Yes!', 'Lovely!', 'Great job!', 'Super!', 'Well done!'];

// Cells of the L-layer k: right column top to bottom, then bottom row left to right (the corner is last).
const cellsOf = (k) => {
  const a = [];
  for (let r = 0; r < k - 1; r++) a.push([r, k - 1]);
  for (let c = 0; c < k; c++) a.push([k - 1, c]);
  return a;
};

const CSS = `
.a-squares-grow{--c:min(var(--cap,66px),calc((100vw - 50px)/var(--n,3) - 3px));width:100%;max-width:760px;display:flex;flex-direction:column;align-items:center;gap:10px;padding-bottom:10px;box-sizing:border-box}
.a-squares-grow *{box-sizing:border-box}
.a-squares-grow .hud{display:flex;align-items:center;justify-content:center;gap:10px 16px;flex-wrap:wrap}
.a-squares-grow .badge{display:flex;align-items:baseline;gap:8px;background:#fff;border:3px solid var(--ink);border-radius:20px;padding:2px 16px;box-shadow:0 4px 0 rgba(43,45,66,.15)}
.a-squares-grow .badge .lbl{font-weight:800}
.a-squares-grow .badge b{font-size:2.2rem;line-height:1.15;min-width:2ch;text-align:center}
.a-squares-grow .eq{font-weight:900;font-size:clamp(1.05rem,4.2vw,1.6rem);display:flex;flex-wrap:wrap;gap:4px;align-items:center;justify-content:center;min-height:1.7em}
.a-squares-grow .part{display:inline-block;min-width:1.7em;padding:0 .4em;border-radius:10px;border:2px solid rgba(43,45,66,.45);text-align:center}
.a-squares-grow .board{display:grid;grid-template-columns:repeat(var(--n),var(--c));grid-auto-rows:var(--c);gap:3px;padding:6px;background:#fff;border:3px solid var(--ink);border-radius:20px;box-shadow:0 5px 0 rgba(43,45,66,.14);max-width:100%}
.a-squares-grow .sq,.a-squares-grow .ttile{border-radius:12px;background:var(--col);border:2px solid rgba(43,45,66,.38);box-shadow:inset 0 -5px 0 rgba(43,45,66,.16),inset 0 3px 0 rgba(255,255,255,.4);display:grid;place-items:center;font-weight:900;font-size:calc(var(--c)*.4);color:rgba(43,45,66,.8);position:relative;transition:transform .2s;min-height:0;margin:0;padding:0}
.a-squares-grow .sq.pop{animation:sg-pop .38s cubic-bezier(.3,1.6,.5,1)}
.a-squares-grow .sq.rowhi{transform:translateY(-4px) scale(1.1);z-index:2}
.a-squares-grow .ghost{border:3px dashed color-mix(in srgb,var(--col) 65%,#2b2d42);border-radius:12px;background:color-mix(in srgb,var(--col) 16%,#fff);display:grid;place-items:center;font:inherit;font-weight:900;font-size:calc(var(--c)*.4);color:var(--ink);padding:0;animation:sg-pulse 1.8s ease-in-out infinite}
.a-squares-grow button.ghost{cursor:pointer}
.a-squares-grow .ghost.counted{background:var(--col);border-style:solid;animation:none}
.a-squares-grow .glow{animation:sg-glow 1s ease-in-out infinite}
.a-squares-grow .caption{min-height:1.5em;font-weight:900;font-size:1.15rem;text-align:center}
.a-squares-grow .zone{display:flex;flex-direction:column;align-items:center;gap:8px;width:100%;min-height:100px}
.a-squares-grow .cap{font-weight:800;opacity:.75}
.a-squares-grow .tray{display:flex;flex-wrap:wrap;gap:10px;justify-content:center;padding:10px 14px;border:3px dashed #c9c3b2;border-radius:22px;background:rgba(255,255,255,.6);max-width:100%}
.a-squares-grow .ttile{width:max(56px,var(--c));height:max(56px,var(--c));cursor:grab;touch-action:none;padding:0;font:inherit}
.a-squares-grow .ttile:focus-visible,.a-squares-grow .chip:focus-visible{outline:4px solid var(--ink);outline-offset:2px}
.a-squares-grow .chip.tried{opacity:.45}
.a-squares-grow .chip.ok{background:var(--green)}
@keyframes sg-pop{from{transform:scale(.4);opacity:.3}}
@keyframes sg-pulse{50%{transform:scale(.94)}}
@keyframes sg-glow{50%{box-shadow:0 0 0 9px rgba(255,209,102,.95)}}
`;

export default {
  id: 'squares-grow',
  rounds: TOTAL,
  parentNote:
    'Every square number is the one before plus an L-shaped border: 1, then +3 makes 4, +5 makes 9, +7 makes 16. Ask "how many tiles does the next L need?" and let her count the dashed squares herself. Later rounds turn it round ("we have 9, we want 16: how many more?") and ask for two L shapes at once. The common slip is adding a strip along each side and forgetting the corner tile, so the L comes out one short; if that happens, point at the empty corner.',

  async start(api) {
    let alive = true;
    api.css(CSS);
    const say = api.say;
    const wrap = h('div', { class: 'a-squares-grow' });
    api.root.append(wrap);

    // ---- run control: every round runs inside a "run"; starting a new run cancels the old one ----
    let run = null;
    let B = null;
    let roundIdx = resumeRound(api, TOTAL);
    const newRun = () => {
      if (run) run.dead = true;
      run = { dead: false };
      return run;
    };
    const live = (R) => alive && !R.dead;
    const wait = async (R, ms) => {
      await sleep(ms);
      if (!live(R)) throw CANCEL;
    };
    const until = async (R, p) => {
      const v = await p;
      if (!live(R)) throw CANCEL;
      return v;
    };
    const bg = (p) =>
      p.catch((e) => {
        if (e !== CANCEL) console.error(e);
      });

    // ---- board ----
    const part = (n, l) => h('span', { class: 'part', style: { background: LAYER[l - 1] } }, String(n));
    function setHud() {
      B.badge.textContent = B.total;
      const items = B.parts.map((n, i) => part(n, i + 1));
      if (B.placed > 0 && B.placed < B.need) items.push(part(B.placed, B.k));
      const kids = [];
      items.forEach((it, i) => {
        if (i) kids.push(' + ');
        kids.push(it);
      });
      if (items.length > 1) kids.push(' = ' + B.total);
      B.eq.replaceChildren(...kids);
    }
    function place(el, r, c, layer) {
      el.style.gridRow = r + 1;
      el.style.gridColumn = c + 1;
      el.dataset.r = r;
      el.style.setProperty('--col', LAYER[layer - 1]);
    }
    // Builds the board for a size x size start; N is the grid width (room for the final square), capPx the max tile size.
    function newBoard(N, capPx, size) {
      const badge = h('b', {}, '1');
      const eq = h('div', { class: 'eq' });
      const board = h('div', { class: 'board' });
      const caption = h('div', { class: 'caption' });
      const zone = h('div', { class: 'zone' });
      wrap.replaceChildren(
        h(
          'div',
          { class: 'hud' },
          h('div', { class: 'badge', 'aria-live': 'polite' }, h('span', { class: 'lbl' }, 'Tiles'), badge),
          eq,
        ),
        board,
        caption,
        zone,
      );
      wrap.style.setProperty('--n', N);
      wrap.style.setProperty('--cap', capPx + 'px');
      B = {
        N,
        board,
        badge,
        eq,
        caption,
        zone,
        ghosts: [],
        parts: [],
        total: size * size,
        placed: 0,
        need: 0,
        k: size,
        counting: false,
        cnt: 0,
        lock: false,
        misses: 0,
        answered: false,
        chips: null,
        full: null,
        resolve: null,
      };
      for (let k = 1; k <= size; k++) {
        for (const [r, c] of cellsOf(k)) {
          const t = h('div', { class: 'sq' });
          place(t, r, c, k);
          board.append(t);
        }
        B.parts.push(2 * k - 1);
      }
      setHud();
    }
    function showGhosts(R, k, counting) {
      B.board.querySelectorAll('.sq').forEach((t) => {
        t.textContent = '';
      });
      B.ghosts = cellsOf(k).map(([r, c]) => {
        const g = h(counting ? 'button' : 'div', {
          class: 'ghost',
          type: counting ? 'button' : null,
          'aria-label': counting ? 'dashed square, tap to count' : null,
        });
        place(g, r, c, k);
        if (counting) g.addEventListener('click', () => countGhost(R, g));
        B.board.append(g);
        return g;
      });
      Object.assign(B, { k, need: 2 * k - 1, placed: 0, cnt: 0, counting, misses: 0 });
      B.full = new Promise((res) => {
        B.resolve = res;
      });
      setHud();
    }
    function countGhost(R, g, force) {
      if (!live(R) || !B.counting || (B.lock && !force) || !g.classList.contains('ghost') || g.dataset.cnt) return;
      B.cnt++;
      g.dataset.cnt = B.cnt;
      g.textContent = B.cnt;
      g.classList.add('counted');
      sfx('tick');
      say(String(B.cnt));
    }
    async function autoCount(R, delay = 0) {
      B.lock = true;
      if (delay) await wait(R, delay);
      for (const g of B.ghosts) {
        if (g.dataset.cnt || !g.classList.contains('ghost')) continue;
        await wait(R, 420);
        countGhost(R, g, true);
      }
      await wait(R, 300);
      B.lock = false;
    }
    function fillGhost(g) {
      g.className = 'sq pop';
      g.removeAttribute('role');
      delete g.dataset.cnt;
      delete g.dataset.claim;
      B.placed++;
      B.total++;
      g.textContent = B.total;
      if (B.placed === B.need) B.parts.push(B.need);
      setHud();
      sfx('pop');
      say(String(B.total));
      if (B.placed === B.need) B.resolve();
    }
    async function autoFill(R) {
      for (const g of B.ghosts) {
        if (!g.classList.contains('ghost')) continue;
        await wait(R, 340);
        fillGhost(g);
      }
    }
    // Highlights each row in turn to show m rows of m.
    async function sweep(R, m) {
      for (let r = 0; r < m; r++) {
        B.board.querySelectorAll('.sq').forEach((t) => t.classList.toggle('rowhi', +t.dataset.r === r));
        B.caption.textContent = `${r + 1} row${r ? 's' : ''} of ${m}`;
        sfx('tick');
        await wait(R, 380);
      }
      B.board.querySelectorAll('.sq').forEach((t) => t.classList.remove('rowhi'));
      B.caption.textContent = `${m} rows of ${m} = ${m * m}`;
      await wait(R, 900);
    }

    // ---- tray (tiles to drag) ----
    const unclaimed = () => B.ghosts.filter((g) => g.classList.contains('ghost') && !g.dataset.claim);
    const nextGhost = () => unclaimed()[0] || null;
    // Nearest unclaimed dashed square to a dropped tile, or null if the drop is too far from any.
    function nearGhost(el) {
      const a = el.getBoundingClientRect();
      const ax = a.left + a.width / 2;
      const ay = a.top + a.height / 2;
      let best = null;
      let bd = 1e9;
      for (const g of unclaimed()) {
        const b = g.getBoundingClientRect();
        const d = Math.hypot(ax - (b.left + b.width / 2), ay - (b.top + b.height / 2));
        if (d < bd) {
          bd = d;
          best = g;
        }
      }
      return bd < Math.max(84, (best ? best.getBoundingClientRect().width : 0) * 1.5) ? best : null;
    }
    async function send(R, tile, g, fly) {
      g.dataset.claim = '1';
      B.misses = 0;
      B.ghosts.forEach((x) => x.classList.remove('glow'));
      if (fly) {
        tile.style.zIndex = 5;
        await flyTo(tile, g, { duration: 400 });
        if (!live(R)) return;
      }
      tile.remove();
      fillGhost(g);
    }
    function miss(R) {
      B.misses++;
      api.nudge(pick(['Drop it on a dashed square.', 'Put it in the dashed L.']));
      if (B.misses >= 2) unclaimed().forEach((g) => g.classList.add('glow'));
    }
    function makeTray(R, k) {
      const n = 2 * k - 1;
      const tiles = Array.from({ length: n }, () => {
        const t = h('button', { class: 'ttile', type: 'button', 'aria-label': 'tile, tap to place' });
        t.style.setProperty('--col', LAYER[k - 1]);
        drag(t, {
          onDrop: (_x, el, moved) => {
            if (!live(R) || B.lock) return false;
            const g = moved ? nearGhost(el) : nextGhost();
            if (!g) {
              if (moved) miss(R);
              return false;
            }
            bg(send(R, el, g, !moved));
            return true;
          },
        });
        t.addEventListener('keydown', (e) => {
          if ((e.key === 'Enter' || e.key === ' ') && live(R)) {
            e.preventDefault();
            const g = nextGhost();
            if (g) bg(send(R, t, g, true));
          }
        });
        return t;
      });
      B.zone.replaceChildren(h('div', { class: 'cap' }, `${n} tiles to place`), h('div', { class: 'tray' }, tiles));
      try {
        B.zone.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      } catch {
        /* ignore */
      }
      return tiles;
    }
    async function buildLayer(R, k, demo) {
      if (!(B.k === k && B.ghosts.length && B.placed === 0)) showGhosts(R, k, false);
      B.counting = false;
      B.ghosts.forEach((g) => {
        g.classList.remove('counted');
        g.textContent = '';
        delete g.dataset.cnt;
        if (g.tagName === 'BUTTON') g.removeAttribute('aria-label');
      });
      const tiles = makeTray(R, k);
      if (demo) {
        for (const t of tiles) {
          await wait(R, 160);
          await send(R, t, nextGhost(), true);
          await wait(R, 260);
        }
      }
      await until(R, B.full);
      B.zone.replaceChildren();
    }

    // ---- number chips ----
    function ask(R, { options, correct, hint, onStrong }) {
      return new Promise((resolve) => {
        let wrong = 0;
        const btns = new Map();
        const row = h('div', { class: 'act-row' });
        [...new Set(options)].forEach((v) => {
          const b = h(
            'button',
            {
              type: 'button',
              class: 'chip choice',
              'aria-label': `${v} tiles`,
              onclick: () => {
                if (!live(R) || B.lock || B.answered) return;
                sfx('tap');
                if (v === correct) {
                  B.answered = true;
                  b.classList.add('ok', 'hop');
                  btns.forEach((x) => {
                    x.disabled = true;
                    x.classList.remove('glow');
                  });
                  resolve();
                  return;
                }
                wrong++;
                b.classList.remove('shake');
                void b.offsetWidth;
                b.classList.add('shake', 'tried');
                api.nudge(hint(v));
                if (wrong >= 2) {
                  btns.get(correct).classList.add('glow');
                  onStrong?.();
                }
              },
            },
            String(v),
          );
          btns.set(v, b);
          row.append(b);
        });
        B.answered = false;
        B.chips = btns;
        B.zone.replaceChildren(h('div', { class: 'cap' }, 'Tap a number'), row);
      });
    }
    async function demoPick(R, correct) {
      await wait(R, 300);
      const b = B.chips.get(correct);
      b.classList.add('hop');
      await wait(R, 600);
      b.click();
    }
    const peekFor = (R, m) => {
      if (B.k !== m || !B.ghosts.some((g) => g.classList.contains('ghost'))) showGhosts(R, m, true);
    };
    const glowCorner = () => {
      const g = B.ghosts[B.ghosts.length - 1];
      if (g) g.classList.add('glow');
    };

    // ---- the five rounds ----
    async function round1(R, demo) {
      api.stage(0, TOTAL);
      newBoard(3, 80, 1);
      for (let k = 2; k <= 3; k++) {
        const p = api.prompt(
          k === 2 ? 'Add 3 tiles to make a 2 by 2 square.' : 'Now add 5 tiles. Make a 3 by 3 square!',
        );
        if (demo) await until(R, p);
        await buildLayer(R, k, demo);
        await until(R, api.cheer(`${pick(PRAISE)} A ${k} by ${k} square: ${k * k} tiles.`));
        await sweep(R, k);
      }
    }

    async function round2(R, demo) {
      api.stage(1, TOTAL);
      const start = pick([2, 3]);
      newBoard(start + 2, 66, start);
      for (let q = 0; q < 2; q++) {
        const k = start + q;
        const m = k + 1;
        const n = 2 * k + 1;
        showGhosts(R, m, true);
        const p = api.prompt('Count the dashed squares. How many tiles make the next L?');
        if (demo) {
          await until(R, p);
          await autoCount(R);
          await wait(R, 300);
        }
        const answered = ask(R, {
          options: shuffle([n, 2 * k, pick([2 * k + 2, 2 * k - 1])]),
          correct: n,
          hint: (v) => {
            if (v === 2 * k) {
              glowCorner();
              return 'So close! The corner needs a tile too.';
            }
            return 'Tap each dashed square and count them.';
          },
          onStrong: () => bg(autoCount(R, 1500)),
        });
        if (demo) await demoPick(R, n);
        await until(R, answered);
        B.ghosts.forEach((g) => g.classList.remove('glow'));
        B.zone.replaceChildren();
        B.counting = false;
        await autoFill(R);
        await until(R, api.cheer(`${pick(PRAISE)} ${n} tiles. Now there are ${m * m}.`));
        if (q === 1) await sweep(R, m);
        else await wait(R, 700);
      }
    }

    async function round3(R, demo) {
      api.stage(2, TOTAL);
      newBoard(5, 66, 2);
      const flip = rand(2);
      for (let k = 2; k <= 4; k++) {
        const m = k + 1;
        const n = 2 * k + 1;
        const total = (k + flip) % 2 === 0;
        const p = api.prompt(
          total ? `How many tiles will the ${m} by ${m} square have?` : 'How many tiles will the next L need?',
        );
        const peek = () => {
          peekFor(R, m);
          bg(autoCount(R, 1500));
        };
        const answered = ask(R, {
          options: shuffle(
            total ? [m * m, m * m - 1, pick([k * k + m, m * m + 2])] : [n, 2 * k, pick([2 * k + 2, 2 * k - 1])],
          ),
          correct: total ? m * m : n,
          hint: (v) => {
            if (v === m * m - 1 || v === 2 * k) return 'So close! Count the corner tile too.';
            return total ? `The old square has ${k * k}. Add the next L.` : 'Count down, across, and the corner.';
          },
          onStrong: peek,
        });
        if (demo) {
          await until(R, p);
          peekFor(R, m);
          await autoCount(R);
          await until(
            R,
            say(
              total
                ? `${k * k} tiles now. The L needs ${n}. ${k * k} plus ${n} makes ${m * m}.`
                : `${k} down, ${k} across, and one corner. That makes ${n}.`,
            ),
          );
          await wait(R, 500);
          await demoPick(R, total ? m * m : n);
        }
        await until(R, answered);
        api.cheer(pick(['Good thinking! Let us build it.', 'Yes! Now we build to check.']));
        await wait(R, 900);
        await buildLayer(R, m, demo);
        await until(R, api.cheer(total ? `${m * m} tiles! Your guess was right.` : `${n} tiles! ${m * m} in all.`));
        if (k === 4) await sweep(R, 5);
        else await wait(R, 800);
      }
    }
    // Round 4: the question is turned round. "We have 9, we want 16: how many more?"
    async function round4(R, demo) {
      api.stage(3, TOTAL);
      const s0 = pick([2, 3]);
      newBoard(5, 66, s0);
      for (let q = 0; q < 2; q++) {
        const k = s0 + q;
        const m = k + 1;
        const n = 2 * k + 1;
        showGhosts(R, m, true);
        const p = api.prompt(`We have ${k * k} tiles. We want ${m * m}. How many more?`);
        const answered = ask(R, {
          options: shuffle([n, 2 * k, pick([2 * k + 2, 2 * k - 1]), m * m]),
          correct: n,
          hint: (v) => {
            if (v === 2 * k) {
              glowCorner();
              return 'So close! The corner needs a tile too.';
            }
            if (v === m * m) return `${m * m} is the whole square. How many more?`;
            return 'Tap the dashed squares to count them.';
          },
          onStrong: () => bg(autoCount(R, 1500)),
        });
        if (demo) {
          await until(R, p);
          await autoCount(R);
          await until(R, say(`${m * m} take away ${k * k}. We need ${n} more.`));
          await wait(R, 400);
          await demoPick(R, n);
        }
        await until(R, answered);
        B.ghosts.forEach((g) => g.classList.remove('glow'));
        api.cheer(pick(['Good thinking! Let us build it.', 'Yes! Now we build to check.']));
        await wait(R, 900);
        await buildLayer(R, m, demo);
        await until(R, api.cheer(`${n} more tiles! Now ${m * m} in all.`));
        if (q === 1) await sweep(R, m);
        else await wait(R, 700);
      }
    }

    // Round 5: two L's at once (2 by 2 to 4 by 4), then the whole 5 by 5 without a picture.
    async function round5(R, demo) {
      api.stage(4, TOTAL);
      newBoard(5, 66, 2);
      const p = api.prompt('Make 4 by 4 from 2 by 2. How many tiles?');
      const a1 = ask(R, {
        options: shuffle([12, 16, 7, pick([10, 14])]),
        correct: 12,
        hint: (v) =>
          v === 16
            ? 'That is the whole square. How many to add?'
            : v === 7
              ? 'Two L shapes to add. The first has 5.'
              : 'The first L has 5. The next L has 7.',
        onStrong: () => {
          peekFor(R, 3);
          bg(autoCount(R, 1500));
        },
      });
      if (demo) {
        await until(R, p);
        peekFor(R, 3);
        await autoCount(R);
        await until(R, say('The first L has 5. The next L has 7. Together, 12.'));
        await wait(R, 400);
        await demoPick(R, 12);
      }
      await until(R, a1);
      api.cheer('Good thinking! Build the first L.');
      await wait(R, 900);
      await buildLayer(R, 3, demo);
      await until(R, api.cheer('5 tiles. Now build the next L.'));
      await buildLayer(R, 4, demo);
      await until(R, api.cheer(`${pick(PRAISE)} 12 tiles. Now 16 in all.`));
      await wait(R, 500);
      const p2 = api.prompt('How many tiles will a 5 by 5 square have?');
      const a2 = ask(R, {
        options: shuffle([25, 24, 20, pick([23, 26])]),
        correct: 25,
        hint: (v) => (v === 24 ? 'So close! Count the corner tile too.' : 'We have 16 now. Add the next L.'),
        onStrong: () => {
          peekFor(R, 5);
          bg(autoCount(R, 1500));
        },
      });
      if (demo) {
        await until(R, p2);
        peekFor(R, 5);
        await autoCount(R);
        await until(R, say('16 now. The next L needs 9. 16 plus 9 makes 25.'));
        await wait(R, 400);
        await demoPick(R, 25);
      }
      await until(R, a2);
      api.cheer('Yes! Now we build to check.');
      await wait(R, 900);
      await buildLayer(R, 5, demo);
      await until(R, api.cheer('25 tiles! Your guess was right.'));
      await sweep(R, 5);
    }
    const rounds = [round1, round2, round3, round4, round5];

    async function loop() {
      while (alive && roundIdx < rounds.length) {
        const R = newRun();
        try {
          await rounds[roundIdx](R, false);
        } catch (e) {
          if (e === CANCEL) return;
          throw e;
        }
        if (R.dead) return;
        roundIdx++;
      }
      if (alive) api.finish();
    }

    api.setDemo(async () => {
      const R = newRun();
      try {
        await rounds[Math.min(roundIdx, rounds.length - 1)](R, true);
      } catch (e) {
        if (e === CANCEL) return;
        throw e;
      }
      if (live(R)) bg(loop());
    });

    bg(loop());
    return {
      destroy() {
        alive = false;
        if (run) run.dead = true;
      },
    };
  },
};
