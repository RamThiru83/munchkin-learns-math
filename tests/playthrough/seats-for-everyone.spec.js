// Play-through: Seats for Everyone (all 5 rounds, to the finish card).
// Plays like a child: drags friends/stars onto chairs with the mouse, answers "just enough / need more / too many",
// then fixes any gap with "Bring a chair" or by tapping an empty chair. Every move is chosen from the live DOM
// (the puzzles are random).
// Relies on the markup of src/activities/seats-for-everyone.js (update here if it changes):
//   .a-seats .slot (chairs; .tappable.glow = chair that can be put away), .tok (friends and stars, each inside a
//   .home cell; a seated token sits on top of a chair), .tray (stars), .waiting (friends),
//   .choices .opt (answers; no test hooks), .actions .btn (Next / Bring a chair), .overlay (finish card).
import { test, expect } from '@playwright/test';
import { watchErrors, currentDot } from '../helpers.js';

const ID = 'seats-for-everyone';
const ROUNDS = 5;

// Visible tokens and chairs with their centres, and whether each token sits on a chair.
const readBoard = (page) =>
  page.evaluate(() => {
    const centre = (el) => {
      const r = el.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, h: r.height };
    };
    const visible = (el) => !el.closest('[hidden]') && el.getClientRects().length > 0;
    const slots = [...document.querySelectorAll('.a-seats .slot')].filter((s) => !s.classList.contains('away'));
    const slotBoxes = slots.map(centre);
    const onChair = (c) => slotBoxes.findIndex((b) => Math.abs(c.x - b.x) < b.w / 2 && Math.abs(c.y - b.y) < b.h / 2);
    const toks = [...document.querySelectorAll('.a-seats .tok')]
      .filter(visible)
      .map((el) => ({ kind: el.classList.contains('star') ? 'star' : 'animal', ...centre(el) }))
      .map((t) => ({ ...t, seat: onChair(t) }));
    const taken = new Set(toks.filter((t) => t.seat >= 0).map((t) => t.seat));
    return {
      toks,
      chairs: slotBoxes.map((b, i) => ({ ...b, free: !taken.has(i) })),
    };
  });

// Drag from one point to another with the real mouse, in small steps.
async function dragMouse(page, from, to) {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move((from.x + to.x) / 2, (from.y + to.y) / 2, { steps: 5 });
  await page.mouse.move(to.x, to.y, { steps: 5 });
  await page.mouse.up();
}

test(`playthrough: ${ID}`, async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'play-throughs run on desktop');
  test.setTimeout(300_000);
  const errors = watchErrors(page);

  await page.goto(`./#/play/${ID}`);
  await expect(page.locator('.a-seats .slot').first()).toBeVisible();
  await expect(page.locator('.a-seats .tok').first()).toBeVisible();

  const next = page.locator('.actions .btn.primary', { hasText: 'Next' });
  const bring = page.locator('.actions .btn[aria-label="Bring a chair"]');
  const choices = page.locator('.choices:not([hidden]) .opt');
  const putAway = page.locator('.slot.tappable.glow');
  const overlay = page.locator('.overlay');

  let round = 0;
  const deadline = Date.now() + 270_000;
  while (!(await overlay.isVisible())) {
    expect(Date.now(), 'play-through ran out of time').toBeLessThan(deadline);

    if (await next.isVisible()) {
      await next.click();
      round++;
      await expect.poll(() => currentDot(page)).toBe(round);
      continue;
    }
    if (await bring.isVisible()) {
      await bring.click();
      await page.waitForTimeout(600);
      continue;
    }
    if (await choices.first().isVisible()) {
      // Read the board like a child: someone standing, or an empty chair, or neither.
      const b = await readBoard(page);
      const standing = b.toks.some((t) => t.kind === 'animal' && t.seat < 0);
      const empty = b.chairs.some((c) => c.free);
      const label = standing ? 'We need more chairs' : empty ? 'There are too many chairs' : 'Just enough chairs';
      await page.locator(`.choices:not([hidden]) .opt[aria-label="${label}"]`).click();
      await page.waitForTimeout(1500);
      continue;
    }
    if (await putAway.first().isVisible()) {
      await putAway.first().click();
      await page.waitForTimeout(900);
      continue;
    }

    // Otherwise move one loose token (stars first, while the tray is out) onto a free chair.
    const b = await readBoard(page);
    const loose = b.toks.filter((t) => t.seat < 0);
    const stars = loose.filter((t) => t.kind === 'star');
    const tok = (stars.length ? stars : loose)[0];
    const chair = b.chairs.find((c) => c.free);
    if (tok && chair) {
      await dragMouse(page, tok, chair);
      await page.waitForTimeout(700);
    } else {
      await page.waitForTimeout(400);
    }
  }

  expect(round).toBe(ROUNDS - 1);
  await expect(overlay).toBeVisible();
  const saved = await page.evaluate((id) => JSON.parse(localStorage.getItem('nilaa:resume') || '{}')[id] ?? null, ID);
  expect(saved).toBeNull();
  expect(errors).toEqual([]);
});
