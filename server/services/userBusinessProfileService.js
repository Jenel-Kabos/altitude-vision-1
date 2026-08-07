// USER-ARCH-1 — Service du profil métier. Même conventions que
// hotelStaffAssignmentService.js (audit via actionLogService, erreurs
// typées avec code+statusCode) mais volontairement plus simple : un profil
// métier ne porte aucune capacité en lui-même (contrairement à
// HotelStaffAssignment.capabilities) — il ne fait que qualifier
// l'identité ; les autorisations fines restent exactement où elles sont
// déjà (Property.owner, Hotel.manager, HotelStaffAssignment, RBAC
// User.role). Aucune donnée métier existante n'est dupliquée ici.
const mongoose = require('mongoose');
const User = require('../models/User');
const Property = require('../models/Property');
const Locataire = require('../models/Locataire');
const Hotel = require('../models/Hotel');
const HotelStaffAssignment = require('../models/HotelStaffAssignment');
const UserBusinessProfile = require('../models/UserBusinessProfile');
const { BUSINESS_PROFILE_TYPES } = require('../constants/businessProfileConstants');
const { logAction, buildAuteur } = require('./actionLogService');

class BusinessProfileError extends Error {
  constructor(code, message, statusCode = 400) { super(message); this.name = 'BusinessProfileError'; this.code = code; this.statusCode = statusCode; }
}
const fail = (code, message, statusCode) => { throw new BusinessProfileError(code, message, statusCode); };

function assertValidProfileType(profileType) {
  if (!BUSINESS_PROFILE_TYPES.includes(profileType)) {
    fail('BUSINESS_PROFILE_TYPE_INVALID', `Profil métier inconnu : ${profileType}.`, 422);
  }
}

async function auditProfile(event, { actor, profile, reason, req }) {
  await logAction({
    action: `user_business_profile.${event}`,
    description: reason || `Profil métier ${profile.profileType} (${profile.user}) — ${event}`,
    module: 'Utilisateurs',
    typeAction: event === 'revoked' ? 'SUPPRESSION' : event === 'granted' ? 'CRÉATION' : 'MODIFICATION',
    auteur: buildAuteur(actor),
    cible: { id: String(profile._id), type: 'UserBusinessProfile', nom: `${profile.profileType} — ${profile.user}` },
    req,
  }).catch(() => {}); // l'audit ne doit jamais faire échouer l'opération métier elle-même
}

// USER-ARCH-1 — point d'entrée UNIQUE pour accorder un profil. Réactive un
// profil existant (suspendu/révoqué) plutôt que d'en créer un doublon —
// jamais deux documents actifs pour le même (user, profileType), garanti
// par l'index unique partiel du modèle.
async function grantProfile({ userId, profileType, actor, source = 'manual', metadata = {}, req } = {}) {
  assertValidProfileType(profileType);
  if (!mongoose.isValidObjectId(userId)) fail('BUSINESS_PROFILE_USER_INVALID', 'Identifiant utilisateur invalide.', 400);
  const user = await User.findById(userId).select('_id');
  if (!user) fail('BUSINESS_PROFILE_USER_NOT_FOUND', 'Utilisateur introuvable.', 404);

  const existing = await UserBusinessProfile.findOne({ user: userId, profileType });
  if (existing) {
    if (existing.status === 'active') return existing; // déjà actif — no-op, jamais un doublon
    existing.status = 'active';
    existing.suspendedBy = null; existing.suspendedAt = null; existing.suspensionReason = null;
    existing.revokedBy = null; existing.revokedAt = null; existing.revocationReason = null;
    existing.grantedBy = actor?._id || actor?.id || null;
    existing.grantedAt = new Date();
    await existing.save();
    await auditProfile('reactivated', { actor, profile: existing, req });
    return existing;
  }

  const profile = await UserBusinessProfile.create({
    user: userId, profileType, source, metadata, grantedBy: actor?._id || actor?.id || null,
  });
  await auditProfile('granted', { actor, profile, req });
  return profile;
}

async function suspendProfile({ userId, profileType, actor, reason, req } = {}) {
  const profile = await UserBusinessProfile.findOne({ user: userId, profileType, status: 'active' });
  if (!profile) fail('BUSINESS_PROFILE_NOT_ACTIVE', 'Aucun profil actif de ce type pour cet utilisateur.', 404);
  profile.status = 'suspended';
  profile.suspendedBy = actor?._id || actor?.id || null;
  profile.suspendedAt = new Date();
  profile.suspensionReason = reason || null;
  await profile.save();
  await auditProfile('suspended', { actor, profile, reason, req });
  return profile;
}

async function revokeProfile({ userId, profileType, actor, reason, req } = {}) {
  const profile = await UserBusinessProfile.findOne({ user: userId, profileType, status: { $in: ['active', 'suspended'] } });
  if (!profile) fail('BUSINESS_PROFILE_NOT_FOUND', 'Aucun profil actif ou suspendu de ce type pour cet utilisateur.', 404);
  profile.status = 'revoked';
  profile.revokedBy = actor?._id || actor?.id || null;
  profile.revokedAt = new Date();
  profile.revocationReason = reason || null;
  await profile.save();
  await auditProfile('revoked', { actor, profile, reason, req });
  return profile;
}

