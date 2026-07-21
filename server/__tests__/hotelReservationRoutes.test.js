// __tests__/hotelReservationRoutes.test.js — Sprint C
// Sécurité et routage des endpoints HotelReservation (modèles + services mockés).

jest.mock('../models/Hotel');
jest.mock('../models/RoomCategory');
jest.mock('../models/RatePlan');
jest.mock('../models/HotelReservation');
jest.mock('../models/User');
jest.mock('../services/hotelAvailabilityService');
jest.mock('../services/hotelReservationService');
jest.mock('../config/db', () => jest.fn());
jest.mock('node-cron', () => ({ schedule: jest.fn() }));
jest.mock('../scripts/sync-facebook', () => ({ syncFacebook: jest.fn() }));
jest.mock('../services/zohoImapService', () => ({ pollZohoInbox: jest.fn() }));
jest.mock('../services/alerteService', () => ({ verifierPaiementsEnRetard: jest.fn() }));
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
const HotelReservation = require('../models/HotelReservation');
const User = require('../models/User');
const availability = require('../services/hotelAvailabilityService');
const reservationService = require('../services/hotelReservationService');

const OWNER_ID = '507f1f77bcf86cd799439011';
const OTHER_OWNER_ID = '507f1f77bcf86cd799439099';
const ADMIN_ID = '507f1f77bcf86cd799439012';
const CLIENT_ID = '507f1f77bcf86cd799439033';
const OTHER_CLIENT_ID = '507f1f77bcf86cd799439044';
const HOTEL_ID = '707f1f77bcf86cd799439055';
const CATEGORY_ID = '807f1f77bcf86cd799439066';
const RESERVATION_ID = '907f1f77bcf86cd799439077';

const makeToken = (id) => jwt.sign({ id, tokenVersion: 0 }, process.env.JWT_SECRET, { expiresIn: '1d' });
const fakeUser = (id, role) => ({ _id: id, id, name: 'Test User', email: 't@a.com', role, isActive: true, status: 'Actif', tokenVersion: 0 });
const mockUserAuth = (id, role) => {
  User.findById = jest.fn().mockReturnValue({ select: jest.fn().mockResolvedValue(fakeUser(id, role)) });
  User.findByIdAndUpdate = jest.fn().mockReturnValue({ catch: jest.fn() });
};

describe('GET /api/hotels/:hotelId/availability — public, sans fuite de données (Sprint C)', () => {
  afterEach(() => jest.clearAllMocks());

  test("404 pour un hôtel non publié — jamais d'information de disponibilité exposée", async () => {
    Hotel.findById = jest.fn().mockResolvedValue({ _id: HOTEL_ID, publicationStatus: 'brouillon', active: true });
    const res = await request(app).get(`/api/hotels/${HOTEL_ID}/availability?roomCategoryId=${CATEGORY_ID}&checkInDate=2026-08-10&checkOutDate=2026-08-11`);
    expect(res.statusCode).toBe(404);
  });

  test('200 — réponse publique ne contient que { available, nights:[{date,available}] }, aucun champ interne', async () => {
    Hotel.findById = jest.fn().mockResolvedValue({ _id: HOTEL_ID, publicationStatus: 'publie', active: true });
    RoomCategory.findOne = jest.fn().mockResolvedValue({ _id: CATEGORY_ID, hotel: HOTEL_ID, status: 'actif' });
    availability.getAvailability.mockResolvedValue({
      available: true,
      nights: [{ date: new Date('2026-08-10'), totalUnits: 5, availableUnits: 3, isClosed: false, stopSell: false, sufficient: true }],
      unavailableDates: [],
    });
    const res = await request(app).get(`/api/hotels/${HOTEL_ID}/availability?roomCategoryId=${CATEGORY_ID}&checkInDate=2026-08-10&checkOutDate=2026-08-11`);
    expect(res.statusCode).toBe(200);
    expect(res.body.data.available).toBe(true);
    expect(res.body.data.nights[0]).toEqual({ date: expect.any(String), available: true });
    expect(res.body.data.nights[0]).not.toHaveProperty('totalUnits');
    expect(res.body.data.nights[0]).not.toHaveProperty('availableUnits');
  });

  test('aucune authentification requise', async () => {
    Hotel.findById = jest.fn().mockResolvedValue({ _id: HOTEL_ID, publicationStatus: 'publie', active: true });
    RoomCategory.findOne = jest.fn().mockResolvedValue({ _id: CATEGORY_ID, hotel: HOTEL_ID, status: 'actif' });
    availability.getAvailability.mockResolvedValue({ available: true, nights: [], unavailableDates: [] });
    const res = await request(app).get(`/api/hotels/${HOTEL_ID}/availability?roomCategoryId=${CATEGORY_ID}&checkInDate=2026-08-10&checkOutDate=2026-08-11`);
    expect(res.statusCode).toBe(200);
  });
});

