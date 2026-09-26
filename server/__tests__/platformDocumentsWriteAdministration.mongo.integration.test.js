// PLATFORM-SUPER-ADMIN OPTION-3 SLICE-8 FINAL SPRINT — matrice P-DOC-W01…W38.
//
// Certifie l'ouverture Pattern 1 des écritures Documents génériques :
//   POST   /api/documents        (create)
//   PATCH  /api/documents/:id    (update)
//   DELETE /api/documents/:id    (hard delete + best-effort Cloudinary)
//
//   PATH A : OrgMembership { businessRole ∈ {Admin, Collaborateur,
//            Secretaire} } pour create/update; {Admin} seul pour delete.
//   PATH B : PlatformOperator actif + platform.documents.manage + tenant
//            sélectionné.
//
// Hardening PATH B :
//   - businessOperationKey (idempotence Financial Core) → 422 rejet
//     explicite côté CREATE et PATCH.
//   - tenant/privateAsset/createdBy déjà stripped côté controller.
//   - assertResourceTenant strict pour PATCH/DELETE.
//   - Financial Core immutability (DOCUMENT_IMMUTABLE 409) préservée.
//   - Cross-tenant fail-closed via assertResourceTenant existant.
//   - naked User.role='Admin' sans OrgMembership et sans PlatformOperator
//     est refusé par le nouveau gate (l'ancien restrictTo Admin retiré).
//
// Négatifs gestion-docs : platform.documents.manage ne donne AUCUN accès
// aux 6 POST /api/gestion-docs/* (Contract/Rental/Finance owned, hors
// Documents domain).

const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const { startFinancialMongo, clearFinancialMongo, stopFinancialMongo } = require('./helpers/financialMongoEnvironment');
const { createTenantFixture, addTenantMember } = require('./helpers/tenantAwareFixture');
const User = require('../models/User');
const OrgMembership = require('../models/OrgMembership');
const PlatformOperator = require('../models/PlatformOperator');
const Document = require('../models/Document');
const Transaction = require('../models/Transaction');
const Contrat = require('../models/Contrat');
const { grantOperator } = require('../services/platformOperator/platformOperatorService');
const documentRoutes = require('../routes/documentRoutes');
const gestionDocumentRoutes = require('../routes/gestionDocumentRoutes');
const { errorHandler } = require('../middleware/errorMiddleware');

jest.setTimeout(180000);

const app = express();
app.use(express.json());
app.use('/api/documents', documentRoutes);
app.use('/api/gestion-docs', gestionDocumentRoutes);
app.use(errorHandler);

const bearer = (user, tenantId) => ({
  Authorization: `Bearer ${jwt.sign({ id: user._id, tokenVersion: 0 }, process.env.JWT_SECRET, { expiresIn: '1d' })}`,
  ...(tenantId ? { 'X-Platform-Tenant-Id': String(tenantId) } : {}),
});

const makeUser = async (overrides = {}) => User.create({
  name: 'Test User',
  email: `u-${Date.now()}-${Math.random().toString(36).slice(2)}@example.test`,
  password: 'Password123!', passwordConfirm: 'Password123!',
  role: 'Collaborateur', isEmailVerified: true,
  ...overrides,
});

const setRole = (userId, tenant, businessRole) => OrgMembership.updateOne(
  { user: userId, orgUnit: tenant.rootOrgUnit, status: 'active' },
  { $set: { businessRole } },
);

const insertContrat = async ({ tenant, docs = [] }) => {
  const _id = new mongoose.Types.ObjectId();
  await Contrat.collection.insertOne({
    _id,
    type: 'location',
    tenant: tenant._id,
    documents: docs.map((d) => ({ _id: new mongoose.Types.ObjectId(), nom: d.nom || 'doc', type: d.type || 'bail', dateGeneration: new Date() })),
    createdAt: new Date(), updatedAt: new Date(),
  });
  return { _id, id: _id };
};

let tenantA; let tenantB; let bootstrapA; let bootstrapB;
let tenantAdminA; let tenantCollabA; let tenantSecretaireA; let tenantGMIA;
let tenantAdminB;
let platformGrantor; let operatorManage; let operatorRead; let operatorWrongCap; let operatorSuspended; let operatorRevoked;
let bareGlobalAdmin;
let docA1; let docB1; let contratA;

