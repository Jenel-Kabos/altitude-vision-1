const asyncHandler = require('express-async-handler');
const Visite   = require('../models/Visite');
const User     = require('../models/User');
const Property = require('../models/Property');
const { notify, notifyStaff } = require('../services/notificationService');
const yabetooService = require('../services/yabetooService');

// ─────────────────────────────────────────────
// POST /api/visites — client crée une demande
// ─────────────────────────────────────────────
exports.createVisite = asyncHandler(async (req, res) => {
  const { propertyId, conversationId, datePreferee, heurePreferee, telephone, message } = req.body;

  if (!propertyId) {
    res.status(400);
    throw new Error('propertyId est requis.');
  }

  const visite = await Visite.create({
    property: propertyId,
    client: req.user.id,
    conversation: conversationId || null,
    datePreferee:  datePreferee  || '',
    heurePreferee: heurePreferee || '',
    telephone:     telephone     || '',
    message:       message       || '',
    statut: 'En attente',
  });

  await visite.populate('property', 'title images address owner');

  // Notifie le propriétaire du bien
  if (visite.property?.owner) {
    notify(visite.property.owner, {
      type:  'visite_new',
      title: 'Nouvelle demande de visite 🏠',
      body:  `${req.user.name} souhaite visiter votre bien : ${visite.property?.title || 'un bien'}`,
      data:  { screen: 'OwnerVisites' },
    }).catch(() => {});
  }

  // Notifie le staff d'une nouvelle demande
  notifyStaff({
    type:  'visite_new',
    title: 'Nouvelle demande de visite',
    body:  `${req.user.name} souhaite visiter : ${visite.property?.title || 'un bien'}`,
    data:  { screen: 'AdminVisites', params: { id: visite._id } },
  }).catch(() => {});

  res.status(201).json({
    status: 'success',
    data: { visite },
  });
});

// ─────────────────────────────────────────────
// GET /api/visites/my — visites du client connecté
// ─────────────────────────────────────────────
exports.getMyVisites = asyncHandler(async (req, res) => {
  const visites = await Visite.find({ client: req.user.id })
    .populate('property', 'title images address')
    .sort('-createdAt');

  res.status(200).json({
    status: 'success',
    results: visites.length,
    data: { visites },
  });
});

// ─────────────────────────────────────────────
// GET /api/visites — toutes les visites (staff)
// ─────────────────────────────────────────────
exports.getAllVisites = asyncHandler(async (req, res) => {
  const visites = await Visite.find()
    .populate({
      path: 'property',
      select: 'title images address availability honoraires fraisVisite price status owner latitude longitude',
      populate: {
        path: 'owner',
        select: 'name phone email',
      },
    })
    .populate('client', 'name email phone')
    .populate('conversation')
    .populate('traitePar', 'name')
    .sort('-createdAt');

  res.status(200).json({
    status: 'success',
    results: visites.length,
    data: { visites },
  });
});

// ─────────────────────────────────────────────
// PATCH /api/visites/:id — staff met à jour
// ─────────────────────────────────────────────
exports.updateVisite = asyncHandler(async (req, res) => {
  const visite = await Visite.findById(req.params.id);

  if (!visite) {
    res.status(404);
    throw new Error('Visite non trouvée.');
  }

  const { dateProposee, dateConfirmee, statut, notes } = req.body;
  const previousStatut = visite.statut;

  if (dateProposee !== undefined) visite.dateProposee = dateProposee;
  if (dateConfirmee !== undefined) visite.dateConfirmee = dateConfirmee;
  if (statut !== undefined) visite.statut = statut;
  if (notes !== undefined) visite.notes = notes;

  // Passage en "Confirmée" : détermine si des honoraires/frais de visite sont dus
  if (statut === 'Confirmée') {
    const prop = await Property.findById(visite.property).select('honoraires fraisVisite price status');
    const montantDu = (prop?.honoraires ?? (
      prop?.status === 'location'
        ? Math.round((prop?.price || 0) * 0.8)
        : Math.round((prop?.price || 0) * 0.1)
    )) + (prop?.fraisVisite || 0);
    if (montantDu > 0) visite.paiementStatus = 'en_attente';
  }

  visite.traitePar = req.user.id;

  await visite.save();

  await visite.populate('property', 'title images address');
  await visite.populate('client', 'name email');
  await visite.populate('traitePar', 'name');

  // Notifie le client si le statut a changé
  if (statut && statut !== previousStatut && visite.client) {
    const STATUT_MESSAGES = {
      'Confirmée':   { title: 'Visite confirmée ✅',   body: `Votre visite de "${visite.property?.title}" a été confirmée${dateConfirmee ? ` le ${new Date(dateConfirmee).toLocaleDateString('fr-FR')}` : ''}.` },
      'En cours':    { title: 'Visite en cours 🏃',    body: `Votre visite de "${visite.property?.title}" est maintenant en cours.` },
      'Refusée':     { title: 'Visite refusée',         body: `Votre demande de visite pour "${visite.property?.title}" n'a pas pu être acceptée.` },
      'Replanifiée': { title: 'Visite replanifiée 📅',  body: `Votre visite de "${visite.property?.title}" a été replanifiée${dateProposee ? ` au ${new Date(dateProposee).toLocaleDateString('fr-FR')}` : ''}.` },
      'Terminée':    { title: 'Visite effectuée',       body: `Merci pour votre visite de "${visite.property?.title}". N'hésitez pas à nous contacter.` },
      'Annulée':     { title: 'Visite annulée ❌',      body: `Votre visite de "${visite.property?.title}" a été annulée car elle n'a pas été prise en charge à l'heure prévue. Contactez-nous pour reprogrammer.` },
    };
    const msg = STATUT_MESSAGES[statut];
    if (msg) {
      notify(visite.client._id || visite.client, {
        type:  'visite_status',
        title: msg.title,
        body:  msg.body,
        data:  { screen: 'Visites', params: { id: visite._id } },
      }).catch(() => {});
    }
  }

  res.status(200).json({
    status: 'success',
    data: { visite },
  });
});

