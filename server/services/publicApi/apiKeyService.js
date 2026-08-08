// API-PUBLIC-1 (Phase 4) — Gestion des clés API. Le secret n'est JAMAIS
// stocké en clair (SHA-256, même famille de garantie qu'un mot de passe
// haché) et n'est retourné qu'UNE seule fois, à la création/rotation —
// exactement comme Stripe/GitHub. Toute révocation est déjà immédiate
// (status:'revoked'), jamais une suppression physique du document (garde la
// traçabilité et le journal d'appels valides).
const crypto = require('crypto');
const mongoose = require('mongoose');
const ApiKey = require('../../models/ApiKey');
const { API_KEY_SCOPES } = require('../../models/ApiKey');

class ApiKeyError extends Error {
  constructor(code, message, statusCode = 400) { super(message); this.name = 'ApiKeyError'; this.code = code; this.statusCode = statusCode; }
}
const fail = (code, message, statusCode) => { throw new ApiKeyError(code, message, statusCode); };

const KEY_PREFIX = 'pk_live_';

function hashKey(rawKey) {
  return crypto.createHash('sha256').update(rawKey).digest('hex');
}

function generateRawKey() {
  const secret = crypto.randomBytes(32).toString('hex');
  const displayPrefix = secret.slice(0, 8);
  return { rawKey: `${KEY_PREFIX}${secret}`, keyPrefix: `${KEY_PREFIX}${displayPrefix}` };
}

async function createApiKey({ name, scopes, rateLimitPerMinute, organizationLabel, expiresAt, actor } = {}) {
  if (!name || !name.trim()) fail('API_KEY_NAME_REQUIRED', 'Le nom est requis.', 422);
  const invalidScopes = (scopes || []).filter((s) => !API_KEY_SCOPES.includes(s));
  if (invalidScopes.length) fail('API_KEY_SCOPE_INVALID', `Scope(s) invalide(s) : ${invalidScopes.join(', ')}.`, 422);

  const { rawKey, keyPrefix } = generateRawKey();
  const apiKey = await ApiKey.create({
    name: name.trim(),
    keyPrefix,
    hashedKey: hashKey(rawKey),
    scopes: scopes?.length ? scopes : undefined,
    rateLimitPerMinute: rateLimitPerMinute || undefined,
    organizationLabel: organizationLabel || '',
    expiresAt: expiresAt || null,
    createdBy: actor?._id || actor?.id || null,
  });
  // La clé en clair n'est JAMAIS relue après cet appel — le contrôleur doit
  // la renvoyer immédiatement au demandeur et ne jamais la journaliser.
  return { apiKey, rawKey };
}

async function verifyApiKey(rawKey) {
  if (!rawKey) return null;
  const apiKey = await ApiKey.findOne({ hashedKey: hashKey(rawKey), status: 'active' });
  if (!apiKey) return null;
  if (apiKey.expiresAt && apiKey.expiresAt.getTime() < Date.now()) return null;
  return apiKey;
}

async function touchLastUsed(apiKeyId) {
  // Fire-and-forget, jamais bloquant pour la requête publique elle-même.
  await ApiKey.updateOne({ _id: apiKeyId }, { lastUsedAt: new Date() }).catch(() => {});
}

async function revokeApiKey(id, { actor, reason } = {}) {
  const apiKey = await ApiKey.findOne({ _id: id, status: 'active' });
  if (!apiKey) fail('API_KEY_NOT_ACTIVE', 'Aucune clé active avec cet identifiant.', 404);
  apiKey.status = 'revoked';
  apiKey.revokedBy = actor?._id || actor?.id || null;
  apiKey.revokedAt = new Date();
  apiKey.revocationReason = reason || null;
  await apiKey.save();
  return apiKey;
}

// Rotation (Phase 4) : révoque l'ancienne clé et en crée une nouvelle avec
// les mêmes attributs (scopes/quota/label), liée via `rotatedFrom` — jamais
// une ré-émission du même secret.
async function rotateApiKey(id, { actor, reason } = {}) {
  if (!mongoose.isValidObjectId(id)) fail('API_KEY_ID_INVALID', 'Identifiant invalide.', 400);
  const oldKey = await ApiKey.findOne({ _id: id, status: 'active' });
  if (!oldKey) fail('API_KEY_NOT_ACTIVE', 'Aucune clé active avec cet identifiant.', 404);
  const { rawKey } = await createApiKey({
    name: oldKey.name, scopes: oldKey.scopes, rateLimitPerMinute: oldKey.rateLimitPerMinute,
    organizationLabel: oldKey.organizationLabel, actor,
  }).then(async (result) => {
    await ApiKey.updateOne({ _id: result.apiKey._id }, { rotatedFrom: oldKey._id });
    return result;
  });
  await revokeApiKey(oldKey._id, { actor, reason: reason || 'Rotation de clé' });
  const newKey = await ApiKey.findOne({ hashedKey: hashKey(rawKey) });
  return { apiKey: newKey, rawKey };
}

async function listApiKeys() {
  return ApiKey.find().sort({ createdAt: -1 }).select('-hashedKey').lean();
}

module.exports = { ApiKeyError, createApiKey, verifyApiKey, touchLastUsed, revokeApiKey, rotateApiKey, listApiKeys, hashKey };
