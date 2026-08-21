const { startFinancialMongo, clearFinancialMongo, stopFinancialMongo } = require('./helpers/financialMongoEnvironment');
const Litige = require('../models/Litige');

jest.setTimeout(180000);

const fixture = (description, reference) => ({
  description,
  type: 'Autre',
  ...(reference !== undefined ? { reference } : {}),
});

beforeAll(async () => {
  await startFinancialMongo();
  await Litige.syncIndexes();
});
afterEach(clearFinancialMongo);
afterAll(stopFinancialMongo);

test('indexe uniquement les références textuelles réelles et conserve leur unicité', async () => {
  const indexes = await Litige.collection.indexes();
  const referenceIndex = indexes.find((index) => index.key?.reference === 1);

  expect(referenceIndex).toMatchObject({
    unique: true,
    partialFilterExpression: { reference: { $type: 'string' } },
  });

  await expect(Litige.create(fixture('Sans référence A'))).resolves.toBeDefined();
  await expect(Litige.create(fixture('Sans référence B'))).resolves.toBeDefined();
  await expect(Litige.create(fixture('Null A', null))).resolves.toBeDefined();
  await expect(Litige.create(fixture('Null B', null))).resolves.toBeDefined();
  await expect(Litige.create(fixture('Référence réelle A', 'LIT-INDEX-001'))).resolves.toBeDefined();

  await expect(Litige.create(fixture('Référence réelle dupliquée', 'LIT-INDEX-001')))
    .rejects.toMatchObject({ code: 11000, keyValue: { reference: 'LIT-INDEX-001' } });
});
