// __tests__/hotelOperationsRoutes.test.js — Sprint D
// Sécurité et routage HTTP des endpoints Chambres/Room Assignment/Check-in/
// Check-out. Modèles + services mockés (même convention que
// hotelReservationRoutes.test.js, Sprint C).

jest.mock('../models/Hotel');
jest.mock('../models/RoomCategory');
jest.mock('../models/Room');
jest.mock('../models/RoomAssignment');
jest.mock('../models/HotelReservation');
jest.mock('../models/User');
jest.mock('../services/roomAssignmentService');
jest.mock('../services/checkInService');
jest.mock('../services/checkOutService');
jest.mock('../services/hotelAvailabilityService');
jest.mock('../services/hotelReservationService');
jest.mock('../config/db', () => jest.fn());
jest.mock('node-cron', () => ({ schedule: jest.fn() }));
jest.mock('../scripts/sync-facebook', () => ({ syncFacebook: jest.fn() }));
jest.mock('../services/zohoImapService', () => ({ pollZohoInbox: jest.fn() }));
jest.mock('../services/alerteService', () => ({ verifierPaiementsEnRetard: jest.fn() }));
jest.mock('../services/platformTenant/tenantContextService', () => ({
  resolveAvailableTenantsForUser: jest.fn().mockResolvedValue([{ _id: '607f1f77bcf86cd799439001' }]),
  resolveEffectiveTenantContext: jest.fn().mockResolvedValue({ tenant: { _id: '607f1f77bcf86cd799439001' }, source: 'membership' }),
  resolveTenantScope: jest.fn().mockResolvedValue({ scopeUserIds: new Set(['507f1f77bcf86cd799439011', '507f1f77bcf86cd799439012']) }),
}));
jest.mock('../services/platformTenant/tenantResourceAttributionService', () => ({
  assertResourceTenant: jest.fn().mockResolvedValue({ status: 'resolved', tenantId: '607f1f77bcf86cd799439001' }),
  resolveResourceTenant: jest.fn().mockResolvedValue({ status: 'resolved', tenantId: '607f1f77bcf86cd799439001' }),
}));
jest.mock('../services/hotel/hotelAccessScopeService', () => ({
  resolveHotelAccessScope: jest.fn(({ actor }) => {
    if (actor?.role === 'Admin' || String(actor?._id || actor?.id) === '507f1f77bcf86cd799439011') {
      return Promise.resolve({ globalAccess: false, hotelIds: ['707f1f77bcf86cd799439055'] });
    }
    return Promise.reject(new Error('Accès refusé'));
  }),
  assertOperationalHotelAccess: jest.fn(({ actor }) => Promise.resolve(
    actor?.role === 'Admin' || String(actor?._id || actor?.id) === '507f1f77bcf86cd799439011' ? {} : { error: 403 },
  )),
  listAccessibleHotels: jest.fn().mockResolvedValue({ globalAccess: false, hotels: [] }),
}));
jest.mock('../utils/generateSitemap', () => jest.fn().mockResolvedValue('<xml/>'));
jest.mock('../services/notificationService', () => ({
  notify: jest.fn().mockResolvedValue(), notifyStaff: jest.fn().mockResolvedValue(), notifyMany: jest.fn().mockResolvedValue(),
}));
jest.mock('../config/cloudinary', () => ({
  ...jest.requireActual('../config/cloudinary'),
  destroyFromCloudinary: jest.fn().mockResolvedValue(),
}));

const request = require('supertest');
const jwt = require('jsonwebtoken');
const { app } = require('../server');
const Hotel = require('../models/Hotel');
const RoomCategory = require('../models/RoomCategory');
const Room = require('../models/Room');
const RoomAssignment = require('../models/RoomAssignment');
const HotelReservation = require('../models/HotelReservation');
const User = require('../models/User');
const roomAssignmentService = require('../services/roomAssignmentService');
const { performCheckIn } = require('../services/checkInService');
const { performCheckOut } = require('../services/checkOutService');

const OWNER_ID = '507f1f77bcf86cd799439011';
const OTHER_OWNER_ID = '507f1f77bcf86cd799439099';
const ADMIN_ID = '507f1f77bcf86cd799439012';
const CLIENT_ID = '507f1f77bcf86cd799439033';
const HOTEL_ID = '707f1f77bcf86cd799439055';
const CATEGORY_ID = '807f1f77bcf86cd799439066';
const RESERVATION_ID = '907f1f77bcf86cd799439077';
const ROOM_ID = 'a07f1f77bcf86cd799439088';
const OTHER_ROOM_ID = 'a07f1f77bcf86cd799439099';

