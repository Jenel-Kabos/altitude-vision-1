// PLATFORM-ADMIN-BOOTSTRAP-1 — preuve que l'identité PlatformOperator créée
// par le script CLI (jamais directement via `grantOperator()` en mémoire de
// test comme le fait PLATFORM-ADMIN-CERT-1) est EXACTEMENT celle reconnue
// par l'autorisation runtime HTTP. Quelques domaines représentatifs
// suffisent (mission §23) — la matrice exhaustive vit déjà dans
// platformAdminCert1.domains.mongo.integration.test.js, jamais dupliquée
// ici. Ajoute un smoke test CRM Automation (mission §24 — signalé "hérité
// mais non testé" par PLATFORM-ADMIN-CERT-1, coût raisonnable de le couvrir
// ici avec une identité réellement bootstrappée).
const path = require('path');
const { spawn } = require('child_process');
const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const { startFinancialMongo, stopFinancialMongo } = require('./helpers/financialMongoEnvironment');
const { createTenantFixture } = require('./helpers/tenantAwareFixture');
const User = require('../models/User');
const PlatformOperator = require('../models/PlatformOperator');
const { safeTestEnv } = require('../test-utils/safeTestEnv');

const propertyRoutes = require('../routes/propertyRoutes');
const conversationRoutes = require('../routes/conversationRoutes');
const reportingRoutes = require('../routes/reportingRoutes');
const crmAutomationRoutes = require('../routes/crmAutomationRoutes');
const { errorHandler } = require('../middleware/errorMiddleware');

jest.setTimeout(180000);

const app = express();
app.use(express.json());
app.use('/api/properties', propertyRoutes);
app.use('/api/conversations', conversationRoutes);
app.use('/api/reporting', reportingRoutes);
app.use('/api/crm-automation', crmAutomationRoutes);
app.use(errorHandler);

const bearer = (user, tenant) => ({
  Authorization: `Bearer ${jwt.sign({ id: user._id, tokenVersion: 0 }, process.env.JWT_SECRET, { expiresIn: '1d' })}`,
  ...(tenant ? { 'X-Platform-Tenant-Id': String(tenant._id) } : {}),
});

const SCRIPT = path.resolve(__dirname, '../scripts/bootstrapPlatformOperator.js');
// Sécurité de test critique : le processus enfant doit être pointé
// EXPLICITEMENT et EXCLUSIVEMENT sur le MongoMemoryReplSet de ce test, en
// écrasant tout MONGO_URI réel hérité de server/.env — sinon le script,
// dont la garde ne fait que COMPARER --confirm-database à la base
// réellement résolue, se connecterait à la vraie base de dev/prod
// (démontré une première fois pendant l'écriture de ce test : la garde a
// bloqué l'écriture car --confirm-database ne correspondait pas, mais
// jamais se reposer sur ce filet — corriger la cause plutôt que le
// symptôme).
function runScript(args, mongoUri) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [SCRIPT, ...args], {
      env: safeTestEnv(process.env, { MONGO_URI: mongoUri }),
      cwd: path.resolve(__dirname, '..'),
    });
    let stdout = ''; let stderr = '';
    child.stdout.on('data', (d) => { stdout += d.toString(); });
    child.stderr.on('data', (d) => { stderr += d.toString(); });
    child.on('exit', (code) => resolve({ code, stdout, stderr }));
  });
}
function parseOutput(stdout) { return JSON.parse(stdout.slice(stdout.indexOf('{'))); }

let tenantA;
let tenantB;
let bootstrappedOperator;
let grantingAdmin;
let mongoUri;

