// Play-through: "Which Room Is Larger?" (which-room-larger), all 5 rounds to the finish card.
// Round 1 is played like a child: taps every floor square of both rooms and checks the count badges.
// Every round reads the squares (.rm .cl) in the DOM to find the larger room (or "same"), then taps
// that room's "This one is larger" button (aria-label "The <colour> room is larger") or
// "They are the same". Round 3 (equal rooms) also taps "Slide the piece" after the right answer.
// "Next" is the .actions .btn.primary shown after a right answer.
// Relies on: .a-which-room-larger .rm/.cl/.bd b/.actions, shared .dots and .overlay.
// If the game's markup changes, update the selectors below. No test hooks are used.
import { test, expect } from '@playwright/test';
import { watchErrors, currentDot } from '../helpers.js';

const ID = 'which-room-larger';
const ROOM_NAMES = ['blue', 'pink'];

test(`playthrough: ${ID}`, async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'play-throughs run on desktop');
  test.setTimeout(300_000);
  const errors = watchErrors(page);
  await page.goto(`./#/play/${ID}`);

  const root = page.locator(`.a-${ID}`);
  const rooms = root.locator('.rm');
  const next = root.locator('.actions .btn.primary');

  for (let r = 0; r < 5; r++) {
    await expect.poll(() => currentDot(page), { timeout: 30_000 }).toBe(r);
    await expect(rooms).toHaveCount(2, { timeout: 30_000 });
    await expect(rooms.nth(1).locator('.cl').first()).toBeVisible();
    const counts = [await rooms.nth(0).locator('.cl').count(), await rooms.nth(1).locator('.cl').count()];

    if (r === 0) {
      // Count by tapping each square, as the child would.
      for (let i = 0; i < 2; i++) {
        const cells = rooms.nth(i).locator('.cl');
        for (let c = 0; c < counts[i]; c++) await cells.nth(c).click();
        await expect(rooms.nth(i).locator('.bd b')).toHaveText(String(counts[i]));
      }
    }

    if (counts[0] === counts[1]) {
      await root.getByRole('button', { name: 'They are the same' }).click();
    } else {
      const bigger = counts[0] > counts[1] ? 0 : 1;
      await root.getByRole('button', { name: `The ${ROOM_NAMES[bigger]} room is larger` }).click();
    }

    await expect(next).toBeVisible({ timeout: 30_000 });
    if (r === 2) {
      const slide = root.getByRole('button', { name: 'Slide the piece' });
      if (await slide.isVisible()) await slide.click();
    }
    await next.click();
  }

  await expect(page.locator('.overlay')).toBeVisible({ timeout: 30_000 });
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('nilaa:resume') || '{}'));
  expect(saved[ID]).toBeUndefined();
  expect(errors).toEqual([]);
});
