// API-PUBLIC-1 (Phase 6) — Quota par minute, par clé. Réutilise la même
// collection que la journalisation (ApiCallLog) comme fenêtre glissante —
// jamais un second compteur en mémoire, jamais une dépendance nouvelle
// (Redis) pour un besoin déjà couvert par une requête Mongo indexée
// (apiKey+createdAt).
const ApiCallLog = require('../models/ApiCallLog');

async function enforceQuota(req, res, next) {
  const apiKey = req.apiKey;
  if (!apiKey) return next(); // requireApiKey s'exécute toujours avant — filet de sécurité uniquement
  const since = new Date(Date.now() - 60000);
  const recentCalls = await ApiCallLog.countDocuments({ apiKey: apiKey._id, createdAt: { $gte: since } });
  if (recentCalls >= apiKey.rateLimitPerMinute) {
    return res.status(429).json({ status: 'fail', message: `Quota dépassé (${apiKey.rateLimitPerMinute} requêtes/minute).` });
  }
  next();
}

module.exports = { enforceQuota };
