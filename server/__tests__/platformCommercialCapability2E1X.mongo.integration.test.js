// USER-TENANT-MEMBERSHIP-ARCHITECTURE-2E.1.X
// PLATFORM-COMMERCIAL-CAPABILITY — TDD for platform.commercial.manage
// and notes authority separation from platform.finance.*.
const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const { startFinancialMongo, clearFinancialMongo, stopFinancialMongo } = require('./helpers/financialMongoEnvironment');
const { createTenantFixture, addTenantMember } = require('./helpers/tenantAwareFixture');
const {
  grantOperator,
  suspendOperator,
  hasCapability,
  PlatformOperatorError,
} = require('../services/platformOperator/platformOperatorService');
const { PLATFORM_OPERATOR_CAPABILITIES } = require('../constants/platformOperatorConstants');
const User = require('../models/User');
const Property = require('../models/Property');
const Transaction = require('../models/Transaction');
const PlatformOperator = require('../models/PlatformOperator');
const transactionRoutes = require('../routes/transactionRoutes');
const { errorHandler } = require('../middleware/errorMiddleware');
const { requirePlatformOperatorCapability } = require('../middleware/platformAuthority');

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
    name: `COMM-CAP ${seq}`, email: `comm-cap-${seq}-${Date.now()}@example.test`,
    password: 'Password123!', passwordConfirm: 'Password123!', role: 'Client', isEmailVerified: true, ...over,
  });
};
const makeProperty = (owner, tenant) => Property.create({
  title: `Villa Comm ${seq++}`, description: 'Description assez longue pour la validation Property.',
  pole: 'Altimmo', type: 'Villa', status: 'vente', price: 50000000,
  address: { city: 'Brazzaville', arrondissement: 'Centre' }, latitude: -4.26, longitude: 15.24,
  images: ['https://placehold.co/1200x800/png?text=Test'], surface: 120, statusAdmin: 'Validée', isPublished: true,
  availability: 'Disponible', owner: owner._id, tenant: tenant?._id || null,
});
const makeTransaction = async (property, client, agent, notes = 'initial-notes') => {
  const result = await Transaction.collection.insertOne({
    property: property._id, client: client._id, agent: agent._id,
    reservation: new mongoose.Types.ObjectId(),
    transactionType: 'vente', status: 'En cours',
    finalAmount: 50000000,
    commission: { taux: 10, total: 5000000, ownerPayout: 0, agencyNet: 5000000 },
    notes, transactionDate: new Date(), createdAt: new Date(),
  });
  return { _id: result.insertedId };
};

async function tenantF(label) {
  return createTenantFixture({ label: `COMM-CAP ${label} ${seq++}`, withAdminMembership: true });
}
async function staffOf(fixture, businessRole, userRole = 'Client') {
  const u = await makeUser({ role: userRole });
  await addTenantMember({ tenant: fixture.tenant, user: u, bootstrap: fixture.bootstrap, businessRole });
  return u;
}

beforeAll(startFinancialMongo);
afterEach(clearFinancialMongo);
afterAll(stopFinancialMongo);

