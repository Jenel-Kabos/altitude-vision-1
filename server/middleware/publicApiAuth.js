// API-PUBLIC-1 (Phase 4) — Authentification par clé API, volontairement
// distincte de authMiddleware.js (JWT interne, voir audit Phase 1). Lit
// `Authorization: Bearer <clé>` ou `X-API-Key`, ne touche jamais au JWT/
// User.tokenVersion.
const { verifyApiKey, touchLastUsed } = require('../services/publicApi/apiKeyService');
// TENANT-CORE-1 (Phase 7) — résolution optionnelle du scope tenant d'une
// clé API. `resolveTenantScope` renvoie `{scopeUserIds:null}` si
// `apiKey.tenant` est absent — aucun changement de comportement pour les
// clés déjà émises (voir models/ApiKey.js).
const { resolveTenantScope } = require('../services/platformTenant/tenantContextService');

async function requireApiKey(req, res, next) {
  const header = req.headers.authorization;
  const bearerKey = header?.startsWith('Bearer ') ? header.slice(7) : null;
  const rawKey = bearerKey || req.headers['x-api-key'];
  if (!rawKey) return res.status(401).json({ status: 'fail', message: 'Clé API requise (Authorization: Bearer <clé> ou X-API-Key).' });

  const apiKey = await verifyApiKey(rawKey);
  if (!apiKey) return res.status(401).json({ status: 'fail', message: 'Clé API invalide, expirée ou révoquée.' });

  req.apiKey = apiKey;
  req.apiKeyTenantScope = apiKey.tenant ? (await resolveTenantScope(apiKey.tenant).catch(() => null))?.scopeUserIds || null : null;
  touchLastUsed(apiKey._id); // fire-and-forget, jamais bloquant
  next();
}

// Vérifie qu'un scope requis est présent sur la clé authentifiée — jamais un
// remplacement de RBAC interne, une couche strictement additionnelle pour
// l'API publique.
function requireScope(scope) {
  return (req, res, next) => {
    if (!req.apiKey?.scopes?.includes(scope)) {
      return res.status(403).json({ status: 'fail', message: `Scope requis : ${scope}.` });
    }
    next();
  };
}

module.exports = { requireApiKey, requireScope };
