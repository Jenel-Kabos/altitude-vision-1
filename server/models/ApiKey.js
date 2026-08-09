// API-PUBLIC-1 — Identifiant d'intégration externe pour /api/public/v1/*.
// Volontairement DISTINCT du JWT interne (voir audit Phase 1) : un JWT est
// lié à une session utilisateur vivante (re-lookup User par requête,
// invalidation par tokenVersion global) et ne porte aucune notion de scope/
// quota — inadapté à un partenaire externe. Le secret n'est JAMAIS stocké en
// clair : seul un hash SHA-256 est persisté (comparable à un mot de passe),
// et seul un `keyPrefix` (8 caractères) reste affiché après création pour
// permettre l'identification dans les journaux sans jamais pouvoir
// reconstituer la clé.
const mongoose = require('mongoose');

const API_KEY_STATUSES = ['active', 'revoked'];
// Sous-ensemble volontairement restreint des ressources exposées Phase 5 —
// jamais un scope "admin"/"crm"/"finance" ici.
const API_KEY_SCOPES = ['properties:read', 'hotels:read', 'accommodations:read', 'webhooks:manage'];

const schema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 200 },
  keyPrefix: { type: String, required: true, index: true, maxlength: 16 },
  hashedKey: { type: String, required: true, unique: true },
  scopes: { type: [String], enum: API_KEY_SCOPES, default: ['properties:read', 'hotels:read', 'accommodations:read'] },
  status: { type: String, enum: API_KEY_STATUSES, default: 'active', index: true },
  rateLimitPerMinute: { type: Number, default: 60, min: 1, max: 6000 },
  ownerUser: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  organizationLabel: { type: String, trim: true, maxlength: 200, default: '' }, // nom libre du partenaire, PAS un lien vers ORGANIZATION-1 (portée différente)
  // TENANT-CORE-1 (Phase 7) — lien optionnel et additif vers un
  // PlatformTenant : quand renseigné, l'API publique (properties/hotels/
  // accommodations) est scopée aux seules ressources de ce tenant (voir
  // publicApiAuth.js). `null` par défaut = comportement STRICTEMENT
  // inchangé pour toute clé déjà émise (catalogue global, comme avant ce
  // sprint) — jamais une régression silencieuse d'une intégration partenaire
  // existante. TENANT-HARDENING-1 ferme désormais l'accès HTTP des clés
  // historiques `null` jusqu'à rattachement explicite : jamais de catalogue
  // global implicite.
  tenant: { type: mongoose.Schema.Types.ObjectId, ref: 'PlatformTenant', default: null },
  expiresAt: { type: Date, default: null },
  lastUsedAt: { type: Date, default: null },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  revokedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  revokedAt: { type: Date, default: null },
  revocationReason: { type: String, maxlength: 1000, default: null },
  // Rotation (Phase 4) : lorsqu'une clé est tournée, l'ancienne est révoquée
  // et une nouvelle créée en référençant celle-ci — jamais de ré-émission
  // silencieuse du même secret.
  rotatedFrom: { type: mongoose.Schema.Types.ObjectId, ref: 'ApiKey', default: null },
  metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
}, { timestamps: true });

module.exports = mongoose.model('ApiKey', schema);
module.exports.API_KEY_STATUSES = API_KEY_STATUSES;
module.exports.API_KEY_SCOPES = API_KEY_SCOPES;
