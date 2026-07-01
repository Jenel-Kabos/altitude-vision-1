const jwt = require('jsonwebtoken');

jest.mock('../models/User');
jest.mock('../models/Property');

const User     = require('../models/User');
const Property = require('../models/Property');
const { protect, restrictTo, adminOnly, checkPropertyOwnership } = require('../middleware/authMiddleware');

// ── Helpers ──────────────────────────────────────────────────
const makeToken = (payload = {}) =>
  jwt.sign({ id: 'user123', tokenVersion: 0, ...payload }, process.env.JWT_SECRET);

const makeReq = (token) => ({
  headers: { authorization: token ? `Bearer ${token}` : undefined },
});

const makeRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json   = jest.fn().mockReturnValue(res);
  return res;
};

// asyncHandler transfère les erreurs vers next(err) — on vérifie next plutôt que rejects
const runMiddleware = async (fn, req, res) => {
  const next = jest.fn();
  await fn(req, res, next);
  return next;
};

// ─────────────────────────────────────────────────────────────
describe('protect', () => {
  afterEach(() => jest.clearAllMocks());

  it('appelle next(Error) sans header Authorization', async () => {
    const next = await runMiddleware(protect, { headers: {} }, makeRes());
    expect(next).toHaveBeenCalledWith(expect.any(Error));
    expect(next.mock.calls[0][0].message).toMatch('aucun token fourni');
  });

  it('appelle next(Error) avec un token invalide', async () => {
    const next = await runMiddleware(protect, makeReq('token-bidon'), makeRes());
    expect(next).toHaveBeenCalledWith(expect.any(Error));
    expect(next.mock.calls[0][0].message).toMatch('token invalide ou expiré');
  });

  it('renvoie 401 si utilisateur inexistant en base', async () => {
    User.findById.mockReturnValue({ select: jest.fn().mockResolvedValue(null) });
    const res  = makeRes();
    const next = await runMiddleware(protect, makeReq(makeToken()), res);
    expect(next).toHaveBeenCalledWith(expect.any(Error));
    expect(next.mock.calls[0][0].message).toMatch('utilisateur inexistant');
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('renvoie 401 si tokenVersion est obsolète', async () => {
    User.findById.mockReturnValue({
      select: jest.fn().mockResolvedValue({ _id: 'user123', tokenVersion: 5, status: 'Actif', isActive: true }),
    });
    const res  = makeRes();
    const next = await runMiddleware(protect, makeReq(makeToken({ tokenVersion: 2 })), res);
    expect(next).toHaveBeenCalledWith(expect.any(Error));
    expect(next.mock.calls[0][0].message).toMatch('Session expirée');
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('renvoie 403 si compte Suspendu', async () => {
    User.findById.mockReturnValue({
      select: jest.fn().mockResolvedValue({ _id: 'user123', tokenVersion: 0, status: 'Suspendu', isActive: true }),
    });
    const res  = makeRes();
    const next = await runMiddleware(protect, makeReq(makeToken()), res);
    expect(next).toHaveBeenCalledWith(expect.any(Error));
    expect(next.mock.calls[0][0].message).toMatch('suspendu');
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('renvoie 403 si isActive est false', async () => {
    User.findById.mockReturnValue({
      select: jest.fn().mockResolvedValue({ _id: 'user123', tokenVersion: 0, status: 'Actif', isActive: false }),
    });
    const res  = makeRes();
    const next = await runMiddleware(protect, makeReq(makeToken()), res);
    expect(next).toHaveBeenCalledWith(expect.any(Error));
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('appelle next() sans erreur et injecte req.user pour un token valide', async () => {
    const fakeUser = { _id: 'user123', tokenVersion: 0, status: 'Actif', isActive: true };
    User.findById.mockReturnValue({ select: jest.fn().mockResolvedValue(fakeUser) });
    User.findByIdAndUpdate.mockResolvedValue(null); // lastActivityAt — non-blocking
    const req  = makeReq(makeToken());
    const res  = makeRes();
    const next = await runMiddleware(protect, req, res);
    // next() appelé sans argument = pas d'erreur
    expect(next).toHaveBeenCalledWith();
    expect(req.user).toBe(fakeUser);
  });
});

// ─────────────────────────────────────────────────────────────
describe('restrictTo', () => {
  it('appelle next() si le rôle est autorisé', () => {
    const req  = { user: { role: 'Admin' } };
    const res  = makeRes();
    const next = jest.fn();
    restrictTo('Admin', 'Collaborateur')(req, res, next);
    expect(next).toHaveBeenCalledWith();
  });

  it('renvoie 403 si le rôle est interdit', () => {
    const req  = { user: { role: 'Client' } };
    const res  = makeRes();
    const next = jest.fn();
    expect(() => restrictTo('Admin')(req, res, next)).toThrow('Accès refusé');
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('renvoie 403 si req.user est absent', () => {
    const req  = {};
    const res  = makeRes();
    const next = jest.fn();
    expect(() => restrictTo('Admin')(req, res, next)).toThrow('Accès refusé');
    expect(res.status).toHaveBeenCalledWith(403);
  });
});

// ─────────────────────────────────────────────────────────────
describe('adminOnly', () => {
  it('appelle next() pour un Admin', () => {
    const req  = { user: { role: 'Admin' } };
    const res  = makeRes();
    const next = jest.fn();
    adminOnly(req, res, next);
    expect(next).toHaveBeenCalledWith();
  });

  it('renvoie 403 pour un Collaborateur', () => {
    const req  = { user: { role: 'Collaborateur' } };
    const res  = makeRes();
    const next = jest.fn();
    expect(() => adminOnly(req, res, next)).toThrow('administrateur requis');
    expect(res.status).toHaveBeenCalledWith(403);
  });
});

// ─────────────────────────────────────────────────────────────
describe('checkPropertyOwnership', () => {
  afterEach(() => jest.clearAllMocks());

  it('appelle next(Error 404) si la propriété est introuvable', async () => {
    Property.findById.mockResolvedValue(null);
    const req  = { user: { _id: { toString: () => 'user123' }, role: 'Client' }, params: { id: 'prop999' } };
    const res  = makeRes();
    const next = await runMiddleware(checkPropertyOwnership, req, res);
    expect(next).toHaveBeenCalledWith(expect.any(Error));
    expect(next.mock.calls[0][0].message).toMatch('non trouvée');
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('autorise un Admin même s\'il n\'est pas propriétaire', async () => {
    Property.findById.mockResolvedValue({ _id: 'prop1', owner: { toString: () => 'autre-user' } });
    const req  = { user: { _id: { toString: () => 'admin1' }, role: 'Admin' }, params: { id: 'prop1' } };
    const res  = makeRes();
    const next = await runMiddleware(checkPropertyOwnership, req, res);
    expect(next).toHaveBeenCalledWith();
    expect(req.property).toBeDefined();
  });

  it('autorise le propriétaire de la ressource', async () => {
    Property.findById.mockResolvedValue({ _id: 'prop1', owner: { toString: () => 'owner-id' } });
    const req  = { user: { _id: { toString: () => 'owner-id' }, role: 'Client' }, params: { id: 'prop1' } };
    const res  = makeRes();
    const next = await runMiddleware(checkPropertyOwnership, req, res);
    expect(next).toHaveBeenCalledWith();
  });

  it('renvoie 403 si l\'utilisateur n\'est ni owner ni Admin', async () => {
    Property.findById.mockResolvedValue({ _id: 'prop1', owner: { toString: () => 'owner-id' } });
    const req  = { user: { _id: { toString: () => 'autre-user' }, role: 'Client' }, params: { id: 'prop1' } };
    const res  = makeRes();
    const next = await runMiddleware(checkPropertyOwnership, req, res);
    expect(next).toHaveBeenCalledWith(expect.any(Error));
    expect(next.mock.calls[0][0].message).toMatch('Accès refusé');
    expect(res.status).toHaveBeenCalledWith(403);
  });
});
