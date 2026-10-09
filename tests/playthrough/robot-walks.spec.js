// Plays all 5 rounds of Robot Walks to the Wall like a child, up to the finish card: reads the round's
// solution, clears any pre-filled (buggy) program, taps the palette cards in order, presses Go.
// Relies on (see src/activities/robot-walks.js): root `.a-robot-walks` whose `data-sol` test hook holds the
// solution as comma-separated card types (fwd, left, right, loop); palette cards `.rw-pal [data-type=...]`;
// program strip `.rw-strip .rw-card`; buttons `.rw-go` (disabled while the robot runs) and
// `[aria-label="Clear all cards"]`; progress dots and `.overlay` finish card from the shared shell.
import { test, expect } from '@playwright/test';
import { watchErrors, currentDot } from '../helpers.js';

const ID = 'robot-walks';
const ROUNDS = 5;

test(`playthrough: ${ID}`, async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'play-throughs run on desktop');
  const errors = watchErrors(page);
  await page.goto(`./#/play/${ID}`);

  const game = page.locator(`.a-${ID}`);
  const strip = game.locator('.rw-strip .rw-card');
  const go = game.locator('.rw-go');

  for (let r = 0; r < ROUNDS; r++) {
    await expect.poll(() => currentDot(page), { timeout: 60_000 }).toBe(r);
    await expect(go).toBeEnabled({ timeout: 60_000 });
    const sol = ((await game.getAttribute('data-sol')) ?? '').split(',').filter(Boolean);
    expect(sol.length).toBeGreaterThan(0);

    // the bug-fixing round starts with a program on the strip: sweep it away first
    if ((await strip.count()) > 0) await game.getByRole('button', { name: 'Clear all cards' }).click();
    await expect(strip).toHaveCount(0);

    for (const [i, type] of sol.entries()) {
      await game.locator(`.rw-pal [data-type="${type}"]`).click();
      await expect(strip).toHaveCount(i + 1);
    }
    await go.click();

    if (r < ROUNDS - 1) await expect.poll(() => currentDot(page), { timeout: 90_000 }).toBe(r + 1);
  }

  await expect(page.locator('.overlay')).toBeVisible({ timeout: 90_000 });
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('nilaa:resume') || '{}'));
  expect(saved[ID]).toBeUndefined();
  expect(errors).toEqual([]);
});
