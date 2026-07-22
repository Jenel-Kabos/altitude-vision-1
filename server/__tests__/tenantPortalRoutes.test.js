// __tests__/tenantPortalRoutes.test.js — Dette technique GL-B2 (Missions 2, 3, 8)
// Sécurité HTTP du portail locataire + rattachement User ↔ Locataire.
// Couvre explicitement le scénario demandé par la mission : tentative
// d'accès au dossier d'un AUTRE locataire → 403/404 (jamais de fuite).

jest.mock('../models/Locataire');
jest.mock('../models/TenantLinkRequest');
jest.mock('../models/Contrat');
jest.mock('../models/Paiement');
jest.mock('../models/RentalManagement');
jest.mock('../models/RentalMaintenanceTicket');
jest.mock('../models/User');
jest.mock('../services/emailService', () => ({ sendEmailViaZoho: jest.fn().mockResolvedValue({}) }));
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
const Locataire = require('../models/Locataire');
const TenantLinkRequest = require('../models/TenantLinkRequest');
const Contrat = require('../models/Contrat');
const User = require('../models/User');

const TENANT_USER_ID = '507f1f77bcf86cd799439011';
const OTHER_TENANT_USER_ID = '507f1f77bcf86cd799439099';
const STAFF_ID = '507f1f77bcf86cd799439012';
const OWNER_ID = '507f1f77bcf86cd799439021';
const CLIENT_NO_DOSSIER_ID = '507f1f77bcf86cd799439033';
const LOCATAIRE_ID = 'a07f1f77bcf86cd799439088';
const OTHER_LOCATAIRE_ID = 'a07f1f77bcf86cd799439077';

const makeToken = (id) => jwt.sign({ id, tokenVersion: 0 }, process.env.JWT_SECRET, { expiresIn: '1d' });
const fakeUser = (id, role) => ({ _id: id, id, name: 'Test User', email: 't@a.com', role, isActive: true, status: 'Actif', tokenVersion: 0 });
const mockUserAuth = (id, role) => {
  User.findById = jest.fn().mockReturnValue({ select: jest.fn().mockResolvedValue(fakeUser(id, role)) });
  User.findByIdAndUpdate = jest.fn().mockReturnValue({ catch: jest.fn() });
};

describe('GET /api/tenant-portal/me — résolution stricte via req.user (Mission 1/8)', () => {
  afterEach(() => jest.clearAllMocks());

  test('200 — le locataire rattaché récupère SON dossier', async () => {
    mockUserAuth(TENANT_USER_ID, 'Client');
    Locataire.findOne = jest.fn().mockResolvedValue({ _id: LOCATAIRE_ID, user: TENANT_USER_ID, nom: 'Dupont', prenom: 'Jean', toObject() { return this; } });
    const res = await request(app).get('/api/tenant-portal/me').set('Authorization', `Bearer ${makeToken(TENANT_USER_ID)}`);
    expect(res.statusCode).toBe(200);
    expect(Locataire.findOne).toHaveBeenCalledWith({ user: TENANT_USER_ID });
  });

  test("404 — un compte sans dossier locataire rattaché (Client 'normal', prospect) n'obtient rien", async () => {
    mockUserAuth(CLIENT_NO_DOSSIER_ID, 'Client');
    Locataire.findOne = jest.fn().mockResolvedValue(null);
    const res = await request(app).get('/api/tenant-portal/me').set('Authorization', `Bearer ${makeToken(CLIENT_NO_DOSSIER_ID)}`);
    expect(res.statusCode).toBe(404);
  });

  test("sécurité — impossible d'accéder au dossier d'un AUTRE locataire (aucun paramètre d'URL n'accepte de locataireId)", async () => {
    mockUserAuth(OTHER_TENANT_USER_ID, 'Client');
    // Même si un tiers connaissait l'ID d'un autre locataire, aucune route
    // du portail n'accepte de locataireId — la résolution est UNIQUEMENT
    // {user: req.user.id}. On simule ici qu'aucun dossier n'est rattaché à
    // ce compte tiers : il ne peut jamais voir le dossier LOCATAIRE_ID.
    Locataire.findOne = jest.fn().mockResolvedValue(null);
    const res = await request(app).get('/api/tenant-portal/me').set('Authorization', `Bearer ${makeToken(OTHER_TENANT_USER_ID)}`);
    expect(res.statusCode).toBe(404);
    expect(Locataire.findOne).toHaveBeenCalledWith({ user: OTHER_TENANT_USER_ID });
    expect(Locataire.findOne).not.toHaveBeenCalledWith(expect.objectContaining({ _id: LOCATAIRE_ID }));
  });

  test('401 sans jeton', async () => {
    const res = await request(app).get('/api/tenant-portal/me');
    expect(res.statusCode).toBe(401);
  });
});