beforeAll(async () => {
  await startFinancialMongo();
  await OrgMembership.syncIndexes();
});
afterAll(stopFinancialMongo);

beforeEach(async () => {
  await clearFinancialMongo();
  const fA = await createTenantFixture({ label: 'PDOCW Tenant A' });
  const fB = await createTenantFixture({ label: 'PDOCW Tenant B' });
  tenantA = fA.tenant; bootstrapA = fA.bootstrap;
  tenantB = fB.tenant; bootstrapB = fB.bootstrap;

  tenantAdminA = await makeUser({ role: 'Admin' });
  await addTenantMember({ tenant: tenantA, user: tenantAdminA, bootstrap: bootstrapA });
  await setRole(tenantAdminA._id, tenantA, 'Admin');

  tenantCollabA = await makeUser({ role: 'Collaborateur' });
  await addTenantMember({ tenant: tenantA, user: tenantCollabA, bootstrap: bootstrapA });
  await setRole(tenantCollabA._id, tenantA, 'Collaborateur');

  tenantSecretaireA = await makeUser({ role: 'Secretaire' });
  await addTenantMember({ tenant: tenantA, user: tenantSecretaireA, bootstrap: bootstrapA });
  await setRole(tenantSecretaireA._id, tenantA, 'Secretaire');

  tenantGMIA = await makeUser({ role: 'GestionnaireImmobilier' });
  await addTenantMember({ tenant: tenantA, user: tenantGMIA, bootstrap: bootstrapA });
  await setRole(tenantGMIA._id, tenantA, 'GestionnaireImmobilier');

  tenantAdminB = await makeUser({ role: 'Admin' });
  await addTenantMember({ tenant: tenantB, user: tenantAdminB, bootstrap: bootstrapB });
  await setRole(tenantAdminB._id, tenantB, 'Admin');

  platformGrantor = await makeUser({ role: 'Admin' });
  await PlatformOperator.create({
    user: platformGrantor._id, status: 'active',
    capabilities: ['platform.operators.manage'],
    grantedBy: platformGrantor._id, grantReason: 'PDOCW bootstrap grantor',
  });

  // User.role='Communicant' pour éviter tout bypass legacy IAM (Communicant
  // n'a pas documents.* dans DEFAULT_CAPABILITIES). Isole la sémantique
  // du nouveau PATH B.
  operatorManage = await makeUser({ role: 'User' });
  await grantOperator({
    userId: operatorManage._id, actor: platformGrantor,
    capabilities: ['platform.documents.manage', 'platform.tenants.read'],
    reason: 'PDOCW operator with documents.manage',
  });

  operatorRead = await makeUser({ role: 'User' });
  await grantOperator({
    userId: operatorRead._id, actor: platformGrantor,
    capabilities: ['platform.documents.read', 'platform.tenants.read'],
    reason: 'PDOCW operator with documents.read only (must not write)',
  });

  operatorWrongCap = await makeUser({ role: 'User' });
  await grantOperator({
    userId: operatorWrongCap._id, actor: platformGrantor,
    capabilities: ['platform.finance.manage', 'platform.rentals.manage', 'platform.crm.manage'],
    reason: 'PDOCW operator with adjacent caps only, no documents.*',
  });

  operatorSuspended = await makeUser({ role: 'User' });
  await grantOperator({
    userId: operatorSuspended._id, actor: platformGrantor,
    capabilities: ['platform.documents.manage'],
    reason: 'PDOCW operator to be suspended',
  });
  await PlatformOperator.updateOne(
    { user: operatorSuspended._id },
    { $set: { status: 'suspended' } },
  );

  operatorRevoked = await makeUser({ role: 'User' });
  await grantOperator({
    userId: operatorRevoked._id, actor: platformGrantor,
    capabilities: ['platform.documents.manage'],
    reason: 'PDOCW operator to be revoked',
  });
  await PlatformOperator.updateOne(
    { user: operatorRevoked._id },
    { $set: { status: 'revoked' } },
  );

  bareGlobalAdmin = await makeUser({ role: 'Admin' });

  docA1 = await Document.create({
    tenant: tenantA._id, type: 'Devis', createdBy: tenantAdminA._id,
    items: [{ description: 'x', quantity: 1, unitPrice: 100, total: 100 }],
    subTotal: 100, totalAmount: 100,
  });
  docB1 = await Document.create({
    tenant: tenantB._id, type: 'Devis', createdBy: tenantAdminB._id,
    items: [{ description: 'z', quantity: 1, unitPrice: 500, total: 500 }],
    subTotal: 500, totalAmount: 500,
  });
  contratA = await insertContrat({ tenant: tenantA, docs: [{ nom: 'bail-a', type: 'bail' }] });
});

