import { expect, test } from './external-network.fixture';

// DOC-ARCH-1 — un seul Centre documentaire pour toute la plateforme.
// Vérifie en conditions réelles de navigateur : (1) l'ancien lien
// /dashboard/gestion-locative/documents redirige automatiquement vers le
// Centre documentaire déjà filtré (aucun favori ne devient invalide) ;
// (2) l'explorateur Pôle → Service fonctionne (navigation réelle, pas de
// mock) ; (3) le dossier Gestion locative n'affiche jamais de bouton
// "Nouveau document" (documents produits uniquement par les workflows
// métier existants).
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

test('l’ancien lien Gestion locative → Documents redirige vers le Centre documentaire déjà filtré, en conservant contratId', async ({ page }) => {
  await login(page);
  await page.goto('/dashboard/gestion-locative/documents?contratId=abc123');
  await expect(page).toHaveURL(/\/dashboard\/documents\?pole=Altimmo&service=gestion_locative&contratId=abc123/);
  await expect(page.getByRole('heading', { name: 'Documents', exact: true })).toBeVisible();
});

test('l’ancien lien sans contratId redirige aussi correctement', async ({ page }) => {
  await login(page);
  await page.goto('/dashboard/gestion-locative/documents');
  await expect(page).toHaveURL(/\/dashboard\/documents\?pole=Altimmo&service=gestion_locative$/);
});

test('explorateur : Centre documentaire → Altimmo → Gestion locative, sans bouton "Nouveau document"', async ({ page }) => {
  await login(page);
  await page.goto('/dashboard/documents');
  await expect(page.getByRole('button', { name: 'Altimmo' })).toBeVisible();

  await page.getByRole('button', { name: 'Altimmo' }).click();
  await expect(page).toHaveURL(/\/dashboard\/documents\?pole=Altimmo$/);
  await expect(page.getByRole('button', { name: 'Gestion locative' })).toBeVisible();

  await page.getByRole('button', { name: 'Gestion locative' }).click();
  await expect(page).toHaveURL(/\/dashboard\/documents\?pole=Altimmo&service=gestion_locative$/);
  await expect(page.getByRole('button', { name: /nouveau document/i })).toHaveCount(0);
});

test('le fil d’Ariane permet de remonter au niveau pôle puis à la racine', async ({ page }) => {
  await login(page);
  await page.goto('/dashboard/documents?pole=Altimmo&service=gestion_locative');
  await page.getByRole('button', { name: 'Altimmo' }).click();
  await expect(page).toHaveURL(/\/dashboard\/documents\?pole=Altimmo$/);

  await page.getByRole('button', { name: 'Centre documentaire' }).click();
  await expect(page).toHaveURL(/\/dashboard\/documents$/);
  await expect(page.getByRole('button', { name: 'Altimmo' })).toBeVisible();
});

test('dossier Propriétaires (générique Document) affiche le bouton "Nouveau document"', async ({ page }) => {
  await login(page);
  await page.goto('/dashboard/documents?pole=Altimmo&service=proprietaires');
  await expect(page.getByRole('button', { name: /nouveau document/i })).toBeVisible();
});
