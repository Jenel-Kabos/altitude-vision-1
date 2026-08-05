const mongoose = require('mongoose');
const Reservation = require('../models/AccommodationReservation');
const Accommodation = require('../models/Accommodation');
const Block = require('../models/AccommodationAvailabilityBlock');
const NightLock = require('../models/AccommodationNightLock');
const service = require('../services/accommodationReservationService');
const { notify } = require('../services/notificationService');
const { logAction, buildAuteur } = require('../services/actionLogService');
const FinancialPayment = require('../models/FinancialPayment');
const PaymentAllocation = require('../models/PaymentAllocation');
const billing = require('../services/finance/accommodationBillingService');
const { reversePaymentAllocation } = require('../services/finance/paymentAllocationService');
const refunds = require('../services/finance/accommodationRefundService');

const respondError = (res, error) => res.status(error.status || 500).json({ status: 'fail', code: error.code, message: error.message });
const isStaff = (user) => ['Admin', 'Collaborateur', 'GestionnaireImmobilier', 'CommunityManager'].includes(user?.role);

exports.create = async (req, res) => {
  try {
    const reservation = await service.create({ input: req.body, user: req.user });
    await notify({ recipient: reservation.owner, sender: req.user.id, type: 'accommodation_reservation_pending', title: 'Nouvelle demande de réservation', message: 'Une nouvelle demande concerne votre hébergement.', link: '/dashboard/hebergements', entityType: 'AccommodationReservation', entityId: reservation._id }).catch(() => null);
    logAction({ action: 'Réservation hébergement créée', description: `Demande ${reservation._id} créée`, module: 'Altimmo', typeAction: 'CRÉATION', auteur: buildAuteur(req.user), cible: { id: String(reservation._id), type: 'AccommodationReservation' }, req });
    res.status(201).json({ status: 'success', data: { reservation } });
  } catch (error) { respondError(res, error); }
};

exports.list = async (req, res) => {
  try {
    const query = {};
    if (req.query.accommodation) query.accommodation = req.query.accommodation;
    if (req.query.status) query.status = req.query.status;
    if (isStaff(req.user)) { /* portée globale autorisée */ }
    else if (req.user.role === 'Proprietaire') query.owner = req.user.id;
    else query.guest = req.user.id;
    const page = Math.max(1, Number(req.query.page) || 1); const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
    const [reservations, total] = await Promise.all([
      Reservation.find(query).populate({ path: 'accommodation', populate: { path: 'property', select: 'title images address owner' } }).populate('guest', 'name email phone').populate('owner', 'name email phone').sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
      Reservation.countDocuments(query),
    ]);
    res.json({ status: 'success', data: { reservations, total, page, totalPages: Math.ceil(total / limit) } });
  } catch (error) { respondError(res, error); }
};

exports.getOne = async (req, res) => {
  try {
    const reservation = await Reservation.findById(req.params.id).populate({ path: 'accommodation', populate: { path: 'property' } }).populate('guest', 'name email phone').populate('owner', 'name email phone');
    if (!reservation) return res.status(404).json({ status: 'fail', message: 'Réservation introuvable.' });
    if (!(isStaff(req.user) || String(reservation.owner) === String(req.user.id) || String(reservation.guest?._id || reservation.guest) === String(req.user.id))) return res.status(403).json({ status: 'fail', message: 'Accès refusé.' });
    res.json({ status: 'success', data: { reservation } });
  } catch (error) { respondError(res, error); }
};

