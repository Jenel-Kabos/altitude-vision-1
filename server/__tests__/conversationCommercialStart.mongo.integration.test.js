const mongoose = require('mongoose');
const { startFinancialMongo, clearFinancialMongo, stopFinancialMongo } = require('./helpers/financialMongoEnvironment');
const User = require('../models/User');
const Conversation = require('../models/Conversation');
const Hotel = require('../models/Hotel');
const HotelReservation = require('../models/HotelReservation');
const PlatformOperator = require('../models/PlatformOperator');
const { grantAuthorization, revokeAuthorization } = require('../services/contactAuthorizationService');
const { startConversation } = require('../controllers/conversationController');

jest.setTimeout(180000);
let sequence = 0;
const user = (role = 'Client') => User.create({
  name: `Start ${++sequence}`, email: `start-${sequence}-${Date.now()}@example.test`,
  password: 'Password123!', passwordConfirm: 'Password123!', role, isEmailVerified: true,
});
const response = () => {
  const res = { statusCode: 200, body: null };
  res.status = jest.fn((code) => { res.statusCode = code; return res; });
  res.json = jest.fn((body) => { res.body = body; return res; });
  return res;
};

beforeAll(startFinancialMongo);
beforeEach(clearFinancialMongo);
afterAll(stopFinancialMongo);

test('crée un canal hôtelier opérationnel depuis une réservation confirmée réelle', async () => {
  const guest = await user('Client');
  const manager = await user('Proprietaire');
  const hotel = await Hotel.collection.insertOne({ name: 'Hôtel canal', manager: manager._id });
  const reservation = await HotelReservation.collection.insertOne({ hotel: hotel.insertedId, guestUser: guest._id, status: 'confirmed' });
  const res = response();

  await startConversation({ user: { id: guest._id, _id: guest._id, role: guest.role }, body: {
    recipientId: manager._id, dossierType: 'HotelReservation', dossierId: reservation.insertedId,
  } }, res);

  expect(res.statusCode).toBe(200);
  expect(await Conversation.findOne({ channelType: 'hotel_operational', relatedDossier: reservation.insertedId })).not.toBeNull();
});

test('ne réutilise jamais une conversation d’un autre dossier pour la même paire', async () => {
  const actor = await user('Admin'); const client = await user('Client'); const owner = await user('Proprietaire');
  await PlatformOperator.create({ user: actor._id, capabilities: ['platform.commercial.manage'], grantedBy: actor._id, grantReason: 'test' });
  const propertyId = new mongoose.Types.ObjectId();
  const dossiers = [new mongoose.Types.ObjectId(), new mongoose.Types.ObjectId()];
  for (const dossierId of dossiers) await grantAuthorization({ clientId: client._id, representativeId: owner._id, propertyId, dossierType: 'RealEstateApplication', dossierId, tenantId: null, scopes: ['direct_transactional_messaging'], actor, reason: 'test' });
  for (const dossierId of dossiers) await startConversation({ user: { id: client._id, _id: client._id, role: client.role }, body: { recipientId: owner._id, propertyId, dossierType: 'RealEstateApplication', dossierId } }, response());
  expect(await Conversation.countDocuments({ participants: { $all: [client._id, owner._id] } })).toBe(2);
});

test('une révocation intercalée avant create empêche la conversation protégée', async () => {
  const actor = await user('Admin'); const client = await user('Client'); const owner = await user('Proprietaire');
  await PlatformOperator.create({ user: actor._id, capabilities: ['platform.commercial.manage'], grantedBy: actor._id, grantReason: 'test' });
  const propertyId = new mongoose.Types.ObjectId(); const dossierId = new mongoose.Types.ObjectId();
  const authorization = await grantAuthorization({ clientId: client._id, representativeId: owner._id, propertyId, dossierType: 'RealEstateApplication', dossierId, tenantId: null, scopes: ['direct_transactional_messaging'], actor, reason: 'test' });
  const original = Conversation.findOne.bind(Conversation);
  const spy = jest.spyOn(Conversation, 'findOne').mockImplementationOnce(async () => {
    await revokeAuthorization({ authorizationId: authorization._id, actor, reason: 'concurrent' });
    return null;
  });
  const res = response();
  await startConversation({ user: { id: client._id, _id: client._id, role: client.role }, body: { recipientId: owner._id, propertyId, dossierType: 'RealEstateApplication', dossierId } }, res);
  spy.mockRestore();
  expect(res.statusCode).toBe(403);
  expect(await original({ participants: { $all: [client._id, owner._id] } })).toBeNull();
});
