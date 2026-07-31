// __tests__/forgotPassword.test.js
// GL-DEBT-1 (Phase 14) — POST /api/auth/forgot-password n'avait aucune
// couverture de test. Modèle mocké (convention `authRoutes.test.js`) :
// pas d'email réel envoyé, `../utils/email` est mocké.

jest.mock('../models/User');
jest.mock('../models/PendingRegistration');
jest.mock('../config/db', () => jest.fn());
jest.mock('node-cron', () => ({ schedule: jest.fn() }));
jest.mock('../scripts/sync-facebook', () => ({ syncFacebook: jest.fn() }));
jest.mock('../services/zohoImapService', () => ({ pollZohoInbox: jest.fn() }));
jest.mock('../services/alerteService', () => ({ verifierPaiementsEnRetard: jest.fn() }));
jest.mock('../utils/generateSitemap', () => jest.fn().mockResolvedValue('<xml/>'));
const mockSendEmail = jest.fn().mockResolvedValue(true);
jest.mock('../utils/email', () => (...args) => mockSendEmail(...args));
const mockMiddleware = () => (req, res, next) => next();
jest.mock('../config/cloudinary', () => ({
  uploadToCloudinary:    jest.fn(),
  destroyFromCloudinary: jest.fn(),
  upload: { single: mockMiddleware, array: mockMiddleware },
}));

const request = require('supertest');
const { app } = require('../server');
const User    = require('../models/User');

// Chaque test utilise sa propre IP simulée (via X-Forwarded-For, `trust
// proxy` étant activé dans server.js) pour ne pas partager le compteur du
// rate limiter (5 requêtes / 15 min) entre tests indépendants — sauf le
// test dédié au rate limiting lui-même, qui a besoin d'une IP fixe.
let ipCounter = 1;
const freshIp = () => `10.10.10.${ipCounter++}`;

const route = '/api/auth/forgot-password';

