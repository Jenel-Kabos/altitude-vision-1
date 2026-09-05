// PHASE-H5 — conditions commerciales du RatePlan (mealPlan/cancellation),
// snapshot contractuel figé sur la réservation, éligibilité d'annulation
// dérivée du snapshot (jamais du RatePlan courant), jamais de remboursement
// exécuté ici (voir hotelCancellationPolicyService.js).
jest.mock('../services/emailService', () => ({ sendEmailViaZoho: jest.fn().mockResolvedValue({ success: true }) }));
const express = require('express');
const request = require('supertest');
const { startFinancialMongo, clearFinancialMongo, stopFinancialMongo } = require('./helpers/financialMongoEnvironment');
const User = require('../models/User');
const Hotel = require('../models/Hotel');
const RoomCategory = require('../models/RoomCategory');
const RatePlan = require('../models/RatePlan');
const HotelReservation = require('../models/HotelReservation');
const hotelRoutes = require('../routes/hotelRoutes');
const hotelReservationRoutes = require('../routes/hotelReservationRoutes');
const { errorHandler } = require('../middleware/errorMiddleware');
const { createReservation, searchAvailableRoomCategories } = require('../services/hotelReservationService');
const { computeCancellationEligibility, describeCancellationPolicy } = require('../services/hotel/hotelCancellationPolicyService');

jest.setTimeout(120000);
const app = express(); app.use(express.json());
app.use('/api/hotels', hotelRoutes);
app.use('/api/hotel-reservations', hotelReservationRoutes);
app.use(errorHandler);
let userCounter = 0;
async function makeUser(overrides = {}) {
  userCounter += 1;
  return User.create({ name: `H5 User ${userCounter}`, email: `h5-user-${Date.now()}-${userCounter}@example.test`, password: 'Password123!', passwordConfirm: 'Password123!', role: 'Proprietaire', isEmailVerified: true, ...overrides });
}
async function makeHotel(overrides = {}) {
  const manager = await makeUser();
  const hotel = await Hotel.create({ name: `Hôtel H5 ${Math.random().toString(36).slice(2)}`, manager: manager._id, createdBy: manager._id, publicationStatus: 'publie', active: true, ...overrides });
  return { hotel, manager: manager._id };
}
async function makeCategory(hotel) {
  return RoomCategory.create({ hotel: hotel._id, name: 'Standard', code: `C-${Date.now()}-${Math.random()}`, status: 'actif', capacity: { maxAdults: 2, maxChildren: 1 }, createdBy: hotel.manager });
}
async function makeRate(category, hotel, overrides = {}) {
  return RatePlan.create({ roomCategory: category._id, rateType: 'public', amount: 40000, currency: 'XAF', active: true, createdBy: hotel.manager, ...overrides });
}

beforeAll(async () => {
  await startFinancialMongo();
  await Promise.all([Hotel, RoomCategory, RatePlan, HotelReservation].map((m) => m.syncIndexes()));
});
afterEach(clearFinancialMongo);
afterAll(stopFinancialMongo);

describe('RatePlan — schéma commercial H5 (rétrocompatibilité + validation)', () => {
  test('un RatePlan legacy (sans mealPlan/cancellation) reste valide', async () => {
    const { hotel } = await makeHotel();
    const category = await makeCategory(hotel);
    const rate = await makeRate(category, hotel);
    expect(rate.mealPlan).toBeNull();
    expect(rate.cancellation).toBeNull();
  });

  test('mealPlan et cancellation valides sont acceptés', async () => {
    const { hotel } = await makeHotel();
    const category = await makeCategory(hotel);
    const rate = await makeRate(category, hotel, {
      mealPlan: 'breakfast_included',
      cancellation: { type: 'free_until', deadlineHoursBeforeCheckIn: 48, penaltyType: 'percentage', penaltyValue: 50 },
    });
    expect(rate.mealPlan).toBe('breakfast_included');
    expect(rate.cancellation.type).toBe('free_until');
  });

  test('un mealPlan hors enum est rejeté', async () => {
    const { hotel } = await makeHotel();
    const category = await makeCategory(hotel);
    await expect(makeRate(category, hotel, { mealPlan: 'all_inclusive' })).rejects.toThrow(/mealPlan/i);
  });

  test('non_refundable avec un délai renseigné est rejeté (configuration contradictoire)', async () => {
    const { hotel } = await makeHotel();
    const category = await makeCategory(hotel);
    await expect(makeRate(category, hotel, {
      cancellation: { type: 'non_refundable', deadlineHoursBeforeCheckIn: 24 },
    })).rejects.toThrow(/contradictoire/i);
  });

  test('free_until sans délai est rejeté', async () => {
    const { hotel } = await makeHotel();
    const category = await makeCategory(hotel);
    await expect(makeRate(category, hotel, { cancellation: { type: 'free_until' } })).rejects.toThrow(/délai/i);
  });

  test('une pénalité en pourcentage supérieure à 100 est rejetée', async () => {
    const { hotel } = await makeHotel();
    const category = await makeCategory(hotel);
    await expect(makeRate(category, hotel, {
      cancellation: { type: 'flexible', deadlineHoursBeforeCheckIn: 24, penaltyType: 'percentage', penaltyValue: 150 },
    })).rejects.toThrow(/100/);
  });
});

