// Play-through: Builder Team (all 5 rounds, to the finish card).
// Plays like a child: reads the blocks in the yard, works out the fastest plan with an exact search over
// "which blocks rest on which" (every round's puzzle is random), then taps a block and taps the builder/turn
// square for it, and finally taps "Build it".
// Relies on the markup of src/activities/construction-foreman.js (update here if it changes):
//   .cf-yard .cf-card[data-id][data-on] (blocks waiting; data-on = space-separated ids it rests on),
//   .cf-who (one per builder), .cf-hd (header cells: 1 label + one per turn),
//   .cf-cell[data-r=builder row][data-t=turn 1..] (grid squares; a placed block is a .cf-card inside),
//   .cf-build ("Build it"), .dots .dot.now, .overlay (finish card), and the nilaa:resume localStorage key.
//   No test hooks; tap-to-select then tap-to-place is used instead of dragging.
import { test, expect } from '@playwright/test';
import { watchErrors, currentDot } from '../helpers.js';

const ID = 'construction-foreman';
const ROUNDS = 5;

// Exact search: the shortest schedule (list of turns, each a list of block ids) for m builders within T turns.
function solve(blocks, m, T) {
  const n = blocks.length;
  const index = Object.fromEntries(blocks.map((b, i) => [b.id, i]));
  const need = blocks.map((b) => b.on.reduce((mask, id) => mask | (1 << index[id]), 0));
  const full = (1 << n) - 1;
  const memo = new Map();
  const count = (x) => {
    let c = 0;
    for (; x; x &= x - 1) c++;
    return c;
  };
  function rec(turn, done) {
    if (done === full) return { len: turn - 1, picks: [] };
    if (turn > T) return null;
    const key = turn * (full + 1) + done;
    if (memo.has(key)) return memo.get(key);
    let ready = 0;
    for (let i = 0; i < n; i++) if (!((done >> i) & 1) && (need[i] & done) === need[i]) ready |= 1 << i;
    let best = null;
    for (let s = ready; s > 0; s = (s - 1) & ready) {
      if (count(s) > m) continue;
      const r = rec(turn + 1, done | s);
      if (r && (!best || r.len < best.len)) best = { len: r.len, picks: [s, ...r.picks] };
    }
    memo.set(key, best);
    return best;
  }
  const result = rec(1, 0);
  if (!result) return null;
  return result.picks.map((mask) => blocks.filter((_, i) => (mask >> i) & 1).map((b) => b.id));
}

const readRound = (page) =>
  page.evaluate(() => ({
    blocks: [...document.querySelectorAll('.cf-yard .cf-card')].map((c) => ({
      id: c.dataset.id,
      on: c.dataset.on ? c.dataset.on.split(' ') : [],
    })),
    builders: document.querySelectorAll('.cf-who').length,
    turns: document.querySelectorAll('.cf-hd').length - 1,
  }));

test(`playthrough: ${ID}`, async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'play-throughs run on desktop');
  const errors = watchErrors(page);

  await page.goto(`./#/play/${ID}`);
  await expect(page.locator('.cf-yard .cf-card').first()).toBeVisible();

  for (let round = 0; round < ROUNDS; round++) {
    await expect.poll(() => currentDot(page)).toBe(round);
    await expect(page.locator('.cf-yard .cf-card').first()).toBeVisible();

    const { blocks, builders, turns } = await readRound(page);
    const plan = solve(blocks, builders, turns);
    expect(plan, `round ${round + 1}: a plan exists`).not.toBeNull();

    for (let t = 0; t < plan.length; t++) {
      for (let k = 0; k < plan[t].length; k++) {
        const id = plan[t][k];
        const cell = page.locator(`.cf-cell[data-r="${k}"][data-t="${t + 1}"]`);
        await page.locator(`.cf-yard .cf-card[data-id="${id}"]`).click();
        await cell.click();
        await expect(cell.locator(`.cf-card[data-id="${id}"]`)).toBeVisible();
      }
    }
    await expect(page.locator('.cf-yard .cf-card')).toHaveCount(0);

    // The button pulses forever (CSS animation), so Playwright's "stable" check would never pass.
    await expect(page.locator('.cf-build')).toBeVisible();
    await page.locator('.cf-build').click({ force: true });
    if (round < ROUNDS - 1) {
      await expect.poll(() => currentDot(page), { timeout: 90_000 }).toBe(round + 1);
    }
  }

  await expect(page.locator('.overlay')).toBeVisible({ timeout: 90_000 });
  const saved = await page.evaluate((id) => JSON.parse(localStorage.getItem('nilaa:resume') || '{}')[id] ?? null, ID);
  expect(saved).toBeNull();
  expect(errors).toEqual([]);
});
