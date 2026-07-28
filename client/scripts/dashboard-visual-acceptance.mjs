// Recette visuelle automatisée du dashboard (Sprint Dashboard UI.1).
// Playwright-core piloté directement (pas de vraie session/API — toutes les requêtes
// vers le backend sont interceptées et satisfaites par une fixture vide), afin de
// vérifier uniquement le rendu du shell partagé (structure, thèmes, responsive,
// reduced motion) sans dépendre de données réelles ni toucher la prod.
import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright-core';

const BASE = process.env.VISUAL_BASE || 'http://localhost:3000';
const OUT = process.env.VISUAL_OUT || '/tmp/dashboard-ui-evidence';
const NAV_TIMEOUT = 15000;
const viewports = [
  ['desktop', 1440, 900], ['laptop', 1280, 800], ['tablet', 768, 1024], ['mobile', 390, 844],
];
const routes = [
  '/dashboard', '/dashboard/properties', '/dashboard/properties?status=vente', '/dashboard/properties/add',
  '/dashboard/my-properties', '/dashboard/hebergements', '/dashboard/estimations', '/dashboard/devis',
  '/dashboard/visites', '/dashboard/paiements', '/dashboard/proprietaires', '/dashboard/transactions',
  '/dashboard/gestion-locative', '/dashboard/gestion-locative/baux', '/dashboard/gestion-locative/locataires',
  '/dashboard/gestion-locative/paiements', '/dashboard/gestion-locative/preavis', '/dashboard/gestion-locative/maintenance',
  '/dashboard/documents', '/dashboard/hotels', '/dashboard/hotels/test-hotel',
  '/dashboard/hotels/test-hotel/room-categories', '/dashboard/hotels/test-hotel/rates',
  '/dashboard/hotels/test-hotel/rooms', '/dashboard/hotels/test-hotel/staff', '/dashboard/hotels/test-hotel/inventory',
  '/dashboard/hotel-reservations', '/dashboard/hotel-rooms', '/dashboard/housekeeping', '/dashboard/maintenance',
  '/dashboard/hotel-finance', '/dashboard/events', '/dashboard/altcom', '/dashboard/quotes',
  '/dashboard/publicites', '/dashboard/export-marketing', '/dashboard/moderation/properties',
  '/dashboard/moderation/hebergement', '/dashboard/moderation/hotellerie', '/dashboard/moderation/reviews',
  '/dashboard/users', '/dashboard/active-sessions', '/dashboard/historique', '/dashboard/litiges',
  '/dashboard/messages', '/dashboard/contact-messages', '/dashboard/conversations', '/dashboard/emails',
  '/dashboard/notifications',
];
const evidenceRoutes = new Map([
  ['/dashboard/properties', 'all-properties'], ['/dashboard/hotels', 'hotels'],
  ['/dashboard/hotels/test-hotel/inventory', 'hotel-calendar'], ['/dashboard/users', 'users'],
  ['/dashboard/gestion-locative/locataires', 'rental-tenants'], ['/dashboard/documents', 'documents'],
  ['/dashboard/housekeeping', 'housekeeping'], ['/dashboard/messages', 'messages'],
]);

const emptyArrays = ['properties', 'hotels', 'users', 'owners', 'reservations', 'rooms', 'documents',
  'conversations', 'messages', 'tasks', 'tickets', 'events', 'quotes', 'estimations', 'visites',
  'reviews', 'litiges', 'notifications', 'sessions', 'logs', 'roomCategories', 'rates', 'staff',
  'inventory', 'contacts', 'emails', 'days', 'locataires', 'dossiers', 'baux', 'paiements', 'preavis',
  'maintenances', 'requests', 'items', 'results', 'records', 'entries', 'list'];
const emptyObj = Object.fromEntries(emptyArrays.map((k) => [k, []]));
const fixtureBody = JSON.stringify({
  status: 'success', success: true, total: 0, count: 0, stats: {}, hotel: null, ...emptyObj,
  data: { ...emptyObj, total: 0, count: 0, stats: {}, hotel: null, pagination: { page: 1, pages: 1, total: 0 } },
});
const sessionBody = JSON.stringify({
  user: { id: 'visual-admin', name: 'Admin Recette', email: 'visual@example.test', role: 'Admin' },
  accessToken: 'visual-token', expires: '2099-01-01T00:00:00.000Z',
});
const authInit = `localStorage.setItem('user', JSON.stringify({_id:'visual-admin',name:'Admin Recette',email:'visual@example.test',role:'Admin',isEmailVerified:true,isActive:true})); localStorage.setItem('token','visual-token');`;

