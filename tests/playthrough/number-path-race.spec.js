// Play-through: Number Path Race (number-path-race), all 5 rounds to the finish card, played like a child.
// Path rounds (1–4): wait until the die can be tapped, tap it, read the roll and the bunny's square, then tap the
// squares one by one, counting on from the bunny's square (round 4 first taps the square she will land on).
// Round 1 also taps a square too far once and checks the bunny stays put. Round 2 ends with "Which number is
// bigger?": tap the chip with the bigger number. Round 5: drag the flag with the mouse to each number on the line.
// Relies on (see src/activities/number-path-race.js): .a-number-path-race[data-phase], .die[data-v], .sq[data-n],
// .tok.me (bunny; none on a square = Start), .ask .chip[data-n], .actions .next, .goal[data-target], .flag,
// .axis (0 at its left edge, 20 at its right edge), .truth; shared .dots and .overlay. No test hooks are imported.
import { test, expect } from '@playwright/test';
import { watchErrors, currentDot } from '../helpers.js';

const ID = 'number-path-race';
const G = `.a-${ID}`;
const ENDS = [10, 10, 20, 20];

test(`playthrough: ${ID}`, async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'play-throughs run on desktop');
  test.setTimeout(300_000);
  const errors = watchErrors(page);
  await page.goto(`./#/play/${ID}`);

  const root = page.locator(G);
  const die = root.locator('.die');
  const next = root.locator('.actions .next');
  const sq = (n) => root.locator(`.sq[data-n="${n}"]`);
  const phase = () => root.getAttribute('data-phase');
  const squareOf = (cls) =>
    page.evaluate(
      ([g, cls]) => {
        const t = document.querySelector(`${g} .sq .tok.${cls}`);
        return t ? Number(t.closest('.sq').dataset.n) : 0;
      },
      [G, cls],
    );

  for (let r = 0; r < 5; r++) {
    await expect.poll(() => currentDot(page), { timeout: 30_000 }).toBe(r);

    if (r < 4) {
      const end = ENDS[r];
      await expect(root.locator('.sq')).toHaveCount(end);
      let triedWrong = false;
      for (;;) {
        await expect.poll(phase, { timeout: 60_000 }).toMatch(/^(roll|ask|done)$/);
        const p = await phase();
        if (p === 'done') break;
        if (p === 'ask') {
          const bigger = Math.max(await squareOf('me'), await squareOf('owl'));
          await root.locator(`.ask .chip[data-n="${bigger}"]`).click();
          break;
        }
        await die.click();
        await expect.poll(phase, { timeout: 10_000 }).toMatch(/^(hop|predict)$/);
        const roll = Number(await die.getAttribute('data-v'));
        const from = await squareOf('me');
        const land = Math.min(from + roll, end);
        if ((await phase()) === 'predict') {
          await sq(land).click();
          await expect.poll(phase).toBe('hop');
        }
        if (r === 0 && !triedWrong && from + 3 <= end) {
          triedWrong = true;
          await sq(from + 3).click(); // too far: bounces, the bunny stays
          expect(await squareOf('me')).toBe(from);
        }
        for (let n = from + 1; n <= land; n++) await sq(n).click();
        expect(await squareOf('me')).toBe(land);
      }
    } else {
      for (let k = 0; k < 3; k++) {
        await expect.poll(phase, { timeout: 30_000 }).toBe('place');
        const target = Number(await root.locator('.goal').getAttribute('data-target'));
        const axis = await root.locator('.axis').boundingBox();
        const flag = await root.locator('.flag').boundingBox();
        // Grab the flag by its pole (15% of its width): the pole tip is what lands on the line.
        await page.mouse.move(flag.x + flag.width * 0.15, flag.y + flag.height / 2);
        await page.mouse.down();
        const x = axis.x + (target / 20) * axis.width;
        await page.mouse.move(x, axis.y, { steps: 12 });
        await page.mouse.up();
        await expect(root.locator('.truth')).toHaveCount(k + 1);
      }
    }

    await expect(next).toBeVisible({ timeout: 30_000 });
    await next.click();
  }

  await expect(page.locator('.overlay')).toBeVisible({ timeout: 30_000 });
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('nilaa:resume') || '{}'));
  expect(saved[ID]).toBeUndefined();
  expect(errors).toEqual([]);
});
