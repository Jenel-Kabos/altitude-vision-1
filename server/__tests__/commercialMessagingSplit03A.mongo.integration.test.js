// GIT-INTEGRATION-03A — décision de la direction : deux messageries distinctes.
//   Générale (réseau social) : libre, jamais bloquée sur la base des rôles.
//   Commerciale (bien, dossier, canal commercial) : autorisation de contact
//   accordée par Altitude Vision, vérifiée à chaque envoi ; historique conservé.
// Parcours réels via les routes HTTP (aucun contrôle désactivé).
const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const { startFinancialMongo, clearFinancialMongo, stopFinancialMongo } = require('./helpers/financialMongoEnvironment');
const { createTenantFixture, addTenantMember } = require('./helpers/tenantAwareFixture');
const User = require('../models/User');
const PlatformOperator = require('../models/PlatformOperator');
const Conversation = require('../models/Conversation');
const Message = require('../models/Message');
const ContactAuthorization = require('../models/ContactAuthorization');
const { PLATFORM_VIEW_REQUIRED_CAPABILITIES } = require('../constants/platformOperatorConstants');
const { grantAuthorization, revokeAuthorization } = require('../services/contactAuthorizationService');
const { errorHandler } = require('../middleware/errorMiddleware');

jest.setTimeout(180000);
const app = express();
app.use(express.json());
app.use('/api/messages', require('../routes/messageRoutes'));
app.use('/api/contact-authorizations', require('../routes/contactAuthorizationRoutes'));
app.use(errorHandler);

let seq = 0;
const user = (role = 'Client') => User.create({ name: `Split ${++seq}`, email: `split03a-${seq}-${Date.now()}@example.test`, password: 'Password123!', passwordConfirm: 'Password123!', role, isEmailVerified: true });
const bearer = (value, tenantId) => ({ Authorization: `Bearer ${jwt.sign({ id: value._id, tokenVersion: 0 }, process.env.JWT_SECRET, { expiresIn: '1h' })}`, ...(tenantId ? { 'X-Platform-Tenant-Id': String(tenantId) } : {}) });
const send = (conversation, sender, tenantId) => request(app).post('/api/messages').set(bearer(sender, tenantId)).send({ conversationId: String(conversation._id), content: 'Bonjour' });
const count = (conversation) => Message.countDocuments({ conversation: conversation._id });

let operator; let clientA; let clientB; let owner;
const commercial = (extra = {}) => Conversation.create({
  participants: [clientA._id, owner._id], isStaffInbox: false,
  relatedProperty: new mongoose.Types.ObjectId(), relatedDossierType: 'RealEstateApplication', relatedDossier: new mongoose.Types.ObjectId(), channelType: 'commercial_direct', ...extra,
});
const authorize = (conversation) => grantAuthorization({
  clientId: clientA._id, representativeId: owner._id, propertyId: conversation.relatedProperty, dossierType: conversation.relatedDossierType,
  dossierId: conversation.relatedDossier, tenantId: conversation.tenant || null, scopes: ['direct_transactional_messaging'], actor: operator, reason: 'Mise en relation validée',
});

beforeAll(async () => {
  await startFinancialMongo();
  await Promise.all([Conversation.syncIndexes(), Message.syncIndexes(), ContactAuthorization.syncIndexes()]);
});
afterAll(stopFinancialMongo);
beforeEach(async () => {
  await clearFinancialMongo();
  [operator, clientA, clientB, owner] = await Promise.all([user('Admin'), user(), user(), user('Proprietaire')]);
  await PlatformOperator.create({ user: operator._id, capabilities: [...PLATFORM_VIEW_REQUIRED_CAPABILITIES], grantedBy: operator._id, grantReason: 'Test 03A' });
});

describe('messagerie générale', () => {
  test('1. deux utilisateurs ordinaires échangent dans une conversation générale', async () => {
    const conversation = await Conversation.create({ participants: [clientA._id, clientB._id], isStaffInbox: false });
    expect((await send(conversation, clientA)).status).toBe(201);
    expect((await send(conversation, clientB)).status).toBe(201);
    expect(await count(conversation)).toBe(2);
  });

  test('2. propriétaire et client échangent hors contexte commercial : les rôles seuls ne bloquent pas', async () => {
    const conversation = await Conversation.create({ participants: [clientA._id, owner._id], isStaffInbox: false });
    expect((await send(conversation, clientA)).status).toBe(201);
    expect((await send(conversation, owner)).status).toBe(201);
  });

  test('10. compatibilité : une conversation générale héritée (sans nouveaux champs) reste utilisable, y compris par envoi direct', async () => {
    const legacy = await Conversation.collection.insertOne({ participants: [clientA._id, owner._id], isStaffInbox: false, lastMessage: 'Ancien', unreadCount: {}, createdAt: new Date(), updatedAt: new Date() });
    expect((await send({ _id: legacy.insertedId }, owner)).status).toBe(201);
    const direct = await request(app).post('/api/messages').set(bearer(clientA)).send({ receiverId: String(owner._id), content: 'Direct général' });
    expect(direct.status).toBe(201);
  });
});

