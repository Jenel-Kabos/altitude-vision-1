// USER-TENANT-MEMBERSHIP-ARCHITECTURE-2E.1.X-I-TENANT-CONTEXT-B.2 —
// Middleware qui matérialise la frontière commerciale « domaine paiement »
// (location vs vente). Il ne délivre AUCUNE autorité ; il pose seulement
// `req.paymentDomain` pour que le contrôleur/service applique le filtre
// canonique correct (Contrat.type === 'location'). L'autorité et
// l'attribution tenant restent respectivement gérées par
// `requireTenantMembershipRole` et `tenantResourceAttributionService`.
const mongoose = require('mongoose');
const Paiement = require('../models/Paiement');
const Contrat = require('../models/Contrat');

function markPaymentDomain(domain) {
  return (req, _res, next) => { req.paymentDomain = domain; return next(); };
}

// Assertion pour les routes `:id` du domaine RENTAL : le paiement doit
// être rattaché à un Contrat de type 'location'. Un Paiement dont le
// contrat est de type 'vente' est refusé — l'URL ne suffit jamais à
// forger le domaine.
async function assertRentalPaymentDomain(req, res, next) {
  try {
    const id = req.params.id || req.params.paiementId;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ status: 'fail', message: 'Identifiant invalide.' });
    }
    const paiement = await Paiement.findById(id).select('contrat').lean();
    if (!paiement) return res.status(404).json({ status: 'fail', message: 'Paiement introuvable.' });
    const contrat = paiement.contrat
      ? await Contrat.findById(paiement.contrat).select('type').lean()
      : null;
    if (contrat && contrat.type !== 'location') {
      // Un paiement de vente ne peut pas être atteint via /paiements/location.
      // Retourne 404 (jamais 403) : ne divulgue pas que la ressource existe
      // pour un autre domaine.
      return res.status(404).json({ status: 'fail', message: 'Paiement introuvable dans le domaine location.' });
    }
    return next();
  } catch (error) {
    return res.status(error.statusCode || 500).json({ status: (error.statusCode || 500) >= 500 ? 'error' : 'fail', message: error.message });
  }
}

module.exports = { markPaymentDomain, assertRentalPaymentDomain };
