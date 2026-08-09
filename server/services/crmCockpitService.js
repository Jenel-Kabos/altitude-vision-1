// CRM-AUTOMATION-1 (Phase 6) — Cockpit commercial : agrège des données
// RÉELLES uniquement (aucune valeur inventée/estimée). Réutilise
// `crmService.getActivities`/`getPipeline` pour ce qu'ils couvrent déjà ;
// n'ajoute de requêtes dédiées que pour les axes qu'aucun service existant
// n'expose (documentées ligne à ligne ci-dessous). Toutes les requêtes sont
// bornées (limit) — pas de scan illimité d'une collection entière.
const CrmCustomer = require('../models/CrmCustomer');
const CrmOpportunity = require('../models/CrmOpportunity');
const CrmActivity = require('../models/CrmActivity');
const Contrat = require('../models/Contrat');
const FinancialDocument = require('../models/FinancialDocument');
const Visite = require('../models/Visite');
const { getActivities } = require('./crmService');

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const LIMIT = 50;

// "Client sans suivi" : fiche active sans aucune activité CRM (tout statut)
// créée dans les STALE_DAYS derniers jours.
const STALE_DAYS_NO_FOLLOWUP = 30;
// "Opportunité bloquée" : ouverte, sans changement d'étape depuis N jours.
const STALE_DAYS_OPPORTUNITY = 14;
// "Prospect inactif" : relation 'prospect', aucune activité/opportunité
// récente.
const STALE_DAYS_PROSPECT = 21;
// "Contrat proche de l'échéance" : même fenêtre que
// rentalManagementController.stats (server/controllers/rentalManagementController.js)
// — réutilise la définition déjà établie par GL, ne l'invente pas.
const CONTRACT_ALERT_WINDOW_DAYS = 30;

async function clientsSansSuivi() {
  const since = new Date(Date.now() - STALE_DAYS_NO_FOLLOWUP * MS_PER_DAY);
  const recentlyFollowedUpIds = await CrmActivity.distinct('customer', { createdAt: { $gte: since } });
  return CrmCustomer.find({ status: { $ne: 'archived' }, _id: { $nin: recentlyFollowedUpIds } })
    .select('displayName company emails updatedAt').sort({ updatedAt: -1 }).limit(LIMIT).lean();
}

async function opportunitesBloquees() {
  const before = new Date(Date.now() - STALE_DAYS_OPPORTUNITY * MS_PER_DAY);
  return CrmOpportunity.find({ outcome: 'open', updatedAt: { $lte: before } })
    .populate('customer', 'displayName company').sort({ updatedAt: 1 }).limit(LIMIT).lean();
}

async function prospectsInactifs() {
  const since = new Date(Date.now() - STALE_DAYS_PROSPECT * MS_PER_DAY);
  const [activeActivityIds, activeOpportunityIds] = await Promise.all([
    CrmActivity.distinct('customer', { createdAt: { $gte: since } }),
    CrmOpportunity.distinct('customer', { updatedAt: { $gte: since } }),
  ]);
  const excluded = [...new Set([...activeActivityIds, ...activeOpportunityIds].map(String))];
  return CrmCustomer.find({ status: { $ne: 'archived' }, relations: 'prospect', _id: { $nin: excluded } })
    .select('displayName company emails createdAt').sort({ createdAt: 1 }).limit(LIMIT).lean();
}

async function relancesAujourdhui() {
  const { activities } = await getActivities({ view: 'today' });
  return activities.filter((a) => ['rappel', 'relance'].includes(a.type));
}

// "Documents manquants" : documents financiers jamais finalisés (status
// 'draft' — server/constants/financialConstants.js) — proxy défendable et
// réel, pas une notion inventée par ce sprint.
async function documentsManquants() {
  return FinancialDocument.find({ status: 'draft' })
    .select('documentType documentNumber customer createdAt').sort({ createdAt: 1 }).limit(LIMIT).lean();
}

// "Paiements à suivre" : documents financiers non soldés (paymentStatus déjà
// dérivé par le domaine Finance, jamais recalculé ici).
async function paiementsASuivre() {
  return FinancialDocument.find({ paymentStatus: { $in: ['unpaid', 'partially_paid'] } })
    .select('documentType documentNumber customer balanceMinor paymentStatus createdAt').sort({ createdAt: 1 }).limit(LIMIT).lean();
}

