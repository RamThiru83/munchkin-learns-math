// Play-through: "Hidden Beads" (hidden-beads), all 5 rounds to the finish card, played like a child.
// Every round: tap each bead to count the whole (the bond's whole circle then shows it).
// Rounds 1-4: read the "showing" part from the number bond, tap the chip for whole - showing (round 1 first
// taps a wrong chip to see the gentle nudge). Round 5: read the target from the bond's "hiding" part, drag one
// bead onto the cup with the mouse and tap the rest under, tap Done; then make two new splits not yet in the
// ways list, tap Done and answer how many are hiding.
// Relies on: .a-hidden-beads .bond [data-part=whole|show|hide], .row .bead (.under when hidden), .cup,
// .chips .chip[data-n], .tools .done, .ways .way[data-split="S+K"]; shared .dots, .banner.try and .overlay.
// If the game's markup changes, update the selectors below. No test hooks are used.
import { test, expect } from '@playwright/test';
import { watchErrors, currentDot } from '../helpers.js';

const ID = 'hidden-beads';
const G = `.a-${ID}`;
const QUESTIONS = [2, 3, 3, 3]; // questions in rounds 1-4

test(`playthrough: ${ID}`, async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'play-throughs run on desktop');
  test.setTimeout(300_000);
  const errors = watchErrors(page);
  await page.goto(`./#/play/${ID}`);

  const beads = page.locator(`${G} .row .bead`);
  const visible = page.locator(`${G} .row .bead:not(.under)`);
  const chips = page.locator(`${G} .chips .chip`);
  const ways = page.locator(`${G} .ways .way`);
  const done = page.locator(`${G} .tools .done`);
  const part = (p) => page.locator(`${G} .bond [data-part="${p}"]`);
  const chip = (v) => page.locator(`${G} .chips .chip[data-n="${v}"]`);
  const num = async (p) => Number(await part(p).textContent());

  async function countBeads() {
    const n = await beads.count();
    for (let i = 0; i < n; i++) await beads.nth(i).click();
    await expect(part('whole')).toHaveText(String(n));
    return n;
  }
  // Drag one bead onto the cup with the mouse, then tap the others under it.
  async function hide(k, withDrag) {
    for (let i = 0; i < k; i++) {
      const before = await visible.count();
      if (withDrag && i === 0) {
        const from = await visible.first().boundingBox();
        const to = await page.locator(`${G} .cup`).boundingBox();
        await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
        await page.mouse.down();
        await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 12 });
        await page.mouse.up();
      } else await visible.first().click();
      await expect(visible).toHaveCount(before - 1);
    }
  }

  for (let r = 0; r < 5; r++) {
    await expect.poll(() => currentDot(page), { timeout: 30_000 }).toBe(r);
    await expect(ways).toHaveCount(0, { timeout: 30_000 });
    await expect(part('whole')).toHaveText('?');
    const n = await countBeads();

    if (r < 4) {
      for (let qi = 0; qi < QUESTIONS[r]; qi++) {
        await expect(chips).toHaveCount(n, { timeout: 30_000 });
        const hidden = n - (await num('show'));
        expect(hidden).toBeGreaterThan(0);
        if (r === 0 && qi === 0) {
          await chip(n).click(); // "all of them" is a common first guess
          await expect(page.locator('.banner.try')).toBeVisible();
        }
        await chip(hidden).click();
        await expect(ways).toHaveCount(qi + 1, { timeout: 30_000 });
        await expect(part('hide')).toHaveText(String(hidden));
      }
      continue;
    }

    // Round 5: make the cup hide the target, then two new splits.
    await expect(done).toBeVisible({ timeout: 30_000 });
    const target = await num('hide');
    await hide(target, true);
    await done.click();
    await expect(ways).toHaveCount(1, { timeout: 30_000 });
    for (let f = 0; f < 2; f++) {
      await expect(done).toBeVisible({ timeout: 30_000 });
      await expect(visible).toHaveCount(n);
      const taken = await ways.evaluateAll((els) => els.map((e) => Number(e.dataset.split.split('+')[1])));
      const k = [...Array(n - 1).keys()].map((i) => i + 1).find((x) => !taken.includes(x));
      await hide(k, false);
      await done.click();
      await expect(chips).toHaveCount(n);
      await expect(part('show')).toHaveText(String(n - k));
      await chip(n - (await num('show'))).click();
      if (f === 0) await expect(ways).toHaveCount(2, { timeout: 30_000 });
    }
  }

  await expect(page.locator('.overlay')).toBeVisible({ timeout: 30_000 });
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('nilaa:resume') || '{}'));
  expect(saved[ID]).toBeUndefined();
  expect(errors).toEqual([]);
});
