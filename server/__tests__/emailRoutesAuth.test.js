// __tests__/emailRoutesAuth.test.js
// HOTFIX-INBOX-SECURITY-1 — caractérise puis prouve la fermeture de
// l'exposition non authentifiée de server/routes/emailRoutes.js (finding P0
// confirmé par INBOX-1 : 14 routes, zéro middleware protect/restrictTo).
//
// Avant correctif : chaque requête anonyme ci-dessous atteint réellement le
// contrôleur et la base (modèle mocké mais bien appelé). Après correctif :
// toutes sont bloquées en 401 avant d'atteindre le contrôleur, et un
// utilisateur staff authentifié (ROLES_DOCS) conserve un comportement
// strictement identique à avant.

jest.mock('../models/Email');
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
const Email   = require('../models/Email');
const User    = require('../models/User');

const FAKE_EMAIL_DOC = { _id: 'e1', email: 'contact@altitudevision.agency', isActive: true, emailsSent: 0 };

const signToken = (userId, role) => jwt.sign({ id: userId, role, tokenVersion: 0 }, process.env.JWT_SECRET, { expiresIn: '1h' });

const mockAuthenticatedUser = (role) => {
  User.findById = jest.fn().mockReturnValue({
    select: jest.fn().mockResolvedValue({ _id: 'staff-1', id: 'staff-1', role, tokenVersion: 0, isActive: true, status: 'Actif' }),
  });
  User.findByIdAndUpdate = jest.fn().mockReturnValue({ catch: jest.fn() });
};

describe('emailRoutes — exposition anonyme (caractérisation AVANT correctif, doit rester vraie APRÈS pour un token absent)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Email.find = jest.fn().mockReturnValue({ populate: jest.fn().mockResolvedValue([FAKE_EMAIL_DOC]) });
    Email.findById = jest.fn().mockReturnValue({ populate: jest.fn().mockResolvedValue(FAKE_EMAIL_DOC) });
    Email.create = jest.fn().mockResolvedValue(FAKE_EMAIL_DOC);
    Email.findByIdAndUpdate = jest.fn().mockResolvedValue(FAKE_EMAIL_DOC);
    Email.findByIdAndDelete = jest.fn().mockResolvedValue(FAKE_EMAIL_DOC);
    Email.countDocuments = jest.fn().mockResolvedValue(0);
    Email.aggregate = jest.fn().mockResolvedValue([]);
    Email.findOne = jest.fn().mockResolvedValue(FAKE_EMAIL_DOC);
  });

  test('GET /api/emails sans Authorization → 401, le contrôleur/modèle ne doit jamais être atteint', async () => {
    const res = await request(app).get('/api/emails');
    expect(res.statusCode).toBe(401);
    expect(Email.find).not.toHaveBeenCalled();
  });

  test('POST /api/emails (création) sans Authorization → 401, aucune écriture', async () => {
    const res = await request(app).post('/api/emails').send({ email: 'x@y.com', displayName: 'X' });
    expect(res.statusCode).toBe(401);
    expect(Email.create).not.toHaveBeenCalled();
  });

  test('DELETE /api/emails/:id sans Authorization → 401, aucune suppression', async () => {
    const res = await request(app).delete('/api/emails/e1');
    expect(res.statusCode).toBe(401);
    expect(Email.findByIdAndDelete).not.toHaveBeenCalled();
  });

  test('POST /api/emails/send sans Authorization → 401, aucune lecture ni tentative d\'envoi', async () => {
    const res = await request(app).post('/api/emails/send').send({ fromEmail: 'a@b.com', toEmail: 'c@d.com', subject: 's', content: 'c' });
    expect(res.statusCode).toBe(401);
    expect(Email.findOne).not.toHaveBeenCalled();
  });

  test('POST /api/emails/sync-zoho sans Authorization → 401', async () => {
    const res = await request(app).post('/api/emails/sync-zoho');
    expect(res.statusCode).toBe(401);
  });

  test('token invalide → 401, aucun accès', async () => {
    const res = await request(app).get('/api/emails').set('Authorization', 'Bearer invalide.token.ici');
    expect(res.statusCode).toBe(401);
    expect(Email.find).not.toHaveBeenCalled();
  });
});

describe('emailRoutes — accès staff authentifié (ROLES_DOCS) préservé après correctif', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Email.find = jest.fn().mockReturnValue({ populate: jest.fn().mockResolvedValue([FAKE_EMAIL_DOC]) });
    Email.findById = jest.fn().mockReturnValue({ populate: jest.fn().mockResolvedValue(FAKE_EMAIL_DOC) });
    Email.create = jest.fn().mockResolvedValue(FAKE_EMAIL_DOC);
    Email.findByIdAndUpdate = jest.fn().mockResolvedValue(FAKE_EMAIL_DOC);
    Email.findByIdAndDelete = jest.fn().mockResolvedValue(FAKE_EMAIL_DOC);
  });

  test.each(['Admin', 'Secretaire', 'Collaborateur'])(
    '%s authentifié : GET /api/emails toujours 200, comportement historique intact',
    async (role) => {
      mockAuthenticatedUser(role);
      const res = await request(app).get('/api/emails').set('Authorization', `Bearer ${signToken('staff-1', role)}`);
      expect(res.statusCode).toBe(200);
      expect(Email.find).toHaveBeenCalled();
    }
  );

  test.each(['GestionnaireImmobilier', 'CommunityManager', 'Communicant', 'Client', 'Proprietaire'])(
    '%s authentifié mais hors ROLES_DOCS : GET /api/emails → 403',
    async (role) => {
      mockAuthenticatedUser(role);
      const res = await request(app).get('/api/emails').set('Authorization', `Bearer ${signToken('staff-1', role)}`);
      expect(res.statusCode).toBe(403);
      expect(Email.find).not.toHaveBeenCalled();
    }
  );

  test('Admin authentifié : POST /api/emails (création) fonctionne comme avant', async () => {
    mockAuthenticatedUser('Admin');
    const res = await request(app).post('/api/emails').set('Authorization', `Bearer ${signToken('staff-1', 'Admin')}`).send({ email: 'x@y.com', displayName: 'X' });
    expect(res.statusCode).toBe(201);
    expect(Email.create).toHaveBeenCalled();
  });
});
