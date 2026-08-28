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
const FinancialRefund = require('../models/FinancialRefund');
const { assertResourceTenantOrUnattributed } = require('../services/platformTenant/tenantResourceAttributionService');
const { resolveTenantForUser } = require('../services/platformTenant/tenantContextService');

const respondError = (res, error) => res.status(error.status || 500).json({ status: 'fail', code: error.code, message: error.message });
const isStaff = (user) => ['Admin', 'Collaborateur', 'GestionnaireImmobilier', 'CommunityManager'].includes(user?.role);
const isPlatformWide = (user) => Boolean(user?.isPlatformOperatorContext && !user?.platformTenant);

async function authorizedCalendarAccommodation(req) {
  const query = { _id: req.params.id };
  if (isStaff(req.user) && !isPlatformWide(req.user)) query.tenant = req.user.platformTenant?._id || req.user.platformTenant;
  const accommodation = await Accommodation.findOne(query).populate('property');
  if (!accommodation || accommodation.hotel) throw service.fail('Hébergement indépendant introuvable.', 404, 'NOT_FOUND');
  return accommodation;
}

// TENANT-CERT-3-PRE — `isStaff(req.user)` autorisait jusqu'ici un accès
// portée globale (toute réservation, tout tenant) à `list`/`getOne`, le même
// bug déjà corrigé sur Accommodation lui-même dans ce sprint. Les sous-flux
// financiers (paiement/remboursement, `assertReservationAccess` plus haut
// dans ce fichier) restent hors périmètre de cette correction — documentés
// comme limitation résiduelle dans TENANT_CERT_3_PRE_REPORT.md, au même
// titre que les occurrences `role === 'Admin'` non ré-auditées par
// TENANT-CERT-2 (précédent explicite, jamais un verdict bloquant en soi).
async function assertReservationTenantBoundary(req, reservation) {
  // PLATFORM-ADMIN-CERT-1 — voir accommodationController.js pour la même justification.
  const explicitTenantId = req.get('X-Platform-Tenant-Id') || req.get('X-Tenant-Id') || null;
  const tenant = await resolveTenantForUser(req.user._id || req.user.id, explicitTenantId);
  await assertResourceTenantOrUnattributed({ resourceType: 'AccommodationReservation', resource: reservation, tenantId: tenant?._id });
}

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
    if (isStaff(req.user)) {
      // TENANT-CERT-3-PRE — portée globale réservée aux acteurs sans aucune
      // appartenance tenant (mêmes principe et service que
      // platformTenantRoutes.js) ; un staff rattaché à un tenant reste
      // borné à ses propres réservations.
      const explicitTenantId = req.get('X-Platform-Tenant-Id') || req.get('X-Tenant-Id') || null;
      const tenant = await resolveTenantForUser(req.user._id || req.user.id, explicitTenantId);
      if (tenant?._id) query.tenant = tenant._id;
    } else if (req.user.role === 'Proprietaire') query.owner = req.user.id;
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
    const isOwnerOrGuest = String(reservation.owner) === String(req.user.id) || String(reservation.guest?._id || reservation.guest) === String(req.user.id);
    if (!isOwnerOrGuest) {
      if (!isStaff(req.user)) return res.status(403).json({ status: 'fail', message: 'Accès refusé.' });
      try {
        await assertReservationTenantBoundary(req, reservation);
      } catch (error) {
        return res.status(error.statusCode || 403).json({ status: 'fail', message: 'Accès refusé.' });
      }
    }
    res.json({ status: 'success', data: { reservation } });
  } catch (error) { respondError(res, error); }
};

