// API-PUBLIC-1 — Contrôleur v1, appelle EXCLUSIVEMENT
// services/publicApi/publicHotelService.js.
const asyncHandler = require('express-async-handler');
const mongoose = require('mongoose');
const { listPublicHotels, getPublicHotelById, getPublicHotelAvailability } = require('../../services/publicApi/publicHotelService');

exports.list = asyncHandler(async (req, res) => {
  const result = await listPublicHotels(req.query, { scopeUserIds: req.apiKeyTenantScope });
  res.json({ status: 'success', data: result });
});

exports.getOne = asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ status: 'fail', message: 'Identifiant invalide.' });
  const hotel = await getPublicHotelById(req.params.id, { scopeUserIds: req.apiKeyTenantScope });
  if (!hotel) return res.status(404).json({ status: 'fail', message: 'Hôtel introuvable.' });
  res.json({ status: 'success', data: { hotel } });
});

exports.availability = asyncHandler(async (req, res) => {
  const { roomCategoryId, checkInDate, checkOutDate, roomsCount } = req.query;
  if (!mongoose.isValidObjectId(req.params.id) || !mongoose.isValidObjectId(roomCategoryId)) {
    return res.status(422).json({ status: 'fail', message: 'Identifiant hôtel ou catégorie de chambres invalide.' });
  }
  const result = await getPublicHotelAvailability({ hotelId: req.params.id, roomCategoryId, checkInDate, checkOutDate, roomsCount });
  if (!result) return res.status(404).json({ status: 'fail', message: 'Hôtel ou catégorie introuvable.' });
  res.json({ status: 'success', data: result });
});
