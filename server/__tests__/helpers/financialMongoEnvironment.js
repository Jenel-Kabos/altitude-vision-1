const mongoose = require('mongoose');
const { MongoMemoryReplSet } = require('mongodb-memory-server');

let replSet;
let connected = false;

async function startFinancialMongo() {
  const externalUri = process.env.MONGODB_FINANCIAL_INTEGRATION_URI;
  let uri = externalUri;
  if (!uri) {
    replSet = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: 'wiredTiger' } });
    uri = replSet.getUri(`financial_f11_${Date.now()}`);
  }
  await mongoose.connect(uri, { maxPoolSize: 20, serverSelectionTimeoutMS: 15000, socketTimeoutMS: 45000, autoIndex: false });
  connected = true;
  const hello = await mongoose.connection.db.admin().command({ hello: 1 });
  if (!hello.setName) throw new Error('FINANCIAL_REPLICA_SET_REQUIRED');
  await Promise.all(Object.values(mongoose.models).filter((model) => model.modelName.startsWith('Financial') || model.modelName === 'PaymentAllocation').map((model) => model.syncIndexes()));
  return { uri, replicaSet: hello.setName };
}

async function clearFinancialMongo() {
  if (!connected) return;
  const collections = mongoose.connection.collections;
  await Promise.all(Object.values(collections).map((collection) => collection.deleteMany({})));
}

async function stopFinancialMongo() {
  if (connected) await mongoose.disconnect();
  if (replSet) await replSet.stop();
  replSet = null;
  connected = false;
}

module.exports = { startFinancialMongo, clearFinancialMongo, stopFinancialMongo };
