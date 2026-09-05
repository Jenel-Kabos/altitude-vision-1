// server/controllers/hotelFaqController.js — PHASE-H3
const mongoose = require('mongoose');
const Hotel = require('../models/Hotel');
const { assertOperationalHotelAccess } = require('../services/hotel/hotelAccessScopeService');
const { HOTEL_OPERATIONAL_CAPABILITIES: CAP } = require('../constants/hotelAccessConstants');
const { listPublicFaq, listForOwner, createFaqEntry, updateFaqEntry, deleteFaqEntry } = require('../services/hotelFaqService');

const fail = (res, statusCode, message) =>
  res.status(statusCode).json({ status: statusCode >= 500 ? 'error' : 'fail', message });

async function assertHotelAccess(req, hotelId, capability) {
  return assertOperationalHotelAccess({ actor: req.user, hotelId, capability });
}

// ─────────────────────────────────────────────
// Public — GET /api/hotels/public/:hotelId/faq
// ─────────────────────────────────────────────
exports.listPublic = async (req, res) => {
  try {
    const { hotelId } = req.params;
    if (!mongoose.isValidObjectId(hotelId)) return fail(res, 400, 'Identifiant invalide.');
    const hotel = await Hotel.findById(hotelId).select('publicationStatus active');
    if (!hotel || hotel.publicationStatus !== 'publie' || hotel.active === false) return fail(res, 404, 'Hôtel introuvable.');
    const faq = await listPublicFaq(hotelId);
    res.json({ status: 'success', data: { faq } });
  } catch (error) {
    fail(res, error.statusCode || 500, error.message);
  }
};

// ─────────────────────────────────────────────
// Propriétaire/staff — mêmes conventions d'accès que roomCategoryController
// (assertOperationalHotelAccess, jamais un rôle global seul).
// ─────────────────────────────────────────────
exports.list = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.hotelId)) return fail(res, 400, 'Identifiant invalide.');
    const { error } = await assertHotelAccess(req, req.params.hotelId, CAP.HOTEL_VIEW);
    if (error === 404) return fail(res, 404, 'Hôtel introuvable.');
    if (error === 403) return fail(res, 403, 'Vous ne pouvez consulter que vos propres hôtels.');
    const faq = await listForOwner(req.params.hotelId);
    res.json({ status: 'success', data: { faq } });
  } catch (error) {
    fail(res, error.statusCode || 500, error.message);
  }
};

exports.create = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.hotelId)) return fail(res, 400, 'Identifiant invalide.');
    const { error } = await assertHotelAccess(req, req.params.hotelId, CAP.HOTEL_MANAGE);
    if (error === 404) return fail(res, 404, 'Hôtel introuvable.');
    if (error === 403) return fail(res, 403, 'Vous ne pouvez gérer que vos propres hôtels.');
    const entry = await createFaqEntry({ hotelId: req.params.hotelId, ...req.body, actingUser: req.user });
    res.status(201).json({ status: 'success', data: { faq: entry } });
  } catch (error) {
    fail(res, error.statusCode || 500, error.message);
  }
};

exports.update = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.hotelId) || !mongoose.isValidObjectId(req.params.faqId)) return fail(res, 400, 'Identifiant invalide.');
    const { error } = await assertHotelAccess(req, req.params.hotelId, CAP.HOTEL_MANAGE);
    if (error === 404) return fail(res, 404, 'Hôtel introuvable.');
    if (error === 403) return fail(res, 403, 'Vous ne pouvez gérer que vos propres hôtels.');
    const entry = await updateFaqEntry({ hotelId: req.params.hotelId, faqId: req.params.faqId, changes: req.body, actingUser: req.user });
    res.json({ status: 'success', data: { faq: entry } });
  } catch (error) {
    fail(res, error.statusCode || 500, error.message);
  }
};

exports.remove = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.hotelId) || !mongoose.isValidObjectId(req.params.faqId)) return fail(res, 400, 'Identifiant invalide.');
    const { error } = await assertHotelAccess(req, req.params.hotelId, CAP.HOTEL_MANAGE);
    if (error === 404) return fail(res, 404, 'Hôtel introuvable.');
    if (error === 403) return fail(res, 403, 'Vous ne pouvez gérer que vos propres hôtels.');
    await deleteFaqEntry({ hotelId: req.params.hotelId, faqId: req.params.faqId });
    res.status(204).send();
  } catch (error) {
    fail(res, error.statusCode || 500, error.message);
  }
};
