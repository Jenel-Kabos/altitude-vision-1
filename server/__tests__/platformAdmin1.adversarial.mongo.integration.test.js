// PLATFORM-ADMIN-1 — matrice adversariale + positive + régression.
// Convention identique à tenantCert3Final.adversarial.mongo.integration.test.js
// (mêmes helpers, même patron de montage Express minimal par routeur testé).
const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const { startFinancialMongo, stopFinancialMongo } = require('./helpers/financialMongoEnvironment');
const { createTenantFixture, createTenantUser } = require('./helpers/tenantAwareFixture');
const User = require('../models/User');
const PlatformOperator = require('../models/PlatformOperator');
const Message = require('../models/Message');
const platformTenantRoutes = require('../routes/platformTenantRoutes');
const platformOperatorRoutes = require('../routes/platformOperatorRoutes');
const propertyRoutes = require('../routes/propertyRoutes');
const conversationRoutes = require('../routes/conversationRoutes');
const reportingRoutes = require('../routes/reportingRoutes');
const { errorHandler } = require('../middleware/errorMiddleware');
const { grantOperator } = require('../services/platformOperator/platformOperatorService');

jest.setTimeout(180000);

const app = express();
app.use(express.json());
app.use('/api/platform-tenants', platformTenantRoutes);
app.use('/api/platform-operators', platformOperatorRoutes);
app.use('/api/properties', propertyRoutes);
app.use('/api/conversations', conversationRoutes);
app.use('/api/reporting', reportingRoutes);
app.use(errorHandler);

const bearer = (user, tenant) => ({
  Authorization: `Bearer ${jwt.sign({ id: user._id, tokenVersion: 0 }, process.env.JWT_SECRET, { expiresIn: '1d' })}`,
  ...(tenant ? { 'X-Platform-Tenant-Id': String(tenant._id) } : {}),
});

let tenantA;
let tenantB;
let adminA;
let adminB;
let staffA;
let operatorUser;
let grantingAdmin;
let suspendedOperatorUser;
let revokedOperatorUser;
let plainAdminNoTenant;
let ordinaryClient;
let proprietor;

beforeAll(async () => {
  await startFinancialMongo();
  const fixtureA = await createTenantFixture({ label: 'PlatformAdmin1 A' });
  const fixtureB = await createTenantFixture({ label: 'PlatformAdmin1 B' });
  tenantA = fixtureA.tenant;
  tenantB = fixtureB.tenant;
  adminA = (await createTenantUser({ tenant: tenantA, bootstrap: fixtureA.bootstrap, overrides: { role: 'Admin' } })).user;
  adminB = (await createTenantUser({ tenant: tenantB, bootstrap: fixtureB.bootstrap, overrides: { role: 'Admin' } })).user;
  staffA = (await createTenantUser({ tenant: tenantA, bootstrap: fixtureA.bootstrap, overrides: { role: 'Collaborateur' } })).user;

  // Un compte Admin sans AUCUNE OrgMembership et sans preuve legacy — exactement
  // le profil qui produisait les 403 rapportés, ET le profil "Admin sans
  // tenant" que la mission exige de garder bloqué s'il n'est PAS opérateur.
  const mkStandaloneAdmin = async (label) => User.create({
    name: label, email: `${label.toLowerCase()}-${Date.now()}@example.test`,
    password: 'Password123!', passwordConfirm: 'Password123!', role: 'Admin', isEmailVerified: true,
  });
  grantingAdmin = await mkStandaloneAdmin('GrantingAdmin');
  operatorUser = await mkStandaloneAdmin('OperatorUser');
  suspendedOperatorUser = await mkStandaloneAdmin('SuspendedOperator');
  revokedOperatorUser = await mkStandaloneAdmin('RevokedOperator');
  plainAdminNoTenant = await mkStandaloneAdmin('PlainAdminNoTenant');
  ordinaryClient = await User.create({ name: 'Ordinary Client', email: `ordinary-${Date.now()}@example.test`, password: 'Password123!', passwordConfirm: 'Password123!', role: 'Client', isEmailVerified: true });
  proprietor = await User.create({ name: 'Isolated Owner', email: `owner-${Date.now()}@example.test`, password: 'Password123!', passwordConfirm: 'Password123!', role: 'Proprietaire', isEmailVerified: true });

  await grantOperator({
    userId: operatorUser._id, actor: grantingAdmin, reason: 'Test PLATFORM-ADMIN-1',
    capabilities: ['platform.tenants.read', 'platform.tenants.manage', 'platform.properties.read', 'platform.reporting.read', 'platform.operators.manage'],
  });
  await grantOperator({ userId: suspendedOperatorUser._id, actor: grantingAdmin, reason: 'Test', capabilities: ['platform.tenants.read'] });
  await PlatformOperator.updateOne({ user: suspendedOperatorUser._id }, { status: 'suspended', suspendedBy: grantingAdmin._id, suspendedAt: new Date(), suspensionReason: 'Test' });
  await grantOperator({ userId: revokedOperatorUser._id, actor: grantingAdmin, reason: 'Test', capabilities: ['platform.tenants.read'] });
  await PlatformOperator.updateOne({ user: revokedOperatorUser._id }, { status: 'revoked', revokedBy: grantingAdmin._id, revokedAt: new Date(), revokeReason: 'Test' });
});

