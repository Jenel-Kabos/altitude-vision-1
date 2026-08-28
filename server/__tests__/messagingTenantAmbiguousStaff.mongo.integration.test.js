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
const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const { startFinancialMongo, clearFinancialMongo, stopFinancialMongo } = require('./helpers/financialMongoEnvironment');
const { createTenantFixture, addTenantMember } = require('./helpers/tenantAwareFixture');
const { grantOperator } = require('../services/platformOperator/platformOperatorService');
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
  await grantOperator({ userId: poGlobal._id, actor: fixtureA.bootstrap, reason: 'HF-FINAL-01 test', capabilities: [] });

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

  test('5. staff multi + header A → A uniquement', async () => {
    const res = await request(app).get('/api/conversations/staff-inbox').set(bearer(staffMulti, fixtureA.tenant._id));
    expect(res.status).toBe(200);
    const ids = res.body.data.conversations.map((c) => String(c._id));
    expect(ids).toEqual([String(convA._id)]);
  });

  test('6. staff multi + header B → B uniquement', async () => {
    const res = await request(app).get('/api/conversations/staff-inbox').set(bearer(staffMulti, fixtureB.tenant._id));
    expect(res.status).toBe(200);
    const ids = res.body.data.conversations.map((c) => String(c._id));
    expect(ids).toEqual([String(convB._id)]);
  });

  test('staff A (mono-tenant) → A uniquement sans avoir besoin de sélectionner (comportement historique préservé)', async () => {
    const res = await request(app).get('/api/conversations/staff-inbox').set(bearer(staffA));
    expect(res.status).toBe(200);
    const ids = res.body.data.conversations.map((c) => String(c._id));
    expect(ids).toEqual([String(convA._id)]);
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

  test('15. PlatformOperator scoped A → A uniquement', async () => {
    const res = await request(app).get('/api/conversations/staff-inbox').set(bearer(poGlobal, fixtureA.tenant._id));
    expect(res.status).toBe(200);
    expect(res.body.data.conversations.map((c) => String(c._id))).toEqual([String(convA._id)]);
  });

  test('16. PlatformOperator scoped B → B uniquement', async () => {
    const res = await request(app).get('/api/conversations/staff-inbox').set(bearer(poGlobal, fixtureB.tenant._id));
    expect(res.status).toBe(200);
    expect(res.body.data.conversations.map((c) => String(c._id))).toEqual([String(convB._id)]);
  });
});

describe('HF-FINAL-01 — GET /api/conversations/:conversationId (detail)', () => {
  test('2. staff ambigu → conversation B par ObjectId → 403', async () => {
    const res = await request(app).get(`/api/conversations/${convB._id}`).set(bearer(staffMulti));
    expect(res.status).toBe(403);
  });

  test('7. staff A → detail A → OK', async () => {
    const res = await request(app).get(`/api/conversations/${convA._id}`).set(bearer(staffA));
    expect(res.status).toBe(200);
    expect(String(res.body.data.conversation._id)).toBe(String(convA._id));
  });

  // NOTE — comportement PRÉ-EXISTANT, non modifié par ce hotfix : l'erreur
  // levée par `assertResourceTenantOrUnattributed` (statusCode:404 sur
  // l'objet Error) n'a pas de `.name` reconnu par `errorMiddleware.js`, qui
  // ne lit jamais `err.statusCode` — seulement `res.statusCode` (déjà 200 à
  // ce stade) et une liste de noms d'erreur explicites. Le refus est bien
  // réel (aucune fuite cross-tenant, confirmé), mais le code HTTP observé
  // est 500, pas 404. Documenté comme NEW_MESSAGING_FINDING_OUT_OF_SCOPE
  // dans `_ROOT_CAUSE.md` — cause racine différente de HF-FINAL-01 (bug de
  // sérialisation d'erreur, pas un contournement de frontière tenant), non
  // corrigé ici conformément au mandat (correction minimale, un seul root
  // cause par hotfix).
  test('8. staff A → detail B → refusé (500 — comportement pré-existant hors périmètre, aucune fuite de données)', async () => {
    const res = await request(app).get(`/api/conversations/${convB._id}`).set(bearer(staffA));
    expect(res.status).toBe(500);
    expect(res.body.data).toBeUndefined();
  });
});

describe('HF-FINAL-01 — DELETE /api/conversations/:conversationId', () => {
  test('3. staff ambigu → suppression conversation B → 403 + DB intacte', async () => {
    const res = await request(app).delete(`/api/conversations/${convB._id}`).set(bearer(staffMulti));
    expect(res.status).toBe(403);
    expect(await Conversation.findById(convB._id)).not.toBeNull();
  });

  test('9. staff A → delete A → comportement historique (succès)', async () => {
    const res = await request(app).delete(`/api/conversations/${convA._id}`).set(bearer(staffA));
    expect(res.status).toBe(200);
    expect(await Conversation.findById(convA._id)).toBeNull();
  });

  // Même remarque que le test 8 ci-dessus (detail) : 500 pré-existant hors périmètre, refus réel confirmé par l'assertion DB.
  test('10. staff A → delete B → refusé (500, comportement pré-existant), zéro suppression', async () => {
    const res = await request(app).delete(`/api/conversations/${convB._id}`).set(bearer(staffA));
    expect(res.status).toBe(500);
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

  test('11. staff A → envoi dans A → comportement historique (succès)', async () => {
    const res = await request(app).post('/api/messages').set(bearer(staffA)).send({ conversationId: String(convA._id), content: 'Réponse légitime A' });
    expect(res.status).toBe(201);
    expect(await Message.countDocuments({ conversation: convA._id })).toBe(1);
  });

  // Même remarque que les tests 8/10 (detail/delete) : `assertResourceTenantOrUnattributed`
  // appelée à l'intérieur de `sendMessage` (une fois le tenant du staff résolu par le
  // garde routeur) porte le même défaut de sérialisation pré-existant (500 au lieu de
  // 404/403) — hors périmètre de ce hotfix. Le refus réel (aucun message créé) est
  // ce qui compte pour la sécurité, vérifié ci-dessous.
  test('12. staff A → envoi dans B → refusé (500, comportement pré-existant), aucun message créé', async () => {
    const res = await request(app).post('/api/messages').set(bearer(staffA)).send({ conversationId: String(convB._id), content: 'INJECTED-CROSS-TENANT' });
    expect(res.status).toBe(500);
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
