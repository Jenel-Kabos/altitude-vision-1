// server/controllers/mapAggregatesController.js — endpoint public GET /api/altimmo/map-aggregates.
//
// Ne retourne JAMAIS de coordonnées de propriétés. Ne s'appuie sur aucun paramètre HTTP
// contrôlant la visibilité publique (statusAdmin/isPublished/availability/pole sont imposés
// côté serveur — voir mapAggregatesService.buildPublicPropertyMatch).

const asyncHandler = require('express-async-handler');
const { aggregateByLocality } = require('../services/mapAggregatesService');

const getMapAggregates = asyncHandler(async (req, res) => {
  const { total, mappedTotal, unmappedTotal, areas } = await aggregateByLocality(req.query);
  res.status(200).json({
    status: 'success',
    data: { total, mappedTotal, unmappedTotal, areas },
  });
});

module.exports = { getMapAggregates };
