// Grown-ups' game lock (decision 0012): set a PIN, lock a game, the PIN opens it for this visit.
import { test, expect } from '@playwright/test';
import { watchErrors } from './helpers.js';

const typePin = async (page, pin) => {
  for (const d of pin) await page.locator('.lk-keys button', { hasText: new RegExp(`^${d}$`) }).click();
};

test('a grown-up locks a game; the PIN opens it', async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto('./#/grownups');
  await page.locator('.lock-open').click();
  await expect(page.locator('#lk-title')).toHaveText('Set a grown-up PIN');
  await typePin(page, '2580');
  await expect(page.locator('#lk-title')).toHaveText('Type it again');
  await typePin(page, '2580');
  await expect(page.locator('#lk-title')).toHaveText('Grown-ups: lock games');
  // lock Same or More? (game 1) and Seats for Everyone (game 2)
  await page.locator('.lk-list label', { hasText: 'Same or More?' }).click();
  await page.locator('.lk-list label', { hasText: 'Seats for Everyone' }).click();
  await expect(page.locator('.lk-count')).toHaveText('2 of 30 games locked');
  await page.locator('.lk-dlg .pill.primary', { hasText: 'Done' }).click();

  // home: padlocks, and Play next skips the locked games
  await page.goto('./#/');
  await expect(page.locator('a.tile.locked')).toHaveCount(2);
  await expect(page.locator('#play-h')).toHaveText('Number Path Race');

  // a typed address asks for the PIN too
  await page.goto('./#/play/same-or-more');
  await expect(page.locator('.lk-dlg')).toBeVisible();
  await expect(page).toHaveURL(/#\/$/);
  await page.locator('.lk-x').click();

  // tapping a locked tile asks for the PIN; a wrong PIN is refused, the right one opens the game
  await page.locator('a.tile.locked[href="#/play/same-or-more"]').click();
  await expect(page.locator('#lk-title')).toHaveText('Grown-ups only');
  await typePin(page, '1111');
  await expect(page.locator('.lk-msg')).toContainText('Not quite');
  await typePin(page, '2580');
  await expect(page).toHaveURL(/#\/play\/same-or-more$/);
  await expect(page.locator('h1.bar-title')).toHaveText('Same or More?');

  // the lock is remembered after a reload
  await page.goto('./#/');
  await page.reload();
  await expect(page.locator('a.tile.locked')).toHaveCount(2);

  // remove the PIN and all locks
  await page.locator('.foot button', { hasText: 'Lock games' }).click();
  await typePin(page, '2580');
  await page.locator('.lk-dlg .pill', { hasText: 'Remove PIN and all locks' }).click();
  await expect(page.locator('a.tile.locked')).toHaveCount(0);
  expect(errors).toEqual([]);
});
