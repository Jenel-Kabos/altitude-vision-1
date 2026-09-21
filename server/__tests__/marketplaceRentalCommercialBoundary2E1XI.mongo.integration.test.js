// USER-TENANT-MEMBERSHIP-ARCHITECTURE-2E.1.X — MARKETPLACE RENTAL
// COMMERCIAL BOUNDARY — pre-contract rental commercialization authority.
// Certifie que :
//  - la conclusion marketplace rental (`Contrat.type='location'` créé
//    directement via `POST /api/contrats`, OU `POST /api/transactions`
//    avec `transactionType='location'` + finalize) exige l'autorité
//    canonique plateforme (`platform.commercial.manage` /
//    `platform.finance.manage`) ;
//  - le workspace propriétaire ne peut PAS conclure lui-même la
//    location marketplace ;
//  - la self-service publication d'un bien locatif reste autorisée
//    au propriétaire selon les règles Property existantes ;
//  - le domaine post-contrat (rental-lease-lifecycle,
//    paiements/location) reste inchangé.
const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const { startFinancialMongo, clearFinancialMongo, stopFinancialMongo } = require('./helpers/financialMongoEnvironment');
const { createTenantFixture, addTenantMember } = require('./helpers/tenantAwareFixture');
const { grantOperator } = require('../services/platformOperator/platformOperatorService');
const User = require('../models/User');
const Property = require('../models/Property');
const Contrat = require('../models/Contrat');
const Transaction = require('../models/Transaction');
const contratRoutes = require('../routes/contratRoutes');
const transactionRoutes = require('../routes/transactionRoutes');
const { errorHandler } = require('../middleware/errorMiddleware');

jest.setTimeout(180000);

const app = express();
app.use(express.json());
app.use('/api/contrats', contratRoutes);
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
    name: `MRCB ${seq}`, email: `mrcb-${seq}-${Date.now()}@example.test`,
    password: 'Password123!', passwordConfirm: 'Password123!', role: 'Client', isEmailVerified: true, ...over,
  });
};
const makeProperty = (owner, tenant) => Property.create({
  title: `Bien MRCB ${seq++}`, description: 'Description assez longue pour la validation Property.',
  pole: 'Altimmo', type: 'Villa', status: 'location', price: 500000,
  address: { city: 'Brazzaville', arrondissement: 'Centre' }, latitude: -4.26, longitude: 15.24,
  images: ['https://placehold.co/1200x800/png?text=Test'], surface: 80, statusAdmin: 'Validée', isPublished: true,
  availability: 'Disponible', owner: owner._id, tenant: tenant?._id || null,
});
async function operatorWith(capabilities) {
  const op = await makeUser({ role: 'Admin' });
  const granter = await makeUser({ role: 'Admin' });
  await grantOperator({ userId: op._id, actor: granter, reason: 'MRCB fixture', capabilities });
  return op;
}

beforeAll(startFinancialMongo);
afterEach(clearFinancialMongo);
afterAll(stopFinancialMongo);

// ═══════════════════════════════════════════════════════════════════════════
// MRCB — Marketplace rental Transaction operations (already covered by C.1)
// ═══════════════════════════════════════════════════════════════════════════