// ─────────────────────────────────────────────
// PATCH /api/visites/:id/cancel — client annule
// ─────────────────────────────────────────────
exports.cancelVisite = asyncHandler(async (req, res) => {
  const visite = await Visite.findById(req.params.id)
    .populate('property', 'title');

  if (!visite) {
    res.status(404);
    throw new Error('Visite non trouvée.');
  }

  if (visite.client.toString() !== req.user.id.toString()) {
    res.status(403);
    throw new Error('Accès refusé : vous ne pouvez annuler que vos propres demandes.');
  }

  if (visite.statut === 'Annulée') {
    res.status(400);
    throw new Error('Cette visite est déjà annulée.');
  }

  visite.statut = 'Annulée';
  await visite.save();

  // Notifie le staff de l'annulation
  notifyStaff({
    type:  'visite_cancelled',
    title: 'Visite annulée',
    body:  `${req.user.name} a annulé sa demande de visite pour "${visite.property?.title || 'un bien'}".`,
    data:  { screen: 'AdminVisites', params: { id: visite._id } },
  }).catch(() => {});

  res.status(200).json({
    status: 'success',
    data: { visite },
  });
});

// ─────────────────────────────────────────────
// GET /api/visites/owner — visites des biens du propriétaire
// ─────────────────────────────────────────────
exports.getOwnerVisites = asyncHandler(async (req, res) => {
  const properties = await Property.find({ owner: req.user.id }).select('_id title');
  const propertyIds = properties.map(p => p._id);

  if (propertyIds.length === 0) {
    return res.status(200).json({ status: 'success', results: 0, data: { visites: [] } });
  }

  const visites = await Visite.find({ property: { $in: propertyIds } })
    .populate('property', 'title images address')
    .populate('client', 'name email phone')
    .sort('-createdAt');

  res.status(200).json({
    status: 'success',
    results: visites.length,
    data: { visites },
  });
});

// ─────────────────────────────────────────────
// PATCH /api/visites/:id/paiement — staff met à jour le paiement
// ─────────────────────────────────────────────
exports.updatePaiementVisite = asyncHandler(async (req, res) => {
  const { paiementStatus, paiementRef } = req.body;

  const visite = await Visite.findByIdAndUpdate(
    req.params.id,
    { paiementStatus, paiementRef },
    { new: true, runValidators: true },
  );

  if (!visite) {
    res.status(404);
    throw new Error('Visite non trouvée.');
  }

  // Notifie le client si paiement confirmé
  if (paiementStatus === 'payé') {
    notify(visite.client._id || visite.client, {
      type:  'visite_confirmee',
      title: 'Paiement confirmé ✅',
      body:  'Votre paiement a été reçu. Votre visite est validée.',
      data:  { screen: 'Visites' },
    }).catch(() => {});
  }

  res.status(200).json({
    status: 'success',
    data: { visite },
  });
});

