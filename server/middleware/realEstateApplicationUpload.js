const multer = require('multer');

module.exports = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 5 },
  fileFilter: (_req, file, cb) => ['application/pdf', 'image/jpeg', 'image/png'].includes(file.mimetype)
    ? cb(null, true)
    : cb(new Error(`Format justificatif non autorisé : ${file.mimetype}`), false),
});
