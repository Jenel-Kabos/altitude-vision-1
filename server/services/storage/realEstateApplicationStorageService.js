const axios = require('axios');
const { cloudinary, uploadToCloudinary } = require('../../config/cloudinary');

const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;

async function storePrivateAttachment(buffer, { applicationId, attachmentId, mimeType }) {
  if (!Buffer.isBuffer(buffer) || !buffer.length || buffer.length > MAX_ATTACHMENT_BYTES) throw new Error('ATTACHMENT_SIZE_INVALID');
  const format = mimeType === 'application/pdf' ? 'pdf' : mimeType === 'image/png' ? 'png' : 'jpg';
  const result = await uploadToCloudinary(buffer, {
    public_id: `altitude-vision/private/real-estate-applications/${applicationId}/${attachmentId}`,
    resource_type: mimeType === 'application/pdf' ? 'raw' : 'image', type: 'authenticated', format,
    overwrite: false, invalidate: false,
  });
  return `${result.resource_type}:${result.public_id}:${result.version || ''}:${format}`;
}

async function readPrivateAttachment(storageKey) {
  const [resourceType, publicId, version, format] = String(storageKey || '').split(':');
  if (!resourceType || !publicId || !['raw', 'image'].includes(resourceType)) throw new Error('ATTACHMENT_STORAGE_KEY_INVALID');
  const url = cloudinary.url(publicId, {
    resource_type: resourceType, type: 'authenticated', version: version || undefined,
    sign_url: true, secure: true, format: format || undefined, expires_at: Math.floor(Date.now() / 1000) + 60,
  });
  const response = await axios.get(url, { responseType: 'arraybuffer', timeout: 15000, maxContentLength: MAX_ATTACHMENT_BYTES });
  return Buffer.from(response.data);
}

async function deletePrivateAttachment(storageKey) {
  const [resourceType, publicId] = String(storageKey || '').split(':');
  if (!resourceType || !publicId) return;
  await cloudinary.uploader.destroy(publicId, { resource_type: resourceType, type: 'authenticated', invalidate: true });
}

module.exports = { MAX_ATTACHMENT_BYTES, storePrivateAttachment, readPrivateAttachment, deletePrivateAttachment };
