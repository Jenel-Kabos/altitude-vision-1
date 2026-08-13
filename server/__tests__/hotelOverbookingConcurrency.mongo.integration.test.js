// HM-1 — Phase 3/13 : le seul test de concurrence existant sur
// createReservation (hotelReservationsCD1) rejoue la MÊME clé d'idempotence
// 20 fois — il vérifie la déduplication, pas l'anti-surbooking. Ici, deux
// réservations DIFFÉRENTES (clés distinctes) se disputent la dernière unité
// disponible : au plus une doit réussir, jamais deux occupant la même unité
// physique le même soir.

const mongoose = require('mongoose');
const { startFinancialMongo, clearFinancialMongo, stopFinancialMongo } = require('./helpers/financialMongoEnvironment');
const Hotel = require('../models/Hotel');
const RoomCategory = require('../models/RoomCategory');
const RatePlan = require('../models/RatePlan');
const HotelReservation = require('../models/HotelReservation');
const RoomInventory = require('../models/RoomInventory');
const { createReservation } = require('../services/hotelReservationService');

jest.setTimeout(120000);
const id = () => new mongoose.Types.ObjectId();

beforeAll(async () => {
  await startFinancialMongo();
  await Promise.all([HotelReservation, RoomInventory, RoomCategory, RatePlan].map((model) => model.syncIndexes()));
});
afterEach(clearFinancialMongo);
afterAll(stopFinancialMongo);

async function fixtureWithOneUnit() {
  const actor = { id: id(), role: 'Admin' };
  const hotel = await Hotel.create({ name: 'Hôtel Surbooking', manager: actor.id, createdBy: actor.id });
  const category = await RoomCategory.create({ hotel: hotel._id, name: 'Standard', code: 'STD', unitsAvailable: 1, createdBy: actor.id });
  const rate = await RatePlan.create({ roomCategory: category._id, rateType: 'public', amount: 35000, currency: 'XAF', createdBy: actor.id });
  return { actor, hotel, category, rate };
}

test('deux réservations concurrentes différentes sur la dernière unité : une seule réussit', async () => {
  const f = await fixtureWithOneUnit();
  const base = {
    hotelId: f.hotel._id, roomCategoryId: f.category._id, ratePlanId: f.rate._id,
    guest: { firstName: 'Ada', lastName: 'Lovelace', email: 'ada@example.test' },
    checkInDate: '2026-10-10', checkOutDate: '2026-10-12', roomsCount: 1, adults: 1, children: 0,
    source: 'public_web', actingUser: {},
    notificationDependencies: { emailSender: jest.fn().mockResolvedValue({ success: true }) },
  };

  const results = await Promise.allSettled([
    createReservation({ ...base, reservationRequestId: 'overbook-a' }),
    createReservation({ ...base, reservationRequestId: 'overbook-b' }),
  ]);

  const fulfilled = results.filter((r) => r.status === 'fulfilled');
  expect(fulfilled).toHaveLength(1);
  expect(results.find((r) => r.status === 'rejected')?.reason?.statusCode).toBe(409);

  const inventory = await RoomInventory.findOne({ roomCategory: f.category._id, date: new Date('2026-10-10T00:00:00.000Z') });
  expect(inventory.reservedUnits).toBe(1);
  expect(await HotelReservation.countDocuments({ hotel: f.hotel._id })).toBe(1);
});
