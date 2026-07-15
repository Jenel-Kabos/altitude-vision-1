// Logger minimaliste : structuré en production, coloré en dev.
// Remplace progressivement les console.log dispersés.
// Usage : const logger = require('../utils/logger');
//         logger.info('Message'); logger.error('Erreur', err);

const isProd = process.env.NODE_ENV === 'production';

const SENSITIVE_KEYS = /token|password|cookie|authorization|mongo_uri|api[_-]?key|secret/i;

const normalizeMetadata = (metadata) => {
  if (metadata == null) return {};
  if (metadata instanceof Error) {
    return { error: metadata.message, ...(metadata.stack ? { stack: metadata.stack } : {}) };
  }
  if (typeof metadata === 'object' && !Array.isArray(metadata)) {
    return Object.fromEntries(Object.entries(metadata).map(([key, value]) => [
      key,
      SENSITIVE_KEYS.test(key) ? '[REDACTED]' : value,
    ]));
  }
  return { detail: String(metadata) };
};

const fmt = (level, msg, meta) => {
  const normalizedMeta = normalizeMetadata(meta);
  if (isProd) {
    // JSON structuré — compatible avec Render / Logtail / Datadog
    return JSON.stringify({ level, msg, ts: new Date().toISOString(), ...normalizedMeta });
  }
  const prefix = { info: '🔍', success: '✅', warn: '⚠️', error: '❌' }[level] || '▶';
  const metaStr = Object.keys(normalizedMeta).length ? ' ' + JSON.stringify(normalizedMeta) : '';
  return `${prefix} [${level.toUpperCase()}] ${msg}${metaStr}`;
};

const logger = {
  info:    (msg, meta)  => console.log(fmt('info', msg, meta)),
  success: (msg, meta)  => console.log(fmt('success', msg, meta)),
  warn:    (msg, meta)  => console.warn(fmt('warn', msg, meta)),
  error:   (msg, meta)  => console.error(fmt('error', msg, meta)),
};

module.exports = { ...logger, normalizeMetadata };