HotelReservation.ALLOWED_TRANSITIONS = {
  pending: ['confirmed', 'rejected', 'cancelled', 'expired'],
  confirmed: ['cancelled', 'checked_in'],
  checked_in: ['checked_out'],
  checked_out: [], cancelled: [], expired: [], rejected: [],
};

const makeToken = (id) => jwt.sign({ id, tokenVersion: 0 }, process.env.JWT_SECRET, { expiresIn: '1d' });
const fakeUser = (id, role) => ({ _id: id, id, name: 'Test User', email: 't@a.com', role, isActive: true, status: 'Actif', tokenVersion: 0 });
const mockUserAuth = (id, role) => {
  User.findById = jest.fn().mockReturnValue({ select: jest.fn().mockResolvedValue(fakeUser(id, role)) });
  User.findByIdAndUpdate = jest.fn().mockReturnValue({ catch: jest.fn() });
};

describe('GET /api/hotels/:hotelId/rooms — tableau des chambres (Sprint D)', () => {
  afterEach(() => jest.clearAllMocks());

  test("403 — un propriétaire tiers ne peut pas consulter les chambres d'un hôtel qui n'est pas le sien", async () => {
    mockUserAuth(OTHER_OWNER_ID, 'Proprietaire');
    Hotel.findById = jest.fn().mockResolvedValue({ _id: HOTEL_ID, manager: OWNER_ID });
    const res = await request(app).get(`/api/hotels/${HOTEL_ID}/rooms`).set('Authorization', `Bearer ${makeToken(OTHER_OWNER_ID)}`);
    expect(res.statusCode).toBe(403);
  });

  test('200 — le propriétaire de l\'hôtel consulte ses chambres', async () => {
    mockUserAuth(OWNER_ID, 'Proprietaire');
    Hotel.findById = jest.fn().mockResolvedValue({ _id: HOTEL_ID, manager: OWNER_ID });
    Room.find = jest.fn().mockReturnValue({
      populate: jest.fn().mockReturnThis(),
      sort: jest.fn().mockResolvedValue([{ _id: ROOM_ID, roomNumber: '101', toObject: () => ({ _id: ROOM_ID, roomNumber: '101' }) }]),
    });
    RoomAssignment.find = jest.fn().mockReturnValue({ populate: jest.fn().mockResolvedValue([]) });
    const res = await request(app).get(`/api/hotels/${HOTEL_ID}/rooms`).set('Authorization', `Bearer ${makeToken(OWNER_ID)}`);
    expect(res.statusCode).toBe(200);
    expect(res.body.data.rooms[0].roomNumber).toBe('101');
  });

  test('401 sans jeton', async () => {
    const res = await request(app).get(`/api/hotels/${HOTEL_ID}/rooms`);
    expect(res.statusCode).toBe(401);
  });
});

describe('POST /api/hotels/:hotelId/rooms — création (Sprint D)', () => {
  afterEach(() => jest.clearAllMocks());

  test('403 — un propriétaire tiers ne peut pas créer de chambre', async () => {
    mockUserAuth(OTHER_OWNER_ID, 'Proprietaire');
    Hotel.findById = jest.fn().mockResolvedValue({ _id: HOTEL_ID, manager: OWNER_ID });
    const res = await request(app).post(`/api/hotels/${HOTEL_ID}/rooms`).set('Authorization', `Bearer ${makeToken(OTHER_OWNER_ID)}`).send({ roomNumber: '101', roomCategoryId: CATEGORY_ID });
    expect(res.statusCode).toBe(403);
  });

  test('201 — le propriétaire crée une chambre pour son hôtel', async () => {
    mockUserAuth(OWNER_ID, 'Proprietaire');
    Hotel.findById = jest.fn().mockResolvedValue({ _id: HOTEL_ID, manager: OWNER_ID });
    RoomCategory.findOne = jest.fn().mockResolvedValue({ _id: CATEGORY_ID, hotel: HOTEL_ID });
    Room.create = jest.fn().mockResolvedValue({ _id: ROOM_ID, roomNumber: '101' });
    const res = await request(app).post(`/api/hotels/${HOTEL_ID}/rooms`).set('Authorization', `Bearer ${makeToken(OWNER_ID)}`).send({ roomNumber: '101', roomCategoryId: CATEGORY_ID });
    expect(res.statusCode).toBe(201);
  });

  test('409 — numéro de chambre déjà pris pour cet hôtel', async () => {
    mockUserAuth(OWNER_ID, 'Proprietaire');
    Hotel.findById = jest.fn().mockResolvedValue({ _id: HOTEL_ID, manager: OWNER_ID });
    RoomCategory.findOne = jest.fn().mockResolvedValue({ _id: CATEGORY_ID, hotel: HOTEL_ID });
    const dup = new Error('duplicate'); dup.code = 11000;
    Room.create = jest.fn().mockRejectedValue(dup);
    const res = await request(app).post(`/api/hotels/${HOTEL_ID}/rooms`).set('Authorization', `Bearer ${makeToken(OWNER_ID)}`).send({ roomNumber: '101', roomCategoryId: CATEGORY_ID });
    expect(res.statusCode).toBe(409);
  });
});

