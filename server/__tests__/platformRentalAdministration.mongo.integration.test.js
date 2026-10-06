// PLATFORM-SUPER-ADMIN OPTION-3 SLICE-3 — matrice P-RENTAL-01..20.
//
// Prouve la composition d'autorité sur /api/rental-management pour les seules
// routes classifiées R1 (READ) et R2 (RentalManagement-only writes). Les
// routes R4 (publish/mark-*/notice lifecycle/validate-exit/onboard/
// resolveRequest) restent strictement tenant-only ; elles sont couvertes ici
// pour prouver qu'un opérateur SANS OrgMembership est refusé — invariant
// R4-out-of-scope préservé.

const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const { startFinancialMongo, clearFinancialMongo, stopFinancialMongo } = require('./helpers/financialMongoEnvironment');
const { createTenantFixture } = require('./helpers/tenantAwareFixture');
const User = require('../models/User');
const OrgMembership = require('../models/OrgMembership');
const Property = require('../models/Property');
const RentalManagement = require('../models/RentalManagement');
const PlatformOperator = require('../models/PlatformOperator');
const PlatformTenantSubscription = require('../models/PlatformTenantSubscription');
const PlatformTenantFeature = require('../models/PlatformTenantFeature');
const { grantOperator } = require('../services/platformOperator/platformOperatorService');
const rentalRoutes = require('../routes/rentalManagementRoutes');
const { errorHandler } = require('../middleware/errorMiddleware');

jest.setTimeout(180000);

const app = express();
app.use(express.json());
app.use('/api/rental-management', rentalRoutes);
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

const insertProperty = async (owner, tenantId, extra = {}) => {
  const doc = {
    _id: new mongoose.Types.ObjectId(),
    title: `Prop-${Math.random().toString(36).slice(2, 6)}`,
    owner, tenant: tenantId,
    status: 'location', price: 100000,
    isPublished: false, statusAdmin: 'Validée',
    availability: 'Disponible', pole: 'Altimmo', type: 'Villa',
    createdAt: new Date(), updatedAt: new Date(),
    ...extra,
  };
  await Property.collection.insertOne(doc);
  return doc;
};

const insertRental = async (property, tenantId, extra = {}) => {
  const doc = {
    _id: new mongoose.Types.ObjectId(),
    property: property._id, owner: property.owner,
    tenant: tenantId,
    managementActivated: true, active: true,
    monthlyRent: property.price || 100000,
    occupancyStatus: 'vacant',
    workflowHistory: [],
    createdAt: new Date(), updatedAt: new Date(),
    ...extra,
  };
  await RentalManagement.collection.insertOne(doc);
  return doc;
};

const enableTenantLocationModule = async (tenant) => {
  await PlatformTenantSubscription.create({
    tenant: tenant._id, plan: 'pro', status: 'active',
    modulesIncluded: ['location', 'immobilier'],
  });
};

let tenantA; let tenantB; let bootstrapA; let bootstrapB;
let ownerA; let ownerB;
let propertyA; let propertyB; let propertyLegacyNull; let propertyLegacyNullB;
let rentalA; let rentalB; let rentalLegacyNull; let rentalLegacyNullB;
let tenantAdminA; let gestionA;
let operatorRead; let operatorManage; let operatorNoRentals; let operatorSuspended;
let operatorTenantsManageOnly; let operatorPropertiesManageOnly; let bareGlobalAdmin;
let grantor;

beforeAll(async () => {
  await startFinancialMongo();
  await OrgMembership.syncIndexes();
});
afterAll(stopFinancialMongo);

