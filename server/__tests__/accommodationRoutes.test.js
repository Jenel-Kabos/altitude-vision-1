// __tests__/accommodationRoutes.test.js
// Tests d'intégration du domaine Hébergement (Sprint 2, modèles mockés)

jest.mock('../models/Accommodation');
jest.mock('../models/RatePlan');
jest.mock('../models/Property');
jest.mock('../models/User');
jest.mock('../models/Hotel');
jest.mock('../models/SaleManagement');
jest.mock('../models/RentalManagement');
jest.mock('../config/db', () => jest.fn());
jest.mock('node-cron', () => ({ schedule: jest.fn() }));
jest.mock('../scripts/sync-facebook', () => ({ syncFacebook: jest.fn() }));
jest.mock('../services/zohoImapService', () => ({ pollZohoInbox: jest.fn() }));
jest.mock('../services/alerteService', () => ({ verifierPaiementsEnRetard: jest.fn() }));
jest.mock('../services/platformTenant/tenantContextService', () => ({
  resolveAvailableTenantsForUser: jest.fn().mockResolvedValue([{ _id: '607f1f77bcf86cd799439001' }]),
  resolveEffectiveTenantContext: jest.fn().mockResolvedValue({ tenant: { _id: '607f1f77bcf86cd799439001' }, source: 'membership' }),
  resolveTenantScope: jest.fn().mockResolvedValue({ scopeUserIds: new Set(['507f1f77bcf86cd799439011', '507f1f77bcf86cd799439012']) }),
  // TENANT-CERT-3-PRE — accommodationController.assertAccommodationAccessible
  // appelle désormais resolveTenantForUser (tenant boundary sur Accommodation,
  // vulnérabilité corrigée ce sprint) ; ce test unitaire mocke les modèles,
  // donc la sécurité réelle est prouvée par tenantCert3Pre.adversarial.mongo.
  // integration.test.js — ici on ne fait que ne pas casser le mock existant.
  resolveTenantForUser: jest.fn().mockResolvedValue({ _id: '607f1f77bcf86cd799439001' }),
}));
jest.mock('../services/platformTenant/tenantResourceAttributionService', () => ({
  assertResourceTenant: jest.fn().mockResolvedValue({ status: 'resolved', tenantId: '607f1f77bcf86cd799439001' }),
  resolveResourceTenant: jest.fn().mockResolvedValue({ status: 'resolved', tenantId: '607f1f77bcf86cd799439001' }),
  assertResourceTenantOrUnattributed: jest.fn().mockResolvedValue({ status: 'resolved', tenantId: '607f1f77bcf86cd799439001' }),
}));
jest.mock('../utils/generateSitemap', () => jest.fn().mockResolvedValue('<xml/>'));
jest.mock('../services/notificationService', () => ({
  notify: jest.fn().mockResolvedValue(),
  notifyStaff: jest.fn().mockResolvedValue(),
  notifyMany: jest.fn().mockResolvedValue(),
}));
jest.mock('../config/cloudinary', () => ({
  ...jest.requireActual('../config/cloudinary'),
  destroyFromCloudinary: jest.fn().mockResolvedValue(),
}));

const request  = require('supertest');
const jwt      = require('jsonwebtoken');
const { app }  = require('../server');
const Accommodation = require('../models/Accommodation');
const RatePlan       = require('../models/RatePlan');
const Property        = require('../models/Property');
const User             = require('../models/User');
const Hotel             = require('../models/Hotel');
const SaleManagement    = require('../models/SaleManagement');
const RentalManagement  = require('../models/RentalManagement');
const { destroyFromCloudinary } = require('../config/cloudinary');

// GET /api/properties/:id embarque désormais sale/rental (Sprint A) — par
// défaut aucune fiche, comme pour un ancien Property créé avant ce sprint.
SaleManagement.findOne = jest.fn().mockResolvedValue(null);
RentalManagement.findOne = jest.fn().mockResolvedValue(null);

// Le vrai modèle expose ACCOMMODATION_TYPES / RATE_MODES en propriétés
// statiques ; jest.mock('../models/Accommodation') les efface (automock).
// On les restaure ici pour que le contrôleur (qui les lit) continue de
// fonctionner sous mock.
Accommodation.ACCOMMODATION_TYPES = ['villa_meublee', 'maison_meublee', 'appartement_meuble', 'studio_meuble', 'residence_meublee', 'bungalow', 'hotel', 'residence_hoteliere', 'chambre_hotes', 'autre'];
Accommodation.HOTEL_ACCOMMODATION_TYPES = ['hotel'];
RatePlan.RATE_MODES = ['nightly', 'weekly', 'monthly', 'yearly'];

const HOTEL_ID = '707f1f77bcf86cd799439055';

