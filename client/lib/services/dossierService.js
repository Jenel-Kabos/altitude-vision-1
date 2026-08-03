import api from './api';

// DOC-EVO-1 — Moteur générique de dossier métier. Un seul endpoint pour
// tous les domaines enregistrés côté serveur (server/services/dossier/) —
// jamais un endpoint par domaine côté client non plus.
export const getDossier = async (domain, entityId) => {
  const res = await api.get(`/dossiers/${domain}/${entityId}`);
  return res.data.data.dossier;
};

// DOC-EVO-1 — évolution 5 : recherche globale intelligente (propriétaire,
// locataire, bien, contrat, facture, numéro/référence).
export const searchDossiers = async (query) => {
  const res = await api.get('/dossiers/search', { params: { q: query } });
  return res.data.data.results;
};
