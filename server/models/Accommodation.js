// server/models/Accommodation.js
//
// Satellite 1-à-1 de Property pour le domaine Hébergement — même pattern que
// RentalManagement.js pour la Location (voir Sprint 1.5, §02). Property reste
// le noyau commun (titre, description, adresse, coordonnées, propriétaire,
// images principales) ; ce modèle ne porte QUE ce qui n'a aucun sens pour
// Vente ou Location.
//
// Sprint 2 (MVP) : logements meublés entiers uniquement (occupancyMode
// toujours 'entire_place'). Hotel/RoomType/Room ne sont volontairement PAS
// créés — voir Sprint 1.5 §09 pour le périmètre exact.

const mongoose = require('mongoose');

const ACCOMMODATION_TYPES = [
  'villa_meublee',
  'maison_meublee',
  'appartement_meuble',
  'studio_meuble',
  'residence_meublee',
  'bungalow',
];

const accommodationSchema = new mongoose.Schema(
  {
    // Property reste l'unique représentation du bien physique et de son
    // annonce (titre, description, adresse, coordonnées, images, owner).
    property: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Property',
      required: [true, 'Accommodation doit référencer un Property.'],
      unique: true,
      index: true,
    },

    accommodationType: {
      type: String,
      enum: {
        values: ACCOMMODATION_TYPES,
        message: 'Type d\'hébergement invalide : {VALUE}.',
      },
      required: [true, "Le type d'hébergement est requis."],
    },

    // Sprint 2 : uniquement des logements entiers. Le champ existe déjà pour
    // ne pas avoir à migrer le schéma au Sprint 4 (chambres d'hôtel).
    occupancyMode: {
      type: String,
      enum: ['entire_place'],
      default: 'entire_place',
      required: true,
    },

    furnished: { type: Boolean, default: true },

    capacity: {
      maxAdults:   { type: Number, min: 1, default: 2 },
      maxChildren: { type: Number, min: 0, default: 0 },
    },

    // bedrooms/bathrooms ne sont PAS dupliqués ici : Property.bedrooms et
    // Property.bathrooms restent l'unique source de vérité (déjà affichés
    // partout — cards, stats, formulaire d'édition). "beds" (lits) est en
    // revanche un concept propre à l'hébergement meublé, sans équivalent
    // Property (peut différer du nombre de chambres : canapé-lit, lits
    // superposés…), donc légitimement porté ici.
    beds: { type: Number, min: 0, default: 0 },

    checkInTime:  { type: String, default: '14:00' }, // "HH:MM"
    checkOutTime: { type: String, default: '11:00' },

    minimumStay: { type: Number, min: 1, default: 1 }, // nuitées
    maximumStay: { type: Number, min: 1, default: null },

    // amenities n'est PAS dupliqué ici : Property.amenities reste l'unique
    // source de vérité, déjà affichée sur toutes les pages (detail, cards).
    houseRules: { type: [String], default: [] },

    cancellationPolicy: {
      type: String,
      enum: ['flexible', 'moderee', 'stricte'],
      default: 'moderee',
    },

    // Distincte de la caution de bail (Contrat.montantCaution) — libellé
    // dédié côté UI ("Caution de séjour"), jamais affichée comme une caution
    // locative.
    securityDeposit: { type: Number, min: 0, default: 0 },
    cleaningFee:     { type: Number, min: 0, default: 0 },

    currency: { type: String, default: 'XAF' },

    // Gate de complétude/qualité propre à Hébergement — s'ADDITIONNE à
    // Property.statusAdmin (qui reste l'unique gate de modération générale,
    // inchangé). Un hébergement n'est visible publiquement que si les DEUX
    // conditions sont réunies (voir accommodationService.isPubliclyVisible).
    publicationStatus: {
      type: String,
      enum: ['brouillon', 'soumis', 'publie', 'rejete'],
      default: 'brouillon',
      index: true,
    },
    rejectionReason: { type: String, trim: true, default: '' },
    submittedAt: { type: Date, default: null },
    publishedAt: { type: Date, default: null },
    reviewedBy:  { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true },
);

const Accommodation = mongoose.model('Accommodation', accommodationSchema);
Accommodation.ACCOMMODATION_TYPES = ACCOMMODATION_TYPES;

module.exports = Accommodation;
