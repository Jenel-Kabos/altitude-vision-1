const axios = require('axios');
const path = require('path');
const { cloudinary, uploadToCloudinary } = require('../../config/cloudinary');

const ASSET_CLASSES = Object.freeze({ PUBLIC_MEDIA: 'PUBLIC_MEDIA', PRIVATE_DOCUMENT: 'PRIVATE_DOCUMENT' });
const PRIVATE_PURPOSES = Object.freeze(['identity', 'lease', 'financial', 'conversation', 'maintenance', 'application', 'administrative']);
const MAX_PRIVATE_BYTES = 100 * 1024 * 1024;
const PRIVATE_ACCESS_TTL_SECONDS = 60;

const safeSegment = (value, fallback = 'asset') => String(value || fallback)
  .normalize('NFKD').replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 100) || fallback;

const extensionFor = (filename, mimeType) => {
  const ext = path.extname(String(filename || '')).replace('.', '').toLowerCase();
  if (ext) return ext;
  if (mimeType === 'application/pdf') return 'pdf';
  if (mimeType === 'image/png') return 'png';
  if (mimeType === 'image/webp') return 'webp';
  if (mimeType?.startsWith('image/')) return 'jpg';
  if (mimeType?.startsWith('audio/')) return 'mp3';
  if (mimeType?.startsWith('video/')) return 'mp4';
  return 'bin';
};

const resourceTypeFor = (mimeType) => {
  if (mimeType?.startsWith('image/')) return 'image';
  if (mimeType?.startsWith('audio/') || mimeType?.startsWith('video/')) return 'video';
  return 'raw';
};

const assertPrivatePurpose = (purpose) => {
  if (!PRIVATE_PURPOSES.includes(purpose)) throw new Error('PRIVATE_ASSET_PURPOSE_INVALID');
};

const toStoredAsset = (result, metadata) => ({
  assetClass: ASSET_CLASSES.PRIVATE_DOCUMENT,
  purpose: metadata.purpose,
  provider: 'cloudinary',
  publicId: result.public_id,
  resourceType: result.resource_type,
  deliveryType: 'authenticated',
  version: String(result.version || ''),
  format: result.format || metadata.format,
  mimeType: metadata.mimeType || 'application/octet-stream',
  originalFilename: String(metadata.originalFilename || 'document').slice(0, 255),
  size: Number(result.bytes || metadata.size || 0),
});

async function uploadPublicAsset(buffer, options = {}) {
  if (!Buffer.isBuffer(buffer) || !buffer.length) throw new Error('PUBLIC_ASSET_BUFFER_INVALID');
  return uploadToCloudinary(buffer, { ...options, type: 'upload' });
}

async function uploadPrivateAsset(buffer, {
  purpose, ownerType, ownerId, filename, mimeType = 'application/octet-stream', folder = 'altitude-vision/private', publicId,
} = {}) {
  assertPrivatePurpose(purpose);
  if (!Buffer.isBuffer(buffer) || !buffer.length || buffer.length > MAX_PRIVATE_BYTES) throw new Error('PRIVATE_ASSET_SIZE_INVALID');
  if (!ownerType || !ownerId) throw new Error('PRIVATE_ASSET_OWNER_REQUIRED');
  const resourceType = resourceTypeFor(mimeType);
  const format = extensionFor(filename, mimeType);
  const resolvedPublicId = publicId || [folder, purpose, safeSegment(ownerType), safeSegment(ownerId), `${Date.now()}-${safeSegment(filename)}`].join('/');
  const result = await uploadToCloudinary(buffer, {
    public_id: resolvedPublicId,
    resource_type: resourceType,
    type: 'authenticated',
    format,
    overwrite: false,
    invalidate: false,
    // Les transformations par défaut des médias publics ne doivent jamais
    // modifier un document privé ou une preuve originale.
    quality: undefined,
    fetch_format: undefined,
    width: undefined,
    crop: undefined,
  });
  return toStoredAsset(result, { purpose, filename, originalFilename: filename, mimeType, size: buffer.length, format });
}

function assertPrivateAsset(asset) {
  if (!asset || asset.assetClass !== ASSET_CLASSES.PRIVATE_DOCUMENT || asset.provider !== 'cloudinary'
    || asset.deliveryType !== 'authenticated' || !asset.publicId || !asset.resourceType) {
    throw new Error('PRIVATE_ASSET_REFERENCE_INVALID');
  }
  return asset;
}

function generatePrivateAccess(asset, { expiresIn = PRIVATE_ACCESS_TTL_SECONDS, attachment = false } = {}) {
  const stored = assertPrivateAsset(asset);
  const expiresAt = Math.floor(Date.now() / 1000) + Math.max(1, Math.min(300, Number(expiresIn) || PRIVATE_ACCESS_TTL_SECONDS));
  const url = cloudinary.utils.private_download_url(stored.publicId, stored.format || '', {
    resource_type: stored.resourceType,
    type: 'authenticated',
    version: stored.version || undefined,
    attachment,
    expires_at: expiresAt,
  });
  return { url, expiresAt };
}

async function readPrivateAsset(asset) {
  const stored = assertPrivateAsset(asset);
  const { url } = generatePrivateAccess(stored);
  const response = await axios.get(url, {
    responseType: 'arraybuffer', timeout: 20000, maxContentLength: MAX_PRIVATE_BYTES,
    headers: { Accept: stored.mimeType || 'application/octet-stream' },
  });
  return Buffer.from(response.data);
}

async function deletePrivateAsset(asset) {
  const stored = assertPrivateAsset(asset);
  return cloudinary.uploader.destroy(stored.publicId, {
    resource_type: stored.resourceType, type: 'authenticated', invalidate: true,
  });
}

const safePrivateDescriptor = (asset, { previewEndpoint, downloadEndpoint } = {}) => ({
  assetClass: ASSET_CLASSES.PRIVATE_DOCUMENT,
  purpose: asset?.purpose,
  mimeType: asset?.mimeType,
  originalFilename: asset?.originalFilename,
  size: asset?.size,
  canPreview: Boolean(previewEndpoint),
  canDownload: Boolean(downloadEndpoint || previewEndpoint),
  ...(previewEndpoint && { previewEndpoint }),
  ...(downloadEndpoint && { downloadEndpoint }),
});

module.exports = {
  ASSET_CLASSES,
  PRIVATE_PURPOSES,
  MAX_PRIVATE_BYTES,
  PRIVATE_ACCESS_TTL_SECONDS,
  uploadPublicAsset,
  uploadPrivateAsset,
  generatePrivateAccess,
  readPrivateAsset,
  deletePrivateAsset,
  safePrivateDescriptor,
  assertPrivateAsset,
};
