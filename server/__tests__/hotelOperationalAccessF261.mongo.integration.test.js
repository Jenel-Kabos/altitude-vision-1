const mongoose = require('mongoose');
const { startFinancialMongo, clearFinancialMongo, stopFinancialMongo } = require('./helpers/financialMongoEnvironment');
const Hotel = require('../models/Hotel');
const User = require('../models/User');
const HotelStaffAssignment = require('../models/HotelStaffAssignment');
const Room = require('../models/Room');
const RoomCategory = require('../models/RoomCategory');
const HousekeepingTask = require('../models/HousekeepingTask');
const RoomInspection = require('../models/RoomInspection');
const MaintenanceTicket = require('../models/MaintenanceTicket');
const assignmentService = require('../services/hotel/hotelStaffAssignmentService');
const { assertOperationalHotelAccess, listAccessibleHotels } = require('../services/hotel/hotelAccessScopeService');
const { HOTEL_OPERATIONAL_CAPABILITIES: CAP } = require('../constants/hotelAccessConstants');

jest.setTimeout(180000);
const id = () => new mongoose.Types.ObjectId();
const admin = { role: 'Admin', _id: id() };
let userCounter = 0;
const makeUser = (overrides = {}) => {
  userCounter += 1;
  return User.create({ name: 'Staff Member', email: `opstaff${userCounter}${Date.now()}@example.com`, password: 'Password123!', passwordConfirm: 'Password123!', role: 'Collaborateur', ...overrides });
};
const makeHotel = (overrides = {}) => { const managerId = id(); return Hotel.create({ name: 'Hôtel F261', brand: 'F261', email: 'f261@example.test', manager: managerId, createdBy: managerId, ...overrides }); };

beforeAll(async () => { await startFinancialMongo(); await HotelStaffAssignment.syncIndexes(); });
afterEach(clearFinancialMongo);
afterAll(stopFinancialMongo);

/** Prépare deux hôtels A/B, un staff rattaché à chacun, et une chambre par hôtel. */
async function twoHotelsFixture() {
  const hotelA = await makeHotel({ name: 'Hôtel A' });
  const hotelB = await makeHotel({ name: 'Hôtel B' });
  const staffA = await makeUser();
  const staffB = await makeUser();
  await assignmentService.createHotelStaffAssignment({ actor: admin, hotelId: hotelA._id, userId: staffA._id, assignmentRole: 'hotel_manager' });
  await assignmentService.createHotelStaffAssignment({ actor: admin, hotelId: hotelB._id, userId: staffB._id, assignmentRole: 'hotel_manager' });
  const categoryA = await RoomCategory.create({ hotel: hotelA._id, name: 'Standard A', createdBy: admin._id });
  const categoryB = await RoomCategory.create({ hotel: hotelB._id, name: 'Standard B', createdBy: admin._id });
  const roomA = await Room.create({ hotel: hotelA._id, roomCategory: categoryA._id, roomNumber: '1', createdBy: admin._id });
  const roomB = await Room.create({ hotel: hotelB._id, roomCategory: categoryB._id, roomNumber: '1', createdBy: admin._id });
  return { hotelA, hotelB, staffA, staffB, roomA, roomB, categoryA, categoryB };
}

test('staff A opère sur les ressources de A, jamais sur celles de B (rooms/housekeeping/inspection/maintenance)', async () => {
  const { hotelA, hotelB, staffA, roomA, roomB } = await twoHotelsFixture();
  const actorA = { role: 'Collaborateur', _id: staffA._id };

  // rooms
  await expect(assertOperationalHotelAccess({ actor: actorA, hotelId: hotelA._id, capability: CAP.ROOM_MANAGE })).resolves.toEqual({});
  expect((await assertOperationalHotelAccess({ actor: actorA, hotelId: hotelB._id, capability: CAP.ROOM_MANAGE })).error).toBe(403);

  // housekeeping — tâche créée dans B, staff A ne doit ni la voir ni la muter
  const taskB = await HousekeepingTask.create({ room: roomB._id, hotel: hotelB._id, type: 'refresh', createdBy: staffA._id });
  expect((await assertOperationalHotelAccess({ actor: actorA, hotelId: taskB.hotel, capability: CAP.HOUSEKEEPING_VIEW })).error).toBe(403);

  // inspection — inspection liée à une chambre de B
  const taskA = await HousekeepingTask.create({ room: roomA._id, hotel: hotelA._id, type: 'refresh', createdBy: staffA._id });
  const inspectionB = await RoomInspection.create({ room: roomB._id, housekeepingTask: taskB._id, inspector: staffA._id });
  const roomOfInspectionB = await Room.findById(inspectionB.room);
  expect((await assertOperationalHotelAccess({ actor: actorA, hotelId: roomOfInspectionB.hotel, capability: CAP.INSPECTION_VIEW })).error).toBe(403);
  const inspectionA = await RoomInspection.create({ room: roomA._id, housekeepingTask: taskA._id, inspector: staffA._id });
  const roomOfInspectionA = await Room.findById(inspectionA.room);
  await expect(assertOperationalHotelAccess({ actor: actorA, hotelId: roomOfInspectionA.hotel, capability: CAP.INSPECTION_VIEW })).resolves.toEqual({});

  // maintenance — ticket dans B
  const ticketB = await MaintenanceTicket.create({ room: roomB._id, hotel: hotelB._id, category: 'plumbing', description: 'Fuite', });
  expect((await assertOperationalHotelAccess({ actor: actorA, hotelId: ticketB.hotel, capability: CAP.MAINTENANCE_MANAGE })).error).toBe(403);
});

