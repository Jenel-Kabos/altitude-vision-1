import { test, expect } from './external-network.fixture';
import { loginThroughUi } from './support/auth';

const credentials = { email: 'owner-e2e@example.test', password: 'E2eOwner!2026' };

// F-U2.14 : connexion partagée robuste (hydratation + compilation `next dev`
// de la page cible) ; destination du staff inchangée : /dashboard.
async function login(page) {
  await loginThroughUi(page, credentials);
  await expect(page).toHaveURL('/dashboard');
}

// F-U2.14 : parcours de 4 pages d'administration, chacune compilée à froid par
// `next dev` (mesuré : 5 à 19 s par page, et les requêtes API ralenties jusqu'à
// 17 s pendant ces compilations) — même budget que les autres parcours
// multi-pages (real-estate-* : 180–240 s). Aucun délai d'assertion n'est modifié.
test.setTimeout(240000);

// F-U2.14 : depuis la refonte de HotelModerationPage (8822eb9, déjà dans HEAD),
// la carte ouvre une fiche de détail ; la décision « Valider » s'y prend.
async function openModerationDetail(page, hotelName) {
  await page.getByRole('heading', { name: hotelName, exact: true }).locator('xpath=..').getByRole('button', { name: 'Voir les détails' }).click();
}
async function validateInModeration(page, hotelName) {
  await openModerationDetail(page, hotelName);
  await page.getByRole('button', { name: 'Valider', exact: true }).click();
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
  await validateInModeration(page, initialName);
  await expect(page.getByText(initialName, { exact: true })).toHaveCount(0);

  await page.goto('/dashboard/etablissements');
  await expect(page.getByRole('heading', { name: initialName })).toBeVisible();
  await capture('01-portfolio-publie');
  // "Modifier" vit dans le menu d'actions (DashboardActionMenu, un
  // bouton "…" qui révèle un menu role="menu") — jamais un bouton visible
  // directement, il faut d'abord l'ouvrir.
  await page.getByRole('button', { name: `Actions pour ${initialName}` }).click();
  await page.getByRole('menuitem', { name: 'Modifier' }).click();
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
  // F-U2.14 : la proposition sensible est présentée dans la fiche de détail.
  await openModerationDetail(page, initialName);
  await expect(page.getByText('Modification sensible proposée').first()).toBeVisible();
  await expect(page.getByText(new RegExp(proposedName)).first()).toBeVisible();
  await capture('03-proposition-moderation');
  await page.getByRole('button', { name: 'Valider', exact: true }).click();

  await page.goto('/dashboard/etablissements');
  await expect(page.getByRole('heading', { name: proposedName })).toBeVisible();
  await capture('04-version-validee');
  // Le libellé réel du lien vers la fiche détail est "Ouvrir" (voir
  // ManageHotelsPage.jsx), jamais "Voir" — décalage préexistant du test.
  await page.getByRole('heading', { name: proposedName }).locator('..').locator('..').getByRole('link', { name: 'Ouvrir' }).click();
  // F-U2.14 : première navigation vers la fiche (route dynamique compilée à froid
  // par `next dev`) — borne explicite limitée à cette navigation.
  await page.waitForURL(new RegExp(`/dashboard/etablissements/${hotelId}`), { timeout: 60000 });
  await expect(page.getByText('Centre opérationnel')).toBeVisible();

  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: 'Archiver' }).click();
  await expect(page).toHaveURL('/dashboard/etablissements');
  await expect(page.getByText(proposedName, { exact: true })).toHaveCount(0);
  await capture('05-archive');
});
