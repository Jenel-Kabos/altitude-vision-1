// __tests__/rentalMaintenanceRoutes.test.js — Sprint GL-B2
// Sécurité et routage HTTP de /api/rental-maintenance (distinct de
// /api/maintenance, hôtelier — Sprint E) + actions préavis sur
// /api/rental-management (acknowledge-notice/cancel-notice).

jest.mock('../models/Property');
jest.mock('../models/RentalMaintenanceTicket');
jest.mock('../models/RentalManagement');
jest.mock('../models/Contrat');
jest.mock('../models/Paiement');
jest.mock('../models/User');
jest.mock('../services/rentalMaintenanceService');
jest.mock('../services/rentalListingSyncService');
// TENANT-CERT-2 — les routes `:id` de rentalManagementRoutes.js vérifient
// désormais la frontière tenant via ces services (voir
// __tests__/tenantCert2.adversarial.mongo.integration.test.js pour la
// vérification réelle) ; mockés ici pour rester indépendant d'une vraie
// connexion Mongo dans ce test unitaire (modèles déjà mockés ci-dessus).
jest.mock('../services/platformTenant/tenantContextService', () => ({
  resolveEffectiveTenantContext: jest.fn().mockResolvedValue({ tenant: { _id: '607f1f77bcf86cd799439001', rootOrgUnit: '607f1f77bcf86cd799439001' }, source: 'single_membership' }),
  resolveTenantForUser: jest.fn().mockResolvedValue({ _id: '607f1f77bcf86cd799439001', rootOrgUnit: '607f1f77bcf86cd799439001' }),
  resolveRootOrgUnitId: jest.fn().mockResolvedValue('607f1f77bcf86cd799439001'),
  resolveAvailableTenantsForUser: jest.fn().mockResolvedValue([{ _id: '607f1f77bcf86cd799439001' }]),
  resolveTenantScope: jest.fn().mockResolvedValue({ scopeUserIds: new Set() }),
}));
jest.mock('../services/platformTenant/tenantResourceAttributionService', () => ({
  assertResourceTenant: jest.fn().mockResolvedValue({ status: 'resolved', tenantId: '607f1f77bcf86cd799439001' }),
  assertResourceTenantOrUnattributed: jest.fn().mockResolvedValue({ status: 'resolved', tenantId: '607f1f77bcf86cd799439001' }),
  resolveResourceTenant: jest.fn().mockResolvedValue({ status: 'resolved', tenantId: '607f1f77bcf86cd799439001' }),
}));
jest.mock('../config/db', () => jest.fn());
jest.mock('node-cron', () => ({ schedule: jest.fn() }));
jest.mock('../scripts/sync-facebook', () => ({ syncFacebook: jest.fn() }));
jest.mock('../services/zohoImapService', () => ({ pollZohoInbox: jest.fn() }));
jest.mock('../services/alerteService', () => ({ verifierPaiementsEnRetard: jest.fn() }));
jest.mock('../utils/generateSitemap', () => jest.fn().mockResolvedValue('<xml/>'));
jest.mock('../services/notificationService', () => ({
  notify: jest.fn().mockResolvedValue(), notifyStaff: jest.fn().mockResolvedValue(), notifyMany: jest.fn().mockResolvedValue(),
}));
jest.mock('../config/cloudinary', () => ({
  ...jest.requireActual('../config/cloudinary'),
  destroyFromCloudinary: jest.fn().mockResolvedValue(),
}));

const request = require('supertest');
const jwt = require('jsonwebtoken');
const { app } = require('../server');
const Property = require('../models/Property');
const RentalMaintenanceTicket = require('../models/RentalMaintenanceTicket');
const RentalManagement = require('../models/RentalManagement');
const User = require('../models/User');
const rentalMaintenanceService = require('../services/rentalMaintenanceService');
const sync = require('../services/rentalListingSyncService');

RentalMaintenanceTicket.RENTAL_MAINTENANCE_CATEGORIES = ['plomberie', 'electricite', 'structure', 'equipement', 'nuisible', 'serrurerie', 'peinture', 'autre'];

