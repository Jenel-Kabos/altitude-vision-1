const multer = require('multer');

const allowed = new Set(['image/jpeg', 'image/png', 'application/pdf']);
module.exports = multer({
  storage: multer.memoryStorage(),
  limits: { files: 1, fileSize: 8 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => cb(allowed.has(file.mimetype) ? null : Object.assign(new Error('Format de justificatif non autorisé.'), { statusCode: 400, code: 'FINANCIAL_PROOF_TYPE_INVALID' }), allowed.has(file.mimetype)),
}).single('proof');
