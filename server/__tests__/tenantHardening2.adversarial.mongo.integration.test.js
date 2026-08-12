// TENANT-HARDENING-2 — preuves transverses avec contrôle positif puis attaque.
const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const { startFinancialMongo, clearFinancialMongo, stopFinancialMongo } = require('./helpers/financialMongoEnvironment');
const { createTenantFixture, createTenantUser } = require('./helpers/tenantAwareFixture');
const User = require('../models/User');
const Property = require('../models/Property');
const RentalManagement = require('../models/RentalManagement');
const ActionLog = require('../models/ActionLog');
const WebhookSubscription = require('../models/WebhookSubscription');
const Notification = require('../models/Notification');
const reportingRoutes = require('../routes/reportingRoutes');
const erpRoutes = require('../routes/erpRoutes');
const rentalRoutes = require('../routes/rentalManagementRoutes');
const exportRoutes = require('../routes/exportRoutes');
const actionLogRoutes = require('../routes/actionLogRoutes');
const { errorHandler } = require('../middleware/errorMiddleware');
const webhookDispatch = require('../services/publicApi/webhookDispatchService');
const { notifyStaff } = require('../services/notificationService');

jest.setTimeout(180000);
const app = express();
app.use(express.json());
app.use('/api/reporting', reportingRoutes);
app.use('/api/erp', erpRoutes);
app.use('/api/rental-management', rentalRoutes);
app.use('/api/export', exportRoutes);
app.use('/api/action-logs', actionLogRoutes);
app.use(errorHandler);

const bearer = (user, tenant) => ({ Authorization: `Bearer ${jwt.sign({ id: user._id, tokenVersion: 0 }, process.env.JWT_SECRET, { expiresIn: '1d' })}`, 'X-Platform-Tenant-Id': String(tenant._id) });
let seq = 0;
const property = (owner, title) => Property.create({
  title, description: 'Description suffisamment longue pour une fixture adversariale tenant.', pole: 'Altimmo',
  type: 'Villa', status: 'vente', price: 100000, address: { city: 'Brazzaville', arrondissement: 'Centre' },
  latitude: -4.2, longitude: 15.2, images: ['https://placehold.co/1200x800/png'], surface: 80,
  statusAdmin: 'Validée', isPublished: true, availability: 'Disponible', owner: owner._id,
});

async function threat() {
  seq += 1;
  const bootstrap = await User.create({ name: 'Bootstrap', email: `h2-bootstrap-${seq}@example.test`, password: 'Password123!', passwordConfirm: 'Password123!', role: 'Admin' });
  const { tenant: tenantA } = await createTenantFixture({ label: 'H2 A', bootstrap });
  const { tenant: tenantB } = await createTenantFixture({ label: 'H2 B', bootstrap });
  const { user: adminA } = await createTenantUser({ tenant: tenantA, bootstrap, overrides: { role: 'Admin', email: `h2-admin-a-${seq}@example.test`, name: 'Admin A' } });
  const { user: adminB } = await createTenantUser({ tenant: tenantB, bootstrap, overrides: { role: 'Admin', email: `h2-admin-b-${seq}@example.test`, name: 'Admin B' } });
  const { user: ownerA } = await createTenantUser({ tenant: tenantA, bootstrap, overrides: { role: 'Proprietaire', email: `h2-owner-a-${seq}@example.test`, name: 'Owner A' } });
  const { user: ownerB } = await createTenantUser({ tenant: tenantB, bootstrap, overrides: { role: 'Proprietaire', email: `h2-owner-b-${seq}@example.test`, name: 'Owner B Secret' } });
  return { tenantA, tenantB, adminA, adminB, ownerA, ownerB };
}

beforeAll(startFinancialMongo);
afterEach(async () => { global.fetch = undefined; await clearFinancialMongo(); });
afterAll(stopFinancialMongo);

test('Reporting/ERP : B voit B ; A sans scope explicite ne voit jamais les KPI Property B', async () => {
  const t = await threat();
  await property(t.ownerA, 'PROPERTY_A_MARKER');
  await property(t.ownerB, 'PROPERTY_B_MARKER');
  const positive = await request(app).get('/api/reporting/executive').set(bearer(t.adminB, t.tenantB));
  expect(positive.status).toBe(200);
  expect(positive.body.data.report.domains.immobilier.error).toBeUndefined();
  expect(positive.body.data.report.domains.immobilier.data.kpis.total).toBe(1);
  const attack = await request(app).get('/api/reporting/executive').set(bearer(t.adminA, t.tenantA));
  expect(attack.status).toBe(200);
  expect(String(attack.body.data.report.tenantId)).toBe(String(t.tenantA._id));
  expect(attack.body.data.report.domains.immobilier.data.kpis.total).toBe(1);
  const erp = await request(app).get('/api/erp/executive').set(bearer(t.adminA, t.tenantA));
  expect(erp.status).toBe(200);
  expect(erp.body.data.overview.domains.immobilier.data.kpis.total).toBe(1);
});