afterAll(async () => stopFinancialMongo());

describe('RCA — les 403 rapportés sont résolus pour un opérateur, inchangés sinon', () => {
  test('opérateur SANS tenant sélectionné → 403 avec signal distinct (pas le message générique historique)', async () => {
    const res = await request(app).get('/api/properties/portfolio').set(bearer(operatorUser));
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('PLATFORM_OPERATOR_TENANT_SELECTION_REQUIRED');
    expect(res.body.message).not.toMatch(/aucun tenant SaaS actif résolu/);
  });

  test('opérateur AVEC tenant A sélectionné → Property Portfolio 200', async () => {
    const res = await request(app).get('/api/properties/portfolio').set(bearer(operatorUser, tenantA));
    expect(res.status).toBe(200);
  });

  test('opérateur AVEC tenant B sélectionné → Property Portfolio 200 (les DEUX tenants, mission §38)', async () => {
    const res = await request(app).get('/api/properties/portfolio').set(bearer(operatorUser, tenantB));
    expect(res.status).toBe(200);
  });

  test('opérateur SANS tenant sélectionné → Conversations unread 403 signal distinct', async () => {
    const res = await request(app).get('/api/conversations/count/unread').set(bearer(operatorUser));
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('PLATFORM_OPERATOR_TENANT_SELECTION_REQUIRED');
  });

  test('opérateur AVEC tenant A sélectionné → Conversations unread 200', async () => {
    await Message.create([
      { tenant: tenantA._id, sender: adminA._id, receiver: operatorUser._id, content: 'Tenant A', isRead: false },
      { tenant: tenantB._id, sender: adminB._id, receiver: operatorUser._id, content: 'Tenant B', isRead: false },
    ]);
    const res = await request(app).get('/api/conversations/count/unread').set(bearer(operatorUser, tenantA));
    expect(res.status).toBe(200);
    expect(res.body.data.unreadCount).toBe(1);
  });

  test('staff mono-tenant A ne compte jamais le message du tenant B', async () => {
    await Message.create([
      { tenant: tenantA._id, sender: adminA._id, receiver: staffA._id, content: 'A', isRead: false },
      { tenant: tenantB._id, sender: adminB._id, receiver: staffA._id, content: 'B', isRead: false },
    ]);
    const res = await request(app).get('/api/conversations/count/unread').set(bearer(staffA));
    expect(res.status).toBe(200); expect(res.body.data.unreadCount).toBe(1);
  });

  test('client ordinaire sans tenant compte son message personnel unattributed', async () => {
    await Message.create({ tenant: null, sender: adminA._id, receiver: ordinaryClient._id, content: 'Personnel', isRead: false });
    const res = await request(app).get('/api/conversations/count/unread').set(bearer(ordinaryClient));
    expect(res.status).toBe(200); expect(res.body.data.unreadCount).toBe(1);
  });

  test('Proprietaire sans tenant reste borné à son identité et ne gagne aucun count', async () => {
    await Message.create({ tenant: null, sender: adminA._id, receiver: ordinaryClient._id, content: 'Autre personne', isRead: false });
    const res = await request(app).get('/api/conversations/count/unread').set(bearer(proprietor));
    expect(res.status).toBe(200); expect(res.body.data.unreadCount).toBe(0);
  });

  test('Admin SANS tenant et SANS capacité opérateur → 403 message historique inchangé (mission §41)', async () => {
    const res = await request(app).get('/api/properties/portfolio').set(bearer(plainAdminNoTenant));
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('TENANT_CONTEXT_REQUIRED');
    expect(res.body.message).toMatch(/aucun tenant SaaS actif résolu/);
  });
});

