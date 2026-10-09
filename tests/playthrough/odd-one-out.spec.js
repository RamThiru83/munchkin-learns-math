// Play-through: Odd One Out, all 5 rounds to the finish card, played by clicking like a child would.
// Relies on (update here if the game's markup changes):
//   .a-odd-one-out .card      one button per card, aria-label "<count> <size> <colour> <shape>[s]" (e.g. "two big red circles")
//   .card.done                a card that has already had its turn (rounds 3 and 5)
//   .reason[data-attr]        reason chips shown after tapping a card (rounds 2-4)
//   .banner                   the prompt text; round 5 asks "Find the only red one." etc.
//   .dots .dot.now            progress dots (currentDot), .overlay = finish card
// The odd card and its reason are worked out from the card labels with the same rule as the game
// (all other cards share one value of an attribute, the card differs), so random puzzles are fine.
import { test, expect } from '@playwright/test';
import { watchErrors, currentDot } from '../helpers.js';

const ATTRS = ['colour', 'size', 'shape', 'count'];
const NUMS = { one: 1, two: 2, three: 3 };
const PUZZLES = [2, 2, 1, 2, 1]; // puzzles per round
const CARD = '.a-odd-one-out .card';

const parse = (label) => {
  const [n, size, colour, shape] = label.split(' ');
  const count = NUMS[n];
  return { count, size, colour, shape: count > 1 ? shape.slice(0, -1) : shape };
};
const valid = (items, i, a) => {
  const others = items.filter((_, j) => j !== i);
  return others.every((o) => o[a] === others[0][a]) && items[i][a] !== others[0][a];
};
const cands = (items) => items.flatMap((_, i) => ATTRS.filter((a) => valid(items, i, a)).map((a) => ({ i, a })));

async function readItems(page) {
  const cards = page.locator(CARD);
  await expect(cards.first()).toBeVisible();
  const labels = await cards.evaluateAll((els) => els.map((e) => e.getAttribute('aria-label')));
  return labels.map(parse);
}
const doneSet = (page) =>
  page.locator(CARD).evaluateAll((els) => els.flatMap((e, i) => (e.classList.contains('done') ? [i] : [])));
const markBoard = (page) => page.evaluate(() => (document.querySelector('.a-odd-one-out .card').__old = true));
const waitNewBoard = (page) =>
  expect
    .poll(() => page.evaluate(() => !document.querySelector('.a-odd-one-out .card')?.__old), { timeout: 15_000 })
    .toBe(true);

// "Find the only red one." / "...the only star." / "...the only one with two shapes." -> matcher on an item
function targetFrom(text) {
  const m = /the only (?:one with (one|two|three) shapes?|(\w+?)s?(?: one)?)\./.exec(text);
  const word = m[2];
  const key = m[1] ? ['count', NUMS[m[1]]] : null;
  return (it, a) => {
    if (key) return a === 'count' && it.count === key[1];
    return a !== 'count' && it[a] === word;
  };
}

test('playthrough: odd-one-out', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'play-throughs run on desktop');
  const errors = watchErrors(page);
  await page.goto('./#/play/odd-one-out');
  await expect(page.locator(CARD).first()).toBeVisible();

  for (let r = 0; r < PUZZLES.length; r++) {
    for (let k = 0; k < PUZZLES[r]; k++) {
      const items = await readItems(page);
      const cards = page.locator(CARD);
      await markBoard(page);

      if (r === 0) {
        // round 1: tap the one that is different
        await cards.nth(cands(items)[0].i).click();
      } else if (r === 1 || r === 3) {
        // rounds 2 and 4: tap the odd card, then its reason chip
        const { i, a } = cands(items)[0];
        await cards.nth(i).click();
        await page.locator(`.reason[data-attr="${a}"]`).click();
      } else if (r === 2) {
        // round 3: every card takes a turn, each with its own reason
        for (let turn = 0; turn < items.length; turn++) {
          const done = await doneSet(page);
          const c = cands(items).find((x) => !done.includes(x.i));
          await cards.nth(c.i).click();
          await page.locator(`.reason[data-attr="${c.a}"]`).click();
          if (turn < items.length - 1) {
            await expect(cards.nth(c.i)).toHaveClass(/done/);
            await expect(page.locator('.banner')).toContainText('Now find another way', { timeout: 10_000 });
          }
        }
      } else {
        // round 5: given the reason, find the card; one turn per card
        const total = cands(items).length;
        for (let turn = 0; turn < total; turn++) {
          await expect(page.locator('.banner')).toContainText(/Find the only/);
          const match = targetFrom(await page.locator('.banner').innerText());
          const done = await doneSet(page);
          const c = cands(items).find((x) => !done.includes(x.i) && match(items[x.i], x.a));
          await cards.nth(c.i).click();
          if (turn < total - 1) await expect(cards.nth(c.i)).toHaveClass(/done/);
          if (turn < total - 1) await expect(page.locator('.banner')).toContainText(/Find the only/);
        }
      }

      if (r === PUZZLES.length - 1) break;
      await waitNewBoard(page);
    }
    if (r < PUZZLES.length - 1) await expect.poll(() => currentDot(page), { timeout: 20_000 }).toBe(r + 1);
  }

  await expect(page.locator('.overlay')).toBeVisible({ timeout: 20_000 });
  const resume = await page.evaluate(() => JSON.parse(localStorage.getItem('nilaa:resume') || '{}'));
  expect(resume['odd-one-out']).toBeUndefined();
  expect(errors).toEqual([]);
});