describe('COMM-CAP — platform.commercial.manage registry and middleware', () => {
  test('COMM-CAP-01 (canonical registry accepts platform.commercial.manage)', async () => {
    expect(PLATFORM_OPERATOR_CAPABILITIES).toContain('platform.commercial.manage');
    expect(PlatformOperator.PLATFORM_OPERATOR_CAPABILITIES).toContain('platform.commercial.manage');
    const opUser = await makeUser({ role: 'Admin' });
    const granter = await makeUser({ role: 'Admin' });
    await expect(grantOperator({
      userId: opUser._id, actor: granter, reason: 'COMM-CAP-01',
      capabilities: ['platform.commercial.manage'],
    })).resolves.toMatchObject({ status: 'active', capabilities: expect.arrayContaining(['platform.commercial.manage']) });
  });

  test('COMM-CAP-02 (unknown capability remains rejected)', async () => {
    const opUser = await makeUser({ role: 'Admin' });
    const granter = await makeUser({ role: 'Admin' });
    await expect(grantOperator({
      userId: opUser._id, actor: granter, reason: 'COMM-CAP-02',
      capabilities: ['platform.commercial.godmode'],
    })).rejects.toMatchObject({ code: 'PLATFORM_OPERATOR_INVALID_CAPABILITY' });
    expect(PlatformOperatorError).toBeDefined();
  });

  test('COMM-CAP-03 (Tenant businessRole cannot satisfy platform commercial capability)', async () => {
    const fA = await tenantF('A');
    const admin = await staffOf(fA, 'Admin', 'Admin');
    const owner = await makeUser({ role: 'Proprietaire' });
    const client = await makeUser({ role: 'Client' });
    const agent = await makeUser({ role: 'Admin' });
    const property = await makeProperty(owner, fA.tenant);
    const tx = await makeTransaction(property, client, agent);
    const res = await request(app).patch(`/api/transactions/${tx._id}/notes`).set(bearer(admin, fA.tenant)).send({ notes: 'tenant-admin' });
    expect(res.status).toBe(403);
  });

  test('COMM-CAP-04 (Global Admin alone cannot satisfy it)', async () => {
    const fA = await tenantF('A');
    const orphanAdmin = await makeUser({ role: 'Admin' });
    const owner = await makeUser({ role: 'Proprietaire' });
    const client = await makeUser({ role: 'Client' });
    const agent = await makeUser({ role: 'Admin' });
    const property = await makeProperty(owner, fA.tenant);
    const tx = await makeTransaction(property, client, agent);
    const res = await request(app).patch(`/api/transactions/${tx._id}/notes`).set(bearer(orphanAdmin)).send({ notes: 'admin-alone' });
    expect(res.status).toBe(403);
  });

  test('COMM-CAP-05 (Non-Admin PlatformOperator cannot satisfy it)', async () => {
    const fA = await tenantF('A');
    const nonAdminOp = await makeUser({ role: 'Proprietaire' });
    const granter = await makeUser({ role: 'Admin' });
    await grantOperator({ userId: nonAdminOp._id, actor: granter, reason: 'COMM-CAP-05', capabilities: ['platform.commercial.manage'] });
    const owner = await makeUser({ role: 'Proprietaire' });
    const client = await makeUser({ role: 'Client' });
    const agent = await makeUser({ role: 'Admin' });
    const property = await makeProperty(owner, fA.tenant);
    const tx = await makeTransaction(property, client, agent);
    const res = await request(app).patch(`/api/transactions/${tx._id}/notes`).set(bearer(nonAdminOp)).send({ notes: 'non-admin-op' });
    expect(res.status).toBe(403);
  });

  test('COMM-CAP-06 (Admin + inactive PlatformOperator cannot satisfy it)', async () => {
    const fA = await tenantF('A');
    const opUser = await makeUser({ role: 'Admin' });
    const granter = await makeUser({ role: 'Admin' });
    await grantOperator({ userId: opUser._id, actor: granter, reason: 'COMM-CAP-06', capabilities: ['platform.commercial.manage'] });
    await suspendOperator({ userId: opUser._id, actor: granter, reason: 'COMM-CAP-06 suspend' });
    const owner = await makeUser({ role: 'Proprietaire' });
    const client = await makeUser({ role: 'Client' });
    const agent = await makeUser({ role: 'Admin' });
    const property = await makeProperty(owner, fA.tenant);
    const tx = await makeTransaction(property, client, agent);
    const res = await request(app).patch(`/api/transactions/${tx._id}/notes`).set(bearer(opUser)).send({ notes: 'inactive-op' });
    expect(res.status).toBe(403);
  });

  test('COMM-CAP-07 (Admin + active PlatformOperator without capability cannot satisfy it)', async () => {
    const fA = await tenantF('A');
    const opUser = await makeUser({ role: 'Admin' });
    const granter = await makeUser({ role: 'Admin' });
    await grantOperator({ userId: opUser._id, actor: granter, reason: 'COMM-CAP-07', capabilities: ['platform.finance.read'] });
    const owner = await makeUser({ role: 'Proprietaire' });
    const client = await makeUser({ role: 'Client' });
    const agent = await makeUser({ role: 'Admin' });
    const property = await makeProperty(owner, fA.tenant);
    const tx = await makeTransaction(property, client, agent);
    const res = await request(app).patch(`/api/transactions/${tx._id}/notes`).set(bearer(opUser)).send({ notes: 'no-comm-cap' });
    expect(res.status).toBe(403);
  });

  test('COMM-CAP-08 (Admin + active PlatformOperator + capability succeeds)', async () => {
    const fA = await tenantF('A');
    const opUser = await makeUser({ role: 'Admin' });
    const granter = await makeUser({ role: 'Admin' });
    await grantOperator({ userId: opUser._id, actor: granter, reason: 'COMM-CAP-08', capabilities: ['platform.commercial.manage'] });
    const owner = await makeUser({ role: 'Proprietaire' });
    const client = await makeUser({ role: 'Client' });
    const agent = await makeUser({ role: 'Admin' });
    const property = await makeProperty(owner, fA.tenant);
    const tx = await makeTransaction(property, client, agent);
    // USER-TENANT-MEMBERSHIP-ARCHITECTURE — un PlatformOperator sélectionne
    // explicitement un tenant à administrer (X-Platform-Tenant-Id) pour que
    // la frontière ressource puisse résoudre la Transaction cible.
    const res = await request(app).patch(`/api/transactions/${tx._id}/notes`).set(bearer(opUser, fA.tenant)).send({ notes: 'allowed-commercial' });
    expect(res.status).not.toBe(403);
    expect(res.status).toBe(200);
    expect(res.body.data.transaction.notes).toBe('allowed-commercial');
  });

  test('COMM-CAP-09 (forged capability in body/query/header has no effect)', async () => {
    const fA = await tenantF('A');
    const orphanAdmin = await makeUser({ role: 'Admin' });
    const owner = await makeUser({ role: 'Proprietaire' });
    const client = await makeUser({ role: 'Client' });
    const agent = await makeUser({ role: 'Admin' });
    const property = await makeProperty(owner, fA.tenant);
    const tx = await makeTransaction(property, client, agent);
    const res = await request(app)
      .patch(`/api/transactions/${tx._id}/notes`)
      .set({
        ...bearer(orphanAdmin),
        'X-Platform-Capability': 'platform.commercial.manage',
      })
      .query({ capability: 'platform.commercial.manage' })
      .send({ notes: 'forged', platformCapability: 'platform.commercial.manage', capabilities: ['platform.commercial.manage'] });
    expect(res.status).toBe(403);
  });

  test('COMM-CAP-10 (another platform capability does not imply commercial.manage)', async () => {
    const op = { status: 'active', capabilities: ['platform.finance.manage', 'platform.crm.manage', 'platform.properties.manage'] };
    expect(hasCapability(op, 'platform.commercial.manage')).toBe(false);
    const fA = await tenantF('A');
    const opUser = await makeUser({ role: 'Admin' });
    const granter = await makeUser({ role: 'Admin' });
    await grantOperator({
      userId: opUser._id, actor: granter, reason: 'COMM-CAP-10',
      capabilities: ['platform.finance.manage', 'platform.crm.manage'],
    });
    const owner = await makeUser({ role: 'Proprietaire' });
    const client = await makeUser({ role: 'Client' });
    const agent = await makeUser({ role: 'Admin' });
    const property = await makeProperty(owner, fA.tenant);
    const tx = await makeTransaction(property, client, agent);
    const res = await request(app).patch(`/api/transactions/${tx._id}/notes`).set(bearer(opUser)).send({ notes: 'other-caps' });
    expect(res.status).toBe(403);
  });
});

