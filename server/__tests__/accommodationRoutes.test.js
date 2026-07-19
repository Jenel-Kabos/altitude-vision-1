// __tests__/accommodationRoutes.test.js
// Tests d'intégration du domaine Hébergement (Sprint 2, modèles mockés)

jest.mock('../models/Accommodation');
jest.mock('../models/RatePlan');
jest.mock('../models/Property');
jest.mock('../models/User');
jest.mock('../config/db', () => jest.fn());
jest.mock('node-cron', () => ({ schedule: jest.fn() }));
jest.mock('../scripts/sync-facebook', () => ({ syncFacebook: jest.fn() }));
jest.mock('../services/zohoImapService', () => ({ pollZohoInbox: jest.fn() }));
jest.mock('../services/alerteService', () => ({ verifierPaiementsEnRetard: jest.fn() }));
jest.mock('../utils/generateSitemap', () => jest.fn().mockResolvedValue('<xml/>'));
jest.mock('../services/notificationService', () => ({
  notify: jest.fn().mockResolvedValue(),
  notifyStaff: jest.fn().mockResolvedValue(),
  notifyMany: jest.fn().mockResolvedValue(),
}));

const request  = require('supertest');
const jwt      = require('jsonwebtoken');
const { app }  = require('../server');
const Accommodation = require('../models/Accommodation');
const RatePlan       = require('../models/RatePlan');
const Property        = require('../models/Property');
const User             = require('../models/User');

// Le vrai modèle expose ACCOMMODATION_TYPES / RATE_MODES en propriétés
// statiques ; jest.mock('../models/Accommodation') les efface (automock).
// On les restaure ici pour que le contrôleur (qui les lit) continue de
// fonctionner sous mock.
Accommodation.ACCOMMODATION_TYPES = ['villa_meublee', 'maison_meublee', 'appartement_meuble', 'studio_meuble', 'residence_meublee', 'bungalow'];
RatePlan.RATE_MODES = ['nightly', 'weekly', 'monthly', 'yearly'];

const OWNER_ID = '507f1f77bcf86cd799439011';
const OTHER_OWNER_ID = '507f1f77bcf86cd799439099';
const ADMIN_ID = '507f1f77bcf86cd799439012';
const PROPERTY_ID = '507f191e810c19729de860ea';
const ACCOMMODATION_ID = '607f191e810c19729de860eb';

const makeToken = (id) => jwt.sign({ id, tokenVersion: 0 }, process.env.JWT_SECRET, { expiresIn: '1d' });
const fakeUser = (id, role = 'Proprietaire') => ({
  _id: id, id, name: 'Test User', email: 'test@altitude.com',
  role, isActive: true, status: 'Actif', tokenVersion: 0,
});

const mockUserAuth = (id, role) => {
  User.findById = jest.fn().mockReturnValue({ select: jest.fn().mockResolvedValue(fakeUser(id, role)) });
  User.findByIdAndUpdate = jest.fn().mockReturnValue({ catch: jest.fn() });
};

const hebergementProperty = (overrides = {}) => ({
  _id: PROPERTY_ID,
  title: 'Villa Test',
  owner: OWNER_ID,
  status: 'hebergement',
  statusAdmin: 'Validée',
  availability: 'Disponible',
  ...overrides,
});

