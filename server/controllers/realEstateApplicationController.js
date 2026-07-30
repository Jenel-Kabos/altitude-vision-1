const Application = require('../models/RealEstateApplication');
const Reservation = require('../models/RealEstateReservation');
const Property = require('../models/Property');
const { STAFF_IMMO } = require('../utils/roles');
const { notify } = require('../services/notificationService');
const workflow = require('../services/realEstateApplicationService');
const mongoose = require('mongoose');
const storage = require('../services/storage/realEstateApplicationStorageService');

const isStaff = (user) => STAFF_IMMO.includes(user?.role);
const fail = (res, error) => res.status(error.statusCode || 500).json({ status: 'fail', code: error.code, message: error.message });
const canManage = (user, application) => isStaff(user) || String(application.owner) === String(user._id);

exports.create = async (req, res) => {
  try {
    const property = await Property.findById(req.body.propertyId).select('owner status statusAdmin availability isPublished title');
    if (!property) return res.status(404).json({ status: 'fail', code: 'PROPERTY_NOT_FOUND', message: 'Bien introuvable.' });
    const kind = property.status === 'vente' ? 'purchase_offer' : property.status === 'location' ? 'rental_application' : null;
    if (!kind || property.statusAdmin !== 'Validée' || !property.isPublished || property.availability !== 'Disponible') {
      return res.status(409).json({ status: 'fail', code: 'PROPERTY_NOT_AVAILABLE', message: 'Ce bien ne reçoit pas de dossier.' });
    }
    if (String(property.owner) === String(req.user._id)) return res.status(409).json({ status: 'fail', code: 'OWNER_CANNOT_APPLY', message: 'Le propriétaire ne peut pas candidater sur son bien.' });
    const validUntil = new Date(req.body.validUntil);
    if (!Number.isFinite(validUntil.getTime()) || validUntil <= new Date()) return res.status(400).json({ status: 'fail', code: 'INVALID_VALIDITY', message: 'La date de validité doit être future.' });

    const payload = {
      kind, property: property._id, applicant: req.user._id, owner: property.owner,
      visit: req.body.visitId || null, validUntil, message: req.body.message,
      history: [{ from: null, to: 'submitted', action: 'submitted', actor: req.user._id }],
    };
    if (kind === 'purchase_offer') {
      const amount = Number(req.body.amount);
      if (!Number.isFinite(amount) || amount <= 0) return res.status(400).json({ status: 'fail', code: 'INVALID_AMOUNT', message: 'Le montant doit être strictement positif.' });
      payload.purchaseOffer = { amount, currency: req.body.currency || 'XAF', conditions: req.body.conditions };
    } else {
      payload.rentalApplication = {
        desiredMoveIn: req.body.desiredMoveIn,
        desiredDurationMonths: req.body.desiredDurationMonths,
        occupants: req.body.occupants,
        monthlyIncome: req.body.monthlyIncome,
        incomeCurrency: req.body.incomeCurrency || 'XAF',
      };
    }
    const application = await Application.create(payload);
    await notify({ recipient: property.owner, type: 'real_estate_application_submitted', title: 'Nouveau dossier immobilier', body: `Un dossier a été reçu pour « ${property.title} ».`, entityType: 'RealEstateApplication', entityId: application._id, dedupeKey: `application:${application._id}:submitted` });
    res.status(201).json({ status: 'success', data: { application } });
  } catch (error) { fail(res, error); }
};

