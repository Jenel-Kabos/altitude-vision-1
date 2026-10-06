#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

class CleanupCliError extends Error {
  constructor(code, message) { super(message); this.name = 'CleanupCliError'; this.code = code; this.exitCode = 2; }
}
const fail = (code, message) => { throw new CleanupCliError(code, message); };
const valueOf = (args, name) => args.find((arg) => arg.startsWith(`${name}=`))?.slice(name.length + 1);

function describeMongoTarget(uri) {
  let parsed;
  try { parsed = new URL(uri); } catch { fail('MONGO_URI_INVALID', 'URI Mongo invalide.'); }
  return { host: parsed.hostname, database: decodeURIComponent(parsed.pathname.replace(/^\//, '')) };
}

function parseArgs(args, env = process.env) {
  const allowed = ['--preview', '--apply', '--confirm-delete-legacy-test-data'];
  const values = ['--confirm-database=', '--manifest-out=', '--manifest=', '--confirm-manifest-hash='];
  const unknown = args.filter((arg) => !allowed.includes(arg) && !values.some((prefix) => arg.startsWith(prefix)));
  if (unknown.length) fail('UNKNOWN_OPTION', `Option inconnue : ${unknown.join(', ')}`);
  if (args.includes('--preview') === args.includes('--apply')) fail('MODE_REQUIRED', 'Choisir exactement --preview ou --apply.');
  if (!env.MONGO_URI) fail('MONGO_URI_REQUIRED', 'MONGO_URI est requis.');
  const target = describeMongoTarget(env.MONGO_URI);
  if (!target.database) fail('DATABASE_REQUIRED_IN_URI', 'La base doit être explicite dans MONGO_URI.');
  if (valueOf(args, '--confirm-database') !== target.database) fail('DATABASE_CONFIRMATION_MISMATCH', 'La confirmation database ne correspond pas.');
  const mode = args.includes('--apply') ? 'apply' : 'preview';
  const parsed = { mode, uri: env.MONGO_URI, host: target.host, database: target.database };
  if (mode === 'preview') {
    parsed.manifestOut = valueOf(args, '--manifest-out');
    if (!parsed.manifestOut) fail('MANIFEST_OUT_REQUIRED', '--manifest-out est requis.');
  } else {
    parsed.manifestPath = valueOf(args, '--manifest');
    parsed.manifestHash = valueOf(args, '--confirm-manifest-hash');
    if (!parsed.manifestPath) fail('MANIFEST_REQUIRED', '--manifest est requis.');
    if (!parsed.manifestHash) fail('MANIFEST_HASH_REQUIRED', '--confirm-manifest-hash est requis.');
    if (!args.includes('--confirm-delete-legacy-test-data')) fail('DELETE_CONFIRMATION_REQUIRED', 'Confirmation destructive requise.');
    if (env.ALLOW_C2_11D_LEGACY_TEST_DATA_DELETE !== 'true') fail('APPLY_ENV_GUARD_REQUIRED', 'Garde environnementale apply absente.');
  }
  return parsed;
}

const print = (name, value) => process.stdout.write(`${name}=${typeof value === 'string' ? value : JSON.stringify(value)}\n`);

async function main(args = process.argv.slice(2), env = process.env) {
  const parsed = parseArgs(args, env);
  const mongoose = require('mongoose');
  const {
    CLASSIFICATION, discoverLegacyRentalTestData, computeCleanupManifestHash, applyLegacyRentalTestDataCleanup,
  } = require('../services/platformTenant/legacyRentalTestDataCleanupService');
  await mongoose.connect(parsed.uri, { autoIndex: false, autoCreate: false, maxPoolSize: 3, serverSelectionTimeoutMS: 15000 });
  try {
    if (mongoose.connection.name !== parsed.database) fail('CONNECTED_DATABASE_MISMATCH', 'Base connectée inattendue.');
    const report = await discoverLegacyRentalTestData(mongoose.connection.db);
    const hash = computeCleanupManifestHash(report.manifest);
    print('TARGET_DATABASE', parsed.database);
    print('LEGACY_LOCATAIRES', report.counts.locataires);
    print('LEGACY_PROPRIETAIRES', report.counts.proprietaires);
    print('DEPENDENCIES_TO_DELETE', report.manifest.dependencies.length);
    print('BLOCKED_RECORDS', report.classificationCounts[CLASSIFICATION.BLOCKED_POSSIBLE_REAL_DATA]);
    print('LEGACY_LOCATAIRE_IDS', report.rows.filter(({ type }) => type === 'Locataire').map(({ id }) => id));
    print('LEGACY_PROPRIETAIRE_IDS', report.rows.filter(({ type }) => type === 'Proprietaire').map(({ id }) => id));

    if (parsed.mode === 'preview') {
      const artifact = { targetDatabase: parsed.database, generatedAt: new Date().toISOString(), manifestHash: hash, manifest: report.manifest, rows: report.rows };
      fs.mkdirSync(path.dirname(parsed.manifestOut), { recursive: true });
      fs.writeFileSync(parsed.manifestOut, `${JSON.stringify(artifact, null, 2)}\n`, { flag: 'wx' });
      print('MANIFEST_HASH', hash);
      print('MANIFEST_PATH', parsed.manifestOut);
      return { report, artifact };
    }

    if (report.classificationCounts[CLASSIFICATION.BLOCKED_POSSIBLE_REAL_DATA] > 0) fail('BLOCKED_RECORDS_PRESENT', 'Suppression interdite : fiches bloquées.');
    const artifact = JSON.parse(fs.readFileSync(parsed.manifestPath, 'utf8'));
    if (artifact.targetDatabase !== parsed.database) fail('MANIFEST_DATABASE_MISMATCH', 'Manifest prévu pour une autre base.');
    if (artifact.manifestHash !== parsed.manifestHash) fail('MANIFEST_HASH_MISMATCH', 'Hash fourni différent du manifest.');
    const result = await applyLegacyRentalTestDataCleanup({ db: mongoose.connection.db, manifest: artifact.manifest, manifestHash: parsed.manifestHash });
    const post = await discoverLegacyRentalTestData(mongoose.connection.db);
    print('LEGACY_LOCATAIRES_DELETED', result.locatairesDeleted);
    print('LEGACY_PROPRIETAIRES_DELETED', result.proprietairesDeleted);
    print('DEPENDENCIES_DELETED', result.dependenciesDeleted);
    print('LEGACY_REMAINING', post.counts.total);
    return { result, post };
  } finally { await mongoose.disconnect(); }
}

if (require.main === module) {
  require('dotenv').config();
  main().catch((error) => { process.stderr.write(`${error.code || error.message}\n`); process.exitCode = error.exitCode || 1; });
}

module.exports = { CleanupCliError, describeMongoTarget, parseArgs, main };
