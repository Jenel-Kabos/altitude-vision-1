// CRM-AUTOMATION-1 — Journal d'exécution, append-only : trace chaque
// déclenchement d'une règle (succès, échec, ou simulation) pour que
// l'administration (Phase 7) puisse auditer/déboguer sans jamais avoir à
// relire les logs serveur bruts.
const mongoose = require('mongoose');

const schema = new mongoose.Schema({
  tenant: { type: mongoose.Schema.Types.ObjectId, ref: 'PlatformTenant', default: null, index: true },
  rule: { type: mongoose.Schema.Types.ObjectId, ref: 'CrmAutomationRule', required: true, index: true },
  ruleId: { type: String, required: true }, // dénormalisé — survit même si la règle est supprimée
  triggerEvent: { type: String, required: true },
  entityType: { type: String, default: null },
  entityId: { type: mongoose.Schema.Types.ObjectId, default: null },
  status: { type: String, enum: ['success', 'error', 'skipped', 'simulated'], required: true },
  actionsRun: { type: [String], default: [] },
  error: { type: String, default: null },
  simulated: { type: Boolean, default: false },
}, { timestamps: true });

schema.index({ createdAt: -1 });
schema.index({ tenant: 1, ruleId: 1, createdAt: -1 });

module.exports = mongoose.model('CrmAutomationRun', schema);
