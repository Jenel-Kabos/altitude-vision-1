// TENANT-CORE-1 (Phase 5) — Configuration par PlatformTenant : devise,
// langue, fuseau horaire, email de contact. Ces valeurs sont AUJOURD'HUI
// des constantes en dur dans tout le codebase (FCFA, fr-FR partout — voir
// audit Phase 1) : les stocker ici est une VRAIE addition, jamais une
// duplication d'un paramètre déjà configurable ailleurs (aucun ne l'est).
// Relation 1:1 avec PlatformTenant (jamais fusionné dans PlatformTenant
// lui-même pour ne pas mélanger identité/statut du tenant et préférences
// d'affichage, qui évoluent à des rythmes différents).
const mongoose = require('mongoose');

const schema = new mongoose.Schema({
  tenant: { type: mongoose.Schema.Types.ObjectId, ref: 'PlatformTenant', required: true, unique: true, index: true },
  currency: { type: String, trim: true, default: 'XAF', maxlength: 10 },
  language: { type: String, trim: true, default: 'fr', maxlength: 10 },
  timezone: { type: String, trim: true, default: 'Africa/Brazzaville', maxlength: 60 },
  contactEmail: { type: String, trim: true, lowercase: true, default: null },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
}, { timestamps: true });

module.exports = mongoose.model('PlatformTenantSettings', schema);
