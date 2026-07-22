const HotelReservation = require('../../models/HotelReservation');
const Hotel = require('../../models/Hotel');
const FinancialDocument = require('../../models/FinancialDocument');
const FinancialDocumentLine = require('../../models/FinancialDocumentLine');
const { assertCurrency, assertAmountMinor } = require('./moneyService');
const { calculateDocumentTotals } = require('./financialDocumentService');
const { appendFinancialLedgerEntry } = require('./financialLedgerService');
const { fail } = require('./financialError');

function toMinor(value, currency) {
  const number = Number(value || 0);
  if (!Number.isSafeInteger(number)) fail('FINANCIAL_INVALID_AMOUNT', 'Le snapshot historique contient un montant non entier.');
  return currency === 'XAF' ? number : assertAmountMinor(number * 100);
}
function assertReservationCanBeBilled(reservation) {
  if (!reservation) fail('FINANCIAL_DOCUMENT_NOT_ISSUED', 'Réservation introuvable.', 404);
  if (['cancelled', 'expired', 'rejected'].includes(reservation.status)) fail('FINANCIAL_INVALID_TRANSITION', 'Cette réservation ne peut pas être facturée.', 409);
}
const getHotelCustomerSnapshot = (r) => ({ name: `${r.guest.firstName} ${r.guest.lastName}`.trim(), email: r.guest.email, phone: r.guest.phone, address: r.guest.country, userId: r.guestUser || null });
const getHotelSellerSnapshot = (h) => ({ name: h.brand || h.name, email: h.email, phone: h.phone, address: '', taxIdentifier: '', legalInformation: '' });
function buildHotelReservationInvoiceLines(reservation, actorId) {
  const currency = assertCurrency(reservation.currency || reservation.rateSnapshot?.currency || 'XAF');
  const base = { lineType: 'accommodation', description: `Séjour ${reservation.reference} — ${reservation.nights} nuit(s), ${reservation.roomsCount} chambre(s)`, quantity: reservation.nights * reservation.roomsCount, unitAmountMinor: toMinor(reservation.unitPrice, currency), discountAmountMinor: toMinor(reservation.discount, currency), taxAmountMinor: toMinor(reservation.taxes, currency), feesAmountMinor: toMinor(reservation.fees, currency), taxes: [], sourceType: 'HotelReservation', sourceId: reservation._id, serviceDate: reservation.checkInDate, createdBy: actorId };
  return calculateDocumentTotals([base]).lines;
}
async function createHotelInvoiceDraftFromReservation({ reservationId, actor }) {
  const reservation = await HotelReservation.findById(reservationId);
  assertReservationCanBeBilled(reservation);
  const hotel = await Hotel.findById(reservation.hotel);
  if (!hotel) fail('FINANCIAL_ESTABLISHMENT_MISMATCH', 'Hôtel introuvable.', 404);
  const key = `hotel-reservation-primary-invoice:${reservation._id}`;
  const existing = await FinancialDocument.findOne({ domain: 'hotel', businessOperationKey: key });
  if (existing) return existing;
  const currency = assertCurrency(reservation.currency || reservation.rateSnapshot?.currency || 'XAF');
  const actorId = actor.id || actor._id;
  const lines = buildHotelReservationInvoiceLines(reservation, actorId);
  const { totals } = calculateDocumentTotals(lines);
  let document;
  try {
    document = await FinancialDocument.create({ domain: 'hotel', establishmentType: 'Hotel', establishmentId: hotel._id, documentType: 'invoice', currency, subjectType: 'HotelReservation', subjectId: reservation._id, customer: getHotelCustomerSnapshot(reservation), seller: getHotelSellerSnapshot(hotel), servicePeriodStart: reservation.checkInDate, servicePeriodEnd: reservation.checkOutDate, ...totals, balanceMinor: totals.totalMinor, businessOperationKey: key, metadata: { reservationReference: reservation.reference }, createdBy: actorId, updatedBy: actorId });
  } catch (error) {
    if (error.code === 11000) return FinancialDocument.findOne({ domain: 'hotel', businessOperationKey: key });
    throw error;
  }
  try {
    await FinancialDocumentLine.insertMany(lines.map((line, index) => ({ ...line, financialDocument: document._id, lineNumber: index + 1 })));
    await appendFinancialLedgerEntry({ eventType: 'financial_document.draft_created', domain: 'hotel', establishmentType: 'Hotel', establishmentId: hotel._id, entityType: 'FinancialDocument', entityId: document._id, actorType: 'user', actorId, amountMinor: document.totalMinor, currency, businessOperationKey: key, newState: { status: 'draft' } });
    return document;
  } catch (error) {
    await FinancialDocumentLine.deleteMany({ financialDocument: document._id });
    await FinancialDocument.deleteOne({ _id: document._id, status: 'draft' });
    throw error;
  }
}
module.exports = { assertReservationCanBeBilled, getHotelCustomerSnapshot, getHotelSellerSnapshot, buildHotelReservationInvoiceLines, createHotelInvoiceDraftFromReservation };
