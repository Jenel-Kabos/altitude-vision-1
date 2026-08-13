#!/usr/bin/env node
const crypto = require('crypto');
const mongoose = require('mongoose');

const INDEX_NAME = 'one_crm_customer_per_tenant_source';
const COLLECTION_NAME = 'crmcustomers';
const EXPECTED_DATABASE = 'altitudevision';
const KEY = { tenant: 1, 'sourceRefs.entityType': 1, 'sourceRefs.entityId': 1 };
const OLD_INDEX = { name: INDEX_NAME, key: KEY, unique: true };
const NEW_INDEX = {
  name: INDEX_NAME,
  key: KEY,
  unique: true,
  partialFilterExpression: {
    'sourceRefs.entityType': { $type: 'string' },
    'sourceRefs.entityId': { $type: 'objectId' },
  },
};

const canonicalize = (value) => {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') return Object.keys(value).sort().reduce((out, key) => {
    if (value[key] !== undefined) out[key] = canonicalize(value[key]);
    return out;
  }, {});
  return value;
};

const normalizedIndex = (index) => canonicalize({
  name: index.name,
  key: index.key,
  unique: index.unique === true,
  partialFilterExpression: index.partialFilterExpression,
  sparse: index.sparse === true ? true : undefined,
  collation: index.collation,
});
const fingerprint = (index) => crypto.createHash('sha256').update(JSON.stringify(normalizedIndex(index))).digest('hex');
const OLD_FINGERPRINT = fingerprint(OLD_INDEX);
const EXPECTED_FINGERPRINT = fingerprint(NEW_INDEX);

class MigrationError extends Error {
  constructor(code, message, details = {}) { super(message); this.name = 'MigrationError'; this.code = code; this.details = details; }
}

const trueSources = (doc) => Array.isArray(doc.sourceRefs)
  ? doc.sourceRefs.filter((ref) => typeof ref?.entityType === 'string' && ref?.entityId?._bsontype === 'ObjectId')
  : [];

const auditCustomers = async (collection) => {
  const counts = { total: 0, sourceRefsMissing: 0, sourceRefsNull: 0, sourceRefsEmpty: 0, withTrueSource: 0, partialOrInvalid: 0, duplicateWithinDocument: 0, sameSourceAcrossTenants: 0 };
  const groups = new Map();
  const crossTenant = new Map();
  const cursor = collection.find({}, { projection: { tenant: 1, sourceRefs: 1 } });
  for await (const doc of cursor) {
    counts.total += 1;
    if (!Object.prototype.hasOwnProperty.call(doc, 'sourceRefs')) counts.sourceRefsMissing += 1;
    else if (doc.sourceRefs === null) counts.sourceRefsNull += 1;
    else if (Array.isArray(doc.sourceRefs) && doc.sourceRefs.length === 0) counts.sourceRefsEmpty += 1;
    const valid = trueSources(doc);
    if (valid.length) counts.withTrueSource += 1;
    if (Array.isArray(doc.sourceRefs) && doc.sourceRefs.some((ref) => !(typeof ref?.entityType === 'string' && ref?.entityId?._bsontype === 'ObjectId' && typeof ref?.source === 'string' && ref.source.length))) counts.partialOrInvalid += 1;
    const local = new Set();
    for (const ref of valid) {
      const source = `${ref.entityType}:${ref.entityId}`;
      const key = `${doc.tenant || 'null'}:${source}`;
      if (local.has(key)) counts.duplicateWithinDocument += 1;
      local.add(key);
      const entry = groups.get(key) || { tenant: String(doc.tenant || 'null'), entityType: ref.entityType, entityId: String(ref.entityId), customerIds: new Set() };
      entry.customerIds.add(String(doc._id)); groups.set(key, entry);
      const tenants = crossTenant.get(source) || new Set(); tenants.add(String(doc.tenant || 'null')); crossTenant.set(source, tenants);
    }
  }
  counts.withoutTrueSource = counts.total - counts.withTrueSource;
  counts.sameSourceAcrossTenants = [...crossTenant.values()].filter((tenants) => tenants.size > 1).length;
  const blockingDuplicates = [...groups.values()].filter((g) => g.customerIds.size > 1).map((g) => ({ ...g, customerIds: [...g.customerIds], count: g.customerIds.size }));
  return { counts, blockingDuplicates };
};

const inspectIndex = async (collection) => {
  const matches = (await collection.indexes()).filter((index) => index.name === INDEX_NAME);
  if (matches.length !== 1) throw new MigrationError('INDEX_STATE_UNEXPECTED', `Expected exactly one ${INDEX_NAME} index, found ${matches.length}.`);
  return matches[0];
};

const assertModelDefinition = () => {
  // Chargement tardif : le dry-run compare réellement l'outil au schéma canonique,
  // sans déclencher syncIndexes ni aucune opération réseau.
  const CrmCustomer = require('../models/CrmCustomer');
  const candidates = CrmCustomer.schema.indexes().filter(([, options]) => options.name === INDEX_NAME);
  if (candidates.length !== 1) throw new MigrationError('MODEL_INDEX_UNEXPECTED', `Expected one model index named ${INDEX_NAME}, found ${candidates.length}.`);
  const [key, options] = candidates[0];
  const modelIndex = { name: options.name, key, unique: options.unique, partialFilterExpression: options.partialFilterExpression, sparse: options.sparse, collation: options.collation };
  if (fingerprint(modelIndex) !== EXPECTED_FINGERPRINT) throw new MigrationError('MODEL_DEFINITION_MISMATCH', 'Expected migration definition differs from CrmCustomer schema.');
};