exports.transition = (to) => async (req, res) => {
  try {
    let authorizedReservation = null;
    if (isStaff(req.user)) {
      const platformWide = req.user.isPlatformOperatorContext && !req.user.platformTenant;
      const query = { _id: req.params.id };
      if (!platformWide) query.tenant = req.user.platformTenant?._id || req.user.platformTenant;
      authorizedReservation = await Reservation.findOne(query);
      if (!authorizedReservation) throw service.fail('Réservation introuvable.', 404, 'NOT_FOUND');
    }
    const reservation = await service.transition({ id: req.params.id, to, user: req.user, reason: req.body.reason, authorizedReservation });
    if (to === 'confirmed') await billing.ensureAccommodationInvoice({ reservationId: reservation._id, actor: req.user });
    const actorIsGuest = String(reservation.guest) === String(req.user.id);
    const recipient = to === 'cancelled' && actorIsGuest ? reservation.owner : reservation.guest;
    await notify({ recipient, sender: req.user.id, type: `accommodation_reservation_${to}`, title: `Réservation ${to}`, message: `Le statut de la réservation est maintenant ${to}.`, link: '/dashboard/hebergements', entityType: 'AccommodationReservation', entityId: reservation._id }).catch(() => null);
    logAction({ action: `Réservation hébergement : ${to}`, description: `Réservation ${reservation._id} passée au statut ${to}`, module: 'Altimmo', typeAction: 'MODIFICATION', auteur: buildAuteur(req.user), cible: { id: String(reservation._id), type: 'AccommodationReservation' }, metadata: { nouvelleValeur: to }, req });
    res.json({ status: 'success', data: { reservation } });
  } catch (error) { respondError(res, error); }
};

