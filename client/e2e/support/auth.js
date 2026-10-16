// F-U2.14 — Connexion par l'interface, sans dépendre du moment de
// l'hydratation React : la page est attendue interactive (réseau au repos,
// `next dev` compilant à la volée), puis la réponse de l'API de connexion est
// EXIGÉE (échec explicite si le clic n'a déclenché aucune requête, au lieu
// d'un blocage silencieux sur /login).
import { expect } from '@playwright/test';

export const E2E_TENANT_ID = '66e200000000000000000044'; // « Tenant E2E » (server/scripts/start-accommodation-e2e.js)

export async function loginThroughUi(page, credentials) {
  await page.goto('/login');
  await page.waitForLoadState('networkidle');
  await page.locator('#email').fill(credentials.email);
  await page.locator('#password').fill(credentials.password);
  const [response] = await Promise.all([
    page.waitForResponse((r) => /\/api\/users\/login$/.test(new URL(r.url()).pathname) && r.request().method() === 'POST'),
    page.getByRole('button', { name: /se connecter/i }).click(),
  ]);
  expect(response.status(), 'réponse de l’API de connexion').toBe(200);
  // La navigation post-connexion (router.replace) peut déclencher la première
  // compilation à la demande de la page cible par `next dev` (mesuré : /dashboard
  // 4 980 modules en 19,4 s) — au-delà du délai d'assertion de 10 s. Borne
  // explicite, limitée à cette navigation ; un échec reste un échec.
  await page.waitForURL((url) => !/^\/login/.test(url.pathname), { timeout: 60000 });
  const consent = page.getByRole('button', { name: 'Tout accepter', exact: true });
  if (await consent.isVisible().catch(() => false)) await consent.click();
  return page.evaluate(() => localStorage.getItem('token'));
}
