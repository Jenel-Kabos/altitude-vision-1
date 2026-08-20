// HOTFIX-OWNER-CONTRACT-RESEND-1 — reproduit et verrouille la rupture
// d'identité entre le chemin de LECTURE (`GET /api/users`, étendu par
// HOTFIX-USERS-COUNT-1 aux comptes non affiliés sur tenant unique via
// `expandScopeWithUnaffiliatedUsersIfSoleTenant`) et le chemin d'ACTION
// (`router.param('id', …)`, userRoutes.js), qui utilisait le scope brut
// `OrgMembership` non étendu — un compte visible dans la liste restait
// 404 "Utilisateur introuvable." sur `POST /:id/renvoyer-contrat` (et sur
// toutes les autres actions /:id). Le correctif réutilise la MÊME
// fonction canonique dans le garde `router.param`.
jest.mock('../config/cloudinary', () => ({
  destroyFromCloudinary: jest.fn().mockResolvedValue(true),
  uploadToCloudinary: jest.fn().mockResolvedValue({
    public_id: 'altitude-vision/private/administrative/mock',
    resource_type: 'raw',
    version: '1',
    format: 'pdf',
    bytes: 1234,
  }),
  upload: { single: () => (req, res, next) => next() },
  cloudinary: {},
}));

const mockSendEmailWithAttachment = jest.fn().mockResolvedValue(true);
jest.mock('../services/emailService', () => ({
  sendEmailWithAttachment: (...args) => mockSendEmailWithAttachment(...args),
}));

const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const { startFinancialMongo, stopFinancialMongo } = require('./helpers/financialMongoEnvironment');
const { createTenantFixture, createTenantUser } = require('./helpers/tenantAwareFixture');
const User = require('../models/User');

const userRoutes = require('../routes/userRoutes');
const { errorHandler } = require('../middleware/errorMiddleware');

jest.setTimeout(180000);

const app = express();
app.use(express.json());
app.use('/api/users', userRoutes);
app.use(errorHandler);

const bearer = (user) => ({
  Authorization: `Bearer ${jwt.sign({ id: user._id, tokenVersion: 0 }, process.env.JWT_SECRET, { expiresIn: '1d' })}`,
});

async function createUnaffiliatedProprietaire(overrides = {}) {
  return User.create({
    name: 'Huinlogistics Boss',
    email: `huinlogistics-${Date.now()}-${Math.random().toString(36).slice(2)}@example.test`,
    password: 'Password123!', passwordConfirm: 'Password123!',
    role: 'Proprietaire', isEmailVerified: true,
    contratAccepte: true,
    contratVersion: 'v1.0',
    contratAccepteLe: new Date('2026-01-15T10:00:00Z'),
    ...overrides,
  });
}

beforeAll(async () => { await startFinancialMongo(); });
afterEach(() => { mockSendEmailWithAttachment.mockClear(); });
afterAll(async () => stopFinancialMongo());

// IMPORTANT : les deux describes ci-dessous partagent le MÊME fixture/tenant
// unique (un seul `createTenantFixture` pour tout le fichier jusqu'au bloc
// cross-tenant) — dès qu'un second `PlatformTenant` existe dans cette même
// base Mongo partagée (`startFinancialMongo` unique pour tout le fichier),
// l'extension "tenant unique" se désactive PARTOUT dans ce fichier, y
// compris pour des tests antérieurs déjà exécutés dans d'autres describes.
// L'ordre des describes est donc significatif : tout ce qui dépend du
// tenant unique doit s'exécuter AVANT le bloc cross-tenant.
let sharedFixture; let sharedProprietaireA; let sharedProprietaireB;