await fs.mkdir(OUT, { recursive: true });

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
context.setDefaultTimeout(NAV_TIMEOUT);
context.setDefaultNavigationTimeout(NAV_TIMEOUT);
await context.addInitScript(authInit);
await context.route('**/api/auth/session', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: sessionBody }));
await context.route('https://altitude-vision.onrender.com/api/**', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: fixtureBody }));
await context.route('http://localhost:5000/api/**', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: fixtureBody }));

const page = await context.newPage();

const results = [];
const selectedRoutes = process.env.VISUAL_ROUTE ? [process.env.VISUAL_ROUTE] : process.env.VISUAL_SMOKE ? routes.slice(0, 1) : routes;

for (const route of selectedRoutes) {
  try {
    await page.goto(`${BASE}${route}`, { waitUntil: 'domcontentloaded', timeout: NAV_TIMEOUT }).catch(() => {});
    await page.locator(
      '.dashboard-shell .dashboard-content-inner h1, .dashboard-shell .dashboard-content-inner h2, '
      + '.dashboard-shell .dashboard-content-inner [role=status], .dashboard-shell .dashboard-content-inner [role=alert]',
    ).first().waitFor({ state: 'attached', timeout: 5000 }).catch(() => {});

    for (const [viewport, width, height] of viewports) {
      for (const theme of ['light', 'dark']) {
        for (const motion of ['normal', 'reduce']) {
          await page.setViewportSize({ width, height });
          await page.emulateMedia({ colorScheme: theme, reducedMotion: motion === 'reduce' ? 'reduce' : 'no-preference' });
          await page.waitForTimeout(80);
          const evalResult = await page.evaluate(() => ({
            path: location.pathname + location.search,
            title: document.querySelector('h1,h2')?.textContent?.trim() || '',
            body: document.body.innerText.slice(0, 300),
            overflow: document.documentElement.scrollWidth > window.innerWidth + 2,
            focusables: document.querySelectorAll('a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled])').length,
            shell: !!document.querySelector('.dashboard-shell'),
            error: /Application error|Unhandled Runtime Error|Internal Server Error|Une erreur est survenue/.test(document.body.innerText),
          })).catch((err) => ({ path: route, title: '', body: '', overflow: false, focusables: 0, shell: false, error: true, evalError: err.message }));
          results.push({ route, viewport, width, height, theme, motion, ...evalResult });

          if (evidenceRoutes.has(route) && ((viewport === 'desktop' && theme === 'light' && motion === 'normal') || (viewport === 'mobile' && theme === 'dark' && motion === 'reduce'))) {
            await page.waitForTimeout(400); // laisse l'animation d'entrée (320ms) se terminer avant la capture
            const suffix = viewport === 'mobile' ? 'mobile-dark-reduced' : 'desktop-light';
            await page.screenshot({ path: path.join(OUT, `${evidenceRoutes.get(route)}-${suffix}.png`) }).catch(() => {});
          }
        }
      }
    }
  } catch (err) {
    results.push({ route, viewport: null, width: null, height: null, theme: null, motion: null, path: route, title: '', body: '', overflow: false, focusables: 0, shell: false, error: true, scriptError: err.message });
  }
}

await fs.writeFile(path.join(OUT, 'results.json'), JSON.stringify(results, null, 2));
const summary = {
  routes: routes.length, checks: results.length,
  runtimeErrors: results.filter((r) => r.error).length,
  missingShell: results.filter((r) => !r.shell).length,
  globalOverflows: results.filter((r) => r.overflow).length,
  redirects: results.filter((r) => r.path !== r.route).length,
  untitled: results.filter((r) => !r.title).length,
  evidence: (await fs.readdir(OUT)).filter((name) => name.endsWith('.png')),
};
await fs.writeFile(path.join(OUT, 'summary.json'), JSON.stringify(summary, null, 2));
console.log(JSON.stringify(summary, null, 2));

await context.close();
await browser.close();