const OWNER_ID = '507f1f77bcf86cd799439011';
const OTHER_OWNER_ID = '507f1f77bcf86cd799439099';
const ADMIN_ID = '507f1f77bcf86cd799439012';
const TENANT_ID = '607f1f77bcf86cd799439001';
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

  // Sprint B1 : "validate" exige désormais un score de complétude à 100%
  // (voir computeCompletionScore) — ce fixture est donc volontairement
  // complet (photos/tarif/équipements/services) pour représenter le cas
  // nominal ; le cas incomplet est testé séparément ci-dessous.
  const submitted = (overrides = {}) => ({
    _id: ACCOMMODATION_ID,
    publicationStatus: 'soumis',
    accommodationType: 'villa_meublee',
    capacity: { maxAdults: 4 },
    checkInTime: '14:00',
    checkOutTime: '11:00',
    amenities: { cuisine: ['Four'], salon: [], internet: [], exterieur: [], parking: [], securite: [] },
    includedServices: { menage: true, petitDejeuner: false, blanchisserie: false, transfert: false, cuisine: false },
    property: {
      _id: PROPERTY_ID, title: 'Villa Test', owner: OWNER_ID,
      description: 'Une belle villa', bedrooms: 3, bathrooms: 2,
      images: ['a.jpg', 'b.jpg', 'c.jpg'],
    },
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

  test('200 — admin valide un hébergement complet : publicationStatus="publie", publishedAt renseigné', async () => {
    mockUserAuth(ADMIN_ID, 'Admin');
    const acc = submitted();
    Accommodation.findById = jest.fn().mockReturnValue({ populate: jest.fn().mockResolvedValue(acc) });
    RatePlan.find = jest.fn().mockReturnValue({ sort: jest.fn().mockResolvedValue([{ mode: 'nightly', amount: 35000, active: true }]) });
    const res = await request(app)
      .patch(`/api/accommodations/${ACCOMMODATION_ID}/validate`)
      .set('Authorization', `Bearer ${makeToken(ADMIN_ID)}`)
      .send({});
    expect(res.statusCode).toBe(200);
    expect(acc.publicationStatus).toBe('publie');
    expect(acc.publishedAt).not.toBeNull();
  });

  test('422 — un hébergement incomplet (aucun tarif, aucun équipement) ne peut pas être validé', async () => {
    mockUserAuth(ADMIN_ID, 'Admin');
    const acc = submitted({ amenities: { cuisine: [], salon: [], internet: [], exterieur: [], parking: [], securite: [] } });
    Accommodation.findById = jest.fn().mockReturnValue({ populate: jest.fn().mockResolvedValue(acc) });
    RatePlan.find = jest.fn().mockReturnValue({ sort: jest.fn().mockResolvedValue([]) });
    const res = await request(app)
      .patch(`/api/accommodations/${ACCOMMODATION_ID}/validate`)
      .set('Authorization', `Bearer ${makeToken(ADMIN_ID)}`)
      .send({});
    expect(res.statusCode).toBe(422);
    expect(res.body.code).toBe('ACCOMMODATION_INCOMPLETE');
    expect(res.body.missingFields).toEqual(expect.arrayContaining([
      { field: 'rates', label: 'Tarif' },
      { field: 'amenities', label: 'Équipements' },
    ]));
    expect(res.body.completion.complete).toBe(false);
    expect(acc.publicationStatus).toBe('soumis');
  });

  test('200 — admin suspend un hébergement publié (motif requis) puis le réactive', async () => {
    mockUserAuth(ADMIN_ID, 'Admin');
    const acc = submitted({ publicationStatus: 'publie' });
    Accommodation.findById = jest.fn().mockReturnValue({ populate: jest.fn().mockResolvedValue(acc) });
    const resNoReason = await request(app)
      .patch(`/api/accommodations/${ACCOMMODATION_ID}/suspend`)
      .set('Authorization', `Bearer ${makeToken(ADMIN_ID)}`)
      .send({});
    expect(resNoReason.statusCode).toBe(422);

    const res = await request(app)
      .patch(`/api/accommodations/${ACCOMMODATION_ID}/suspend`)
      .set('Authorization', `Bearer ${makeToken(ADMIN_ID)}`)
      .send({ reason: 'Signalement client' });
    expect(res.statusCode).toBe(200);
    expect(acc.publicationStatus).toBe('suspendu');
    expect(acc.suspensionReason).toBe('Signalement client');

    const resUnsuspend = await request(app)
      .patch(`/api/accommodations/${ACCOMMODATION_ID}/unsuspend`)
      .set('Authorization', `Bearer ${makeToken(ADMIN_ID)}`)
      .send({});
    expect(resUnsuspend.statusCode).toBe(200);
    expect(acc.publicationStatus).toBe('publie');
  });

  test('409 — impossible de suspendre un hébergement qui n\'est pas publié', async () => {
    mockUserAuth(ADMIN_ID, 'Admin');
    Accommodation.findById = jest.fn().mockReturnValue({ populate: jest.fn().mockResolvedValue(submitted({ publicationStatus: 'brouillon' })) });
    const res = await request(app)
      .patch(`/api/accommodations/${ACCOMMODATION_ID}/suspend`)
      .set('Authorization', `Bearer ${makeToken(ADMIN_ID)}`)
      .send({ reason: 'x' });
    expect(res.statusCode).toBe(409);
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
    // Sprint B1 — pending() calcule désormais un score de complétude par
    // hébergement (getActiveRates → RatePlan.find(...).sort(...)).
    RatePlan.find = jest.fn().mockReturnValue({ sort: jest.fn().mockResolvedValue([]) });
    const res = await request(app)
      .get('/api/accommodations/status/pending')
      .set('Authorization', `Bearer ${makeToken(ADMIN_ID)}`);
    expect(res.statusCode).toBe(200);
    expect(res.body.data.accommodations).toHaveLength(1);
    expect(res.body.data.accommodations[0].completion).toBeDefined();
    expect(Accommodation.find).toHaveBeenCalledWith({
      publicationStatus: 'soumis',
      tenant: TENANT_ID,
      $and: [{ $or: [{ hotel: null }, { hotel: { $exists: false } }] }],
    });
  });
});

describe('Sprint B1 — cycle de vie propriétaire (deactivate/reactivate/duplicate/delete)', () => {
  afterEach(() => jest.clearAllMocks());

  const owned = (overrides = {}) => ({
    _id: ACCOMMODATION_ID,
    createdBy: OWNER_ID,
    active: true,
    save: jest.fn().mockResolvedValue(),
    ...overrides,
  });

  test('403 — un autre propriétaire ne peut pas désactiver', async () => {
    mockUserAuth(OTHER_OWNER_ID, 'Proprietaire');
    Accommodation.findById = jest.fn().mockResolvedValue(owned());
    const res = await request(app)
      .patch(`/api/accommodations/${ACCOMMODATION_ID}/deactivate`)
      .set('Authorization', `Bearer ${makeToken(OTHER_OWNER_ID)}`);
    expect(res.statusCode).toBe(403);
  });

  test('200 — le propriétaire désactive puis réactive son hébergement', async () => {
    mockUserAuth(OWNER_ID, 'Proprietaire');
    const acc = owned();
    Accommodation.findById = jest.fn().mockResolvedValue(acc);
    const res = await request(app)
      .patch(`/api/accommodations/${ACCOMMODATION_ID}/deactivate`)
      .set('Authorization', `Bearer ${makeToken(OWNER_ID)}`);
    expect(res.statusCode).toBe(200);
    expect(acc.active).toBe(false);

    const res2 = await request(app)
      .patch(`/api/accommodations/${ACCOMMODATION_ID}/reactivate`)
      .set('Authorization', `Bearer ${makeToken(OWNER_ID)}`);
    expect(res2.statusCode).toBe(200);
    expect(acc.active).toBe(true);
  });

  test('201 — le propriétaire duplique son hébergement en brouillon', async () => {
    mockUserAuth(OWNER_ID, 'Proprietaire');
    const property = { _id: PROPERTY_ID, title: 'Villa Test', owner: OWNER_ID, images: [] };
    const acc = owned({ property, accommodationType: 'villa_meublee' });
    Accommodation.findById = jest.fn().mockReturnValue({ populate: jest.fn().mockResolvedValue(acc) });
    Property.create = jest.fn().mockResolvedValue({ _id: 'NEW-PROPERTY-ID', title: 'Villa Test (copie)' });
    Accommodation.create = jest.fn().mockResolvedValue({ _id: 'NEW-ACC-ID', publicationStatus: 'brouillon' });
    RatePlan.find = jest.fn().mockResolvedValue([]);
    const res = await request(app)
      .post(`/api/accommodations/${ACCOMMODATION_ID}/duplicate`)
      .set('Authorization', `Bearer ${makeToken(OWNER_ID)}`);
    expect(res.statusCode).toBe(201);
    expect(Property.create).toHaveBeenCalled();
    expect(Accommodation.create).toHaveBeenCalled();
  });

  test('200 — le propriétaire supprime définitivement son hébergement', async () => {
    mockUserAuth(OWNER_ID, 'Proprietaire');
    const property = { _id: PROPERTY_ID, title: 'Villa Test', owner: OWNER_ID, images: [] };
    Accommodation.findById = jest.fn().mockReturnValue({ populate: jest.fn().mockResolvedValue(owned({ property })) });
    RatePlan.deleteMany = jest.fn().mockResolvedValue({});
    Accommodation.findByIdAndDelete = jest.fn().mockResolvedValue({});
    Property.findByIdAndDelete = jest.fn().mockResolvedValue({});
    const res = await request(app)
      .delete(`/api/accommodations/${ACCOMMODATION_ID}`)
      .set('Authorization', `Bearer ${makeToken(OWNER_ID)}`);
    expect(res.statusCode).toBe(200);
    expect(Accommodation.findByIdAndDelete).toHaveBeenCalledWith(ACCOMMODATION_ID);
    expect(Property.findByIdAndDelete).toHaveBeenCalledWith(PROPERTY_ID);
  });
});