describe('HOTFIX-OWNER-CONTRACT-RESEND-1 — scénario réel : Proprietaire signup sans OrgMembership, tenant unique', () => {
  let fixture; let proprietaire;

  beforeAll(async () => {
    fixture = sharedFixture = await createTenantFixture({ label: 'HotfixResend1 Solo' });
    proprietaire = sharedProprietaireA = await createUnaffiliatedProprietaire({ name: 'Proprietaire A' });
    sharedProprietaireB = await createUnaffiliatedProprietaire({ name: 'Proprietaire B' });
  });

  test('reproduction AVANT correctif (documentée) : le Proprietaire est visible dans GET /api/users', async () => {
    const res = await request(app).get('/api/users').set(bearer(fixture.bootstrap));
    const ids = res.body.data.users.map((u) => String(u._id));
    expect(ids).toContain(String(proprietaire._id));
  });

  test('POST /:id/renvoyer-contrat sur ce même compte → 200, jamais 404 "Utilisateur introuvable."', async () => {
    const res = await request(app)
      .post(`/api/users/${proprietaire._id}/renvoyer-contrat`)
      .set(bearer(fixture.bootstrap))
      .send({});
    expect(res.status).toBe(200);
    expect(res.body.message).not.toMatch(/introuvable/i);
  });

  test("le service mail est appelé avec l'email canonique du Proprietaire (dérivé serveur-side)", async () => {
    await request(app)
      .post(`/api/users/${proprietaire._id}/renvoyer-contrat`)
      .set(bearer(fixture.bootstrap))
      .send({});
    expect(mockSendEmailWithAttachment).toHaveBeenCalledTimes(1);
    const [recipient] = mockSendEmailWithAttachment.mock.calls[0];
    expect(recipient).toBe(proprietaire.email);
  });

  test('GET /:id/contract-document (même garde router.param) est également accessible, pas 404', async () => {
    const res = await request(app)
      .get(`/api/users/${proprietaire._id}/contract-document`)
      .set(bearer(fixture.bootstrap));
    // 409 LEGACY_ASSET_MIGRATION_REQUIRED est acceptable ici (aucun PDF
    // stocké avant le premier renvoi dans CE test) — seul un 404
    // "Utilisateur introuvable." prouverait la régression ciblée.
    expect(res.status).not.toBe(404);
  });
});

describe('HOTFIX-OWNER-CONTRACT-RESEND-1 — sécurité : aucune injection d’un destinataire arbitraire', () => {
  test('un body forgé avec l’email/ID de B n’envoie JAMAIS le contrat de A à B — le destinataire est dérivé côté serveur, pas du body', async () => {
    const res = await request(app)
      .post(`/api/users/${sharedProprietaireA._id}/renvoyer-contrat`)
      .set(bearer(sharedFixture.bootstrap))
      .send({ email: sharedProprietaireB.email, userId: String(sharedProprietaireB._id), recipient: sharedProprietaireB.email });
    expect(res.status).toBe(200);
    expect(mockSendEmailWithAttachment).toHaveBeenCalledTimes(1);
    const [recipient] = mockSendEmailWithAttachment.mock.calls[0];
    expect(recipient).toBe(sharedProprietaireA.email);
    expect(recipient).not.toBe(sharedProprietaireB.email);
  });
});

describe('HOTFIX-OWNER-CONTRACT-RESEND-1 — isolation cross-tenant préservée', () => {
  let fixtureB; let proprietaireA; let adminB;

  beforeAll(async () => {
    await createTenantFixture({ label: 'HotfixResend1 CrossA' });
    proprietaireA = await createUnaffiliatedProprietaire({ name: 'Cross Proprietaire A' });
    fixtureB = await createTenantFixture({ label: 'HotfixResend1 CrossB' });
    adminB = (await createTenantUser({ tenant: fixtureB.tenant, bootstrap: fixtureB.bootstrap, overrides: { role: 'Admin' } })).user;
  });

  test('AdminB (tenant distinct) ne peut pas renvoyer le contrat d’un Proprietaire non affilié au Tenant A dès qu’un second tenant existe', async () => {
    const res = await request(app)
      .post(`/api/users/${proprietaireA._id}/renvoyer-contrat`)
      .set(bearer(adminB))
      .send({});
    expect(res.status).toBe(404);
    expect(mockSendEmailWithAttachment).not.toHaveBeenCalled();
  });
});

describe('HOTFIX-OWNER-CONTRACT-RESEND-1 — IAM et non-régression', () => {
  let fixture; let collaborateur; let proprietaire;

  beforeAll(async () => {
    fixture = await createTenantFixture({ label: 'HotfixResend1 IAM' });
    collaborateur = (await createTenantUser({ tenant: fixture.tenant, bootstrap: fixture.bootstrap, overrides: { role: 'Collaborateur' } })).user;
    proprietaire = await createUnaffiliatedProprietaire();
  });

  test('Collaborateur (non-Admin) reçoit 403 sur POST /:id/renvoyer-contrat', async () => {
    const res = await request(app)
      .post(`/api/users/${proprietaire._id}/renvoyer-contrat`)
      .set(bearer(collaborateur))
      .send({});
    expect(res.status).toBe(403);
    expect(mockSendEmailWithAttachment).not.toHaveBeenCalled();
  });

  test('renvoyer-contrat sur un compte non-Proprietaire → 400, pas 404, pas d’envoi', async () => {
    const nonOwner = (await createTenantUser({ tenant: fixture.tenant, bootstrap: fixture.bootstrap, overrides: { role: 'Client' } })).user;
    const res = await request(app)
      .post(`/api/users/${nonOwner._id}/renvoyer-contrat`)
      .set(bearer(fixture.bootstrap))
      .send({});
    expect(res.status).toBe(400);
    expect(mockSendEmailWithAttachment).not.toHaveBeenCalled();
  });
});
