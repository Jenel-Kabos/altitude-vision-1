// server/routes/publiciteRoutes.js
const express = require('express');
const router = express.Router();

const authController = require('../controllers/authController');
const publiciteController = require('../controllers/publiciteController');

// ============================================================
// 1️⃣ ROUTE PUBLIQUE
// ============================================================

/**
 * @route GET /api/publicites/active
 * @description Publicités actives à afficher dans l'app mobile (Public)
 */
router.get('/active', publiciteController.getActivePublicites);

// ============================================================
// 2️⃣ ROUTES ADMIN
// ============================================================

/**
 * @route GET /api/publicites
 * @description Toutes les publicités (Admin)
 */
router.get(
  '/',
  authController.protect,
  authController.restrictTo('Admin'),
  publiciteController.getAllPublicites
);

/**
 * @route POST /api/publicites
 * @description Créer une publicité (Admin)
 */
router.post(
  '/',
  authController.protect,
  authController.restrictTo('Admin'),
  publiciteController.createPublicite
);

/**
 * @route PATCH /api/publicites/:id
 * @description Mettre à jour une publicité (Admin)
 */
router.patch(
  '/:id',
  authController.protect,
  authController.restrictTo('Admin'),
  publiciteController.updatePublicite
);

/**
 * @route DELETE /api/publicites/:id
 * @description Supprimer une publicité (Admin)
 */
router.delete(
  '/:id',
  authController.protect,
  authController.restrictTo('Admin'),
  publiciteController.deletePublicite
);

module.exports = router;
