const mongoose = require('mongoose');
const { MongoMemoryReplSet, MongoMemoryServer } = require('mongodb-memory-server');

let replSet;
let standalone;
let connected = false;

async function startFinancialMongo() {
  const externalUri = process.env.MONGODB_FINANCIAL_INTEGRATION_URI;
  let uri = externalUri;
  if (!uri) {
    if (process.env.FINANCIAL_MONGO_STANDALONE === '1') { standalone = await MongoMemoryServer.create(); uri = standalone.getUri(`financial_f11_${Date.now()}`); }
    else { replSet = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: 'wiredTiger' } }); uri = replSet.getUri(`financial_f11_${Date.now()}`); }
  }
  await mongoose.connect(uri, { maxPoolSize: 20, serverSelectionTimeoutMS: 15000, socketTimeoutMS: 45000, autoIndex: false });
  connected = true;
  const hello = await mongoose.connection.db.admin().command({ hello: 1 });
  if (!hello.setName && process.env.FINANCIAL_MONGO_STANDALONE !== '1') throw new Error('FINANCIAL_REPLICA_SET_REQUIRED');
  await Promise.all(Object.values(mongoose.models).filter((model) => model.modelName.startsWith('Financial') || model.modelName === 'PaymentAllocation').map((model) => model.syncIndexes()));
  return { uri, replicaSet: hello.setName || null, standalone: !hello.setName };
}

// Sous forte charge de transactions (plusieurs `session.withTransaction`
// abandonnées en succession rapide dans le même fichier de test),
// mongodb-memory-server peut laisser une session interne expirée attachée
// à la connexion Mongoose au moment où ce nettoyage s'exécute
// (`MongoExpiredSessionError: Cannot use a session that has ended`), sans
// rapport avec la correction applicative (chaque test a déjà vérifié ses
// propres assertions avant ce nettoyage). On retente une fois après un tick
// pour laisser le driver terminer son cycle de session interne.
async function clearFinancialMongo() {
  if (!connected) return;
  const collections = mongoose.connection.collections;
  try {
    await Promise.all(Object.values(collections).map((collection) => collection.deleteMany({})));
  } catch (error) {
    if (!/session/i.test(error?.message || '')) throw error;
    await new Promise((resolve) => setImmediate(resolve));
    await Promise.all(Object.values(collections).map((collection) => collection.deleteMany({})));
  }
}

async function stopFinancialMongo() {
  // Le runner Mongo global injecte une URI unique partagée séquentiellement
  // par toutes les suites Jest. Un simple disconnect laisse les fixtures de
  // la suite terminée dans cette base et pollue le premier test de la suite
  // suivante (QA-1 : tenantCert3Final → altimmoSearch). Nettoyer avant de
  // rendre la connexion garantit l'isolation même si une suite conserve des
  // fixtures en beforeAll et n'utilise pas clearFinancialMongo en afterEach.
  if (connected) {
    await clearFinancialMongo();
    await mongoose.disconnect();
  }
  if (replSet) await replSet.stop();
  if (standalone) await standalone.stop();
  replSet = null;
  standalone = null;
  connected = false;
}

module.exports = { startFinancialMongo, clearFinancialMongo, stopFinancialMongo };