exports.list = async (req, res) => {
  const filter = isStaff(req.user) ? {} : { $or: [{ applicant: req.user._id }, { owner: req.user._id }] };
  if (req.query.kind) filter.kind = req.query.kind;
  if (req.query.status) filter.status = req.query.status;
  if (req.query.propertyId) filter.property = req.query.propertyId;
  if (req.query.search) {
    const properties = await Property.find({ title: { $regex: String(req.query.search).slice(0, 100), $options: 'i' } }).distinct('_id');
    filter.property = filter.property ? { $in: properties.filter((id) => String(id) === String(req.query.propertyId)) } : { $in: properties };
  }
  const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
  const limit = Math.min(50, Math.max(1, Number.parseInt(req.query.limit, 10) || 20));
  const sortMap = { oldest: { createdAt: 1 }, amount_desc: { 'purchaseOffer.amount': -1, createdAt: -1 }, amount_asc: { 'purchaseOffer.amount': 1, createdAt: -1 } };
  const sort = sortMap[req.query.sort] || { createdAt: -1 };
  const [applications, total] = await Promise.all([
    Application.find(filter).select('-attachments -rentalApplication.monthlyIncome').populate('property', 'title images status availability').populate('applicant', 'name firstName lastName').sort(sort).skip((page - 1) * limit).limit(limit),
    Application.countDocuments(filter),
  ]);
  res.json({ status: 'success', results: applications.length, pagination: { page, limit, total, pages: Math.ceil(total / limit) }, data: { applications } });
};

exports.getOne = async (req, res) => {
  const application = await Application.findById(req.params.id).select('+attachments +attachments.storageKey +rentalApplication.monthlyIncome').populate('property', 'title images status availability owner').populate('applicant', 'name firstName lastName email phone').populate('decidedBy', 'name firstName lastName');
  if (!application) return res.status(404).json({ status: 'fail', message: 'Dossier introuvable.' });
  if (!canManage(req.user, application) && String(application.applicant) !== String(req.user._id)) return res.status(403).json({ status: 'fail', message: 'Accès refusé.' });
  const safe = application.toObject();
  safe.attachments = (safe.attachments || []).map(({ storageKey: _storageKey, ...attachment }) => attachment);
  res.json({ status: 'success', data: { application: safe } });
};

exports.review = async (req, res) => {
  const application = await Application.findById(req.params.id);
  if (!application) return res.status(404).json({ status: 'fail', message: 'Dossier introuvable.' });
  if (!canManage(req.user, application)) return res.status(403).json({ status: 'fail', message: 'Accès refusé.' });
  if (application.status !== 'submitted') return res.status(409).json({ status: 'fail', code: 'INVALID_TRANSITION', message: 'Transition impossible.' });
  application.status = 'under_review';
  application.history.push({ from: 'submitted', to: 'under_review', action: 'review_started', actor: req.user._id });
  await application.save();
  await notify({ recipient: application.applicant, type: 'real_estate_application_under_review', title: 'Dossier en étude', body: 'Votre dossier immobilier est maintenant en cours d’étude.', entityType: 'RealEstateApplication', entityId: application._id, dedupeKey: `application:${application._id}:under_review` });
  res.json({ status: 'success', data: { application } });
};

exports.accept = async (req, res) => {
  try {
    const application = await Application.findById(req.params.id);
    if (!application) return res.status(404).json({ status: 'fail', message: 'Dossier introuvable.' });
    if (!canManage(req.user, application)) return res.status(403).json({ status: 'fail', message: 'Accès refusé.' });
    const result = await workflow.acceptApplication({ applicationId: application._id, actorId: req.user._id, idempotencyKey: req.get('Idempotency-Key') });
    if (!result.idempotent) await notify({ recipient: result.application.applicant, type: 'real_estate_application_accepted', title: 'Dossier accepté', body: 'Votre dossier est accepté et le bien est temporairement réservé.', entityType: 'RealEstateReservation', entityId: result.reservation._id, dedupeKey: `reservation:${result.reservation._id}:created` });
    res.status(result.idempotent ? 200 : 201).json({ status: 'success', data: result });
  } catch (error) { fail(res, error); }
};

