// CRM-AUTOMATION-1 (Phase 5) — Score commercial, TOUJOURS dérivé à la
// lecture, JAMAIS stocké (aucun champ `score` sur CrmCustomer). Réutilise
// exclusivement `crmService.getCustomer360()` déjà agrégé — zéro nouvelle
// requête, zéro duplication des relations customer↔domaine.
//
// Barème (documenté, plafonné, transparent — pas de boîte noire) :
//   engagement (messages + conversations)         → 0-25
//   visites                                        → 0-15
//   contrats                                       → 0-20
//   réservations (hébergement + hôtel)             → 0-15
//   paiements (documents financiers soldés)        → 0-10
//   documents (nombre de documents financiers)     → 0-5
//   ancienneté (mois depuis création de la fiche)  → 0-10
// Total plafonné à 100.
const { getCustomer360 } = require('./crmService');

const WEIGHTS = {
  engagement: 25, visites: 15, contrats: 20, reservations: 15, paiements: 10, documents: 5, anciennete: 10,
};

function clamp(value, max) {
  return Math.max(0, Math.min(max, value));
}

function computeFromDossier(dossier) {
  const { relations, communication, finance, customer } = dossier;
  const engagement = clamp((communication.messages?.length || 0) * 1.5 + (communication.conversations?.length || 0) * 3, WEIGHTS.engagement);
  const visites = clamp((relations.visits?.length || 0) * 5, WEIGHTS.visites);
  const contrats = clamp((relations.contracts?.length || 0) * 10, WEIGHTS.contrats);
  const reservations = clamp(((relations.accommodationReservations?.length || 0) + (relations.hotelReservations?.length || 0)) * 5, WEIGHTS.reservations);
  const paidDocuments = (finance.documents || []).filter((d) => (d.balanceMinor || 0) <= 0 && (d.totalMinor || 0) > 0).length;
  const paiements = clamp(paidDocuments * 5, WEIGHTS.paiements);
  const documents = clamp((finance.documents?.length || 0), WEIGHTS.documents);
  const monthsSinceCreated = customer.createdAt ? (Date.now() - new Date(customer.createdAt).getTime()) / (1000 * 60 * 60 * 24 * 30) : 0;
  const anciennete = clamp(Math.floor(monthsSinceCreated), WEIGHTS.anciennete);

  const breakdown = { engagement, visites, contrats, reservations, paiements, documents, anciennete };
  const total = clamp(Object.values(breakdown).reduce((sum, v) => sum + v, 0), 100);
  return { total: Math.round(total), breakdown, computedAt: new Date() };
}

async function computeCustomerScore(customerId) {
  const dossier = await getCustomer360(customerId);
  return computeFromDossier(dossier);
}

module.exports = { computeCustomerScore, computeFromDossier, WEIGHTS };
