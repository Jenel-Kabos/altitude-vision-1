const express = require('express');
const router = express.Router();
const { syncFacebook } = require('../scripts/sync-facebook');

router.get('/facebook', (req, res) => {
  res.status(405).json({ success: false, message: 'Utilisez POST pour déclencher la sync.' });
});

router.post('/facebook', async (req, res) => {
  try {
    const resultats = await syncFacebook();
    res.json({ success: true, message: 'Synchronisation réussie !', resultats });
  } catch (error) {
    console.error('❌ Sync Facebook échouée :', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;