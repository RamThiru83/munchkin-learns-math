// Play-through: "Same or More?" (same-or-more), all 5 rounds to the finish card.
// Plays by real clicks: when a round has a move button (rounds 2, 4, 5) taps it, counts the
// berries (.it.berry) and baskets (.it.basket) in the DOM to pick the answer, and taps the
// matching .opt button (aria-labels "More berries" / "The same" / "More baskets").
// Round 3 first taps a deliberate wrong answer to exercise the pair-up hint, waiting for the
// pair button to read "Back". "Next" is the .actions .btn.primary shown after a right answer.
// Relies on: .a-same-or-more .field/.it/.actions/.choices/.opt, shared .dots and .overlay.
// If the game's markup changes, update the selectors below. No test hooks are used.
import { test, expect } from '@playwright/test';
import { watchErrors, currentDot } from '../helpers.js';

const ID = 'same-or-more';
const ARIA = { berries: 'More berries', same: 'The same', baskets: 'More baskets' };
const MOVE_ROUNDS = [1, 3, 4]; // zero-based rounds that start with a move button (round 1 auto-moves)

test(`playthrough: ${ID}`, async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'play-throughs run on desktop');
  test.setTimeout(300_000);
  const errors = watchErrors(page);
  await page.goto(`./#/play/${ID}`);

  const root = page.locator(`.a-${ID}`);
  const berries = root.locator('.it.berry');
  const baskets = root.locator('.it.basket');
  const choices = root.locator('.choices');
  const action = root.locator('.actions .btn');

  for (let r = 0; r < 5; r++) {
    await expect.poll(() => currentDot(page), { timeout: 30_000 }).toBe(r);
    await expect(berries.first()).toBeVisible({ timeout: 30_000 });
    // Round 1 moves by itself after an intro; the other move rounds need a tap.
    if (MOVE_ROUNDS.includes(r)) {
      await expect(action).toHaveCount(1);
      await action.click();
    }
    await expect(choices).toBeVisible({ timeout: 30_000 });
    await expect(action).toHaveText(/Pair them up/);

    const nB = await berries.count();
    const nK = await baskets.count();
    const right = nB === nK ? 'same' : nB > nK ? 'berries' : 'baskets';

    if (r === 2) {
      const wrong = right === 'same' ? 'berries' : 'same';
      await root.getByRole('button', { name: ARIA[wrong] }).click();
      await expect(action).toHaveText(/Back/, { timeout: 30_000 });
    }
    await root.getByRole('button', { name: ARIA[right] }).click();

    if (r < 4) {
      const next = root.locator('.actions .btn.primary');
      await expect(next).toHaveText(/Next/, { timeout: 30_000 });
      await next.click();
    }
  }

  await expect(page.locator('.overlay')).toBeVisible({ timeout: 30_000 });
  const resume = await page.evaluate(() => JSON.parse(localStorage.getItem('nilaa:resume') || '{}'));
  expect(resume[ID]).toBeUndefined();
  expect(errors).toEqual([]);
});
