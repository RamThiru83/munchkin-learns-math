// Play-through: block-chains (Chain of Blocks), all 5 rounds (6 puzzle steps: round 2 has two parts),
// with real mouse drags of tray blocks into open slots, up to the finish card.
// Each step: read the board from the DOM, solve it with a small backtracking solver (mirrors solve() in
// src/activities/block-chains.js), then drag each solution block into its slot (empties in index order,
// which also satisfies the left-to-right chains).
// Relies on: `.a-block-chains .slot[data-i]` (`.open` = droppable, `.blk[data-id]` = placed block, id is
// 3 bits colour/shape/size), `.tray .blk[data-id]`, layout container `.chain` / `.ring` / `.grid`
// (grid is 2 x 4), the step order of PLAN/ROUND_OF in the game (step 4 is the "two changes" rule),
// `.dots .dot.now`, `.overlay`, and the `nilaa:resume` localStorage key. No test hooks.
import { test, expect } from '@playwright/test';
import { watchErrors, currentDot } from '../helpers.js';

const ID = 'block-chains';
const ROUND_OF = [0, 1, 1, 2, 3, 4]; // progress dot of each puzzle step (ROUND_OF in the game)
const NEED = [1, 1, 1, 1, 2, 1]; // features that must change between neighbours, per step

const dist = (a, b) => [0, 1, 2].filter((i) => ((a ^ b) >> i) & 1).length;

function edgesFor(kind, n) {
  if (kind === 'chain') return Array.from({ length: n - 1 }, (_, i) => [i, i + 1]);
  if (kind === 'ring') return Array.from({ length: n }, (_, i) => [i, (i + 1) % n]);
  const cols = n / 2;
  const e = [];
  for (let r = 0; r < 2; r++) for (let c = 0; c < cols - 1; c++) e.push([r * cols + c, r * cols + c + 1]);
  for (let c = 0; c < cols; c++) e.push([c, cols + c]);
  return e;
}

function solve(assign, edges, pool, need) {
  const nb = assign.map(() => []);
  edges.forEach(([a, b]) => {
    nb[a].push(b);
    nb[b].push(a);
  });
  const empty = assign.map((v, i) => (v == null ? i : -1)).filter((i) => i >= 0);
  const cur = assign.slice();
  const used = new Set();
  const rec = (k) => {
    if (k === empty.length) return true;
    const s = empty[k];
    for (const b of pool) {
      if (used.has(b)) continue;
      if (nb[s].every((t) => cur[t] == null || dist(cur[t], b) === need)) {
        cur[s] = b;
        used.add(b);
        if (rec(k + 1)) return true;
        cur[s] = null;
        used.delete(b);
      }
    }
    return false;
  };
  return rec(0) ? cur : null;
}

test(`playthrough: ${ID}`, async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'play-throughs run on desktop');
  const errors = watchErrors(page);
  const game = page.locator(`.a-${ID}`);

  await page.goto('./#/');
  await page.evaluate(() => localStorage.clear());
  await page.goto(`./#/play/${ID}`);
  await expect(game.locator('.slot').first()).toBeVisible();
  expect(await currentDot(page)).toBe(0);

  for (let step = 0; step < ROUND_OF.length; step++) {
    // a fresh puzzle is on the board once a slot is open again (after the previous "done" pause)
    await expect(game.locator('.slot.open').first()).toBeVisible({ timeout: 15_000 });
    expect(await currentDot(page)).toBe(ROUND_OF[step]);
    const st = await game.evaluate((root) => ({
      assign: [...root.querySelectorAll('.slot')].map((s) => {
        const b = s.querySelector('.blk');
        return b ? +b.dataset.id : null;
      }),
      tray: [...root.querySelectorAll('.tray .blk')].map((b) => +b.dataset.id),
      kind: root.querySelector('.grid') ? 'grid' : root.querySelector('.ring') ? 'ring' : 'chain',
    }));
    const sol = solve(st.assign, edgesFor(st.kind, st.assign.length), st.tray, NEED[step]);
    expect(sol, `step ${step} solvable: ${JSON.stringify(st)}`).not.toBeNull();

    const empties = st.assign.map((v, i) => (v == null ? i : -1)).filter((i) => i >= 0);
    for (const s of empties) {
      const blk = game.locator(`.tray .blk[data-id="${sol[s]}"]`);
      const slot = game.locator(`.slot[data-i="${s}"]`);
      await expect(slot).toHaveClass(/\bopen\b/);
      await blk.scrollIntoViewIfNeeded();
      const a = await blk.boundingBox();
      const b = await slot.boundingBox();
      await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
      await page.mouse.down();
      await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 8 });
      await page.mouse.up();
      await expect(slot.locator(`.blk[data-id="${sol[s]}"]`)).toHaveCount(1);
    }

    const next = ROUND_OF[step + 1];
    if (next != null && next !== ROUND_OF[step]) await expect.poll(() => currentDot(page)).toBe(next);
  }

  await expect(page.locator('.overlay')).toBeVisible({ timeout: 15_000 });
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('nilaa:resume') || '{}'));
  expect(saved[ID]).toBeUndefined();
  expect(errors).toEqual([]);
});
