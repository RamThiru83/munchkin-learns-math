// Play-through: snowflakes (Fold, Cut, Unfold), all 5 rounds, as a child would (real taps, state read from the DOM).
// Rounds 1-2: pick a stamp chip, tap the folded paper at two spots on the folds, tap "Unfold", then "Next paper".
// Round 3 / 5: tap the `.choices .choice` buttons in turn until one turns `.right` (wrong ones just shake).
// Round 4: read the target from the `.goal` picture (first layer of its mask: polygon point count -> shape,
//   centre -> nearest target spot), snip those shapes at those spots, "Unfold".
// Paper taps are placed with `svg.paper`'s getScreenCTM (model units: square paper is -100..100, fold lines
//   pass through 0,0); snips are counted as `svg.paper mask polygon`. Target spots mirror MAKE_PTS in the game.
// Relies on: stamp aria-labels ("Triangle snip", ...), `button.unfold`, "Next paper", `.choices .choice(.right)`,
//   `.goal svg mask > g`, `.overlay`, `.dots .dot.now`, and the `nilaa:resume` localStorage key. No test hooks.
import { test, expect } from '@playwright/test';
import { watchErrors, currentDot } from '../helpers.js';

const ID = 'snowflakes';
// Round 4 target spots on the quarter-folded paper (MAKE_PTS in src/activities/snowflakes.js).
const MAKE_PTS = [
  [0, -50],
  [50, 0],
  [60, -60],
];
const STAMP_BY_POINTS = { 3: 'Triangle snip', 4: 'Square snip' }; // anything else is the half circle

test(`playthrough: ${ID}`, async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'play-throughs run on desktop');
  const errors = watchErrors(page);
  const game = page.locator(`.a-${ID}`);
  const snips = game.locator('svg.paper mask polygon');
  const unfold = game.locator('button.unfold');

  await page.goto('./#/');
  await page.evaluate(() => localStorage.clear());
  await page.goto(`./#/play/${ID}`);
  await expect(page.locator('.dots .dot').first()).toBeVisible();
  expect(await currentDot(page)).toBe(0);

  // Pick a stamp, then tap the paper at model point pt; wait until the snip shows.
  async function snip(stamp, pt) {
    const chip = game.locator(`.tools [aria-label="${stamp}"]`);
    await expect(chip).toBeEnabled();
    await chip.click();
    await expect(chip).toHaveAttribute('aria-pressed', 'true');
    const before = await snips.count();
    const [x, y] = await game.locator('svg.paper').evaluate((svg, p) => {
      const q = new DOMPoint(p[0], p[1]).matrixTransform(svg.getScreenCTM());
      return [q.x, q.y];
    }, pt);
    await page.mouse.click(x, y);
    await expect(snips).toHaveCount(before + 1);
  }

  async function nextPaper(r) {
    const next = game.getByRole('button', { name: /Next paper/ });
    await expect(next).toBeVisible({ timeout: 30_000 });
    await next.click();
    await expect.poll(() => currentDot(page), { timeout: 20_000 }).toBe(r + 1);
  }

  // Tap each choice in turn until the right one is found.
  async function pickRightChoice() {
    const choices = game.locator('.choices .choice');
    await expect(choices).toHaveCount(3, { timeout: 30_000 });
    for (let i = 0; i < 3; i++) {
      await choices.nth(i).click();
      if (await game.locator('.choices .choice.right').count()) break;
    }
    await expect(game.locator('.choices .choice.right')).toHaveCount(1);
  }

  // Round 1: half fold, two snips on the fold.
  await expect(unfold).toBeVisible({ timeout: 30_000 });
  await snip('Half circle snip', [0, -50]);
  await snip('Triangle snip', [0, 45]);
  await unfold.click();
  await nextPaper(0);

  // Round 2: quarter fold, one snip on each fold.
  await expect(unfold).toBeVisible({ timeout: 30_000 });
  await snip('Square snip', [0, -55]);
  await snip('Triangle snip', [55, 0]);
  await unfold.click();
  await nextPaper(1);

  // Round 3: which open snowflake does the snipped wedge become?
  await pickRightChoice();
  await nextPaper(2);

  // Round 4: copy the target picture.
  await expect(unfold).toBeVisible({ timeout: 30_000 });
  const target = await game
    .locator('.goal svg mask > g')
    .first()
    .evaluate((g) =>
      [...g.querySelectorAll('polygon')].map((poly) => {
        const P = poly
          .getAttribute('points')
          .trim()
          .split(/\s+/)
          .map((s) => s.split(',').map(Number));
        return { n: P.length, c: [0, 1].map((k) => P.reduce((a, q) => a + q[k], 0) / P.length) };
      }),
    );
  expect(target).toHaveLength(2);
  for (const { n, c } of target) {
    const pt = MAKE_PTS.slice().sort(
      (a, b) => Math.hypot(a[0] - c[0], a[1] - c[1]) - Math.hypot(b[0] - c[0], b[1] - c[1]),
    )[0];
    await snip(STAMP_BY_POINTS[n] ?? 'Half circle snip', pt);
  }
  await unfold.click();
  await nextPaper(3);

  // Round 5: which folded wedge made this snowflake?
  await pickRightChoice();

  await expect(page.locator('.overlay')).toBeVisible({ timeout: 30_000 });
  const resume = await page.evaluate(() => JSON.parse(localStorage.getItem('nilaa:resume') || '{}'));
  expect(resume[ID]).toBeUndefined();
  expect(errors).toEqual([]);
});
