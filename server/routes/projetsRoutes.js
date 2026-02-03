const express = require('express');
const router = express.Router();
const Projet = require('../models/Projet');

router.get('/', async (req, res) => {
  try {
    const projets = await Projet.find().sort({ createdAt: -1 });
    res.json(projets);
  } catch (error) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

router.post('/', async (req, res) => {
  try {
    const projet = new Projet(req.body);
    await projet.save();
    res.status(201).json(projet);
  } catch (error) {
    res.status(400).json({ error: 'Erreur création', details: error.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const projet = await Projet.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );
    if (!projet) {
      return res.status(404).json({ error: 'Projet non trouvé' });
    }
    res.json(projet);
  } catch (error) {
    res.status(400).json({ error: 'Erreur modification' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const projet = await Projet.findByIdAndDelete(req.params.id);
    if (!projet) {
      return res.status(404).json({ error: 'Projet non trouvé' });
    }
    res.json({ message: 'Projet supprimé avec succès' });
  } catch (error) {
    res.status(500).json({ error: 'Erreur suppression' });
  }
});

module.exports = router;