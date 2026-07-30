// Correctif robustesse 2026-07 — teste la route RÉELLE POST /api/accommodations/mobile/full
// (router + middlewares d'auth réels + contrôleur + service, sur un vrai MongoMemoryReplSet).
// App Express minimale (pas server.js — qui connecte une vraie Mongo prod et démarre des cron
// jobs, jamais safe à importer en test, voir convention déjà en place dans propertyRoutes.test.js
// qui neutralise ces effets de bord par jest.mock plutôt que d'éviter server.js — ici on préfère
// isoler strictement le routeur sous test, cf. propertySearchFilters.mongo.integration.test.js).

jest.mock('../config/cloudinary', () => ({
  destroyFromCloudinary: jest.fn().mockResolvedValue(true),
  upload: { array: () => (req, res, next) => next(), single: () => (req, res, next) => next() },
}));

const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const { startFinancialMongo, clearFinancialMongo, stopFinancialMongo } = require('./helpers/financialMongoEnvironment');
const User = require('../models/User');
const Property = require('../models/Property');
const Accommodation = require('../models/Accommodation');
const RatePlan = require('../models/RatePlan');
const Hotel = require('../models/Hotel');
const ActionLog = require('../models/ActionLog');
const RoomCategory = require('../models/RoomCategory');
const accommodationRoutes = require('../routes/accommodationRoutes');
const { errorHandler } = require('../middleware/errorMiddleware');

jest.setTimeout(120000);

const app = express();
app.use(express.json());
app.use('/api/accommodations', accommodationRoutes);
app.use(errorHandler);

const signToken = (id, tokenVersion = 0) =>
  jwt.sign({ id, tokenVersion }, process.env.JWT_SECRET, { expiresIn: '1d' });

let userCounter = 0;
const makeUser = (overrides = {}) => {
  userCounter += 1;
  return User.create({
    name: 'Propriétaire Test', email: `httpowner${userCounter}${Date.now()}@example.com`,
    password: 'Password123!', passwordConfirm: 'Password123!', role: 'Proprietaire', ...overrides,
  });
};

const basePayload = (overrides = {}) => ({
  publicationRequestId: overrides.publicationRequestId || `req-http-${Date.now()}-${Math.random()}`,
  publicationKind: overrides.publicationKind || 'furnished_accommodation',
  property: {
    titre: 'Villa meublée avec piscine',
    description: 'Description suffisamment longue pour la validation du modèle Property.',
    type: 'Villa', ville: 'Brazzaville', arrondissement: 'Bacongo',
    superficie: 200, prix: 35000, bathrooms: 1,
    photos: ['https://res.cloudinary.test/photo1.jpg'],
    ...overrides.property,
  },
  accommodation: {
    accommodationType: 'villa_meublee', capacity: { maxAdults: 2, maxChildren: 0 },
    checkInTime: '14:00', checkOutTime: '11:00',
    ...overrides.accommodation,
  },
  ratePlan: { mode: 'nightly', amount: 35000, currency: 'XAF', ...overrides.ratePlan },
});

const hotelPayload = (accommodationType = 'hotel') => basePayload({
  publicationKind: 'hotel_establishment',
  property: {
    titre: 'Hôtel Panorama', description: 'Établissement hôtelier au centre-ville.',
    type: 'Commerce', ville: 'Brazzaville', arrondissement: 'Poto-Poto',
    superficie: 1, prix: 45000, chambres: 0, bathrooms: 0,
    photos: ['https://res.cloudinary.test/hotel.jpg'],
  },
  accommodation: {
    accommodationType, capacity: { maxAdults: 80, maxChildren: 0 },
    checkInTime: '14:00', checkOutTime: '11:00',
    hotel: { name: 'Hôtel Panorama', description: 'Établissement hôtelier au centre-ville.', phone: '+242060000000', starRating: 3, hasReception: true, hotelServices: { wifi: true, reception24h: true } },
  },
  ratePlan: { amount: 45000 },
  roomCategories: [],
});