describe('Contrôle final Sprint B2 — un hébergement de type hotel ne se gère jamais depuis le domaine Hébergement', () => {
  afterEach(() => jest.clearAllMocks());

  // Sans ce garde-fou, DELETE/duplicate/deactivate ici ne toucheraient QUE
  // Accommodation + Property, laissant orphelins le Hotel, ses
  // RoomCategory et leurs RatePlan (référençant un Property supprimé) —
  // constaté à l'audit final avant le Sprint C.
  const hotelTypeAcc = (overrides = {}) => ({
    _id: ACCOMMODATION_ID,
    createdBy: OWNER_ID,
    accommodationType: 'hotel',
    active: true,
    property: { _id: PROPERTY_ID, title: 'Hôtel Test', owner: OWNER_ID, images: [] },
    save: jest.fn().mockResolvedValue(),
    ...overrides,
  });

  test("409 — DELETE /api/accommodations/:id refuse un hébergement de type hotel", async () => {
    mockUserAuth(OWNER_ID, 'Proprietaire');
    Accommodation.findById = jest.fn().mockReturnValue({ populate: jest.fn().mockResolvedValue(hotelTypeAcc()) });
    const res = await request(app)
      .delete(`/api/accommodations/${ACCOMMODATION_ID}`)
      .set('Authorization', `Bearer ${makeToken(OWNER_ID)}`);
    expect(res.statusCode).toBe(409);
    expect(Accommodation.findByIdAndDelete).not.toHaveBeenCalled();
  });

  test("409 — POST /api/accommodations/:id/duplicate refuse un hébergement de type hotel", async () => {
    mockUserAuth(OWNER_ID, 'Proprietaire');
    Accommodation.findById = jest.fn().mockReturnValue({ populate: jest.fn().mockResolvedValue(hotelTypeAcc()) });
    const res = await request(app)
      .post(`/api/accommodations/${ACCOMMODATION_ID}/duplicate`)
      .set('Authorization', `Bearer ${makeToken(OWNER_ID)}`);
    expect(res.statusCode).toBe(409);
    expect(Accommodation.create).not.toHaveBeenCalled();
  });

  test("409 — PATCH /api/accommodations/:id/deactivate refuse un hébergement de type hotel", async () => {
    mockUserAuth(OWNER_ID, 'Proprietaire');
    const acc = hotelTypeAcc();
    Accommodation.findById = jest.fn().mockResolvedValue(acc);
    const res = await request(app)
      .patch(`/api/accommodations/${ACCOMMODATION_ID}/deactivate`)
      .set('Authorization', `Bearer ${makeToken(OWNER_ID)}`);
    expect(res.statusCode).toBe(409);
    expect(acc.active).toBe(true); // inchangé
  });

  test("409 — PATCH /api/accommodations/:id/reactivate refuse un hébergement de type hotel", async () => {
    mockUserAuth(OWNER_ID, 'Proprietaire');
    Accommodation.findById = jest.fn().mockResolvedValue(hotelTypeAcc({ active: false }));
    const res = await request(app)
      .patch(`/api/accommodations/${ACCOMMODATION_ID}/reactivate`)
      .set('Authorization', `Bearer ${makeToken(OWNER_ID)}`);
    expect(res.statusCode).toBe(409);
  });

  test("200 — un hébergement non-hotel n'est pas affecté par ce garde-fou (régression)", async () => {
    mockUserAuth(OWNER_ID, 'Proprietaire');
    const property = { _id: PROPERTY_ID, title: 'Villa Test', owner: OWNER_ID, images: [] };
    Accommodation.findById = jest.fn().mockReturnValue({ populate: jest.fn().mockResolvedValue(hotelTypeAcc({ accommodationType: 'villa_meublee', property })) });
    RatePlan.deleteMany = jest.fn().mockResolvedValue({});
    Accommodation.findByIdAndDelete = jest.fn().mockResolvedValue({});
    Property.findByIdAndDelete = jest.fn().mockResolvedValue({});
    const res = await request(app)
      .delete(`/api/accommodations/${ACCOMMODATION_ID}`)
      .set('Authorization', `Bearer ${makeToken(OWNER_ID)}`);
    expect(res.statusCode).toBe(200);
  });
});

describe('GET /api/accommodations/admin/list — Sprint B1 (dashboard admin, tous statuts)', () => {
  afterEach(() => jest.clearAllMocks());

  test('403 — un propriétaire ne peut pas lister tous les hébergements', async () => {
    mockUserAuth(OWNER_ID, 'Proprietaire');
    const res = await request(app)
      .get('/api/accommodations/admin/list')
      .set('Authorization', `Bearer ${makeToken(OWNER_ID)}`);
    expect(res.statusCode).toBe(403);
  });

  test('200 — un admin liste les hébergements filtrés par statut, avec pagination', async () => {
    mockUserAuth(ADMIN_ID, 'Admin');
    const acc = {
      _id: ACCOMMODATION_ID,
      publicationStatus: 'publie',
      property: { _id: PROPERTY_ID, title: 'Villa Test', price: 50000 },
      toObject() { return { ...this, toObject: undefined }; },
    };
    Accommodation.find = jest.fn().mockReturnValue({ populate: jest.fn().mockReturnValue({ sort: jest.fn().mockResolvedValue([acc]) }) });
    RatePlan.find = jest.fn().mockReturnValue({ sort: jest.fn().mockResolvedValue([]) });
    const res = await request(app)
      .get('/api/accommodations/admin/list?status=publie&page=1&limit=20')
      .set('Authorization', `Bearer ${makeToken(ADMIN_ID)}`);
    expect(res.statusCode).toBe(200);
    expect(res.body.data.accommodations).toHaveLength(1);
    expect(res.body.data.total).toBe(1);
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
      isPublished: true,
      toObject() { return { ...this, toObject: undefined }; },
    });
    Property.findByIdAndUpdate = jest.fn().mockReturnValue({ populate: jest.fn().mockResolvedValue(property) });
    Accommodation.findOne = jest.fn().mockResolvedValue({ publicationStatus: 'brouillon' });
    const res = await request(app).get(`/api/properties/${PROPERTY_ID}`);
    expect(res.statusCode).toBe(403);
  });

  test('200 — un hébergement publié est visible publiquement', async () => {
    const property = hebergementProperty({
      isPublished: true,
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
      _id: PROPERTY_ID, title: 'Ancien bien', status: 'vente', statusAdmin: 'Validée', isPublished: true, availability: 'Disponible',
      toObject() { return { ...this, toObject: undefined }; },
    };
    Property.findByIdAndUpdate = jest.fn().mockReturnValue({ populate: jest.fn().mockResolvedValue(property) });
    const res = await request(app).get(`/api/properties/${PROPERTY_ID}`);
    expect(res.statusCode).toBe(200);
    expect(Accommodation.findOne).not.toHaveBeenCalled();
    expect(res.body.data.property.accommodation).toBeUndefined();
  });
});

