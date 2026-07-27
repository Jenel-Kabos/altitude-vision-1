jest.mock('../services/emailService', () => ({ sendEmailViaZoho: jest.fn().mockResolvedValue({ success: true }) }));

const mongoose = require('mongoose');
const { startFinancialMongo, clearFinancialMongo, stopFinancialMongo } = require('./helpers/financialMongoEnvironment');
const Hotel = require('../models/Hotel'); const RoomCategory = require('../models/RoomCategory'); const RatePlan = require('../models/RatePlan'); const HotelReservation = require('../models/HotelReservation'); const RoomInventory = require('../models/RoomInventory'); const Room = require('../models/Room'); const RoomAssignment = require('../models/RoomAssignment'); const HousekeepingTask = require('../models/HousekeepingTask');
const { createReservation } = require('../services/hotelReservationService');
const { assignRoom, autoAssignRooms, changeRoom } = require('../services/roomAssignmentService');
const { performCheckIn } = require('../services/checkInService'); const { performCheckOut } = require('../services/checkOutService');
const RoomInspection = require('../models/RoomInspection'); const MaintenanceTicket = require('../models/MaintenanceTicket'); const HotelReservationNotification = require('../models/HotelReservationNotification');
const { startTask, completeTask } = require('../services/housekeepingService'); const { createInspection, approveInspection, rejectInspection } = require('../services/inspectionService'); const { createTicket, resolveTicket } = require('../services/maintenanceService');

jest.setTimeout(120000); const id = () => new mongoose.Types.ObjectId();
async function fixture({ units = 3 } = {}) {
  const actor = { id: id(), role: 'Admin' };
  const hotel = await Hotel.create({ name: 'Hôtel C/D.1', manager: actor.id, createdBy: actor.id });
  const category = await RoomCategory.create({ hotel: hotel._id, name: 'Standard', code: 'STD', unitsAvailable: units, createdBy: actor.id });
  const rate = await RatePlan.create({ roomCategory: category._id, rateType: 'public', amount: 35000, currency: 'XAF', createdBy: actor.id });
  return { actor, hotel, category, rate };
}
const reservationInput = (f, key) => ({ hotelId: f.hotel._id, roomCategoryId: f.category._id, ratePlanId: f.rate._id, guest: { firstName: 'Ada', lastName: 'Lovelace', email: 'ada@example.test' }, checkInDate: '2026-09-10', checkOutDate: '2026-09-13', roomsCount: 2, adults: 2, children: 0, source: 'public_web', actingUser: {}, reservationRequestId: key });

beforeAll(async () => {
  await startFinancialMongo();
  await Promise.all([HotelReservation, RoomInventory, RoomAssignment, Room, RoomCategory, RatePlan, HousekeepingTask, RoomInspection, MaintenanceTicket, HotelReservationNotification].map((model) => model.syncIndexes()));
});
afterEach(clearFinancialMongo); afterAll(stopFinancialMongo);

test('20 créations concurrentes avec la même clé créent une réservation et une consommation', async () => {
  const f = await fixture(); const input = reservationInput(f, 'mobile-retry-001');
  const results = await Promise.all(Array.from({ length: 20 }, () => createReservation(input)));
  expect(new Set(results.map((item) => String(item._id))).size).toBe(1);
  expect(await HotelReservation.countDocuments()).toBe(1);
  const nights = await RoomInventory.find({ roomCategory: f.category._id });
  expect(nights).toHaveLength(3); expect(nights.every((item) => item.reservedUnits === 2)).toBe(true);
});

test('même clé avec payload différent renvoie RESERVATION_IDEMPOTENCY_CONFLICT', async () => {
  const f = await fixture(); const input = reservationInput(f, 'conflict-001'); await createReservation(input);
  await expect(createReservation({ ...input, adults: 3 })).rejects.toMatchObject({ code: 'RESERVATION_IDEMPOTENCY_CONFLICT', statusCode: 409 });
});

