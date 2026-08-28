const asyncHandler = require('express-async-handler');
const Visite   = require('../models/Visite');
const User     = require('../models/User');
const Property = require('../models/Property');
const { assertResourceTenantOrUnattributed } = require('../services/platformTenant/tenantResourceAttributionService');
const { notify, notifyStaff } = require('../services/notificationService');
const yabetooService = require('../services/yabetooService');
const mongoose = require('mongoose');
const {
  STATUS, LABELS, LEGACY_TO_STATUS, normalizeStatus, canTransition,
  appendHistory, resetReminderStates, serializeVisite,
} = require('../services/visiteWorkflowService');
const {
  VISIT_DURATION_MINUTES, AGENCY_OPENING_HOURS, computeVisitEnd, computeConflictWindow,
  isWithinOpeningHours, localParts, parseHHmmToMinutes, formatMinutesToHHmm,
} = require('../config/visiteScheduling');

// Statuts qui occupent réellement un créneau (mêmes valeurs que le contrôle
// de doublon historique) — les visites annulées/refusées/terminées/expirées
// ne bloquent jamais un créneau.
const SLOT_BLOCKING_STATUS = [STATUS.REQUESTED, STATUS.AWAITING_CONFIRMATION, STATUS.CONFIRMED, STATUS.RESCHEDULED];
const SLOT_BLOCKING_STATUT_LEGACY = ['En attente', 'Confirmée', 'Replanifiée'];

const sourceOf = (req) => req.get('x-altimmo-client') === 'mobile' ? 'mobile' : 'web';
const assertObjectId = (id, res) => {
  if (!mongoose.isValidObjectId(id)) {
    res.status(400);
    throw new Error('Identifiant de rendez-vous invalide.');
  }
};

// SECURITY-CLOSURE-P1-WAVE-1 (P1-B, finding RA-06) — `Visite.tenant` existe
// dans le schéma mais n'est JAMAIS peuplé nulle part dans ce contrôleur
// (vérifié par recherche exhaustive) : l'utiliser tel quel filtrerait TOUTES
// les visites au lieu de les scoper correctement. La frontière canonique
// réelle est dérivée via `Visite.property` (Property) -> `owner` ->
// OrgMembership, même relation que Locataire/Proprietaire/Contrat —
// `tenantResourceAttributionService` supporte déjà nativement
// `resourceType: 'Visite'`.
async function scopedPropertyIdsForTenant(req) {
  if (!req.platformTenant) return null;
  return Property.find({ owner: { $in: req.tenantScopeUserIds || [] } }).distinct('_id');
}

