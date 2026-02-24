// server/routes/eventRoutes.js
const express = require('express');
const eventController = require('../controllers/eventController');
const authController = require('../controllers/authController');
const { upload, uploadToCloudinary } = require('../config/cloudinary');

const router = express.Router();

// ======================================================
// 📢 ROUTES PUBLIQUES (Accessible à tous)
// ======================================================
router.get('/', eventController.getAllEvents);
router.get('/:id', eventController.getEvent);

// ======================================================
// 🔒 PROTECTION - Routes suivantes réservées aux admins/collaborateurs
// ======================================================
router.use(authController.protect);
router.use(authController.restrictTo('Admin', 'Collaborateur'));

// ======================================================
// 📤 UPLOAD D'IMAGES
// ======================================================
router.post(
  '/upload-images',
  upload.array('images', 10),
  async (req, res) => {
    try {
      if (!req.files || req.files.length === 0) {
        return res.status(400).json({
          status: 'fail',
          message: "Aucune image n'a été uploadée",
        });
      }

      const imageUrls = await Promise.all(
        req.files.map(file => uploadToCloudinary(file.buffer, {
          folder: 'altitude-vision/events',
          transformation: [{ width: 1200, crop: 'limit' }],
        }))
      );

      console.log('✅ [Upload Images] Images uploadées:', imageUrls.map(r => r.secure_url));

      res.status(200).json({
        status: 'success',
        message: `${req.files.length} image(s) uploadée(s) avec succès`,
        data: { images: imageUrls.map(r => r.secure_url) },
      });
    } catch (error) {
      console.error('❌ [Upload Images] Erreur:', error);
      res.status(500).json({
        status: 'error',
        message: "Erreur lors de l'upload des images",
      });
    }
  }
);

// ======================================================
// 🎬 UPLOAD DE VIDÉOS
// ======================================================
router.post(
  '/upload-videos',
  upload.array('videos', 3),
  async (req, res) => {
    try {
      if (!req.files || req.files.length === 0) {
        return res.status(400).json({
          status: 'fail',
          message: "Aucune vidéo n'a été uploadée",
        });
      }

      if (req.files.length > 3) {
        return res.status(400).json({
          status: 'fail',
          message: 'Maximum 3 vidéos autorisées',
        });
      }

      const videoResults = await Promise.all(
        req.files.map(file => uploadToCloudinary(file.buffer, {
          folder: 'altitude-vision/events/videos',
          resource_type: 'video', // ← Important pour les vidéos
        }))
      );

      const videoUrls = videoResults.map(result => ({
        url: result.secure_url,
        public_id: result.public_id,
        duration: result.duration,
        format: result.format,
      }));

      console.log('✅ [Upload Videos] Vidéos uploadées:', videoUrls.map(v => v.url));

      res.status(200).json({
        status: 'success',
        message: `${req.files.length} vidéo(s) uploadée(s) avec succès`,
        data: {
          videos: videoUrls.map(v => v.url),
          metadata: videoUrls,
        },
      });
    } catch (error) {
      console.error('❌ [Upload Videos] Erreur:', error);
      res.status(500).json({
        status: 'error',
        message: error.message || "Erreur lors de l'upload des vidéos",
      });
    }
  }
);

// ======================================================
// ✏️ CRUD ÉVÉNEMENTS
// ======================================================
router.post('/', eventController.createEvent);
router.put('/:id', eventController.updateEvent);
router.patch('/:id', eventController.updateEvent);
router.delete('/:id', eventController.deleteEvent);

module.exports = router;