describe('Tenant Admin — isolation stricte inchangée (mission §37)', () => {
  test('AdminA → Property Portfolio de son propre tenant : 200', async () => {
    const res = await request(app).get('/api/properties/portfolio').set(bearer(adminA));
    expect(res.status).toBe(200);
  });

  test('AdminA → tente Tenant B via en-tête explicite : refusé (pas opérateur)', async () => {
    const res = await request(app).get('/api/properties/portfolio').set(bearer(adminA, tenantB));
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('TENANT_CONTEXT_REQUIRED');
  });

  test('AdminA → GET /api/platform-tenants (liste globale) : 403 inchangé', async () => {
    const res = await request(app).get('/api/platform-tenants').set(bearer(adminA));
    expect(res.status).toBe(403);
  });

  test('AdminA → GET overview Tenant B : 403 inchangé (régression TENANT-CERT-3-PRE)', async () => {
    const res = await request(app).get(`/api/platform-tenants/${tenantB._id}`).set(bearer(adminA));
    expect(res.status).toBe(403);
  });
});

describe('PlatformOperator — administration transversale des tenants (mission §21, §38)', () => {
  test('opérateur avec platform.tenants.read → liste TOUS les tenants (A et B)', async () => {
    const res = await request(app).get('/api/platform-tenants').set(bearer(operatorUser));
    expect(res.status).toBe(200);
    const ids = res.body.data.tenants.map((t) => String(t._id));
    expect(ids).toEqual(expect.arrayContaining([String(tenantA._id), String(tenantB._id)]));
  });

  test('opérateur avec platform.tenants.read → overview Tenant B accessible', async () => {
    const res = await request(app).get(`/api/platform-tenants/${tenantB._id}`).set(bearer(operatorUser));
    expect(res.status).toBe(200);
  });

  test('opérateur SANS platform.tenants.manage → création de tenant refusée', async () => {
    await PlatformOperator.updateOne({ user: operatorUser._id }, { $pull: { capabilities: 'platform.tenants.manage' } });
    const res = await request(app).post('/api/platform-tenants').set(bearer(operatorUser)).send({ name: 'Nouveau Tenant Hostile' });
    expect(res.status).toBe(403);
    await PlatformOperator.updateOne({ user: operatorUser._id }, { $addToSet: { capabilities: 'platform.tenants.manage' } });
  });
});

describe('PlatformOperator — révocation/suspension = perte immédiate (mission §39-40)', () => {
  test('opérateur suspendu → 403 même en sélectionnant un tenant explicite', async () => {
    const res = await request(app).get('/api/properties/portfolio').set(bearer(suspendedOperatorUser, tenantA));
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('TENANT_CONTEXT_REQUIRED'); // redevenu un Admin ordinaire sans membership
  });

  test('opérateur révoqué → 403, y compris sur les routes de gestion des tenants', async () => {
    const res = await request(app).get('/api/platform-tenants').set(bearer(revokedOperatorUser));
    expect(res.status).toBe(403);
  });

  test('opérateur suspendu → routes de gestion opérateur également refusées', async () => {
    const res = await request(app).get('/api/platform-operators').set(bearer(suspendedOperatorUser));
    expect(res.status).toBe(403);
  });
});