beforeEach(async () => {
  await clearFinancialMongo();
  const fA = await createTenantFixture({ label: 'RNT Tenant A' });
  const fB = await createTenantFixture({ label: 'RNT Tenant B' });
  tenantA = fA.tenant; bootstrapA = fA.bootstrap;
  tenantB = fB.tenant; bootstrapB = fB.bootstrap;
  await enableTenantLocationModule(tenantA);
  await enableTenantLocationModule(tenantB);

  // BACKEND-TENANT-ISOLATION-CLOSURE-01 — les propriétaires sont membres de
  // leur tenant : sans cela, le scope owner du listing excluait TOUT (y
  // compris rentalA) et P-RENTAL-01/04/19 passaient sur un tableau vide.
  ownerA = await makeUser({ role: 'Proprietaire' });
  ownerB = await makeUser({ role: 'Proprietaire' });
  await OrgMembership.create({ user: ownerA._id, orgUnit: tenantA.rootOrgUnit, status: 'active', roleInUnit: 'member', grantedBy: bootstrapA._id });
  await OrgMembership.create({ user: ownerB._id, orgUnit: tenantB.rootOrgUnit, status: 'active', roleInUnit: 'member', grantedBy: bootstrapB._id });

  propertyA = await insertProperty(ownerA._id, tenantA._id);
  propertyB = await insertProperty(ownerB._id, tenantB._id);
  propertyLegacyNull = await insertProperty(ownerA._id, null, { price: 650000 });
  propertyLegacyNullB = await insertProperty(ownerB._id, null, { price: 660000 });

  rentalA = await insertRental(propertyA, tenantA._id);
  rentalB = await insertRental(propertyB, tenantB._id);
  // Legacy tenant:null, MÊME owner que rentalA, activé et actif : seule la
  // valeur `tenant:null` le distingue de rentalA.
  rentalLegacyNull = await insertRental(propertyLegacyNull, null);
  rentalLegacyNullB = await insertRental(propertyLegacyNullB, null);

  // Tenant A canonical staff (PATH A).
  tenantAdminA = await makeUser({ role: 'Admin' });
  await OrgMembership.create({ user: tenantAdminA._id, orgUnit: tenantA.rootOrgUnit, businessRole: 'Admin', status: 'active', roleInUnit: 'member', grantedBy: bootstrapA._id });
  gestionA = await makeUser({ role: 'Collaborateur' });
  await OrgMembership.create({ user: gestionA._id, orgUnit: tenantA.rootOrgUnit, businessRole: 'GestionnaireImmobilier', status: 'active', roleInUnit: 'member', grantedBy: bootstrapA._id });

  grantor = await makeUser({ role: 'Admin' });
  await PlatformOperator.create({
    user: grantor._id, status: 'active',
    capabilities: ['platform.operators.manage'],
    grantedBy: grantor._id, grantReason: 'RNT grantor',
  });

  operatorRead = await makeUser({ role: 'Admin' });
  await grantOperator({ userId: operatorRead._id, actor: grantor, capabilities: ['platform.rentals.read'], reason: 'RNT read op' });

  operatorManage = await makeUser({ role: 'Admin' });
  await grantOperator({ userId: operatorManage._id, actor: grantor, capabilities: ['platform.rentals.manage'], reason: 'RNT manage op' });

  operatorNoRentals = await makeUser({ role: 'Admin' });
  await grantOperator({ userId: operatorNoRentals._id, actor: grantor, capabilities: ['platform.tenants.read'], reason: 'RNT no-rental-cap op' });

  operatorSuspended = await makeUser({ role: 'Admin' });
  await grantOperator({ userId: operatorSuspended._id, actor: grantor, capabilities: ['platform.rentals.manage'], reason: 'RNT suspended op' });
  await PlatformOperator.updateOne(
    { user: operatorSuspended._id },
    { $set: { status: 'suspended', suspendedBy: grantor._id, suspendedAt: new Date(), suspensionReason: 'RNT' } },
  );

  operatorTenantsManageOnly = await makeUser({ role: 'Admin' });
  await grantOperator({ userId: operatorTenantsManageOnly._id, actor: grantor, capabilities: ['platform.tenants.manage'], reason: 'RNT tenants.manage-only' });

  operatorPropertiesManageOnly = await makeUser({ role: 'Admin' });
  await grantOperator({ userId: operatorPropertiesManageOnly._id, actor: grantor, capabilities: ['platform.properties.manage', 'platform.properties.read'], reason: 'RNT properties-only op' });

  bareGlobalAdmin = await makeUser({ role: 'Admin' });
});

// ─── P-RENTAL-01/02/03/04 — cross-tenant listing + isolation ──────────────

// Contrat réel de GET /api/rental-management : `data: { rentals, total, ... }`.
// Exige un tableau et renvoie les ids — la présence de la ressource du
// tenant cible est toujours assertée : un tableau vide échoue.
const listRentalIds = async (user, tenantId) => {
  const res = await request(app).get('/api/rental-management').set(bearer(user, tenantId));
  expect(res.status).toBe(200);
  expect(Array.isArray(res.body.data?.rentals)).toBe(true);
  return { res, ids: res.body.data.rentals.map((r) => String(r._id)) };
};

test('P-RENTAL-01: operator + rentals.read lists Tenant A rentals', async () => {
  const { res, ids } = await listRentalIds(operatorRead, tenantA._id);
  expect(ids).toContain(String(rentalA._id));
  for (const r of res.body.data.rentals) expect(String(r.tenant)).toBe(String(tenantA._id));
});

