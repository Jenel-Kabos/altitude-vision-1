// PLATFORM-SUPER-ADMIN OPTION-3 SLICE-6 — matrice P-CRM-01..24.
//
// Prouve la composition d'autorité sur /api/crm et /api/crm-automation :
//   PATH A : OrgMembership STAFF/MANAGERS (rôles préservés)
//   PATH B : PlatformOperator actif + platform.crm.read/manage + tenant sélectionné
//
// Aucune vue platform-wide CRM, aucun bypass User.role, aucune mutation
// cross-domain (Property/Contrat/Transaction/HotelReservation restent des
// reads dans crmService pour hydrater la vue 360°).

const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const { startFinancialMongo, clearFinancialMongo, stopFinancialMongo } = require('./helpers/financialMongoEnvironment');
const { createTenantFixture } = require('./helpers/tenantAwareFixture');
const User = require('../models/User');
const OrgMembership = require('../models/OrgMembership');
const CrmCustomer = require('../models/CrmCustomer');
const CrmOpportunity = require('../models/CrmOpportunity');
const CrmActivity = require('../models/CrmActivity');
const CrmAutomationRule = require('../models/CrmAutomationRule');
const Property = require('../models/Property');
const PlatformOperator = require('../models/PlatformOperator');
const { grantOperator } = require('../services/platformOperator/platformOperatorService');
const crmRoutes = require('../routes/crmRoutes');
const crmAutomationRoutes = require('../routes/crmAutomationRoutes');
const { errorHandler } = require('../middleware/errorMiddleware');

jest.setTimeout(180000);

const app = express();
app.use(express.json());
app.use('/api/crm', crmRoutes);
app.use('/api/crm-automation', crmAutomationRoutes);
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

let tenantA; let tenantB; let bootstrapA; let bootstrapB;
let customerA1; let customerA2; let customerB1; let customerLegacyNull;
let opportunityA1; let opportunityB1;
let ruleA1; let ruleB1;
let tenantAdminA; let staffCollabA; let gestionA;
let operatorRead; let operatorManage; let operatorNoCrm; let operatorSuspended;
let operatorTenantsMgOnly; let operatorPropertiesMgOnly; let operatorMarketingMgOnly; let operatorCommercialMgOnly;
let bareGlobalAdmin;
let grantor;

const addMembership = (user, tenant, businessRole) => OrgMembership.create({
  user: user._id, orgUnit: tenant.rootOrgUnit, roleInUnit: 'member',
  businessRole, status: 'active', grantedBy: user._id,
});

beforeAll(async () => {
  await startFinancialMongo();
  await OrgMembership.syncIndexes();
});
afterAll(stopFinancialMongo);

