// HOTFIX-INBOX-SECURITY-2 — FINAL CERTIFICATION
// Config Playwright dédiée à la validation navigateur réel de ce hotfix
// uniquement. Réutilise l'infrastructure déjà installée (@playwright/test,
// Chromium déjà téléchargé) SANS démarrer la stack e2e complète
// (MongoMemoryReplSet + Express + Next dev server, cf. ../../playwright.config.js)
// qui n'est pas nécessaire ici : le test charge un bundle statique du
// composant de production réel, pas l'application déployée.
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
