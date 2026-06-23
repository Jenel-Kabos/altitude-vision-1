const rateLimit = require('express-rate-limit');

exports.signupLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 heure
  max: 5,
  message: {
    status: 'fail',
    message: "Trop de tentatives d'inscription. Réessayez dans 1 heure.",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

exports.resendVerificationLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 3,
  message: {
    status: 'fail',
    message: 'Trop de demandes. Réessayez dans 10 minutes.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});
