// MARKETING-CONSENT-1 — Historique append-only des changements de
// consentement marketing. Preuve du consentement (date, canal, source,
// version du texte) et de son retrait. Volontairement minimal : aucune
// adresse IP, aucun e-mail, aucun user-agent — l'identifiant du compte suffit.
const mongoose = require('mongoose');
const { CONSENT_CHANNELS, CONSENT_STATUSES, CONSENT_SOURCES } = require('../constants/marketingConsent');

const schema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true, immutable: true },
  channel: { type: String, enum: CONSENT_CHANNELS, required: true, immutable: true },
  previousStatus: { type: String, enum: CONSENT_STATUSES, required: true, immutable: true },
  status: { type: String, enum: CONSENT_STATUSES, required: true, immutable: true },
  source: { type: String, enum: CONSENT_SOURCES, required: true, immutable: true },
  textVersion: { type: String, default: null, immutable: true },
  at: { type: Date, default: Date.now, immutable: true },
}, { timestamps: false, versionKey: false });

schema.index({ user: 1, at: -1 });

module.exports = mongoose.model('MarketingConsentEvent', schema);