const professionalHotelPayload = (accommodationType = 'hotel') => ({
  ...hotelPayload(accommodationType),
  roomCategories: [
    { clientKey: 'std', name: 'Standard', code: 'STD', categoryType: 'standard', quantity: 13, adultCapacity: 2, childCapacity: 0, beds: 1, ratePlans: [{ rateType: 'public', amount: 35000, currency: 'XAF' }] },
    { clientKey: 'ste', name: 'Suite', code: 'STE', categoryType: 'suite', quantity: 5, adultCapacity: 2, childCapacity: 1, beds: 2, ratePlans: [{ rateType: 'public', amount: 85000, currency: 'XAF' }] },
  ],
  property: { ...hotelPayload(accommodationType).property, prix: 35000 },
});

beforeAll(async () => {
  await startFinancialMongo();
  await Accommodation.syncIndexes();
});
afterEach(async () => { await clearFinancialMongo(); jest.clearAllMocks(); });
afterAll(stopFinancialMongo);

describe('POST /api/accommodations/mobile/full', () => {
  test('201 — succès, Property+Accommodation+RatePlan créés et soumis', async () => {
    const user = await makeUser();
    const res = await request(app)
      .post('/api/accommodations/mobile/full')
      .set('Authorization', `Bearer ${signToken(user._id)}`)
      .send(basePayload());

    expect(res.statusCode).toBe(201);
    expect(res.body.status).toBe('success');
    expect(res.body.data.accommodation.publicationStatus).toBe('soumis');
    expect(await Property.countDocuments()).toBe(1);
    expect(await Accommodation.countDocuments()).toBe(1);
    expect(await RatePlan.countDocuments()).toBe(1);
  });

  test.each(['hotel', 'residence_hoteliere'])('201 — établissement %s : Hotel créé, type/prix/tarif cohérents', async (type) => {
    const user = await makeUser();
    const res = await request(app)
      .post('/api/accommodations/mobile/full')
      .set('Authorization', `Bearer ${signToken(user._id)}`)
      .send(professionalHotelPayload(type));

    expect(res.statusCode).toBe(201);
    const [property, accommodation, rate, hotel] = await Promise.all([
      Property.findOne(), Accommodation.findOne(), RatePlan.findOne(), Hotel.findOne(),
    ]);
    expect(property.type).toBe('Commerce');
    expect(property.price).toBe(35000);
    expect(rate.amount).toBe(35000);
    expect(accommodation.accommodationType).toBe(type);
    expect(accommodation.hotel.toString()).toBe(hotel._id.toString());
    expect(accommodation.occupancyMode).toBe('room_based');
    expect(hotel).toMatchObject({ totalRooms: 18, totalCapacity: 41, minNightlyRate: 35000, maxNightlyRate: 85000 });
    expect(await RoomCategory.countDocuments({ hotel: hotel._id })).toBe(2);
  });

  test.each([
    ['aucune catégorie', [], 'roomCategories'],
    ['quantité nulle', [{ ...professionalHotelPayload().roomCategories[0], quantity: 0 }], 'roomCategories.0.quantity'],
    ['tarif absent', [{ ...professionalHotelPayload().roomCategories[0], ratePlans: [] }], 'roomCategories.0.ratePlans'],
    ['codes dupliqués', [professionalHotelPayload().roomCategories[0], { ...professionalHotelPayload().roomCategories[1], code: 'STD' }], 'roomCategories.1.code'],
  ])('422 — hôtel refusé : %s', async (_label, roomCategories, field) => {
    const user = await makeUser();
    const res = await request(app).post('/api/accommodations/mobile/full')
      .set('Authorization', `Bearer ${signToken(user._id)}`)
      .send({ ...professionalHotelPayload(), roomCategories });
    expect(res.statusCode).toBe(422);
    expect(res.body.missingFields.map((item) => item.field)).toContain(field);
    expect(await Hotel.countDocuments()).toBe(0);
  });

  test('422 — Property.prix divergent du tarif minimum', async () => {
    const user = await makeUser();
    const payload = professionalHotelPayload();
    payload.property.prix = 99999;
    const res = await request(app).post('/api/accommodations/mobile/full')
      .set('Authorization', `Bearer ${signToken(user._id)}`).send(payload);
    expect(res.statusCode).toBe(422);
    expect(res.body.missingFields.map((item) => item.field)).toContain('property.prix/minNightlyRate');
  });

  test('400 — famille et accommodationType incohérents : rollback avant transaction', async () => {
    const user = await makeUser();
    const res = await request(app)
      .post('/api/accommodations/mobile/full')
      .set('Authorization', `Bearer ${signToken(user._id)}`)
      .send(basePayload({ accommodation: { accommodationType: 'hotel' } }));
    expect(res.statusCode).toBe(400);
    expect(await Property.countDocuments()).toBe(0);
  });

  test('200 — retry avec la même publicationRequestId : réponse idempotente stable, aucun doublon', async () => {
    const user = await makeUser();
    const payload = basePayload();
    const token = `Bearer ${signToken(user._id)}`;

    const first = await request(app).post('/api/accommodations/mobile/full').set('Authorization', token).send(payload);
    expect(first.statusCode).toBe(201);

    const second = await request(app).post('/api/accommodations/mobile/full').set('Authorization', token).send(payload);
    expect(second.statusCode).toBe(200);
    expect(second.body.data.accommodation._id).toBe(first.body.data.accommodation._id);

    expect(await Accommodation.countDocuments()).toBe(1);
  });

  test('400 — payload invalide (titre manquant), aucune écriture', async () => {
    const user = await makeUser();
    const res = await request(app)
      .post('/api/accommodations/mobile/full')
      .set('Authorization', `Bearer ${signToken(user._id)}`)
      .send(basePayload({ property: { titre: '' } }));

    expect(res.statusCode).toBe(400);
    expect(res.body.code).toBe('MOBILE_ACCOMMODATION_VALIDATION_ERROR');
    expect(await Property.countDocuments()).toBe(0);
  });

  test('401 — aucun token fourni', async () => {
    const res = await request(app).post('/api/accommodations/mobile/full').send(basePayload());
    expect(res.statusCode).toBe(401);
    expect(await Property.countDocuments()).toBe(0);
  });

  test('403 — rôle non autorisé à publier un bien (Client)', async () => {
    const user = await makeUser({ role: 'Client', email: `client${Date.now()}@example.com` });
    const res = await request(app)
      .post('/api/accommodations/mobile/full')
      .set('Authorization', `Bearer ${signToken(user._id)}`)
      .send(basePayload());

    expect(res.statusCode).toBe(403);
    expect(await Property.countDocuments()).toBe(0);
  });

  test('403 — clé de publication déjà utilisée par un autre utilisateur', async () => {
    const owner = await makeUser();
    const intruder = await makeUser();
    const payload = basePayload();

    const first = await request(app).post('/api/accommodations/mobile/full').set('Authorization', `Bearer ${signToken(owner._id)}`).send(payload);
    expect(first.statusCode).toBe(201);

    const res = await request(app)
      .post('/api/accommodations/mobile/full')
      .set('Authorization', `Bearer ${signToken(intruder._id)}`)
      .send(payload);

    expect(res.statusCode).toBe(403);
    expect(res.body.code).toBe('MOBILE_ACCOMMODATION_IDEMPOTENCY_KEY_CONFLICT');
    expect(await Accommodation.countDocuments()).toBe(1);
  });

  test('500 — échec inattendu (ActionLog) : rollback garanti, aucune donnée persistée', async () => {
    const user = await makeUser();
    const spy = jest.spyOn(ActionLog, 'create').mockRejectedValueOnce(new Error('ActionLog indisponible'));

    const res = await request(app)
      .post('/api/accommodations/mobile/full')
      .set('Authorization', `Bearer ${signToken(user._id)}`)
      .send(basePayload());

    expect(res.statusCode).toBe(500);
    expect(await Property.countDocuments()).toBe(0);
    expect(await Accommodation.countDocuments()).toBe(0);
    spy.mockRestore();
  });
});
