// The recorded (Chirp 3 HD) voice: packs load and a game's first line plays from the recording.
import { test, expect } from '@playwright/test';
import { watchErrors } from './helpers.js';

test('recorded voice plays a game line', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'one size is enough');
  const errors = watchErrors(page);
  await page.goto('./#/');
  await page.evaluate(() => localStorage.setItem('nilaa:voice', 'true'));
  await page.reload();
  await page.locator('a.tile[href="#/play/hidden-beads"]').click();
  await expect(page.locator('html')).toHaveAttribute('data-voice', 'recorded', { timeout: 15_000 });
  // "Hear it again" replays the banner from the recording too.
  await page.evaluate(() => delete document.documentElement.dataset.voice);
  await page.getByRole('button', { name: 'Hear it again' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-voice', 'recorded', { timeout: 15_000 });
  expect(errors).toEqual([]);
});
