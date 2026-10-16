// HOTFIX-MESSAGING-TENANT-AMBIGUOUS-STAFF-1 (HF-FINAL-01) — reproduction
// rouge→verte, vrai Mongo + vrai HTTP. Avant correctif : un staff membre de
// deux tenants (ou d'aucun), sans en-tête `X-Platform-Tenant-Id`, obtenait un
// accès cross-tenant en lecture/suppression/écriture sur la messagerie
// partagée (`GET /staff-inbox`, `GET/DELETE/PATCH /:conversationId*`,
// `POST /api/messages`, `GET /api/messages/:conversationId`). Contrat cible :
// AMBIGU → 403 (même garde canonique que `/count/unread`, déjà sûre) ;
// SCOPED A → A uniquement ; SCOPED B → B uniquement ; ressource d'un AUTRE
// tenant déjà résolu → 404 (inchangé) ; PlatformOperator suit le même
// contrat que le staff sur ce domaine (jamais de mode plateforme natif ici,
// voir tenantContext.js).
//
// P0 SUPPORT-INBOX (révision) — les conversations de ce fichier sont des
// conversations de la boîte de support (`isStaffInbox: true`). Elles
// appartiennent exclusivement à Altitude Vision : un staff d'organisation n'y
// accède plus, même sur son propre tenant (anciens cas 5, 6, 7, 9, 11, 15, 16
// « succès » → refus). Les refus ambigus / cross-tenant restent figés ; seul un
// PlatformOperator actif `platform.support.read` (lecture) /
// `platform.support.reply` (réponse) y accède, quelle que soit la provenance.
const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const { startFinancialMongo, clearFinancialMongo, stopFinancialMongo } = require('./helpers/financialMongoEnvironment');
const { createTenantFixture, addTenantMember } = require('./helpers/tenantAwareFixture');
const { provisionPrivilegedOperator } = require('../services/platformOperator/platformOperatorService');
const User = require('../models/User');
const Conversation = require('../models/Conversation');
const Message = require('../models/Message');
const conversationRoutes = require('../routes/conversationRoutes');
const messageRoutes = require('../routes/messageRoutes');
const { errorHandler } = require('../middleware/errorMiddleware');

jest.setTimeout(180000);

const app = express();
app.use(express.json());
app.use('/api/conversations', conversationRoutes);
app.use('/api/messages', messageRoutes);
app.use(errorHandler);

const bearer = (user, tenantId) => ({
  Authorization: `Bearer ${jwt.sign({ id: user._id, tokenVersion: 0 }, process.env.JWT_SECRET, { expiresIn: '1d' })}`,
  ...(tenantId ? { 'X-Platform-Tenant-Id': String(tenantId) } : {}),
});

let fixtureA;
let fixtureB;
let staffA;      // staff mono-tenant, scope A
let staffB;      // staff mono-tenant, scope B
let staffMulti;  // staff membre de A ET B, aucune sélection par défaut
let staffNoMembership; // staff sans aucune adhésion (cas "no membership")
let poGlobal;    // PlatformOperator, aucun tenant sélectionné
let supportAgent; // PlatformOperator support.read + support.reply
let clientA;
let clientB;
let convA;
let convB;

beforeAll(async () => {
  await startFinancialMongo();
  await Conversation.syncIndexes();
  await Message.syncIndexes();
});
afterAll(stopFinancialMongo);

beforeEach(async () => {
  await clearFinancialMongo();

  fixtureA = await createTenantFixture({ label: 'HF-FINAL-01 A' });
  fixtureB = await createTenantFixture({ label: 'HF-FINAL-01 B' });

  const mkUser = async (overrides = {}) => User.create({
    name: 'HF-FINAL-01 User', email: `hf-final-01-${Date.now()}-${Math.random().toString(36).slice(2)}@example.test`,
    password: 'Password123!', passwordConfirm: 'Password123!', role: 'Collaborateur', isEmailVerified: true, ...overrides,
  });

  staffA = await mkUser();
  await addTenantMember({ tenant: fixtureA.tenant, user: staffA, bootstrap: fixtureA.bootstrap });

  staffB = await mkUser();
  await addTenantMember({ tenant: fixtureB.tenant, user: staffB, bootstrap: fixtureB.bootstrap });

  staffMulti = await mkUser();
  await addTenantMember({ tenant: fixtureA.tenant, user: staffMulti, bootstrap: fixtureA.bootstrap });
  await addTenantMember({ tenant: fixtureB.tenant, user: staffMulti, bootstrap: fixtureB.bootstrap });

  staffNoMembership = await mkUser();

  poGlobal = await mkUser({ role: 'Admin' });
  await provisionPrivilegedOperator({ userId: poGlobal._id, actor: fixtureA.bootstrap, reason: 'HF-FINAL-01 test', capabilities: [] });

  supportAgent = await mkUser({ role: 'Client' });
  await provisionPrivilegedOperator({ userId: supportAgent._id, actor: fixtureA.bootstrap, reason: 'P0 SUPPORT-INBOX test', capabilities: ['platform.support.read', 'platform.support.reply'] });

  clientA = await mkUser({ role: 'Client' });
  clientB = await mkUser({ role: 'Client' });

  convA = await Conversation.create({ tenant: fixtureA.tenant._id, participants: [clientA._id], isStaffInbox: true, lastMessage: 'SENTINEL-A' });
  convB = await Conversation.create({ tenant: fixtureB.tenant._id, participants: [clientB._id], isStaffInbox: true, lastMessage: 'SENTINEL-B' });
});

