// server/services/actionLogService.js
const ActionLog = require('../models/ActionLog');

/**
 * Enregistre une action dans le journal d'audit.
 * Non-bloquant par défaut : les erreurs sont absorbées pour ne jamais interrompre
 * l'opération principale — SAUF si un `session` (transaction Mongo) est fourni : dans ce
 * cas l'appelant est explicitement dans un flux transactionnel qui doit pouvoir échouer et
 * déclencher un rollback (F2.6.3 — atomicité Hotel+HotelStaffAssignment+ActionLog), donc
 * l'erreur est propagée au lieu d'être avalée.
 */
const logAction = async ({
  action,
  description,
  module: moduleName,
  auteur,
  cible,
  typeAction,
  metadata = {},
  req,
  session,
}) => {
  const write = async () => {
    // Les tests d'intégration Supertest utilisent les modèles mockés sans
    // connexion Mongo. Ne pas laisser Mongoose bufferiser une écriture
    // fire-and-forget après la fin de Jest. Les tests unitaires qui mockent
    // ActionLog (sans propriété `db`) continuent de vérifier create().
    if (process.env.NODE_ENV === 'test' && ActionLog.db?.readyState === 0) return undefined;

    // Enrichir metadata avec IP et User-Agent si req est fourni
    const enrichedMetadata = { ...metadata };
    if (req) {
      enrichedMetadata.ip        = req.headers?.['x-forwarded-for']?.split(',')[0]?.trim() || req.socket?.remoteAddress || req.ip;
      enrichedMetadata.userAgent = req.headers?.['user-agent'] || '';
    }

    const [created] = await ActionLog.create([{
      tenant: req?.platformTenant?._id || metadata.platformTenantId || null,
      organization: req?.platformTenant?.rootOrgUnit || metadata.orgUnitId || null,
      action,
      description,
      module:     moduleName,
      auteur,
      cible,
      typeAction,
      metadata:   enrichedMetadata,
    }], { session });
    return created;
  };

  if (session) return write();

  try {
    return await write();
  } catch (err) {
    // Ne jamais faire planter l'opération principale à cause d'un log
    console.error('[ActionLog] Erreur lors de l\'enregistrement:', err.message);
    return undefined;
  }
};

/**
 * Construit l'objet auteur à partir d'un objet user Express (req.user).
 */
const buildAuteur = (user) => {
  if (!user) return {};
  return {
    id:    user._id || user.id,
    nom:   user.name  || user.nom  || '',
    role:  user.role  || '',
    email: user.email || '',
  };
};

module.exports = { logAction, buildAuteur };