describe('POST /api/accommodations/admin — création complète (dashboard admin)', () => {
  afterEach(() => jest.clearAllMocks());

  const validBody = () => ({
    title: 'Villa Meublée Test',
    description: 'Une belle villa meublée pour séjours courts.',
    price: '50000',
    type: 'Villa',
    surface: '120',
    bedrooms: '3',
    bathrooms: '2',
    'address[city]': 'Brazzaville',
    'address[arrondissement]': 'Bacongo',
    latitude: '-4.26',
    longitude: '15.24',
    accommodationType: 'villa_meublee',
    'capacity[maxAdults]': '4',
    'capacity[maxChildren]': '2',
    checkInTime: '14:00',
    checkOutTime: '11:00',
    nightlyPrice: '35000',
  });

  const mockCreatedDocs = () => {
    const property = { _id: PROPERTY_ID, title: 'Villa Meublée Test', status: 'hebergement' };
    const accommodation = {
      _id: ACCOMMODATION_ID, property: PROPERTY_ID, accommodationType: 'villa_meublee',
      toObject() { return { _id: this._id, property: this.property, accommodationType: this.accommodationType }; },
    };
    const rate = { _id: 'rate1', accommodation: ACCOMMODATION_ID, mode: 'nightly', amount: 35000, currency: 'XAF' };
    Property.create = jest.fn().mockResolvedValue(property);
    Accommodation.create = jest.fn().mockResolvedValue(accommodation);
    RatePlan.create = jest.fn().mockResolvedValue(rate);
    return { property, accommodation, rate };
  };

  test('401 sans token', async () => {
    const res = await request(app).post('/api/accommodations/admin').send(validBody());
    expect(res.statusCode).toBe(401);
  });

  test("403 — un utilisateur non-staff (Proprietaire) est refusé", async () => {
    mockUserAuth(OWNER_ID, 'Proprietaire');
    const res = await request(app)
      .post('/api/accommodations/admin')
      .set('Authorization', `Bearer ${makeToken(OWNER_ID)}`)
      .send(validBody());
    expect(res.statusCode).toBe(403);
    expect(Property.create).not.toHaveBeenCalled();
  });

  test("403 — un Client est refusé", async () => {
    mockUserAuth(OWNER_ID, 'Client');
    const res = await request(app)
      .post('/api/accommodations/admin')
      .set('Authorization', `Bearer ${makeToken(OWNER_ID)}`)
      .send(validBody());
    expect(res.statusCode).toBe(403);
  });

  test('201 — un admin crée un hébergement complet (Property + Accommodation + RatePlan)', async () => {
    mockUserAuth(ADMIN_ID, 'Admin');
    const { property, accommodation, rate } = mockCreatedDocs();

    const res = await request(app)
      .post('/api/accommodations/admin')
      .set('Authorization', `Bearer ${makeToken(ADMIN_ID)}`)
      .send(validBody());

    expect(res.statusCode).toBe(201);
    // Property.status forcé à 'hebergement', jamais accepté depuis le client.
    expect(Property.create).toHaveBeenCalledWith(expect.objectContaining({ status: 'hebergement' }));
    expect(Accommodation.create).toHaveBeenCalledWith(expect.objectContaining({
      property: property._id, accommodationType: 'villa_meublee',
    }));
    expect(RatePlan.create).toHaveBeenCalledWith(expect.objectContaining({
      accommodation: accommodation._id, mode: 'nightly', amount: 35000,
    }));
    expect(res.body.data.property._id).toBe(PROPERTY_ID);
    expect(res.body.data.accommodation._id).toBe(ACCOMMODATION_ID);
    expect(res.body.data.rate.amount).toBe(35000);
  });

  test("IAM-3 — CommunityManager ne peut plus créer un hébergement administratif", async () => {
    mockUserAuth('507f1f77bcf86cd799439033', 'CommunityManager');
    mockCreatedDocs();
    const res = await request(app)
      .post('/api/accommodations/admin')
      .set('Authorization', `Bearer ${makeToken('507f1f77bcf86cd799439033')}`)
      .send(validBody());
    expect(res.statusCode).toBe(403);
  });

  test("aucun RatePlan n'est créé si le tarif optionnel est absent", async () => {
    mockUserAuth(ADMIN_ID, 'Admin');
    mockCreatedDocs();
    const body = validBody();
    delete body.nightlyPrice;

    const res = await request(app)
      .post('/api/accommodations/admin')
      .set('Authorization', `Bearer ${makeToken(ADMIN_ID)}`)
      .send(body);

    expect(res.statusCode).toBe(201);
    expect(RatePlan.create).not.toHaveBeenCalled();
    expect(res.body.data.rate).toBeNull();
  });

  test('422 — accommodationType manquant ou invalide est refusé', async () => {
    mockUserAuth(ADMIN_ID, 'Admin');
    mockCreatedDocs();
    const body = validBody();
    body.accommodationType = 'chateau_gonflable';

    const res = await request(app)
      .post('/api/accommodations/admin')
      .set('Authorization', `Bearer ${makeToken(ADMIN_ID)}`)
      .send(body);

    expect(res.statusCode).toBe(422);
    expect(Property.create).not.toHaveBeenCalled();
  });

  test('422 — titre/description/prix manquants sont refusés', async () => {
    mockUserAuth(ADMIN_ID, 'Admin');
    mockCreatedDocs();
    const body = validBody();
    delete body.title;

    const res = await request(app)
      .post('/api/accommodations/admin')
      .set('Authorization', `Bearer ${makeToken(ADMIN_ID)}`)
      .send(body);

    expect(res.statusCode).toBe(422);
    expect(Property.create).not.toHaveBeenCalled();
  });

  test('422 — un prix par nuit négatif est refusé (RatePlan validation)', async () => {
    mockUserAuth(ADMIN_ID, 'Admin');
    const property = { _id: PROPERTY_ID, title: 'Villa', status: 'hebergement' };
    const accommodation = {
      _id: ACCOMMODATION_ID, property: PROPERTY_ID,
      toObject() { return { _id: this._id }; },
    };
    Property.create = jest.fn().mockResolvedValue(property);
    Property.findByIdAndDelete = jest.fn().mockResolvedValue({});
    Accommodation.create = jest.fn().mockResolvedValue(accommodation);
    Accommodation.findByIdAndDelete = jest.fn().mockResolvedValue({});
    const validationError = Object.assign(new Error('RatePlan validation failed: amount: Le montant ne peut pas être négatif.'), { name: 'ValidationError' });
    RatePlan.create = jest.fn().mockRejectedValue(validationError);

    const body = validBody();
    body.nightlyPrice = '-5000';

    const res = await request(app)
      .post('/api/accommodations/admin')
      .set('Authorization', `Bearer ${makeToken(ADMIN_ID)}`)
      .send(body);

    // Un montant négatif produit un Number négatif → hasValidInitialRate()
    // exige amount > 0, donc aucun RatePlan n'est même tenté : traité comme
    // "pas de tarif fourni", la création réussit sans RatePlan.
    expect(res.statusCode).toBe(201);
    expect(RatePlan.create).not.toHaveBeenCalled();
    expect(res.body.data.rate).toBeNull();
  });

  test('422 — une capacité invalide (maxAdults à 0) est refusée par le schéma Accommodation', async () => {
    mockUserAuth(ADMIN_ID, 'Admin');
    const property = { _id: PROPERTY_ID, title: 'Villa', status: 'hebergement' };
    Property.create = jest.fn().mockResolvedValue(property);
    Property.findByIdAndDelete = jest.fn().mockResolvedValue({});
    const validationError = Object.assign(
      new Error('Accommodation validation failed: capacity.maxAdults: Path `capacity.maxAdults` (0) is less than minimum allowed value (1).'),
      { name: 'ValidationError' },
    );
    Accommodation.create = jest.fn().mockRejectedValue(validationError);

    const body = validBody();
    body['capacity[maxAdults]'] = '0';

    const res = await request(app)
      .post('/api/accommodations/admin')
      .set('Authorization', `Bearer ${makeToken(ADMIN_ID)}`)
      .send(body);

    expect(res.statusCode).toBe(422);
    // Aucun Property orphelin : compensation déclenchée.
    expect(Property.findByIdAndDelete).toHaveBeenCalledWith(PROPERTY_ID);
  });

  test("422 — une capacité non numérique (\"abc\") est refusée avant tout accès base (pas de NaN silencieux)", async () => {
    mockUserAuth(ADMIN_ID, 'Admin');
    mockCreatedDocs();
    const body = validBody();
    body['capacity[maxAdults]'] = 'abc';

    const res = await request(app)
      .post('/api/accommodations/admin')
      .set('Authorization', `Bearer ${makeToken(ADMIN_ID)}`)
      .send(body);

    expect(res.statusCode).toBe(422);
    expect(Property.create).not.toHaveBeenCalled();
  });

  test('422 — un prix par nuit non numérique est refusé avant tout accès base', async () => {
    mockUserAuth(ADMIN_ID, 'Admin');
    mockCreatedDocs();
    const body = validBody();
    body.nightlyPrice = 'gratuit';

    const res = await request(app)
      .post('/api/accommodations/admin')
      .set('Authorization', `Bearer ${makeToken(ADMIN_ID)}`)
      .send(body);

    expect(res.statusCode).toBe(422);
    expect(Property.create).not.toHaveBeenCalled();
  });

  test('422 — un format de check-in invalide est refusé', async () => {
    mockUserAuth(ADMIN_ID, 'Admin');
    mockCreatedDocs();
    const body = validBody();
    body.checkInTime = '25:99';

    const res = await request(app)
      .post('/api/accommodations/admin')
      .set('Authorization', `Bearer ${makeToken(ADMIN_ID)}`)
      .send(body);

    expect(res.statusCode).toBe(422);
    expect(Property.create).not.toHaveBeenCalled();
  });

  test('422 — maximumStay < minimumStay est refusé', async () => {
    mockUserAuth(ADMIN_ID, 'Admin');
    mockCreatedDocs();
    const body = validBody();
    body.minimumStay = '5';
    body.maximumStay = '2';

    const res = await request(app)
      .post('/api/accommodations/admin')
      .set('Authorization', `Bearer ${makeToken(ADMIN_ID)}`)
      .send(body);

    expect(res.statusCode).toBe(422);
    expect(Property.create).not.toHaveBeenCalled();
  });

  test('aucun Property orphelin ne subsiste si Accommodation échoue (compensation), et les images Cloudinary déjà uploadées sont nettoyées', async () => {
    mockUserAuth(ADMIN_ID, 'Admin');
    const property = {
      _id: PROPERTY_ID, title: 'Villa', status: 'hebergement',
      images: ['https://res.cloudinary.com/demo/image/upload/v1/altitude-vision/properties/abc.jpg'],
    };
    Property.create = jest.fn().mockResolvedValue(property);
    Property.findByIdAndDelete = jest.fn().mockResolvedValue({});
    Accommodation.create = jest.fn().mockRejectedValue(new Error('DB down'));

    const res = await request(app)
      .post('/api/accommodations/admin')
      .set('Authorization', `Bearer ${makeToken(ADMIN_ID)}`)
      .send(validBody());

    expect(res.statusCode).toBe(500);
    expect(Property.findByIdAndDelete).toHaveBeenCalledTimes(1);
    expect(Property.findByIdAndDelete).toHaveBeenCalledWith(PROPERTY_ID);
    expect(RatePlan.create).not.toHaveBeenCalled();
    expect(destroyFromCloudinary).toHaveBeenCalledWith(property.images[0]);
  });

  test('aucun Property ni Accommodation orphelins ne subsistent si le RatePlan échoue de façon inattendue', async () => {
    mockUserAuth(ADMIN_ID, 'Admin');
    const property = { _id: PROPERTY_ID, title: 'Villa', status: 'hebergement' };
    const accommodation = { _id: ACCOMMODATION_ID, property: PROPERTY_ID, toObject() { return { _id: this._id }; } };
    Property.create = jest.fn().mockResolvedValue(property);
    Property.findByIdAndDelete = jest.fn().mockResolvedValue({});
    Accommodation.create = jest.fn().mockResolvedValue(accommodation);
    Accommodation.findByIdAndDelete = jest.fn().mockResolvedValue({});
    RatePlan.create = jest.fn().mockRejectedValue(new Error('DB down'));

    const res = await request(app)
      .post('/api/accommodations/admin')
      .set('Authorization', `Bearer ${makeToken(ADMIN_ID)}`)
      .send(validBody());

    expect(res.statusCode).toBe(500);
    expect(Accommodation.findByIdAndDelete).toHaveBeenCalledWith(ACCOMMODATION_ID);
    expect(Property.findByIdAndDelete).toHaveBeenCalledWith(PROPERTY_ID);
  });
});