describe('DELETE /api/hotels/rooms/:id — suppression (Sprint D)', () => {
  afterEach(() => jest.clearAllMocks());

  test("409 — impossible de supprimer une chambre actuellement affectée", async () => {
    mockUserAuth(OWNER_ID, 'Proprietaire');
    Room.findById = jest.fn().mockResolvedValue({ _id: ROOM_ID, hotel: HOTEL_ID });
    Hotel.findById = jest.fn().mockResolvedValue({ _id: HOTEL_ID, manager: OWNER_ID });
    RoomAssignment.findOne = jest.fn().mockResolvedValue({ _id: 'ASSIGN-1' });
    const res = await request(app).delete(`/api/hotels/rooms/${ROOM_ID}`).set('Authorization', `Bearer ${makeToken(OWNER_ID)}`);
    expect(res.statusCode).toBe(409);
  });

  test('200 — suppression physique réussie : aucune affectation active ET aucun historique', async () => {
    mockUserAuth(OWNER_ID, 'Proprietaire');
    Room.findById = jest.fn().mockResolvedValue({ _id: ROOM_ID, hotel: HOTEL_ID, status: 'available' });
    Hotel.findById = jest.fn().mockResolvedValue({ _id: HOTEL_ID, manager: OWNER_ID });
    RoomAssignment.findOne = jest.fn().mockResolvedValue(null);
    RoomAssignment.exists = jest.fn().mockResolvedValue(false);
    Room.findByIdAndDelete = jest.fn().mockResolvedValue({});
    const res = await request(app).delete(`/api/hotels/rooms/${ROOM_ID}`).set('Authorization', `Bearer ${makeToken(OWNER_ID)}`);
    expect(res.statusCode).toBe(200);
    expect(Room.findByIdAndDelete).toHaveBeenCalledWith(ROOM_ID);
  });

  test("409 — chambre occupée refusée même sans document RoomAssignment actif retrouvé (garde défensive)", async () => {
    mockUserAuth(OWNER_ID, 'Proprietaire');
    Room.findById = jest.fn().mockResolvedValue({ _id: ROOM_ID, hotel: HOTEL_ID, status: 'occupied' });
    Hotel.findById = jest.fn().mockResolvedValue({ _id: HOTEL_ID, manager: OWNER_ID });
    RoomAssignment.findOne = jest.fn().mockResolvedValue(null);
    const res = await request(app).delete(`/api/hotels/rooms/${ROOM_ID}`).set('Authorization', `Bearer ${makeToken(OWNER_ID)}`);
    expect(res.statusCode).toBe(409);
  });

  test('200 — chambre avec historique (affectations libérées) : archivée (active=false), jamais supprimée physiquement', async () => {
    mockUserAuth(OWNER_ID, 'Proprietaire');
    const room = { _id: ROOM_ID, hotel: HOTEL_ID, status: 'available', roomNumber: '101', save: jest.fn().mockResolvedValue() };
    Room.findById = jest.fn().mockResolvedValue(room);
    Hotel.findById = jest.fn().mockResolvedValue({ _id: HOTEL_ID, manager: OWNER_ID });
    RoomAssignment.findOne = jest.fn().mockResolvedValue(null);
    RoomAssignment.exists = jest.fn().mockResolvedValue(true);
    Room.findByIdAndDelete = jest.fn();
    const res = await request(app).delete(`/api/hotels/rooms/${ROOM_ID}`).set('Authorization', `Bearer ${makeToken(OWNER_ID)}`);
    expect(res.statusCode).toBe(200);
    expect(res.body.data.archived).toBe(true);
    expect(room.active).toBe(false);
    expect(room.save).toHaveBeenCalled();
    expect(Room.findByIdAndDelete).not.toHaveBeenCalled();
  });
});

