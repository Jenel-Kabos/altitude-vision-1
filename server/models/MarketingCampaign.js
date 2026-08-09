// MARKETING-AUTOMATION-1 (Phase 4) — Campagne = audience (segment déclaré,
// jamais stocké) + modèle + canal. RÈGLE DURE : la création d'une campagne
// ne déclenche JAMAIS un envoi — `status` doit passer explicitement par
// 'approved' (action humaine distincte de la création) avant que
// marketingCampaignService.sendCampaign() puisse s'exécuter. Aucune
// campagne ne s'auto-envoie au changement de statut.
const mongoose = require('mongoose');

const CAMPAIGN_CHANNELS = ['email', 'push', 'notification', 'sms', 'whatsapp'];
const CAMPAIGN_STATUSES = ['draft', 'approved', 'sending', 'sent', 'cancelled'];

const schema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 200 },
  channel: { type: String, enum: CAMPAIGN_CHANNELS, required: true },
  template: { type: mongoose.Schema.Types.ObjectId, ref: 'MarketingTemplate', required: true },
  // Référence déclarative au registre de segments (marketingSegmentService.js)
  // — jamais une liste de destinataires stockée en dur.
  segmentKey: { type: String, required: true },
  segmentParams: { type: mongoose.Schema.Types.Mixed, default: {} }, // ex: {city:'Brazzaville'} ou {orgUnitId}
  status: { type: String, enum: CAMPAIGN_STATUSES, default: 'draft', index: true },
  scheduledAt: { type: Date, default: null },
  // Coût optionnel — seule base honnête pour un calcul de ROI (Phase 7) ;
  // si absent, le ROI est explicitement renvoyé `null`, jamais estimé.
  costMinor: { type: Number, default: null },
  approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  approvedAt: { type: Date, default: null },
  sentAt: { type: Date, default: null },
  cancelledBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  cancelledAt: { type: Date, default: null },
  stats: {
    totalRecipients: { type: Number, default: 0 },
    sentCount: { type: Number, default: 0 },
    failedCount: { type: Number, default: 0 },
  },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
}, { timestamps: true });

schema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model('MarketingCampaign', schema);
module.exports.CAMPAIGN_CHANNELS = CAMPAIGN_CHANNELS;
module.exports.CAMPAIGN_STATUSES = CAMPAIGN_STATUSES;