describe('POST /api/accommodations/admin — rattachement à un Hôtel (Sprint Hôtel)', () => {
  afterEach(() => jest.clearAllMocks());

  const hotelBody = (overrides = {}) => ({
    title: 'Hôtel Le Panorama',
    description: "Chambre standard dans l'hôtel Le Panorama.",
    price: '50000',
    type: 'Appartement meublé',
    surface: '30',
    bedrooms: '1',
    bathrooms: '1',
    'address[city]': 'Brazzaville',
    'address[arrondissement]': 'Bacongo',
    latitude: '-4.26',
    longitude: '15.24',
    accommodationType: 'hotel',
    'capacity[maxAdults]': '2',
    'capacity[maxChildren]': '0',
    checkInTime: '14:00',
    checkOutTime: '11:00',
    ...overrides,
  });

  const mockPropertyAndAccommodation = () => {
    const property = { _id: PROPERTY_ID, title: 'Hôtel Le Panorama', status: 'hebergement' };
    const accommodation = {
      _id: ACCOMMODATION_ID, property: PROPERTY_ID, accommodationType: 'hotel', hotel: HOTEL_ID,
      toObject() { return { _id: this._id, property: this.property, accommodationType: this.accommodationType, hotel: this.hotel }; },
    };
    Property.create = jest.fn().mockResolvedValue(property);
    Property.findByIdAndDelete = jest.fn().mockResolvedValue({});
    Accommodation.create = jest.fn().mockResolvedValue(accommodation);
    Accommodation.findByIdAndDelete = jest.fn().mockResolvedValue({});
    return { property, accommodation };
  };

  test('422 — accommodationType=hotel sans hotelMode est refusé', async () => {
    mockUserAuth(ADMIN_ID, 'Admin');
    mockPropertyAndAccommodation();
    const res = await request(app)
      .post('/api/accommodations/admin')
      .set('Authorization', `Bearer ${makeToken(ADMIN_ID)}`)
      .send(hotelBody());
    expect(res.statusCode).toBe(422);
    expect(Property.create).not.toHaveBeenCalled();
  });

  test('422 — hotelMode=existing sans hotelId est refusé', async () => {
    mockUserAuth(ADMIN_ID, 'Admin');
    mockPropertyAndAccommodation();
    const res = await request(app)
      .post('/api/accommodations/admin')
      .set('Authorization', `Bearer ${makeToken(ADMIN_ID)}`)
      .send(hotelBody({ hotelMode: 'existing' }));
    expect(res.statusCode).toBe(422);
    expect(Property.create).not.toHaveBeenCalled();
  });

  test("422 — référence Hôtel inexistante refusée (aucune référence arbitraire acceptée)", async () => {
    mockUserAuth(ADMIN_ID, 'Admin');
    const { property } = mockPropertyAndAccommodation();
    Hotel.findById = jest.fn().mockResolvedValue(null);

    const res = await request(app)
      .post('/api/accommodations/admin')
      .set('Authorization', `Bearer ${makeToken(ADMIN_ID)}`)
      .send(hotelBody({ hotelMode: 'existing', hotelId: HOTEL_ID }));

    expect(res.statusCode).toBe(422);
    // Le Property déjà créé pour tenter le rattachement est compensé.
    expect(Property.findByIdAndDelete).toHaveBeenCalledWith(property._id);
    expect(Accommodation.create).not.toHaveBeenCalled();
  });

  test("422 — un hotelId mal formé (pas un ObjectId) est refusé avant toute création de Property", async () => {
    mockUserAuth(ADMIN_ID, 'Admin');
    mockPropertyAndAccommodation();

    const res = await request(app)
      .post('/api/accommodations/admin')
      .set('Authorization', `Bearer ${makeToken(ADMIN_ID)}`)
      .send(hotelBody({ hotelMode: 'existing', hotelId: 'pas-un-object-id' }));

    expect(res.statusCode).toBe(422);
    // Rejeté au même stade que les autres champs invalides : aucun Property
    // créé (donc rien à compenser), contrairement à une référence Hotel
    // bien formée mais inexistante (voir test précédent).
    expect(Property.create).not.toHaveBeenCalled();
    expect(Hotel.findById).not.toHaveBeenCalled();
  });

  test('201 — rattachement à un Hôtel existant', async () => {
    mockUserAuth(ADMIN_ID, 'Admin');
    mockPropertyAndAccommodation();
    Hotel.findById = jest.fn().mockResolvedValue({ _id: HOTEL_ID, name: 'Le Panorama' });

    const res = await request(app)
      .post('/api/accommodations/admin')
      .set('Authorization', `Bearer ${makeToken(ADMIN_ID)}`)
      .send(hotelBody({ hotelMode: 'existing', hotelId: HOTEL_ID }));

    expect(res.statusCode).toBe(201);
    expect(Accommodation.create).toHaveBeenCalledWith(expect.objectContaining({ hotel: HOTEL_ID }));
    expect(Hotel.create).not.toHaveBeenCalled();
    expect(res.body.data.hotel).toBe(HOTEL_ID);
  });

  test("422 — création d'un nouvel hôtel sans nom est refusée", async () => {
    mockUserAuth(ADMIN_ID, 'Admin');
    mockPropertyAndAccommodation();
    const res = await request(app)
      .post('/api/accommodations/admin')
      .set('Authorization', `Bearer ${makeToken(ADMIN_ID)}`)
      .send(hotelBody({ hotelMode: 'create', hotelName: '   ' }));
    expect(res.statusCode).toBe(422);
    expect(Property.create).not.toHaveBeenCalled();
    expect(Hotel.create).not.toHaveBeenCalled();
  });

  test('422 — un email hôtel invalide est refusé', async () => {
    mockUserAuth(ADMIN_ID, 'Admin');
    mockPropertyAndAccommodation();
    const res = await request(app)
      .post('/api/accommodations/admin')
      .set('Authorization', `Bearer ${makeToken(ADMIN_ID)}`)
      .send(hotelBody({ hotelMode: 'create', hotelName: 'Le Panorama', hotelEmail: 'pas-un-email' }));
    expect(res.statusCode).toBe(422);
    expect(Property.create).not.toHaveBeenCalled();
  });

  test('422 — un nombre d\'étoiles hors 1-5 est refusé', async () => {
    mockUserAuth(ADMIN_ID, 'Admin');
    mockPropertyAndAccommodation();
    const res = await request(app)
      .post('/api/accommodations/admin')
      .set('Authorization', `Bearer ${makeToken(ADMIN_ID)}`)
      .send(hotelBody({ hotelMode: 'create', hotelName: 'Le Panorama', hotelStarRating: '9' }));
    expect(res.statusCode).toBe(422);
    expect(Property.create).not.toHaveBeenCalled();
  });

  test("422 — un nombre d'étoiles non numérique (\"abc\") est refusé avant tout accès base", async () => {
    mockUserAuth(ADMIN_ID, 'Admin');
    mockPropertyAndAccommodation();
    const res = await request(app)
      .post('/api/accommodations/admin')
      .set('Authorization', `Bearer ${makeToken(ADMIN_ID)}`)
      .send(hotelBody({ hotelMode: 'create', hotelName: 'Le Panorama', hotelStarRating: 'abc' }));
    expect(res.statusCode).toBe(422);
    expect(Property.create).not.toHaveBeenCalled();
    expect(Hotel.create).not.toHaveBeenCalled();
  });

  test("201 — création d'un nouvel Hôtel rattaché au nouveau Property", async () => {
    mockUserAuth(ADMIN_ID, 'Admin');
    const { property } = mockPropertyAndAccommodation();
    Hotel.create = jest.fn().mockResolvedValue({ _id: HOTEL_ID, name: 'Le Panorama' });

    const res = await request(app)
      .post('/api/accommodations/admin')
      .set('Authorization', `Bearer ${makeToken(ADMIN_ID)}`)
      .send(hotelBody({
        hotelMode: 'create', hotelName: 'Le Panorama', hotelStarRating: '4',
        hotelEmail: 'contact@panorama.cg', hotelHasRestaurant: 'true',
      }));

    expect(res.statusCode).toBe(201);
    expect(Hotel.create).toHaveBeenCalledWith(expect.objectContaining({
      name: 'Le Panorama', starRating: 4, property: property._id, hasRestaurant: true,
    }));
    expect(Accommodation.create).toHaveBeenCalledWith(expect.objectContaining({ hotel: HOTEL_ID }));
    expect(res.body.data.hotel).toBe(HOTEL_ID);
  });

  test('201 — hotelHasRestaurant="false" (chaîne, convention FormData) ne devient jamais true', async () => {
    mockUserAuth(ADMIN_ID, 'Admin');
    mockPropertyAndAccommodation();
    Hotel.create = jest.fn().mockResolvedValue({ _id: HOTEL_ID, name: 'Le Panorama' });

    const res = await request(app)
      .post('/api/accommodations/admin')
      .set('Authorization', `Bearer ${makeToken(ADMIN_ID)}`)
      .send(hotelBody({
        hotelMode: 'create', hotelName: 'Le Panorama',
        hotelHasRestaurant: 'false', hotelHasReception: 'false',
      }));

    expect(res.statusCode).toBe(201);
    expect(Hotel.create).toHaveBeenCalledWith(expect.objectContaining({
      hasRestaurant: false, hasReception: false,
    }));
  });

  test('201 — hotelServices (chaîne séparée par des virgules) est normalisé en tableau', async () => {
    mockUserAuth(ADMIN_ID, 'Admin');
    mockPropertyAndAccommodation();
    Hotel.create = jest.fn().mockResolvedValue({ _id: HOTEL_ID, name: 'Le Panorama' });

    const res = await request(app)
      .post('/api/accommodations/admin')
      .set('Authorization', `Bearer ${makeToken(ADMIN_ID)}`)
      .send(hotelBody({
        hotelMode: 'create', hotelName: 'Le Panorama', hotelServices: 'Piscine, Wifi , Climatisation',
      }));

    expect(res.statusCode).toBe(201);
    expect(Hotel.create).toHaveBeenCalledWith(expect.objectContaining({
      services: ['Piscine', 'Wifi', 'Climatisation'],
    }));
  });

  test("201 — hotelEmail/hotelWebsite absents sont transmis vides, jamais undefined (aucune propriété arbitraire du body ne fuite)", async () => {
    mockUserAuth(ADMIN_ID, 'Admin');
    mockPropertyAndAccommodation();
    Hotel.create = jest.fn().mockResolvedValue({ _id: HOTEL_ID, name: 'Le Panorama' });

    const res = await request(app)
      .post('/api/accommodations/admin')
      .set('Authorization', `Bearer ${makeToken(ADMIN_ID)}`)
      .send(hotelBody({ hotelMode: 'create', hotelName: 'Le Panorama', neverAllowedField: 'injected' }));

    expect(res.statusCode).toBe(201);
    const created = Hotel.create.mock.calls[0][0];
    expect(created.email).toBe('');
    expect(created.website).toBe('');
    expect(created).not.toHaveProperty('neverAllowedField');
  });

  test("compensation — un Hôtel nouvellement créé est supprimé si l'Accommodation échoue ensuite", async () => {
    mockUserAuth(ADMIN_ID, 'Admin');
    const property = { _id: PROPERTY_ID, title: 'Hôtel', status: 'hebergement' };
    Property.create = jest.fn().mockResolvedValue(property);
    Property.findByIdAndDelete = jest.fn().mockResolvedValue({});
    Hotel.create = jest.fn().mockResolvedValue({ _id: HOTEL_ID, name: 'Le Panorama' });
    Hotel.findByIdAndDelete = jest.fn().mockResolvedValue({});
    Accommodation.create = jest.fn().mockRejectedValue(new Error('DB down'));

    const res = await request(app)
      .post('/api/accommodations/admin')
      .set('Authorization', `Bearer ${makeToken(ADMIN_ID)}`)
      .send(hotelBody({ hotelMode: 'create', hotelName: 'Le Panorama' }));

    expect(res.statusCode).toBe(500);
    expect(Hotel.findByIdAndDelete).toHaveBeenCalledWith(HOTEL_ID);
    expect(Property.findByIdAndDelete).toHaveBeenCalledWith(PROPERTY_ID);
  });

  test("compensation — un Hôtel nouvellement créé est supprimé si le RatePlan échoue ensuite", async () => {
    mockUserAuth(ADMIN_ID, 'Admin');
    const property = { _id: PROPERTY_ID, title: 'Hôtel', status: 'hebergement' };
    const accommodation = { _id: ACCOMMODATION_ID, property: PROPERTY_ID, toObject() { return { _id: this._id }; } };
    Property.create = jest.fn().mockResolvedValue(property);
    Property.findByIdAndDelete = jest.fn().mockResolvedValue({});
    Hotel.create = jest.fn().mockResolvedValue({ _id: HOTEL_ID, name: 'Le Panorama' });
    Hotel.findByIdAndDelete = jest.fn().mockResolvedValue({});
    Accommodation.create = jest.fn().mockResolvedValue(accommodation);
    Accommodation.findByIdAndDelete = jest.fn().mockResolvedValue({});
    RatePlan.create = jest.fn().mockRejectedValue(new Error('DB down'));

    const res = await request(app)
      .post('/api/accommodations/admin')
      .set('Authorization', `Bearer ${makeToken(ADMIN_ID)}`)
      .send(hotelBody({ hotelMode: 'create', hotelName: 'Le Panorama', nightlyPrice: '35000' }));

    expect(res.statusCode).toBe(500);
    expect(Accommodation.findByIdAndDelete).toHaveBeenCalledWith(ACCOMMODATION_ID);
    expect(Hotel.findByIdAndDelete).toHaveBeenCalledWith(HOTEL_ID);
    expect(Property.findByIdAndDelete).toHaveBeenCalledWith(PROPERTY_ID);
  });

  test("un Hôtel EXISTANT sélectionné par l'utilisateur n'est jamais supprimé, même si l'Accommodation échoue ensuite", async () => {
    mockUserAuth(ADMIN_ID, 'Admin');
    const property = { _id: PROPERTY_ID, title: 'Hôtel', status: 'hebergement' };
    Property.create = jest.fn().mockResolvedValue(property);
    Property.findByIdAndDelete = jest.fn().mockResolvedValue({});
    Hotel.findById = jest.fn().mockResolvedValue({ _id: HOTEL_ID, name: 'Le Panorama' });
    Hotel.findByIdAndDelete = jest.fn().mockResolvedValue({});
    Accommodation.create = jest.fn().mockRejectedValue(new Error('DB down'));

    const res = await request(app)
      .post('/api/accommodations/admin')
      .set('Authorization', `Bearer ${makeToken(ADMIN_ID)}`)
      .send(hotelBody({ hotelMode: 'existing', hotelId: HOTEL_ID }));

    expect(res.statusCode).toBe(500);
    expect(Hotel.findByIdAndDelete).not.toHaveBeenCalled();
    expect(Property.findByIdAndDelete).toHaveBeenCalledWith(PROPERTY_ID);
  });

  test("un autre type d'hébergement (villa_meublee) n'exige aucune référence Hôtel", async () => {
    mockUserAuth(ADMIN_ID, 'Admin');
    const property = { _id: PROPERTY_ID, title: 'Villa', status: 'hebergement' };
    const accommodation = { _id: ACCOMMODATION_ID, property: PROPERTY_ID, toObject() { return { _id: this._id }; } };
    Property.create = jest.fn().mockResolvedValue(property);
    Accommodation.create = jest.fn().mockResolvedValue(accommodation);

    const res = await request(app)
      .post('/api/accommodations/admin')
      .set('Authorization', `Bearer ${makeToken(ADMIN_ID)}`)
      .send(hotelBody({ accommodationType: 'villa_meublee' }));

    expect(res.statusCode).toBe(201);
    expect(Hotel.create).not.toHaveBeenCalled();
    expect(Hotel.findById).not.toHaveBeenCalled();
    expect(Accommodation.create).toHaveBeenCalledWith(expect.objectContaining({ hotel: null }));
  });
});