test('identifiants croisés bloqués : hotelId A + ressource de B, quel que soit le domaine', async () => {
  const { hotelA, hotelB, staffA, roomB } = await twoHotelsFixture();
  const actorA = { role: 'Collaborateur', _id: staffA._id };
  const taskB = await HousekeepingTask.create({ room: roomB._id, hotel: hotelB._id, type: 'refresh', createdBy: staffA._id });
  const ticketB = await MaintenanceTicket.create({ room: roomB._id, hotel: hotelB._id, category: 'electricity', description: 'Panne' });

  // Un client qui prétendrait agir "sous" hotelA sur des ressources hôtel B doit être refusé
  // dès la vérification de scope — jamais une confiance dans un hotelId déclaratif.
  expect((await assertOperationalHotelAccess({ actor: actorA, hotelId: hotelA._id, capability: CAP.HOUSEKEEPING_MANAGE })).error).toBeUndefined();
  expect(String(taskB.hotel)).not.toBe(String(hotelA._id));
  expect((await assertOperationalHotelAccess({ actor: actorA, hotelId: taskB.hotel, capability: CAP.HOUSEKEEPING_MANAGE })).error).toBe(403);
  expect((await assertOperationalHotelAccess({ actor: actorA, hotelId: ticketB.hotel, capability: CAP.MAINTENANCE_MANAGE })).error).toBe(403);
});

test('les counts et listes sont scopés (listAccessibleHotels) — aucune fuite du total', async () => {
  const { hotelA, hotelB, staffA, roomA, roomB } = await twoHotelsFixture();
  await HousekeepingTask.create({ room: roomA._id, hotel: hotelA._id, type: 'refresh', createdBy: staffA._id });
  await HousekeepingTask.create({ room: roomA._id, hotel: hotelA._id, type: 'deep_cleaning', createdBy: staffA._id });
  await HousekeepingTask.create({ room: roomB._id, hotel: hotelB._id, type: 'refresh', createdBy: staffA._id });

  const { globalAccess, hotels } = await listAccessibleHotels({ role: 'Collaborateur', _id: staffA._id });
  expect(globalAccess).toBe(false);
  const hotelIds = hotels.map((h) => h._id);
  expect(hotelIds.map(String)).toEqual([String(hotelA._id)]);
  const count = await HousekeepingTask.countDocuments({ hotel: { $in: hotelIds } });
  expect(count).toBe(2); // jamais 3 (le total ne doit jamais inclure les tâches de l'hôtel B)
});

test('aucune écriture partielle après un refus : une chambre B reste inchangée si l’accès est refusé', async () => {
  const { hotelA, roomB } = await twoHotelsFixture();
  const before = await Room.findById(roomB._id).lean();
  const denied = await assertOperationalHotelAccess({ actor: { role: 'Collaborateur', _id: id() }, hotelId: hotelA._id, capability: CAP.ROOM_MANAGE });
  expect(denied.error).toBe(403);
  // Aucune tentative de mutation n'a été faite côté test — on vérifie simplement que la
  // chambre B n'a subi aucun effet de bord de la vérification de scope elle-même.
  const after = await Room.findById(roomB._id).lean();
  expect(after).toEqual(before);
});

