// UX-ACCOMMODATION-SEARCH-BAR-1 — validation visuelle réelle en Chromium
// (light/dark, desktop/mobile) du VRAI composant de production
// `ManageAccommodationsPage.jsx`, bundlé en mémoire (esbuild) avec ses seuls
// services réseau/contexte auth stubbés — jamais une réimplémentation du
// composant. Charge le vrai CSS compilé de production (Tailwind +
// dashboard.css) pour une preuve fidèle du mécanisme dark mode déjà en place.
//
// Ces tests SAUVEGARDENT des captures pour inspection visuelle humaine
// (server/docs/UX_ACCOMMODATION_SEARCH_BAR1_VISUAL_VALIDATION.md).
import { test, expect } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';
import esbuild from 'esbuild';
import { FIXTURE_ACCOMMODATIONS } from './fixtures.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CLIENT_ROOT = path.join(__dirname, '..', '..');
const SCREENSHOT_DIR = path.join(__dirname, 'screenshots');
fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

const stub = (contents) => ({
  name: 'accommodations-visual-stub',
  setup(build) {
    build.onResolve({ filter: /\/services\/accommodationService$/ }, () => ({ path: 'accsb1-stub:accommodationService', namespace: 'accsb1-stub' }));
    build.onResolve({ filter: /\/services\/dashboardAnalyticsService$/ }, () => ({ path: 'accsb1-stub:dashboardAnalyticsService', namespace: 'accsb1-stub' }));
    build.onResolve({ filter: /\/context\/AuthContext$/ }, () => ({ path: 'accsb1-stub:AuthContext', namespace: 'accsb1-stub' }));
    build.onResolve({ filter: /MapLeaflet$/ }, () => ({ path: 'accsb1-stub:MapLeaflet', namespace: 'accsb1-stub' }));
    build.onResolve({ filter: /^next\/image$/ }, () => ({ path: 'accsb1-stub:next-image', namespace: 'accsb1-stub' }));
    build.onResolve({ filter: /^next\/link$/ }, () => ({ path: 'accsb1-stub:next-link', namespace: 'accsb1-stub' }));
    build.onResolve({ filter: /^@\// }, (args) => {
      const base = path.join(CLIENT_ROOT, args.path.slice(2));
      const candidate = ['', '.js', '.jsx', '.ts', '.tsx'].map((ext) => `${base}${ext}`).find((p) => fs.existsSync(p));
      return { path: candidate || base };
    });
    build.onLoad({ filter: /.*/, namespace: 'accsb1-stub' }, (args) => {
      if (args.path === 'accsb1-stub:accommodationService') return { contents: contents.accommodationService, loader: 'js' };
      if (args.path === 'accsb1-stub:dashboardAnalyticsService') return { contents: contents.dashboardAnalyticsService, loader: 'js' };
      if (args.path === 'accsb1-stub:AuthContext') return { contents: contents.authContext, loader: 'js' };
      if (args.path === 'accsb1-stub:MapLeaflet') return { contents: 'export default function MapLeaflet() { return null; }', loader: 'js' };
      if (args.path === 'accsb1-stub:next-image') {
        return { contents: 'export default function Image({src, alt, fill, sizes, ...rest}) { return <img src={src} alt={alt} {...rest} />; }', loader: 'jsx', resolveDir: CLIENT_ROOT };
      }
      if (args.path === 'accsb1-stub:next-link') {
        return { contents: 'export default function Link({href, children, ...rest}) { return <a href={href} {...rest}>{children}</a>; }', loader: 'jsx', resolveDir: CLIENT_ROOT };
      }
      return null;
    });
  },
});

let BUNDLE;
let PROD_CSS;

