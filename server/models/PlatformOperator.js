// PLATFORM-ADMIN-1 — Identité canonique de l'administrateur central de la
// plateforme, distincte de `User.role === 'Admin'` (qui reste strictement
// tenant-scopé, voir TENANT-HARDENING-2 §8 et platformTenantRoutes.js).
//
// Pourquoi un modèle et pas un booléen sur User (mission §9-10) : un simple
// flag ne permettrait ni traçabilité (qui a accordé/révoqué, quand,
// pourquoi), ni capacités granulaires, ni séparation des responsabilités
// (un opérateur ne doit pouvoir en promouvoir un autre que s'il détient
// explicitement `platform.operators.manage`). Un document par utilisateur,
// jamais supprimé physiquement — révoqué/suspendu via `status`, l'historique
// du dernier octroi et de la dernière révocation/suspension reste lisible
// directement sur le document (pas de collection d'audit séparée créée ici :
// chaque transition émet également une entrée `ActionLog`, voir
// `platformOperatorService.js`).
const mongoose = require('mongoose');
const { PLATFORM_OPERATOR_CAPABILITIES, PLATFORM_OPERATOR_STATUSES } = require('../constants/platformOperatorConstants');

const schema = new mongoose.Schema({
  // Unique : un seul document PlatformOperator par utilisateur, quel que
  // soit son statut. Une réattribution après révocation réutilise ce même
  // document (voir platformOperatorService.grantOperator) plutôt que d'en
  // créer un second, pour ne jamais fragmenter l'historique d'un utilisateur.
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  status: { type: String, enum: PLATFORM_OPERATOR_STATUSES, default: 'active', index: true },
  capabilities: [{ type: String, enum: PLATFORM_OPERATOR_CAPABILITIES }],

  grantedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  grantedAt: { type: Date, default: Date.now },
  grantReason: { type: String, required: true, trim: true, maxlength: 1000 },

  suspendedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  suspendedAt: { type: Date, default: null },
  suspensionReason: { type: String, maxlength: 1000, default: null },

  revokedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  revokedAt: { type: Date, default: null },
  revokeReason: { type: String, maxlength: 1000, default: null },
}, { timestamps: true });

module.exports = mongoose.model('PlatformOperator', schema);
module.exports.PLATFORM_OPERATOR_CAPABILITIES = PLATFORM_OPERATOR_CAPABILITIES;
module.exports.PLATFORM_OPERATOR_STATUSES = PLATFORM_OPERATOR_STATUSES;