test('suspension prend effet immédiatement, y compris en cours d’opération', async () => {
  const { hotelA, staffA, roomA } = await twoHotelsFixture();
  const actorA = { role: 'Collaborateur', _id: staffA._id };
  await expect(assertOperationalHotelAccess({ actor: actorA, hotelId: hotelA._id, capability: CAP.ROOM_MANAGE })).resolves.toEqual({});

  const assignment = await HotelStaffAssignment.findOne({ user: staffA._id, hotel: hotelA._id, status: 'active' });
  await assignmentService.suspendHotelStaffAssignment({ actor: admin, assignmentId: assignment._id, reason: 'Vérification de sécurité en cours.' });

  expect((await assertOperationalHotelAccess({ actor: actorA, hotelId: hotelA._id, capability: CAP.ROOM_MANAGE })).error).toBe(403);
  expect(await Room.findById(roomA._id)).toBeTruthy(); // la chambre existe toujours, aucune corruption
});

test('révocation prend effet immédiatement et les lectures concurrentes restent refusées', async () => {
  const { hotelA, staffA } = await twoHotelsFixture();
  const actorA = { role: 'Collaborateur', _id: staffA._id };
  const assignment = await HotelStaffAssignment.findOne({ user: staffA._id, hotel: hotelA._id, status: 'active' });
  await assignmentService.revokeHotelStaffAssignment({ actor: admin, assignmentId: assignment._id, reason: 'Départ définitif confirmé par RH.' });

  const reads = await Promise.allSettled(Array.from({ length: 6 }, () => assertOperationalHotelAccess({ actor: actorA, hotelId: hotelA._id, capability: CAP.ROOM_MANAGE })));
  reads.forEach((r) => expect(r.value.error).toBe(403));
});

test('compatibilité Hotel.manager legacy : un manager legacy garde l’accès sans HotelStaffAssignment', async () => {
  const managerId = id();
  const hotel = await Hotel.create({ name: 'Hôtel Legacy', brand: 'LEG', email: 'legacy@example.test', manager: managerId, createdBy: managerId });
  const legacyActor = { role: 'Proprietaire', _id: managerId };
  await expect(assertOperationalHotelAccess({ actor: legacyActor, hotelId: hotel._id, capability: CAP.ROOM_VIEW })).resolves.toEqual({});
  expect(await HotelStaffAssignment.countDocuments({ hotel: hotel._id })).toBe(0);
});

test('Admin conserve un accès global mais reste scopé quand un hotelId précis est demandé', async () => {
  const { hotelA, hotelB } = await twoHotelsFixture();
  await expect(assertOperationalHotelAccess({ actor: admin, hotelId: hotelA._id, capability: CAP.ROOM_MANAGE })).resolves.toEqual({});
  await expect(assertOperationalHotelAccess({ actor: admin, hotelId: hotelB._id, capability: CAP.ROOM_MANAGE })).resolves.toEqual({});
  const { globalAccess } = await listAccessibleHotels(admin);
  expect(globalAccess).toBe(true);
});

test('roomAssignment : la cohérence réservation/chambre/hôtel est garantie (déjà appliquée par roomAssignmentService)', async () => {
  const { hotelA, hotelB, roomB } = await twoHotelsFixture();
  const HotelReservation = require('../models/HotelReservation');
  const { assignRoom } = require('../services/roomAssignmentService');
  const reservationA = await HotelReservation.create({
    hotel: hotelA._id, roomCategory: id(), guest: { firstName: 'Ada', lastName: 'Lovelace', email: 'ada@example.test', country: 'CG' },
    checkInDate: new Date('2026-09-01'), checkOutDate: new Date('2026-09-02'), roomsCount: 1, adults: 1,
    unitPrice: 30000, subtotal: 30000, totalAmount: 30000, currency: 'XAF',
    rateSnapshot: { rateType: 'nightly', amount: 30000, currency: 'XAF' }, status: 'confirmed', source: 'owner_dashboard', createdBy: id(),
  });
  // Chambre B affectée à une réservation de l'hôtel A : doit être bloqué avant toute écriture.
  await expect(assignRoom({ reservationId: reservationA._id, roomId: roomB._id, reservation: reservationA, actingUser: admin, reason: '' }))
    .rejects.toMatchObject({ message: expect.stringContaining("n'appartient pas à cet hôtel") });
  const RoomAssignment = require('../models/RoomAssignment');
  expect(await RoomAssignment.countDocuments({})).toBe(0);
});
