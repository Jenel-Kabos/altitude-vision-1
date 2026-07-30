import { expect, test } from '@playwright/test';

// Parcours Location complet (Sprint IM-2.2, phase 9) : le paiement initial
// n'est pas un prérequis métier réel de l'activation du bail — voir
// contratController.syncLeaseOccupation, qui convertit la réservation et
// passe le bien en "Loué" dès qu'un contrat est créé avec statut:'actif',
// sans jamais vérifier de paiement. On couvre donc : candidature (UI) →
// acceptation (UI) → contrat lié à la réservation (API — aucune page ne
// permet de créer un Contrat rattaché à une RealEstateReservation, voir
// GestionLocativePage.jsx qui n'envoie jamais `reservation`) → activation du
// bail → conversion de la réservation → statut du bien.

const API = 'http://localhost:5000/api';
const client = { email: 'client-e2e@example.test', password: 'E2eClient!2026' };
const admin = { email: 'owner-e2e@example.test', password: 'E2eOwner!2026' };
test.setTimeout(180000);

async function login(page, credentials) {
  await page.goto('/login');
  await page.locator('#email').fill(credentials.email);
  await page.locator('#password').fill(credentials.password);
  await page.getByRole('button', { name: /se connecter/i }).click();
  await expect(page).not.toHaveURL(/\/login/);
  const consent = page.getByRole('button', { name: 'Tout accepter', exact: true });
  if (await consent.isVisible().catch(() => false)) await consent.click();
  return page.evaluate(() => localStorage.getItem('token'));
}

const authHeaders = (token) => ({ Authorization: `Bearer ${token}` });

test('location : candidature, acceptation, contrat actif, conversion et bien loué', async ({ page, request }, testInfo) => {
  // Les projets desktop/mobile-chromium partagent le même serveur E2E dans
  // une seule exécution Playwright : une propriété dédiée par projet évite
  // qu'un run ne rende le bien indisponible ("Loué") pour l'autre.
  const mobile = testInfo.project.name === 'mobile-chromium';
  const propertyId = mobile ? '66e200000000000000000036' : '66e200000000000000000035';
  const title = mobile ? 'Studio Location Activation E2E Mobile' : 'Studio Location Activation E2E';
  await login(page, client);
  await page.goto(`/immobilier/dossiers?propertyId=${propertyId}&kind=rental_application`);
  await page.getByLabel('Date d’entrée').fill('2027-02-01');
  await page.getByLabel('Durée souhaitée').fill('12');
  await page.getByLabel('Nombre d’occupants').fill('2');
  await page.getByLabel('Valable jusqu’au').fill('2027-12-31T18:00');
  const applicationResponse = page.waitForResponse((response) => response.url().endsWith('/api/real-estate-applications') && response.request().method() === 'POST');
  await page.getByRole('button', { name: 'Envoyer le dossier' }).click();
  const applicationJson = await (await applicationResponse).json();
  const applicationId = applicationJson.data.application._id;
  await expect(page.getByRole('article').filter({ hasText: title }).first()).toBeVisible();

  await page.evaluate(() => { localStorage.clear(); });
  const adminToken = await login(page, admin);
  await page.goto('/dashboard/dossiers-immobiliers');
  const row = page.getByRole('row').filter({ hasText: title }).first();
  await row.getByRole('button', { name: 'Consulter' }).click();
  page.once('dialog', (dialog) => dialog.accept());
  const acceptButton = page.getByRole('button', { name: 'Accepter', exact: true });
  await expect(acceptButton).toBeEnabled();
  const [acceptedResponse] = await Promise.all([
    page.waitForResponse((response) => response.url().endsWith(`/api/real-estate-applications/${applicationId}/accept`) && response.request().method() === 'POST'),
    acceptButton.click(),
  ]);
  const acceptedJson = await acceptedResponse.json();
  const reservationId = acceptedJson.data.reservation._id;
  expect(acceptedJson.data.reservation.type).toBe('rental');

  const reservationBeforeContract = await request.get(`${API}/real-estate-applications/reservations/${reservationId}`, { headers: authHeaders(adminToken) });
  expect((await reservationBeforeContract.json()).data.reservation.status).toBe('active');

  // Aucune page du dashboard (GestionLocativePage.jsx) ne relie un Contrat à
  // une RealEstateReservation — étape sans UI, donc pilotée par API comme
  // convenu pour ce sprint.
  const contractResponse = await request.post(`${API}/contrats`, {
    headers: authHeaders(adminToken),
    data: {
      bien: propertyId,
      type: 'location',
      reservation: reservationId,
      statut: 'actif',
      dateEntree: '2027-02-01',
      dateFinBail: '2028-01-31',
      montantLoyer: 450000,
    },
  });
  expect(contractResponse.status()).toBe(201);
  const contractId = (await contractResponse.json()).data.contrat._id;

  // Rejeu : la même paire (bien, type) ne doit jamais produire un second
  // contrat ouvert (index partiel one_open_contract_per_property_and_type).
  const duplicateContract = await request.post(`${API}/contrats`, {
    headers: authHeaders(adminToken),
    data: { bien: propertyId, type: 'location', reservation: reservationId, statut: 'actif', dateEntree: '2027-02-01', dateFinBail: '2028-01-31', montantLoyer: 450000 },
  });
  expect(duplicateContract.status()).toBe(409);

  const reservationCheck = await request.get(`${API}/real-estate-applications/reservations/${reservationId}`, { headers: authHeaders(adminToken) });
  expect((await reservationCheck.json()).data.reservation.status).toBe('converted');

  const propertyCheck = await request.get(`${API}/properties/${propertyId}`, { headers: authHeaders(adminToken) });
  const propertyPayload = await propertyCheck.json();
  const property = propertyPayload.data?.property || propertyPayload.property;
  expect(property.availability).toBe('Loué');
  expect(property.isPublished).toBe(false);

  const contractCheck = await request.get(`${API}/contrats/${contractId}`, { headers: authHeaders(adminToken) });
  expect((await contractCheck.json()).data.contrat.statut).toBe('actif');
});
