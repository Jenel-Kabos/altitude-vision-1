// PLATFORM-SUPER-ADMIN OPTION-3 SLICE-8 PHASE-2A — matrice P-DOC-01…22.
//
// Prouve la composition d'autorité mise en place sur les 3 routes READ
// certifiées de la slice Documents :
//   GET /api/documents
//   GET /api/documents/:id
//   GET /api/gestion-docs/contrat/:contratId
//
//   PATH A : OrgMembership { businessRole ∈ {Admin, Collaborateur,
//            Secretaire} } dans le tenant sélectionné.
//   PATH B : PlatformOperator actif + platform.documents.read (ou
//            .manage comme superset lecture) + tenant explicitement
//            sélectionné (X-Platform-Tenant-Id).
//
// Aucun bypass User.role, aucune ouverture d'écriture (POST/PATCH/DELETE
// /api/documents restent strictement sur l'IAM legacy hors scope), aucune
// modification self-service rental-documents, aucune modification Finance,
// aucune ouverture des 6 POST gestion-docs générateurs.

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

// Contrat fixture — insertMany bypasse la validation stricte (le contrôleur
// gestionDocumentController.getDocuments lit seulement contrat.documents[]
// et contrat.tenant, aucun autre champ n'est requis dans ce parcours READ).
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
let tenantAdminA; let tenantCollabA; let tenantSecretaireA; let tenantGMIA; let tenantAdminB;
let platformGrantor; let operatorRead; let operatorManage; let operatorWrongCap; let operatorSuspended; let operatorRevoked;
let bareGlobalAdmin;
let docA1; let docA2; let docB1;
let contratA; let contratB; let contratNull;

beforeAll(async () => {
  await startFinancialMongo();
  await OrgMembership.syncIndexes();
});
afterAll(stopFinancialMongo);

