// Play-through: Shoes in the Dark (all 5 rounds, to the finish card).
// Plays like a child: taps the dark sack to grab until the "Be SURE" button appears, taps it, then taps the chip
// with the right number of grabs. The right number is read from the DOM: the shelf has exactly one numbered slot
// per grab you need to be sure (R.sure), so the answer is the slot count.
// Relies on the markup of src/activities/shoes-in-dark.js (update here if it changes):
//   .a-shoes-in-dark .scene (the sack; not .off while playable), .slot (shelf slots), .ctl (control row),
//   button[aria-label="How many grabs to be sure of a pair?"] ("Be SURE"), .chip[aria-label="<n> grabs"] (answers),
//   .overlay (finish card). No test hooks are used.
import { test, expect } from '@playwright/test';
import { watchErrors, currentDot } from '../helpers.js';

const ID = 'shoes-in-dark';
const ROUNDS = 5;

test(`playthrough: ${ID}`, async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'play-throughs run on desktop');
  test.setTimeout(360_000); // ~2 min of game animation per run
  const errors = watchErrors(page);

  await page.goto(`./#/play/${ID}`);

  const slots = page.locator('.a-shoes-in-dark .slot');
  const scene = page.locator('.a-shoes-in-dark .scene:not(.off)');
  const beSure = page.locator('.ctl button[aria-label="How many grabs to be sure of a pair?"]');

  for (let r = 0; r < ROUNDS; r++) {
    await expect.poll(() => currentDot(page)).toBe(r);
    await expect(scene).toBeVisible();
    const sure = await slots.count();
    expect(sure).toBeGreaterThan(2);

    // Grab from the sack (as a child would) until the "Be SURE" button is offered.
    await expect(async () => {
      if (!(await beSure.isVisible())) await scene.click({ force: true });
      await expect(beSure).toBeVisible({ timeout: 2500 });
    }).toPass({ timeout: 60_000 });
    await beSure.click();

    const chip = page.locator(`.chip[aria-label="${sure} grabs"]`);
    await expect(chip).toBeVisible();
    await chip.click();

    if (r < ROUNDS - 1) await expect.poll(() => currentDot(page), { timeout: 40_000 }).toBe(r + 1);
  }

  await expect(page.locator('.overlay')).toBeVisible({ timeout: 40_000 });
  expect(await page.evaluate((id) => JSON.parse(localStorage.getItem('nilaa:resume') || '{}')[id], ID)).toBeUndefined();
  expect(errors).toEqual([]);
});
