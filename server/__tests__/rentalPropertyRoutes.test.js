// __tests__/rentalPropertyRoutes.test.js — Sprint A (séparation Vente/Location)

jest.mock('../models/Property');
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

const request = require('supertest');
const jwt = require('jsonwebtoken');
const { app } = require('../server');
const Property = require('../models/Property');
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
  title: 'Appartement à louer',
  description: 'Bel appartement 3 pièces.',
  price: '150000',
  type: 'Appartement',
  surface: '80',
  bedrooms: '2',
  bathrooms: '1',
  'address[city]': 'Brazzaville',
  'address[arrondissement]': 'Bacongo',
  latitude: '-4.26',
  longitude: '15.24',
  monthlyRent: '150000',
  cautionMultiplicateur: '2',
  minimumLeaseMonths: '12',
});

describe('POST /api/rental-properties — création complète (dashboard admin)', () => {
  afterEach(() => jest.clearAllMocks());

  const mockCreatedDocs = () => {
    const property = { _id: PROPERTY_ID, title: 'Appartement à louer', status: 'location' };
    const rental = { _id: 'rental1', property: PROPERTY_ID, monthlyRent: 150000 };
    Property.create = jest.fn().mockResolvedValue(property);
    RentalManagement.create = jest.fn().mockResolvedValue(rental);
    return { property, rental };
  };

  test('401 sans token', async () => {
    const res = await request(app).post('/api/rental-properties').send(validBody());
    expect(res.statusCode).toBe(401);
  });

  test("403 — un utilisateur non-staff (Proprietaire) est refusé", async () => {
    mockUserAuth(OWNER_ID, 'Proprietaire');
    const res = await request(app)
      .post('/api/rental-properties')
      .set('Authorization', `Bearer ${makeToken(OWNER_ID)}`)
      .send(validBody());
    expect(res.statusCode).toBe(403);
    expect(Property.create).not.toHaveBeenCalled();
  });

  test('201 — un admin crée une annonce de location complète (Property + RentalManagement)', async () => {
    mockUserAuth(ADMIN_ID, 'Admin');
    const { property, rental } = mockCreatedDocs();

    const res = await request(app)
      .post('/api/rental-properties')
      .set('Authorization', `Bearer ${makeToken(ADMIN_ID)}`)
      .send(validBody());

    expect(res.statusCode).toBe(201);
    expect(Property.create).toHaveBeenCalledWith(expect.objectContaining({ status: 'location' }));
    expect(RentalManagement.create).toHaveBeenCalledWith(expect.objectContaining({
      property: property._id, monthlyRent: 150000, cautionMultiplicateur: 2, minimumLeaseMonths: 12,
      // Sprint A (audit sécurité) — une simple annonce ne doit jamais
      // démarrer directement en dossier de gestion locative "activé" (voir
      // rentalManagementController.stats/list, section 2 de l'audit).
      managementActivated: false,
    }));
    expect(res.body.data.property._id).toBe(PROPERTY_ID);
    expect(res.body.data.rental._id).toBe('rental1');
  });

  test('422 — un loyer négatif ou nul est refusé (audit sécurité Sprint A)', async () => {
    mockUserAuth(ADMIN_ID, 'Admin');
    mockCreatedDocs();
    const negative = await request(app)
      .post('/api/rental-properties')
      .set('Authorization', `Bearer ${makeToken(ADMIN_ID)}`)
      .send({ ...validBody(), price: '-1000' });
    expect(negative.statusCode).toBe(422);
    expect(Property.create).not.toHaveBeenCalled();
  });

  test('422 — loyer (prix) absent est refusé', async () => {
    mockUserAuth(ADMIN_ID, 'Admin');
    mockCreatedDocs();
    const body = validBody();
    delete body.price;

    const res = await request(app)
      .post('/api/rental-properties')
      .set('Authorization', `Bearer ${makeToken(ADMIN_ID)}`)
      .send(body);

    expect(res.statusCode).toBe(422);
    expect(Property.create).not.toHaveBeenCalled();
  });

  test('422 — une caution (multiplicateur) hors 0-6 est refusée', async () => {
    mockUserAuth(ADMIN_ID, 'Admin');
    mockCreatedDocs();
    const body = { ...validBody(), cautionMultiplicateur: '9' };

    const res = await request(app)
      .post('/api/rental-properties')
      .set('Authorization', `Bearer ${makeToken(ADMIN_ID)}`)
      .send(body);

    expect(res.statusCode).toBe(422);
    expect(Property.create).not.toHaveBeenCalled();
  });

  test('422 — une avance (minimumLeaseMonths) non entière est refusée', async () => {
    mockUserAuth(ADMIN_ID, 'Admin');
    mockCreatedDocs();
    const body = { ...validBody(), minimumLeaseMonths: '3.5' };

    const res = await request(app)
      .post('/api/rental-properties')
      .set('Authorization', `Bearer ${makeToken(ADMIN_ID)}`)
      .send(body);

    expect(res.statusCode).toBe(422);
    expect(Property.create).not.toHaveBeenCalled();
  });

  test('422 — un profil de locataire invalide est refusé', async () => {
    mockUserAuth(ADMIN_ID, 'Admin');
    mockCreatedDocs();
    const body = { ...validBody(), profilsLocataireRecherches: 'Millionnaire' };

    const res = await request(app)
      .post('/api/rental-properties')
      .set('Authorization', `Bearer ${makeToken(ADMIN_ID)}`)
      .send(body);

    expect(res.statusCode).toBe(422);
    expect(Property.create).not.toHaveBeenCalled();
  });

  test('aucun Property orphelin ne subsiste si RentalManagement échoue (compensation)', async () => {
    mockUserAuth(ADMIN_ID, 'Admin');
    const property = {
      _id: PROPERTY_ID, title: 'Appartement', status: 'location',
      images: ['https://res.cloudinary.com/demo/image/upload/v1/altitude-vision/properties/abc.jpg'],
    };
    Property.create = jest.fn().mockResolvedValue(property);
    Property.findByIdAndDelete = jest.fn().mockResolvedValue({});
    RentalManagement.create = jest.fn().mockRejectedValue(new Error('DB down'));

    const res = await request(app)
      .post('/api/rental-properties')
      .set('Authorization', `Bearer ${makeToken(ADMIN_ID)}`)
      .send(validBody());

    expect(res.statusCode).toBe(500);
    expect(Property.findByIdAndDelete).toHaveBeenCalledWith(PROPERTY_ID);
  });
});