beforeEach(async () => {
  await clearFinancialMongo();
  const fA = await createTenantFixture({ label: 'CRM Tenant A' });
  const fB = await createTenantFixture({ label: 'CRM Tenant B' });
  tenantA = fA.tenant; bootstrapA = fA.bootstrap;
  tenantB = fB.tenant; bootstrapB = fB.bootstrap;

  // 2 CrmCustomer A + 1 B + 1 legacy tenant=null.
  customerA1 = await CrmCustomer.create({ tenant: tenantA._id, displayName: 'A1 Customer', emails: [`a1-${Date.now()}@ex.test`], identityKeys: [`email:a1-${Date.now()}@ex.test`], relations: ['prospect'] });
  customerA2 = await CrmCustomer.create({ tenant: tenantA._id, displayName: 'A2 Customer', emails: [`a2-${Date.now()}@ex.test`], identityKeys: [`email:a2-${Date.now()}@ex.test`], relations: ['prospect'] });
  customerB1 = await CrmCustomer.create({ tenant: tenantB._id, displayName: 'B1 Customer', emails: [`b1-${Date.now()}@ex.test`], identityKeys: [`email:b1-${Date.now()}@ex.test`], relations: ['prospect'] });
  customerLegacyNull = await CrmCustomer.create({ tenant: null, displayName: 'Legacy Null Customer', emails: [`ln-${Date.now()}@ex.test`], identityKeys: [`email:ln-${Date.now()}@ex.test`], relations: ['prospect'] });

  opportunityA1 = await CrmOpportunity.create({ tenant: tenantA._id, customer: customerA1._id, title: 'Opp A1', stage: 'qualification', status: 'open' });
  opportunityB1 = await CrmOpportunity.create({ tenant: tenantB._id, customer: customerB1._id, title: 'Opp B1', stage: 'qualification', status: 'open' });

  ruleA1 = await CrmAutomationRule.create({ tenant: tenantA._id, ruleId: 'test-rule-A', label: 'Rule A', triggerEvent: 'customer.created', enabled: true, priority: 10, actions: [{ actionId: 'noop', params: {} }] });
  ruleB1 = await CrmAutomationRule.create({ tenant: tenantB._id, ruleId: 'test-rule-B', label: 'Rule B', triggerEvent: 'customer.created', enabled: true, priority: 10, actions: [{ actionId: 'noop', params: {} }] });

  tenantAdminA = await makeUser({ role: 'Admin' });
  await addMembership(tenantAdminA, tenantA, 'Admin');
  staffCollabA = await makeUser({ role: 'Collaborateur' });
  await addMembership(staffCollabA, tenantA, 'Collaborateur');
  gestionA = await makeUser({ role: 'Collaborateur' });
  await addMembership(gestionA, tenantA, 'GestionnaireImmobilier');

  grantor = await makeUser({ role: 'Admin' });
  await PlatformOperator.create({
    user: grantor._id, status: 'active',
    capabilities: ['platform.operators.manage'],
    grantedBy: grantor._id, grantReason: 'CRM grantor',
  });

  operatorRead = await makeUser({ role: 'Admin' });
  await grantOperator({ userId: operatorRead._id, actor: grantor, capabilities: ['platform.crm.read'], reason: 'CRM read op' });

  operatorManage = await makeUser({ role: 'Admin' });
  await grantOperator({ userId: operatorManage._id, actor: grantor, capabilities: ['platform.crm.manage'], reason: 'CRM manage op' });

  operatorNoCrm = await makeUser({ role: 'Admin' });
  await grantOperator({ userId: operatorNoCrm._id, actor: grantor, capabilities: ['platform.tenants.read'], reason: 'CRM no-crm-cap op' });

  operatorSuspended = await makeUser({ role: 'Admin' });
  await grantOperator({ userId: operatorSuspended._id, actor: grantor, capabilities: ['platform.crm.manage'], reason: 'CRM suspended op' });
  await PlatformOperator.updateOne(
    { user: operatorSuspended._id },
    { $set: { status: 'suspended', suspendedBy: grantor._id, suspendedAt: new Date(), suspensionReason: 'CRM' } },
  );

  operatorTenantsMgOnly = await makeUser({ role: 'Admin' });
  await grantOperator({ userId: operatorTenantsMgOnly._id, actor: grantor, capabilities: ['platform.tenants.manage'], reason: 'tenants.manage only' });

  operatorPropertiesMgOnly = await makeUser({ role: 'Admin' });
  await grantOperator({ userId: operatorPropertiesMgOnly._id, actor: grantor, capabilities: ['platform.properties.manage'], reason: 'properties.manage only' });

  operatorMarketingMgOnly = await makeUser({ role: 'Admin' });
  await grantOperator({ userId: operatorMarketingMgOnly._id, actor: grantor, capabilities: ['platform.marketing.manage'], reason: 'marketing.manage only' });

  operatorCommercialMgOnly = await makeUser({ role: 'Admin' });
  await grantOperator({ userId: operatorCommercialMgOnly._id, actor: grantor, capabilities: ['platform.commercial.manage'], reason: 'commercial.manage only' });

  bareGlobalAdmin = await makeUser({ role: 'Admin' });
});

// ─── P-CRM-01/02/03/04 — cross-tenant listing + isolation ─────────────────

test('P-CRM-01: operator + platform.crm.read lists Tenant A customers', async () => {
  const res = await request(app).get('/api/crm/customers').set(bearer(operatorRead, tenantA._id));
  expect(res.status).toBe(200);
  const list = res.body.data?.customers || res.body.data || [];
  const arr = Array.isArray(list) ? list : (list.customers || []);
  for (const c of arr) {
    expect(String(c.tenant)).toBe(String(tenantA._id));
  }
});

test('P-CRM-02: switch to Tenant B returns Tenant B customers', async () => {
  const res = await request(app).get('/api/crm/customers').set(bearer(operatorRead, tenantB._id));
  expect(res.status).toBe(200);
  const list = res.body.data?.customers || res.body.data || [];
  const arr = Array.isArray(list) ? list : (list.customers || []);
  for (const c of arr) {
    expect(String(c.tenant)).toBe(String(tenantB._id));
  }
});

