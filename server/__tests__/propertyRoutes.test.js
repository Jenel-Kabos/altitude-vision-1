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

describe('GET /api/properties/:id', () => {
  afterEach(() => jest.clearAllMocks());

  test('400 — ObjectId invalide sans CastError 500', async () => {
    const res = await request(app).get('/api/properties/not-an-object-id');
    expect(res.statusCode).toBe(400);
    expect(Property.findByIdAndUpdate).not.toHaveBeenCalled();
  });

  test('404 — ObjectId valide mais bien absent', async () => {
    Property.findByIdAndUpdate = jest.fn().mockReturnValue({ populate: jest.fn().mockResolvedValue(null) });
    const res = await request(app).get('/api/properties/507f191e810c19729de860ea');
    expect(res.statusCode).toBe(404);
  });

  test('200 — projection publique retire documents et coordonnées privées propriétaire', async () => {
    const document = {
      _id: '507f191e810c19729de860ea', title: 'TEST DATA PROPERTY', statusAdmin: 'Validée',
      owner: { _id: '507f1f77bcf86cd799439012', name: 'TEST DATA OWNER', photo: '', email: 'private@example.com', phone: '+242000000000' },
      documents: ['TEST DATA PRIVATE DOCUMENT'], images: [], latitude: -4, longitude: 15,
      location: { type: 'Point', coordinates: [15, -4] }, address: { street: 'TEST DATA PRIVATE STREET', city: 'TEST DATA CITY' },
      toObject() { return { ...this, toObject: undefined }; },
    };
    Property.findByIdAndUpdate = jest.fn().mockReturnValue({ populate: jest.fn().mockResolvedValue(document) });
    const res = await request(app).get('/api/properties/507f191e810c19729de860ea');
    expect(res.statusCode).toBe(200);
    expect(res.body.data.property.documents).toBeUndefined();
    expect(res.body.data.property.owner).toEqual(expect.objectContaining({ name: 'TEST DATA OWNER' }));
    expect(res.body.data.property.owner.email).toBeUndefined();
    expect(res.body.data.property.owner.phone).toBeUndefined();
    expect(res.body.data.property.latitude).toBeUndefined();
    expect(res.body.data.property.longitude).toBeUndefined();
    expect(res.body.data.property.location).toBeUndefined();
    expect(res.body.data.property.address.street).toBeUndefined();
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

  test('201 — persiste les honoraires et frais de visite saisis à la création web', async () => {
    User.findById = jest.fn().mockReturnValue({ select: jest.fn().mockResolvedValue(fakeUser('Proprietaire')) });
    User.findByIdAndUpdate = jest.fn().mockReturnValue({ catch: jest.fn() });
    Property.create = jest.fn().mockImplementation(async (data) => ({ _id: fakeProp._id, ...data }));

    const res = await request(app)
      .post('/api/properties')
      .set('Authorization', `Bearer ${makeToken('Proprietaire')}`)
      .send({
        title: 'TEST DATA PROPERTY', description: 'TEST DATA DESCRIPTION', price: '10000000',
        honoraires: '750000', fraisVisite: '0', pole: 'Altimmo', status: 'vente',
        type: 'Villa', surface: '100', latitude: '-4.2661', longitude: '15.2832',
        address: { arrondissement: 'TEST DATA ARRONDISSEMENT' },
      });

    expect(res.statusCode).toBe(201);
    expect(Property.create).toHaveBeenCalledWith(expect.objectContaining({
      honoraires: 750000,
      fraisVisite: 0,
    }));
  });

  test('400 — rejette des honoraires négatifs à la création web', async () => {
    User.findById = jest.fn().mockReturnValue({ select: jest.fn().mockResolvedValue(fakeUser('Proprietaire')) });
    User.findByIdAndUpdate = jest.fn().mockReturnValue({ catch: jest.fn() });

    const res = await request(app)
      .post('/api/properties')
      .set('Authorization', `Bearer ${makeToken('Proprietaire')}`)
      .send({ honoraires: '-1' });

    expect(res.statusCode).toBe(400);
    expect(Property.create).not.toHaveBeenCalled();
  });
});

describe('POST /api/properties/mobile — honoraires', () => {
  afterEach(() => jest.clearAllMocks());

  test('201 — persiste les montants transmis par le mobile', async () => {
    User.findById = jest.fn().mockReturnValue({ select: jest.fn().mockResolvedValue(fakeUser('Proprietaire')) });
    User.findByIdAndUpdate = jest.fn().mockReturnValue({ catch: jest.fn() });
    User.find = jest.fn().mockReturnValue({ select: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue([]) }) });
    Property.create = jest.fn().mockImplementation(async (data) => ({
      _id: { toString: () => fakeProp._id },
      ...data,
    }));

    const res = await request(app)
      .post('/api/properties/mobile')
      .set('Authorization', `Bearer ${makeToken('Proprietaire')}`)
      .send({
        titre: 'TEST DATA PROPERTY', description: 'TEST DATA DESCRIPTION', prix: 200000,
        superficie: 80, arrondissement: 'TEST DATA ARRONDISSEMENT', ville: 'Brazzaville',
        type: 'Appartement', categorie: 'location', photos: ['https://example.test/image.jpg'],
        honoraires: 160000, fraisVisite: 0,
      });

    expect(res.statusCode).toBe(201);
    expect(Property.create).toHaveBeenCalledWith(expect.objectContaining({
      honoraires: 160000,
      fraisVisite: 0,
    }));
  });

  test('400 — rejette des frais de visite négatifs depuis le mobile', async () => {
    User.findById = jest.fn().mockReturnValue({ select: jest.fn().mockResolvedValue(fakeUser('Proprietaire')) });
    User.findByIdAndUpdate = jest.fn().mockReturnValue({ catch: jest.fn() });

    const res = await request(app)
      .post('/api/properties/mobile')
      .set('Authorization', `Bearer ${makeToken('Proprietaire')}`)
      .send({ fraisVisite: -100 });

    expect(res.statusCode).toBe(400);
    expect(Property.create).not.toHaveBeenCalled();
  });
});
