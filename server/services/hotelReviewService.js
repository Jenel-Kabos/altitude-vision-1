// server/services/hotelReviewService.js — PHASE-H3
//
// Un avis n'existe que pour un séjour RÉELLEMENT terminé (mission §2) :
// HotelReservation.status === 'checked_out' — le seul état "terminé" du
// domaine (voir HotelReservation.RESERVATION_STATUSES/ALLOWED_TRANSITIONS,
// jamais devinée comme 'completed'/'terminee'). L'auteur, l'hôtel et la
// réservation sont TOUJOURS dérivés côté serveur, jamais lus depuis le
// payload client au-delà de `reservationId` (mission §9 : "never trust
// author from request body").
const mongoose = require('mongoose');
const Hotel = require('../models/Hotel');
const HotelReservation = require('../models/HotelReservation');
const HotelReview = require('../models/HotelReview');

const CATEGORY_KEYS = ['cleanliness', 'service', 'location', 'amenities'];

function fail(message, statusCode, code) {
  const err = new Error(message); err.statusCode = statusCode; if (code) err.code = code; throw err;
}

// Identité publique sûre (mission §5) : jamais l'email/téléphone/ID exposés
// — un prénom + l'initiale du nom, seule donnée déjà considérée affichable
// nulle part ailleurs dans ce domaine (contrairement à `Review.js`, qui
// peuple `author` avec l'email en clair — jamais reproduit ici).
function safeDisplayName(user) {
  const parts = String(user?.name || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'Client Altitude Vision';
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${parts[1][0].toUpperCase()}.`;
}

function sanitizeCategoryRatings(input = {}) {
  const out = {};
  CATEGORY_KEYS.forEach((key) => {
    const value = input[key];
    if (value === undefined || value === null || value === '') { out[key] = null; return; }
    const n = Number(value);
    if (!Number.isFinite(n) || n < 1 || n > 5) fail(`La note "${key}" doit être comprise entre 1 et 5.`, 422, 'HOTEL_REVIEW_INVALID_RATING');
    out[key] = n;
  });
  return out;
}

/**
 * @param {object} params
 * @param {string} params.hotelId
 * @param {string} params.reservationId
 * @param {number} params.overallRating
 * @param {string} params.comment
 * @param {object} [params.categoryRatings]
 * @param {object} params.actingUser — utilisateur authentifié (jamais optionnel ici)
 */
async function createReview({ hotelId, reservationId, overallRating, comment, categoryRatings, actingUser }) {
  const userId = actingUser?.id || actingUser?._id;
  if (!userId) fail('Authentification requise.', 401, 'HOTEL_REVIEW_AUTH_REQUIRED');
  if (!mongoose.isValidObjectId(hotelId) || !mongoose.isValidObjectId(reservationId)) {
    fail('Identifiant invalide.', 400, 'HOTEL_REVIEW_INVALID_ID');
  }
  const rating = Number(overallRating);
  if (!Number.isFinite(rating) || rating < 1 || rating > 5) fail('La note globale doit être comprise entre 1 et 5.', 422, 'HOTEL_REVIEW_INVALID_RATING');
  if (!String(comment || '').trim()) fail('Un commentaire est requis.', 422, 'HOTEL_REVIEW_COMMENT_REQUIRED');

  const reservation = await HotelReservation.findById(reservationId);
  if (!reservation) fail('Réservation introuvable.', 404, 'HOTEL_REVIEW_RESERVATION_NOT_FOUND');
  // Ownership AVANT toute autre vérification (mission §2/§20) — jamais
  // révéler qu'une réservation existe pour un autre hôtel/statut avant
  // d'avoir prouvé qu'elle appartient à cet utilisateur.
  if (!reservation.guestUser || String(reservation.guestUser) !== String(userId)) {
    fail('Cette réservation ne vous appartient pas.', 403, 'HOTEL_REVIEW_NOT_OWNER');
  }
  if (String(reservation.hotel) !== String(hotelId)) {
    fail('Cette réservation ne concerne pas cet hôtel.', 422, 'HOTEL_REVIEW_WRONG_HOTEL');
  }
  if (reservation.status !== 'checked_out') {
    fail('Seul un séjour terminé peut être évalué.', 422, 'HOTEL_REVIEW_STAY_NOT_COMPLETED');
  }

  const hotel = await Hotel.findById(hotelId).select('_id');
  if (!hotel) fail('Hôtel introuvable.', 404, 'HOTEL_REVIEW_HOTEL_NOT_FOUND');

  try {
    return await HotelReview.create({
      hotel: hotelId, reservation: reservationId, author: userId,
      overallRating: rating, categoryRatings: sanitizeCategoryRatings(categoryRatings),
      comment: String(comment).trim(),
    });
  } catch (error) {
    if (error.code === 11000) fail('Cette réservation a déjà fait l’objet d’un avis.', 409, 'HOTEL_REVIEW_ALREADY_EXISTS');
    throw error;
  }
}

/** Projection publique sûre — jamais l'ID de réservation/auteur/email (mission §5/§20). */
function serializePublicReview(review) {
  return {
    id: review._id,
    overallRating: review.overallRating,
    categoryRatings: review.categoryRatings,
    comment: review.comment,
    author: safeDisplayName(review.author),
    verifiedStay: true, // toute HotelReview existante l'est structurellement (mission §10)
    createdAt: review.createdAt,
  };
}

async function listPublishedReviews({ hotelId, page = 1, limit = 10 }) {
  const safePage = Math.max(1, Number(page) || 1);
  const safeLimit = Math.min(50, Math.max(1, Number(limit) || 10));
  const query = { hotel: hotelId, status: 'published' };
  const [reviews, total] = await Promise.all([
    HotelReview.find(query).populate('author', 'name').sort({ createdAt: -1 })
      .skip((safePage - 1) * safeLimit).limit(safeLimit),
    HotelReview.countDocuments(query),
  ]);
  return {
    reviews: reviews.map(serializePublicReview),
    pagination: { page: safePage, limit: safeLimit, total, pages: Math.max(1, Math.ceil(total / safeLimit)) },
  };
}

/** Moyenne déterministe, arrondie à 1 décimale — jamais 5.0/"Nouveau" pour zéro avis (mission §7). */
function round1(value) {
  return Math.round(value * 10) / 10;
}

async function getRatingSummary(hotelId) {
  const published = await HotelReview.find({ hotel: hotelId, status: 'published' }).select('overallRating categoryRatings');
  const reviewCount = published.length;
  if (reviewCount === 0) {
    return { averageRating: null, reviewCount: 0, categories: null };
  }
  const averageRating = round1(published.reduce((sum, r) => sum + r.overallRating, 0) / reviewCount);
  const categories = {};
  CATEGORY_KEYS.forEach((key) => {
    const values = published.map((r) => r.categoryRatings?.[key]).filter((v) => v != null);
    categories[key] = values.length ? round1(values.reduce((sum, v) => sum + v, 0) / values.length) : null;
  });
  const hasAnyCategory = Object.values(categories).some((v) => v != null);
  return { averageRating, reviewCount, categories: hasAnyCategory ? categories : null };
}

module.exports = {
  createReview, listPublishedReviews, getRatingSummary, safeDisplayName, serializePublicReview,
};
