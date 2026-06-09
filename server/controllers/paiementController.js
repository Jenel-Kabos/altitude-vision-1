const Paiement = require('../models/Paiement');
const Contrat  = require('../models/Contrat');
const { verifierPaiementsEnRetard } = require('../services/alerteService');

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

// ── Marquer comme payé (avec gestion pénalités) ────────────────
exports.marquerPaye = async (req, res) => {
  try {
    const p = await Paiement.findById(req.params.id);
    if (!p) return res.status(404).json({ status: 'error', message: 'Paiement introuvable' });

    const { montantRecu, datePaiement, modePaiement, reference, notes } = req.body;
    const recu = Number(montantRecu) || 0;

    let statut      = 'payé';
    let notesFinale = notes || '';

    if (p.penaliteAppliquee) {
      const totalDu = p.montantTotal || (p.montant + (p.penaliteMontant || 0));
      if (recu > 0 && recu < totalDu) statut = 'partiel';

      if (p.penaliteMontant > 0) {
        const mention = `Pénalité de retard incluse : ${p.penaliteMontant.toLocaleString('fr-FR')} FCFA`;
        notesFinale = notesFinale ? `${notesFinale}\n${mention}` : mention;
      }
    }

    const updated = await Paiement.findByIdAndUpdate(
      p._id,
      {
        statut,
        ...(recu > 0        && { montantRecu: recu }),
        ...(datePaiement    && { datePaiement }),
        ...(modePaiement    && { modePaiement }),
        ...(reference       && { reference }),
        ...(notesFinale     && { notes: notesFinale }),
      },
      { new: true },
    );

    res.json({ status: 'success', data: { paiement: updated } });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
};

// ── Déclencher manuellement le calcul des pénalités ────────────
exports.calculerPenalites = async (req, res) => {
  try {
    const result = await verifierPaiementsEnRetard();
    res.json({ status: 'success', data: result });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
};

// ── Résumé alertes pour le dashboard ───────────────────────────
exports.getAlertes = async (req, res) => {
  try {
    const maintenant = new Date();

    const paiementsRetard = await Paiement.find({
      statut: { $in: ['impayé', 'en_retard'] },
    }).select('retardJours penaliteAppliquee penaliteMontant');

    const nbImpayes     = paiementsRetard.filter(p => (p.retardJours || 0) >= 5).length;
    const nbPenalites   = paiementsRetard.filter(p => p.penaliteAppliquee).length;
    const totalPenalites = paiementsRetard
      .filter(p => p.penaliteAppliquee)
      .reduce((s, p) => s + (p.penaliteMontant || 0), 0);

    const dans30j = new Date(maintenant.getTime() + 30 * 24 * 60 * 60 * 1000);
    const bailsExpiration = await Contrat.countDocuments({
      statut: 'actif',
      type: 'location',
      dateFinBail: { $gte: maintenant, $lte: dans30j },
    });

    res.json({ status: 'success', data: { nbImpayes, nbPenalites, totalPenalites, bailsExpiration } });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
};
