const express = require('express');
const router = express.Router();
const Realisation = require('../models/Realisation');

// GET - Toutes les réalisations
router.get('/', async (req, res) => {
  try {
    const realisations = await Realisation.find().sort({ createdAt: -1 });
    res.json(realisations);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// GET - Une réalisation par ID
router.get('/:id', async (req, res) => {
  try {
    const realisation = await Realisation.findById(req.params.id);
    if (!realisation) {
      return res.status(404).json({ error: 'Réalisation non trouvée' });
    }
    res.json(realisation);
  } catch (error) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// POST - Créer une réalisation
router.post('/', async (req, res) => {
  try {
    const realisation = new Realisation(req.body);
    await realisation.save();
    res.status(201).json(realisation);
  } catch (error) {
    console.error(error);
    res.status(400).json({ error: 'Erreur création', details: error.message });
  }
});

// PUT - Modifier une réalisation
router.put('/:id', async (req, res) => {
  try {
    const realisation = await Realisation.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );
    
    if (!realisation) {
      return res.status(404).json({ error: 'Réalisation non trouvée' });
    }
    
    res.json(realisation);
  } catch (error) {
    console.error(error);
    res.status(400).json({ error: 'Erreur modification', details: error.message });
  }
});

// DELETE - Supprimer une réalisation
router.delete('/:id', async (req, res) => {
  try {
    const realisation = await Realisation.findByIdAndDelete(req.params.id);
    
    if (!realisation) {
      return res.status(404).json({ error: 'Réalisation non trouvée' });
    }
    
    res.json({ message: 'Réalisation supprimée avec succès' });
  } catch (error) {
    res.status(500).json({ error: 'Erreur suppression' });
  }
});

module.exports = router;