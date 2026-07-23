const FinancialDocument = require('../../models/FinancialDocument');
const FinancialDocumentLine = require('../../models/FinancialDocumentLine');
const FinancialPayment = require('../../models/FinancialPayment');
const PaymentAllocation = require('../../models/PaymentAllocation');
const FinancialLedgerEntry = require('../../models/FinancialLedgerEntry');
const FinancialSequence = require('../../models/FinancialSequence');
const { derivePaymentStatus } = require('./paymentAllocationService');
const { appendFinancialLedgerEntry } = require('./financialLedgerService');
const { runFinancialOperation } = require('./financialTransactionService');

const CRITICAL = 'critical';
const HIGH = 'high';
const issue = (code, entityType, entityId, details = {}) => ({ code, severity: details.severity || HIGH, entityType, entityId, repairable: details.repairable === true, ...details });
const same = (a, b) => String(a || '') === String(b || '');
const scopeFilter = ({ domain, establishmentId, establishment, document, payment } = {}) => ({
  ...(domain ? { domain } : {}),
  ...((establishmentId || establishment) ? { establishmentId: establishmentId || establishment } : {}),
  ...(document ? { _id: document } : {}),
  ...(payment ? { _id: payment } : {}),
});
const sum = (items, field) => items.reduce((total, item) => total + Number(item[field] || 0), 0);

