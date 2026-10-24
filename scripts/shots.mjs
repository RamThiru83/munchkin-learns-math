// Takes a picture of every game's first round for the home page: img/games/<id>.png (then made small by
// scripts/shots-small.py). Run after changing how a game's first round looks:
//   PORT=8790 node scripts/serve.mjs &  node scripts/shots.mjs   (CHROME=/path/to/chromium optional)
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { ACTIVITIES } from '../src/content/registry.js';

const PORT = Number(process.env.PORT || 8790);
const out = new URL('../img/games/raw/', import.meta.url).pathname;
mkdirSync(out, { recursive: true });
const browser = await chromium.launch(
  process.env.CHROME ? { executablePath: process.env.CHROME, args: ['--no-sandbox'] } : {},
);
const ctx = await browser.newContext({ viewport: { width: 1024, height: 768 }, deviceScaleFactor: 1 });
await ctx.addInitScript(() => {
  localStorage.setItem('nilaa:voice', 'false');
  localStorage.setItem('nilaa:fasttests', '1');
});
const only = process.argv.slice(2);
for (const { id } of ACTIVITIES) {
  if (only.length && !only.includes(id)) continue;
  const page = await ctx.newPage();
  await page.goto(`http://localhost:${PORT}/src/#/play/${id}`);
  await page.locator('.dots .dot').first().waitFor();
  await page.waitForTimeout(Number(process.env.WAIT || 3500));
  await page.locator('.stage').screenshot({ path: `${out}${id}.png` });
  await page.close();
  console.log(id);
}
await browser.close();