describe('GET /api/hotels/:hotelId/rooms — filtre active (correctif, sélecteur d\'affectation)', () => {
  afterEach(() => jest.clearAllMocks());

  test('active=true est transmis à la requête Mongo (exclut les chambres désactivées)', async () => {
    mockUserAuth(OWNER_ID, 'Proprietaire');
    Hotel.findById = jest.fn().mockResolvedValue({ _id: HOTEL_ID, manager: OWNER_ID });
    Room.find = jest.fn().mockReturnValue({ populate: jest.fn().mockReturnThis(), sort: jest.fn().mockResolvedValue([]) });
    RoomAssignment.find = jest.fn().mockReturnValue({ populate: jest.fn().mockResolvedValue([]) });
    await request(app).get(`/api/hotels/${HOTEL_ID}/rooms?status=available&active=true`).set('Authorization', `Bearer ${makeToken(OWNER_ID)}`);
    expect(Room.find).toHaveBeenCalledWith(expect.objectContaining({ active: true }));
  });

  test('sans paramètre active, aucun filtre actif/inactif appliqué (tableau de bord voit tout)', async () => {
    mockUserAuth(OWNER_ID, 'Proprietaire');
    Hotel.findById = jest.fn().mockResolvedValue({ _id: HOTEL_ID, manager: OWNER_ID });
    Room.find = jest.fn().mockReturnValue({ populate: jest.fn().mockReturnThis(), sort: jest.fn().mockResolvedValue([]) });
    RoomAssignment.find = jest.fn().mockReturnValue({ populate: jest.fn().mockResolvedValue([]) });
    await request(app).get(`/api/hotels/${HOTEL_ID}/rooms`).set('Authorization', `Bearer ${makeToken(OWNER_ID)}`);
    expect(Room.find).toHaveBeenCalledWith(expect.not.objectContaining({ active: expect.anything() }));
  });
});

describe('POST /api/hotels/room-assignments — affectation (Sprint D)', () => {
  afterEach(() => jest.clearAllMocks());

  test("403 — un propriétaire tiers ne peut pas affecter de chambre sur une réservation qui n'est pas la sienne", async () => {
    mockUserAuth(OTHER_OWNER_ID, 'Proprietaire');
    HotelReservation.findById = jest.fn().mockResolvedValue({ _id: RESERVATION_ID, hotel: HOTEL_ID, reference: 'RES-1' });
    Hotel.findById = jest.fn().mockResolvedValue({ _id: HOTEL_ID, manager: OWNER_ID });
    const res = await request(app).post('/api/hotels/room-assignments').set('Authorization', `Bearer ${makeToken(OTHER_OWNER_ID)}`).send({ reservationId: RESERVATION_ID, roomId: ROOM_ID });
    expect(res.statusCode).toBe(403);
  });

  test('403 — un client ne peut jamais affecter sa propre chambre (mission §13)', async () => {
    mockUserAuth(CLIENT_ID, 'Client');
    HotelReservation.findById = jest.fn().mockResolvedValue({ _id: RESERVATION_ID, hotel: HOTEL_ID, guestUser: CLIENT_ID, reference: 'RES-1' });
    Hotel.findById = jest.fn().mockResolvedValue({ _id: HOTEL_ID, manager: OWNER_ID });
    const res = await request(app).post('/api/hotels/room-assignments').set('Authorization', `Bearer ${makeToken(CLIENT_ID)}`).send({ reservationId: RESERVATION_ID, roomId: ROOM_ID });
    expect(res.statusCode).toBe(403);
    expect(roomAssignmentService.assignRoom).not.toHaveBeenCalled();
  });

  test('201 — le propriétaire affecte une chambre à une réservation de son hôtel', async () => {
    mockUserAuth(OWNER_ID, 'Proprietaire');
    HotelReservation.findById = jest.fn().mockResolvedValue({ _id: RESERVATION_ID, hotel: HOTEL_ID, reference: 'RES-1', guestUser: null });
    Hotel.findById = jest.fn().mockResolvedValue({ _id: HOTEL_ID, manager: OWNER_ID });
    roomAssignmentService.assignRoom.mockResolvedValue({ _id: 'ASSIGN-1', room: ROOM_ID, reservation: RESERVATION_ID });
    const res = await request(app).post('/api/hotels/room-assignments').set('Authorization', `Bearer ${makeToken(OWNER_ID)}`).send({ reservationId: RESERVATION_ID, roomId: ROOM_ID });
    expect(res.statusCode).toBe(201);
  });

  test('409 — double affectation renvoyée proprement par le service (E11000 converti)', async () => {
    mockUserAuth(OWNER_ID, 'Proprietaire');
    HotelReservation.findById = jest.fn().mockResolvedValue({ _id: RESERVATION_ID, hotel: HOTEL_ID, reference: 'RES-1', guestUser: null });
    Hotel.findById = jest.fn().mockResolvedValue({ _id: HOTEL_ID, manager: OWNER_ID });
    const err = new Error('Cette chambre vient déjà d\'être affectée à une autre réservation.'); err.statusCode = 409;
    roomAssignmentService.assignRoom.mockRejectedValue(err);
    const res = await request(app).post('/api/hotels/room-assignments').set('Authorization', `Bearer ${makeToken(OWNER_ID)}`).send({ reservationId: RESERVATION_ID, roomId: ROOM_ID });
    expect(res.statusCode).toBe(409);
  });
});

