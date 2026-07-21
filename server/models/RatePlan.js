// server/models/RatePlan.js
//
// Grille tarifaire, séparée pour rester versionnable et réutilisable
// (Sprint 1.5, §02 — décision architecturale validée). Aucun moteur de
// calcul ici : un tarif est saisi explicitement, jamais déduit
// automatiquement d'un autre (ex : le prix mensuel n'est jamais
// `nightly × 30`).
//
// Sprint 2 (MVP) : nightly/weekly/monthly exposés pour Accommodation.
// 'yearly' existe dans l'enum pour éviter une migration de schéma, mais
// n'est pas exposé côté formulaire tant qu'un besoin réel n'est pas
// confirmé. Aucune saisonnalité, promotion ou tarification dynamique reliée
// à un moteur de réservation dans ce sprint.
//
// Sprint B2 (Hôtellerie) — ADDITIF, aucune migration : un RatePlan
// référence désormais SOIT un Accommodation (hébergement indépendant,
// `mode` nightly/weekly/monthly/yearly, comportement Sprint B1 inchangé à
// l'identique), SOIT une RoomCategory (`rateType` public/entreprise/
// weekend/promotion/haute_saison) — jamais les deux à la fois. `RatePlan`
// n'est plus jamais lié directement à `Hotel` : Hotel → RoomCategory →
// RatePlan (voir RoomCategory.js et HOTEL_V2.md).

const mongoose = require('mongoose');

const RATE_MODES = ['nightly', 'weekly', 'monthly', 'yearly'];
const RATE_TYPES = ['public', 'entreprise', 'weekend', 'promotion', 'haute_saison'];

const ratePlanSchema = new mongoose.Schema(
  {
    // Pas de `index: true` ici : l'index composé ci-dessous (accommodation+
    // mode, unique partiel) préfixe déjà ce champ seul — un index simple
    // séparé serait strictement redondant (constaté à l'audit final Sprint
    // B2, corrigé : doublon d'index supprimé).
    accommodation: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Accommodation',
      default: null,
    },
    mode: {
      type: String,
      enum: { values: RATE_MODES, message: 'Mode tarifaire invalide : {VALUE}.' },
      default: null,
    },

    // Sprint B2 — tarification par catégorie de chambres. Idem : pas
    // d'index simple séparé, préfixé par l'index composé roomCategory+rateType.
    roomCategory: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'RoomCategory',
      default: null,
    },
    rateType: {
      type: String,
      enum: { values: RATE_TYPES, message: 'Type de tarif invalide : {VALUE}.' },
      default: null,
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

// Exactement une des deux paires (accommodation+mode) XOR
// (roomCategory+rateType) — jamais les deux, jamais aucune.
ratePlanSchema.pre('validate', function enforceExactlyOneTarget(next) {
  const hasAccommodation = Boolean(this.accommodation) && Boolean(this.mode);
  const hasRoomCategory = Boolean(this.roomCategory) && Boolean(this.rateType);
  if (hasAccommodation === hasRoomCategory) {
    // soit aucune paire complète, soit les deux à la fois : rejeté
    this.invalidate(
      'accommodation',
      "Un RatePlan doit référencer exactement une cible : (accommodation + mode) OU (roomCategory + rateType), jamais les deux.",
    );
  }
  next();
});

// Contrôle final (audit Sprint B2) — un seul tarif ACTIF par (accommodation,
// mode) ou par (roomCategory, rateType) était jusqu'ici appliqué UNIQUEMENT
// par la logique applicative (le service désactive l'ancien actif avant
// d'en créer un nouveau, jamais une mutation en place) : deux appels
// concurrents pouvaient tous deux constater "aucun actif" et créer chacun
// un tarif actif, produisant deux tarifs actifs simultanés pour la même
// cible/type. Corrigé par un index unique PARTIEL (porte uniquement sur les
// documents actifs ET réellement ciblés — `$type: 'objectId'`/`'string'`
// exclut les documents dont le champ vaut `null`, qui sinon seraient tous
// traités comme une même valeur "null" par l'unicité Mongo et entreraient
// en collision entre eux). Les tarifs inactifs (historique) ne sont jamais
// concernés par cette contrainte et peuvent coexister sans limite.
ratePlanSchema.index(
  { accommodation: 1, mode: 1 },
  {
    unique: true,
    partialFilterExpression: { active: true, accommodation: { $type: 'objectId' }, mode: { $type: 'string' } },
  },
);
ratePlanSchema.index(
  { roomCategory: 1, rateType: 1 },
  {
    unique: true,
    partialFilterExpression: { active: true, roomCategory: { $type: 'objectId' }, rateType: { $type: 'string' } },
  },
);

const RatePlan = mongoose.model('RatePlan', ratePlanSchema);
RatePlan.RATE_MODES = RATE_MODES;
RatePlan.RATE_TYPES = RATE_TYPES;

module.exports = RatePlan;
