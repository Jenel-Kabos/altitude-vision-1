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
const Property = require('../models/Property');
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
  // withAdminMembership : le fondateur (propriétaire des biens ci-dessous) est
  // membre de son tenant, condition du scope portfolio (tenant + owner) ;
  // l'opérateur bootstrappé, lui, n'obtient jamais de membership.
  const fixtureA = await createTenantFixture({ label: 'Bootstrap Runtime A', withAdminMembership: true });
  const fixtureB = await createTenantFixture({ label: 'Bootstrap Runtime B', withAdminMembership: true });
  tenantA = fixtureA.tenant;
  tenantB = fixtureB.tenant;

  // Un bien par tenant : rend observable le bornage PATH B du portfolio.
  const propertyData = (title, owner, tenant) => ({
    title, description: 'Description suffisamment longue pour le registre global Altimmo.',
    pole: 'Altimmo', type: 'Villa', status: 'vente', statusAdmin: 'Validée', isPublished: true,
    availability: 'Disponible', price: 100000, owner, tenant,
    address: { city: 'Brazzaville', arrondissement: 'Centre' },
    latitude: -4.26, longitude: 15.24, images: ['https://example.test/property.jpg'], surface: 80,
  });
  await Property.create([
    propertyData('Bootstrap Bien Tenant A', fixtureA.bootstrap._id, tenantA._id),
    propertyData('Bootstrap Bien Tenant B', fixtureB.bootstrap._id, tenantB._id),
  ]);

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

describe('Reconnaissance runtime — Property Portfolio (Pattern 1 / Option 3)', () => {
  // ARCH-AUTH-03 Pattern 1 (INVARIANTS §12) — `/api/properties/portfolio`
  // compose PATH A (OrgMembership) OU PATH B (PlatformOperator actif +
  // platform.properties.read + tenant explicitement sélectionné). L'identité
  // bootstrappée par le CLI doit être reconnue par le PATH B, sans
  // OrgMembership synthétisée, et strictement bornée au tenant sélectionné.
  const titles = (res) => {
    const items = res.body.data?.items;
    expect(Array.isArray(items)).toBe(true);
    return items.map((p) => p.title);
  };
  test('opérateur bootstrappé, Tenant A sélectionné → PATH B, portfolio strictement Tenant A', async () => {
    const res = await request(app).get('/api/properties/portfolio').set(bearer(bootstrappedOperator, tenantA));
    expect(res.status).toBe(200);
    expect(titles(res)).toContain('Bootstrap Bien Tenant A');
    expect(titles(res)).not.toContain('Bootstrap Bien Tenant B');
  });
  test('opérateur bootstrappé, Tenant B sélectionné → PATH B, portfolio strictement Tenant B', async () => {
    const res = await request(app).get('/api/properties/portfolio').set(bearer(bootstrappedOperator, tenantB));
    expect(res.status).toBe(200);
    expect(titles(res)).toContain('Bootstrap Bien Tenant B');
    expect(titles(res)).not.toContain('Bootstrap Bien Tenant A');
  });
  test('aucune OrgMembership n\'a été synthétisée pour l\'opérateur bootstrappé', async () => {
    const OrgMembership = require('../models/OrgMembership');
    expect(await OrgMembership.countDocuments({ user: bootstrappedOperator._id })).toBe(0);
  });
  test('opérateur bootstrappé, sans tenant sélectionné → refusé (registre plateforme non fabriqué ici)', async () => {
    const res = await request(app).get('/api/properties/portfolio').set(bearer(bootstrappedOperator));
    expect(res.status).toBe(403);
  });
});

describe('Reconnaissance runtime — Conversations', () => {
  test('opérateur bootstrappé, Tenant B sélectionné → 200', async () => {
    const res = await request(app).get('/api/conversations/count/unread').set(bearer(bootstrappedOperator, tenantB));
    expect(res.status).toBe(200);
  });
});

describe('Reconnaissance runtime — Reporting (mode plateforme natif)', () => {
  // PLATFORM-ADMIN-04A — l'opérateur bootstrappé (3 capabilities) est reconnu
  // comme opérateur mais n'est pas éligible à la Vue plateforme : jamais de
  // rapport consolidé global ; la sélection d'un tenant reste son chemin.
  test('opérateur bootstrappé partiel, sans tenant sélectionné → Vue plateforme refusée (PLATFORM_VIEW_NOT_ELIGIBLE)', async () => {
    const res = await request(app).get('/api/reporting/executive').set(bearer(bootstrappedOperator));
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('PLATFORM_VIEW_NOT_ELIGIBLE');
  });
});

describe('Reconnaissance runtime — CRM Automation (mission §24, hérité mais non testé par PLATFORM-ADMIN-CERT-1)', () => {
  // ARCH-AUTH-03 Pattern 1 — CRM Automation : lecture via platform.crm.read
  // (PATH B, tenant sélectionné) ; mutations réservées à platform.crm.manage.
  test('opérateur bootstrappé platform.crm.read, Tenant A sélectionné → lecture PATH B bornée au Tenant A', async () => {
    const res = await request(app).get('/api/crm-automation/rules').set(bearer(bootstrappedOperator, tenantA));
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data?.rules)).toBe(true);
    for (const rule of res.body.data.rules) expect(String(rule.tenant)).toBe(String(tenantA._id));
  });
  test('opérateur bootstrappé platform.crm.read seul → mutation CRM Automation refusée (read ≠ manage)', async () => {
    const res = await request(app).post('/api/crm-automation/rules').set(bearer(bootstrappedOperator, tenantA)).send({});
    expect(res.status).toBe(403);
  });
  test('opérateur bootstrappé, sans tenant sélectionné → refusé (pas de mode plateforme fabriqué)', async () => {
    const res = await request(app).get('/api/crm-automation/rules').set(bearer(bootstrappedOperator));
    expect(res.status).toBe(403);
  });
});
