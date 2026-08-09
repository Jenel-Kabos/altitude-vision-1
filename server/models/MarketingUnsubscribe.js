// MARKETING-AUTOMATION-1 — Liste de suppression globale. Une fois un email
// désabonné, AUCUNE campagne future (quel que soit le segment) ne doit lui
// être adressée — vérifié par marketingCampaignService avant chaque envoi,
// jamais une simple mention dans MarketingSend (qui ne fait qu'historiser
// un envoi déjà eu lieu).
const mongoose = require('mongoose');

const schema = new mongoose.Schema({
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  channel: { type: String, default: 'email' },
  unsubscribedAt: { type: Date, default: Date.now },
  source: { type: String, default: 'campaign' }, // 'campaign' | 'manual' | 'complaint'
}, { timestamps: true });

module.exports = mongoose.model('MarketingUnsubscribe', schema);
