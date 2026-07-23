const axios = require('axios');
const { cloudinary, uploadToCloudinary } = require('../../config/cloudinary');

const MAX_PDF_BYTES = 10 * 1024 * 1024;

async function storeOfficialPdf(buffer, { documentId, artifactId }) {
  if (!Buffer.isBuffer(buffer) || !buffer.length || buffer.length > MAX_PDF_BYTES) throw new Error('FINANCIAL_PDF_SIZE_INVALID');
  const publicId = `altitude-vision/financial/hotel/${documentId}/${artifactId}`;
  const result = await uploadToCloudinary(buffer, {
    public_id: publicId, resource_type: 'raw', type: 'authenticated', format: 'pdf',
    overwrite: false, invalidate: false,
  });
  return { provider: 'cloudinary', storageKey: result.public_id, storageVersion: String(result.version || '') };
}

async function readOfficialPdf({ storageKey, storageVersion }) {
  const url = cloudinary.url(storageKey, {
    resource_type: 'raw', type: 'authenticated', version: storageVersion || undefined,
    sign_url: true, secure: true, format: 'pdf', expires_at: Math.floor(Date.now() / 1000) + 60,
  });
  const response = await axios.get(url, { responseType: 'arraybuffer', timeout: 15000, maxContentLength: MAX_PDF_BYTES });
  return Buffer.from(response.data);
}

module.exports = { MAX_PDF_BYTES, storeOfficialPdf, readOfficialPdf };
