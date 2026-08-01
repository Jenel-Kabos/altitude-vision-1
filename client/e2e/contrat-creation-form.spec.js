import { expect, test } from '@playwright/test';

// REG-GL-1.1 — Deux incompatibilités frontend/backend empêchaient toute
// création de contrat manuelle depuis GestionLocativePage.jsx :
// (1) sélectionner un "bien propre" (Proprietaire.biensPropres[], sans
//     document Property réel) laissait `bien` vide → 400
//     INVALID_CONTRACT_INPUT ("Le bien et le type de contrat sont
//     requis.") — cette option n'est plus sélectionnable dans le formulaire.
// (2) sélectionner un bien réel du portefeuille copiait Property.address
//     (un objet {street, neighborhood, arrondissement, city}) tel quel
//     dans Contrat.adresseBien (un champ String) → CastError Mongoose.
const admin = { email: 'owner-e2e@example.test', password: 'E2eOwner!2026' };
test.setTimeout(120000);

async function login(page) {
  await page.goto('/login');
  await page.locator('#email').fill(admin.email);
  await page.locator('#password').fill(admin.password);
  await page.getByRole('button', { name: /se connecter/i }).click();
  await expect(page).not.toHaveURL(/\/login/);
  const consent = page.getByRole('button', { name: 'Tout accepter', exact: true });
  if (await consent.isVisible().catch(() => false)) await consent.click();
}

test('option "bien propre" non sélectionnable dans le formulaire de contrat', async ({ page }) => {
  await login(page);
  await page.goto('/dashboard/gestion-locative');
  await page.getByRole('button', { name: /nouveau contrat/i }).click();

  const proprietaireSelect = page.locator('label:text("Propriétaire")').locator('xpath=following-sibling::select');
  const proprietaireOptionText = await proprietaireSelect.locator('option', { hasText: 'BienPropre' }).textContent();
  await proprietaireSelect.selectOption({ label: proprietaireOptionText });

  const bienSelect = page.locator('label:text("Bien immobilier")').locator('xpath=following-sibling::select');
  await expect(bienSelect.locator('option', { hasText: 'Bien propre E2E' })).toBeDisabled();
});

test('création de contrat avec un bien du portefeuille Altimmo réussit et le contrat apparaît dans la liste', async ({ page }, testInfo) => {
  // desktop-chromium et mobile-chromium partagent la même base ; un bien
  // distinct par projet évite le conflit d'index "un contrat ouvert par bien".
  const bienTitre = testInfo.project.name === 'mobile-chromium' ? 'Maison Location E2E Mobile' : 'Maison Location E2E';

  await login(page);
  await page.goto('/dashboard/gestion-locative');
  await page.getByRole('button', { name: /nouveau contrat/i }).click();

  const proprietaireSelect = page.locator('label:text("Propriétaire")').locator('xpath=following-sibling::select');
  const proprietaireOptionText = await proprietaireSelect.locator('option', { hasText: 'BienPropre' }).textContent();
  await proprietaireSelect.selectOption({ label: proprietaireOptionText });

  const bienSelect = page.locator('label:text("Bien immobilier")').locator('xpath=following-sibling::select');
  const bienOptionText = await bienSelect.locator('option', { hasText: new RegExp(`^${bienTitre}$`) }).textContent();
  await bienSelect.selectOption({ label: bienOptionText });

  await page.locator('label:text("Loyer/mois")').locator('xpath=following-sibling::input').fill('250000');

  const [response] = await Promise.all([
    page.waitForResponse((r) => r.url().includes('/api/contrats') && r.request().method() === 'POST'),
    page.getByRole('button', { name: /enregistrer/i }).click(),
  ]);

  expect(response.status()).toBe(201);
  const body = await response.json();
  expect(body.data.contrat.bien).toBeTruthy();
  expect(body.data.contrat.adresseBien).toBe('Moungali');
  expect(body.data.contrat.villeBien).toBe('Brazzaville');

  await expect(page.getByText(/Contrat créé/i)).toBeVisible();
  await expect(page.getByText(bienTitre)).toBeVisible();
});
