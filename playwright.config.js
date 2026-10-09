// Browser tests. `npm test` runs every game at desktop and phone size.
//   TARGET=built npm test   -> test the built index.html instead of the source in src/
//   CHROME=/path/to/chrome  -> use an existing Chromium instead of Playwright's download
//   npx playwright test -g dice-race   -> one game only
import { defineConfig, devices } from '@playwright/test';

const PORT = Number(process.env.TEST_PORT || 8765);
const path = process.env.TARGET === 'built' ? '/' : '/src/';
const launchOptions = process.env.CHROME ? { executablePath: process.env.CHROME, args: ['--no-sandbox'] } : {};

export default defineConfig({
  testDir: 'tests',
  timeout: 360_000,
  fullyParallel: true,
  workers: process.env.CI ? 2 : 6,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: { baseURL: `http://localhost:${PORT}${path}`, launchOptions },
  projects: [
    { name: 'desktop', use: { viewport: { width: 1024, height: 768 } } },
    { name: 'phone', use: { ...devices['Pixel 5'], viewport: { width: 390, height: 780 }, launchOptions } },
  ],
  webServer: {
    command: `node scripts/serve.mjs`,
    env: { PORT: String(PORT) },
    url: `http://localhost:${PORT}/src/`,
    reuseExistingServer: !process.env.CI,
  },
});