exports.reject = async (req, res) => {
  const application = await Application.findById(req.params.id);
  if (!application) return res.status(404).json({ status: 'fail', message: 'Dossier introuvable.' });
  if (!canManage(req.user, application)) return res.status(403).json({ status: 'fail', message: 'Accès refusé.' });
  if (!['submitted', 'under_review'].includes(application.status)) return res.status(409).json({ status: 'fail', code: 'INVALID_TRANSITION', message: 'Transition impossible.' });
  const reason = String(req.body.reason || '').trim();
  if (!reason) return res.status(400).json({ status: 'fail', code: 'REJECTION_REASON_REQUIRED', message: 'Le motif de rejet est requis.' });
  const from = application.status;
  application.status = 'rejected'; application.decisionReason = reason; application.decidedBy = req.user._id; application.decidedAt = new Date();
  application.history.push({ from, to: 'rejected', action: 'rejected', actor: req.user._id, reason: application.decisionReason });
  await application.save();
  await notify({ recipient: application.applicant, type: 'real_estate_application_rejected', title: 'Dossier non retenu', body: 'Votre dossier immobilier n’a pas été retenu.', entityType: 'RealEstateApplication', entityId: application._id, dedupeKey: `application:${application._id}:rejected` });
  res.json({ status: 'success', data: { application } });
};

exports.withdraw = async (req, res) => {
  const application = await Application.findOne({ _id: req.params.id, applicant: req.user._id });
  if (!application) return res.status(404).json({ status: 'fail', message: 'Dossier introuvable.' });
  if (!['submitted', 'under_review'].includes(application.status)) return res.status(409).json({ status: 'fail', code: 'INVALID_TRANSITION', message: 'Ce dossier ne peut plus être retiré.' });
  const from = application.status; application.status = 'withdrawn'; application.history.push({ from, to: 'withdrawn', action: 'withdrawn', actor: req.user._id }); await application.save();
  await notify({ recipient: application.owner, type: 'real_estate_application_withdrawn', title: 'Dossier retiré', body: 'Un candidat a retiré son dossier immobilier.', entityType: 'RealEstateApplication', entityId: application._id, dedupeKey: `application:${application._id}:withdrawn` });
  res.json({ status: 'success', data: { application } });
};

exports.getReservation = async (req, res) => {
  const reservation = await Reservation.findById(req.params.id).populate('property', 'title images status availability owner').populate('application');
  if (!reservation) return res.status(404).json({ status: 'fail', message: 'Réservation introuvable.' });
  const owner = reservation.property?.owner;
  if (!isStaff(req.user) && String(reservation.client) !== String(req.user._id) && String(owner) !== String(req.user._id)) return res.status(403).json({ status: 'fail', message: 'Accès refusé.' });
  res.json({ status: 'success', data: { reservation } });
};

exports.cancelReservation = async (req, res) => {
  const reservation = await Reservation.findById(req.params.id).populate('property', 'owner');
  if (!reservation) return res.status(404).json({ status: 'fail', message: 'Réservation introuvable.' });
  const allowed = isStaff(req.user) || String(reservation.client) === String(req.user._id) || String(reservation.property?.owner) === String(req.user._id);
  if (!allowed) return res.status(403).json({ status: 'fail', message: 'Accès refusé.' });
  if (isStaff(req.user) && !String(req.body.reason || '').trim()) return res.status(400).json({ status: 'fail', code: 'CANCELLATION_REASON_REQUIRED', message: 'Le motif est requis.' });
  const changed = await workflow.releaseReservation(reservation, { status: 'cancelled', actorId: req.user._id, reason: req.body.reason });
  if (changed) {
    const recipients = [...new Set([String(reservation.client), String(reservation.property?.owner)].filter(Boolean))];
    await Promise.all(recipients.map((recipient) => notify({ recipient, type: 'real_estate_reservation_cancelled', title: 'Réservation annulée', body: 'La réservation immobilière a été annulée et le bien libéré.', entityType: 'RealEstateReservation', entityId: reservation._id, dedupeKey: `reservation:${reservation._id}:cancelled:${recipient}` })));
  }
  res.json({ status: 'success', data: { reservation, idempotent: !changed } });
};

