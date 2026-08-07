// USER-ARCH-1 — Contrôleur du profil métier. Délègue entièrement au
// service (même convention que hotelStaffAssignmentController.js) — aucune
// logique métier ici.
const service = require('../services/userBusinessProfileService');

const serialize = (profile) => ({
  id: profile._id, user: profile.user, profileType: profile.profileType, status: profile.status,
  source: profile.source, grantedBy: profile.grantedBy, grantedAt: profile.grantedAt,
  suspendedAt: profile.suspendedAt, suspensionReason: profile.suspensionReason,
  revokedAt: profile.revokedAt, revocationReason: profile.revocationReason,
});

exports.grant = async (req, res, next) => {
  try {
    const profile = await service.grantProfile({
      userId: req.params.userId, profileType: req.body.profileType, actor: req.user, metadata: req.body.metadata, req,
    });
    res.status(201).json({ status: 'success', data: { profile: serialize(profile) } });
  } catch (e) { next(e); }
};

exports.suspend = async (req, res, next) => {
  try {
    const profile = await service.suspendProfile({ userId: req.params.userId, profileType: req.params.profileType, actor: req.user, reason: req.body.reason, req });
    res.json({ status: 'success', data: { profile: serialize(profile) } });
  } catch (e) { next(e); }
};

exports.revoke = async (req, res, next) => {
  try {
    const profile = await service.revokeProfile({ userId: req.params.userId, profileType: req.params.profileType, actor: req.user, reason: req.body.reason, req });
    res.json({ status: 'success', data: { profile: serialize(profile) } });
  } catch (e) { next(e); }
};

// Un utilisateur peut consulter ses propres profils ; le staff peut
// consulter ceux de n'importe qui (RBAC vérifié au niveau des routes).
exports.list = async (req, res, next) => {
  try {
    const profiles = await service.getEffectiveProfiles(req.params.userId);
    res.json({ status: 'success', data: { profiles } });
  } catch (e) { next(e); }
};

// USER-ARCH-UX-1 (Phase 7 — administration) — historique complet
// (actif/suspendu/révoqué) réservé au staff, distinct de `list` qui ne
// renvoie que les profils EFFECTIFS (fusion stocké+dérivé) pour l'auto-lecture.
exports.history = async (req, res, next) => {
  try {
    const [stored, derived] = await Promise.all([
      service.listAllProfiles(req.params.userId),
      service.deriveProfilesFromExistingData(req.params.userId),
    ]);
    res.json({
      status: 'success',
      data: { profiles: stored.map(serialize), derivedOnly: derived.filter((t) => !stored.some((p) => p.profileType === t)) },
    });
  } catch (e) { next(e); }
};
