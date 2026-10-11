// Random play (taps and drags) to reach "try again" lines, for the voice plan. Usage: node scripts/voice/fuzz.mjs <port> <actionsPerRound> [ids...]
import { chromium } from '@playwright/test';
import { ACTIVITIES } from '../../src/content/registry.js';

const PORT = process.argv[2];
const N = Number(process.argv[3] || 60);
const ids = process.argv.slice(4).length ? process.argv.slice(4) : ACTIVITIES.map((a) => a.id);
const browser = await chromium.launch({
  args: ['--no-sandbox'],
  ...(process.env.CHROME ? { executablePath: process.env.CHROME } : {}),
});

async function one(id, r, vp) {
  const page = await browser.newPage({ viewport: vp });
  page.setDefaultTimeout(4000);
  try {
    await page.goto(`http://localhost:${PORT}/src/#/`);
    await page.evaluate(
      ([id, r]) => localStorage.setItem('nilaa:resume', JSON.stringify({ [id]: { r, n: 5 } })),
      [id, r],
    );
    await page.goto(`http://localhost:${PORT}/src/?f=${r}#/play/${id}`);
    await page.reload();
    if (r > 0) await page.click('[data-resume=continue]').catch(() => {});
    await page.waitForTimeout(400);
    for (let i = 0; i < N; i++) {
      const pts = await page.evaluate(() => {
        const st = document.querySelector('.stage');
        if (!st) return [];
        const els = [...st.querySelectorAll('*')].filter((e) => {
          const b = e.getBoundingClientRect();
          return b.width > 8 && b.height > 8 && b.width < innerWidth * 0.9 && b.bottom > 0 && b.top < innerHeight;
        });
        const pick = () => {
          const e = els[Math.floor(Math.random() * els.length)];
          const b = e.getBoundingClientRect();
          return [b.left + b.width * (0.3 + Math.random() * 0.4), b.top + b.height * (0.3 + Math.random() * 0.4)];
        };
        return els.length ? [pick(), pick()] : [];
      });
      if (!pts.length) break;
      const [a, b] = pts;
      if (Math.random() < 0.6) await page.mouse.click(a[0], a[1]);
      else {
        await page.mouse.move(a[0], a[1]);
        await page.mouse.down();
        await page.mouse.move((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, { steps: 4 });
        await page.mouse.move(b[0], b[1], { steps: 4 });
        await page.mouse.up();
      }
      await page.waitForTimeout(120);
      if (!page.url().includes('/play/')) break;
    }
  } catch {
    /* keep going */
  }
  await page.close();
}

const jobs = [];
for (const id of ids) for (let r = 0; r < 5; r++) jobs.push([id, r]);
let k = 0;
async function worker() {
  while (k < jobs.length) {
    const [id, r] = jobs[k++];
    await one(id, r, Math.random() < 0.5 ? { width: 1024, height: 768 } : { width: 390, height: 780 });
  }
}
await Promise.all([1, 2, 3].map(worker));
await browser.close();
console.log('fuzz done', jobs.length);
