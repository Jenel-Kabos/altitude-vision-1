// LOT N — fiabilité des notifications et assainissement de leur visibilité
// historique (suite du correctif P0 SUPPORT-INBOX).
//
// 1. Visibilité : les notifications de la boîte de support (`new_staff_message`,
//    aperçu du message d'un prospect) reçues AVANT le correctif par du staff
//    d'organisation ne sont plus exposées. Filtre à la LECTURE (aucune purge,
//    aucune migration, aucune écriture sur ces documents) : seul un agent
//    `platform.support.read` actif, relu à chaque requête, les voit.
// 2. Fiabilité : la notification persistante d'un destinataire ne dépend plus
//    de la disponibilité de Socket.IO (auparavant `getIO()` levait avant
//    `notify()` dans le même bloc et la notification était perdue).
jest.mock('../utils/expoPush', () => ({ sendExpoPushNotification: jest.fn().mockResolvedValue(undefined) }));
jest.mock('../services/emailService', () => new Proxy({}, { get: () => jest.fn().mockResolvedValue(undefined) }));

const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const { startFinancialMongo, stopFinancialMongo } = require('./helpers/financialMongoEnvironment');
const { createTenantFixture, createTenantUser } = require('./helpers/tenantAwareFixture');
const operatorService = require('../services/platformOperator/platformOperatorService');
const User = require('../models/User');
const Conversation = require('../models/Conversation');
const Message = require('../models/Message');
const Notification = require('../models/Notification');
const PlatformOperator = require('../models/PlatformOperator');
const { errorHandler } = require('../middleware/errorMiddleware');

jest.setTimeout(240000);

const app = express();
app.use(express.json());
app.use('/api/notifications', require('../routes/notificationRoutes'));
app.use('/api/messages', require('../routes/messageRoutes'));
app.use(errorHandler);

const bearer = (user) => ({ Authorization: `Bearer ${jwt.sign({ id: user._id, tokenVersion: 0 }, process.env.JWT_SECRET, { expiresIn: '1d' })}` });
let seq = 0;
const makeUser = (label, over = {}) => {
  seq += 1;
  return User.create({
    name: `LOTN ${label} ${seq}`, email: `lotn-${label}-${seq}-${Date.now()}@example.test`,
    password: 'Password123!', passwordConfirm: 'Password123!', role: 'Client', isEmailVerified: true, ...over,
  });
};
const legacyInboxNotification = (recipient, conversation, tenant) => Notification.create({
  recipient: recipient._id, platformTenant: tenant?._id || null, type: 'new_staff_message', audience: 'staff',
  title: 'Prospect', body: 'APERCU-PROSPECT-CONFIDENTIEL', data: { conversationId: String(conversation._id) },
});

const S = {};
beforeAll(async () => {
  await startFinancialMongo();
  S.fx = await createTenantFixture({ label: 'LOTN X', withAdminMembership: true });
  ({ user: S.orgStaff } = await createTenantUser({ tenant: S.fx.tenant, bootstrap: S.fx.bootstrap, overrides: { role: 'Collaborateur' }, businessRole: 'Collaborateur' }));
  S.prospect = await makeUser('prospect');
  S.inbox = await Conversation.create({ isStaffInbox: true, tenant: S.fx.tenant._id, participants: [S.prospect._id], lastMessage: 'Bonjour' });
  S.agent = await makeUser('agent');
  await operatorService.provisionPrivilegedOperator({ userId: S.agent._id, actor: S.fx.bootstrap, reason: 'fixture', capabilities: ['platform.support.read', 'platform.support.reply'] });
});
afterAll(stopFinancialMongo);

