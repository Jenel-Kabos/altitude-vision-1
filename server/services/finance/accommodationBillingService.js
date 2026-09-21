const crypto = require('crypto');
const FinancialDocument = require('../../models/FinancialDocument');
const FinancialDocumentLine = require('../../models/FinancialDocumentLine');
const FinancialPayment = require('../../models/FinancialPayment');
const PaymentAllocation = require('../../models/PaymentAllocation');
const Reservation = require('../../models/AccommodationReservation');
const { calculateDocumentTotals, finalizeDocumentLines, issueFinancialDocument } = require('./financialDocumentService');
const { appendFinancialLedgerEntry } = require('./financialLedgerService');
const { allocatePaymentToDocument } = require('./paymentAllocationService');
const { runFinancialOperation } = require('./financialTransactionService');
const { fail } = require('./financialError');

const actorId = (actor) => actor.id || actor._id;
async function ensureAccommodationInvoice({ reservationId, actor }) {
  const reservation = await Reservation.findById(reservationId).populate('guest', 'name email phone').populate({ path: 'accommodation', populate: { path: 'property', select: 'title address owner' } });
  if (!reservation || !['pending_payment', 'confirmed', 'checked_in'].includes(reservation.status) || !(reservation.pricingSnapshot?.quotedAt || reservation.pricingSnapshot?.confirmedAt)) fail('FINANCIAL_RESERVATION_SNAPSHOT_INCOMPLETE', 'Demande de réservation et snapshot tarifaire requis.', 422);
  const key = `accommodation-reservation-primary-invoice:${reservation._id}`;
  let document = await FinancialDocument.findOne({ domain: 'real_estate', businessOperationKey: key }); if (document) return document;
  const p = reservation.pricingSnapshot; const lineInput = { lineType: 'accommodation', description: `Séjour — ${reservation.nights} nuit(s)`, quantity: reservation.nights, unitAmountMinor: p.nightlyRate, discountAmountMinor: reservation.discount || 0, taxAmountMinor: reservation.taxes || 0, feesAmountMinor: reservation.fees || 0, taxes: [], sourceType: 'AccommodationReservation', sourceId: reservation._id, serviceDate: reservation.checkInDate, createdBy: actorId(actor) };
  const { lines, totals } = calculateDocumentTotals([lineInput]);
  try {
    document = await FinancialDocument.create({ tenant: reservation.tenant || actor.platformTenant?._id || actor.platformTenant || null, domain: 'real_estate', establishmentType: 'Accommodation', establishmentId: reservation.accommodation._id, documentType: 'invoice', status: 'draft', currency: 'XAF', subjectType: 'AccommodationReservation', subjectId: reservation._id,
      customer: { name: reservation.guest?.name || '', email: reservation.guest?.email, phone: reservation.guest?.phone, userId: reservation.guest?._id || reservation.guest }, seller: { name: reservation.accommodation.property?.title || 'Hébergement', address: reservation.accommodation.property?.address?.city || '', userId: reservation.owner },
      servicePeriodStart: reservation.checkInDate, servicePeriodEnd: reservation.checkOutDate, ...totals, balanceMinor: totals.totalMinor, businessOperationKey: key, metadata: { source: 'accommodation_reservation', linesFinalized: false, reservationUpdatedAt: reservation.updatedAt }, createdBy: actorId(actor), updatedBy: actorId(actor) });
    await FinancialDocumentLine.insertMany(lines.map((line, index) => ({ ...line, financialDocument: document._id, lineNumber: index + 1 })));
    await finalizeDocumentLines({ documentId: document._id, actor });
    document = await issueFinancialDocument({ documentId: document._id, actor, businessOperationKey: `issue:${document._id}`, establishmentCode: String(reservation.accommodation._id).slice(-6) });
    reservation.financialDocument = document._id; reservation.remainingAmount = reservation.total; await reservation.save();
    return document;
  } catch (error) { if (error.code === 11000) return FinancialDocument.findOne({ domain: 'real_estate', businessOperationKey: key }); throw error; }
}

async function recalculateReservationFinancials(reservationId, { session } = {}) {
  const reservationQuery = Reservation.findById(reservationId); const reservation = await (session ? reservationQuery.session(session) : reservationQuery); if (!reservation) fail('FINANCIAL_PAYMENT_NOT_AVAILABLE', 'Réservation introuvable.', 404);
  const document = reservation.financialDocument ? await FinancialDocument.findById(reservation.financialDocument) : await FinancialDocument.findOne({ domain: 'real_estate', subjectType: 'AccommodationReservation', subjectId: reservation._id });
  if (!document) return reservation;
  const activeQuery = PaymentAllocation.aggregate([{ $match: { financialDocument: document._id, status: 'active' } }, { $group: { _id: null, amount: { $sum: '$amountMinor' } } }]);
  const refundedQuery = FinancialPayment.aggregate([{ $match: { subjectType: 'AccommodationReservation', subjectId: reservation._id } }, { $group: { _id: null, amount: { $sum: '$refundedAmountMinor' } } }]);
  if (session) { activeQuery.session(session); refundedQuery.session(session); }
  const [active, refunded] = await Promise.all([activeQuery, refundedQuery]);
  const grossAmountPaid = active[0]?.amount || 0; const refundedAmount = refunded[0]?.amount || 0; const amountPaid = Math.max(0, grossAmountPaid - refundedAmount);
  reservation.grossAmountPaid = grossAmountPaid; reservation.refundedAmount = refundedAmount; reservation.amountPaid = amountPaid; reservation.remainingAmount = Math.max(0, reservation.total - amountPaid);
  reservation.paymentStatus = refundedAmount > 0 && amountPaid === 0 ? 'refunded' : refundedAmount > 0 ? 'partially_refunded' : amountPaid <= 0 ? 'unpaid' : amountPaid < reservation.total ? 'partially_paid' : 'paid';
  await reservation.save({ session }); return reservation;
}