const validDevisBody = () => ({
  type: 'Devis',
  items: [{ description: 'test', quantity: 1, unitPrice: 100, total: 100 }],
});

// ═════════════════════════════════════════════════════════════════════
// P-DOC-W01 → P-DOC-W15 — POST /api/documents
// ═════════════════════════════════════════════════════════════════════

test('P-DOC-W01 PATH A Admin can POST /api/documents', async () => {
  const res = await request(app).post('/api/documents').set(bearer(tenantAdminA, tenantA._id)).send(validDevisBody());
  expect(res.status).toBe(201);
  expect(String(res.body.data.document.tenant)).toBe(String(tenantA._id));
});

test('P-DOC-W02 PATH A Collaborateur can POST /api/documents (writeWindow preserved for PATH A)', async () => {
  const res = await request(app).post('/api/documents').set(bearer(tenantCollabA, tenantA._id)).send(validDevisBody());
  expect(res.status).toBe(201);
});

test('P-DOC-W03 PATH A Secretaire can POST /api/documents', async () => {
  const res = await request(app).post('/api/documents').set(bearer(tenantSecretaireA, tenantA._id)).send(validDevisBody());
  expect(res.status).toBe(201);
});

test('P-DOC-W04 GestionnaireImmobilier (businessRole excluded) → 403 on POST', async () => {
  const res = await request(app).post('/api/documents').set(bearer(tenantGMIA, tenantA._id)).send(validDevisBody());
  expect(res.status).toBe(403);
});

test('P-DOC-W05 PATH B operator + documents.manage + Tenant A can POST', async () => {
  const res = await request(app).post('/api/documents').set(bearer(operatorManage, tenantA._id)).send(validDevisBody());
  expect(res.status).toBe(201);
  expect(String(res.body.data.document.tenant)).toBe(String(tenantA._id));
});

test('P-DOC-W06 PATH B operator documents.read ONLY → 403 on POST (read cannot write)', async () => {
  const res = await request(app).post('/api/documents').set(bearer(operatorRead, tenantA._id)).send(validDevisBody());
  expect(res.status).toBe(403);
});

test('P-DOC-W07 PATH B operator documents.manage WITHOUT selected tenant → 403', async () => {
  const res = await request(app).post('/api/documents').set(bearer(operatorManage)).send(validDevisBody());
  expect(res.status).toBe(403);
});

test('P-DOC-W08 PATH B operator with wrong capabilities (finance/rentals/crm) → 403 on POST', async () => {
  const res = await request(app).post('/api/documents').set(bearer(operatorWrongCap, tenantA._id)).send(validDevisBody());
  expect(res.status).toBe(403);
});

test('P-DOC-W09 suspended operator → 403 on POST', async () => {
  const res = await request(app).post('/api/documents').set(bearer(operatorSuspended, tenantA._id)).send(validDevisBody());
  expect(res.status).toBe(403);
});

test('P-DOC-W10 revoked operator → 403 on POST', async () => {
  const res = await request(app).post('/api/documents').set(bearer(operatorRevoked, tenantA._id)).send(validDevisBody());
  expect(res.status).toBe(403);
});

test('P-DOC-W11 naked global User.role=Admin without membership/operator → 403 on POST', async () => {
  const res = await request(app).post('/api/documents').set(bearer(bareGlobalAdmin, tenantA._id)).send(validDevisBody());
  expect(res.status).toBe(403);
});

