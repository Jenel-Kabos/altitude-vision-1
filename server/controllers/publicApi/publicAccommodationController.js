// API-PUBLIC-1 — Contrôleur v1, appelle EXCLUSIVEMENT
// services/publicApi/publicAccommodationService.js.
const asyncHandler = require('express-async-handler');
const mongoose = require('mongoose');
const { getPublicAccommodationById, getPublicAccommodationAvailability } = require('../../services/publicApi/publicAccommodationService');

exports.getOne = asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ status: 'fail', message: 'Identifiant invalide.' });
  const accommodation = await getPublicAccommodationById(req.params.id, { scopeUserIds: req.apiKeyTenantScope });
  if (!accommodation) return res.status(404).json({ status: 'fail', message: 'Hébergement introuvable.' });
  res.json({ status: 'success', data: { accommodation } });
});

exports.availability = asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ status: 'fail', message: 'Identifiant invalide.' });
  const result = await getPublicAccommodationAvailability(req.params.id, req.query);
  if (!result) return res.status(404).json({ status: 'fail', message: 'Hébergement introuvable.' });
  res.json({ status: 'success', data: result });
});