test('C29 réel : un séjour traversant deux périodes persiste son détail tarifaire nuit par nuit', async () => {
  const f = await fixture({ units: 2 });
  f.rate.seasonalPeriods = [
    { label: 'Vacances', startDate: '2026-09-01', endDate: '2026-09-30', amount: 50000, priority: 10 },
    { label: 'Festival', startDate: '2026-09-11', endDate: '2026-09-12', amount: 85000, priority: 20 },
  ];
  await f.rate.save();
  const reservation = await createReservation({ ...reservationInput(f, 'seasonal-001'), roomsCount: 1 });
  const stored = await HotelReservation.findById(reservation._id);
  expect(stored.rateSnapshot.nightlyRates.map((night) => night.amount)).toEqual([50000, 85000, 50000]);
  expect(stored.rateSnapshot.nightlyRates[1]).toMatchObject({ periodLabel: 'Festival', priority: 20 });
  expect(stored.subtotal).toBe(185000); expect(stored.totalAmount).toBe(185000);
});

test('multichambre : auto-affectation, changement avant/après arrivée et check-out atomique', async () => {
  const f = await fixture();
  const rooms = await Room.create(['101', '102', '103', '104'].map((roomNumber) => ({ hotel: f.hotel._id, roomCategory: f.category._id, roomNumber, createdBy: f.actor.id })));
  const reservation = await createReservation(reservationInput(f, 'ops-001')); reservation.status = 'confirmed'; await reservation.save();
  let assignments = await autoAssignRooms({ reservationId: reservation._id, reservation, actingUser: f.actor, transactionMode: 'transactional' });
  expect(assignments).toHaveLength(2);
  await changeRoom({ reservationId: reservation._id, oldRoomId: assignments[0].room, newRoomId: rooms[2]._id, reservation, actingUser: f.actor, transactionMode: 'transactional' });
  let checkedIn = await performCheckIn({ reservationId: reservation._id, actingUser: f.actor, transactionMode: 'transactional' });
  expect(checkedIn.rooms).toHaveLength(2); expect(await Room.countDocuments({ status: 'occupied' })).toBe(2);
  assignments = await RoomAssignment.find({ reservation: reservation._id, releasedAt: null });
  const replacement = await Room.findOne({ _id: { $nin: assignments.map((item) => item.room) }, status: 'available' });
  const currentReservation = await HotelReservation.findById(reservation._id);
  await changeRoom({ reservationId: reservation._id, oldRoomId: assignments[0].room, newRoomId: replacement._id, reservation: currentReservation, actingUser: f.actor, transactionMode: 'transactional' });
  const result = await performCheckOut({ reservationId: reservation._id, actingUser: f.actor, financialOverride: { requested: true, reason: 'Départ de test validé par la direction' }, transactionMode: 'transactional' });
  expect(result.rooms).toHaveLength(2); expect(await RoomAssignment.countDocuments({ reservation: reservation._id, releasedAt: null })).toBe(0);
  expect(await HousekeepingTask.countDocuments({ reservation: reservation._id, type: 'refresh' })).toBe(1);
  expect(await HousekeepingTask.countDocuments({ reservation: reservation._id, type: 'checkout_cleaning' })).toBe(2);
});