// `res` positionné AVANT le throw (même convention qu'`assertObjectId`
// ci-dessus) : errorMiddleware.js dérive son statusCode de `res.statusCode`,
// jamais de `err.statusCode`.
async function assertVisitePropertyInScope(req, res, visite) {
  if (!req.platformTenant) return;
  try {
    await assertResourceTenantOrUnattributed({ resourceType: 'Visite', resource: visite, tenantId: req.platformTenant._id });
  } catch (error) {
    res.status(error.statusCode || 404);
    throw new Error('Visite non trouvée.');
  }
}
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
// GET /api/visites/availability — créneaux disponibles pour un bien/jour
// ─────────────────────────────────────────────
exports.getAvailability = asyncHandler(async (req, res) => {
  const { propertyId, date } = req.query;
  if (!propertyId || !mongoose.isValidObjectId(propertyId)) {
    res.status(400);
    throw new Error('propertyId invalide.');
  }
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    res.status(400);
    throw new Error('date invalide (attendu AAAA-MM-JJ).');
  }
  const property = await Property.findById(propertyId).select('_id');
  if (!property) {
    res.status(404);
    throw new Error('Bien introuvable.');
  }

  const dayStart = new Date(`${date}T00:00:00+01:00`);
  const { dayKey } = localParts(dayStart);
  const hours = AGENCY_OPENING_HOURS[dayKey];

  if (!hours) {
    return res.status(200).json({
      status: 'success',
      data: {
        date, durationMinutes: VISIT_DURATION_MINUTES,
        openingTime: null, closingTime: null,
        availableSlots: [], unavailableSlots: [],
      },
    });
  }

  const openMinutes  = parseHHmmToMinutes(hours.open);
  const closeMinutes = parseHHmmToMinutes(hours.close);
  const candidateStartMinutes = [];
  for (let m = openMinutes; m + VISIT_DURATION_MINUTES <= closeMinutes; m += VISIT_DURATION_MINUTES) {
    candidateStartMinutes.push(m);
  }

  // Visites actives ce jour-là (± une durée de visite pour couvrir les
  // chevauchements à cheval sur les bornes du jour).
  const dayEnd = new Date(dayStart.getTime() + 24 * 3600000);
  const visites = await Visite.find({
    property: propertyId,
    $or: [
      { status: { $in: SLOT_BLOCKING_STATUS } },
      { status: null, statut: { $in: SLOT_BLOCKING_STATUT_LEGACY } },
    ],
    requestedDate: {
      $gte: new Date(dayStart.getTime() - VISIT_DURATION_MINUTES * 60000),
      $lt: dayEnd,
    },
  }).select('requestedDate');

  const availableSlots = [];
  const unavailableSlots = [];
  for (const startMinutes of candidateStartMinutes) {
    const slotStart = new Date(dayStart.getTime() + startMinutes * 60000);
    const { afterExclusive, beforeExclusive } = computeConflictWindow(slotStart);
    const conflict = visites.some((v) => {
      const vStart = new Date(v.requestedDate);
      return vStart > afterExclusive && vStart < beforeExclusive;
    });
    const label = formatMinutesToHHmm(startMinutes);
    (conflict ? unavailableSlots : availableSlots).push(label);
  }

  res.status(200).json({
    status: 'success',
    data: {
      date, durationMinutes: VISIT_DURATION_MINUTES,
      openingTime: hours.open, closingTime: hours.close,
      availableSlots, unavailableSlots,
    },
  });
});

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
  if (property.owner && property.owner._id.toString() === req.user.id.toString()) {
    res.status(403);
    throw new Error('Vous ne pouvez pas planifier une visite sur votre propre bien.');
  }
  // isPublished appartient au workflow séparé "gestion locative"
  // (rentalListingSyncService.js) et ne reflète pas la disponibilité
  // publique générale — voir propertyMapper.js (mobile) pour la même
  // correction côté client. Un bien validé et disponible ne doit jamais
  // être bloqué pour cette seule raison.
  if (property.availability !== 'Disponible' || property.statusAdmin !== 'Validée') {
    res.status(409);
    throw new Error('Ce bien n’est pas disponible pour une nouvelle visite.');
  }
  const requestedStart = buildRequestedStart(req.body);
  if (!requestedStart || requestedStart <= new Date()) {
    res.status(400);
    throw new Error('Choisissez une date et une heure futures valides.');
  }
  const requestedEnd = computeVisitEnd(requestedStart);
  if (!isWithinOpeningHours(requestedStart, requestedEnd)) {
    res.status(400);
    throw new Error('Choisissez un créneau pendant les horaires d’ouverture de l’agence (Lun-Ven 8h-18h, Sam 9h-14h).');
  }
  if (!clientContactConsent) {
    res.status(400);
    throw new Error('Le consentement de contact est requis pour organiser la visite.');
  }
  // Une seule visite active par client et par bien : si ce client a déjà une
  // visite en cours sur CE bien (demandée, en attente, confirmée ou
  // reprogrammée), on ne crée pas de doublon — on l'invite à reprogrammer
  // celle qui existe déjà plutôt que d'autoriser une nouvelle réservation.
  // Les visites annulées/refusées/terminées ne comptent pas (SLOT_BLOCKING_STATUS).
  const existingActiveVisit = await Visite.findOne({
    property: propertyId, client: req.user.id,
    $or: [
      { status: { $in: SLOT_BLOCKING_STATUS } },
      { status: null, statut: { $in: SLOT_BLOCKING_STATUT_LEGACY } },
    ],
  }).select('_id status statut requestedDate');
  if (existingActiveVisit) {
    return res.status(409).json({
      status: 'fail',
      message: 'Vous avez déjà une visite active pour ce bien. Souhaitez-vous la reprogrammer ?',
      data: { existingVisiteId: existingActiveVisit._id, action: 'reschedule' },
    });
  }
  // Conflit de créneau : un bien peut être visité par plusieurs clients le
  // même jour, à condition que leurs créneaux de VISIT_DURATION_MINUTES ne
  // se chevauchent pas (toutes visites confondues, tous clients confondus).
  // existingStart < newEnd ET existingStart > newStart - durée
  // (équivalent à existingEnd > newStart, sans stocker de champ de fin).
  const { afterExclusive: conflictWindowStart } = computeConflictWindow(requestedStart);
  const slotConflict = await Visite.exists({
    property: propertyId,
    $or: [
      { status: { $in: SLOT_BLOCKING_STATUS } },
      { status: null, statut: { $in: SLOT_BLOCKING_STATUT_LEGACY } },
    ],
    requestedDate: { $gt: conflictWindowStart, $lt: requestedEnd },
  });
  if (slotConflict) {
    res.status(409);
    throw new Error('Ce créneau est déjà réservé pour ce bien. Choisissez un autre horaire.');
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

  // Protection anti-concurrence : le contrôle de chevauchement ci-dessus et
  // la création ne sont pas atomiques (pas de transaction Mongo dans ce
  // projet à ce jour). On revérifie juste après création : si un autre
  // client a créé une visite en conflit avec un createdAt antérieur pendant
  // la fenêtre de course, on annule (compense) la création perdante plutôt
  // que de laisser deux visites incompatibles coexister.
  const raceConflict = await Visite.exists({
    _id: { $ne: visite._id },
    property: propertyId,
    $or: [
      { status: { $in: SLOT_BLOCKING_STATUS } },
      { status: null, statut: { $in: SLOT_BLOCKING_STATUT_LEGACY } },
    ],
    requestedDate: { $gt: conflictWindowStart, $lt: requestedEnd },
    createdAt: { $lt: visite.createdAt },
  });
  if (raceConflict) {
    await Visite.deleteOne({ _id: visite._id });
    res.status(409);
    throw new Error('Ce créneau vient d’être réservé par un autre client. Choisissez un autre horaire.');
  }

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
  const scopedPropertyIds = await scopedPropertyIdsForTenant(req);
  const scopeFilter = scopedPropertyIds ? { property: { $in: scopedPropertyIds } } : {};
  await Visite.updateMany({ ...scopeFilter, staffViewedAt: null }, { $set: { staffViewedAt: new Date() } });
  const visites = await Visite.find(scopeFilter)
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

exports.getUnreadCount = asyncHandler(async (req, res) => {
  const scopedPropertyIds = await scopedPropertyIdsForTenant(req);
  const unreadCount = await Visite.countDocuments({
    staffViewedAt: null,
    ...(scopedPropertyIds ? { property: { $in: scopedPropertyIds } } : {}),
  });
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
  await assertVisitePropertyInScope(req, res, visite);

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

  const existing = await Visite.findById(req.params.id);
  if (!existing) {
    res.status(404);
    throw new Error('Visite non trouvée.');
  }
  await assertVisitePropertyInScope(req, res, existing);

  const visite = await Visite.findByIdAndUpdate(
    req.params.id,
    { paiementStatus, paiementRef },
    { new: true, runValidators: true },
  );

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
  const scopedPropertyIds = await scopedPropertyIdsForTenant(req);
  const visites = await Visite.find({
    paiementStatus: { $ne: 'non_requis' },
    ...(scopedPropertyIds ? { property: { $in: scopedPropertyIds } } : {}),
  })
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

  const businessKey = `yabetoo:visite:${visite._id}:payer:${req.user.id}:v1`;
  const claimed = await Visite.findOneAndUpdate(
    { _id: visite._id, client: req.user.id, yabetooBusinessKey: null, paiementStatus: { $ne: 'payé' } },
    { $set: { yabetooBusinessKey: businessKey, yabetooState: 'creating', yabetooReconciliationRequired: false } },
    { new: true },
  ).select('+yabetooBusinessKey');
  if (!claimed) {
    const current = await Visite.findById(visite._id).select('+yabetooBusinessKey');
    return res.status(202).json({ status: 'pending', code: current?.yabetooReconciliationRequired ? 'PAYMENT_RECONCILIATION_REQUIRED' : 'PAYMENT_ALREADY_INITIATED', data: { intentId: current?.paiementRef || null, montant } });
  }

  let intent;
  try {
    intent = await yabetooService.createIntent({ amount: montant, description: `Honoraires visite — ${prop?.title || 'bien'}`, metadata: { visiteId: visite._id.toString(), businessKey } });
  } catch (error) {
    await Visite.findByIdAndUpdate(visite._id, { yabetooState: error.code === 'provider_timeout_unknown' ? 'create_unknown' : 'failed', yabetooReconciliationRequired: error.code === 'provider_timeout_unknown' });
    throw error;
  }

  const created = yabetooService.extractIntent(intent);
  if (!created.id || !created.clientSecret) {
    await Visite.findByIdAndUpdate(visite._id, { yabetooState: 'create_unknown', yabetooReconciliationRequired: true });
    res.status(502);
    const error = new Error("Réponse Yabetoo incomplète ; reconciliation requise."); error.code = 'provider_invalid_response'; throw error;
  }
  const intentId = created.id;
  await Visite.findByIdAndUpdate(visite._id, { paiementRef: intentId, paiementStatus: 'en_attente', yabetooState: 'confirming', yabetooReconciliationRequired: true });

  // Déclenche la notification push MoMo sur le téléphone du client
  try {
    const confirmation = await yabetooService.confirmIntent(intentId, {
      clientSecret: created.clientSecret, phone, operator,
      firstName: req.user.name?.split(' ')[0] || '', lastName: req.user.name?.split(' ').slice(1).join(' ') || '', receiptEmail: req.user.email,
    });
    const confirmed = yabetooService.extractIntent(confirmation);
    await Visite.findByIdAndUpdate(visite._id, { yabetooState: 'pending', yabetooProviderStatus: confirmed.status || undefined, yabetooReconciliationRequired: true });
  } catch (error) {
    await Visite.findByIdAndUpdate(visite._id, { yabetooState: error.code === 'provider_timeout_unknown' ? 'confirm_unknown' : 'pending', yabetooReconciliationRequired: true });
    throw error;
  }

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
  else if (yStatus === 'failed' || yStatus === 'expired') statut = 'échoué';

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

  await Visite.findByIdAndUpdate(visite._id, {
    yabetooProviderStatus: yStatus || 'unknown',
    yabetooState: statut === 'payé' ? 'succeeded' : statut === 'échoué' ? 'failed' : 'pending',
    yabetooReconciliationRequired: statut === 'en_attente',
  });

  res.status(200).json({
    status: 'success',
    data: { statut },
  });
});
