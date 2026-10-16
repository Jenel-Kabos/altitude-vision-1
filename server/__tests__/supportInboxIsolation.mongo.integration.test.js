// P0 — ISOLATION DE LA BOÎTE DE SUPPORT ALTITUDE VISION.
//
// Décision métier : la boîte de support commercial (conversations
// `isStaffInbox`) appartient exclusivement à Altitude Vision. Aucun membre
// d'une organisation cliente (Admin, Collaborateur, CommunityManager…) ne la
// liste, ne la lit, n'y répond, n'en télécharge les pièces jointes, n'en
// rejoint les salons Socket.IO ni n'en reçoit les notifications — y compris
// pour un prospect intéressé par un bien de sa propre organisation, et pour
// les prospects `tenant: null`.
//
// L'autorité est un PlatformOperator actif détenant la capacité exacte,
// relue à chaque accès : `platform.support.read` (lecture) et
// `platform.support.reply` (réponse). Aucun envoi réel (Zoho, Expo simulés ;
// téléchargement distant simulé).
jest.mock('../services/emailService', () => ({ sendEmailViaZoho: jest.fn().mockResolvedValue({ success: true }) }));
jest.mock('../utils/expoPush', () => ({ sendExpoPushNotification: jest.fn().mockResolvedValue(true) }));
jest.mock('../services/storage/documentStreamingService', () => ({
  streamRemoteDocument: jest.fn(({ res }) => res.status(200).send('ok')),
}));

const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const { startFinancialMongo, clearFinancialMongo, stopFinancialMongo } = require('./helpers/financialMongoEnvironment');
const { createTenantFixture, addTenantMember } = require('./helpers/tenantAwareFixture');
const User = require('../models/User');
const PlatformOperator = require('../models/PlatformOperator');
const Conversation = require('../models/Conversation');
const Message = require('../models/Message');
const Notification = require('../models/Notification');
const { canAccessConversation, canWriteConversation } = require('../socket');
const { errorHandler } = require('../middleware/errorMiddleware');

jest.setTimeout(240000);
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-support-inbox';
const app = express();
app.use(express.json());
app.use('/api/conversations', require('../routes/conversationRoutes'));
app.use('/api/messages', require('../routes/messageRoutes'));
app.use(errorHandler);

let n = 0;
const makeUser = (role) => User.create({ name: `Support ${role} ${++n}`, email: `support-inbox-${Date.now()}-${n}@example.test`, password: 'Password123!', passwordConfirm: 'Password123!', role, isEmailVerified: true });
const bearer = (user, tenant) => ({
  Authorization: `Bearer ${jwt.sign({ id: user._id, tokenVersion: 0 }, process.env.JWT_SECRET, { expiresIn: '1d' })}`,
  ...(tenant ? { 'X-Platform-Tenant-Id': String(tenant._id) } : {}),
});
const makeAgent = async (capabilities) => {
  const agent = await makeUser('Client');
  await PlatformOperator.create({ user: agent._id, status: 'active', capabilities, grantedBy: agent._id, grantReason: 'TEST DATA support inbox' });
  return agent;
};

let S;
async function seed() {
  const { tenant: tenantX, bootstrap: bootX } = await createTenantFixture({ label: 'Support Org X' });
  const { tenant: tenantY, bootstrap: bootY } = await createTenantFixture({ label: 'Support Org Y' });
  const orgX = {};
  for (const role of ['Admin', 'Collaborateur', 'CommunityManager']) {
    orgX[role] = await makeUser(role);
    await addTenantMember({ tenant: tenantX, user: orgX[role], bootstrap: bootX, businessRole: role });
  }
  const orgYCollab = await makeUser('Collaborateur');
  await addTenantMember({ tenant: tenantY, user: orgYCollab, bootstrap: bootY, businessRole: 'Collaborateur' });
  const prospect = await makeUser('Client');
  const prospectNull = await makeUser('Client');
  // Conversation de support d'un prospect intéressé par un bien de X : la
  // provenance (tenant X) est conservée, mais n'ouvre aucun accès à X.
  const convX = await Conversation.create({ participants: [prospect._id], isStaffInbox: true, tenant: tenantX._id, lastMessage: 'Je souhaite visiter', unreadCount: { staff: 1 } });
  const convNull = await Conversation.create({ participants: [prospectNull._id], isStaffInbox: true, tenant: null, lastMessage: 'Question générale', unreadCount: { staff: 1 } });
  const msgX = await Message.create({ sender: prospect._id, receiver: null, conversation: convX._id, content: 'Mon numéro privé', tenant: tenantX._id, attachments: [{ url: 'https://example.invalid/piece.pdf', nom: 'piece.pdf', type: 'file' }] });
  await Message.create({ sender: prospectNull._id, receiver: null, conversation: convNull._id, content: 'Bonjour', tenant: null });
  S = { tenantX, tenantY, orgX, orgYCollab, prospect, prospectNull, convX, convNull, msgX };
}

