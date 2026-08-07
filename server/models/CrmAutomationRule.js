// CRM-AUTOMATION-1 — Registre déclaratif des règles d'automatisation.
// Une règle ne contient JAMAIS de logique métier : elle référence un
// `triggerEvent` (le champ `type` d'une Notification déjà émise par un
// domaine existant — GL, Hôtel, Accommodation, Finance, CRM) et une liste
// d'actions identifiées par leur clé dans le registre de handlers
// (crmAutomationActions.js). Aucun `if` dispersé dans un contrôleur :
// activer/désactiver/prioriser une règle ne nécessite jamais de déploiement.
const mongoose = require('mongoose');

const conditionSchema = new mongoose.Schema({
  field: { type: String, required: true }, // ex: 'metadata.pole', 'audience'
  op: { type: String, enum: ['eq', 'ne', 'in', 'exists'], default: 'eq' },
  value: { type: mongoose.Schema.Types.Mixed, default: null },
}, { _id: false });

const actionSchema = new mongoose.Schema({
  actionId: { type: String, required: true }, // clé dans ACTION_HANDLERS
  params: { type: mongoose.Schema.Types.Mixed, default: {} },
}, { _id: false });

const schema = new mongoose.Schema({
  ruleId: { type: String, required: true, unique: true, trim: true, maxlength: 100 },
  label: { type: String, required: true, trim: true, maxlength: 200 },
  description: { type: String, default: '', maxlength: 1000 },
  // Correspond exactement à Notification.type (voir models/Notification.js,
  // NOTIFICATION_TYPES) — jamais un nouvel événement inventé par ce moteur.
  triggerEvent: { type: String, required: true, index: true },
  conditions: { type: [conditionSchema], default: [] },
  actions: { type: [actionSchema], default: [], validate: (v) => v.length > 0 },
  priority: { type: Number, default: 100 }, // plus petit = exécuté en premier
  enabled: { type: Boolean, default: true, index: true },
  // Phase 4 — "relance automatique si aucune évolution après délai
  // configurable" : délai optionnel utilisé par les actions de type rappel.
  delayMinutes: { type: Number, default: 0 },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
}, { timestamps: true });

schema.index({ triggerEvent: 1, enabled: 1, priority: 1 });

module.exports = mongoose.model('CrmAutomationRule', schema);
