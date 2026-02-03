// --- src/middlewares/multer.js ---
import multer from 'multer';
import path from 'path';
import fs from 'fs';

// Création du dossier uploads/users s'il n'existe pas
const uploadDir = path.join('uploads', 'users');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Configuration du stockage
const storage = multer.diskStorage({
  destination(req, file, cb) {
    cb(null, uploadDir);
  },
  filename(req, file, cb) {
    const ext = path.extname(file.originalname);
    const filename = `user-${Date.now()}${ext}`;
    cb(null, filename);
  },
});

// Filtrage des fichiers (acceptation images seulement)
const fileFilter = (req, file, cb) => {
  const allowedTypes = /jpg|jpeg|png/;
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowedTypes.test(file.mimetype);

  if (extname && mimetype) {
    cb(null, true);
  } else {
    cb(new Error('Seules les images (jpg, jpeg, png) sont autorisées'));
  }
};

// Limite taille fichier (ex: 5 Mo)
const limits = {
  fileSize: 5 * 1024 * 1024, // 5MB
};

const upload = multer({ storage, fileFilter, limits });

export default upload;
