// API-PUBLIC-1 — Contrôleur v1, appelle EXCLUSIVEMENT
// services/publicApi/publicPropertyService.js — jamais Property directement,
// jamais controllers/propertyController.js (dont l'audit a révélé qu'il
// expose des champs internes sur ses routes publiques historiques).
const asyncHandler = require('express-async-handler');
const { listPublicProperties, getPublicPropertyById } = require('../../services/publicApi/publicPropertyService');

exports.list = asyncHandler(async (req, res) => {
  const result = await listPublicProperties(req.query);
  res.json({ status: 'success', data: result });
});

exports.getOne = asyncHandler(async (req, res) => {
  const property = await getPublicPropertyById(req.params.id);
  if (!property) return res.status(404).json({ status: 'fail', message: 'Annonce introuvable.' });
  res.json({ status: 'success', data: { property } });
});
