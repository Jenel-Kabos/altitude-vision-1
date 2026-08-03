// DOC-EVO-1 — Moteur générique de "dossier métier" pour le Centre
// documentaire. Un dossier n'est JAMAIS une nouvelle collection : c'est une
// vue d'agrégation en lecture seule sur les modèles déjà existants
// (Contrat, RentalManagement, Paiement, RentalMaintenanceTicket, Document,
// FinancialDocument, Transaction, RealEstateReservation,
// AccommodationReservation, HotelReservation). Chaque domaine fournit un
// "adaptateur" (une fonction `load({ entityId, user })` qui retourne
// l'enveloppe uniforme ci-dessous) et s'enregistre ici — c'est le seul
// point de branchement nécessaire pour connecter un nouveau pôle demain
// (Altcom, Mila Events, Administration, RH, Comptabilité) sans toucher au
// contrôleur ni au frontend.
//
// Enveloppe uniforme retournée par chaque adaptateur :
// {
//   domain, entityId, status,           // 'Actif' | 'En cours' | 'Terminé' | 'Archivé'
//   summary: { title, subtitle, badges: [string], fields: { label: value } },
//   relatedLinks: [{ label, domain, entityType, entityId }],
//   sections: [{ key, label, items: [{ id, label, date, meta, previewUrl, downloadUrl }] }],
//   timeline: [{ date, label, type, meta }],   // triée chronologiquement
//   actions: [{ key, label }],                 // descriptif seulement — le frontend sait
// }                                             // déjà comment déclencher chaque action existante.

const adapters = new Map();

function registerDossierAdapter(domain, adapter) {
  adapters.set(domain, adapter);
}

function getDossierAdapter(domain) {
  return adapters.get(domain) || null;
}

function listDossierDomains() {
  return Array.from(adapters.keys());
}

// Tri chronologique commun — réutilisé par chaque adaptateur pour ne jamais
// dupliquer cette logique.
function buildTimeline(events) {
  return events
    .filter((event) => event && event.date)
    .map((event) => ({ ...event, date: new Date(event.date) }))
    .sort((a, b) => a.date - b.date)
    .map((event) => ({ ...event, date: event.date.toISOString() }));
}

module.exports = { registerDossierAdapter, getDossierAdapter, listDossierDomains, buildTimeline };
