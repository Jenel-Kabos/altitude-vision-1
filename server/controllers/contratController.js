const Contrat  = require('../models/Contrat');
const Paiement = require('../models/Paiement');
const Property = require('../models/Property');
const RentalManagement = require('../models/RentalManagement');
const rentalSync = require('../services/rentalListingSyncService');
const { logAction, buildAuteur } = require('../services/actionLogService');
const { notify } = require('../services/notificationService');

const syncLeaseOccupation = async (contract, actor) => {
  if (contract.type !== 'location' || !contract.bien) return;
  const propertyId = contract.bien?._id || contract.bien;
  const property = await Property.findById(propertyId).select('_id owner status price');
  if (!property || property.status !== 'location') return;
  const rental = await RentalManagement.findOneAndUpdate(
    { property: property._id },
    {
      $setOnInsert: { property: property._id, owner: property.owner, manager: actor },
      // Un bail signé implique une gestion active, même si l'écran d'activation
      // dédié n'a jamais été utilisé (Sprint A — voir rentalManagementController.create).
      $set: { monthlyRent: contract.montantLoyer ?? property.price, managementActivated: true },
    },
    { new: true, upsert: true, runValidators: true },
  );
  if (contract.statut === 'actif') {
    await rentalSync.markPropertyRented(rental._id, { leaseId: contract._id, tenantId: contract.locataire, actor, source: 'contract' });
  } else if (['résilié', 'expiré'].includes(contract.statut) && rental.activeLease?.toString() === contract._id.toString()) {
    await rentalSync.schedulePropertyExit(rental._id, { actor, source: 'contract' });
  }
};

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
      await syncLeaseOccupation(c, req.user.id);
    }

    const populated = await c.populate([
      { path: 'proprietaire', select: 'nom prenom telephone' },
      { path: 'locataire',    select: 'nom prenom telephone' },
      { path: 'bien',         select: 'title address' },
    ]);

    res.status(201).json({ status: 'success', data: { contrat: populated } });

    // Notifie locataire et propriétaire s'ils ont un userId
    const notifBase = {
      type:  'contrat_new',
      title: 'Nouveau contrat 📄',
      body:  `Un contrat de ${c.type || 'location'} pour "${populated.bien?.title || 'votre bien'}" a été établi.`,
      data:  { screen: 'Profil' },
    };
    [populated.proprietaire?.userId, populated.locataire?.userId]
      .filter(Boolean)
      .forEach((uid) => notify({ recipient: uid, ...notifBase }).catch(() => {}));

    logAction({
      action: 'Contrat créé',
      description: `Contrat de ${c.type || 'location'} créé`,
      module: 'GestionLocative',
      typeAction: 'CRÉATION',
      auteur: buildAuteur(req.user),
      cible: { id: String(c._id), type: 'Contrat', nom: `Contrat ${c.type || ''} #${c._id}` },
      req,
    });
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
    await syncLeaseOccupation(c, req.user.id);
    res.json({ status: 'success', data: { contrat: c } });

    [c.proprietaire?.userId, c.locataire?.userId]
      .filter(Boolean)
      .forEach((uid) => notify({
        recipient: uid,
        type:  'contrat_updated',
        title: 'Contrat mis à jour',
        body:  `Votre contrat pour "${c.bien?.title || 'votre bien'}" a été modifié.`,
        data:  { screen: 'Profil' },
      }).catch(() => {}));

    logAction({
      action: 'Contrat modifié',
      description: `Contrat #${c._id} mis à jour`,
      module: 'GestionLocative',
      typeAction: 'MODIFICATION',
      auteur: buildAuteur(req.user),
      cible: { id: String(c._id), type: 'Contrat', nom: `Contrat ${c.type || ''} #${c._id}` },
      req,
    });
  } catch (err) {
    res.status(400).json({ status: 'error', message: err.message });
  }
};

exports.delete = async (req, res) => {
  try {
    const c = await Contrat.findByIdAndDelete(req.params.id);
    if (!c) return res.status(404).json({ status: 'error', message: 'Contrat introuvable' });
    if (c.type === 'location' && c.bien) {
      const rental = await RentalManagement.findOne({ property: c.bien?._id || c.bien });
      if (rental?.activeLease?.toString() === c._id.toString()) {
        await rentalSync.schedulePropertyExit(rental._id, {
          actor: req.user.id,
          source: 'contract',
          comment: 'Contrat supprimé : contrôle de sortie requis',
        });
      }
    }
    // Supprimer les paiements associés
    await Paiement.deleteMany({ contrat: req.params.id });
    res.json({ status: 'success', message: 'Contrat et paiements supprimés' });
    logAction({
      action: 'Contrat supprimé',
      description: `Contrat #${c._id} et ses paiements supprimés`,
      module: 'GestionLocative',
      typeAction: 'SUPPRESSION',
      auteur: buildAuteur(req.user),
      cible: { id: String(c._id), type: 'Contrat', nom: `Contrat ${c.type || ''} #${c._id}` },
      req,
    });
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
    const { notifyContractTenant } = require('../services/rentalTenantNotificationService');
    await notifyContractTenant(req.params.id, {
      type: 'tenant_payment_recorded', title: 'Paiement locatif enregistré',
      body: `Une échéance ${p.mois || ''}/${p.annee || ''} a été enregistrée.`, entityType: 'Paiement', entityId: p._id,
      dedupeKey: `tenant:payment:${p._id}:${p.statut}`, metadata: { paymentId: String(p._id), status: p.statut },
    }).catch(() => {});
    res.status(201).json({ status: 'success', data: { paiement: p } });
  } catch (err) {
    res.status(400).json({ status: 'error', message: err.message });
  }
};
