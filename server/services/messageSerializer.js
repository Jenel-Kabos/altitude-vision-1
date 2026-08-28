const { safePrivateDescriptor } = require('./storage/secureStorageService');

/**
 * Représentation HTTP canonique d'un Message.
 * Pure : aucune requête, autorisation, mutation du document source ou
 * dépendance Express. Les projections sender/receiver restent la
 * responsabilité des requêtes appelantes.
 */
function serializeMessage(value) {
  const data = value?.toObject ? value.toObject() : { ...value };
  data.attachments = (data.attachments || []).map((attachment) => {
    const { asset, url: legacyUrl, ...metadata } = attachment;
    if (asset) {
      return {
        ...metadata,
        ...safePrivateDescriptor(asset, {
          previewEndpoint: `/api/messages/${data._id}/attachments/${attachment._id}`,
          downloadEndpoint: `/api/messages/${data._id}/attachments/${attachment._id}?download=1`,
        }),
      };
    }
    return {
      ...metadata,
      legacy: true,
      previewEndpoint: `/api/messages/${data._id}/attachments/${attachment._id}`,
      downloadEndpoint: `/api/messages/${data._id}/attachments/${attachment._id}?download=1`,
      canPreview: Boolean(legacyUrl),
      canDownload: Boolean(legacyUrl),
    };
  });
  return data;
}

module.exports = { serializeMessage };
