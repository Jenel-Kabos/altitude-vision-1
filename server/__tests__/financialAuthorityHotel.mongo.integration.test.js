const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const { startFinancialMongo, clearFinancialMongo, stopFinancialMongo } = require('./helpers/financialMongoEnvironment');
const { createTenantFixture, createTenantUser, createTenantHotel, tenantActor } = require('./helpers/tenantAwareFixture');
const OrgMembership = require('../models/OrgMembership');
const PlatformOperator = require('../models/PlatformOperator');
const FinancialDocument = require('../models/FinancialDocument');
const FinancialPayment = require('../models/FinancialPayment');
const HotelReservation = require('../models/HotelReservation');
const authz = require('../services/finance/financialAuthorizationService');
const routes = require('../routes/financialRoutes');
const app = express(); app.use(express.json()); app.use('/financial', routes);
app.use((err, req, res, next) => res.status(err.statusCode || 500).json({ code: err.code, message: err.message }));
jest.setTimeout(120000);
const id = () => new mongoose.Types.ObjectId();
let f; let other; let hotel; let user; let actor; let doc; let reservationId;
beforeAll(startFinancialMongo); afterAll(stopFinancialMongo);
beforeEach(async () => {
  await clearFinancialMongo();
  f = await createTenantFixture({ label: 'Finance A' }); other = await createTenantFixture({ label: 'Finance B' });
  ({ user, actor } = await createTenantUser({ ...f, businessRole: 'Admin', overrides: { role: 'Client' } }));
  hotel = await createTenantHotel({ tenant: f.tenant, manager: f.bootstrap });
  reservationId = id();
  await HotelReservation.collection.insertOne({ _id: reservationId, hotel: hotel._id, tenant: f.tenant._id, guest: { firstName: 'Guest' }, status: 'checked_in' });
  doc = await FinancialDocument.create({ tenant: f.tenant._id, domain: 'hotel', establishmentType: 'Hotel', establishmentId: hotel._id, documentType: 'invoice', documentNumber: `FA-${id()}`, status: 'issued', currency: 'XAF', subjectType: 'HotelReservation', subjectId: reservationId, totalMinor: 100000, balanceMinor: 100000, businessOperationKey: `doc-${id()}`, createdBy: user._id });
});
const headers = (who = user, tenant = f.tenant) => ({ Authorization: `Bearer ${jwt.sign({ id: who._id, tokenVersion: 0 }, process.env.JWT_SECRET)}`, 'X-Platform-Tenant-Id': String(tenant._id), 'Idempotency-Key': `FA-${id()}` });
const body = () => ({ financialDocumentId: String(doc._id), reservationId: String(reservationId), amountMinor: 40000, method: 'cash' });

test('FA-04 F2.2-01 active tenant membership records payment through real route', async () => {
  const response = await request(app).post('/financial/hotel/payments').set(headers()).send(body());
  expect(response.status).toBe(201); expect(response.body.data.payment.status).toBe('pending');
  expect(await FinancialPayment.countDocuments()).toBe(1);
});
test.each(['assertCanCreateFinancialPayment', 'assertCanConfirmFinancialPayment', 'assertCanAllocatePayment'])('FA-01..03/08 global Admin and manager alone denied: %s', async (operation) => {
  await expect(authz[operation](tenantActor(f.bootstrap, f.tenant), hotel._id)).rejects.toMatchObject({ code: 'FINANCIAL_UNAUTHORIZED' });
});
test.each(['suspended', 'revoked'])('FA-06/07 %s membership denied', async (status) => {
  await OrgMembership.updateMany({ user: user._id }, { status });
  await expect(authz.assertCanConfirmFinancialPayment(actor, hotel._id)).rejects.toMatchObject({ code: 'FINANCIAL_UNAUTHORIZED' });
});
test('FA-05/15/16 wrong tenant document and payment fail closed', async () => {
  const h = await createTenantHotel({ tenant: other.tenant, manager: other.bootstrap });
  await expect(authz.assertCanCreateFinancialPayment(actor, h._id)).rejects.toMatchObject({ code: 'FINANCIAL_UNAUTHORIZED' });
  doc.establishmentId = h._id; doc.tenant = other.tenant._id; await doc.save();
  const payment = await FinancialPayment.create({ domain: 'hotel', establishmentType: 'Hotel', establishmentId: h._id, tenant: other.tenant._id, paymentReference: `P-${id()}`, amountMinor: 1, availableAmountMinor: 1, currency: 'XAF', method: 'cash', createdBy: user._id });
  const response = await request(app).post(`/financial/payments/${payment._id}/confirm`).set(headers()).send({ tenantId: String(other.tenant._id) });
  expect(response.status).toBe(404); expect((await FinancialPayment.findById(payment._id)).status).toBe('pending');
  const read = await request(app).get(`/financial/documents/${doc._id}`).set(headers()); expect(read.status).toBe(404);
});
test('FA-10/11/12 platform finance is explicit and independent from membership', async () => {
  const operator = await PlatformOperator.create({ user: f.bootstrap._id, status: 'active', capabilities: [], grantedBy: other.bootstrap._id, grantReason: 'Test finance authority' });
  const opActor = tenantActor(f.bootstrap, f.tenant);
  await expect(authz.assertCanAllocatePayment(opActor, hotel._id)).rejects.toMatchObject({ code: 'FINANCIAL_UNAUTHORIZED' });
  operator.capabilities = ['platform.finance.manage']; await operator.save();
  await expect(authz.assertCanAllocatePayment(opActor, hotel._id)).resolves.toBeDefined();
});
test('FA-17 body spoof cannot authorize global Admin manager', async () => {
  const response = await request(app).post('/financial/hotel/payments').set(headers(f.bootstrap)).send({ ...body(), tenantId: String(f.tenant._id), businessRole: 'Admin', platformOperatorCapabilities: ['platform.finance.manage'] });
  expect(response.status).toBe(403); expect(await FinancialPayment.countDocuments()).toBe(0);
});
