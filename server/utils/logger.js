// Logger minimaliste : structuré en production, coloré en dev.
// Remplace progressivement les console.log dispersés.
// Usage : const logger = require('../utils/logger');
//         logger.info('Message'); logger.error('Erreur', err);

const isProd = process.env.NODE_ENV === 'production';

const fmt = (level, msg, meta) => {
  if (isProd) {
    // JSON structuré — compatible avec Render / Logtail / Datadog
    return JSON.stringify({ level, msg, ts: new Date().toISOString(), ...meta });
  }
  const prefix = { info: '🔍', success: '✅', warn: '⚠️', error: '❌' }[level] || '▶';
  const metaStr = meta && Object.keys(meta).length ? ' ' + JSON.stringify(meta) : '';
  return `${prefix} [${level.toUpperCase()}] ${msg}${metaStr}`;
};

const logger = {
  info:    (msg, meta)  => console.log(fmt('info', msg, meta)),
  success: (msg, meta)  => console.log(fmt('success', msg, meta)),
  warn:    (msg, meta)  => console.warn(fmt('warn', msg, meta)),
  error:   (msg, meta)  => console.error(fmt('error', msg, meta)),
};

module.exports = logger;