describe('POST /api/accommodations — création', () => {
  afterEach(() => jest.clearAllMocks());

  test('401 sans token', async () => {
    const res = await request(app).post('/api/accommodations').send({});
    expect(res.statusCode).toBe(401);
  });

  test('404 — bien introuvable', async () => {
    mockUserAuth(OWNER_ID, 'Proprietaire');
    Property.findById = jest.fn().mockResolvedValue(null);
    const res = await request(app)
      .post('/api/accommodations')
      .set('Authorization', `Bearer ${makeToken(OWNER_ID)}`)
      .send({ property: PROPERTY_ID, accommodationType: 'villa_meublee' });
    expect(res.statusCode).toBe(404);
  });

  test("403 — un autre utilisateur que le propriétaire ne peut pas créer l'hébergement", async () => {
    mockUserAuth(OTHER_OWNER_ID, 'Proprietaire');
    Property.findById = jest.fn().mockResolvedValue(hebergementProperty());
    const res = await request(app)
      .post('/api/accommodations')
      .set('Authorization', `Bearer ${makeToken(OTHER_OWNER_ID)}`)
      .send({ property: PROPERTY_ID, accommodationType: 'villa_meublee' });
    expect(res.statusCode).toBe(403);
    expect(Accommodation.create).not.toHaveBeenCalled();
  });

  test("422 — refuse un Property dont le status n'est pas hebergement (Vente inchangée)", async () => {
    mockUserAuth(OWNER_ID, 'Proprietaire');
    Property.findById = jest.fn().mockResolvedValue(hebergementProperty({ status: 'vente' }));
    const res = await request(app)
      .post('/api/accommodations')
      .set('Authorization', `Bearer ${makeToken(OWNER_ID)}`)
      .send({ property: PROPERTY_ID, accommodationType: 'villa_meublee' });
    expect(res.statusCode).toBe(422);
    expect(Accommodation.create).not.toHaveBeenCalled();
  });

  test("422 — refuse un Property en location (Location inchangée)", async () => {
    mockUserAuth(OWNER_ID, 'Proprietaire');
    Property.findById = jest.fn().mockResolvedValue(hebergementProperty({ status: 'location' }));
    const res = await request(app)
      .post('/api/accommodations')
      .set('Authorization', `Bearer ${makeToken(OWNER_ID)}`)
      .send({ property: PROPERTY_ID, accommodationType: 'villa_meublee' });
    expect(res.statusCode).toBe(422);
  });

  test('422 — refuse un accommodationType invalide', async () => {
    mockUserAuth(OWNER_ID, 'Proprietaire');
    Property.findById = jest.fn().mockResolvedValue(hebergementProperty());
    const res = await request(app)
      .post('/api/accommodations')
      .set('Authorization', `Bearer ${makeToken(OWNER_ID)}`)
      .send({ property: PROPERTY_ID, accommodationType: 'chateau_fort' });
    expect(res.statusCode).toBe(422);
    expect(Accommodation.create).not.toHaveBeenCalled();
  });

  test('201 — création réussie avec devise XAF par défaut (non envoyée)', async () => {
    mockUserAuth(OWNER_ID, 'Proprietaire');
    Property.findById = jest.fn().mockResolvedValue(hebergementProperty());
    const created = {
      _id: ACCOMMODATION_ID, property: PROPERTY_ID, accommodationType: 'villa_meublee',
      currency: 'XAF', publicationStatus: 'brouillon',
      toObject() { return { ...this, toObject: undefined }; },
    };
    Accommodation.create = jest.fn().mockResolvedValue(created);

    const res = await request(app)
      .post('/api/accommodations')
      .set('Authorization', `Bearer ${makeToken(OWNER_ID)}`)
      .send({ property: PROPERTY_ID, accommodationType: 'villa_meublee' });

    expect(res.statusCode).toBe(201);
    expect(res.body.data.accommodation.currency).toBe('XAF');
    expect(Accommodation.create).toHaveBeenCalledWith(expect.objectContaining({
      property: PROPERTY_ID, createdBy: OWNER_ID,
    }));
  });

  test('409 — unicité Property/Accommodation (index dupliqué)', async () => {
    mockUserAuth(OWNER_ID, 'Proprietaire');
    Property.findById = jest.fn().mockResolvedValue(hebergementProperty());
    const dup = new Error('duplicate'); dup.code = 11000;
    Accommodation.create = jest.fn().mockRejectedValue(dup);
    const res = await request(app)
      .post('/api/accommodations')
      .set('Authorization', `Bearer ${makeToken(OWNER_ID)}`)
      .send({ property: PROPERTY_ID, accommodationType: 'villa_meublee' });
    expect(res.statusCode).toBe(409);
  });
});