const accountingRoles = ['Admin', 'Collaborateur', 'Secretaire'];
const assertReservationAccess = async (reservationId, user, req) => {
  const reservation = await Reservation.findById(reservationId); if (!reservation) throw service.fail('Réservation introuvable.', 404);
  if (!(isStaff(user) || accountingRoles.includes(user.role) || String(reservation.owner) === String(user.id) || String(reservation.guest) === String(user.id))) throw service.fail('Accès refusé.', 403, 'FORBIDDEN');
  const isOwnerOrGuest = String(reservation.owner) === String(user.id) || String(reservation.guest) === String(user.id);
  if (!isOwnerOrGuest) {
    const tenant = await resolveTenantForUser(user._id || user.id, req?.headers?.['x-platform-tenant-id']);
    if (!tenant) throw service.fail('Accès refusé.', 403, 'FORBIDDEN');
    try {
      await assertResourceTenantOrUnattributed({ resourceType: 'AccommodationReservation', resource: reservation, tenantId: tenant._id });
    } catch (_) {
      throw service.fail('Accès refusé.', 404, 'NOT_FOUND');
    }
  }
  return reservation;
};
exports.financialSummary = async (req, res) => {
  try { const reservation = await assertReservationAccess(req.params.id, req.user, req); const refreshed = await billing.recalculateReservationFinancials(reservation._id); const payments = await FinancialPayment.find({ subjectType: 'AccommodationReservation', subjectId: reservation._id }).select('-providerMetadata -payloadHash').sort({ createdAt: -1 }).lean(); res.json({ status: 'success', data: { paymentStatus: refreshed.paymentStatus, amountPaid: refreshed.amountPaid, remainingAmount: refreshed.remainingAmount, total: refreshed.total, payments } }); }
  catch (error) { respondError(res, error); }
};
exports.createPayment = async (req, res) => {
  try { if (!accountingRoles.includes(req.user.role)) throw service.fail('Permission comptable requise.', 403, 'FORBIDDEN'); await assertReservationAccess(req.params.id, req.user, req); const key = String(req.headers['idempotency-key'] || ''); if (!key) throw service.fail('Clé d’idempotence requise.', 422); const result = await billing.createAccommodationPayment({ reservationId: req.params.id, amountMinor: Number(req.body.amountMinor), method: req.body.method, reference: req.body.reference, actor: req.user, idempotencyKey: key }); res.status(result.created ? 201 : 200).json({ status: 'success', data: result }); }
  catch (error) { respondError(res, error); }
};
exports.confirmPayment = async (req, res) => {
  try { if (!accountingRoles.includes(req.user.role)) throw service.fail('Permission comptable requise.', 403, 'FORBIDDEN'); const payment = await FinancialPayment.findById(req.params.paymentId); if (!payment) throw service.fail('Paiement introuvable.', 404); await assertReservationAccess(payment.subjectId, req.user, req); const key = String(req.headers['idempotency-key'] || ''); if (!key) throw service.fail('Clé d’idempotence requise.', 422); const result = await billing.confirmAndAllocateAccommodationPayment({ paymentId: payment._id, actor: req.user, idempotencyKey: key }); await notify({ recipient: result.reservation.guest, sender: req.user.id, type: result.reservation.paymentStatus === 'paid' ? 'accommodation_payment_completed' : 'accommodation_payment_received', title: 'Paiement enregistré', message: `Paiement reçu. Solde : ${result.reservation.remainingAmount} XAF.`, link: '/profile', entityType: 'AccommodationReservation', entityId: result.reservation._id }).catch(() => null); res.json({ status: 'success', data: result }); }
  catch (error) { respondError(res, error); }
};
exports.reversePaymentAllocation = async (req, res) => {
  try { if (req.user.role !== 'Admin') throw service.fail('Action administrateur requise.', 403, 'FORBIDDEN'); const allocation = await PaymentAllocation.findById(req.params.allocationId); const payment = allocation ? await FinancialPayment.findById(allocation.financialPayment) : null; if (!allocation || !payment || payment.domain !== 'real_estate' || payment.subjectType !== 'AccommodationReservation') throw service.fail('Allocation introuvable.', 404); await assertReservationAccess(payment.subjectId, req.user, req); if (payment.refundedAmountMinor > 0) throw service.fail('Une allocation remboursée ne peut plus être renversée.', 409, 'FINANCIAL_REFUNDED_ALLOCATION_IMMUTABLE'); const result = await reversePaymentAllocation({ allocationId: allocation._id, reason: req.body.reason, businessOperationKey: `accommodation-reverse:${allocation._id}:${Date.now()}`, actor: req.user, transactionMode: 'auto' }); const reservation = await billing.recalculateReservationFinancials(payment.subjectId); res.json({ status: 'success', data: { ...result, reservation } }); }
  catch (error) { respondError(res, error); }
};
const idempotencyKey = (req) => { const key = String(req.headers['idempotency-key'] || ''); if (!key) throw service.fail('Clé d’idempotence requise.', 422); return key; };
const assertRefundAccess = async (refundId, user, req) => {
  const refund = await FinancialRefund.findOne({
    _id: refundId, domain: 'real_estate', subjectType: 'AccommodationReservation',
  });
  if (!refund) throw service.fail('Remboursement introuvable.', 404, 'NOT_FOUND');
  await assertReservationAccess(refund.subjectId, user, req);
  return refund;
};
exports.refundableSummary = async (req, res) => {
  try { await assertReservationAccess(req.params.id, req.user, req); const summary = await refunds.refundableSummary(req.params.id); res.json({ status: 'success', data: summary }); } catch (error) { respondError(res, error); }
};
exports.requestRefund = async (req, res) => {
  try { const reservation = await assertReservationAccess(req.params.id, req.user, req); if (!(req.user.role === 'Admin' || accountingRoles.includes(req.user.role) || String(reservation.guest) === String(req.user.id))) throw service.fail('Seul le client ou le staff financier peut demander ce remboursement.', 403, 'FORBIDDEN'); const result = await refunds.requestRefund({ reservationId: reservation._id, paymentId: req.body.paymentId, amountMinor: Number(req.body.amountMinor), method: req.body.method, reason: req.body.reason, actor: req.user, idempotencyKey: idempotencyKey(req) }); res.status(result.created ? 201 : 200).json({ status: 'success', data: result }); } catch (error) { respondError(res, error); }
};
exports.approveRefund = async (req, res) => {
  try { if (!accountingRoles.includes(req.user.role)) throw service.fail('Permission comptable requise.', 403, 'FORBIDDEN'); await assertRefundAccess(req.params.refundId, req.user, req); const refund = await refunds.approveRefund({ refundId: req.params.refundId, actor: req.user, idempotencyKey: idempotencyKey(req) }); res.json({ status: 'success', data: { refund } }); } catch (error) { respondError(res, error); }
};
exports.completeRefund = async (req, res) => {
  try { if (!accountingRoles.includes(req.user.role)) throw service.fail('Permission comptable requise.', 403, 'FORBIDDEN'); await assertRefundAccess(req.params.refundId, req.user, req); const refund = await refunds.completeManualRefund({ refundId: req.params.refundId, reference: req.body.reference, effectiveDate: req.body.effectiveDate, proofUrl: req.body.proofUrl, comment: req.body.comment, actor: req.user, idempotencyKey: idempotencyKey(req) }); res.json({ status: 'success', data: { refund } }); } catch (error) { respondError(res, error); }
};
exports.cancelRefund = async (req, res) => {
  try { if (!accountingRoles.includes(req.user.role)) throw service.fail('Permission comptable requise.', 403, 'FORBIDDEN'); await assertRefundAccess(req.params.refundId, req.user, req); const refund = await refunds.cancelRefund({ refundId: req.params.refundId, reason: req.body.reason, actor: req.user, idempotencyKey: idempotencyKey(req) }); res.json({ status: 'success', data: { refund } }); } catch (error) { respondError(res, error); }
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
  try { const authorizedAccommodation = await authorizedCalendarAccommodation(req); const block = await service.createBlock({ accommodationId: req.params.id, input: req.body, user: req.user, authorizedAccommodation }); logAction({ action: 'Calendrier hébergement bloqué', description: `Blocage ${block._id} créé`, module: 'Altimmo', typeAction: 'CRÉATION', auteur: buildAuteur(req.user), cible: { id: String(block._id), type: 'AccommodationAvailabilityBlock' }, req }); res.status(201).json({ status: 'success', data: { block } }); }
  catch (error) { respondError(res, error); }
};

