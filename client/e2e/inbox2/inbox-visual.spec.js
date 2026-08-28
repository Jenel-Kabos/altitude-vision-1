// INBOX-2 — validation visuelle réelle en Chromium (light/dark,
// desktop/mobile) du VRAI composant de production `InternalMessagingPage`,
// bundlé en mémoire (esbuild) avec ses seules dépendances externes
// (services réseau, contexte auth, routeur Next) stubbées — jamais une
// réimplémentation du composant lui-même. Charge le vrai CSS compilé de
// production (Tailwind + dashboard.css) pour une preuve fidèle du
// mécanisme de compatibilité dark mode déjà en place
// (`.dashboard-content-inner`, HOTFIX-DASHBOARD-DARK-MODE-UI-1).
//
// Ces tests SAUVEGARDENT des captures pour inspection visuelle humaine
// (server/docs/INBOX2_VISUAL_VALIDATION.md) — ce ne sont pas des tests de
// non-régression par diff de pixels (aucune image de référence n'existe,
// volontairement : la validation de ce sprint EST la première preuve).
import { test, expect } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';
import esbuild from 'esbuild';
import { FIXTURE_MESSAGES, HEIGHT_FIXTURE_MESSAGES } from './fixtures.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CLIENT_ROOT = path.join(__dirname, '..', '..');
const SCREENSHOT_DIR = path.join(__dirname, 'screenshots');
fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

const stub = (contents) => ({
  name: 'inbox2-stub',
  setup(build) {
    build.onResolve({ filter: /\/services\/messageService$/ }, () => ({ path: 'inbox2-stub:messageService', namespace: 'inbox2-stub' }));
    build.onResolve({ filter: /\/services\/userService$/ }, () => ({ path: 'inbox2-stub:userService', namespace: 'inbox2-stub' }));
    build.onResolve({ filter: /\/context\/AuthContext$/ }, () => ({ path: 'inbox2-stub:AuthContext', namespace: 'inbox2-stub' }));
    build.onResolve({ filter: /^next\/navigation$/ }, () => ({ path: 'inbox2-stub:next-navigation', namespace: 'inbox2-stub' }));
    build.onResolve({ filter: /^@\// }, (args) => {
      const base = path.join(CLIENT_ROOT, args.path.slice(2));
      const candidate = ['', '.js', '.jsx', '.ts', '.tsx'].map((ext) => `${base}${ext}`).find((p) => fs.existsSync(p));
      return { path: candidate || base };
    });
    build.onLoad({ filter: /.*/, namespace: 'inbox2-stub' }, (args) => {
      if (args.path === 'inbox2-stub:messageService') return { contents: contents.messageService, loader: 'js' };
      if (args.path === 'inbox2-stub:userService') return { contents: contents.userService, loader: 'js' };
      if (args.path === 'inbox2-stub:AuthContext') return { contents: contents.authContext, loader: 'js' };
      if (args.path === 'inbox2-stub:next-navigation') {
        return { contents: "export const useRouter = () => ({ push(){}, back(){}, replace(){} }); export const usePathname = () => '/dashboard/messages';", loader: 'js' };
      }
      return null;
    });
  },
});

let BUNDLE;
let PROD_CSS;

