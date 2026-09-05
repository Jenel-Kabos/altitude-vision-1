// server/controllers/hotelReviewController.js — PHASE-H3
const mongoose = require('mongoose');
const Hotel = require('../models/Hotel');
const { createReview, listPublishedReviews, getRatingSummary } = require('../services/hotelReviewService');

const fail = (res, statusCode, message, extra = {}) =>
  res.status(statusCode).json({ status: statusCode >= 500 ? 'error' : 'fail', message, ...extra });

async function assertPubliclyVisibleHotel(hotelId) {
  if (!mongoose.isValidObjectId(hotelId)) return null;
  const hotel = await Hotel.findById(hotelId).select('publicationStatus active');
  if (!hotel || hotel.publicationStatus !== 'publie' || hotel.active === false) return null;
  return hotel;
}

// ─────────────────────────────────────────────
// Public — GET /api/hotels/public/:hotelId/reviews
// ─────────────────────────────────────────────
exports.listPublic = async (req, res) => {
  try {
    const { hotelId } = req.params;
    if (!mongoose.isValidObjectId(hotelId)) return fail(res, 400, 'Identifiant invalide.');
    const hotel = await assertPubliclyVisibleHotel(hotelId);
    if (!hotel) return fail(res, 404, 'Hôtel introuvable.');

    const [summary, page] = await Promise.all([
      getRatingSummary(hotelId),
      listPublishedReviews({ hotelId, page: req.query.page, limit: req.query.limit }),
    ]);
    res.json({ status: 'success', data: { summary, reviews: page.reviews, pagination: page.pagination } });
  } catch (error) {
    fail(res, error.statusCode || 500, error.message);
  }
};

// ─────────────────────────────────────────────
// Authentifié — POST /api/hotels/:hotelId/reviews
// ─────────────────────────────────────────────
exports.create = async (req, res) => {
  try {
    const { hotelId } = req.params;
    if (!mongoose.isValidObjectId(hotelId)) return fail(res, 400, 'Identifiant invalide.');
    const { reservationId, overallRating, comment, categoryRatings } = req.body;
    const review = await createReview({
      hotelId, reservationId, overallRating, comment, categoryRatings, actingUser: req.user,
    });
    res.status(201).json({ status: 'success', data: { review: { id: review._id, status: review.status } } });
  } catch (error) {
    fail(res, error.statusCode || 500, error.message, error.code ? { code: error.code } : {});
  }
};
