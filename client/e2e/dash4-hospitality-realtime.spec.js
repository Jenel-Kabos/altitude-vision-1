import { test, expect } from './external-network.fixture';

const credentials = { email: 'rental-owner-e2e@example.test', password: 'E2eOwnerRental!2026' };
const HOTEL_A = '66e200000000000000000051';
const HOTEL_B = '66e200000000000000000053';
const FOREIGN_HOTEL = '66e200000000000000000011';
const HOUSE_C = '66e200000000000000000055';

async function login(page) {
  await page.addInitScript(() => localStorage.setItem('cookie_consent', 'refused'));
  await page.goto('/login');
  await page.locator('#email').fill(credentials.email);
  await page.locator('#password').fill(credentials.password);
  await page.getByRole('button', { name: /se connecter/i }).click();
  await expect(page).toHaveURL(/\/mon-espace-proprietaire|\/mes-biens|\/mes-hotels/);
}

test.describe('DASH-4 E2E — propriétaire multi-établissements et deep-links', () => {
  test('portfolio → Hotel A → Hotel B → Maison C et URL directe restaurent le contexte', async ({ page }) => {
    await login(page);
    await page.goto('/mes-hotels');
    await expect(page.getByText('Hôtel Owner A E2E', { exact: true })).toBeVisible();
    await expect(page.getByText('Hôtel Owner B E2E', { exact: true })).toBeVisible();
    await expect(page.getByText('Maison Owner C E2E', { exact: true })).toBeVisible();
    await page.goto(`/mes-hotels/${HOTEL_A}`);
    await expect(page.getByText('Hôtel Owner A E2E', { exact: true }).first()).toBeVisible();
    await page.goto(`/mes-hotels/${HOTEL_B}`);
    await expect(page.getByText('Hôtel Owner B E2E', { exact: true }).first()).toBeVisible();
    await page.goto(`/mes-hebergements/${HOUSE_C}`);
    await expect(page.getByText('Maison Owner C E2E', { exact: true }).first()).toBeVisible();
  });

  test('notification synthétique ouvre directement la maintenance du bon hôtel', async ({ page }) => {
    await login(page);
    await page.getByRole('button', { name: /Notifications/ }).click();
    const scopedRequest = page.waitForRequest((request) => request.url().includes(`/api/maintenance?hotelId=${HOTEL_A}`));
    await page.getByText('Maintenance Hôtel Owner A', { exact: true }).click();
    await expect(page).toHaveURL(`/mes-hotels/${HOTEL_A}/maintenance`);
    await expect(page.getByRole('heading', { name: 'Maintenance', exact: true })).toBeVisible();
    await expect(scopedRequest).resolves.toBeTruthy();
  });

  test('URL d’un hôtel étranger reste sécurisée et n’affiche aucune donnée', async ({ page }) => {
    await login(page);
    await page.goto(`/mes-hotels/${FOREIGN_HOTEL}`);
    await expect(page.getByText(/Établissement introuvable|n’est pas disponible/i).first()).toBeVisible();
    await expect(page.getByText('Hôtel Portefeuille E2E', { exact: true })).toHaveCount(0);
    await page.goto('/mes-hebergements/66e200000000000000000004');
    await expect(page.getByRole('heading', { name: 'Hébergement inaccessible' })).toBeVisible();
    await expect(page.getByText('Villa E2E Brazzaville', { exact: true })).toHaveCount(0);
  });
});
