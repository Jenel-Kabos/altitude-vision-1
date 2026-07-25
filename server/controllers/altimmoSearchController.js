// server/controllers/altimmoSearchController.js — correctif architecture recherche Altimmo
// (2026-07-25)
//
// Endpoint public unifié : choisit la SOURCE de données selon `offerType`.
//   - vente / location / absent ('tous') → Property (propertyController.runPropertySearch,
//     inchangé, réutilisé — jamais de fusion artificielle des données dans Property).
//   - hebergement → Accommodation (accommodationSearchService.searchPublicAccommodations),
//     avec sa vraie catégorie `accommodationType` — structurellement incapable de renvoyer une
//     annonce Vente ou Location (collection différente).
// Réponse normalisée identique dans les deux cas : { status, results, total, data:
// { properties, total, page, limit } } — le frontend n'a pas à distinguer la source.

const asyncHandler = require('express-async-handler');
const { runPropertySearch } = require('./propertyController');
const { searchPublicAccommodations } = require('../services/accommodationSearchService');
const { resolveOfferType } = require('../services/propertyFilterService');

const search = asyncHandler(async (req, res) => {
  const isAdmin = req.user && req.user.role === 'Admin';
  const offerType = resolveOfferType(req.query);

  if (offerType === 'hebergement') {
    const { properties, total, page, limit } = await searchPublicAccommodations(req.query);
    return res.status(200).json({
      status: 'success', results: properties.length, total,
      data: { properties, total, page, limit },
    });
  }

  const { properties, total } = await runPropertySearch({ query: req.query, isAdmin });
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.max(1, Number(req.query.limit) || 10);
  return res.status(200).json({
    status: 'success', results: properties.length, total,
    data: { properties, total, page, limit },
  });
});

module.exports = { search };