describe('Gestion des opérateurs — jamais d\'auto-promotion (mission §44-46)', () => {
  test('AdminA (Tenant Admin, aucune capacité opérateur) → ne peut pas lister/gérer les opérateurs', async () => {
    const list = await request(app).get('/api/platform-operators').set(bearer(adminA));
    expect(list.status).toBe(403);
    const grant = await request(app).post('/api/platform-operators').set(bearer(adminA)).send({ userId: staffA._id, capabilities: ['platform.tenants.read'], reason: 'Tentative hostile' });
    expect(grant.status).toBe(403);
  });

  test('opérateur avec platform.operators.manage → peut accorder la capacité à un autre utilisateur', async () => {
    // Cible = adminB (role Admin, déjà membre du tenant B) : les routes
    // platform-tenants/platform-operators exigent `role === 'Admin'` comme
    // garde de base (inchangé) — la capacité opérateur s'ajoute à ce rôle,
    // elle ne le remplace pas. Prouve qu'un Admin tenant-scopé ordinaire
    // devient réellement transversal une fois la capacité accordée.
    const res = await request(app).post('/api/platform-operators').set(bearer(operatorUser))
      .send({ userId: adminB._id, capabilities: ['platform.tenants.read'], reason: 'Test délégation' });
    expect(res.status).toBe(201);
    expect(res.body.data.operator.status).toBe('active');
    // adminB (auparavant Admin scopé au seul tenant B) peut maintenant lister tous les tenants
    const list = await request(app).get('/api/platform-tenants').set(bearer(adminB));
    expect(list.status).toBe(200);
    const ids = list.body.data.tenants.map((t) => String(t._id));
    expect(ids).toEqual(expect.arrayContaining([String(tenantA._id), String(tenantB._id)]));
    await PlatformOperator.deleteOne({ user: adminB._id });
  });

  test('opérateur ne peut pas modifier ses propres capacités (auto-promotion interdite)', async () => {
    const res = await request(app).post('/api/platform-operators').set(bearer(operatorUser))
      .send({ userId: operatorUser._id, capabilities: ['platform.finance.manage'], reason: 'Auto-octroi' });
    expect(res.status).toBe(403);
  });

  test('opérateur ne peut pas se révoquer/suspendre lui-même', async () => {
    const revoke = await request(app).patch(`/api/platform-operators/${operatorUser._id}/revoke`).set(bearer(operatorUser)).send({ reason: 'Auto' });
    expect(revoke.status).toBe(403);
    const suspend = await request(app).patch(`/api/platform-operators/${operatorUser._id}/suspend`).set(bearer(operatorUser)).send({ reason: 'Auto' });
    expect(suspend.status).toBe(403);
  });

  test('capacité invalide rejetée par le service (aucune capacité fantaisiste acceptée)', async () => {
    await expect(grantOperator({
      userId: staffA._id, actor: grantingAdmin, reason: 'Test capacité invalide', capabilities: ['platform.god_mode'],
    })).rejects.toThrow();
  });
});

describe('Reporting — mode plateforme natif, jamais fabriqué pour un non-opérateur (mission §20, §31)', () => {
  test('opérateur SANS tenant sélectionné → rapport exécutif consolidé accessible (200)', async () => {
    const res = await request(app).get('/api/reporting/executive').set(bearer(operatorUser));
    expect(res.status).toBe(200);
  });

  test('opérateur AVEC tenant sélectionné → rapport scopé à ce tenant (200)', async () => {
    const res = await request(app).get('/api/reporting/executive').set(bearer(operatorUser, tenantA));
    expect(res.status).toBe(200);
  });

  test('Admin SANS tenant et SANS capacité opérateur → reporting reste bloqué (jamais de mode plateforme accidentel)', async () => {
    const res = await request(app).get('/api/reporting/executive').set(bearer(plainAdminNoTenant));
    expect(res.status).toBe(403);
  });

  test('AdminA (Tenant Admin ordinaire) → reporting toujours scopé à son tenant, comportement inchangé', async () => {
    const res = await request(app).get('/api/reporting/executive').set(bearer(adminA));
    expect(res.status).toBe(200);
  });
});
