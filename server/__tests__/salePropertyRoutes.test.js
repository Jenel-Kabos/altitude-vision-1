// __tests__/salePropertyRoutes.test.js — Sprint A (séparation Vente/Location)

jest.mock('../models/Property');
jest.mock('../models/SaleManagement');
jest.mock('../models/RentalManagement');
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
jest.mock('../config/cloudinary', () => ({
  ...jest.requireActual('../config/cloudinary'),
  destroyFromCloudinary: jest.fn().mockResolvedValue(),
}));
// SECURITY-CLOSURE-P1-WAVE-1 (P1-F) — `updateFull` (staff) appelle
// désormais `assertStaffPropertyTenantAccess` ; sans ce mock, la résolution
// tenant réelle (non mockée dans ce test unitaire) attend indéfiniment une
// connexion Mongo absente ici (timeout Jest).
jest.mock('../services/platformTenant/tenantContextService', () => ({
  resolveTenantForUser: jest.fn().mockResolvedValue({ _id: '607f1f77bcf86cd799439001' }),
}));
jest.mock('../services/platformTenant/tenantResourceAttributionService', () => ({
  assertResourceTenantOrUnattributed: jest.fn().mockResolvedValue({ status: 'resolved', tenantId: '607f1f77bcf86cd799439001' }),
}));

const request = require('supertest');
const jwt = require('jsonwebtoken');
const { app } = require('../server');
const Property = require('../models/Property');
const SaleManagement = require('../models/SaleManagement');
const RentalManagement = require('../models/RentalManagement');
const User = require('../models/User');

const OWNER_ID = '507f1f77bcf86cd799439011';
const ADMIN_ID = '507f1f77bcf86cd799439012';
const PROPERTY_ID = '507f191e810c19729de860ea';

const makeToken = (id) => jwt.sign({ id, tokenVersion: 0 }, process.env.JWT_SECRET, { expiresIn: '1d' });
const fakeUser = (id, role = 'Admin') => ({
  _id: id, id, name: 'Test User', email: 'test@altitude.com',
  role, isActive: true, status: 'Actif', tokenVersion: 0,
});
const mockUserAuth = (id, role) => {
  User.findById = jest.fn().mockReturnValue({ select: jest.fn().mockResolvedValue(fakeUser(id, role)) });
  User.findByIdAndUpdate = jest.fn().mockReturnValue({ catch: jest.fn() });
};

const validBody = () => ({
  title: 'Villa à vendre',
  description: 'Belle villa avec jardin.',
  price: '75000000',
  type: 'Villa',
  surface: '250',
  bedrooms: '4',
  bathrooms: '3',
  'address[city]': 'Brazzaville',
  'address[arrondissement]': 'Bacongo',
  latitude: '-4.26',
  longitude: '15.24',
  negotiable: 'true',
  legalStatus: 'regularise',
  agencyCommission: '5',
});

