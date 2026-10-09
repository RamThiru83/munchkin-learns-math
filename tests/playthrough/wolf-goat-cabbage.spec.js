// Play-through: Wolf, Goat and Cabbage (all 5 rounds, to the finish card).
// Plays like a child: taps each passenger to put it in the boat, then taps Sail. The rules of each round are
// rebuilt from which passengers are on the bank (the rounds are random), and a shortest plan (BFS, including
// going backwards) is worked out and followed crossing by crossing.
// Relies on the markup of src/activities/wolf-goat-cabbage.js (update here if it changes):
//   .a-wolf-goat-cabbage .who[data-id] (passengers; ids kid1/kid2/big, wolf/goat/cabbage/flowers/apples/cat/
//   mouse/fox/hen), .hull (boat; a loaded passenger is a .who inside it), .btn.primary (Sail; disabled while
//   sailing), .overlay (finish card). Rule table below mirrors the game's rules (boat size, pairs not to be left
//   alone); no test hooks are used.
import { test, expect } from '@playwright/test';
import { watchErrors, currentDot } from '../helpers.js';

const ID = 'wolf-goat-cabbage';
const ROUNDS = 5;
const G = `.a-${ID}`;
const PAIRS_NOT_ALONE = [
  ['wolf', 'goat'],
  ['goat', 'cabbage'],
  ['goat', 'flowers'],
  ['goat', 'apples'],
  ['cat', 'mouse'],
  ['fox', 'hen'],
];

// Rules of the round from the passengers on the bank.
function rulesFor(ids) {
  if (ids.includes('kid1')) {
    return { farmer: false, cap: 2, bad: [], items: ids.map((id) => ({ id, w: id === 'big' ? 2 : 1 })) };
  }
  return {
    farmer: true,
    cap: ids.length > 3 ? 2 : 1,
    bad: PAIRS_NOT_ALONE.filter(([a, b]) => ids.includes(a) && ids.includes(b)),
    items: ids.map((id) => ({ id, w: 1 })),
  };
}

// Shortest list of crossings (each a list of passenger ids), breadth first. side: 0 = start bank, 1 = far bank.
function solve(R) {
  const key = (s) => `${R.items.map((i) => s.side[i.id]).join('')}|${s.boat}`;
  const start = { side: Object.fromEntries(R.items.map((i) => [i.id, 0])), boat: 0 };
  const queue = [[start, []]];
  const seen = new Set([key(start)]);
  while (queue.length) {
    const [s, path] = queue.shift();
    const here = R.items.filter((i) => s.side[i.id] === s.boat);
    for (let m = 0; m < 1 << here.length; m++) {
      const sub = here.filter((_, i) => (m >> i) & 1);
      if (sub.reduce((a, i) => a + i.w, 0) > R.cap || (!R.farmer && !sub.length)) continue;
      const n = { side: { ...s.side }, boat: 1 - s.boat };
      sub.forEach((i) => (n.side[i.id] = n.boat));
      const left = R.farmer && R.bad.some(([a, b]) => n.side[a] === n.side[b] && n.side[a] !== n.boat);
      if (left || seen.has(key(n))) continue;
      seen.add(key(n));
      const next = [...path, sub.map((i) => i.id)];
      if (R.items.every((i) => n.side[i.id] === 1)) return next;
      queue.push([n, next]);
    }
  }
  throw new Error('no solution for ' + R.items.map((i) => i.id).join(','));
}

test(`playthrough: ${ID}`, async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'play-throughs run on desktop');
  const errors = watchErrors(page);
  await page.goto(`./#/play/${ID}`);

  const sail = page.locator(`${G} .btn.primary`);
  for (let r = 0; r < ROUNDS; r++) {
    await expect.poll(() => currentDot(page)).toBe(r);
    await expect(sail).toBeEnabled();
    const ids = await page.locator(`${G} .who`).evaluateAll((els) => els.map((e) => e.dataset.id));
    expect(ids.length).toBeGreaterThanOrEqual(2);
    const plan = solve(rulesFor(ids));

    for (const crossing of plan) {
      for (const id of crossing) {
        await page.locator(`${G} .who[data-id="${id}"]`).click();
        await expect(page.locator(`${G} .hull .who[data-id="${id}"]`)).toHaveCount(1);
      }
      await expect(sail).toBeEnabled();
      await sail.click();
      // The crossing is over when the boat is empty and Sail is ready again (after the last one the round ends).
      await expect(page.locator(`${G} .hull .who`)).toHaveCount(0, { timeout: 10_000 });
      if (crossing !== plan[plan.length - 1]) await expect(sail).toBeEnabled();
    }
    if (r < ROUNDS - 1) await expect.poll(() => currentDot(page), { timeout: 15_000 }).toBe(r + 1);
  }

  await expect(page.locator('.overlay')).toBeVisible({ timeout: 15_000 });
  const resume = await page.evaluate(() => JSON.parse(localStorage.getItem('nilaa:resume') || '{}'));
  expect(resume[ID]).toBeUndefined();
  expect(errors).toEqual([]);
});
