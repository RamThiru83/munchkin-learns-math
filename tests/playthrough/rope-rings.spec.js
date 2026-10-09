// Plays all 5 rounds of Rope Rings like a child: drags each tray block into the right zone of the Venn ropes,
// then answers the follow-up questions of rounds 3-5 (tap blocks / press a count button), up to the finish card.
// Relies on (see src/activities/rope-rings.js): tray blocks `.rr-tray .rr-tok` with aria-label "<size> <color> <shape>";
// rope rules read from the two `.rr-label:not(.out)` texts (A then B); rope circles = board svg
// `circle[stroke-width="14"]` without a dasharray (A then B); placed blocks `.rr-board .rr-tok.placed`;
// pick questions mark blocks `.rr-tok.pickable` (done = `.ok`); count answers `.rr-tray .rr-num[aria-label=N]`.
// The question order per round (QS in the game) is mirrored below; rules and blocks are random each play.
import { test, expect } from '@playwright/test';
import { watchErrors, currentDot } from '../helpers.js';

const ID = 'rope-rings';
// questions after the sort, per round index (rounds 3-5)
const QS = {
  2: [
    ['pick', (z) => z !== 'OUT'], // A or B
    ['pick', (z, l, A) => !fits(A, l)], // not A
    ['count', (z) => z === 'AB'], // how many in both
  ],
  3: [
    ['pick', (z) => z === 'A'],
    ['pick', (z) => z === 'OUT'],
    ['count', (z) => z === 'OUT'],
  ],
  4: [
    ['pick', (z) => z === 'B'],
    ['pick', (z) => z !== 'AB'],
    ['count', (z) => z === 'A' || z === 'AB'],
  ],
};
const SHAPE_WORD = { round: 'circle', square: 'square', triangle: 'triangle' };

// does block label "<size> <color> <shape>" satisfy rope rule word (e.g. "red", "round", "big")?
function fits(rule, label) {
  const [size, color, shape] = label.split(' ');
  return rule === size || rule === color || SHAPE_WORD[rule] === shape;
}
const zoneOf = (label, A, B) => (fits(A, label) ? (fits(B, label) ? 'AB' : 'A') : fits(B, label) ? 'B' : 'OUT');

// read board geometry (board units) and the two rope rules from the DOM
const readBoard = (page) =>
  page.evaluate(() => {
    const board = document.querySelector('.rr-board');
    const br = board.getBoundingClientRect();
    const vb = board.querySelector('svg').viewBox.baseVal;
    const k = vb.width / br.width;
    const ropes = [...board.querySelectorAll('circle[stroke-width="14"]:not([stroke-dasharray])')].map((c) => ({
      x: +c.getAttribute('cx'),
      y: +c.getAttribute('cy'),
      r: +c.getAttribute('r'),
    }));
    const labelEls = [...board.querySelectorAll('.rr-label')];
    const boxes = labelEls.map((l) => {
      const r = l.getBoundingClientRect();
      return {
        x0: (r.left - br.left) * k,
        x1: (r.right - br.left) * k,
        y0: (r.top - br.top) * k,
        y1: (r.bottom - br.top) * k,
      };
    });
    const rules = labelEls.filter((l) => !l.classList.contains('out')).map((l) => l.textContent.trim());
    return { left: br.left, top: br.top, k, W: vb.width, H: vb.height, A: ropes[0], B: ropes[1], boxes, rules };
  });

// the point in zone `zone` farthest from rope lines, labels, edges and blocks already placed there
function findSpot(g, zone, used) {
  const d = (p, c) => Math.hypot(p.x - c.x, p.y - c.y) - c.r;
  let best = null;
  let bestScore = -Infinity;
  for (let y = 40; y <= g.H - 40; y += 6)
    for (let x = 40; x <= g.W - 40; x += 6) {
      const p = { x, y };
      const dA = d(p, g.A);
      const dB = d(p, g.B);
      const z = dA < 0 ? (dB < 0 ? 'AB' : 'A') : dB < 0 ? 'B' : 'OUT';
      if (z !== zone) continue;
      let score = Math.min(Math.abs(dA), Math.abs(dB));
      for (const b of g.boxes) {
        const dx = Math.max(b.x0 - x, 0, x - b.x1);
        const dy = Math.max(b.y0 - y, 0, y - b.y1);
        score = Math.min(score, Math.hypot(dx, dy) - 30);
      }
      for (const u of used) score = Math.min(score, Math.hypot(x - u.x, y - u.y) - 30);
      if (score > bestScore) {
        bestScore = score;
        best = p;
      }
    }
  return best;
}

test(`playthrough: ${ID}`, async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'play-throughs run on desktop');
  const errors = watchErrors(page);
  await page.goto(`./#/play/${ID}`);

  const tray = page.locator('.rr-tray .rr-tok');
  const TOTAL = 5;

  for (let round = 0; round < TOTAL; round++) {
    await expect.poll(() => currentDot(page), { timeout: 30_000 }).toBe(round);
    // blocks are in the tray and the tray is unlocked (round 2 first slides the ropes together)
    await expect(tray.first()).toBeVisible();
    await expect(page.locator('.rr-tray.locked')).toHaveCount(0, { timeout: 30_000 });

    // ---- sort every block ----
    const g = await readBoard(page);
    const [ruleA, ruleB] = g.rules;
    const used = { A: [], B: [], AB: [], OUT: [] };
    const zones = {}; // aria-label -> zone
    for (let left = await tray.count(); left > 0; left--) {
      const tok = tray.first();
      const label = await tok.getAttribute('aria-label');
      const zone = zoneOf(label, ruleA, ruleB);
      zones[label] = zone;
      const spot = findSpot(g, zone, used[zone]);
      used[zone].push(spot);
      const box = await tok.boundingBox();
      const sx = box.x + box.width / 2;
      const sy = box.y + box.height / 2;
      const tx = g.left + spot.x / g.k;
      const ty = g.top + spot.y / g.k;
      await page.mouse.move(sx, sy);
      await page.mouse.down();
      await page.mouse.move((sx + tx) / 2, (sy + ty) / 2, { steps: 5 });
      await page.mouse.move(tx, ty, { steps: 5 });
      await page.mouse.up();
      await expect(tray).toHaveCount(left - 1);
    }
    await expect(page.locator('.rr-board .rr-tok.placed')).toHaveCount(Object.keys(zones).length);

    // ---- questions (rounds 3-5) ----
    for (const [kind, want] of QS[round] || []) {
      if (kind === 'pick') {
        // a new pick question has started once blocks are pickable again
        await expect(page.locator('.rr-tok.pickable').first()).toBeVisible({ timeout: 30_000 });
        const targets = Object.keys(zones).filter((l) => want(zones[l], l, ruleA));
        for (const l of targets) await page.locator(`.rr-board .rr-tok.placed[aria-label="${l}"]`).click();
        await expect(page.locator('.rr-tok.pickable')).toHaveCount(0);
      } else {
        const n = Object.keys(zones).filter((l) => want(zones[l])).length;
        const btn = page.locator(`.rr-tray .rr-num[aria-label="${n}"]`);
        await expect(btn).toBeVisible({ timeout: 30_000 });
        await btn.click();
        // the count is the last question of its round: the next round's dot / finish card is awaited next
      }
    }
  }

  await expect(page.locator('.overlay')).toBeVisible({ timeout: 60_000 });
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('nilaa:resume') || '{}'));
  expect(saved[ID]).toBeUndefined();
  expect(errors).toEqual([]);
});