exports.transition = (to) => async (req, res) => {
  try {
    const reservation = await service.transition({ id: req.params.id, to, user: req.user, reason: req.body.reason });
    if (to === 'confirmed') await billing.ensureAccommodationInvoice({ reservationId: reservation._id, actor: req.user });
    const actorIsGuest = String(reservation.guest) === String(req.user.id);
    const recipient = to === 'cancelled' && actorIsGuest ? reservation.owner : reservation.guest;
    await notify({ recipient, sender: req.user.id, type: `accommodation_reservation_${to}`, title: `Réservation ${to}`, message: `Le statut de la réservation est maintenant ${to}.`, link: '/dashboard/hebergements', entityType: 'AccommodationReservation', entityId: reservation._id }).catch(() => null);
    logAction({ action: `Réservation hébergement : ${to}`, description: `Réservation ${reservation._id} passée au statut ${to}`, module: 'Altimmo', typeAction: 'MODIFICATION', auteur: buildAuteur(req.user), cible: { id: String(reservation._id), type: 'AccommodationReservation' }, metadata: { nouvelleValeur: to }, req });
    res.json({ status: 'success', data: { reservation } });
  } catch (error) { respondError(res, error); }
};

const accountingRoles = ['Admin', 'Collaborateur', 'Secretaire'];
const assertReservationAccess = async (reservationId, user) => {
  const reservation = await Reservation.findById(reservationId); if (!reservation) throw service.fail('Réservation introuvable.', 404);
  if (!(isStaff(user) || accountingRoles.includes(user.role) || String(reservation.owner) === String(user.id) || String(reservation.guest) === String(user.id))) throw service.fail('Accès refusé.', 403, 'FORBIDDEN');
  return reservation;
};
exports.financialSummary = async (req, res) => {
  try { const reservation = await assertReservationAccess(req.params.id, req.user); const refreshed = await billing.recalculateReservationFinancials(reservation._id); const payments = await FinancialPayment.find({ subjectType: 'AccommodationReservation', subjectId: reservation._id }).select('-providerMetadata -payloadHash').sort({ createdAt: -1 }).lean(); res.json({ status: 'success', data: { paymentStatus: refreshed.paymentStatus, amountPaid: refreshed.amountPaid, remainingAmount: refreshed.remainingAmount, total: refreshed.total, payments } }); }
  catch (error) { respondError(res, error); }
};
exports.createPayment = async (req, res) => {
  try { if (!accountingRoles.includes(req.user.role)) throw service.fail('Permission comptable requise.', 403, 'FORBIDDEN'); await assertReservationAccess(req.params.id, req.user); const key = String(req.headers['idempotency-key'] || ''); if (!key) throw service.fail('Clé d’idempotence requise.', 422); const result = await billing.createAccommodationPayment({ reservationId: req.params.id, amountMinor: Number(req.body.amountMinor), method: req.body.method, reference: req.body.reference, actor: req.user, idempotencyKey: key }); res.status(result.created ? 201 : 200).json({ status: 'success', data: result }); }
  catch (error) { respondError(res, error); }
};
exports.confirmPayment = async (req, res) => {
  try { if (!accountingRoles.includes(req.user.role)) throw service.fail('Permission comptable requise.', 403, 'FORBIDDEN'); const payment = await FinancialPayment.findById(req.params.paymentId); if (!payment) throw service.fail('Paiement introuvable.', 404); await assertReservationAccess(payment.subjectId, req.user); const key = String(req.headers['idempotency-key'] || ''); if (!key) throw service.fail('Clé d’idempotence requise.', 422); const result = await billing.confirmAndAllocateAccommodationPayment({ paymentId: payment._id, actor: req.user, idempotencyKey: key }); await notify({ recipient: result.reservation.guest, sender: req.user.id, type: result.reservation.paymentStatus === 'paid' ? 'accommodation_payment_completed' : 'accommodation_payment_received', title: 'Paiement enregistré', message: `Paiement reçu. Solde : ${result.reservation.remainingAmount} XAF.`, link: '/profile', entityType: 'AccommodationReservation', entityId: result.reservation._id }).catch(() => null); res.json({ status: 'success', data: result }); }
  catch (error) { respondError(res, error); }
};
exports.reversePaymentAllocation = async (req, res) => {
  try { if (req.user.role !== 'Admin') throw service.fail('Action administrateur requise.', 403, 'FORBIDDEN'); const allocation = await PaymentAllocation.findById(req.params.allocationId); const payment = allocation ? await FinancialPayment.findById(allocation.financialPayment) : null; if (!allocation || !payment || payment.domain !== 'real_estate' || payment.subjectType !== 'AccommodationReservation') throw service.fail('Allocation introuvable.', 404); if (payment.refundedAmountMinor > 0) throw service.fail('Une allocation remboursée ne peut plus être renversée.', 409, 'FINANCIAL_REFUNDED_ALLOCATION_IMMUTABLE'); const result = await reversePaymentAllocation({ allocationId: allocation._id, reason: req.body.reason, businessOperationKey: `accommodation-reverse:${allocation._id}:${Date.now()}`, actor: req.user, transactionMode: 'auto' }); const reservation = await billing.recalculateReservationFinancials(payment.subjectId); res.json({ status: 'success', data: { ...result, reservation } }); }
  catch (error) { respondError(res, error); }
};
const idempotencyKey = (req) => { const key = String(req.headers['idempotency-key'] || ''); if (!key) throw service.fail('Clé d’idempotence requise.', 422); return key; };
exports.refundableSummary = async (req, res) => {
  try { await assertReservationAccess(req.params.id, req.user); const summary = await refunds.refundableSummary(req.params.id); res.json({ status: 'success', data: summary }); } catch (error) { respondError(res, error); }
};
exports.requestRefund = async (req, res) => {
  try { const reservation = await assertReservationAccess(req.params.id, req.user); if (!(req.user.role === 'Admin' || accountingRoles.includes(req.user.role) || String(reservation.guest) === String(req.user.id))) throw service.fail('Seul le client ou le staff financier peut demander ce remboursement.', 403, 'FORBIDDEN'); const result = await refunds.requestRefund({ reservationId: reservation._id, paymentId: req.body.paymentId, amountMinor: Number(req.body.amountMinor), method: req.body.method, reason: req.body.reason, actor: req.user, idempotencyKey: idempotencyKey(req) }); res.status(result.created ? 201 : 200).json({ status: 'success', data: result }); } catch (error) { respondError(res, error); }
};
exports.approveRefund = async (req, res) => {
  try { if (!accountingRoles.includes(req.user.role)) throw service.fail('Permission comptable requise.', 403, 'FORBIDDEN'); const refund = await refunds.approveRefund({ refundId: req.params.refundId, actor: req.user, idempotencyKey: idempotencyKey(req) }); res.json({ status: 'success', data: { refund } }); } catch (error) { respondError(res, error); }
};
exports.completeRefund = async (req, res) => {
  try { if (!accountingRoles.includes(req.user.role)) throw service.fail('Permission comptable requise.', 403, 'FORBIDDEN'); const refund = await refunds.completeManualRefund({ refundId: req.params.refundId, reference: req.body.reference, effectiveDate: req.body.effectiveDate, proofUrl: req.body.proofUrl, comment: req.body.comment, actor: req.user, idempotencyKey: idempotencyKey(req) }); res.json({ status: 'success', data: { refund } }); } catch (error) { respondError(res, error); }
};
exports.cancelRefund = async (req, res) => {
  try { if (!accountingRoles.includes(req.user.role)) throw service.fail('Permission comptable requise.', 403, 'FORBIDDEN'); const refund = await refunds.cancelRefund({ refundId: req.params.refundId, reason: req.body.reason, actor: req.user, idempotencyKey: idempotencyKey(req) }); res.json({ status: 'success', data: { refund } }); } catch (error) { respondError(res, error); }
};

