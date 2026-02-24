const cloudinary = require('cloudinary').v2;
const multer = require('multer');
const { Readable } = require('stream');
const dotenv = require('dotenv');

dotenv.config();

// 1. Connexion à Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// 2. Multer stocke en mémoire (plus besoin de multer-storage-cloudinary)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB max
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Format non supporté'), false);
    }
  },
});

// 3. Fonction d'upload vers Cloudinary (stream)
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

module.exports = { upload, uploadToCloudinary };