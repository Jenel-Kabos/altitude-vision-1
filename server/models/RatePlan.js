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

// PHASE-H5 — conditions commerciales, ADDITIVES uniquement (aucune migration
// destructive) : les RatePlans existants n'ont aucun de ces champs, ce qui
// reste une valeur légale (`null` = condition inconnue/héritée du régime
// pré-H5), jamais interprétée comme une promesse favorable ("pas de
// mealPlan" ≠ "petit-déjeuner inclus", "pas de cancellation" ≠
// "remboursable" — voir audit HOTEL_H2/H3_REPORT.md, classification E,
// et mission H5 §4/§6). `refundable` n'existe PAS comme champ indépendant :
// il est TOUJOURS dérivé de `cancellation.type` (mission §6) pour éviter un
// état contradictoire (refundable=true + cancellation.type=non_refundable).
const MEAL_PLANS = ['room_only', 'breakfast_included', 'half_board', 'full_board'];
const CANCELLATION_TYPES = ['free_until', 'non_refundable', 'flexible'];
const PENALTY_TYPES = ['percentage', 'fixed_amount'];

const cancellationPolicySchema = new mongoose.Schema({
  type: { type: String, enum: CANCELLATION_TYPES, required: true },
  // Pertinents uniquement pour free_until/flexible — `non_refundable` ne
  // doit jamais transporter de délai/pénalité (contradictoire, rejeté à la
  // validation ci-dessous).
  deadlineHoursBeforeCheckIn: { type: Number, min: 0, default: null },
  penaltyType: { type: String, enum: PENALTY_TYPES, default: null },
  penaltyValue: { type: Number, min: 0, default: null },
}, { _id: false });

cancellationPolicySchema.pre('validate', function enforceCoherence(next) {
  if (this.type === 'non_refundable') {
    if (this.deadlineHoursBeforeCheckIn != null || this.penaltyType != null || this.penaltyValue != null) {
      this.invalidate('type', 'Une politique "non remboursable" ne peut pas porter de délai ou de pénalité (configuration contradictoire).');
    }
  } else if (this.deadlineHoursBeforeCheckIn == null) {
    this.invalidate('deadlineHoursBeforeCheckIn', 'Un délai d’annulation (en heures avant l’arrivée) est requis pour ce type de politique.');
  }
  if (this.penaltyType === 'percentage' && this.penaltyValue != null && this.penaltyValue > 100) {
    this.invalidate('penaltyValue', 'Un pourcentage de pénalité ne peut pas dépasser 100.');
  }
  next();
});

const seasonalPeriodSchema = new mongoose.Schema({
  label: { type: String, trim: true, maxlength: 80, default: '' },
  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },
  amount: { type: Number, required: true, min: 0 },
  priority: { type: Number, default: 0, min: 0 },
}, { _id: true });

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
    // PHASE-H5 — `null` = legacy/inconnu, jamais un défaut favorable fabriqué.
    mealPlan: { type: String, enum: MEAL_PLANS, default: null },
    cancellation: { type: cancellationPolicySchema, default: null },
    // C29 — périodes inclusives au départ et exclusives à la fin. Elles
    // restent dans le RatePlan existant afin de ne pas créer un second
    // moteur tarifaire. Une nuit sans période applicable retombe sur
    // `amount`; la priorité la plus élevée gagne en cas de chevauchement.
    seasonalPeriods: { type: [seasonalPeriodSchema], default: [] },
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
  const periods = this.seasonalPeriods || [];
  periods.forEach((period) => {
    if (period.startDate && period.endDate && period.endDate <= period.startDate) {
      this.invalidate('seasonalPeriods', 'La fin d’une période tarifaire doit être postérieure à son début.');
    }
  });
  // Deux périodes qui se chevauchent avec la même priorité rendraient la
  // résolution ambiguë. Les chevauchements restent permis uniquement si la
  // priorité tranche explicitement.
  for (let i = 0; i < periods.length; i += 1) {
    for (let j = i + 1; j < periods.length; j += 1) {
      const a = periods[i]; const b = periods[j];
      const overlaps = a.startDate < b.endDate && b.startDate < a.endDate;
      if (overlaps && a.priority === b.priority) {
        this.invalidate('seasonalPeriods', 'Deux périodes tarifaires qui se chevauchent doivent avoir des priorités différentes.');
      }
    }
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
RatePlan.MEAL_PLANS = MEAL_PLANS;
RatePlan.CANCELLATION_TYPES = CANCELLATION_TYPES;
RatePlan.PENALTY_TYPES = PENALTY_TYPES;

module.exports = RatePlan;
