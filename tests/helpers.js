// Shared helpers for the browser tests.
import { expect } from '@playwright/test';
import { ACTIVITIES } from '../src/content/registry.js';

export { ACTIVITIES };

/** Collect console errors and page errors for a page. */
export function watchErrors(page) {
  const errors = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  page.on('pageerror', (e) => errors.push(`PAGEERROR ${e.message}`));
  return errors;
}

/** Zero-based index of the highlighted ("now") progress dot. */
export const currentDot = (page) =>
  page.evaluate(() => [...document.querySelectorAll('.dots .dot')].findIndex((d) => d.classList.contains('now')));

/** Click Watch and wait until the demo has finished. */
export async function runDemo(page, timeout = 150_000) {
  const watch = page.locator('button.watch');
  await expect(watch).toBeVisible();
  await watch.click();
  await expect(page.locator('.stage.demo-running')).toHaveCount(0, { timeout });
}

export async function expectNoHorizontalScroll(page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 2)).toBe(false);
}

/** Pretend the child left a game on round r (zero-based) of n, then open the game. */
export async function openWithSavedRound(page, id, r, n) {
  await page.goto('./#/');
  await page.evaluate(
    ([id, r, n]) => localStorage.setItem('nilaa:resume', JSON.stringify({ [id]: { r, n } })),
    [id, r, n],
  );
  await page.goto(`./?r=${r}#/play/${id}`);
  await page.reload();
}