async function scanFinancialConsistency(scope = {}) {
  const session = scope.session;
  const lean = (query) => (session ? query.session(session) : query).lean();
  const emptyFilter = { _id: { $in: [] } };
  const documentFilter = scope.payment ? emptyFilter : scopeFilter({ ...scope, payment: undefined });
  const paymentFilter = scope.document ? emptyFilter : scopeFilter({ ...scope, document: undefined });
  const baseFilter = scopeFilter({ ...scope, document: undefined, payment: undefined });
  const allocationFilter = scope.document ? { financialDocument: scope.document } : scope.payment ? { financialPayment: scope.payment } : baseFilter;
  const limit = Math.min(Math.max(Number(scope.limit) || 1000, 1), 10000);
  const [documents, payments, allocations, lines, ledgers, sequences] = await Promise.all([
    lean(FinancialDocument.find(documentFilter).limit(limit)), lean(FinancialPayment.find(paymentFilter).limit(limit)), lean(PaymentAllocation.find(allocationFilter).limit(limit)),
    lean(FinancialDocumentLine.find({})), lean(FinancialLedgerEntry.find(baseFilter)), lean(FinancialSequence.find(baseFilter)),
  ]);
  const active = allocations.filter((item) => item.status === 'active');
  const issues = [];
  const documentById = new Map(documents.map((item) => [String(item._id), item]));
  const paymentById = new Map(payments.map((item) => [String(item._id), item]));
  const hasLedger = (eventType, entityId) => ledgers.some((entry) => entry.eventType === eventType && same(entry.entityId, entityId));

  for (const document of documents) {
    const documentAllocations = active.filter((item) => same(item.financialDocument, document._id));
    const allocated = sum(documentAllocations, 'amountMinor');
    const expected = { amountAllocatedMinor: allocated, balanceMinor: document.totalMinor - allocated, paymentStatus: derivePaymentStatus(document.totalMinor, allocated) };
    const actual = { amountAllocatedMinor: document.amountAllocatedMinor, balanceMinor: document.balanceMinor, paymentStatus: document.paymentStatus };
    if (Object.keys(expected).some((key) => expected[key] !== actual[key])) issues.push(issue('FINANCIAL_DOCUMENT_AGGREGATE_MISMATCH', 'FinancialDocument', document._id, { repairable: true, actual, expected }));
    const documentLines = lines.filter((line) => same(line.financialDocument, document._id));
    const lineTotal = sum(documentLines, 'totalMinor');
    if (documentLines.length && lineTotal !== document.totalMinor) issues.push(issue(document.status === 'draft' ? 'FINANCIAL_DRAFT_TOTAL_MISMATCH' : 'FINANCIAL_ISSUED_CONTENT_MISMATCH', 'FinancialDocument', document._id, { severity: document.status === 'draft' ? HIGH : CRITICAL, repairable: false, actual: { totalMinor: document.totalMinor }, expected: { totalMinor: lineTotal } }));
    if (document.totalMinor < 0) issues.push(issue('FINANCIAL_DOCUMENT_NEGATIVE_TOTAL', 'FinancialDocument', document._id, { severity: CRITICAL }));
    if (document.status === 'issued' && !document.documentNumber) issues.push(issue('FINANCIAL_ISSUED_WITHOUT_NUMBER', 'FinancialDocument', document._id, { severity: CRITICAL }));
    if (document.status === 'draft' && document.documentNumber) issues.push(issue('FINANCIAL_DRAFT_WITH_FINAL_NUMBER', 'FinancialDocument', document._id, { severity: CRITICAL }));
    if (document.status === 'issued' && !document.sequenceValue) issues.push(issue('FINANCIAL_ISSUED_WITHOUT_SEQUENCE', 'FinancialDocument', document._id, { severity: CRITICAL }));
    if (document.status === 'issued' && !hasLedger('financial_document.issued', document._id)) issues.push(issue('FINANCIAL_ISSUE_LEDGER_MISSING', 'FinancialDocument', document._id, { severity: CRITICAL }));
    if (document.status === 'draft' && !hasLedger('financial_document.draft_created', document._id)) issues.push(issue('FINANCIAL_DRAFT_LEDGER_MISSING', 'FinancialDocument', document._id, { severity: 'medium' }));
    if (document.status === 'cancelled' && documentAllocations.length) issues.push(issue('FINANCIAL_CANCELLED_DOCUMENT_ACTIVE_ALLOCATION', 'FinancialDocument', document._id, { severity: CRITICAL }));
  }

  for (const payment of payments) {
    const paymentAllocations = active.filter((item) => same(item.financialPayment, payment._id));
    const allocated = sum(paymentAllocations, 'amountMinor');
    const expected = { allocatedAmountMinor: allocated, availableAmountMinor: payment.amountMinor - payment.refundedAmountMinor - allocated };
    const actual = { allocatedAmountMinor: payment.allocatedAmountMinor, availableAmountMinor: payment.availableAmountMinor };
    if (Object.keys(expected).some((key) => expected[key] !== actual[key])) issues.push(issue('FINANCIAL_PAYMENT_AGGREGATE_MISMATCH', 'FinancialPayment', payment._id, { repairable: true, actual, expected }));
    if (expected.availableAmountMinor < 0 || allocated > payment.amountMinor) issues.push(issue('FINANCIAL_PAYMENT_OVERALLOCATED', 'FinancialPayment', payment._id, { severity: CRITICAL }));
    if (paymentAllocations.length && payment.status !== 'succeeded') issues.push(issue('FINANCIAL_UNCONFIRMED_PAYMENT_ACTIVE_ALLOCATION', 'FinancialPayment', payment._id, { severity: CRITICAL }));
    if (payment.refundedAmountMinor > payment.amountMinor || (payment.status === 'refunded' && payment.refundedAmountMinor !== payment.amountMinor)) issues.push(issue('FINANCIAL_REFUND_AMOUNT_MISMATCH', 'FinancialPayment', payment._id, { severity: CRITICAL }));
    if (payment.status === 'succeeded' && !hasLedger('payment.confirmed', payment._id)) issues.push(issue('FINANCIAL_PAYMENT_LEDGER_MISSING', 'FinancialPayment', payment._id, { severity: HIGH }));
  }

  for (const allocation of allocations) {
    const document = documentById.get(String(allocation.financialDocument)) || await lean(FinancialDocument.findById(allocation.financialDocument));
    const payment = paymentById.get(String(allocation.financialPayment)) || await lean(FinancialPayment.findById(allocation.financialPayment));
    if (!document) issues.push(issue('FINANCIAL_ALLOCATION_DOCUMENT_MISSING', 'PaymentAllocation', allocation._id, { severity: CRITICAL }));
    if (!payment) issues.push(issue('FINANCIAL_ALLOCATION_PAYMENT_MISSING', 'PaymentAllocation', allocation._id, { severity: CRITICAL }));
    if (document && payment && (!same(document.establishmentId, payment.establishmentId) || !same(allocation.establishmentId, document.establishmentId))) issues.push(issue('FINANCIAL_ALLOCATION_ESTABLISHMENT_MISMATCH', 'PaymentAllocation', allocation._id, { severity: CRITICAL }));
    if (document && payment && (document.currency !== payment.currency || allocation.currency !== document.currency)) issues.push(issue('FINANCIAL_ALLOCATION_CURRENCY_MISMATCH', 'PaymentAllocation', allocation._id, { severity: CRITICAL }));
    if (document && payment && (document.domain !== payment.domain || allocation.domain !== document.domain)) issues.push(issue('FINANCIAL_ALLOCATION_DOMAIN_MISMATCH', 'PaymentAllocation', allocation._id, { severity: CRITICAL }));
    if (allocation.amountMinor <= 0) issues.push(issue('FINANCIAL_ALLOCATION_INVALID_AMOUNT', 'PaymentAllocation', allocation._id, { severity: CRITICAL }));
    if (allocation.status === 'active' && document?.status !== 'issued') issues.push(issue('FINANCIAL_ALLOCATION_DOCUMENT_NOT_ISSUED', 'PaymentAllocation', allocation._id, { severity: CRITICAL }));
    if (allocation.status === 'reversed' && (!allocation.reversedAt || !allocation.reversedBy)) issues.push(issue('FINANCIAL_REVERSAL_METADATA_MISSING', 'PaymentAllocation', allocation._id, { severity: CRITICAL }));
    const event = allocation.status === 'active' ? 'payment.allocated' : 'payment.allocation_reversed';
    if (!hasLedger(event, allocation._id)) issues.push(issue('FINANCIAL_ALLOCATION_LEDGER_MISSING', 'PaymentAllocation', allocation._id, { severity: HIGH }));
  }

  for (const document of documents.filter((item) => item.status === 'issued' && item.sequenceValue)) {
    const sequence = sequences.find((item) => same(item.establishmentId, document.establishmentId) && item.domain === document.domain && item.documentType === document.documentType && item.year === document.sequenceYear);
    if (!sequence || sequence.currentValue < document.sequenceValue) issues.push(issue('FINANCIAL_SEQUENCE_BEHIND_DOCUMENT', 'FinancialDocument', document._id, { severity: CRITICAL }));
  }
  return { scannedAt: new Date(), scope: baseFilter, scanned: { documents: documents.length, payments: payments.length, allocations: allocations.length }, counts: { documents: documents.length, payments: payments.length, allocations: allocations.length }, issues };
}

