const FinancialDocument = require('../../models/FinancialDocument');
const FinancialDocumentLine = require('../../models/FinancialDocumentLine');
const { assertAmountMinor, addMinor, subtractMinor, multiplyMinor } = require('./moneyService');
const { fail } = require('./financialError');
const { getNextFinancialDocumentNumber } = require('./financialSequenceService');
const { appendFinancialLedgerEntry } = require('./financialLedgerService');
const { assertFinancialDocumentTransition } = require('./financialStateService');
const { runFinancialOperation } = require('./financialTransactionService');
const { financialCheckpoint } = require('./financialFaultInjection');
const HotelReservation = require('../../models/HotelReservation');
const inSession = (query, session) => (session ? query.session(session) : query);

function calculateLine(input) {
  const quantity = input.quantity;
  const subtotalMinor = multiplyMinor(assertAmountMinor(input.unitAmountMinor), quantity);
  const discountAmountMinor = assertAmountMinor(input.discountAmountMinor || 0);
  const taxAmountMinor = assertAmountMinor(input.taxAmountMinor || 0);
  const feesAmountMinor = assertAmountMinor(input.feesAmountMinor || 0);
  if (discountAmountMinor > subtotalMinor) fail('FINANCIAL_INVALID_AMOUNT', 'La remise dépasse le sous-total de ligne.');
  return { ...input, subtotalMinor, discountAmountMinor, taxAmountMinor, feesAmountMinor, totalMinor: addMinor(subtractMinor(subtotalMinor, discountAmountMinor), taxAmountMinor, feesAmountMinor) };
}
function calculateDocumentTotals(lines) {
  if (!Array.isArray(lines) || lines.length === 0) fail('FINANCIAL_INVALID_AMOUNT', 'Une facture doit contenir au moins une ligne.');
  const calculated = lines.map(calculateLine);
  const sum = (field) => addMinor(...calculated.map((line) => line[field]));
  const totals = { subtotalMinor: sum('subtotalMinor'), discountTotalMinor: sum('discountAmountMinor'), taxTotalMinor: sum('taxAmountMinor'), feesTotalMinor: sum('feesAmountMinor'), totalMinor: sum('totalMinor') };
  return { lines: calculated, totals };
}
async function recalculateDocument(documentId, { session } = {}) {
  const lines = await FinancialDocumentLine.find({ financialDocument: documentId }).sort('lineNumber').session(session || null);
  const { totals } = calculateDocumentTotals(lines.map((line) => line.toObject()));
  const document = await FinancialDocument.findOneAndUpdate({ _id: documentId, status: 'draft' }, { ...totals, balanceMinor: totals.totalMinor }, { new: true, session });
  if (!document) fail('FINANCIAL_DOCUMENT_IMMUTABLE', 'Une facture émise ne peut plus être modifiée.', 409);
  return document;
}
async function replaceDraftLines(documentId, lines, actorId) {
  const document = await FinancialDocument.findOne({ _id: documentId, status: 'draft' });
  if (!document) fail('FINANCIAL_DOCUMENT_IMMUTABLE', 'Une facture émise ne peut plus être modifiée.', 409);
  const calculated = calculateDocumentTotals(lines);
  await FinancialDocumentLine.deleteMany({ financialDocument: documentId });
  await FinancialDocumentLine.insertMany(calculated.lines.map((line, index) => ({ ...line, financialDocument: documentId, lineNumber: index + 1, createdBy: actorId })));
  const wasFinalized = document.metadata?.linesFinalized === true;
  Object.assign(document, calculated.totals, { balanceMinor: calculated.totals.totalMinor, updatedBy: actorId });
  document.metadata = { ...(document.metadata || {}), linesFinalized: false, linesFinalizedAt: null, linesFinalizedBy: null };
  document.markModified('metadata');
  await document.save();
  await appendFinancialLedgerEntry({ eventType: 'financial_document.draft_updated', domain: document.domain, establishmentType: document.establishmentType, establishmentId: document.establishmentId, entityType: 'FinancialDocument', entityId: document._id, actorType: 'user', actorId, businessOperationKey: `document:${document._id}:draft:${document.updatedAt.getTime()}`, previousState: { linesFinalized: wasFinalized }, newState: { ...calculated.totals, linesFinalized: false } });
  if (wasFinalized) await appendFinancialLedgerEntry({ eventType: 'financial_document.lines_finalization_invalidated', domain: document.domain, establishmentType: document.establishmentType, establishmentId: document.establishmentId, entityType: 'FinancialDocument', entityId: document._id, actorType: 'user', actorId, businessOperationKey: `document:${document._id}:finalization-invalidated:${document.updatedAt.getTime()}`, previousState: { linesFinalized: true }, newState: { linesFinalized: false } });
  return document;
}