beforeAll(startFinancialMongo);
beforeEach(seed);
afterEach(clearFinancialMongo);
afterAll(stopFinancialMongo);

const orgSurfaces = (user, tenant, conv, msg) => [
  ['liste de la boîte', () => request(app).get('/api/conversations/staff-inbox').set(bearer(user, tenant))],
  ['détail conversation', () => request(app).get(`/api/conversations/${conv._id}`).set(bearer(user, tenant))],
  ['messages (route conversations)', () => request(app).get(`/api/conversations/${conv._id}/messages`).set(bearer(user, tenant))],
  ['messages (route héritée /api/messages/:id)', () => request(app).get(`/api/messages/${conv._id}`).set(bearer(user, tenant))],
  ['réponse', () => request(app).post('/api/messages').set(bearer(user, tenant)).send({ conversationId: String(conv._id), content: 'Appelez-moi directement' })],
  ['marquer comme lu', () => request(app).patch(`/api/conversations/${conv._id}/mark-read`).set(bearer(user, tenant))],
  ['suppression', () => request(app).delete(`/api/conversations/${conv._id}`).set(bearer(user, tenant))],
  ...(msg ? [['pièce jointe', () => request(app).get(`/api/messages/${msg._id}/attachments/${msg.attachments[0]._id}`).set(bearer(user, tenant))]] : []),
];

describe('Organisations clientes : aucun accès à la boîte de support', () => {
  test.each(['Admin', 'Collaborateur', 'CommunityManager'])(
    '%s de l\'organisation X : refus sur toutes les surfaces, même pour un prospect de son bien',
    async (role) => {
      const user = S.orgX[role];
      for (const [label, call] of orgSurfaces(user, S.tenantX, S.convX, S.msgX)) {
        const res = await call();
        if (label === 'liste de la boîte') expect([label, res.status]).toEqual([label, 403]);
        else expect([label, res.status >= 400 && res.status < 500 && res.status !== 401]).toEqual([label, true]);
      }
      expect(await Message.countDocuments({ content: 'Appelez-moi directement' })).toBe(0);
      expect(await Conversation.exists({ _id: S.convX._id })).not.toBeNull();
    },
  );

  test('collaborateur d\'une autre organisation : refus sur le prospect de X et sur le prospect tenant:null', async () => {
    for (const conv of [S.convX, S.convNull]) {
      for (const [label, call] of orgSurfaces(S.orgYCollab, S.tenantY, conv, conv === S.convX ? S.msgX : null)) {
        const res = await call();
        expect([label, res.status, res.status >= 400 && res.status < 500 && res.status !== 401]).toEqual([label, res.status, true]);
      }
    }
    expect(await Message.countDocuments({ content: 'Appelez-moi directement' })).toBe(0);
  });

  test('collaborateur de X : refus sur le prospect tenant:null', async () => {
    for (const [label, call] of orgSurfaces(S.orgX.Collaborateur, S.tenantX, S.convNull)) {
      const res = await call();
      expect([label, res.status >= 400 && res.status < 500 && res.status !== 401]).toEqual([label, true]);
    }
  });

  test('Socket.IO : aucun salon ni écriture pour un membre d\'organisation', async () => {
    const asSocketUser = (user) => ({ _id: user._id, role: user.role });
    expect(await canAccessConversation(asSocketUser(S.orgX.Collaborateur), String(S.convX._id), String(S.tenantX._id))).toBe(false);
    expect(await canAccessConversation(asSocketUser(S.orgX.Admin), String(S.convX._id), String(S.tenantX._id))).toBe(false);
    expect(await canAccessConversation(asSocketUser(S.orgYCollab), String(S.convNull._id), String(S.tenantY._id))).toBe(false);
    expect(await canWriteConversation(asSocketUser(S.orgX.Collaborateur), String(S.convX._id), String(S.tenantX._id))).toBe(false);
  });

  test('compteur de non-lus : la boîte centrale n\'est jamais comptée pour une organisation', async () => {
    const res = await request(app).get('/api/conversations/count/unread').set(bearer(S.orgX.Collaborateur, S.tenantX));
    expect(res.status).toBe(200);
    expect(res.body.data.unreadCount).toBe(0);
  });

  test('notifications : un nouveau message de prospect n\'atteint que les agents de support, jamais l\'organisation', async () => {
    const agent = await makeAgent(['platform.support.read', 'platform.support.reply']);
    const res = await request(app).post('/api/messages').set(bearer(S.prospect)).send({ conversationId: String(S.convX._id), content: 'Toujours intéressé' });
    expect(res.status).toBe(201);
    await new Promise((resolve) => setTimeout(resolve, 200));
    const orgIds = Object.values(S.orgX).map((u) => u._id);
    expect(await Notification.countDocuments({ recipient: { $in: orgIds } })).toBe(0);
    expect(await Notification.countDocuments({ recipient: agent._id, type: 'new_staff_message' })).toBe(1);
  });
});

