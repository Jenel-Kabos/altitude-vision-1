// PHASE-H2 — recherche de disponibilité multi-catégories (consommateur) et
// validation d'occupation à la création de réservation. Réutilise
// exclusivement hotelAvailabilityService (inventaire) et
// computeReservationPricing (tarification) — jamais un second moteur.
jest.mock('../services/emailService', () => ({ sendEmailViaZoho: jest.fn().mockResolvedValue({ success: true }) }));

const express = require('express');
const request = require('supertest');
const mongoose = require('mongoose');
const { startFinancialMongo, clearFinancialMongo, stopFinancialMongo } = require('./helpers/financialMongoEnvironment');
const Hotel = require('../models/Hotel');
const RoomCategory = require('../models/RoomCategory');
const RatePlan = require('../models/RatePlan');
const RoomInventory = require('../models/RoomInventory');
const HotelReservation = require('../models/HotelReservation');
const { createReservation } = require('../services/hotelReservationService');
const hotelRoutes = require('../routes/hotelRoutes');
const { errorHandler } = require('../middleware/errorMiddleware');

jest.setTimeout(120000);
const app = express(); app.use(express.json()); app.use('/api/hotels', hotelRoutes); app.use(errorHandler);
const id = () => new mongoose.Types.ObjectId();

async function makeHotel(overrides = {}) {
  const actor = { id: id(), role: 'Admin' };
  const hotel = await Hotel.create({
    name: 'Hôtel H2 Test', manager: actor.id, createdBy: actor.id,
    publicationStatus: 'publie', active: true, ...overrides,
  });
  return { actor, hotel };
}
async function makeCategory(hotel, actor, overrides = {}) {
  return RoomCategory.create({
    hotel: hotel._id, name: 'Chambre Standard', code: overrides.code || `STD-${Date.now()}-${Math.random()}`,
    unitsAvailable: 2, capacity: { maxAdults: 2, maxChildren: 1 }, beds: 2, surface: 24,
    status: 'actif', createdBy: actor.id, ...overrides,
  });
}
async function makeRate(category, actor, overrides = {}) {
  return RatePlan.create({
    roomCategory: category._id, rateType: 'public', amount: 30000, currency: 'XAF',
    active: true, createdBy: actor.id, ...overrides,
  });
}

const search = ({ hotelId, checkIn = '2026-11-10', checkOut = '2026-11-12', adults = 1, children, rooms }) => {
  const q = new URLSearchParams({ checkIn, checkOut, adults: String(adults) });
  if (children !== undefined) q.set('children', String(children));
  if (rooms !== undefined) q.set('rooms', String(rooms));
  return request(app).get(`/api/hotels/public/${hotelId}/availability?${q.toString()}`);
};

beforeAll(async () => {
  await startFinancialMongo();
  await Promise.all([Hotel, RoomCategory, RatePlan, RoomInventory, HotelReservation].map((m) => m.syncIndexes()));
});
afterEach(clearFinancialMongo);
afterAll(stopFinancialMongo);