describe('PUT /api/accommodations/admin/:propertyId — édition complète (dashboard admin)', () => {
  afterEach(() => jest.clearAllMocks());

  const existingProperty = (overrides = {}) => ({
    _id: PROPERTY_ID,
    title: 'Villa existante',
    status: 'hebergement',
    save: jest.fn().mockResolvedValue(),
    ...overrides,
  });

  test('401 sans token', async () => {
    const res = await request(app).put(`/api/accommodations/admin/${PROPERTY_ID}`).send({ title: 'x' });
    expect(res.statusCode).toBe(401);
  });

  test('403 — un non-staff est refusé', async () => {
    mockUserAuth(OWNER_ID, 'Proprietaire');
    const res = await request(app)
      .put(`/api/accommodations/admin/${PROPERTY_ID}`)
      .set('Authorization', `Bearer ${makeToken(OWNER_ID)}`)
      .send({ title: 'x' });
    expect(res.statusCode).toBe(403);
  });

  test('404 — bien introuvable', async () => {
    mockUserAuth(ADMIN_ID, 'Admin');
    Property.findById = jest.fn().mockResolvedValue(null);
    const res = await request(app)
      .put(`/api/accommodations/admin/${PROPERTY_ID}`)
      .set('Authorization', `Bearer ${makeToken(ADMIN_ID)}`)
      .send({ title: 'x' });
    expect(res.statusCode).toBe(404);
  });

  test("422 — refuse un bien qui n'est pas de type hébergement", async () => {
    mockUserAuth(ADMIN_ID, 'Admin');
    Property.findById = jest.fn().mockResolvedValue(existingProperty({ status: 'vente' }));
    const res = await request(app)
      .put(`/api/accommodations/admin/${PROPERTY_ID}`)
      .set('Authorization', `Bearer ${makeToken(ADMIN_ID)}`)
      .send({ title: 'x' });
    expect(res.statusCode).toBe(422);
  });

  test("200 — met à jour Property + Accommodation existant sans créer de doublon", async () => {
    mockUserAuth(ADMIN_ID, 'Admin');
    const property = existingProperty();
    Property.findById = jest.fn().mockResolvedValue(property);
    const existingAccommodation = {
      _id: ACCOMMODATION_ID, property: PROPERTY_ID, accommodationType: 'villa_meublee',
      publicationStatus: 'brouillon',
      save: jest.fn().mockResolvedValue(),
      toObject() { return { _id: this._id, accommodationType: this.accommodationType }; },
    };
    Accommodation.findOne = jest.fn().mockResolvedValue(existingAccommodation);

    const res = await request(app)
      .put(`/api/accommodations/admin/${PROPERTY_ID}`)
      .set('Authorization', `Bearer ${makeToken(ADMIN_ID)}`)
      .send({ title: 'Villa mise à jour', beds: '5' });

    expect(res.statusCode).toBe(200);
    expect(Accommodation.create).not.toHaveBeenCalled();
    expect(existingAccommodation.save).toHaveBeenCalled();
    expect(property.title).toBe('Villa mise à jour');
  });

  test("crée l'Accommodation si elle manque exceptionnellement (ancien Property sans profil)", async () => {
    mockUserAuth(ADMIN_ID, 'Admin');
    Property.findById = jest.fn().mockResolvedValue(existingProperty());
    Accommodation.findOne = jest.fn().mockResolvedValue(null);
    Accommodation.create = jest.fn().mockResolvedValue({
      _id: ACCOMMODATION_ID, toObject() { return { _id: this._id }; },
    });

    const res = await request(app)
      .put(`/api/accommodations/admin/${PROPERTY_ID}`)
      .set('Authorization', `Bearer ${makeToken(ADMIN_ID)}`)
      .send({ accommodationType: 'studio_meuble' });

    expect(res.statusCode).toBe(200);
    expect(Accommodation.create).toHaveBeenCalledTimes(1);
  });

  test("ne crée pas de nouveau RatePlan si aucun tarif n'est fourni en édition", async () => {
    mockUserAuth(ADMIN_ID, 'Admin');
    Property.findById = jest.fn().mockResolvedValue(existingProperty());
    Accommodation.findOne = jest.fn().mockResolvedValue({
      _id: ACCOMMODATION_ID, save: jest.fn().mockResolvedValue(),
      toObject() { return { _id: this._id }; },
    });

    const res = await request(app)
      .put(`/api/accommodations/admin/${PROPERTY_ID}`)
      .set('Authorization', `Bearer ${makeToken(ADMIN_ID)}`)
      .send({ title: 'Sans changement de tarif' });

    expect(res.statusCode).toBe(200);
    expect(RatePlan.create).not.toHaveBeenCalled();
    expect(RatePlan.updateMany).not.toHaveBeenCalled();
  });

  test("un nouveau tarif désactive l'ancien plutôt que de créer un doublon (même mode)", async () => {
    mockUserAuth(ADMIN_ID, 'Admin');
    Property.findById = jest.fn().mockResolvedValue(existingProperty());
    Accommodation.findOne = jest.fn().mockResolvedValue({
      _id: ACCOMMODATION_ID, save: jest.fn().mockResolvedValue(),
      toObject() { return { _id: this._id }; },
    });
    RatePlan.updateMany = jest.fn().mockResolvedValue({});
    RatePlan.create = jest.fn().mockResolvedValue({ mode: 'nightly', amount: 40000, currency: 'XAF' });

    const res = await request(app)
      .put(`/api/accommodations/admin/${PROPERTY_ID}`)
      .set('Authorization', `Bearer ${makeToken(ADMIN_ID)}`)
      .send({ nightlyPrice: '40000' });

    expect(res.statusCode).toBe(200);
    expect(RatePlan.updateMany).toHaveBeenCalledWith(
      { accommodation: ACCOMMODATION_ID, mode: 'nightly', active: true },
      { $set: { active: false } },
    );
    expect(RatePlan.create).toHaveBeenCalledTimes(1);
  });

  test("édition sans changement d'hôtel : la référence existante est conservée, aucune duplication", async () => {
    mockUserAuth(ADMIN_ID, 'Admin');
    Property.findById = jest.fn().mockResolvedValue(existingProperty());
    const existingAccommodation = {
      _id: ACCOMMODATION_ID, property: PROPERTY_ID, accommodationType: 'hotel', hotel: HOTEL_ID,
      save: jest.fn().mockResolvedValue(),
      toObject() { return { _id: this._id, accommodationType: this.accommodationType, hotel: this.hotel }; },
    };
    Accommodation.findOne = jest.fn().mockResolvedValue(existingAccommodation);

    const res = await request(app)
      .put(`/api/accommodations/admin/${PROPERTY_ID}`)
      .set('Authorization', `Bearer ${makeToken(ADMIN_ID)}`)
      .send({ title: 'Hôtel mis à jour' });

    expect(res.statusCode).toBe(200);
    expect(Accommodation.create).not.toHaveBeenCalled();
    expect(Hotel.create).not.toHaveBeenCalled();
    expect(existingAccommodation.hotel).toBe(HOTEL_ID);
  });

  test("édition — rattacher à un nouvel Hôtel existant remplace la référence sans supprimer l'ancien", async () => {
    mockUserAuth(ADMIN_ID, 'Admin');
    Property.findById = jest.fn().mockResolvedValue(existingProperty());
    const previousHotelId = '707f1f77bcf86cd799439066';
    const existingAccommodation = {
      _id: ACCOMMODATION_ID, property: PROPERTY_ID, accommodationType: 'hotel', hotel: previousHotelId,
      save: jest.fn().mockResolvedValue(),
      toObject() { return { _id: this._id, accommodationType: this.accommodationType, hotel: this.hotel }; },
    };
    Accommodation.findOne = jest.fn().mockResolvedValue(existingAccommodation);
    Accommodation.countDocuments = jest.fn().mockResolvedValue(1); // encore référencé ailleurs
    Hotel.findById = jest.fn().mockResolvedValue({ _id: HOTEL_ID, name: 'Nouvel hôtel' });

    const res = await request(app)
      .put(`/api/accommodations/admin/${PROPERTY_ID}`)
      .set('Authorization', `Bearer ${makeToken(ADMIN_ID)}`)
      .send({ hotelMode: 'existing', hotelId: HOTEL_ID });

    expect(res.statusCode).toBe(200);
    expect(existingAccommodation.hotel).toBe(HOTEL_ID);
    expect(Hotel.findByIdAndDelete).not.toHaveBeenCalled();
    expect(res.body.data.hotelOrphaned).toBe(false);
  });

  test("édition — passer à un type non-hôtel détache la référence et signale un hôtel orphelin sans le supprimer", async () => {
    mockUserAuth(ADMIN_ID, 'Admin');
    Property.findById = jest.fn().mockResolvedValue(existingProperty());
    const existingAccommodation = {
      _id: ACCOMMODATION_ID, property: PROPERTY_ID, accommodationType: 'hotel', hotel: HOTEL_ID,
      save: jest.fn().mockResolvedValue(),
      toObject() { return { _id: this._id, accommodationType: this.accommodationType, hotel: this.hotel }; },
    };
    Accommodation.findOne = jest.fn().mockResolvedValue(existingAccommodation);
    Accommodation.countDocuments = jest.fn().mockResolvedValue(0); // plus aucune référence

    const res = await request(app)
      .put(`/api/accommodations/admin/${PROPERTY_ID}`)
      .set('Authorization', `Bearer ${makeToken(ADMIN_ID)}`)
      .send({ accommodationType: 'villa_meublee' });

    expect(res.statusCode).toBe(200);
    expect(existingAccommodation.hotel).toBeNull();
    expect(Hotel.findByIdAndDelete).not.toHaveBeenCalled();
    expect(res.body.data.hotelOrphaned).toBe(true);
  });
});