describe('HF-FINAL-01 — GET /api/conversations/staff-inbox', () => {
  test('1. staff multi-tenant sans en-tête → 403 (ambigu)', async () => {
    const res = await request(app).get('/api/conversations/staff-inbox').set(bearer(staffMulti));
    expect(res.status).toBe(403);
  });

  test('staff sans aucune adhésion (no membership) → 403 (fail-closed)', async () => {
    const res = await request(app).get('/api/conversations/staff-inbox').set(bearer(staffNoMembership));
    expect(res.status).toBe(403);
  });

  test('5. staff multi + header A → 403 (boîte de support réservée à Altitude Vision)', async () => {
    const res = await request(app).get('/api/conversations/staff-inbox').set(bearer(staffMulti, fixtureA.tenant._id));
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('SUPPORT_CAPABILITY_REQUIRED');
  });

  test('6. staff multi + header B → 403 (boîte de support réservée à Altitude Vision)', async () => {
    const res = await request(app).get('/api/conversations/staff-inbox').set(bearer(staffMulti, fixtureB.tenant._id));
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('SUPPORT_CAPABILITY_REQUIRED');
  });

  test('staff A (mono-tenant), même sur son propre tenant → 403', async () => {
    const res = await request(app).get('/api/conversations/staff-inbox').set(bearer(staffA));
    expect(res.status).toBe(403);
  });

  test('13. en-tête invalide (tenant sans adhésion) → refusé', async () => {
    const foreignTenant = await createTenantFixture({ label: 'HF-FINAL-01 C' });
    const res = await request(app).get('/api/conversations/staff-inbox').set(bearer(staffA, foreignTenant.tenant._id));
    expect(res.status).toBe(403);
  });

  test('14. PlatformOperator global (aucune sélection) → même contrat que staff ambigu (403), messaging n’a jamais eu de mode plateforme natif', async () => {
    const res = await request(app).get('/api/conversations/staff-inbox').set(bearer(poGlobal));
    expect(res.status).toBe(403);
  });

  test('15. PlatformOperator scoped A sans capacité support → 403', async () => {
    const res = await request(app).get('/api/conversations/staff-inbox').set(bearer(poGlobal, fixtureA.tenant._id));
    expect(res.status).toBe(403);
  });

  test('16. PlatformOperator scoped B sans capacité support → 403', async () => {
    const res = await request(app).get('/api/conversations/staff-inbox').set(bearer(poGlobal, fixtureB.tenant._id));
    expect(res.status).toBe(403);
  });
});

describe('P0 SUPPORT-INBOX — agent support Altitude Vision', () => {
  test('liste les conversations de toutes provenances, lit et répond', async () => {
    const list = await request(app).get('/api/conversations/staff-inbox').set(bearer(supportAgent));
    expect(list.status).toBe(200);
    expect(list.body.data.conversations.map((c) => String(c._id)).sort()).toEqual([String(convA._id), String(convB._id)].sort());

    const detail = await request(app).get(`/api/conversations/${convB._id}`).set(bearer(supportAgent));
    expect(detail.status).toBe(200);

    const reply = await request(app).post('/api/messages').set(bearer(supportAgent)).send({ conversationId: String(convB._id), content: 'Réponse Altitude Vision' });
    expect(reply.status).toBe(201);
    expect(await Message.countDocuments({ conversation: convB._id, receiver: clientB._id })).toBe(1);
  });
});

describe('HF-FINAL-01 — GET /api/conversations/:conversationId (detail)', () => {
  test('2. staff ambigu → conversation B par ObjectId → 403', async () => {
    const res = await request(app).get(`/api/conversations/${convB._id}`).set(bearer(staffMulti));
    expect(res.status).toBe(403);
  });

  test('7. staff A → detail A (son propre tenant) → 403', async () => {
    const res = await request(app).get(`/api/conversations/${convA._id}`).set(bearer(staffA));
    expect(res.status).toBe(403);
    expect(res.body.data).toBeUndefined();
  });

  // Le 500 historique (erreur d'attribution tenant non mappée) est corrigé :
  // le refus est désormais un 4xx explicite, sans fuite de données.
  test('8. staff A → detail B → refusé (4xx), aucune donnée', async () => {
    const res = await request(app).get(`/api/conversations/${convB._id}`).set(bearer(staffA));
    expect(res.status).toBe(403);
    expect(res.body.data).toBeUndefined();
  });
});

