const mongoose = require('mongoose');
const { startFinancialMongo, clearFinancialMongo, stopFinancialMongo } = require('./helpers/financialMongoEnvironment');
const FinancialSequence = require('../models/FinancialSequence');
const FinancialDocument = require('../models/FinancialDocument');
const FinancialDocumentLine = require('../models/FinancialDocumentLine');
const FinancialPayment = require('../models/FinancialPayment');
const PaymentAllocation = require('../models/PaymentAllocation');
const FinancialLedgerEntry = require('../models/FinancialLedgerEntry');
const FinancialProviderEvent = require('../models/FinancialProviderEvent');
const { scanFinancialConsistency, applyFinancialReconciliation, verifyFinancialReconciliation } = require('../services/finance/financialReconciliationService');

jest.setTimeout(120000);
const id = () => new mongoose.Types.ObjectId();
const base = () => ({ domain: 'hotel', establishmentType: 'Hotel', establishmentId: id(), currency: 'XAF' });
const documentData = (scope, extra = {}) => ({ ...scope, documentType: 'invoice', status: 'issued', paymentStatus: 'unpaid', subjectType: 'HotelReservation', subjectId: id(), totalMinor: 100000, balanceMinor: 100000, businessOperationKey: `doc-${id()}`, createdBy: id(), ...extra });
const paymentData = (scope, extra = {}) => ({ ...scope, paymentReference: `PAY-${id()}`, status: 'succeeded', method: 'cash', amountMinor: 100000, availableAmountMinor: 100000, createdBy: id(), ...extra });

beforeAll(startFinancialMongo);
afterEach(clearFinancialMongo);
afterAll(stopFinancialMongo);

test('les index financiers attendus existent réellement', async () => {
  const expected = [
    [FinancialSequence, 'domain_1_establishmentType_1_establishmentId_1_documentType_1_year_1', true],
    [FinancialDocument, 'domain_1_establishmentId_1_documentNumber_1', true],
    [FinancialDocumentLine, 'financialDocument_1_lineNumber_1', true],
    [FinancialPayment, 'domain_1_establishmentId_1_paymentReference_1', true],
    [PaymentAllocation, 'domain_1_establishmentId_1_businessOperationKey_1', true],
    [FinancialProviderEvent, 'provider_1_providerEventId_1', true],
    [FinancialLedgerEntry, 'entityType_1_entityId_1_occurredAt_-1', false],
  ];
  for (const [Model, name, unique] of expected) {
    const index = (await Model.collection.indexes()).find((item) => item.name === name);
    expect(index).toBeDefined();
    if (unique) expect(index.unique).toBe(true);
  }
  const providerPaymentIndex = (await FinancialPayment.collection.indexes()).find((item) => item.name === 'provider_1_providerPaymentId_1');
  expect(providerPaymentIndex.partialFilterExpression).toEqual({ providerPaymentId: { $type: 'string' } });
});

test('dix paiements manuels sans identifiant fournisseur coexistent', async () => {
  const scope = base();
  await expect(Promise.all(Array.from({ length: 10 }, () => FinancialPayment.create(paymentData(scope))))).resolves.toHaveLength(10);
});

test('l’index fournisseur refuse seulement les vrais doublons et rejette les identifiants invalides', async () => {
  const scope = base();
  await FinancialPayment.create(paymentData(scope, { provider: 'provider-a', providerPaymentId: 'external-1' }));
  await expect(FinancialPayment.create(paymentData(scope, { provider: 'provider-a', providerPaymentId: 'external-1' }))).rejects.toMatchObject({ code: 11000 });
  await expect(FinancialPayment.create(paymentData(scope, { provider: 'provider-b', providerPaymentId: 'external-1' }))).resolves.toBeDefined();
  for (const providerPaymentId of ['', '   ', 123]) await expect(FinancialPayment.create(paymentData(base(), { provider: 'provider-c', providerPaymentId }))).rejects.toMatchObject({ name: expect.stringMatching(/ValidationError|CastError/) });
  await expect(FinancialPayment.create(paymentData(base(), { providerPaymentId: null }))).resolves.toBeDefined();
  await expect(FinancialPayment.create(paymentData(base()))).resolves.toBeDefined();
});

