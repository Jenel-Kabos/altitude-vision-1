const mongoose = require('mongoose');
const { startFinancialMongo, stopFinancialMongo } = require('./helpers/financialMongoEnvironment');
const {
  INDEX_NAME, OLD_INDEX, OLD_FINGERPRINT, EXPECTED_FINGERPRINT,
  inspect, migrate,
} = require('../scripts/migrateCrmCustomerSourceIndex');

jest.setTimeout(180000);
let db;
let collection;
const tenantA = new mongoose.Types.ObjectId();
const tenantB = new mongoose.Types.ObjectId();
const sourceId = new mongoose.Types.ObjectId();
const source = { entityType: 'User', entityId: sourceId, source: 'auth' };
const doc = (tenant, suffix, sourceRefsMarker = 'missing') => {
  const value = { tenant, displayName: suffix, identityKeys: [`manual:${suffix}`] };
  if (sourceRefsMarker !== 'missing') value.sourceRefs = sourceRefsMarker;
  return value;
};
const createOld = () => collection.createIndex(OLD_INDEX.key, { name: INDEX_NAME, unique: true });
const confirmations = () => ({ database: db.databaseName, index: INDEX_NAME, currentFingerprint: OLD_FINGERPRINT, expectedFingerprint: EXPECTED_FINGERPRINT });
const runMigration = (options = {}) => migrate({ db, expectedDatabase: db.databaseName, ...options });

beforeAll(async () => {
  await startFinancialMongo();
  db = mongoose.connection.db;
  collection = db.collection('crmcustomers');
});
beforeEach(async () => {
  await collection.drop().catch(() => {});
  await createOld();
});
afterAll(stopFinancialMongo);

test('OLD reproduit la collision null/missing sans modifier les données', async () => {
  await collection.insertOne(doc(tenantA, 'old-1'));
  await expect(collection.insertOne(doc(tenantA, 'old-2'))).rejects.toMatchObject({ code: 11000 });
  expect((await inspect({ db })).currentFingerprint).toBe(OLD_FINGERPRINT);
});

test('migration OLD→NEW conserve documents et applique les invariants manual/cross-tenant/multikey', async () => {
  await collection.insertMany([doc(tenantA, 'manual'), doc(tenantA, 'source-x', [source])]);
  const before = await collection.find({}).sort({ _id: 1 }).toArray();
  const result = await runMigration({ apply: true, confirmations: confirmations() });
  expect(result.result).toBe('MIGRATED');
  expect(result.currentFingerprint).toBe(EXPECTED_FINGERPRINT);
  expect(await collection.find({}).sort({ _id: 1 }).toArray()).toEqual(before);
  await expect(collection.insertOne(doc(tenantA, 'manual-2', []))).resolves.toBeTruthy();
  await expect(collection.insertOne(doc(tenantA, 'manual-3', null))).resolves.toBeTruthy();
  await expect(collection.insertOne(doc(tenantA, 'source-x-duplicate', [source]))).rejects.toMatchObject({ code: 11000 });
  await expect(collection.insertOne(doc(tenantB, 'source-x-other-tenant', [source]))).resolves.toBeTruthy();
  const sourceY = { entityType: 'ContactMessage', entityId: new mongoose.Types.ObjectId(), source: 'contact' };
  await collection.insertOne(doc(tenantA, 'multi', [sourceY, { entityType: 'QuoteRequest', entityId: new mongoose.Types.ObjectId(), source: 'quote' }]));
  await expect(collection.insertOne(doc(tenantA, 'multi-duplicate', [sourceY]))).rejects.toMatchObject({ code: 11000 });
});

test('seconde exécution est ALREADY_MIGRATED et sans écriture', async () => {
  await collection.insertOne(doc(tenantA, 'one'));
  await runMigration({ apply: true, confirmations: confirmations() });
  const result = await runMigration({ apply: true, confirmations: confirmations() });
  expect(result).toMatchObject({ result: 'ALREADY_MIGRATED', writes: 0 });
});

test('dry-run reste sans écriture', async () => {
  await collection.insertOne(doc(tenantA, 'dry'));
  const before = await collection.indexes();
  const result = await runMigration();
  expect(result).toMatchObject({ result: 'DRY_RUN', writes: 0 });
  expect(await collection.indexes()).toEqual(before);
});

test('doublons bloquants sont détectés avant drop', async () => {
  await collection.dropIndex(INDEX_NAME);
  await collection.insertMany([doc(tenantA, 'dup-1', [source]), doc(tenantA, 'dup-2', [source])]);
  await createOld().catch(() => {});
  // Recrée un index OLD non unique pour matérialiser un état de données incompatible,
  // puis vérifie que le preflight refuse avant toute migration.
  await collection.createIndex(OLD_INDEX.key, { name: INDEX_NAME });
  const report = await inspect({ db });
  expect(report.blockingDuplicates).toHaveLength(1);
  expect(report.state).toBe('INDEX_STATE_UNEXPECTED');
});

test('crash après drop laisse un état explicite et le restart fail-closed', async () => {
  await collection.insertOne(doc(tenantA, 'crash'));
  await expect(runMigration({ apply: true, confirmations: confirmations(), hooks: { afterDrop: () => { throw new Error('SIMULATED_CRASH'); } } })).rejects.toThrow('SIMULATED_CRASH');
  await expect(inspect({ db })).rejects.toMatchObject({ code: 'INDEX_STATE_UNEXPECTED' });
  expect(await collection.countDocuments()).toBe(1);
});

test('échec create est explicite et ne change aucun document', async () => {
  await collection.insertOne(doc(tenantA, 'create-fail'));
  await expect(runMigration({
    apply: true,
    confirmations: confirmations(),
    hooks: { beforeCreate: () => { throw new Error('SIMULATED_CREATE_FAILURE'); } },
  })).rejects.toMatchObject({ code: 'CREATE_INDEX_FAILED' });
  expect(await collection.countDocuments()).toBe(1);
});

test('deux migrations concurrentes ne peuvent pas toutes deux remplacer l index', async () => {
  await collection.insertOne(doc(tenantA, 'concurrent'));
  const results = await Promise.allSettled([
    runMigration({ apply: true, confirmations: confirmations() }),
    runMigration({ apply: true, confirmations: confirmations() }),
  ]);
  expect(results.filter((r) => r.status === 'fulfilled' && r.value.result === 'MIGRATED')).toHaveLength(1);
  expect(results.filter((r) => r.status === 'rejected')).toHaveLength(1);
  expect((await inspect({ db })).state).toBe('ALREADY_MIGRATED');
});

test('NEW→OLD rollback est possible seulement avant création de plusieurs clients sans source', async () => {
  await collection.insertOne(doc(tenantA, 'rollback-one'));
  await runMigration({ apply: true, confirmations: confirmations() });
  await collection.dropIndex(INDEX_NAME);
  await expect(createOld()).resolves.toBe(INDEX_NAME);
  await collection.dropIndex(INDEX_NAME);
  await collection.insertOne(doc(tenantA, 'rollback-two'));
  await expect(createOld()).rejects.toMatchObject({ code: 11000 });
});
