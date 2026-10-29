const jwt = require('jsonwebtoken');

const { verifySessionToken, signSessionToken } = require('../utils/jwtSession');

describe('JWT session contract', () => {
  const secret = 'synthetic-jwt-secret-for-tests-only';
  const userId = '507f1f77bcf86cd799439011';

  beforeEach(() => { process.env.JWT_SECRET = secret; });

  it.each([
    ['tokenVersion absent', { id: userId }],
    ['tokenVersion négatif', { id: userId, tokenVersion: -1 }],
    ['tokenVersion non entier', { id: userId, tokenVersion: '0' }],
    ['id absent', { tokenVersion: 0 }],
    ['id non ObjectId', { id: 'user123', tokenVersion: 0 }],
  ])('refuse un jeton dont le contrat de session est invalide: %s', (_label, payload) => {
    const token = jwt.sign(payload, secret, { algorithm: 'HS256', expiresIn: '1h' });
    expect(() => verifySessionToken(token)).toThrow();
  });

  it('refuse un jeton d’authentification sans expiration', () => {
    const token = jwt.sign({ id: userId, tokenVersion: 0 }, secret, { algorithm: 'HS256' });
    expect(() => verifySessionToken(token)).toThrow();
  });

  it('refuse un algorithme signé mais non autorisé', () => {
    const token = jwt.sign({ id: userId, tokenVersion: 0 }, secret, { algorithm: 'HS384', expiresIn: '1h' });
    expect(() => verifySessionToken(token)).toThrow();
  });

  it('refuse un jeton expiré', () => {
    const now = Math.floor(Date.now() / 1000);
    const token = jwt.sign({ id: userId, tokenVersion: 0, iat: now - 7200, exp: now - 3600 }, secret, { algorithm: 'HS256' });
    expect(() => verifySessionToken(token)).toThrow(jwt.TokenExpiredError);
  });

  it('refuse un jeton signé avec un autre secret', () => {
    const token = jwt.sign({ id: userId, tokenVersion: 0 }, 'synthetic-other-secret-for-tests-only', { algorithm: 'HS256', expiresIn: '1h' });
    expect(() => verifySessionToken(token)).toThrow(/invalid signature/);
  });

  it('refuse un jeton non signé (alg none)', () => {
    const token = jwt.sign({ id: userId, tokenVersion: 0 }, null, { algorithm: 'none', expiresIn: '1h' });
    expect(() => verifySessionToken(token)).toThrow();
  });

  it('émet et accepte un jeton HS256 complet', () => {
    const token = signSessionToken({ id: userId, tokenVersion: 0 }, { expiresIn: '1h' });
    expect(jwt.decode(token, { complete: true }).header.alg).toBe('HS256');
    expect(verifySessionToken(token)).toMatchObject({ id: userId, tokenVersion: 0 });
  });

  it('refuse un iat situé dans le futur', () => {
    const now = Math.floor(Date.now() / 1000);
    const token = jwt.sign({ id: userId, tokenVersion: 0, iat: now + 3600, exp: now + 7200 }, secret, { algorithm: 'HS256' });
    expect(() => verifySessionToken(token)).toThrow();
  });

  it('refuse d’émettre une session sans expiration', () => {
    expect(() => signSessionToken({ id: userId, tokenVersion: 0 })).toThrow();
  });

  it('charge l’émetteur historique et produit un jeton conforme', () => {
    process.env.JWT_EXPIRES_IN = '1h';
    const generateToken = require('../utils/generateToken');
    expect(verifySessionToken(generateToken(userId, 0))).toMatchObject({ id: userId, tokenVersion: 0 });
  });
});
