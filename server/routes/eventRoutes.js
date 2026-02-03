// server/routes/eventRoutes.js
const express = require('express');
const eventController = require('../controllers/eventController');
const authController = require('../controllers/authController');
const { uploadImages, uploadVideos } = require('../middleware/multer');

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
  uploadImages.array('images', 10),
  (req, res) => {
    try {
      if (!req.files || req.files.length === 0) {
        return res.status(400).json({
          status: 'fail',
          message: 'Aucune image n\'a été uploadée',
        });
      }

      const imageUrls = req.files.map(file => {
        const relativePath = file.path.split('uploads')[1].replace(/\\/g, '/');
        return `${req.protocol}://${req.get('host')}/uploads${relativePath}`;
      });

      console.log('✅ [Upload Images] Images uploadées:', imageUrls);

      res.status(200).json({
        status: 'success',
        message: `${req.files.length} image(s) uploadée(s) avec succès`,
        data: { images: imageUrls },
      });
    } catch (error) {
      console.error('❌ [Upload Images] Erreur:', error);
      res.status(500).json({
        status: 'error',
        message: 'Erreur lors de l\'upload des images',
      });
    }
  }
);

// ======================================================
// 🎬 UPLOAD DE VIDÉOS
// ======================================================
router.post(
  '/upload-videos',
  uploadVideos.array('videos', 3),
  (req, res) => {
    try {
      if (!req.files || req.files.length === 0) {
        return res.status(400).json({
          status: 'fail',
          message: 'Aucune vidéo n\'a été uploadée',
        });
      }

      // Vérifier que max 3 vidéos
      if (req.files.length > 3) {
        return res.status(400).json({
          status: 'fail',
          message: 'Maximum 3 vidéos autorisées',
        });
      }

      const videoUrls = req.files.map(file => {
        const relativePath = file.path.split('uploads')[1].replace(/\\/g, '/');
        const url = `${req.protocol}://${req.get('host')}/uploads${relativePath}`;
        
        // Ajouter des métadonnées
        return {
          url,
          filename: file.filename,
          size: file.size,
          mimetype: file.mimetype
        };
      });

      console.log('✅ [Upload Videos] Vidéos uploadées:', videoUrls);

      res.status(200).json({
        status: 'success',
        message: `${req.files.length} vidéo(s) uploadée(s) avec succès`,
        data: { 
          videos: videoUrls.map(v => v.url),
          metadata: videoUrls
        },
      });
    } catch (error) {
      console.error('❌ [Upload Videos] Erreur:', error);
      res.status(500).json({
        status: 'error',
        message: error.message || 'Erreur lors de l\'upload des vidéos',
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