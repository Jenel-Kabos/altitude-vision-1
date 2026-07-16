const rateLimit = require("express-rate-limit");

exports.signupLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 heure
  max: 5,
  message: {
    status: "fail",
    message: "Trop de tentatives d'inscription. Réessayez dans 1 heure.",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

exports.resendVerificationLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 3,
  message: {
    status: "fail",
    message: "Trop de demandes. Réessayez dans 10 minutes.",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Protège contre les attaques brute-force sur le mot de passe
exports.loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  message: {
    status: "fail",
    message: "Trop de tentatives de connexion. Réessayez dans 15 minutes.",
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // ne pénalise pas les connexions réussies
});

// Protège /auth/google et /auth/google-token contre le brute-force / abus de vérification de tokens
exports.googleLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: {
    status: "fail",
    message: "Trop de tentatives Google. Réessayez dans 15 minutes.",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

exports.estimationSubmissionLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  message: {
    status: "fail",
    message: "Trop de demandes d’estimation. Réessayez plus tard.",
  },
  standardHeaders: true,
  legacyHeaders: false,
});
