// SECURITY-CLOSURE-P0-WAVE-1 (P0-A, finding RA-01, source
// TENANT_SCOPE_HORIZONTAL_CLOSURE_REAUDIT1_FINDING_MATRIX.md) — reproduction
// rouge->verte PERMANENTE : `messageController.sendMessage` (POST
// /api/messages, avec `conversationId`) n'appliquait jusqu'ici aucune
// vérification participant/staff — seulement une frontière tenant
// optionnelle (`if (req.platformTenant)`), sans effet pour Client/
// Proprietaire (jamais de `req.platformTenant`). Contrat cible, prouvé (pas
// inventé) : réutiliser `assertConversationAccess`, déjà en production sur
// `getMessages` (HOTFIX-MESSAGING-MESSAGE-READ-AUTHORITY-1) et sur 4
// fonctions de conversationController.js. L'autorité staff tenant-wide
// (tout staff du tenant peut écrire dans toute conversation de ce tenant,
// y compris une conversation privée d'un collègue) est intentionnelle et
// PRÉSERVÉE, pas fermée par ce hotfix.
const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const { startFinancialMongo, clearFinancialMongo, stopFinancialMongo } = require('./helpers/financialMongoEnvironment');
const { createTenantFixture, addTenantMember } = require('./helpers/tenantAwareFixture');
const { provisionPrivilegedOperator } = require('../services/platformOperator/platformOperatorService');
const PlatformOperator = require('../models/PlatformOperator');
const { grantAuthorization, revokeAuthorization } = require('../services/contactAuthorizationService');
const User = require('../models/User');
const Conversation = require('../models/Conversation');
const Message = require('../models/Message');
const messageRoutes = require('../routes/messageRoutes');
const { errorHandler } = require('../middleware/errorMiddleware');

jest.setTimeout(180000);

const app = express();
app.use(express.json());
app.use('/api/messages', messageRoutes);
app.use(errorHandler);

const bearer = (user, tenantId) => ({
  Authorization: `Bearer ${jwt.sign({ id: user._id, tokenVersion: 0 }, process.env.JWT_SECRET, { expiresIn: '1d' })}`,
  ...(tenantId ? { 'X-Platform-Tenant-Id': String(tenantId) } : {}),
});

let fixtureA;
let fixtureB;
let clientA;
let clientB;
let clientC;
let proprietaireA;
let staffA;
let staffB;
let adminA;
let staffMulti;
let poGlobal;
let convPrivateBC;
let convStaffBClient;
let convTenantB;

beforeAll(async () => {
  await startFinancialMongo();
  await Conversation.syncIndexes();
  await Message.syncIndexes();
});
afterAll(stopFinancialMongo);

