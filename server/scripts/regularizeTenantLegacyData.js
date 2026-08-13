#!/usr/bin/env node
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const connectDB = require('../config/db');
const { buildManifest, applyManifest } = require('../services/platformTenant/tenantDataRegularizationService');

const args = process.argv.slice(2);
const value = (name) => args.find((arg) => arg.startsWith(`${name}=`))?.slice(name.length + 1);
const has = (name) => args.includes(name);
const refused = ['--force-all', '--include-ambiguous', '--include-orphans', '--first-tenant', '--fallback-tenant', '--force', '--write', '--backfill'];

async function main() {
  const bad = refused.filter((flag) => has(flag) || value(flag));
  if (bad.length) throw new Error(`REGULARIZATION_BYPASS_REFUSED: ${bad.join(', ')}`);
  const dryRun = has('--dry-run'); const apply = has('--apply');
  if (dryRun === apply) throw new Error('Choisir exactement un mode : --dry-run ou --apply.');
  const database = value('--database'); const tenantId = value('--tenant'); const actorId = value('--actor'); const batchId = value('--batch');
  if (!database || !tenantId || !actorId || !batchId) throw new Error('--database, --tenant, --actor et --batch sont obligatoires.');
  await connectDB();
  if (mongoose.connection.name !== database) throw new Error('DATABASE_MISMATCH');

  if (dryRun) {
    const auditPath = value('--audit'); const output = value('--output');
    if (!auditPath || !output) throw new Error('--audit et --output sont obligatoires en dry-run.');
    const audit = JSON.parse(fs.readFileSync(path.resolve(auditPath), 'utf8'));
    if (audit.report?.writes !== 0 || audit.report?.database !== database) throw new Error('AUDIT_SNAPSHOT_INVALID');
    const manifest = await buildManifest({ audit, tenantId, actorId, database, batchId });
    fs.mkdirSync(path.dirname(path.resolve(output)), { recursive: true });
    fs.writeFileSync(path.resolve(output), `${JSON.stringify(manifest, null, 2)}\n`, { flag: 'wx' });
    process.stdout.write(`${JSON.stringify({ mode: 'dry-run', writes: 0, database, tenantId, actorId, batchId, manifestHash: manifest.manifestHash, ready: manifest.entries.length }, null, 2)}\n`);
    return;
  }

  const manifestPath = value('--manifest');
  if (!manifestPath || value('--confirm-database') !== database || value('--confirm-tenant') !== tenantId || value('--confirm-batch') !== batchId) {
    throw new Error('APPLY_CONFIRMATIONS_MISSING');
  }
  if (database !== 'altitudevision') throw new Error('APPLY_DATABASE_REFUSED');
  const manifest = JSON.parse(fs.readFileSync(path.resolve(manifestPath), 'utf8'));
  if (manifest.database !== database || manifest.tenantId !== tenantId || manifest.actorId !== actorId || manifest.batchId !== batchId) throw new Error('APPLY_MANIFEST_ARGUMENT_MISMATCH');
  const results = await applyManifest(manifest);
  process.stdout.write(`${JSON.stringify({ mode: 'apply', batchId, results }, null, 2)}\n`);
}

if (require.main === module) main().catch((error) => { process.stderr.write(`${error.code || error.message}\n`); process.exitCode = 1; }).finally(() => mongoose.disconnect());
