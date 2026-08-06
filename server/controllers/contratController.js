const Contrat  = require('../models/Contrat');
const Paiement = require('../models/Paiement');
const Property = require('../models/Property');
const RentalManagement = require('../models/RentalManagement');
const rentalSync = require('../services/rentalListingSyncService');
const { logAction, buildAuteur } = require('../services/actionLogService');
const { notify } = require('../services/notificationService');
const RealEstateReservation = require('../models/RealEstateReservation');
// GL-ARCH-1.1 : extrait dans un service partagé pour être réutilisé par le
// script de réconciliation historique (server/scripts/reconcileRentalManagement.js)
// — comportement strictement inchangé, voir rentalManagementLeaseSyncService.js.
const { ensureRentalManagementActive, syncLeaseOccupation } = require('../services/rentalManagementLeaseSyncService');
// GL-LIFE-1 — la machine d'état devient l'unique point d'entrée pour tout
// changement de `statut` sur un bail (comportement inchangé pour les
// contrats de vente, hors périmètre du cycle de vie locatif).
const leaseLifecycle = require('../services/rentalLeaseLifecycleService');

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
    if (!req.body?.bien || !['location', 'vente'].includes(req.body?.type)) {
      return res.status(400).json({ status: 'fail', code: 'INVALID_CONTRACT_INPUT', message: 'Le bien et le type de contrat sont requis.' });
    }
    const property = await Property.findById(req.body.bien).select('status statusAdmin availability owner price reservationLock');
    if (!property) return res.status(404).json({ status: 'fail', code: 'PROPERTY_NOT_FOUND', message: 'Bien introuvable.' });
    if (property.status !== req.body.type) {
      return res.status(409).json({ status: 'fail', code: 'CONTRACT_TYPE_MISMATCH', message: 'Le type de contrat ne correspond pas au bien.' });
    }
    // REG-GL-1 : deux parcours légitimes et distincts créent un Contrat via
    // cette même route. (1) Le parcours public candidature/réservation
    // (RealEstateApplicationsPage → acceptation → réservation active) doit
    // rester strictement verrouillé sur cette réservation (IM-1R/IM-2.2) —
    // une réservation publique n'existe que sur une annonce publiée, donc
    // `statusAdmin==='Validée'` y reste un invariant légitime, pas une
    // dépendance métier à la publication. (2) La création manuelle par le
    // staff depuis GestionLocativePage (« Ajouter un contrat ») n'a jamais
    // transmis de `reservation`.
    // GL-ARCH-1 : pour ce second parcours, la Gestion Locative est la source
    // de vérité — la publication (statusAdmin) n'est qu'une vitrine
    // commerciale et ne doit jamais conditionner la création d'un bail
    // (Admin/Gestionnaire Immobilier doivent pouvoir créer un bail sur
    // n'importe quel bien pris en gestion, publié ou non). Seule la
    // disponibilité réelle du bien (occupation) reste vérifiée ici.
    let reservation = null;
    if (req.body.reservation) {
      reservation = await RealEstateReservation.findById(req.body.reservation);
      const expectedReservationType = req.body.type === 'location' ? 'rental' : 'sale';
      if (!reservation || reservation.status !== 'active' || reservation.expiresAt <= new Date()
        || reservation.type !== expectedReservationType || String(reservation.property) !== String(property._id)) {
        return res.status(409).json({ status: 'fail', code: 'ACTIVE_RESERVATION_REQUIRED', message: 'Une réservation active et cohérente est requise.' });
      }
      if (property.statusAdmin !== 'Validée' || property.availability !== 'Réservé' || String(property.reservationLock?.reservation) !== String(reservation._id)) {
        return res.status(409).json({ status: 'fail', code: 'PROPERTY_NOT_AVAILABLE', message: 'Ce bien ne peut plus faire l’objet d’un nouveau contrat.' });
      }
    } else if (property.availability !== 'Disponible') {
      return res.status(409).json({ status: 'fail', code: 'PROPERTY_NOT_AVAILABLE', message: 'Ce bien ne peut plus faire l’objet d’un nouveau contrat.' });
    }
    // GL-RECON-1 — l'invariant Property → RentalManagement actif → Contrat
    // doit être vrai AVANT l'insertion du bail. La synchronisation complète
    // d'occupation reste ensuite déléguée au même service officiel.
    if (req.body.type === 'location') {
      const rental = await ensureRentalManagementActive({
        property,
        actor: req.user.id,
        monthlyRent: req.body.montantLoyer,
      });
      if (!rental?.active || !rental?.managementActivated) {
        return res.status(409).json({
          status: 'fail',
          code: 'RENTAL_MANAGEMENT_REQUIRED',
          message: 'Le bien doit être activé en Gestion locative avant la création du bail.',
        });
      }
    }

    const c = await Contrat.create(req.body);
    if (reservation) {
      await RealEstateReservation.updateOne({ _id: reservation._id, status: 'active', contract: null }, { $set: { contract: c._id }, $push: { history: { from: 'active', to: 'active', action: 'contract_created', actor: req.user._id } } });
    }

    if (c.type === 'location') {
      await generatePaiements(c._id, c.dateEntree, c.dateFinBail, c.montantLoyer);
      await syncLeaseOccupation(c, req.user.id);
      // GL-LIFE-1 — amorce le cycle de vie dès la création (sinon dérivé à
      // la première transition) ; n'écrase jamais une valeur déjà fournie.
      if (!c.cycleVie) {
        c.cycleVie = leaseLifecycle.deriveCycleVie(c);
        c.cycleHistory.push({ to: c.cycleVie, action: 'contrat_cree', actor: req.user.id });
        await c.save();
      }
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
    if (err?.code === 11000) {
      return res.status(409).json({ status: 'fail', code: 'PROPERTY_CONTRACT_ALREADY_OPEN', message: 'Un contrat en attente ou actif existe déjà pour ce bien.' });
    }
    res.status(400).json({ status: 'error', message: err.message });
  }
};

