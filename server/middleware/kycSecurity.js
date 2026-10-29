// F-U1.J — Protections HTTP propres aux routes KYC.
const rateLimit = require('express-rate-limit');

// Aucune réponse KYC (données personnelles, statuts, journaux) ne doit être
// conservée par un navigateur, un proxy ou un CDN.
function kycNoStore(_req, res, next) {
  res.setHeader('Cache-Control', 'private, no-store, max-age=0');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  next();
}

// Limitation par identité authentifiée (jamais par adresse seule) : freine
// l'aspiration de justificatifs et l'énumération.
const byUser = (req) => `kyc:${req.user?._id || 'anonymous'}`;
const limiter = (max, message) => rateLimit({
  windowMs: 10 * 60 * 1000, max, keyGenerator: byUser, standardHeaders: true, legacyHeaders: false,
  message: { status: 'fail', code: 'KYC_RATE_LIMITED', message },
});

module.exports = {
  kycNoStore,
  kycDocumentReadLimiter: limiter(60, 'Trop de consultations de justificatifs. Réessayez plus tard.'),
  kycDocumentUploadLimiter: limiter(20, 'Trop de dépôts de justificatifs. Réessayez plus tard.'),
};
