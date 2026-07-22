const mongoose = require('mongoose');
const { startFinancialMongo, clearFinancialMongo, stopFinancialMongo } = require('./helpers/financialMongoEnvironment');
const FinancialSequence = require('../models/FinancialSequence');
const FinancialDocument = require('../models/FinancialDocument');
const FinancialPayment = require('../models/FinancialPayment');
const PaymentAllocation = require('../models/PaymentAllocation');
const FinancialLedgerEntry = require('../models/FinancialLedgerEntry');
const { getNextFinancialDocumentNumber } = require('../services/finance/financialSequenceService');
const { allocatePaymentToDocument } = require('../services/finance/paymentAllocationService');

jest.setTimeout(120000);
const id = () => new mongoose.Types.ObjectId();
const makeScope = () => ({ domain: 'hotel', establishmentType: 'Hotel', establishmentId: id(), currency: 'XAF' });
async function createPair(scope = makeScope()) {
  const actor = { id: id() };
  const document = await FinancialDocument.create({ ...scope, documentType: 'invoice', status: 'issued', paymentStatus: 'unpaid', documentNumber: `FAC-${id()}`, subjectType: 'HotelReservation', subjectId: id(), totalMinor: 100000, balanceMinor: 100000, businessOperationKey: `doc-${id()}`, createdBy: actor.id });
  const payment = await FinancialPayment.create({ ...scope, paymentReference: `PAY-${id()}`, status: 'succeeded', method: 'cash', amountMinor: 100000, availableAmountMinor: 100000, createdBy: actor.id });
  return { scope, actor, document, payment };
}

beforeAll(startFinancialMongo);
afterEach(clearFinancialMongo);
afterAll(stopFinancialMongo);

test('100 incréments concurrents restent uniques et isolés par scope', async () => {
  const establishmentId = id();
  const input = { domain: 'hotel', establishmentType: 'Hotel', establishmentId, documentType: 'invoice', year: 2026, establishmentCode: 'HT1' };
  const results = await Promise.all(Array.from({ length: 100 }, () => getNextFinancialDocumentNumber(input)));
  expect(new Set(results.map((item) => item.sequenceValue)).size).toBe(100);
  expect(Math.min(...results.map((item) => item.sequenceValue))).toBeGreaterThan(0);
  const isolated = await getNextFinancialDocumentNumber({ ...input, establishmentId: id(), establishmentCode: 'HT2' });
  expect(isolated.sequenceValue).toBe(1);
  expect(await FinancialSequence.countDocuments()).toBe(2);
});

test('deux allocations concurrentes de 70 000 ne surallouent jamais en fallback', async () => {
  const { actor, document, payment } = await createPair();
  const settled = await Promise.allSettled(['a', 'b'].map((key) => allocatePaymentToDocument({ paymentId: payment._id, documentId: document._id, amountMinor: 70000, businessOperationKey: key, actor, transactionMode: 'fallback' })));
  expect(settled.filter((item) => item.status === 'fulfilled')).toHaveLength(1);
  const [freshPayment, freshDocument] = await Promise.all([FinancialPayment.findById(payment._id), FinancialDocument.findById(document._id)]);
  expect(freshPayment.availableAmountMinor).toBe(30000);
  expect(freshDocument.balanceMinor).toBe(30000);
  expect(await PaymentAllocation.countDocuments({ status: 'active' })).toBe(1);
});

test('dix allocations transactionnelles concurrentes paient exactement la facture', async () => {
  const { actor, document, payment } = await createPair();
  const settled = await Promise.allSettled(Array.from({ length: 10 }, (_, index) => allocatePaymentToDocument({ paymentId: payment._id, documentId: document._id, amountMinor: 10000, businessOperationKey: `ten-${index}`, actor, transactionMode: 'transactional' })));
  expect(settled.filter((item) => item.status === 'fulfilled')).toHaveLength(10);
  const [freshPayment, freshDocument] = await Promise.all([FinancialPayment.findById(payment._id), FinancialDocument.findById(document._id)]);
  expect(freshPayment.availableAmountMinor).toBe(0);
  expect(freshDocument).toMatchObject({ balanceMinor: 0, amountAllocatedMinor: 100000, paymentStatus: 'paid' });
  expect(await FinancialLedgerEntry.countDocuments({ eventType: 'payment.allocated' })).toBe(10);
});

test('une erreur de journal provoque le rollback transactionnel intégral', async () => {
  const { actor, document, payment } = await createPair();
  await FinancialLedgerEntry.create({ domain: 'hotel', establishmentType: 'Hotel', establishmentId: document.establishmentId, eventType: 'payment.allocated', entityType: 'PaymentAllocation', entityId: id(), actorType: 'system', businessOperationKey: 'rollback-key' });
  await expect(allocatePaymentToDocument({ paymentId: payment._id, documentId: document._id, amountMinor: 30000, businessOperationKey: 'rollback-key', actor, transactionMode: 'transactional' })).rejects.toMatchObject({ code: 'FINANCIAL_DUPLICATE_ALLOCATION', statusCode: 409 });
  expect(await PaymentAllocation.countDocuments({ businessOperationKey: 'rollback-key' })).toBe(0);
  expect(await FinancialPayment.findById(payment._id)).toMatchObject({ availableAmountMinor: 100000, allocatedAmountMinor: 0 });
  expect(await FinancialDocument.findById(document._id)).toMatchObject({ balanceMinor: 100000, amountAllocatedMinor: 0 });
});