describe('PATCH /api/hotels/room-assignments/change — changement de chambre (Sprint D)', () => {
  afterEach(() => jest.clearAllMocks());

  test('200 — staff change la chambre d\'une réservation', async () => {
    mockUserAuth(ADMIN_ID, 'Admin');
    HotelReservation.findById = jest.fn().mockResolvedValue({ _id: RESERVATION_ID, hotel: HOTEL_ID, reference: 'RES-1', guestUser: null });
    Hotel.findById = jest.fn().mockResolvedValue({ _id: HOTEL_ID, manager: OWNER_ID });
    roomAssignmentService.changeRoom.mockResolvedValue({ _id: 'ASSIGN-2', room: OTHER_ROOM_ID });
    const res = await request(app).patch('/api/hotels/room-assignments/change').set('Authorization', `Bearer ${makeToken(ADMIN_ID)}`).send({ reservationId: RESERVATION_ID, newRoomId: OTHER_ROOM_ID });
    expect(res.statusCode).toBe(200);
  });

  test('403 — un client ne peut jamais changer de chambre lui-même', async () => {
    mockUserAuth(CLIENT_ID, 'Client');
    HotelReservation.findById = jest.fn().mockResolvedValue({ _id: RESERVATION_ID, hotel: HOTEL_ID, guestUser: CLIENT_ID, reference: 'RES-1' });
    Hotel.findById = jest.fn().mockResolvedValue({ _id: HOTEL_ID, manager: OWNER_ID });
    const res = await request(app).patch('/api/hotels/room-assignments/change').set('Authorization', `Bearer ${makeToken(CLIENT_ID)}`).send({ reservationId: RESERVATION_ID, newRoomId: OTHER_ROOM_ID });
    expect(res.statusCode).toBe(403);
  });
});

describe('PATCH /api/hotels/room-assignments/release — libération (Sprint D)', () => {
  afterEach(() => jest.clearAllMocks());

  test('200 — le propriétaire libère la chambre d\'une réservation', async () => {
    mockUserAuth(OWNER_ID, 'Proprietaire');
    HotelReservation.findById = jest.fn().mockResolvedValue({ _id: RESERVATION_ID, hotel: HOTEL_ID, reference: 'RES-1', guestUser: null });
    Hotel.findById = jest.fn().mockResolvedValue({ _id: HOTEL_ID, manager: OWNER_ID });
    roomAssignmentService.releaseRoom.mockResolvedValue({ assignment: { _id: 'ASSIGN-1' }, room: { _id: ROOM_ID, status: 'available' } });
    const res = await request(app).patch('/api/hotels/room-assignments/release').set('Authorization', `Bearer ${makeToken(OWNER_ID)}`).send({ reservationId: RESERVATION_ID });
    expect(res.statusCode).toBe(200);
  });

  test('404 — aucune affectation active à libérer', async () => {
    mockUserAuth(OWNER_ID, 'Proprietaire');
    HotelReservation.findById = jest.fn().mockResolvedValue({ _id: RESERVATION_ID, hotel: HOTEL_ID, reference: 'RES-1', guestUser: null });
    Hotel.findById = jest.fn().mockResolvedValue({ _id: HOTEL_ID, manager: OWNER_ID });
    const err = new Error('Aucune chambre active à libérer pour cette réservation.'); err.statusCode = 404;
    roomAssignmentService.releaseRoom.mockRejectedValue(err);
    const res = await request(app).patch('/api/hotels/room-assignments/release').set('Authorization', `Bearer ${makeToken(OWNER_ID)}`).send({ reservationId: RESERVATION_ID });
    expect(res.statusCode).toBe(404);
  });
});