async function getActiveProfiles(userId) {
  const rows = await UserBusinessProfile.find({ user: userId, status: 'active' }).select('profileType').lean();
  return rows.map((r) => r.profileType);
}

async function hasProfile(userId, profileType) {
  const count = await UserBusinessProfile.countDocuments({ user: userId, profileType, status: 'active' });
  return count > 0;
}

// USER-ARCH-1 — Phase 4 (rétrocompatibilité) : dérive, en LECTURE SEULE, les
// profils qu'un utilisateur DEVRAIT avoir d'après les données déjà
// existantes (Property.owner, Accommodation/Hotel, HotelStaffAssignment,
// Locataire.user) — jamais un accès direct à `User.role`, qui reste hors de
// ce calcul (un rôle 'Proprietaire' seul ne suffit plus à décider). Utilisé
// par le script de backfill ET comme filet de sécurité pour tout utilisateur
// pas encore synchronisé (voir getEffectiveProfiles ci-dessous) — aucune
// donnée n'est jamais copiée, uniquement lue.
async function deriveProfilesFromExistingData(userId) {
  const derived = new Set();

  const [proprieteImmo, proprieteHebergement, hotelManager, staffAssignment, locataireLink] = await Promise.all([
    Property.exists({ owner: userId, status: { $in: ['vente', 'location'] } }),
    Property.exists({ owner: userId, status: 'hebergement' }),
    Hotel.exists({ manager: userId }),
    HotelStaffAssignment.exists({ user: userId, status: 'active' }),
    Locataire.exists({ user: userId }),
  ]);

  if (proprieteImmo) derived.add('proprietaire_immobilier');
  if (proprieteHebergement || hotelManager || staffAssignment) derived.add('exploitant_etablissement');
  if (locataireLink) derived.add('locataire');

  return [...derived];
}

// Union des profils explicitement accordés (stockés) et des profils
// dérivables des données existantes — garantit qu'un utilisateur jamais
// synchronisé par le backfill obtient malgré tout la bonne réponse
// (rétrocompatibilité totale, aucune régression possible pour les comptes
// existants).
async function getEffectiveProfiles(userId) {
  const [stored, derived] = await Promise.all([getActiveProfiles(userId), deriveProfilesFromExistingData(userId)]);
  return [...new Set([...stored, ...derived])];
}

async function hasEffectiveProfile(userId, profileType) {
  const profiles = await getEffectiveProfiles(userId);
  return profiles.includes(profileType);
}

// USER-ARCH-UX-1 — équivalent BULK (multi-utilisateurs) de
// `deriveProfilesFromExistingData`, MÊME règle métier (mêmes champs sources :
// Property.owner+status, Hotel.manager, HotelStaffAssignment.status,
// Locataire.user), mais en requêtes groupées (`distinct`) plutôt qu'une par
// utilisateur — destiné aux écrans de segmentation/liste (CRM, tableaux de
// bord, exports) qui doivent classer beaucoup d'utilisateurs à la fois sans
// réimplémenter la règle ailleurs (voir crmService.loadIdentitySources, seul
// appelant à ce jour). Ne couvre PAS les profils explicitement accordés
// (UserBusinessProfile stockés) : à combiner par l'appelant si nécessaire,
// comme getEffectiveProfiles le fait pour un seul utilisateur.
async function getBulkDerivedProfileUserIds() {
  const [immoOwnerIds, hebergementOwnerIds, hotelManagerIds, staffAssignmentUserIds, tenantUserIds] = await Promise.all([
    Property.find({ owner: { $ne: null }, status: { $in: ['vente', 'location'] } }).distinct('owner'),
    Property.find({ owner: { $ne: null }, status: 'hebergement' }).distinct('owner'),
    Hotel.find({ manager: { $ne: null } }).distinct('manager'),
    HotelStaffAssignment.find({ status: 'active' }).distinct('user'),
    Locataire.find({ user: { $ne: null } }).distinct('user'),
  ]);
  return {
    proprietaire_immobilier: new Set(immoOwnerIds.map(String)),
    exploitant_etablissement: new Set([...hebergementOwnerIds, ...hotelManagerIds, ...staffAssignmentUserIds].map(String)),
    locataire: new Set(tenantUserIds.map(String)),
  };
}

// Liste détaillée (tous statuts confondus) — réservée aux écrans staff
// d'administration (Phase 7) : contrairement à getEffectiveProfiles, ne
// fusionne rien et n'omet pas les profils suspendus/révoqués (nécessaires
// pour afficher l'historique complet et permettre une réactivation).
async function listAllProfiles(userId) {
  return UserBusinessProfile.find({ user: userId }).sort({ createdAt: -1 }).lean();
}

module.exports = {
  BusinessProfileError,
  grantProfile, suspendProfile, revokeProfile,
  getActiveProfiles, hasProfile, listAllProfiles,
  deriveProfilesFromExistingData, getEffectiveProfiles, hasEffectiveProfile,
  getBulkDerivedProfileUserIds,
};