describe('Agents de support Altitude Vision', () => {
  test('agent habilité (support.read + support.reply, sans capacité commerciale ni Vue plateforme) : liste tous les prospects, lit, répond', async () => {
    const agent = await makeAgent(['platform.support.read', 'platform.support.reply']);
    const list = await request(app).get('/api/conversations/staff-inbox').set(bearer(agent));
    expect(list.status).toBe(200);
    const ids = JSON.stringify(list.body);
    expect(ids).toContain(String(S.convX._id));
    expect(ids).toContain(String(S.convNull._id));
    expect((await request(app).get(`/api/messages/${S.convX._id}`).set(bearer(agent))).status).toBe(200);
    expect((await request(app).get(`/api/messages/${S.msgX._id}/attachments/${S.msgX.attachments[0]._id}`).set(bearer(agent))).status).toBe(200);
    const reply = await request(app).post('/api/messages').set(bearer(agent)).send({ conversationId: String(S.convX._id), content: 'Un conseiller vous rappelle' });
    expect(reply.status).toBe(201);
    // La réponse est adressée au prospect (participant), jamais à un tiers.
    // NB : en test, Socket.IO n'est pas initialisé ; `getIO()` lève avant
    // `notify()` dans le même bloc (fragilité préexistante, consignée).
    expect(await Message.exists({ conversation: S.convX._id, sender: agent._id, receiver: S.prospect._id })).not.toBeNull();
    const asSocketUser = { _id: agent._id, role: agent.role };
    expect(await canAccessConversation(asSocketUser, String(S.convX._id), null)).toBe(true);
    expect(await canWriteConversation(asSocketUser, String(S.convNull._id), null)).toBe(true);
  });

  test('agent en lecture seule (support.read sans support.reply) : lit mais ne répond pas', async () => {
    const reader = await makeAgent(['platform.support.read']);
    expect((await request(app).get('/api/conversations/staff-inbox').set(bearer(reader))).status).toBe(200);
    expect((await request(app).get(`/api/messages/${S.convNull._id}`).set(bearer(reader))).status).toBe(200);
    const reply = await request(app).post('/api/messages').set(bearer(reader)).send({ conversationId: String(S.convNull._id), content: 'Réponse non habilitée' });
    expect(reply.status).toBe(403);
    expect(await Message.countDocuments({ content: 'Réponse non habilitée' })).toBe(0);
  });

  test('opérateur sans capacité de support (ex. commercial uniquement) : refus', async () => {
    const commercial = await makeAgent(['platform.commercial.manage']);
    expect((await request(app).get('/api/conversations/staff-inbox').set(bearer(commercial))).status).toBe(403);
    expect((await request(app).get(`/api/messages/${S.convX._id}`).set(bearer(commercial))).status).toBe(403);
    const reply = await request(app).post('/api/messages').set(bearer(commercial)).send({ conversationId: String(S.convX._id), content: 'Hors support' });
    expect(reply.status).toBe(403);
  });

  test.each(['suspended', 'revoked'])('habilitation %s : refus immédiat (liste, lecture, réponse, socket)', async (status) => {
    const agent = await makeAgent(['platform.support.read', 'platform.support.reply']);
    expect((await request(app).get('/api/conversations/staff-inbox').set(bearer(agent))).status).toBe(200);
    await PlatformOperator.updateOne({ user: agent._id }, { status });
    expect((await request(app).get('/api/conversations/staff-inbox').set(bearer(agent))).status).toBe(403);
    expect((await request(app).get(`/api/messages/${S.convX._id}`).set(bearer(agent))).status).toBe(403);
    const reply = await request(app).post('/api/messages').set(bearer(agent)).send({ conversationId: String(S.convX._id), content: 'Après révocation' });
    expect(reply.status).toBe(403);
    expect(await Message.countDocuments({ content: 'Après révocation' })).toBe(0);
    expect(await canAccessConversation({ _id: agent._id, role: agent.role }, String(S.convX._id), null)).toBe(false);
  });
});

describe('Non-régression des flux légitimes', () => {
  test('le prospect lit et écrit dans sa propre conversation de support', async () => {
    expect((await request(app).get(`/api/messages/${S.convX._id}`).set(bearer(S.prospect))).status).toBe(200);
    const res = await request(app).post('/api/messages').set(bearer(S.prospect)).send({ conversationId: String(S.convX._id), content: 'Encore une question' });
    expect(res.status).toBe(201);
    expect((await request(app).get('/api/conversations/my-inbox').set(bearer(S.prospect))).status).toBe(200);
  });

  test('un prospect ne lit pas la conversation de support d\'un autre prospect', async () => {
    expect((await request(app).get(`/api/messages/${S.convNull._id}`).set(bearer(S.prospect))).status).toBe(403);
  });
});
