// API-PUBLIC-1 (Phase 6) — Journalisation de chaque appel (Phase 6 : suivi
// des erreurs = statusCode >= 400 déjà interrogeable sur ce même journal,
// aucune table séparée). Écrit sur `res.on('finish')` pour capturer le
// statusCode réel et la durée totale — jamais bloquant pour la réponse
// elle-même (fire-and-forget, comme tous les journaux d'audit déjà en place
// sur la plateforme).
const ApiCallLog = require('../models/ApiCallLog');

function logApiCall(req, res, next) {
  const startedAt = Date.now();
  res.on('finish', () => {
    if (!req.apiKey) return;
    ApiCallLog.create({
      apiKey: req.apiKey._id,
      method: req.method,
      path: req.originalUrl,
      statusCode: res.statusCode,
      durationMs: Date.now() - startedAt,
      ip: req.ip,
    }).catch(() => {});
  });
  next();
}

module.exports = { logApiCall };
