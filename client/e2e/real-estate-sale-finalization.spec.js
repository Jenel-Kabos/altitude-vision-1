import crypto from 'crypto';
import { expect, test } from '@playwright/test';

const API = 'http://localhost:5000/api';
const client = { email: 'client-e2e@example.test', password: 'E2eClient!2026' };
const admin = { email: 'owner-e2e@example.test', password: 'E2eOwner!2026' };

test.setTimeout(240000);

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

test('vente : offre, paiement signé, finalisation et rejeux idempotents', async ({ page, request }, testInfo) => {
  const mobile = testInfo.project.name === 'mobile-chromium';
  const propertyId = mobile ? '66e200000000000000000034' : '66e200000000000000000032';
  const title = mobile ? 'Villa Vente Finalisation E2E Mobile' : 'Villa Vente Finalisation E2E';
  const clientToken = await login(page, client);
  await page.goto(`/immobilier/dossiers?propertyId=${propertyId}&kind=purchase_offer`);
  await page.getByLabel('Montant proposé').fill('120000000');
  await page.getByLabel('Valable jusqu’au').fill('2027-12-31T18:00');
  const applicationResponse = page.waitForResponse((response) => response.url().endsWith('/api/real-estate-applications') && response.request().method() === 'POST');
  await page.getByRole('button', { name: 'Envoyer le dossier' }).click();
  const applicationJson = await (await applicationResponse).json();
  const applicationId = applicationJson.data.application._id;
  await expect(page.getByRole('article').filter({ hasText: title })).toBeVisible();

  await page.evaluate(() => { localStorage.clear(); });
  const adminToken = await login(page, admin);
  await page.goto('/dashboard/dossiers-immobiliers');
  const row = page.getByRole('row').filter({ hasText: title });
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

  const transactionResponse = await request.post(`${API}/transactions`, {
    headers: authHeaders(adminToken),
    data: { propertyId, clientId: '66e200000000000000000002', reservationId, finalAmount: 120000000, transactionType: 'vente' },
  });
  expect(transactionResponse.status()).toBe(201);
  const transactionId = (await transactionResponse.json()).data.transaction._id;

  const paymentPayload = { phone: '+242060000002', operator: 'MTN', firstName: 'Client', lastName: 'E2E' };
  const [paymentA, paymentB] = await Promise.all([
    request.post(`${API}/transactions/${transactionId}/paiements/initier`, { headers: authHeaders(clientToken), data: paymentPayload }),
    request.post(`${API}/transactions/${transactionId}/paiements/initier`, { headers: authHeaders(clientToken), data: paymentPayload }),
  ]);
  // Deux issues légitimes pour le perdant de la course : 400 si le
  // findOne applicatif voit déjà le paiement "En attente" de l'autre
  // requête, 409 si les deux passent ce contrôle et se percutent sur
  // l'index unique en base — jamais un deuxième succès (200).
  const paymentStatuses = [paymentA.status(), paymentB.status()].sort((a, b) => a - b);
  expect(paymentStatuses[0]).toBe(200);
  expect([400, 409]).toContain(paymentStatuses[1]);
  const successfulPayment = paymentA.status() === 200 ? paymentA : paymentB;
  const intentId = (await successfulPayment.json()).data.intentId;

  // `id` doit être unique par intent : desktop et mobile-chromium partagent
  // le même serveur E2E dans une seule exécution Playwright, donc une
  // valeur fixe ferait percuter la vraie protection d'idempotence
  // (webhook déjà reçu avec un contenu différent) entre les deux projets.
  const webhookBody = { id: `e2e-sale-payment-succeeded-${intentId}`, type: 'payment_intent.succeeded', data: { id: intentId } };
  const timestamp = String(Math.floor(Date.now() / 1000));
  const rawBody = JSON.stringify(webhookBody);
  const signature = crypto.createHmac('sha256', 'e2e-webhook-secret').update(`${timestamp}.${rawBody}`).digest('hex');
  const webhookHeaders = { 'content-type': 'application/json', 'x-yabetoo-webhook-timestamp': timestamp, 'x-yabetoo-webhook-signature': `v1=${signature}` };
  const firstWebhook = await request.post(`${API}/transactions/paiements/webhook`, { headers: webhookHeaders, data: webhookBody });
  expect(firstWebhook.status()).toBe(200);
  const replayWebhook = await request.post(`${API}/transactions/paiements/webhook`, { headers: webhookHeaders, data: webhookBody });
  expect(replayWebhook.status()).toBe(200);
  expect((await replayWebhook.json()).duplicate).toBe(true);

  await page.goto('/dashboard/transactions');
  await page.getByText(title, { exact: true }).click();
  await expect(page.getByText('Paiement : Confirmé')).toBeVisible();
  await page.getByRole('button', { name: 'Finaliser' }).click();
  const finalizedResponse = page.waitForResponse((response) => response.url().endsWith(`/api/transactions/${transactionId}/finalize`) && response.request().method() === 'POST');
  await page.getByRole('button', { name: 'Oui, finaliser' }).click();
  const finalizedJson = await (await finalizedResponse).json();
  expect(finalizedJson.data.idempotent).toBe(false);
  const invoiceId = finalizedJson.data.invoice._id;

  const replayFinalization = await request.post(`${API}/transactions/${transactionId}/finalize`, { headers: authHeaders(adminToken), data: {} });
  expect(replayFinalization.status()).toBe(200);
  const replayFinalizationJson = await replayFinalization.json();
  expect(replayFinalizationJson.data.idempotent).toBe(true);
  expect(replayFinalizationJson.data.invoice._id).toBe(invoiceId);

  const transactionCheck = await request.get(`${API}/transactions/${transactionId}`, { headers: authHeaders(adminToken) });
  const transaction = (await transactionCheck.json()).data.transaction;
  expect(transaction.status).toBe('Réussie');
  expect(transaction.paymentStatus).toBe('confirmé');
  expect(transaction.linkedInvoice).toBe(invoiceId);
  expect(transaction.finalization.attemptCount).toBe(1);

  const reservationCheck = await request.get(`${API}/real-estate-applications/reservations/${reservationId}`, { headers: authHeaders(adminToken) });
  expect((await reservationCheck.json()).data.reservation.status).toBe('converted');

  const propertyCheck = await request.get(`${API}/properties/${propertyId}`, { headers: authHeaders(adminToken) });
  const propertyPayload = await propertyCheck.json();
  const property = propertyPayload.data?.property || propertyPayload.property;
  expect(property.availability).toBe('Vendu');
  expect(property.isPublished).toBe(false);

  await page.reload();
  await page.getByText(title, { exact: true }).click();
  await expect(page.getByText('Facture générée')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Finaliser' })).toHaveCount(0);
});