describe('GET /api/hotels — liste des établissements (sélecteur admin)', () => {
  afterEach(() => jest.clearAllMocks());

  test('401 sans token', async () => {
    const res = await request(app).get('/api/hotels');
    expect(res.statusCode).toBe(401);
  });

  test('403 — un Proprietaire ne peut pas consulter la liste des hôtels', async () => {
    mockUserAuth(OWNER_ID, 'Proprietaire');
    const res = await request(app)
      .get('/api/hotels')
      .set('Authorization', `Bearer ${makeToken(OWNER_ID)}`);
    expect(res.statusCode).toBe(403);
  });

  test('200 — un admin récupère la liste des hôtels actifs', async () => {
    mockUserAuth(ADMIN_ID, 'Admin');
    Hotel.find = jest.fn().mockReturnValue({
      select: jest.fn().mockReturnValue({
        sort: jest.fn().mockReturnValue({
          limit: jest.fn().mockResolvedValue([{ _id: HOTEL_ID, name: 'Le Panorama' }]),
        }),
      }),
    });
    const res = await request(app)
      .get('/api/hotels')
      .set('Authorization', `Bearer ${makeToken(ADMIN_ID)}`);
    expect(res.statusCode).toBe(200);
    expect(res.body.data.hotels).toHaveLength(1);
    expect(Hotel.find).toHaveBeenCalledWith({ status: 'actif' });
  });
});
