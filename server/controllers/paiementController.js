const Paiement = require('../models/Paiement');
const Contrat  = require('../models/Contrat');
const { verifierPaiementsEnRetard } = require('../services/alerteService');
const { logAction, buildAuteur } = require('../services/actionLogService');
const { notifyContractTenant } = require('../services/rentalTenantNotificationService');

exports.getAll = async (req, res) => {
  try {
    const filter = {};
    if (req.query.contrat) filter.contrat = req.query.contrat;
    if (req.query.statut)  filter.statut  = req.query.statut;
    if (req.query.annee)   filter.annee   = parseInt(req.query.annee, 10);

    // Sprint GL-B2 — pagination optionnelle (comportement inchangé si
    // `page`/`limit` absents, pour ne casser aucun appelant existant).
    const hasPagination = req.query.page !== undefined || req.query.limit !== undefined;
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(200, Math.max(1, Number(req.query.limit) || 20));

    let query = Paiement.find(filter)
      .populate({
        path: 'contrat',
        select: 'type adresseBien montantLoyer locataire',
        populate: { path: 'locataire', select: 'nom prenom' },
      })
      .sort({ annee: 1, mois: 1 });
    if (hasPagination) query = query.skip((page - 1) * limit).limit(limit);
    else query = query.limit(200);

    const [paiements, total] = await Promise.all([
      query,
      hasPagination ? Paiement.countDocuments(filter) : Promise.resolve(undefined),
    ]);

    res.json({
      status: 'success',
      data: hasPagination
        ? { paiements, total, page, totalPages: Math.ceil(total / limit) }
        : { paiements },
    });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
};

// ─────────────────────────────────────────────
// GET /api/paiements/stats — statistiques d'encaissement (mission GL-B2).
// Calculs entièrement côté serveur — jamais recalculés côté client.
// ─────────────────────────────────────────────
exports.getStats = async (req, res) => {
  try {
    const { annee } = req.query;
    const filter = {};
    if (annee) filter.annee = parseInt(annee, 10);

    const [grouped] = await Paiement.aggregate([
      { $match: filter },
      {
        $group: {
          _id: null,
          totalAttendu: { $sum: { $ifNull: ['$montantTotal', '$montant'] } },
          totalEncaisse: { $sum: { $cond: [{ $eq: ['$statut', 'payé'] }, { $ifNull: ['$montantRecu', '$montant'] }, { $ifNull: ['$montantRecu', 0] }] } },
          nbPayes: { $sum: { $cond: [{ $eq: ['$statut', 'payé'] }, 1, 0] } },
          nbPartiels: { $sum: { $cond: [{ $eq: ['$statut', 'partiel'] }, 1, 0] } },
          nbImpayes: { $sum: { $cond: [{ $in: ['$statut', ['impayé', 'en_retard']] }, 1, 0] } },
          nbTotal: { $sum: 1 },
        },
      },
    ]);
    const stats = grouped || { totalAttendu: 0, totalEncaisse: 0, nbPayes: 0, nbPartiels: 0, nbImpayes: 0, nbTotal: 0 };
    stats.totalImpaye = Math.max(0, (stats.totalAttendu || 0) - (stats.totalEncaisse || 0));
    stats.tauxEncaissement = stats.totalAttendu > 0 ? Math.round((stats.totalEncaisse / stats.totalAttendu) * 100) : 0;
    res.json({ status: 'success', data: { stats } });
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
    const current = await Paiement.findById(req.params.id);
    if (!current) return res.status(404).json({ status: 'error', message: 'Paiement introuvable' });
    if (current.statut === 'payé' || Number(current.montantRecu) > 0 || current.datePaiement || current.reference) {
      return res.status(409).json({ status: 'fail', code: 'PAYMENT_HISTORY_IMMUTABLE', message: 'Un encaissement enregistré ne peut plus être modifié.' });
    }
    const allowed = ['notes', 'jourEcheance'];
    const updates = Object.fromEntries(allowed.filter((field) => Object.prototype.hasOwnProperty.call(req.body, field)).map((field) => [field, req.body[field]]));
    if (!Object.keys(updates).length) {
      return res.status(422).json({ status: 'fail', message: 'Aucun champ modifiable fourni.' });
    }
    const p = await Paiement.findOneAndUpdate({ _id: current._id, statut: current.statut, montantRecu: current.montantRecu }, updates, {
      new: true, runValidators: true,
    });
    if (!p) return res.status(409).json({ status: 'fail', code: 'PAYMENT_CONCURRENT_UPDATE', message: 'Cette échéance vient d’être modifiée.' });
    res.json({ status: 'success', data: { paiement: p } });
  } catch (err) {
    res.status(400).json({ status: 'error', message: err.message });
  }
};

exports.delete = async (req, res) => {
  try {
    const current = await Paiement.findById(req.params.id);
    if (!current) return res.status(404).json({ status: 'error', message: 'Paiement introuvable' });
    if (current.statut === 'payé' || current.statut === 'partiel' || Number(current.montantRecu) > 0 || current.datePaiement || current.reference) {
      return res.status(409).json({ status: 'fail', code: 'PAYMENT_HISTORY_IMMUTABLE', message: 'Un encaissement historique ne peut pas être supprimé.' });
    }
    const p = await Paiement.findOneAndDelete({ _id: current._id, statut: { $in: ['impayé', 'en_retard'] }, montantRecu: { $in: [null, 0] } });
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
    const recu = Number(montantRecu);
    if (!Number.isFinite(recu) || recu <= 0) {
      return res.status(422).json({ status: 'fail', message: 'Le montant reçu doit être strictement positif.' });
    }
    if (p.statut === 'payé') {
      return res.status(409).json({ status: 'fail', code: 'PAYMENT_ALREADY_PAID', message: 'Cette échéance est déjà intégralement payée.' });
    }
    const totalDu = Number(p.montantTotal ?? p.montant ?? 0);
    if (totalDu <= 0 || recu > totalDu) {
      return res.status(422).json({ status: 'fail', message: 'Le montant reçu dépasse le montant dû.' });
    }
    if (Number(p.montantRecu) > 0 && recu < Number(p.montantRecu)) {
      return res.status(422).json({ status: 'fail', message: 'Le montant cumulé ne peut pas diminuer.' });
    }

    let statut      = recu < totalDu ? 'partiel' : 'payé';
    let notesFinale = notes || '';

    if (p.penaliteAppliquee) {
      if (p.penaliteMontant > 0) {
        const mention = `Pénalité de retard incluse : ${p.penaliteMontant.toLocaleString('fr-FR')} FCFA`;
        notesFinale = notesFinale ? `${notesFinale}\n${mention}` : mention;
      }
    }

    const updated = await Paiement.findOneAndUpdate(
      { _id: p._id, statut: p.statut, montantRecu: p.montantRecu },
      {
        statut,
        montantRecu: recu,
        ...(datePaiement    && { datePaiement }),
        ...(modePaiement    && { modePaiement }),
        ...(reference       && { reference }),
        ...(notesFinale     && { notes: notesFinale }),
      },
      { new: true },
    );
    if (!updated) {
      return res.status(409).json({ status: 'fail', code: 'PAYMENT_CONCURRENT_UPDATE', message: 'Un autre encaissement vient d’être enregistré sur cette échéance.' });
    }

    await notifyContractTenant(p.contrat, {
      type: 'tenant_payment_recorded', title: 'Paiement locatif enregistré',
      body: `Votre paiement ${updated.mois || ''}/${updated.annee || ''} est ${statut}.`, entityType: 'Paiement', entityId: updated._id,
      dedupeKey: `tenant:payment:${updated._id}:${statut}`, metadata: { paymentId: String(updated._id), status: statut },
    }).catch(() => {});

    res.json({ status: 'success', data: { paiement: updated } });
    const moisLabel = updated.mois ? updated.mois + '/' + updated.annee : String(updated.annee || '');
    logAction({
      action: 'Paiement enregistré',
      description: `Loyer ${moisLabel} marqué comme ${statut}`,
      module: 'GestionLocative',
      typeAction: 'PAIEMENT',
      auteur: buildAuteur(req.user),
      cible: { id: String(updated._id), type: 'Paiement', nom: `Loyer ${moisLabel}` },
      req,
    });
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
