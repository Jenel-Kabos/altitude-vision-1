// INBOX-2 — config Playwright dédiée à la validation visuelle réelle de
// l'Inbox, réutilisant l'infrastructure déjà installée (@playwright/test,
// Chromium déjà téléchargé) — même patron que
// client/e2e/security2/playwright.security2.config.js. Ne démarre PAS la
// stack e2e complète (Mongo/Express/Next dev server) : le test charge le
// vrai composant de production bundlé (esbuild, en mémoire) plus le vrai
// CSS compilé de production, pas l'application déployée.
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
