// Play-through: The Missing Shape (id: missing-shape) - all 5 rounds, as a child would, to the finish card.
// Relies on (update if the game's markup changes):
//   .a-missing-shape .board.n{2,3,4}  grid; its children .cell (row-major), the empty one is .cell.hole
//   .cell aria-label "<colour> <shape>"; tray buttons .opt aria-label "<colour> <shape>"
//   .dots .dot.now (progress), .overlay (finish card), localStorage 'nilaa:resume' (saved round, cleared at the end)
// The answer is worked out from the DOM using the round's rule: 2x2 - the piece opposite the diagonal cell;
// bigger grids - the piece whose varying colour/shape is not yet in the hole's row.
// Round 2 (index 1) drags the piece into the hole; the other rounds tap it.
import { test, expect } from '@playwright/test';
import { watchErrors, currentDot } from '../helpers.js';

const ROUNDS = 5;

// Read the board and return the aria-label of the tray piece that fits the hole.
const findAnswer = (page) =>
  page.evaluate(() => {
    const root = document.querySelector('.a-missing-shape');
    const board = root.querySelector('.board');
    const n = Number(board.className.match(/\bn(\d)\b/)[1]);
    const cells = [...board.querySelectorAll('.cell')];
    const at = cells.findIndex((c) => c.classList.contains('hole'));
    const [hr, hc] = [Math.floor(at / n), at % n];
    const parse = (el) => {
      const [col, shape] = el.getAttribute('aria-label').split(' ');
      return { col, shape };
    };
    const labels = [...root.querySelectorAll('.opt')].map((o) => o.getAttribute('aria-label'));
    if (n === 2) {
      const d = parse(cells[(1 - hr) * 2 + (1 - hc)]);
      return labels.find((l) => {
        const p = l.split(' ');
        return p[0] !== d.col && p[1] !== d.shape;
      });
    }
    const row = cells.filter((c, i) => Math.floor(i / n) === hr && i !== at).map(parse);
    return labels.find((l) => {
      const [col, shape] = l.split(' ');
      return ['col', 'shape'].every((k) => {
        const vals = row.map((p) => p[k]);
        return new Set(vals).size < 2 || !vals.includes(k === 'col' ? col : shape);
      });
    });
  });

test('playthrough: missing-shape', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'play-throughs run on desktop');
  const errors = watchErrors(page);
  await page.goto('./#/play/missing-shape');
  await expect(page.locator('.a-missing-shape .opt').first()).toBeVisible();

  for (let r = 0; r < ROUNDS; r++) {
    await expect.poll(() => currentDot(page)).toBe(r);
    const board = page.locator('.a-missing-shape .board');
    await expect(board.locator('.cell.hole:not(.done)')).toHaveCount(1);
    const answer = await findAnswer(page);
    expect(answer, `round ${r + 1}: an answer was found`).toBeTruthy();
    const piece = page.locator(`.a-missing-shape .opt[aria-label="${answer}"]`);
    await expect(piece).toBeVisible();

    if (r === 1) {
      const from = await piece.boundingBox();
      const to = await board.locator('.cell.hole').boundingBox();
      await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
      await page.mouse.down();
      await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 10 });
      await page.mouse.up();
    } else {
      await piece.click();
    }

    if (r < ROUNDS - 1) {
      await expect.poll(() => currentDot(page), { timeout: 20_000 }).toBe(r + 1);
    }
  }

  await expect(page.locator('.overlay')).toBeVisible({ timeout: 20_000 });
  const resume = await page.evaluate(() => JSON.parse(localStorage.getItem('nilaa:resume') || '{}'));
  expect(resume['missing-shape']).toBeUndefined();
  expect(errors).toEqual([]);
});