test('P-CRM-03: Tenant A response contains no Tenant B customer', async () => {
  const res = await request(app).get('/api/crm/customers').set(bearer(operatorRead, tenantA._id));
  expect(res.status).toBe(200);
  const list = res.body.data?.customers || res.body.data || [];
  const arr = Array.isArray(list) ? list : (list.customers || []);
  expect(arr.some((c) => String(c._id) === String(customerB1._id))).toBe(false);
});

test('P-CRM-04: Tenant A response contains no tenant:null legacy customer', async () => {
  const res = await request(app).get('/api/crm/customers').set(bearer(operatorRead, tenantA._id));
  expect(res.status).toBe(200);
  const list = res.body.data?.customers || res.body.data || [];
  const arr = Array.isArray(list) ? list : (list.customers || []);
  expect(arr.some((c) => String(c._id) === String(customerLegacyNull._id))).toBe(false);
});

// ─── P-CRM-05/06 — read cannot write ─────────────────────────────────────

test('P-CRM-05: platform.crm.read can access customer detail', async () => {
  const res = await request(app).get(`/api/crm/customers/${customerA1._id}`).set(bearer(operatorRead, tenantA._id));
  expect(res.status).toBe(200);
});

test('P-CRM-06: platform.crm.read cannot create an opportunity (POST refused)', async () => {
  const res = await request(app).post(`/api/crm/customers/${customerA1._id}/opportunities`).set(bearer(operatorRead, tenantA._id))
    .send({ stage: 'qualification', status: 'open' });
  expect(res.status).toBe(403);
});

// ─── P-CRM-07/08 — manage capability cross tenants ───────────────────────

test('P-CRM-07: platform.crm.manage updates activity in Tenant A', async () => {
  const activity = await CrmActivity.create({ tenant: tenantA._id, customer: customerA1._id, type: 'note', title: 'seed', createdBy: tenantAdminA._id });
  const res = await request(app).patch(`/api/crm/activities/${activity._id}`).set(bearer(operatorManage, tenantA._id))
    .send({ title: 'updated by operator A' });
  expect(res.status).toBe(200);
  const after = await CrmActivity.findById(activity._id).lean();
  expect(after.title).toBe('updated by operator A');
});

test('P-CRM-08: same manage capability updates activity in Tenant B after switch', async () => {
  const activity = await CrmActivity.create({ tenant: tenantB._id, customer: customerB1._id, type: 'note', title: 'seed B', createdBy: bootstrapB._id });
  const res = await request(app).patch(`/api/crm/activities/${activity._id}`).set(bearer(operatorManage, tenantB._id))
    .send({ title: 'updated by operator B' });
  expect(res.status).toBe(200);
  const after = await CrmActivity.findById(activity._id).lean();
  expect(after.title).toBe('updated by operator B');
});

// ─── P-CRM-09/10/11/12 — negative authority ──────────────────────────────

test('P-CRM-09: operator without platform.crm.* is denied', async () => {
  const res = await request(app).get('/api/crm/customers').set(bearer(operatorNoCrm, tenantA._id));
  expect(res.status).toBe(403);
});

test('P-CRM-10: suspended PlatformOperator is denied', async () => {
  const res = await request(app).get('/api/crm/customers').set(bearer(operatorSuspended, tenantA._id));
  expect(res.status).toBe(403);
});

test('P-CRM-11: User.role=Admin without PlatformOperator and without membership is denied', async () => {
  const res = await request(app).get('/api/crm/customers').set(bearer(bareGlobalAdmin, tenantA._id));
  expect(res.status).toBe(403);
});

test('P-CRM-12: no selected tenant → 403 fail closed', async () => {
  const res = await request(app).get('/api/crm/customers').set(bearer(operatorRead));
  expect(res.status).toBe(403);
});

// ─── P-CRM-13/14 — cross-tenant + null resource ID ──────────────────────