describe('Lot N — visibilité historique des notifications de la boîte de support', () => {
  test('le staff d’organisation ne voit plus ses anciennes notifications de support (liste, compteur, non-lus)', async () => {
    const legacy = await legacyInboxNotification(S.orgStaff, S.inbox, S.fx.tenant);
    const ordinary = await Notification.create({ recipient: S.orgStaff._id, type: 'visite_new', title: 'Visite', body: 'Nouvelle visite' });

    const list = await request(app).get('/api/notifications').set(bearer(S.orgStaff));
    expect(list.status).toBe(200);
    const ids = list.body.data.notifications.map((n) => String(n._id));
    expect(ids).toContain(String(ordinary._id));
    expect(ids).not.toContain(String(legacy._id));
    expect(JSON.stringify(list.body)).not.toContain('APERCU-PROSPECT-CONFIDENTIEL');
    expect(list.body.data.unreadCount).toBe(1);
    expect(list.body.data.pagination.total).toBe(1);

    const unread = await request(app).get('/api/notifications?filter=unread').set(bearer(S.orgStaff));
    expect(unread.body.data.notifications.map((n) => String(n._id))).not.toContain(String(legacy._id));

    const count = await request(app).get('/api/notifications/count').set(bearer(S.orgStaff));
    expect(count.body.data.count).toBe(1);
  });

  test('aucun accès par identifiant (lecture/suppression → 404) et aucune mutation des documents masqués (read-all, clear)', async () => {
    const staff = (await createTenantUser({ tenant: S.fx.tenant, bootstrap: S.fx.bootstrap, overrides: { role: 'Admin' }, businessRole: 'Admin' })).user;
    const legacy = await legacyInboxNotification(staff, S.inbox, S.fx.tenant);
    const legacyRead = await Notification.create({
      recipient: staff._id, type: 'new_staff_message', title: 'Prospect', body: 'APERCU-PROSPECT-CONFIDENTIEL', read: true,
      data: { conversationId: String(S.inbox._id) },
    });

    const markRead = await request(app).patch(`/api/notifications/${legacy._id}/read`).set(bearer(staff));
    expect(markRead.status).toBe(404);
    expect(JSON.stringify(markRead.body)).not.toContain('APERCU-PROSPECT-CONFIDENTIEL');
    expect((await request(app).delete(`/api/notifications/${legacy._id}`).set(bearer(staff))).status).toBe(404);

    await request(app).patch('/api/notifications/read-all').set(bearer(staff));
    await request(app).delete('/api/notifications').set(bearer(staff));

    const after = await Notification.findById(legacy._id).lean();
    expect(after).not.toBeNull();
    expect(after.read).toBe(false); // jamais modifiée
    expect(await Notification.findById(legacyRead._id).lean()).not.toBeNull(); // jamais supprimée
  });

  test('un agent support actif voit ses notifications de support ; révoqué → masquées immédiatement', async () => {
    const own = await legacyInboxNotification(S.agent, S.inbox, null);
    const visible = await request(app).get('/api/notifications').set(bearer(S.agent));
    expect(visible.body.data.notifications.map((n) => String(n._id))).toContain(String(own._id));

    await PlatformOperator.updateOne({ user: S.agent._id }, { $pull: { capabilities: 'platform.support.read' } });
    const hidden = await request(app).get('/api/notifications').set(bearer(S.agent));
    expect(hidden.body.data.notifications.map((n) => String(n._id))).not.toContain(String(own._id));
    await PlatformOperator.updateOne({ user: S.agent._id }, { $addToSet: { capabilities: 'platform.support.read' } });
  });

  test('le prospect conserve ses notifications de réponse (message_staff) et les autres types restent inchangés', async () => {
    const reply = await Notification.create({ recipient: S.prospect._id, type: 'message_staff', title: 'Altitude Vision', body: 'Réponse', data: { conversationId: String(S.inbox._id) } });
    const res = await request(app).get('/api/notifications').set(bearer(S.prospect));
    expect(res.body.data.notifications.map((n) => String(n._id))).toContain(String(reply._id));
    expect((await request(app).patch(`/api/notifications/${reply._id}/read`).set(bearer(S.prospect))).status).toBe(200);
  });
});

describe('Lot N — fiabilité : notification persistante indépendante de Socket.IO', () => {
  test('réponse d’un agent : le prospect reçoit sa notification même sans Socket.IO initialisé', async () => {
    const conv = await Conversation.create({ isStaffInbox: true, tenant: null, participants: [S.prospect._id], lastMessage: 'Question' });
    await Message.create({ conversation: conv._id, sender: S.prospect._id, receiver: null, content: 'Question', tenant: null });
    const before = await Notification.countDocuments({ recipient: S.prospect._id, type: 'message_staff', 'data.conversationId': String(conv._id) });

    const res = await request(app).post('/api/messages').set(bearer(S.agent)).send({ conversationId: String(conv._id), content: 'Réponse Altitude Vision' });
    expect(res.status).toBe(201);

    let after = before;
    for (let attempt = 0; attempt < 40 && after === before; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 50));
      after = await Notification.countDocuments({ recipient: S.prospect._id, type: 'message_staff', 'data.conversationId': String(conv._id) });
    }
    expect(after).toBe(before + 1);
  });
});
