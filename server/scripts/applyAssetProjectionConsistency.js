#!/usr/bin/env node
require('dotenv').config();
const mongoose = require('mongoose');
const {
  REASON,
  regularizeAssetProjectionBatch,
} = require('../services/platformTenant/assetProjectionConsistencyApplyService');

const C2_8M_BATCH = Object.freeze({
  expectedOwnerId: '6a84080352c6ffabafb26af7',
  targetTenantId: '6a9ba40f6e102ba5f9b1a4c6',
  propertyIds: Object.freeze([
    '6a8be8be306fabec9cad0506',
    '6a89f9bcbbb632e80e727ec4',
  ]),
  reason: REASON,
});

class AssetProjectionCliError extends Error {
  constructor(code, message) { super(message); this.name = 'AssetProjectionCliError'; this.code = code; this.exitCode = 2; }
}
const fail = (code, message) => { throw new AssetProjectionCliError(code, message); };
const valueOf = (args, name) => args.find((arg) => arg.startsWith(`${name}=`))?.slice(name.length + 1);
const valuesOf = (args, name) => args.filter((arg) => arg.startsWith(`${name}=`)).map((arg) => arg.slice(name.length + 1));

function describeMongoTarget(uri) {
  if (!uri) fail('MONGO_URI_REQUIRED', 'MONGO_URI est requis.');
  let parsed;
  try { parsed = new URL(uri); } catch { fail('MONGO_URI_INVALID', 'MONGO_URI invalide.'); }
  return {
    host: parsed.hostname,
    database: decodeURIComponent(parsed.pathname.replace(/^\//, '')),
  };
}

function exactSet(actual, expected) {
  return actual.length === expected.length
    && new Set(actual).size === actual.length
    && expected.every((value) => actual.includes(value));
}

function parseAndValidateArgs(args, env = process.env) {
  const knownValuePrefixes = [
    '--confirm-database=', '--confirm-target-tenant=', '--confirm-owner=',
    '--actor=', '--operation=', '--property=',
  ];
  const knownFlags = new Set(['--apply', '--preview', '--confirm-production']);
  const unknown = args.filter((arg) => !knownFlags.has(arg) && !knownValuePrefixes.some((prefix) => arg.startsWith(prefix)));
  if (unknown.length) fail('UNKNOWN_OPTION', `Option refusée : ${unknown.join(', ')}`);
  if (args.includes('--apply') && args.includes('--preview')) fail('MODE_CONFLICT', '--apply et --preview sont incompatibles.');
  const mode = args.includes('--apply') ? 'apply' : 'preview';
  const target = describeMongoTarget(env.MONGO_URI);
  const confirmDatabase = valueOf(args, '--confirm-database');
  if (confirmDatabase !== target.database) fail('DATABASE_CONFIRMATION_MISMATCH', 'La confirmation database ne correspond pas à MONGO_URI.');
  if (valueOf(args, '--confirm-target-tenant') !== C2_8M_BATCH.targetTenantId) {
    fail('TARGET_TENANT_CONFIRMATION_MISMATCH', 'Le tenant cible confirmé ne correspond pas au batch C2.8M.');
  }
  if (valueOf(args, '--confirm-owner') !== C2_8M_BATCH.expectedOwnerId) {
    fail('OWNER_CONFIRMATION_MISMATCH', 'Le propriétaire confirmé ne correspond pas au batch C2.8M.');
  }
  const properties = valuesOf(args, '--property');
  if (!exactSet(properties, C2_8M_BATCH.propertyIds)) fail('PROPERTY_ALLOWLIST_MISMATCH', 'L’allowlist doit contenir exactement les deux Property C2.8M.');
  const actorId = valueOf(args, '--actor');
  if (!actorId) fail('ACTOR_REQUIRED', '--actor=<User ObjectId> est requis.');
  const operationId = valueOf(args, '--operation');
  if (!operationId) fail('OPERATION_REQUIRED', '--operation=<identifiant unique> est requis.');
  if (mode === 'apply') {
    if (!args.includes('--confirm-production')) fail('PRODUCTION_CONFIRMATION_REQUIRED', '--confirm-production est requis.');
    if (env.ALLOW_C2_8M_ASSET_REGULARIZATION_APPLY !== 'true') {
      fail('PRODUCTION_ENV_GUARD_REQUIRED', 'ALLOW_C2_8M_ASSET_REGULARIZATION_APPLY=true est requis.');
    }
  }
  return { mode, actorId, operationId, confirmDatabase, target };
}

async function main(args = process.argv.slice(2), env = process.env) {
  const parsed = parseAndValidateArgs(args, env);
  process.stdout.write(`${JSON.stringify({ event: 'C2_8M_TARGET', ...parsed.target })}\n`);
  let connected = false;
  try {
    await mongoose.connect(env.MONGO_URI, {
      autoIndex: false,
      autoCreate: false,
      maxPoolSize: 5,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });
    connected = true;
    if (mongoose.connection.name !== parsed.confirmDatabase) {
      fail('CONNECTED_DATABASE_MISMATCH', 'La base résolue après connexion ne correspond pas à la confirmation.');
    }
    const result = await regularizeAssetProjectionBatch({
      mode: parsed.mode,
      targetTenantId: C2_8M_BATCH.targetTenantId,
      expectedOwnerId: C2_8M_BATCH.expectedOwnerId,
      propertyIds: [...C2_8M_BATCH.propertyIds],
      actorId: parsed.actorId,
      reason: C2_8M_BATCH.reason,
      operationId: parsed.operationId,
    });
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    return result;
  } finally {
    if (connected) await mongoose.disconnect();
  }
}

if (require.main === module) main().catch((error) => {
  process.stderr.write(`${error.code || error.message}\n`);
  process.exitCode = error.exitCode || 1;
});

module.exports = {
  C2_8M_BATCH,
  AssetProjectionCliError,
  describeMongoTarget,
  parseAndValidateArgs,
  main,
};