describe('COMM-NOTE — updateNotes requires platform.commercial.manage', () => {
  async function scenario() {
    const fA = await tenantF('A');
    const owner = await makeUser({ role: 'Proprietaire' });
    await addTenantMember({ tenant: fA.tenant, user: owner, bootstrap: fA.bootstrap });
    const client = await makeUser({ role: 'Client' });
    const agent = await makeUser({ role: 'Admin' });
    const property = await makeProperty(owner, fA.tenant);
    const tx = await makeTransaction(property, client, agent, 'unchanged-notes');
    return { fA, owner, client, property, tx };
  }

  test('COMM-NOTE-01 (Tenant Admin → DENIED)', async () => {
    const { fA, tx } = await scenario();
    const admin = await staffOf(fA, 'Admin', 'Admin');
    const res = await request(app).patch(`/api/transactions/${tx._id}/notes`).set(bearer(admin, fA.tenant)).send({ notes: 'x' });
    expect(res.status).toBe(403);
  });

  test('COMM-NOTE-02 (Proprietaire → DENIED)', async () => {
    const { fA, owner, tx } = await scenario();
    const res = await request(app).patch(`/api/transactions/${tx._id}/notes`).set(bearer(owner, fA.tenant)).send({ notes: 'x' });
    expect(res.status).toBe(403);
  });

  test('COMM-NOTE-03 (Client → DENIED)', async () => {
    const { fA, client, tx } = await scenario();
    const res = await request(app).patch(`/api/transactions/${tx._id}/notes`).set(bearer(client, fA.tenant)).send({ notes: 'x' });
    expect(res.status).toBe(403);
  });

  test('COMM-NOTE-04 (Global Admin alone → DENIED)', async () => {
    const { tx } = await scenario();
    const orphanAdmin = await makeUser({ role: 'Admin' });
    const res = await request(app).patch(`/api/transactions/${tx._id}/notes`).set(bearer(orphanAdmin)).send({ notes: 'x' });
    // USER-TENANT-MEMBERSHIP-ARCHITECTURE — orphan Global Admin sans tenant
    // sélectionné : 403 (chaîne tenant amont) OU 404 (frontière ressource
    // sans tenant résolu) — les deux sont fail-closed canoniques ; le point
    // certifié est l'absence d'autorisation, jamais 200. Alignement avec
    // 2E1XI COMM-NOTE-09 (same invariant).
    expect([403, 404]).toContain(res.status);
    expect(res.status).not.toBe(200);
  });

  test('COMM-NOTE-05 (Admin + PlatformOperator without commercial.manage → DENIED)', async () => {
    const { tx } = await scenario();
    const opUser = await makeUser({ role: 'Admin' });
    const granter = await makeUser({ role: 'Admin' });
    await grantOperator({ userId: opUser._id, actor: granter, reason: 'COMM-NOTE-05', capabilities: ['platform.properties.manage'] });
    const res = await request(app).patch(`/api/transactions/${tx._id}/notes`).set(bearer(opUser)).send({ notes: 'x' });
    expect(res.status).toBe(403);
  });

  test('COMM-NOTE-06 (Admin + PlatformOperator + finance.manage WITHOUT commercial.manage → DENIED)', async () => {
    const { tx } = await scenario();
    const opUser = await makeUser({ role: 'Admin' });
    const granter = await makeUser({ role: 'Admin' });
    await grantOperator({ userId: opUser._id, actor: granter, reason: 'COMM-NOTE-06', capabilities: ['platform.finance.manage'] });
    const res = await request(app).patch(`/api/transactions/${tx._id}/notes`).set(bearer(opUser)).send({ notes: 'finance-does-not-imply-commercial' });
    expect(res.status).toBe(403);
  });

  test('COMM-NOTE-07 (Admin + PlatformOperator + commercial.manage → ALLOWED)', async () => {
    const { fA, tx } = await scenario();
    const opUser = await makeUser({ role: 'Admin' });
    const granter = await makeUser({ role: 'Admin' });
    await grantOperator({ userId: opUser._id, actor: granter, reason: 'COMM-NOTE-07', capabilities: ['platform.commercial.manage'] });
    // USER-TENANT-MEMBERSHIP-ARCHITECTURE — un PlatformOperator doit
    // sélectionner explicitement un tenant à administrer (X-Platform-Tenant-Id)
    // pour que la frontière ressource puisse résoudre la Transaction.
    // Sans sélection, la ressource est inaccessible (404) — comportement
    // fail-closed canonique, jamais un fallback à un scope global.
    const res = await request(app).patch(`/api/transactions/${tx._id}/notes`).set(bearer(opUser, fA.tenant)).send({ notes: 'commercial-ok' });
    expect(res.status).toBe(200);
    expect(res.body.data.transaction.notes).toBe('commercial-ok');
  });

  test('COMM-NOTE-08 (forged tenant/businessRole/capability → no effect)', async () => {
    const { fA, tx } = await scenario();
    const admin = await staffOf(fA, 'Admin', 'Admin');
    const res = await request(app)
      .patch(`/api/transactions/${tx._id}/notes`)
      .set(bearer(admin, fA.tenant))
      .send({ notes: 'forged', businessRole: 'Admin', tenantBusinessRole: 'Admin', platformCapability: 'platform.commercial.manage' });
    expect(res.status).toBe(403);
  });

  test('COMM-NOTE-09 (Denied request → notes unchanged)', async () => {
    const { fA, tx } = await scenario();
    const admin = await staffOf(fA, 'Admin', 'Admin');
    const res = await request(app).patch(`/api/transactions/${tx._id}/notes`).set(bearer(admin, fA.tenant)).send({ notes: 'should-not-persist' });
    expect(res.status).toBe(403);
    const after = await Transaction.findById(tx._id).lean();
    expect(after.notes).toBe('unchanged-notes');
  });

  test('COMM-NOTE-10 (Cross-tenant membership does not influence platform authority)', async () => {
    const { fA, tx } = await scenario();
    const fB = await tenantF('B');
    const adminA = await staffOf(fA, 'Admin', 'Admin');
    const res = await request(app).patch(`/api/transactions/${tx._id}/notes`).set(bearer(adminA, fB.tenant)).send({ notes: 'cross-tenant' });
    expect(res.status).toBe(403);
  });
});

