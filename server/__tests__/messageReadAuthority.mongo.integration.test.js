// HOTFIX-MESSAGING-MESSAGE-READ-AUTHORITY-1 — reproduction rouge→verte
// permanente, vrai Mongo + vrai HTTP. Avant correctif :
// `messageController.getMessages` (`GET /api/messages/:conversationId`)
// n'appliquait aucune vérification participant/staff/ownership — seulement
// une frontière tenant optionnelle (HF-FINAL-01), sans effet pour les rôles
// non-staff (Client/Proprietaire, qui n'ont structurellement jamais de
// `req.platformTenant`). Contrat cible, prouvé (pas inventé, voir
// HOTFIX_MESSAGING_MESSAGE_READ_AUTHORITY1_EXISTING_CONTRACT.md) : réutiliser
// `assertConversationAccess` (isStaff ALL_STAFF OU participant), déjà en
// production sur 4 fonctions sœurs de `conversationController.js` — jamais
// une politique inventée pour ce hotfix. En particulier, l'autorité staff
// "tout staff du tenant peut lire toute conversation de ce tenant" est
// intentionnelle et PRÉSERVÉE, pas fermée par ce hotfix (voir contrat
// existant déjà exercé identiquement 4 fois avant ce hotfix).
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
let clientA;      // aucun lien avec les conversations testées
let clientB;
let clientC;
let proprietaireA; // même chemin de code que Client, aucun lien
let staffA;        // Collaborateur, tenant A, PARTICIPANT d'aucune conversation testée
let staffB;        // Collaborateur, tenant A
let adminA;        // Admin, tenant A
let staffMulti;    // multi-tenant, aucune sélection par défaut (HF-FINAL-01)
let poGlobal;
let convPrivateBC;   // Client B <-> Client C, tenant absent (conversation "générique")
let convStaffBClient; // Staff B <-> un client, tenant A, PAS isStaffInbox
let convTenantB;      // conversation attribuée au tenant B

beforeAll(async () => {
  await startFinancialMongo();
  await Conversation.syncIndexes();
  await Message.syncIndexes();
});
afterAll(stopFinancialMongo);

beforeEach(async () => {
  await clearFinancialMongo();

  fixtureA = await createTenantFixture({ label: 'READ-AUTHORITY A' });
  fixtureB = await createTenantFixture({ label: 'READ-AUTHORITY B' });

  const mkUser = (overrides = {}) => User.create({
    name: 'Read Authority User', email: `read-authority-${Date.now()}-${Math.random().toString(36).slice(2)}@example.test`,
    password: 'Password123!', passwordConfirm: 'Password123!', role: 'Client', isEmailVerified: true, ...overrides,
  });

  clientA = await mkUser();
  clientB = await mkUser();
  clientC = await mkUser();
  proprietaireA = await mkUser({ role: 'Proprietaire' });

  staffA = await mkUser({ role: 'Collaborateur' });
  await addTenantMember({ tenant: fixtureA.tenant, user: staffA, bootstrap: fixtureA.bootstrap });
  staffB = await mkUser({ role: 'Collaborateur' });
  await addTenantMember({ tenant: fixtureA.tenant, user: staffB, bootstrap: fixtureA.bootstrap });
  adminA = await mkUser({ role: 'Admin' });
  await addTenantMember({ tenant: fixtureA.tenant, user: adminA, bootstrap: fixtureA.bootstrap });

  staffMulti = await mkUser({ role: 'Collaborateur' });
  await addTenantMember({ tenant: fixtureA.tenant, user: staffMulti, bootstrap: fixtureA.bootstrap });
  await addTenantMember({ tenant: fixtureB.tenant, user: staffMulti, bootstrap: fixtureB.bootstrap });

  poGlobal = await mkUser({ role: 'Admin' });
  await grantOperator({ userId: poGlobal._id, actor: adminA, reason: 'HOTFIX-MESSAGING-MESSAGE-READ-AUTHORITY-1 test', capabilities: [] });

  // Conversation privée générique (pas de tenant), entre deux clients sans aucun lien avec staffA/clientA.
  convPrivateBC = await Conversation.create({ participants: [clientB._id, clientC._id], isStaffInbox: false, lastMessage: 'SENTINEL-PRIVATE-BC' });
  await Message.create({ sender: clientB._id, receiver: clientC._id, conversation: convPrivateBC._id, content: 'SECRET-BC-CONTENT', isRead: false });

  // Conversation privée 1-1 (PAS staff-inbox) entre staffB et un client tiers, tenant A.
  const otherClient = await mkUser();
  convStaffBClient = await Conversation.create({ tenant: fixtureA.tenant._id, participants: [staffB._id, otherClient._id], isStaffInbox: false, lastMessage: 'SENTINEL-STAFFB' });
  await Message.create({ sender: staffB._id, receiver: otherClient._id, conversation: convStaffBClient._id, content: 'STAFF-B-PRIVATE-CONTENT', tenant: fixtureA.tenant._id });

  // Conversation attribuée au tenant B.
  const clientTenantB = await mkUser();
  convTenantB = await Conversation.create({ tenant: fixtureB.tenant._id, participants: [clientTenantB._id], isStaffInbox: true, lastMessage: 'SENTINEL-TENANT-B' });
  await Message.create({ sender: clientTenantB._id, receiver: null, conversation: convTenantB._id, content: 'TENANT-B-CONTENT', tenant: fixtureB.tenant._id });
});

