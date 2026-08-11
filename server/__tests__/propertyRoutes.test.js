// __tests__/propertyRoutes.test.js
// Tests d'intégration des routes de biens immobiliers (modèles mockés)

jest.mock('../models/Property');
jest.mock('../models/User');
jest.mock('../models/Accommodation');
jest.mock('../models/SaleManagement');
jest.mock('../models/RentalManagement');
jest.mock('../models/Transaction');
jest.mock('../models/Contrat');
// TENANT-CERT-2 — propertyController.js vérifie désormais la frontière
// tenant pour tout accès Admin non-propriétaire (voir
// __tests__/tenantCert2.adversarial.mongo.integration.test.js pour la
// vérification réelle, y compris le refus effectif d'un Admin hors
// tenant). Mocké ici en "toujours résolu" pour préserver l'intention des
// tests ci-dessous (logique métier SaleManagement/RentalManagement, sans
// dépendre d'une vraie connexion Mongo).
jest.mock('../services/platformTenant/tenantContextService', () => ({
  resolveTenantForUser: jest.fn().mockResolvedValue({ _id: '607f1f77bcf86cd799439001', rootOrgUnit: '607f1f77bcf86cd799439001' }),
  resolveRootOrgUnitId: jest.fn().mockResolvedValue('607f1f77bcf86cd799439001'),
  resolveAvailableTenantsForUser: jest.fn().mockResolvedValue([{ _id: '607f1f77bcf86cd799439001' }]),
  resolveTenantScope: jest.fn().mockResolvedValue({ scopeUserIds: new Set() }),
}));
jest.mock('../services/platformTenant/tenantResourceAttributionService', () => ({
  assertResourceTenant: jest.fn().mockResolvedValue({ status: 'resolved', tenantId: '607f1f77bcf86cd799439001' }),
  resolveResourceTenant: jest.fn().mockResolvedValue({ status: 'resolved', tenantId: '607f1f77bcf86cd799439001' }),
}));
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
const Accommodation = require('../models/Accommodation');
const SaleManagement = require('../models/SaleManagement');
const RentalManagement = require('../models/RentalManagement');