beforeEach(async () => {
  await clearFinancialMongo();
  const fA = await createTenantFixture({ label: 'PDOC Tenant A' });
  const fB = await createTenantFixture({ label: 'PDOC Tenant B' });
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

  // GestionnaireImmobilier — membre tenant A mais businessRole EXCLU pour
  // documents.read : doit être refusé PATH A.
  tenantGMIA = await makeUser({ role: 'GestionnaireImmobilier' });
  await addTenantMember({ tenant: tenantA, user: tenantGMIA, bootstrap: bootstrapA });
  await setRole(tenantGMIA._id, tenantA, 'GestionnaireImmobilier');

  tenantAdminB = await makeUser({ role: 'Admin' });
  await addTenantMember({ tenant: tenantB, user: tenantAdminB, bootstrap: bootstrapB });
  await setRole(tenantAdminB._id, tenantB, 'Admin');

  // Platform operators — grantOperator interdit le self-grant, on utilise un
  // grantor séparé porteur de platform.operators.manage.
  platformGrantor = await makeUser({ role: 'Admin' });
  await PlatformOperator.create({
    user: platformGrantor._id, status: 'active',
    capabilities: ['platform.operators.manage'],
    grantedBy: platformGrantor._id, grantReason: 'PDOC bootstrap grantor',
  });

  // PLATFORM-SUPER-ADMIN OPTION-3 SLICE-8 PHASE-2A — operators MUST use a
  // User.role that has NO legacy documents.* capability (via '*' or
  // 'legacy.full') in iamArchitecture DEFAULT_CAPABILITIES; otherwise the
  // pre-existing legacy IAM path (requireCapability on POST/PATCH/DELETE)
  // would admit them regardless of the new PATH B gate — which would mask
  // the actual capability separation this suite proves. 'Communicant' has
  // only { messages.read, messages.manage, visits.read } — zero documents.*
  // leakage — and is the correct control User.role for these tests.
  operatorRead = await makeUser({ role: 'Communicant' });
  await grantOperator({
    userId: operatorRead._id, actor: platformGrantor,
    capabilities: ['platform.documents.read', 'platform.tenants.read'],
    reason: 'PDOC operator with documents.read only',
  });

  operatorManage = await makeUser({ role: 'Communicant' });
  await grantOperator({
    userId: operatorManage._id, actor: platformGrantor,
    capabilities: ['platform.documents.manage', 'platform.tenants.read'],
    reason: 'PDOC operator with documents.manage (superset read)',
  });

  operatorWrongCap = await makeUser({ role: 'Communicant' });
  await grantOperator({
    userId: operatorWrongCap._id, actor: platformGrantor,
    capabilities: ['platform.finance.read', 'platform.rentals.read', 'platform.crm.read'],
    reason: 'PDOC operator with adjacent-only capabilities, no documents.*',
  });

  operatorSuspended = await makeUser({ role: 'Communicant' });
  await grantOperator({
    userId: operatorSuspended._id, actor: platformGrantor,
    capabilities: ['platform.documents.read'],
    reason: 'PDOC operator to be suspended',
  });
  await PlatformOperator.updateOne(
    { user: operatorSuspended._id },
    { $set: { status: 'suspended' } },
  );

  operatorRevoked = await makeUser({ role: 'Communicant' });
  await grantOperator({
    userId: operatorRevoked._id, actor: platformGrantor,
    capabilities: ['platform.documents.read'],
    reason: 'PDOC operator to be revoked',
  });
  await PlatformOperator.updateOne(
    { user: operatorRevoked._id },
    { $set: { status: 'revoked' } },
  );

  // Bare global User.role='Admin' — aucune OrgMembership, aucun
  // PlatformOperator : ne doit franchir NI PATH A NI PATH B.
  bareGlobalAdmin = await makeUser({ role: 'Admin' });

  // Fixtures Document — tenant A (2), tenant B (1), un legacy tenant=null
  // qui ne doit pas remonter côté opérateur avec tenant A sélectionné.
  docA1 = await Document.create({
    tenant: tenantA._id, type: 'Devis', createdBy: tenantAdminA._id,
    items: [{ description: 'x', quantity: 1, unitPrice: 100, total: 100 }],
    subTotal: 100, totalAmount: 100,
    businessOperationKey: `pdoc-a1-${Date.now()}`,
  });
  docA2 = await Document.create({
    tenant: tenantA._id, type: 'Facture', createdBy: tenantAdminA._id,
    items: [{ description: 'y', quantity: 1, unitPrice: 250, total: 250 }],
    subTotal: 250, totalAmount: 250,
    businessOperationKey: `pdoc-a2-${Date.now()}`,
  });
  docB1 = await Document.create({
    tenant: tenantB._id, type: 'Devis', createdBy: tenantAdminB._id,
    items: [{ description: 'z', quantity: 1, unitPrice: 500, total: 500 }],
    subTotal: 500, totalAmount: 500,
    businessOperationKey: `pdoc-b1-${Date.now()}`,
  });

  contratA = await insertContrat({ tenant: tenantA, docs: [{ nom: 'bail-a', type: 'bail' }] });
  contratB = await insertContrat({ tenant: tenantB, docs: [{ nom: 'bail-b', type: 'bail' }] });
  // Legacy Contrat sans attribution tenant directe (`tenant: null`) —
  // reproduit le cas où `resolveResourceTenant` retourne `unresolved` (le
  // service d'attribution dérive le tenant via `bien`/Property uniquement,
  // et ce Contrat n'a ni tenant ni bien). Doit être fail-closed pour un
  // PlatformOperator quel que soit le tenant sélectionné.
  contratNull = await (async () => {
    const _id = new mongoose.Types.ObjectId();
    await Contrat.collection.insertOne({
      _id, type: 'location', tenant: null,
      documents: [{ _id: new mongoose.Types.ObjectId(), nom: 'legacy-null-doc', type: 'bail', dateGeneration: new Date() }],
      createdAt: new Date(), updatedAt: new Date(),
    });
    return { _id, id: _id };
  })();
});

// ═════════════════════════════════════════════════════════════════════
// P-DOC-01 → P-DOC-03 — PATH A tenant staff READ
// ═════════════════════════════════════════════════════════════════════

test('P-DOC-01 tenant Admin PATH A can list /api/documents', async () => {
  const res = await request(app).get('/api/documents').set(bearer(tenantAdminA, tenantA._id));
  expect(res.status).toBe(200);
});

