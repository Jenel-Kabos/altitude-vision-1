// server/models/RatePlan.js
//
// Grille tarifaire d'un Accommodation, séparée pour rester versionnable et
// réutilisable (Sprint 1.5, §02 — décision architecturale validée). Aucun
// moteur de calcul ici : un tarif est saisi explicitement par mode, jamais
// déduit automatiquement d'un autre (ex : le prix mensuel n'est jamais
// `nightly × 30`).
//
// Sprint 2 (MVP) : nightly/weekly/monthly exposés. 'yearly' existe dans
// l'enum pour éviter une migration de schéma au Sprint 3, mais n'est pas
// exposé côté formulaire tant qu'un besoin réel n'est pas confirmé.
// Aucune saisonnalité, promotion ou tarification dynamique dans ce sprint.

const mongoose = require('mongoose');

const RATE_MODES = ['nightly', 'weekly', 'monthly', 'yearly'];

const ratePlanSchema = new mongoose.Schema(
  {
    accommodation: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Accommodation',
      required: [true, 'RatePlan doit référencer un Accommodation.'],
      index: true,
    },
    mode: {
      type: String,
      enum: { values: RATE_MODES, message: 'Mode tarifaire invalide : {VALUE}.' },
      required: [true, 'Le mode tarifaire est requis.'],
    },
    amount: {
      type: Number,
      required: [true, 'Un montant est requis.'],
      min: [0, 'Le montant ne peut pas être négatif.'],
    },
    currency: { type: String, default: 'XAF' },
    active: { type: Boolean, default: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true },
);

// Un seul tarif ACTIF par (accommodation, mode) — plusieurs tarifs inactifs
// (historique) peuvent coexister, d'où l'absence d'index unique strict ici ;
// l'unicité de l'actif est appliquée par le service, pas par la base.
ratePlanSchema.index({ accommodation: 1, mode: 1, active: 1 });

const RatePlan = mongoose.model('RatePlan', ratePlanSchema);
RatePlan.RATE_MODES = RATE_MODES;

module.exports = RatePlan;
