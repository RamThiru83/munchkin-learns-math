// Play-through: necklaces (Necklace Makers), all 5 rounds, as a child would (real taps, state read from the DOM).
// Each round: for every pattern in the round's list, tap `.bench .bead` until each bead's `.blue` class matches,
//   tap "Add to shelf", and wait for one more landed `.shelf-row .mini:not(.empty)` (hidden while it flies in, and taps are ignored until then); then tap "Next" / "All done".
// The pattern lists mirror combos()/patternsFor() in src/activities/necklaces.js (k blue of n; k = null means any
//   number; flip round keeps one of each mirror pair). Mirror-twin adds may flip the bench, which is fine since the
//   beads are re-read before every tap.
// Relies on: `.a-necklaces`, `.bench .bead(.blue)`, `.btn.primary` "Add to shelf", `.shelf-row .mini(.empty)`,
//   `.controls .btn.primary` "Next" / "All done", `.overlay`, `.dots .dot.now`, and the `nilaa:resume` key.
//   No test hooks.
import { test, expect } from '@playwright/test';
import { watchErrors, currentDot } from '../helpers.js';

const ID = 'necklaces';
const ROUNDS = [
  { n: 3, k: 1 },
  { n: 4, k: 2 },
  { n: 5, k: 2 },
  { n: 3, k: null },
  { n: 5, k: 2, flip: true },
];

function combos(n, k) {
  const out = [];
  const rec = (start, chosen) => {
    if (chosen.length === k) {
      out.push(Array.from({ length: n }, (_, i) => (chosen.includes(i) ? 'B' : 'W')).join(''));
      return;
    }
    for (let i = start; i < n; i++) rec(i + 1, [...chosen, i]);
  };
  rec(0, []);
  return out;
}

function patternsFor(R) {
  let list = R.k == null ? Array.from({ length: R.n + 1 }, (_, j) => combos(R.n, j)).flat() : combos(R.n, R.k);
  if (R.flip) {
    const seen = new Set();
    list = list.filter((p) => {
      const r = [...p].reverse().join('');
      const key = r < p ? r : p;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }
  return list;
}

test(`playthrough: ${ID}`, async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'play-throughs run on desktop');
  const errors = watchErrors(page);
  const game = page.locator(`.a-${ID}`);
  const beads = game.locator('.bench .bead');
  const onShelf = game.locator('.shelf-row .mini:not(.empty):not([style*="hidden"])');

  await page.goto('./#/');
  await page.evaluate(() => localStorage.clear());
  await page.goto(`./#/play/${ID}`);
  await expect(beads.first()).toBeVisible();

  for (let r = 0; r < ROUNDS.length; r++) {
    await expect.poll(() => currentDot(page)).toBe(r);
    const list = patternsFor(ROUNDS[r]);
    for (let j = 0; j < list.length; j++) {
      const pattern = list[j];
      for (let i = 0; i < pattern.length; i++) {
        const isBlue = await beads.nth(i).evaluate((el) => el.classList.contains('blue'));
        if (isBlue !== (pattern[i] === 'B')) await beads.nth(i).click();
      }
      await game.locator('.btn.primary', { hasText: 'Add to shelf' }).click();
      await expect(onShelf).toHaveCount(j + 1);
    }
    const next = game.locator('.controls .btn.primary:not([hidden])', { hasText: /Next|All done/ });
    await expect(next).toBeVisible();
    await next.click();
  }

  await expect(page.locator('.overlay')).toBeVisible();
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('nilaa:resume') || '{}'));
  expect(saved[ID]).toBeUndefined();
  expect(errors).toEqual([]);
});
