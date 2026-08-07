// USER-KPI-1 — Couche unique de calcul des KPI utilisateurs. Toute
// statistique impliquant l'identité métier d'un utilisateur (propriétaire
// immobilier, exploitant d'établissement, locataire, multi-profils, compte
// legacy, utilisateur actif) DOIT passer par ce service — aucun contrôleur
// ne doit recalculer un profil ou reconstruire sa propre requête Property/
// Hotel/User pour répondre à la même question.
//
// Réutilise exclusivement les primitives USER-ARCH-1 déjà en place
// (userBusinessProfileService.getBulkDerivedProfileUserIds — la même règle
// que deriveProfilesFromExistingData, en version groupée) : ce service
// n'invente aucune nouvelle règle de dérivation, il agrège ce qui existe
// déjà pour toute la population en évitant toute boucle par utilisateur.
//
// Définitions officielles (voir docs/USER_KPI_1_REPORT.md §2 pour la
// justification complète de chaque choix) :
//   - Propriétaires immobiliers : profil effectif 'proprietaire_immobilier'
//     (stocké actif OU dérivé) — même notion que getEffectiveProfiles().
//   - Exploitants d'établissement : profil effectif 'exploitant_etablissement'.
//   - Locataires : profil effectif 'locataire'.
//   - Multi-profils : utilisateurs portant 2+ profils effectifs distincts.
//   - Comptes legacy : au moins un profil dérivable, mais AUCUN
//     UserBusinessProfile actif stocké — jamais synchronisés par le backfill.
//   - Utilisateurs actifs : status:'Actif' ET isActive:true ET non technique
//     (même convention que crmService.loadIdentitySources et
//     exportController, qui excluent déjà isTechnical/status:'Supprimé').
const User = require('../models/User');
const UserBusinessProfile = require('../models/UserBusinessProfile');
const { getBulkDerivedProfileUserIds } = require('./userBusinessProfileService');
const { BUSINESS_PROFILE_TYPES } = require('../constants/businessProfileConstants');

// Équivalent bulk de getActiveProfiles() : un aggregate group-by, jamais une
// requête par utilisateur.
async function getStoredActiveProfileUserIdSets() {
  const rows = await UserBusinessProfile.aggregate([
    { $match: { status: 'active' } },
    { $group: { _id: '$profileType', users: { $addToSet: '$user' } } },
  ]);
  const sets = Object.fromEntries(BUSINESS_PROFILE_TYPES.map((t) => [t, new Set()]));
  rows.forEach((r) => { if (sets[r._id]) sets[r._id] = new Set(r.users.map(String)); });
  return sets;
}

// Équivalent bulk de getEffectiveProfiles() : fusion dérivé + stocké actif,
// pour toute la population, en 2 requêtes groupées au total.
async function getEffectiveProfileUserIdSets() {
  const [derived, stored] = await Promise.all([
    getBulkDerivedProfileUserIds(),
    getStoredActiveProfileUserIdSets(),
  ]);
  const merged = {};
  for (const type of BUSINESS_PROFILE_TYPES) {
    merged[type] = new Set([...(derived[type] || []), ...(stored[type] || [])]);
  }
  return { merged, derived, stored };
}

async function countActiveUsers() {
  return User.countDocuments({ status: 'Actif', isActive: true, isTechnical: { $ne: true } });
}

// KPI legacy "Propriétaires" (tuile déjà affichée avant USER-KPI-1) :
// préserve l'intention historique du rôle brut 'Proprietaire', qui
// désignait indifféremment un propriétaire immobilier ET/OU un exploitant
// d'établissement (voir audit USER-ARCH-1) — calculée ici comme l'union des
// deux profils effectifs, jamais comme une nouvelle notion inventée.
function unionIds(setA, setB) {
  return new Set([...setA, ...setB]);
}
function unionSize(setA, setB) {
  return unionIds(setA, setB).size;
}

// Détail complet, source unique pour tous les tableaux de bord (Phase 4).
async function getUserKpiSummary() {
  const [{ merged, derived, stored }, utilisateursActifs] = await Promise.all([
    getEffectiveProfileUserIdSets(),
    countActiveUsers(),
  ]);

  const perUserProfileCount = new Map();
  for (const type of BUSINESS_PROFILE_TYPES) {
    for (const id of merged[type]) {
      perUserProfileCount.set(id, (perUserProfileCount.get(id) || 0) + 1);
    }
  }
  const multiProfils = [...perUserProfileCount.values()].filter((n) => n >= 2).length;

  const derivedUnion = new Set(BUSINESS_PROFILE_TYPES.flatMap((t) => [...(derived[t] || [])]));
  const storedUnion = new Set(BUSINESS_PROFILE_TYPES.flatMap((t) => [...(stored[t] || [])]));
  const comptesLegacy = [...derivedUnion].filter((id) => !storedUnion.has(id)).length;

  return {
    proprietairesImmobiliers: merged.proprietaire_immobilier.size,
    exploitantsEtablissement: merged.exploitant_etablissement.size,
    locataires: merged.locataire.size,
    clients: merged.client.size,
    proprietaires: unionSize(merged.proprietaire_immobilier, merged.exploitant_etablissement),
    multiProfils,
    comptesLegacy,
    utilisateursActifs,
    generatedAt: new Date(),
  };
}

// Liste d'identifiants (pas seulement un compte) pour les écrans qui
// affichaient auparavant `User.find({role:'Proprietaire'})` — même règle
// d'union que le KPI `proprietaires` de getUserKpiSummary(), pour que le
// compteur et la liste restent toujours cohérents entre eux.
async function getProprietaireUserIds() {
  const { merged } = await getEffectiveProfileUserIdSets();
  return [...unionIds(merged.proprietaire_immobilier, merged.exploitant_etablissement)];
}

module.exports = {
  getStoredActiveProfileUserIdSets,
  getEffectiveProfileUserIdSets,
  countActiveUsers,
  getUserKpiSummary,
  getProprietaireUserIds,
};