test('P-DOC-02 tenant Collaborateur PATH A can list /api/documents', async () => {
  const res = await request(app).get('/api/documents').set(bearer(tenantCollabA, tenantA._id));
  expect(res.status).toBe(200);
});

test('P-DOC-03 tenant Secretaire PATH A can list /api/documents', async () => {
  const res = await request(app).get('/api/documents').set(bearer(tenantSecretaireA, tenantA._id));
  expect(res.status).toBe(200);
});

test('P-DOC-04 GestionnaireImmobilier tenant member is denied — businessRole excluded from documents.read PATH A', async () => {
  const res = await request(app).get('/api/documents').set(bearer(tenantGMIA, tenantA._id));
  expect(res.status).toBe(403);
});

test('P-DOC-05 tenant Admin PATH A can GET /api/documents/:id in own tenant', async () => {
  const res = await request(app).get(`/api/documents/${docA1._id}`).set(bearer(tenantAdminA, tenantA._id));
  expect(res.status).toBe(200);
});

test('P-DOC-06 tenant Admin PATH A cross-tenant GET /api/documents/:id blocked', async () => {
  const res = await request(app).get(`/api/documents/${docB1._id}`).set(bearer(tenantAdminA, tenantA._id));
  expect([403, 404]).toContain(res.status);
});

// ═════════════════════════════════════════════════════════════════════
// P-DOC-07 → P-DOC-14 — PATH B PlatformOperator READ
// ═════════════════════════════════════════════════════════════════════

test('P-DOC-07 PlatformOperator + documents.read + Tenant A can list /api/documents', async () => {
  const res = await request(app).get('/api/documents').set(bearer(operatorRead, tenantA._id));
  expect(res.status).toBe(200);
});

test('P-DOC-08 PlatformOperator + documents.manage + Tenant A can list (manage as read superset)', async () => {
  const res = await request(app).get('/api/documents').set(bearer(operatorManage, tenantA._id));
  expect(res.status).toBe(200);
});

test('P-DOC-09 PlatformOperator + documents.read WITHOUT selected tenant is denied', async () => {
  const res = await request(app).get('/api/documents').set(bearer(operatorRead));
  expect(res.status).toBe(403);
});

test('P-DOC-10 PlatformOperator + documents.read + Tenant A cannot access Tenant B document', async () => {
  const res = await request(app).get(`/api/documents/${docB1._id}`).set(bearer(operatorRead, tenantA._id));
  expect([403, 404]).toContain(res.status);
});

test('P-DOC-11 PlatformOperator + documents.read + Tenant A can GET own-tenant document', async () => {
  const res = await request(app).get(`/api/documents/${docA1._id}`).set(bearer(operatorRead, tenantA._id));
  expect(res.status).toBe(200);
});

test('P-DOC-12 PlatformOperator with wrong capabilities (finance/rentals/crm only) is denied', async () => {
  const res = await request(app).get('/api/documents').set(bearer(operatorWrongCap, tenantA._id));
  expect(res.status).toBe(403);
});

test('P-DOC-13 suspended PlatformOperator is denied even with documents.read', async () => {
  const res = await request(app).get('/api/documents').set(bearer(operatorSuspended, tenantA._id));
  expect(res.status).toBe(403);
});

test('P-DOC-14 revoked PlatformOperator is denied', async () => {
  const res = await request(app).get('/api/documents').set(bearer(operatorRevoked, tenantA._id));
  expect(res.status).toBe(403);
});

// ═════════════════════════════════════════════════════════════════════
// P-DOC-15 — Bare global User.role='Admin' NO PATH — must fail on the
// new Pattern 1 gate. (La dette IAM legacy DELETE reste hors scope —
// on ne teste que le nouveau PATH B côté /api/documents READ.)
// ═════════════════════════════════════════════════════════════════════

test('P-DOC-15 bare global User.role=Admin without OrgMembership and without PlatformOperator is denied by new PATH B', async () => {
  const res = await request(app).get('/api/documents').set(bearer(bareGlobalAdmin, tenantA._id));
  expect(res.status).toBe(403);
});

// ═════════════════════════════════════════════════════════════════════
// P-DOC-16 → P-DOC-18 — Slice does NOT open writes
// ═════════════════════════════════════════════════════════════════════