test.beforeAll(async () => {
  const fixturesJson = JSON.stringify(FIXTURE_ACCOMMODATIONS);
  const accommodationServiceStub = `
    const ACCOMMODATIONS = ${fixturesJson};
    export const getAccommodationsAdmin = async (params) => {
      let list = ACCOMMODATIONS;
      if (params?.search) list = list.filter(a => a.property.title.toLowerCase().includes(String(params.search).toLowerCase()));
      if (params?.city) list = list.filter(a => a.property.address.city.toLowerCase().includes(String(params.city).toLowerCase()));
      if (params?.availability) list = list.filter(a => a.property.availability === params.availability);
      if (params?.type && params.type !== 'tous') list = list.filter(a => a.accommodationType === params.type);
      return { accommodations: list, total: list.length, page: 1, limit: 20 };
    };
    export const deactivateAccommodation = async () => {};
    export const createFullAccommodation = async () => {};
    export const updateFullAccommodation = async () => {};
    export const getHotels = async () => [];
    export const getHotel = async () => null;
  `;
  const dashboardAnalyticsServiceStub = `
    export const getDashboardAnalytics = async () => ({ kpis: { total: 3, published: 3, unavailable: 0, maintenance: 1, reservationsToday: 0, checkInsToday: 0, checkOutsToday: 0, occupancyRate: 42 } });
  `;
  const authContextStub = "export const useAuth = () => ({ user: { _id: 'me', name: 'Admin Test', role: 'Admin' }, canEdit: true });";

  const result = await esbuild.build({
    entryPoints: [path.join(__dirname, 'mountAccommodations.entry.jsx')],
    bundle: true,
    format: 'iife',
    loader: { '.jsx': 'jsx' },
    jsx: 'automatic',
    write: false,
    logLevel: 'silent',
    define: { 'process.env.NODE_ENV': '"development"', 'process.env': '{}' },
    plugins: [stub({ accommodationService: accommodationServiceStub, dashboardAnalyticsService: dashboardAnalyticsServiceStub, authContext: authContextStub })],
  });
  BUNDLE = result.outputFiles[0].text;

  const cssDir = path.join(CLIENT_ROOT, '.next/static/css');
  PROD_CSS = fs.readdirSync(cssDir)
    .filter((f) => f.endsWith('.css'))
    .map((f) => fs.readFileSync(path.join(cssDir, f), 'utf8'))
    .join('\n');
});

async function mountAccommodations(page) {
  await page.setContent('<!DOCTYPE html><html><body><div class="dashboard-shell"><div class="dashboard-content-inner"><div id="root"></div></div></div></body></html>');
  await page.addStyleTag({ content: PROD_CSS });
  await page.addScriptTag({ content: BUNDLE });
  await page.evaluate(() => window.mountAccommodations());
  await page.getByText('Villa Bacongo').first().waitFor();
}

test.describe('Hébergements — toolbar compacte, validation visuelle réelle (UX-ACCOMMODATION-SEARCH-BAR-1)', () => {
  test('desktop clair — filtres fermés', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.emulateMedia({ colorScheme: 'light' });
    await mountAccommodations(page);
    await expect(page.getByRole('button', { name: 'Filtres' })).toBeVisible();
    await expect(page.getByLabel('Ville')).toHaveCount(0);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'desktop-light-filters-closed.png') });
  });

  test('desktop clair — filtres ouverts avec chips actifs', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.emulateMedia({ colorScheme: 'light' });
    await mountAccommodations(page);
    await page.getByRole('button', { name: 'Filtres' }).click();
    await page.getByLabel('Ville').fill('Brazzaville');
    await page.getByLabel('Disponibilité').selectOption('Maintenance');
    await expect(page.getByRole('button', { name: 'Filtres (2)' })).toBeVisible();
    await expect(page.locator('span.rounded-full', { hasText: 'Brazzaville' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Réinitialiser' })).toBeVisible();
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'desktop-light-filters-open.png') });
  });

  test('desktop sombre — filtres fermés', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.emulateMedia({ colorScheme: 'dark' });
    await mountAccommodations(page);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'desktop-dark-filters-closed.png') });
  });

  test('mobile clair — recherche + Filtres/Ajouter côte à côte', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.emulateMedia({ colorScheme: 'light' });
    await mountAccommodations(page);
    await expect(page.getByPlaceholder('Rechercher un hébergement…')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Filtres' })).toBeVisible();
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'mobile-light.png') });
  });

  test('mobile sombre — recherche + Filtres/Ajouter côte à côte', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.emulateMedia({ colorScheme: 'dark' });
    await mountAccommodations(page);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'mobile-dark.png') });
  });
});