exports.deleteBlock = async (req, res) => {
  try {
    const authorizedAccommodation = await authorizedCalendarAccommodation(req);
    const block = await Block.findOne({ _id: req.params.blockId, accommodation: authorizedAccommodation._id }).populate({ path: 'accommodation', populate: { path: 'property' } });
    if (!block) return res.status(404).json({ status: 'fail', message: 'Blocage introuvable.' });
    if (!(isStaff(req.user) || String(block.accommodation.property.owner) === String(req.user.id))) return res.status(403).json({ status: 'fail', message: 'Accès refusé.' });
    await Promise.all([NightLock.deleteMany({ sourceType: 'block', sourceId: block._id }), block.deleteOne()]);
    logAction({ action: 'Blocage calendrier hébergement supprimé', description: `Blocage ${block._id} supprimé`, module: 'Altimmo', typeAction: 'SUPPRESSION', auteur: buildAuteur(req.user), cible: { id: String(block._id), type: 'AccommodationAvailabilityBlock' }, req });
    res.status(204).send();
  } catch (error) { respondError(res, error); }
};

// RBAC-ACCOMMODATION-AVAILABILITY-BLOCKS-1 (RBAC-FINAL-01) — cette lecture
// n'exigeait jusqu'ici que `auth.protect` (tout utilisateur authentifié),
// contrairement à ses trois routes sœurs sur la même ressource (`calendar`,
// `createBlock`, `deleteBlock` ci-dessus), qui exigent toutes
// `isStaff(user) || owner===user.id` — contrat déjà en production, prouvé
// par HOTFIX_ACCOMMODATION_CALENDAR_TENANT_SCOPE1_RBAC_CONTRACT.md. Même
// garde réutilisée ici à l'identique (jamais une nouvelle politique) : les
// blocages exposent des données internes (motif libre, créateur) qu'un
// Client ou un Proprietaire non-owner n'a aucune raison de lire. La
// frontière tenant (HZ-02, `authorizedCalendarAccommodation` ci-dessus)
// reste strictement inchangée.
exports.listBlocks = async (req, res) => {
  try {
    const accommodation = await authorizedCalendarAccommodation(req);
    if (!(isStaff(req.user) || String(accommodation.property?.owner) === String(req.user.id))) {
      return res.status(403).json({ status: 'fail', message: 'Accès refusé.' });
    }
    const blocks = await Block.find({ accommodation: accommodation._id }).sort({ startDate: 1 }).lean();
    res.json({ status: 'success', data: { blocks } });
  } catch (error) { respondError(res, error); }
};

exports.calendar = async (req, res) => {
  try {
    const accommodation = await authorizedCalendarAccommodation(req);
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