test('P-DOC-16 PlatformOperator documents.read cannot POST /api/documents (write not opened)', async () => {
  const res = await request(app)
    .post('/api/documents')
    .set(bearer(operatorRead, tenantA._id))
    .send({ type: 'Devis', items: [{ description: 'q', quantity: 1, unitPrice: 10, total: 10 }] });
  expect([401, 403]).toContain(res.status);
});

test('P-DOC-17 PlatformOperator documents.read cannot PATCH /api/documents/:id (write not opened)', async () => {
  const res = await request(app)
    .patch(`/api/documents/${docA1._id}`)
    .set(bearer(operatorRead, tenantA._id))
    .send({ notes: 'x' });
  expect([401, 403]).toContain(res.status);
});

test('P-DOC-18 PlatformOperator documents.manage on DELETE — Financial Core immutability preserved (docA1 has businessOperationKey → 409)', async () => {
  // FINAL SPRINT — DELETE authority migrated to Pattern 1 (see
  // platformDocumentsWriteAdministration matrix). Pattern 1 admits the
  // operator via PATH B (platform.documents.manage), but the controller
  // still enforces DOCUMENT_IMMUTABLE 409 when the document is bound to
  // Financial Core (businessOperationKey or Transaction.linkedInvoice) —
  // this is the invariant we want to prove is preserved.
  const res = await request(app)
    .delete(`/api/documents/${docA1._id}`)
    .set(bearer(operatorManage, tenantA._id));
  expect(res.status).toBe(409);
  expect(res.body.code).toBe('DOCUMENT_IMMUTABLE');
});

// ═════════════════════════════════════════════════════════════════════
// P-DOC-G01 → P-DOC-G18 — Phase 2A.1 CONTRACT READ GUARD matrix.
// GET /api/gestion-docs/contrat/:contratId now uses Pattern 1 compositional
// authority (PATH A businessRole ∈ {Admin,Collaborateur,Secretaire} OR
// PATH B active PlatformOperator + platform.documents.read/manage +
// selected tenant) plus a route-local platform-aware tenant guard
// (assertContratPlatformOperatorTenantScope) that fail-closed enforces
// `contrat.tenant === req.platformTenant._id` for PlatformOperator context
// — closing the fail-open gap in resolveResourceTenant for Contrats
// without a `bien`. The 6 POST generation routes remain untouched on
// legacy requireCapability + router.param authority.
// ═════════════════════════════════════════════════════════════════════

test('P-DOC-G01 PATH A tenant Admin can GET /api/gestion-docs/contrat/:id in own tenant', async () => {
  const res = await request(app).get(`/api/gestion-docs/contrat/${contratA._id}`).set(bearer(tenantAdminA, tenantA._id));
  expect(res.status).toBe(200);
});

test('P-DOC-G02 PATH A tenant Collaborateur can GET /api/gestion-docs/contrat/:id in own tenant', async () => {
  const res = await request(app).get(`/api/gestion-docs/contrat/${contratA._id}`).set(bearer(tenantCollabA, tenantA._id));
  expect(res.status).toBe(200);
});

test('P-DOC-G03 PATH A tenant Secretaire can GET /api/gestion-docs/contrat/:id in own tenant', async () => {
  const res = await request(app).get(`/api/gestion-docs/contrat/${contratA._id}`).set(bearer(tenantSecretaireA, tenantA._id));
  expect(res.status).toBe(200);
});

test('P-DOC-G04 GestionnaireImmobilier tenant member is denied (businessRole excluded)', async () => {
  const res = await request(app).get(`/api/gestion-docs/contrat/${contratA._id}`).set(bearer(tenantGMIA, tenantA._id));
  expect(res.status).toBe(403);
});

test('P-DOC-G05 PATH B operator + documents.read + Tenant A + Contrat A → 200', async () => {
  const res = await request(app).get(`/api/gestion-docs/contrat/${contratA._id}`).set(bearer(operatorRead, tenantA._id));
  expect(res.status).toBe(200);
});

test('P-DOC-G06 PATH B operator + documents.manage + Tenant A + Contrat A → 200 (manage as read superset)', async () => {
  const res = await request(app).get(`/api/gestion-docs/contrat/${contratA._id}`).set(bearer(operatorManage, tenantA._id));
  expect(res.status).toBe(200);
});

