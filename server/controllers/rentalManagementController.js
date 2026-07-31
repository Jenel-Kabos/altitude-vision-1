const mongoose = require('mongoose');
const RentalManagement = require('../models/RentalManagement');
const Property = require('../models/Property');
const Contrat = require('../models/Contrat');
const Paiement = require('../models/Paiement');
const sync = require('../services/rentalListingSyncService');
const { notifyStaff } = require('../services/notificationService');
const { contractAlertWindowDays } = require('../services/rentalFinancialAutomationService');

const fail = (res, error) => res.status(error.statusCode || 500).json({
  status: (error.statusCode || 500) >= 500 ? 'error' : 'fail',
  message: error.message,
  ...(error.readiness && { publicationReadiness: error.readiness }),
  ...(error.vacancyReadiness && { vacancyReadiness: error.vacancyReadiness }),
});

exports.list = async (req, res) => {
  try {
    // Par défaut, ne liste que les dossiers réellement activés (Sprint A) —
    // une simple annonce Location créée via POST /api/rental-properties ne
    // doit pas apparaître dans le module Gestion Locative tant qu'elle n'a
    // pas été explicitement activée. `?managementActivated=false` permet de
    // consulter les annonces en attente d'activation si un écran futur en a besoin.
    const filter = { managementActivated: true };
    ['occupancyStatus', 'availabilityStatus', 'publicationStatus', 'owner', 'active', 'managementActivated'].forEach((key) => {
      if (req.query[key] !== undefined) {
        filter[key] = key === 'managementActivated' || key === 'active' ? req.query[key] === 'true' : req.query[key];
      }
    });
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 25));
    const [rows, total] = await Promise.all([
      RentalManagement.find(filter)
        .populate('property', 'title images address type surface price availability statusAdmin isPublished owner')
        .populate('owner', 'name photo')
        .populate('currentTenant', 'nom prenom')
        .populate('activeLease', 'statut dateFinBail montantLoyer')
        .sort({ updatedAt: -1 }).skip((page - 1) * limit).limit(limit),
      RentalManagement.countDocuments(filter),
    ]);
    const leaseIds = rows.map((row) => row.activeLease?._id || row.activeLease).filter(Boolean);
    const paymentRows = leaseIds.length ? await Paiement.aggregate([
      { $match: { contrat: { $in: leaseIds } } },
      { $group: { _id: '$contrat', expected: { $sum: { $ifNull: ['$montantTotal', '$montant'] } }, paid: { $sum: { $cond: [{ $eq: ['$statut', 'payé'] }, { $ifNull: ['$montantRecu', '$montant'] }, { $ifNull: ['$montantRecu', 0] }] } }, overdueCount: { $sum: { $cond: [{ $in: ['$statut', ['impayé', 'en_retard']] }, 1, 0] } }, partialCount: { $sum: { $cond: [{ $eq: ['$statut', 'partiel'] }, 1, 0] } }, nextDueAt: { $min: { $cond: [{ $ne: ['$statut', 'payé'] }, { $dateFromParts: { year: '$annee', month: '$mois', day: { $ifNull: ['$jourEcheance', 1] } } }, null] } } } },
    ]) : [];
    const paymentMap = new Map(paymentRows.map((item) => [String(item._id), { ...item, remaining: Math.max(0, (item.expected || 0) - (item.paid || 0)) }]));
    const rentals = rows.map((row) => ({ ...sync.serializeRentalManagement(row), paymentSummary: paymentMap.get(String(row.activeLease?._id || row.activeLease)) || { expected: 0, paid: 0, remaining: 0, overdueCount: 0, partialCount: 0, nextDueAt: null } }));
    res.json({ status: 'success', data: { rentals, total, page, totalPages: Math.ceil(total / limit) } });
  } catch (error) { fail(res, error); }
};