describe('PUT /api/rental-properties/:propertyId — édition complète (dashboard admin)', () => {
  afterEach(() => jest.clearAllMocks());

  const existingProperty = (overrides = {}) => ({
    _id: PROPERTY_ID, title: 'Appartement existant', status: 'location',
    save: jest.fn().mockResolvedValue(), ...overrides,
  });

  test('401 sans token', async () => {
    const res = await request(app).put(`/api/rental-properties/${PROPERTY_ID}`).send({ title: 'x' });
    expect(res.statusCode).toBe(401);
  });

  test('403 — un non-staff est refusé', async () => {
    mockUserAuth(OWNER_ID, 'Proprietaire');
    const res = await request(app)
      .put(`/api/rental-properties/${PROPERTY_ID}`)
      .set('Authorization', `Bearer ${makeToken(OWNER_ID)}`)
      .send({ title: 'x' });
    expect(res.statusCode).toBe(403);
  });

  test('404 — bien introuvable', async () => {
    mockUserAuth(ADMIN_ID, 'Admin');
    Property.findById = jest.fn().mockResolvedValue(null);
    const res = await request(app)
      .put(`/api/rental-properties/${PROPERTY_ID}`)
      .set('Authorization', `Bearer ${makeToken(ADMIN_ID)}`)
      .send({ title: 'x' });
    expect(res.statusCode).toBe(404);
  });

  test("422 — refuse un bien qui n'est pas une annonce de location (non-régression Vente/Hébergement)", async () => {
    mockUserAuth(ADMIN_ID, 'Admin');
    Property.findById = jest.fn().mockResolvedValue(existingProperty({ status: 'vente' }));
    const res = await request(app)
      .put(`/api/rental-properties/${PROPERTY_ID}`)
      .set('Authorization', `Bearer ${makeToken(ADMIN_ID)}`)
      .send({ title: 'x' });
    expect(res.statusCode).toBe(422);
  });

  test('422 — un loyer négatif ou nul est refusé en édition (audit sécurité Sprint A)', async () => {
    mockUserAuth(ADMIN_ID, 'Admin');
    Property.findById = jest.fn().mockResolvedValue(existingProperty());
    const res = await request(app)
      .put(`/api/rental-properties/${PROPERTY_ID}`)
      .set('Authorization', `Bearer ${makeToken(ADMIN_ID)}`)
      .send({ price: '0' });
    expect(res.statusCode).toBe(422);
    expect(RentalManagement.create).not.toHaveBeenCalled();
  });

  test("200 — met à jour Property + RentalManagement existant sans créer de doublon", async () => {
    mockUserAuth(ADMIN_ID, 'Admin');
    const property = existingProperty();
    Property.findById = jest.fn().mockResolvedValue(property);
    const existingRental = {
      _id: 'rental1', property: PROPERTY_ID, monthlyRent: 100000,
      save: jest.fn().mockResolvedValue(),
    };
    RentalManagement.findOne = jest.fn().mockResolvedValue(existingRental);

    const res = await request(app)
      .put(`/api/rental-properties/${PROPERTY_ID}`)
      .set('Authorization', `Bearer ${makeToken(ADMIN_ID)}`)
      .send({ title: 'Appartement mis à jour', monthlyRent: '160000' });

    expect(res.statusCode).toBe(200);
    expect(RentalManagement.create).not.toHaveBeenCalled();
    expect(existingRental.save).toHaveBeenCalled();
    expect(existingRental.monthlyRent).toBe(160000);
    expect(property.title).toBe('Appartement mis à jour');
  });

  test("crée le RentalManagement s'il manque exceptionnellement (ancien Property sans fiche)", async () => {
    mockUserAuth(ADMIN_ID, 'Admin');
    Property.findById = jest.fn().mockResolvedValue(existingProperty());
    RentalManagement.findOne = jest.fn().mockResolvedValue(null);
    RentalManagement.create = jest.fn().mockResolvedValue({ _id: 'rental1' });

    const res = await request(app)
      .put(`/api/rental-properties/${PROPERTY_ID}`)
      .set('Authorization', `Bearer ${makeToken(ADMIN_ID)}`)
      .send({ monthlyRent: '160000' });

    expect(res.statusCode).toBe(200);
    expect(RentalManagement.create).toHaveBeenCalledTimes(1);
  });
});
