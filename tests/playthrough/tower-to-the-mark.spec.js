// Play-through: "Tower to the Mark" (tower-to-the-mark), all 5 rounds to the finish card.
// Rounds 1–2: taps "+ Block" under each wall until the tower reaches the line (wall data-mark / data-unit),
// in round 1 also taking the top block off once on the way, then answers the question in `.qa`.
// Rounds 3–5: really drags clips from the clip box (`.src[data-size]`) onto the ribbons with the mouse, aiming at
// the end of the last clip (ribbon width / data-len = one small clip). Round 3 first drops one clip with a gap
// and checks the gentle nudge. Round 5 predicts, measures both ways, answers, then uses the 📎 buttons to measure
// ribbons until it finds the one that is 6 small clips and taps its "This one" button.
// Relies on: .a-tower-to-the-mark .col/.wall[data-mark][data-unit]/.add/.blk, .lane[data-i] .ribbon[data-len],
// .lane .placed[data-size], .tray .src[data-size], .qa button[data-v], .lhead .measure/.pick; shared .dots,
// .banner and .overlay. If the game's markup changes, update the selectors below. No test hooks are used.
import { test, expect } from '@playwright/test';
import { watchErrors, currentDot } from '../helpers.js';

const ID = 'tower-to-the-mark';
const G = `.a-${ID}`;

test(`playthrough: ${ID}`, async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'play-throughs run on desktop');
  test.setTimeout(300_000);
  const errors = watchErrors(page);
  await page.goto(`./#/play/${ID}`);
  const qa = (v) => page.locator(`${G} .qa button[data-v="${v}"]`);
  const lanes = page.locator(`${G} .lane`);

  // Small clips already on a lane (big clips count as 2).
  const used = (lane) =>
    lane.locator('.placed').evaluateAll((els) => els.reduce((s, e) => s + Number(e.dataset.size), 0));
  // Drag a clip of `size` from the box onto `lane`, `extra` small clips past the right spot (0 = right next to the last).
  async function dragClip(lane, size, extra = 0) {
    const src = page.locator(`${G} .tray .src[data-size="${size}"]`);
    // wait until the clip has glided home after the last drop
    await expect
      .poll(() => src.evaluate((e) => getComputedStyle(e).transform))
      .toMatch(/^(none|matrix\(1, 0, 0, 1, 0, 0\))$/);
    const from = await src.boundingBox();
    const rib = await lane.locator('.ribbon').boundingBox();
    const len = Number(await lane.locator('.ribbon').getAttribute('data-len'));
    const cw = rib.width / len;
    const x = rib.x + ((await used(lane)) + size / 2 + extra) * cw;
    await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
    await page.mouse.down();
    await page.mouse.move(x, rib.y + rib.height / 2, { steps: 10 });
    await page.mouse.up();
  }
  async function measure(lane, size) {
    const len = Number(await lane.locator('.ribbon').getAttribute('data-len'));
    while ((await used(lane)) < len) {
      const before = await used(lane);
      await dragClip(lane, size);
      await expect.poll(() => used(lane)).toBe(before + size);
    }
    return len / size;
  }

  for (let r = 0; r < 5; r++) {
    await expect.poll(() => currentDot(page), { timeout: 30_000 }).toBe(r);

    if (r < 2) {
      const cols = page.locator(`${G} .walls .col`);
      await expect(cols).toHaveCount(r + 1);
      const counts = [];
      for (let i = 0; i < r + 1; i++) {
        const wall = cols.nth(i).locator('.wall');
        const need = Number(await wall.getAttribute('data-mark')) / Number(await wall.getAttribute('data-unit'));
        const add = cols.nth(i).locator('.add');
        if (r === 0) {
          // stack one short, take the top block off again, then build up to the line
          for (let b = 0; b < need - 1; b++) await add.click();
          await wall.locator('.blk').last().click();
          await expect(wall.locator('.blk')).toHaveCount(need - 2);
          for (let b = 0; b < 2; b++) await add.click();
        } else for (let b = 0; b < need; b++) await add.click();
        await expect(wall.locator('.blk')).toHaveCount(need);
        await expect(add).toBeDisabled();
        counts.push(need);
      }
      if (r === 0) await qa(counts[0]).click();
      else await qa('taller').click();
    } else if (r < 4) {
      await expect(lanes).toHaveCount(r === 2 ? 1 : 2);
      const n = [];
      for (let i = 0; i < r - 1; i++) {
        if (r === 2) {
          await dragClip(lanes.nth(0), 1);
          await expect.poll(() => used(lanes.nth(0))).toBe(1);
          await dragClip(lanes.nth(0), 1, 2); // leaves a gap of two clips
          await expect(page.locator('.banner')).toContainText('gap');
          expect(await used(lanes.nth(0))).toBe(1);
        }
        n.push(await measure(lanes.nth(i), 1));
      }
      if (r === 2) await qa(n[0]).click();
      else {
        await qa(n[0] > n[1] ? 'red' : 'blue').click();
        await qa(Math.abs(n[0] - n[1])).click();
      }
    } else {
      await qa('small').click();
      await expect(lanes).toHaveCount(2);
      const small = await measure(lanes.nth(0), 1);
      const big = await measure(lanes.nth(1), 2);
      expect(small).toBe(2 * big);
      await qa(small).click();
      // measure the ribbons with the 📎 buttons until one is 6 small clips, then pick it
      await expect(lanes).toHaveCount(3, { timeout: 30_000 });
      for (let i = 0; i < 3; i++) {
        const lane = lanes.nth(i);
        await page.locator(`${G} .lhead .measure`).nth(i).click();
        const len = Number(await lane.locator('.ribbon').getAttribute('data-len'));
        await expect.poll(() => used(lane), { timeout: 30_000 }).toBe(len);
        if (len === 6) {
          await page.locator(`${G} .lhead .pick`).nth(i).click();
          break;
        }
      }
    }
  }

  await expect(page.locator('.overlay')).toBeVisible({ timeout: 30_000 });
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('nilaa:resume') || '{}'));
  expect(saved[ID]).toBeUndefined();
  expect(errors).toEqual([]);
});
