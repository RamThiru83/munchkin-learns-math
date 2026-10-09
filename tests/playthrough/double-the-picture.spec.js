// Plays all 5 rounds of Make It Twice as Big to the finish card with real mouse clicks on the big grid.
// Relies on: model SVG `.dp-box.model svg` whose second child group holds the model's <line>s (x1,y1 -> x2,y2 in
// 40-unit cells), the child's grid `svg.dp-big` (40-unit cells, 18-unit padding, viewBox = cells*40 + 36), progress
// `.dots .dot.now`, and the `.overlay` finish card. The scale k is read from the ratio of the two grid sizes; every
// corner of the model path is multiplied by k and tapped in drawing order (the reference path starts at the first line).
import { test, expect } from '@playwright/test';
import { watchErrors, currentDot } from '../helpers.js';

const ID = 'double-the-picture';
const ROUNDS = 5;
const U = 40; // viewBox units per grid cell
const P = 18; // viewBox padding around a grid

test(`playthrough: ${ID}`, async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'play-throughs run on desktop');
  const errors = watchErrors(page);
  await page.goto(`./#/play/${ID}`);

  for (let round = 0; round < ROUNDS; round++) {
    await expect.poll(() => currentDot(page), { timeout: 20_000 }).toBe(round);
    await expect(page.locator('.dp-big')).toBeVisible();
    await page.waitForTimeout(500); // round-intro animation

    // Read the model's corner points (in cells) and the scale factor from the DOM.
    const { pts } = await page.evaluate(
      ([U]) => {
        const ms = document.querySelector('.dp-box.model svg');
        const bs = document.querySelector('.dp-big');
        const lines = [...ms.querySelectorAll('g > g:nth-child(2) line')].map((l) => [
          +l.getAttribute('x1'),
          +l.getAttribute('y1'),
          +l.getAttribute('x2'),
          +l.getAttribute('y2'),
        ]);
        const k = (bs.viewBox.baseVal.width - 36) / (ms.viewBox.baseVal.width - 36);
        const cells = [[lines[0][0], lines[0][1]], ...lines.map((l) => [l[2], l[3]])];
        return { pts: cells.map(([x, y]) => [(x / U) * k, (y / U) * k]) };
      },
      [U],
    );
    expect(pts.length).toBeGreaterThanOrEqual(3);

    for (const [x, y] of pts) {
      const b = await page.evaluate(() => {
        const svg = document.querySelector('.dp-big');
        const r = svg.getBoundingClientRect();
        return {
          l: r.left,
          t: r.top,
          w: r.width,
          h: r.height,
          W: svg.viewBox.baseVal.width,
          H: svg.viewBox.baseVal.height,
        };
      });
      await page.mouse.click(b.l + ((x * U + P) / b.W) * b.w, b.t + ((y * U + P) / b.H) * b.h);
      await page.waitForTimeout(150);
    }

    if (round < ROUNDS - 1) await expect.poll(() => currentDot(page), { timeout: 20_000 }).toBe(round + 1);
  }

  await expect(page.locator('.overlay')).toBeVisible({ timeout: 20_000 });
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('nilaa:resume') || '{}'));
  expect(saved[ID]).toBeUndefined();
  expect(errors).toEqual([]);
});