test('P-DOC-G07 PATH B operator documents.read WITHOUT selected tenant → denied', async () => {
  const res = await request(app).get(`/api/gestion-docs/contrat/${contratA._id}`).set(bearer(operatorRead));
  expect(res.status).toBe(403);
});

test('P-DOC-G08 CRITICAL cross-tenant — operator + Tenant A + Contrat B → 404 fail-closed', async () => {
  const res = await request(app).get(`/api/gestion-docs/contrat/${contratB._id}`).set(bearer(operatorRead, tenantA._id));
  // Guard's assertContratPlatformOperatorTenantScope enforces
  // contrat.tenant match; must never leak Tenant B content.
  expect(res.status).toBe(404);
});

test('P-DOC-G09 CRITICAL — operator + Tenant A + Contrat tenant:null legacy → 404 fail-closed (no owner-based fallback for operators)', async () => {
  const res = await request(app).get(`/api/gestion-docs/contrat/${contratNull._id}`).set(bearer(operatorRead, tenantA._id));
  expect(res.status).toBe(404);
});

test('P-DOC-G10 PATH B operator with wrong capabilities (finance/rentals/crm only) → 403', async () => {
  const res = await request(app).get(`/api/gestion-docs/contrat/${contratA._id}`).set(bearer(operatorWrongCap, tenantA._id));
  expect(res.status).toBe(403);
});

test('P-DOC-G11 suspended operator → 403 even with documents.read', async () => {
  const res = await request(app).get(`/api/gestion-docs/contrat/${contratA._id}`).set(bearer(operatorSuspended, tenantA._id));
  expect(res.status).toBe(403);
});

test('P-DOC-G12 revoked operator → 403', async () => {
  const res = await request(app).get(`/api/gestion-docs/contrat/${contratA._id}`).set(bearer(operatorRevoked, tenantA._id));
  expect(res.status).toBe(403);
});

test('P-DOC-G13 naked User.role=Admin without OrgMembership and without PlatformOperator → denied by new PATH B', async () => {
  const res = await request(app).get(`/api/gestion-docs/contrat/${contratA._id}`).set(bearer(bareGlobalAdmin, tenantA._id));
  expect(res.status).toBe(403);
});

test('P-DOC-G14 operator documents.read cannot POST /api/gestion-docs/bail/:contratId (write NOT opened by Phase 2A.1)', async () => {
  // operatorRead has User.role='Communicant' which lacks legacy documents.manage
  // in iamArchitecture DEFAULT_CAPABILITIES — the 6 POST generation routes
  // remain strictly on requireCapability (untouched by this slice).
  const res = await request(app)
    .post(`/api/gestion-docs/bail/${contratA._id}`)
    .set(bearer(operatorRead, tenantA._id))
    .send({});
  expect(res.status).toBe(403);
});

test('P-DOC-G15 operator documents.manage cannot POST /api/gestion-docs/bail/:contratId (generation NOT opened)', async () => {
  const res = await request(app)
    .post(`/api/gestion-docs/bail/${contratA._id}`)
    .set(bearer(operatorManage, tenantA._id))
    .send({});
  expect(res.status).toBe(403);
});

test('P-DOC-G16 Contract B remains unreadable even when its ID is known exactly by an operator in Tenant A', async () => {
  const res = await request(app).get(`/api/gestion-docs/contrat/${contratB._id}`).set(bearer(operatorManage, tenantA._id));
  expect(res.status).toBe(404);
});

test('P-DOC-G17 invalid contract ID → 400 normal semantics preserved', async () => {
  const res = await request(app).get('/api/gestion-docs/contrat/not-an-objectid').set(bearer(tenantAdminA, tenantA._id));
  expect(res.status).toBe(400);
});

test('P-DOC-G18 nonexistent contract ID → 404 normal semantics preserved', async () => {
  const ghostId = new mongoose.Types.ObjectId();
  const res = await request(app).get(`/api/gestion-docs/contrat/${ghostId}`).set(bearer(tenantAdminA, tenantA._id));
  expect(res.status).toBe(404);
});
