const jwt = require('jsonwebtoken');

const SESSION_ALGORITHM = 'HS256';

function jwtSecret() {
  if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET manquant');
  return process.env.JWT_SECRET;
}

function assertSessionClaims(decoded) {
  const validId = typeof decoded?.id === 'string' && /^[a-f\d]{24}$/i.test(decoded.id);
  const validVersion = Number.isInteger(decoded?.tokenVersion) && decoded.tokenVersion >= 0;
  const now = Math.floor(Date.now() / 1000);
  const validTimes = Number.isInteger(decoded?.iat)
    && Number.isInteger(decoded?.exp)
    && decoded.iat <= now + 30
    && decoded.exp > decoded.iat;
  if (!validId || !validVersion || !validTimes) {
    throw new jwt.JsonWebTokenError('Contrat de session JWT invalide');
  }
  return decoded;
}

function verifySessionToken(token) {
  return assertSessionClaims(jwt.verify(token, jwtSecret(), { algorithms: [SESSION_ALGORITHM] }));
}

function signSessionToken(payload, options = {}) {
  if (!/^[a-f\d]{24}$/i.test(String(payload?.id || ''))
    || !Number.isInteger(payload?.tokenVersion)
    || payload.tokenVersion < 0
    || options.expiresIn === undefined) {
    throw new jwt.JsonWebTokenError('Contrat d’émission JWT invalide');
  }
  return jwt.sign(payload, jwtSecret(), { ...options, algorithm: SESSION_ALGORITHM });
}

module.exports = { SESSION_ALGORITHM, verifySessionToken, signSessionToken };