describe('POST /api/tenant-portal/maintenance — jamais de propertyId/leaseId confiés au client (Mission 2/8)', () => {
  afterEach(() => jest.clearAllMocks());

  test("201 — crée une demande, propertyId/leaseId ignorés du body même s'ils sont fournis", async () => {
    mockUserAuth(TENANT_USER_ID, 'Client');
    Locataire.findOne = jest.fn().mockResolvedValue({ _id: LOCATAIRE_ID, user: TENANT_USER_ID });
    Contrat.find = jest.fn().mockReturnValue({
      sort: jest.fn().mockReturnThis(),
      populate: jest.fn().mockResolvedValue([{ _id: 'LEASE-1', statut: 'actif', bien: { _id: 'PROP-1', owner: 'OWNER-1' } }]),
    });
    const RentalMaintenanceTicket = require('../models/RentalMaintenanceTicket');
    RentalMaintenanceTicket.RENTAL_MAINTENANCE_CATEGORIES = ['plomberie'];
    RentalMaintenanceTicket.create = jest.fn().mockResolvedValue({ _id: 'TICKET-1', property: 'PROP-1' });

    const res = await request(app).post('/api/tenant-portal/maintenance').set('Authorization', `Bearer ${makeToken(TENANT_USER_ID)}`)
      .send({ category: 'plomberie', description: 'Fuite', propertyId: 'PROP-MALVEILLANT', leaseId: 'LEASE-MALVEILLANT' });
    expect(res.statusCode).toBe(201);
    expect(RentalMaintenanceTicket.create).toHaveBeenCalledWith(expect.objectContaining({ property: 'PROP-1', lease: 'LEASE-1' }));
  });

  test('404 — sans dossier locataire rattaché', async () => {
    mockUserAuth(CLIENT_NO_DOSSIER_ID, 'Client');
    Locataire.findOne = jest.fn().mockResolvedValue(null);
    const res = await request(app).post('/api/tenant-portal/maintenance').set('Authorization', `Bearer ${makeToken(CLIENT_NO_DOSSIER_ID)}`)
      .send({ category: 'plomberie', description: 'x' });
    expect(res.statusCode).toBe(404);
  });
});

describe('POST /api/tenant-portal/activate — activation d\'invitation (Mission 3/8)', () => {
  afterEach(() => jest.clearAllMocks());

  test('200 — active avec un token valide', async () => {
    mockUserAuth(TENANT_USER_ID, 'Client');
    const crypto = require('crypto');
    const rawToken = 'valid-raw-token';
    TenantLinkRequest.findOne = jest.fn().mockResolvedValue({
      _id: 'c07f1f77bcf86cd799439066', status: 'pending', locataire: LOCATAIRE_ID, tokenHash: crypto.createHash('sha256').update(rawToken).digest('hex'),
      tokenExpiresAt: new Date(Date.now() + 86400000), save: jest.fn().mockResolvedValue(),
    });
    Locataire.findOne = jest.fn().mockResolvedValue(null);
    Locataire.findOneAndUpdate = jest.fn().mockResolvedValue({ _id: LOCATAIRE_ID, user: TENANT_USER_ID, nom: 'Dupont', prenom: 'Jean' });

    const res = await request(app).post('/api/tenant-portal/activate').set('Authorization', `Bearer ${makeToken(TENANT_USER_ID)}`).send({ token: rawToken });
    expect(res.statusCode).toBe(200);
  });

  test('404 — jeton invalide/inconnu', async () => {
    mockUserAuth(TENANT_USER_ID, 'Client');
    TenantLinkRequest.findOne = jest.fn().mockResolvedValue(null);
    const res = await request(app).post('/api/tenant-portal/activate').set('Authorization', `Bearer ${makeToken(TENANT_USER_ID)}`).send({ token: 'invalid' });
    expect(res.statusCode).toBe(404);
  });

  test('401 sans jeton d\'authentification', async () => {
    const res = await request(app).post('/api/tenant-portal/activate').send({ token: 'x' });
    expect(res.statusCode).toBe(401);
  });
});

