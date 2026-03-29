// server/config/cloudinary.js
// ✅ multer@2.0.2 — CVE-2025-47944 & CVE-2025-47935 corrigés par la mise à jour
// API multer.memoryStorage() identique en v1 et v2, aucun breaking change ici.

const cloudinary    = require('cloudinary').v2;
const multer        = require('multer');
const { Readable }  = require('stream');
const dotenv        = require('dotenv');

dotenv.config();

// ── 1. Connexion à Cloudinary ─────────────────────────────────
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// ── 2. Multer en mémoire ──────────────────────────────────────
// ✅ limits.files ajouté : sans cette limite, un attaquant peut envoyer
//    des centaines de fichiers dans une seule requête → saturation mémoire (DoS).
//    fileSize seul ne protège pas contre les attaques multi-fichiers.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024,  // 10 Mo par fichier
    files:    15,                  // max 15 fichiers par requête (galerie immobilière)
  },
  fileFilter: (req, file, cb) => {
    // ✅ Liste blanche stricte avec includes() — pas de regex laxiste
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Format non supporté : ${file.mimetype}`), false);
    }
  },
});

// ── 3. Upload vers Cloudinary (stream) ───────────────────────
// ✅ Options d'optimisation centralisées ici plutôt que répétées
//    dans chaque contrôleur. Économie estimée : 40-60% sur le poids
//    des images (WebP auto + compression intelligente + redimensionnement).
//
// Les options passées en paramètre (ex: depuis propertyController.js)
// écrasent les defaults via le spread operator → comportement préservé.
const CLOUDINARY_DEFAULTS = {
  folder:       'altitude-vision',
  quality:      'auto',    // compression intelligente
  fetch_format: 'auto',    // WebP si le navigateur le supporte
  width:        1200,      // redimensionne si > 1200px
  crop:         'limit',   // ne touche pas les petites images
};

const uploadToCloudinary = (fileBuffer, options = {}) => {
  return new Promise((resolve, reject) => {
    const uploadOptions = {
      ...CLOUDINARY_DEFAULTS,
      ...options,           // les options du contrôleur écrasent les defaults
    };

    const stream = cloudinary.uploader.upload_stream(
      uploadOptions,
      (error, result) => {
        if (error) return reject(error);
        resolve(result);
      }
    );

    Readable.from(fileBuffer).pipe(stream);
  });
};

// ── 4. Suppression depuis Cloudinary via URL ──────────────────
/**
 * Extrait le public_id depuis une URL Cloudinary et supprime le fichier.
 * Non-bloquant : les erreurs sont loggées sans interrompre la requête appelante.
 * @param {string|null} url  URL Cloudinary (ex: https://res.cloudinary.com/...)
 */
const destroyFromCloudinary = async (url) => {
  if (!url || !url.includes('cloudinary.com')) return;
  try {
    const match    = url.match(/\/upload\/(?:v\d+\/)?(.+?)(\.[^.]+)?$/);
    const publicId = match?.[1];
    if (!publicId) return;

    const result = await cloudinary.uploader.destroy(publicId);
    console.log(`🗑️  [Cloudinary] Suppression "${publicId}" → ${result.result}`);
  } catch (err) {
    console.error('⚠️  [Cloudinary] Impossible de supprimer:', err.message);
  }
};

module.exports = { upload, uploadToCloudinary, destroyFromCloudinary };