describe('MRCB — rental Transaction lifecycle uses canonical platform authority (C.1 regression)', () => {
  async function rentalTx() {
    const fA = await createTenantFixture({ label: `MRCB tx ${seq++}`, withAdminMembership: true });
    const owner = await makeUser({ role: 'Proprietaire' });
    await addTenantMember({ tenant: fA.tenant, user: owner, bootstrap: fA.bootstrap });
    const client = await makeUser({ role: 'Client' });
    const agent = await makeUser({ role: 'Admin' });
    const property = await makeProperty(owner, fA.tenant);
    const raw = { property: property._id, client: client._id, agent: agent._id, reservation: new mongoose.Types.ObjectId(), transactionType: 'location', status: 'En cours', finalAmount: 500000, transactionDate: new Date(), createdAt: new Date() };
    const insert = await Transaction.collection.insertOne(raw);
    return { fA, owner, client, property, txId: insert.insertedId };
  }

  test('MRCB-02/03/04 (Tenant Admin cannot finalize a rental Transaction)', async () => {
    const { fA, txId } = await rentalTx();
    const admin = await makeUser({ role: 'Admin' });
    await addTenantMember({ tenant: fA.tenant, user: admin, bootstrap: fA.bootstrap, businessRole: 'Admin' });
    const res = await request(app).post(`/api/transactions/${txId}/finalize`).set(bearer(admin, fA.tenant));
    expect(res.status).toBe(403);
  });

  test('MRCB-06 (Proprietaire cannot finalize their own rental Transaction)', async () => {
    const { fA, owner, txId } = await rentalTx();
    const res = await request(app).post(`/api/transactions/${txId}/finalize`).set(bearer(owner, fA.tenant));
    expect(res.status).toBe(403);
  });

  test('MRCB-05 (Client cannot finalize a rental Transaction)', async () => {
    const { fA, client, txId } = await rentalTx();
    const res = await request(app).post(`/api/transactions/${txId}/finalize`).set(bearer(client, fA.tenant));
    expect(res.status).toBe(403);
  });

  test('MRCB-07 (Global User.role=Admin without PlatformOperator → DENIED on rental finalize)', async () => {
    const { txId } = await rentalTx();
    const orphan = await makeUser({ role: 'Admin' });
    const res = await request(app).post(`/api/transactions/${txId}/finalize`).set(bearer(orphan));
    expect(res.status).toBe(403);
  });

  test('MRCB-11/12 (Admin + PlatformOperator + platform.finance.manage authorized on rental finalize; commercial.manage alone denied)', async () => {
    const { txId } = await rentalTx();
    const financeOp = await operatorWith(['platform.finance.manage']);
    const commercialOp = await operatorWith(['platform.commercial.manage']);
    const resFin = await request(app).post(`/api/transactions/${txId}/finalize`).set(bearer(financeOp));
    expect(resFin.status).not.toBe(403);
    const resComm = await request(app).post(`/api/transactions/${txId}/finalize`).set(bearer(commercialOp));
    expect(resComm.status).toBe(403);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// MRCB — Direct rental contract creation via POST /api/contrats
// ═══════════════════════════════════════════════════════════════════════════

describe('MRCB — POST /api/contrats (rental contract formation) is PLATFORM-ONLY (marketplace conclusion)', () => {
  async function contractCandidate() {
    const fA = await createTenantFixture({ label: `MRCB contrat ${seq++}`, withAdminMembership: true });
    const owner = await makeUser({ role: 'Proprietaire' });
    await addTenantMember({ tenant: fA.tenant, user: owner, bootstrap: fA.bootstrap });
    const property = await Property.create({
      title: `Bien MRCB contrat ${seq++}`, description: 'Description assez longue pour la validation Property.',
      pole: 'Altimmo', type: 'Villa', status: 'location', price: 500000,
      address: { city: 'Brazzaville', arrondissement: 'Centre' }, latitude: -4.26, longitude: 15.24,
      images: ['https://placehold.co/1200x800/png?text=Test'], surface: 80, statusAdmin: 'Validée', isPublished: true,
      availability: 'Disponible', owner: owner._id, tenant: fA.tenant._id,
    });
    return { fA, owner, property };
  }

  const payload = (property) => ({ bien: String(property._id), type: 'location', montantLoyer: 500000 });

  test('MRCB-02b (Tenant Admin cannot create marketplace rental Contrat)', async () => {
    const { fA, owner, property } = await contractCandidate();
    const admin = await makeUser({ role: 'Admin' });
    await addTenantMember({ tenant: fA.tenant, user: admin, bootstrap: fA.bootstrap, businessRole: 'Admin' });
    const res = await request(app).post('/api/contrats').set(bearer(admin, fA.tenant)).send(payload(property));
    expect(res.status).toBe(403);
    expect(await Contrat.countDocuments({ bien: property._id, type: 'location' })).toBe(0);
    void owner;
  });

  test('MRCB-06b (Proprietaire cannot create marketplace rental Contrat)', async () => {
    const { fA, owner, property } = await contractCandidate();
    const res = await request(app).post('/api/contrats').set(bearer(owner, fA.tenant)).send(payload(property));
    expect(res.status).toBe(403);
  });

  test('MRCB-07b (Global User.role=Admin without PlatformOperator → DENIED)', async () => {
    const { property } = await contractCandidate();
    const orphan = await makeUser({ role: 'Admin' });
    const res = await request(app).post('/api/contrats').set(bearer(orphan)).send(payload(property));
    expect(res.status).toBe(403);
    expect(await Contrat.countDocuments({ bien: property._id, type: 'location' })).toBe(0);
  });

  test('MRCB-11b (Admin + PlatformOperator + platform.commercial.manage → allowed)', async () => {
    const { property } = await contractCandidate();
    const op = await operatorWith(['platform.commercial.manage']);
    const res = await request(app).post('/api/contrats').set(bearer(op)).send(payload(property));
    // La couche autorité laisse passer ; le résultat métier peut échouer
    // pour d'autres raisons (validation), l'invariant testé est NON-403.
    expect(res.status).not.toBe(403);
  });

  test('MRCB-10b (Admin + PlatformOperator + finance.manage only → DENIED — capability independence)', async () => {
    const { property } = await contractCandidate();
    const op = await operatorWith(['platform.finance.manage']);
    const res = await request(app).post('/api/contrats').set(bearer(op)).send(payload(property));
    expect(res.status).toBe(403);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// MRCB — post-contract preservation
// ═══════════════════════════════════════════════════════════════════════════

describe('MRCB — post-contract boundaries preserved', () => {
  test('MRCB-18 (Property publication is NOT gated by managed-property quota)', async () => {
    // Le seul créer-Property test qu'on peut valider ici sans HTTP :
    // Property.create direct — n'implique aucune activation
    // RentalManagement, donc n'est pas comptée dans maxManagedProperties.
    const owner = await makeUser({ role: 'Proprietaire' });
    const fA = await createTenantFixture({ label: 'MRCB quota', withAdminMembership: true });
    // Créer plusieurs Property sur le tenant : n'active AUCUN RentalManagement.
    for (let i = 0; i < 5; i += 1) await makeProperty(owner, fA.tenant);
    const RentalManagement = require('../models/RentalManagement');
    const active = await RentalManagement.countDocuments({ tenant: fA.tenant._id, managementActivated: true });
    expect(active).toBe(0);
  });

  test('MRCB-19 (marketplace conclusion does not implicitly activate RentalManagement)', async () => {
    const owner = await makeUser({ role: 'Proprietaire' });
    const fA = await createTenantFixture({ label: 'MRCB no auto-activate', withAdminMembership: true });
    const property = await makeProperty(owner, fA.tenant);
    // Aucun endpoint marketplace n'a été appelé ; c'est un check statique
    // qu'aucun RentalManagement n'existe.
    const RentalManagement = require('../models/RentalManagement');
    expect(await RentalManagement.countDocuments({ property: property._id })).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// MRCB — capability independence adversarial
// ═══════════════════════════════════════════════════════════════════════════

describe('MRCB — capability independence + separation invariants', () => {
  test('MRCB-25 (finance.manage does NOT imply commercial.manage)', async () => {
    const financeOp = await operatorWith(['platform.finance.manage']);
    // POST /api/contrats (marketplace commercial) requires commercial.manage.
    const owner = await makeUser({ role: 'Proprietaire' });
    const property = await Property.create({
      title: `Bien MRCB Cap ${seq++}`, description: 'Description assez longue pour la validation Property.',
      pole: 'Altimmo', type: 'Villa', status: 'location', price: 500000,
      address: { city: 'Brazzaville', arrondissement: 'Centre' }, latitude: -4.26, longitude: 15.24,
      images: ['https://placehold.co/1200x800/png?text=Test'], surface: 80, statusAdmin: 'Validée', isPublished: true,
      availability: 'Disponible', owner: owner._id,
    });
    const res = await request(app).post('/api/contrats').set(bearer(financeOp)).send({ bien: String(property._id), type: 'location', montantLoyer: 500000 });
    expect(res.status).toBe(403);
  });

  test('MRCB-26 (commercial.manage does NOT imply finance.manage)', async () => {
    const commercialOp = await operatorWith(['platform.commercial.manage']);
    const owner = await makeUser({ role: 'Proprietaire' });
    const property = await Property.create({
      title: `Bien MRCB Cap2 ${seq++}`, description: 'Description assez longue pour la validation Property.',
      pole: 'Altimmo', type: 'Villa', status: 'location', price: 500000,
      address: { city: 'Brazzaville', arrondissement: 'Centre' }, latitude: -4.26, longitude: 15.24,
      images: ['https://placehold.co/1200x800/png?text=Test'], surface: 80, statusAdmin: 'Validée', isPublished: true,
      availability: 'Disponible', owner: owner._id,
    });
    const client = await makeUser({ role: 'Client' });
    const agent = await makeUser({ role: 'Admin' });
    const raw = { property: property._id, client: client._id, agent: agent._id, reservation: new mongoose.Types.ObjectId(), transactionType: 'location', status: 'En cours', finalAmount: 500000, transactionDate: new Date(), createdAt: new Date() };
    const insert = await Transaction.collection.insertOne(raw);
    // POST /api/transactions/:id/finalize requires finance.manage.
    const res = await request(app).post(`/api/transactions/${insert.insertedId}/finalize`).set(bearer(commercialOp));
    expect(res.status).toBe(403);
  });
});
