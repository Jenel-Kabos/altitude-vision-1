// ALTIMMO-AI-INTEGRATION-01 (DeepSeek) — registre de consommation du conseiller conversationnel.
//
// Un document par environnement et par mois. Les dépenses y sont ajoutées par incrément atomique ($inc),
// jamais réécrites : un redémarrage relit le cumul, plusieurs instances s'additionnent, et un mois écoulé
// reste conservé. Aucune donnée de conversation : seulement des compteurs et des identifiants de compte hachés.
const mongoose = require('mongoose');

const altimmoAdvisorUsageSchema = new mongoose.Schema(
  {
    environment: { type: String, required: true, trim: true, maxlength: 40 },
    month: { type: String, required: true, match: /^\d{4}-\d{2}$/ },
    provider: { type: String, required: true, trim: true, maxlength: 20 },
    spentUsd: { type: Number, default: 0, min: 0 },
    calls: { type: Number, default: 0, min: 0 },
    estimatedCalls: { type: Number, default: 0, min: 0 },
    inputTokens: { type: Number, default: 0, min: 0 },
    outputTokens: { type: Number, default: 0, min: 0 },
    // Clé : empreinte du compte (jamais l'identifiant ni l'e-mail) → { calls, spentUsd }.
    byAccount: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true, minimize: false },
);

altimmoAdvisorUsageSchema.index({ environment: 1, provider: 1, month: 1 }, { unique: true });

module.exports = mongoose.models.AltimmoAdvisorUsage || mongoose.model('AltimmoAdvisorUsage', altimmoAdvisorUsageSchema);
