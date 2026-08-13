#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { execFileSync } = require('child_process');
const mongoose = require('mongoose');
const { buildManifest, DATABASE } = require('./auditDataReset');

const CONFIRMED_RESET_ID = 'data-reset-1-20260813';
const CONFIRMED_HASH = 'e675ec0df7301effde02ddf71a4fc5768976c5cdb0344247bd5283439d0012b1';
const CONFIRMED_COLLECTIONS = 104;
const CONFIRMED_DOCUMENTS = 718;
const args = Object.fromEntries(process.argv.slice(2).filter((x) => x.startsWith('--')).map((x) => { const [k, ...v] = x.slice(2).split('='); return [k, v.length ? v.join('=') : true]; }));

function requireConfirmation(name, expected) {
  if (args[name] !== expected) throw new Error(`CONFIRMATION_MISMATCH --${name}`);
}

async function readSecret(prompt) {
  if (!process.stdin.isTTY) throw new Error('INTERACTIVE_TTY_REQUIRED');
  process.stdout.write(prompt);
  let echoDisabled = false;
  try { execFileSync('stty', ['-echo'], { stdio: ['inherit', 'ignore', 'ignore'] }); echoDisabled = true; } catch { throw new Error('TERMINAL_ECHO_DISABLE_FAILED'); }
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
  try {
    return await new Promise((resolve) => rl.question('', resolve));
  } finally {
    rl.close();
    if (echoDisabled) execFileSync('stty', ['echo'], { stdio: ['inherit', 'ignore', 'ignore'] });
    process.stdout.write('\n');
  }
}

function loadModels() {
  const dir = path.join(__dirname, '..', 'models');
  fs.readdirSync(dir).filter((name) => name.endsWith('.js')).sort().forEach((name) => {
    try { require(path.join(dir, name)); } catch (error) { throw new Error(`MODEL_LOAD_FAILED ${name}: ${error.message}`); }
  });
}

async function recreateIndexes() {
  const byCollection = new Map();
  Object.values(mongoose.models).forEach((model) => { if (!byCollection.has(model.collection.name)) byCollection.set(model.collection.name, model); });
  const results = [];
  for (const model of [...byCollection.values()].sort((a, b) => a.collection.name.localeCompare(b.collection.name))) {
    await model.createCollection();
    await model.syncIndexes();
    results.push({ collection: model.collection.name, indexes: (await model.collection.indexes()).map((index) => index.name) });
  }
  return results;
}

