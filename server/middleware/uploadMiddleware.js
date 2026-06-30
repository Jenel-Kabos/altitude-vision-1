// Utilisation de CommonJS (require) au lieu de ESM (import)
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const logger = require('../utils/logger');

// Définir les types de fichiers acceptés pour les pièces jointes de messages
const MESSAGE_ATTACHMENT_TYPES = [
    'image/', 'application/pdf', 'application/msword', 
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/zip', 'application/x-zip-compressed',
];
const MAX_FILE_SIZE = 1024 * 1024 * 10; // 10 Mo

// Configuration du stockage sur le disque
const storage = multer.diskStorage({
  destination(req, file, cb) {
    let uploadPath = 'uploads/';
    
    // 🎯 Détection intelligente du type d'upload
    if (req.baseUrl.includes('/users') || req.path.includes('updateMe')) {
      uploadPath = 'uploads/users/'; // Ex: photos de profil
    } else if (req.baseUrl.includes('/messages')) { // ⬅️ NOUVEAU : Messages/Pièces jointes
        uploadPath = 'uploads/attachments/'; 
    } else if (req.baseUrl.includes('/properties')) {
      uploadPath = 'uploads/properties/';
    } else if (req.baseUrl.includes('/services')) {
      uploadPath = 'uploads/services/';
    } else if (req.baseUrl.includes('/events')) {
      uploadPath = 'uploads/events/';
    } else if (req.baseUrl.includes('/documents')) {
      uploadPath = 'uploads/documents/';
    }
    
    // Créer le chemin absolu
    const fullPath = path.join(__dirname, '..', uploadPath);
    
    // Créer le dossier s'il n'existe pas
    if (!fs.existsSync(fullPath)) {
      fs.mkdirSync(fullPath, { recursive: true });
      logger.info(`📁 [Upload] Dossier créé: ${fullPath}`);
    }
    
    logger.info(`📤 [Upload] Destination: ${fullPath}`);
    logger.info(`📤 [Upload] Route: ${req.baseUrl}${req.path}`);
    
    cb(null, fullPath);
  },
  filename(req, file, cb) {
    // Utilisation de l'ID utilisateur (si disponible via protect) et du timestamp
    const userId = req.user ? req.user.id : 'anonymous';
    const safeOriginalName = file.originalname.replace(/\s/g, '_');
    const uniqueName = `${userId}-${Date.now()}-${safeOriginalName}`;
    
    logger.info(`📝 [Upload] Nom du fichier: ${uniqueName}`);
    logger.info(`📝 [Upload] Fichier original: ${file.originalname}`);
    logger.info(`📝 [Upload] Type MIME: ${file.mimetype}`);
    
    cb(null, uniqueName);
  },
});

/**
 * Filtre personnalisé : images pour les avatars/propriétés, tout pour les messages
 */
function checkFileType(req, file, cb) {
  logger.info(`🔍 [Upload] Vérification du type: ${file.mimetype}`);
  
  // Logique spécifique aux PIÈCES JOINTES de messages
  if (req.baseUrl.includes('/messages')) {
    if (MESSAGE_ATTACHMENT_TYPES.some(type => file.mimetype.startsWith(type))) {
      logger.success(`✅ [Upload] Fichier accepté (Pièce jointe): ${file.originalname}`);
      return cb(null, true);
    } else {
      logger.info(`❌ [Upload] Fichier rejeté (Pièce jointe): ${file.originalname}`);
      cb(new Error('Erreur : Ce format de pièce jointe n\'est pas autorisé.'));
    }
  } 
  // Logique par défaut (pour les autres routes comme /users, /properties, etc.)
  else if (file.mimetype.startsWith('image/')) {
    logger.success(`✅ [Upload] Fichier accepté (Image): ${file.originalname}`);
    return cb(null, true);
  } else {
    logger.info(`❌ [Upload] Fichier rejeté (Image): ${file.originalname} (type: ${file.mimetype})`);
    cb(new Error('Erreur : Seules les images sont autorisées sur cette route !'));
  }
}

// Initialisation de Multer avec la configuration complète
const upload = multer({
  storage,
  limits: {
    fileSize: MAX_FILE_SIZE, // Limite la taille des fichiers à 10 Mo
  },
  fileFilter: function (req, file, cb) {
    checkFileType(req, file, cb); // On passe req pour la logique dynamique
  },
});

/**
 * Fonction pour supprimer les fichiers du disque en cas d'erreur de transaction ou de validation.
 * @param {Array<object>} files Tableau d'objets fichiers (req.files)
 */
const cleanupUploadedFiles = (files) => {
    if (Array.isArray(files) && files.length > 0) {
        files.forEach(file => {
            fs.unlink(file.path, (err) => {
                if (err) logger.error("⚠️ [Cleanup Error] Échec de la suppression du fichier:", file.path, err.message);
                else logger.info(`🗑️ [Cleanup] Fichier supprimé: ${file.path}`);
            });
        });
    }
};

// Middleware de gestion des erreurs Multer
const handleMulterError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    logger.error('❌ [Multer Error]:', err.message, err.code);
    // Tenter de nettoyer les fichiers si une erreur Multer survient après le stockage
    cleanupUploadedFiles(req.files); 

    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        status: 'error',
        message: `Fichier trop volumineux. Taille maximale: ${MAX_FILE_SIZE / (1024 * 1024)} MB.`
      });
    }
    return res.status(400).json({
      status: 'error',
      message: `Erreur d'upload: ${err.message}`
    });
  } else if (err) {
    logger.error('❌ [Upload Error]:', err.message);
    // Tenter de nettoyer les fichiers pour toute autre erreur (ex: fileFilter)
    cleanupUploadedFiles(req.files);
    return res.status(400).json({
      status: 'error',
      message: err.message
    });
  }
  next();
};

// Exporter les middlewares d'upload spécifiques aux besoins des messages
const uploadAttachments = upload.array('attachments', 5); // Nom du champ 'attachments', max 5 fichiers

// Utilisation de module.exports au lieu de export default
module.exports = upload;
module.exports.handleMulterError = handleMulterError;
module.exports.uploadAttachments = uploadAttachments;
module.exports.cleanupUploadedFiles = cleanupUploadedFiles;