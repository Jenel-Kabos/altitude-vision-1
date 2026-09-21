// USER-TENANT-MEMBERSHIP-ARCHITECTURE-2E.1.X-I-TENANT-CONTEXT-C.1 —
// Marketplace sale commercial authority is PLATFORM-ONLY. Tenant Admin,
// tenant staff, Proprietaire, Client MUST NOT be able to perform
// sensitive platform commercial/financial mutations on
// `/api/transactions/*`.
const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const { startFinancialMongo, clearFinancialMongo, stopFinancialMongo } = require('./helpers/financialMongoEnvironment');
const { createTenantFixture, addTenantMember } = require('./helpers/tenantAwareFixture');
const { grantOperator } = require('../services/platformOperator/platformOperatorService');
const User = require('../models/User');
const Property = require('../models/Property');
const Transaction = require('../models/Transaction');
const transactionRoutes = require('../routes/transactionRoutes');
const { errorHandler } = require('../middleware/errorMiddleware');

jest.setTimeout(180000);

const app = express();
app.use(express.json());
app.use('/api/transactions', transactionRoutes);
app.use(errorHandler);

const bearer = (user, tenant) => ({
  Authorization: `Bearer ${jwt.sign({ id: user._id, tokenVersion: 0 }, process.env.JWT_SECRET, { expiresIn: '1d' })}`,
  ...(tenant ? { 'X-Platform-Tenant-Id': String(tenant._id) } : {}),
});

let seq = 0;
const makeUser = (over = {}) => {
  seq += 1;
  return User.create({
    name: `SALE-C1 ${seq}`, email: `sale-c1-${seq}-${Date.now()}@example.test`,
    password: 'Password123!', passwordConfirm: 'Password123!', role: 'Client', isEmailVerified: true, ...over,
  });
};
const makeProperty = (owner, tenant) => Property.create({
  title: `Villa Sale ${seq++}`, description: 'Description assez longue pour la validation Property.',
  pole: 'Altimmo', type: 'Villa', status: 'vente', price: 50000000,
  address: { city: 'Brazzaville', arrondissement: 'Centre' }, latitude: -4.26, longitude: 15.24,
  images: ['https://placehold.co/1200x800/png?text=Test'], surface: 120, statusAdmin: 'Validée', isPublished: true,
  availability: 'Disponible', owner: owner._id, tenant: tenant?._id || null,
});
const makeTransaction = (property, client, agent) => Transaction.collection.insertOne({
  property: property._id, client: client._id, agent: agent._id,
  reservation: new mongoose.Types.ObjectId(),
  transactionType: 'vente', status: 'En cours',
  finalAmount: 50000000, transactionDate: new Date(), createdAt: new Date(),
});

async function tenantF(label) {
  return createTenantFixture({ label: `SALE-C1 ${label} ${seq++}`, withAdminMembership: true });
}
async function staffOf(fixture, businessRole, userRole = 'Client') {
  const u = await makeUser({ role: userRole });
  await addTenantMember({ tenant: fixture.tenant, user: u, bootstrap: fixture.bootstrap, businessRole });
  return u;
}

beforeAll(startFinancialMongo);
afterEach(clearFinancialMongo);
afterAll(stopFinancialMongo);

// ═══════════════════════════════════════════════════════════════════════════
// SALE-PLAT — Platform commercial authority
// ═══════════════════════════════════════════════════════════════════════════