test('multi-tenant sans contexte explicite : Reporting échoue fermé', async () => {
  const t = await threat();
  await require('../services/organizationService').grantMembership({ userId: t.adminA._id, orgUnitId: t.tenantB.rootOrgUnit, actor: t.adminB });
  const res = await request(app).get('/api/reporting/executive').set('Authorization', bearer(t.adminA, t.tenantA).Authorization);
  expect(res.status).toBe(403);
});

test('Gestion locative liste/statistiques : contrôle B positif et aucune ligne B dans A', async () => {
  const t = await threat();
  const pA = await property(t.ownerA, 'GL_A'); pA.status = 'location'; await pA.save();
  const pB = await property(t.ownerB, 'GL_B_SECRET'); pB.status = 'location'; await pB.save();
  await RentalManagement.create({ property: pA._id, owner: t.ownerA._id, managementActivated: true });
  const rB = await RentalManagement.create({ property: pB._id, owner: t.ownerB._id, managementActivated: true });
  const positive = await request(app).get('/api/rental-management').set(bearer(t.adminB, t.tenantB));
  expect(positive.status).toBe(200);
  expect(positive.body.data.rentals.map((r) => String(r._id))).toContain(String(rB._id));
  const attack = await request(app).get('/api/rental-management').set(bearer(t.adminA, t.tenantA));
  expect(attack.status).toBe(200);
  expect(attack.body.data.rentals.map((r) => String(r._id))).not.toContain(String(rB._id));
  expect(attack.body.data.total).toBe(1);
});

test('Export contacts et ActionLog : le contenu réel A exclut les marqueurs B', async () => {
  const t = await threat();
  const csvA = await request(app).get('/api/export/contacts/csv?source=clients').set(bearer(t.adminA, t.tenantA));
  expect(csvA.status).toBe(200);
  expect(csvA.text).toContain(t.ownerA.email);
  expect(csvA.text).not.toContain(t.ownerB.email);
  await ActionLog.create({ tenant: t.tenantA._id, action: 'ACTION_A', description: 'visible A', module: 'Dashboard', typeAction: 'MODIFICATION' });
  await ActionLog.create({ tenant: t.tenantB._id, action: 'ACTION_B_SECRET', description: 'secret B', module: 'Dashboard', typeAction: 'MODIFICATION' });
  const logsB = await request(app).get('/api/action-logs/export').set(bearer(t.adminB, t.tenantB));
  expect(logsB.text).toContain('ACTION_B_SECRET');
  const logsA = await request(app).get('/api/action-logs/export').set(bearer(t.adminA, t.tenantA));
  expect(logsA.text).toContain('ACTION_A');
  expect(logsA.text).not.toContain('ACTION_B_SECRET');
});

test('Webhook : Event B appelle uniquement subscription B active avec signature, jamais A/disabled', async () => {
  const t = await threat();
  const apiKey = new mongoose.Types.ObjectId();
  await WebhookSubscription.create({ tenant: t.tenantA._id, apiKey, url: 'https://a.example.test/hook', events: ['bien_valide'], secret: 'secret-a' });
  await WebhookSubscription.create({ tenant: t.tenantB._id, apiKey, url: 'https://b.example.test/hook', events: ['bien_valide'], secret: 'secret-b' });
  await WebhookSubscription.create({ tenant: t.tenantB._id, apiKey, url: 'https://disabled.example.test/hook', events: ['bien_valide'], secret: 'disabled', status: 'disabled' });
  global.fetch = jest.fn().mockResolvedValue({ ok: true });
  await webhookDispatch.dispatch({ type: 'bien_valide', platformTenantId: t.tenantB._id, entityType: 'Property', entityId: new mongoose.Types.ObjectId() });
  expect(global.fetch).toHaveBeenCalledTimes(1);
  expect(global.fetch.mock.calls[0][0]).toBe('https://b.example.test/hook');
  expect(global.fetch.mock.calls[0][1].headers['X-Altitude-Signature']).toMatch(/^[a-f0-9]{64}$/);
});

test('Cron/notification staff : un événement A ne crée aucune notification chez le staff B', async () => {
  const t = await threat();
  await notifyStaff({ platformTenantId: t.tenantA._id, type: 'rental_contract_expiring', title: 'Alerte A', body: 'Contrat A' });
  const recipients = (await Notification.find({ title: 'Alerte A' }).distinct('recipient')).map(String);
  expect(recipients).toContain(String(t.adminA._id));
  expect(recipients).not.toContain(String(t.adminB._id));
});
