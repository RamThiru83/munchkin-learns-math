// Play-through: Pour the Same (level 3) - all 5 rounds, like a child, to the finish card.
// Relies on markup in src/activities/pour-the-same.js (no test hooks exist):
//   .acts .btn          the pour / "Pour into the twins" / "Pour to check" / "Tip it" / "Next" button
//   .choices .opt       answer chips in rounds 1, 2, 4 (aria-labels; wrong tries are harmless)
//   .pics .pic          picture answers in rounds 3 and 5 (".good" marks the right one)
// Rounds 1, 2, 4, 5 are random, so we pour first (the game's own way to check), then try the
// answers until "Next" appears. Round 3 has two questions (bottle, cup), each with a Next button.
// Note the game ignores clicks while it animates, so each answer loop retries until it lands.
import { test, expect } from '@playwright/test';
import { watchErrors, currentDot } from '../helpers.js';

test('playthrough: pour-the-same', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'play-throughs run on desktop');
  test.setTimeout(240_000);
  const errors = watchErrors(page);
  await page.goto('./#/play/pour-the-same');
  await expect(page.locator('.a-pour-the-same')).toBeVisible();

  const next = page.locator('.acts .btn', { hasText: 'Next' });
  const goNext = async (r) => {
    await next.click();
    if (r < 4) await expect.poll(() => currentDot(page)).toBe(r + 1);
  };
  // Click the answers (chips or pictures) in turn until the game accepts one and shows Next.
  const answerUntilNext = async (sel) => {
    await expect(async () => {
      const n = await page.locator(sel).count();
      expect(n).toBeGreaterThan(0);
      for (let i = 0; i < n; i++) {
        await page.locator(sel).nth(i).click();
        if (
          await next.waitFor({ timeout: 2500 }).then(
            () => true,
            () => false,
          )
        )
          return;
      }
      throw new Error('no answer accepted yet');
    }).toPass({ timeout: 60_000 });
  };
  const pourFirst = async () => {
    const pour = page.locator('.acts .btn').first();
    await expect(pour).toBeVisible();
    await pour.click();
  };

  // Round 1: pour into the tall/wide glass, then answer.
  await expect.poll(() => currentDot(page)).toBe(0);
  await pourFirst();
  await expect(page.locator('.choices .opt')).toHaveCount(3);
  await answerUntilNext('.choices .opt');
  await goNext(0);

  // Round 2: tall vs wide glass, pour both into twins, then answer.
  await expect(page.locator('.choices .opt')).toHaveCount(3);
  await pourFirst();
  await answerUntilNext('.choices .opt');
  await goNext(1);

  // Round 3: two tilted containers, tap the picture with the flat water line.
  for (let q = 0; q < 2; q++) {
    await expect(page.locator('.pics .pic')).toHaveCount(3);
    await expect(page.locator('.pics .pic.good')).toHaveCount(0);
    await answerUntilNext('.pics .pic');
    if (q === 0) await next.click();
    else await goNext(2);
  }

  // Round 4: same / lower line in tall and wide glass, pour into twins, answer.
  await expect(page.locator('.choices .opt')).toHaveCount(3);
  await pourFirst();
  await answerUntilNext('.choices .opt');
  await goNext(3);

  // Round 5: two glasses into one tall thin glass, pick the picture of the height.
  await expect(page.locator('.pics .pic')).toHaveCount(3);
  await pourFirst();
  await answerUntilNext('.pics .pic');
  await next.click();

  await expect(page.locator('.overlay')).toBeVisible();
  const resume = await page.evaluate(() => JSON.parse(localStorage.getItem('nilaa:resume') || '{}'));
  expect(resume['pour-the-same']).toBeUndefined();
  expect(errors).toEqual([]);
});
