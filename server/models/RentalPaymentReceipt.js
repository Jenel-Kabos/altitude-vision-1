// server/models/RentalPaymentReceipt.js — GL-DEBT-1 (Phases 5-9)
//
// Historique granulaire des encaissements locatifs, additif à Paiement (qui
// reste l'échéance ET la vue agrégée "dernier état connu" — inchangé pour
// ne casser aucun consommateur existant : Vue d'ensemble, portail locataire,
// documents, quittances, statistiques). Un RentalPaymentReceipt représente
// UN encaissement réel contre UNE échéance (Paiement) — plusieurs reçus
// peuvent viser la même échéance (versements partiels successifs), ce que
// Paiement seul (un train de champs montantRecu/statut) ne pouvait pas
// GL-DEBT-1.1 : un même encaissement peut désormais être réparti sur
// PLUSIEURS échéances (`encaisserMultiple`) — dans ce cas, un
// RentalPaymentReceipt est créé PAR échéance touchée, tous partageant le
// même `encaissementId` (identifiant de regroupement, généré une fois par
// appel). Annulation/réversion reste volontairement à la granularité de
// l'échéance (annuler une ligne de l'encaissement n'annule pas les autres) —
// comportement métier attendu, chaque échéance ayant son propre solde.
//
// Ne remplace ni ne supprime Paiement. N'est PAS un domaine du Financial
// Core (FinancialPayment/PaymentAllocation) : mélanger la facturation
// hôtelière/immobilière-transactionnelle avec l'encaissement de loyer
// créerait la confusion que la mission demande explicitement d'éviter.

const mongoose = require('mongoose');

const STATUSES = ['confirmed', 'cancelled'];

const rentalPaymentReceiptSchema = new mongoose.Schema({
  paiement: { type: mongoose.Schema.Types.ObjectId, ref: 'Paiement', required: true, index: true },
  contrat:  { type: mongoose.Schema.Types.ObjectId, ref: 'Contrat', required: true, index: true },

  montant:      { type: Number, required: true, min: 0.01 },
  datePaiement: { type: Date, required: true },
  modePaiement: { type: String, enum: ['espèces', 'virement', 'chèque', 'mobile'], required: true },
  reference:    { type: String, trim: true },
  preuvePaiement: {
    url:      { type: String },
    publicId: { type: String },
  },

  auteur: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

  // GL-DEBT-1.1 — regroupe les reçus issus d'un même encaissement réparti
  // sur plusieurs échéances. `null` pour tous les reçus mono-échéance
  // existants (marquerPaye) — champ additif, aucune migration nécessaire.
  encaissementId: { type: mongoose.Schema.Types.ObjectId, default: null, index: true },

  // Idempotence — même clé que celle déjà envoyée par le client sur
  // marquerPaye (voir paiementController.js) : un rejeu réseau avec la même
  // clé ne doit jamais produire un second reçu.
  idempotencyKey: { type: String, trim: true, maxlength: 200 },

  statut: { type: String, enum: STATUSES, default: 'confirmed', index: true },

  // Annulation contrôlée (Phase 8) — jamais une suppression.
  cancelledAt:     { type: Date, default: null },
  cancelledBy:     { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  cancelledReason: { type: String, trim: true, default: '' },

  notes: { type: String, trim: true },
}, { timestamps: true });

rentalPaymentReceiptSchema.index({ paiement: 1, statut: 1 });
// Idempotence : la même clé ne peut produire qu'un seul reçu confirmé pour
// une même échéance (sparse — les anciens appels sans clé restent possibles).
rentalPaymentReceiptSchema.index(
  { paiement: 1, idempotencyKey: 1 },
  { unique: true, partialFilterExpression: { idempotencyKey: { $type: 'string' } } },
);

rentalPaymentReceiptSchema.statics.STATUSES = STATUSES;

module.exports = mongoose.model('RentalPaymentReceipt', rentalPaymentReceiptSchema);