describe('POST /api/hotels/:hotelId/reservations — création publique (Sprint C)', () => {
  afterEach(() => jest.clearAllMocks());

  const validBody = () => ({
    roomCategoryId: CATEGORY_ID, ratePlanId: '907f1f77bcf86cd799439088',
    checkInDate: '2026-08-10', checkOutDate: '2026-08-12', roomsCount: 1, adults: 2,
    guest: { firstName: 'Jean', lastName: 'Dupont', email: 'jean@example.com' },
  });

  test('422 sans identité client (firstName/lastName/email)', async () => {
    Hotel.findById = jest.fn().mockResolvedValue({ _id: HOTEL_ID, name: 'Hôtel Test', publicationStatus: 'publie', active: true });
    const res = await request(app).post(`/api/hotels/${HOTEL_ID}/reservations`).send({ ...validBody(), guest: {} });
    expect(res.statusCode).toBe(422);
  });

  test('201 — création anonyme réussie (aucun jeton), source=public_web', async () => {
    Hotel.findById = jest.fn().mockResolvedValue({ _id: HOTEL_ID, name: 'Hôtel Test', publicationStatus: 'publie', active: true });
    reservationService.createReservation.mockResolvedValue({ _id: RESERVATION_ID, reference: 'RES-2026-000001', source: 'public_web' });
    const res = await request(app).post(`/api/hotels/${HOTEL_ID}/reservations`).send(validBody());
    expect(res.statusCode).toBe(201);
    expect(reservationService.createReservation).toHaveBeenCalledWith(expect.objectContaining({ source: 'public_web', guestUserId: null }));
  });

  test('409 avec unavailableDates si le stock est indisponible', async () => {
    Hotel.findById = jest.fn().mockResolvedValue({ _id: HOTEL_ID, name: 'Hôtel Test', publicationStatus: 'publie', active: true });
    const err = new Error('indisponible'); err.statusCode = 409; err.unavailableDates = [new Date('2026-08-10')];
    reservationService.createReservation.mockRejectedValue(err);
    const res = await request(app).post(`/api/hotels/${HOTEL_ID}/reservations`).send(validBody());
    expect(res.statusCode).toBe(409);
    expect(res.body.unavailableDates).toBeDefined();
  });

  test('404 si l\'hôtel n\'est pas publié — aucune réservation créée', async () => {
    Hotel.findById = jest.fn().mockResolvedValue({ _id: HOTEL_ID, publicationStatus: 'brouillon', active: true });
    const res = await request(app).post(`/api/hotels/${HOTEL_ID}/reservations`).send(validBody());
    expect(res.statusCode).toBe(404);
    expect(reservationService.createReservation).not.toHaveBeenCalled();
  });
});

