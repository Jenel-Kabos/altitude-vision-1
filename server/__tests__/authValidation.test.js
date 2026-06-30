// Tests des règles de validation du contrôleur d'authentification
// (sans appel réseau ni base de données)

jest.mock('../models/User');
jest.mock('../models/PendingRegistration');
jest.mock('../utils/email', () => jest.fn());
jest.mock('../config/cloudinary', () => ({
  uploadToCloudinary: jest.fn(),
  destroyFromCloudinary: jest.fn(),
}));

const User               = require('../models/User');
const PendingRegistration = require('../models/PendingRegistration');
const authController     = require('../controllers/authController');

const makeRes = () => {
  const res = { _status: 200, _body: null };
  res.status = jest.fn(s => { res._status = s; return res; });
  res.json   = jest.fn(b => { res._body   = b; return res; });
  return res;
};

describe('signup — validation des champs', () => {
  afterEach(() => jest.clearAllMocks());

  it('renvoie 400 si le nom est manquant', async () => {
    const req = { body: { email: 'test@test.com', password: 'motdepasse', passwordConfirm: 'motdepasse' }, headers: {}, socket: {}, ip: '127.0.0.1' };
    const res = makeRes();
    await authController.signup(req, res);
    expect(res._status).toBe(400);
    expect(res._body.message).toMatch(/Champs manquants/);
  });

  it('renvoie 400 si le mot de passe est trop court (< 8 chars)', async () => {
    const req = { body: { name: 'Test', email: 'test@test.com', password: '1234', passwordConfirm: '1234' }, headers: {}, socket: {}, ip: '127.0.0.1' };
    const res = makeRes();
    await authController.signup(req, res);
    expect(res._status).toBe(400);
    expect(res._body.message).toMatch(/8 caractères/);
  });

  it('renvoie 400 si les mots de passe ne correspondent pas', async () => {
    const req = { body: { name: 'Test', email: 'test@test.com', password: 'motdepasse1', passwordConfirm: 'motdepasse2' }, headers: {}, socket: {}, ip: '127.0.0.1' };
    const res = makeRes();
    await authController.signup(req, res);
    expect(res._status).toBe(400);
    expect(res._body.message).toMatch(/identiques/);
  });

  it('renvoie 400 si Propriétaire sans contrat accepté', async () => {
    const req = { body: { name: 'Test', email: 'test@test.com', password: 'motdepasse1', passwordConfirm: 'motdepasse1', role: 'Proprietaire', contratAccepte: false }, headers: {}, socket: {}, ip: '127.0.0.1' };
    const res = makeRes();
    await authController.signup(req, res);
    expect(res._status).toBe(400);
    expect(res._body.message).toMatch(/contrat/i);
  });
});