describe('PATCH /api/hotel-reservations/:id/check-in (Sprint D)', () => {
  afterEach(() => jest.clearAllMocks());

  test('200 — le propriétaire effectue le check-in', async () => {
    mockUserAuth(OWNER_ID, 'Proprietaire');
    HotelReservation.findById = jest.fn().mockResolvedValue({ _id: RESERVATION_ID, hotel: HOTEL_ID, guestUser: null, status: 'confirmed', reference: 'RES-1' });
    Hotel.findById = jest.fn().mockResolvedValue({ _id: HOTEL_ID, manager: OWNER_ID });
    performCheckIn.mockResolvedValue({ reservation: { _id: RESERVATION_ID, status: 'checked_in', reference: 'RES-1' }, room: { _id: ROOM_ID, roomNumber: '101', status: 'occupied' } });
    const res = await request(app).patch(`/api/hotel-reservations/${RESERVATION_ID}/check-in`).set('Authorization', `Bearer ${makeToken(OWNER_ID)}`).send({ roomId: ROOM_ID });
    expect(res.statusCode).toBe(200);
    expect(res.body.data.room.roomNumber).toBe('101');
  });

  test("403 — un client ne peut jamais déclencher son propre check-in", async () => {
    mockUserAuth(CLIENT_ID, 'Client');
    HotelReservation.findById = jest.fn().mockResolvedValue({ _id: RESERVATION_ID, hotel: HOTEL_ID, guestUser: CLIENT_ID, status: 'confirmed', reference: 'RES-1' });
    Hotel.findById = jest.fn().mockResolvedValue({ _id: HOTEL_ID, manager: OWNER_ID });
    const res = await request(app).patch(`/api/hotel-reservations/${RESERVATION_ID}/check-in`).set('Authorization', `Bearer ${makeToken(CLIENT_ID)}`).send({ roomId: ROOM_ID });
    expect(res.statusCode).toBe(403);
    expect(performCheckIn).not.toHaveBeenCalled();
  });

  test("403 — un propriétaire tiers ne peut pas faire le check-in d'un hôtel qui n'est pas le sien", async () => {
    mockUserAuth(OTHER_OWNER_ID, 'Proprietaire');
    HotelReservation.findById = jest.fn().mockResolvedValue({ _id: RESERVATION_ID, hotel: HOTEL_ID, guestUser: null, status: 'confirmed', reference: 'RES-1' });
    Hotel.findById = jest.fn().mockResolvedValue({ _id: HOTEL_ID, manager: OWNER_ID });
    const res = await request(app).patch(`/api/hotel-reservations/${RESERVATION_ID}/check-in`).set('Authorization', `Bearer ${makeToken(OTHER_OWNER_ID)}`).send({ roomId: ROOM_ID });
    expect(res.statusCode).toBe(403);
  });

  test('409 — le service refuse une réservation qui n\'est pas confirmed', async () => {
    mockUserAuth(OWNER_ID, 'Proprietaire');
    HotelReservation.findById = jest.fn().mockResolvedValue({ _id: RESERVATION_ID, hotel: HOTEL_ID, guestUser: null, status: 'pending', reference: 'RES-1' });
    Hotel.findById = jest.fn().mockResolvedValue({ _id: HOTEL_ID, manager: OWNER_ID });
    const err = new Error('Seule une réservation confirmée peut faire l\'objet d\'un check-in.'); err.statusCode = 409;
    performCheckIn.mockRejectedValue(err);
    const res = await request(app).patch(`/api/hotel-reservations/${RESERVATION_ID}/check-in`).set('Authorization', `Bearer ${makeToken(OWNER_ID)}`).send({ roomId: ROOM_ID });
    expect(res.statusCode).toBe(409);
  });
});

