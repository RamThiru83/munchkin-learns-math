// Play-through: "Equal Towers & Bars" (equal-towers), all 5 rounds to the finish card, played like a child.
// Rounds 1-2: reads both towers' heights (blocks that are not taken off), then taps + on the shorter tower
// (round 1) or - on the taller tower (round 2) until they match, and taps the difference chip.
// Round 3: counts the pictures in both groups; taps one wrong chip first and expects a gentle nudge.
// Round 4: two steps; turns "Show objects" on, then answers the whole and the missing (blue) part.
// Round 5: two steps; answers the extra piece, then Mouse's amount.
// Relies on: .a-equal-towers .tw[data-who] .blk/.blk.gone, .pm button[aria-label], .chips .chip[data-n],
// .grp .item, .seg(.unk/.extra) .cell, .row[data-who=mouse] .mouse .cell, .objbtn, .next; shared .dots,
// .banner.try and .overlay. If the game's markup changes, update the selectors below. No test hooks are used.
import { test, expect } from '@playwright/test';
import { watchErrors, currentDot } from '../helpers.js';

const ID = 'equal-towers';

test(`playthrough: ${ID}`, async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'play-throughs run on desktop');
  test.setTimeout(300_000);
  const errors = watchErrors(page);
  await page.goto(`./#/play/${ID}`);

  const root = page.locator(`.a-${ID}`);
  const chip = (n) => root.locator(`.chips .chip[data-n="${n}"]`);
  const count = (sel) => root.locator(sel).count();
  const next = root.locator('.next');
  // Wait for the answer chips of a step, then tap the right one.
  async function answer(n) {
    await expect(chip(n)).toBeEnabled({ timeout: 30_000 });
    await chip(n).click();
  }

  for (let r = 0; r < 5; r++) {
    await expect.poll(() => currentDot(page), { timeout: 30_000 }).toBe(r);

    if (r < 2) {
      const tw = (who) => root.locator(`.tw[data-who=${who}]`);
      await expect(tw('bear').locator('.blk').first()).toBeVisible();
      const hs = {};
      for (const who of ['bear', 'bunny']) hs[who] = await tw(who).locator('.blk:not(.gone)').count();
      const [lo, hi] = hs.bear < hs.bunny ? ['bear', 'bunny'] : ['bunny', 'bear'];
      const d = hs[hi] - hs[lo];
      const name = { bear: 'Bear', bunny: 'Bunny' };
      const btn =
        r === 0
          ? root.getByRole('button', { name: `Add a block to ${name[lo]}'s tower` })
          : root.getByRole('button', { name: `Take a block off ${name[hi]}'s tower` });
      for (let k = 0; k < d; k++) await btn.click();
      await expect(tw(lo).locator('.blk:not(.gone)')).toHaveCount(hs[lo] + (r === 0 ? d : 0));
      await expect(tw(hi).locator('.blk:not(.gone)')).toHaveCount(hs[lo] + (r === 0 ? d : 0));
      await answer(d);
    } else if (r === 2) {
      await expect(root.locator('.grp')).toHaveCount(2);
      const total = await count('.grp .item');
      await expect(chip(total === 10 ? 9 : total + 1)).toBeVisible();
      await chip(total === 10 ? 9 : total + 1).click();
      await expect(page.locator('.banner.try')).toBeVisible();
      await answer(total);
    } else if (r === 3) {
      await root.locator('.objbtn').click();
      await expect(root).toHaveClass(/objs/);
      await expect(root.locator('.seg')).toHaveCount(2);
      await answer(await count('.seg .cell')); // whole
      await expect(root.locator('.seg.unk')).toHaveCount(1, { timeout: 30_000 });
      await answer(await count('.seg.unk .cell')); // missing blue part
    } else {
      await expect(root.locator('.seg.extra')).toHaveCount(1);
      await answer(await count('.seg.extra .cell')); // how many more
      await expect(root.locator('.mouse.unk')).toHaveCount(1, { timeout: 30_000 });
      await answer(await count('[data-who=mouse] .mouse .cell')); // Mouse's amount
    }

    await expect(next).toBeVisible({ timeout: 30_000 });
    await next.click();
  }

  await expect(page.locator('.overlay')).toBeVisible({ timeout: 30_000 });
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('nilaa:resume') || '{}'));
  expect(saved[ID]).toBeUndefined();
  expect(errors).toEqual([]);
});
