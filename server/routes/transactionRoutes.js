const express = require('express');
const transactionController = require('../controllers/transactionController');
const authController = require('../controllers/authController');

const router = express.Router();

// All transaction routes are protected and for internal use only
router.use(authController.protect, authController.restrictTo('Admin', 'Collaborateur'));

router.route('/')
    .get(transactionController.getAllTransactions)
    .post(transactionController.createTransaction);

// Special route to finalize a transaction
router.route('/:id/finalize')
    .post(transactionController.finalizeTransaction);

module.exports = router;