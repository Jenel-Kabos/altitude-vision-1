// server/models/RoomCategory.js — Sprint B2 (domaine Hôtellerie)
//
// Une RoomCategory représente une CATÉGORIE de chambres commercialisée par
// un Hotel (Standard, Deluxe, Suite, Suite familiale, Suite présidentielle…)
// — jamais une chambre physique individuelle. `unitsAvailable` est un
// COMPTEUR (nombre d'unités de ce type dans l'établissement), pas une liste
// de chambres identifiées : aucune notion de numéro de chambre, d'étage, de
// calendrier de disponibilité ou de statut occupé/libre n'existe ici — voir
// HOTEL_V2.md ("RoomCategory remplace l'ancienne logique de RatePlan
// unique", note posée au Sprint 0). Une future entité `Room` (chambre
// physique, hors périmètre de ce sprint) référencera cette catégorie.
//
// RatePlan référence désormais soit un Accommodation (hébergement
// indépendant, Sprint B1, inchangé), soit une RoomCategory (ce sprint) —
// jamais les deux à la fois. Voir RatePlan.js.

const mongoose = require('mongoose');

const roomCategorySchema = new mongoose.Schema(
  {
    // Pas de `index: true` seul ici : l'index composé {hotel, status}
    // ci-dessous préfixe déjà ce champ (constaté à l'audit final Sprint
    // B2, corrigé : doublon d'index supprimé — toutes les requêtes
    // scopent systématiquement par hotel dans roomCategoryController).
    hotel: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Hotel',
      required: [true, 'RoomCategory doit référencer un Hotel.'],
    },

    name: { type: String, required: [true, 'Le nom de la catégorie est requis.'], trim: true },
    // Optionnel pour les catégories historiques créées avant le formulaire professionnel ;
    // le nouveau flux mobile l'impose avant écriture.
    code: { type: String, trim: true, uppercase: true, default: null },
    categoryType: {
      type: String,
      enum: ['standard', 'superieure', 'deluxe', 'premium', 'suite_junior', 'suite', 'suite_presidentielle', 'familiale', 'twin', 'double', 'simple', 'autre'],
      default: 'standard',
    },
    displayOrder: { type: Number, min: 0, default: 0 },
    description: { type: String, trim: true, default: '' },

    capacity: {
      maxAdults: { type: Number, min: 1, default: 2 },
      maxChildren: { type: Number, min: 0, default: 0 },
    },
    beds: { type: Number, min: 0, default: 1 },
    surface: { type: Number, min: 0, default: null }, // m²

    // Compteur d'unités de ce type dans l'établissement — PAS une liste de
    // chambres identifiées (voir note d'en-tête).
    unitsAvailable: { type: Number, min: 0, default: 1 },

    // Équipements spécifiques à la catégorie (même structure par catégorie
    // que Accommodation.amenities, Sprint B1) — ex : une Suite peut avoir
    // "Jacuzzi" en plus des équipements génériques de l'hôtel.
    amenities: {
      cuisine: { type: [String], default: [] },
      salon: { type: [String], default: [] },
      internet: { type: [String], default: [] },
      exterieur: { type: [String], default: [] },
      parking: { type: [String], default: [] },
      securite: { type: [String], default: [] },
    },

    // Galerie optionnelle propre à la catégorie (même structure que
    // Hotel.gallery/Accommodation.gallery) — si vide, la fiche catégorie
    // affiche la galerie de l'hôtel parent.
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

    status: {
      type: String,
      enum: ['actif', 'inactif'],
      default: 'actif',
      index: true,
    },

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true },
);

roomCategorySchema.index({ hotel: 1, status: 1 });
roomCategorySchema.index(
  { hotel: 1, code: 1 },
  { unique: true, partialFilterExpression: { code: { $type: 'string' } } },
);

const RoomCategory = mongoose.model('RoomCategory', roomCategorySchema);

module.exports = RoomCategory;
