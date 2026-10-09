// Play-through: "Build the Picture" (build-from-picture), all 5 rounds to the finish card.
// Plays with real mouse input: for each move it asks the game's own hint solver which shape goes
// where (wrap.__bfp.findHint() -> {pid, rot, x, y}), taps the shape until its turn matches
// (__bfp.same(pid, rot)), then drags it so its top-left lands on board cell (x, y) and checks it
// snapped (__bfp.st.pieces[pid].placed). A round is won when .board.won appears.
// Relies on the documented test hook `.a-build-from-picture`.__bfp (st, cell, origin(), M,
// findHint(), same()) and on each piece's `path.body` (the filled shape inside the piece's svg);
// the press point is found with SVG isPointInFill, so no source-only module import is needed.
// Shared .dots and .overlay. If the hook or piece markup changes, update piecePoint()/dragTarget().
import { test, expect } from '@playwright/test';
import { watchErrors, currentDot } from '../helpers.js';

const ID = 'build-from-picture';

// A screen point inside the filled body of piece `pid` that is not covered by anything else.
const piecePoint = (page, pid) =>
  page.evaluate((pid) => {
    const hook = document.querySelector('.a-build-from-picture').__bfp;
    const el = hook.st.pieces[pid].el;
    const body = el.querySelector('path.body');
    const svg = body.ownerSVGElement;
    const ctm = svg.getScreenCTM();
    const bb = body.getBBox();
    for (let i = 1; i < 12; i++)
      for (let j = 1; j < 12; j++) {
        const x = bb.x + (bb.width * i) / 12,
          y = bb.y + (bb.height * j) / 12;
        if (!body.isPointInFill(new DOMPoint(x, y))) continue;
        const s = new DOMPoint(x, y).matrixTransform(ctm);
        const top = document.elementFromPoint(s.x, s.y);
        if (top && el.contains(top)) return { x: s.x, y: s.y };
      }
    return null;
  }, pid);

// Pixel offset that moves piece `g.pid` so its top-left sits on board cell (g.x, g.y).
const dragTarget = (page, g) =>
  page.evaluate((g) => {
    const hook = document.querySelector('.a-build-from-picture').__bfp;
    const p = hook.st.pieces[g.pid];
    const o = hook.origin();
    return { dx: o.x + g.x * hook.cell - hook.M - p.x, dy: o.y + g.y * hook.cell - hook.M - p.y };
  }, g);

test(`playthrough: ${ID}`, async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'play-throughs run on desktop');
  const errors = watchErrors(page);
  await page.goto('./#/');
  await page.evaluate(() => localStorage.removeItem('nilaa:resume'));
  await page.goto(`./#/play/${ID}`);

  const root = page.locator(`.a-${ID}`);
  const won = root.locator('.board.won');

  for (let r = 0; r < 5; r++) {
    await expect.poll(() => currentDot(page), { timeout: 30_000 }).toBe(r);
    await expect(root.locator('.pc').first()).toBeVisible({ timeout: 30_000 });
    await expect(won).toHaveCount(0, { timeout: 30_000 });
    await expect
      .poll(() => page.evaluate(() => !!document.querySelector('.a-build-from-picture').__bfp?.st))
      .toBe(true);
    await page.waitForTimeout(400); // let the pieces settle into the tray

    for (let moves = 0; ; moves++) {
      const g = await page.evaluate(() => document.querySelector('.a-build-from-picture').__bfp.findHint());
      if (g == null) break;
      expect(g, `dead end in round ${r + 1}`).not.toBe(false);
      expect(moves, 'too many moves').toBeLessThan(12);

      // Tap to turn until the shape is turned the right way.
      for (let t = 0; t < 4; t++) {
        const same = await page.evaluate(
          (g) => document.querySelector('.a-build-from-picture').__bfp.same(g.pid, g.rot),
          g,
        );
        if (same) break;
        const pt = await piecePoint(page, g.pid);
        expect(pt, `no visible point on piece ${g.pid}`).not.toBeNull();
        await page.mouse.click(pt.x, pt.y);
        await page.waitForTimeout(120);
      }
      expect(
        await page.evaluate((g) => document.querySelector('.a-build-from-picture').__bfp.same(g.pid, g.rot), g),
      ).toBe(true);

      // Drag it onto its spot in small steps, like a finger would.
      const d = await dragTarget(page, g);
      const pt = await piecePoint(page, g.pid);
      expect(pt, `no visible point on piece ${g.pid}`).not.toBeNull();
      await page.mouse.move(pt.x, pt.y);
      await page.mouse.down();
      for (let s = 1; s <= 8; s++) await page.mouse.move(pt.x + (d.dx * s) / 8, pt.y + (d.dy * s) / 8);
      await page.mouse.up();
      await expect
        .poll(
          () =>
            page.evaluate(
              (pid) => !!document.querySelector('.a-build-from-picture').__bfp.st.pieces[pid].placed,
              g.pid,
            ),
          { message: `round ${r + 1}: piece ${g.pid} did not snap` },
        )
        .toBe(true);
      await page.waitForTimeout(300); // snap animation
    }
    await expect(won).toHaveCount(1, { timeout: 10_000 });
  }

  await expect(page.locator('.overlay')).toBeVisible({ timeout: 30_000 });
  const resume = await page.evaluate(() => JSON.parse(localStorage.getItem('nilaa:resume') || '{}'));
  expect(resume[ID]).toBeUndefined();
  expect(errors).toEqual([]);
});