describe('GET /api/hotels/public/:hotelId/availability — recherche multi-catégories (PHASE-H2)', () => {
  test('un séjour valide renvoie la catégorie disponible avec ses offres', async () => {
    const { actor, hotel } = await makeHotel();
    const category = await makeCategory(hotel, actor);
    const rate = await makeRate(category, actor);

    const response = await search({ hotelId: hotel._id, adults: 2 });
    expect(response.status).toBe(200);
    expect(response.body.data.hotelId).toBe(String(hotel._id));
    expect(response.body.data.search).toEqual(expect.objectContaining({ nights: 2, adults: 2, children: 0, rooms: 1 }));
    expect(response.body.data.roomCategories).toHaveLength(1);
    const cat = response.body.data.roomCategories[0];
    expect(cat.id).toBe(String(category._id));
    expect(cat.name).toBe('Chambre Standard');
    expect(cat.offers).toHaveLength(1);
    expect(cat.offers[0]).toEqual(expect.objectContaining({
      ratePlanId: String(rate._id), amount: 30000, currency: 'XAF', nights: 2, totalAmount: 60000,
    }));
  });

  test('une catégorie sans stock suffisant est exclue (inventaire nuit par nuit)', async () => {
    const { actor, hotel } = await makeHotel();
    const category = await makeCategory(hotel, actor, { unitsAvailable: 1 });
    await makeRate(category, actor);
    // Sature l'inventaire d'une des deux nuits demandées.
    await RoomInventory.create({
      hotel: hotel._id, roomCategory: category._id, date: new Date('2026-11-11T00:00:00.000Z'),
      totalUnits: 1, reservedUnits: 1,
    });

    const response = await search({ hotelId: hotel._id });
    expect(response.body.data.roomCategories).toHaveLength(0);
  });

  test('le nombre de chambres demandées est respecté (availableQuantity=1, rooms=2 → exclue)', async () => {
    const { actor, hotel } = await makeHotel();
    const category = await makeCategory(hotel, actor, { unitsAvailable: 1 });
    await makeRate(category, actor);

    const response = await search({ hotelId: hotel._id, rooms: 2 });
    expect(response.body.data.roomCategories).toHaveLength(0);
  });

  test('l’occupation demandée est respectée (adults > maxAdults → catégorie exclue)', async () => {
    const { actor, hotel } = await makeHotel();
    const category = await makeCategory(hotel, actor, { capacity: { maxAdults: 2, maxChildren: 0 } });
    await makeRate(category, actor);

    const response = await search({ hotelId: hotel._id, adults: 3 });
    expect(response.body.data.roomCategories).toHaveLength(0);
  });

  test('un RatePlan inactif est exclu des offres', async () => {
    const { actor, hotel } = await makeHotel();
    const category = await makeCategory(hotel, actor);
    await makeRate(category, actor, { active: false });

    const response = await search({ hotelId: hotel._id });
    // Aucune offre active → catégorie invendable, jamais montrée comme réservable.
    expect(response.body.data.roomCategories).toHaveLength(0);
  });

  test('identifiants et devise renvoyés correspondent exactement aux documents canoniques', async () => {
    const { actor, hotel } = await makeHotel();
    const category = await makeCategory(hotel, actor);
    const rate = await makeRate(category, actor, { currency: 'EUR', amount: 99 });

    const response = await search({ hotelId: hotel._id });
    const offer = response.body.data.roomCategories[0].offers[0];
    expect(offer.ratePlanId).toBe(String(rate._id));
    expect(offer.currency).toBe('EUR');
    expect(offer.amount).toBe(99);
    expect(response.body.data.roomCategories[0].id).toBe(String(category._id));
  });

  test('un hôtel non publié (soumis) est inaccessible à la recherche', async () => {
    const { actor, hotel } = await makeHotel({ publicationStatus: 'soumis' });
    const category = await makeCategory(hotel, actor);
    await makeRate(category, actor);

    const response = await search({ hotelId: hotel._id });
    expect(response.status).toBe(404);
  });

  test('des dates invalides (départ avant arrivée) sont rejetées', async () => {
    const { hotel } = await makeHotel();
    const response = await search({ hotelId: hotel._id, checkIn: '2026-11-12', checkOut: '2026-11-10' });
    expect(response.status).toBe(422);
  });

  test('un hôtel inconnu est rejeté (404)', async () => {
    const response = await search({ hotelId: new mongoose.Types.ObjectId() });
    expect(response.status).toBe(404);
  });

  test('un identifiant hôtel invalide est rejeté (400)', async () => {
    const response = await request(app).get('/api/hotels/public/not-an-id/availability?checkIn=2026-11-10&checkOut=2026-11-12');
    expect(response.status).toBe(400);
  });
});

describe('createReservation — validation d’occupation (PHASE-H2)', () => {
  const baseInput = (f) => ({
    hotelId: f.hotel._id, roomCategoryId: f.category._id, ratePlanId: f.rate._id,
    guest: { firstName: 'Ada', lastName: 'Lovelace', email: 'ada@example.test' },
    checkInDate: '2026-11-10', checkOutDate: '2026-11-12', roomsCount: 1,
    source: 'public_web', actingUser: {},
  });

  async function fixture(capacity) {
    const { actor, hotel } = await makeHotel();
    const category = await makeCategory(hotel, actor, { capacity });
    const rate = await makeRate(category, actor);
    return { actor, hotel, category, rate };
  }

  test('adults > maxAdults est refusé (422)', async () => {
    const f = await fixture({ maxAdults: 2, maxChildren: 0 });
    await expect(createReservation({ ...baseInput(f), adults: 3, children: 0 }))
      .rejects.toMatchObject({ statusCode: 422, code: 'HOTEL_ROOM_OCCUPANCY_EXCEEDED' });
    expect(await HotelReservation.countDocuments()).toBe(0);
  });

  test('children > maxChildren est refusé (422)', async () => {
    const f = await fixture({ maxAdults: 2, maxChildren: 0 });
    await expect(createReservation({ ...baseInput(f), adults: 1, children: 1 }))
      .rejects.toMatchObject({ statusCode: 422, code: 'HOTEL_ROOM_OCCUPANCY_EXCEEDED' });
  });

  test('une occupation conforme est acceptée', async () => {
    const f = await fixture({ maxAdults: 2, maxChildren: 1 });
    const reservation = await createReservation({ ...baseInput(f), adults: 2, children: 1 });
    expect(reservation.status).toBe('pending');
  });

  test('le prix envoyé par le client est totalement ignoré (jamais lu, toujours recalculé serveur)', async () => {
    const f = await fixture({ maxAdults: 2, maxChildren: 0 });
    const reservation = await createReservation({
      ...baseInput(f), adults: 1, children: 0,
      // Champs de prix falsifiés — createReservation ne les lit jamais.
      amount: 1, totalAmount: 1, unitPrice: 1, currency: 'ZZZ',
    });
    expect(reservation.totalAmount).toBe(30000 * 2); // tarif réel × 2 nuits
    expect(reservation.currency).toBe('XAF');
  });
});
