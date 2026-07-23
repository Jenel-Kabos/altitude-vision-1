const FinancialDocument = require('../../models/FinancialDocument');
const FinancialDocumentLine = require('../../models/FinancialDocumentLine');
const HotelReservation = require('../../models/HotelReservation');
const { buildHotelReservationInvoiceLines, assertReservationCanBeBilled, sourceSnapshotHash } = require('./hotelBillingAdapter');
const { replaceDraftLines } = require('./financialDocumentService');
const { appendFinancialLedgerEntry } = require('./financialLedgerService');
const { fail } = require('./financialError');

async function refreshHotelInvoiceDraftFromReservation({ documentId, actor }) {
  const document = await FinancialDocument.findById(documentId);
  if (!document) fail('FINANCIAL_DOCUMENT_NOT_ISSUED', 'Facture introuvable.', 404);
  if (document.domain !== 'hotel' || document.subjectType !== 'HotelReservation') fail('FINANCIAL_INVALID_TRANSITION', 'Ce document n’est pas une facture hôtelière.', 409);
  if (document.status !== 'draft') fail('FINANCIAL_DOCUMENT_IMMUTABLE', 'Une facture émise ne peut pas être actualisée.', 409);
  const reservation = await HotelReservation.findById(document.subjectId);
  assertReservationCanBeBilled(reservation);
  if (String(reservation.hotel) !== String(document.establishmentId)) fail('FINANCIAL_ESTABLISHMENT_MISMATCH', 'L’établissement est incohérent.', 409);
  const actorId = actor.id || actor._id;
  const lines = buildHotelReservationInvoiceLines(reservation, actorId);
  const updated = await replaceDraftLines(document._id, lines, actorId);
  updated.metadata = {
    ...(updated.metadata || {}), linesFinalized: false,
    reservationUpdatedAt: reservation.updatedAt,
    sourceSnapshotHash: sourceSnapshotHash(reservation),
    refreshedAt: new Date(), refreshedBy: actorId,
  };
  updated.markModified('metadata');
  await updated.save();
  await appendFinancialLedgerEntry({ eventType: 'financial_document.refreshed_from_reservation', domain: 'hotel', establishmentType: 'Hotel', establishmentId: updated.establishmentId, entityType: 'FinancialDocument', entityId: updated._id, relatedEntities: [{ entityType: 'HotelReservation', entityId: reservation._id }], actorType: 'user', actorId, amountMinor: updated.totalMinor, currency: updated.currency, businessOperationKey: `document:${updated._id}:refresh:${updated.updatedAt.getTime()}`, newState: { linesFinalized: false, sourceSnapshotHash: updated.metadata.sourceSnapshotHash } });
  return updated;
}

async function getHotelInvoiceWithLines(document) {
  if (!document) return null;
  const lines = await FinancialDocumentLine.find({ financialDocument: document._id }).sort('lineNumber').lean();
  return { document, lines };
}

module.exports = { refreshHotelInvoiceDraftFromReservation, getHotelInvoiceWithLines };
