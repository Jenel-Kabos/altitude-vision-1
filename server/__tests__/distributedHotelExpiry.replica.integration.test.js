const mongoose = require('mongoose');
const { startFinancialMongo, clearFinancialMongo, stopFinancialMongo } = require('./helpers/financialMongoEnvironment');

jest.mock('../services/hotelReservationNotificationService', () => ({ notifyReservationGuest: jest.fn().mockResolvedValue() }));
jest.mock('../socket', () => ({ emitHotelEvent: jest.fn().mockResolvedValue() }));

const HotelReservation = require('../models/HotelReservation');
const RoomInventory = require('../models/RoomInventory');
const { expireReservationAtomically } = require('../services/hotelReservationExpiryService');

jest.setTimeout(120000);

beforeAll(async () => {
  await startFinancialMongo();
  await Promise.all([HotelReservation.syncIndexes(), RoomInventory.syncIndexes()]);
});
afterEach(clearFinancialMongo);
afterAll(stopFinancialMongo);

const ids = () => ({ hotel: new mongoose.Types.ObjectId(), category: new mongoose.Types.ObjectId() });

async function seedExpiredReservation() {
  const { hotel, category } = ids();
  const reservation = new mongoose.Types.ObjectId();
  const checkInDate = new Date('2030-02-01T00:00:00.000Z');
  const checkOutDate = new Date('2030-02-02T00:00:00.000Z');
  await HotelReservation.collection.insertOne({
    _id: reservation, hotel, roomCategory: category,
    guest: { firstName: 'Test', lastName: 'Client', email: 'client@example.test' },
    checkInDate, checkOutDate, nights: 1, roomsCount: 1, adults: 1, children: 0,
    unitPrice: 10000, subtotal: 10000, taxes: 0, fees: 0, discount: 0, totalAmount: 10000,
    currency: 'XAF', status: 'pending', source: 'public_web',
    pendingExpiresAt: new Date('2030-01-01T00:00:00.000Z'), statusHistory: [],
    createdAt: new Date(), updatedAt: new Date(),
  });
  await RoomInventory.create({ hotel, roomCategory: category, date: checkInDate, totalUnits: 2, reservedUnits: 2 });
  return { reservation, category };
}

test('deux workers concurrents expirent une seule fois et ne libèrent qu’une unité', async () => {
  const fixture = await seedExpiredReservation();
  const now = new Date('2030-01-02T00:00:00.000Z');
  const results = await Promise.all([
    expireReservationAtomically(fixture.reservation, { now }),
    expireReservationAtomically(fixture.reservation, { now }),
  ]);
  expect(results.filter(Boolean)).toHaveLength(1);
  expect((await HotelReservation.findById(fixture.reservation)).status).toBe('expired');
  expect((await RoomInventory.findOne({ roomCategory: fixture.category })).reservedUnits).toBe(1);
});

test('une panne injectée aprè libération rollbacke statut et inventaire', async () => {
  const fixture = await seedExpiredReservation();
  await expect(expireReservationAtomically(fixture.reservation, {
    now: new Date('2030-01-02T00:00:00.000Z'),
    faultInjector: async () => { throw new Error('simulated_crash'); },
  })).rejects.toThrow('simulated_crash');
  expect((await HotelReservation.findById(fixture.reservation)).status).toBe('pending');
  expect((await RoomInventory.findOne({ roomCategory: fixture.category })).reservedUnits).toBe(2);
});
