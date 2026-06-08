const Paiement = require('../models/Paiement');

exports.getAll = async (req, res) => {
  try {
    const filter = {};
    if (req.query.contrat) filter.contrat = req.query.contrat;
    if (req.query.statut)  filter.statut  = req.query.statut;
    if (req.query.annee)   filter.annee   = parseInt(req.query.annee, 10);

    const paiements = await Paiement.find(filter)
      .populate('contrat', 'type adresseBien montantLoyer')
      .sort({ annee: 1, mois: 1 });

    res.json({ status: 'success', data: { paiements } });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
};

exports.getOne = async (req, res) => {
  try {
    const p = await Paiement.findById(req.params.id).populate('contrat');
    if (!p) return res.status(404).json({ status: 'error', message: 'Paiement introuvable' });
    res.json({ status: 'success', data: { paiement: p } });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
};

exports.update = async (req, res) => {
  try {
    const p = await Paiement.findByIdAndUpdate(req.params.id, req.body, {
      new: true, runValidators: true,
    });
    if (!p) return res.status(404).json({ status: 'error', message: 'Paiement introuvable' });
    res.json({ status: 'success', data: { paiement: p } });
  } catch (err) {
    res.status(400).json({ status: 'error', message: err.message });
  }
};

exports.delete = async (req, res) => {
  try {
    const p = await Paiement.findByIdAndDelete(req.params.id);
    if (!p) return res.status(404).json({ status: 'error', message: 'Paiement introuvable' });
    res.json({ status: 'success', message: 'Paiement supprimé' });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
};
