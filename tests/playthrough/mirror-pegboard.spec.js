// Plays all 5 rounds of Mirror Pegboard to the finish card with real clicks.
// Relies on: `.mp-board` SVG (aria-label contains "standing" for a vertical mirror), the coloured shape as the first
// `g > polygon` (points are 60-unit cells, peg centre = (index + 0.5) * 60), tap targets `.mp-hit[aria-label="Peg X across, Y down"]`
// (1-based), progress `.dots .dot.now`, and the `.overlay` finish card. The mirror is the middle (4th) column/row.
// The twin of a peg is its reflection across the mirror; pegs on the mirror stay put and need no tap.
import { test, expect } from '@playwright/test';
import { watchErrors, currentDot } from '../helpers.js';

const ID = 'mirror-pegboard';
const ROUNDS = 5;
const N = 7; // pegs per side
const M = 3; // mirror index

test(`playthrough: ${ID}`, async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'play-throughs run on desktop');
  const errors = watchErrors(page);
  await page.goto(`./#/play/${ID}`);

  for (let round = 0; round < ROUNDS; round++) {
    await expect.poll(() => currentDot(page)).toBe(round);
    const board = page.locator('.mp-board');
    await expect(board).toBeVisible();

    // Read the shape and mirror direction from the DOM.
    const { vertical, cells } = await board.evaluate((svg) => {
      const pts = svg
        .querySelector('g > polygon')
        .getAttribute('points')
        .trim()
        .split(/\s+/)
        .map((s) => s.split(',').map(Number));
      return {
        vertical: svg.getAttribute('aria-label').includes('standing'),
        cells: pts.map(([x, y]) => [Math.round(x / 60 - 0.5), Math.round(y / 60 - 0.5)]),
      };
    });
    expect(cells.length).toBeGreaterThanOrEqual(3);

    // Round 1: a child's first wrong tap (far corner, never a twin) must not advance the game.
    if (round === 0) {
      await page.locator('.mp-hit[aria-label="Peg 1 across, 1 down"]').click();
      await page.waitForTimeout(1200);
      expect(await currentDot(page)).toBe(0);
    }

    for (const [c, r] of cells) {
      if (vertical ? c === M : r === M) continue; // on the mirror: stays put
      const [tc, tr] = vertical ? [N - 1 - c, r] : [c, N - 1 - r];
      await page.locator(`.mp-hit[aria-label="Peg ${tc + 1} across, ${tr + 1} down"]`).click();
    }

    if (round < ROUNDS - 1) await expect.poll(() => currentDot(page), { timeout: 20_000 }).toBe(round + 1);
  }

  await expect(page.locator('.overlay')).toBeVisible({ timeout: 20_000 });
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('nilaa:resume') || '{}'));
  expect(saved[ID]).toBeUndefined();
  expect(errors).toEqual([]);
});
