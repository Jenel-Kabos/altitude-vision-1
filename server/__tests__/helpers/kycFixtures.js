// F-U1.J — fixtures KYC de TEST : documents fictifs bien formés et analyseur
// anti-malware factice. Aucune vraie pièce d'identité.
const { registerKycDocumentScanner } = require('../../services/storage/kycDocumentScanner');

const chunk = (type, data = Buffer.alloc(0)) => {
  const length = Buffer.alloc(4); length.writeUInt32BE(data.length);
  return Buffer.concat([length, Buffer.from(type, 'latin1'), data, Buffer.alloc(4)]);
};

// PNG minimal : signature, IHDR (dimensions), tEXt (graine → empreinte unique), IEND.
function fakePng(seed = 'fixture', { width = 800, height = 500 } = {}) {
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(width, 0); ihdr.writeUInt32BE(height, 4); ihdr[8] = 8; ihdr[9] = 2;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr),
    chunk('tEXt', Buffer.from(`Comment\u0000fictif-${seed}-${Math.random()}`, 'latin1')), chunk('IEND'),
  ]);
}

// JPEG minimal : SOI, SOF0 (dimensions), SOS, données, EOI.
function fakeJpeg(seed = 'fixture', { width = 800, height = 500 } = {}) {
  const sof = Buffer.from([0xff, 0xc0, 0x00, 0x0b, 0x08, height >> 8, height & 0xff, width >> 8, width & 0xff, 0x01, 0x01, 0x11, 0x00]);
  return Buffer.concat([Buffer.from([0xff, 0xd8]), sof, Buffer.from([0xff, 0xda, 0x00, 0x02]), Buffer.from(`fictif-${seed}-${Math.random()}`), Buffer.from([0xff, 0xd9])]);
}

const fakePdf = (body = '1 0 obj << /Type /Catalog >> endobj') => Buffer.from(`%PDF-1.4\n${body}\ntrailer << /Root 1 0 R >>\n%%EOF\n`, 'latin1');

const pngFile = (seed) => ({ buffer: fakePng(seed), mimetype: 'image/png', originalname: 'carte-identite-jean-dupont.png' });

function useCleanScanner() {
  const calls = [];
  registerKycDocumentScanner({ scan: async (buffer, { mimeType }) => { calls.push({ size: buffer.length, mimeType }); return { verdict: 'clean', engine: 'test-fixture' }; } });
  return calls;
}

function enableKycStorageForTests() {
  process.env.KYC_DOCUMENT_STORAGE_ENABLED = 'true';
  process.env.CLOUDINARY_CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME || 'test-cloud';
  process.env.CLOUDINARY_API_KEY = process.env.CLOUDINARY_API_KEY || 'test-key';
  process.env.CLOUDINARY_API_SECRET = process.env.CLOUDINARY_API_SECRET || 'test-secret-not-real';
  return useCleanScanner();
}

module.exports = { fakePng, fakeJpeg, fakePdf, pngFile, useCleanScanner, enableKycStorageForTests };