exports.stats = async (_req, res) => {
  try {
    const windowDays = contractAlertWindowDays();
    const soon = new Date(Date.now() + windowDays * 24 * 60 * 60 * 1000);
    const [grouped, overduePayments, partialPayments, expiringContracts, expiredContracts, biensInscrits] = await Promise.all([
      // Sprint A : n'agrège que les dossiers réellement activés — une
      // simple annonce Location ne doit jamais gonfler les statistiques de
      // gestion locative (voir server/docs/PROPERTY_TRANSACTION_ARCHITECTURE.md).
      RentalManagement.aggregate([{ $match: { managementActivated: true } }, { $group: { _id: null, total: { $sum: 1 }, vacant: { $sum: { $cond: [{ $eq: ['$occupancyStatus', 'vacant'] }, 1, 0] } }, available: { $sum: { $cond: [{ $eq: ['$availabilityStatus', 'disponible'] }, 1, 0] } }, occupied: { $sum: { $cond: [{ $eq: ['$occupancyStatus', 'occupe'] }, 1, 0] } }, notice: { $sum: { $cond: [{ $eq: ['$occupancyStatus', 'preavis'] }, 1, 0] } }, scheduledExits: { $sum: { $cond: [{ $eq: ['$occupancyStatus', 'sortie_programmee'] }, 1, 0] } }, inModeration: { $sum: { $cond: [{ $eq: ['$publicationStatus', 'en_attente_moderation'] }, 1, 0] } }, published: { $sum: { $cond: [{ $eq: ['$publicationStatus', 'publie'] }, 1, 0] } }, maintenance: { $sum: { $cond: [{ $eq: ['$availabilityStatus', 'maintenance'] }, 1, 0] } }, blockingInspections: { $sum: { $cond: [{ $and: [{ $eq: ['$occupancyStatus', 'sortie_programmee'] }, { $eq: [{ $ifNull: ['$exitInspectionClearedAt', null] }, null] }] }, 1, 0] } }, readyToRepublish: { $sum: { $cond: [{ $and: [{ $eq: ['$occupancyStatus', 'vacant'] }, { $eq: ['$publicationReadiness.ready', true] }, { $ne: ['$publicationStatus', 'publie'] }] }, 1, 0] } } } }]),
      Paiement.countDocuments({ statut: { $in: ['impayé', 'en_retard'] } }),
      Paiement.countDocuments({ statut: 'partiel' }),
      Contrat.countDocuments({ type: 'location', statut: 'actif', dateFinBail: { $gte: new Date(), $lte: soon } }),
      Contrat.countDocuments({ type: 'location', $or: [{ statut: 'expiré' }, { statut: 'actif', dateFinBail: { $lt: new Date() } }] }),
      // "Biens inscrits" (Sprint GL-UX1, affiné GL-DEBT-1) — distinct de
      // "biens sous gestion" (RentalManagement.managementActivated:true
      // ci-dessus) : biens de LOCATION réellement rattachés à un
      // propriétaire externe identifiable (role 'Proprietaire'), ni retirés
      // du marché, ni internes à l'agence (owner Admin/Collaborateur/...).
      // `owner` est `required:true` sur Property (aucun bien sans
      // propriétaire n'existe en base), donc seul le filtre de rôle est
      // nécessaire pour exclure les biens "possédés" par un compte staff.
      // N'inclut PAS Proprietaire.biensPropres[] : cette structure historique
      // (pré-Property) n'est reliée à aucun Contrat/RentalManagement du
      // module Gestion Locative — l'inclure gonflerait ce KPI avec des
      // entrées invisibles partout ailleurs dans le module. Voir
      // server/docs/PROPERTY_TRANSACTION_ARCHITECTURE.md.
      Property.aggregate([
        { $match: { status: 'location', availability: { $ne: 'Retiré' }, owner: { $exists: true, $ne: null } } },
        { $lookup: { from: 'users', localField: 'owner', foreignField: '_id', as: 'ownerDoc' } },
        { $unwind: '$ownerDoc' },
        { $match: { 'ownerDoc.role': 'Proprietaire' } },
        { $count: 'total' },
      ]).then((rows) => rows[0]?.total || 0),
    ]);
    res.json({ status: 'success', data: { stats: { ...(grouped[0] || { total: 0, vacant: 0, available: 0, occupied: 0, notice: 0, scheduledExits: 0, inModeration: 0, published: 0, maintenance: 0, blockingInspections: 0, readyToRepublish: 0 }), overduePayments, partialPayments, expiringContracts, expiredContracts, contractAlertWindowDays: windowDays, biensInscrits } } });
  } catch (error) { fail(res, error); }
};

exports.getOne = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ status: 'fail', message: 'Identifiant invalide.' });
    const rental = await RentalManagement.findById(req.params.id)
      .populate('property').populate('owner', 'name photo').populate('currentTenant', 'nom prenom')
      .populate('activeLease');
    if (!rental) return res.status(404).json({ status: 'fail', message: 'Dossier introuvable.' });
    res.json({ status: 'success', data: { rental: sync.serializeRentalManagement(rental) } });
  } catch (error) { fail(res, error); }
};