describe('POST /api/accommodations/:id/submit — soumission', () => {
  afterEach(() => jest.clearAllMocks());

  const draft = (overrides = {}) => ({
    _id: ACCOMMODATION_ID,
    createdBy: OWNER_ID,
    publicationStatus: 'brouillon',
    accommodationType: 'villa_meublee',
    capacity: { maxAdults: 2 },
    property: { bedrooms: 2, bathrooms: 1 },
    checkInTime: '14:00',
    checkOutTime: '11:00',
    save: jest.fn().mockResolvedValue(),
    ...overrides,
  });

  test('422 — refuse la soumission si les champs requis (Property) sont incomplets', async () => {
    mockUserAuth(OWNER_ID, 'Proprietaire');
    const acc = draft({ property: { bedrooms: 2, bathrooms: 0 } });
    Accommodation.findById = jest.fn().mockReturnValue({ populate: jest.fn().mockResolvedValue(acc) });
    const res = await request(app)
      .post(`/api/accommodations/${ACCOMMODATION_ID}/submit`)
      .set('Authorization', `Bearer ${makeToken(OWNER_ID)}`);
    expect(res.statusCode).toBe(422);
    expect(res.body.readiness.ready).toBe(false);
    expect(res.body.readiness.missingFields).toContain('bathrooms');
  });

  test('200 — soumission réussie, statut passe à "soumis"', async () => {
    mockUserAuth(OWNER_ID, 'Proprietaire');
    const acc = draft();
    Accommodation.findById = jest.fn().mockReturnValue({ populate: jest.fn().mockResolvedValue(acc) });
    const res = await request(app)
      .post(`/api/accommodations/${ACCOMMODATION_ID}/submit`)
      .set('Authorization', `Bearer ${makeToken(OWNER_ID)}`);
    expect(res.statusCode).toBe(200);
    expect(acc.publicationStatus).toBe('soumis');
    expect(acc.save).toHaveBeenCalled();
  });
});

describe('PATCH /api/accommodations/:id/:action — décision admin', () => {
  afterEach(() => jest.clearAllMocks());

  const submitted = (overrides = {}) => ({
    _id: ACCOMMODATION_ID,
    publicationStatus: 'soumis',
    property: { _id: PROPERTY_ID, title: 'Villa Test', owner: OWNER_ID },
    save: jest.fn().mockResolvedValue(),
    ...overrides,
  });

  test("403 — un propriétaire (non staff) ne peut pas valider", async () => {
    mockUserAuth(OWNER_ID, 'Proprietaire');
    const res = await request(app)
      .patch(`/api/accommodations/${ACCOMMODATION_ID}/validate`)
      .set('Authorization', `Bearer ${makeToken(OWNER_ID)}`)
      .send({});
    expect(res.statusCode).toBe(403);
  });

  test('200 — admin valide : publicationStatus="publie", publishedAt renseigné', async () => {
    mockUserAuth(ADMIN_ID, 'Admin');
    const acc = submitted();
    Accommodation.findById = jest.fn().mockReturnValue({ populate: jest.fn().mockResolvedValue(acc) });
    const res = await request(app)
      .patch(`/api/accommodations/${ACCOMMODATION_ID}/validate`)
      .set('Authorization', `Bearer ${makeToken(ADMIN_ID)}`)
      .send({});
    expect(res.statusCode).toBe(200);
    expect(acc.publicationStatus).toBe('publie');
    expect(acc.publishedAt).not.toBeNull();
  });

  test('422 — rejet sans motif refusé', async () => {
    mockUserAuth(ADMIN_ID, 'Admin');
    Accommodation.findById = jest.fn().mockReturnValue({ populate: jest.fn().mockResolvedValue(submitted()) });
    const res = await request(app)
      .patch(`/api/accommodations/${ACCOMMODATION_ID}/reject`)
      .set('Authorization', `Bearer ${makeToken(ADMIN_ID)}`)
      .send({});
    expect(res.statusCode).toBe(422);
  });

  test('200 — rejet avec motif : publicationStatus="rejete", rejectionReason renseignée', async () => {
    mockUserAuth(ADMIN_ID, 'Admin');
    const acc = submitted();
    Accommodation.findById = jest.fn().mockReturnValue({ populate: jest.fn().mockResolvedValue(acc) });
    const res = await request(app)
      .patch(`/api/accommodations/${ACCOMMODATION_ID}/reject`)
      .set('Authorization', `Bearer ${makeToken(ADMIN_ID)}`)
      .send({ reason: 'Photos manquantes' });
    expect(res.statusCode).toBe(200);
    expect(acc.publicationStatus).toBe('rejete');
    expect(acc.rejectionReason).toBe('Photos manquantes');
  });

  test('409 — impossible de valider un hébergement pas encore soumis (toujours brouillon)', async () => {
    mockUserAuth(ADMIN_ID, 'Admin');
    Accommodation.findById = jest.fn().mockReturnValue({ populate: jest.fn().mockResolvedValue(submitted({ publicationStatus: 'brouillon' })) });
    const res = await request(app)
      .patch(`/api/accommodations/${ACCOMMODATION_ID}/validate`)
      .set('Authorization', `Bearer ${makeToken(ADMIN_ID)}`)
      .send({});
    expect(res.statusCode).toBe(409);
  });
});