const inspect = async ({ db, collectionName = COLLECTION_NAME }) => {
  assertModelDefinition();
  if (collectionName !== COLLECTION_NAME) throw new MigrationError('COLLECTION_UNEXPECTED', `Expected collection ${COLLECTION_NAME}.`);
  const collection = db.collection(collectionName);
  const current = await inspectIndex(collection);
  const currentFingerprint = fingerprint(current);
  const audit = await auditCustomers(collection);
  const state = currentFingerprint === EXPECTED_FINGERPRINT ? 'ALREADY_MIGRATED' : currentFingerprint === OLD_FINGERPRINT ? 'READY' : 'INDEX_STATE_UNEXPECTED';
  return { database: db.databaseName, collection: collectionName, indexName: INDEX_NAME, currentIndex: normalizedIndex(current), currentFingerprint, expectedIndex: normalizedIndex(NEW_INDEX), expectedFingerprint: EXPECTED_FINGERPRINT, state, ...audit };
};

const migrate = async ({ db, apply = false, confirmations = {}, hooks = {}, expectedDatabase = EXPECTED_DATABASE }) => {
  const report = await inspect({ db });
  if (!apply || report.state === 'ALREADY_MIGRATED') return { ...report, writes: 0, result: report.state === 'ALREADY_MIGRATED' ? 'ALREADY_MIGRATED' : 'DRY_RUN' };
  if (db.databaseName !== expectedDatabase || confirmations.database !== expectedDatabase) throw new MigrationError('DATABASE_MISMATCH', 'Database confirmation mismatch.');
  if (confirmations.index !== INDEX_NAME) throw new MigrationError('INDEX_CONFIRMATION_MISMATCH', 'Index confirmation mismatch.');
  if (confirmations.currentFingerprint !== report.currentFingerprint) throw new MigrationError('CURRENT_FINGERPRINT_MISMATCH', 'Current fingerprint confirmation mismatch.');
  if (confirmations.expectedFingerprint !== EXPECTED_FINGERPRINT) throw new MigrationError('EXPECTED_FINGERPRINT_MISMATCH', 'Expected fingerprint confirmation mismatch.');
  if (report.state !== 'READY') throw new MigrationError('INDEX_STATE_UNEXPECTED', 'Current index is neither audited OLD nor expected NEW.');
  if (report.blockingDuplicates.length) throw new MigrationError('BLOCKING_DUPLICATES', 'Blocking duplicate real sources exist.', { count: report.blockingDuplicates.length });
  const collection = db.collection(COLLECTION_NAME);
  const before = await collection.find({}).sort({ _id: 1 }).toArray();
  await collection.dropIndex(INDEX_NAME);
  if (hooks.afterDrop) await hooks.afterDrop();
  try {
    if (hooks.beforeCreate) await hooks.beforeCreate();
    await collection.createIndex(KEY, { unique: true, name: INDEX_NAME, partialFilterExpression: NEW_INDEX.partialFilterExpression });
  } catch (error) {
    throw new MigrationError('CREATE_INDEX_FAILED', error.message);
  }
  const after = await collection.find({}).sort({ _id: 1 }).toArray();
  const verified = await inspect({ db });
  if (verified.state !== 'ALREADY_MIGRATED') throw new MigrationError('POST_VERIFY_FAILED', 'Expected index was not observed after create.');
  if (JSON.stringify(before) !== JSON.stringify(after)) throw new MigrationError('DATA_CHANGED', 'CRM documents changed during index migration.');
  return { ...verified, writes: 2, documentWrites: 0, result: 'MIGRATED' };
};

const parseArgs = (argv) => Object.fromEntries(argv.slice(2).filter((arg) => arg.startsWith('--')).map((arg) => {
  const [key, ...rest] = arg.slice(2).split('='); return [key, rest.length ? rest.join('=') : true];
}));

const main = async () => {
  require('dotenv').config();
  const args = parseArgs(process.argv);
  await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 15000, autoIndex: false });
  try {
    const result = await migrate({
      db: mongoose.connection.db,
      apply: args.apply === true,
      confirmations: { database: args['confirm-database'], index: args['confirm-index'], currentFingerprint: args['confirm-current-fingerprint'], expectedFingerprint: args['confirm-expected-fingerprint'] },
    });
    console.log(JSON.stringify(result, null, 2));
  } finally { await mongoose.disconnect(); }
};

if (require.main === module) main().catch(async (error) => {
  console.error(JSON.stringify({ error: error.code || 'MIGRATION_ERROR', message: error.message, details: error.details || {} }, null, 2));
  try { await mongoose.disconnect(); } catch { /* noop */ }
  process.exitCode = 1;
});

module.exports = { INDEX_NAME, COLLECTION_NAME, OLD_INDEX, NEW_INDEX, OLD_FINGERPRINT, EXPECTED_FINGERPRINT, fingerprint, normalizedIndex, auditCustomers, assertModelDefinition, inspect, migrate, MigrationError };
