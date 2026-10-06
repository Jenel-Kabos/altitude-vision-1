#!/usr/bin/env node
require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('../config/db');
const {
  discoverAssetProjectionConsistency,
} = require('../services/platformTenant/assetProjectionConsistencyDiscoveryService');

// C2.8M — tout drapeau évoquant une mutation est refusé AVANT la connexion.
const WRITE_FLAGS = [
  '--apply', '--write', '--force', '--backfill', '--migrate', '--repair',
  '--commit', '--execute', '--live', '--fix', '--update', '--delete', '--mutate',
];
const valueOf = (args, name) => args.find((arg) => arg.startsWith(`${name}=`))?.slice(name.length + 1);

function parseAndValidateArgs(args) {
  const refused = WRITE_FLAGS.filter((flag) => args.some((arg) => arg === flag || arg.startsWith(`${flag}=`)));
  if (refused.length) throw Object.assign(
    new Error(`ASSET_PROJECTION_DISCOVERY_WRITE_FLAG_REFUSED: ${refused.join(', ')}`),
    { exitCode: 2 },
  );
  const ownerId = valueOf(args, '--owner-id');
  if (!ownerId) throw Object.assign(new Error('ASSET_PROJECTION_DISCOVERY_OWNER_REQUIRED'), { exitCode: 2 });
  const targetTenantId = valueOf(args, '--target-tenant-id');
  if (!targetTenantId) throw Object.assign(new Error('ASSET_PROJECTION_DISCOVERY_TARGET_TENANT_REQUIRED'), { exitCode: 2 });
  const confirmDatabase = valueOf(args, '--confirm-database');
  if (!confirmDatabase) throw Object.assign(new Error('ASSET_PROJECTION_DISCOVERY_DATABASE_NOT_CONFIRMED'), { exitCode: 2 });
  return { ownerId, targetTenantId, confirmDatabase };
}

async function main(args = process.argv.slice(2)) {
  const options = parseAndValidateArgs(args);
  // C2.8M — aucune écriture implicite : sans ces options, Mongoose crée les
  // index et collections des modèles chargés dès l'ouverture de la connexion.
  mongoose.set('autoIndex', false);
  mongoose.set('autoCreate', false);
  await connectDB();
  if (mongoose.connection.name !== options.confirmDatabase) {
    throw Object.assign(new Error('ASSET_PROJECTION_DISCOVERY_DATABASE_MISMATCH'), { exitCode: 2 });
  }
  const report = await discoverAssetProjectionConsistency(options);
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
}

if (require.main === module) main().catch((error) => {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = error.exitCode || 1;
}).finally(() => mongoose.disconnect());

module.exports = { main, parseAndValidateArgs };
