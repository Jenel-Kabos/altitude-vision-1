// __tests__/authRoutes.test.js
// Tests d'intégration des routes d'authentification (modèles mockés)

jest.mock('../models/User');
jest.mock('../models/PendingRegistration');
jest.mock('../config/db', () => jest.fn());
jest.mock('node-cron', () => ({ schedule: jest.fn() }));
jest.mock('../scripts/sync-facebook', () => ({ syncFacebook: jest.fn() }));
jest.mock('../services/zohoImapService', () => ({ pollZohoInbox: jest.fn() }));
jest.mock('../services/alerteService', () => ({ verifierPaiementsEnRetard: jest.fn() }));
jest.mock('../utils/generateSitemap', () => jest.fn().mockResolvedValue('<xml/>'));
jest.mock('../utils/email', () => jest.fn().mockResolvedValue(true));
const mockMiddleware = () => (req, res, next) => next();
jest.mock('../config/cloudinary', () => ({
  uploadToCloudinary:    jest.fn(),
  destroyFromCloudinary: jest.fn(),
  upload: { single: mockMiddleware, array: mockMiddleware },
}));

const request            = require('supertest');
const bcrypt             = require('bcryptjs');
const { app }            = require('../server');
const User               = require('../models/User');
const PendingRegistration = require('../models/PendingRegistration');

// ─── POST /api/auth/login ───────────────────────────────────────────────────

describe('POST /api/auth/login', () => {
  afterEach(() => jest.clearAllMocks());

  test('400 si champs manquants', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({});
    expect(res.statusCode).toBe(400);
  });

  test('401 si email introuvable', async () => {
    User.findOne = jest.fn().mockReturnValue({
      select: jest.fn().mockResolvedValue(null),
    });

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'inconnu@test.com', password: 'MonMotDePasse123!' });

    expect(res.statusCode).toBe(401);
  });

  test('401 si mot de passe incorrect', async () => {
    User.findOne = jest.fn().mockReturnValue({
      select: jest.fn().mockResolvedValue({
        _id:             '507f1f77bcf86cd799439011',
        email:           'user@test.com',
        isEmailVerified: true,
        isActive:        true,
        tokenVersion:    0,
        matchPassword:   jest.fn().mockResolvedValue(false), // mauvais mot de passe
      }),
    });

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'user@test.com', password: 'MauvaisMotDePasse!' });

    expect(res.statusCode).toBe(401);
  });

  test('200 + token JWT si credentials valides', async () => {
    const fakeUser = {
      _id:             '507f1f77bcf86cd799439011',
      name:            'Test User',
      email:           'user@test.com',
      role:            'Client',
      isEmailVerified: true,
      isActive:        true,
      tokenVersion:    0,
      matchPassword:   jest.fn().mockResolvedValue(true),
      save:            jest.fn().mockResolvedValue(true),
    };

    User.findOne = jest.fn().mockReturnValue({
      select: jest.fn().mockResolvedValue(fakeUser),
    });

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'user@test.com', password: 'BonMotDePasse123!' });

    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('token');
    expect(res.body.data?.user?.email).toBe('user@test.com');
    // Le mot de passe ne doit JAMAIS apparaître dans la réponse
    expect(JSON.stringify(res.body)).not.toContain('password');
  });
});

// ─── POST /api/auth/signup ──────────────────────────────────────────────────

describe('POST /api/auth/signup', () => {
  afterEach(() => jest.clearAllMocks());

  test('400 si email manquant', async () => {
    const res = await request(app)
      .post('/api/auth/signup')
      .send({ name: 'Jean', password: 'MonMotDePasse123!' });
    expect(res.statusCode).toBe(400);
  });

  test('400 si mot de passe trop court (< 8 chars)', async () => {
    const res = await request(app)
      .post('/api/auth/signup')
      .send({ name: 'Jean', email: 'jean@test.com', password: '123' });
    expect(res.statusCode).toBe(400);
  });

  test('400 si email déjà utilisé (User vérifié existant)', async () => {
    User.findOne = jest.fn().mockResolvedValue({
      _id:             '507f1f77bcf86cd799439011',
      isEmailVerified: true,
    });

    const res = await request(app)
      .post('/api/auth/signup')
      .send({ name: 'Jean', email: 'jean@test.com', password: 'MonMotDePasse123!' });

    expect(res.statusCode).toBe(400);
    expect(res.body.message).toMatch(/déjà utilisée/i);
  });

  test('201 si inscription valide — envoie email de vérification', async () => {
    User.findOne    = jest.fn().mockResolvedValue(null);
    User.deleteOne  = jest.fn().mockResolvedValue({});
    PendingRegistration.findOneAndUpdate = jest.fn().mockResolvedValue({
      _id: '507f191e810c19729de860ea',
    });

    const sendEmail = require('../utils/email');

    const res = await request(app)
      .post('/api/auth/signup')
      .send({
        name:     'Jean Dupont',
        email:    'jean@test.com',
        password: 'MonMotDePasse123!',
      });

    expect([200, 201]).toContain(res.statusCode);
    expect(sendEmail).toHaveBeenCalledTimes(1);
    expect(res.body.message).toMatch(/email/i);
  });
});

// ─── Rate limiter signup ─────────────────────────────────────────────────────

describe('Rate limiter /api/auth/signup', () => {
  test('429 après 5 tentatives rapides (limite : 5/h)', async () => {
    User.findOne = jest.fn().mockResolvedValue(null);
    PendingRegistration.findOneAndUpdate = jest.fn().mockResolvedValue({ _id: '1' });

    // Envoyer 6 requêtes — la 6e doit être bloquée
    for (let i = 0; i < 5; i++) {
      await request(app)
        .post('/api/auth/signup')
        .send({ name: `User${i}`, email: `user${i}@test.com`, password: 'Password123!' });
    }

    const res = await request(app)
      .post('/api/auth/signup')
      .send({ name: 'User6', email: 'user6@test.com', password: 'Password123!' });

    expect(res.statusCode).toBe(429);
  });
});
