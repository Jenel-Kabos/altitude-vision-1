const { safePrivateDescriptor } = require('./storage/secureStorageService');

/**
 * Représentation HTTP canonique d'un Message.
 * Pure : aucune requête, autorisation, mutation du document source ou
 * dépendance Express. Les projections sender/receiver restent la
 * responsabilité des requêtes appelantes.
 */
function serializeMessage(value) {
  const data = value?.toObject ? value.toObject() : { ...value };
  for (const party of ['sender', 'receiver']) {
    if (data[party] && typeof data[party] === 'object' && !data[party]._bsontype && ('_id' in data[party] || 'email' in data[party] || 'name' in data[party])) {
      const { email, phone, password, token, refreshToken, googleId, ...safeParty } = data[party];
      data[party] = safeParty;
    }
  }
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