const getMessages = (conv, actor, tenantId) => request(app).get(`/api/messages/${conv._id}`).set(bearer(actor, tenantId));

describe('HOTFIX-MESSAGING-MESSAGE-READ-AUTHORITY-1 — acteurs SANS autorité (doivent être refusés)', () => {
  test('1. Client A (non-participant) sur conversation privée Client B/C → 403, aucun contenu', async () => {
    const res = await getMessages(convPrivateBC, clientA);
    expect(res.status).toBe(403);
    expect(res.body.data).toBeUndefined();
  });

  test('2. Proprietaire A (non-participant, même chemin que Client) sur conversation privée → 403', async () => {
    const res = await getMessages(convPrivateBC, proprietaireA);
    expect(res.status).toBe(403);
  });

  test('3. Client A sur conversation attribuée au tenant B (sans lien) → 403', async () => {
    const res = await getMessages(convTenantB, clientA);
    expect(res.status).toBe(403);
  });

  test('effet de bord : isRead reste inchangé après une lecture refusée', async () => {
    const before = await Message.findOne({ conversation: convPrivateBC._id });
    expect(before.isRead).toBe(false);
    await getMessages(convPrivateBC, clientA);
    const after = await Message.findOne({ conversation: convPrivateBC._id });
    expect(after.isRead).toBe(false);
  });
});

describe('HOTFIX-MESSAGING-MESSAGE-READ-AUTHORITY-1 — acteurs AVEC autorité (doivent rester autorisés, comportement historique)', () => {
  test('4. Client B (participant réel) lit sa propre conversation → 200, contenu historique', async () => {
    const res = await getMessages(convPrivateBC, clientB);
    expect(res.status).toBe(200);
    expect(res.body.data.messages).toHaveLength(1);
    expect(res.body.data.messages[0].content).toBe('SECRET-BC-CONTENT');
  });

  test('effet de bord : isRead bascule à true pour un accès autorisé (comportement historique préservé)', async () => {
    await getMessages(convPrivateBC, clientC); // clientC = receiver du message
    const after = await Message.findOne({ conversation: convPrivateBC._id });
    expect(after.isRead).toBe(true);
  });

  test('5. Staff A (même tenant, NON-participant) sur conversation privée d’un collègue (staffB) → 200 — autorité staff tenant-wide PRÉSERVÉE, pas un rouge', async () => {
    const res = await getMessages(convStaffBClient, staffA, fixtureA.tenant._id);
    expect(res.status).toBe(200);
    expect(res.body.data.messages[0].content).toBe('STAFF-B-PRIVATE-CONTENT');
  });

  test('6. Admin A sur une conversation quelconque de son tenant → 200 — autorité Admin préservée', async () => {
    const res = await getMessages(convStaffBClient, adminA, fixtureA.tenant._id);
    expect(res.status).toBe(200);
  });

  test('7. PlatformOperator scopé A → 200 sur une conversation du tenant A', async () => {
    const res = await getMessages(convStaffBClient, poGlobal, fixtureA.tenant._id);
    expect(res.status).toBe(200);
  });
});

describe('HOTFIX-MESSAGING-MESSAGE-READ-AUTHORITY-1 — non-régression HF-FINAL-01 (tenant, inchangé)', () => {
  test('8. Staff multi-tenant SANS en-tête → 403 (ambigu, HF-FINAL-01 toujours actif)', async () => {
    const res = await getMessages(convStaffBClient, staffMulti);
    expect(res.status).toBe(403);
  });

  test('9. Staff A (tenant A) sur une conversation du tenant B → refusé (tenant croisé, comportement pré-existant)', async () => {
    const res = await getMessages(convTenantB, staffA, fixtureA.tenant._id);
    expect(res.status).not.toBe(200);
    expect(await Message.countDocuments({ conversation: convTenantB._id, isRead: true })).toBe(0);
  });

  test('10. En-tête de tenant invalide (aucune adhésion) → refusé', async () => {
    const foreignTenant = await createTenantFixture({ label: 'READ-AUTHORITY C' });
    const res = await getMessages(convStaffBClient, staffA, foreignTenant.tenant._id);
    expect(res.status).toBe(403);
  });
});

describe('HOTFIX-MESSAGING-MESSAGE-READ-AUTHORITY-1 — non-régression conversationController (assertConversationAccess partagée)', () => {
  test('getConversationById continue de fonctionner identiquement après extraction du helper', async () => {
    const res = await request(app).get(`/api/conversations/${convPrivateBC._id}`).set(bearer(clientB));
    expect(res.status).toBe(200);
  });

  test('getConversationById refuse toujours un non-participant non-staff', async () => {
    const res = await request(app).get(`/api/conversations/${convPrivateBC._id}`).set(bearer(clientA));
    expect(res.status).toBe(403);
  });
});
