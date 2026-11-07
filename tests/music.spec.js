// Rhyme time and the Music switch (decision 0010). The other tests skip rhymes (nilaa:fasttests); these turn them on.
import { test, expect } from '@playwright/test';
import { watchErrors } from './helpers.js';

test('a game opens with its rhyme, words light up, and Let’s play starts round 1', async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto('./#/');
  await page.evaluate(() => localStorage.removeItem('nilaa:fasttests'));
  await page.reload();
  await page.locator('a.tile[href="#/play/hidden-beads"]').click();
  const song = page.locator('.rhyme-wrap .song');
  await expect(song).toBeVisible();
  await expect(song.locator('.lyrics li')).toHaveCount(4);
  await expect(song.locator('.lyrics li').first()).toContainText('Beads on a string');
  await expect(song.locator('.w.lit').first()).toBeVisible({ timeout: 15_000 });
  await page.locator('.go-play').click();
  await expect(page.locator('.rhyme-wrap')).toHaveCount(0);
  await expect(page.locator('.dots .dot').first()).toBeVisible({ timeout: 15_000 });
  expect(errors).toEqual([]);
});

test('the rhyme starts the game by itself when it ends', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'one size is enough');
  await page.goto('./#/');
  await page.evaluate(() => {
    localStorage.removeItem('nilaa:fasttests');
    localStorage.setItem('nilaa:music', 'false'); // no band: lines follow each other at once
  });
  await page.reload();
  await page.locator('a.tile[href="#/play/same-or-more"]').click();
  await expect(page.locator('.rhyme-wrap')).toBeVisible();
  await expect(page.locator('.rhyme-wrap')).toHaveCount(0, { timeout: 30_000 });
  await expect(page.locator('.dots .dot').first()).toBeVisible({ timeout: 15_000 });
});

test('the Music switch is remembered', async ({ page }) => {
  await page.goto('./#/');
  const sw = page.locator('.top-tools button', { hasText: 'Music' });
  await expect(sw).toHaveAttribute('aria-pressed', 'true');
  await sw.click();
  await expect(sw).toHaveAttribute('aria-pressed', 'false');
  expect(await page.evaluate(() => localStorage.getItem('nilaa:music'))).toBe('false');
  await page.reload();
  await expect(page.locator('.top-tools button', { hasText: 'Music' })).toHaveAttribute('aria-pressed', 'false');
});