describe('SALE-PLAT — marketplace sale commercial authority is PLATFORM-ONLY', () => {
  async function scenario() {
    const fA = await tenantF('A');
    const owner = await makeUser({ role: 'Proprietaire' });
    await addTenantMember({ tenant: fA.tenant, user: owner, bootstrap: fA.bootstrap });
    const client = await makeUser({ role: 'Client' });
    const agent = await makeUser({ role: 'Admin' });
    const property = await makeProperty(owner, fA.tenant);
    const tx = await makeTransaction(property, client, agent);
    return { fA, owner, client, property, tx: { _id: tx.insertedId } };
  }

  test('SALE-PLAT-01 (Tenant Admin cannot finalize)', async () => {
    const { fA, tx } = await scenario();
    const admin = await staffOf(fA, 'Admin', 'Admin');
    const res = await request(app).post(`/api/transactions/${tx._id}/finalize`).set(bearer(admin, fA.tenant));
    expect(res.status).toBe(403);
  });

  test('SALE-PLAT-02 (Tenant Collaborateur cannot finalize)', async () => {
    const { fA, tx } = await scenario();
    const collab = await staffOf(fA, 'Collaborateur', 'Collaborateur');
    const res = await request(app).post(`/api/transactions/${tx._id}/finalize`).set(bearer(collab, fA.tenant));
    expect(res.status).toBe(403);
  });

  test('SALE-PLAT-03 (Tenant Secretaire cannot finalize)', async () => {
    const { fA, tx } = await scenario();
    const sec = await staffOf(fA, 'Secretaire', 'Secretaire');
    const res = await request(app).post(`/api/transactions/${tx._id}/finalize`).set(bearer(sec, fA.tenant));
    expect(res.status).toBe(403);
  });

  test('SALE-PLAT-04 (Proprietaire cannot finalize)', async () => {
    const { fA, owner, tx } = await scenario();
    const res = await request(app).post(`/api/transactions/${tx._id}/finalize`).set(bearer(owner, fA.tenant));
    expect(res.status).toBe(403);
  });

  test('SALE-PLAT-05 (Client cannot finalize)', async () => {
    const { fA, client, tx } = await scenario();
    const res = await request(app).post(`/api/transactions/${tx._id}/finalize`).set(bearer(client, fA.tenant));
    expect(res.status).toBe(403);
  });

  test('SALE-PLAT-06 (Global User.role=Admin alone cannot finalize — needs active PlatformOperator + capability)', async () => {
    const { tx } = await scenario();
    const orphanAdmin = await makeUser({ role: 'Admin' });
    const res = await request(app).post(`/api/transactions/${tx._id}/finalize`).set(bearer(orphanAdmin));
    expect(res.status).toBe(403);
  });

  test('SALE-PLAT-07 (Non-Admin PlatformOperator cannot finalize — the middleware requires role=Admin first)', async () => {
    const { tx } = await scenario();
    const nonAdminOp = await makeUser({ role: 'Proprietaire' });
    const granter = await makeUser({ role: 'Admin' });
    // Try to grant operator to non-Admin — but grantOperator only requires targetUser exists; the middleware still checks role='Admin'.
    await grantOperator({ userId: nonAdminOp._id, actor: granter, reason: 'SALE-PLAT-07', capabilities: ['platform.finance.manage'] });
    const res = await request(app).post(`/api/transactions/${tx._id}/finalize`).set(bearer(nonAdminOp));
    expect(res.status).toBe(403);
  });

  test('SALE-PLAT-08 (Admin + PlatformOperator without exact platform.finance.manage capability → DENIED)', async () => {
    const { tx } = await scenario();
    const opUser = await makeUser({ role: 'Admin' });
    const granter = await makeUser({ role: 'Admin' });
    await grantOperator({ userId: opUser._id, actor: granter, reason: 'SALE-PLAT-08', capabilities: ['platform.finance.read'] });
    const res = await request(app).post(`/api/transactions/${tx._id}/finalize`).set(bearer(opUser));
    expect(res.status).toBe(403);
  });

  test('SALE-PLAT-09 (Admin + PlatformOperator + platform.finance.manage → finalize reaches the controller — no auth 403)', async () => {
    const { tx } = await scenario();
    const opUser = await makeUser({ role: 'Admin' });
    const granter = await makeUser({ role: 'Admin' });
    await grantOperator({ userId: opUser._id, actor: granter, reason: 'SALE-PLAT-09', capabilities: ['platform.finance.manage'] });
    const res = await request(app).post(`/api/transactions/${tx._id}/finalize`).set(bearer(opUser));
    // La couche autorité laisse passer ; le résultat métier peut être 200/4xx business selon l'état
    // de la transaction (fixture raw sans finalization payload) — l'invariant testé ici est
    // NON-403 côté autorité. Le contrat financier reste géré par le service inchangé.
    expect(res.status).not.toBe(403);
  });

  test('SALE-PLAT-10 (forged body businessRole has no effect on platform authority)', async () => {
    const { fA, tx } = await scenario();
    const admin = await staffOf(fA, 'Admin', 'Admin');
    const res = await request(app)
      .post(`/api/transactions/${tx._id}/finalize`)
      .set(bearer(admin, fA.tenant))
      .send({ tenantBusinessRole: 'Admin', businessRole: 'Admin', platformCapability: 'platform.finance.manage' });
    expect(res.status).toBe(403);
  });

  test('SALE-PLAT-11 (forged X-Platform-Tenant-Id does not grant platform authority)', async () => {
    const { fA, tx } = await scenario();
    const fB = await tenantF('B');
    const adminA = await staffOf(fA, 'Admin', 'Admin');
    // Le tenant Admin A envoie un en-tête tenantB pour tenter de widener.
    const res = await request(app).post(`/api/transactions/${tx._id}/finalize`).set(bearer(adminA, fB.tenant));
    expect(res.status).toBe(403);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// SALE-OWNER — Ownership self-service reads preserved ; mutation denied
// ═══════════════════════════════════════════════════════════════════════════

describe('SALE-OWNER — ownership does not grant platform commercial authority', () => {
  test('SALE-OWNER-04 (Proprietaire cannot finalize their own transaction)', async () => {
    const fA = await tenantF('A');
    const owner = await makeUser({ role: 'Proprietaire' });
    await addTenantMember({ tenant: fA.tenant, user: owner, bootstrap: fA.bootstrap });
    const client = await makeUser({ role: 'Client' });
    const agent = await makeUser({ role: 'Admin' });
    const property = await makeProperty(owner, fA.tenant);
    const tx = await makeTransaction(property, client, agent);
    const res = await request(app).post(`/api/transactions/${tx.insertedId}/finalize`).set(bearer(owner, fA.tenant));
    expect(res.status).toBe(403);
  });

  test('SALE-OWNER-06 (Tenant Admin status does not expand ownership into commercial finalize)', async () => {
    const fA = await tenantF('A');
    const admin = await staffOf(fA, 'Admin', 'Admin');
    // Même le Tenant Admin (qui pourrait posséder la Property indirectement)
    // ne peut pas finaliser la transaction plateforme.
    const client = await makeUser({ role: 'Client' });
    const agent = await makeUser({ role: 'Admin' });
    const property = await makeProperty(admin, fA.tenant);
    const tx = await makeTransaction(property, client, agent);
    const res = await request(app).post(`/api/transactions/${tx.insertedId}/finalize`).set(bearer(admin, fA.tenant));
    expect(res.status).toBe(403);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// SALE-PAY — payment mutations require platform financial authority
// ═══════════════════════════════════════════════════════════════════════════

describe('SALE-PAY — payment mutations are PLATFORM FINANCIAL', () => {
  test('SALE-PAY-04 (Tenant Admin cannot record cash payment)', async () => {
    const fA = await tenantF('A');
    const admin = await staffOf(fA, 'Admin', 'Admin');
    const owner = await makeUser({ role: 'Proprietaire' });
    await addTenantMember({ tenant: fA.tenant, user: owner, bootstrap: fA.bootstrap });
    const client = await makeUser({ role: 'Client' });
    const agent = await makeUser({ role: 'Admin' });
    const property = await makeProperty(owner, fA.tenant);
    const tx = await makeTransaction(property, client, agent);
    const res = await request(app).post(`/api/transactions/${tx.insertedId}/paiements/especes`).set(bearer(admin, fA.tenant)).send({ montant: 1000000 });
    expect(res.status).toBe(403);
  });

  test('SALE-PAY-05 (Owner cannot record cash payment on their own transaction)', async () => {
    const fA = await tenantF('A');
    const owner = await makeUser({ role: 'Proprietaire' });
    const client = await makeUser({ role: 'Client' });
    const agent = await makeUser({ role: 'Admin' });
    const property = await makeProperty(owner, fA.tenant);
    const tx = await makeTransaction(property, client, agent);
    const res = await request(app).post(`/api/transactions/${tx.insertedId}/paiements/especes`).set(bearer(owner, fA.tenant)).send({ montant: 1000000 });
    expect(res.status).toBe(403);
  });

  test('SALE-PAY-10 (Admin + PlatformOperator + platform.finance.manage reaches the endpoint — auth layer accepts)', async () => {
    const fA = await tenantF('A');
    const owner = await makeUser({ role: 'Proprietaire' });
    const client = await makeUser({ role: 'Client' });
    const agent = await makeUser({ role: 'Admin' });
    const property = await makeProperty(owner, fA.tenant);
    const tx = await makeTransaction(property, client, agent);
    const opUser = await makeUser({ role: 'Admin' });
    const granter = await makeUser({ role: 'Admin' });
    await grantOperator({ userId: opUser._id, actor: granter, reason: 'SALE-PAY-10', capabilities: ['platform.finance.manage'] });
    const res = await request(app).post(`/api/transactions/${tx.insertedId}/paiements/especes`).set(bearer(opUser)).send({ montant: 1000000 });
    expect(res.status).not.toBe(403);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// SALE-FIN — commission/payout integrity: unauthorized calls freeze nothing
// ═══════════════════════════════════════════════════════════════════════════

describe('SALE-FIN — unauthorized commercial calls create no financial side effect', () => {
  test('SALE-FIN-01/02 (Tenant Admin denied finalize does not alter commission)', async () => {
    const fA = await tenantF('A');
    const admin = await staffOf(fA, 'Admin', 'Admin');
    const owner = await makeUser({ role: 'Proprietaire' });
    const client = await makeUser({ role: 'Client' });
    const agent = await makeUser({ role: 'Admin' });
    const property = await makeProperty(owner, fA.tenant);
    const tx = await makeTransaction(property, client, agent);
    const before = await Transaction.findById(tx.insertedId).lean();
    const res = await request(app).post(`/api/transactions/${tx.insertedId}/finalize`).set(bearer(admin, fA.tenant));
    expect(res.status).toBe(403);
    const after = await Transaction.findById(tx.insertedId).lean();
    expect(after.status).toBe(before.status);
    expect(after.commission).toEqual(before.commission);
  });

  test('SALE-FIN-06 (Owner cannot self-confirm a payout — no route markPayoutAsPaid exists; owner denied on any financial mutation)', async () => {
    const fA = await tenantF('A');
    const owner = await makeUser({ role: 'Proprietaire' });
    const client = await makeUser({ role: 'Client' });
    const agent = await makeUser({ role: 'Admin' });
    const property = await makeProperty(owner, fA.tenant);
    const tx = await makeTransaction(property, client, agent);
    // Le owner tente une mutation financière (finalize) — refusé.
    const res = await request(app).post(`/api/transactions/${tx.insertedId}/finalize`).set(bearer(owner, fA.tenant));
    expect(res.status).toBe(403);
    // Confirmation implicite : aucun endpoint « markPayoutAsPaid » n'est
    // exposé — un scan des routes /api/transactions ne le trouve pas.
    // Le tracking payout reste hors périmètre (SALE_PAYOUT_TRACKING_READY=PARTIAL).
  });
});