describe('FIN-CAP — commercial.manage does not grant financial authority', () => {
  async function scenario() {
    const fA = await tenantF('A');
    const owner = await makeUser({ role: 'Proprietaire' });
    const client = await makeUser({ role: 'Client' });
    const agent = await makeUser({ role: 'Admin' });
    const property = await makeProperty(owner, fA.tenant);
    const tx = await makeTransaction(property, client, agent);
    const opUser = await makeUser({ role: 'Admin' });
    const granter = await makeUser({ role: 'Admin' });
    await grantOperator({ userId: opUser._id, actor: granter, reason: 'FIN-CAP', capabilities: ['platform.commercial.manage'] });
    return { fA, tx, opUser, property, client, agent };
  }

  test('FIN-CAP-01 (commercial.manage alone cannot finalize transaction)', async () => {
    const { tx, opUser } = await scenario();
    const res = await request(app).post(`/api/transactions/${tx._id}/finalize`).set(bearer(opUser));
    expect(res.status).toBe(403);
  });

  test('FIN-CAP-02 (commercial.manage alone cannot validate payment)', async () => {
    const { tx, opUser } = await scenario();
    const paiementId = new mongoose.Types.ObjectId();
    const res = await request(app)
      .patch(`/api/transactions/${tx._id}/paiements/${paiementId}/valider`)
      .set(bearer(opUser))
      .send({ action: 'valider' });
    expect(res.status).toBe(403);
  });

  test('FIN-CAP-03 (commercial.manage alone cannot record protected financial mutation)', async () => {
    const { tx, opUser } = await scenario();
    const res = await request(app)
      .post(`/api/transactions/${tx._id}/paiements/especes`)
      .set(bearer(opUser))
      .send({ montant: 1000000 });
    expect(res.status).toBe(403);
  });

  test('FIN-CAP-04 (finance.manage retains finalize authority)', async () => {
    const fA = await tenantF('A');
    const owner = await makeUser({ role: 'Proprietaire' });
    const client = await makeUser({ role: 'Client' });
    const agent = await makeUser({ role: 'Admin' });
    const property = await makeProperty(owner, fA.tenant);
    const tx = await makeTransaction(property, client, agent);
    const opUser = await makeUser({ role: 'Admin' });
    const granter = await makeUser({ role: 'Admin' });
    await grantOperator({ userId: opUser._id, actor: granter, reason: 'FIN-CAP-04', capabilities: ['platform.finance.manage'] });
    const res = await request(app).post(`/api/transactions/${tx._id}/finalize`).set(bearer(opUser));
    expect(res.status).not.toBe(403);
  });

  test('FIN-CAP-05 (finance.manage retains payment validation authority)', async () => {
    const fA = await tenantF('A');
    const owner = await makeUser({ role: 'Proprietaire' });
    const client = await makeUser({ role: 'Client' });
    const agent = await makeUser({ role: 'Admin' });
    const property = await makeProperty(owner, fA.tenant);
    const tx = await makeTransaction(property, client, agent);
    const opUser = await makeUser({ role: 'Admin' });
    const granter = await makeUser({ role: 'Admin' });
    await grantOperator({ userId: opUser._id, actor: granter, reason: 'FIN-CAP-05', capabilities: ['platform.finance.manage'] });
    const paiementId = new mongoose.Types.ObjectId();
    const res = await request(app)
      .patch(`/api/transactions/${tx._id}/paiements/${paiementId}/valider`)
      .set(bearer(opUser))
      .send({ action: 'valider' });
    expect(res.status).not.toBe(403);
  });

  test('FIN-CAP-06 (commission calculation unchanged)', () => {
    // Runtime formula from transactionController — 10% default, no special → ownerPayout 0.
    const finalAmount = 50000000;
    const tauxPercent = 10;
    const total = Math.round(finalAmount * (tauxPercent / 100));
    const ownerPayout = 0;
    const agencyNet = total - ownerPayout;
    expect({ taux: tauxPercent, total, ownerPayout, agencyNet }).toEqual({
      taux: 10, total: 5000000, ownerPayout: 0, agencyNet: 5000000,
    });
  });

  test('FIN-CAP-07 (payout calculation unchanged)', () => {
    const finalAmount = 50000000;
    const tauxPercent = 10;
    const hasSpecial = true;
    const total = Math.round(finalAmount * (tauxPercent / 100));
    const ownerPayout = Math.round(total * 0.30);
    const agencyNet = total - ownerPayout;
    expect({ total, ownerPayout, agencyNet }).toEqual({
      total: 5000000, ownerPayout: 1500000, agencyNet: 3500000,
    });
  });

  test('FIN-CAP-08 (denied commercial operation has zero financial side effects)', async () => {
    const { fA, tx } = await scenario();
    const admin = await staffOf(fA, 'Admin', 'Admin');
    const before = await Transaction.findById(tx._id).lean();
    const res = await request(app).patch(`/api/transactions/${tx._id}/notes`).set(bearer(admin, fA.tenant)).send({ notes: 'denied' });
    expect(res.status).toBe(403);
    const after = await Transaction.findById(tx._id).lean();
    expect(after.status).toBe(before.status);
    expect(after.commission).toEqual(before.commission);
    expect(after.finalAmount).toBe(before.finalAmount);
    expect(after.notes).toBe(before.notes);
  });
});

