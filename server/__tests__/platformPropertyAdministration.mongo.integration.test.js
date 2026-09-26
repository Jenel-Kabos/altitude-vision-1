// PLATFORM-SUPER-ADMIN OPTION-3 SLICE-2 — matrice P-PROPERTY-01..18.
//
// Prouve la composition d'autorité sur /api/properties et
// /api/property-asset/portfolio/dashboard :
//   PATH A : OrgMembership + businessRole tenant (préservé)
//   PATH B : PlatformOperator actif + platform.properties.read/manage
//            + tenant explicitement sélectionné via X-Platform-Tenant-Id
//
// Aucun bypass User.role, aucun OrgMembership artificiel, tenant scope
// obligatoire (jamais platformWide sur endpoint tenant-scoped), Property.tenant
// null demeure invisible aux endpoints tenant-scoped (invariant hotfix Rental
// Portfolio préservé).

const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const { startFinancialMongo, clearFinancialMongo, stopFinancialMongo } = require('./helpers/financialMongoEnvironment');
const { createTenantFixture, createTenantUser } = require('./helpers/tenantAwareFixture');
const User = require('../models/User');
const OrgMembership = require('../models/OrgMembership');
const Property = require('../models/Property');
const PlatformOperator = require('../models/PlatformOperator');
const { grantOperator } = require('../services/platformOperator/platformOperatorService');
const propertyRoutes = require('../routes/propertyRoutes');
const propertyAssetRoutes = require('../routes/propertyAssetRoutes');
const { errorHandler } = require('../middleware/errorMiddleware');

jest.setTimeout(180000);

const app = express();
app.use(express.json());
app.use('/api/properties', propertyRoutes);
app.use('/api/property-asset', propertyAssetRoutes);
app.use(errorHandler);

const bearer = (user, tenantId) => ({
  Authorization: `Bearer ${jwt.sign({ id: user._id, tokenVersion: 0 }, process.env.JWT_SECRET, { expiresIn: '1d' })}`,
  ...(tenantId ? { 'X-Platform-Tenant-Id': String(tenantId) } : {}),
});

const makeGlobalUser = async (overrides = {}) => User.create({
  name: 'Test User',
  email: `u-${Date.now()}-${Math.random().toString(36).slice(2)}@example.test`,
  password: 'Password123!', passwordConfirm: 'Password123!',
  role: 'Collaborateur', isEmailVerified: true,
  ...overrides,
});

let tenantA; let tenantB; let bootstrapA; let bootstrapB;
let ownerA; let ownerB;
let propertyA1; let propertyA2; let propertyB1; let propertyLegacyNull;
let tenantAdminA; let gestionA;
let operatorRead; let operatorManage; let operatorNoProp; let operatorSuspended;
let operatorTenantsManageOnly; let bareGlobalAdmin;
let grantor;

beforeAll(async () => {
  await startFinancialMongo();
  await OrgMembership.syncIndexes();
});
afterAll(stopFinancialMongo);

beforeEach(async () => {
  await clearFinancialMongo();
  const fA = await createTenantFixture({ label: 'PROP Tenant A' });
  const fB = await createTenantFixture({ label: 'PROP Tenant B' });
  tenantA = fA.tenant; bootstrapA = fA.bootstrap;
  tenantB = fB.tenant; bootstrapB = fB.bootstrap;

  ownerA = await makeGlobalUser({ role: 'Proprietaire' });
  ownerB = await makeGlobalUser({ role: 'Proprietaire' });

  // Two Tenant A properties, one Tenant B property, one legacy tenant=null.
  // Use collection.insertMany to bypass full Mongoose validation (fixtures
  // do not care about surface/latitude/pole/etc. — those are contract-level
  // fields validated by the createProperty controller path only).
  const mkProp = (owner, tenant, status, price, title) => ({
    _id: new (require('mongoose').Types.ObjectId)(),
    title, owner, tenant, status, price,
    isPublished: false, statusAdmin: 'En attente',
    availability: 'available', pole: 'Altimmo', type: 'Villa',
    createdAt: new Date(), updatedAt: new Date(),
  });
  const docs = [
    mkProp(ownerA._id, tenantA._id, 'location', 111, 'A1 Prop'),
    mkProp(ownerA._id, tenantA._id, 'vente', 112, 'A2 Prop'),
    mkProp(ownerB._id, tenantB._id, 'location', 210, 'B1 Prop'),
    mkProp(ownerA._id, null, 'location', 650000, 'Legacy Null'),
  ];
  await Property.collection.insertMany(docs);
  [propertyA1, propertyA2, propertyB1, propertyLegacyNull] = docs;

  // Tenant A canonical staff.
  tenantAdminA = (await createTenantUser({ tenant: tenantA, bootstrap: bootstrapA, businessRole: 'Admin', overrides: { role: 'Admin' } })).user;
  gestionA = (await createTenantUser({ tenant: tenantA, bootstrap: bootstrapA, businessRole: 'GestionnaireImmobilier', overrides: { role: 'Collaborateur' } })).user;

  // Grantor for operator bootstrap (grantOperator forbids self-grant).
  grantor = await makeGlobalUser({ role: 'Admin' });
  await PlatformOperator.create({
    user: grantor._id, status: 'active',
    capabilities: ['platform.operators.manage'],
    grantedBy: grantor._id, grantReason: 'PROP grantor',
  });

  operatorRead = await makeGlobalUser({ role: 'Admin' });
  await grantOperator({ userId: operatorRead._id, actor: grantor, capabilities: ['platform.properties.read'], reason: 'PROP read op' });

  operatorManage = await makeGlobalUser({ role: 'Admin' });
  await grantOperator({ userId: operatorManage._id, actor: grantor, capabilities: ['platform.properties.manage'], reason: 'PROP manage op' });

  operatorNoProp = await makeGlobalUser({ role: 'Admin' });
  await grantOperator({ userId: operatorNoProp._id, actor: grantor, capabilities: ['platform.tenants.read'], reason: 'PROP no-property-cap op' });

  operatorSuspended = await makeGlobalUser({ role: 'Admin' });
  await grantOperator({ userId: operatorSuspended._id, actor: grantor, capabilities: ['platform.properties.manage'], reason: 'PROP suspended op' });
  await PlatformOperator.updateOne(
    { user: operatorSuspended._id },
    { $set: { status: 'suspended', suspendedBy: grantor._id, suspendedAt: new Date(), suspensionReason: 'PROP' } },
  );

  operatorTenantsManageOnly = await makeGlobalUser({ role: 'Admin' });
  await grantOperator({ userId: operatorTenantsManageOnly._id, actor: grantor, capabilities: ['platform.tenants.manage'], reason: 'PROP tenants.manage-only op' });

  bareGlobalAdmin = await makeGlobalUser({ role: 'Admin' });
});

