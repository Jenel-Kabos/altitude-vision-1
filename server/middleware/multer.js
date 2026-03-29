// server/middleware/multer.js
// ✅ Compatible multer@2.0.0 — CVE-2025-47944 & CVE-2025-47935 corrigés
// L'API diskStorage/memoryStorage est inchangée en v2 — aucun breaking change
// sur ce fichier. La protection vient de la mise à jour de la librairie elle-même.

const multer = require('multer');
const path   = require('path');
const fs     = require('fs');

// ======================================================
// 📁 Créer les dossiers uploads s'ils n'existent pas
// ======================================================
const uploadDirs = {
  images:     './uploads/events',
  videos:     './uploads/events/videos',
  userPhotos: './uploads/users',
};

Object.values(uploadDirs).forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log(`✅ [Multer] Dossier ${dir} créé`);
  }
});

// ======================================================
// 🧹 Nettoyage des noms de fichiers
// ======================================================
const sanitizeFilename = (filename) => {
  const ext  = path.extname(filename);
  let   name = path.basename(filename, ext);

  name = name.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  name = name
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 50);

  if (!name || name.length < 3) name = 'media';

  return name + ext.toLowerCase();
};

// ======================================================
// 💾 Stockage événements (images + vidéos)
// ======================================================
const eventStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const destDir = file.mimetype.startsWith('video/')
      ? uploadDirs.videos
      : uploadDirs.images;
    cb(null, destDir);
  },
  filename: (req, file, cb) => {
    const cleanName      = sanitizeFilename(file.originalname);
    const uniqueSuffix   = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext            = path.extname(cleanName);
    const nameWithoutExt = path.basename(cleanName, ext);
    cb(null, `${nameWithoutExt}-${uniqueSuffix}${ext}`);
  },
});

// ======================================================
// 💾 Stockage photos de profil
// ======================================================
const userPhotoStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDirs.userPhotos),
  filename: (req, file, cb) => {
    const userId   = req.user?._id || req.user?.id || 'unknown';
    const ext      = path.extname(file.originalname).toLowerCase();
    cb(null, `user-${userId}-${Date.now()}${ext}`);
  },
});

// ======================================================
// 🔍 Filtres MIME + extension
// ======================================================
const imageFilter = (req, file, cb) => {
  const allowedMimes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
  const allowedExts  = /\.(jpeg|jpg|png|gif|webp)$/i;

  if (allowedMimes.includes(file.mimetype) && allowedExts.test(file.originalname)) {
    return cb(null, true);
  }
  cb(new multer.MulterError('LIMIT_UNEXPECTED_FILE', file.fieldname));
};

const userPhotoFilter = (req, file, cb) => {
  const allowedMimes = ['image/jpeg', 'image/png', 'image/webp'];
  const allowedExts  = /\.(jpeg|jpg|png|webp)$/i;

  if (allowedMimes.includes(file.mimetype) && allowedExts.test(file.originalname)) {
    return cb(null, true);
  }
  cb(new Error('Seuls les formats JPG, PNG et WebP sont acceptés pour la photo de profil'));
};

const videoFilter = (req, file, cb) => {
  const allowedMimes = ['video/mp4', 'video/webm'];
  const allowedExts  = /\.(mp4|webm)$/i;

  if (allowedMimes.includes(file.mimetype) && allowedExts.test(file.originalname)) {
    return cb(null, true);
  }
  cb(new Error('Seules les vidéos MP4 et WebM sont autorisées'));
};

// ======================================================
// ⚙️  Instances Multer
// ✅ limits.files ajouté partout — protection DoS supplémentaire
// ======================================================

// Images événements
const uploadImages = multer({
  storage:    eventStorage,
  fileFilter: imageFilter,
  limits: {
    fileSize: 10 * 1024 * 1024,  // 10 Mo par fichier
    files:    10,                  // max 10 fichiers par requête
  },
});

// Vidéos événements
const uploadVideos = multer({
  storage:    eventStorage,
  fileFilter: videoFilter,
  limits: {
    fileSize: 100 * 1024 * 1024, // 100 Mo par fichier
    files:    3,                  // max 3 vidéos
  },
});

// Photo de profil
const uploadUserPhoto = multer({
  storage:    userPhotoStorage,
  fileFilter: userPhotoFilter,
  limits: {
    fileSize: 5 * 1024 * 1024,   // 5 Mo
    files:    1,                  // 1 seule photo
  },
});

// ======================================================
// 💾 Middleware Cloudinary (memoryStorage)
// ✅ Utilisé par propertyController.js pour les biens immobiliers
// ✅ multer.memoryStorage() — API identique en v1 et v2
// ======================================================
const uploadPropertyImages = multer({
  storage:    multer.memoryStorage(),
  fileFilter: imageFilter,
  limits: {
    fileSize: 10 * 1024 * 1024,  // 10 Mo par fichier
    files:    15,                 // max 15 photos par bien
  },
});

// ======================================================
// 🛠️  Supprimer l'ancienne photo de profil
// ======================================================
const deleteUserPhoto = (photoPath) => {
  if (!photoPath) return;
  const relative = photoPath.replace(/^.*\/uploads\//, 'uploads/');
  const fullPath  = path.resolve(relative);

  fs.unlink(fullPath, (err) => {
    if (err && err.code !== 'ENOENT') {
      console.error('⚠️  [Multer] Impossible de supprimer la photo:', err.message);
    }
  });
};

// ======================================================
// 📤 EXPORTS
// ======================================================
module.exports = {
  uploadImages,
  uploadVideos,
  uploadUserPhoto,
  uploadPropertyImages,   // ✅ pour les routes /api/properties
  deleteUserPhoto,
  default: uploadImages,
};

module.exports.default = uploadImages;