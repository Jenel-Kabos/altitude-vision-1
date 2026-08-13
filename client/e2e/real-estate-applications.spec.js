import { expect, test } from './external-network.fixture';

const credentials = { email: 'client-e2e@example.test', password: 'E2eClient!2026' };
const properties = {
  purchase_offer: '66e200000000000000000030',
  rental_application: '66e200000000000000000031',
};

async function login(page) {
  await page.goto('/login');
  await page.locator('#email').fill(credentials.email);
  await page.locator('#password').fill(credentials.password);
  await page.getByRole('button', { name: /se connecter/i }).click();
  await expect(page).not.toHaveURL(/\/login/);
}

for (const kind of ['purchase_offer', 'rental_application']) {
  test(`${kind === 'purchase_offer' ? 'offre de vente' : 'candidature locative'} : dépôt puis retrait`, async ({ page }) => {
    await login(page);
    await page.goto(`/immobilier/dossiers?propertyId=${properties[kind]}&kind=${kind}`);
    if (kind === 'purchase_offer') {
      await page.getByLabel('Montant proposé').fill('90000000');
    } else {
      await page.getByLabel('Date d’entrée').fill('2027-01-15');
      await page.getByLabel('Durée souhaitée').fill('12');
      await page.getByLabel('Nombre d’occupants').fill('2');
    }
    await page.getByLabel('Valable jusqu’au').fill('2026-12-31T18:00');
    const created = page.waitForResponse((response) => response.url().includes('/api/real-estate-applications') && response.request().method() === 'POST');
    await page.getByRole('button', { name: 'Envoyer le dossier' }).click();
    expect((await created).status()).toBe(201);
    await expect(page.getByText(kind === 'purchase_offer' ? 'Appartement Vente E2E' : 'Maison Location E2E')).toBeVisible();
    const withdrawn = page.waitForResponse((response) => response.url().endsWith('/withdraw') && response.request().method() === 'POST');
    await page.getByRole('button', { name: 'Retirer le dossier' }).click();
    expect((await withdrawn).status()).toBe(200);
    const dossier = page.getByRole('article').filter({ hasText: kind === 'purchase_offer' ? 'Appartement Vente E2E' : 'Maison Location E2E' }).last();
    await expect(dossier.getByText('Retiré')).toBeVisible();
  });
}
