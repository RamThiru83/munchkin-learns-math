// Play-through: "A Day in Order" (morning-order), all 5 rounds to the finish card.
// Plays like a child: real mouse drags of picture cards into numbered slots. The valid orders are
// not exposed, so each slot is filled by trying the tray cards one by one; a wrong drop glides back
// and the next card is tried. The DOM is re-read each time because the cards are random.
// Relies on: .mo-tray .mo-card (tray cards), .mo-cell (numbered slots, each holds a .mo-card once
// filled), .mo-actions .btn.primary (Next / Finish after the story), .overlay (finish card),
// localStorage 'nilaa:resume', and helpers currentDot / watchErrors.
import { test, expect } from '@playwright/test';
import { watchErrors, currentDot } from '../helpers.js';

const ID = 'morning-order';
const ROUNDS = 5;

/** Drag the centre of one element onto the centre of another with the real mouse. */
async function dragOnto(page, from, to) {
  await from.scrollIntoViewIfNeeded();
  const a = await from.boundingBox();
  const b = await to.boundingBox();
  await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
  await page.mouse.down();
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 8 });
  await page.mouse.up();
}

test(`playthrough: ${ID}`, async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'play-throughs run on desktop');
  const errors = watchErrors(page);
  await page.goto(`./#/play/${ID}`);
  await expect(page.locator('.mo-tray .mo-card').first()).toBeVisible();

  for (let round = 0; round < ROUNDS; round++) {
    await expect.poll(() => currentDot(page)).toBe(round);
    const slots = page.locator('.mo-cell');
    const n = await slots.count();

    for (let k = 0; k < n; k++) {
      const cell = slots.nth(k);
      let placed = false;
      const tries = await page.locator('.mo-tray .mo-card').count();
      for (let t = 0; t < tries && !placed; t++) {
        await dragOnto(page, page.locator('.mo-tray .mo-card').nth(t), cell);
        placed = (await cell.locator('.mo-card').count()) === 1;
        // a refused card glides back to the tray; let it settle before the next try
        if (!placed) await page.waitForTimeout(350);
      }
      expect(placed, `round ${round + 1}: a card fits slot ${k + 1}`).toBe(true);
    }

    await expect(page.locator('.mo-tray .mo-card')).toHaveCount(0);
    // the story plays (about a second per card), then Next / Finish appears
    const next = page.locator('.mo-actions .btn.primary');
    await expect(next).toBeVisible({ timeout: 30_000 });
    await next.click();
    if (round < ROUNDS - 1) await expect.poll(() => currentDot(page)).toBe(round + 1);
  }

  await expect(page.locator('.overlay')).toBeVisible();
  const resume = await page.evaluate(() => JSON.parse(localStorage.getItem('nilaa:resume') || '{}'));
  expect(resume[ID]).toBeUndefined();
  expect(errors).toEqual([]);
});
