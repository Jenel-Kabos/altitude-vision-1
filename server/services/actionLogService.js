// server/services/actionLogService.js
const ActionLog = require('../models/ActionLog');

/**
 * Enregistre une action dans le journal d'audit.
 * Non-bloquant : les erreurs sont absorbées pour ne jamais interrompre l'opération principale.
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
}) => {
  try {
    // Enrichir metadata avec IP et User-Agent si req est fourni
    const enrichedMetadata = { ...metadata };
    if (req) {
      enrichedMetadata.ip        = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket?.remoteAddress || req.ip;
      enrichedMetadata.userAgent = req.headers['user-agent'] || '';
    }

    await ActionLog.create({
      action,
      description,
      module:     moduleName,
      auteur,
      cible,
      typeAction,
      metadata:   enrichedMetadata,
    });
  } catch (err) {
    // Ne jamais faire planter l'opération principale à cause d'un log
    console.error('[ActionLog] Erreur lors de l\'enregistrement:', err.message);
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
