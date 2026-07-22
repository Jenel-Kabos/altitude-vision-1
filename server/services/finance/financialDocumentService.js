const FinancialDocument = require('../../models/FinancialDocument');
const FinancialDocumentLine = require('../../models/FinancialDocumentLine');
const { assertAmountMinor, addMinor, subtractMinor, multiplyMinor } = require('./moneyService');
const { fail } = require('./financialError');
const { getNextFinancialDocumentNumber } = require('./financialSequenceService');
const { appendFinancialLedgerEntry } = require('./financialLedgerService');
const { assertFinancialDocumentTransition } = require('./financialStateService');

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
  Object.assign(document, calculated.totals, { balanceMinor: calculated.totals.totalMinor, updatedBy: actorId });
  await document.save();
  await appendFinancialLedgerEntry({ eventType: 'financial_document.draft_updated', domain: document.domain, establishmentType: document.establishmentType, establishmentId: document.establishmentId, entityType: 'FinancialDocument', entityId: document._id, actorType: 'user', actorId, businessOperationKey: `document:${document._id}:draft:${document.updatedAt.getTime()}`, newState: calculated.totals });
  return document;
}
async function issueFinancialDocument({ documentId, actor, businessOperationKey, establishmentCode }) {
  let document = await FinancialDocument.findById(documentId);
  if (!document) fail('FINANCIAL_DOCUMENT_NOT_ISSUED', 'Facture introuvable.', 404);
  if (document.status === 'issued') return document;
  assertFinancialDocumentTransition(document.status, 'issued');
  const lines = await FinancialDocumentLine.find({ financialDocument: documentId });
  const { totals } = calculateDocumentTotals(lines.map((line) => line.toObject()));
  const next = await getNextFinancialDocumentNumber({ domain: document.domain, establishmentType: document.establishmentType, establishmentId: document.establishmentId, documentType: document.documentType, year: new Date().getUTCFullYear(), establishmentCode });
  document = await FinancialDocument.findOneAndUpdate({ _id: documentId, status: 'draft' }, { ...totals, balanceMinor: totals.totalMinor, status: 'issued', documentNumber: next.formattedNumber, sequenceValue: next.sequenceValue, sequenceYear: new Date().getUTCFullYear(), issueDate: new Date(), issuedAt: new Date(), issuedBy: actor.id || actor._id, updatedBy: actor.id || actor._id }, { new: true });
  if (!document) return FinancialDocument.findById(documentId);
  await appendFinancialLedgerEntry({ eventType: 'financial_document.issued', domain: document.domain, establishmentType: document.establishmentType, establishmentId: document.establishmentId, entityType: 'FinancialDocument', entityId: document._id, actorType: 'user', actorId: actor.id || actor._id, amountMinor: document.totalMinor, currency: document.currency, idempotencyKey: businessOperationKey, businessOperationKey: `document:${document._id}:issued`, previousState: { status: 'draft' }, newState: { status: 'issued', documentNumber: document.documentNumber } });
  return document;
}
module.exports = { calculateLine, calculateDocumentTotals, recalculateDocument, replaceDraftLines, issueFinancialDocument };