exports.availability = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ status: 'fail', message: 'Identifiant invalide.' });
    const accommodation = await Accommodation.findById(req.params.id); if (!accommodation || accommodation.hotel) return res.status(404).json({ status: 'fail', message: 'Hébergement indépendant introuvable.' });
    const from = req.query.from ? service.parseDate(req.query.from) : service.parseDate(new Date());
    const to = req.query.to ? service.parseDate(req.query.to) : new Date(from.getTime() + 90 * 86400000);
    const days = service.nightsBetween(from, to);
    const locks = await NightLock.find({ accommodation: accommodation._id, date: { $gte: from, $lt: to } }).select('date sourceType').sort({ date: 1 }).lean();
    const pricing = req.query.from && req.query.to ? await service.quote(accommodation, from, to).catch(() => null) : null;
    res.json({ status: 'success', data: { accommodationId: accommodation._id, from, to, days, available: locks.length === 0, pricing, unavailableDates: locks.map((lock) => ({ date: lock.date, type: lock.sourceType })) } });
  } catch (error) { respondError(res, error); }
};

exports.createBlock = async (req, res) => {
  try { const block = await service.createBlock({ accommodationId: req.params.id, input: req.body, user: req.user }); logAction({ action: 'Calendrier hébergement bloqué', description: `Blocage ${block._id} créé`, module: 'Altimmo', typeAction: 'CRÉATION', auteur: buildAuteur(req.user), cible: { id: String(block._id), type: 'AccommodationAvailabilityBlock' }, req }); res.status(201).json({ status: 'success', data: { block } }); }
  catch (error) { respondError(res, error); }
};