describe('PATCH /api/hotel-reservations/:id/check-out (Sprint D)', () => {
  afterEach(() => jest.clearAllMocks());

  test('200 — staff effectue le check-out', async () => {
    mockUserAuth(ADMIN_ID, 'Admin');
    HotelReservation.findById = jest.fn().mockResolvedValue({ _id: RESERVATION_ID, hotel: HOTEL_ID, guestUser: null, status: 'checked_in', reference: 'RES-1' });
    Hotel.findById = jest.fn().mockResolvedValue({ _id: HOTEL_ID, manager: OWNER_ID });
    performCheckOut.mockResolvedValue({ reservation: { _id: RESERVATION_ID, status: 'checked_out', reference: 'RES-1' }, room: { _id: ROOM_ID, status: 'cleaning' } });
    const res = await request(app).patch(`/api/hotel-reservations/${RESERVATION_ID}/check-out`).set('Authorization', `Bearer ${makeToken(ADMIN_ID)}`);
    expect(res.statusCode).toBe(200);
    expect(res.body.data.room.status).toBe('cleaning');
  });

  test("403 — un client ne peut jamais déclencher son propre check-out", async () => {
    mockUserAuth(CLIENT_ID, 'Client');
    HotelReservation.findById = jest.fn().mockResolvedValue({ _id: RESERVATION_ID, hotel: HOTEL_ID, guestUser: CLIENT_ID, status: 'checked_in', reference: 'RES-1' });
    Hotel.findById = jest.fn().mockResolvedValue({ _id: HOTEL_ID, manager: OWNER_ID });
    const res = await request(app).patch(`/api/hotel-reservations/${RESERVATION_ID}/check-out`).set('Authorization', `Bearer ${makeToken(CLIENT_ID)}`);
    expect(res.statusCode).toBe(403);
    expect(performCheckOut).not.toHaveBeenCalled();
  });

  test('401 sans jeton', async () => {
    const res = await request(app).patch(`/api/hotel-reservations/${RESERVATION_ID}/check-out`);
    expect(res.statusCode).toBe(401);
  });
});