describe('messagerie commerciale', () => {
  test('3/4. conversation liée à une annonce et à un dossier sans autorisation → envoi refusé', async () => {
    const conversation = await commercial();
    const res = await send(conversation, clientA);
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('CONTACT_AUTHORIZATION_REQUIRED');
    expect(await count(conversation)).toBe(0);
    const propertyOnly = await Conversation.create({ participants: [clientA._id, owner._id], isStaffInbox: false, relatedProperty: new mongoose.Types.ObjectId() });
    expect((await send(propertyOnly, owner)).status).toBe(403);
  });

  test('5/7. autorisation exacte → échanges permis ; révocation → nouveaux envois refusés', async () => {
    const conversation = await commercial();
    const authorization = await authorize(conversation);
    expect((await send(conversation, clientA)).status).toBe(201);
    expect((await send(conversation, owner)).status).toBe(201);
    await revokeAuthorization({ authorizationId: authorization._id, actor: operator, reason: 'Fin de la mise en relation' });
    const denied = await send(conversation, owner);
    expect(denied.status).toBe(403);
    expect(denied.body.code).toBe('CONTACT_AUTHORIZATION_REQUIRED');
    expect(await count(conversation)).toBe(2);
  });

  test('6. historique conservé et lisible par les participants après blocage', async () => {
    const conversation = await commercial();
    await Message.create([{ sender: clientA._id, receiver: owner._id, conversation: conversation._id, content: 'Avant la règle' }]);
    expect((await send(conversation, clientA)).status).toBe(403);
    const history = await request(app).get(`/api/messages/${conversation._id}`).set(bearer(owner));
    expect(history.status).toBe(200);
    expect(JSON.stringify(history.body)).toContain('Avant la règle');
    expect(await count(conversation)).toBe(1);
  });

  test('8. un membre d’un autre tenant ne peut pas écrire dans une conversation commerciale du tenant A', async () => {
    const [fixtureA, fixtureB] = [await createTenantFixture({ label: '03A A' }), await createTenantFixture({ label: '03A B' })];
    const staffB = await user('Collaborateur');
    await addTenantMember({ tenant: fixtureB.tenant, user: staffB, bootstrap: fixtureB.bootstrap });
    const conversation = await commercial({ tenant: fixtureA.tenant._id });
    await authorize(conversation);
    const res = await send(conversation, staffB, fixtureB.tenant._id);
    expect([403, 404]).toContain(res.status);
    expect(await count(conversation)).toBe(0);
  });

  test('envoi direct par receiverId : ne contourne jamais une conversation commerciale existante', async () => {
    await commercial();
    const res = await request(app).post('/api/messages').set(bearer(owner)).send({ receiverId: String(clientA._id), content: 'Hors Altitude Vision' });
    expect(res.status).toBe(403);
    expect(await Message.countDocuments({ sender: owner._id })).toBe(0);
  });
});

describe('autorisations de contact', () => {
  test('9. ni propriétaire, ni client, ni utilisateur sans capacité ne peuvent octroyer ou révoquer', async () => {
    const conversation = await commercial();
    const payload = { clientId: clientA._id, representativeId: owner._id, propertyId: conversation.relatedProperty, dossierType: 'RealEstateApplication', dossierId: conversation.relatedDossier, scopes: ['direct_transactional_messaging'], reason: 'Auto-octroi' };
    for (const actor of [owner, clientA, clientB]) {
      expect((await request(app).post('/api/contact-authorizations').set(bearer(actor)).send(payload)).status).toBe(403);
    }
    const authorization = await authorize(conversation);
    for (const actor of [owner, clientA]) {
      expect((await request(app).patch(`/api/contact-authorizations/${authorization._id}/revoke`).set(bearer(actor)).send({ reason: 'Retrait' })).status).toBe(403);
    }
    expect(await ContactAuthorization.findById(authorization._id).lean()).toMatchObject({ status: 'active' });
    const granted = await request(app).post('/api/contact-authorizations').set(bearer(operator)).send({ ...payload, dossierId: new mongoose.Types.ObjectId(), reason: 'Validation Altitude Vision' });
    expect(granted.status).toBe(201);
  });
});
