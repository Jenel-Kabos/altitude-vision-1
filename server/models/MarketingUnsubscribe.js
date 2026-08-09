// MARKETING-AUTOMATION-1 — Liste de suppression globale. Une fois un email
// désabonné, AUCUNE campagne future (quel que soit le segment) ne doit lui
// être adressée — vérifié par marketingCampaignService avant chaque envoi,
// jamais une simple mention dans MarketingSend (qui ne fait qu'historiser
// un envoi déjà eu lieu).
const mongoose = require('mongoose');

const schema = new mongoose.Schema({
  tenant: { type: mongoose.Schema.Types.ObjectId, ref: 'PlatformTenant', default: null, index: true },
  email: { type: String, required: true, lowercase: true, trim: true },
  channel: { type: String, default: 'email' },
  unsubscribedAt: { type: Date, default: Date.now },
  source: { type: String, default: 'campaign' }, // 'campaign' | 'manual' | 'complaint'
}, { timestamps: true });

schema.index({ tenant: 1, email: 1 }, { unique: true });

module.exports = mongoose.model('MarketingUnsubscribe', schema);
