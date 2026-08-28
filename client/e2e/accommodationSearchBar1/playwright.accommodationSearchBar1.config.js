// UX-ACCOMMODATION-SEARCH-BAR-1 — config Playwright dédiée, même patron que
// client/e2e/inbox2/playwright.inbox2.config.js. Ne démarre PAS la stack e2e
// complète : charge le vrai composant de production bundlé (esbuild, en
// mémoire) plus le vrai CSS compilé de production.
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: '.',
  timeout: 30000,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list']],
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
