// __tests__/googleGetToken.test.js
// Tests d'intégration de POST /api/auth/google-token (pont interne NextAuth → JWT applicatif)

jest.mock('../models/User');
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

const request = require('supertest');
const jwt     = require('jsonwebtoken');
const { app } = require('../server');
const User    = require('../models/User');

const NEXTAUTH_SECRET = 'test-nextauth-secret';

describe('POST /api/auth/google-token', () => {
  const originalSecret = process.env.NEXTAUTH_API_SECRET;

  beforeAll(() => {
    process.env.NEXTAUTH_API_SECRET = NEXTAUTH_SECRET;
  });

  afterAll(() => {
    process.env.NEXTAUTH_API_SECRET = originalSecret;
  });

  afterEach(() => jest.clearAllMocks());

  test('403 si le header x-nextauth-secret est absent', async () => {
    const res = await request(app)
      .post('/api/auth/google-token')
      .send({ email: 'user@test.com' });

    expect(res.statusCode).toBe(403);
    expect(User.findOne).not.toHaveBeenCalled();
  });

  test('403 si le secret ne correspond pas', async () => {
    const res = await request(app)
      .post('/api/auth/google-token')
      .set('x-nextauth-secret', 'mauvais-secret')
      .send({ email: 'user@test.com' });

    expect(res.statusCode).toBe(403);
  });

  test('400 si email manquant', async () => {
    const res = await request(app)
      .post('/api/auth/google-token')
      .set('x-nextauth-secret', NEXTAUTH_SECRET)
      .send({});

    expect(res.statusCode).toBe(400);
  });

  test('404 si aucun utilisateur ne correspond à l\'email', async () => {
    User.findOne = jest.fn().mockResolvedValue(null);

    const res = await request(app)
      .post('/api/auth/google-token')
      .set('x-nextauth-secret', NEXTAUTH_SECRET)
      .send({ email: 'inconnu@test.com' });

    expect(res.statusCode).toBe(404);
  });

  test('200 + token JWT, userId et role si utilisateur trouvé', async () => {
    const fakeUser = {
      _id:          '507f1f77bcf86cd799439011',
      email:        'user@test.com',
      role:         'Collaborateur',
      tokenVersion: 0,
    };
    User.findOne = jest.fn().mockResolvedValue(fakeUser);

    const res = await request(app)
      .post('/api/auth/google-token')
      .set('x-nextauth-secret', NEXTAUTH_SECRET)
      .send({ email: 'user@test.com' });

    expect(res.statusCode).toBe(200);
    expect(res.body.userId).toBe(fakeUser._id);
    expect(res.body.role).toBe('Collaborateur');
    expect(typeof res.body.token).toBe('string');

    // Le token renvoyé doit être un JWT valide, signé avec le bon payload
    const decoded = jwt.verify(res.body.token, process.env.JWT_SECRET);
    expect(decoded.id).toBe(fakeUser._id);
    expect(decoded.tokenVersion).toBe(0);
  });
});
