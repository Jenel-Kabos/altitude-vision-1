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

const request      = require('supertest');
const jwt          = require('jsonwebtoken');
const { app }      = require('../server');
const User         = require('../models/User');
const Conversation = require('../models/Conversation');

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