beforeAll(async () => {
  const { uri } = await startFinancialMongo();
  mongoUri = uri;
  const fixtureA = await createTenantFixture({ label: 'Bootstrap Runtime A' });
  const fixtureB = await createTenantFixture({ label: 'Bootstrap Runtime B' });
  tenantA = fixtureA.tenant;
  tenantB = fixtureB.tenant;

  grantingAdmin = await User.create({
    name: 'GrantingAdmin Bootstrap', email: `granting-bootstrap-${Date.now()}@example.test`,
    password: 'Password123!', passwordConfirm: 'Password123!', role: 'Admin', isEmailVerified: true,
  });
  bootstrappedOperator = await User.create({
    name: 'Bootstrapped Operator', email: `bootstrapped-op-${Date.now()}@example.test`,
    password: 'Password123!', passwordConfirm: 'Password123!', role: 'Admin', isEmailVerified: true,
  });

  // Résout le nom de base réel de la connexion mongoose déjà établie par
  // startFinancialMongo(), exactement comme --confirm-database l'exige.
  const dbName = require('mongoose').connection.name;
  const res = await runScript([
    `--email=${bootstrappedOperator.email}`, `--grantedBy=${grantingAdmin.email}`,
    '--reason=Preuve de reconnaissance runtime PLATFORM-ADMIN-BOOTSTRAP-1',
    '--capabilities=platform.properties.read,platform.reporting.read,platform.crm.read',
    `--confirm-database=${dbName}`, '--apply',
  ], mongoUri);
  if (res.code !== 0) throw new Error(`Bootstrap script failed in test setup: ${res.stderr}`);
  const output = parseOutput(res.stdout);
  if (output.result?.status !== 'active') throw new Error(`Unexpected bootstrap result: ${res.stdout}`);
});

afterAll(async () => stopFinancialMongo());

test('l\'opérateur bootstrappé par le script CLI existe réellement en base avec le bon acteur', async () => {
  const doc = await PlatformOperator.findOne({ user: bootstrappedOperator._id }).lean();
  expect(doc.status).toBe('active');
  expect(String(doc.grantedBy)).toBe(String(grantingAdmin._id));
  expect(doc.capabilities.sort()).toEqual(['platform.crm.read', 'platform.properties.read', 'platform.reporting.read']);
});

describe('Reconnaissance runtime — Property Portfolio', () => {
  test('opérateur bootstrappé, Tenant A sélectionné → 200', async () => {
    const res = await request(app).get('/api/properties/portfolio').set(bearer(bootstrappedOperator, tenantA));
    expect(res.status).toBe(200);
  });
  test('opérateur bootstrappé, Tenant B sélectionné → 200', async () => {
    const res = await request(app).get('/api/properties/portfolio').set(bearer(bootstrappedOperator, tenantB));
    expect(res.status).toBe(200);
  });
  test('opérateur bootstrappé, sans tenant sélectionné → signal distinct, jamais un accès global implicite', async () => {
    const res = await request(app).get('/api/properties/portfolio').set(bearer(bootstrappedOperator));
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('PLATFORM_OPERATOR_TENANT_SELECTION_REQUIRED');
  });
});

describe('Reconnaissance runtime — Conversations', () => {
  test('opérateur bootstrappé, Tenant B sélectionné → 200', async () => {
    const res = await request(app).get('/api/conversations/count/unread').set(bearer(bootstrappedOperator, tenantB));
    expect(res.status).toBe(200);
  });
});

describe('Reconnaissance runtime — Reporting (mode plateforme natif)', () => {
  test('opérateur bootstrappé, sans tenant sélectionné → rapport consolidé accessible', async () => {
    const res = await request(app).get('/api/reporting/executive').set(bearer(bootstrappedOperator));
    expect(res.status).toBe(200);
  });
});

describe('Reconnaissance runtime — CRM Automation (mission §24, hérité mais non testé par PLATFORM-ADMIN-CERT-1)', () => {
  test('opérateur bootstrappé, Tenant A sélectionné → liste les règles sans erreur', async () => {
    const res = await request(app).get('/api/crm-automation/rules').set(bearer(bootstrappedOperator, tenantA));
    expect(res.status).toBe(200);
  });
  test('opérateur bootstrappé, sans tenant sélectionné → refusé (pas de mode plateforme fabriqué)', async () => {
    const res = await request(app).get('/api/crm-automation/rules').set(bearer(bootstrappedOperator));
    expect(res.status).toBe(403);
  });
});
