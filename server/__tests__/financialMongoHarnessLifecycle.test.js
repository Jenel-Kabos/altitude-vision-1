// Real local Mongo characterization of the shared test helper, not business code.
const mongoose = require('mongoose');
const { MongoMemoryReplSet } = require('mongodb-memory-server');
const { startFinancialMongo, clearFinancialMongo, stopFinancialMongo } = require('./helpers/financialMongoEnvironment');

jest.setTimeout(30000);
const Probe = mongoose.model('HarnessLifecycleProbe', new mongoose.Schema({ marker: String }));
afterEach(stopFinancialMongo);

test('HARNESS-08: cleanup empties actual database collections, including unregistered collections, preserving indexes', async () => {
  await startFinancialMongo();
  const db = mongoose.connection.db;
  const nativeName = 'harness_native_sentinels';
  const native = db.collection(nativeName);
  await Probe.create({ marker: 'registered sentinel' });
  await native.createIndex({ marker: 1 }, { unique: true, name: 'sentinel_unique' });
  await native.insertOne({ marker: 'native sentinel' });
  expect(mongoose.connection.collections[nativeName]).toBeUndefined();
  expect(await Probe.countDocuments()).toBe(1);
  expect(await native.countDocuments()).toBe(1);
  const indexesBefore = await native.indexes();

  await clearFinancialMongo();

  expect(await Probe.countDocuments()).toBe(0);
  expect(await native.countDocuments()).toBe(0);
  const collections = await db.listCollections({}, { nameOnly: true }).toArray();
  expect(collections.map(({ name }) => name)).toContain(nativeName);
  for (const { name } of collections.filter(({ name }) => !name.startsWith('system.'))) {
    expect(await db.collection(name).countDocuments({})).toBe(0);
  }
  expect(await native.indexes()).toEqual(indexesBefore);
});

test('HARNESS-09: cleanup leaves system collections and other local databases untouched', async () => {
  await startFinancialMongo();
  const system = mongoose.connection.db.collection('system.js');
  const other = mongoose.connection.getClient().db('harness_other_local_db').collection('sentinels');
  try {
    await system.insertOne({ _id: 'harness_sentinel', value: 'preserved' });
    await other.insertOne({ marker: 'other database' });
    await Probe.create({ marker: 'active database' });
    await clearFinancialMongo();
    expect(await Probe.countDocuments()).toBe(0);
    expect(await system.countDocuments({ _id: 'harness_sentinel' })).toBe(1);
    expect(await other.countDocuments()).toBe(1);
  } finally {
    await system.deleteMany({ _id: 'harness_sentinel' });
    await other.deleteMany({});
  }
});

test('HARNESS-10: deletion failure is surfaced after the other deletions settle', async () => {
  await startFinancialMongo();
  const db = mongoose.connection.db;
  const failed = db.collection('harness_failed_delete');
  await failed.insertOne({ marker: 'must remain on failure' });
  await Probe.create({ marker: 'must be deleted before rejection' });
  const collection = db.collection.bind(db);
  const error = new Error('INJECTED_CLEANUP_DELETE_FAILURE');
  const spy = jest.spyOn(db, 'collection').mockImplementation((name, ...args) => (
    name === failed.collectionName ? { deleteMany: async () => { throw error; } } : collection(name, ...args)
  ));
  try {
    await expect(clearFinancialMongo()).rejects.toBe(error);
    expect(await Probe.countDocuments()).toBe(0);
    expect(await failed.countDocuments()).toBe(1);
  } finally {
    spy.mockRestore();
  }
});

test('HARNESS-01: start/stop closes the client and its sessions', async () => {
  await startFinancialMongo();
  const client = mongoose.connection.getClient();
  const session = client.startSession();
  await Probe.create({ marker: 'owned fixture' });
  await stopFinancialMongo();
  expect(mongoose.connection.readyState).toBe(0);
  expect(session.hasEnded).toBe(true);
  expect(client.s.activeSessions.size).toBe(0);
  expect(client.topology).toBeUndefined();
});

test('HARNESS-02: repeated stop is idempotent', async () => {
  await startFinancialMongo();
  await stopFinancialMongo();
  await stopFinancialMongo();
  expect(mongoose.connection.readyState).toBe(0);
});

test('HARNESS-03: stopping an idle connection requires no explicit session', async () => {
  await startFinancialMongo();
  await stopFinancialMongo();
  expect(mongoose.connection.readyState).toBe(0);
});

test('HARNESS-04: consecutive start/stop cycles release each client', async () => {
  for (let cycle = 0; cycle < 3; cycle += 1) {
    await startFinancialMongo();
    const client = mongoose.connection.getClient();
    expect(await Probe.countDocuments()).toBe(0);
    await Probe.create({ marker: `cycle ${cycle}` });
    await stopFinancialMongo();
    expect(client.topology).toBeUndefined();
  }
});

test('HARNESS-05: an interrupted read transaction is aborted and its session ended', async () => {
  await startFinancialMongo();
  await Probe.create({ marker: 'read transaction' });
  const session = await mongoose.startSession();
  session.startTransaction();
  await Probe.findOne({ marker: 'read transaction' }).session(session);
  expect(session.inTransaction()).toBe(true);
  await stopFinancialMongo();
  expect(session.hasEnded).toBe(true);
  expect(session.inTransaction()).toBe(false);
});

test('HARNESS-06: a following connection cannot see fixtures from the previous lifecycle', async () => {
  const previousUri = process.env.MONGODB_FINANCIAL_INTEGRATION_URI;
  const donor = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: 'wiredTiger' } });
  const uri = donor.getUri('harness_successive_suites');
  process.env.MONGODB_FINANCIAL_INTEGRATION_URI = uri;
  const reader = new mongoose.mongo.MongoClient(uri);
  try {
    await startFinancialMongo();
    await reader.connect();
    await Probe.create({ marker: 'previous suite' });
    expect(await reader.db().collection(Probe.collection.name).countDocuments()).toBe(1);
    await stopFinancialMongo();
    // The helper must not stop the borrowed server or this independent client.
    expect(await reader.db().collection(Probe.collection.name).countDocuments()).toBe(0);
    await startFinancialMongo();
    expect(await Probe.countDocuments()).toBe(0);
  } finally {
    await stopFinancialMongo();
    await reader.close();
    await donor.stop();
    if (previousUri === undefined) delete process.env.MONGODB_FINANCIAL_INTEGRATION_URI;
    else process.env.MONGODB_FINANCIAL_INTEGRATION_URI = previousUri;
  }
});

test('HARNESS-07: ordinary persistence and caller-completed transactions are unchanged', async () => {
  await startFinancialMongo();
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      await Probe.create([{ marker: 'committed' }], { session });
    });
  } finally {
    await session.endSession();
  }
  expect(await Probe.countDocuments({ marker: 'committed' })).toBe(1);
});
