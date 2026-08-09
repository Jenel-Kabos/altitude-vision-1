// MARKETING-AUTOMATION-1 (Phase 3) — Segmentation dynamique. AUCUN segment
// n'est stocké : chaque appel recalcule la liste de CrmCustomer à partir des
// données réelles déjà en base, en réutilisant exclusivement des services
// déjà existants (CRM-CORE-1, USER-KPI-1, USER-ARCH-1, ORGANIZATION-1,
// CRM-AUTOMATION-1) — aucune requête métier n'est réinventée ici, ce
// fichier ne fait qu'orchestrer/router vers le bon service selon la clé de
// segment demandée.
const CrmCustomer = require('../models/CrmCustomer');
const { getEffectiveProfileUserIdSets } = require('./userKpiService');
const { getScopeUserIds } = require('./organizationService');
const { clientsSansSuivi, prospectsInactifs } = require('./crmCockpitService');
const { computeCustomerScore } = require('./crmScoreService');

// Même borne que crmCockpitService.LIMIT — un score par client est coûteux
// (relit tout le dossier 360°, voir crmScoreService.computeCustomerScore) ;
// les segments score-dépendants (VIP/chauds/froids) restent donc bornés aux
// clients récemment actifs plutôt qu'un scan de toute la base, exactement
// le même compromis performance déjà assumé par crmCockpitService.
const SCORE_CANDIDATE_LIMIT = 200;
const VIP_SCORE_THRESHOLD = 60;
const HOT_PROSPECT_SCORE_THRESHOLD = 30;

async function customerIdsByRelation(relation) {
  return CrmCustomer.distinct('_id', { status: { $ne: 'archived' }, relations: relation });
}

// Convertit un ensemble d'identifiants User (USER-KPI-1/ORGANIZATION-1) en
// identifiants CrmCustomer — même mécanisme d'identité que
// crmAutomationActions.resolveCustomerId, en version groupée (bulk), jamais
// une boucle par utilisateur.
async function customerIdsFromUserIds(userIds) {
  if (!userIds || !userIds.size) return [];
  const keys = [...userIds].map((id) => `user:${id}`);
  return CrmCustomer.distinct('_id', { status: { $ne: 'archived' }, identityKeys: { $in: keys } });
}

async function scoreBoundedCandidates(prefilter = {}) {
  return CrmCustomer.find({ status: { $ne: 'archived' }, ...prefilter })
    .sort({ updatedAt: -1 }).limit(SCORE_CANDIDATE_LIMIT).select('_id').lean();
}

async function customersAboveScore(prefilter, threshold, direction = 'above') {
  const candidates = await scoreBoundedCandidates(prefilter);
  const scores = await Promise.all(candidates.map(async (c) => ({ id: c._id, score: (await computeCustomerScore(c._id).catch(() => ({ total: 0 }))).total })));
  return scores.filter((s) => (direction === 'above' ? s.score >= threshold : s.score < threshold)).map((s) => s.id);
}

