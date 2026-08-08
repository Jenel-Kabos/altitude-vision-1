// API-PUBLIC-1 — Journal d'appels de l'API publique. Sert à la fois de
// journalisation (Phase 6), de suivi des erreurs (statusCode >= 400) et de
// fenêtre glissante pour l'application du quota par minute (voir
// publicApiQuota.js) — jamais un second mécanisme de comptage séparé.
const mongoose = require('mongoose');

const schema = new mongoose.Schema({
  apiKey: { type: mongoose.Schema.Types.ObjectId, ref: 'ApiKey', required: true, index: true },
  method: { type: String, required: true },
  path: { type: String, required: true },
  statusCode: { type: Number, required: true },
  durationMs: { type: Number, default: null },
  ip: { type: String, default: null },
}, { timestamps: true });

schema.index({ apiKey: 1, createdAt: -1 });
// TTL — un journal d'appels n'a pas vocation à croître indéfiniment ; 90
// jours suffisent au support/débogage partenaire (purge automatique Mongo,
// jamais une suppression applicative qui pourrait être confondue avec une
// suppression de données réelles au sens du sprint).
schema.index({ createdAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 90 });

module.exports = mongoose.model('ApiCallLog', schema);