exports.ownerList = async (req, res) => {
  try {
    const rows = await RentalManagement.find({ owner: req.user.id })
      .populate('property', 'title images address type surface price availability statusAdmin isPublished')
      .populate('activeLease', 'statut dateFinBail montantLoyer')
      .sort({ updatedAt: -1 });
    const leaseIds = rows.map((row) => row.activeLease?._id || row.activeLease).filter(Boolean);
    const paymentRows = leaseIds.length ? await Paiement.aggregate([
      { $match: { contrat: { $in: leaseIds } } },
      { $group: { _id: '$contrat', expected: { $sum: { $ifNull: ['$montantTotal', '$montant'] } }, paid: { $sum: { $cond: [{ $eq: ['$statut', 'payé'] }, { $ifNull: ['$montantRecu', '$montant'] }, { $ifNull: ['$montantRecu', 0] }] } }, overdueCount: { $sum: { $cond: [{ $in: ['$statut', ['impayé', 'en_retard']] }, 1, 0] } }, partialCount: { $sum: { $cond: [{ $eq: ['$statut', 'partiel'] }, 1, 0] } }, nextDueAt: { $min: { $cond: [{ $ne: ['$statut', 'payé'] }, { $dateFromParts: { year: '$annee', month: '$mois', day: { $ifNull: ['$jourEcheance', 1] } } }, null] } } } },
    ]) : [];
    const paymentMap = new Map(paymentRows.map((item) => [String(item._id), { expected: item.expected || 0, paid: item.paid || 0, remaining: Math.max(0, (item.expected || 0) - (item.paid || 0)), overdueCount: item.overdueCount || 0, partialCount: item.partialCount || 0, nextDueAt: item.nextDueAt || null }]));
    const rentals = rows.map((row) => ({ ...sync.serializeRentalManagement(row, 'owner'), paymentSummary: paymentMap.get(String(row.activeLease?._id || row.activeLease)) || { expected: 0, paid: 0, remaining: 0, overdueCount: 0, partialCount: 0, nextDueAt: null } }));
    res.json({ status: 'success', data: { rentals } });
  } catch (error) { fail(res, error); }
};

exports.ownerRequest = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ status: 'fail', message: 'Identifiant invalide.' });
    const rental = await RentalManagement.findOne({ _id: req.params.id, owner: req.user.id });
    if (!rental) return res.status(404).json({ status: 'fail', message: 'Dossier introuvable.' });
    const typeMap = { 'request-publish': 'publish', 'request-suspension': 'suspend', 'report-maintenance': 'maintenance', 'declare-future-availability': 'future_availability' };
    const type = typeMap[req.params.action];
    if (!type) return res.status(404).json({ status: 'fail', message: 'Action inconnue.' });
    const pending = rental.actionRequests.find((request) => request.type === type && request.status === 'pending');
    if (pending) return res.json({ status: 'success', data: { request: pending, rental: sync.serializeRentalManagement(rental, 'owner') } });
    if (type === 'future_availability') {
      const planned = new Date(req.body.plannedAt);
      if (!req.body.plannedAt || Number.isNaN(planned.getTime()) || planned <= new Date()) return res.status(422).json({ status: 'fail', message: 'Date future valide obligatoire.' });
    }
    const request = rental.actionRequests.create({ type, requestedBy: req.user.id, reason: String(req.body.reason || '').slice(0, 1000), plannedAt: req.body.plannedAt || undefined });
    rental.actionRequests.push(request);
    rental.workflowHistory.push({ action: `owner_request_${type}`, actor: req.user.id, source: 'owner', comment: request.reason, from: rental.occupancyStatus, to: rental.occupancyStatus });
    await rental.save();
    await notifyStaff({ type: 'rental_owner_request', title: 'Demande propriétaire', body: `Une demande ${type} nécessite une décision.`, entityType: 'RentalManagement', entityId: rental._id, dedupeKey: `rental-request:${request._id}`, data: { rentalManagementId: rental._id, propertyId: rental.property, eventType: 'rental_owner_request', updatedAt: new Date() } });
    res.status(201).json({ status: 'success', data: { request, rental: sync.serializeRentalManagement(rental, 'owner') } });
  } catch (error) { fail(res, error); }
};

