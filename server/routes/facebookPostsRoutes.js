const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');

const FacebookPost = mongoose.models.FacebookPost || mongoose.model('FacebookPost', new mongoose.Schema({
  facebook_id: { type: String, unique: true },
  page_name: String,
  page_id: String,
  message: String,
  image: String,
  permalink: String,
  date_publication: Date,
  date_sync: Date
}));

// GET /api/facebook-posts/recent → 10 derniers posts (page d'accueil)
router.get('/recent', async (req, res) => {
  try {
    const posts = await FacebookPost.find()
      .sort({ date_publication: -1 })
      .limit(10);
    res.json({ success: true, data: posts });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/facebook-posts/actus → posts des 5 derniers jours (page actualités)
router.get('/actus', async (req, res) => {
  try {
    const cinqJoursAvant = new Date();
    cinqJoursAvant.setDate(cinqJoursAvant.getDate() - 5);

    const posts = await FacebookPost.find({
      date_publication: { $gte: cinqJoursAvant }
    }).sort({ date_publication: -1 });

    res.json({ success: true, data: posts });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;