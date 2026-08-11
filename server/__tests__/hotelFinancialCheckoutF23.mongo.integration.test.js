const mongoose = require('mongoose');
const { startFinancialMongo, clearFinancialMongo, stopFinancialMongo } = require('./helpers/financialMongoEnvironment');
const Hotel = require('../models/Hotel'); const HotelReservation = require('../models/HotelReservation'); const RoomCategory = require('../models/RoomCategory'); const Room = require('../models/Room'); const RoomAssignment = require('../models/RoomAssignment'); const HousekeepingTask = require('../models/HousekeepingTask'); const FinancialLedgerEntry = require('../models/FinancialLedgerEntry');
const { performCheckOut } = require('../services/checkOutService');
const { createTenantFixture, tenantActor } = require('./helpers/tenantAwareFixture');
jest.setTimeout(120000); const id = () => new mongoose.Types.ObjectId();
async function fixture() {
  const admin = { id: id(), _id: id(), role: 'Admin' };
  admin._id = admin.id;
  const { tenant } = await createTenantFixture({ label: 'Hotel checkout', bootstrap: admin });
  Object.assign(admin, tenantActor(admin, tenant), { id: admin.id });
  const hotel = await Hotel.create({ name: 'Hôtel F2.3', tenant: tenant._id, manager: id(), createdBy: admin.id });
  const category = await RoomCategory.create({ hotel: hotel._id, name: 'Standard', createdBy: admin.id });
  const room = await Room.create({ hotel: hotel._id, roomCategory: category._id, roomNumber: '101', status: 'occupied', createdBy: admin.id });
  const reservation = await HotelReservation.create({ hotel: hotel._id, roomCategory: category._id, guest: { firstName: 'Ada', lastName: 'Lovelace', email: 'ada@example.test', country: 'CG' }, checkInDate: new Date('2026-09-01'), checkOutDate: new Date('2026-09-02'), roomsCount: 1, adults: 1, unitPrice: 30000, subtotal: 30000, totalAmount: 30000, currency: 'XAF', rateSnapshot: { rateType: 'nightly', amount: 30000, currency: 'XAF' }, status: 'checked_in', source: 'owner_dashboard', createdBy: admin.id });
  await RoomAssignment.create({ reservation: reservation._id, room: room._id, assignedBy: admin.id });
  return { admin, hotel, room, reservation };
}
beforeAll(startFinancialMongo); afterEach(clearFinancialMongo); afterAll(stopFinancialMongo);

test('document absent bloque sans aucune mutation métier', async () => {
  const f = await fixture();
  await expect(performCheckOut({ reservationId: f.reservation._id, actingUser: f.admin, transactionMode: 'transactional' })).rejects.toMatchObject({ code: 'CHECKOUT_BLOCKED_FINANCIAL', statusCode: 409 });
  expect(await HotelReservation.findById(f.reservation._id)).toMatchObject({ status: 'checked_in' }); expect(await Room.findById(f.room._id)).toMatchObject({ status: 'occupied' }); expect(await HousekeepingTask.countDocuments()).toBe(0); expect(await FinancialLedgerEntry.countDocuments({ eventType: 'hotel_checkout.financial_override' })).toBe(0);
});

test('override Admin rend audit, réservation, chambre et housekeeping atomiques sans fait financier artificiel', async () => {
  const f = await fixture();
  const result = await performCheckOut({ reservationId: f.reservation._id, actingUser: f.admin, financialOverride: { requested: true, reason: 'Départ exceptionnel validé par la direction', ticket: 'INC-23' }, transactionMode: 'transactional' });
  expect(result.financialCheckout).toMatchObject({ status: 'overridden', overrideApplied: true });
  expect(await HotelReservation.findById(f.reservation._id)).toMatchObject({ status: 'checked_out' }); expect(await Room.findById(f.room._id)).toMatchObject({ status: 'cleaning' }); expect(await HousekeepingTask.countDocuments({ reservation: f.reservation._id, open: true })).toBe(1); expect(await FinancialLedgerEntry.countDocuments({ entityId: f.reservation._id, eventType: 'hotel_checkout.financial_override' })).toBe(1);
});

test('deux check-outs dérogés simultanés produisent une clôture, une tâche et un audit uniques', async () => {
  const f = await fixture(); const input = { reservationId: f.reservation._id, actingUser: f.admin, financialOverride: { requested: true, reason: 'Départ exceptionnel validé par la direction' }, transactionMode: 'transactional' };
  const results = await Promise.allSettled([performCheckOut(input), performCheckOut(input)]);
  expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1); expect(await HousekeepingTask.countDocuments({ reservation: f.reservation._id })).toBe(1); expect(await FinancialLedgerEntry.countDocuments({ entityId: f.reservation._id, eventType: 'hotel_checkout.financial_override' })).toBe(1); expect(await RoomAssignment.countDocuments({ reservation: f.reservation._id, releasedAt: { $ne: null } })).toBe(1);
});
