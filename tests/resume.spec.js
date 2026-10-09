// Saved progress: a game left on round r opens with a welcome-back card, "Carry on" starts on round r,
// Watch on that round does not jump back, and "Start from round 1" really restarts.
import { test, expect } from '@playwright/test';
import { ACTIVITIES, watchErrors, currentDot, runDemo, openWithSavedRound } from './helpers.js';

const games = await Promise.all(
  ACTIVITIES.map(async ({ id }) => {
    const mod = await import(`../src/activities/${id}.js`);
    return { id, rounds: mod.default.rounds || 5 };
  }),
);

for (const { id, rounds } of games) {
  test(`resume: ${id}`, async ({ page }) => {
    const errors = watchErrors(page);
    for (let r = 1; r < rounds; r++) {
      await openWithSavedRound(page, id, r, rounds);
      await page.click('[data-resume=continue]');
      await expect.poll(() => currentDot(page)).toBe(r);
      const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('nilaa:resume') || '{}'));
      expect(saved[id]?.r).toBe(r);
      if (r === rounds - 1) {
        await runDemo(page);
        const done = await page.locator('.overlay').count();
        if (!done) expect(await currentDot(page)).toBeGreaterThanOrEqual(r);
      }
    }
    await openWithSavedRound(page, id, 3, rounds);
    await page.click('[data-resume=restart]');
    await expect.poll(() => currentDot(page)).toBe(0);
    expect(errors).toEqual([]);
  });
}

test('home tile shows the saved round and Again keeps it', async ({ page }) => {
  await openWithSavedRound(page, 'dice-race', 2, 5);
  await page.goto('./#/');
  await expect(page.locator('a[href="#/play/dice-race"] .resume-tag')).toHaveText('▶ Round 3 of 5');
  await page.click('a[href="#/play/dice-race"]');
  await page.click('[data-resume=continue]');
  await expect.poll(() => currentDot(page)).toBe(2);
  await page.click('button[title="Start this round again"]');
  await expect.poll(() => currentDot(page)).toBe(2);
});