describe('GET /api/accommodations/status/pending — file de modération staff', () => {
  afterEach(() => jest.clearAllMocks());

  test("403 — un propriétaire ne peut pas consulter la file de modération", async () => {
    mockUserAuth(OWNER_ID, 'Proprietaire');
    const res = await request(app)
      .get('/api/accommodations/status/pending')
      .set('Authorization', `Bearer ${makeToken(OWNER_ID)}`);
    expect(res.statusCode).toBe(403);
  });

  test('200 — un admin récupère la liste des hébergements soumis', async () => {
    mockUserAuth(ADMIN_ID, 'Admin');
    const acc = {
      _id: ACCOMMODATION_ID,
      publicationStatus: 'soumis',
      property: { _id: PROPERTY_ID, title: 'Villa Test', owner: OWNER_ID },
      toObject() { return { ...this, toObject: undefined }; },
    };
    Accommodation.find = jest.fn().mockReturnValue({
      populate: jest.fn().mockReturnValue({ sort: jest.fn().mockResolvedValue([acc]) }),
    });
    const res = await request(app)
      .get('/api/accommodations/status/pending')
      .set('Authorization', `Bearer ${makeToken(ADMIN_ID)}`);
    expect(res.statusCode).toBe(200);
    expect(res.body.data.accommodations).toHaveLength(1);
    expect(Accommodation.find).toHaveBeenCalledWith({ publicationStatus: 'soumis' });
  });
});