test('P-DOC-W12 client-supplied tenant is ignored — server forces tenant = selected', async () => {
  const forgedBody = { ...validDevisBody(), tenant: String(tenantB._id) };
  const res = await request(app).post('/api/documents').set(bearer(operatorManage, tenantA._id)).send(forgedBody);
  expect(res.status).toBe(201);
  expect(String(res.body.data.document.tenant)).toBe(String(tenantA._id));
});

test('P-DOC-W13 cross-tenant relatedProperty is rejected (relationsConsistentWithTenant)', async () => {
  const Property = require('../models/Property');
  const propBId = new mongoose.Types.ObjectId();
  await Property.collection.insertOne({ _id: propBId, tenant: tenantB._id, owner: tenantAdminB._id, title: 'PB', createdAt: new Date(), updatedAt: new Date() });
  const res = await request(app).post('/api/documents')
    .set(bearer(operatorManage, tenantA._id))
    .send({ ...validDevisBody(), relatedProperty: String(propBId) });
  expect(res.status).toBe(422);
  expect(res.body.code).toBe('TENANT_RELATION_MISMATCH');
});

test('P-DOC-W14 cross-tenant client is rejected', async () => {
  const res = await request(app).post('/api/documents')
    .set(bearer(operatorManage, tenantA._id))
    .send({ ...validDevisBody(), client: String(tenantAdminB._id) });
  // tenantAdminB is a tenant B member → attribution resolves to tenant B → rejected
  expect(res.status).toBe(422);
});

test('P-DOC-W15 PATH B forging businessOperationKey on CREATE → 422 DOCUMENT_FIELD_IMMUTABLE_FOR_PLATFORM_OPERATOR', async () => {
  const res = await request(app).post('/api/documents')
    .set(bearer(operatorManage, tenantA._id))
    .send({ ...validDevisBody(), businessOperationKey: 'forged-key-attack' });
  expect(res.status).toBe(422);
  expect(res.body.code).toBe('DOCUMENT_FIELD_IMMUTABLE_FOR_PLATFORM_OPERATOR');
});

// ═════════════════════════════════════════════════════════════════════
// P-DOC-W16 → P-DOC-W27 — PATCH /api/documents/:id
// ═════════════════════════════════════════════════════════════════════

test('P-DOC-W16 PATH A Admin can PATCH own-tenant Document', async () => {
  const res = await request(app).patch(`/api/documents/${docA1._id}`).set(bearer(tenantAdminA, tenantA._id)).send({ notes: 'updated' });
  expect(res.status).toBe(200);
});

test('P-DOC-W17 PATH B operator manage + Tenant A + Document A → 200 PATCH', async () => {
  const res = await request(app).patch(`/api/documents/${docA1._id}`).set(bearer(operatorManage, tenantA._id)).send({ notes: 'op patch' });
  expect(res.status).toBe(200);
});

test('P-DOC-W18 PATH B operator documents.read ONLY → 403 on PATCH', async () => {
  const res = await request(app).patch(`/api/documents/${docA1._id}`).set(bearer(operatorRead, tenantA._id)).send({ notes: 'nope' });
  expect(res.status).toBe(403);
});

test('P-DOC-W19 PATH B operator Tenant A + Document B → cross-tenant fail-closed', async () => {
  const res = await request(app).patch(`/api/documents/${docB1._id}`).set(bearer(operatorManage, tenantA._id)).send({ notes: 'x' });
  expect([403, 404]).toContain(res.status);
});

test('P-DOC-W20 Document tenant:null → assertResourceTenant refuses PATH B', async () => {
  const legacyDoc = await Document.create({
    tenant: null, type: 'Devis', createdBy: tenantAdminA._id,
    items: [{ description: 'l', quantity: 1, unitPrice: 1, total: 1 }],
    subTotal: 1, totalAmount: 1,
  });
  const res = await request(app).patch(`/api/documents/${legacyDoc._id}`).set(bearer(operatorManage, tenantA._id)).send({ notes: 'x' });
  expect([403, 404]).toContain(res.status);
});

test('P-DOC-W21 PATH B tenant mutation attempt is ignored — server keeps existing tenant', async () => {
  const res = await request(app).patch(`/api/documents/${docA1._id}`).set(bearer(operatorManage, tenantA._id)).send({ tenant: String(tenantB._id), notes: 'attempt' });
  expect(res.status).toBe(200);
  const persisted = await Document.findById(docA1._id).lean();
  expect(String(persisted.tenant)).toBe(String(tenantA._id));
});

