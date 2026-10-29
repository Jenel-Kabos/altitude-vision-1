const mongoose = require('mongoose');
const { startFinancialMongo, stopFinancialMongo } = require('./helpers/financialMongoEnvironment');
const User = require('../models/User');
const PlatformOperator = require('../models/PlatformOperator');
const { grantAuthorization, revokeAuthorization } = require('../services/contactAuthorizationService');
const { evaluateConversationWriteState, assertConversationWritable } = require('../services/messagingAuthorizationService');
const Hotel = require('../models/Hotel');
const HotelReservation = require('../models/HotelReservation');

jest.setTimeout(180000);
let n = 0;
const makeUser = (role) => User.create({ name: `Policy ${++n}`, email: `policy-${n}-${Date.now()}@example.test`, password: 'Password123!', passwordConfirm: 'Password123!', role, isEmailVerified: true });
let operator; let client; let owner; let outsider; let propertyId; let dossierId; let tenantId;
beforeAll(async () => { await startFinancialMongo(); [operator, client, owner, outsider] = await Promise.all([makeUser('Client'), makeUser('Client'), makeUser('Proprietaire'), makeUser('Client')]); propertyId = new mongoose.Types.ObjectId(); dossierId = new mongoose.Types.ObjectId(); tenantId = new mongoose.Types.ObjectId(); await PlatformOperator.create({ user: operator._id, capabilities: ['platform.commercial.manage'], grantedBy: operator._id, grantReason: 'policy' }); });
afterEach(async () => mongoose.models.ContactAuthorization.deleteMany({}));
afterAll(async () => stopFinancialMongo());

const conversation = (overrides = {}) => ({ _id: new mongoose.Types.ObjectId(), participants: [client._id, owner._id], tenant: tenantId, relatedProperty: propertyId, relatedDossierType: 'RealEstateApplication', relatedDossier: dossierId, isStaffInbox: false, ...overrides });
const grant = () => grantAuthorization({ clientId: client._id, representativeId: owner._id, propertyId, dossierType: 'RealEstateApplication', dossierId, tenantId, scopes: ['direct_transactional_messaging'], actor: operator, reason: 'Introduction' });

test('conversation directe sans autorisation est en lecture seule', async () => {
  await expect(evaluateConversationWriteState({ actor: client, conversation: conversation() })).resolves.toMatchObject({ writable: false, code: 'CONTACT_AUTHORIZATION_REQUIRED', channelType: 'commercial_direct' });
});

test('autorisation exacte active permet le canal et une révocation fraîche le rebloque', async () => {
  const authorization = await grant();
  await expect(assertConversationWritable({ actor: client, conversation: conversation() })).resolves.toMatchObject({ writable: true, authorizationId: String(authorization._id) });
  await revokeAuthorization({ authorizationId: authorization._id, actor: operator, reason: 'Retrait' });
  await expect(assertConversationWritable({ actor: client, conversation: conversation() })).rejects.toMatchObject({ code: 'CONTACT_AUTHORIZATION_REQUIRED', statusCode: 403 });
});

test.each([
  ['bien', { relatedProperty: new mongoose.Types.ObjectId() }],
  ['dossier', { relatedDossier: new mongoose.Types.ObjectId() }],
  ['tenant', { tenant: new mongoose.Types.ObjectId() }],
])('autorisation pour un autre %s ne correspond pas', async (_label, mismatch) => {
  await grant();
  await expect(evaluateConversationWriteState({ actor: client, conversation: conversation(mismatch) })).resolves.toMatchObject({ writable: false });
});

test('staff inbox reste inscriptible pour son participant et refuse un tiers', async () => {
  await expect(evaluateConversationWriteState({ actor: client, conversation: conversation({ participants: [client._id], isStaffInbox: true }) })).resolves.toMatchObject({ writable: true, channelType: 'staff_inbox' });
  await expect(evaluateConversationWriteState({ actor: outsider, conversation: conversation({ participants: [client._id], isStaffInbox: true }) })).resolves.toMatchObject({ writable: false });
});

test('nouvelle conversation : générale sans contexte, refusée avec un bien sans dossier commercial', async () => {
  // GIT-INTEGRATION-03A — sans contexte : messagerie générale ; avec un bien
  // mais sans dossier commercial : refusé.
  await expect(evaluateConversationWriteState({ actor: client, receiverId: owner._id })).resolves.toMatchObject({ writable: true, code: 'GENERAL_CONVERSATION' });
  await expect(evaluateConversationWriteState({ actor: client, receiverId: owner._id, propertyId })).resolves.toMatchObject({ writable: false, code: 'COMMERCIAL_CONTEXT_REQUIRED' });
});

test.each(['Admin', 'CommunityManager', 'Collaborateur'])('un staff de tenant %s ne contourne pas la médiation commerciale', async (role) => {
  const tenantStaff = await makeUser(role);
  const direct = conversation({ participants: [client._id, tenantStaff._id] });
  await expect(evaluateConversationWriteState({ actor: tenantStaff, conversation: direct }))
    .resolves.toMatchObject({ writable: false, code: 'CONTACT_AUTHORIZATION_REQUIRED' });
});

test('canal hôtelier opérationnel exige une réservation valide et ses participants', async () => {
  const hotelId = new mongoose.Types.ObjectId();
  const reservationId = new mongoose.Types.ObjectId();
  await Hotel.collection.insertOne({ _id: hotelId, manager: owner._id, tenant: tenantId, name: 'Hôtel test' });
  await HotelReservation.collection.insertOne({ _id: reservationId, hotel: hotelId, guestUser: client._id, status: 'confirmed', tenant: tenantId });
  const operational = conversation({ channelType: 'hotel_operational', relatedDossierType: 'HotelReservation', relatedDossier: reservationId, relatedProperty: null });
  await expect(evaluateConversationWriteState({ actor: client, conversation: operational })).resolves.toMatchObject({ writable: true, channelType: 'hotel_operational' });
  await expect(evaluateConversationWriteState({ actor: outsider, conversation: operational })).resolves.toMatchObject({ writable: false });
  await HotelReservation.collection.updateOne({ _id: reservationId }, { $set: { status: 'cancelled' } });
  await expect(evaluateConversationWriteState({ actor: client, conversation: operational })).resolves.toMatchObject({ writable: false, code: 'HOTEL_RESERVATION_NOT_OPERATIONAL' });
});

