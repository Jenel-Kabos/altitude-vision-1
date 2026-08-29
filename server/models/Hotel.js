// server/models/Hotel.js
//
// Établissement hôtelier — satellite référencé par Accommodation quand
// accommodationType === 'hotel' (voir Accommodation.js). Ne porte QUE les
// informations propres à l'établissement, jamais celles déjà portées par
// Property (adresse, ville, quartier, coordonnées GPS, images principales —
// voir Sprint Hôtel §01, aucune duplication).
//
// Sprint B2 : véritable domaine Hôtellerie — un Hotel gère désormais ses
// RoomCategory (voir RoomCategory.js), sa galerie enrichie (même structure
// que Accommodation.gallery, Sprint B1), ses services structurés, son
// contact, et son propre cycle de publication (score de complétude dédié,
// voir hotelService.computeHotelCompletionScore). Toujours PAS de
// Room/Reservation/Calendar — voir HOTEL_V2.md.

const mongoose = require('mongoose');
const { normalizeHotelName } = require('../utils/normalizeHotelName');

// Services structurés (Sprint B2) — chaque clé est un booléen. Remplace
// l'ancien `services: [String]` en tant que source de vérité pour le
// nouveau domaine Hôtellerie ; `services` (texte libre) est conservé pour
// toute mention additionnelle non couverte par cette liste (aucune perte de
// donnée existante, aucune migration).
const HOTEL_SERVICE_KEYS = [
  'restaurant', 'bar', 'piscine', 'spa', 'salleSport',
  'salleConference', 'navette', 'parking', 'reception24h', 'wifi',
];

