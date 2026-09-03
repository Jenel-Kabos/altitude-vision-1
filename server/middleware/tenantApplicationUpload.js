const multer = require('multer');

const MAX_FILE_BYTES = 10 * 1024 * 1024;
const ALLOWED_MIME_TYPES = Object.freeze(['application/pdf', 'image/jpeg', 'image/png']);

module.exports = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_BYTES, files: 1 },
  fileFilter: (_req, file, callback) => ALLOWED_MIME_TYPES.includes(file.mimetype)
    ? callback(null, true)
    : callback(Object.assign(new Error('Format de justificatif non autorisé.'), {
      name: 'TenantApplicationError', statusCode: 415, code: 'TENANT_APPLICATION_DOCUMENT_MIME_INVALID',
    })),
});
module.exports.MAX_FILE_BYTES = MAX_FILE_BYTES;
module.exports.ALLOWED_MIME_TYPES = ALLOWED_MIME_TYPES;
