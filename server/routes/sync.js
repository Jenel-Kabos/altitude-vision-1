const express = require('express');
const router = express.Router();
const { syncFacebook } = require('../scripts/sync-facebook');

router.post('/facebook', async (req, res) => {
  try {
    await syncFacebook();
    res.json({ success: true, message: 'Synchronisation réussie !' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;

// Ce fichier définit une route POST /api/sync/facebook qui déclenche la synchronisation des posts Facebook.