test('P-RENTAL-02: switch to Tenant B returns Tenant B rentals', async () => {
  const { res, ids } = await listRentalIds(operatorRead, tenantB._id);
  expect(ids).toContain(String(rentalB._id));
  expect(ids).not.toContain(String(rentalA._id));
  for (const r of res.body.data.rentals) expect(String(r.tenant)).toBe(String(tenantB._id));
});

test('P-RENTAL-03: Tenant A response contains no Tenant B rental', async () => {
  const { ids } = await listRentalIds(operatorRead, tenantA._id);
  expect(ids).toContain(String(rentalA._id));
  expect(ids).not.toContain(String(rentalB._id));
});

test('P-RENTAL-04: Tenant A response contains no tenant:null legacy rental (650k Bureau invariant)', async () => {
  const { ids } = await listRentalIds(operatorRead, tenantA._id);
  expect(ids).toContain(String(rentalA._id));
  expect(ids).not.toContain(String(rentalLegacyNull._id));
  expect(ids).not.toContain(String(rentalLegacyNullB._id));
});

test('PLATFORM_OPERATOR_CANNOT_ACCESS_TENANT_NULL_RENTAL_MANAGEMENT', async () => {
  // C2.10A (D4/D6) — le dossier legacy tenant:null (owner membre de A) est un
  // bien INDIVIDUAL : il n'est plus visible du staff de A (PATH A) non plus.
  // Staff et opérateur partagent la même population Property.tenant = A.
  const pathA = await listRentalIds(tenantAdminA, tenantA._id);
  expect(pathA.ids).toContain(String(rentalA._id));
  expect(pathA.ids).not.toContain(String(rentalLegacyNull._id));

  const { ids } = await listRentalIds(operatorRead, tenantA._id);
  expect(ids).toContain(String(rentalA._id));
  expect(ids).not.toContain(String(rentalLegacyNull._id));

  const byId = await request(app).get(`/api/rental-management/${rentalLegacyNull._id}`).set(bearer(operatorRead, tenantA._id));
  expect(byId.status).toBe(404);
  expect(JSON.stringify(byId.body)).not.toContain(String(rentalLegacyNull._id));

  const history = await request(app).get(`/api/rental-management/${rentalLegacyNull._id}/history`).set(bearer(operatorRead, tenantA._id));
  expect(history.status).toBe(404);
});

test('P-RENTAL-STATS: operator /stats Tenant A counts only Tenant A (no tenant:null, no Tenant B)', async () => {
  // C2.10A (D4/D6) — PATH A compte désormais la même population canonique
  // (Property.tenant = A) : le dossier legacy tenant:null n'est plus compté.
  const pathA = await request(app).get('/api/rental-management/stats').set(bearer(tenantAdminA, tenantA._id));
  expect(pathA.status).toBe(200);
  expect(pathA.body.data.stats.total).toBe(1);

  const res = await request(app).get('/api/rental-management/stats').set(bearer(operatorRead, tenantA._id));
  expect(res.status).toBe(200);
  expect(res.body.data.stats.total).toBe(1);
  expect(res.body.data.stats.vacant).toBe(1);

  const resB = await request(app).get('/api/rental-management/stats').set(bearer(operatorRead, tenantB._id));
  expect(resB.status).toBe(200);
  expect(resB.body.data.stats.total).toBe(1);
});

// ─── P-RENTAL-05/06 — read cannot write ─────────────────────────────────

test('P-RENTAL-05: rentals.read can read /stats aggregate', async () => {
  const res = await request(app).get('/api/rental-management/stats').set(bearer(operatorRead, tenantA._id));
  expect(res.status).toBe(200);
});

test('P-RENTAL-06: rentals.read cannot mutate (PATCH /:id refused)', async () => {
  const res = await request(app).patch(`/api/rental-management/${rentalA._id}`).set(bearer(operatorRead, tenantA._id)).send({ monthlyRent: 999 });
  expect(res.status).toBe(403);
});

// ─── P-RENTAL-07/08 — manage capability across tenants ──────────────────

test('P-RENTAL-07: rentals.manage updates a Tenant A rental (PATCH /:id monthlyRent)', async () => {
  const res = await request(app).patch(`/api/rental-management/${rentalA._id}`).set(bearer(operatorManage, tenantA._id)).send({ monthlyRent: 222222 });
  expect(res.status).toBe(200);
  const after = await RentalManagement.findById(rentalA._id).lean();
  expect(after.monthlyRent).toBe(222222);
});