exports.update = async (req, res) => {
  try {
    const existing = await Contrat.findById(req.params.id).select('type statut');
    if (!existing) return res.status(404).json({ status: 'error', message: 'Contrat introuvable' });

    const updates = { ...req.body };
    if (existing.type === 'location' && updates.statut !== undefined && updates.statut !== existing.statut) {
      // GL-LIFE-1 : toute demande de changement de statut sur un bail passe
      // désormais par la machine d'état centralisée — rejetée (409) si la
      // transition est illégale, jamais un écrasement silencieux.
      await leaseLifecycle.requestStatutChange(existing._id, updates.statut, { actor: req.user.id, comment: updates.comment });
      delete updates.statut; // déjà appliqué et synchronisé par la state machine
    }

    const c = await Contrat.findByIdAndUpdate(req.params.id, updates, {
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
    res.status(err.statusCode || 400).json({ status: 'error', message: err.message });
  }
};

exports.delete = async (req, res) => {
  try {
    const c = await Contrat.findById(req.params.id);
    if (!c) return res.status(404).json({ status: 'error', message: 'Contrat introuvable' });
    const historicalPayment = await Paiement.findOne({
      contrat: c._id,
      $or: [
        { statut: { $in: ['payé', 'partiel'] } },
        { montantRecu: { $gt: 0 } },
        { datePaiement: { $ne: null } },
        { reference: { $nin: [null, ''] } },
      ],
    }).select('_id');
    if (historicalPayment || (c.documents?.length || 0) > 0) {
      return res.status(409).json({ status: 'fail', code: 'CONTRACT_HISTORY_IMMUTABLE', message: 'Ce contrat possède un historique financier ou documentaire et doit être archivé, pas supprimé.' });
    }
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
    // Seules des échéances sans encaissement peuvent encore exister ici.
    await Paiement.deleteMany({ contrat: req.params.id });
    await Contrat.deleteOne({ _id: c._id });
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

// GL-LIFE-1 — réutilisé par rentalLeaseRenewalService.js pour générer les
// échéances futures d'un renouvellement (prolongation ou nouveau contrat
// lié) sans dupliquer cette logique de calendrier.
exports.generatePaiements = generatePaiements;
