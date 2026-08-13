const mongoose = require('mongoose');
const { startFinancialMongo, stopFinancialMongo } = require('./helpers/financialMongoEnvironment');
const CrmCustomer = require('../models/CrmCustomer');

jest.setTimeout(180000);
const tenantA = new mongoose.Types.ObjectId();
const tenantB = new mongoose.Types.ObjectId();
let sequence = 0;
const customer = (tenant, sourceRefsMarker = 'missing') => {
  sequence += 1;
  const value = { tenant, displayName: `Customer ${sequence}`, identityKeys: [`manual:${sequence}`] };
  if (sourceRefsMarker !== 'missing') value.sourceRefs = sourceRefsMarker;
  return value;
};

beforeAll(async () => {
  await startFinancialMongo();
  await CrmCustomer.syncIndexes();
});
afterEach(() => CrmCustomer.deleteMany({}));
afterAll(() => stopFinancialMongo());

test.each([
  ['missing', 'missing'],
  ['empty array', []],
  ['null', null],
])('plusieurs clients manuels du même tenant coexistent avec sourceRefs=%s', async (_label, marker) => {
  await CrmCustomer.create(customer(tenantA, marker));
  await expect(CrmCustomer.create(customer(tenantA, marker))).resolves.toBeTruthy();
});

test('une vraie source dupliquée dans le même tenant reste refusée', async () => {
  const source = { entityType: 'User', entityId: new mongoose.Types.ObjectId(), source: 'auth' };
  await CrmCustomer.create(customer(tenantA, [source]));
  await expect(CrmCustomer.create(customer(tenantA, [source]))).rejects.toMatchObject({ code: 11000 });
});

test('la même vraie source est permise dans deux tenants distincts', async () => {
  const source = { entityType: 'User', entityId: new mongoose.Types.ObjectId(), source: 'auth' };
  await CrmCustomer.create(customer(tenantA, [source]));
  await expect(CrmCustomer.create(customer(tenantB, [source]))).resolves.toBeTruthy();
});

test('plusieurs sourceRefs valides sont chacune protégées', async () => {
  const sources = [
    { entityType: 'User', entityId: new mongoose.Types.ObjectId(), source: 'auth' },
    { entityType: 'ContactMessage', entityId: new mongoose.Types.ObjectId(), source: 'contact' },
  ];
  await CrmCustomer.create(customer(tenantA, sources));
  await expect(CrmCustomer.create(customer(tenantA, [{ ...sources[1] }]))).rejects.toMatchObject({ code: 11000 });
});

test.each([
  [{ entityType: 'User', source: 'auth' }],
  [{ entityId: new mongoose.Types.ObjectId(), source: 'auth' }],
  [{ entityType: 'Unknown', entityId: new mongoose.Types.ObjectId(), source: 'auth' }],
])('un sous-document source partiel ou invalide est refusé par le schéma', async (sourceRefs) => {
  await expect(CrmCustomer.create(customer(tenantA, sourceRefs))).rejects.toBeTruthy();
});
