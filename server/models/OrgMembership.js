// ORGANIZATION-1 — Appartenance d'un utilisateur à une unité
// organisationnelle (Organisation/Filiale/Établissement/Département/Équipe).
// Même patron d'audit que HotelStaffAssignment/UserBusinessProfile (déjà
// deux fois établi dans ce codebase) : statut actif/suspendu/révoqué, trace
// complète d'octroi/suspension/révocation, jamais de suppression physique.
//
// Volontairement un modèle séparé de HotelStaffAssignment (intrinsèquement
// lié à `hotel`, `required:true`) et de UserBusinessProfile (enum plat
// `profileType`, une seule dimension) — voir audit Phase 1 : aucun des deux
// ne peut représenter "quelle équipe/département" sans détourner son sens.
const mongoose = require('mongoose');
const { ROLE_IN_UNIT, MEMBERSHIP_STATUSES } = require('../constants/organizationConstants');

const schema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  orgUnit: { type: mongoose.Schema.Types.ObjectId, ref: 'OrgUnit', required: true, index: true },
  roleInUnit: { type: String, enum: ROLE_IN_UNIT, default: 'member' },
  status: { type: String, enum: MEMBERSHIP_STATUSES, default: 'active' },
  grantedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  grantedAt: { type: Date, default: Date.now },
  suspendedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  suspendedAt: { type: Date, default: null },
  suspensionReason: { type: String, maxlength: 1000, default: null },
  revokedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  revokedAt: { type: Date, default: null },
  revocationReason: { type: String, maxlength: 1000, default: null },
  metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
}, { timestamps: true });

schema.index({ user: 1, status: 1 });
schema.index({ orgUnit: 1, status: 1 });
// Un utilisateur peut porter plusieurs rôles dans la MÊME unité (ex :
// 'member' d'une équipe ET 'lead' d'un département parent — deux unités
// différentes, deux memberships) mais jamais deux fois le même rôle actif
// dans la même unité.
schema.index({ user: 1, orgUnit: 1, roleInUnit: 1 }, { unique: true, partialFilterExpression: { status: 'active' } });

module.exports = mongoose.model('OrgMembership', schema);