describe('POST /api/sale-properties — création complète (dashboard admin)', () => {
  afterEach(() => jest.clearAllMocks());

  const mockCreatedDocs = () => {
    const property = { _id: PROPERTY_ID, title: 'Villa à vendre', status: 'vente' };
    const sale = { _id: 'sale1', property: PROPERTY_ID, negotiable: true, legalStatus: 'regularise' };
    Property.create = jest.fn().mockResolvedValue(property);
    SaleManagement.create = jest.fn().mockResolvedValue(sale);
    return { property, sale };
  };

  test('401 sans token', async () => {
    const res = await request(app).post('/api/sale-properties').send(validBody());
    expect(res.statusCode).toBe(401);
  });

  test("403 — un rôle sans lien avec l'immobilier (Client) est refusé", async () => {
    mockUserAuth(OWNER_ID, 'Client');
    const res = await request(app)
      .post('/api/sale-properties')
      .set('Authorization', `Bearer ${makeToken(OWNER_ID)}`)
      .send(validBody());
    expect(res.statusCode).toBe(403);
    expect(Property.create).not.toHaveBeenCalled();
  });

  // UX-OWNER-2 — `Proprietaire` est désormais autorisé sur cette route
  // (server/routes/salePropertyRoutes.js), avec ses propres frontières
  // appliquées côté contrôleur (jamais un accès Admin élargi) :
  // - `owner` toujours forcé sur l'acteur, jamais un body arbitraire ;
  // - `agencyCommission` (Admin-only, commission interne) silencieusement
  //   ignoré, jamais une 422, jamais persisté.
  test('201 — un Proprietaire crée sa propre annonce de vente, owner forcé, agencyCommission ignoré', async () => {
    mockUserAuth(OWNER_ID, 'Proprietaire');
    const { sale } = mockCreatedDocs();

    const res = await request(app)
      .post('/api/sale-properties')
      .set('Authorization', `Bearer ${makeToken(OWNER_ID)}`)
      .send({ ...validBody(), owner: ADMIN_ID }); // tentative d'injection d'un owner arbitraire

    expect(res.statusCode).toBe(201);
    expect(Property.create).toHaveBeenCalledWith(expect.objectContaining({ status: 'vente', owner: OWNER_ID }));
    const saleCreatedWith = SaleManagement.create.mock.calls[0][0];
    expect(saleCreatedWith).not.toHaveProperty('agencyCommission');
    expect(res.body.data.sale._id).toBe(sale._id);
  });

  test('201 — un admin crée une annonce de vente complète (Property + SaleManagement)', async () => {
    mockUserAuth(ADMIN_ID, 'Admin');
    const { property, sale } = mockCreatedDocs();

    const res = await request(app)
      .post('/api/sale-properties')
      .set('Authorization', `Bearer ${makeToken(ADMIN_ID)}`)
      .send(validBody());

    expect(res.statusCode).toBe(201);
    expect(Property.create).toHaveBeenCalledWith(expect.objectContaining({ status: 'vente' }));
    expect(SaleManagement.create).toHaveBeenCalledWith(expect.objectContaining({
      property: property._id, negotiable: true, legalStatus: 'regularise', agencyCommission: 5,
    }));
    expect(res.body.data.property._id).toBe(PROPERTY_ID);
    expect(res.body.data.sale._id).toBe('sale1');
  });

  test('422 — un prix de vente négatif ou nul est refusé (audit sécurité Sprint A)', async () => {
    mockUserAuth(ADMIN_ID, 'Admin');
    mockCreatedDocs();
    const negative = await request(app)
      .post('/api/sale-properties')
      .set('Authorization', `Bearer ${makeToken(ADMIN_ID)}`)
      .send({ ...validBody(), price: '-50000' });
    expect(negative.statusCode).toBe(422);
    expect(Property.create).not.toHaveBeenCalled();

    const zero = await request(app)
      .post('/api/sale-properties')
      .set('Authorization', `Bearer ${makeToken(ADMIN_ID)}`)
      .send({ ...validBody(), price: '0' });
    expect(zero.statusCode).toBe(422);
  });

  test('422 — prix absent est refusé', async () => {
    mockUserAuth(ADMIN_ID, 'Admin');
    mockCreatedDocs();
    const body = validBody();
    delete body.price;

    const res = await request(app)
      .post('/api/sale-properties')
      .set('Authorization', `Bearer ${makeToken(ADMIN_ID)}`)
      .send(body);

    expect(res.statusCode).toBe(422);
    expect(Property.create).not.toHaveBeenCalled();
  });

  test("un champ hôtelier injecté (hotelMode) est ignoré — jamais transmis à SaleManagement", async () => {
    mockUserAuth(ADMIN_ID, 'Admin');
    mockCreatedDocs();
    const body = { ...validBody(), hotelMode: 'create', hotelName: 'Injection test' };

    const res = await request(app)
      .post('/api/sale-properties')
      .set('Authorization', `Bearer ${makeToken(ADMIN_ID)}`)
      .send(body);

    expect(res.statusCode).toBe(201);
    const created = SaleManagement.create.mock.calls[0][0];
    expect(created).not.toHaveProperty('hotelMode');
    expect(created).not.toHaveProperty('hotelName');
  });

  test('422 — un statut juridique invalide est refusé', async () => {
    mockUserAuth(ADMIN_ID, 'Admin');
    mockCreatedDocs();
    const body = { ...validBody(), legalStatus: 'valeur_invalide' };

    const res = await request(app)
      .post('/api/sale-properties')
      .set('Authorization', `Bearer ${makeToken(ADMIN_ID)}`)
      .send(body);

    expect(res.statusCode).toBe(422);
    expect(Property.create).not.toHaveBeenCalled();
  });

  test('422 — une commission hors 0-100 est refusée', async () => {
    mockUserAuth(ADMIN_ID, 'Admin');
    mockCreatedDocs();
    const body = { ...validBody(), agencyCommission: '150' };

    const res = await request(app)
      .post('/api/sale-properties')
      .set('Authorization', `Bearer ${makeToken(ADMIN_ID)}`)
      .send(body);

    expect(res.statusCode).toBe(422);
    expect(Property.create).not.toHaveBeenCalled();
  });

  // UX-OWNER-2 — mass assignment : un Proprietaire ne doit jamais pouvoir
  // forcer un statut administratif, une publication ou un rôle de commission
  // via le body, même en les nommant explicitement.
  test("mass assignment — un Proprietaire injectant statusAdmin/isPublished/recommande/agent ne les voit jamais appliqués", async () => {
    mockUserAuth(OWNER_ID, 'Proprietaire');
    mockCreatedDocs();

    await request(app)
      .post('/api/sale-properties')
      .set('Authorization', `Bearer ${makeToken(OWNER_ID)}`)
      .send({ ...validBody(), statusAdmin: 'Validée', isPublished: 'true', recommande: 'true', agent: ADMIN_ID });

    const createdWith = Property.create.mock.calls[0][0];
    expect(createdWith.statusAdmin).toBe('En attente');
    expect(createdWith).not.toHaveProperty('isPublished');
    expect(createdWith).not.toHaveProperty('recommande');
    expect(createdWith).not.toHaveProperty('agent');
    expect(createdWith.owner).toBe(OWNER_ID);
  });

  test('aucun Property orphelin ne subsiste si SaleManagement échoue (compensation)', async () => {
    mockUserAuth(ADMIN_ID, 'Admin');
    const property = {
      _id: PROPERTY_ID, title: 'Villa', status: 'vente',
      images: ['https://res.cloudinary.com/demo/image/upload/v1/altitude-vision/properties/abc.jpg'],
    };
    Property.create = jest.fn().mockResolvedValue(property);
    Property.findByIdAndDelete = jest.fn().mockResolvedValue({});
    SaleManagement.create = jest.fn().mockRejectedValue(new Error('DB down'));

    const res = await request(app)
      .post('/api/sale-properties')
      .set('Authorization', `Bearer ${makeToken(ADMIN_ID)}`)
      .send(validBody());

    expect(res.statusCode).toBe(500);
    expect(Property.findByIdAndDelete).toHaveBeenCalledWith(PROPERTY_ID);
  });
});

