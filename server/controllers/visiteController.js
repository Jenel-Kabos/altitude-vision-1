const asyncHandler = require('express-async-handler');
const Visite   = require('../models/Visite');
const User     = require('../models/User');
const Property = require('../models/Property');
const { notify, notifyStaff } = require('../services/notificationService');
const yabetooService = require('../services/yabetooService');
const mongoose = require('mongoose');
const {
  STATUS, LABELS, LEGACY_TO_STATUS, normalizeStatus, canTransition,
  appendHistory, resetReminderStates, serializeVisite,
} = require('../services/visiteWorkflowService');

const sourceOf = (req) => req.get('x-altimmo-client') === 'mobile' ? 'mobile' : 'web';
const assertObjectId = (id, res) => {
  if (!mongoose.isValidObjectId(id)) {
    res.status(400);
    throw new Error('Identifiant de rendez-vous invalide.');
  }
};
const buildRequestedStart = (body) => {
  if (body.requestedDate) return new Date(body.requestedDate);
  if (!body.datePreferee) return null;
  let datePart = body.datePreferee;
  const french = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(datePart);
  if (french) datePart = `${french[3]}-${french[2]}-${french[1]}`;
  const value = /^\d{4}-\d{2}-\d{2}$/.test(datePart)
    ? `${datePart}T${body.heurePreferee || '00:00'}:00+01:00`
    : datePart;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

// ─────────────────────────────────────────────
// POST /api/visites — client crée une demande
// ─────────────────────────────────────────────
exports.createVisite = asyncHandler(async (req, res) => {
  const { propertyId, conversationId, datePreferee, heurePreferee, telephone, message,
    whatsapp, preferredContactMethod, visitorCount, clientContactConsent } = req.body;

  if (!propertyId) {
    res.status(400);
    throw new Error('propertyId est requis.');
  }

  if (!mongoose.isValidObjectId(propertyId)) {
    res.status(400);
    throw new Error('propertyId invalide.');
  }
  const property = await Property.findById(propertyId).populate('owner', 'name phone');
  if (!property) {
    res.status(404);
    throw new Error('Bien introuvable.');
  }
  if (property.availability !== 'Disponible' || property.statusAdmin !== 'Validée' || !property.isPublished) {
    res.status(409);
    throw new Error('Ce bien n’est pas disponible pour une nouvelle visite.');
  }
  const requestedStart = buildRequestedStart(req.body);
  if (!requestedStart || requestedStart <= new Date()) {
    res.status(400);
    throw new Error('Choisissez une date et une heure futures valides.');
  }
  if (!clientContactConsent) {
    res.status(400);
    throw new Error('Le consentement de contact est requis pour organiser la visite.');
  }
  const duplicate = await Visite.exists({
    property: propertyId, client: req.user.id,
    $or: [
      { status: { $in: [STATUS.REQUESTED, STATUS.AWAITING_CONFIRMATION, STATUS.CONFIRMED, STATUS.RESCHEDULED] } },
      { status: null, statut: { $in: ['En attente', 'Confirmée', 'Replanifiée'] } },
    ],
    requestedDate: { $gte: new Date(requestedStart.getTime() - 30 * 60 * 1000), $lte: new Date(requestedStart.getTime() + 30 * 60 * 1000) },
  });
  if (duplicate) {
    res.status(409);
    throw new Error('Une demande similaire existe déjà pour ce créneau.');
  }
  const address = property.address || {};
  const visite = await Visite.create({
    property: propertyId, owner: property.owner?._id || property.owner,
    client: req.user.id,
    conversation: conversationId || null,
    datePreferee:  datePreferee  || '',
    heurePreferee: heurePreferee || '',
    telephone:     telephone     || '',
    message:       message       || '',
    requestedDate: requestedStart,
    requestedTime: heurePreferee || '',
    clientNameSnapshot: req.user.name || '',
    clientPhoneSnapshot: telephone || req.user.phone || '',
    clientWhatsAppSnapshot: whatsapp || '',
    preferredContactMethod: preferredContactMethod || '',
    visitorCount: visitorCount || 1,
    clientContactConsent: true,
    ownerNameSnapshot: property.owner?.name || '',
    ownerPhoneSnapshot: property.owner?.phone || '',
    propertySnapshot: {
      title: property.title || '', reference: property.reference || property.ref || '',
      type: property.type || property.propertyType || '', city: address.city || '',
      arrondissement: address.arrondissement || '', quartier: address.neighborhood || address.quartier || '',
      image: property.images?.[0] || '', price: property.price ?? null,
      transaction: property.status || property.transaction || '', link: `/altimmo/property/${property._id}`,
    },
    clientNotes: message || '',
    status: STATUS.REQUESTED,
    statut: 'En attente',
    workflowHistory: [{ from: '', to: STATUS.REQUESTED, action: 'create', actor: req.user.id, role: 'client', source: sourceOf(req) }],
  });

  await visite.populate('property', 'title images address owner');

  // Notifie le propriétaire du bien
  if (visite.property?.owner) {
    notify({ recipient: visite.property.owner,
      type:  'visite_sur_mon_bien',
      title: 'Nouvelle demande de visite 🏠',
      body:  `Une demande de visite est en attente d’organisation pour : ${visite.property?.title || 'un bien'}.`,
      entityType: 'Visite', entityId: visite._id,
      data:  { screen: 'OwnerVisites', visiteId: visite._id.toString(), route: 'Visites' },
    }).catch(() => {});
  }

  // Notifie le staff d'une nouvelle demande
  notifyStaff({
    type:  'visite_new',
    title: 'Nouvelle demande de visite',
    body:  `${req.user.name} souhaite visiter : ${visite.property?.title || 'un bien'}`,
    entityType: 'Visite', entityId: visite._id,
    data:  { screen: 'AdminVisites', params: { id: visite._id }, visiteId: visite._id.toString(), route: 'Visites' },
  }).catch(() => {});

  res.status(201).json({
    status: 'success',
    data: { visite: serializeVisite(visite, 'client') },
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
    data: { visites: visites.map((visite) => serializeVisite(visite, 'client')) },
  });
});

// ─────────────────────────────────────────────
// GET /api/visites — toutes les visites (staff)
// ─────────────────────────────────────────────
exports.getAllVisites = asyncHandler(async (req, res) => {
  // La liste staff est la vue détaillée disponible dans ce module : la
  // consultation est distincte du statut « En attente » du rendez-vous.
  await Visite.updateMany({ staffViewedAt: null }, { $set: { staffViewedAt: new Date() } });
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
    data: { visites: visites.map((visite) => serializeVisite(visite, 'staff')) },
  });
});

