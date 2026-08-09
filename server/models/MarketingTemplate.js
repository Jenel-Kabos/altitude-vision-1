// MARKETING-AUTOMATION-1 (Phase 6) — Modèle de message, versionné,
// indépendant du canal de diffusion (le même corps `{{prenom}}` peut, en
// théorie, alimenter un email ou une notification — seul `subject` n'a de
// sens que pour l'email). Jamais un remplacement des générateurs PDF
// existants (pdfService.js) — ceci concerne des messages courts, pas des
// documents contractuels.
const mongoose = require('mongoose');

const TEMPLATE_CHANNELS = ['email', 'push', 'notification', 'sms', 'whatsapp'];
const TEMPLATE_STATUSES = ['draft', 'active', 'archived'];

const schema = new mongoose.Schema({
  tenant: { type: mongoose.Schema.Types.ObjectId, ref: 'PlatformTenant', default: null, index: true },
  name: { type: String, required: true, trim: true, maxlength: 200 },
  channel: { type: String, enum: TEMPLATE_CHANNELS, required: true },
  subject: { type: String, trim: true, maxlength: 200, default: '' }, // email uniquement
  body: { type: String, required: true, maxlength: 10000 },
  // Variables déclarées explicitement (ex: ['prenom','bienTitre']) — sert à
  // la prévisualisation (Phase 6) et à valider qu'aucune variable inconnue
  // n'est utilisée dans `body` sans être documentée.
  variables: { type: [String], default: [] },
  version: { type: Number, default: 1 },
  status: { type: String, enum: TEMPLATE_STATUSES, default: 'draft', index: true },
  // Versionnement (Phase 6) : chaque édition d'un modèle actif crée une
  // NOUVELLE version liée à la précédente — jamais une modification en
  // place d'une version déjà utilisée par une campagne envoyée (historique
  // exact préservé pour l'audit).
  previousVersion: { type: mongoose.Schema.Types.ObjectId, ref: 'MarketingTemplate', default: null },
  family: { type: String, required: true, index: true }, // identifiant stable partagé entre toutes les versions d'un même modèle
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
}, { timestamps: true });

schema.index({ tenant: 1, family: 1, version: -1 });
schema.index({ tenant: 1, family: 1, status: 1 });

module.exports = mongoose.model('MarketingTemplate', schema);
module.exports.TEMPLATE_CHANNELS = TEMPLATE_CHANNELS;
module.exports.TEMPLATE_STATUSES = TEMPLATE_STATUSES;
