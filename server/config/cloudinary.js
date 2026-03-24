// --- server/config/cloudinary.js ---
const cloudinary = require('cloudinary').v2;
const multer     = require('multer');
const { Readable } = require('stream');
const dotenv     = require('dotenv');

dotenv.config();

// ── 1. Connexion à Cloudinary ─────────────────────────────────
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// ── 2. Multer en mémoire ──────────────────────────────────────
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 Mo
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
    allowed.includes(file.mimetype)
      ? cb(null, true)
      : cb(new Error('Format non supporté'), false);
  },
});

// ── 3. Upload vers Cloudinary (stream) ───────────────────────
const uploadToCloudinary = (fileBuffer, options = {}) => {
  return new Promise((resolve, reject) => {
    const uploadOptions = {
      folder: 'altitude-vision',
      transformation: [{ width: 1000, crop: 'limit' }],
      ...options,
    };

    const stream = cloudinary.uploader.upload_stream(uploadOptions, (error, result) => {
      if (error) return reject(error);
      resolve(result);
    });

    Readable.from(fileBuffer).pipe(stream);
  });
};

// ── 4. Suppression depuis Cloudinary via URL 🆕 ───────────────
/**
 * Extrait le public_id depuis une URL Cloudinary et supprime le fichier.
 * Non-bloquant : les erreurs sont loggées sans interrompre la requête appelante.
 * @param {string|null} url  URL Cloudinary stockée en base (ex: https://res.cloudinary.com/...)
 */
const destroyFromCloudinary = async (url) => {
  if (!url || !url.includes('cloudinary.com')) return;
  try {
    // Extrait le public_id : tout ce qui suit "/upload/vXXX/" jusqu'à l'extension
    const match = url.match(/\/upload\/(?:v\d+\/)?(.+?)(\.[^.]+)?$/);
    const publicId = match?.[1];
    if (!publicId) return;

    const result = await cloudinary.uploader.destroy(publicId);
    console.log(`🗑️  [Cloudinary] Suppression "${publicId}" → ${result.result}`);
  } catch (err) {
    console.error('⚠️  [Cloudinary] Impossible de supprimer:', err.message);
  }
};

module.exports = { upload, uploadToCloudinary, destroyFromCloudinary };