describe('Sécurité — accès inter-tenant interdit (Sprint C)', () => {
  afterEach(() => jest.clearAllMocks());

  test("403 — un client tiers ne peut pas lire la réservation d'un autre client", async () => {
    mockUserAuth(OTHER_CLIENT_ID, 'Client');
    HotelReservation.findById = jest.fn().mockReturnValue({
      populate: jest.fn().mockReturnValue({
        populate: jest.fn().mockResolvedValue({ _id: RESERVATION_ID, guestUser: CLIENT_ID, hotel: HOTEL_ID }),
      }),
    });
    Hotel.findById = jest.fn().mockResolvedValue({ _id: HOTEL_ID, manager: OWNER_ID });
    const res = await request(app).get(`/api/hotel-reservations/${RESERVATION_ID}`).set('Authorization', `Bearer ${makeToken(OTHER_CLIENT_ID)}`);
    expect(res.statusCode).toBe(403);
  });

  test("200 — le client propriétaire de la réservation peut la lire", async () => {
    mockUserAuth(CLIENT_ID, 'Client');
    HotelReservation.findById = jest.fn().mockReturnValue({
      populate: jest.fn().mockReturnValue({
        populate: jest.fn().mockResolvedValue({ _id: RESERVATION_ID, guestUser: CLIENT_ID, hotel: HOTEL_ID }),
      }),
    });
    const res = await request(app).get(`/api/hotel-reservations/${RESERVATION_ID}`).set('Authorization', `Bearer ${makeToken(CLIENT_ID)}`);
    expect(res.statusCode).toBe(200);
  });

  test("403 — un propriétaire tiers ne peut pas lire une réservation d'un hôtel qui n'est pas le sien", async () => {
    mockUserAuth(OTHER_OWNER_ID, 'Proprietaire');
    HotelReservation.findById = jest.fn().mockReturnValue({
      populate: jest.fn().mockReturnValue({
        populate: jest.fn().mockResolvedValue({ _id: RESERVATION_ID, guestUser: null, hotel: HOTEL_ID }),
      }),
    });
    Hotel.findById = jest.fn().mockResolvedValue({ _id: HOTEL_ID, manager: OWNER_ID });
    const res = await request(app).get(`/api/hotel-reservations/${RESERVATION_ID}`).set('Authorization', `Bearer ${makeToken(OTHER_OWNER_ID)}`);
    expect(res.statusCode).toBe(403);
  });

  test("200 — le propriétaire de l'hôtel peut lire la réservation", async () => {
    mockUserAuth(OWNER_ID, 'Proprietaire');
    HotelReservation.findById = jest.fn().mockReturnValue({
      populate: jest.fn().mockReturnValue({
        populate: jest.fn().mockResolvedValue({ _id: RESERVATION_ID, guestUser: null, hotel: HOTEL_ID }),
      }),
    });
    Hotel.findById = jest.fn().mockResolvedValue({ _id: HOTEL_ID, manager: OWNER_ID });
    const res = await request(app).get(`/api/hotel-reservations/${RESERVATION_ID}`).set('Authorization', `Bearer ${makeToken(OWNER_ID)}`);
    expect(res.statusCode).toBe(200);
  });

  test("403 — un propriétaire tiers ne peut pas créer de réservation manuelle sur un hôtel qui n'est pas le sien", async () => {
    mockUserAuth(OTHER_OWNER_ID, 'Proprietaire');
    Hotel.findById = jest.fn().mockResolvedValue({ _id: HOTEL_ID, manager: OWNER_ID, name: 'Hôtel Test' });
    const res = await request(app)
      .post('/api/hotel-reservations/owner')
      .set('Authorization', `Bearer ${makeToken(OTHER_OWNER_ID)}`)
      .send({ hotelId: HOTEL_ID, roomCategoryId: CATEGORY_ID, ratePlanId: 'x', checkInDate: '2026-08-10', checkOutDate: '2026-08-11', guest: { firstName: 'A', lastName: 'B', email: 'a@b.com' } });
    expect(res.statusCode).toBe(403);
    expect(reservationService.createReservation).not.toHaveBeenCalled();
  });

  test("200 — un admin peut créer une réservation pour n'importe quel hôtel (matrice existante)", async () => {
    mockUserAuth(ADMIN_ID, 'Admin');
    Hotel.findById = jest.fn().mockResolvedValue({ _id: HOTEL_ID, manager: OWNER_ID, name: 'Hôtel Test' });
    reservationService.createReservation.mockResolvedValue({ _id: RESERVATION_ID, reference: 'RES-2026-000002', source: 'admin_dashboard' });
    const res = await request(app)
      .post('/api/hotel-reservations/owner')
      .set('Authorization', `Bearer ${makeToken(ADMIN_ID)}`)
      .send({ hotelId: HOTEL_ID, roomCategoryId: CATEGORY_ID, ratePlanId: 'x', checkInDate: '2026-08-10', checkOutDate: '2026-08-11', guest: { firstName: 'A', lastName: 'B', email: 'a@b.com' } });
    expect(res.statusCode).toBe(201);
  });

  test("liste propriétaire : scope automatiquement restreint à ses propres hôtels (jamais tous les hôtels)", async () => {
    mockUserAuth(OWNER_ID, 'Proprietaire');
    Hotel.find = jest.fn().mockReturnValue({ select: jest.fn().mockResolvedValue([{ _id: HOTEL_ID, name: 'Hôtel Test' }]) });
    HotelReservation.countDocuments = jest.fn().mockResolvedValue(0);
    HotelReservation.find = jest.fn().mockReturnValue({
      populate: jest.fn().mockReturnValue({ populate: jest.fn().mockReturnValue({ sort: jest.fn().mockReturnValue({ skip: jest.fn().mockReturnValue({ limit: jest.fn().mockResolvedValue([]) }) }) }) }),
    });
    const res = await request(app).get('/api/hotel-reservations/owner').set('Authorization', `Bearer ${makeToken(OWNER_ID)}`);
    expect(res.statusCode).toBe(200);
    expect(Hotel.find).toHaveBeenCalledWith(expect.objectContaining({ manager: OWNER_ID }));
  });

  test("403 — un client ne peut pas accéder à la liste admin", async () => {
    mockUserAuth(CLIENT_ID, 'Client');
    const res = await request(app).get('/api/hotel-reservations/admin/list').set('Authorization', `Bearer ${makeToken(CLIENT_ID)}`);
    expect(res.statusCode).toBe(403);
  });

  test("403 — un propriétaire ne peut pas accéder à la liste admin (réservée au staff)", async () => {
    mockUserAuth(OWNER_ID, 'Proprietaire');
    const res = await request(app).get('/api/hotel-reservations/admin/list').set('Authorization', `Bearer ${makeToken(OWNER_ID)}`);
    expect(res.statusCode).toBe(403);
  });

  test('401 sans jeton sur toutes les routes authentifiées', async () => {
    const endpoints = [
      ['get', '/api/hotel-reservations/mine'],
      ['get', '/api/hotel-reservations/owner'],
      ['get', '/api/hotel-reservations/admin/list'],
      ['get', `/api/hotel-reservations/${RESERVATION_ID}`],
      ['patch', `/api/hotel-reservations/${RESERVATION_ID}/cancel`],
    ];
    for (const [method, url] of endpoints) {
      // eslint-disable-next-line no-await-in-loop
      const res = await request(app)[method](url);
      expect(res.statusCode).toBe(401);
    }
  });
});