test('P-CRM-13: Tenant A context + Tenant B activity ID → denied and target unchanged', async () => {
  const activity = await CrmActivity.create({ tenant: tenantB._id, customer: customerB1._id, type: 'note', title: 'B origin', createdBy: bootstrapB._id });
  const res = await request(app).patch(`/api/crm/activities/${activity._id}`).set(bearer(operatorManage, tenantA._id))
    .send({ title: 'attempted cross-tenant' });
  expect([403, 404]).toContain(res.status);
  const after = await CrmActivity.findById(activity._id).lean();
  expect(after.title).toBe('B origin');
});

test('P-CRM-14: Tenant A context + tenant:null activity ID → denied', async () => {
  const activity = await CrmActivity.create({ tenant: null, customer: customerLegacyNull._id, type: 'note', title: 'legacy null', createdBy: bootstrapA._id });
  const res = await request(app).patch(`/api/crm/activities/${activity._id}`).set(bearer(operatorManage, tenantA._id))
    .send({ title: 'attempted null' });
  expect([403, 404]).toContain(res.status);
  const after = await CrmActivity.findById(activity._id).lean();
  expect(after.title).toBe('legacy null');
});

// ─── P-CRM-15 — PATH A preserved (STAFF + MANAGERS separation) ─────────

test('P-CRM-15: tenant STAFF (Admin) still lists customers via PATH A', async () => {
  const res = await request(app).get('/api/crm/customers').set(bearer(tenantAdminA, tenantA._id));
  expect(res.status).toBe(200);
});

test('P-CRM-15b: tenant Collaborateur (STAFF non-MANAGER) still lists but cannot POST /consolidations (MANAGERS-only preserved)', async () => {
  const listRes = await request(app).get('/api/crm/customers').set(bearer(staffCollabA, tenantA._id));
  expect(listRes.status).toBe(200);
  const consolidateRes = await request(app).post('/api/crm/consolidations').set(bearer(staffCollabA, tenantA._id))
    .send({ customerA: String(customerA1._id), customerB: String(customerA2._id) });
  expect(consolidateRes.status).toBe(403);
});

test('P-CRM-15c: PlatformOperator + platform.crm.manage CAN reach MANAGERS-only route (PATH B parity)', async () => {
  const res = await request(app).post('/api/crm/consolidations').set(bearer(operatorManage, tenantA._id))
    .send({ customerA: String(customerA1._id), customerB: String(customerA2._id) });
  // Middleware autorise (200 ou 422 selon métier — l'important est: pas 403).
  expect(res.status).not.toBe(403);
});

// ─── P-CRM-16 — capability-specificity ────────────────────────────────

test('P-CRM-16: platform.crm.read does not imply platform.crm.manage', async () => {
  const res = await request(app).post('/api/crm/consolidations').set(bearer(operatorRead, tenantA._id))
    .send({ customerA: String(customerA1._id), customerB: String(customerA2._id) });
  expect(res.status).toBe(403);
});

// ─── P-CRM-17/18/19/20/21 — cross-capability separation ──────────────

test('P-CRM-17: platform.tenants.manage alone is insufficient for CRM read and manage', async () => {
  const listRes = await request(app).get('/api/crm/customers').set(bearer(operatorTenantsMgOnly, tenantA._id));
  expect(listRes.status).toBe(403);
  const consolidateRes = await request(app).post('/api/crm/consolidations').set(bearer(operatorTenantsMgOnly, tenantA._id)).send({});
  expect(consolidateRes.status).toBe(403);
});

test('P-CRM-18: platform.properties.manage alone insufficient for CRM authority', async () => {
  const res = await request(app).get('/api/crm/customers').set(bearer(operatorPropertiesMgOnly, tenantA._id));
  expect(res.status).toBe(403);
});

test('P-CRM-19: platform.rentals.manage alone insufficient for CRM authority', async () => {
  const opRentals = await makeUser({ role: 'Admin' });
  await grantOperator({ userId: opRentals._id, actor: grantor, capabilities: ['platform.rentals.manage'], reason: 'rentals only' });
  const res = await request(app).get('/api/crm/customers').set(bearer(opRentals, tenantA._id));
  expect(res.status).toBe(403);
});

test('P-CRM-20: platform.marketing.manage alone insufficient for CRM authority', async () => {
  const res = await request(app).get('/api/crm/customers').set(bearer(operatorMarketingMgOnly, tenantA._id));
  expect(res.status).toBe(403);
});

test('P-CRM-21: platform.commercial.manage alone insufficient for CRM authority', async () => {
  const res = await request(app).get('/api/crm/customers').set(bearer(operatorCommercialMgOnly, tenantA._id));
  expect(res.status).toBe(403);
});