test('P-RENTAL-08: same manage capability updates a Tenant B rental after switch', async () => {
  const res = await request(app).patch(`/api/rental-management/${rentalB._id}`).set(bearer(operatorManage, tenantB._id)).send({ monthlyRent: 333333 });
  expect(res.status).toBe(200);
  const after = await RentalManagement.findById(rentalB._id).lean();
  expect(after.monthlyRent).toBe(333333);
});

// ─── P-RENTAL-09/10/11/12 — negative authority ──────────────────────────

test('P-RENTAL-09: operator without platform.rentals.* is denied', async () => {
  const res = await request(app).get('/api/rental-management').set(bearer(operatorNoRentals, tenantA._id));
  expect(res.status).toBe(403);
});

test('P-RENTAL-10: suspended PlatformOperator is denied', async () => {
  const res = await request(app).get('/api/rental-management').set(bearer(operatorSuspended, tenantA._id));
  expect(res.status).toBe(403);
});

test('P-RENTAL-11: User.role Admin without PlatformOperator and without membership is denied', async () => {
  const res = await request(app).get('/api/rental-management').set(bearer(bareGlobalAdmin, tenantA._id));
  expect(res.status).toBe(403);
});

test('P-RENTAL-12: no selected tenant → 403 fail closed', async () => {
  const res = await request(app).get('/api/rental-management').set(bearer(operatorRead));
  expect(res.status).toBe(403);
});

// ─── P-RENTAL-13/14 — cross-tenant + null resource ID ───────────────────

test('P-RENTAL-13: Tenant A context + Tenant B rental ID → denied and target unchanged', async () => {
  const res = await request(app).patch(`/api/rental-management/${rentalB._id}`).set(bearer(operatorManage, tenantA._id)).send({ monthlyRent: 999 });
  expect([403, 404]).toContain(res.status);
  const after = await RentalManagement.findById(rentalB._id).lean();
  expect(after.monthlyRent).not.toBe(999);
});

test('P-RENTAL-14: Tenant A context + tenant:null rental ID → denied', async () => {
  const res = await request(app).patch(`/api/rental-management/${rentalLegacyNull._id}`).set(bearer(operatorManage, tenantA._id)).send({ monthlyRent: 999 });
  expect([403, 404]).toContain(res.status);
  const after = await RentalManagement.findById(rentalLegacyNull._id).lean();
  expect(after.monthlyRent).not.toBe(999);
});

// ─── P-RENTAL-15 — tenant Admin unchanged ───────────────────────────────

test('P-RENTAL-15: normal Tenant Admin PATH A still updates (behavior preserved)', async () => {
  const res = await request(app).patch(`/api/rental-management/${rentalA._id}`).set(bearer(tenantAdminA, tenantA._id)).send({ monthlyRent: 444444 });
  expect(res.status).toBe(200);
  const after = await RentalManagement.findById(rentalA._id).lean();
  expect(after.monthlyRent).toBe(444444);
});

// ─── P-RENTAL-16/17/18 — capability-specificity ─────────────────────────

test('P-RENTAL-16: rentals.read does not imply rentals.manage', async () => {
  const res = await request(app).post('/api/rental-management/').set(bearer(operatorRead, tenantA._id)).send({ property: String(propertyA._id) });
  expect(res.status).toBe(403);
});

test('P-RENTAL-17: platform.tenants.manage alone grants neither rental read nor rental manage', async () => {
  const listRes = await request(app).get('/api/rental-management').set(bearer(operatorTenantsManageOnly, tenantA._id));
  expect(listRes.status).toBe(403);
  const patchRes = await request(app).patch(`/api/rental-management/${rentalA._id}`).set(bearer(operatorTenantsManageOnly, tenantA._id)).send({ monthlyRent: 111 });
  expect(patchRes.status).toBe(403);
});

test('P-RENTAL-18: platform.properties.manage/read alone grants no rental authority', async () => {
  const listRes = await request(app).get('/api/rental-management').set(bearer(operatorPropertiesManageOnly, tenantA._id));
  expect(listRes.status).toBe(403);
  const patchRes = await request(app).patch(`/api/rental-management/${rentalA._id}`).set(bearer(operatorPropertiesManageOnly, tenantA._id)).send({ monthlyRent: 111 });
  expect(patchRes.status).toBe(403);
});

// ─── P-RENTAL-19 — Rental Portfolio KPI invariant ───────────────────────