test.beforeAll(async () => {
  const fixturesJson = JSON.stringify(FIXTURE_MESSAGES);
  const heightFixturesJson = JSON.stringify(HEIGHT_FIXTURE_MESSAGES);
  const messageServiceStub = `
    const MESSAGES = ${fixturesJson};
    const HEIGHT_MESSAGES = ${heightFixturesJson};
    const activeMessages = () => globalThis.__INBOX_HEIGHT_FIXTURES__ ? HEIGHT_MESSAGES : MESSAGES;
    export const getReceivedMessages = async () => activeMessages();
    export const getSentMessages = async () => [];
    export const getUnreadMessages = async () => MESSAGES.filter(m => !m.isRead);
    export const getStarredMessages = async () => MESSAGES.filter(m => m.isStarred);
    export const getDraftMessages = async () => [];
    export const getTrashedMessages = async () => [];
    export const countUnread = async () => activeMessages().filter(m => !m.isRead).length;
    export const markAsRead = async () => {};
    export const addStar = async () => {};
    export const removeStar = async () => {};
    export const moveToTrash = async () => {};
    export const restoreFromTrash = async () => {};
    export const permanentlyDelete = async () => {};
    export const emptyTrash = async () => {};
    export const saveDraft = async () => {};
    export const updateDraft = async () => {};
    export const deleteDraft = async () => {};
    export const sendInternalMail = async () => {};
    export const previewInternalMailAttachment = async () => {};
    export const fetchInternalMailAttachmentContent = async () => '<p>apercu</p>';
    export const downloadInternalMailAttachment = async () => {};
  `;
  const userServiceStub = 'export const getAllUsers = async () => [];';
  const authContextStub = "export const useAuth = () => ({ user: { _id: 'me', name: 'Moi', role: 'Admin' } });";

  const result = await esbuild.build({
    entryPoints: [path.join(__dirname, 'mountInbox.entry.jsx')],
    bundle: true,
    format: 'iife',
    loader: { '.jsx': 'jsx' },
    jsx: 'automatic',
    write: false,
    logLevel: 'silent',
    plugins: [stub({ messageService: messageServiceStub, userService: userServiceStub, authContext: authContextStub })],
  });
  BUNDLE = result.outputFiles[0].text;

  const cssDir = path.join(CLIENT_ROOT, '.next/static/css');
  PROD_CSS = fs.readdirSync(cssDir)
    .filter((f) => f.endsWith('.css'))
    .map((f) => fs.readFileSync(path.join(cssDir, f), 'utf8'))
    .join('\n');
});

async function mountInbox(page, { heightFixtures = false } = {}) {
  await page.setContent('<!DOCTYPE html><html><body><div class="dashboard-shell"><div class="dashboard-content-inner"><div id="root"></div></div></div></body></html>');
  await page.evaluate((enabled) => { window.__INBOX_HEIGHT_FIXTURES__ = enabled; }, heightFixtures);
  await page.addStyleTag({ content: PROD_CSS });
  await page.addScriptTag({ content: BUNDLE });
  await page.evaluate(() => window.mountInbox());
  // Attend la fin du chargement asynchrone des messages (fixture résolue),
  // indépendamment de la visibilité (mobile/desktop affichent des volets
  // différents à ce stade) — le skeleton de chargement disparaît une fois
  // les données arrivées.
  await page.waitForFunction(() => !document.querySelector('[aria-hidden="true"].animate-pulse'));
}

async function openHeightFixture(page, subject) {
  await page.getByText(subject).first().click();
  await page.getByTestId('email-html-frame').waitFor();
  await page.waitForTimeout(50);
}

async function measureSelectedEmail(page) {
  const outer = await page.evaluate(() => {
    const readingPane = document.querySelector('[data-testid="inbox-message-viewer"]');
    const bodyArea = document.querySelector('[data-testid="inbox-message-body-scroll"]');
    const iframe = document.querySelector('[data-testid="email-html-frame"]');
    const list = document.querySelector('[data-testid="inbox-message-list-scroll"]');
    return {
      readingPaneClientHeight: readingPane.clientHeight,
      bodyAreaClientHeight: bodyArea.clientHeight,
      bodyAreaScrollHeight: bodyArea.scrollHeight,
      bodyAreaOverflowY: getComputedStyle(bodyArea).overflowY,
      iframeClientHeight: iframe.clientHeight,
      sandbox: iframe.getAttribute('sandbox'),
      listOverflowY: getComputedStyle(list).overflowY,
    };
  });
  const emailFrame = page.frames().find((frame) => frame !== page.mainFrame());
  const inner = await emailFrame.evaluate(() => ({
    clientHeight: document.documentElement.clientHeight,
    scrollHeight: document.documentElement.scrollHeight,
    scrollingElement: document.scrollingElement === document.documentElement ? 'html' : 'body',
  }));
  return { ...outer, inner };
}

