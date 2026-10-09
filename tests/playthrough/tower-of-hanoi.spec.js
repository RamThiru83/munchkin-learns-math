// Plays all 5 rounds of Tower of Hanoi (pancakes) like a child: taps the peg holding the pancake to lift, then taps
// the target peg, repeating until the stack sits on the star plate, up to the finish card.
// Relies on (see src/activities/tower-of-hanoi.js): `.board` with three equal-width columns (pegs 0..2 left to right);
// pancakes `.board .disc` in DOM order smallest first (peg read from the horizontal centre of each); the star plate is
// the `.base.goal` (its index = goal peg); the `.moves` text starts "moves: N" (counts completed moves).
// The moves are planned here with the classic recursive solver (same idea as the game's exported planMoves), because
// start positions and goal pegs are random each play; the DOM is re-read before every move.
import { test, expect } from '@playwright/test';
import { watchErrors, currentDot } from '../helpers.js';

const ID = 'tower-of-hanoi';
const ROUNDS = 5;

// fewest-moves plan from any legal position; pos[s] = peg of pancake s (0 = smallest)
function plan(posIn, target) {
  const pos = posIn.slice();
  const out = [];
  const go = (k, t) => {
    if (k < 0) return;
    if (pos[k] === t) return go(k - 1, t);
    const other = 3 - pos[k] - t;
    go(k - 1, other);
    out.push([pos[k], t]);
    pos[k] = t;
    go(k - 1, t);
  };
  go(pos.length - 1, target);
  return out;
}

// board box, peg of every pancake and the goal peg, read from the DOM
const readState = (page) =>
  page.evaluate(() => {
    const bd = document.querySelector('.board').getBoundingClientRect();
    const pos = [...document.querySelectorAll('.board .disc')].map((d) => {
      const r = d.getBoundingClientRect();
      return Math.min(2, Math.max(0, Math.floor(((r.left + r.width / 2 - bd.left) / bd.width) * 3)));
    });
    const goal = [...document.querySelectorAll('.board .base')].findIndex((b) => b.classList.contains('goal'));
    return { box: { x: bd.left, y: bd.top, w: bd.width, h: bd.height }, pos, goal };
  });

const movesCount = async (page) => {
  const m = /moves: (\d+)/.exec((await page.locator('.moves').textContent()) || '');
  return m ? Number(m[1]) : -1;
};

test(`playthrough: ${ID}`, async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'play-throughs run on desktop');
  const errors = watchErrors(page);
  await page.goto(`./#/play/${ID}`);
  await expect(page.locator('.board')).toBeVisible();

  for (let round = 0; round < ROUNDS; round++) {
    expect(await currentDot(page)).toBe(round);
    await expect(page.locator('.board .disc')).toHaveCount([2, 3, 4, 3, 4][round]);

    for (let guard = 0; guard < 40; guard++) {
      const st = await readState(page);
      if (st.pos.every((p) => p === st.goal)) break;
      const [from, to] = plan(st.pos, st.goal)[0];
      const before = await movesCount(page);
      const x = (peg) => st.box.x + (st.box.w * (peg + 0.5)) / 3;
      const y = st.box.y + st.box.h - 40;
      await page.mouse.click(x(from), y);
      await page.mouse.click(x(to), y);
      await expect.poll(() => movesCount(page), { timeout: 10_000 }).toBe(before + 1);
    }

    await expect(page.locator('.moves')).toContainText('best possible');
    if (round < ROUNDS - 1) await expect.poll(() => currentDot(page), { timeout: 15_000 }).toBe(round + 1);
  }

  await expect(page.locator('.overlay')).toBeVisible({ timeout: 15_000 });
  const resume = await page.evaluate(() => JSON.parse(localStorage.getItem('nilaa:resume') || '{}'));
  expect(resume[ID]).toBeUndefined();
  expect(errors).toEqual([]);
});
