// server/controllers/publiciteController.js
const asyncHandler = require('express-async-handler');
const Publicite = require('../models/Publicite');

/**
 * @description Publicités actives (Public) — filtrées par pôle Altimmo
 * @route GET /api/publicites/active
 */
const getActivePublicites = asyncHandler(async (req, res) => {
  const publicites = await Publicite.find({
    actif: true,
    pole: 'Altimmo',
  }).sort({ ordre: 1, createdAt: -1 });

  res.status(200).json({
    status: 'success',
    results: publicites.length,
    data: { publicites },
  });
});

/**
 * @description Toutes les publicités (Admin) — actives + inactives
 * @route GET /api/publicites
 */
const getAllPublicites = asyncHandler(async (req, res) => {
  const publicites = await Publicite.find().sort({ ordre: 1, createdAt: -1 });

  res.status(200).json({
    status: 'success',
    results: publicites.length,
    data: { publicites },
  });
});

/**
 * @description Créer une publicité (Admin)
 * @route POST /api/publicites
 */
const createPublicite = asyncHandler(async (req, res) => {
  const { titre, media, type, lien, actif, ordre, pole } = req.body;

  const publicite = await Publicite.create({
    titre,
    media,
    type,
    lien,
    actif,
    ordre,
    pole,
  });

  res.status(201).json({
    status: 'success',
    data: { publicite },
  });
});

/**
 * @description Mettre à jour une publicité (Admin)
 * @route PATCH /api/publicites/:id
 */
const updatePublicite = asyncHandler(async (req, res) => {
  const publicite = await Publicite.findByIdAndUpdate(
    req.params.id,
    req.body,
    { new: true, runValidators: true }
  );

  if (!publicite) {
    res.status(404);
    throw new Error('Publicité non trouvée.');
  }

  res.status(200).json({
    status: 'success',
    data: { publicite },
  });
});

/**
 * @description Supprimer une publicité (Admin)
 * @route DELETE /api/publicites/:id
 */
const deletePublicite = asyncHandler(async (req, res) => {
  const publicite = await Publicite.findByIdAndDelete(req.params.id);

  if (!publicite) {
    res.status(404);
    throw new Error('Publicité non trouvée.');
  }

  res.status(204).json({ status: 'success', data: null });
});

module.exports = {
  getActivePublicites,
  getAllPublicites,
  createPublicite,
  updatePublicite,
  deletePublicite,
};
