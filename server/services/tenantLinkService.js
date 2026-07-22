// server/services/tenantLinkService.js — Dette technique GL-B2 (Mission 1 & 3)
//
// Source unique de vérité pour le rattachement User ↔ Locataire. Un User
// n'est JAMAIS automatiquement un Locataire — ce service est le SEUL endroit
// autorisé à écrire `Locataire.user`, dans les deux sens :
//
//   1. Invitation (staff → locataire) : inviteTenant → activateInvitation.
//   2. Demande de rattachement (locataire → staff) : requestLink →
//      reviewLinkRequest (validation OBLIGATOIRE, jamais automatique).
//
// `resolveLocataireForUser` est la fonction que TOUT endpoint du futur
// portail locataire doit appeler pour retrouver "mon dossier" — jamais un
// `locataireId` envoyé par le frontend (mission : "ne jamais faire
// confiance à un locataireId envoyé par le frontend").

const crypto = require('crypto');
const Locataire = require('../models/Locataire');
const TenantLinkRequest = require('../models/TenantLinkRequest');

const INVITATION_TTL_DAYS = 7;

function fail(message, statusCode) {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
}

function hashToken(rawToken) {
  return crypto.createHash('sha256').update(rawToken).digest('hex');
}

/**
 * Résolution serveur du dossier locataire à partir du compte connecté —
 * req.user ↓ Locataire ↓ Contrats ↓ Paiements (voir mission). Ne renvoie
 * jamais un dossier qui n'appartient pas à cet utilisateur.
 */
async function resolveLocataireForUser(userId) {
  return Locataire.findOne({ user: userId });
}

// ─────────────────────────────────────────────
// Cas 1 — Invitation (staff → locataire)
// ─────────────────────────────────────────────
async function inviteTenant({ locataireId, actingUser }) {
  const locataire = await Locataire.findById(locataireId);
  if (!locataire) throw fail('Locataire introuvable.', 404);
  if (locataire.user) throw fail('Ce locataire est déjà rattaché à un compte.', 409);

  const rawToken = crypto.randomBytes(32).toString('hex');
  let request;
  try {
    request = await TenantLinkRequest.create({
      locataire: locataire._id,
      type: 'invitation',
      status: 'pending',
      tokenHash: hashToken(rawToken),
      tokenExpiresAt: new Date(Date.now() + INVITATION_TTL_DAYS * 24 * 3600 * 1000),
      requestedBy: actingUser?.id || null,
    });
  } catch (error) {
    // Index unique partiel {locataire, status:'pending'} — une invitation
    // ou demande est déjà en attente pour ce dossier.
    if (error.code === 11000) throw fail('Une invitation ou demande est déjà en attente pour ce locataire.', 409);
    throw error;
  }

  return { request, rawToken, locataire };
}

async function activateInvitation({ rawToken, userId }) {
  if (!rawToken) throw fail('Jeton d\'invitation manquant.', 422);
  const tokenHash = hashToken(rawToken);
  const request = await TenantLinkRequest.findOne({ tokenHash, type: 'invitation', status: 'pending' });
  if (!request) throw fail('Invitation invalide ou déjà utilisée.', 404);
  if (request.tokenExpiresAt && request.tokenExpiresAt.getTime() < Date.now()) {
    request.status = 'expired';
    await request.save();
    throw fail('Cette invitation a expiré.', 410);
  }

  // Un compte User ne peut être rattaché qu'à un seul Locataire — vérifié
  // AVANT toute écriture (défense en profondeur, en plus de l'index unique
  // partiel sur Locataire.user).
  const alreadyLinked = await Locataire.findOne({ user: userId });
  if (alreadyLinked) throw fail('Ce compte est déjà rattaché à un autre dossier locataire.', 409);

  // Transition atomique : le dossier ne doit pas avoir été rattaché
  // entre-temps (double activation concurrente, ou déjà lié par une autre
  // voie) — findOneAndUpdate avec garde `user: null`.
  const locataire = await Locataire.findOneAndUpdate(
    { _id: request.locataire, user: null },
    { $set: { user: userId } },
    { new: true },
  );
  if (!locataire) throw fail('Ce dossier locataire est déjà rattaché à un autre compte.', 409);

  request.status = 'accepted';
  request.user = userId;
  request.acceptedAt = new Date();
  await request.save();

  return { locataire, request };
}

async function cancelInvitation({ requestId, actingUser }) {
  const request = await TenantLinkRequest.findById(requestId);
  if (!request) throw fail('Invitation introuvable.', 404);
  if (request.status !== 'pending') throw fail('Cette invitation a déjà été traitée.', 409);
  request.status = 'cancelled';
  request.reviewedBy = actingUser?.id || null;
  request.reviewedAt = new Date();
  await request.save();
  return request;
}

// ─────────────────────────────────────────────
// Cas 2 — Demande de rattachement (locataire → staff, validation obligatoire)
// ─────────────────────────────────────────────
async function requestLink({ locataireId, userId }) {
  const locataire = await Locataire.findById(locataireId);
  if (!locataire) throw fail('Locataire introuvable.', 404);
  if (locataire.user) throw fail('Ce dossier locataire est déjà rattaché à un compte.', 409);

  const alreadyLinked = await Locataire.findOne({ user: userId });
  if (alreadyLinked) throw fail('Votre compte est déjà rattaché à un dossier locataire.', 409);

  let request;
  try {
    request = await TenantLinkRequest.create({
      locataire: locataire._id, user: userId, type: 'self_request', status: 'pending', requestedBy: userId,
    });
  } catch (error) {
    if (error.code === 11000) throw fail('Une demande est déjà en attente pour ce dossier.', 409);
    throw error;
  }
  return request;
}

/** Jamais de rattachement automatique — décision explicite du gestionnaire. */
async function reviewLinkRequest({ requestId, decision, actingUser, comment = '' }) {
  if (!['approved', 'rejected'].includes(decision)) throw fail('Décision invalide.', 422);
  const request = await TenantLinkRequest.findById(requestId);
  if (!request) throw fail('Demande introuvable.', 404);
  if (request.type !== 'self_request') throw fail('Seule une demande de rattachement peut être validée ici.', 409);
  if (request.status !== 'pending') throw fail('Cette demande a déjà été traitée.', 409);

  let locataire = null;
  if (decision === 'approved') {
    locataire = await Locataire.findOneAndUpdate(
      { _id: request.locataire, user: null },
      { $set: { user: request.user } },
      { new: true },
    );
    if (!locataire) throw fail('Ce dossier locataire est déjà rattaché à un autre compte.', 409);
  }

  request.status = decision;
  request.reviewedBy = actingUser?.id || null;
  request.reviewedAt = new Date();
  request.reviewComment = comment;
  if (decision === 'approved') request.acceptedAt = new Date();
  await request.save();

  return { request, locataire };
}

module.exports = {
  resolveLocataireForUser,
  inviteTenant, activateInvitation, cancelInvitation,
  requestLink, reviewLinkRequest,
};