function planFinancialReconciliation(report) {
  return report.issues.filter((item) => item.repairable && item.expected && ['FinancialDocument', 'FinancialPayment'].includes(item.entityType)).map((item) => ({ code: item.code, entityType: item.entityType, entityId: item.entityId, update: item.expected, previous: item.actual }));
}

async function applyFinancialReconciliation({ report, actorId, transactionMode = 'fallback', origin = 'cli' }) {
  const plan = planFinancialReconciliation(report);
  return runFinancialOperation({ operationName: 'financial.reconciliation.apply', transactionMode }, async ({ session }) => {
    for (const item of plan) {
      const Model = item.entityType === 'FinancialDocument' ? FinancialDocument : FinancialPayment;
      const entity = await Model.findByIdAndUpdate(item.entityId, { $set: item.update }, { new: true, session });
      await appendFinancialLedgerEntry({ eventType: 'financial_reconciliation.repair_applied', domain: entity.domain, establishmentType: entity.establishmentType, establishmentId: entity.establishmentId, entityType: item.entityType, entityId: entity._id, actorType: 'system', actorId, currency: entity.currency, businessOperationKey: `reconciliation:${item.code}:${item.entityId}:${Date.now()}`, previousState: item.previous, newState: item.update, metadata: { anomalyCode: item.code, reason: 'Derived aggregate repair', origin } }, { session });
    }
    return { applied: plan.length, plan };
  });
}
async function verifyFinancialReconciliation(scope) { const report = await scanFinancialConsistency(scope); return { consistent: report.issues.length === 0, report }; }
module.exports = { scanFinancialConsistency, scanFinancialInconsistencies: scanFinancialConsistency, planFinancialReconciliation, applyFinancialReconciliation, verifyFinancialReconciliation };
