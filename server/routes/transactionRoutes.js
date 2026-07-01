const express = require('express');
const transactionController = require('../controllers/transactionController');
const authController = require('../controllers/authController');

const router = express.Router();

// Route accessible to any authenticated user — must be before the admin-only middleware
router.get('/my', authController.protect, transactionController.getMyTransactions);

// All routes below are for internal staff only
router.use(authController.protect, authController.restrictTo('Admin', 'Collaborateur'));

router.route('/')
    .get(transactionController.getAllTransactions)
    .post(transactionController.createTransaction);

// Special route to finalize a transaction
router.route('/:id/finalize')
    .post(transactionController.finalizeTransaction);

module.exports = router;