exports.getUnreadCount = asyncHandler(async (_req, res) => {
  const unreadCount = await Visite.countDocuments({ staffViewedAt: null });
  res.status(200).json({ status: 'success', data: { unreadCount } });
});

// ─────────────────────────────────────────────
// PATCH /api/visites/:id — staff met à jour
// ─────────────────────────────────────────────
exports.updateVisite = asyncHandler(async (req, res) => {
  assertObjectId(req.params.id, res);
  const visite = await Visite.findById(req.params.id);

  if (!visite) {
    res.status(404);
    throw new Error('Visite non trouvée.');
  }

  const { dateProposee, dateConfirmee, statut, status, notes, scheduledStartAt,
    scheduledEndAt, meetingAddressSnapshot, coordinatesSnapshot, assignedAgent,
    visitFeeAmount, visitFeeCurrency, agencyCommissionType, agencyCommissionValue,
    commissionNotes } = req.body;
  const previousStatus = normalizeStatus(visite.status, visite.statut);
  const nextStatus = status || LEGACY_TO_STATUS[statut] || previousStatus;

  if (nextStatus !== previousStatus && !canTransition(previousStatus, nextStatus)) {
    res.status(409);
    throw new Error(`Transition interdite : ${LABELS[previousStatus]} → ${LABELS[nextStatus] || nextStatus}.`);
  }

  if (dateProposee !== undefined) visite.dateProposee = dateProposee;
  if (dateConfirmee !== undefined) visite.dateConfirmee = dateConfirmee;
  if (scheduledStartAt !== undefined || dateConfirmee !== undefined) visite.scheduledStartAt = scheduledStartAt || dateConfirmee;
  if (scheduledEndAt !== undefined) visite.scheduledEndAt = scheduledEndAt;
  if (scheduledStartAt !== undefined || scheduledEndAt !== undefined || nextStatus === STATUS.RESCHEDULED) {
    resetReminderStates(visite);
    if (nextStatus === STATUS.RESCHEDULED) visite.rescheduledAt = new Date();
  }
  if (notes !== undefined) visite.notes = notes;
  if (notes !== undefined) visite.staffNotes = notes;
  if (meetingAddressSnapshot !== undefined) visite.meetingAddressSnapshot = meetingAddressSnapshot;
  if (coordinatesSnapshot !== undefined) visite.coordinatesSnapshot = coordinatesSnapshot;
  if (assignedAgent !== undefined) visite.assignedAgent = assignedAgent || null;
  if (visitFeeAmount !== undefined) visite.visitFeeAmount = visitFeeAmount === '' ? null : visitFeeAmount;
  if (visitFeeCurrency !== undefined) visite.visitFeeCurrency = visitFeeCurrency;
  if (agencyCommissionType !== undefined) visite.agencyCommissionType = agencyCommissionType;
  if (agencyCommissionValue !== undefined) visite.agencyCommissionValue = agencyCommissionValue === '' ? null : agencyCommissionValue;
  if (commissionNotes !== undefined) visite.commissionNotes = commissionNotes;

  // Une confirmation ou reprogrammation exige un créneau complet et sans conflit.
  if (nextStatus === STATUS.CONFIRMED && (previousStatus !== STATUS.CONFIRMED || scheduledStartAt !== undefined || scheduledEndAt !== undefined)) {
    const start = new Date(visite.scheduledStartAt || visite.dateConfirmee);
    const end = new Date(visite.scheduledEndAt);
    if (!start.getTime() || !end.getTime() || end <= start || !visite.meetingAddressSnapshot) {
      res.status(400);
      throw new Error('Date, heure de fin et point de rendez-vous sont requis pour confirmer.');
    }
    const conflict = await Visite.exists({
      _id: { $ne: visite._id },
      $and: [
        { $or: [
          { status: { $in: [STATUS.CONFIRMED, STATUS.IN_PROGRESS] } },
          { status: null, statut: { $in: ['Confirmée', 'En cours'] } },
        ] },
        { $or: [
          { property: visite.property, scheduledStartAt: { $lt: end }, scheduledEndAt: { $gt: start } },
          ...(visite.assignedAgent ? [{ assignedAgent: visite.assignedAgent, scheduledStartAt: { $lt: end }, scheduledEndAt: { $gt: start } }] : []),
        ] },
      ],
    });
    if (conflict) {
      res.status(409);
      throw new Error('Ce créneau est en conflit avec un autre rendez-vous confirmé.');
    }
    visite.confirmedAt = new Date();
    visite.confirmedBy = req.user.id;
    visite.ownerViewedAt = null;
    if (visite.visitFeeAmount > 0) visite.paiementStatus = 'en_attente';
  }

  if (nextStatus !== previousStatus) appendHistory(visite, { to: nextStatus, action: 'staff_update', actor: req.user.id, role: 'staff', comment: notes || '', source: sourceOf(req) });

  visite.traitePar = req.user.id;

  await visite.save();

  await visite.populate('property', 'title images address owner');
  await visite.populate('client', 'name email');
  await visite.populate('traitePar', 'name');

  // Notifie le client si le statut a changé
  if (nextStatus !== previousStatus && visite.client) {
    const STATUT_MESSAGES = {
      'Confirmée':   { title: 'Visite confirmée ✅',   body: `Votre visite de "${visite.property?.title}" a été confirmée${dateConfirmee ? ` le ${new Date(dateConfirmee).toLocaleDateString('fr-FR')}` : ''}.` },
      'En cours':    { title: 'Visite en cours 🏃',    body: `Votre visite de "${visite.property?.title}" est maintenant en cours.` },
      'Refusée':     { title: 'Visite refusée',         body: `Votre demande de visite pour "${visite.property?.title}" n'a pas pu être acceptée.` },
      'Replanifiée': { title: 'Visite replanifiée 📅',  body: `Votre visite de "${visite.property?.title}" a été replanifiée${dateProposee ? ` au ${new Date(dateProposee).toLocaleDateString('fr-FR')}` : ''}.` },
      'Terminée':    { title: 'Visite effectuée',       body: `Merci pour votre visite de "${visite.property?.title}". N'hésitez pas à nous contacter.` },
      'Annulée':     { title: 'Visite annulée ❌',      body: `Votre visite de "${visite.property?.title}" a été annulée car elle n'a pas été prise en charge à l'heure prévue. Contactez-nous pour reprogrammer.` },
    };
    const msg = STATUT_MESSAGES[visite.statut];
    if (msg) {
      notify({ recipient: visite.client._id || visite.client,
        type:  'visite_status',
        title: msg.title,
        body:  msg.body,
        entityType: 'Visite', entityId: visite._id,
        data:  { screen: 'Visites', params: { id: visite._id }, visiteId: visite._id.toString(), route: 'Visites' },
      }).catch(() => {});
    }
    if (visite.property?.owner) {
      notify({
        recipient: visite.property.owner,
        type: nextStatus === STATUS.CONFIRMED ? 'visite_confirmee' : 'visite_status',
        title: 'Rendez-vous de visite mis à jour',
        body: `${visite.property?.title || 'Un bien'} : ${LABELS[nextStatus]}.`,
        link: '/mes-biens/visites', entityType: 'Visite', entityId: visite._id,
        data: { screen: 'Visites', visiteId: visite._id.toString(), route: 'Visites' },
      }).catch(() => {});
    }
    if (visite.assignedAgent && nextStatus === STATUS.CONFIRMED) {
      const agentId = visite.assignedAgent._id || visite.assignedAgent;
      if (String(agentId) !== String(visite.client?._id || visite.client) && String(agentId) !== String(visite.property?.owner || '')) {
        notify({
          recipient: agentId, type: 'visite_confirmee', title: 'Rendez-vous de visite assigné',
          body: `Un rendez-vous confirmé vous a été assigné pour ${visite.property?.title || 'un bien'}.`,
          entityType: 'Visite', entityId: visite._id,
          data: { screen: 'Visites', visiteId: visite._id.toString(), route: 'Visites' },
        }).catch(() => {});
      }
    }
  }

  res.status(200).json({
    status: 'success',
    data: { visite: serializeVisite(visite, 'staff') },
  });
});

