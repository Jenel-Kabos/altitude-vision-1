// server/middleware/multer.js
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// ======================================================
// 📁 Créer les dossiers uploads s'ils n'existent pas
// ======================================================
const uploadDirs = {
  images:      './uploads/events',
  videos:      './uploads/events/videos',
  userPhotos:  './uploads/users',           // 🆕 Photos de profil
};

Object.values(uploadDirs).forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log(`✅ [Multer] Dossier ${dir} créé`);
  }
});

// ======================================================
// 🧹 Fonction pour nettoyer les noms de fichiers
// ======================================================
const sanitizeFilename = (filename) => {
  const ext = path.extname(filename);
  let name = path.basename(filename, ext);

  name = name.normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  name = name
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 50);

  if (!name || name.length < 3) {
    name = 'media';
  }

  return name + ext.toLowerCase();
};

// ======================================================
// 💾 Stockage événements (images + vidéos)
// ======================================================
const eventStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    const destDir = file.mimetype.startsWith('video/')
      ? uploadDirs.videos
      : uploadDirs.images;
    console.log(`📂 [Multer] Destination: ${destDir}`);
    cb(null, destDir);
  },
  filename: function (req, file, cb) {
    const cleanName   = sanitizeFilename(file.originalname);
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext         = path.extname(cleanName);
    const nameWithoutExt = path.basename(cleanName, ext);
    const finalName   = `${nameWithoutExt}-${uniqueSuffix}${ext}`;

    console.log('📸 [Multer] Fichier original:', file.originalname);
    console.log('📸 [Multer] Fichier nettoyé:', finalName);
    cb(null, finalName);
  },
});

// ======================================================
// 💾 Stockage photos de profil utilisateur           🆕
// ======================================================
const userPhotoStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    console.log(`📂 [Multer] Destination: ${uploadDirs.userPhotos}`);
    cb(null, uploadDirs.userPhotos);
  },
  filename: function (req, file, cb) {
    // Nommage : user-<userId>-<timestamp>.<ext>
    // req.user est injecté par le middleware d'authentification
    const userId      = req.user?._id || req.user?.id || 'unknown';
    const ext         = path.extname(file.originalname).toLowerCase();
    const finalName   = `user-${userId}-${Date.now()}${ext}`;

    console.log('🖼️  [Multer] Photo profil:', finalName);
    cb(null, finalName);
  },
});

// ======================================================
// 🔍 Filtres
// ======================================================
const imageFilter = (req, file, cb) => {
  const allowedExt  = /jpeg|jpg|png|gif|webp/;
  const extOk       = allowedExt.test(path.extname(file.originalname).toLowerCase());
  const mimeOk      = allowedExt.test(file.mimetype);

  if (mimeOk && extOk) {
    console.log('✅ [Multer] Image acceptée:', file.originalname);
    return cb(null, true);
  }
  console.error('❌ [Multer] Type image non autorisé:', file.originalname);
  cb(new Error('Seules les images sont autorisées (jpeg, jpg, png, gif, webp)'));
};

// Filtre strict pour photos de profil (pas de gif)    🆕
const userPhotoFilter = (req, file, cb) => {
  const allowedExt  = /jpeg|jpg|png|webp/;
  const extOk       = allowedExt.test(path.extname(file.originalname).toLowerCase());
  const mimeOk      = /image\/(jpeg|png|webp)/.test(file.mimetype);

  if (mimeOk && extOk) {
    console.log('✅ [Multer] Photo profil acceptée:', file.originalname);
    return cb(null, true);
  }
  console.error('❌ [Multer] Type non autorisé pour photo profil:', file.originalname);
  cb(new Error('Seuls les formats JPG, PNG et WebP sont acceptés pour la photo de profil'));
};

const videoFilter = (req, file, cb) => {
  const allowedExt  = /mp4|webm/;
  const extOk       = allowedExt.test(path.extname(file.originalname).toLowerCase());
  const mimeOk      = file.mimetype.startsWith('video/');

  if (mimeOk && extOk) {
    console.log('✅ [Multer] Vidéo acceptée:', file.originalname);
    return cb(null, true);
  }
  console.error('❌ [Multer] Type vidéo non autorisé:', file.originalname);
  cb(new Error('Seules les vidéos MP4 et WebM sont autorisées'));
};

// ======================================================
// ⚙️  Instances Multer
// ======================================================

// Images événements
const uploadImages = multer({
  storage: eventStorage,
  limits: { fileSize: 10 * 1024 * 1024 },   // 10 Mo
  fileFilter: imageFilter,
});

// Vidéos événements
const uploadVideos = multer({
  storage: eventStorage,
  limits: { fileSize: 100 * 1024 * 1024, files: 3 },   // 100 Mo, max 3
  fileFilter: videoFilter,
});

// Photo de profil utilisateur                          🆕
const uploadUserPhoto = multer({
  storage: userPhotoStorage,
  limits: { fileSize: 5 * 1024 * 1024 },    // 5 Mo (cohérent avec AccountPage)
  fileFilter: userPhotoFilter,
});

// ======================================================
// 🛠️  Helper : supprimer l'ancienne photo de profil   🆕
// ======================================================
/**
 * Supprime un fichier de photo de profil existant du disque.
 * @param {string} photoPath  Chemin relatif stocké en base (ex: "uploads/users/user-xxx.jpg")
 */
const deleteUserPhoto = (photoPath) => {
  if (!photoPath) return;

  // Accepte aussi bien un chemin relatif qu'une URL complète
  const relative = photoPath.replace(/^.*\/uploads\//, 'uploads/');
  const fullPath = path.resolve(relative);

  fs.unlink(fullPath, (err) => {
    if (err && err.code !== 'ENOENT') {
      console.error('⚠️  [Multer] Impossible de supprimer la photo:', err.message);
    } else {
      console.log('🗑️  [Multer] Photo supprimée:', fullPath);
    }
  });
};

// ======================================================
// 📤 EXPORTS
// ======================================================
module.exports = {
  uploadImages,
  uploadVideos,
  uploadUserPhoto,   // 🆕
  deleteUserPhoto,   // 🆕
  // Compatibilité descendante
  default: uploadImages,
};

module.exports.default = uploadImages;