const crypto = require('crypto');
const secureStorage = require('./secureStorageService');
const { MAX_FILE_BYTES, ALLOWED_MIME_TYPES } = require('../../middleware/tenantApplicationUpload');

const cleanFilename = (value) => Array.from(String(value || 'document').normalize('NFKC'))
  .filter((character) => character.charCodeAt(0) > 31 && character.charCodeAt(0) !== 127)
  .join('').replace(/[\\/]+/g, '-').trim().slice(0, 180) || 'document';
const storageError = (code, message, statusCode) => Object.assign(new Error(message), { name: 'TenantApplicationError', code, statusCode });

function contentMatchesMime(buffer, mimeType) {
  if (!Buffer.isBuffer(buffer) || !buffer.length) return false;
  if (mimeType === 'application/pdf') return buffer.subarray(0, 5).toString() === '%PDF-';
  if (mimeType === 'image/jpeg') return buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  if (mimeType === 'image/png') return buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  return false;
}

function validateFile(file) {
  if (!file?.buffer?.length) throw storageError('TENANT_APPLICATION_DOCUMENT_REQUIRED', 'Justificatif requis.', 422);
  if (file.buffer.length > MAX_FILE_BYTES) throw storageError('TENANT_APPLICATION_DOCUMENT_TOO_LARGE', 'Justificatif trop volumineux.', 413);
  if (!ALLOWED_MIME_TYPES.includes(file.mimetype) || !contentMatchesMime(file.buffer, file.mimetype)) {
    throw storageError('TENANT_APPLICATION_DOCUMENT_CONTENT_INVALID', 'Le contenu du justificatif ne correspond pas au format annoncé.', 415);
  }
  return { displayName: cleanFilename(file.originalname), mimeType: file.mimetype };
}

async function upload({ applicationId, attachmentId, file }) {
  const metadata = validateFile(file);
  const privateAsset = await secureStorage.uploadPrivateAsset(file.buffer, {
    purpose: 'application', ownerType: 'TenantApplication', ownerId: applicationId,
    filename: metadata.displayName, mimeType: metadata.mimeType,
    folder: 'altitude-vision/private/tenant-applications',
    publicId: `altitude-vision/private/tenant-applications/${applicationId}/${attachmentId}-${crypto.randomUUID()}`,
  });
  return { privateAsset, ...metadata };
}

module.exports = { upload, read: secureStorage.readPrivateAsset, remove: secureStorage.deletePrivateAsset, validateFile, cleanFilename };
