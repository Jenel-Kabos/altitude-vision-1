const mongoose = require('mongoose');

const sourceRefSchema = new mongoose.Schema({
  entityType: { type: String, required: true, enum: ['User', 'Proprietaire', 'Locataire', 'ContactMessage', 'QuoteRequest', 'AltcomProject'] },
  entityId: { type: mongoose.Schema.Types.ObjectId, required: true },
  source: { type: String, required: true },
}, { _id: false });

const auditSchema = new mongoose.Schema({
  action: { type: String, required: true },
  actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  at: { type: Date, default: Date.now },
  metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
}, { _id: false });

const schema = new mongoose.Schema({
  kind: { type: String, enum: ['person', 'organization'], default: 'person', index: true },
  displayName: { type: String, required: true, trim: true, maxlength: 200 },
  firstName: { type: String, trim: true, default: '' },
  lastName: { type: String, trim: true, default: '' },
  company: { type: String, trim: true, default: '' },
  emails: [{ type: String, lowercase: true, trim: true }],
  phones: [{ type: String, trim: true }],
  addresses: [{ label: String, line: String, city: String, country: String }],
  languages: [{ type: String, trim: true }],
  identityKeys: [{ type: String, required: true }],
  // USER-ARCH-1 — 'exploitant_etablissement' ajouté de façon additive :
  // distingue la personne qui EXPLOITE un hébergement/hôtel (ce champ) du
  // client qui y séjourne ('client_hotel'/'client_hebergement', inchangés).
  relations: [{ type: String, enum: ['proprietaire', 'locataire', 'acheteur', 'vendeur', 'voyageur', 'client_hotel', 'client_hebergement', 'client_altcom', 'organisateur', 'sponsor', 'partenaire', 'prestataire', 'prospect', 'exploitant_etablissement'] }],
  sourceRefs: [sourceRefSchema],
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  status: { type: String, enum: ['active', 'archived', 'merge_review'], default: 'active', index: true },
  mergedInto: { type: mongoose.Schema.Types.ObjectId, ref: 'CrmCustomer', default: null, index: true },
  audit: [auditSchema],
}, { timestamps: true });

schema.index({ identityKeys: 1 }, { unique: true, name: 'one_crm_customer_per_identity_key' });
schema.index({ 'sourceRefs.entityType': 1, 'sourceRefs.entityId': 1 }, { unique: true, name: 'one_crm_customer_per_source' });
schema.index({ displayName: 'text', company: 'text', emails: 'text', phones: 'text' });

module.exports = mongoose.model('CrmCustomer', schema);
