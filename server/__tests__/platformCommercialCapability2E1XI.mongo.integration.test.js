// USER-TENANT-MEMBERSHIP-ARCHITECTURE-2E.1.X-PLATFORM-COMMERCIAL-CAPABILITY —
// certifie la séparation canonique entre `platform.commercial.manage`
// et `platform.finance.manage`. Aucune capacité n'implique l'autre.
// La ressource cible est `PATCH /api/transactions/:id/notes` — la seule
// opération commerciale non-financière migrée dans ce lot.
const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const { startFinancialMongo, clearFinancialMongo, stopFinancialMongo } = require('./helpers/financialMongoEnvironment');
const { createTenantFixture, addTenantMember } = require('./helpers/tenantAwareFixture');
const { grantOperator } = require('../services/platformOperator/platformOperatorService');
const { PLATFORM_OPERATOR_CAPABILITIES } = require('../constants/platformOperatorConstants');
const User = require('../models/User');
const Property = require('../models/Property');
const Transaction = require('../models/Transaction');
const PlatformOperator = require('../models/PlatformOperator');
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
const makeTransaction = (property, client, agent) => Transaction.collection.insertOne({
  property: property._id, client: client._id, agent: agent._id,
  reservation: new mongoose.Types.ObjectId(),
  transactionType: 'vente', status: 'En cours',
  finalAmount: 50000000, transactionDate: new Date(), createdAt: new Date(),
});

async function makeOperator(capabilities) {
  const opUser = await makeUser({ role: 'Admin' });
  const granter = await makeUser({ role: 'Admin' });
  await grantOperator({ userId: opUser._id, actor: granter, reason: 'COMM-CAP fixture', capabilities });
  return opUser;
}

async function scenario() {
  const fA = await createTenantFixture({ label: `COMM-CAP ${seq++}`, withAdminMembership: true });
  const owner = await makeUser({ role: 'Proprietaire' });
  await addTenantMember({ tenant: fA.tenant, user: owner, bootstrap: fA.bootstrap });
  const client = await makeUser({ role: 'Client' });
  const agent = await makeUser({ role: 'Admin' });
  const property = await makeProperty(owner, fA.tenant);
  const tx = await makeTransaction(property, client, agent);
  return { fA, owner, client, agent, property, txId: tx.insertedId };
}

beforeAll(startFinancialMongo);
afterEach(clearFinancialMongo);
afterAll(stopFinancialMongo);

// ═══════════════════════════════════════════════════════════════════════════
// COMM-CAP — canonical registry & authority
// ═══════════════════════════════════════════════════════════════════════════

