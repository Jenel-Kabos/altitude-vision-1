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

// Sprint B1 : catégories d'équipements propres à l'hébergement indépendant
// (villas/appartements/studios/maisons/chambres d'hôtes/résidences meublées).
// Chaque catégorie est une liste libre de chaînes (pas d'enum strict côté
// serveur : la liste de référence proposée à l'utilisateur vit côté client,
// `client/lib/constants/accommodation.js`, pour ne pas nécessiter de
// migration serveur à chaque ajout d'équipement). Distinct de
// `Property.amenities` (texte libre générique Vente/Location/Hébergement,
// inchangé) : ici la structure par catégorie sert l'expérience "type Airbnb"
// (filtres publics, affichage groupé sur la fiche) demandée par le Sprint B1.
const AMENITY_CATEGORIES = ['cuisine', 'salon', 'internet', 'exterieur', 'parking', 'securite'];

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

    // Équipements structurés par catégorie (Sprint B1) — chaque valeur de
    // tableau est une chaîne libre validée côté client contre la liste de
    // référence de `constants/accommodation.js`. Property.amenities reste
    // inchangé (texte libre générique, toujours affiché tel quel ailleurs).
    amenities: {
      cuisine:   { type: [String], default: [] },
      salon:     { type: [String], default: [] },
      internet:  { type: [String], default: [] },
      exterieur: { type: [String], default: [] },
      parking:   { type: [String], default: [] },
      securite:  { type: [String], default: [] },
    },

    // Règles structurées (Sprint B1) — remplace la lecture "devinée" d'un
    // texte libre par une vraie donnée exploitable (filtres, affichage,
    // complétude). `houseRules` (texte libre) est conservé pour toute règle
    // additionnelle non couverte par ces champs (aucune perte de donnée
    // existante, aucune migration nécessaire).
    rules: {
      petsAllowed:      { type: Boolean, default: false },
      partiesAllowed:   { type: Boolean, default: false },
      smokingAllowed:   { type: Boolean, default: false },
      childrenAllowed:  { type: Boolean, default: true },
      minimumAge:       { type: Number, min: 0, default: 0 },
    },
    houseRules: { type: [String], default: [] },

    // Services inclus dans le prix (Sprint B1) — booléens simples, pas de
    // tarification additionnelle dans ce sprint (hors périmètre).
    includedServices: {
      menage:         { type: Boolean, default: false },
      petitDejeuner:  { type: Boolean, default: false },
      blanchisserie:  { type: Boolean, default: false },
      transfert:      { type: Boolean, default: false },
      cuisine:        { type: Boolean, default: false },
    },

    // Galerie enrichie (Sprint B1) — métadonnées posées SUR les URLs déjà
    // hébergées par Cloudinary via Property.images (aucun changement
    // Cloudinary, conformément à la consigne). `url` doit correspondre à une
    // entrée de `property.images` pour une photo ; une vidéo peut référencer
    // une URL Cloudinary vidéo distincte. Si `gallery` est vide, l'ordre
    // d'affichage retombe sur `property.images` tel quel (comportement
    // inchangé, rétro-compatible avec les hébergements déjà publiés).
    gallery: {
      type: [
        {
          url:     { type: String, required: true },
          type:    { type: String, enum: ['photo', 'video'], default: 'photo' },
          isCover: { type: Boolean, default: false },
          order:   { type: Number, default: 0 },
          alt:     { type: String, default: '', trim: true },
        },
      ],
      default: [],
    },

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
    // 'suspendu' (Sprint B1) : action ADMIN uniquement (retrait d'une annonce
    // déjà publiée, ex. signalement/litige) — distincte de `active` ci-dessous
    // qui est le levier PROPRIÉTAIRE ("désactiver" temporairement sans perdre
    // le statut 'publie').
    publicationStatus: {
      type: String,
      enum: ['brouillon', 'soumis', 'publie', 'rejete', 'suspendu'],
      default: 'brouillon',
      index: true,
    },
    rejectionReason: { type: String, trim: true, default: '' },
    suspensionReason: { type: String, trim: true, default: '' },
    submittedAt: { type: Date, default: null },
    publishedAt: { type: Date, default: null },
    suspendedAt: { type: Date, default: null },
    reviewedBy:  { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },

    // Levier propriétaire (Sprint B1) : masquer temporairement une annonce
    // publiée sans perdre `publicationStatus: 'publie'` ni repasser par la
    // modération — réactivable à tout moment par le propriétaire lui-même
    // (contrairement à 'suspendu', qui exige une levée admin).
    active: { type: Boolean, default: true },

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
Accommodation.AMENITY_CATEGORIES = AMENITY_CATEGORIES;

module.exports = Accommodation;
