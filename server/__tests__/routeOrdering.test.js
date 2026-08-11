// __tests__/routeOrdering.test.js — Contrôle final : audit des routes
// Hotel/Accommodation contre un faux 404 authentifié.
//
// Hypothèse investiguée : une route dynamique (/:id, /:id/:action,
// /:hotelId/room-categories…) intercepterait des routes statiques
// (/admin/list, /status/pending, /mine, /public, /public/:id) à cause de
// leur ordre de déclaration dans hotelRoutes.js / accommodationRoutes.js.
//
// Conclusion de l'audit (voir rapport) : AUCUNE capture constatée — dans les
// deux fichiers, toutes les routes statiques à 2 segments (/admin/list,
// /status/pending) sont déclarées AVANT tout paramètre dynamique à 1 segment
// (/:id), et Express (avec ou sans path-to-regexp v6) ne fait jamais
// correspondre un pattern à N segments à une URL à un nombre de segments
// différent — confirmé empiriquement (script isolé + suite ci-dessous) et
// par une relecture complète des deux fichiers. Ces tests figent ce
// comportement en régression permanente.

jest.mock('../models/Accommodation');
jest.mock('../models/RatePlan');
jest.mock('../models/Property');
jest.mock('../models/User');
jest.mock('../models/Hotel');
jest.mock('../models/RoomCategory');
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
}));
jest.mock('../services/platformTenant/tenantResourceAttributionService', () => ({
  assertResourceTenant: jest.fn().mockResolvedValue({ status: 'resolved', tenantId: '607f1f77bcf86cd799439001' }),
  resolveResourceTenant: jest.fn().mockResolvedValue({ status: 'resolved', tenantId: '607f1f77bcf86cd799439001' }),
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

const request = require('supertest');
const jwt = require('jsonwebtoken');
const { app } = require('../server');
const Accommodation = require('../models/Accommodation');
const RatePlan = require('../models/RatePlan');
const Hotel = require('../models/Hotel');
const RoomCategory = require('../models/RoomCategory');
const User = require('../models/User');
const SaleManagement = require('../models/SaleManagement');
const RentalManagement = require('../models/RentalManagement');

SaleManagement.findOne = jest.fn().mockResolvedValue(null);
RentalManagement.findOne = jest.fn().mockResolvedValue(null);
Accommodation.ACCOMMODATION_TYPES = ['villa_meublee', 'hotel'];
Accommodation.HOTEL_ACCOMMODATION_TYPES = ['hotel'];
RatePlan.RATE_MODES = ['nightly', 'weekly', 'monthly', 'yearly'];
RatePlan.RATE_TYPES = ['public', 'entreprise', 'weekend', 'promotion', 'haute_saison'];

const ADMIN_ID = '507f1f77bcf86cd799439012';
const OWNER_ID = '507f1f77bcf86cd799439011';
const NONEXISTENT_ID = '65f1f77bcf86cd799439abc'.padStart(24, '0'); // 24 caractères hex, syntaxiquement valide, introuvable en base

const makeToken = (id) => jwt.sign({ id, tokenVersion: 0 }, process.env.JWT_SECRET, { expiresIn: '1d' });
const fakeUser = (id, role) => ({
  _id: id, id, name: 'Test User', email: 'test@altitude.com',
  role, isActive: true, status: 'Actif', tokenVersion: 0,
});
const mockUserAuth = (id, role) => {
  User.findById = jest.fn().mockReturnValue({ select: jest.fn().mockResolvedValue(fakeUser(id, role)) });
  User.findByIdAndUpdate = jest.fn().mockReturnValue({ catch: jest.fn() });
};

describe("Contrôle final — routage Hotel/Accommodation : aucune route dynamique ne capture les routes statiques", () => {
  afterEach(() => jest.clearAllMocks());

  test('GET /api/hotels/admin/list (authentifié, staff) appelle bien listAdmin — jamais interprété comme /:id', async () => {
    mockUserAuth(ADMIN_ID, 'Admin');
    Hotel.find = jest.fn().mockReturnValue({ populate: jest.fn().mockReturnValue({ sort: jest.fn().mockResolvedValue([]) }) });
    RoomCategory.find = jest.fn().mockResolvedValue([]);

    const res = await request(app)
      .get('/api/hotels/admin/list')
      .set('Authorization', `Bearer ${makeToken(ADMIN_ID)}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.data).toHaveProperty('hotels');
    expect(res.body.data).toHaveProperty('total');
    // Si /:id avait capturé "admin" comme id, getOne aurait renvoyé
    // { data: { hotel, completion } } et jamais { hotels, total }.
    expect(res.body.data).not.toHaveProperty('hotel');
  });

  test('GET /api/hotels/status/pending (authentifié, staff) appelle bien pending — jamais interprété comme /:id', async () => {
    mockUserAuth(ADMIN_ID, 'Admin');
    Hotel.find = jest.fn().mockReturnValue({ populate: jest.fn().mockReturnValue({ sort: jest.fn().mockResolvedValue([]) }) });
    RoomCategory.find = jest.fn().mockResolvedValue([]);

    const res = await request(app)
      .get('/api/hotels/status/pending')
      .set('Authorization', `Bearer ${makeToken(ADMIN_ID)}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.data).toHaveProperty('hotels');
  });

  test('GET /api/accommodations/admin/list (authentifié, staff) appelle bien listAdmin — jamais interprété comme /:id', async () => {
    mockUserAuth(ADMIN_ID, 'Admin');
    Accommodation.find = jest.fn().mockReturnValue({ populate: jest.fn().mockReturnValue({ sort: jest.fn().mockResolvedValue([]) }) });

    const res = await request(app)
      .get('/api/accommodations/admin/list')
      .set('Authorization', `Bearer ${makeToken(ADMIN_ID)}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.data).toHaveProperty('accommodations');
    expect(res.body.data).toHaveProperty('total');
    expect(res.body.data).not.toHaveProperty('accommodation');
  });

  test("GET /api/hotels/mine (authentifié, propriétaire) appelle bien mine — jamais interprété comme /:id", async () => {
    mockUserAuth(OWNER_ID, 'Proprietaire');
    Hotel.find = jest.fn().mockReturnValue({ populate: jest.fn().mockReturnValue({ sort: jest.fn().mockResolvedValue([]) }) });
    const res = await request(app)
      .get('/api/hotels/mine')
      .set('Authorization', `Bearer ${makeToken(OWNER_ID)}`);
    expect(res.statusCode).toBe(200);
    expect(res.body.data).toHaveProperty('hotels');
  });

  test('GET /api/hotels/public (public, sans jeton) reste accessible — jamais interprété comme /:id', async () => {
    Hotel.find = jest.fn().mockReturnValue({
      select: jest.fn().mockReturnValue({ populate: jest.fn().mockReturnValue({ sort: jest.fn().mockResolvedValue([]) }) }),
    });
    const res = await request(app).get('/api/hotels/public');
    expect(res.statusCode).toBe(200);
  });

  test('404 — GET /api/hotels/:id avec un ObjectId syntaxiquement valide mais introuvable renvoie bien 404 (le vrai endpoint /:id, pas une capture)', async () => {
    mockUserAuth(ADMIN_ID, 'Admin');
    Hotel.findById = jest.fn().mockReturnValue({ populate: jest.fn().mockResolvedValue(null) });
    const res = await request(app)
      .get(`/api/hotels/${NONEXISTENT_ID}`)
      .set('Authorization', `Bearer ${makeToken(ADMIN_ID)}`);
    expect(res.statusCode).toBe(404);
  });

  test('404 — GET /api/accommodations/:id avec un ObjectId syntaxiquement valide mais introuvable renvoie bien 404', async () => {
    mockUserAuth(ADMIN_ID, 'Admin');
    Accommodation.findById = jest.fn().mockReturnValue({ populate: jest.fn().mockResolvedValue(null) });
    const res = await request(app)
      .get(`/api/accommodations/${NONEXISTENT_ID}`)
      .set('Authorization', `Bearer ${makeToken(ADMIN_ID)}`);
    expect(res.statusCode).toBe(404);
  });

  test("401 sans jeton sur /api/hotels/admin/list (confirme que la route est bien montée et atteint le middleware d'auth)", async () => {
    const res = await request(app).get('/api/hotels/admin/list');
    expect(res.statusCode).toBe(401);
  });

  test("401 sans jeton sur /api/accommodations/admin/list", async () => {
    const res = await request(app).get('/api/accommodations/admin/list');
    expect(res.statusCode).toBe(401);
  });

});
