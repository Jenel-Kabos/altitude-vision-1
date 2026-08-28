// SECURITY-CLOSURE-P1-WAVE-1 (P1-I, finding RA-14) — reproduction rouge->verte
// PERMANENTE : `transactionController.*`/`paiementTransactionController.*`
// n'avaient aucune awareness tenant, malgré le support déjà déclaré de
// `resourceType: 'Transaction'` dans tenantResourceAttributionService
// (jamais utilisé). Correctif : même primitive canonique, appliquée aux
// listes (via Property.owner en scope) et aux mutations unitaires
// (finalize/cancel/notes/enregistrer-especes/valider-virement), staff
// uniquement — jamais pour le client propriétaire de sa transaction.
const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const { startFinancialMongo, clearFinancialMongo, stopFinancialMongo } = require('./helpers/financialMongoEnvironment');
const User = require('../models/User');
const Property = require('../models/Property');
const RealEstateApplication = require('../models/RealEstateApplication');
const RealEstateReservation = require('../models/RealEstateReservation');
const Transaction = require('../models/Transaction');
const PaiementTransaction = require('../models/PaiementTransaction');
const transactionRoutes = require('../routes/transactionRoutes');
const { errorHandler } = require('../middleware/errorMiddleware');
const organizationService = require('../services/organizationService');
const platformTenantService = require('../services/platformTenant/platformTenantService');

jest.setTimeout(180000);

const app = express();
app.use(express.json());
app.use('/api/transactions', transactionRoutes);
app.use(errorHandler);

const signToken = (id) => jwt.sign({ id, tokenVersion: 0 }, process.env.JWT_SECRET, { expiresIn: '1d' });
const bearer = (user, tenantId) => ({
  Authorization: `Bearer ${signToken(user._id)}`,
  ...(tenantId ? { 'X-Platform-Tenant-Id': String(tenantId) } : {}),
});

beforeAll(startFinancialMongo);
afterEach(clearFinancialMongo);
afterAll(stopFinancialMongo);

let seq = 0;
async function buildTenantFixture(label) {
  seq += 1;
  const admin = await User.create({ name: `Admin ${label}`, email: `p1i-admin-${label}-${seq}-${Date.now()}@example.com`, password: 'Password123!', passwordConfirm: 'Password123!', role: 'Admin', isEmailVerified: true });
  const owner = await User.create({ name: `Owner ${label}`, email: `p1i-owner-${label}-${seq}-${Date.now()}@example.com`, password: 'Password123!', passwordConfirm: 'Password123!', role: 'Proprietaire', isEmailVerified: true });
  const client = await User.create({ name: `Client ${label}`, email: `p1i-client-${label}-${seq}-${Date.now()}@example.com`, password: 'Password123!', passwordConfirm: 'Password123!', role: 'Client', isEmailVerified: true });
  const tenant = await platformTenantService.createTenant({ name: `P1I-${label}-${seq}-${Date.now()}`, actor: admin });
  await Promise.all([
    organizationService.grantMembership({ userId: admin._id, orgUnitId: tenant.rootOrgUnit, actor: admin }),
    organizationService.grantMembership({ userId: owner._id, orgUnitId: tenant.rootOrgUnit, actor: admin }),
  ]);
  const property = await Property.create({
    title: `Villa P1I ${label}`, description: 'Description suffisamment longue pour la validation du modele Property.',
    pole: 'Altimmo', type: 'Villa', status: 'vente', price: 30000000,
    address: { arrondissement: 'Bacongo', city: 'Brazzaville' }, latitude: -4.26, longitude: 15.24,
    images: ['https://placehold.co/1200x800/png?text=Test'], surface: 90,
    statusAdmin: 'Validée', availability: 'Réservé', owner: owner._id,
  });
  const application = await RealEstateApplication.create({
    kind: 'purchase_offer', property: property._id, applicant: client._id, owner: owner._id,
    validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), purchaseOffer: { amount: 30000000 },
  });
  const reservation = await RealEstateReservation.create({
    property: property._id, client: client._id, application: application._id, type: 'sale',
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), idempotencyKey: `p1i-${label}-${seq}-${Date.now()}`,
  });
  const transaction = await Transaction.create({
    property: property._id, client: client._id, agent: admin._id, reservation: reservation._id,
    finalAmount: 30000000, transactionType: 'vente',
  });
  return { admin, owner, client, tenant, property, transaction };
}