const OWNER_ID = '507f1f77bcf86cd799439011';
const OTHER_OWNER_ID = '507f1f77bcf86cd799439099';
const ADMIN_ID = '507f1f77bcf86cd799439012';
const CLIENT_ID = '507f1f77bcf86cd799439033';
const PROPERTY_ID = '707f1f77bcf86cd799439055';
const TICKET_ID = 'b07f1f77bcf86cd799439077';
const RENTAL_ID = 'c07f1f77bcf86cd799439066';

const makeToken = (id) => jwt.sign({ id, tokenVersion: 0 }, process.env.JWT_SECRET, { expiresIn: '1d' });
const fakeUser = (id, role) => ({ _id: id, id, name: 'Test User', email: 't@a.com', role, isActive: true, status: 'Actif', tokenVersion: 0 });
const mockUserAuth = (id, role) => {
  User.findById = jest.fn().mockReturnValue({ select: jest.fn().mockResolvedValue(fakeUser(id, role)) });
  User.findByIdAndUpdate = jest.fn().mockReturnValue({ catch: jest.fn() });
};

describe('POST /api/rental-maintenance — création (Sprint GL-B2)', () => {
  afterEach(() => jest.clearAllMocks());

  test("403 — un propriétaire tiers ne peut pas créer de ticket sur un bien qui n'est pas le sien", async () => {
    mockUserAuth(OTHER_OWNER_ID, 'Proprietaire');
    Property.findById = jest.fn().mockResolvedValue({ _id: PROPERTY_ID, owner: OWNER_ID, title: 'Appartement' });
    const res = await request(app).post('/api/rental-maintenance').set('Authorization', `Bearer ${makeToken(OTHER_OWNER_ID)}`)
      .send({ propertyId: PROPERTY_ID, category: 'plomberie', description: 'Fuite' });
    expect(res.statusCode).toBe(403);
  });

  test('403 — un client ne peut jamais créer de ticket de maintenance locative', async () => {
    mockUserAuth(CLIENT_ID, 'Client');
    Property.findById = jest.fn().mockResolvedValue({ _id: PROPERTY_ID, owner: OWNER_ID, title: 'Appartement' });
    const res = await request(app).post('/api/rental-maintenance').set('Authorization', `Bearer ${makeToken(CLIENT_ID)}`)
      .send({ propertyId: PROPERTY_ID, category: 'plomberie', description: 'Fuite' });
    expect(res.statusCode).toBe(403);
    expect(rentalMaintenanceService.createTicket).not.toHaveBeenCalled();
  });

  test('201 — le propriétaire crée un ticket pour son propre bien', async () => {
    mockUserAuth(OWNER_ID, 'Proprietaire');
    Property.findById = jest.fn().mockResolvedValue({ _id: PROPERTY_ID, owner: OWNER_ID, title: 'Appartement' });
    rentalMaintenanceService.createTicket.mockResolvedValue({ _id: TICKET_ID, status: 'ouvert' });
    const res = await request(app).post('/api/rental-maintenance').set('Authorization', `Bearer ${makeToken(OWNER_ID)}`)
      .send({ propertyId: PROPERTY_ID, category: 'plomberie', description: 'Fuite au lavabo' });
    expect(res.statusCode).toBe(201);
  });

  test('201 — le staff (ROLES_GL) crée un ticket même sans être propriétaire', async () => {
    mockUserAuth(ADMIN_ID, 'Admin');
    Property.findById = jest.fn().mockResolvedValue({ _id: PROPERTY_ID, owner: OWNER_ID, title: 'Appartement' });
    rentalMaintenanceService.createTicket.mockResolvedValue({ _id: TICKET_ID, status: 'ouvert' });
    const res = await request(app).post('/api/rental-maintenance').set('Authorization', `Bearer ${makeToken(ADMIN_ID)}`)
      .send({ propertyId: PROPERTY_ID, category: 'electricite', description: 'Court-circuit' });
    expect(res.statusCode).toBe(201);
  });

  test('422 — catégorie invalide', async () => {
    mockUserAuth(OWNER_ID, 'Proprietaire');
    Property.findById = jest.fn().mockResolvedValue({ _id: PROPERTY_ID, owner: OWNER_ID, title: 'Appartement' });
    const res = await request(app).post('/api/rental-maintenance').set('Authorization', `Bearer ${makeToken(OWNER_ID)}`)
      .send({ propertyId: PROPERTY_ID, category: 'inconnu', description: 'x' });
    expect(res.statusCode).toBe(422);
  });

  test('422 — description manquante', async () => {
    mockUserAuth(OWNER_ID, 'Proprietaire');
    Property.findById = jest.fn().mockResolvedValue({ _id: PROPERTY_ID, owner: OWNER_ID, title: 'Appartement' });
    const res = await request(app).post('/api/rental-maintenance').set('Authorization', `Bearer ${makeToken(OWNER_ID)}`)
      .send({ propertyId: PROPERTY_ID, category: 'plomberie' });
    expect(res.statusCode).toBe(422);
  });

  test('401 sans jeton', async () => {
    const res = await request(app).post('/api/rental-maintenance').send({ propertyId: PROPERTY_ID, category: 'plomberie', description: 'x' });
    expect(res.statusCode).toBe(401);
  });
});

