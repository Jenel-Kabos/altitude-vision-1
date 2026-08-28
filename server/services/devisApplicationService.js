const Devis = require('../models/Devis');

async function createDevis(data) {
  return Devis.create(data);
}

async function listDevis() {
  return Devis.find()
    .populate('traitePar', 'name')
    .sort('-createdAt');
}

async function updateDevis({ devisId, statut, noteInterne, traitePar }) {
  const devis = await Devis.findById(devisId);

  if (!devis) return null;

  if (statut !== undefined) devis.statut = statut;
  if (noteInterne !== undefined) devis.noteInterne = noteInterne;
  devis.traitePar = traitePar;

  await devis.save();
  await devis.populate('traitePar', 'name');

  return devis;
}

module.exports = {
  createDevis,
  listDevis,
  updateDevis,
};
