const mongoose = require('mongoose');
const ContactAuthorization = require('../models/ContactAuthorization');
const PlatformOperator = require('../models/PlatformOperator');
const { logAction, buildAuteur } = require('./actionLogService');
const {
  CONTACT_AUTHORIZATION_SCOPES: CONTACT_AUTHORIZATION_SCOPE_VALUES,
  CONTACT_AUTHORIZATION_DOSSIER_TYPES,
} = require('../models/ContactAuthorization');

const CONTACT_AUTHORIZATION_SCOPES = Object.freeze({
  DIRECT_TRANSACTIONAL_MESSAGING: 'direct_transactional_messaging',
  CONTACT_DETAILS_DISCLOSURE: 'contact_details_disclosure',
});

class ContactAuthorizationError extends Error {
  constructor(code, message, statusCode = 400) {
    super(message);
    this.name = 'ContactAuthorizationError';
    this.code = code;
    this.statusCode = statusCode;
  }
}

const fail = (code, message, statusCode) => {
  throw new ContactAuthorizationError(code, message, statusCode);
};
const actorId = (actor) => actor?._id || actor?.id || null;
const normalizeTenant = (tenantId) => tenantId || null;

function assertObjectId(value, field) {
  if (!mongoose.isValidObjectId(value)) fail('CONTACT_AUTHORIZATION_INVALID_CONTEXT', `${field} invalide.`, 422);
}

function exactContext(input) {
  assertObjectId(input.clientId, 'clientId');
  assertObjectId(input.representativeId, 'representativeId');
  if (input.propertyId != null) assertObjectId(input.propertyId, 'propertyId');
  if (input.dossierId != null) assertObjectId(input.dossierId, 'dossierId');
  if (input.tenantId != null) assertObjectId(input.tenantId, 'tenantId');
  if (String(input.clientId) === String(input.representativeId)) {
    fail('CONTACT_AUTHORIZATION_PARTIES_MUST_DIFFER', 'Le client et le représentant doivent être distincts.', 422);
  }
  if ((input.dossierId == null) !== (input.dossierType == null)) {
    fail('CONTACT_AUTHORIZATION_INVALID_CONTEXT', 'Le type et l’identifiant du dossier doivent être fournis ensemble.', 422);
  }
  if (input.dossierType != null && !CONTACT_AUTHORIZATION_DOSSIER_TYPES.includes(input.dossierType)) {
    fail('CONTACT_AUTHORIZATION_INVALID_DOSSIER_TYPE', 'Type de dossier non pris en charge.', 422);
  }
  return {
    client: input.clientId,
    representative: input.representativeId,
    property: input.propertyId || null,
    dossierType: input.dossierType || null,
    dossier: input.dossierId || null,
    tenant: normalizeTenant(input.tenantId),
  };
}

function normalizeScopes(scopes) {
  const values = [...new Set(scopes || [])];
  if (!values.length || values.some((scope) => !CONTACT_AUTHORIZATION_SCOPE_VALUES.includes(scope))) {
    fail('CONTACT_AUTHORIZATION_INVALID_SCOPE', 'Au moins une portée de contact valide est requise.', 422);
  }
  return values.sort();
}

async function assertCommercialOperator(actor) {
  const userId = actorId(actor);
  if (!userId) fail('PLATFORM_COMMERCIAL_AUTHORITY_REQUIRED', 'Autorité commerciale plateforme requise.', 403);
  const operator = await PlatformOperator.findOne({
    user: userId,
    status: 'active',
    capabilities: 'platform.commercial.manage',
  }).select('_id user status capabilities').lean();
  if (!operator) fail('PLATFORM_COMMERCIAL_AUTHORITY_REQUIRED', 'Autorité commerciale plateforme requise.', 403);
  return operator;
}

async function listAuthorizations({ actor, tenantId, status } = {}) {
  await assertCommercialOperator(actor);
  const query = {};
  if (tenantId !== undefined) query.tenant = normalizeTenant(tenantId);
  if (status) query.status = status;
  return ContactAuthorization.find(query).sort({ createdAt: -1 });
}

async function getAuthorizationForViewer({ authorizationId, viewer, requestedTenantId = undefined } = {}) {
  if (!mongoose.isValidObjectId(authorizationId)) return null;
  const authorization = await ContactAuthorization.findById(authorizationId);
  if (!authorization) return null;
  const viewerId = actorId(viewer);
  const participant = [authorization.client, authorization.representative].some((id) => String(id) === String(viewerId));
  const operator = await PlatformOperator.exists({ user: viewerId, status: 'active', capabilities: 'platform.commercial.manage' });
  if (!participant && !operator) return null;
  if (requestedTenantId !== undefined && String(authorization.tenant || '') !== String(requestedTenantId || '')) return null;
  return authorization;
}

