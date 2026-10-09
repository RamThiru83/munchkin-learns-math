// Saved data from older versions must keep working after updates (docs/decisions/0004-saved-progress.md).
import { test, expect } from '@playwright/test';

test('v1 saved data (no schema key) is kept and upgraded', async ({ page }) => {
  await page.goto('./#/');
  await page.evaluate(() => {
    localStorage.clear();
    localStorage.setItem('nilaa:progress', JSON.stringify({ 'same-or-more': 3, 'odd-one-out': 3 }));
    localStorage.setItem('nilaa:resume', JSON.stringify({ 'dice-race': { r: 3, n: 5 } }));
  });
  await page.reload();
  await expect(page.locator('.count')).toContainText('6 stars · 2 of');
  await expect(page.locator('a[href="#/play/same-or-more"]')).toHaveClass(/done/);
  await expect(page.locator('a[href="#/play/dice-race"] .resume-tag')).toHaveText('▶ Round 4 of 5');
  const schema = await page.evaluate(() => localStorage.getItem('nilaa:schema'));
  expect(Number(schema)).toBeGreaterThanOrEqual(2);
});

test('finishing a game awards stars and clears its saved round', async ({ page }) => {
  await page.goto('./#/');
  await page.evaluate(() => {
    localStorage.clear();
    localStorage.setItem('nilaa:resume', JSON.stringify({ 'which-room-larger': { r: 4, n: 5 } }));
  });
  await page.goto('./?f=1#/play/which-room-larger');
  await page.reload();
  await page.click('[data-resume=continue]');
  await page.locator('button.watch').click();
  await expect(page.locator('.stage.demo-running')).toHaveCount(0, { timeout: 120_000 });
  // Try each answer button in turn (a wrong one only gives a gentle hint) until the finish card appears.
  const answered = await page.evaluate(async () => {
    for (const b of document.querySelectorAll('.stage button')) {
      b.click();
      await new Promise((r) => setTimeout(r, 1500));
      if (document.querySelector('.overlay')) return true;
    }
    return !!document.querySelector('.overlay');
  });
  expect(answered).toBe(true);
  const data = await page.evaluate(() => ({
    progress: JSON.parse(localStorage.getItem('nilaa:progress')),
    resume: JSON.parse(localStorage.getItem('nilaa:resume')),
  }));
  expect(data.progress['which-room-larger']).toBe(3);
  expect(data.resume['which-room-larger']).toBeUndefined();
});