test.describe('Inbox InternalMail — validation visuelle réelle (INBOX-2)', () => {
  test('IH3 : iframe plein viewport, scroll unique et sandbox inchangé — court/moyen/long', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await mountInbox(page, { heightFixtures: true });

    const results = {};
    for (const [kind, subject] of [
      ['short', 'IH3 — email court'],
      ['medium', 'IH3 — email moyen'],
      ['long', 'IH3 — email long'],
    ]) {
      await openHeightFixture(page, subject);
      results[kind] = await measureSelectedEmail(page);
      expect(results[kind].iframeClientHeight).toBeGreaterThanOrEqual(results[kind].bodyAreaClientHeight - 50);
      expect(results[kind].iframeClientHeight).toBeGreaterThan(500);
      expect(results[kind].bodyAreaScrollHeight).toBe(results[kind].bodyAreaClientHeight);
      expect(results[kind].bodyAreaOverflowY).toBe('hidden');
      expect(results[kind].sandbox).toBe('allow-popups allow-popups-to-escape-sandbox');
      expect(results[kind].sandbox).not.toContain('allow-same-origin');
      expect(results[kind].listOverflowY).toBe('auto');
      expect(results[kind].inner.scrollingElement).toBe('html');
    }

    expect(results.short.inner.scrollHeight).toBeLessThanOrEqual(results.short.inner.clientHeight);
    expect(results.medium.inner.scrollHeight).toBeLessThanOrEqual(results.medium.inner.clientHeight);
    expect(results.long.inner.scrollHeight).toBeGreaterThan(results.long.inner.clientHeight);
    console.info('IH3 desktop layout metrics', JSON.stringify(results));
  });

  test('IH3 : viewport moyen conservé avec DevTools-width et sur mobile', async ({ page }) => {
    for (const viewport of [{ width: 1024, height: 768 }, { width: 390, height: 844 }]) {
      await page.setViewportSize(viewport);
      await mountInbox(page, { heightFixtures: true });
      if (viewport.width < 1024) {
        await page.getByRole('button', { name: /boîte de réception/i }).first().click();
      }
      await openHeightFixture(page, 'IH3 — email moyen');
      const metrics = await measureSelectedEmail(page);
      expect(metrics.iframeClientHeight).toBeGreaterThanOrEqual(metrics.bodyAreaClientHeight - 50);
      expect(metrics.iframeClientHeight).toBeGreaterThan(300);
      expect(metrics.bodyAreaOverflowY).toBe('hidden');
      expect(metrics.sandbox).not.toContain('allow-same-origin');
      console.info(`IH3 ${viewport.width}x${viewport.height} layout metrics`, JSON.stringify(metrics));
    }
  });

  test('desktop clair : liste + panneau de lecture + pièces jointes', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.emulateMedia({ colorScheme: 'light' });
    await mountInbox(page);
    await page.getByText('Facture Bacongo — juillet 2026').first().click();
    await page.getByTestId('email-html-frame').waitFor();
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'desktop-light.png') });
  });

  test('desktop sombre : liste + panneau de lecture + pièces jointes', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.emulateMedia({ colorScheme: 'dark' });
    await mountInbox(page);
    await page.getByText('Facture Bacongo — juillet 2026').first().click();
    await page.getByTestId('email-html-frame').waitFor();
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'desktop-dark.png') });
  });

  test('mobile clair : écran dossiers', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.emulateMedia({ colorScheme: 'light' });
    await mountInbox(page);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'mobile-light-folders.png') });
  });

  test('mobile sombre : écran dossiers', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.emulateMedia({ colorScheme: 'dark' });
    await mountInbox(page);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'mobile-dark-folders.png') });
  });

  test('mobile clair : liste puis lecture plein écran', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.emulateMedia({ colorScheme: 'light' });
    await mountInbox(page);
    await page.getByRole('button', { name: /boîte de réception/i }).first().click();
    await page.getByText('Facture Bacongo — juillet 2026').first().waitFor();
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'mobile-light-list.png') });
    await page.getByText('Facture Bacongo — juillet 2026').first().click();
    await page.getByTestId('email-html-frame').waitFor();
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'mobile-light-detail.png') });
  });

  test('desktop clair : état vide (aucun résultat de recherche)', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.emulateMedia({ colorScheme: 'light' });
    await mountInbox(page);
    await page.getByPlaceholder(/rechercher/i).fill('zzz-aucun-resultat-zzz');
    await expect(page.getByText('Aucun résultat.')).toBeVisible();
  });
});