describe('Cycle de vie via API — confirm/reject/cancel (Sprint C)', () => {
  afterEach(() => jest.clearAllMocks());

  test('200 — le propriétaire confirme une réservation de son hôtel', async () => {
    mockUserAuth(OWNER_ID, 'Proprietaire');
    HotelReservation.findById = jest.fn().mockResolvedValue({ _id: RESERVATION_ID, guestUser: null, hotel: HOTEL_ID, status: 'pending' });
    Hotel.findById = jest.fn().mockResolvedValue({ _id: HOTEL_ID, manager: OWNER_ID });
    reservationService.transitionStatus.mockResolvedValue({ _id: RESERVATION_ID, reference: 'RES-2026-000001', status: 'confirmed' });
    const res = await request(app).patch(`/api/hotel-reservations/${RESERVATION_ID}/confirm`).set('Authorization', `Bearer ${makeToken(OWNER_ID)}`);
    expect(res.statusCode).toBe(200);
  });

  test('422 — le rejet exige un motif', async () => {
    mockUserAuth(OWNER_ID, 'Proprietaire');
    HotelReservation.findById = jest.fn().mockResolvedValue({ _id: RESERVATION_ID, guestUser: null, hotel: HOTEL_ID, status: 'pending' });
    Hotel.findById = jest.fn().mockResolvedValue({ _id: HOTEL_ID, manager: OWNER_ID });
    const res = await request(app).patch(`/api/hotel-reservations/${RESERVATION_ID}/reject`).set('Authorization', `Bearer ${makeToken(OWNER_ID)}`).send({});
    expect(res.statusCode).toBe(422);
    expect(reservationService.transitionStatus).not.toHaveBeenCalled();
  });

  test('200 — le client annule sa propre réservation', async () => {
    mockUserAuth(CLIENT_ID, 'Client');
    HotelReservation.findById = jest.fn().mockResolvedValue({ _id: RESERVATION_ID, guestUser: CLIENT_ID, hotel: HOTEL_ID, status: 'pending' });
    reservationService.transitionStatus.mockResolvedValue({ _id: RESERVATION_ID, reference: 'RES-2026-000001', status: 'cancelled' });
    const res = await request(app).patch(`/api/hotel-reservations/${RESERVATION_ID}/cancel`).set('Authorization', `Bearer ${makeToken(CLIENT_ID)}`).send({ reason: 'Changement de plan' });
    expect(res.statusCode).toBe(200);
  });

  test("403 — un client ne peut pas confirmer une réservation (réservé propriétaire/staff)", async () => {
    mockUserAuth(CLIENT_ID, 'Client');
    HotelReservation.findById = jest.fn().mockResolvedValue({ _id: RESERVATION_ID, guestUser: CLIENT_ID, hotel: HOTEL_ID, status: 'pending' });
    Hotel.findById = jest.fn().mockResolvedValue({ _id: HOTEL_ID, manager: OWNER_ID });
    const res = await request(app).patch(`/api/hotel-reservations/${RESERVATION_ID}/confirm`).set('Authorization', `Bearer ${makeToken(CLIENT_ID)}`);
    expect(res.statusCode).toBe(403);
  });
});
