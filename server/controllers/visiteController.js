const asyncHandler = require('express-async-handler');
const Visite = require('../models/Visite');

// ─────────────────────────────────────────────
// POST /api/visites — client crée une demande
// ─────────────────────────────────────────────
exports.createVisite = asyncHandler(async (req, res) => {
  const { propertyId, conversationId } = req.body;

  if (!propertyId) {
    res.status(400);
    throw new Error('propertyId est requis.');
  }

  const visite = await Visite.create({
    property: propertyId,
    client: req.user.id,
    conversation: conversationId || null,
    statut: 'En attente',
  });

  await visite.populate('property', 'title images address');

  res.status(201).json({
    status: 'success',
    data: { visite },
  });
});

// ─────────────────────────────────────────────
// GET /api/visites/my — visites du client connecté
// ─────────────────────────────────────────────
exports.getMyVisites = asyncHandler(async (req, res) => {
  const visites = await Visite.find({ client: req.user.id })
    .populate('property', 'title images address')
    .sort('-createdAt');

  res.status(200).json({
    status: 'success',
    results: visites.length,
    data: { visites },
  });
});

// ─────────────────────────────────────────────
// GET /api/visites — toutes les visites (staff)
// ─────────────────────────────────────────────
exports.getAllVisites = asyncHandler(async (req, res) => {
  const visites = await Visite.find()
    .populate('property', 'title images address availability')
    .populate('client', 'name email phone')
    .populate('conversation')
    .populate('traitePar', 'name')
    .sort('-createdAt');

  res.status(200).json({
    status: 'success',
    results: visites.length,
    data: { visites },
  });
});

// ─────────────────────────────────────────────
// PATCH /api/visites/:id — staff met à jour
// ─────────────────────────────────────────────
exports.updateVisite = asyncHandler(async (req, res) => {
  const visite = await Visite.findById(req.params.id);

  if (!visite) {
    res.status(404);
    throw new Error('Visite non trouvée.');
  }

  const { dateProposee, dateConfirmee, statut, notes } = req.body;

  if (dateProposee !== undefined) visite.dateProposee = dateProposee;
  if (dateConfirmee !== undefined) visite.dateConfirmee = dateConfirmee;
  if (statut !== undefined) visite.statut = statut;
  if (notes !== undefined) visite.notes = notes;

  visite.traitePar = req.user.id;

  await visite.save();

  await visite.populate('property', 'title images address');
  await visite.populate('client', 'name email');
  await visite.populate('traitePar', 'name');

  res.status(200).json({
    status: 'success',
    data: { visite },
  });
});

// ─────────────────────────────────────────────
// PATCH /api/visites/:id/cancel — client annule
// ─────────────────────────────────────────────
exports.cancelVisite = asyncHandler(async (req, res) => {
  const visite = await Visite.findById(req.params.id);

  if (!visite) {
    res.status(404);
    throw new Error('Visite non trouvée.');
  }

  if (visite.client.toString() !== req.user.id.toString()) {
    res.status(403);
    throw new Error('Accès refusé : vous ne pouvez annuler que vos propres demandes.');
  }

  if (visite.statut === 'Annulée') {
    res.status(400);
    throw new Error('Cette visite est déjà annulée.');
  }

  visite.statut = 'Annulée';
  await visite.save();

  res.status(200).json({
    status: 'success',
    data: { visite },
  });
});
