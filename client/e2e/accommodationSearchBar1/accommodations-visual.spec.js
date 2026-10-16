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
import { buildAppCss } from '../support/appCss';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';
import esbuild from 'esbuild';
import { FIXTURE_ACCOMMODATIONS } from './fixtures.js';

// F-U2.15 — banc visuel monté par setContent (sans <meta viewport>) : le rendu
// ne doit pas dépendre du projet Playwright. Sous l'émulation Pixel 5
// (mobile-chromium : isMobile, DPR 2,75), Chromium appliquait un viewport de
// mise en page de 980 px et écrasait les captures de référence par une vue
// desktop réduite. Contexte fixé ici (DPR 1, sans émulation mobile/tactile),
// identique à celui des références ; les formats desktop/mobile restent fixés
// par setViewportSize dans chaque test, exécuté dans les deux projets.
test.use({ isMobile: false, hasTouch: false, deviceScaleFactor: 1 });

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
    build.onResolve({ filter: /\/context\/PlatformTenantRuntimeContext$/ }, () => ({ path: 'accsb1-stub:PlatformTenantRuntimeContext', namespace: 'accsb1-stub' }));
    build.onResolve({ filter: /MapLeaflet$/ }, () => ({ path: 'accsb1-stub:MapLeaflet', namespace: 'accsb1-stub' }));
    build.onResolve({ filter: /^next\/image$/ }, () => ({ path: 'accsb1-stub:next-image', namespace: 'accsb1-stub' }));
    build.onResolve({ filter: /^next\/link$/ }, () => ({ path: 'accsb1-stub:next-link', namespace: 'accsb1-stub' }));
    // F-U2.14 — `useRouter` (next/navigation) exige le routeur App Router, absent
    // de ce banc isolé (« invariant expected app router to be mounted »).
    build.onResolve({ filter: /^next\/navigation$/ }, () => ({ path: 'accsb1-stub:next-navigation', namespace: 'accsb1-stub' }));
    build.onResolve({ filter: /^@\// }, (args) => {
      const base = path.join(CLIENT_ROOT, args.path.slice(2));
      const candidate = ['', '.js', '.jsx', '.ts', '.tsx'].map((ext) => `${base}${ext}`).find((p) => fs.existsSync(p));
      return { path: candidate || base };
    });
    build.onLoad({ filter: /.*/, namespace: 'accsb1-stub' }, (args) => {
      if (args.path === 'accsb1-stub:accommodationService') return { contents: contents.accommodationService, loader: 'js' };
      if (args.path === 'accsb1-stub:dashboardAnalyticsService') return { contents: contents.dashboardAnalyticsService, loader: 'js' };
      if (args.path === 'accsb1-stub:AuthContext') return { contents: contents.authContext, loader: 'js' };
      if (args.path === 'accsb1-stub:PlatformTenantRuntimeContext') return { contents: contents.tenantRuntime, loader: 'js' };
      if (args.path === 'accsb1-stub:MapLeaflet') return { contents: 'export default function MapLeaflet() { return null; }', loader: 'js' };
      if (args.path === 'accsb1-stub:next-image') {
        return { contents: 'export default function Image({src, alt, fill, sizes, ...rest}) { return <img src={src} alt={alt} {...rest} />; }', loader: 'jsx', resolveDir: CLIENT_ROOT };
      }
      if (args.path === 'accsb1-stub:next-navigation') {
        return { contents: "export const useRouter = () => ({ push() {}, replace() {}, back() {}, refresh() {}, prefetch() {} }); export const usePathname = () => '/dashboard/hebergements'; export const useSearchParams = () => new URLSearchParams();", loader: 'js' };
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
  // F-U2.14 — depuis 38001d0 la page est fail-closed hors contexte résolu
  // (scope « unresolved » → liste vide). Le banc fournit explicitement le
  // contexte d'une organisation administrée (rôle métier Admin), comme l'app
  // réelle sous PlatformTenantRuntimeProvider ; aucun comportement n'est assoupli.
  const tenantRuntimeStub = "export const usePlatformTenantRuntime = () => ({ scope: { mode: 'tenant', tenantId: 'tenant-visual', key: 'tenant:tenant-visual' }, can: () => false, tenantBusinessRole: 'Admin' }); export const PlatformTenantRuntimeProvider = ({ children }) => children;";

  const result = await esbuild.build({
    entryPoints: [path.join(__dirname, 'mountAccommodations.entry.jsx')],
    bundle: true,
    format: 'iife',
    loader: { '.jsx': 'jsx' },
    jsx: 'automatic',
    write: false,
    logLevel: 'silent',
    define: { 'process.env.NODE_ENV': '"development"', 'process.env': '{}' },
    plugins: [stub({ accommodationService: accommodationServiceStub, dashboardAnalyticsService: dashboardAnalyticsServiceStub, authContext: authContextStub, tenantRuntime: tenantRuntimeStub })],
  });
  BUNDLE = result.outputFiles[0].text;

  // F-U2.14 — CSS applicatif compilé avec la configuration réelle du projet
  // (mêmes sources et règles que le build de production), indépendamment du
  // dossier `.next` que le serveur E2E (`next dev`) réécrit.
  PROD_CSS = await buildAppCss(CLIENT_ROOT);
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