beforeEach(async () => {
  await clearFinancialMongo();

  fixtureA = await createTenantFixture({ label: 'P0-A A' });
  fixtureB = await createTenantFixture({ label: 'P0-A B' });

  const mkUser = (overrides = {}) => User.create({
    name: 'P0-A User', email: `p0a-${Date.now()}-${Math.random().toString(36).slice(2)}@example.test`,
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
  await provisionPrivilegedOperator({ userId: poGlobal._id, actor: adminA, reason: 'SECURITY-CLOSURE-P0-WAVE-1 test', capabilities: [] });

  convPrivateBC = await Conversation.create({ participants: [clientB._id, clientC._id], isStaffInbox: false, lastMessage: null });
  const otherClient = await mkUser();
  convStaffBClient = await Conversation.create({ tenant: fixtureA.tenant._id, participants: [staffB._id, otherClient._id], isStaffInbox: false, lastMessage: null });
  const clientTenantB = await mkUser();
  convTenantB = await Conversation.create({ tenant: fixtureB.tenant._id, participants: [clientTenantB._id], isStaffInbox: true, lastMessage: null });
});

const sendMsg = (conv, actor, tenantId) => request(app).post('/api/messages').set(bearer(actor, tenantId)).send({ conversationId: String(conv._id), content: 'HELLO' });

describe('SECURITY-CLOSURE-P0-WAVE-1 (P0-A) — acteurs SANS autorité (doivent être refusés)', () => {
  test('1. Client A (non-participant) sur conversation privée Client B/C → refusé, aucun Message créé', async () => {
    const res = await sendMsg(convPrivateBC, clientA);
    expect(res.status).not.toBe(201);
    expect(await Message.countDocuments({ conversation: convPrivateBC._id })).toBe(0);
  });

  test('2. Proprietaire A (non-participant) sur conversation privée → refusé', async () => {
    const res = await sendMsg(convPrivateBC, proprietaireA);
    expect(res.status).not.toBe(201);
    expect(await Message.countDocuments({ conversation: convPrivateBC._id })).toBe(0);
  });

  test('3. Client A sur conversation attribuée au tenant B (sans lien) → refusé', async () => {
    const res = await sendMsg(convTenantB, clientA);
    expect(res.status).not.toBe(201);
    expect(await Message.countDocuments({ conversation: convTenantB._id })).toBe(0);
  });

  test('effet de bord : aucune mise à jour de Conversation.lastMessage/unreadCount pour un envoi refusé', async () => {
    await sendMsg(convPrivateBC, clientA);
    const fresh = await Conversation.findById(convPrivateBC._id);
    expect(fresh.lastMessage).toBeNull();
  });
});

describe('SECURITY-CLOSURE-P0-WAVE-1 (P0-A) — acteurs AVEC autorité (préservés, comportement historique)', () => {
  test('4. Conversation client-client héritée sans autorisation → lecture seule', async () => {
    const res = await sendMsg(convPrivateBC, clientB);
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('CONTACT_AUTHORIZATION_REQUIRED');
    expect(await Message.countDocuments({ conversation: convPrivateBC._id })).toBe(0);
  });

  test('5. Staff A de tenant sans autorité plateforme ne contourne pas la médiation', async () => {
    const res = await sendMsg(convStaffBClient, staffA, fixtureA.tenant._id);
    expect(res.status).toBe(403);
  });

  test('6. Admin A de tenant ne reçoit aucun privilège commercial implicite', async () => {
    const res = await sendMsg(convStaffBClient, adminA, fixtureA.tenant._id);
    expect(res.status).toBe(403);
  });

  test('7. PlatformOperator sans platform.commercial.manage reste en lecture seule', async () => {
    const res = await sendMsg(convStaffBClient, poGlobal, fixtureA.tenant._id);
    expect(res.status).toBe(403);
  });
});

describe('SECURITY-CLOSURE-P0-WAVE-1 (P0-A) — non-régression HF-FINAL-01 (tenant, inchangé)', () => {
  test('8. Staff multi-tenant SANS en-tête → refusé (ambigu, HF-FINAL-01 toujours actif)', async () => {
    const res = await sendMsg(convStaffBClient, staffMulti);
    expect(res.status).not.toBe(201);
  });

  test('9. Staff A (tenant A) sur une conversation du tenant B → refusé (tenant croisé)', async () => {
    const res = await sendMsg(convTenantB, staffA, fixtureA.tenant._id);
    expect(res.status).not.toBe(201);
  });

  test('10. En-tête de tenant invalide (aucune adhésion) → refusé', async () => {
    const foreignTenant = await createTenantFixture({ label: 'P0-A C' });
    const res = await sendMsg(convStaffBClient, staffA, foreignTenant.tenant._id);
    expect(res.status).not.toBe(201);
  });
});

describe('SECURITY-CLOSURE-P0-WAVE-1 (P0-A) — side effects sur envoi non autorisé', () => {
  test('11. Zéro notification/Message créé pour un envoi refusé', async () => {
    await sendMsg(convTenantB, clientA);
    expect(await Message.countDocuments({ conversation: convTenantB._id })).toBe(0);
  });

  test('12. receiverId direct ne suffit plus à créer une relation commerciale', async () => {
    const res = await request(app).post('/api/messages').set(bearer(clientB)).send({ receiverId: String(clientC._id), content: 'DIRECT' });
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('COMMERCIAL_CONTEXT_REQUIRED');
    expect(await Message.countDocuments({ sender: clientB._id, receiver: clientC._id })).toBe(0);
  });
});

describe('INTERMEDIATION-C — autorisation commerciale vérifiée à chaque envoi', () => {
  test('autorisation active permet puis révocation bloque le même canal sans effacer son historique', async () => {
    await PlatformOperator.updateOne({ user: poGlobal._id }, { $addToSet: { capabilities: 'platform.commercial.manage' } });
    const propertyId = new (require('mongoose').Types.ObjectId)();
    const dossierId = new (require('mongoose').Types.ObjectId)();
    const authorization = await grantAuthorization({ clientId: clientB._id, representativeId: proprietaireA._id, propertyId, dossierType: 'RealEstateApplication', dossierId, tenantId: null, scopes: ['direct_transactional_messaging'], actor: poGlobal, reason: 'Test route' });
    const conversation = await Conversation.create({ participants: [clientB._id, proprietaireA._id], relatedProperty: propertyId, relatedDossierType: 'RealEstateApplication', relatedDossier: dossierId, channelType: 'commercial_direct' });

    expect((await sendMsg(conversation, clientB)).status).toBe(201);
    await revokeAuthorization({ authorizationId: authorization._id, actor: poGlobal, reason: 'Retrait concurrent' });
    const denied = await sendMsg(conversation, clientB);
    expect(denied.status).toBe(403);
    expect(denied.body.code).toBe('CONTACT_AUTHORIZATION_REQUIRED');
    expect(await Message.countDocuments({ conversation: conversation._id })).toBe(1);
  });
});
