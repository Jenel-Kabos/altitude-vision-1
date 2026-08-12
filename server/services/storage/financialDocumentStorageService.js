const { uploadPrivateAsset, readPrivateAsset } = require('./secureStorageService');

const MAX_PDF_BYTES = 10 * 1024 * 1024;

async function storeOfficialPdf(buffer, { documentId, artifactId }) {
  if (!Buffer.isBuffer(buffer) || !buffer.length || buffer.length > MAX_PDF_BYTES) throw new Error('FINANCIAL_PDF_SIZE_INVALID');
  const publicId = `altitude-vision/financial/hotel/${documentId}/${artifactId}`;
  const asset = await uploadPrivateAsset(buffer, {
    purpose: 'financial', ownerType: 'FinancialDocument', ownerId: documentId,
    filename: `${artifactId}.pdf`, mimeType: 'application/pdf', publicId,
  });
  return { provider: 'cloudinary', storageKey: asset.publicId, storageVersion: asset.version };
}

async function readOfficialPdf({ storageKey, storageVersion }) {
  return readPrivateAsset({ assetClass: 'PRIVATE_DOCUMENT', purpose: 'financial', provider: 'cloudinary', publicId: storageKey,
    resourceType: 'raw', deliveryType: 'authenticated', version: storageVersion || '', format: 'pdf', mimeType: 'application/pdf' });
}

module.exports = { MAX_PDF_BYTES, storeOfficialPdf, readOfficialPdf };
