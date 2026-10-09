// Plays all 5 rounds of The Ant on the Band like a child, up to the finish card:
//   1. builds each pictured band (reads the "Make this one" thumbnail: a twisted band's strip turns flat
//      somewhere, so its drawn width varies a lot; a plain ring's width stays nearly constant),
//   2. guesses, presses "Walk!" / "Keep walking", then answers the footprints question (ring No, twisty Yes),
//   3. drags around the band to paint it (ring 1 lap, twisty band 2 laps), answers "1 side",
//   4. guesses, drags to cut each band along the middle, answers 2 pieces (ring) / 1 piece (twisty),
//   5. guesses, drags two laps to cut near the edge, answers 2 pieces and "Twice".
// Relies on (see src/activities/ant-on-band.js): root `.a-ant-on-band`; thumbnail `.thumb svg polygon`
// (strip quads with points "A.p B.p B.q A.q"); main drawing `svg.main` (any drag on it moves the
// brush/scissors); lap label `.lap` ("Drag to paint" / "Drag to cut" / "✂️ Lap 1", empty once the drag
// goal is reached); choice buttons in `.ctl` named by aria-label (No twist, Twist, Yes, No, One piece,
// Two pieces, Once, Twice) or text (Walk!, Keep walking, 1 side). Picked buttons become disabled.
import { test, expect } from '@playwright/test';
import { watchErrors, currentDot } from '../helpers.js';

const ID = 'ant-on-band';
const STEP = { timeout: 45_000 }; // a step may wait behind walks, turns and spoken lines

test(`playthrough: ${ID}`, async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'play-throughs run on desktop');
  const errors = watchErrors(page);
  await page.goto(`./#/play/${ID}`);

  const game = page.locator('.a-ant-on-band');
  const banner = page.locator('.banner > span');
  const lap = game.locator('.lap');

  // press the (still enabled) choice button with this name, once it is offered
  async function choose(name) {
    const btn = game.locator('.ctl').getByRole('button', { name, exact: typeof name === 'string', disabled: false });
    await expect(btn).toBeVisible(STEP);
    await btn.click();
    await expect(btn).toHaveCount(0); // the picked button is disabled (or replaced) straight away
  }

  // drag round and round on the band until the brush/scissors reach the goal (lap label clears)
  async function dragAround(startLabel) {
    await expect(lap).toHaveText(startLabel, STEP);
    const box = await game.locator('svg.main').boundingBox();
    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;
    const r = Math.min(box.width, box.height) * 0.3;
    let ang = 0;
    await page.mouse.move(cx + r, cy);
    await page.mouse.down();
    const until = Date.now() + 60_000;
    while ((await lap.textContent()) !== '') {
      expect(Date.now(), 'dragging never reached the goal').toBeLessThan(until);
      for (let i = 0; i < 12; i++) {
        ang += Math.PI / 12;
        await page.mouse.move(cx + r * Math.cos(ang), cy + r * Math.sin(ang));
      }
    }
    await page.mouse.up();
  }

  // ---- round 1: build the band in the picture (both bands, random order) ----
  await expect.poll(() => currentDot(page)).toBe(0);
  for (const promptText of ['Make a band like this one', 'Now make the other band']) {
    await expect(banner).toContainText(promptText, STEP);
    await expect(game.locator('.thumb svg polygon').first()).toBeAttached();
    const widthRatio = await game.locator('.thumb svg').evaluate((svg) => {
      const ws = [...svg.querySelectorAll('polygon')].map((p) => {
        const q = p
          .getAttribute('points')
          .split(' ')
          .map((s) => s.split(',').map(Number));
        return Math.hypot(q[0][0] - q[3][0], q[0][1] - q[3][1]);
      });
      return Math.min(...ws) / Math.max(...ws);
    });
    await choose(widthRatio < 0.6 ? 'Twist' : 'No twist'); // ring ≈ 0.85, twisted band < 0.4
    await expect(page.locator('.banner.good')).toBeVisible(STEP);
  }

  // ---- round 2: the ant walks two laps on the ring, then on the twisty band ----
  await expect.poll(() => currentDot(page), STEP).toBe(1);
  for (const blueHasSteps of [false, true]) {
    await choose(blueHasSteps ? 'Yes' : 'No'); // the guess
    await choose(/Walk!/);
    await choose(/Keep walking/);
    await expect(banner).toHaveText('Are there footprints on the blue side?', STEP);
    await choose(blueHasSteps ? 'Yes' : 'No');
    await expect(page.locator('.banner.good')).toBeVisible(STEP);
  }

  // ---- round 3: paint the inside of the ring, then of the twisty band (two laps) ----
  await expect.poll(() => currentDot(page), STEP).toBe(2);
  await dragAround('Drag to paint');
  await expect(banner).toContainText('Now paint the inside of the twisty band', STEP);
  await dragAround('Drag to paint');
  await choose('1 side');

  // ---- round 4: cut the ring, then the twisty band, along the middle ----
  await expect.poll(() => currentDot(page), STEP).toBe(3);
  for (const pieces of ['Two pieces', 'One piece']) {
    await choose(pieces); // the guess
    await dragAround('Drag to cut');
    await expect(banner).toHaveText('How many pieces now?', STEP);
    await choose(pieces);
    await expect(page.locator('.banner.good')).toBeVisible(STEP);
  }

  // ---- round 5: cut the twisty band near the edge (two laps of scissors) ----
  await expect.poll(() => currentDot(page), STEP).toBe(4);
  await choose('Two pieces');
  await dragAround('✂️ Lap 1');
  await expect(banner).toHaveText('How many pieces now?', STEP);
  await choose('Two pieces');
  await expect(banner).toHaveText('How many times round did the scissors go?', STEP);
  await choose('Twice');

  await expect(page.locator('.overlay')).toBeVisible(STEP);
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('nilaa:resume') || '{}'));
  expect(saved[ID]).toBeUndefined();
  expect(errors).toEqual([]);
});
