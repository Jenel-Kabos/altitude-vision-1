import { test, expect } from '@playwright/test';

const credentials = { email: 'owner-e2e@example.test', password: 'E2eOwner!2026' };

async function login(page) {
  await page.addInitScript(() => localStorage.setItem('cookie_consent', 'refused'));
  await page.goto('/login');
  await page.locator('#email').fill(credentials.email);
  await page.locator('#password').fill(credentials.password);
  await page.getByRole('button', { name: /se connecter/i }).click();
  await expect(page).toHaveURL('/dashboard');
}

test('Modération Hôtellerie → portefeuille Établissements → centre opérationnel → archivage', async ({ page }, testInfo) => {
  const mobile = testInfo.project.name === 'mobile-chromium';
  const initialName = mobile ? 'Hôtel Portefeuille E2E Mobile' : 'Hôtel Portefeuille E2E';
  const proposedName = mobile ? 'Hôtel Version 2 E2E Mobile' : 'Hôtel Version 2 E2E';
  const hotelId = mobile ? '66e200000000000000000021' : '66e200000000000000000011';
  const capture = (step) => page.screenshot({ path: testInfo.outputPath(`${step}.png`), fullPage: true });
  await login(page);
  await page.goto('/dashboard/etablissements');
  await expect(page.getByText(initialName, { exact: true })).toHaveCount(0);

  await page.goto('/dashboard/moderation/hotellerie');
  await expect(page.getByText(initialName, { exact: true })).toBeVisible();
  await page.getByText(initialName, { exact: true }).locator('..').locator('..').getByRole('button', { name: 'Valider' }).click();
  await expect(page.getByText(initialName, { exact: true })).toHaveCount(0);

  await page.goto('/dashboard/etablissements');
  await expect(page.getByRole('heading', { name: initialName })).toBeVisible();
  await capture('01-portfolio-publie');
  await page.getByRole('heading', { name: initialName }).locator('..').locator('..').getByRole('button', { name: 'Modifier' }).click();
  await page.getByLabel("Nom de l'hôtel").fill(proposedName);
  const updateResponsePromise = page.waitForResponse((response) => response.url().includes(`/api/hotels/admin/${hotelId}`) && response.request().method() === 'PUT');
  await page.getByRole('button', { name: /Enregistrer/ }).click();
  const updateResponse = await updateResponsePromise;
  expect(updateResponse.ok(), await updateResponse.text()).toBe(true);
  await expect(page.getByText(/modifications sensibles restent en attente/i)).toBeVisible();
  await expect(page.getByRole('heading', { name: initialName })).toBeVisible();
  await expect(page.getByRole('heading', { name: proposedName })).toHaveCount(0);
  await capture('02-version-publiee-inchangee');

  await page.goto('/dashboard/moderation/hotellerie');
  await expect(page.getByText('Modification sensible proposée')).toBeVisible();
  await expect(page.getByText(new RegExp(proposedName))).toBeVisible();
  await capture('03-proposition-moderation');
  await page.getByText(initialName, { exact: true }).locator('..').locator('..').getByRole('button', { name: 'Valider' }).click();

  await page.goto('/dashboard/etablissements');
  await expect(page.getByRole('heading', { name: proposedName })).toBeVisible();
  await capture('04-version-validee');
  await page.getByRole('heading', { name: proposedName }).locator('..').locator('..').getByRole('link', { name: 'Voir' }).click();
  await expect(page).toHaveURL(new RegExp(`/dashboard/etablissements/${hotelId}`));
  await expect(page.getByText('Centre opérationnel')).toBeVisible();

  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: 'Archiver' }).click();
  await expect(page).toHaveURL('/dashboard/etablissements');
  await expect(page.getByText(proposedName, { exact: true })).toHaveCount(0);
  await capture('05-archive');
});
