const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const multer = require('multer');
const dotenv = require('dotenv');

dotenv.config();

// 1. Connexion à Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// 2. Configuration du stockage
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'altitude-vision', // Le nom du dossier dans ton nuage
    allowed_formats: ['jpg', 'png', 'jpeg', 'webp', 'pdf'], // Formats acceptés
    // Transformation automatique (optionnel, pour réduire la taille)
    transformation: [{ width: 1000, crop: "limit" }],
  },
});

// 3. Création de l'outil d'upload
const upload = multer({ storage: storage });

module.exports = upload;