// ─────────────────────────────────────────────
// PATCH /api/visites/:id/cancel — client annule
// ─────────────────────────────────────────────
exports.cancelVisite = asyncHandler(async (req, res) => {
  assertObjectId(req.params.id, res);
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

  const currentStatus = normalizeStatus(visite.status, visite.statut);
  if (!canTransition(currentStatus, STATUS.CANCELLED_CLIENT)) {
    res.status(400);
    throw new Error('Cette visite est déjà annulée.');
  }

  visite.cancelledAt = new Date();
  visite.cancellationActor = 'client';
  visite.cancellationReason = String(req.body?.reason || '').slice(0, 1000);
  appendHistory(visite, { to: STATUS.CANCELLED_CLIENT, action: 'cancel', actor: req.user.id, role: 'client', comment: visite.cancellationReason, source: sourceOf(req) });
  await visite.save();

  // Notifie le staff de l'annulation
  notifyStaff({
    type:  'visite_cancelled',
    title: 'Visite annulée',
    body:  `${req.user.name} a annulé sa demande de visite pour "${visite.property?.title || 'un bien'}".`,
    entityType: 'Visite', entityId: visite._id,
    data:  { screen: 'AdminVisites', params: { id: visite._id }, visiteId: visite._id.toString(), route: 'Visites' },
  }).catch(() => {});

  res.status(200).json({
    status: 'success',
    data: { visite: serializeVisite(visite, 'client') },
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

  await Visite.updateMany({
    property: { $in: propertyIds }, ownerViewedAt: null,
    $or: [
      { status: { $in: [STATUS.CONFIRMED, STATUS.RESCHEDULED] } },
      { status: null, statut: { $in: ['Confirmée', 'Replanifiée'] } },
    ],
  }, { $set: { ownerViewedAt: new Date() } });
  const visites = await Visite.find({ property: { $in: propertyIds } })
    .populate('property', 'title images address')
    .populate('client', 'name')
    .sort('-createdAt');

  res.status(200).json({
    status: 'success',
    results: visites.length,
    data: { visites: visites.map((visite) => serializeVisite(visite, 'owner')) },
  });
});

exports.getOwnerUnreadCount = asyncHandler(async (req, res) => {
  const properties = await Property.find({ owner: req.user.id }).distinct('_id');
  const unreadCount = await Visite.countDocuments({
    property: { $in: properties }, ownerViewedAt: null,
    $or: [
      { status: { $in: [STATUS.CONFIRMED, STATUS.RESCHEDULED] } },
      { status: null, statut: { $in: ['Confirmée', 'Replanifiée'] } },
    ],
  });
  res.status(200).json({ status: 'success', data: { unreadCount } });
});

exports.ownerAction = asyncHandler(async (req, res) => {
  assertObjectId(req.params.id, res);
  const properties = await Property.find({ owner: req.user.id }).distinct('_id');
  const visite = await Visite.findOne({ _id: req.params.id, property: { $in: properties } });
  if (!visite) {
    res.status(404);
    throw new Error('Rendez-vous introuvable.');
  }
  const current = normalizeStatus(visite.status, visite.statut);
  if (req.params.action === 'report-incident') {
    const comment = String(req.body?.comment || req.body?.reason || '').trim().slice(0, 1000);
    if (!comment) {
      res.status(400);
      throw new Error('Décrivez brièvement l’incident.');
    }
    visite.workflowHistory.push({ from: current, to: current, action: 'report_incident', actor: req.user.id, role: 'owner', comment, source: sourceOf(req), at: new Date() });
    visite.ownerNotes = visite.ownerNotes ? `${visite.ownerNotes}\n${comment}` : comment;
    await visite.save();
    notifyStaff({ type: 'visite_incident', title: 'Incident pendant un rendez-vous de visite', body: 'Un propriétaire a signalé un incident. Consultez le dossier.', data: { screen: 'AdminVisites', params: { id: visite._id } } }).catch(() => {});
    return res.status(200).json({ status: 'success', data: { visite: serializeVisite(visite, 'owner') } });
  }
  const targets = { start: STATUS.IN_PROGRESS, complete: STATUS.COMPLETED, 'client-absent': STATUS.CLIENT_ABSENT, 'request-cancellation': STATUS.OWNER_CANCELLATION_REQUESTED };
  const target = targets[req.params.action];
  if (!target || !canTransition(current, target)) {
    res.status(409);
    throw new Error('Action propriétaire non autorisée dans cet état.');
  }
  if (target === STATUS.IN_PROGRESS) visite.startedAt = new Date();
  if (target === STATUS.COMPLETED) visite.completedAt = new Date();
  if (target === STATUS.OWNER_CANCELLATION_REQUESTED) {
    visite.cancellationRequestedAt = new Date();
    visite.cancellationRequestedBy = req.user.id;
    visite.cancellationRequestReason = String(req.body?.reason || '').slice(0, 1000);
  }
  appendHistory(visite, { to: target, action: req.params.action, actor: req.user.id, role: 'owner', comment: req.body?.reason || req.body?.comment || '', source: sourceOf(req) });
  await visite.save();
  notifyStaff({ type: target === STATUS.OWNER_CANCELLATION_REQUESTED ? 'visite_annulation_demandee' : 'visite_status', title: 'Rendez-vous de visite mis à jour', body: `Le propriétaire a signalé : ${LABELS[target]}.`, data: { screen: 'AdminVisites', params: { id: visite._id } } }).catch(() => {});
  res.status(200).json({ status: 'success', data: { visite: serializeVisite(visite, 'owner') } });
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
    notify({ recipient: visite.client._id || visite.client,
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

    notify({ recipient: visite.client,
      type:  'paiement_confirme',
      title: '✅ Paiement confirmé',
      body:  'Vos honoraires ont bien été reçus. Votre visite est validée.',
      data:  { screen: 'Visites' },
    }).catch(() => {});

    notifyStaff({
      type:  'visite_payee',
      title: '💳 Paiement reçu',
      body:  `Honoraires reçus pour la visite de ${visite.property?.title || 'un bien'}.`,
      data:  { visiteId: visite._id.toString(), screen: 'Paiements' },
    }).catch(() => {});
  } else if (statut === 'échoué') {
    notify({ recipient: visite.client,
      type:  'paiement_echoue',
      title: '❌ Paiement échoué',
      body:  "Votre paiement n'a pas abouti. Veuillez réessayer.",
      data:  { screen: 'Visites' },
    }).catch(() => {});
  }

  res.status(200).json({
    status: 'success',
    data: { statut },
  });
});