async function createAccommodationPayment({ reservationId, amountMinor, method, reference, actor, idempotencyKey, provider = 'manual', providerPaymentId, paymentPurpose = 'guarantee', obligationKey }) {
  if (!['cash', 'bank_transfer', 'mobile_money', 'cheque'].includes(method)) fail('FINANCIAL_PAYMENT_METHOD_UNSUPPORTED', 'Moyen de paiement non supporté.', 422);
  const reservation = await Reservation.findById(reservationId).populate('guest', 'name email phone'); if (!reservation) fail('FINANCIAL_PAYMENT_NOT_AVAILABLE', 'Réservation introuvable.', 404);
  const document = await ensureAccommodationInvoice({ reservationId, actor }); if (amountMinor <= 0 || amountMinor > document.balanceMinor) fail('FINANCIAL_DOCUMENT_OVERPAYMENT', 'Le paiement dépasse le solde restant.', 409);
  const existing = await FinancialPayment.findOne({ domain: 'real_estate', establishmentId: reservation.accommodation, $or: [{ businessOperationKey: idempotencyKey }, ...(obligationKey ? [{ obligationKey }] : [])] }); if (existing) return { payment: existing, created: false };
  const isManual = provider === 'manual';
  let payment;
  try { payment = await FinancialPayment.create({ tenant: reservation.tenant || actor.platformTenant?._id || actor.platformTenant || null, domain: 'real_estate', establishmentType: 'Accommodation', establishmentId: reservation.accommodation, paymentReference: reference || `ACC-${Date.now()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`, status: 'pending', method, provider, providerPaymentId, currency: 'XAF', amountMinor, availableAmountMinor: amountMinor, payer: { name: reservation.guest?.name, email: reservation.guest?.email, phone: reservation.guest?.phone, userId: reservation.guest?._id || reservation.guest }, subjectType: 'AccommodationReservation', subjectId: reservation._id, receivedAt: new Date(), manualValidation: isManual ? { status: 'pending', submittedBy: actorId(actor) } : undefined, metadata: { financialDocumentId: document._id, source: isManual ? 'accommodation_manual' : 'accommodation_provider', paymentPurpose }, businessOperationKey: idempotencyKey, obligationKey, payloadHash: idempotencyKey, createdBy: actorId(actor) }); }
  catch (error) { if (error?.code === 11000 && obligationKey) { const concurrent = await FinancialPayment.findOne({ obligationKey }); if (concurrent) return { payment: concurrent, created: false }; } throw error; }
  await appendFinancialLedgerEntry({ eventType: 'payment.created', domain: 'real_estate', establishmentType: 'Accommodation', establishmentId: reservation.accommodation, entityType: 'FinancialPayment', entityId: payment._id, relatedEntities: [{ entityType: 'AccommodationReservation', entityId: reservation._id }, { entityType: 'FinancialDocument', entityId: document._id }], actorType: 'user', actorId: actorId(actor), amountMinor, currency: 'XAF', businessOperationKey: idempotencyKey, newState: { status: 'pending' } });
  return { payment, document, created: true };
}

async function confirmAndAllocateAccommodationPayment({ paymentId, actor, idempotencyKey }) {
  return runFinancialOperation({ operationName: 'payment.accommodation.confirm_allocate', transactionMode: 'auto' }, async ({ session }) => {
    let payment = await FinancialPayment.findById(paymentId).session(session); if (!payment || payment.domain !== 'real_estate' || payment.subjectType !== 'AccommodationReservation') fail('FINANCIAL_PAYMENT_NOT_AVAILABLE', 'Paiement hébergement introuvable.', 404);
    const before = await Reservation.findById(payment.subjectId).session(session);
    if (!before) fail('FINANCIAL_PAYMENT_NOT_AVAILABLE', 'Réservation introuvable.', 404);
    if (before.status === 'expired' || (before.status === 'pending_payment' && (!before.paymentExpiresAt || before.paymentExpiresAt <= new Date()))) fail('ACCOMMODATION_LATE_PAYMENT_REFUND_REQUIRED', 'Le hold a expiré. Ce paiement ne peut pas confirmer la réservation et nécessite un traitement de remboursement.', 409);
    if (payment.status === 'pending') payment = await FinancialPayment.findOneAndUpdate({ _id: payment._id, status: 'pending' }, { status: 'succeeded', confirmedAt: new Date(), confirmedBy: actorId(actor), 'manualValidation.status': 'approved', 'manualValidation.approvedBy': actorId(actor), 'manualValidation.approvedAt': new Date() }, { new: true, session });
    if (payment.status !== 'succeeded') fail('FINANCIAL_PAYMENT_INVALID_TRANSITION', 'Paiement non confirmable.', 409);
    const allocation = await allocatePaymentToDocument({ paymentId: payment._id, documentId: payment.metadata.financialDocumentId, amountMinor: payment.availableAmountMinor, businessOperationKey: `${idempotencyKey}:allocation`, actor, session });
    let reservation = await recalculateReservationFinancials(payment.subjectId, { session });
    if (reservation.status === 'pending_payment' && reservation.amountPaid >= Number(reservation.pricingSnapshot?.requiredToConfirm || 0)) {
      // Import différé : évite le cycle service réservation -> facturation.
      const reservationService = require('../accommodationReservationService');
      reservation = await reservationService.confirmFromValidatedPayment({ reservationId: reservation._id, session });
    }
    return { payment, allocation, reservation };
  });
}
module.exports = { ensureAccommodationInvoice, recalculateReservationFinancials, createAccommodationPayment, confirmAndAllocateAccommodationPayment };