test('P-DOC-W22 PATH B privateAsset mutation attempt is stripped — never persisted', async () => {
  const res = await request(app).patch(`/api/documents/${docA1._id}`).set(bearer(operatorManage, tenantA._id))
    .send({ privateAsset: { publicId: 'forged/id', resourceType: 'raw', format: 'pdf' }, notes: 'attempt' });
  expect(res.status).toBe(200);
  const persisted = await Document.findById(docA1._id).lean();
  expect(persisted.privateAsset).toBeFalsy();
});

test('P-DOC-W23 PATH B businessOperationKey mutation attempt on PATCH → 422', async () => {
  const res = await request(app).patch(`/api/documents/${docA1._id}`).set(bearer(operatorManage, tenantA._id))
    .send({ businessOperationKey: 'forged' });
  expect(res.status).toBe(422);
  expect(res.body.code).toBe('DOCUMENT_FIELD_IMMUTABLE_FOR_PLATFORM_OPERATOR');
});

test('P-DOC-W24 cross-tenant relatedProperty injection on PATCH → 422', async () => {
  const Property = require('../models/Property');
  const propBId = new mongoose.Types.ObjectId();
  await Property.collection.insertOne({ _id: propBId, tenant: tenantB._id, owner: tenantAdminB._id, title: 'PB2', createdAt: new Date(), updatedAt: new Date() });
  const res = await request(app).patch(`/api/documents/${docA1._id}`).set(bearer(operatorManage, tenantA._id))
    .send({ relatedProperty: String(propBId) });
  expect(res.status).toBe(422);
});

test('P-DOC-W25 wrong capability → 403 on PATCH', async () => {
  const res = await request(app).patch(`/api/documents/${docA1._id}`).set(bearer(operatorWrongCap, tenantA._id)).send({ notes: 'x' });
  expect(res.status).toBe(403);
});

test('P-DOC-W26 suspended operator → 403 on PATCH', async () => {
  const res = await request(app).patch(`/api/documents/${docA1._id}`).set(bearer(operatorSuspended, tenantA._id)).send({ notes: 'x' });
  expect(res.status).toBe(403);
});

test('P-DOC-W27 naked global Admin → 403 on PATCH', async () => {
  const res = await request(app).patch(`/api/documents/${docA1._id}`).set(bearer(bareGlobalAdmin, tenantA._id)).send({ notes: 'x' });
  expect(res.status).toBe(403);
});

// ═════════════════════════════════════════════════════════════════════
// P-DOC-W28 → P-DOC-W36 — DELETE /api/documents/:id
// ═════════════════════════════════════════════════════════════════════

test('P-DOC-W28 PATH A Admin businessRole can DELETE own-tenant Document', async () => {
  const doc = await Document.create({ tenant: tenantA._id, type: 'Devis', createdBy: tenantAdminA._id, items: [{ description: 'del', quantity: 1, unitPrice: 1, total: 1 }] });
  const res = await request(app).delete(`/api/documents/${doc._id}`).set(bearer(tenantAdminA, tenantA._id));
  expect(res.status).toBe(204);
  expect(await Document.exists({ _id: doc._id })).toBeNull();
});

test('P-DOC-W29 PATH A Collaborateur (non-Admin businessRole) → 403 on DELETE', async () => {
  const doc = await Document.create({ tenant: tenantA._id, type: 'Devis', createdBy: tenantAdminA._id, items: [{ description: 'del2', quantity: 1, unitPrice: 1, total: 1 }] });
  const res = await request(app).delete(`/api/documents/${doc._id}`).set(bearer(tenantCollabA, tenantA._id));
  expect(res.status).toBe(403);
});

test('P-DOC-W30 PATH B operator manage + Tenant A + Document A → 204 DELETE', async () => {
  const doc = await Document.create({ tenant: tenantA._id, type: 'Devis', createdBy: tenantAdminA._id, items: [{ description: 'del3', quantity: 1, unitPrice: 1, total: 1 }] });
  const res = await request(app).delete(`/api/documents/${doc._id}`).set(bearer(operatorManage, tenantA._id));
  expect(res.status).toBe(204);
  expect(await Document.exists({ _id: doc._id })).toBeNull();
});

