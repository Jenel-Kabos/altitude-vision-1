// DOC-EVO-1 — Contrôleur générique du moteur de dossier métier. Ne connaît
// aucune logique propre à un domaine : il délègue entièrement à
// l'adaptateur enregistré (server/services/dossier/index.js). Chaque
// adaptateur gère lui-même son RBAC (aucune notion de permission générique
// ici — les règles diffèrent réellement par domaine, cf. DOC-EVO-1 §RBAC).
const { getDossierAdapter, listDossierDomains } = require('../services/dossier');
const { searchDossiers } = require('../services/dossier/dossierSearchService');

// DOC-EVO-1 — évolution 5 (recherche globale intelligente). Réservé au
// staff — mêmes rôles que le reste du Centre documentaire, appliqués au
// niveau route (voir dossierRoutes.js).
exports.search = async (req, res) => {
  try {
    const results = await searchDossiers(req.query.q, {
      tenantId: req.platformTenant._id,
      scopeUserIds: req.tenantScopeUserIds,
    });
    res.status(200).json({ status: 'success', results: results.length, data: { results } });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
};

exports.getDossier = async (req, res) => {
  const { domain, entityId } = req.params;
  const adapter = getDossierAdapter(domain);
  if (!adapter) {
    return res.status(404).json({ status: 'fail', code: 'DOSSIER_DOMAIN_UNKNOWN', message: `Domaine de dossier inconnu : ${domain}.`, data: { availableDomains: listDossierDomains() } });
  }
  try {
    const dossier = await adapter({ entityId, user: req.user });
    res.status(200).json({ status: 'success', data: { dossier } });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    res.status(statusCode).json({ status: statusCode >= 500 ? 'error' : 'fail', message: error.message });
  }
};
