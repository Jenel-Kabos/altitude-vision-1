const http = require('http');
const https = require('https');
const logger = require('../../utils/logger');

const safeFilename = (name) => String(name || 'document').replace(/[^\w.\- ]/g, '_').slice(0, 120);

const fail = (res, status, message) =>
  res.status(status).json({ status: status >= 500 ? 'error' : 'fail', message });

/**
 * Proxy-stream d'une URL HTTP(S) déjà autorisée par le contrôleur appelant.
 * Les contrôles d'authentification, tenant, ownership et existence restent
 * volontairement avant cet appel, dans leurs frontières applicatives.
 */
function streamRemoteDocument({ url, name, res, context = {} }) {
  if (!/^https?:\/\//i.test(url || '')) return fail(res, 422, 'Document indisponible.');
  const client = url.startsWith('https:') ? https : http;
  const upstream = client.get(url, (upstreamRes) => {
    if (upstreamRes.statusCode >= 400) {
      logger.error('rental_document.upstream_error', { ...context, statusCode: upstreamRes.statusCode });
      upstreamRes.resume();
      return fail(res, 502, 'Impossible de récupérer le document.');
    }
    res.setHeader('Content-Type', upstreamRes.headers['content-type'] || 'application/octet-stream');
    res.setHeader('Content-Disposition', `inline; filename="${safeFilename(name)}"`);
    res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    upstreamRes.pipe(res);
  });
  upstream.on('error', (error) => {
    logger.error('rental_document.stream_failed', { ...context, error: error.message });
    if (!res.headersSent) fail(res, 502, 'Impossible de récupérer le document.');
  });
}

module.exports = { safeFilename, streamRemoteDocument };