exports.deleteBlock = async (req, res) => {
  try {
    const block = await Block.findOne({ _id: req.params.blockId, accommodation: req.params.id }).populate({ path: 'accommodation', populate: { path: 'property' } });
    if (!block) return res.status(404).json({ status: 'fail', message: 'Blocage introuvable.' });
    if (!(isStaff(req.user) || String(block.accommodation.property.owner) === String(req.user.id))) return res.status(403).json({ status: 'fail', message: 'Accès refusé.' });
    await Promise.all([NightLock.deleteMany({ sourceType: 'block', sourceId: block._id }), block.deleteOne()]);
    logAction({ action: 'Blocage calendrier hébergement supprimé', description: `Blocage ${block._id} supprimé`, module: 'Altimmo', typeAction: 'SUPPRESSION', auteur: buildAuteur(req.user), cible: { id: String(block._id), type: 'AccommodationAvailabilityBlock' }, req });
    res.status(204).send();
  } catch (error) { respondError(res, error); }
};

exports.listBlocks = async (req, res) => {
  try { const blocks = await Block.find({ accommodation: req.params.id }).sort({ startDate: 1 }).lean(); res.json({ status: 'success', data: { blocks } }); }
  catch (error) { respondError(res, error); }
};

exports.calendar = async (req, res) => {
  try {
    const accommodation = await Accommodation.findById(req.params.id).populate('property', 'owner title');
    if (!accommodation || accommodation.hotel) throw service.fail('Hébergement indépendant introuvable.', 404);
    if (!(isStaff(req.user) || String(accommodation.property?.owner) === String(req.user.id))) throw service.fail('Accès refusé.', 403, 'FORBIDDEN');
    const from = service.parseDate(req.query.from); const to = service.parseDate(req.query.to);
    if (service.nightsBetween(from, to) > 62) throw service.fail('La période du calendrier est limitée à 62 jours.', 422);
    const [reservations, blocks] = await Promise.all([
      Reservation.find({ accommodation: accommodation._id, status: { $in: ['pending', 'confirmed', 'checked_in'] }, checkInDate: { $lt: to }, checkOutDate: { $gt: from } }).select('checkInDate checkOutDate status guestCount total paymentStatus').sort({ checkInDate: 1 }).lean(),
      Block.find({ accommodation: accommodation._id, startDate: { $lt: to }, endDate: { $gt: from } }).select('startDate endDate type reason').sort({ startDate: 1 }).lean(),
    ]);
    res.json({ status: 'success', data: { accommodation: { _id: accommodation._id, title: accommodation.property?.title }, from, to, reservations, blocks } });
  } catch (error) { respondError(res, error); }
};