// ─── P-CRM-22/23/24 — CRM manage never triggers cross-domain writes ───

test('P-CRM-22: crm.manage activity update creates no FinancialPayment/Document/Refund', async () => {
  const FinancialPayment = require('../models/FinancialPayment');
  const FinancialRefund = require('../models/FinancialRefund');
  const activity = await CrmActivity.create({ tenant: tenantA._id, customer: customerA1._id, type: 'note', title: 'baseline', createdBy: tenantAdminA._id });
  const financialBefore = await FinancialPayment.countDocuments();
  const refundBefore = await FinancialRefund.countDocuments();
  const res = await request(app).patch(`/api/crm/activities/${activity._id}`).set(bearer(operatorManage, tenantA._id))
    .send({ title: 'no side effect' });
  expect(res.status).toBe(200);
  const financialAfter = await FinancialPayment.countDocuments();
  const refundAfter = await FinancialRefund.countDocuments();
  expect(financialAfter).toBe(financialBefore);
  expect(refundAfter).toBe(refundBefore);
});

test('P-CRM-23: crm.manage opportunity move creates no Property/Contrat/Transaction write', async () => {
  const Contrat = require('../models/Contrat');
  const Transaction = require('../models/Transaction');
  const propBefore = await Property.countDocuments();
  const contratBefore = await Contrat.countDocuments();
  const txBefore = await Transaction.countDocuments();
  const res = await request(app).patch(`/api/crm/opportunities/${opportunityA1._id}/stage`).set(bearer(operatorManage, tenantA._id))
    .send({ stage: 'qualification' });
  expect([200, 400, 422]).toContain(res.status); // Middleware allowed regardless
  expect(await Property.countDocuments()).toBe(propBefore);
  expect(await Contrat.countDocuments()).toBe(contratBefore);
  expect(await Transaction.countDocuments()).toBe(txBefore);
});

test('P-CRM-24: crm.manage activity does not write HotelReservation nor CrmAutomationRun', async () => {
  const HotelReservation = require('../models/HotelReservation');
  const CrmAutomationRun = require('../models/CrmAutomationRun');
  const activity = await CrmActivity.create({ tenant: tenantA._id, customer: customerA1._id, type: 'note', title: 'baseline24', createdBy: tenantAdminA._id });
  const hrBefore = await HotelReservation.countDocuments();
  const runBefore = await CrmAutomationRun.countDocuments();
  const res = await request(app).patch(`/api/crm/activities/${activity._id}`).set(bearer(operatorManage, tenantA._id))
    .send({ title: 'no side effect 24' });
  expect(res.status).toBe(200);
  expect(await HotelReservation.countDocuments()).toBe(hrBefore);
  expect(await CrmAutomationRun.countDocuments()).toBe(runBefore);
});

// ─── Automation routes coverage ─────────────────────────────────────

test('P-CRM-AUTO-01: crm.read lists automation rules in Tenant A', async () => {
  const res = await request(app).get('/api/crm-automation/rules').set(bearer(operatorRead, tenantA._id));
  expect(res.status).toBe(200);
});

test('P-CRM-AUTO-02: crm.read cannot create automation rule (MANAGERS-only preserved via PATH B)', async () => {
  const res = await request(app).post('/api/crm-automation/rules').set(bearer(operatorRead, tenantA._id))
    .send({ ruleId: 'p-crm-auto-r-read', name: 'nope', triggerEvent: 'customer.created', actions: [] });
  expect(res.status).toBe(403);
});

test('P-CRM-AUTO-03: crm.manage can toggle rule enabled in Tenant B (cross-tenant via PATH B)', async () => {
  const res = await request(app).patch(`/api/crm-automation/rules/${ruleB1._id}/enabled`).set(bearer(operatorManage, tenantB._id))
    .send({ enabled: false });
  // Middleware allows; controller may 200/400/404 based on payload, but never 403.
  expect(res.status).not.toBe(403);
});

test('P-CRM-AUTO-04: tenant Collaborateur cannot mutate automation rule (MANAGERS-only PATH A)', async () => {
  const res = await request(app).patch(`/api/crm-automation/rules/${ruleA1._id}/enabled`).set(bearer(staffCollabA, tenantA._id))
    .send({ enabled: false });
  expect(res.status).toBe(403);
});
