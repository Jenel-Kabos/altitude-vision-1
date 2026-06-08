const Contrat  = require('../models/Contrat');
const Paiement = require('../models/Paiement');

// Génère les paiements mensuels pour un bail location
const generatePaiements = async (contratId, dateEntree, dateFinBail, montantLoyer) => {
  if (!dateEntree || !dateFinBail || !montantLoyer) return;

  const start = new Date(dateEntree);
  const end   = new Date(dateFinBail);
  const rows  = [];

  let cur = new Date(start.getFullYear(), start.getMonth(), 1);
  const endMonth = new Date(end.getFullYear(), end.getMonth(), 1);

  while (cur <= endMonth) {
    rows.push({
      contrat:  contratId,
      mois:     cur.getMonth() + 1,
      annee:    cur.getFullYear(),
      montant:  montantLoyer,
      statut:   'impayé',
    });
    cur.setMonth(cur.getMonth() + 1);
  }

  if (rows.length > 0) await Paiement.insertMany(rows);
};

exports.getAll = async (req, res) => {
  try {
    const filter = {};
    if (req.query.statut) filter.statut = req.query.statut;
    if (req.query.type)   filter.type   = req.query.type;

    const contrats = await Contrat.find(filter)
      .populate('proprietaire', 'nom prenom telephone')
      .populate('locataire',    'nom prenom telephone')
      .populate('bien',         'title address')
      .sort({ createdAt: -1 });

    res.json({ status: 'success', results: contrats.length, data: { contrats } });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
};

exports.getOne = async (req, res) => {
  try {
    const c = await Contrat.findById(req.params.id)
      .populate('proprietaire', 'nom prenom telephone email')
      .populate('locataire',    'nom prenom telephone email')
      .populate('bien',         'title address city');
    if (!c) return res.status(404).json({ status: 'error', message: 'Contrat introuvable' });
    res.json({ status: 'success', data: { contrat: c } });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
};

exports.create = async (req, res) => {
  try {
    const c = await Contrat.create(req.body);

    if (c.type === 'location') {
      await generatePaiements(c._id, c.dateEntree, c.dateFinBail, c.montantLoyer);
    }

    const populated = await c.populate([
      { path: 'proprietaire', select: 'nom prenom telephone' },
      { path: 'locataire',    select: 'nom prenom telephone' },
      { path: 'bien',         select: 'title address' },
    ]);

    res.status(201).json({ status: 'success', data: { contrat: populated } });
  } catch (err) {
    res.status(400).json({ status: 'error', message: err.message });
  }
};

exports.update = async (req, res) => {
  try {
    const c = await Contrat.findByIdAndUpdate(req.params.id, req.body, {
      new: true, runValidators: true,
    })
      .populate('proprietaire', 'nom prenom telephone')
      .populate('locataire',    'nom prenom telephone')
      .populate('bien',         'title address');

    if (!c) return res.status(404).json({ status: 'error', message: 'Contrat introuvable' });
    res.json({ status: 'success', data: { contrat: c } });
  } catch (err) {
    res.status(400).json({ status: 'error', message: err.message });
  }
};

exports.delete = async (req, res) => {
  try {
    const c = await Contrat.findByIdAndDelete(req.params.id);
    if (!c) return res.status(404).json({ status: 'error', message: 'Contrat introuvable' });
    // Supprimer les paiements associés
    await Paiement.deleteMany({ contrat: req.params.id });
    res.json({ status: 'success', message: 'Contrat et paiements supprimés' });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
};

// GET /api/contrats/:id/paiements
exports.getPaiements = async (req, res) => {
  try {
    const filter = { contrat: req.params.id };
    if (req.query.annee) filter.annee = parseInt(req.query.annee, 10);

    const paiements = await Paiement.find(filter).sort({ annee: 1, mois: 1 });
    res.json({ status: 'success', data: { paiements } });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
};

// POST /api/contrats/:id/paiements
exports.createPaiement = async (req, res) => {
  try {
    const p = await Paiement.create({ ...req.body, contrat: req.params.id });
    res.status(201).json({ status: 'success', data: { paiement: p } });
  } catch (err) {
    res.status(400).json({ status: 'error', message: err.message });
  }
};
