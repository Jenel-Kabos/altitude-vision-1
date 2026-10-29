const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const { startFinancialMongo, stopFinancialMongo } = require('./helpers/financialMongoEnvironment');
const User = require('../models/User');
const PlatformOperator = require('../models/PlatformOperator');
const ContactAuthorization = require('../models/ContactAuthorization');
const { PLATFORM_VIEW_REQUIRED_CAPABILITIES } = require('../constants/platformOperatorConstants');
const routes = require('../routes/contactAuthorizationRoutes');
const { errorHandler } = require('../middleware/errorMiddleware');

jest.setTimeout(180000);
const app = express();
app.use(express.json());
app.use('/api/contact-authorizations', routes);
app.use(errorHandler);

let seq = 0;
const user = async (role = 'Client') => User.create({ name: `CA route ${++seq}`, email: `ca-route-${seq}-${Date.now()}@example.test`, password: 'Password123!', passwordConfirm: 'Password123!', role, isEmailVerified: true });
const bearer = (value, tenantId) => ({ Authorization: `Bearer ${jwt.sign({ id: value._id, tokenVersion: 0 }, process.env.JWT_SECRET, { expiresIn: '1d' })}`, ...(tenantId ? { 'X-Platform-Tenant-Id': String(tenantId) } : {}) });

let operator; let client; let representative; let unrelated; let tenantAdmin; let propertyId; let dossierId; let tenantId;

beforeAll(async () => {
  await startFinancialMongo();
  [operator, client, representative, unrelated, tenantAdmin] = await Promise.all([user(), user(), user('Proprietaire'), user(), user('Admin')]);
  propertyId = new mongoose.Types.ObjectId(); dossierId = new mongoose.Types.ObjectId(); tenantId = new mongoose.Types.ObjectId();
  await PlatformOperator.create({ user: operator._id, capabilities: [...PLATFORM_VIEW_REQUIRED_CAPABILITIES], grantedBy: operator._id, grantReason: 'route test' });
});
afterEach(() => ContactAuthorization.deleteMany({}));
afterAll(async () => stopFinancialMongo());

const payload = () => ({ clientId: client._id, representativeId: representative._id, propertyId, dossierType: 'RealEstateApplication', dossierId, tenantId, scopes: ['direct_transactional_messaging'], reason: 'Introduction validée' });

test('opérateur plateforme habilité octroie, liste et révoque', async () => {
  const created = await request(app).post('/api/contact-authorizations').set(bearer(operator)).send(payload());
  expect(created.status).toBe(201);
  expect(created.body.data.authorization.status).toBe('active');
  const listed = await request(app).get('/api/contact-authorizations').set(bearer(operator));
  expect(listed.status).toBe(200);
  expect(listed.body.data.authorizations).toHaveLength(1);
  const revoked = await request(app).patch(`/api/contact-authorizations/${created.body.data.authorization.id}/revoke`).set(bearer(operator)).send({ reason: 'Retrait' });
  expect(revoked.status).toBe(200);
  expect(revoked.body.data.authorization.status).toBe('revoked');
});

test.each(['suspended', 'revoked'])('opérateur %s refusé', async (status) => {
  await PlatformOperator.updateOne({ user: operator._id }, { status });
  const res = await request(app).post('/api/contact-authorizations').set(bearer(operator)).send(payload());
  expect(res.status).toBe(403);
  await PlatformOperator.updateOne({ user: operator._id }, { status: 'active' });
});

test('Admin tenant, opérateur sans capacité et contexte tenant sont refusés', async () => {
  await PlatformOperator.create({ user: unrelated._id, capabilities: ['platform.users.read'], grantedBy: operator._id, grantReason: 'wrong capability' });
  expect((await request(app).post('/api/contact-authorizations').set(bearer(tenantAdmin)).send(payload())).status).toBe(403);
  expect((await request(app).post('/api/contact-authorizations').set(bearer(unrelated)).send(payload())).status).toBe(403);
  expect((await request(app).post('/api/contact-authorizations').set(bearer(operator, tenantId)).send(payload())).status).toBe(403);
});

test('participants voient la projection sûre; tiers et autre tenant ne peuvent pas énumérer', async () => {
  const created = await request(app).post('/api/contact-authorizations').set(bearer(operator)).send(payload());
  const id = created.body.data.authorization.id;
  const own = await request(app).get(`/api/contact-authorizations/${id}`).set(bearer(client));
  expect(own.status).toBe(200);
  expect(JSON.stringify(own.body)).not.toMatch(/email|phone|password/i);
  expect((await request(app).get(`/api/contact-authorizations/${id}`).set(bearer(unrelated))).status).toBe(404);
  expect((await request(app).get(`/api/contact-authorizations/${id}`).set(bearer(client, new mongoose.Types.ObjectId()))).status).toBe(404);
});