describe('POST /:hotelId/room-categories/:id/rate-plans (H5) — gestion professionnelle', () => {
  async function actorHeader(hotel) {
    const jwt = require('jsonwebtoken');
    return { Authorization: `Bearer ${jwt.sign({ id: hotel.manager, tokenVersion: 0 }, process.env.JWT_SECRET, { expiresIn: '1d' })}` };
  }
  test('le propriétaire peut créer un tarif avec conditions commerciales', async () => {
    const { hotel } = await makeHotel();
    const category = await makeCategory(hotel);
    const response = await request(app)
      .post(`/api/hotels/room-categories/${category._id}/rate-plans`)
      .set(await actorHeader(hotel))
      .send({ rateType: 'public', amount: 50000, mealPlan: 'half_board', cancellation: { type: 'flexible', deadlineHoursBeforeCheckIn: 72, penaltyType: 'fixed_amount', penaltyValue: 10000 } });
    expect(response.status).toBe(201);
    expect(response.body.data.rate.mealPlan).toBe('half_board');
    expect(response.body.data.rate.cancellation.type).toBe('flexible');
  });

  test('un mealPlan invalide est refusé (422)', async () => {
    const { hotel } = await makeHotel();
    const category = await makeCategory(hotel);
    const response = await request(app)
      .post(`/api/hotels/room-categories/${category._id}/rate-plans`)
      .set(await actorHeader(hotel))
      .send({ rateType: 'public', amount: 50000, mealPlan: 'buffet_illimite' });
    expect(response.status).toBe(422);
  });

  test('un autre propriétaire ne peut pas gérer les tarifs de cet hôtel (isolation tenant H5)', async () => {
    const { hotel } = await makeHotel();
    const category = await makeCategory(hotel);
    const { hotel: intruder } = await makeHotel();
    const response = await request(app)
      .post(`/api/hotels/room-categories/${category._id}/rate-plans`)
      .set(await actorHeader(intruder))
      .send({ rateType: 'public', amount: 50000, mealPlan: 'breakfast_included' });
    expect(response.status).toBe(403);
  });
});

describe('Disponibilité — offres avec conditions commerciales (H5)', () => {
  test('une offre avec RatePlan H5 expose mealPlan et cancellation réels', async () => {
    const { hotel } = await makeHotel();
    const category = await makeCategory(hotel);
    await makeRate(category, hotel, {
      mealPlan: 'breakfast_included',
      cancellation: { type: 'free_until', deadlineHoursBeforeCheckIn: 48 },
    });
    const checkIn = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
    const checkOut = new Date(Date.now() + 32 * 86400000).toISOString().slice(0, 10);
    const result = await searchAvailableRoomCategories({ hotelId: hotel._id, checkInDate: checkIn, checkOutDate: checkOut, roomsCount: 1, adults: 1, children: 0 });
    const offer = result.roomCategories[0].offers[0];
    expect(offer.mealPlan).toBe('breakfast_included');
    expect(offer.cancellation.type).toBe('free_until');
    expect(offer.cancellation.deadlineAt).toBeInstanceOf(Date);
  });

  test('un RatePlan legacy (sans conditions) ne fabrique jamais de condition favorable', async () => {
    const { hotel } = await makeHotel();
    const category = await makeCategory(hotel);
    await makeRate(category, hotel);
    const checkIn = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
    const checkOut = new Date(Date.now() + 32 * 86400000).toISOString().slice(0, 10);
    const result = await searchAvailableRoomCategories({ hotelId: hotel._id, checkInDate: checkIn, checkOutDate: checkOut, roomsCount: 1, adults: 1, children: 0 });
    const offer = result.roomCategories[0].offers[0];
    expect(offer.mealPlan).toBeNull();
    expect(offer.cancellation).toBeNull();
  });
});