test('E2E C/D.1.1 : maintenance urgente, ménage, inspections, départ anticipé et cohérence finale', async () => {
  const f = await fixture({ units: 6 });
  const rooms = await Room.create(['201', '202', '203', '204', '205', '206'].map((roomNumber, index) => ({ hotel: f.hotel._id, roomCategory: f.category._id, roomNumber, floor: index < 3 ? 2 : 3, createdBy: f.actor.id })));
  const input = reservationInput(f, 'e2e-cd11');
  const reservation = await createReservation(input); const retry = await createReservation(input);
  expect(String(retry._id)).toBe(String(reservation._id)); expect(await HotelReservation.countDocuments({ reservationRequestId: 'e2e-cd11' })).toBe(1);
  reservation.status = 'confirmed'; await reservation.save();
  let assignments = await autoAssignRooms({ reservationId: reservation._id, reservation, actingUser: f.actor, transactionMode: 'transactional' });
  await changeRoom({ reservationId: reservation._id, oldRoomId: assignments[0].room, newRoomId: rooms[2]._id, reservation, actingUser: f.actor, transactionMode: 'transactional' });
  await performCheckIn({ reservationId: reservation._id, actingUser: f.actor, transactionMode: 'transactional' });
  assignments = await RoomAssignment.find({ reservation: reservation._id, releasedAt: null });
  const urgentRoomId = assignments[0].room; const replacement = await Room.findOne({ _id: { $nin: assignments.map((item) => item.room) }, status: 'available' });
  const urgentTicket = await createTicket({ roomId: urgentRoomId, hotelId: f.hotel._id, category: 'other', priority: 'urgent', description: 'Incident urgent pendant le séjour', actingUser: f.actor, transactionMode: 'transactional' });
  expect((await HotelReservation.findById(reservation._id)).requiresRoomReassignment).toBe(true);
  await changeRoom({ reservationId: reservation._id, oldRoomId: urgentRoomId, newRoomId: replacement._id, reservation: await HotelReservation.findById(reservation._id), actingUser: f.actor, transactionMode: 'transactional' });
  const correctiveTask = await HousekeepingTask.findOne({ room: urgentRoomId, open: true }); expect(correctiveTask).toBeTruthy();
  await startTask({ taskId: correctiveTask._id, actingUser: f.actor }); await completeTask({ taskId: correctiveTask._id, actingUser: f.actor, transactionMode: 'transactional' });
  const failedInspection = await createInspection({ roomId: urgentRoomId, housekeepingTaskId: correctiveTask._id, inspectorId: f.actor.id, actingUser: f.actor });
  await rejectInspection({ inspectionId: failedInspection._id, actingUser: f.actor, notes: 'Correction supplémentaire requise', transactionMode: 'transactional' });
  await resolveTicket({ ticketId: urgentTicket._id, actingUser: f.actor });
  const finalInspection = await createInspection({ roomId: urgentRoomId, housekeepingTaskId: correctiveTask._id, inspectorId: f.actor.id, actingUser: f.actor });
  await approveInspection({ inspectionId: finalInspection._id, actingUser: f.actor, transactionMode: 'transactional' });
  expect((await Room.findById(urgentRoomId)).status).toBe('available');
  const checkout = await performCheckOut({ reservationId: reservation._id, actingUser: f.actor, financialOverride: { requested: true, reason: 'Départ anticipé autorisé pour scénario complet' }, transactionMode: 'transactional' });
  expect(checkout.rooms).toHaveLength(2);
  const checkoutTasks = await HousekeepingTask.find({ reservation: reservation._id, open: true }); expect(checkoutTasks).toHaveLength(2);
  for (const task of checkoutTasks) { // eslint-disable-next-line no-await-in-loop
    await startTask({ taskId: task._id, actingUser: f.actor }); // eslint-disable-next-line no-await-in-loop
    await completeTask({ taskId: task._id, actingUser: f.actor, transactionMode: 'transactional' }); // eslint-disable-next-line no-await-in-loop
    const inspection = await createInspection({ roomId: task.room, housekeepingTaskId: task._id, inspectorId: f.actor.id, actingUser: f.actor }); // eslint-disable-next-line no-await-in-loop
    await approveInspection({ inspectionId: inspection._id, actingUser: f.actor, transactionMode: 'transactional' });
  }
  expect(await Room.countDocuments({ _id: { $in: checkout.rooms.map((room) => room._id) }, status: 'available' })).toBe(2);
  expect(await RoomAssignment.countDocuments({ reservation: reservation._id, releasedAt: null })).toBe(0);
  expect(await RoomAssignment.countDocuments({ reservation: reservation._id })).toBeGreaterThan(2);
  expect((await RoomInventory.find({ roomCategory: f.category._id })).every((row) => row.reservedUnits === 0 && row.physicalBlockedUnits === 0)).toBe(true);
  const notificationKeys = await HotelReservationNotification.distinct('eventKey', { reservation: reservation._id }); expect(new Set(notificationKeys).size).toBe(notificationKeys.length);
});
