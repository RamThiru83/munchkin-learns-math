// Play-through: dice-race, all 5 rounds, as a child would (real clicks, state read from the DOM).
// Round 1-2: pick the first animal lane, press "Roll ten times" until the Next button appears.
// Round 3: tap the six boxes "r and 7-r" in the dice table, then the "6" count chip.
// Round 4: read the target from `.goal .big`, build every white+pink pair via `[aria-label="white n"]`
//   / `[aria-label="pink n"]`, then "pick a team".
// Round 5: pick the two `.nb` numbers with the most ways (dots in `.dts`), "Race!", roll until "Finish".
// Relies on: `.a-dice-race .who`, `.btns:not([hidden]) .btn.primary`, `.gc`, `.count .chip`, `.goal .big`,
//   `.nb`, `.overlay`, `.dots .dot.now`, and the `nilaa:resume` localStorage key. No test hooks.
import { test, expect } from '@playwright/test';
import { watchErrors, currentDot } from '../helpers.js';

const ID = 'dice-race';

test(`playthrough: ${ID}`, async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'play-throughs run on desktop');
  test.setTimeout(240_000);
  const errors = watchErrors(page);
  const game = page.locator(`.a-${ID}`);

  await page.goto('./#/');
  await page.evaluate(() => localStorage.clear());
  await page.goto(`./#/play/${ID}`);
  await expect(game.locator('.who').first()).toBeVisible();
  expect(await currentDot(page)).toBe(0);

  // Rounds 1 and 2: pick an animal, roll until the race is over, go on.
  for (let r = 0; r < 2; r++) {
    await game.locator('.who').first().click();
    const next = game.locator('.btns:not([hidden]) .btn.primary', { hasText: 'Next' });
    await expect
      .poll(
        async () => {
          if (await next.isVisible()) return true;
          await game
            .getByRole('button', { name: 'Roll ten times' })
            .click({ timeout: 1000 })
            .catch(() => {});
          return next.isVisible();
        },
        { timeout: 90_000, intervals: [500] },
      )
      .toBe(true);
    await next.click();
    await expect.poll(() => currentDot(page)).toBe(r + 1);
  }

  // Round 3: all six boxes that make 7, then answer "6".
  await expect(game.locator('.gc').first()).toBeVisible();
  for (let r = 1; r <= 6; r++) {
    await game.locator(`.gc[aria-label="${r} and ${7 - r}"]`).click();
  }
  await game.locator('.count .chip', { hasText: /^6$/ }).click();
  await expect.poll(() => currentDot(page), { timeout: 20_000 }).toBe(3);

  // Round 4: build every ordered pair that makes the target.
  await expect(game.locator('.goal .big')).toBeVisible();
  const target = Number(await game.locator('.goal .big').textContent());
  for (let w = 1; w <= 6; w++) {
    const q = target - w;
    if (q < 1 || q > 6) continue;
    await game.locator(`[aria-label="white ${w}"]`).click();
    await game.locator(`[aria-label="pink ${q}"]`).click();
    await expect(game.locator('.slot.full')).toHaveCount(w - Math.max(1, target - 6) + 1);
  }
  await game.locator('.btn', { hasText: 'pick a team' }).click();
  await expect.poll(() => currentDot(page), { timeout: 20_000 }).toBe(4);

  // Round 5: pick the two numbers with the most ways, race, finish.
  await expect(game.locator('.nb').first()).toBeVisible();
  const nums = await game
    .locator('.nb')
    .evaluateAll((els) => els.map((e) => [e.getAttribute('aria-label'), e.querySelectorAll('.dts i').length]));
  nums.sort((a, b) => b[1] - a[1]);
  for (const [label] of nums.slice(0, 2)) await game.locator(`.nb[aria-label="${label}"]`).click();
  await game.locator('.btn', { hasText: 'Race!' }).click();
  await game.locator('.btn', { hasText: 'Finish' }).click({ timeout: 120_000 });

  await expect(page.locator('.overlay')).toBeVisible();
  const resume = await page.evaluate(() => JSON.parse(localStorage.getItem('nilaa:resume') || '{}'));
  expect(resume[ID]).toBeUndefined();
  expect(errors).toEqual([]);
});
