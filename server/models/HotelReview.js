// server/models/HotelReview.js — PHASE-H3
//
// Avis hôtel lié à un séjour réellement effectué (HotelReservation au
// statut canonique 'checked_out' — voir HotelReservation.RESERVATION_STATUSES,
// aucun autre état "terminé" n'existe dans ce domaine). Volontairement UN
// NOUVEAU modèle plutôt qu'une réutilisation de `Review` (générique,
// scope `pole` Altimmo/MilaEvents/Altcom, `unique(pole, author)` — un seul
// avis PAR UTILISATEUR POUR TOUJOURS sur tout un pôle, aucun lien
// réservation/hôtel, `author` peuplé avec l'email en clair sur un endpoint
// public) : ces invariants sont incompatibles avec "un avis par séjour
// réellement vécu, jamais l'email exposé publiquement" — les forcer dans
// `Review` aurait cassé ses trois autres consommateurs (Altimmo/MilaEvents/
// Altcom) pour un besoin qui n'a rien à voir avec le sien.
//
// Échelle 1–5 : reprend exactement celle déjà utilisée par `Review.js`,
// jamais une échelle concurrente (mission §4).
const mongoose = require('mongoose');

const HOTEL_REVIEW_STATUSES = ['pending', 'published', 'rejected'];

const hotelReviewSchema = new mongoose.Schema(
  {
    hotel: { type: mongoose.Schema.Types.ObjectId, ref: 'Hotel', required: true, index: true },
    // Unique : structurellement un seul avis par séjour (mission §3) —
    // jamais une déduplication applicative fragile.
    reservation: { type: mongoose.Schema.Types.ObjectId, ref: 'HotelReservation', required: true, unique: true },
    author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

    overallRating: { type: Number, min: 1, max: 5, required: true },
    // Notes par catégorie — optionnelles (mission §4 : "seulement si on les
    // supporte délibérément") : un avis reste valide sans elles.
    categoryRatings: {
      cleanliness: { type: Number, min: 1, max: 5, default: null },
      service: { type: Number, min: 1, max: 5, default: null },
      location: { type: Number, min: 1, max: 5, default: null },
      amenities: { type: Number, min: 1, max: 5, default: null },
    },
    comment: { type: String, trim: true, required: true, maxlength: 2000 },

    // H3 — aucune infrastructure de modération générique réutilisable
    // n'existe pour les avis (audit confirmé). Publication immédiate par
    // défaut (pas de tableau de bord staff créé ce sprint, hors périmètre
    // H3 explicite) — le champ existe pour permettre une modération a
    // posteriori (ex: signalement) sans migration de schéma future.
    status: { type: String, enum: HOTEL_REVIEW_STATUSES, default: 'published' },
    rejectionReason: { type: String, trim: true, default: '' },
  },
  { timestamps: true },
);

hotelReviewSchema.index({ hotel: 1, status: 1, createdAt: -1 });

const HotelReview = mongoose.model('HotelReview', hotelReviewSchema);
HotelReview.HOTEL_REVIEW_STATUSES = HOTEL_REVIEW_STATUSES;

module.exports = HotelReview;