describe('POST /api/auth/forgot-password', () => {
  afterEach(() => jest.clearAllMocks());

  test('email connu : réponse générique 200, token et expiration écrits sur le user', async () => {
    const save = jest.fn().mockResolvedValue(true);
    const user = { _id: 'u1', email: 'connu@test.com', name: 'Connu', save };
    User.findOne = jest.fn().mockResolvedValue(user);

    const res = await request(app).post(route).set('X-Forwarded-For', freshIp()).send({ email: 'connu@test.com' });

    expect(res.statusCode).toBe(200);
    expect(res.body.message).toMatch(/Si cet email existe/);
    expect(user.passwordResetToken).toBeDefined();
    expect(typeof user.passwordResetToken).toBe('string');
    expect(user.passwordResetExpires).toBeGreaterThan(Date.now());
    expect(save).toHaveBeenCalledWith({ validateBeforeSave: false });
    expect(mockSendEmail).toHaveBeenCalledTimes(1);
  });

  test('email inconnu : même réponse générique 200, aucun email envoyé', async () => {
    User.findOne = jest.fn().mockResolvedValue(null);

    const res = await request(app).post(route).set('X-Forwarded-For', freshIp()).send({ email: 'inconnu@test.com' });

    expect(res.statusCode).toBe(200);
    expect(res.body.message).toMatch(/Si cet email existe/);
    expect(mockSendEmail).not.toHaveBeenCalled();
  });

  test('anti-énumération : réponse strictement identique (statut + corps) entre email connu et inconnu', async () => {
    const save = jest.fn().mockResolvedValue(true);
    User.findOne = jest.fn().mockResolvedValueOnce({ _id: 'u1', email: 'connu@test.com', name: 'Connu', save });
    const resKnown = await request(app).post(route).set('X-Forwarded-For', freshIp()).send({ email: 'connu@test.com' });

    User.findOne = jest.fn().mockResolvedValueOnce(null);
    const resUnknown = await request(app).post(route).set('X-Forwarded-For', freshIp()).send({ email: 'inconnu@test.com' });

    expect(resKnown.statusCode).toBe(resUnknown.statusCode);
    expect(resKnown.body).toEqual(resUnknown.body);
  });

  test('email manquant : 400, ne révèle aucune information sur l\'existence d\'un compte', async () => {
    const res = await request(app).post(route).set('X-Forwarded-For', freshIp()).send({});
    expect(res.statusCode).toBe(400);
    expect(res.body.message).not.toMatch(/existe|introuvable|inconnu/i);
  });

  test('token haché (sha256) stocké, jamais le token brut', async () => {
    const save = jest.fn().mockResolvedValue(true);
    const user = { _id: 'u1', email: 'connu@test.com', name: 'Connu', save };
    User.findOne = jest.fn().mockResolvedValue(user);

    await request(app).post(route).set('X-Forwarded-For', freshIp()).send({ email: 'connu@test.com' });

    // Un hash sha256 hex fait 64 caractères ; le token brut (crypto.randomBytes(32).toString('hex')) en fait aussi 64,
    // donc on vérifie plutôt que le token stocké ne correspond PAS au resetURL envoyé à l'email (qui contient le brut).
    const emailArgs = mockSendEmail.mock.calls[0][0];
    expect(emailArgs.resetURL).toBeDefined();
    const rawTokenInUrl = emailArgs.resetURL.split('/').pop();
    expect(user.passwordResetToken).not.toBe(rawTokenInUrl);
    expect(user.passwordResetToken).toMatch(/^[a-f0-9]{64}$/);
  });

  test('expiration fixée à 10 minutes', async () => {
    const save = jest.fn().mockResolvedValue(true);
    const user = { _id: 'u1', email: 'connu@test.com', name: 'Connu', save };
    User.findOne = jest.fn().mockResolvedValue(user);

    const before = Date.now();
    await request(app).post(route).set('X-Forwarded-For', freshIp()).send({ email: 'connu@test.com' });
    const after = Date.now();

    expect(user.passwordResetExpires).toBeGreaterThanOrEqual(before + 10 * 60 * 1000 - 1000);
    expect(user.passwordResetExpires).toBeLessThanOrEqual(after + 10 * 60 * 1000 + 1000);
  });

  test('échec d\'envoi email (SMTP indisponible) : token nettoyé, 500 renvoyé, pas d\'information sensible dans la réponse', async () => {
    mockSendEmail.mockRejectedValueOnce(new Error('SMTP indisponible'));
    const save = jest.fn().mockResolvedValue(true);
    const user = { _id: 'u1', email: 'connu@test.com', name: 'Connu', save };
    User.findOne = jest.fn().mockResolvedValue(user);

    const res = await request(app).post(route).set('X-Forwarded-For', freshIp()).send({ email: 'connu@test.com' });

    expect(res.statusCode).toBe(500);
    expect(user.passwordResetToken).toBeUndefined();
    expect(user.passwordResetExpires).toBeUndefined();
    expect(save).toHaveBeenCalledTimes(2); // écriture du token, puis nettoyage
    expect(JSON.stringify(res.body)).not.toMatch(/passwordResetToken|sha256|[a-f0-9]{64}/);
  });

  test('rate limiting : la 6e requête dans la fenêtre de 15 min est bloquée (429)', async () => {
    User.findOne = jest.fn().mockResolvedValue(null);
    const fixedIp = freshIp();
    let last;
    for (let i = 0; i < 6; i += 1) {
      last = await request(app).post(route).set('X-Forwarded-For', fixedIp).send({ email: `x${i}@test.com` });
    }
    expect(last.statusCode).toBe(429);
  });

  test('erreur inattendue (ex: DB down) : 500 générique, aucune trace de token/hash dans la réponse', async () => {
    User.findOne = jest.fn().mockRejectedValue(new Error('connection refused'));

    const res = await request(app).post(route).set('X-Forwarded-For', freshIp()).send({ email: 'connu@test.com' });

    expect(res.statusCode).toBe(500);
    expect(JSON.stringify(res.body)).not.toMatch(/passwordResetToken|[a-f0-9]{64}/);
  });
});