test('MongoDB produit de vrais E11000 sur les clés idempotentes et les numéros scopés', async () => {
  await FinancialProviderEvent.create({ provider: 'test', providerEventId: 'evt-1', eventType: 'paid', payloadHash: 'hash', signatureVerified: true, businessOperationKey: 'provider-1' });
  await expect(FinancialProviderEvent.create({ provider: 'test', providerEventId: 'evt-1', eventType: 'paid', payloadHash: 'hash2', signatureVerified: true, businessOperationKey: 'provider-2' })).rejects.toMatchObject({ code: 11000 });
  const scope = base();
  await FinancialDocument.create(documentData(scope, { documentNumber: 'FAC-H1-2026-000001' }));
  await expect(FinancialDocument.create(documentData(scope, { documentNumber: 'FAC-H1-2026-000001' }))).rejects.toMatchObject({ code: 11000 });
  await expect(FinancialDocument.create(documentData({ ...scope, establishmentId: id() }, { documentNumber: 'FAC-H1-2026-000001' }))).resolves.toBeDefined();
});

test('le journal est append-only pour les requêtes et document.save()', async () => {
  const scope = base();
  const entry = await FinancialLedgerEntry.create({ ...scope, eventType: 'test.created', entityType: 'FinancialDocument', entityId: id(), actorType: 'system', businessOperationKey: 'ledger-test' });
  await expect(FinancialLedgerEntry.updateOne({ _id: entry._id }, { eventType: 'changed' })).rejects.toThrow('FINANCIAL_LEDGER_APPEND_ONLY');
  entry.eventType = 'changed';
  await expect(entry.save()).rejects.toThrow('FINANCIAL_LEDGER_APPEND_ONLY');
  await expect(FinancialLedgerEntry.updateMany({}, { eventType: 'changed' })).rejects.toThrow('FINANCIAL_LEDGER_APPEND_ONLY');
  await expect(FinancialLedgerEntry.findByIdAndUpdate(entry._id, { eventType: 'changed' })).rejects.toThrow('FINANCIAL_LEDGER_APPEND_ONLY');
  await expect(FinancialLedgerEntry.replaceOne({ _id: entry._id }, entry.toObject())).rejects.toThrow('FINANCIAL_LEDGER_APPEND_ONLY');
  await expect(FinancialLedgerEntry.findOneAndReplace({ _id: entry._id }, entry.toObject())).rejects.toThrow('FINANCIAL_LEDGER_APPEND_ONLY');
  await expect(FinancialLedgerEntry.deleteOne({ _id: entry._id })).rejects.toThrow('FINANCIAL_LEDGER_APPEND_ONLY');
  await expect(FinancialLedgerEntry.deleteMany({})).rejects.toThrow('FINANCIAL_LEDGER_APPEND_ONLY');
  await expect(FinancialLedgerEntry.findByIdAndDelete(entry._id)).rejects.toThrow('FINANCIAL_LEDGER_APPEND_ONLY');
  await expect(FinancialLedgerEntry.bulkWrite([{ deleteOne: { filter: { _id: entry._id } } }])).rejects.toThrow('FINANCIAL_LEDGER_APPEND_ONLY');
});

test.each([
  ['décimal', 1.5], ['NaN', Number.NaN], ['Infinity', Number.POSITIVE_INFINITY], ['-Infinity', Number.NEGATIVE_INFINITY], ['hors entier sûr', Number.MAX_SAFE_INTEGER + 1],
])('les validateurs Mongoose refusent un montant %s', async (_label, amountMinor) => {
  const scope = base();
  await expect(FinancialPayment.create(paymentData(scope, { amountMinor, availableAmountMinor: amountMinor }))).rejects.toMatchObject({ name: 'ValidationError' });
  await expect(FinancialDocument.create(documentData(scope, { totalMinor: amountMinor, balanceMinor: amountMinor }))).rejects.toMatchObject({ name: 'ValidationError' });
});

test('les enums monétaires refusent devise inconnue, minuscule et vide', async () => {
  for (const currency of ['GBP', 'xaf', '']) await expect(FinancialPayment.create(paymentData(base(), { currency }))).rejects.toMatchObject({ name: 'ValidationError' });
});