async function finalizeDocumentLines({ documentId, actor }) {
  const document = await FinancialDocument.findById(documentId);
  if (!document) fail('FINANCIAL_DOCUMENT_NOT_ISSUED', 'Facture introuvable.', 404);
  if (document.status !== 'draft') fail('FINANCIAL_DOCUMENT_IMMUTABLE', 'Une facture émise ne peut plus être modifiée.', 409);
  if (document.domain === 'hotel' && document.currency !== 'XAF') fail('FINANCIAL_CURRENCY_UNSUPPORTED', 'F2 Hôtel accepte uniquement la devise XAF.', 422);
  const lines = await FinancialDocumentLine.find({ financialDocument: documentId }).sort('lineNumber');
  const { totals } = calculateDocumentTotals(lines.map((line) => line.toObject()));
  if (Object.entries(totals).some(([key, value]) => Number(document[key]) !== value)) fail('FINANCIAL_DOCUMENT_TOTAL_MISMATCH', 'Les totaux du document sont incohérents.', 409);
  if (document.metadata?.linesFinalized === true) return document;
  const now = new Date(); const actorId = actor.id || actor._id;
  const updated = await FinancialDocument.findOneAndUpdate(
    { _id: documentId, status: 'draft', 'metadata.linesFinalized': { $ne: true }, updatedAt: document.updatedAt },
    { $set: { 'metadata.linesFinalized': true, 'metadata.linesFinalizedAt': now, 'metadata.linesFinalizedBy': actorId, updatedBy: actorId } },
    { new: true },
  );
  if (!updated) {
    const current = await FinancialDocument.findById(documentId);
    if (current?.status === 'draft' && current.metadata?.linesFinalized === true) return current;
    fail('FINANCIAL_DOCUMENT_STATE_CHANGED', 'Le document a changé pendant la finalisation.', 409);
  }
  await appendFinancialLedgerEntry({ eventType: 'financial_document.lines_finalized', domain: updated.domain, establishmentType: updated.establishmentType, establishmentId: updated.establishmentId, entityType: 'FinancialDocument', entityId: updated._id, relatedEntities: [{ entityType: updated.subjectType, entityId: updated.subjectId }], actorType: 'user', actorId, amountMinor: updated.totalMinor, currency: updated.currency, businessOperationKey: `document:${updated._id}:lines-finalized:${now.getTime()}`, previousState: { linesFinalized: false }, newState: { linesFinalized: true }, metadata: { lineCount: lines.length } });
  return updated;
}
async function issueFinancialDocumentCore({ documentId, actor, businessOperationKey, establishmentCode, session, faultInjector }) {
  await financialCheckpoint(faultInjector, 'issue.before_sequence', { businessOperationKey });
  let document = await inSession(FinancialDocument.findById(documentId), session);
  if (!document) fail('FINANCIAL_DOCUMENT_NOT_ISSUED', 'Facture introuvable.', 404);
  if (document.status === 'issued') return document;
  assertFinancialDocumentTransition(document.status, 'issued');
  if (document.domain === 'hotel' && document.metadata?.source === 'hotel_reservation') {
    if (document.currency !== 'XAF') fail('FINANCIAL_CURRENCY_UNSUPPORTED', 'F2 Hôtel accepte uniquement la devise XAF.', 422);
    if (document.metadata?.linesFinalized !== true) fail('FINANCIAL_DOCUMENT_LINES_NOT_FINALIZED', 'Finalisez les lignes avant d’émettre la facture.', 409);
    const reservation = await inSession(HotelReservation.findById(document.subjectId), session);
    if (!reservation) fail('FINANCIAL_RESERVATION_CHANGED', 'La réservation associée est introuvable.', 409);
    if (['cancelled', 'expired', 'rejected', 'checked_out'].includes(reservation.status)) fail('FINANCIAL_INVALID_TRANSITION', 'La réservation ne permet pas l’émission.', 409);
    if (String(reservation.hotel) !== String(document.establishmentId)) fail('FINANCIAL_ESTABLISHMENT_MISMATCH', 'L’établissement du document est incohérent.', 409);
  }
  const lines = await inSession(FinancialDocumentLine.find({ financialDocument: documentId }), session);
  const { totals } = calculateDocumentTotals(lines.map((line) => line.toObject()));
  const next = await getNextFinancialDocumentNumber({ domain: document.domain, establishmentType: document.establishmentType, establishmentId: document.establishmentId, documentType: document.documentType, year: new Date().getUTCFullYear(), establishmentCode, session });
  await financialCheckpoint(faultInjector, 'issue.after_sequence', { businessOperationKey, sequenceValue: next.sequenceValue });
  await financialCheckpoint(faultInjector, 'issue.before_document_update', { businessOperationKey });
  document = await FinancialDocument.findOneAndUpdate({ _id: documentId, status: 'draft' }, { ...totals, balanceMinor: totals.totalMinor, status: 'issued', documentNumber: next.formattedNumber, sequenceValue: next.sequenceValue, sequenceYear: new Date().getUTCFullYear(), issueDate: new Date(), issuedAt: new Date(), issuedBy: actor.id || actor._id, updatedBy: actor.id || actor._id }, { new: true, session });
  if (!document) return inSession(FinancialDocument.findById(documentId), session);
  await financialCheckpoint(faultInjector, 'issue.after_document_update', { businessOperationKey, documentId });
  await financialCheckpoint(faultInjector, 'issue.before_ledger', { businessOperationKey, documentId });
  const ledgerData = { eventType: 'financial_document.issued', domain: document.domain, establishmentType: document.establishmentType, establishmentId: document.establishmentId, entityType: 'FinancialDocument', entityId: document._id, actorType: 'user', actorId: actor.id || actor._id, amountMinor: document.totalMinor, currency: document.currency, idempotencyKey: businessOperationKey, businessOperationKey: `document:${document._id}:issued`, previousState: { status: 'draft' }, newState: { status: 'issued', documentNumber: document.documentNumber } };
  await (session ? appendFinancialLedgerEntry(ledgerData, { session }) : appendFinancialLedgerEntry(ledgerData));
  await financialCheckpoint(faultInjector, 'issue.after_ledger', { businessOperationKey, documentId });
  return document;
}
async function issueFinancialDocument(args) {
  return runFinancialOperation({ operationName: 'financial_document.issue', transactionMode: args.transactionMode }, ({ session }) => issueFinancialDocumentCore({ ...args, session }));
}
module.exports = { calculateLine, calculateDocumentTotals, recalculateDocument, replaceDraftLines, finalizeDocumentLines, issueFinancialDocument };
