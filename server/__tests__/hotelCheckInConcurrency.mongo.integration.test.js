// HM-1 — Phase 4/13 : aucun test existant ne vérifiait empiriquement le
// double check-in concurrent (le double check-out l'est déjà, voir
// hotelFinancialCheckoutF23.mongo.integration.test.js). performCheckInCore
// lit HotelReservation.status === 'confirmed' sans le réclamer atomiquement
// — la protection réelle attendue est la transition atomique de Room
// (findOneAndUpdate avec garde de statut) côté performCheckInCore, utilisée
// en mode 'auto' (session réelle) comme le fait le contrôleur HTTP réel.

const mongoose = require('mongoose');
const { startFinancialMongo, clearFinancialMongo, stopFinancialMongo } = require('./helpers/financialMongoEnvironment');
const Hotel = require('../models/Hotel');
const RoomCategory = require('../models/RoomCategory');
const RatePlan = require('../models/RatePlan');
const HotelReservation = require('../models/HotelReservation');
const Room = require('../models/Room');
const RoomAssignment = require('../models/RoomAssignment');
const RoomInventory = require('../models/RoomInventory');
const { createReservation } = require('../services/hotelReservationService');
const { autoAssignRooms } = require('../services/roomAssignmentService');
const { performCheckIn } = require('../services/checkInService');

jest.setTimeout(120000);
const id = () => new mongoose.Types.ObjectId();

beforeAll(async () => {
  await startFinancialMongo();
  await Promise.all([HotelReservation, RoomInventory, RoomAssignment, Room, RoomCategory, RatePlan].map((model) => model.syncIndexes()));
});
afterEach(clearFinancialMongo);
afterAll(stopFinancialMongo);

async function fixture() {
  const actor = { id: id(), role: 'Admin' };
  const hotel = await Hotel.create({ name: 'Hôtel Check-in Concurrence', manager: actor.id, createdBy: actor.id });
  const category = await RoomCategory.create({ hotel: hotel._id, name: 'Standard', code: 'STD', unitsAvailable: 1, createdBy: actor.id });
  const rate = await RatePlan.create({ roomCategory: category._id, rateType: 'public', amount: 35000, currency: 'XAF', createdBy: actor.id });
  await Room.create({ hotel: hotel._id, roomCategory: category._id, roomNumber: '101', createdBy: actor.id });
  return { actor, hotel, category, rate };
}

test('deux check-in concurrents sur la même réservation : une seule chambre passe occupied, un seul historique', async () => {
  const f = await fixture();
  const reservation = await createReservation({
    hotelId: f.hotel._id, roomCategoryId: f.category._id, ratePlanId: f.rate._id,
    guest: { firstName: 'Ada', lastName: 'Lovelace', email: 'ada@example.test' },
    checkInDate: '2026-09-10', checkOutDate: '2026-09-13', roomsCount: 1, adults: 1, children: 0,
    source: 'public_web', actingUser: {}, reservationRequestId: 'checkin-race-001',
    notificationDependencies: { emailSender: jest.fn().mockResolvedValue({ success: true }) },
  });
  reservation.status = 'confirmed';
  await reservation.save();
  await autoAssignRooms({ reservationId: reservation._id, reservation, actingUser: f.actor, transactionMode: 'transactional' });

  const results = await Promise.allSettled([
    performCheckIn({ reservationId: reservation._id, actingUser: f.actor, transactionMode: 'auto', notificationDependencies: { emailSender: jest.fn().mockResolvedValue({ success: true }) } }),
    performCheckIn({ reservationId: reservation._id, actingUser: f.actor, transactionMode: 'auto', notificationDependencies: { emailSender: jest.fn().mockResolvedValue({ success: true }) } }),
  ]);

  expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
  const final = await HotelReservation.findById(reservation._id);
  expect(final.status).toBe('checked_in');
  expect(final.statusHistory.filter((h) => h.to === 'checked_in')).toHaveLength(1);
  expect(await Room.countDocuments({ hotel: f.hotel._id, status: 'occupied' })).toBe(1);
});