describe('GET /api/hotel-reservations/:id/room-assignment — persistance (correctif)', () => {
  afterEach(() => jest.clearAllMocks());

  test('200 — le propriétaire récupère l\'affectation active', async () => {
    mockUserAuth(OWNER_ID, 'Proprietaire');
    HotelReservation.findById = jest.fn().mockResolvedValue({ _id: RESERVATION_ID, hotel: HOTEL_ID, guestUser: null, status: 'confirmed' });
    Hotel.findById = jest.fn().mockResolvedValue({ _id: HOTEL_ID, manager: OWNER_ID });
    roomAssignmentService.getActiveAssignment.mockResolvedValue({
      _id: 'ASSIGN-1', assignedAt: '2026-08-01T00:00:00Z',
      room: { _id: ROOM_ID, roomNumber: '101', floor: 1, status: 'reserved', roomCategory: CATEGORY_ID },
    });
    const res = await request(app).get(`/api/hotel-reservations/${RESERVATION_ID}/room-assignment`).set('Authorization', `Bearer ${makeToken(OWNER_ID)}`);
    expect(res.statusCode).toBe(200);
    expect(res.body.data.activeRoomAssignment).toMatchObject({ id: 'ASSIGN-1', room: { roomNumber: '101' } });
    // Jamais assignedBy/reason exposés (mission §8 — projection minimale).
    expect(res.body.data.activeRoomAssignment.assignedBy).toBeUndefined();
    expect(res.body.data.activeRoomAssignment.reason).toBeUndefined();
  });

  test('200 — le staff autorisé récupère l\'affectation', async () => {
    mockUserAuth(ADMIN_ID, 'Admin');
    HotelReservation.findById = jest.fn().mockResolvedValue({ _id: RESERVATION_ID, hotel: HOTEL_ID, guestUser: null, status: 'confirmed' });
    Hotel.findById = jest.fn().mockResolvedValue({ _id: HOTEL_ID, manager: OWNER_ID });
    roomAssignmentService.getActiveAssignment.mockResolvedValue({
      _id: 'ASSIGN-1', assignedAt: '2026-08-01T00:00:00Z',
      room: { _id: ROOM_ID, roomNumber: '205', floor: 2, status: 'reserved', roomCategory: CATEGORY_ID },
    });
    const res = await request(app).get(`/api/hotel-reservations/${RESERVATION_ID}/room-assignment`).set('Authorization', `Bearer ${makeToken(ADMIN_ID)}`);
    expect(res.statusCode).toBe(200);
    expect(res.body.data.activeRoomAssignment.room.roomNumber).toBe('205');
  });

  test('200 — le client ne reçoit AUCUN numéro de chambre avant le check-in, même si une chambre est déjà affectée', async () => {
    mockUserAuth(CLIENT_ID, 'Client');
    HotelReservation.findById = jest.fn().mockResolvedValue({ _id: RESERVATION_ID, hotel: HOTEL_ID, guestUser: CLIENT_ID, status: 'confirmed' });
    roomAssignmentService.getActiveAssignment.mockResolvedValue({
      _id: 'ASSIGN-1', room: { _id: ROOM_ID, roomNumber: '101' },
    });
    const res = await request(app).get(`/api/hotel-reservations/${RESERVATION_ID}/room-assignment`).set('Authorization', `Bearer ${makeToken(CLIENT_ID)}`);
    expect(res.statusCode).toBe(200);
    expect(res.body.data.activeRoomAssignment).toBeNull();
    expect(roomAssignmentService.getActiveAssignment).not.toHaveBeenCalled();
  });

  test('200 — le client reçoit le numéro de chambre APRÈS le check-in', async () => {
    mockUserAuth(CLIENT_ID, 'Client');
    HotelReservation.findById = jest.fn().mockResolvedValue({ _id: RESERVATION_ID, hotel: HOTEL_ID, guestUser: CLIENT_ID, status: 'checked_in' });
    roomAssignmentService.getActiveAssignment.mockResolvedValue({
      _id: 'ASSIGN-1', room: { _id: ROOM_ID, roomNumber: '101', floor: 1, status: 'occupied', roomCategory: CATEGORY_ID },
    });
    const res = await request(app).get(`/api/hotel-reservations/${RESERVATION_ID}/room-assignment`).set('Authorization', `Bearer ${makeToken(CLIENT_ID)}`);
    expect(res.statusCode).toBe(200);
    expect(res.body.data.activeRoomAssignment.room.roomNumber).toBe('101');
  });

  test("403 — un utilisateur tiers (ni client, ni propriétaire, ni staff) ne reçoit rien", async () => {
    mockUserAuth(OTHER_OWNER_ID, 'Proprietaire');
    HotelReservation.findById = jest.fn().mockResolvedValue({ _id: RESERVATION_ID, hotel: HOTEL_ID, guestUser: null, status: 'confirmed' });
    Hotel.findById = jest.fn().mockResolvedValue({ _id: HOTEL_ID, manager: OWNER_ID });
    const res = await request(app).get(`/api/hotel-reservations/${RESERVATION_ID}/room-assignment`).set('Authorization', `Bearer ${makeToken(OTHER_OWNER_ID)}`);
    expect(res.statusCode).toBe(403);
  });

  test('404 — réservation introuvable', async () => {
    mockUserAuth(OWNER_ID, 'Proprietaire');
    HotelReservation.findById = jest.fn().mockResolvedValue(null);
    const res = await request(app).get(`/api/hotel-reservations/${RESERVATION_ID}/room-assignment`).set('Authorization', `Bearer ${makeToken(OWNER_ID)}`);
    expect(res.statusCode).toBe(404);
  });

  test('200 — activeRoomAssignment: null quand aucune affectation active', async () => {
    mockUserAuth(OWNER_ID, 'Proprietaire');
    HotelReservation.findById = jest.fn().mockResolvedValue({ _id: RESERVATION_ID, hotel: HOTEL_ID, guestUser: null, status: 'confirmed' });
    Hotel.findById = jest.fn().mockResolvedValue({ _id: HOTEL_ID, manager: OWNER_ID });
    roomAssignmentService.getActiveAssignment.mockResolvedValue(null);
    const res = await request(app).get(`/api/hotel-reservations/${RESERVATION_ID}/room-assignment`).set('Authorization', `Bearer ${makeToken(OWNER_ID)}`);
    expect(res.statusCode).toBe(200);
    expect(res.body.data.activeRoomAssignment).toBeNull();
  });

  test('401 sans jeton', async () => {
    const res = await request(app).get(`/api/hotel-reservations/${RESERVATION_ID}/room-assignment`);
    expect(res.statusCode).toBe(401);
  });
});