exports.resolveRequest = async (req, res) => {
  try {
    const rental = await RentalManagement.findById(req.params.id);
    if (!rental) return res.status(404).json({ status: 'fail', message: 'Dossier introuvable.' });
    const request = rental.actionRequests.id(req.params.requestId);
    if (!request) return res.status(404).json({ status: 'fail', message: 'Demande introuvable.' });
    if (request.status !== 'pending') return res.status(409).json({ status: 'fail', message: 'Demande déjà traitée.' });
    const approved = req.body.decision === 'approved';
    if (!approved && req.body.decision !== 'rejected') return res.status(422).json({ status: 'fail', message: 'Décision invalide.' });
    request.status = approved ? 'approved' : 'rejected'; request.reviewedBy = req.user.id; request.reviewedAt = new Date(); request.reviewComment = String(req.body.comment || '').slice(0, 1000);
    rental.workflowHistory.push({ action: `owner_request_${request.status}`, actor: req.user.id, source: 'staff', comment: request.reviewComment, from: rental.occupancyStatus, to: rental.occupancyStatus });
    await rental.save();
    if (approved) {
      if (request.type === 'publish') { rental.publicationAuthorized = true; await rental.save(); await sync.publishRentalProperty(rental._id, req.user.id, request.reviewComment); }
      if (request.type === 'suspend') await sync.suspendRentalListing(rental._id, req.user.id, request.reviewComment);
      if (request.type === 'maintenance') await sync.markMaintenance(rental._id, { actor: req.user.id, comment: request.reason });
      if (request.type === 'future_availability') await sync.startNotice(rental._id, { actor: req.user.id, plannedExitAt: request.plannedAt, comment: request.reason });
    }
    const updated = await RentalManagement.findById(rental._id);
    res.json({ status: 'success', data: { rental: sync.serializeRentalManagement(updated), request } });
  } catch (error) { fail(res, error); }
};

exports.validateExitInspection = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ status: 'fail', message: 'Identifiant invalide.' });
    const rental = await RentalManagement.findById(req.params.id);
    if (!rental) return res.status(404).json({ status: 'fail', message: 'Dossier introuvable.' });
    const contract = await Contrat.findOne({ bien: rental.property, type: 'location', 'etatsDesLieux.type': 'sortie' }).sort({ updatedAt: -1 });
    if (!contract) return res.status(422).json({ status: 'fail', message: 'État des lieux de sortie absent.' });
    const inspection = [...contract.etatsDesLieux].reverse().find((item) => item.type === 'sortie');
    if (!inspection) return res.status(422).json({ status: 'fail', message: 'État des lieux de sortie absent.' });
    inspection.validatedByStaff = true; inspection.validatedAt = new Date(); inspection.validatedBy = req.user.id;
    inspection.degradationReported = Boolean(req.body.degradationReported);
    inspection.maintenanceRequired = Boolean(req.body.maintenanceRequired);
    inspection.blockingReason = String(req.body.blockingReason || '').slice(0, 1000);
    await contract.save();
    rental.exitInspectionClearedAt = new Date();
    rental.workflowHistory.push({ action: 'exit_inspection_validated', actor: req.user.id, source: 'staff', comment: inspection.blockingReason, from: rental.occupancyStatus, to: rental.occupancyStatus });
    await rental.save();
    const result = inspection.maintenanceRequired
      ? await sync.markMaintenance(rental._id, { actor: req.user.id, comment: inspection.blockingReason || 'Travaux requis après état des lieux' })
      : await sync.markPropertyVacant(rental._id, { actor: req.user.id, comment: req.body.comment });
    res.json({ status: 'success', data: { rental: sync.serializeRentalManagement(result.management), vacancyReadiness: sync.evaluateVacancyReadiness(result.management) } });
  } catch (error) { fail(res, error); }
};