test('P-RENTAL-19: RentalManagement listing remains tenant-isolated for operator (never leaks tenant:null 650k)', async () => {
  // Additional safeguard: request Tenant A rentals and prove the legacy null
  // 650k rental is never reachable via list/stats through platform authority.
  const { ids } = await listRentalIds(operatorManage, tenantA._id);
  expect(ids).toContain(String(rentalA._id));
  expect(ids).not.toContain(String(rentalLegacyNull._id));
  const stats = await request(app).get('/api/rental-management/stats').set(bearer(operatorManage, tenantA._id));
  expect(stats.status).toBe(200);
  expect(stats.body.data.stats.total).toBe(1);
});

// ─── BACKEND-TENANT-ISOLATION-CLOSURE-01 — adversarial PATH B ───────────

test('P-RENTAL-21: invalid (nonexistent) tenant target → refused', async () => {
  const res = await request(app).get('/api/rental-management').set(bearer(operatorRead, new mongoose.Types.ObjectId()));
  expect([403, 404]).toContain(res.status);
});

test('P-RENTAL-22: Tenant B membership only (no PlatformOperator) → no access to Tenant A', async () => {
  const memberB = await makeUser({ role: 'Admin' });
  await OrgMembership.create({ user: memberB._id, orgUnit: tenantB.rootOrgUnit, businessRole: 'Admin', status: 'active', roleInUnit: 'member', grantedBy: bootstrapB._id });
  const res = await request(app).get('/api/rental-management').set(bearer(memberB, tenantA._id));
  expect(res.status).toBe(403);
  expect(JSON.stringify(res.body)).not.toContain(String(rentalA._id));
});

test('P-RENTAL-23: rentals.manage operator cannot activate a Tenant B or tenant:null property from Tenant A context', async () => {
  const before = await RentalManagement.countDocuments({});
  const crossTenant = await request(app).post('/api/rental-management/').set(bearer(operatorManage, tenantA._id)).send({ property: String(propertyB._id) });
  expect(crossTenant.status).toBe(404);
  const legacy = await request(app).post('/api/rental-management/').set(bearer(operatorManage, tenantA._id)).send({ property: String(propertyLegacyNull._id) });
  expect(legacy.status).toBe(404);
  expect(await RentalManagement.countDocuments({})).toBe(before);
});

test('P-RENTAL-24: rentals.manage operator still activates a Tenant A property (Option 3 preserved)', async () => {
  const freshA = await insertProperty(ownerA._id, tenantA._id);
  const res = await request(app).post('/api/rental-management/').set(bearer(operatorManage, tenantA._id)).send({ property: String(freshA._id) });
  expect(res.status).toBe(201);
  const created = await RentalManagement.findOne({ property: freshA._id }).lean();
  expect(String(created.tenant)).toBe(String(tenantA._id));
});

test('P-RENTAL-25: /onboarding/options for operator exposes only Tenant A properties and owners', async () => {
  const Proprietaire = require('../models/Proprietaire');
  await Proprietaire.create([
    { nom: 'OwnerA', prenom: 'P', email: `pa-${Date.now()}@example.test`, telephone: '+242060000011', user: ownerA._id },
    { nom: 'OwnerB', prenom: 'P', email: `pb-${Date.now()}@example.test`, telephone: '+242060000012', user: ownerB._id },
  ]);
  const res = await request(app).get('/api/rental-management/onboarding/options').set(bearer(operatorRead, tenantA._id));
  expect(res.status).toBe(200);
  const rows = [...res.body.data.existingEligibleProperties, ...res.body.data.ineligibleProperties];
  const propertyIds = rows.filter((r) => r.propertyId).map((r) => r.propertyId);
  expect(propertyIds).toContain(String(propertyA._id));
  expect(propertyIds).not.toContain(String(propertyB._id));
  expect(propertyIds).not.toContain(String(propertyLegacyNull._id));
  expect(propertyIds).not.toContain(String(propertyLegacyNullB._id));
  expect(res.body.data.owners.map((o) => o._id)).toEqual([String(ownerA._id)]);
  expect(JSON.stringify(res.body)).not.toContain('OwnerB');
});

// ─── P-RENTAL-20 — R4 out-of-scope invariant ────────────────────────────

test('P-RENTAL-20: R4 lifecycle route (POST /:id/publish) refuses PlatformOperator without OrgMembership (adjacent Property write out-of-scope for slice 3)', async () => {
  // Even an operator with platform.rentals.manage cannot invoke a route
  // classified R4 (mutates Property/Contrat). SLICE 3 intentionally left
  // these routes on strict tenant authority.
  const res = await request(app).post(`/api/rental-management/${rentalA._id}/publish`).set(bearer(operatorManage, tenantA._id)).send({});
  expect(res.status).toBe(403);
  const propAfter = await Property.findById(propertyA._id).lean();
  expect(propAfter.isPublished).toBe(false);
});
