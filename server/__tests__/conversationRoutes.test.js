// __tests__/conversationRoutes.test.js
// Tests d'intégration des routes de messagerie (conversations)

jest.mock('../models/User');
jest.mock('../models/Conversation');
jest.mock('../models/Message');
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
// POST-E2E-2 — sans ce mock, `attachTenantContext` (conversationRoutes.js)
// déclenche de vraies requêtes Mongoose (OrgMembership/PlatformTenant) contre
// une DB inexistante en test unitaire (`config/db` mocké), provoquant un
// timeout ~20s avant repli silencieux sur `null` — jamais un bug de
// production, un angle mort de mock. Un client ordinaire n'a structurellement
// aucun tenant propre (voir POST_E2E1_REPORT.md §9) : `tenant: null` est donc
// la valeur réaliste par défaut ici.
jest.mock('../services/platformTenant/tenantContextService', () => ({
  resolveAvailableTenantsForUser: jest.fn().mockResolvedValue([]),
  resolveEffectiveTenantContext: jest.fn().mockResolvedValue({ tenant: null, source: null }),
  resolveTenantScope: jest.fn().mockResolvedValue({ scopeUserIds: new Set() }),
}));

const request      = require('supertest');
const jwt          = require('jsonwebtoken');
const { app }      = require('../server');
const User         = require('../models/User');
const Conversation = require('../models/Conversation');
const Message      = require('../models/Message');

const makeToken = (role = 'Client') =>
  jwt.sign({ id: '507f1f77bcf86cd799439011', tokenVersion: 0 }, process.env.JWT_SECRET, { expiresIn: '1d' });

const fakeUser = (role = 'Client') => ({
  _id:          '507f1f77bcf86cd799439011',
  name:         'Test User',
  email:        'test@altitude.com',
  role,
  isActive:     true,
  status:       'Actif',
  tokenVersion: 0,
});

// ─── GET /api/conversations ──────────────────────────────────────────────────

describe('GET /api/conversations', () => {
  afterEach(() => jest.clearAllMocks());

  test('401 sans authentification', async () => {
    const res = await request(app).get('/api/conversations');
    expect(res.statusCode).toBe(401);
  });

  test('401 avec token malformé', async () => {
    const res = await request(app)
      .get('/api/conversations')
      .set('Authorization', 'Bearer token.invalide.xyz');
    expect(res.statusCode).toBe(401);
  });
});

describe('GET /api/conversations/count/unread — ordre et clients sans tenant', () => {
  afterEach(() => jest.clearAllMocks());

  test('la route statique atteint le compteur et conserve le client ordinaire', async () => {
    User.findById = jest.fn().mockReturnValue({ select: jest.fn().mockResolvedValue({ ...fakeUser('Client'), id: '507f1f77bcf86cd799439011' }) });
    User.findByIdAndUpdate = jest.fn().mockResolvedValue(null);
    Message.countDocuments = jest.fn().mockResolvedValue(2);
    const res = await request(app).get('/api/conversations/count/unread').set('Authorization', `Bearer ${makeToken('Client')}`);
    expect(res.statusCode).toBe(200); expect(res.body.data.unreadCount).toBe(2);
    expect(Message.countDocuments).toHaveBeenCalledWith(expect.objectContaining({ receiver: '507f1f77bcf86cd799439011', isRead: false }));
    expect(Conversation.findById).not.toHaveBeenCalled();
  });

  test('401 sans authentification', async () => {
    expect((await request(app).get('/api/conversations/count/unread')).statusCode).toBe(401);
  });
});

// ─── POST /api/conversations ─────────────────────────────────────────────────

describe('POST /api/conversations', () => {
  afterEach(() => jest.clearAllMocks());

  test('401 sans token', async () => {
    const res = await request(app)
      .post('/api/conversations')
      .send({ recipientId: '507f191e810c19729de860ea' });
    expect(res.statusCode).toBe(401);
  });
});

// ─── GET /api/conversations/staff-inbox ──────────────────────────────────────

describe('GET /api/conversations/staff-inbox', () => {
  test('401 sans token', async () => {
    const res = await request(app).get('/api/conversations/staff-inbox');
    expect(res.statusCode).toBe(401);
  });
});

// ─── GET /api/conversations/:conversationId — isolation + statut HTTP ──────
// POST-E2E-2 — non-régression des 2 bugs réels corrigés ce sprint : (1) un
// tiers non participant recevait un 500 au lieu d'un 403 (bug réel démontré,
// POST_E2E1_REPORT.md §36) ; (2) le propriétaire de la ressource contactée ne
// doit JAMAIS être automatiquement participant (règle métier absolue,
// mandat POST-E2E-2 §0).

const CONVERSATION_ID = '607f1f77bcf86cd799439055';
const OWNER_ID = '507f1f77bcf86cd799439099'; // jamais dans `participants` ci-dessous

const fakeConversation = (overrides = {}) => ({
  _id: CONVERSATION_ID,
  participants: [{ _id: '507f1f77bcf86cd799439011' }, { _id: '507f1f77bcf86cd799439022' }],
  isStaffInbox: false,
  tenant: null,
  ...overrides,
  populate: jest.fn().mockReturnThis(),
  lean: jest.fn(),
});

describe('GET /api/conversations/:conversationId — accès et isolation', () => {
  afterEach(() => jest.clearAllMocks());

  test('403 (jamais 500) pour un tiers non participant et non staff', async () => {
    User.findById = jest.fn().mockReturnValue({ select: jest.fn().mockResolvedValue(fakeUser('Client')) });
    User.findByIdAndUpdate = jest.fn().mockResolvedValue(null);
    const conv = fakeConversation();
    conv.lean.mockResolvedValue({ _id: CONVERSATION_ID, participants: conv.participants, isStaffInbox: false });
    Conversation.findById = jest.fn().mockReturnValue(conv);

    const res = await request(app)
      .get(`/api/conversations/${CONVERSATION_ID}`)
      .set('Authorization', `Bearer ${makeToken('Client')}`);

    expect(res.statusCode).toBe(403);
    expect(res.statusCode).not.toBe(500);
  });

  test('le propriétaire de la ressource liée n\'est jamais automatiquement participant (403 attendu)', async () => {
    // OWNER_ID simule le propriétaire du bien lié à la conversation — il
    // n'apparaît jamais dans `participants`, exactement comme le garantit
    // startConversation (POST-E2E-1) qui ne l'ajoute jamais.
    const ownerUser = { ...fakeUser('Proprietaire'), _id: OWNER_ID };
    User.findById = jest.fn().mockReturnValue({ select: jest.fn().mockResolvedValue(ownerUser) });
    User.findByIdAndUpdate = jest.fn().mockResolvedValue(null);
    const token = jwt.sign({ id: OWNER_ID, tokenVersion: 0 }, process.env.JWT_SECRET, { expiresIn: '1d' });
    const conv = fakeConversation({ relatedProperty: 'prop-1' });
    conv.lean.mockResolvedValue({ _id: CONVERSATION_ID, participants: conv.participants, isStaffInbox: true, relatedProperty: 'prop-1' });
    Conversation.findById = jest.fn().mockReturnValue(conv);

    const res = await request(app)
      .get(`/api/conversations/${CONVERSATION_ID}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.statusCode).toBe(403);
  });
});