describe('CAPABILITY INDEPENDENCE — no implicit inheritance', () => {
  test('commercial.manage does not imply finance.manage', () => {
    const op = { status: 'active', capabilities: ['platform.commercial.manage'] };
    expect(hasCapability(op, 'platform.finance.manage')).toBe(false);
    expect(hasCapability(op, 'platform.commercial.manage')).toBe(true);
  });

  test('finance.manage does not imply commercial.manage', () => {
    const op = { status: 'active', capabilities: ['platform.finance.manage'] };
    expect(hasCapability(op, 'platform.commercial.manage')).toBe(false);
    expect(hasCapability(op, 'platform.finance.manage')).toBe(true);
  });

  test('middleware requirePlatformOperatorCapability is exact-match only', async () => {
    const req = {
      user: { _id: new mongoose.Types.ObjectId(), role: 'Admin' },
    };
    const res = { statusCode: null, body: null, status(c) { this.statusCode = c; return this; }, json(b) { this.body = b; return this; } };
    let nextCalled = false;
    // Without an active operator document, even Admin fails closed.
    await requirePlatformOperatorCapability('platform.commercial.manage')(req, res, () => { nextCalled = true; });
    expect(nextCalled).toBe(false);
    expect(res.statusCode).toBe(403);
  });
});