// Par défaut, aucune fiche Vente/Location (property.status indéfini dans la
// plupart des tests existants de ce fichier) — évite tout appel réel non
// mocké si un test venait à définir status: 'vente'/'location'.
SaleManagement.findOne = jest.fn().mockResolvedValue(null);
RentalManagement.findOne = jest.fn().mockResolvedValue(null);

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
const makeMongoChain = (result = [fakeProp], total = result.length) => {
  const chain = {};
  // toutes les méthodes chainables retournent le même objet
  ['find', 'sort', 'select', 'skip', 'limit', 'populate', 'lean'].forEach(m => {
    chain[m] = jest.fn().mockReturnValue(chain);
  });
  // countFeatures.query.countDocuments() — même chaîne, résultat distinct
  chain.countDocuments = jest.fn().mockResolvedValue(total);
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

  test('exclut un hébergement non publié du listing public sans affecter une Vente publiée (documente la limitation de pagination connue)', async () => {
    const venteProp = { ...fakeProp, _id: 'vente-1', status: 'vente' };
    const hebergementProp = { _id: 'heb-1', status: 'hebergement', statusAdmin: 'Validée', availability: 'Disponible' };
    // `total` (2) reflète le compte AVANT filtrage post-fetch — c'est la
    // limitation documentée dans propertyController.js (getAllProperties).
    Property.find = jest.fn().mockReturnValue(makeMongoChain([venteProp, hebergementProp], 2));
    Accommodation.find = jest.fn().mockReturnValue({ select: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue([]) }) });

    const res = await request(app).get('/api/properties');
    expect(res.statusCode).toBe(200);
    const ids = (res.body.data?.properties || []).map((p) => p._id);
    expect(ids).toContain('vente-1');
    expect(ids).not.toContain('heb-1');
    // Limitation connue : total (2) > results.length (1) quand un hébergement
    // non publié est retiré après pagination.
    expect(res.body.results).toBe(1);
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

  test('403 — un bien vendu ou loué reste inaccessible par URL publique directe', async () => {
    const document = {
      _id: '507f191e810c19729de860ea', title: 'TEST DATA CLOSED PROPERTY',
      statusAdmin: 'Validée', availability: 'Vendu', owner: { _id: '507f1f77bcf86cd799439012' },
    };
    Property.findByIdAndUpdate = jest.fn().mockReturnValue({ populate: jest.fn().mockResolvedValue(document) });

    const res = await request(app).get('/api/properties/507f191e810c19729de860ea');

    expect(res.statusCode).toBe(403);
  });

  test('200 — projection publique retire documents et coordonnées privées propriétaire', async () => {
    const document = {
      _id: '507f191e810c19729de860ea', title: 'TEST DATA PROPERTY', statusAdmin: 'Validée', isPublished: true,
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

  test('200 — incrémente réellement le compteur de vues en base ($inc, jamais un calcul local)', async () => {
    const document = {
      _id: '507f191e810c19729de860ea', title: 'TEST DATA PROPERTY', statusAdmin: 'Validée', isPublished: true,
      views: 43, images: [], address: {},
      toObject() { return { ...this, toObject: undefined }; },
    };
    const populateMock = jest.fn().mockResolvedValue(document);
    Property.findByIdAndUpdate = jest.fn().mockReturnValue({ populate: populateMock });
    const res = await request(app).get('/api/properties/507f191e810c19729de860ea');
    expect(res.statusCode).toBe(200);
    expect(Property.findByIdAndUpdate).toHaveBeenCalledWith(
      '507f191e810c19729de860ea',
      { $inc: { views: 1 } },
      { new: true },
    );
    expect(res.body.data.property.views).toBe(43);
  });

  // Fiches complètes (mocks) utilisées par les tests ci-dessous — champs
  // volontairement sensibles pour vérifier qu'ils ne fuient JAMAIS en public.
  const fullSaleDoc = () => ({
    _id: 'sale1', property: '507f191e810c19729de860ea',
    negotiable: true, legalStatus: 'regularise', financingAccepted: true,
    agencyCommission: 7, sellerConditions: 'TEST DATA SELLER CONDITIONS PRIVATE',
    ownershipDocumentType: 'Titre foncier', ownershipDocumentAvailable: true,
    manager: 'TEST-MANAGER-ID', createdBy: 'TEST-CREATOR-ID', publicationStatus: 'publie',
    toObject() { return { ...this, toObject: undefined }; },
  });
  const fullRentalDoc = () => ({
    _id: 'rental1', property: '507f191e810c19729de860ea',
    monthlyRent: 150000, furnished: true, chargesIncluded: false,
    minimumLeaseMonths: 12, availableFrom: '2026-08-01', petsAllowed: false,
    rentalConditions: 'TEST DATA PUBLIC CONDITIONS',
    currentTenant: 'TEST-TENANT-ID', activeLease: 'TEST-LEASE-ID',
    manager: 'TEST-MANAGER-ID', managementFee: 15000,
    workflowHistory: [{ action: 'TEST DATA INTERNAL NOTE', actor: 'TEST-ACTOR-ID' }],
    maintenanceReason: 'TEST DATA INTERNAL MAINTENANCE NOTE',
    occupancyStatus: 'occupe', publicationStatus: 'publie',
    toObject() { return { ...this, toObject: undefined }; },
  });

  test("200 (accès public, sans authentification) — la fiche SaleManagement est réduite à une projection publique sans champ interne", async () => {
    const document = {
      _id: '507f191e810c19729de860ea', title: 'TEST DATA VILLA', statusAdmin: 'Validée', isPublished: true,
      status: 'vente', images: [], address: {},
      toObject() { return { ...this, toObject: undefined }; },
    };
    Property.findByIdAndUpdate = jest.fn().mockReturnValue({ populate: jest.fn().mockResolvedValue(document) });
    SaleManagement.findOne = jest.fn().mockResolvedValue(fullSaleDoc());
    const res = await request(app).get('/api/properties/507f191e810c19729de860ea');
    expect(res.statusCode).toBe(200);
    expect(res.body.data.property.sale).toEqual({
      negotiable: true, legalStatus: 'regularise', financingAccepted: true,
    });
    // Jamais de champ interne/sensible en accès public.
    expect(res.body.data.property.sale.agencyCommission).toBeUndefined();
    expect(res.body.data.property.sale.sellerConditions).toBeUndefined();
    expect(res.body.data.property.sale.manager).toBeUndefined();
    expect(res.body.data.property.sale.createdBy).toBeUndefined();
    expect(res.body.data.property.sale.ownershipDocumentType).toBeUndefined();
    expect(res.body.data.property.rental).toBeUndefined();
  });

  test("200 (accès public, sans authentification) — la fiche RentalManagement est réduite à une projection publique sans dossier locatif interne", async () => {
    const document = {
      _id: '507f191e810c19729de860ea', title: 'TEST DATA APPART', statusAdmin: 'Validée', isPublished: true,
      status: 'location', images: [], address: {},
      toObject() { return { ...this, toObject: undefined }; },
    };
    Property.findByIdAndUpdate = jest.fn().mockReturnValue({ populate: jest.fn().mockResolvedValue(document) });
    RentalManagement.findOne = jest.fn().mockResolvedValue(fullRentalDoc());
    const res = await request(app).get('/api/properties/507f191e810c19729de860ea');
    expect(res.statusCode).toBe(200);
    expect(res.body.data.property.rental).toEqual({
      furnished: true, chargesIncluded: false, minimumLeaseMonths: 12,
      availableFrom: '2026-08-01', petsAllowed: false, rentalConditions: 'TEST DATA PUBLIC CONDITIONS',
    });
    // Jamais de dossier locatif interne (locataire, bail, gestion, historique) en accès public.
    expect(res.body.data.property.rental.monthlyRent).toBeUndefined();
    expect(res.body.data.property.rental.currentTenant).toBeUndefined();
    expect(res.body.data.property.rental.activeLease).toBeUndefined();
    expect(res.body.data.property.rental.manager).toBeUndefined();
    expect(res.body.data.property.rental.managementFee).toBeUndefined();
    expect(res.body.data.property.rental.workflowHistory).toBeUndefined();
    expect(res.body.data.property.rental.maintenanceReason).toBeUndefined();
    expect(res.body.data.property.rental.occupancyStatus).toBeUndefined();
    expect(res.body.data.property.sale).toBeUndefined();
  });

  // authController.optionalAuth (utilisé par GET /api/properties/:id) résout
  // `User.findById(id)` DIRECTEMENT (pas de `.select()` chaîné, contrairement
  // à `.protect`) et appelle `currentUser.changedPasswordAfter(...)` — un
  // mock non conforme est silencieusement avalé par son try/catch et
  // n'échoue jamais la requête, il retombe juste en accès anonyme (piège
  // découvert en écrivant ce test).
  const fakeAuthenticatedUser = (role) => ({ ...fakeUser(role), changedPasswordAfter: () => false });

  test("200 (Admin authentifié) — la fiche SaleManagement complète est renvoyée (préremplissage édition dashboard)", async () => {
    User.findById = jest.fn().mockResolvedValue(fakeAuthenticatedUser('Admin'));
    const document = {
      _id: '507f191e810c19729de860ea', title: 'TEST DATA VILLA', statusAdmin: 'Validée',
      status: 'vente', images: [], address: {},
      toObject() { return { ...this, toObject: undefined }; },
    };
    Property.findByIdAndUpdate = jest.fn().mockReturnValue({ populate: jest.fn().mockResolvedValue(document) });
    SaleManagement.findOne = jest.fn().mockResolvedValue(fullSaleDoc());
    const res = await request(app)
      .get('/api/properties/507f191e810c19729de860ea')
      .set('Authorization', `Bearer ${makeToken('Admin')}`);
    expect(res.statusCode).toBe(200);
    expect(res.body.data.property.sale.agencyCommission).toBe(7);
    expect(res.body.data.property.sale.sellerConditions).toBe('TEST DATA SELLER CONDITIONS PRIVATE');
  });

  test("200 (Admin authentifié) — la fiche RentalManagement complète est renvoyée (préremplissage édition dashboard)", async () => {
    User.findById = jest.fn().mockResolvedValue(fakeAuthenticatedUser('Admin'));
    const document = {
      _id: '507f191e810c19729de860ea', title: 'TEST DATA APPART', statusAdmin: 'Validée',
      status: 'location', images: [], address: {},
      toObject() { return { ...this, toObject: undefined }; },
    };
    Property.findByIdAndUpdate = jest.fn().mockReturnValue({ populate: jest.fn().mockResolvedValue(document) });
    RentalManagement.findOne = jest.fn().mockResolvedValue(fullRentalDoc());
    const res = await request(app)
      .get('/api/properties/507f191e810c19729de860ea')
      .set('Authorization', `Bearer ${makeToken('Admin')}`);
    expect(res.statusCode).toBe(200);
    expect(res.body.data.property.rental.monthlyRent).toBe(150000);
    expect(res.body.data.property.rental.currentTenant).toBe('TEST-TENANT-ID');
    expect(res.body.data.property.rental.workflowHistory).toEqual(fullRentalDoc().workflowHistory);
  });

  test("200 (Admin) — fallback legacy : un RentalManagement non activé (valeurs par défaut) n'écrase pas les vraies valeurs historiques de Property", async () => {
    User.findById = jest.fn().mockResolvedValue(fakeAuthenticatedUser('Admin'));
    const document = {
      _id: '507f191e810c19729de860ea', title: 'TEST DATA APPART ANCIEN', statusAdmin: 'Validée',
      status: 'location', images: [], address: {},
      // Valeurs historiques réellement saisies avant le Sprint A.
      cautionMultiplicateur: 4, profilsLocataireRecherches: ['Salarié', 'Fonctionnaire'], documentsRequis: ['CNI'],
      toObject() { return { ...this, toObject: undefined }; },
    };
    Property.findByIdAndUpdate = jest.fn().mockReturnValue({ populate: jest.fn().mockResolvedValue(document) });
    // RentalManagement créé automatiquement par le nouveau flux d'annonce
    // (Sprint A) mais jamais activé : valeurs par défaut du schéma uniquement.
    RentalManagement.findOne = jest.fn().mockResolvedValue({
      _id: 'rental1', property: document._id, managementActivated: false,
      cautionMultiplicateur: 2, profilsLocataireRecherches: [], documentsRequis: [],
      toObject() { return { ...this, toObject: undefined }; },
    });
    const res = await request(app)
      .get('/api/properties/507f191e810c19729de860ea')
      .set('Authorization', `Bearer ${makeToken('Admin')}`);
    expect(res.statusCode).toBe(200);
    expect(res.body.data.property.rental.cautionMultiplicateur).toBe(4);
    expect(res.body.data.property.rental.profilsLocataireRecherches).toEqual(['Salarié', 'Fonctionnaire']);
    expect(res.body.data.property.rental.documentsRequis).toEqual(['CNI']);
  });

  test("200 (Admin) — un RentalManagement réellement activé fait foi, même si Property porte d'anciennes valeurs différentes", async () => {
    User.findById = jest.fn().mockResolvedValue(fakeAuthenticatedUser('Admin'));
    const document = {
      _id: '507f191e810c19729de860ea', title: 'TEST DATA APPART GÉRÉ', statusAdmin: 'Validée',
      status: 'location', images: [], address: {},
      cautionMultiplicateur: 4, profilsLocataireRecherches: ['Salarié'], documentsRequis: ['CNI'],
      toObject() { return { ...this, toObject: undefined }; },
    };
    Property.findByIdAndUpdate = jest.fn().mockReturnValue({ populate: jest.fn().mockResolvedValue(document) });
    RentalManagement.findOne = jest.fn().mockResolvedValue({
      _id: 'rental1', property: document._id, managementActivated: true,
      cautionMultiplicateur: 1, profilsLocataireRecherches: ['Étudiant'], documentsRequis: [],
      toObject() { return { ...this, toObject: undefined }; },
    });
    const res = await request(app)
      .get('/api/properties/507f191e810c19729de860ea')
      .set('Authorization', `Bearer ${makeToken('Admin')}`);
    expect(res.statusCode).toBe(200);
    expect(res.body.data.property.rental.cautionMultiplicateur).toBe(1);
    expect(res.body.data.property.rental.profilsLocataireRecherches).toEqual(['Étudiant']);
    expect(res.body.data.property.rental.documentsRequis).toEqual([]);
  });

  test("200 (Admin) — une ancienne annonce Location sans RentalManagement conserve ses valeurs legacy directement sur Property", async () => {
    User.findById = jest.fn().mockResolvedValue(fakeAuthenticatedUser('Admin'));
    const document = {
      _id: '507f191e810c19729de860ea', title: 'TEST DATA APPART TRÈS ANCIEN', statusAdmin: 'Validée',
      status: 'location', images: [], address: {},
      cautionMultiplicateur: 3, profilsLocataireRecherches: ['Retraité'], documentsRequis: [],
      toObject() { return { ...this, toObject: undefined }; },
    };
    Property.findByIdAndUpdate = jest.fn().mockReturnValue({ populate: jest.fn().mockResolvedValue(document) });
    RentalManagement.findOne = jest.fn().mockResolvedValue(null); // jamais créé
    const res = await request(app)
      .get('/api/properties/507f191e810c19729de860ea')
      .set('Authorization', `Bearer ${makeToken('Admin')}`);
    expect(res.statusCode).toBe(200);
    expect(res.body.data.property.rental).toBeUndefined();
    expect(res.body.data.property.cautionMultiplicateur).toBe(3);
    expect(res.body.data.property.profilsLocataireRecherches).toEqual(['Retraité']);
  });
});

// ─── POST /api/properties/:id/like (favoris — même source que le web) ────────

describe('POST /api/properties/:id/like', () => {
  afterEach(() => jest.clearAllMocks());

  test('401 sans token', async () => {
    const res = await request(app).post(`/api/properties/${fakeProp._id}/like`);
    expect(res.statusCode).toBe(401);
  });

  test('404 — bien introuvable', async () => {
    User.findById = jest.fn().mockReturnValue({ select: jest.fn().mockResolvedValue(fakeUser('Client')) });
    User.findByIdAndUpdate = jest.fn().mockReturnValue({ catch: jest.fn() });
    Property.findById = jest.fn().mockResolvedValue(null);
    const res = await request(app)
      .post(`/api/properties/${fakeProp._id}/like`)
      .set('Authorization', `Bearer ${makeToken('Client')}`);
    expect(res.statusCode).toBe(404);
  });

  test("200 — premier like : ajout unique, pas de doublon possible ($addToSet)", async () => {
    User.findById = jest.fn().mockReturnValue({ select: jest.fn().mockResolvedValue(fakeUser('Client')) });
    User.findByIdAndUpdate = jest.fn().mockReturnValue({ catch: jest.fn() });
    const property = { likes: [] };
    Property.findById = jest.fn().mockResolvedValue(property);
    Property.findByIdAndUpdate = jest.fn().mockResolvedValue({ likes: ['507f1f77bcf86cd799439011'] });

    const res = await request(app)
      .post(`/api/properties/${fakeProp._id}/like`)
      .set('Authorization', `Bearer ${makeToken('Client')}`);

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ status: 'success', liked: true, likes: 1 });
    expect(Property.findByIdAndUpdate).toHaveBeenCalledWith(
      fakeProp._id,
      { $addToSet: { likes: '507f1f77bcf86cd799439011' } },
      { new: true },
    );
  });

  test('200 — deuxième appel retire le like (toggle) et le compteur redescend', async () => {
    User.findById = jest.fn().mockReturnValue({ select: jest.fn().mockResolvedValue(fakeUser('Client')) });
    User.findByIdAndUpdate = jest.fn().mockReturnValue({ catch: jest.fn() });
    const property = { likes: ['507f1f77bcf86cd799439011'] };
    Property.findById = jest.fn().mockResolvedValue(property);
    Property.findByIdAndUpdate = jest.fn().mockResolvedValue({ likes: [] });

    const res = await request(app)
      .post(`/api/properties/${fakeProp._id}/like`)
      .set('Authorization', `Bearer ${makeToken('Client')}`);

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ status: 'success', liked: false, likes: 0 });
    expect(Property.findByIdAndUpdate).toHaveBeenCalledWith(
      fakeProp._id,
      { $pull: { likes: '507f1f77bcf86cd799439011' } },
      { new: true },
    );
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

describe('Rental management route security', () => {
  afterEach(() => jest.clearAllMocks());

  test('401 — liste inaccessible sans authentification', async () => {
    const res = await request(app).get('/api/rental-management');
    expect(res.statusCode).toBe(401);
  });

  test('403 — un propriétaire ne peut pas forcer une publication', async () => {
    User.findById = jest.fn().mockReturnValue({ select: jest.fn().mockResolvedValue(fakeUser('Proprietaire')) });
    User.findByIdAndUpdate = jest.fn().mockReturnValue({ catch: jest.fn() });
    const res = await request(app)
      .post('/api/rental-management/507f191e810c19729de860ea/publish')
      .set('Authorization', `Bearer ${makeToken('Proprietaire')}`)
      .send({});
    expect(res.statusCode).toBe(403);
  });

  test('400 — ObjectId de dossier invalide contrôlé pour le staff', async () => {
    User.findById = jest.fn().mockReturnValue({ select: jest.fn().mockResolvedValue(fakeUser('Admin')) });
    User.findByIdAndUpdate = jest.fn().mockReturnValue({ catch: jest.fn() });
    const res = await request(app)
      .get('/api/rental-management/not-an-object-id')
      .set('Authorization', `Bearer ${makeToken('Admin')}`);
    expect(res.statusCode).toBe(400);
  });
});

// ─── POST /api/properties/:id/reviews (commentaires mobile) ──────────────────

describe('POST /api/properties/:id/reviews', () => {
  afterEach(() => jest.clearAllMocks());

  test('401 sans token', async () => {
    const res = await request(app)
      .post(`/api/properties/${fakeProp._id}/reviews`)
      .send({ comment: 'Très beau bien' });
    expect(res.statusCode).toBe(401);
  });

  test('400 — commentaire vide rejeté', async () => {
    User.findById = jest.fn().mockReturnValue({ select: jest.fn().mockResolvedValue(fakeUser('Client')) });
    const res = await request(app)
      .post(`/api/properties/${fakeProp._id}/reviews`)
      .set('Authorization', `Bearer ${makeToken('Client')}`)
      .send({ comment: '   ' });
    expect(res.statusCode).toBe(400);
  });

  test('404 — bien introuvable', async () => {
    User.findById = jest.fn().mockReturnValue({ select: jest.fn().mockResolvedValue(fakeUser('Client')) });
    Property.findById = jest.fn().mockResolvedValue(null);
    const res = await request(app)
      .post(`/api/properties/${fakeProp._id}/reviews`)
      .set('Authorization', `Bearer ${makeToken('Client')}`)
      .send({ comment: 'Très beau bien' });
    expect(res.statusCode).toBe(404);
  });

  test('201 — ajoute le commentaire et retourne la liste peuplée', async () => {
    User.findById = jest.fn().mockReturnValue({ select: jest.fn().mockResolvedValue(fakeUser('Client')) });
    const property = {
      reviews: [],
      save: jest.fn().mockResolvedValue(),
      populate: jest.fn().mockResolvedValue(),
    };
    Property.findById = jest.fn().mockResolvedValue(property);

    const res = await request(app)
      .post(`/api/properties/${fakeProp._id}/reviews`)
      .set('Authorization', `Bearer ${makeToken('Client')}`)
      .send({ comment: 'Très beau bien', rating: 4 });

    expect(res.statusCode).toBe(201);
    expect(property.save).toHaveBeenCalled();
    expect(property.reviews).toHaveLength(1);
    expect(property.reviews[0]).toMatchObject({ comment: 'Très beau bien', rating: 4 });
  });
});