describe('Snapshot contractuel de la réservation (H5)', () => {
  async function bookWithRate(rateOverrides) {
    const { hotel } = await makeHotel();
    const category = await makeCategory(hotel);
    const rate = await makeRate(category, hotel, rateOverrides);
    const reservation = await createReservation({
      hotelId: hotel._id, roomCategoryId: category._id, ratePlanId: rate._id,
      guest: { firstName: 'Jean', lastName: 'Dupont', email: 'jean@example.test' },
      checkInDate: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
      checkOutDate: new Date(Date.now() + 32 * 86400000).toISOString().slice(0, 10),
      roomsCount: 1, adults: 1, source: 'public_web',
    });
    return { hotel, category, rate, reservation };
  }

  test('la réservation fige mealPlan et cancellation au moment de la création', async () => {
    const { reservation } = await bookWithRate({
      mealPlan: 'full_board',
      cancellation: { type: 'flexible', deadlineHoursBeforeCheckIn: 24, penaltyType: 'percentage', penaltyValue: 30 },
    });
    expect(reservation.rateSnapshot.mealPlan).toBe('full_board');
    expect(reservation.rateSnapshot.cancellation.type).toBe('flexible');
    expect(reservation.rateSnapshot.cancellation.penaltyValue).toBe(30);
  });

  test('modifier le RatePlan après coup ne change jamais le snapshot déjà figé', async () => {
    const { rate, reservation } = await bookWithRate({
      mealPlan: 'breakfast_included',
      cancellation: { type: 'free_until', deadlineHoursBeforeCheckIn: 48 },
    });
    rate.mealPlan = 'full_board';
    rate.cancellation = { type: 'non_refundable' };
    await rate.save();

    const reloaded = await HotelReservation.findById(reservation._id);
    expect(reloaded.rateSnapshot.mealPlan).toBe('breakfast_included');
    expect(reloaded.rateSnapshot.cancellation.type).toBe('free_until');
  });

  test('un client ne peut pas imposer ses propres conditions commerciales à la création', async () => {
    const { hotel } = await makeHotel();
    const category = await makeCategory(hotel);
    await makeRate(category, hotel, { mealPlan: 'room_only' });
    const rate2 = await RatePlan.findOne({ roomCategory: category._id });
    const response = await request(app)
      .post(`/api/hotels/${hotel._id}/reservations`)
      .send({
        roomCategoryId: category._id, ratePlanId: rate2._id,
        checkInDate: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
        checkOutDate: new Date(Date.now() + 32 * 86400000).toISOString().slice(0, 10),
        roomsCount: 1, adults: 1,
        guest: { firstName: 'Jean', lastName: 'Dupont', email: 'jean2@example.test' },
        // Tentative d'injection cliente — doit être totalement ignorée.
        mealPlan: 'full_board', cancellation: { type: 'non_refundable' },
      });
    expect(response.status).toBe(201);
    expect(response.body.data.reservation.rateSnapshot.mealPlan).toBe('room_only');
    expect(response.body.data.reservation.rateSnapshot.cancellation).toBeNull();
  });
});

