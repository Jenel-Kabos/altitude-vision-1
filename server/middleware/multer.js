// server/middleware/multer.js
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// ======================================================
// 📁 Créer les dossiers uploads s'ils n'existent pas
// ======================================================
const uploadDirs = {
  images: './uploads/events',
  videos: './uploads/events/videos'
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
// 💾 Configuration du stockage (disque local)
// ======================================================
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    // Déterminer le dossier selon le type de fichier
    let destDir = uploadDirs.images;
    
    if (file.mimetype.startsWith('video/')) {
      destDir = uploadDirs.videos;
    }
    
    console.log(`📂 [Multer] Destination: ${destDir}`);
    cb(null, destDir);
  },
  filename: function (req, file, cb) {
    const cleanName = sanitizeFilename(file.originalname);
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(cleanName);
    const nameWithoutExt = path.basename(cleanName, ext);
    
    const finalName = nameWithoutExt + '-' + uniqueSuffix + ext;
    
    console.log('📸 [Multer] Fichier original:', file.originalname);
    console.log('📸 [Multer] Fichier nettoyé:', finalName);
    
    cb(null, finalName);
  }
});

// ======================================================
// 🔍 Filtrage des fichiers
// ======================================================
const imageFilter = (req, file, cb) => {
  const allowedExtensions = /jpeg|jpg|png|gif|webp/;
  const extname = allowedExtensions.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowedExtensions.test(file.mimetype);

  if (mimetype && extname) {
    console.log('✅ [Multer] Image acceptée:', file.originalname);
    return cb(null, true);
  } else {
    console.error('❌ [Multer] Type d\'image non autorisé:', file.originalname);
    cb(new Error('Seules les images sont autorisées (jpeg, jpg, png, gif, webp)'));
  }
};

// 🆕 Filtre pour les vidéos
const videoFilter = (req, file, cb) => {
  const allowedExtensions = /mp4|webm/;
  const extname = allowedExtensions.test(path.extname(file.originalname).toLowerCase());
  const mimetype = file.mimetype.startsWith('video/');

  if (mimetype && extname) {
    console.log('✅ [Multer] Vidéo acceptée:', file.originalname);
    return cb(null, true);
  } else {
    console.error('❌ [Multer] Type de vidéo non autorisé:', file.originalname);
    cb(new Error('Seules les vidéos MP4 et WebM sont autorisées'));
  }
};

// ======================================================
// ⚙️ Configuration Multer pour IMAGES
// ======================================================
const uploadImages = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
  },
  fileFilter: imageFilter
});

// ======================================================
// ⚙️ Configuration Multer pour VIDÉOS
// ======================================================
const uploadVideos = multer({
  storage: storage,
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB
    files: 3 // Maximum 3 vidéos
  },
  fileFilter: videoFilter
});

// ======================================================
// 📤 EXPORTS
// ======================================================
module.exports = {
  uploadImages,
  uploadVideos,
  // Export par défaut pour compatibilité
  default: uploadImages
};

// Export par défaut pour require sans destructuration
module.exports.default = uploadImages;