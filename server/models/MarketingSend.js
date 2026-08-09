// MARKETING-AUTOMATION-1 (Phase 7) — Journal d'envoi, un document par
// destinataire. Seule source des KPI "envois/ouvertures/clics/échecs/
// désabonnements" (Phase 7) — Reporting ne recalcule jamais ceci depuis
// d'autres collections, il l'agrège tel quel (voir
// services/reporting/domains/marketingReport.js).
const mongoose = require('mongoose');

const SEND_STATUSES = ['sent', 'failed', 'opened', 'clicked', 'unsubscribed'];

const schema = new mongoose.Schema({
  // Une campagne (envoi de masse, Phase 4) OU un déclenchement de workflow
  // individuel (Phase 5, ruleId CrmAutomationRule) — jamais les deux, l'un
  // des deux est toujours renseigné pour distinguer l'origine de l'envoi.
  campaign: { type: mongoose.Schema.Types.ObjectId, ref: 'MarketingCampaign', default: null, index: true },
  workflowRuleId: { type: String, default: null, index: true },
  template: { type: mongoose.Schema.Types.ObjectId, ref: 'MarketingTemplate', required: true },
  channel: { type: String, required: true },
  recipientCustomer: { type: mongoose.Schema.Types.ObjectId, ref: 'CrmCustomer', default: null },
  recipientUser: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  recipientEmail: { type: String, default: null },
  status: { type: String, enum: SEND_STATUSES, default: 'sent', index: true },
  error: { type: String, default: null },
  sentAt: { type: Date, default: Date.now },
  openedAt: { type: Date, default: null },
  clickedAt: { type: Date, default: null },
  unsubscribedAt: { type: Date, default: null },
}, { timestamps: true });

schema.index({ campaign: 1, status: 1 });
schema.index({ createdAt: -1 });

module.exports = mongoose.model('MarketingSend', schema);
module.exports.SEND_STATUSES = SEND_STATUSES;
