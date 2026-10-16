// LOT D — canal opérationnel hôtelier (HTTP réel) : limité à une réservation
// confirmée ou en cours, entre l'invité et le gérant / le staff affecté
// actif ; l'état de la réservation est relu juste avant chaque envoi. Il ne
// crée jamais de canal général de prospection. Aucun envoi réel.
jest.mock('../services/emailService', () => ({ sendEmailViaZoho: jest.fn().mockResolvedValue({ success: true }) }));
jest.mock('../utils/expoPush', () => ({ sendExpoPushNotification: jest.fn().mockResolvedValue(true) }));

const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const { startFinancialMongo, clearFinancialMongo, stopFinancialMongo } = require('./helpers/financialMongoEnvironment');
const User = require('../models/User');
const Hotel = require('../models/Hotel');
const HotelReservation = require('../models/HotelReservation');
const HotelStaffAssignment = require('../models/HotelStaffAssignment');
const Conversation = require('../models/Conversation');
const Message = require('../models/Message');
const { errorHandler } = require('../middleware/errorMiddleware');

jest.setTimeout(180000);
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-hotel-operational';
const app = express(); app.use(express.json());
app.use('/api/conversations', require('../routes/conversationRoutes'));
app.use('/api/messages', require('../routes/messageRoutes'));
app.use(errorHandler);

let n = 0;
const user = (role) => User.create({ name: `Hotel ${role} ${++n}`, email: `hotel-op-${Date.now()}-${n}@example.test`, password: 'Password123!', passwordConfirm: 'Password123!', role, isEmailVerified: true });
const bearer = (u) => ({ Authorization: `Bearer ${jwt.sign({ id: u._id, tokenVersion: 0 }, process.env.JWT_SECRET, { expiresIn: '1d' })}` });

async function stay({ status = 'confirmed' } = {}) {
  const guest = await user('Client');
  const manager = await user('Proprietaire');
  const hotel = await Hotel.collection.insertOne({ name: `Hôtel op ${n}`, manager: manager._id, publicationStatus: 'publie', active: true });
  const reservation = await HotelReservation.collection.insertOne({ hotel: hotel.insertedId, guestUser: guest._id, status });
  return { guest, manager, hotelId: hotel.insertedId, reservationId: reservation.insertedId };
}
const start = (actor, recipient, reservationId) => request(app).post('/api/conversations/start').set(bearer(actor))
  .send({ recipientId: String(recipient._id), dossierType: 'HotelReservation', dossierId: String(reservationId) });
const send = (actor, conversationId, content = 'Message') => request(app).post('/api/messages').set(bearer(actor)).send({ conversationId: String(conversationId), content });

beforeAll(startFinancialMongo);
afterEach(clearFinancialMongo);
afterAll(stopFinancialMongo);

test('invité et gérant d\'une réservation confirmée échangent dans un canal opérationnel', async () => {
  const { guest, manager, reservationId } = await stay();
  const opened = await start(guest, manager, reservationId);
  expect(opened.status).toBe(200);
  const conversation = await Conversation.findOne({ channelType: 'hotel_operational', relatedDossier: reservationId }).lean();
  expect(conversation).not.toBeNull();
  expect((await send(guest, conversation._id, 'Heure d’arrivée : 22h')).status).toBe(201);
  expect((await send(manager, conversation._id, 'Bien noté')).status).toBe(201);
  expect(JSON.stringify(opened.body)).not.toMatch(new RegExp(guest.email.replace('.', '\\.')));
});

test('un staff affecté actif, membre du tenant de l\'hôtel, peut répondre ; un staff révoqué ne le peut plus', async () => {
  const { createTenantFixture, addTenantMember } = require('./helpers/tenantAwareFixture');
  const { tenant, bootstrap } = await createTenantFixture({ label: 'Hôtel opérationnel' });
  const { guest, hotelId, reservationId } = await stay();
  await Hotel.collection.updateOne({ _id: hotelId }, { $set: { tenant: tenant._id } });
  await HotelReservation.collection.updateOne({ _id: reservationId }, { $set: { tenant: tenant._id } });
  const staff = await user('Collaborateur');
  await addTenantMember({ tenant, user: staff, bootstrap, businessRole: 'Collaborateur' });
  await HotelStaffAssignment.collection.insertOne({ user: staff._id, hotel: hotelId, status: 'active', validUntil: null });
  const opened = await start(guest, staff, reservationId);
  expect(opened.status).toBe(200);
  const conversation = await Conversation.findOne({ channelType: 'hotel_operational', relatedDossier: reservationId }).lean();
  expect(String(conversation.tenant)).toBe(String(tenant._id));
  const asStaff = (req) => req.set('X-Platform-Tenant-Id', String(tenant._id));
  expect((await asStaff(send(staff, conversation._id, 'Votre chambre est prête'))).status).toBe(201);
  await HotelStaffAssignment.collection.updateOne({ user: staff._id }, { $set: { status: 'revoked' } });
  expect((await send(guest, conversation._id, 'Merci')).status).toBe(403);
  expect((await asStaff(send(staff, conversation._id, 'Encore là'))).status).toBe(403);
});

test('ni un autre client, ni le gérant d\'un autre hôtel ne peuvent ouvrir le canal d\'une réservation', async () => {
  const { guest, manager, reservationId } = await stay();
  const stranger = await user('Client');
  const otherManager = (await stay()).manager;
  expect((await start(stranger, manager, reservationId)).status).toBeGreaterThanOrEqual(400);
  expect((await start(guest, otherManager, reservationId)).status).toBeGreaterThanOrEqual(400);
  expect(await Conversation.countDocuments({ channelType: 'hotel_operational' })).toBe(0);
});

test('annulation ou séjour terminé : le canal passe en lecture seule, relu juste avant l\'envoi', async () => {
  for (const finalStatus of ['cancelled', 'checked_out']) {
    const { guest, manager, reservationId } = await stay();
    await start(guest, manager, reservationId);
    const conversation = await Conversation.findOne({ channelType: 'hotel_operational', relatedDossier: reservationId }).lean();
    expect((await send(guest, conversation._id, 'Avant')).status).toBe(201);
    await HotelReservation.collection.updateOne({ _id: reservationId }, { $set: { status: finalStatus } });
    const after = await send(manager, conversation._id, 'Offre spéciale pour votre prochain séjour');
    expect(after.status).toBe(403);
  }
  expect(await Message.countDocuments({ content: /Offre spéciale/ })).toBe(0);
});

test('une réservation non confirmée n\'ouvre aucun canal ; le gérant ne peut pas démarcher un client hors réservation', async () => {
  const { guest, manager, reservationId } = await stay({ status: 'pending' });
  expect((await start(guest, manager, reservationId)).status).toBeGreaterThanOrEqual(400);
  const prospecting = await request(app).post('/api/conversations/start').set(bearer(manager)).send({ recipientId: String(guest._id) });
  expect(prospecting.status).toBeGreaterThanOrEqual(400);
  const direct = await request(app).post('/api/messages').set(bearer(manager)).send({ receiverId: String(guest._id), content: 'Promo' });
  expect(direct.status).toBeGreaterThanOrEqual(400);
  expect(await Message.countDocuments()).toBe(0);
  expect(await Conversation.countDocuments({ isStaffInbox: { $ne: true } })).toBe(0);
});