test('P-DOC-W31 PATH B operator documents.read ONLY → 403 on DELETE', async () => {
  const res = await request(app).delete(`/api/documents/${docA1._id}`).set(bearer(operatorRead, tenantA._id));
  expect(res.status).toBe(403);
});

test('P-DOC-W32 PATH B operator Tenant A + Document B → cross-tenant fail-closed on DELETE', async () => {
  const res = await request(app).delete(`/api/documents/${docB1._id}`).set(bearer(operatorManage, tenantA._id));
  expect([403, 404]).toContain(res.status);
  expect(await Document.exists({ _id: docB1._id })).toBeTruthy();
});

test('P-DOC-W33 Document tenant:null → DELETE fails-closed', async () => {
  const legacyDoc = await Document.create({
    tenant: null, type: 'Devis', createdBy: tenantAdminA._id,
    items: [{ description: 'l', quantity: 1, unitPrice: 1, total: 1 }],
  });
  const res = await request(app).delete(`/api/documents/${legacyDoc._id}`).set(bearer(operatorManage, tenantA._id));
  expect([403, 404]).toContain(res.status);
});

test('P-DOC-W34 naked global Admin → 403 on DELETE (restrictTo Admin bypass removed)', async () => {
  const res = await request(app).delete(`/api/documents/${docA1._id}`).set(bearer(bareGlobalAdmin, tenantA._id));
  expect(res.status).toBe(403);
  expect(await Document.exists({ _id: docA1._id })).toBeTruthy();
});

test('P-DOC-W35 DOCUMENT_IMMUTABLE preserved — businessOperationKey document cannot be deleted', async () => {
  const doc = await Document.create({
    tenant: tenantA._id, type: 'Facture', createdBy: tenantAdminA._id,
    items: [{ description: 'fin', quantity: 1, unitPrice: 1, total: 1 }],
    businessOperationKey: `fin-core-${Date.now()}`,
  });
  const res = await request(app).delete(`/api/documents/${doc._id}`).set(bearer(operatorManage, tenantA._id));
  expect(res.status).toBe(409);
  expect(res.body.code).toBe('DOCUMENT_IMMUTABLE');
  expect(await Document.exists({ _id: doc._id })).toBeTruthy();
});

test('P-DOC-W36 DOCUMENT_IMMUTABLE preserved — Transaction.linkedInvoice document cannot be deleted', async () => {
  const doc = await Document.create({
    tenant: tenantA._id, type: 'Facture', createdBy: tenantAdminA._id,
    items: [{ description: 'inv', quantity: 1, unitPrice: 1, total: 1 }],
  });
  await Transaction.collection.insertOne({ _id: new mongoose.Types.ObjectId(), linkedInvoice: doc._id, tenant: tenantA._id, status: 'Réussie', createdAt: new Date(), updatedAt: new Date() });
  const res = await request(app).delete(`/api/documents/${doc._id}`).set(bearer(tenantAdminA, tenantA._id));
  expect(res.status).toBe(409);
  expect(res.body.code).toBe('DOCUMENT_IMMUTABLE');
});

// ═════════════════════════════════════════════════════════════════════
// P-DOC-W37 → P-DOC-W38 — gestion-docs freeze (§43)
// platform.documents.manage MUST NOT unlock the 6 cross-domain POSTs
// ═════════════════════════════════════════════════════════════════════

test('P-DOC-W37 operator documents.manage cannot POST /api/gestion-docs/bail/:contratId (Contract-owned)', async () => {
  const res = await request(app).post(`/api/gestion-docs/bail/${contratA._id}`).set(bearer(operatorManage, tenantA._id)).send({});
  expect(res.status).toBe(403);
});

test('P-DOC-W38 operator documents.manage cannot POST /api/gestion-docs/etat-des-lieux/:contratId (Contract state mutation)', async () => {
  const res = await request(app).post(`/api/gestion-docs/etat-des-lieux/${contratA._id}`).set(bearer(operatorManage, tenantA._id)).send({ type: 'entree', pieces: [] });
  expect(res.status).toBe(403);
});
