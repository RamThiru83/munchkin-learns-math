// Play-through: All the Labels Are Wrong, all 5 rounds to the finish card, played with real clicks and drags.
// Relies on (see src/activities/wrong-labels.js; update here if the markup changes):
//   .a-wrong-labels .boxbtn     one button per box (tap = peek); .peekzone = the fruit tag that pops out of box i
//   .a-wrong-labels .tray .tag  the new tags to drag, data-k = true contents key; .tray.off while peeking/cheering
//   .a-wrong-labels .oldtag     the wrong tag on each box; text matches a tray tag's text, so it maps to a key
//   .a-wrong-labels .col        drop target per box; .slot holds the dropped tag
//   .dots .dot.now (currentDot), .overlay = finish card
// Puzzle logic: `possible` is the game's own exported pure helper (labels + one peek -> remaining arrangements).
// Peek choice: a mixed-key box ('ap') if one is among the old labels, else box 0 (any box works in the other rounds).
import { test, expect } from '@playwright/test';
import { watchErrors, currentDot } from '../helpers.js';
import { possible } from '../../src/activities/wrong-labels.js';

const ROOT = '.a-wrong-labels';

test('playthrough: wrong-labels', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'play-throughs run on desktop');
  const errors = watchErrors(page);
  await page.goto('./#/play/wrong-labels');
  await expect(page.locator(`${ROOT} .col`).first()).toBeVisible();

  for (let r = 0; r < 5; r++) {
    await expect.poll(() => currentDot(page), { timeout: 20_000 }).toBe(r);
    await expect(page.locator(`${ROOT} .oldtag`).first()).toBeVisible();
    await expect(page.locator(`${ROOT} .tray .tag`).first()).toBeAttached();

    // Read the tags: text -> key, and the key written on each box's wrong tag.
    const { tags, labels } = await page.evaluate((root) => {
      const tags = [...document.querySelectorAll(`${root} .tray .tag`)].map((t) => [t.textContent, t.dataset.k]);
      const map = Object.fromEntries(tags);
      const labels = [...document.querySelectorAll(`${root} .oldtag`)].map((o) => map[o.textContent]);
      return { tags, labels };
    }, ROOT);
    const map = Object.fromEntries(tags);
    const peek = labels.includes('ap') ? labels.indexOf('ap') : 0;

    // Peek in the box and see what comes out.
    await page.locator(`${ROOT} .boxbtn`).nth(peek).click();
    const peekZone = page.locator(`${ROOT} .peekzone`).nth(peek);
    await expect(peekZone).not.toHaveText('');
    const found = map[await peekZone.textContent()];
    const truth = possible(labels, [{ i: peek, f: found }]);
    expect(truth, `round ${r + 1} should be settled by one peek`).toHaveLength(1);

    // Drag each true tag onto its box.
    await expect(page.locator(`${ROOT} .tray:not(.off)`)).toBeVisible();
    for (let b = 0; b < truth[0].length; b++) {
      const key = truth[0][b];
      const src = await page.locator(`${ROOT} .tray .tag[data-k="${key}"]`).boundingBox();
      const dst = await page.locator(`${ROOT} .col`).nth(b).boundingBox();
      await page.mouse.move(src.x + src.width / 2, src.y + src.height / 2);
      await page.mouse.down();
      await page.mouse.move(src.x + src.width / 2 + 10, src.y + src.height / 2 - 10, { steps: 3 });
      await page.mouse.move(dst.x + dst.width / 2, dst.y + dst.height * 0.8, { steps: 12 });
      await page.mouse.up();
      await expect(page.locator(`${ROOT} .slot`).nth(b).locator(`.tag[data-k="${key}"]`)).toHaveCount(1, {
        timeout: 5_000,
      });
    }
    if (r < 4) await expect.poll(() => currentDot(page), { timeout: 20_000 }).toBe(r + 1);
  }

  await expect(page.locator('.overlay')).toBeVisible({ timeout: 20_000 });
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('nilaa:resume') || '{}')['wrong-labels']);
  expect(saved).toBeUndefined();
  expect(errors).toEqual([]);
});
