// Every game loads, its Watch demo runs to the end, and nothing errors or scrolls sideways.
import { test, expect } from '@playwright/test';
import { ACTIVITIES, watchErrors, runDemo, expectNoHorizontalScroll } from './helpers.js';

for (const { id } of ACTIVITIES) {
  test(`smoke: ${id}`, async ({ page }, info) => {
    const errors = watchErrors(page);
    await page.goto(`./#/play/${id}`);
    await expect(page.locator('.dots .dot').first()).toBeVisible();
    await runDemo(page);
    await expectNoHorizontalScroll(page);
    await page.screenshot({ path: info.outputPath(`${id}.png`) });
    expect(errors).toEqual([]);
  });
}

test('home and grown-ups pages render', async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto('./#/');
  await expect(page.locator('.tile')).toHaveCount(ACTIVITIES.length);
  await page.goto('./#/grownups');
  await expect(page.locator('.agecard')).toHaveCount(5);
  await expect(page.locator('.note')).toHaveCount(ACTIVITIES.length);
  await expect(page.locator('.refs li').first()).toBeVisible();
  await expectNoHorizontalScroll(page);
  expect(errors).toEqual([]);
});