describe('COMM-CAP — canonical registry + Admin+Operator+capability contract', () => {
  test('COMM-CAP-01 (registry contains platform.commercial.manage)', () => {
    expect(PLATFORM_OPERATOR_CAPABILITIES).toContain('platform.commercial.manage');
  });

  test('COMM-CAP-02 (unknown capability remains rejected — grantOperator schema/validation)', async () => {
    const target = await makeUser({ role: 'Admin' });
    const granter = await makeUser({ role: 'Admin' });
    await expect(grantOperator({
      userId: target._id, actor: granter, reason: 'unknown cap test',
      capabilities: ['platform.nonexistent.manage'],
    })).rejects.toBeDefined();
  });

  test('COMM-CAP-03 (Tenant Admin businessRole cannot satisfy platform.commercial.manage)', async () => {
    const { fA, txId } = await scenario();
    const admin = await makeUser({ role: 'Admin' });
    await addTenantMember({ tenant: fA.tenant, user: admin, bootstrap: fA.bootstrap, businessRole: 'Admin' });
    const res = await request(app).patch(`/api/transactions/${txId}/notes`).set(bearer(admin, fA.tenant)).send({ notes: 'hostile' });
    expect(res.status).toBe(403);
  });

  test('COMM-CAP-04 (Global Admin alone → DENIED)', async () => {
    const { txId } = await scenario();
    const orphan = await makeUser({ role: 'Admin' });
    const res = await request(app).patch(`/api/transactions/${txId}/notes`).set(bearer(orphan)).send({ notes: 'hostile' });
    expect(res.status).toBe(403);
  });

  test('COMM-CAP-05 (Non-Admin PlatformOperator → DENIED — middleware requires role=Admin)', async () => {
    const { txId } = await scenario();
    const nonAdminOp = await makeUser({ role: 'Proprietaire' });
    const granter = await makeUser({ role: 'Admin' });
    await grantOperator({ userId: nonAdminOp._id, actor: granter, reason: 'COMM-CAP-05', capabilities: ['platform.commercial.manage'] });
    const res = await request(app).patch(`/api/transactions/${txId}/notes`).set(bearer(nonAdminOp)).send({ notes: 'hostile' });
    expect(res.status).toBe(403);
  });

  test('COMM-CAP-06 (Admin + suspended PlatformOperator → DENIED)', async () => {
    const { txId } = await scenario();
    const op = await makeOperator(['platform.commercial.manage']);
    await PlatformOperator.updateOne({ user: op._id }, { $set: { status: 'suspended' } });
    const res = await request(app).patch(`/api/transactions/${txId}/notes`).set(bearer(op)).send({ notes: 'hostile' });
    expect(res.status).toBe(403);
  });

  test('COMM-CAP-07 (Admin + active PlatformOperator sans platform.commercial.manage → DENIED)', async () => {
    const { txId } = await scenario();
    const op = await makeOperator(['platform.finance.read']); // aucune commercial.*
    const res = await request(app).patch(`/api/transactions/${txId}/notes`).set(bearer(op)).send({ notes: 'hostile' });
    expect(res.status).toBe(403);
  });

  test('COMM-CAP-08 (Admin + PlatformOperator + platform.commercial.manage → ALLOWED)', async () => {
    const { txId } = await scenario();
    const op = await makeOperator(['platform.commercial.manage']);
    const res = await request(app).patch(`/api/transactions/${txId}/notes`).set(bearer(op)).send({ notes: 'Note commerciale légitime' });
    // La couche autorité laisse passer ; le résultat métier est renvoyé par
    // le controller. L'invariant testé est NON-403 côté autorité.
    expect(res.status).not.toBe(403);
  });

  test('COMM-CAP-09 (forged body/query/header capability has no effect)', async () => {
    const { fA, txId } = await scenario();
    const admin = await makeUser({ role: 'Admin' });
    await addTenantMember({ tenant: fA.tenant, user: admin, bootstrap: fA.bootstrap, businessRole: 'Admin' });
    const res = await request(app)
      .patch(`/api/transactions/${txId}/notes`)
      .set(bearer(admin, fA.tenant))
      .set('X-Platform-Capability', 'platform.commercial.manage')
      .send({ notes: 'hostile', platformCapability: 'platform.commercial.manage', capabilities: ['platform.commercial.manage'] });
    expect(res.status).toBe(403);
  });

  test('COMM-CAP-10 (another capability does NOT imply commercial.manage)', async () => {
    const { txId } = await scenario();
    // Un operator qui a TOUTES les autres capacités sauf commercial.manage.
    const others = PLATFORM_OPERATOR_CAPABILITIES.filter((c) => c !== 'platform.commercial.manage');
    const op = await makeOperator(others);
    const res = await request(app).patch(`/api/transactions/${txId}/notes`).set(bearer(op)).send({ notes: 'hostile' });
    expect(res.status).toBe(403);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// COMM-NOTE — updateNotes contract
// ═══════════════════════════════════════════════════════════════════════════

describe('COMM-NOTE — PATCH /api/transactions/:id/notes requires platform.commercial.manage', () => {
  test('COMM-NOTE-01/02/03 (Tenant Admin / Proprietaire / Client → DENIED)', async () => {
    const { fA, owner, client, txId } = await scenario();
    const tAdmin = await makeUser({ role: 'Admin' });
    await addTenantMember({ tenant: fA.tenant, user: tAdmin, bootstrap: fA.bootstrap, businessRole: 'Admin' });
    for (const actor of [tAdmin, owner, client]) {
      const res = await request(app).patch(`/api/transactions/${txId}/notes`).set(bearer(actor, fA.tenant)).send({ notes: 'nope' });
      expect(res.status).toBe(403);
    }
  });

  test('COMM-NOTE-06 (Admin + PlatformOperator + platform.finance.manage SANS commercial.manage → DENIED — capabilities are independent)', async () => {
    const { txId } = await scenario();
    const op = await makeOperator(['platform.finance.manage']); // finance seulement
    const res = await request(app).patch(`/api/transactions/${txId}/notes`).set(bearer(op)).send({ notes: 'hostile' });
    expect(res.status).toBe(403);
  });

  test('COMM-NOTE-07 (Admin + PlatformOperator + platform.commercial.manage → ALLOWED)', async () => {
    const { txId } = await scenario();
    const op = await makeOperator(['platform.commercial.manage']);
    const res = await request(app).patch(`/api/transactions/${txId}/notes`).set(bearer(op)).send({ notes: 'ok' });
    expect(res.status).not.toBe(403);
  });

  test('COMM-NOTE-09 (denied request leaves notes unchanged)', async () => {
    const { txId } = await scenario();
    const before = await Transaction.findById(txId).lean();
    const orphan = await makeUser({ role: 'Admin' });
    const res = await request(app).patch(`/api/transactions/${txId}/notes`).set(bearer(orphan)).send({ notes: 'unauthorized change' });
    expect(res.status).toBe(403);
    const after = await Transaction.findById(txId).lean();
    expect(after.notes).toEqual(before.notes);
    expect(after.updatedAt).toEqual(before.updatedAt);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// FIN-CAP — capability independence: commercial ≠ finance
// ═══════════════════════════════════════════════════════════════════════════

describe('FIN-CAP — platform.commercial.manage does NOT imply platform.finance.manage (and vice versa)', () => {
  test('FIN-CAP-01 (commercial.manage alone cannot finalize transaction)', async () => {
    const { txId } = await scenario();
    const op = await makeOperator(['platform.commercial.manage']); // pas de finance.manage
    const res = await request(app).post(`/api/transactions/${txId}/finalize`).set(bearer(op));
    expect(res.status).toBe(403);
  });

  test('FIN-CAP-02 (commercial.manage alone cannot record cash payment)', async () => {
    const { txId } = await scenario();
    const op = await makeOperator(['platform.commercial.manage']);
    const res = await request(app).post(`/api/transactions/${txId}/paiements/especes`).set(bearer(op)).send({ montant: 100000 });
    expect(res.status).toBe(403);
  });

  test('FIN-CAP-03 (commercial.manage alone cannot cancel — cancel is financial)', async () => {
    const { txId } = await scenario();
    const op = await makeOperator(['platform.commercial.manage']);
    const res = await request(app).patch(`/api/transactions/${txId}/cancel`).set(bearer(op)).send({ raison: 'test' });
    expect(res.status).toBe(403);
  });

  test('FIN-CAP-04 (finance.manage alone cannot update notes — commercial capability required)', async () => {
    const { txId } = await scenario();
    const op = await makeOperator(['platform.finance.manage']);
    const res = await request(app).patch(`/api/transactions/${txId}/notes`).set(bearer(op)).send({ notes: 'from-finance-op' });
    expect(res.status).toBe(403);
  });

  test('FIN-CAP-05 (finance.manage retains finalize authority)', async () => {
    const { txId } = await scenario();
    const op = await makeOperator(['platform.finance.manage']);
    const res = await request(app).post(`/api/transactions/${txId}/finalize`).set(bearer(op));
    expect(res.status).not.toBe(403);
  });

  test('FIN-CAP-08 (denied commercial operation → zero financial side effect)', async () => {
    const { txId } = await scenario();
    const before = await Transaction.findById(txId).lean();
    const op = await makeOperator(['platform.finance.manage']); // pas commercial
    const res = await request(app).patch(`/api/transactions/${txId}/notes`).set(bearer(op)).send({ notes: 'hostile' });
    expect(res.status).toBe(403);
    const after = await Transaction.findById(txId).lean();
    // Aucun changement de commission/status/finalization suite au refus.
    expect(after.commission).toEqual(before.commission);
    expect(after.status).toBe(before.status);
    expect(after.notes).toEqual(before.notes);
  });
});
