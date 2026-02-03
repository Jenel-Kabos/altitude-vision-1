const express = require('express');
const router = express.Router();
const Devis = require('../models/Devis');

router.get('/', async (req, res) => {
  try {
    const devis = await Devis.find().sort({ createdAt: -1 });
    res.json(devis);
  } catch (error) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

router.post('/', async (req, res) => {
  try {
    const devisItem = new Devis(req.body);
    await devisItem.save();
    res.status(201).json(devisItem);
  } catch (error) {
    res.status(400).json({ error: 'Erreur création', details: error.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const devisItem = await Devis.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );
    if (!devisItem) {
      return res.status(404).json({ error: 'Devis non trouvé' });
    }
    res.json(devisItem);
  } catch (error) {
    res.status(400).json({ error: 'Erreur modification' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const devisItem = await Devis.findByIdAndDelete(req.params.id);
    if (!devisItem) {
      return res.status(404).json({ error: 'Devis non trouvé' });
    }
    res.json({ message: 'Devis supprimé avec succès' });
  } catch (error) {
    res.status(500).json({ error: 'Erreur suppression' });
  }
});

module.exports = router;