test('les validateurs réels couvrent lignes, allocations, journal et séquences', async () => {
  const scope = base(); const actor = id(); const documentId = id();
  const line = (extra = {}) => ({ financialDocument: documentId, lineNumber: 1, lineType: 'accommodation', description: 'Ligne', quantity: 1, unitAmountMinor: 100, subtotalMinor: 100, totalMinor: 100, sourceType: 'HotelReservation', sourceId: id(), createdBy: actor, ...extra });
  await expect(FinancialDocumentLine.create(line({ quantity: 1.5 }))).rejects.toMatchObject({ name: 'ValidationError' });
  await expect(FinancialDocumentLine.create(line({ quantity: -1 }))).rejects.toMatchObject({ name: 'ValidationError' });
  await expect(FinancialDocumentLine.create(line({ unitAmountMinor: Number.MAX_SAFE_INTEGER + 1 }))).rejects.toMatchObject({ name: 'ValidationError' });
  const allocation = (extra = {}) => ({ ...scope, financialPayment: id(), financialDocument: documentId, amountMinor: 100, businessOperationKey: `allocation-${id()}`, allocatedBy: actor, ...extra });
  await expect(PaymentAllocation.create(allocation({ amountMinor: 0 }))).rejects.toMatchObject({ name: 'ValidationError' });
  await expect(PaymentAllocation.create(allocation({ amountMinor: 1.5 }))).rejects.toMatchObject({ name: 'ValidationError' });
  const ledger = (extra = {}) => ({ ...scope, eventType: 'validation.test', entityType: 'FinancialDocument', entityId: documentId, actorType: 'system', businessOperationKey: `ledger-${id()}`, ...extra });
  await expect(FinancialLedgerEntry.create(ledger({ amountMinor: Number.POSITIVE_INFINITY }))).rejects.toMatchObject({ name: 'ValidationError' });
  await expect(FinancialLedgerEntry.create(ledger({ amountMinor: null }))).resolves.toBeDefined();
  const sequence = (extra = {}) => ({ domain: scope.domain, establishmentType: scope.establishmentType, establishmentId: scope.establishmentId, documentType: 'invoice', year: 2026, prefix: 'FAC', currentValue: 1, ...extra });
  await expect(FinancialSequence.create(sequence({ currentValue: -1 }))).rejects.toMatchObject({ name: 'ValidationError' });
  await expect(FinancialSequence.create(sequence({ currentValue: 1.5 }))).rejects.toMatchObject({ name: 'ValidationError' });
  await expect(FinancialPayment.create(paymentData(base(), { amountMinor: '100', availableAmountMinor: '100' }))).resolves.toMatchObject({ amountMinor: 100, availableAmountMinor: 100 });
  await expect(FinancialPayment.create(paymentData(base(), { amountMinor: '', availableAmountMinor: '' }))).rejects.toMatchObject({ name: 'ValidationError' });
});

test('scan, plan, apply et vérification réparent seulement les agrégats dérivés', async () => {
  const scope = base();
  const document = await FinancialDocument.create(documentData(scope, { amountAllocatedMinor: 0, balanceMinor: 100000 }));
  const payment = await FinancialPayment.create(paymentData(scope));
  await PaymentAllocation.create({ ...scope, financialPayment: payment._id, financialDocument: document._id, amountMinor: 40000, businessOperationKey: 'allocation-reconcile', allocatedBy: id() });
  const report = await scanFinancialConsistency({ domain: scope.domain, establishmentId: scope.establishmentId });
  expect(report.issues.some((issue) => issue.code === 'FINANCIAL_DOCUMENT_AGGREGATE_MISMATCH')).toBe(true);
  expect(report.issues.some((issue) => issue.code === 'FINANCIAL_PAYMENT_AGGREGATE_MISMATCH')).toBe(true);
  await applyFinancialReconciliation({ report });
  const verification = await verifyFinancialReconciliation({ domain: scope.domain, establishmentId: scope.establishmentId });
  expect(verification.report.issues.some((issue) => issue.repairable)).toBe(false);
  expect(await FinancialLedgerEntry.countDocuments({ eventType: 'financial_reconciliation.repair_applied' })).toBe(2);
});
