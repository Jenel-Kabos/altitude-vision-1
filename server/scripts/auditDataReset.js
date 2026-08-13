#!/usr/bin/env node
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');

const RESET_ID = 'data-reset-1-20260813';
const DATABASE = 'altitudevision';
const STRUCTURAL = new Set(['users', 'platformtenants', 'orgunits', 'orgmemberships', 'platformoperators', 'platformtenantsettings', 'platformtenantthemes', 'platformtenantsubscriptions', 'actionlogs']);
const INFRASTRUCTURE = new Set(['counters', 'inventoryoperationlocks', 'accommodationcalendarmutexes', 'accommodationnightlocks', 'writewindows', 'financialsequences']);
const SECURITY = new Set(['apikeys', 'apicalllogs', 'webhooksubscriptions', 'pendingregistrations']);

const stable = (value) => Array.isArray(value) ? value.map(stable) : value && typeof value === 'object'
  ? Object.keys(value).sort().reduce((out, key) => { out[key] = stable(value[key]); return out; }, {}) : value;
const hash = (value) => crypto.createHash('sha256').update(JSON.stringify(stable(value))).digest('hex');
const args = Object.fromEntries(process.argv.slice(2).filter((x) => x.startsWith('--')).map((x) => { const [k, ...v] = x.slice(2).split('='); return [k, v.length ? v.join('=') : true]; }));

function loadModels() {
  const dir = path.join(__dirname, '..', 'models');
  fs.readdirSync(dir).filter((name) => name.endsWith('.js')).sort().forEach((name) => {
    try { require(path.join(dir, name)); } catch (error) { process.stderr.write(`MODEL_LOAD_WARNING ${name}: ${error.message}\n`); }
  });
}

const category = (name) => STRUCTURAL.has(name) ? 'B — RESET STRUCTUREL PUIS REBOOTSTRAP'
  : SECURITY.has(name) ? 'A — RESET SÉCURITÉ TEST'
    : INFRASTRUCTURE.has(name) ? 'A — RESET INFRASTRUCTURE RUNTIME'
      : 'A — RESET MÉTIER/TEST';

async function buildManifest(db) {
  loadModels();
  const modelByCollection = new Map(Object.values(mongoose.models).map((model) => [model.collection.name, model.modelName]));
  const collections = (await db.listCollections({}, { nameOnly: true }).toArray()).map((item) => item.name).sort();
  const rows = [];
  for (const name of collections) {
    const count = await db.collection(name).countDocuments({});
    rows.push({ collection: name, countBefore: count, model: modelByCollection.get(name) || null, category: category(name), action: 'DROP_WITH_DATABASE', expectedAfterBootstrap: STRUCTURAL.has(name) ? ({ users: 1, platformtenants: 1, orgunits: 1, orgmemberships: 1, platformoperators: 1, platformtenantsettings: 1, platformtenantthemes: 1, platformtenantsubscriptions: 1 }[name] || 'bootstrap-audit-logs') : 0 });
  }
  const indexDefinitions = Object.values(mongoose.models).sort((a, b) => a.collection.name.localeCompare(b.collection.name)).map((model) => ({
    collection: model.collection.name,
    model: model.modelName,
    indexes: model.schema.indexes().map(([key, options]) => ({ key, options })),
  }));
  const plan = {
    resetId: RESET_ID,
    database: db.databaseName,
    strategy: 'DROP_DATABASE_THEN_RECREATE_MODEL_INDEXES_AND_BOOTSTRAP_MINIMUM',
    collections: rows,
    preservedCollections: [],
    bootstrapEntities: { User: 1, PlatformTenant: 1, OrgUnit: 1, OrgMembership: 1, PlatformOperator: 1, PlatformTenantSettings: 1, PlatformTenantTheme: 1, PlatformTenantSubscription: 1 },
    adminStrategy: 'DELETE_ALL_USERS_AND_CREATE_NEW_ADMIN_FROM_EXPLICIT_EMAIL_AND_SECURE_PASSWORD_INPUT',
    indexDefinitions,
    cloudinary: 'NO_CHANGE',
  };
  return { ...plan, fingerprint: hash(plan), generatedAt: new Date().toISOString(), writes: 0 };
}

async function main() {
  require('dotenv').config();
  if (args.apply) throw new Error('PHASE_1_ONLY — this audit tool never applies a reset.');
  await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 15000, autoIndex: false, autoCreate: false });
  try {
    if (mongoose.connection.name !== DATABASE) throw new Error(`DATABASE_MISMATCH — resolved ${mongoose.connection.name}, expected ${DATABASE}.`);
    const manifest = await buildManifest(mongoose.connection.db);
    if (args.output) fs.writeFileSync(path.resolve(args.output), `${JSON.stringify(manifest, null, 2)}\n`, { flag: 'wx' });
    process.stdout.write(`${JSON.stringify({ database: manifest.database, resetId: manifest.resetId, fingerprint: manifest.fingerprint, collectionCount: manifest.collections.length, documentCount: manifest.collections.reduce((n, row) => n + row.countBefore, 0), preservedCollections: manifest.preservedCollections, bootstrapEntities: manifest.bootstrapEntities, cloudinary: manifest.cloudinary, writes: 0 }, null, 2)}\n`);
  } finally { await mongoose.disconnect(); }
}

if (require.main === module) main().catch(async (error) => { process.stderr.write(`${error.message}\n`); try { await mongoose.disconnect(); } catch {} process.exitCode = 1; });
module.exports = { RESET_ID, DATABASE, buildManifest, hash };