describe('GET /api/rental-maintenance — liste scopée propriétaire (Sprint GL-B2)', () => {
  afterEach(() => jest.clearAllMocks());

  test("200 — le propriétaire ne voit que les tickets de ses propres biens (scope automatique sans propertyId)", async () => {
    mockUserAuth(OWNER_ID, 'Proprietaire');
    Property.find = jest.fn().mockReturnValue({ select: jest.fn().mockResolvedValue([{ _id: PROPERTY_ID }]) });
    RentalMaintenanceTicket.find = jest.fn().mockReturnValue({
      populate: jest.fn().mockReturnThis(), sort: jest.fn().mockResolvedValue([]),
    });
    const res = await request(app).get('/api/rental-maintenance').set('Authorization', `Bearer ${makeToken(OWNER_ID)}`);
    expect(res.statusCode).toBe(200);
    expect(RentalMaintenanceTicket.find).toHaveBeenCalledWith(expect.objectContaining({ property: { $in: [PROPERTY_ID] } }));
  });
});

describe('PATCH /api/rental-maintenance/:id/assign|schedule|start|resolve|close (Sprint GL-B2)', () => {
  afterEach(() => jest.clearAllMocks());

  test("403 — un propriétaire tiers ne peut pas gérer un ticket sur un bien qui n'est pas le sien", async () => {
    mockUserAuth(OTHER_OWNER_ID, 'Proprietaire');
    RentalMaintenanceTicket.findById = jest.fn().mockResolvedValue({ _id: TICKET_ID, property: PROPERTY_ID });
    Property.findById = jest.fn().mockResolvedValue({ _id: PROPERTY_ID, owner: OWNER_ID });
    const res = await request(app).patch(`/api/rental-maintenance/${TICKET_ID}/start`).set('Authorization', `Bearer ${makeToken(OTHER_OWNER_ID)}`);
    expect(res.statusCode).toBe(403);
  });

  test('200 — le propriétaire assigne un technicien', async () => {
    mockUserAuth(OWNER_ID, 'Proprietaire');
    RentalMaintenanceTicket.findById = jest.fn().mockResolvedValue({ _id: TICKET_ID, property: PROPERTY_ID });
    Property.findById = jest.fn().mockResolvedValue({ _id: PROPERTY_ID, owner: OWNER_ID });
    rentalMaintenanceService.assignTicket.mockResolvedValue({ _id: TICKET_ID, status: 'assigne' });
    const res = await request(app).patch(`/api/rental-maintenance/${TICKET_ID}/assign`).set('Authorization', `Bearer ${makeToken(OWNER_ID)}`)
      .send({ assignedToUserId: 'a07f1f77bcf86cd799439001' });
    expect(res.statusCode).toBe(200);
  });

  test('200 — le staff résout un ticket avec un coût réel', async () => {
    mockUserAuth(ADMIN_ID, 'Admin');
    RentalMaintenanceTicket.findById = jest.fn().mockResolvedValue({ _id: TICKET_ID, property: PROPERTY_ID });
    Property.findById = jest.fn().mockResolvedValue({ _id: PROPERTY_ID, owner: OWNER_ID });
    rentalMaintenanceService.resolveTicket.mockResolvedValue({ _id: TICKET_ID, status: 'resolu', actualCost: 12000 });
    const res = await request(app).patch(`/api/rental-maintenance/${TICKET_ID}/resolve`).set('Authorization', `Bearer ${makeToken(ADMIN_ID)}`).send({ actualCost: 12000 });
    expect(res.statusCode).toBe(200);
    expect(res.body.data.ticket.actualCost).toBe(12000);
  });

  test('409 — transition invalide remontée par le service', async () => {
    mockUserAuth(OWNER_ID, 'Proprietaire');
    RentalMaintenanceTicket.findById = jest.fn().mockResolvedValue({ _id: TICKET_ID, property: PROPERTY_ID });
    Property.findById = jest.fn().mockResolvedValue({ _id: PROPERTY_ID, owner: OWNER_ID });
    const err = new Error('Transition invalide : ouvert → cloture.'); err.statusCode = 409;
    rentalMaintenanceService.closeTicket.mockRejectedValue(err);
    const res = await request(app).patch(`/api/rental-maintenance/${TICKET_ID}/close`).set('Authorization', `Bearer ${makeToken(OWNER_ID)}`);
    expect(res.statusCode).toBe(409);
  });

  test('401 sans jeton', async () => {
    const res = await request(app).patch(`/api/rental-maintenance/${TICKET_ID}/start`);
    expect(res.statusCode).toBe(401);
  });
});