const hotelSchema = new mongoose.Schema(
  {
    tenant: { type: mongoose.Schema.Types.ObjectId, ref: 'PlatformTenant', default: null, index: true },
    name: {
      type: String,
      required: [true, "Le nom de l'hôtel est requis."],
      trim: true,
    },
    normalizedName: { type: String, select: false, default: null },
    // Enseigne / marque commerciale (Sprint B2) — distincte du nom légal
    // (ex : nom = "SARL Panorama Hôtellerie", enseigne = "Hôtel Panorama").
    brand: { type: String, trim: true, default: '' },
    description: { type: String, trim: true, default: '' },

    starRating: {
      type: Number,
      min: [1, 'Le nombre d\'étoiles doit être compris entre 1 et 5.'],
      max: [5, 'Le nombre d\'étoiles doit être compris entre 1 et 5.'],
      default: null,
    },

    phone: { type: String, trim: true, default: '' },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      default: '',
      validate: {
        // Volontairement permissif (même regex que le reste du projet) —
        // seule une adresse manifestement mal formée est rejetée.
        validator: (v) => !v || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v),
        message: 'Adresse email invalide.',
      },
    },
    website: {
      type: String,
      trim: true,
      default: '',
      validate: {
        // Volontairement permissif (avec ou sans protocole, ex :
        // "hotel-panorama.cg" ou "https://hotel-panorama.cg") — seule une
        // valeur manifestement non-URL est rejetée.
        validator: (v) => !v || /^(https?:\/\/)?[^\s@/]+\.[a-z]{2,}([/?#].*)?$/i.test(v),
        message: 'Site web invalide.',
      },
    },

    // Contact (Sprint B2) — informatif, aucun impact sur les permissions.
    contact: {
      responsable: { type: String, trim: true, default: '' },
      horaires: { type: String, trim: true, default: '' },
      languesParlees: { type: [String], default: [] },
    },

    services: { type: [String], default: [] }, // texte libre historique, conservé
    hotelServices: {
      // Structuré (Sprint B2) — voir HOTEL_SERVICE_KEYS.
      restaurant: { type: Boolean, default: false },
      bar: { type: Boolean, default: false },
      piscine: { type: Boolean, default: false },
      spa: { type: Boolean, default: false },
      salleSport: { type: Boolean, default: false },
      salleConference: { type: Boolean, default: false },
      navette: { type: Boolean, default: false },
      parking: { type: Boolean, default: false },
      reception24h: { type: Boolean, default: false },
      wifi: { type: Boolean, default: false },
    },
    hasRestaurant: { type: Boolean, default: false }, // legacy, conservé (voir hasRestaurant/hasReception)
    hasReception: { type: Boolean, default: false },
    totalRooms: { type: Number, min: 0, default: 0 },
    totalCapacity: { type: Number, min: 0, default: 0 },
    totalBeds: { type: Number, min: 0, default: 0 },
    minNightlyRate: { type: Number, min: 0, default: 0 },
    maxNightlyRate: { type: Number, min: 0, default: 0 },
    currency: { type: String, default: 'XAF' },
    legalName: { type: String, trim: true, default: '' },
    hotelType: { type: String, enum: ['hotel', 'residence_hoteliere', 'auberge', 'chambre_hotes', 'motel', 'autre'], default: 'hotel' },
    timezone: { type: String, trim: true, default: 'Africa/Brazzaville' },
    taxInformation: {
      taxIdentifier: { type: String, trim: true, default: '' },
      taxRegime: { type: String, trim: true, default: '' },
      vatRate: { type: Number, min: 0, max: 100, default: 0 },
    },
    policies: {
      checkInTime: { type: String, trim: true, default: '14:00' },
      checkOutTime: { type: String, trim: true, default: '11:00' },
      cancellation: { type: String, trim: true, default: '' },
      pets: { type: String, trim: true, default: '' },
      children: { type: String, trim: true, default: '' },
      visitors: { type: String, trim: true, default: '' },
      accessibility: { type: String, trim: true, default: '' },
    },
    administrativeDocuments: {
      type: [{ label: { type: String, trim: true, required: true }, url: { type: String, trim: true, required: true }, documentType: { type: String, trim: true, default: 'other' } }],
      default: [],
    },
    proposedVersion: {
      requestId: { type: String, trim: true, default: null },
      status: { type: String, enum: ['pending', 'rejected'], default: null },
      hotelChanges: { type: mongoose.Schema.Types.Mixed, default: null },
      propertyChanges: { type: mongoose.Schema.Types.Mixed, default: null },
      submittedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
      submittedAt: { type: Date, default: null },
      reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
      reviewedAt: { type: Date, default: null },
      rejectionReason: { type: String, trim: true, default: '' },
    },
    versionHistory: {
      type: [{
        requestId: { type: String, trim: true, required: true },
        decision: { type: String, enum: ['approved', 'rejected', 'rolled_back'], required: true },
        hotelChanges: { type: mongoose.Schema.Types.Mixed, default: {} },
        propertyChanges: { type: mongoose.Schema.Types.Mixed, default: {} },
        previousHotelValues: { type: mongoose.Schema.Types.Mixed, default: {} },
        previousPropertyValues: { type: mongoose.Schema.Types.Mixed, default: {} },
        submittedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
        reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
        submittedAt: { type: Date, default: null },
        reviewedAt: { type: Date, default: Date.now },
        reason: { type: String, trim: true, default: '' },
      }],
      default: [],
    },
    moderationHistory: {
      type: [{
        from: { type: String, enum: ['brouillon', 'soumis', 'publie', 'rejete', 'suspendu'], required: true },
        to: { type: String, enum: ['brouillon', 'soumis', 'publie', 'rejete', 'suspendu'], required: true },
        decision: { type: String, enum: ['validate', 'reject', 'suspend', 'unsuspend'], required: true },
        reason: { type: String, trim: true, default: '' },
        comment: { type: String, trim: true, default: '' },
        moderator: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
        decidedAt: { type: Date, default: Date.now },
      }],
      default: [],
    },

    // Galerie enrichie (Sprint B2) — même structure que
    // Accommodation.gallery (Sprint B1) : métadonnées posées sur les URLs
    // déjà hébergées par Property.images via Cloudinary (aucun changement
    // Cloudinary). Si vide, l'affichage retombe sur Property.images.
    gallery: {
      type: [
        {
          url: { type: String, required: true },
          type: { type: String, enum: ['photo', 'video'], default: 'photo' },
          isCover: { type: Boolean, default: false },
          order: { type: Number, default: 0 },
          alt: { type: String, default: '', trim: true },
        },
      ],
      default: [],
    },

    // Gestionnaire/propriétaire de l'établissement — même convention que
    // Property.owner.
    // index: true — corrige un index manquant constaté à l'audit final
    // Sprint B2 : `hotelController.mine` filtre systématiquement par
    // `manager` (GET /api/hotels/mine, "Mes hôtels"), ce qui provoquait un
    // scan complet de la collection Hotel sans cet index.
    manager: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },

    // Property "ancre" créé en même temps que ce Hotel, s'il y en a un.
    // Pas d'unicité : un même Hotel pourra plus tard être référencé par
    // plusieurs Property/Accommodation (chaînes, plusieurs bâtiments).
    property: { type: mongoose.Schema.Types.ObjectId, ref: 'Property', default: null },

    status: {
      type: String,
      enum: ['actif', 'inactif'],
      default: 'actif',
      index: true, // filtré sur chaque GET /api/hotels (sélecteur admin)
    },

    // Cycle de publication dédié (Sprint B2) — même forme que
    // Accommodation.publicationStatus (Sprint B1/audit sécurité). Gate la
    // visibilité du DOMAINE HÔTELLERIE (dashboard, modération) ; la
    // visibilité PUBLIQUE de l'annonce reste gouvernée par
    // Accommodation.publicationStatus (inchangé, voir accommodationService.
    // isPubliclyVisible) — synchronisée au moment de la validation/
    // suspension par hotelService.syncLinkedAccommodations (best-effort,
    // jamais bloquant).
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
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    active: { type: Boolean, default: true }, // levier propriétaire, cf Accommodation.active

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true },
);

hotelSchema.pre('validate', function deriveNormalizedHotelName() {
  this.normalizedName = normalizeHotelName(this.name);
});

hotelSchema.index(
  { tenant: 1, normalizedName: 1 },
  {
    name: 'tenant_normalized_hotel_name_unique',
    unique: true,
    partialFilterExpression: {
      tenant: { $type: 'objectId' },
      normalizedName: { $type: 'string' },
    },
  },
);

const Hotel = mongoose.model('Hotel', hotelSchema);
Hotel.HOTEL_SERVICE_KEYS = HOTEL_SERVICE_KEYS;

module.exports = Hotel;