describe('POST /api/locataires/:id/invite + rattachement — permissions staff (Mission 3/8)', () => {
  afterEach(() => jest.clearAllMocks());

  test('403 — un client ne peut jamais inviter un locataire', async () => {
    mockUserAuth(CLIENT_NO_DOSSIER_ID, 'Client');
    const res = await request(app).post(`/api/locataires/${LOCATAIRE_ID}/invite`).set('Authorization', `Bearer ${makeToken(CLIENT_NO_DOSSIER_ID)}`);
    expect(res.statusCode).toBe(403);
  });

  test('403 — un propriétaire ne peut pas inviter un locataire (réservé STAFF_IMMO)', async () => {
    mockUserAuth(OWNER_ID, 'Proprietaire');
    const res = await request(app).post(`/api/locataires/${LOCATAIRE_ID}/invite`).set('Authorization', `Bearer ${makeToken(OWNER_ID)}`);
    expect(res.statusCode).toBe(403);
  });

  test('201 — le staff (GestionnaireImmobilier) invite un locataire non rattaché', async () => {
    mockUserAuth(STAFF_ID, 'GestionnaireImmobilier');
    Locataire.findById = jest.fn().mockResolvedValue({ _id: LOCATAIRE_ID, user: null, email: null, prenom: 'Jean', nom: 'Dupont' });
    TenantLinkRequest.create = jest.fn().mockResolvedValue({ _id: 'c07f1f77bcf86cd799439066', status: 'pending', tokenExpiresAt: new Date() });
    const res = await request(app).post(`/api/locataires/${LOCATAIRE_ID}/invite`).set('Authorization', `Bearer ${makeToken(STAFF_ID)}`);
    expect(res.statusCode).toBe(201);
  });

  test('409 — impossible d\'inviter un locataire déjà rattaché', async () => {
    mockUserAuth(STAFF_ID, 'Admin');
    Locataire.findById = jest.fn().mockResolvedValue({ _id: LOCATAIRE_ID, user: TENANT_USER_ID });
    const res = await request(app).post(`/api/locataires/${LOCATAIRE_ID}/invite`).set('Authorization', `Bearer ${makeToken(STAFF_ID)}`);
    expect(res.statusCode).toBe(409);
  });

  test('200 — le staff approuve une demande de rattachement (self_request)', async () => {
    mockUserAuth(STAFF_ID, 'Admin');
    TenantLinkRequest.findById = jest.fn().mockResolvedValue({
      _id: 'c07f1f77bcf86cd799439066', type: 'self_request', status: 'pending', locataire: LOCATAIRE_ID, user: TENANT_USER_ID, save: jest.fn().mockResolvedValue(),
    });
    Locataire.findOneAndUpdate = jest.fn().mockResolvedValue({ _id: LOCATAIRE_ID, user: TENANT_USER_ID });
    const res = await request(app).patch('/api/locataires/link-requests/c07f1f77bcf86cd799439066/review').set('Authorization', `Bearer ${makeToken(STAFF_ID)}`).send({ decision: 'approved' });
    expect(res.statusCode).toBe(200);
  });

  test("403 — un client ne peut pas approuver une demande de rattachement (validation OBLIGATOIRE par le staff)", async () => {
    mockUserAuth(CLIENT_NO_DOSSIER_ID, 'Client');
    const res = await request(app).patch('/api/locataires/link-requests/c07f1f77bcf86cd799439066/review').set('Authorization', `Bearer ${makeToken(CLIENT_NO_DOSSIER_ID)}`).send({ decision: 'approved' });
    expect(res.statusCode).toBe(403);
  });

  test('401 sans jeton sur les routes de rattachement', async () => {
    const res = await request(app).get('/api/locataires/link-requests');
    expect(res.statusCode).toBe(401);
  });
});

describe('POST /api/tenant-portal/request-link — Cas 2, validation obligatoire (Mission 3/8)', () => {
  afterEach(() => jest.clearAllMocks());

  test('201 — le locataire crée une demande de rattachement (statut pending, jamais rattaché immédiatement)', async () => {
    mockUserAuth(TENANT_USER_ID, 'Client');
    Locataire.findById = jest.fn().mockResolvedValue({ _id: LOCATAIRE_ID, user: null });
    Locataire.findOne = jest.fn().mockResolvedValue(null);
    TenantLinkRequest.create = jest.fn().mockResolvedValue({ _id: 'c07f1f77bcf86cd799439066', status: 'pending' });
    const res = await request(app).post('/api/tenant-portal/request-link').set('Authorization', `Bearer ${makeToken(TENANT_USER_ID)}`).send({ locataireId: LOCATAIRE_ID });
    expect(res.statusCode).toBe(201);
    expect(res.body.data.request.status).toBe('pending');
  });

  test("409 — refuse si le dossier ciblé (LOCATAIRE_ID) est déjà rattaché à un autre compte (protège contre l'usurpation)", async () => {
    mockUserAuth(OTHER_TENANT_USER_ID, 'Client');
    Locataire.findById = jest.fn().mockResolvedValue({ _id: OTHER_LOCATAIRE_ID, user: TENANT_USER_ID });
    const res = await request(app).post('/api/tenant-portal/request-link').set('Authorization', `Bearer ${makeToken(OTHER_TENANT_USER_ID)}`).send({ locataireId: OTHER_LOCATAIRE_ID });
    expect(res.statusCode).toBe(409);
  });
});