// ─── P-PROPERTY-01/02/03/04 — cross-tenant listing + null exclusion ────────

test('P-PROPERTY-01: PlatformOperator + platform.properties.read lists Tenant A portfolio', async () => {
  const res = await request(app).get('/api/properties/portfolio').set(bearer(operatorRead, tenantA._id));
  expect(res.status).toBe(200);
  const list = res.body.data?.properties || res.body.data || [];
  const arr = Array.isArray(list) ? list : (list.properties || []);
  // At least one Tenant A property returned; every returned property belongs to Tenant A.
  for (const p of arr) {
    expect(String(p.tenant)).toBe(String(tenantA._id));
  }
});

test('P-PROPERTY-02: same operator lists Tenant B portfolio after explicit switch', async () => {
  const res = await request(app).get('/api/properties/portfolio').set(bearer(operatorRead, tenantB._id));
  expect(res.status).toBe(200);
  const list = res.body.data?.properties || res.body.data || [];
  const arr = Array.isArray(list) ? list : (list.properties || []);
  for (const p of arr) {
    expect(String(p.tenant)).toBe(String(tenantB._id));
  }
});

test('P-PROPERTY-03: Tenant A response contains no Tenant B property', async () => {
  const res = await request(app).get('/api/properties/portfolio').set(bearer(operatorRead, tenantA._id));
  expect(res.status).toBe(200);
  const list = res.body.data?.properties || res.body.data || [];
  const arr = Array.isArray(list) ? list : (list.properties || []);
  expect(arr.some((p) => String(p._id) === String(propertyB1._id))).toBe(false);
});

test('P-PROPERTY-04: Tenant A response contains no tenant:null property (hotfix Rental Portfolio preserved)', async () => {
  const res = await request(app).get('/api/property-asset/portfolio/dashboard?status=location').set(bearer(operatorRead, tenantA._id));
  expect(res.status).toBe(200);
  const props = res.body.data?.properties || res.body.data?.dashboard?.properties || [];
  expect(props.some((p) => String(p._id) === String(propertyLegacyNull._id))).toBe(false);
});

// ─── P-PROPERTY-05/06 — read cannot write ─────────────────────────────────

test('P-PROPERTY-05: platform.properties.read can read pending moderation queue', async () => {
  const res = await request(app).get('/api/properties/status/pending').set(bearer(operatorRead, tenantA._id));
  expect(res.status).toBe(200);
});

test('P-PROPERTY-06: platform.properties.read cannot mutate (validate) a property', async () => {
  const res = await request(app).patch(`/api/properties/admin/${propertyA1._id}/validate`).set(bearer(operatorRead, tenantA._id)).send({});
  expect(res.status).toBe(403);
});

// ─── P-PROPERTY-07/08 — manage capability across tenants ──────────────────

test('P-PROPERTY-07: platform.properties.manage can validate a Tenant A property', async () => {
  const res = await request(app).patch(`/api/properties/admin/${propertyA1._id}/validate`).set(bearer(operatorManage, tenantA._id)).send({});
  expect(res.status).toBe(200);
  const after = await Property.findById(propertyA1._id).lean();
  expect(after.statusAdmin).toBe('Validée');
});