async function audit(type, authorization, actor, reason, req) {
  await logAction({
    action: `contact_authorization.${type}`,
    description: `Autorisation de contact ${authorization._id} — ${type}`,
    module: 'Messagerie',
    scopeMode: 'platform',
    typeAction: type === 'granted' ? 'CRÉATION' : 'MODIFICATION',
    tenant: authorization.tenant || null,
    auteur: buildAuteur(actor),
    cible: { id: String(authorization._id), type: 'ContactAuthorization', nom: String(authorization._id) },
    metadata: { reason },
    req,
  }).catch(() => {});
}

async function grantAuthorization(input = {}) {
  const reason = String(input.reason || '').trim();
  if (!reason) fail('CONTACT_AUTHORIZATION_REASON_REQUIRED', 'Un motif est requis.', 422);
  const context = exactContext(input);
  const scopes = normalizeScopes(input.scopes);
  const userId = actorId(input.actor);
  await assertCommercialOperator(input.actor);

  const existing = await ContactAuthorization.findOne(context);
  if (existing?.status === 'active' && scopes.every((scope) => existing.scopes.includes(scope))) return existing;

  // The authority lookup is deliberately repeated immediately before the
  // mutation so a concurrently suspended/revoked operator cannot rely on a
  // previously loaded identity.
  await assertCommercialOperator(input.actor);
  const now = new Date();
  const event = { type: 'granted', actor: userId, at: now, reason, scopes };
  let authorization;
  try {
    authorization = await ContactAuthorization.findOneAndUpdate(
      context,
      {
        $set: {
          status: 'active',
          scopes,
          grantedBy: userId,
          grantedAt: now,
          grantReason: reason,
          revokedBy: null,
          revokedAt: null,
          revokeReason: null,
        },
        $push: { events: event },
      },
      { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true },
    );
  } catch (error) {
    if (error?.code !== 11000) throw error;
    authorization = await ContactAuthorization.findOne(context);
  }
  await audit('granted', authorization, input.actor, reason, input.req);
  return authorization;
}

async function findActiveAuthorization(input = {}) {
  const scope = input.scope;
  if (!CONTACT_AUTHORIZATION_SCOPE_VALUES.includes(scope)) return null;
  const context = exactContext(input);
  return ContactAuthorization.findOne({ ...context, status: 'active', scopes: scope });
}

async function assertActiveScope(input = {}) {
  const authorization = await findActiveAuthorization(input);
  if (!authorization) {
    fail('CONTACT_AUTHORIZATION_REQUIRED', 'Une autorisation de contact active est requise.', 403);
  }
  return authorization;
}

async function revokeAuthorization({ authorizationId, actor, reason, req } = {}) {
  if (!mongoose.isValidObjectId(authorizationId)) fail('CONTACT_AUTHORIZATION_INVALID_ID', 'Autorisation invalide.', 422);
  const normalizedReason = String(reason || '').trim();
  if (!normalizedReason) fail('CONTACT_AUTHORIZATION_REASON_REQUIRED', 'Un motif est requis.', 422);
  await assertCommercialOperator(actor);
  const userId = actorId(actor);
  const now = new Date();
  // Re-check authority immediately before the compare-and-set write.
  await assertCommercialOperator(actor);
  const authorization = await ContactAuthorization.findOneAndUpdate(
    { _id: authorizationId, status: 'active' },
    {
      $set: { status: 'revoked', revokedBy: userId, revokedAt: now, revokeReason: normalizedReason },
      $push: { events: { type: 'revoked', actor: userId, at: now, reason: normalizedReason, scopes: [] } },
    },
    { new: true, runValidators: true },
  );
  if (!authorization) fail('CONTACT_AUTHORIZATION_NOT_ACTIVE', 'Autorisation introuvable ou déjà révoquée.', 409);
  await audit('revoked', authorization, actor, normalizedReason, req);
  return authorization;
}

const idOrNull = (value) => (value == null ? null : String(value?._id || value));

function serializeContactAuthorization(value) {
  const authorization = value?.toObject ? value.toObject() : value;
  return {
    id: idOrNull(authorization._id),
    clientId: idOrNull(authorization.client),
    representativeId: idOrNull(authorization.representative),
    propertyId: idOrNull(authorization.property),
    dossierType: authorization.dossierType,
    dossierId: idOrNull(authorization.dossier),
    tenantId: idOrNull(authorization.tenant),
    status: authorization.status,
    scopes: [...(authorization.scopes || [])],
    grantedAt: authorization.grantedAt,
    revokedAt: authorization.revokedAt || null,
  };
}

module.exports = {
  CONTACT_AUTHORIZATION_SCOPES,
  ContactAuthorizationError,
  assertActiveScope,
  findActiveAuthorization,
  grantAuthorization,
  getAuthorizationForViewer,
  listAuthorizations,
  revokeAuthorization,
  serializeContactAuthorization,
};