describe('HF-FINAL-01 — DELETE /api/conversations/:conversationId', () => {
  test('3. staff ambigu → suppression conversation B → 403 + DB intacte', async () => {
    const res = await request(app).delete(`/api/conversations/${convB._id}`).set(bearer(staffMulti));
    expect(res.status).toBe(403);
    expect(await Conversation.findById(convB._id)).not.toBeNull();
  });

  test('9. staff A → delete A (son propre tenant) → 403, zéro suppression', async () => {
    const res = await request(app).delete(`/api/conversations/${convA._id}`).set(bearer(staffA));
    expect(res.status).toBe(403);
    expect(await Conversation.findById(convA._id)).not.toBeNull();
  });

  test('10. staff A → delete B → refusé (4xx), zéro suppression', async () => {
    const res = await request(app).delete(`/api/conversations/${convB._id}`).set(bearer(staffA));
    expect(res.status).toBe(403);
    expect(await Conversation.findById(convB._id)).not.toBeNull();
  });
});

describe('HF-FINAL-01 — PATCH /api/conversations/:conversationId/mark-read', () => {
  test('staff ambigu → mark-read sur B → 403', async () => {
    const res = await request(app).patch(`/api/conversations/${convB._id}/mark-read`).set(bearer(staffMulti));
    expect(res.status).toBe(403);
  });
});

describe('HF-FINAL-01 — POST /api/messages (send)', () => {
  test('4. staff ambigu → envoi dans conversation B → 403 + aucun message créé', async () => {
    const before = await Message.countDocuments({ conversation: convB._id });
    const res = await request(app).post('/api/messages').set(bearer(staffMulti)).send({ conversationId: String(convB._id), content: 'INJECTED-CROSS-TENANT' });
    expect(res.status).toBe(403);
    expect(await Message.countDocuments({ conversation: convB._id })).toBe(before);
    const reloadedB = await Conversation.findById(convB._id);
    expect(reloadedB.lastMessage).toBe('SENTINEL-B');
  });

  test('11. staff A → envoi dans A (son propre tenant) → 403, aucun message', async () => {
    const res = await request(app).post('/api/messages').set(bearer(staffA)).send({ conversationId: String(convA._id), content: 'Réponse tenant interdite' });
    expect(res.status).toBe(403);
    expect(await Message.countDocuments({ conversation: convA._id })).toBe(0);
  });

  test('12. staff A → envoi dans B → refusé (4xx), aucun message créé', async () => {
    const res = await request(app).post('/api/messages').set(bearer(staffA)).send({ conversationId: String(convB._id), content: 'INJECTED-CROSS-TENANT' });
    expect(res.status).toBe(403);
    expect(await Message.countDocuments({ conversation: convB._id })).toBe(0);
  });
});

describe('HF-FINAL-01 — GET /api/messages/:conversationId', () => {
  test('staff ambigu → lecture des messages de B → 403', async () => {
    const res = await request(app).get(`/api/messages/${convB._id}`).set(bearer(staffMulti));
    expect(res.status).toBe(403);
  });
});

describe('HF-FINAL-01 — 17/18. GET /api/conversations/count/unread reste inchangé (référence canonique déjà sûre)', () => {
  test('17. ambigu → toujours 403', async () => {
    const res = await request(app).get('/api/conversations/count/unread').set(bearer(staffMulti));
    expect(res.status).toBe(403);
  });

  test('18. scoped → résultat historique (200, compteur numérique)', async () => {
    const res = await request(app).get('/api/conversations/count/unread').set(bearer(staffA, fixtureA.tenant._id));
    expect(res.status).toBe(200);
    expect(typeof res.body.data.unreadCount).toBe('number');
  });
});

describe('HF-FINAL-01 — non-régression client (jamais de tenant propre, jamais bloqué)', () => {
  test('client participant peut toujours lire sa propre conversation staff-inbox', async () => {
    const res = await request(app).get(`/api/conversations/${convA._id}`).set(bearer(clientA));
    expect(res.status).toBe(200);
  });

  test('client peut toujours lister my-inbox sans en-tête tenant', async () => {
    const res = await request(app).get('/api/conversations/my-inbox').set(bearer(clientA));
    expect(res.status).toBe(200);
  });
});
