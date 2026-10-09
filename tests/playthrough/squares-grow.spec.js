// Play-through: squares-grow (Squares That Grow), all 5 rounds as a child would: real drags and taps, state read from the DOM.
// Tray tiles `.a-squares-grow .ttile` are dragged onto the first dashed cell `.ghost:not([data-claim])` (each drop fills the cell).
// Questions show `.chip.choice` buttons (aria-label "<n> tiles"). The right number is worked out from the banner text
//   (`.banner > span`): "next L" -> 2k+1 (k from the number of `.board .sq`), "We have X ... We want Y" -> Y-X,
//   "the m by m square" -> m*m, "Make 4 by 4 from 2 by 2" -> 12, "5 by 5" -> 25.
// When the dashed cells are tap-to-count buttons (`button.ghost`) they are tapped first, and their count must match the answer.
// Relies on: `.dots .dot.now`, `.overlay`, the `nilaa:resume` localStorage key. No test hooks; question order is random per play,
//   so the loop reads the DOM each time. If the prompt wording in squares-grow.js changes, update `answerFor`.
import { test, expect } from '@playwright/test';
import { watchErrors, currentDot } from '../helpers.js';

const ID = 'squares-grow';

test(`playthrough: ${ID}`, async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'play-throughs run on desktop');
  test.setTimeout(300_000);
  const errors = watchErrors(page);
  const game = page.locator(`.a-${ID}`);
  const tiles = game.locator('.ttile');
  const openChips = game.locator('.chip.choice:not([disabled])');

  await page.goto('./#/');
  await page.evaluate(() => localStorage.clear());
  await page.goto(`./#/play/${ID}`);
  await expect(game).toBeVisible();
  expect(await currentDot(page)).toBe(0);

  // The number a child works out from the question on the banner.
  async function answerFor() {
    const text = await page.locator('.banner > span').innerText();
    const side = Math.round(Math.sqrt(await game.locator('.board .sq').count()));
    let m;
    if ((m = text.match(/We have (\d+) tiles\. We want (\d+)/))) return +m[2] - +m[1];
    if ((m = text.match(/will the (\d+) by \d+ square have/))) return m[1] * m[1];
    if (/Make 4 by 4 from 2 by 2/.test(text)) return 12;
    if (/5 by 5 square/.test(text)) return 25;
    if (/next L/.test(text)) return 2 * side + 1;
    throw new Error(`unrecognised question: ${text}`);
  }

  // Drag the first tray tile onto the first free dashed cell. The page may still be scrolling smoothly when the tray
  // appears, so wait for both boxes to hold still and retry if the tile glided back.
  async function dragTileToGhost() {
    const before = await tiles.count();
    const free = game.locator('.ghost:not([data-claim])').first();
    for (let attempt = 0; attempt < 4; attempt++) {
      let from = await tiles.first().boundingBox();
      let to = await free.boundingBox();
      for (let i = 0; i < 20; i++) {
        await page.waitForTimeout(100);
        const f2 = await tiles.first().boundingBox();
        const t2 = await free.boundingBox();
        const still = Math.abs(f2.y - from.y) < 4 && Math.abs(t2.y - to.y) < 4;
        from = f2;
        to = t2;
        if (still) break;
      }
      await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
      await page.mouse.down();
      await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 8 });
      await page.mouse.up();
      try {
        await expect(tiles).toHaveCount(before - 1, { timeout: 3000 });
        return;
      } catch (e) {
        if (attempt === 3) throw e;
      }
    }
  }

  const seen = [0];
  const deadline = Date.now() + 200_000;
  while (!(await page.locator('.overlay').isVisible())) {
    expect(Date.now(), 'play-through ran out of time').toBeLessThan(deadline);
    const dot = await currentDot(page);
    if (dot !== seen.at(-1)) seen.push(dot);

    if (await tiles.count()) {
      await dragTileToGhost();
    } else if (await openChips.count()) {
      const answer = await answerFor();
      const counters = game.locator('button.ghost');
      const n = await counters.count();
      for (let i = 0; i < n; i++) await counters.nth(i).click({ force: true, timeout: 5000 });
      if (n && !/by \d+ square/.test(await page.locator('.banner > span').innerText())) expect(n).toBe(answer);
      const chip = game.locator(`.chip.choice[aria-label="${answer} tiles"]`);
      await chip.click();
      await expect(openChips).toHaveCount(0);
    } else {
      await page.waitForTimeout(250);
    }
  }

  expect(seen).toEqual([0, 1, 2, 3, 4]);
  await expect(page.locator('.overlay')).toBeVisible();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('nilaa:resume') || '{}'))).not.toHaveProperty(ID);
  expect(errors).toEqual([]);
});