describe('POST /api/rental-management/:id/acknowledge-notice|cancel-notice (Sprint GL-B2)', () => {
  afterEach(() => jest.clearAllMocks());
  // TENANT-CERT-2 — router.param('id', …) de rentalManagementRoutes.js
  // charge désormais le dossier avant tout contrôleur (voir le fichier de
  // routes) : sans ce mock, RentalManagement.findById(...).select(...)
  // échoue sur l'automock par défaut (undefined).
  beforeEach(() => {
    RentalManagement.findById = jest.fn().mockResolvedValue({ _id: RENTAL_ID, property: PROPERTY_ID, owner: OWNER_ID });
  });

  test('200 — le staff (ROLES_GL) accuse réception du préavis', async () => {
    mockUserAuth(ADMIN_ID, 'Admin');
    sync.acknowledgeNotice.mockResolvedValue({ management: { toObject: () => ({ _id: RENTAL_ID, occupancyStatus: 'sortie_programmee' }) } });
    sync.serializeRentalManagement = jest.fn().mockReturnValue({ _id: RENTAL_ID, occupancyStatus: 'sortie_programmee' });
    const res = await request(app).post(`/api/rental-management/${RENTAL_ID}/acknowledge-notice`).set('Authorization', `Bearer ${makeToken(ADMIN_ID)}`);
    expect(res.statusCode).toBe(200);
  });

  test('200 — le staff annule un préavis en cours', async () => {
    mockUserAuth(ADMIN_ID, 'Admin');
    sync.cancelNotice.mockResolvedValue({ management: { toObject: () => ({ _id: RENTAL_ID, occupancyStatus: 'occupe' }) } });
    sync.serializeRentalManagement = jest.fn().mockReturnValue({ _id: RENTAL_ID, occupancyStatus: 'occupe' });
    const res = await request(app).post(`/api/rental-management/${RENTAL_ID}/cancel-notice`).set('Authorization', `Bearer ${makeToken(ADMIN_ID)}`).send({ comment: 'Reste finalement' });
    expect(res.statusCode).toBe(200);
    expect(res.body.data.rental.occupancyStatus).toBe('occupe');
  });

  test("403 — un propriétaire (rôle Proprietaire) n'a pas accès aux actions staff de gestion locative", async () => {
    mockUserAuth(OWNER_ID, 'Proprietaire');
    const res = await request(app).post(`/api/rental-management/${RENTAL_ID}/acknowledge-notice`).set('Authorization', `Bearer ${makeToken(OWNER_ID)}`);
    expect(res.statusCode).toBe(403);
  });

  test('409 — aucun préavis en cours (remonté par le service)', async () => {
    mockUserAuth(ADMIN_ID, 'Admin');
    const err = new Error('Aucun préavis en cours pour ce dossier.'); err.statusCode = 409;
    sync.cancelNotice.mockRejectedValue(err);
    const res = await request(app).post(`/api/rental-management/${RENTAL_ID}/cancel-notice`).set('Authorization', `Bearer ${makeToken(ADMIN_ID)}`);
    expect(res.statusCode).toBe(409);
  });

  test('401 sans jeton', async () => {
    const res = await request(app).post(`/api/rental-management/${RENTAL_ID}/acknowledge-notice`);
    expect(res.statusCode).toBe(401);
  });
});
