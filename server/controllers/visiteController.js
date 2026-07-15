const asyncHandler = require('express-async-handler');
const Visite = require('../models/Visite');
const User   = require('../models/User');
const { notify, notifyStaff } = require('../services/notificationService');

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
    .populate('property', 'title images address availability')
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
  const Property = require('../models/Property');

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
