// server/models/Hotel.js
//
// Établissement hôtelier — satellite référencé par Accommodation quand
// accommodationType === 'hotel' (voir Accommodation.js). Ne porte QUE les
// informations propres à l'établissement, jamais celles déjà portées par
// Property (adresse, ville, quartier, coordonnées GPS, images principales —
// voir Sprint Hôtel §01, aucune duplication).
//
// Périmètre volontairement minimal : pas de gestion de chambres/unités, pas
// de calendrier, pas de réservation — voir server/docs/HEBERGEMENT.md
// ("Sprint Hôtel"). Un Hotel n'est qu'une fiche d'établissement à ce stade.

const mongoose = require('mongoose');

const hotelSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Le nom de l'hôtel est requis."],
      trim: true,
    },
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

    services: { type: [String], default: [] },
    hasRestaurant: { type: Boolean, default: false },
    hasReception: { type: Boolean, default: false },

    // Gestionnaire/propriétaire de l'établissement — même convention que
    // Property.owner. Ne conditionne aucun droit d'accès à ce stade (pas de
    // dashboard hôtel dédié dans ce sprint) — champ informatif.
    manager: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },

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

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true },
);

const Hotel = mongoose.model('Hotel', hotelSchema);

module.exports = Hotel;
