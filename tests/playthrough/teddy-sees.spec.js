// Play-through: "What Does Teddy See?" (teddy-sees), all 5 rounds to the finish card with real clicks and drags.
// Picture rounds (1-3 and the end of 5): read the toys on the table and Teddy's seat, work out his view the way a
// child reasons it (turn the table round to his seat; a toy is hidden behind a toy at least as tall in the same
// line; only a box or tower hides), then tap the picture that shows it. Round 1 first taps a wrong picture and checks the game stays put.
// Round 4: read the clue in the banner ("Put the ball in front of the box.") and drag the toy to a cell that fits.
// Round 5: drag each toy to the cell shown on the map, then pick Teddy's view.
// Relies on: .a-teddy-sees scene `.toyg[data-toy][data-x][data-y]`, `.teddy[data-seat]`, `.cell[data-x][data-y]`,
// pictures `.opt` with items `[data-u][data-d][data-toy]`, `.opt.right`, tray `.toy[data-toy]`, map `.map [data-toy]`,
// `.actions .btn.primary` (Next), the shared `.banner span`, `.dots` and `.overlay`. No test hooks are used.
import { test, expect } from '@playwright/test';
import { watchErrors, currentDot } from '../helpers.js';

const ID = 'teddy-sees';
const HEIGHT = { ball: 1, hat: 2, box: 3, tower: 4 }; // which toy is taller
const SOLID = new Set(['box', 'tower']); // only wide, solid toys hide others (never the ball or the cone hat)
const NAMES = { ball: 'ball', 'party hat': 'hat', box: 'box', tower: 'tower' };
const REL = {
  'in front of': (c, a) => c.x === a.x && c.y > a.y,
  behind: (c, a) => c.x === a.x && c.y < a.y,
  'to the left of': (c, a) => c.y === a.y && c.x < a.x,
  'to the right of': (c, a) => c.y === a.y && c.x > a.x,
};

// Teddy's view as "lines left to right, each listed front to back" (x from her left, y = 0 is the back row).
function viewSig(toys, seat) {
  const at = ({ x, y }) =>
    ({ N: { u: 2 - x, d: y }, E: { u: 2 - y, d: 2 - x }, W: { u: y, d: x }, S: { u: x, d: 2 - y } })[seat];
  const items = toys.map((t) => ({ toy: t.toy, ...at(t) }));
  const shown = items.filter(
    (a) =>
      !items.some((b) => b !== a && b.u === a.u && b.d < a.d && SOLID.has(b.toy) && HEIGHT[b.toy] >= HEIGHT[a.toy]),
  );
  return sig(shown);
}
function sig(items) {
  const cols = [];
  for (let u = 0; u < 3; u++) {
    const col = items.filter((t) => t.u === u).sort((a, b) => a.d - b.d);
    if (col.length) cols.push(col.map((t) => t.toy).join('+'));
  }
  return cols.join('|');
}

test(`playthrough: ${ID}`, async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'play-throughs run on desktop');
  test.setTimeout(300_000);
  const errors = watchErrors(page);
  await page.goto(`./#/play/${ID}`);

  const root = page.locator(`.a-${ID}`);
  const next = root.locator('.actions .btn.primary');
  const opts = root.locator('.opt');

  const sceneToys = () =>
    root
      .locator('.scene .toyg')
      .evaluateAll((els) => els.map((e) => ({ toy: e.dataset.toy, x: +e.dataset.x, y: +e.dataset.y })));
  const optionSigs = () =>
    opts.evaluateAll((els) =>
      els.map((o) =>
        [...o.querySelectorAll('[data-u]')].map((e) => ({ toy: e.dataset.toy, u: +e.dataset.u, d: +e.dataset.d })),
      ),
    );
  async function dragToCell(toy, { x, y }) {
    const from = await root.locator(`.toy[data-toy="${toy}"]`).boundingBox();
    const to = await root.locator(`.cell[data-x="${x}"][data-y="${y}"]`).boundingBox();
    await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
    await page.mouse.down();
    await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 12 });
    await page.mouse.up();
    await expect(root.locator(`.scene .toyg[data-toy="${toy}"]`)).toHaveCount(1);
  }
  async function pickTeddysView(tryWrongFirst) {
    await expect(opts.first()).toBeVisible();
    const seat = await root.locator('.scene .teddy').getAttribute('data-seat');
    const want = viewSig(await sceneToys(), seat);
    const sigs = (await optionSigs()).map(sig);
    expect(sigs.filter((s) => s === want)).toHaveLength(1);
    if (tryWrongFirst) {
      await opts.nth(sigs.findIndex((s) => s !== want)).click();
      await page.waitForTimeout(800);
      await expect(root.locator('.opt.right')).toHaveCount(0);
      expect(await currentDot(page)).toBe(0);
    }
    await opts.nth(sigs.indexOf(want)).click();
    await expect(root.locator('.opt.right')).toHaveCount(1);
  }

  for (let r = 0; r < 5; r++) {
    await expect.poll(() => currentDot(page), { timeout: 30_000 }).toBe(r);
    await expect(root.locator('.scene svg')).toBeVisible();

    if (r < 3) await pickTeddysView(r === 0);

    if (r === 3) {
      for (let step = 0; step < 2; step++) {
        const toy = step === 0 ? 'ball' : 'hat';
        await expect(root.locator(`.toy[data-toy="${toy}"]`)).toBeVisible();
        const text = await page.locator('.banner span').first().textContent();
        const m = text.match(/Put the (.+?) (in front of|behind|to the left of|to the right of) the (.+?)\./);
        expect(m, `clue in banner: ${text}`).toBeTruthy();
        expect(NAMES[m[1]]).toBe(toy);
        const toys = await sceneToys();
        const anchor = toys.find((t) => t.toy === NAMES[m[3]]);
        const cell = [0, 1, 2, 3, 4, 5, 6, 7, 8]
          .map((i) => ({ x: i % 3, y: Math.floor(i / 3) }))
          .find((c) => !toys.some((t) => t.x === c.x && t.y === c.y) && REL[m[2]](c, anchor));
        expect(cell).toBeTruthy();
        await dragToCell(toy, cell);
      }
    }

    if (r === 4) {
      const goals = await root
        .locator('.map [data-toy]')
        .evaluateAll((els) => els.map((e) => ({ toy: e.dataset.toy, x: +e.dataset.x, y: +e.dataset.y })));
      expect(goals).toHaveLength(3);
      for (const g of goals) await dragToCell(g.toy, g);
      await pickTeddysView(false);
    }

    await expect(next).toBeVisible({ timeout: 30_000 });
    await next.click();
  }

  await expect(page.locator('.overlay')).toBeVisible({ timeout: 30_000 });
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('nilaa:resume') || '{}'));
  expect(saved[ID]).toBeUndefined();
  expect(errors).toEqual([]);
});
