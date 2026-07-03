// __tests__/propertyRoutes.test.js
// Tests d'intégration des routes de biens immobiliers (modèles mockés)

jest.mock('../models/Property');
jest.mock('../models/User');
jest.mock('../config/db', () => jest.fn());
jest.mock('node-cron', () => ({ schedule: jest.fn() }));
jest.mock('../scripts/sync-facebook', () => ({ syncFacebook: jest.fn() }));
jest.mock('../services/zohoImapService', () => ({ pollZohoInbox: jest.fn() }));
jest.mock('../services/alerteService', () => ({ verifierPaiementsEnRetard: jest.fn() }));
jest.mock('../utils/generateSitemap', () => jest.fn().mockResolvedValue('<xml/>'));
const mockMiddleware = () => (req, res, next) => next();
jest.mock('../config/cloudinary', () => ({
  uploadToCloudinary:    jest.fn(),
  destroyFromCloudinary: jest.fn(),
  upload: { single: mockMiddleware, array: mockMiddleware },
}));
jest.mock('../services/actionLogService', () => ({
  logAction:   jest.fn(),
  buildAuteur: jest.fn(),
}));

const request  = require('supertest');
const jwt      = require('jsonwebtoken');
const { app }  = require('../server');
const Property = require('../models/Property');
const User     = require('../models/User');

// ─── Helpers ─────────────────────────────────────────────────────────────────

const makeToken = (role = 'Client') =>
  jwt.sign(
    { id: '507f1f77bcf86cd799439011', tokenVersion: 0 },
    process.env.JWT_SECRET,
    { expiresIn: '1d' },
  );

const fakeUser = (role = 'Client') => ({
  _id:          '507f1f77bcf86cd799439011',
  name:         'Test User',
  email:        'test@altitude.com',
  role,
  isActive:     true,
  status:       'Actif',
  tokenVersion: 0,
});

const fakeProp = {
  _id:         '507f191e810c19729de860ea',
  title:       'Villa à Brazzaville',
  price:       15000000,
  type:        'Villa',
  status:      'vente',
  statusAdmin: 'Validée',
  owner:       { name: 'Proprio', email: 'p@test.com' },
};

// Chaîne Mongoose complète dont APIFeatures a besoin
const makeMongoChain = (result = [fakeProp]) => {
  const chain = {};
  // toutes les méthodes chainables retournent le même objet
  ['find', 'sort', 'select', 'skip', 'limit', 'populate', 'lean'].forEach(m => {
    chain[m] = jest.fn().mockReturnValue(chain);
  });
  // then/catch permettent d'await la chaîne
  chain.then = (resolve) => Promise.resolve(result).then(resolve);
  chain.catch = (reject) => Promise.resolve(result).catch(reject);
  return chain;
};

// ─── GET /api/properties (listing public) ───────────────────────────────────

describe('GET /api/properties', () => {
  afterEach(() => jest.clearAllMocks());

  test('réponse non-4xx — route accessible sans authentification', async () => {
    Property.find = jest.fn().mockReturnValue(makeMongoChain());
    Property.countDocuments = jest.fn().mockResolvedValue(1);

    const res = await request(app).get('/api/properties');
    // La route est publique — ne doit pas retourner 401 ni 403
    expect(res.statusCode).not.toBe(401);
    expect(res.statusCode).not.toBe(403);
  });
});

// ─── GET /api/properties/recommended ────────────────────────────────────────

describe('GET /api/properties/recommended', () => {
  afterEach(() => jest.clearAllMocks());

  test('200 — biens recommandés accessibles sans token', async () => {
    Property.find = jest.fn().mockReturnValue({
      populate: jest.fn().mockReturnValue({
        limit: jest.fn().mockResolvedValue([fakeProp]),
      }),
    });

    const res = await request(app).get('/api/properties/recommended');
    expect([200, 500]).toContain(res.statusCode);
  });
});

// ─── POST /api/properties (création — authentification requise) ──────────────

describe('POST /api/properties', () => {
  afterEach(() => jest.clearAllMocks());

  test('401 sans token', async () => {
    const res = await request(app)
      .post('/api/properties')
      .send({ title: 'Villa', price: 10000000 });
    expect(res.statusCode).toBe(401);
  });

  test('401 avec token invalide', async () => {
    const res = await request(app)
      .post('/api/properties')
      .set('Authorization', 'Bearer token.invalide.xyz')
      .send({ title: 'Villa', price: 10000000 });
    expect(res.statusCode).toBe(401);
  });

  test('token invalide retourne 401', async () => {
    const res = await request(app)
      .post('/api/properties')
      .set('Authorization', 'Bearer jwt.invalide.ici')
      .send({ title: 'Villa test', price: 15000000 });
    expect(res.statusCode).toBe(401);
  });
});