describe('SECURITY-CLOSURE-P1-WAVE-1 (P1-I) — GET /api/transactions', () => {
  test('1. Admin A ne voit QUE les transactions du tenant A', async () => {
    const a = await buildTenantFixture('A');
    const b = await buildTenantFixture('B');
    const res = await request(app).get('/api/transactions').set(bearer(a.admin, a.tenant._id));
    expect(res.status).toBe(200);
    const ids = res.body.data.transactions.map((t) => t._id);
    expect(ids).toContain(String(a.transaction._id));
    expect(ids).not.toContain(String(b.transaction._id));
  });

  test('2. GET /:id : Admin A refusé sur la transaction du tenant B', async () => {
    const a = await buildTenantFixture('C');
    const b = await buildTenantFixture('D');
    const res = await request(app).get(`/api/transactions/${b.transaction._id}`).set(bearer(a.admin, a.tenant._id));
    expect(res.status).not.toBe(200);
  });

  test('3. Le client reste autorisé sur sa propre transaction, sans tenant', async () => {
    const a = await buildTenantFixture('E');
    const res = await request(app).get(`/api/transactions/${a.transaction._id}`).set(bearer(a.client));
    expect(res.status).toBe(200);
  });

  test('4. Staff multi-tenant sans en-tête → fail-closed', async () => {
    const a = await buildTenantFixture('F');
    const b = await buildTenantFixture('G');
    const staffMulti = await User.create({ name: 'Staff Multi', email: `p1i-multi-${Date.now()}@example.com`, password: 'Password123!', passwordConfirm: 'Password123!', role: 'Admin', isEmailVerified: true });
    await organizationService.grantMembership({ userId: staffMulti._id, orgUnitId: a.tenant.rootOrgUnit, actor: a.admin });
    await organizationService.grantMembership({ userId: staffMulti._id, orgUnitId: b.tenant.rootOrgUnit, actor: b.admin });
    const res = await request(app).get('/api/transactions').set(bearer(staffMulti));
    expect(res.status).toBe(403);
  });
});

describe('SECURITY-CLOSURE-P1-WAVE-1 (P1-I) — mutations financières', () => {
  test('5. Admin A ne peut PAS annuler la transaction du tenant B', async () => {
    const a = await buildTenantFixture('H');
    const b = await buildTenantFixture('I');
    const res = await request(app).patch(`/api/transactions/${b.transaction._id}/cancel`).set(bearer(a.admin, a.tenant._id)).send({ raison: 'test' });
    expect(res.status).not.toBe(200);
    const fresh = await Transaction.findById(b.transaction._id);
    expect(fresh.status).not.toBe('Annulée');
  });

  test('6. Admin A ne peut PAS enregistrer un paiement especes sur la transaction du tenant B', async () => {
    const a = await buildTenantFixture('J');
    const b = await buildTenantFixture('K');
    const res = await request(app).post(`/api/transactions/${b.transaction._id}/paiements/especes`).set(bearer(a.admin, a.tenant._id)).send({ methode: 'especes', montant: 30000000 });
    expect(res.status).not.toBe(201);
    expect(await PaiementTransaction.countDocuments({ transaction: b.transaction._id })).toBe(0);
  });

  test('7. Admin A PEUT annuler sa propre transaction (comportement historique préservé)', async () => {
    const a = await buildTenantFixture('L');
    const res = await request(app).patch(`/api/transactions/${a.transaction._id}/cancel`).set(bearer(a.admin, a.tenant._id)).send({ raison: 'test valide' });
    expect(res.status).toBe(200);
  });
});
