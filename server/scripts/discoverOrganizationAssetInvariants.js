#!/usr/bin/env node
require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('../config/db');
const { discoverOrganizationAssetInvariants } = require('../services/platformTenant/organizationAssetDiscoveryService');

const args = process.argv.slice(2);
const refused = ['--apply', '--write', '--force', '--backfill'].filter((flag) => args.some((arg) => arg === flag || arg.startsWith(`${flag}=`)));
const valueOf = (name) => args.find((arg) => arg.startsWith(`${name}=`))?.slice(name.length + 1);

async function main() {
  if (refused.length) throw Object.assign(new Error(`ORGANIZATION_ASSET_DISCOVERY_WRITE_FLAG_REFUSED: ${refused.join(', ')}`), { exitCode: 2 });
  const confirmed = valueOf('--confirm-database');
  if (!confirmed) throw Object.assign(new Error('ORGANIZATION_ASSET_DISCOVERY_DATABASE_NOT_CONFIRMED'), { exitCode: 2 });
  await connectDB();
  if (mongoose.connection.name !== confirmed) throw Object.assign(new Error('ORGANIZATION_ASSET_DISCOVERY_DATABASE_MISMATCH'), { exitCode: 2 });
  const report = await discoverOrganizationAssetInvariants({ batchSize: Math.max(1, Number(valueOf('--batch-size') || 500)) });
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
}

if (require.main === module) main().catch((error) => { process.stderr.write(`${error.message}\n`); process.exitCode = error.exitCode || 1; }).finally(() => mongoose.disconnect());
module.exports = { main };
