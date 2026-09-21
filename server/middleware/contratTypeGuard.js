// USER-TENANT-MEMBERSHIP-ARCHITECTURE-2E.2.XIV — CONTRAT-DOMAIN-SPLIT.
//
// Type guard canonique pour les surfaces typées `/api/contrats/location`
// et `/api/contrats/vente`. Charge le Contrat via `req.params.id` (idempotent
// avec le `router.param('id', …)` de tenant frontier — la ressource est
// relue ici seulement pour prononcer le verdict de type, jamais pour
// contourner la frontière tenant qui s'exécute AVANT).
//
// Répond à UNE seule question : "Cette ressource Contrat correspond-elle au
// type de la surface HTTP appelée ?" — jamais à l'autorité tenant/module
// (déléguée à requireTenantScope + requireTenantMembershipRole +
// requireTenantModule).
//
// Convention de refus : 404 fail-closed, comme `assertResourceTenantOr-
// Unattributed`. Un contrat vente exposé à /api/contrats/location doit
// être indistinguable d'un ID absent, jamais un 403 qui trahirait
// l'existence.

const mongoose = require('mongoose');
const Contrat = require('../models/Contrat');

const CONTRAT_TYPES = ['location', 'vente'];

function requireContratType(expectedType) {
  if (!CONTRAT_TYPES.includes(expectedType)) {
    throw new Error(`requireContratType: unknown type '${expectedType}' (must be one of ${CONTRAT_TYPES.join(', ')}).`);
  }
  return async function contratTypeGuardMiddleware(req, res, next) {
    try {
      if (!mongoose.isValidObjectId(req.params.id)) {
        return res.status(400).json({ status: 'fail', message: 'Identifiant invalide.' });
      }
      const contrat = await Contrat.findById(req.params.id).select('type');
      if (!contrat || contrat.type !== expectedType) {
        return res.status(404).json({ status: 'fail', code: 'CONTRAT_DOMAIN_MISMATCH', message: 'Contrat introuvable.' });
      }
      return next();
    } catch (err) {
      return next(err);
    }
  };
}

module.exports = { requireContratType, CONTRAT_TYPES };
