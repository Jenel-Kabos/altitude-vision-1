// F-U1.I — Réception d'un justificatif KYC : mémoire uniquement, un fichier,
// taille bornée. Le contenu réel (signature binaire) est revérifié par
// kycDocumentStorageService avant tout stockage.
const multer = require('multer');
const { KYC_DOCUMENT_ALLOWED_MIME_TYPES, KYC_DOCUMENT_MAX_BYTES } = require('../constants/financialKycConstants');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: KYC_DOCUMENT_MAX_BYTES, files: 1, fields: 5 },
  fileFilter: (_req, file, callback) => (KYC_DOCUMENT_ALLOWED_MIME_TYPES.includes(file.mimetype)
    ? callback(null, true)
    : callback(Object.assign(new Error('Format de justificatif non autorisé.'), { name: 'FinancialError', statusCode: 415, code: 'KYC_DOCUMENT_MIME_INVALID' }))),
}).single('file');

// Traduit les erreurs multer (taille, champs) en erreurs métier stables.
module.exports = (req, res, next) => upload(req, res, (error) => {
  if (!error) return next();
  if (error instanceof multer.MulterError) {
    return next(Object.assign(new Error('Justificatif refusé.'), { name: 'FinancialError', statusCode: error.code === 'LIMIT_FILE_SIZE' ? 413 : 422, code: `KYC_${error.code}` }));
  }
  return next(error);
});