describe('PUT /api/sale-properties/:propertyId — édition complète (dashboard admin)', () => {
  afterEach(() => jest.clearAllMocks());

  const existingProperty = (overrides = {}) => ({
    _id: PROPERTY_ID, title: 'Villa existante', status: 'vente',
    save: jest.fn().mockResolvedValue(), ...overrides,
  });

  test('401 sans token', async () => {
    const res = await request(app).put(`/api/sale-properties/${PROPERTY_ID}`).send({ title: 'x' });
    expect(res.statusCode).toBe(401);
  });

  test("403 — un rôle sans lien avec l'immobilier (Client) est refusé", async () => {
    mockUserAuth(OWNER_ID, 'Client');
    const res = await request(app)
      .put(`/api/sale-properties/${PROPERTY_ID}`)
      .set('Authorization', `Bearer ${makeToken(OWNER_ID)}`)
      .send({ title: 'x' });
    expect(res.statusCode).toBe(403);
  });

  // UX-OWNER-2 — un Proprietaire peut désormais atteindre ce contrôleur,
  // mais seulement pour SES PROPRES biens (jamais de vérification
  // d'ownership auparavant, cette route était réservée au staff).
  test('403 — un Proprietaire ne peut pas modifier le bien vente d\'un autre propriétaire', async () => {
    mockUserAuth(OWNER_ID, 'Proprietaire');
    Property.findById = jest.fn().mockResolvedValue(existingProperty({ owner: ADMIN_ID }));
    const res = await request(app)
      .put(`/api/sale-properties/${PROPERTY_ID}`)
      .set('Authorization', `Bearer ${makeToken(OWNER_ID)}`)
      .send({ title: 'x' });
    expect(res.statusCode).toBe(403);
  });

  test('200 — un Proprietaire modifie SON PROPRE bien vente, agencyCommission ignoré, repasse en modération', async () => {
    mockUserAuth(OWNER_ID, 'Proprietaire');
    const property = existingProperty({ owner: OWNER_ID });
    Property.findById = jest.fn().mockResolvedValue(property);
    const existingSale = { _id: 'sale1', property: PROPERTY_ID, save: jest.fn().mockResolvedValue() };
    SaleManagement.findOne = jest.fn().mockResolvedValue(existingSale);
    RentalManagement.findOne = jest.fn().mockReturnValue({ select: jest.fn().mockResolvedValue(null) });

    const res = await request(app)
      .put(`/api/sale-properties/${PROPERTY_ID}`)
      .set('Authorization', `Bearer ${makeToken(OWNER_ID)}`)
      .send({ title: 'Villa mise à jour par le propriétaire', agencyCommission: '9' });

    expect(res.statusCode).toBe(200);
    expect(property.title).toBe('Villa mise à jour par le propriétaire');
    expect(property.statusAdmin).toBe('En attente');
    const saleUpdate = existingSale;
    expect(saleUpdate).not.toHaveProperty('agencyCommission');
  });

  test('404 — bien introuvable', async () => {
    mockUserAuth(ADMIN_ID, 'Admin');
    Property.findById = jest.fn().mockResolvedValue(null);
    const res = await request(app)
      .put(`/api/sale-properties/${PROPERTY_ID}`)
      .set('Authorization', `Bearer ${makeToken(ADMIN_ID)}`)
      .send({ title: 'x' });
    expect(res.statusCode).toBe(404);
  });

  test("422 — refuse un bien qui n'est pas une annonce de vente (non-régression Location/Hébergement)", async () => {
    mockUserAuth(ADMIN_ID, 'Admin');
    Property.findById = jest.fn().mockResolvedValue(existingProperty({ status: 'location' }));
    const res = await request(app)
      .put(`/api/sale-properties/${PROPERTY_ID}`)
      .set('Authorization', `Bearer ${makeToken(ADMIN_ID)}`)
      .send({ title: 'x' });
    expect(res.statusCode).toBe(422);
  });

  test('422 — un prix de vente négatif ou nul est refusé en édition (audit sécurité Sprint A)', async () => {
    mockUserAuth(ADMIN_ID, 'Admin');
    Property.findById = jest.fn().mockResolvedValue(existingProperty());
    const res = await request(app)
      .put(`/api/sale-properties/${PROPERTY_ID}`)
      .set('Authorization', `Bearer ${makeToken(ADMIN_ID)}`)
      .send({ price: '-1' });
    expect(res.statusCode).toBe(422);
    expect(SaleManagement.create).not.toHaveBeenCalled();
  });

  test("200 — met à jour Property + SaleManagement existant sans créer de doublon", async () => {
    mockUserAuth(ADMIN_ID, 'Admin');
    const property = existingProperty();
    Property.findById = jest.fn().mockResolvedValue(property);
    const existingSale = {
      _id: 'sale1', property: PROPERTY_ID, negotiable: false,
      save: jest.fn().mockResolvedValue(),
    };
    SaleManagement.findOne = jest.fn().mockResolvedValue(existingSale);

    const res = await request(app)
      .put(`/api/sale-properties/${PROPERTY_ID}`)
      .set('Authorization', `Bearer ${makeToken(ADMIN_ID)}`)
      .send({ title: 'Villa mise à jour', negotiable: 'true' });

    expect(res.statusCode).toBe(200);
    expect(SaleManagement.create).not.toHaveBeenCalled();
    expect(existingSale.save).toHaveBeenCalled();
    expect(existingSale.negotiable).toBe(true);
    expect(property.title).toBe('Villa mise à jour');
  });

  test("crée le SaleManagement s'il manque exceptionnellement (ancien Property sans fiche)", async () => {
    mockUserAuth(ADMIN_ID, 'Admin');
    Property.findById = jest.fn().mockResolvedValue(existingProperty());
    SaleManagement.findOne = jest.fn().mockResolvedValue(null);
    SaleManagement.create = jest.fn().mockResolvedValue({ _id: 'sale1' });

    const res = await request(app)
      .put(`/api/sale-properties/${PROPERTY_ID}`)
      .set('Authorization', `Bearer ${makeToken(ADMIN_ID)}`)
      .send({ negotiable: 'true' });

    expect(res.statusCode).toBe(200);
    expect(SaleManagement.create).toHaveBeenCalledTimes(1);
  });
});