describe('RatePlan — nightly/weekly/monthly, devise XAF par défaut', () => {
  afterEach(() => jest.clearAllMocks());

  const owned = () => ({ _id: ACCOMMODATION_ID, createdBy: OWNER_ID });

  test.each(['nightly', 'weekly', 'monthly'])('201 — crée un tarif %s', async (mode) => {
    mockUserAuth(OWNER_ID, 'Proprietaire');
    Accommodation.findById = jest.fn().mockResolvedValue(owned());
    RatePlan.updateMany = jest.fn().mockResolvedValue({});
    RatePlan.create = jest.fn().mockResolvedValue({ mode, amount: 25000, currency: 'XAF' });

    const res = await request(app)
      .post(`/api/accommodations/${ACCOMMODATION_ID}/rate-plans`)
      .set('Authorization', `Bearer ${makeToken(OWNER_ID)}`)
      .send({ mode, amount: 25000 });

    expect(res.statusCode).toBe(201);
    expect(res.body.data.rate.currency).toBe('XAF');
    expect(RatePlan.create).toHaveBeenCalledWith(expect.objectContaining({ mode, amount: 25000, currency: 'XAF' }));
  });

  test('422 — refuse un mode tarifaire invalide', async () => {
    mockUserAuth(OWNER_ID, 'Proprietaire');
    Accommodation.findById = jest.fn().mockResolvedValue(owned());
    const res = await request(app)
      .post(`/api/accommodations/${ACCOMMODATION_ID}/rate-plans`)
      .set('Authorization', `Bearer ${makeToken(OWNER_ID)}`)
      .send({ mode: 'horaire', amount: 5000 });
    expect(res.statusCode).toBe(422);
  });

  test('désactive l\'ancien tarif actif du même mode avant de créer le nouveau', async () => {
    mockUserAuth(OWNER_ID, 'Proprietaire');
    Accommodation.findById = jest.fn().mockResolvedValue(owned());
    RatePlan.updateMany = jest.fn().mockResolvedValue({});
    RatePlan.create = jest.fn().mockResolvedValue({ mode: 'nightly', amount: 30000, currency: 'XAF' });
    await request(app)
      .post(`/api/accommodations/${ACCOMMODATION_ID}/rate-plans`)
      .set('Authorization', `Bearer ${makeToken(OWNER_ID)}`)
      .send({ mode: 'nightly', amount: 30000 });
    expect(RatePlan.updateMany).toHaveBeenCalledWith(
      { accommodation: ACCOMMODATION_ID, mode: 'nightly', active: true },
      { $set: { active: false } },
    );
  });
});

describe('GET /api/properties/:id — visibilité publique Hébergement (brouillon vs publié)', () => {
  afterEach(() => jest.clearAllMocks());

  test('403 — un hébergement dont Accommodation est en brouillon reste invisible au public', async () => {
    const property = hebergementProperty({
      toObject() { return { ...this, toObject: undefined }; },
    });
    Property.findByIdAndUpdate = jest.fn().mockReturnValue({ populate: jest.fn().mockResolvedValue(property) });
    Accommodation.findOne = jest.fn().mockResolvedValue({ publicationStatus: 'brouillon' });
    const res = await request(app).get(`/api/properties/${PROPERTY_ID}`);
    expect(res.statusCode).toBe(403);
  });

  test('200 — un hébergement publié est visible publiquement', async () => {
    const property = hebergementProperty({
      toObject() { return { ...this, toObject: undefined }; },
    });
    Property.findByIdAndUpdate = jest.fn().mockReturnValue({ populate: jest.fn().mockResolvedValue(property) });
    const accommodationDoc = {
      publicationStatus: 'publie',
      toObject() { return { publicationStatus: 'publie' }; },
    };
    Accommodation.findOne = jest.fn().mockResolvedValue(accommodationDoc);
    RatePlan.find = jest.fn().mockResolvedValue([]);
    const res = await request(app).get(`/api/properties/${PROPERTY_ID}`);
    expect(res.statusCode).toBe(200);
    expect(res.body.data.property.accommodation).toBeDefined();
  });

  test("200 — une ancienne Property Vente sans Accommodation reste valide (comportement inchangé)", async () => {
    const property = {
      _id: PROPERTY_ID, title: 'Ancien bien', status: 'vente', statusAdmin: 'Validée', availability: 'Disponible',
      toObject() { return { ...this, toObject: undefined }; },
    };
    Property.findByIdAndUpdate = jest.fn().mockReturnValue({ populate: jest.fn().mockResolvedValue(property) });
    const res = await request(app).get(`/api/properties/${PROPERTY_ID}`);
    expect(res.statusCode).toBe(200);
    expect(Accommodation.findOne).not.toHaveBeenCalled();
    expect(res.body.data.property.accommodation).toBeUndefined();
  });
});
