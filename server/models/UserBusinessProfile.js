// USER-ARCH-1 — Couche "profils métiers" entre l'identité (User) et les
// domaines (Property/Accommodation/Hotel/...). Calqué exactement sur le
// patron déjà éprouvé de HotelStaffAssignment.js (même forme : user,
// type/rôle, status actif/suspendu/révoqué, audit trail complet) — pas une
// nouvelle architecture, l'extension du même patron au niveau User.
//
// Pourquoi un nouveau modèle plutôt que de tout dériver à la lecture :
// `Proprietaire`/`Hotel.manager`/`Accommodation` sont tous des références
// IMPLICITES (on ne sait qu'une personne "est" exploitant d'établissement
// qu'en constatant qu'elle possède déjà un Hotel/Accommodation) — impossible
// d'accorder un profil par anticipation (ex: onboarding, avant la création
// du premier établissement), et aucun de ces modèles ne peut porter un
// historique d'octroi/révocation explicite. `UserBusinessProfile` comble ce
// manque sans dupliquer aucune donnée métier existante : il ne fait que
// qualifier une identité, jamais un bien/établissement.
const mongoose = require('mongoose');
const { BUSINESS_PROFILE_TYPES, BUSINESS_PROFILE_STATUSES } = require('../constants/businessProfileConstants');

const ObjectId = mongoose.Schema.Types.ObjectId;

const schema = new mongoose.Schema({
  user: { type: ObjectId, ref: 'User', required: true },
  profileType: { type: String, enum: BUSINESS_PROFILE_TYPES, required: true },
  status: { type: String, enum: BUSINESS_PROFILE_STATUSES, default: 'active' },
  // Origine du profil : 'manual' (accordé par un staff), 'derived' (déduit
  // automatiquement des données existantes lors du backfill/synchronisation
  // — voir userBusinessProfileService.deriveProfilesFromExistingData).
  source: { type: String, enum: ['manual', 'derived'], default: 'manual' },
  grantedBy: { type: ObjectId, ref: 'User', default: null },
  grantedAt: { type: Date, default: Date.now },
  suspendedBy: { type: ObjectId, ref: 'User', default: null },
  suspendedAt: { type: Date, default: null },
  suspensionReason: { type: String, maxlength: 1000, default: null },
  revokedBy: { type: ObjectId, ref: 'User', default: null },
  revokedAt: { type: Date, default: null },
  revocationReason: { type: String, maxlength: 1000, default: null },
  // Contexte libre non-normatif (ex: établissement d'origine ayant motivé
  // l'octroi) — jamais lu par une règle d'autorisation, uniquement
  // informatif/audit, à l'image de HotelStaffAssignment.metadata.
  metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
}, { timestamps: true });

schema.index({ user: 1, status: 1 });
schema.index({ profileType: 1, status: 1 });
// Un seul profil actif par (user, profileType) — même convention que
// HotelStaffAssignment (égalité simple sur `status` dans le
// partialFilterExpression, les opérateurs comme $ne n'étant pas fiables ici).
schema.index(
  { user: 1, profileType: 1 },
  { unique: true, partialFilterExpression: { status: 'active' } },
);

module.exports = mongoose.model('UserBusinessProfile', schema);