// ─────────────────────────────────────────────
// GET /api/visites/all-payments — staff : toutes les visites avec paiement requis
// ─────────────────────────────────────────────
exports.getAllPayments = asyncHandler(async (req, res) => {
  const visites = await Visite.find({ paiementStatus: { $ne: 'non_requis' } })
    .populate('client', 'name email phone')
    .populate({
      path: 'property',
      select: 'title images address price status honoraires fraisVisite owner',
      populate: { path: 'owner', select: 'name phone email' },
    })
    .sort('-updatedAt');

  res.status(200).json({
    status: 'success',
    results: visites.length,
    data: { visites },
  });
});

// ─────────────────────────────────────────────
// GET /api/visites/my-payments — client : ses visites avec paiement requis
// ─────────────────────────────────────────────
exports.getMyPayments = asyncHandler(async (req, res) => {
  const visites = await Visite.find({ client: req.user.id, paiementStatus: { $ne: 'non_requis' } })
    .populate({
      path: 'property',
      select: 'title address price status honoraires fraisVisite images',
    })
    .sort('-updatedAt');

  res.status(200).json({
    status: 'success',
    results: visites.length,
    data: { visites },
  });
});

// ─────────────────────────────────────────────
// POST /api/visites/:id/paiement/initier — client initie un paiement YabetooPay
// ─────────────────────────────────────────────
exports.initierPaiementVisite = asyncHandler(async (req, res) => {
  const { phone, operator } = req.body;

  if (!phone || !operator) {
    res.status(400);
    throw new Error('phone et operator sont requis.');
  }
  if (!['AIRTEL', 'MTN'].includes(operator)) {
    res.status(400);
    throw new Error('operator doit être AIRTEL ou MTN.');
  }

  const visite = await Visite.findById(req.params.id)
    .populate({ path: 'property', select: 'title price status honoraires fraisVisite' });

  if (!visite) {
    res.status(404);
    throw new Error('Visite introuvable.');
  }
  if (visite.client.toString() !== req.user.id.toString()) {
    res.status(403);
    throw new Error('Accès refusé.');
  }
  if (visite.paiementStatus === 'payé') {
    res.status(400);
    throw new Error('Déjà payé.');
  }

  const prop = visite.property;
  const honoraires = prop?.honoraires ?? (
    prop?.status === 'location'
      ? Math.round((prop?.price || 0) * 0.8)
      : Math.round((prop?.price || 0) * 0.1)
  );
  const montant = honoraires + (prop?.fraisVisite || 0);

  if (montant <= 0) {
    res.status(400);
    throw new Error('Aucun montant à payer.');
  }

  const intent = await yabetooService.createIntent({
    amount:   montant,
    phone,
    operator,
    firstName: req.user.name?.split(' ')[0] || '',
    lastName:  req.user.name?.split(' ').slice(1).join(' ') || '',
    description: `Honoraires visite — ${prop?.title || 'bien'}`,
    metadata: { visiteId: visite._id.toString() },
  });

  const intentId = intent?.id || intent?.data?.id;
  if (!intentId) {
    res.status(500);
    throw new Error("YabetooPay n'a pas retourné d'identifiant d'intention.");
  }

  // Déclenche la notification push MoMo sur le téléphone du client
  await yabetooService.confirmIntent(intentId);

  visite.paiementStatus = 'en_attente';
  visite.paiementRef = intentId;
  await visite.save();

  res.status(200).json({
    status: 'success',
    data: { intentId, montant },
  });
});

// ─────────────────────────────────────────────
// GET /api/visites/paiement/verifier/:intentId — vérifie le statut d'un paiement YabetooPay
// ─────────────────────────────────────────────
exports.verifierPaiementVisite = asyncHandler(async (req, res) => {
  const { intentId } = req.params;

  const visite = await Visite.findOne({ paiementRef: intentId }).populate('property', 'title');
  if (!visite) {
    res.status(404);
    throw new Error('Paiement introuvable.');
  }
  if (visite.client.toString() !== req.user.id.toString()) {
    res.status(403);
    throw new Error('Accès refusé.');
  }

  const intent  = await yabetooService.getIntent(intentId);
  const yStatus = intent?.status || intent?.data?.status;

  let statut = 'en_attente';
  if (yStatus === 'succeeded') statut = 'payé';
  else if (yStatus === 'failed') statut = 'échoué';

  if (statut === 'payé' && visite.paiementStatus !== 'payé') {
    visite.paiementStatus = 'payé';
    await visite.save();

    notify(visite.client, {
      type:  'visite_confirmee',
      title: 'Paiement confirmé ✅',
      body:  `Votre paiement pour "${visite.property?.title || 'un bien'}" a été reçu.`,
      data:  { screen: 'Visites' },
    }).catch(() => {});
  }

  res.status(200).json({
    status: 'success',
    data: { statut },
  });
});