exports.create = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.body.property)) return res.status(422).json({ status: 'fail', message: 'Un Property valide est obligatoire.' });
    const property = await Property.findById(req.body.property);
    if (!property) return res.status(404).json({ status: 'fail', message: 'Bien introuvable.' });
    if (property.status !== 'location') return res.status(422).json({ status: 'fail', message: 'Seul un bien en location peut être activé en gestion locative.' });
    const allowed = ['monthlyRent', 'charges', 'depositAmount', 'managementFee', 'mandateStartAt', 'mandateEndAt', 'publicationPolicy', 'publicationAuthorized'];
    const details = Object.fromEntries(allowed.filter((key) => req.body[key] !== undefined).map((key) => [key, req.body[key]]));
    const rental = await RentalManagement.findOneAndUpdate(
      { property: property._id },
      {
        $setOnInsert: { property: property._id, owner: property.owner, manager: req.user.id },
        // Activation explicite (Sprint A) : marque le dossier comme
        // réellement géré, même s'il avait été créé "en attente" par le
        // nouveau flux de simple annonce (POST /api/rental-properties).
        $set: { ...details, managementActivated: true },
      },
      { new: true, upsert: true, runValidators: true },
    );
    sync.refreshReadiness(rental, property);
    rental.workflowHistory.push({ action: 'rental_management_enabled', actor: req.user.id, source: 'api', to: rental.occupancyStatus });
    await rental.save();
    res.status(201).json({ status: 'success', data: { rental: sync.serializeRentalManagement(rental) } });
  } catch (error) {
    if (error.code === 11000) error.statusCode = 409;
    fail(res, error);
  }
};

exports.update = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ status: 'fail', message: 'Identifiant invalide.' });
    const rental = await RentalManagement.findById(req.params.id);
    if (!rental) return res.status(404).json({ status: 'fail', message: 'Dossier introuvable.' });
    const allowed = ['monthlyRent', 'charges', 'depositAmount', 'managementFee', 'mandateStartAt', 'mandateEndAt', 'publicationPolicy', 'publicationAuthorized', 'active'];
    allowed.forEach((key) => { if (req.body[key] !== undefined) rental[key] = req.body[key]; });
    const property = await Property.findById(rental.property);
    if (property) sync.refreshReadiness(rental, property);
    rental.workflowHistory.push({ action: 'rental_management_updated', actor: req.user.id, source: 'api', comment: String(req.body.comment || '').slice(0, 1000) });
    await rental.save();
    res.json({ status: 'success', data: { rental: sync.serializeRentalManagement(rental) } });
  } catch (error) { fail(res, error); }
};

const runAction = (handler) => async (req, res) => {
  try {
    const result = await handler(req.params.id, {
      actor: req.user.id,
      comment: req.body?.comment,
      controlValidated: req.body?.controlValidated,
      plannedExitAt: req.body?.plannedExitAt,
    });
    res.json({ status: 'success', data: { rental: sync.serializeRentalManagement(result.management), publicationReadiness: result.readiness } });
  } catch (error) { fail(res, error); }
};

exports.publish = async (req, res) => {
  try {
    const result = await sync.publishRentalProperty(req.params.id, req.user.id, req.body?.comment);
    res.json({ status: 'success', data: { rental: sync.serializeRentalManagement(result.management), publicationReadiness: result.readiness } });
  } catch (error) { fail(res, error); }
};
exports.suspend = async (req, res) => {
  try {
    const result = await sync.suspendRentalListing(req.params.id, req.user.id, req.body?.comment);
    res.json({ status: 'success', data: { rental: sync.serializeRentalManagement(result.management) } });
  } catch (error) { fail(res, error); }
};
exports.markRented = runAction((id, options) => sync.markPropertyRented(id, options));
exports.markVacant = runAction((id, options) => sync.markPropertyVacant(id, options));
exports.markMaintenance = runAction((id, options) => sync.markMaintenance(id, options));
exports.completeMaintenance = runAction((id, options) => sync.completeMaintenance(id, { ...options, controlValidated: options.controlValidated }));
exports.startNotice = runAction((id, options) => sync.startNotice(id, options));
// Sprint GL-B2 — accusé de réception / annulation d'un préavis en cours.
exports.acknowledgeNotice = runAction((id, options) => sync.acknowledgeNotice(id, options));
exports.cancelNotice = runAction((id, options) => sync.cancelNotice(id, options));

exports.history = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ status: 'fail', message: 'Identifiant invalide.' });
    const rental = await RentalManagement.findById(req.params.id).select('workflowHistory');
    if (!rental) return res.status(404).json({ status: 'fail', message: 'Dossier introuvable.' });
    res.json({ status: 'success', data: { history: [...rental.workflowHistory].reverse() } });
  } catch (error) { fail(res, error); }
};