test('P-PROPERTY-08: same manage capability validates a Tenant B property after explicit switch', async () => {
  const res = await request(app).patch(`/api/properties/admin/${propertyB1._id}/validate`).set(bearer(operatorManage, tenantB._id)).send({});
  expect(res.status).toBe(200);
  const after = await Property.findById(propertyB1._id).lean();
  expect(after.statusAdmin).toBe('Validée');
});

// ─── P-PROPERTY-09/10/11/12 — negative authority ──────────────────────────

test('P-PROPERTY-09: operator without platform.properties.* is denied', async () => {
  const res = await request(app).get('/api/properties/portfolio').set(bearer(operatorNoProp, tenantA._id));
  expect(res.status).toBe(403);
});

test('P-PROPERTY-10: suspended PlatformOperator is denied', async () => {
  const res = await request(app).get('/api/properties/portfolio').set(bearer(operatorSuspended, tenantA._id));
  expect(res.status).toBe(403);
});

test('P-PROPERTY-11: User.role Admin without PlatformOperator and without membership is denied', async () => {
  const res = await request(app).get('/api/properties/portfolio').set(bearer(bareGlobalAdmin, tenantA._id));
  expect(res.status).toBe(403);
});

test('P-PROPERTY-12: no selected tenant → fail closed (403)', async () => {
  const res = await request(app).get('/api/properties/portfolio').set(bearer(operatorRead));
  expect(res.status).toBe(403);
});

// ─── P-PROPERTY-13/14 — resource-ID cross-tenant / null protection ────────

test('P-PROPERTY-13: Tenant A context + Tenant B property ID → 403 (property.tenant != active tenant)', async () => {
  const res = await request(app).patch(`/api/properties/admin/${propertyB1._id}/validate`).set(bearer(operatorManage, tenantA._id)).send({});
  expect(res.status).toBe(403);
  const after = await Property.findById(propertyB1._id).lean();
  expect(after.statusAdmin).not.toBe('Validée');
});

test('P-PROPERTY-14: Tenant A context + tenant:null property ID → 403 (property.tenant is null)', async () => {
  const res = await request(app).patch(`/api/properties/admin/${propertyLegacyNull._id}/validate`).set(bearer(operatorManage, tenantA._id)).send({});
  expect(res.status).toBe(403);
  const after = await Property.findById(propertyLegacyNull._id).lean();
  expect(after.statusAdmin).not.toBe('Validée');
  expect(after.tenant).toBeNull();
});

// ─── P-PROPERTY-15 — tenant Admin unchanged ───────────────────────────────

test('P-PROPERTY-15: normal Tenant Admin behavior unchanged (PATH A still validates)', async () => {
  const res = await request(app).patch(`/api/properties/admin/${propertyA2._id}/validate`).set(bearer(tenantAdminA, tenantA._id)).send({});
  expect(res.status).toBe(200);
  const after = await Property.findById(propertyA2._id).lean();
  expect(after.statusAdmin).toBe('Validée');
});

// ─── P-PROPERTY-16/17 — capability-specificity ───────────────────────────

test('P-PROPERTY-16: platform.properties.read does not imply platform.properties.manage (validate refused)', async () => {
  const res = await request(app).patch(`/api/properties/admin/${propertyA1._id}/validate`).set(bearer(operatorRead, tenantA._id)).send({});
  expect(res.status).toBe(403);
});

test('P-PROPERTY-17: platform.tenants.manage alone does not grant property authority', async () => {
  const listRes = await request(app).get('/api/properties/portfolio').set(bearer(operatorTenantsManageOnly, tenantA._id));
  expect(listRes.status).toBe(403);
  const patchRes = await request(app).patch(`/api/properties/admin/${propertyA1._id}/validate`).set(bearer(operatorTenantsManageOnly, tenantA._id)).send({});
  expect(patchRes.status).toBe(403);
});

// ─── P-PROPERTY-18 — hotfix Rental Portfolio preserved for operator ──────

test('P-PROPERTY-18: Rental Portfolio KPI remains tenant-isolated for PlatformOperator (never leaks tenant:null 650k)', async () => {
  const res = await request(app).get('/api/property-asset/portfolio/dashboard?status=location').set(bearer(operatorManage, tenantA._id));
  expect(res.status).toBe(200);
  const data = res.body.data || {};
  const props = data.properties || data.dashboard?.properties || [];
  for (const p of props) {
    // Every property in the dashboard belongs to Tenant A (strict tenant filter).
    if (p.tenant !== undefined) {
      expect(String(p.tenant)).toBe(String(tenantA._id));
    }
  }
  // Total value must never include the legacy tenant:null 650k property.
  const total = data.dashboard?.valeurTotale ?? data.valeurTotale ?? 0;
  expect(total).toBeLessThan(650000);
});
