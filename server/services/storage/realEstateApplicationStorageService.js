const { uploadPrivateAsset, readPrivateAsset, deletePrivateAsset } = require('./secureStorageService');

const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;

async function storePrivateAttachment(buffer, { applicationId, attachmentId, mimeType }) {
  if (!Buffer.isBuffer(buffer) || !buffer.length || buffer.length > MAX_ATTACHMENT_BYTES) throw new Error('ATTACHMENT_SIZE_INVALID');
  const format = mimeType === 'application/pdf' ? 'pdf' : mimeType === 'image/png' ? 'png' : 'jpg';
  const result = await uploadPrivateAsset(buffer, {
    purpose: 'application', ownerType: 'RealEstateApplication', ownerId: applicationId,
    filename: `${attachmentId}.${format}`, mimeType,
    publicId: `altitude-vision/private/real-estate-applications/${applicationId}/${attachmentId}`,
  });
  return `${result.resourceType}:${result.publicId}:${result.version || ''}:${format}`;
}

async function readPrivateAttachment(storageKey) {
  const [resourceType, publicId, version, format] = String(storageKey || '').split(':');
  if (!resourceType || !publicId || !['raw', 'image'].includes(resourceType)) throw new Error('ATTACHMENT_STORAGE_KEY_INVALID');
  return readPrivateAsset({ assetClass: 'PRIVATE_DOCUMENT', purpose: 'application', provider: 'cloudinary', publicId,
    resourceType, deliveryType: 'authenticated', version, format, mimeType: format === 'pdf' ? 'application/pdf' : `image/${format}` });
}

async function deletePrivateAttachment(storageKey) {
  const [resourceType, publicId] = String(storageKey || '').split(':');
  if (!resourceType || !publicId) return;
  await deletePrivateAsset({ assetClass: 'PRIVATE_DOCUMENT', purpose: 'application', provider: 'cloudinary', publicId,
    resourceType, deliveryType: 'authenticated' });
}

module.exports = { MAX_ATTACHMENT_BYTES, storePrivateAttachment, readPrivateAttachment, deletePrivateAttachment };