describe('Éligibilité d’annulation (H5) — dérivée du snapshot, jamais exécutée', () => {
  test('avant l’échéance : annulation gratuite', () => {
    const reservation = {
      status: 'confirmed', totalAmount: 100000,
      checkInDate: new Date(Date.now() + 10 * 86400000),
      rateSnapshot: { cancellation: { type: 'free_until', deadlineHoursBeforeCheckIn: 48 } },
    };
    const result = computeCancellationEligibility({ reservation });
    expect(result.freeCancellation).toBe(true);
    expect(result.penaltyAmount).toBe(0);
    expect(result.refundableAmount).toBe(100000);
  });

  test('après l’échéance : pénalité calculée (pourcentage)', () => {
    const reservation = {
      status: 'confirmed', totalAmount: 100000,
      checkInDate: new Date(Date.now() + 1 * 3600 * 1000), // dans 1h
      rateSnapshot: { cancellation: { type: 'flexible', deadlineHoursBeforeCheckIn: 48, penaltyType: 'percentage', penaltyValue: 30 } },
    };
    const result = computeCancellationEligibility({ reservation });
    expect(result.freeCancellation).toBe(false);
    expect(result.penaltyAmount).toBe(30000);
    expect(result.refundableAmount).toBe(70000);
  });

  test('non remboursable : aucun montant remboursable, quelle que soit la date', () => {
    const reservation = {
      status: 'confirmed', totalAmount: 60000,
      checkInDate: new Date(Date.now() + 60 * 86400000),
      rateSnapshot: { cancellation: { type: 'non_refundable' } },
    };
    const result = computeCancellationEligibility({ reservation });
    expect(result.freeCancellation).toBe(false);
    expect(result.penaltyAmount).toBe(60000);
    expect(result.refundableAmount).toBe(0);
  });

  test('politique inconnue (RatePlan pré-H5) : jamais fabriquée comme remboursable ou non', () => {
    const reservation = { status: 'confirmed', totalAmount: 50000, checkInDate: new Date(), rateSnapshot: {} };
    const result = computeCancellationEligibility({ reservation });
    expect(result.policyKnown).toBe(false);
    expect(result.freeCancellation).toBeNull();
    expect(result.refundableAmount).toBeNull();
  });

  test('l’éligibilité utilise le snapshot figé, jamais le RatePlan courant même modifié depuis', async () => {
    const { hotel } = await makeHotel();
    const category = await makeCategory(hotel);
    const rate = await makeRate(category, hotel, { cancellation: { type: 'free_until', deadlineHoursBeforeCheckIn: 48 } });
    const reservation = await createReservation({
      hotelId: hotel._id, roomCategoryId: category._id, ratePlanId: rate._id,
      guest: { firstName: 'A', lastName: 'B', email: 'ab@example.test' },
      checkInDate: new Date(Date.now() + 10 * 86400000).toISOString().slice(0, 10),
      checkOutDate: new Date(Date.now() + 12 * 86400000).toISOString().slice(0, 10),
      roomsCount: 1, adults: 1, source: 'public_web',
    });
    rate.cancellation = { type: 'non_refundable' };
    await rate.save();

    const result = computeCancellationEligibility({ reservation });
    expect(result.freeCancellation).toBe(true); // toujours basé sur le snapshot d'origine
  });

  test('GET /:id/cancellation-eligibility n’exécute aucun remboursement ni mutation', async () => {
    const { hotel } = await makeHotel();
    const category = await makeCategory(hotel);
    const rate = await makeRate(category, hotel, { cancellation: { type: 'free_until', deadlineHoursBeforeCheckIn: 48 } });
    const jwt = require('jsonwebtoken');
    const guest = await makeUser({ role: 'Client' });
    const reservation = await createReservation({
      hotelId: hotel._id, roomCategoryId: category._id, ratePlanId: rate._id,
      guestUserId: guest._id,
      guest: { firstName: 'A', lastName: 'B', email: 'ab2@example.test' },
      checkInDate: new Date(Date.now() + 10 * 86400000).toISOString().slice(0, 10),
      checkOutDate: new Date(Date.now() + 12 * 86400000).toISOString().slice(0, 10),
      roomsCount: 1, adults: 1, source: 'public_web',
    });
    const token = jwt.sign({ id: guest._id, tokenVersion: 0 }, process.env.JWT_SECRET, { expiresIn: '1d' });
    const response = await request(app)
      .get(`/api/hotel-reservations/${reservation._id}/cancellation-eligibility`)
      .set('Authorization', `Bearer ${token}`);
    expect(response.status).toBe(200);
    expect(response.body.data.eligibility.freeCancellation).toBe(true);
    const reloaded = await HotelReservation.findById(reservation._id);
    expect(reloaded.status).toBe('pending'); // statut inchangé : lecture pure
  });
});

describe('describeCancellationPolicy — formatage offre (pur)', () => {
  test('non_refundable ne porte jamais de délai', () => {
    expect(describeCancellationPolicy({ type: 'non_refundable' }, new Date())).toEqual({
      type: 'non_refundable', deadlineAt: null, penaltyType: null, penaltyValue: null,
    });
  });
  test('absence de politique → null (jamais une valeur par défaut)', () => {
    expect(describeCancellationPolicy(null, new Date())).toBeNull();
  });
});
