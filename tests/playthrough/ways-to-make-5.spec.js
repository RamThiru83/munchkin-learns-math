// Plays all 5 rounds of Ways to Make Five like a child: taps coins in the coin box (one coin is dragged into the
// slot with the mouse), finding every way of paying the gate, biggest coin first, up to the finish card.
// Relies on (see src/activities/ways-to-make-5.js): coin box `.a-ways-to-make-5 .binrow .coin[data-v=N]`
// (click = tap, drag onto `.gatezone`), coins in the slot `.tray .placed .coin`, found-way cards `.cards [data-key]`
// (shelf is cleared at the start of each round). The ways per round are fixed (partitions of 4, 5, 5, 6, 6), so
// they are listed below; a way is complete when the slot empties and its card appears.
import { test, expect } from '@playwright/test';
import { watchErrors, currentDot } from '../helpers.js';

const ID = 'ways-to-make-5';
const G = `.a-${ID}`;
// ways to pay per round, biggest coin first
const PLANS = [
  [
    [2, 2],
    [2, 1, 1],
    [1, 1, 1, 1],
  ],
  [
    [2, 2, 1],
    [2, 1, 1, 1],
    [1, 1, 1, 1, 1],
  ],
  [
    [3, 2],
    [3, 1, 1],
    [2, 2, 1],
    [2, 1, 1, 1],
    [1, 1, 1, 1, 1],
  ],
  [
    [3, 2, 1],
    [2, 2, 2],
  ],
  [
    [3, 3],
    [3, 2, 1],
    [3, 1, 1, 1],
    [2, 2, 2],
    [2, 2, 1, 1],
    [2, 1, 1, 1, 1],
    [1, 1, 1, 1, 1, 1],
  ],
];

test('playthrough: ways-to-make-5', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'play-throughs run on desktop');
  test.setTimeout(240_000);
  const errors = watchErrors(page);
  await page.goto(`./#/play/${ID}`);
  const coin = (v) => page.locator(`${G} .binrow .coin[data-v="${v}"]`);
  const placed = page.locator(`${G} .tray .placed .coin`);
  const cards = page.locator(`${G} .cards [data-key]`);
  await expect(coin(1)).toBeVisible();

  for (let r = 0; r < PLANS.length; r++) {
    expect(await currentDot(page)).toBe(r);
    // wait for this round's (empty) shelf
    await expect(cards).toHaveCount(0);
    for (let i = 0; i < PLANS[r].length; i++) {
      const way = PLANS[r][i];
      for (let c = 0; c < way.length; c++) {
        if (r === 0 && i === 0 && c === 0) {
          // one real drag from the coin box into the slot
          const from = await coin(way[c]).boundingBox();
          const to = await page.locator(`${G} .tray`).boundingBox();
          await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
          await page.mouse.down();
          await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 12 });
          await page.mouse.up();
        } else {
          await coin(way[c]).click();
        }
        // the last coin empties the slot after the gate opens, so only check growth before that
        if (c < way.length - 1) await expect(placed).toHaveCount(c + 1);
      }
      // the way is counted: its card joins the shelf and the slot is emptied
      if (i < PLANS[r].length - 1 || r < PLANS.length - 1) {
        await expect(cards).toHaveCount(i + 1, { timeout: 15_000 });
      }
      if (!(r === PLANS.length - 1 && i === PLANS[r].length - 1)) {
        await expect(placed).toHaveCount(0, { timeout: 15_000 });
      }
    }
    if (r < PLANS.length - 1) {
      await expect.poll(() => currentDot(page), { timeout: 20_000 }).toBe(r + 1);
    }
  }

  await expect(page.locator('.overlay')).toBeVisible({ timeout: 20_000 });
  const saved = await page.evaluate((id) => JSON.parse(localStorage.getItem('nilaa:resume') || '{}')[id], ID);
  expect(saved).toBeUndefined();
  expect(errors).toEqual([]);
});