// Registre déclaratif — chaque entrée : { label, description, resolve(params) }.
// `resolve` renvoie TOUJOURS un tableau d'identifiants CrmCustomer.
const SEGMENT_REGISTRY = {
  clients: {
    label: 'Clients',
    description: 'Fiches CRM ayant au moins une relation client réelle (hôtel, hébergement, Altcom…), hors simples prospects.',
    resolve: () => CrmCustomer.distinct('_id', { status: { $ne: 'archived' }, relations: { $in: ['client_hotel', 'client_hebergement', 'client_altcom', 'acheteur', 'vendeur', 'voyageur'] } }),
  },
  prospects: {
    label: 'Prospects',
    description: "Fiches CRM taguées 'prospect' (crmService.loadIdentitySources).",
    resolve: () => customerIdsByRelation('prospect'),
  },
  locataires: {
    label: 'Locataires',
    description: 'Fiches CRM taguées locataire (Locataire.user lié).',
    resolve: () => customerIdsByRelation('locataire'),
  },
  proprietaires_immobiliers: {
    label: 'Propriétaires immobiliers',
    description: 'Profil métier effectif proprietaire_immobilier (USER-ARCH-1/USER-KPI-1).',
    resolve: async () => customerIdsFromUserIds((await getEffectiveProfileUserIdSets()).merged.proprietaire_immobilier),
  },
  exploitants: {
    label: "Exploitants d'établissement",
    description: 'Profil métier effectif exploitant_etablissement (USER-ARCH-1/USER-KPI-1).',
    resolve: async () => customerIdsFromUserIds((await getEffectiveProfileUserIdSets()).merged.exploitant_etablissement),
  },
  clients_hotel: {
    label: 'Clients hôtels',
    description: "Fiches CRM taguées 'client_hotel'.",
    resolve: () => customerIdsByRelation('client_hotel'),
  },
  clients_accommodation: {
    label: 'Clients hébergement',
    description: "Fiches CRM taguées 'client_hebergement'.",
    resolve: () => customerIdsByRelation('client_hebergement'),
  },
  clients_inactifs: {
    label: 'Clients inactifs',
    description: 'Réutilise crmCockpitService.clientsSansSuivi() (30 jours sans activité CRM) — même définition que le cockpit CRM-AUTOMATION-1.',
    resolve: async () => (await clientsSansSuivi()).map((c) => c._id),
  },
  prospects_inactifs: {
    label: 'Prospects inactifs (comportemental)',
    description: 'Réutilise crmCockpitService.prospectsInactifs() (21 jours sans activité/opportunité).',
    resolve: async () => (await prospectsInactifs()).map((c) => c._id),
  },
  clients_vip: {
    label: 'Clients VIP',
    description: `Score commercial (crmScoreService, CRM-AUTOMATION-1) ≥ ${VIP_SCORE_THRESHOLD}, parmi les ${SCORE_CANDIDATE_LIMIT} fiches les plus récemment actives.`,
    resolve: () => customersAboveScore({ relations: { $ne: 'prospect' } }, VIP_SCORE_THRESHOLD, 'above'),
  },
  prospects_chauds: {
    label: 'Prospects chauds',
    description: `Prospects avec un score ≥ ${HOT_PROSPECT_SCORE_THRESHOLD}.`,
    resolve: () => customersAboveScore({ relations: 'prospect' }, HOT_PROSPECT_SCORE_THRESHOLD, 'above'),
  },
  prospects_froids: {
    label: 'Prospects froids',
    description: `Prospects avec un score < ${HOT_PROSPECT_SCORE_THRESHOLD}.`,
    resolve: () => customersAboveScore({ relations: 'prospect' }, HOT_PROSPECT_SCORE_THRESHOLD, 'below'),
  },
  geographique: {
    label: 'Segment géographique',
    description: 'Fiches CRM dont une adresse correspond à la ville fournie (params.city).',
    resolve: (params = {}) => {
      if (!params.city) return [];
      return CrmCustomer.distinct('_id', { status: { $ne: 'archived' }, 'addresses.city': new RegExp(`^${params.city}$`, 'i') });
    },
  },
  organisationnel: {
    label: 'Segment organisationnel',
    description: "Membres actifs d'une unité ORGANIZATION-1 (params.orgUnitId), descendants inclus.",
    resolve: async (params = {}) => {
      if (!params.orgUnitId) return [];
      return customerIdsFromUserIds(await getScopeUserIds(params.orgUnitId));
    },
  },
};

function listSegments() {
  return Object.entries(SEGMENT_REGISTRY).map(([key, { label, description }]) => ({ key, label, description }));
}

async function resolveSegment(segmentKey, params = {}, { tenantId } = {}) {
  const segment = SEGMENT_REGISTRY[segmentKey];
  if (!segment) { const err = new Error(`Segment inconnu : ${segmentKey}.`); err.statusCode = 422; throw err; }
  const ids = await segment.resolve(params);
  const scopedIds = tenantId ? await CrmCustomer.distinct('_id', { _id: { $in: ids }, tenant: tenantId }) : ids;
  return [...new Set(scopedIds.map(String))];
}

module.exports = { SEGMENT_REGISTRY, listSegments, resolveSegment };