// "Contrats proches de l'échéance" : même filtre que
// rentalManagementController.stats.expiringContracts — réutilisation
// explicite de la définition GL déjà en production.
async function contratsProchesEcheance() {
  const soon = new Date(Date.now() + CONTRACT_ALERT_WINDOW_DAYS * MS_PER_DAY);
  return Contrat.find({ type: 'location', statut: 'actif', dateFinBail: { $gte: new Date(), $lte: soon } })
    .select('type statut dateFinBail locataire proprietaire bien').sort({ dateFinBail: 1 }).limit(LIMIT).lean();
}

// "Visites sans suite" : visite Terminée depuis plus de 3 jours, sans
// activité CRM créée après sa date de fin pour le même customer (résolu via
// User→CrmCustomer.identityKeys, même mécanisme que crmAutomationActions).
async function visitesSansSuite() {
  const before = new Date(Date.now() - 3 * MS_PER_DAY);
  const visits = await Visite.find({ statut: 'Terminée', updatedAt: { $lte: before } })
    .select('client property scheduledStartAt updatedAt').sort({ updatedAt: -1 }).limit(LIMIT).lean();
  if (!visits.length) return [];
  const clientIds = [...new Set(visits.map((v) => String(v.client)).filter(Boolean))];
  const customers = await CrmCustomer.find({ identityKeys: { $in: clientIds.map((id) => `user:${id}`) } })
    .select('identityKeys').lean();
  const customerByUserId = new Map();
  customers.forEach((c) => c.identityKeys.forEach((k) => { if (k.startsWith('user:')) customerByUserId.set(k.slice(5), c._id); }));
  const customerIds = [...new Set([...customerByUserId.values()].map(String))];
  const recentActivityCustomerIds = new Set(
    (await CrmActivity.find({ customer: { $in: customerIds }, createdAt: { $gte: before } }).distinct('customer')).map(String),
  );
  return visits.filter((v) => {
    const customerId = customerByUserId.get(String(v.client));
    return !customerId || !recentActivityCustomerIds.has(String(customerId));
  });
}

async function getCockpit() {
  const [
    clientsSuivi, oppBloquees, prospectsInactifsList, relances, docsManquants, paiementsSuivre, contratsEcheance, visitesSuite,
  ] = await Promise.all([
    clientsSansSuivi(), opportunitesBloquees(), prospectsInactifs(), relancesAujourdhui(),
    documentsManquants(), paiementsASuivre(), contratsProchesEcheance(), visitesSansSuite(),
  ]);

  // "Actions prioritaires" : fusion triée des catégories les plus urgentes
  // (aucune nouvelle donnée — un simple regroupement de ce qui précède).
  const actionsPrioritaires = [
    ...relances.map((a) => ({ kind: 'relance', label: a.title, dueAt: a.dueAt, ref: a._id })),
    ...oppBloquees.slice(0, 10).map((o) => ({ kind: 'opportunite_bloquee', label: o.title, ref: o._id })),
    ...paiementsSuivre.slice(0, 10).map((d) => ({ kind: 'paiement', label: `${d.documentType} ${d.documentNumber || ''}`.trim(), ref: d._id })),
  ].slice(0, LIMIT);

  return {
    actionsPrioritaires,
    clientsSansSuivi: clientsSuivi,
    opportunitesBloquees: oppBloquees,
    prospectsInactifs: prospectsInactifsList,
    relancesAujourdhui: relances,
    documentsManquants: docsManquants,
    paiementsASuivre: paiementsSuivre,
    contratsProchesEcheance: contratsEcheance,
    visitesSansSuite: visitesSuite,
    generatedAt: new Date(),
  };
}

module.exports = {
  getCockpit,
  // MARKETING-AUTOMATION-1 — exportées additivement pour être réutilisées
  // comme segments "comportementaux" par marketingSegmentService.js —
  // aucune requête n'est dupliquée, seul l'export change.
  clientsSansSuivi, prospectsInactifs,
};
