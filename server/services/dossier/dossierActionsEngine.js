// DOC-EVO-2 — Actions contextuelles : purement descriptives (key + label),
// jamais d'exécution ici. Filtrées par rôle (mêmes groupes que
// gestionDocumentRoutes/contratRoutes — jamais une nouvelle notion de
// permission) et par état réel du dossier, pour ne jamais proposer une
// action déjà sans objet (ex : générer un bail qui existe déjà). Le
// frontend sait déjà, pour chaque clé connue, vers quelle page existante
// naviguer (voir DossierPanel.jsx) — une clé sans mapping ne devient jamais
// un lien mort, elle est simplement masquée.
const { STAFF_DOC } = require('../../utils/roles');

function computeDossierActions({ user, contrat, rental, paiements }) {
  if (!STAFF_DOC.includes(user.role)) return [];

  const actions = [];
  const hasValidBail = (contrat.documents || []).some((d) => d.type === 'bail' && !d.invalidated);
  const hasEtatEntree = (contrat.documents || []).some((d) => d.type === 'etat_entree');
  const hasEtatSortie = (contrat.documents || []).some((d) => d.type === 'etat_sortie');
  const preavisActif = Boolean(rental?.noticeStartedAt && !rental?.exitInspectionClearedAt);
  const aUneEcheanceReglable = paiements.some((p) => p.statut !== 'payé');

  if (!hasValidBail && contrat.statut !== 'résilié') {
    actions.push({ key: 'generate_bail', label: 'Générer le bail' });
  }
  if (aUneEcheanceReglable) {
    actions.push({ key: 'generate_quittance', label: 'Générer une quittance' });
  }
  if (contrat.statut === 'actif' && !preavisActif) {
    actions.push({ key: 'generate_preavis', label: 'Générer un préavis' });
  }
  if (contrat.statut !== 'en_attente' && !hasEtatEntree) {
    actions.push({ key: 'generate_etat_des_lieux_entree', label: "Générer l'état des lieux d'entrée" });
  }
  if (preavisActif && !hasEtatSortie) {
    actions.push({ key: 'generate_etat_des_lieux_sortie', label: "Générer l'état des lieux de sortie" });
  }
  actions.push({ key: 'signaler_maintenance', label: 'Signaler une maintenance' });
  if (contrat.statut === 'actif') {
    actions.push({ key: 'gerer_preavis', label: 'Gérer le préavis' });
  }
  if (contrat.statut === 'expiré' || contrat.statut === 'en_attente') {
    actions.push({ key: 'renouveler_bail', label: 'Renouveler le bail' });
  }
  if (contrat.statut === 'actif') {
    actions.push({ key: 'cloturer_bail', label: 'Clôturer le bail' });
  }

  return actions;
}

module.exports = { computeDossierActions };
