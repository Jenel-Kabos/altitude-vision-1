const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const { startFinancialMongo, clearFinancialMongo, stopFinancialMongo } = require('./helpers/financialMongoEnvironment');
const { createTenantFixture, addTenantMember } = require('./helpers/tenantAwareFixture');
const User = require('../models/User');
const Property = require('../models/Property');
const Contrat = require('../models/Contrat');
const Paiement = require('../models/Paiement');
const routes = require('../routes/paiementRoutes');
const { errorHandler } = require('../middleware/errorMiddleware');

jest.setTimeout(180000);
const app = express();
app.use(express.json());
app.use('/api/paiements', routes);
app.use(errorHandler);
let sequence = 0;
let a, b, owner;
const headers = (f) => ({
  Authorization: `Bearer ${jwt.sign({ id: f.bootstrap._id, tokenVersion: 0 }, process.env.JWT_SECRET, { expiresIn: '1d' })}`,
  'X-Platform-Tenant-Id': String(f.tenant._id),
});
async function payment(tenant, amount = 100000) {
  const property = await Property.create({
    title: `Payment B1 ${sequence++}`, description: 'Description assez longue pour un bien de test.',
    pole: 'Altimmo', type: 'Villa', status: 'location', price: amount,
    address: { city: 'Brazzaville', arrondissement: 'Centre' }, latitude: -4.26, longitude: 15.24,
    images: ['https://example.test/property.png'], surface: 90, owner: owner._id,
    tenant: tenant?._id || null,
  });
  const contrat = await Contrat.create({ type: 'location', bien: property._id, statut: 'actif', montantLoyer: amount });
  return Paiement.create({ contrat: contrat._id, montant: amount, montantTotal: amount, statut: 'en_retard',
    annee: 2025, mois: 1, retardJours: 20, penaliteAppliquee: true, penaliteMontant: 3000 });
}
const list = async (f) => {
  const response = await request(app).get('/api/paiements').set(headers(f));
  expect(response.status).toBe(200);
  return response.body.data.paiements.map((p) => p._id);
};
beforeAll(startFinancialMongo);
beforeEach(async () => {
  a = await createTenantFixture({ label: 'PAY B1 A', withAdminMembership: true });
  b = await createTenantFixture({ label: 'PAY B1 B', withAdminMembership: true });
  owner = await User.create({ name: 'Shared owner', email: `pay-b1-${sequence++}@example.test`,
    password: 'Password123!', passwordConfirm: 'Password123!', role: 'Proprietaire', isEmailVerified: true });
  await addTenantMember({ tenant: a.tenant, user: owner, bootstrap: a.bootstrap });
  await addTenantMember({ tenant: b.tenant, user: owner, bootstrap: b.bootstrap });
});
afterEach(clearFinancialMongo);
afterAll(stopFinancialMongo);

test('PAY-AGG-01: direct tenant A payment remains visible to A with shared owner', async () => {
  const p = await payment(a.tenant);
  expect(await list(a)).toEqual([String(p._id)]);
});
test('PAY-AGG-02: owner membership B cannot expose an explicit A payment to B', async () => {
  await payment(a.tenant);
  expect(await list(b)).toEqual([]);
});
test('PAY-AGG-03: B statistics exclude explicit A amounts', async () => {
  await payment(a.tenant);
  const response = await request(app).get('/api/paiements/stats').set(headers(b));
  expect(response.status).toBe(200);
  expect(response.body.data.stats).toMatchObject({ nbTotal: 0, totalAttendu: 0, totalImpaye: 0 });
});
test('PAY-AGG-04: B alerts exclude explicit A overdue payments', async () => {
  await payment(a.tenant);
  const response = await request(app).get('/api/paiements/alertes').set(headers(b));
  expect(response.status).toBe(200);
  expect(response.body.data).toMatchObject({ nbImpayes: 0, nbPenalites: 0, totalPenalites: 0 });
});
test('PAY-AGG-05: same owner, two direct tenants, separate histories', async () => {
  const pa = await payment(a.tenant);
  const pb = await payment(b.tenant, 200000);
  expect(await list(a)).toEqual([String(pa._id)]);
  expect(await list(b)).toEqual([String(pb._id)]);
});
test('PAY-AGG-06: explicit tenant wins even without owner membership there', async () => {
  const OrgMembership = require('../models/OrgMembership');
  await OrgMembership.updateOne({ user: owner._id, orgUnit: a.tenant.rootOrgUnit }, { $set: { status: 'revoked' } });
  const p = await payment(a.tenant);
  expect(await list(a)).toEqual([String(p._id)]);
  expect(await list(b)).toEqual([]);
});
test('PAY-AGG-07: null tenant keeps uniquely attributable owner compatibility', async () => {
  const OrgMembership = require('../models/OrgMembership');
  await OrgMembership.updateOne({ user: owner._id, orgUnit: b.tenant.rootOrgUnit }, { $set: { status: 'revoked' } });
  const p = await payment(null);
  expect(await list(a)).toEqual([String(p._id)]);
  expect(await list(b)).toEqual([]);
});
test('PAY-AGG-08: ambiguous legacy owner is excluded from both tenant lists', async () => {
  await payment(null);
  expect(await list(a)).toEqual([]);
  expect(await list(b)).toEqual([]);
});
