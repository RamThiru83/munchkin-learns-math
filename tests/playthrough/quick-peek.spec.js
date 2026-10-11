// Play-through: "Quick Peek" (quick-peek), all 5 rounds to the finish card.
// Each question: read what is asked (.board[data-ask] = total | empty | missing) and the drawn card
// (.pip / .dot for dots, .cell and .cell.on for frame squares), then tap the number chip named by the answer.
// Round 1, card 1: waits for the card to turn face down (.flip.shut) and taps "Peek again" to see it open.
// Round 2, card 1: taps a wrong chip twice; checks the gentle nudge (.banner.try) and that the second miss
// glows (.num.glow) the right chip without moving on. A question is done when the round dot, the card trail
// (.trail i.now) or data-ask changes.
// Relies on: .a-quick-peek .board[data-ask]/.flip/.pip/.dot/.cell/.trail/.num, "Peek again" button,
// shared .dots, .banner and .overlay. If the game's markup changes, update the selectors below.
import { test, expect } from '@playwright/test';
import { watchErrors, currentDot } from '../helpers.js';

const ID = 'quick-peek';

test(`playthrough: ${ID}`, async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'play-throughs run on desktop');
  test.setTimeout(300_000);
  const errors = watchErrors(page);
  await page.goto(`./#/play/${ID}`);

  const root = page.locator(`.a-${ID}`);
  const board = root.locator('.board');
  const flip = root.locator('.flip');
  const chip = (n) => root.getByRole('button', { name: String(n), exact: true });

  // Where we are: round dot, card in the round, and what is asked.
  const where = () =>
    page.evaluate((id) => {
      const b = document.querySelector(`.a-${id} .board`);
      const t = [...document.querySelectorAll(`.a-${id} .trail i`)].findIndex((i) => i.classList.contains('now'));
      const d = [...document.querySelectorAll('.dots .dot')].findIndex((x) => x.classList.contains('now'));
      return `${d}/${t}/${b?.dataset.ask}`;
    }, ID);
  // The right answer, read from the drawn card.
  const answer = () =>
    page.evaluate((id) => {
      const q = (s) => document.querySelectorAll(`.a-${id} .flip ${s}`).length;
      const ask = document.querySelector(`.a-${id} .board`).dataset.ask;
      return ask === 'total' ? q('.pip') + q('.dot') : q('.cell') - q('.cell.on');
    }, ID);

  for (let r = 0; r < 5; r++) {
    await expect.poll(() => currentDot(page), { timeout: 30_000 }).toBe(r);
    const cards = await root.locator('.trail i').count();
    const questions = r === 2 ? cards * 2 : cards;

    for (let q = 0; q < questions; q++) {
      await expect(board).toHaveAttribute('data-ask', /total|empty|missing/);
      const before = await where();
      const ans = await answer();
      expect(ans).toBeGreaterThanOrEqual(1);

      if (r === 0 && q === 0) {
        // The card opens for a quick look, then turns over; peek again.
        await expect(flip).not.toHaveClass(/shut/, { timeout: 10_000 });
        await expect(flip).toHaveClass(/shut/, { timeout: 10_000 });
        await root.getByRole('button', { name: 'Peek again' }).click();
        await expect(flip).not.toHaveClass(/shut/);
      }
      if (r === 1 && q === 0) {
        const miss = ans === 5 ? 4 : ans + 1;
        await chip(miss).click();
        await expect(page.locator('.banner.try')).toBeVisible();
        await chip(miss).click();
        await expect(root.locator('.num.glow')).toHaveText(String(ans));
        expect(await where()).toBe(before);
      }

      await chip(ans).click();
      await expect
        .poll(async () => (await page.locator('.overlay').count()) > 0 || (await where()) !== before, {
          timeout: 30_000,
        })
        .toBe(true);
    }
  }

  await expect(page.locator('.overlay')).toBeVisible({ timeout: 30_000 });
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('nilaa:resume') || '{}'));
  expect(saved[ID]).toBeUndefined();
  expect(errors).toEqual([]);
});
