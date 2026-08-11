const HotelReservation = require('../../models/HotelReservation');
const Hotel = require('../../models/Hotel');
const FinancialDocument = require('../../models/FinancialDocument');
const FinancialDocumentLine = require('../../models/FinancialDocumentLine');
const { assertCurrency, assertAmountMinor } = require('./moneyService');
const { calculateDocumentTotals } = require('./financialDocumentService');
const { appendFinancialLedgerEntry } = require('./financialLedgerService');
const { fail } = require('./financialError');
const { runFinancialOperation } = require('./financialTransactionService');
const { financialCheckpoint } = require('./financialFaultInjection');
const crypto = require('crypto');
const inSession = (query, session) => (session ? query.session(session) : query);

function toMinor(value, currency) {
  const number = Number(value || 0);
  if (!Number.isSafeInteger(number)) fail('FINANCIAL_INVALID_AMOUNT', 'Le snapshot historique contient un montant non entier.');
  return currency === 'XAF' ? number : assertAmountMinor(number * 100);
}
function assertReservationCanBeBilled(reservation) {
  if (!reservation) fail('FINANCIAL_DOCUMENT_NOT_ISSUED', 'Réservation introuvable.', 404);
  if (!['confirmed', 'checked_in'].includes(reservation.status)) fail('FINANCIAL_INVALID_TRANSITION', 'Cette réservation ne peut pas être facturée.', 409);
  const requiredIntegers = ['nights', 'roomsCount', 'unitPrice', 'subtotal', 'taxes', 'fees', 'discount', 'totalAmount'];
  if (requiredIntegers.some((field) => !Number.isSafeInteger(Number(reservation[field]))) || !reservation.rateSnapshot || !reservation.guest?.firstName || !reservation.guest?.lastName || !reservation.guest?.email) {
    fail('FINANCIAL_RESERVATION_SNAPSHOT_INCOMPLETE', 'Le snapshot tarifaire de la réservation est incomplet.', 422);
  }
  const currency = reservation.currency || reservation.rateSnapshot?.currency;
  if (currency !== 'XAF') fail('FINANCIAL_CURRENCY_UNSUPPORTED', 'F2 Hôtel accepte uniquement la devise XAF.', 422);
}
function sourceSnapshotHash(reservation) {
  const value = {
    updatedAt: reservation.updatedAt, currency: reservation.currency,
    nights: reservation.nights, roomsCount: reservation.roomsCount,
    unitPrice: reservation.unitPrice, subtotal: reservation.subtotal,
    taxes: reservation.taxes, fees: reservation.fees,
    discount: reservation.discount, totalAmount: reservation.totalAmount,
    rateSnapshot: reservation.rateSnapshot,
  };
  return crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
}
const getHotelCustomerSnapshot = (r) => ({ name: `${r.guest.firstName} ${r.guest.lastName}`.trim(), email: r.guest.email, phone: r.guest.phone, address: r.guest.country, userId: r.guestUser || null });
const getHotelSellerSnapshot = (h) => ({ name: h.brand || h.name, email: h.email, phone: h.phone, address: '', taxIdentifier: '', legalInformation: '' });
function buildHotelReservationInvoiceLines(reservation, actorId) {
  const currency = assertCurrency(reservation.currency || reservation.rateSnapshot?.currency || 'XAF');
  const base = { lineType: 'accommodation', description: `Séjour ${reservation.reference} — ${reservation.nights} nuit(s), ${reservation.roomsCount} chambre(s)`, quantity: reservation.nights * reservation.roomsCount, unitAmountMinor: toMinor(reservation.unitPrice, currency), discountAmountMinor: toMinor(reservation.discount, currency), taxAmountMinor: toMinor(reservation.taxes, currency), feesAmountMinor: toMinor(reservation.fees, currency), taxes: [], sourceType: 'HotelReservation', sourceId: reservation._id, serviceDate: reservation.checkInDate, createdBy: actorId };
  return calculateDocumentTotals([base]).lines;
}
async function createHotelInvoiceDraftCore({ reservationId, actor, source = 'manual', session, transactional, faultInjector }) {
  const reservation = await inSession(HotelReservation.findById(reservationId), session);
  assertReservationCanBeBilled(reservation);
  await financialCheckpoint(faultInjector, 'draft.after_reservation_read', { reservationId });
  const reservationStillActive = await inSession(HotelReservation.exists({ _id: reservationId, status: { $nin: ['cancelled', 'expired', 'rejected'] } }), session);
  if (!reservationStillActive) fail('FINANCIAL_RESERVATION_CHANGED', 'La réservation a été supprimée ou invalidée pendant la facturation.', 409);
  const hotel = await inSession(Hotel.findById(reservation.hotel), session);
  if (!hotel) fail('FINANCIAL_ESTABLISHMENT_MISMATCH', 'Hôtel introuvable.', 404);
  const key = `hotel-reservation-primary-invoice:${reservation._id}`;
  const existing = await inSession(FinancialDocument.findOne({ domain: 'hotel', businessOperationKey: key }), session);
  if (existing) return existing;
  const currency = assertCurrency(reservation.currency || reservation.rateSnapshot?.currency || 'XAF');
  const actorId = actor.id || actor._id;
  const lines = buildHotelReservationInvoiceLines(reservation, actorId);
  const { totals } = calculateDocumentTotals(lines);
  let document;
  try {
    const data = { tenant: actor.platformTenant?._id || actor.platformTenant || hotel.tenant || null, domain: 'hotel', establishmentType: 'Hotel', establishmentId: hotel._id, documentType: 'invoice', currency, subjectType: 'HotelReservation', subjectId: reservation._id, customer: getHotelCustomerSnapshot(reservation), seller: getHotelSellerSnapshot(hotel), servicePeriodStart: reservation.checkInDate, servicePeriodEnd: reservation.checkOutDate, ...totals, balanceMinor: totals.totalMinor, businessOperationKey: key, metadata: { reservationReference: reservation.reference, source: 'hotel_reservation', creationSource: source, linesFinalized: false, reservationUpdatedAt: reservation.updatedAt, sourceSnapshotHash: sourceSnapshotHash(reservation), rateSnapshotVersion: reservation.rateSnapshot?.version || null }, createdBy: actorId, updatedBy: actorId };
    document = session ? (await FinancialDocument.create([data], { session }))[0] : await FinancialDocument.create(data);
  } catch (error) {
    if (error.code === 11000) return inSession(FinancialDocument.findOne({ domain: 'hotel', businessOperationKey: key }), session);
    throw error;
  }
  try {
    await financialCheckpoint(faultInjector, 'draft.after_document', { businessOperationKey: key, documentId: document._id });
    await financialCheckpoint(faultInjector, 'draft.before_lines', { businessOperationKey: key, documentId: document._id });
    await FinancialDocumentLine.insertMany(lines.map((line, index) => ({ ...line, financialDocument: document._id, lineNumber: index + 1 })), { session });
    await financialCheckpoint(faultInjector, 'draft.after_lines', { businessOperationKey: key, documentId: document._id });
    await financialCheckpoint(faultInjector, 'draft.before_ledger', { businessOperationKey: key, documentId: document._id });
    await appendFinancialLedgerEntry({ eventType: 'financial_document.draft_created', domain: 'hotel', establishmentType: 'Hotel', establishmentId: hotel._id, entityType: 'FinancialDocument', entityId: document._id, relatedEntities: [{ entityType: 'HotelReservation', entityId: reservation._id }], actorType: 'user', actorId, amountMinor: document.totalMinor, currency, businessOperationKey: key, newState: { status: 'draft', linesFinalized: false }, metadata: { source } }, { session });
    return document;
  } catch (error) {
    if (!transactional) {
      await FinancialDocumentLine.deleteMany({ financialDocument: document._id });
      await FinancialDocument.deleteOne({ _id: document._id, status: 'draft' });
    }
    throw error;
  }
}
async function createHotelInvoiceDraftFromReservation(args) {
  return runFinancialOperation({ operationName: 'financial_document.hotel_draft', transactionMode: args.transactionMode }, (context) => createHotelInvoiceDraftCore({ ...args, ...context }));
}
module.exports = { assertReservationCanBeBilled, sourceSnapshotHash, getHotelCustomerSnapshot, getHotelSellerSnapshot, buildHotelReservationInvoiceLines, createHotelInvoiceDraftFromReservation };
