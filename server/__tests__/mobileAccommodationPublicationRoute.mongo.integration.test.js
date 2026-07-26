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
const ActionLog = require('../models/ActionLog');
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
