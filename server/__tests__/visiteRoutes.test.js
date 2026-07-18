// __tests__/visiteRoutes.test.js
// Tests d'intégration des routes de visites (modèles mockés)

jest.mock('../models/Visite');
jest.mock('../models/Property');
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
}));

const request  = require('supertest');
const jwt      = require('jsonwebtoken');
const { app }  = require('../server');
const Visite   = require('../models/Visite');
const Property = require('../models/Property');
const User     = require('../models/User');

const OWNER_ID  = '507f1f77bcf86cd799439011';
const CLIENT_ID = '507f1f77bcf86cd799439012';

const makeToken = (id) =>
  jwt.sign({ id, tokenVersion: 0 }, process.env.JWT_SECRET, { expiresIn: '1d' });

const fakeUser = (id, role = 'Client') => ({
  _id: id, id, name: 'Test User', email: 'test@altitude.com',
  role, isActive: true, status: 'Actif', tokenVersion: 0,
});

const futureDateBody = () => {
  const d = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const pad = (n) => String(n).padStart(2, '0');
  return {
    propertyId: '507f191e810c19729de860ea',
    datePreferee: `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`,
    heurePreferee: '10:00',
    telephone: '+242060000000',
    clientContactConsent: true,
  };
};

describe('POST /api/visites', () => {
  afterEach(() => jest.clearAllMocks());

  test('401 sans token', async () => {
    const res = await request(app).post('/api/visites').send(futureDateBody());
    expect(res.statusCode).toBe(401);
  });

  test("403 — un propriétaire ne peut pas planifier une visite sur son propre bien", async () => {
    User.findById = jest.fn().mockReturnValue({ select: jest.fn().mockResolvedValue(fakeUser(OWNER_ID, 'Proprietaire')) });
    User.findByIdAndUpdate = jest.fn().mockReturnValue({ catch: jest.fn() });
    Property.findById = jest.fn().mockReturnValue({
      populate: jest.fn().mockResolvedValue({
        _id: '507f191e810c19729de860ea',
        owner: { _id: OWNER_ID, name: 'Proprio', phone: '' },
        availability: 'Disponible',
        statusAdmin: 'Validée',
        isPublished: true,
      }),
    });

    const res = await request(app)
      .post('/api/visites')
      .set('Authorization', `Bearer ${makeToken(OWNER_ID)}`)
      .send(futureDateBody());

    expect(res.statusCode).toBe(403);
    expect(Visite.create).not.toHaveBeenCalled();
  });

  test('409 — bien indisponible pour un client tiers', async () => {
    User.findById = jest.fn().mockReturnValue({ select: jest.fn().mockResolvedValue(fakeUser(CLIENT_ID, 'Client')) });
    User.findByIdAndUpdate = jest.fn().mockReturnValue({ catch: jest.fn() });
    Property.findById = jest.fn().mockReturnValue({
      populate: jest.fn().mockResolvedValue({
        _id: '507f191e810c19729de860ea',
        owner: { _id: OWNER_ID, name: 'Proprio', phone: '' },
        availability: 'Loué',
        statusAdmin: 'Validée',
        isPublished: true,
      }),
    });

    const res = await request(app)
      .post('/api/visites')
      .set('Authorization', `Bearer ${makeToken(CLIENT_ID)}`)
      .send(futureDateBody());

    expect(res.statusCode).toBe(409);
    expect(Visite.create).not.toHaveBeenCalled();
  });

  test('404 — bien introuvable', async () => {
    User.findById = jest.fn().mockReturnValue({ select: jest.fn().mockResolvedValue(fakeUser(CLIENT_ID, 'Client')) });
    User.findByIdAndUpdate = jest.fn().mockReturnValue({ catch: jest.fn() });
    Property.findById = jest.fn().mockReturnValue({ populate: jest.fn().mockResolvedValue(null) });

    const res = await request(app)
      .post('/api/visites')
      .set('Authorization', `Bearer ${makeToken(CLIENT_ID)}`)
      .send(futureDateBody());

    expect(res.statusCode).toBe(404);
  });
});