const loadApplicationWithPrivateFields = (id) => Application.findById(id).select('+attachments +attachments.storageKey +rentalApplication.monthlyIncome');
const canReadPrivate = (user, application) => canManage(user, application) || String(application.applicant) === String(user._id);

exports.uploadAttachments = async (req, res) => {
  const application = await loadApplicationWithPrivateFields(req.params.id);
  if (!application) return res.status(404).json({ status: 'fail', message: 'Dossier introuvable.' });
  if (String(application.applicant) !== String(req.user._id)) return res.status(403).json({ status: 'fail', message: 'Seul le candidat peut ajouter ses justificatifs.' });
  if (!['submitted', 'under_review'].includes(application.status)) return res.status(409).json({ status: 'fail', code: 'ATTACHMENTS_LOCKED', message: 'Les pièces de ce dossier sont verrouillées.' });
  const files = req.files || [];
  if (!files.length || application.attachments.length + files.length > 5) return res.status(400).json({ status: 'fail', code: 'ATTACHMENT_LIMIT', message: 'Un à cinq justificatifs sont autorisés.' });
  const stored = [];
  try {
    for (const file of files) {
      const attachmentId = new mongoose.Types.ObjectId();
      const storageKey = await storage.storePrivateAttachment(file.buffer, { applicationId: application._id, attachmentId, mimeType: file.mimetype });
      const item = { _id: attachmentId, storageKey, name: file.originalname, mimeType: file.mimetype, size: file.size };
      application.attachments.push(item); stored.push(item);
    }
    application.history.push({ from: application.status, to: application.status, action: 'attachments_added', actor: req.user._id, reason: `${files.length} pièce(s)` });
    await application.save();
    res.status(201).json({ status: 'success', data: { attachments: application.attachments.map(({ _id, name, mimeType, size, uploadedAt }) => ({ _id, name, mimeType, size, uploadedAt })) } });
  } catch (error) {
    await Promise.allSettled(stored.map((item) => storage.deletePrivateAttachment(item.storageKey)));
    fail(res, error);
  }
};

exports.downloadAttachment = async (req, res) => {
  try {
    const application = await loadApplicationWithPrivateFields(req.params.id);
    if (!application) return res.status(404).json({ status: 'fail', message: 'Dossier introuvable.' });
    if (!canReadPrivate(req.user, application)) return res.status(403).json({ status: 'fail', message: 'Accès refusé.' });
    const attachment = application.attachments.id(req.params.attachmentId);
    if (!attachment) return res.status(404).json({ status: 'fail', message: 'Pièce introuvable.' });
    const buffer = await storage.readPrivateAttachment(attachment.storageKey);
    const safeName = attachment.name.replace(/[\r\n"\\]/g, '_');
    res.set({ 'Content-Type': attachment.mimeType, 'Content-Disposition': `attachment; filename="${safeName}"`, 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' }).send(buffer);
  } catch (error) { fail(res, error); }
};

exports.deleteAttachment = async (req, res) => {
  const application = await loadApplicationWithPrivateFields(req.params.id);
  if (!application) return res.status(404).json({ status: 'fail', message: 'Dossier introuvable.' });
  if (String(application.applicant) !== String(req.user._id) || !['submitted', 'under_review'].includes(application.status)) return res.status(403).json({ status: 'fail', message: 'Suppression interdite.' });
  const attachment = application.attachments.id(req.params.attachmentId);
  if (!attachment) return res.status(404).json({ status: 'fail', message: 'Pièce introuvable.' });
  const storageKey = attachment.storageKey; attachment.deleteOne();
  application.history.push({ from: application.status, to: application.status, action: 'attachment_deleted', actor: req.user._id });
  await application.save();
  await storage.deletePrivateAttachment(storageKey).catch(() => {});
  res.status(204).send();
};
