// server/models/Accommodation.js
//
// Satellite 1-à-1 de Property pour le domaine Hébergement — même pattern que
// RentalManagement.js pour la Location (voir Sprint 1.5, §02). Property reste
// le noyau commun (titre, description, adresse, coordonnées, propriétaire,
// images principales) ; ce modèle ne porte QUE ce qui n'a aucun sens pour
// Vente ou Location.
//
// Sprint 2 (MVP) : logements meublés entiers uniquement (occupancyMode
// toujours 'entire_place'). RoomType/Room/Unit ne sont volontairement PAS
// créés — voir Sprint 1.5 §09 et server/docs/HEBERGEMENT.md ("Sprint Hôtel")
// pour le périmètre exact.
//
// Sprint Hôtel : accommodationType accepte désormais 'hotel' — dans ce cas,
// `hotel` référence l'établissement (voir Hotel.js), qui reste une fiche
// d'établissement et non une entité réservable. `occupancyMode` est forcé à
// 'room_based' pour ce type (voir hook pre('validate') plus bas) : la
// disponibilité/réservation d'un hôtel sera portée par une future entité
// Room/Unit (hors périmètre de ce sprint), jamais par l'établissement
// entier — contrairement aux logements meublés classiques
// ('entire_place'). Aucune logique de recherche/tarification/affichage ne
// lit ce champ à ce jour (vérifié par grep) : l'ajout de 'room_based' est
// donc sans impact sur le comportement existant.

const mongoose = require('mongoose');

const ACCOMMODATION_TYPES = [
  'villa_meublee',
  'maison_meublee',
  'appartement_meuble',
  'studio_meuble',
  'residence_meublee',
  'bungalow',
  'hotel',
  'residence_hoteliere',
  'chambre_hotes',
  'autre',
];

// Types pour lesquels une référence Hotel est acceptée/pertinente. Les
// logements meublés "entiers" classiques n'ont jamais de Hotel rattaché
// (voir accommodationController.buildAccommodationData).
const HOTEL_ACCOMMODATION_TYPES = ['hotel'];

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

    // Établissement hôtelier — renseigné uniquement quand accommodationType
    // === 'hotel' (voir HOTEL_ACCOMMODATION_TYPES). `null` pour tous les
    // autres types, y compris 'chambre_hotes' et 'residence_hoteliere' qui
    // n'exigent pas de fiche Hotel dans ce sprint.
    // Défense en profondeur : le contrôleur (buildHotelInput) impose déjà
    // une référence Hotel pour accommodationType='hotel' avant tout accès
    // base, mais l'invariant est aussi vérifié ici pour ne jamais dépendre
    // d'un seul point d'entrée (ex : un futur script de migration/import).
    hotel: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Hotel',
      default: null,
      index: true,
      validate: {
        validator: function hotelRequiredForHotelType(v) {
          return !HOTEL_ACCOMMODATION_TYPES.includes(this.accommodationType) || Boolean(v);
        },
        message: "Une référence à un établissement hôtelier (hotel) est requise pour accommodationType='hotel'.",
      },
    },

    // Sprint 2 : logements meublés entiers ('entire_place'). Sprint Hôtel :
    // 'room_based' pour accommodationType='hotel' — forcé par le hook
    // pre('validate') ci-dessous, jamais laissé au choix de l'appelant, pour
    // que l'invariant tienne quel que soit le point d'entrée (création
    // propriétaire, création/édition admin, futurs appels).
    occupancyMode: {
      type: String,
      enum: ['entire_place', 'room_based'],
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

// Invariant occupancyMode ⟺ accommodationType, appliqué à CHAQUE validation
// (création ET édition, quel que soit l'appelant) — jamais délégué au
// contrôleur/service pour éviter qu'un point d'entrée oublié laisse
// 'entire_place' sur un hôtel ou 'room_based' sur un logement meublé.
accommodationSchema.pre('validate', function forceOccupancyMode() {
  this.occupancyMode = HOTEL_ACCOMMODATION_TYPES.includes(this.accommodationType)
    ? 'room_based'
    : 'entire_place';
});

const Accommodation = mongoose.model('Accommodation', accommodationSchema);
Accommodation.ACCOMMODATION_TYPES = ACCOMMODATION_TYPES;
Accommodation.HOTEL_ACCOMMODATION_TYPES = HOTEL_ACCOMMODATION_TYPES;

module.exports = Accommodation;