async function main() {
  require('dotenv').config();
  requireConfirmation('confirm-database', DATABASE);
  requireConfirmation('confirm-reset-id', CONFIRMED_RESET_ID);
  requireConfirmation('confirm-manifest-hash', CONFIRMED_HASH);
  requireConfirmation('confirm-collections', String(CONFIRMED_COLLECTIONS));
  requireConfirmation('confirm-documents', String(CONFIRMED_DOCUMENTS));
  if (args.apply !== true) throw new Error('APPLY_FLAG_REQUIRED');
  const adminName = String(args['admin-name'] || '').trim();
  const adminEmail = String(args['admin-email'] || '').trim().toLowerCase();
  if (!adminName || !adminEmail) throw new Error('ADMIN_IDENTITY_REQUIRED');
  const password = await readSecret('Nouveau mot de passe Admin (saisie masquée) : ');
  if (password.length < 8) throw new Error('ADMIN_PASSWORD_TOO_SHORT');

  await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 15000, autoIndex: false, autoCreate: false });
  let destructiveStarted = false;
  try {
    const preflight = await buildManifest(mongoose.connection.db);
    const documents = preflight.collections.reduce((sum, row) => sum + row.countBefore, 0);
    if (preflight.database !== DATABASE || preflight.resetId !== CONFIRMED_RESET_ID || preflight.fingerprint !== CONFIRMED_HASH || preflight.collections.length !== CONFIRMED_COLLECTIONS || documents !== CONFIRMED_DOCUMENTS) {
      throw new Error(`PREFLIGHT_DIVERGED database=${preflight.database} resetId=${preflight.resetId} hash=${preflight.fingerprint} collections=${preflight.collections.length} documents=${documents}`);
    }
    process.stdout.write('PREFLIGHT_MATCHED — démarrage du reset confirmé.\n');
    await mongoose.connection.db.dropDatabase();
    destructiveStarted = true;
    loadModels();
    const indexes = await recreateIndexes();

    const User = require('../models/User');
    const PlatformTenant = require('../models/PlatformTenant');
    const OrgUnit = require('../models/OrgUnit');
    const OrgMembership = require('../models/OrgMembership');
    const PlatformOperator = require('../models/PlatformOperator');
    const CrmCustomer = require('../models/CrmCustomer');
    const platformTenantService = require('../services/platformTenant/platformTenantService');
    const organizationService = require('../services/organizationService');
    const { grantOperator } = require('../services/platformOperator/platformOperatorService');
    const { PLATFORM_OPERATOR_CAPABILITIES } = require('../constants/platformOperatorConstants');

    const admin = await User.create({ name: adminName, email: adminEmail, password, passwordConfirm: password, role: 'Admin', isEmailVerified: true });
    const tenant = await platformTenantService.createTenant({ name: 'Altitude Vision', actor: admin, req: null });
    await organizationService.grantMembership({ userId: admin._id, orgUnitId: tenant.rootOrgUnit, roleInUnit: 'owner', actor: admin, metadata: { reason: 'DATA-RESET-1 bootstrap' }, req: null });
    await grantOperator({ userId: admin._id, capabilities: PLATFORM_OPERATOR_CAPABILITIES, actor: admin, reason: 'DATA-RESET-1 bootstrap', req: null, allowSelfGrant: true });

    const crmIndex = (await CrmCustomer.collection.indexes()).find((index) => index.name === 'one_crm_customer_per_tenant_source');
    const counts = {
      User: await User.countDocuments(), PlatformTenant: await PlatformTenant.countDocuments(), OrgUnit: await OrgUnit.countDocuments(),
      OrgMembership: await OrgMembership.countDocuments(), PlatformOperator: await PlatformOperator.countDocuments(), CrmCustomer: await CrmCustomer.countDocuments(),
    };
    if (JSON.stringify(counts) !== JSON.stringify({ User: 1, PlatformTenant: 1, OrgUnit: 1, OrgMembership: 1, PlatformOperator: 1, CrmCustomer: 0 })) throw new Error(`POST_RESET_COUNTS_INVALID ${JSON.stringify(counts)}`);
    if (!crmIndex?.partialFilterExpression) throw new Error('CRM_PARTIAL_INDEX_MISSING');
    const report = { resetId: CONFIRMED_RESET_ID, database: DATABASE, manifestHash: CONFIRMED_HASH, completedAt: new Date().toISOString(), admin: { id: String(admin._id), emailMasked: `${adminEmail.slice(0, 2)}***@${adminEmail.split('@')[1]}` }, tenant: { id: String(tenant._id), rootOrgUnit: String(tenant.rootOrgUnit) }, counts, crmIndex: { name: crmIndex.name, key: crmIndex.key, unique: crmIndex.unique, partialFilterExpression: crmIndex.partialFilterExpression }, recreatedCollectionCount: indexes.length, cloudinary: 'NO_CHANGE', result: 'RESET_AND_BOOTSTRAP_COMPLETE' };
    fs.writeFileSync(path.join(__dirname, '..', 'reports', 'data-reset-1-apply-report.json'), `${JSON.stringify(report, null, 2)}\n`, { flag: 'wx' });
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  } catch (error) {
    if (destructiveStarted) process.stderr.write('RESET_DONE_OR_PARTIAL — BOOTSTRAP RECOVERY REQUIRED\n');
    throw error;
  } finally { await mongoose.disconnect(); }
}

main().catch(async (error) => { process.stderr.write(`${error.message}\n`); try { await mongoose.disconnect(); } catch {} process.exitCode = 1; });
