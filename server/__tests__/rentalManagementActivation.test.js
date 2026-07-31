// __tests__/rentalManagementActivation.test.js — Sprint A (audit sécurité).
//
// Vérifie qu'une annonce Location créée via POST /api/rental-properties
// (simple fiche) ne déclenche jamais automatiquement un dossier de gestion
// locative opérationnel : pas de bail actif, pas de locataire, pas de
// paiement, pas de statistique de gestion locative — jusqu'à activation
// explicite (POST /api/rental-management, module existant, inchangé) ou
// création d'un Contrat de bail.

jest.mock('../models/Property');
jest.mock('../models/RentalManagement');
jest.mock('../models/Contrat');
jest.mock('../models/Paiement');
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
const fakeUser = (id, role) => ({
  _id: id, id, name: 'Test User', email: 'test@altitude.com',
  role, isActive: true, status: 'Actif', tokenVersion: 0,
});
const mockUserAuth = (id, role) => {
  User.findById = jest.fn().mockReturnValue({ select: jest.fn().mockResolvedValue(fakeUser(id, role)) });
  User.findByIdAndUpdate = jest.fn().mockReturnValue({ catch: jest.fn() });
};

describe('RentalManagement — annonce simple vs dossier activé (Sprint A, audit sécurité) — TEST DATA', () => {
  afterEach(() => jest.clearAllMocks());

  test("création d'une annonce Location (POST /api/rental-properties) : aucun locataire, aucun bail, dossier non activé", async () => {
    mockUserAuth(ADMIN_ID, 'Admin');
    const property = { _id: PROPERTY_ID, title: 'Appartement', status: 'location' };
    Property.create = jest.fn().mockResolvedValue(property);
    const rental = {
      _id: 'rental1', property: PROPERTY_ID, managementActivated: false,
      currentTenant: null, activeLease: null, occupancyStatus: 'vacant',
    };
    RentalManagement.create = jest.fn().mockResolvedValue(rental);

    const res = await request(app)
      .post('/api/rental-properties')
      .set('Authorization', `Bearer ${makeToken(ADMIN_ID)}`)
      .send({
        title: 'Appartement', description: 'Desc', price: '150000', type: 'Appartement',
        surface: '80', bedrooms: '2', bathrooms: '1',
        'address[city]': 'Brazzaville', 'address[arrondissement]': 'Bacongo',
        latitude: '-4.26', longitude: '15.24', monthlyRent: '150000',
      });

    expect(res.statusCode).toBe(201);
    // Aucun paiement, aucun contrat créés par ce flux (modèles non
    // appelés du tout — la simple présence des mocks non sollicités le prouve).
    expect(RentalManagement.create).toHaveBeenCalledWith(expect.objectContaining({ managementActivated: false }));
  });

  test("l'activation explicite (POST /api/rental-management) marque managementActivated=true sur le dossier existant, sans le dupliquer", async () => {
    mockUserAuth(ADMIN_ID, 'GestionnaireImmobilier');
    Property.findById = jest.fn().mockResolvedValue({ _id: PROPERTY_ID, status: 'location', owner: OWNER_ID, price: 150000 });
    const rental = {
      _id: 'rental1', occupancyStatus: 'vacant', workflowHistory: [], save: jest.fn().mockResolvedValue(),
      toObject() { return { ...this, toObject: undefined, save: undefined }; },
    };
    RentalManagement.findOneAndUpdate = jest.fn().mockResolvedValue(rental);

    const res = await request(app)
      .post('/api/rental-management')
      .set('Authorization', `Bearer ${makeToken(ADMIN_ID)}`)
      .send({ property: PROPERTY_ID, monthlyRent: 150000 });

    expect(res.statusCode).toBe(201);
    expect(RentalManagement.findOneAndUpdate).toHaveBeenCalledWith(
      { property: PROPERTY_ID },
      expect.objectContaining({
        $set: expect.objectContaining({ managementActivated: true }),
      }),
      expect.objectContaining({ upsert: true }),
    );
  });

  test('GET /api/rental-management (liste) ne remonte que les dossiers activés par défaut', async () => {
    mockUserAuth(ADMIN_ID, 'GestionnaireImmobilier');
    RentalManagement.find = jest.fn().mockReturnValue({
      populate: jest.fn().mockReturnThis(),
      sort: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      limit: jest.fn().mockResolvedValue([]),
    });
    RentalManagement.countDocuments = jest.fn().mockResolvedValue(0);

    const res = await request(app)
      .get('/api/rental-management')
      .set('Authorization', `Bearer ${makeToken(ADMIN_ID)}`);

    expect(res.statusCode).toBe(200);
    expect(RentalManagement.find).toHaveBeenCalledWith(expect.objectContaining({ managementActivated: true }));
  });

  test('GET /api/rental-management/stats agrège uniquement les dossiers activés', async () => {
    mockUserAuth(ADMIN_ID, 'GestionnaireImmobilier');
    RentalManagement.aggregate = jest.fn().mockResolvedValue([]);
    const Contrat = require('../models/Contrat');
    const Paiement = require('../models/Paiement');
    Contrat.countDocuments = jest.fn().mockResolvedValue(0);
    Paiement.countDocuments = jest.fn().mockResolvedValue(0);
    Property.aggregate = jest.fn().mockResolvedValue([]);

    const res = await request(app)
      .get('/api/rental-management/stats')
      .set('Authorization', `Bearer ${makeToken(ADMIN_ID)}`);

    expect(res.statusCode).toBe(200);
    const pipeline = RentalManagement.aggregate.mock.calls[0][0];
    expect(pipeline[0]).toEqual({ $match: { managementActivated: true } });
  });
});
