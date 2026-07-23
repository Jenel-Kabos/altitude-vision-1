const mongoose = require('mongoose');
const { startFinancialMongo, clearFinancialMongo, stopFinancialMongo } = require('./helpers/financialMongoEnvironment');
const FinancialDocument = require('../models/FinancialDocument');
const FinancialPayment = require('../models/FinancialPayment');
const PaymentAllocation = require('../models/PaymentAllocation');
const FinancialLedgerEntry = require('../models/FinancialLedgerEntry');
const { createHotelPayment, confirmHotelPayment } = require('../services/finance/financialPaymentService');
const { allocatePaymentToDocument, reversePaymentAllocation } = require('../services/finance/paymentAllocationService');

jest.setTimeout(120000);
const id = () => new mongoose.Types.ObjectId();
async function fixture(totalMinor = 100000) {
  const actor = { id: id() }; const hotelId = id(); const reservationId = id();
  const document = await FinancialDocument.create({ domain: 'hotel', establishmentType: 'Hotel', establishmentId: hotelId, documentType: 'invoice', documentNumber: `FAC-${id()}`, status: 'issued', paymentStatus: 'unpaid', currency: 'XAF', subjectType: 'HotelReservation', subjectId: reservationId, totalMinor, balanceMinor: totalMinor, amountAllocatedMinor: 0, businessOperationKey: `doc-${id()}`, metadata: { source: 'hotel_reservation', linesFinalized: true }, createdBy: actor.id, issuedBy: actor.id, issuedAt: new Date() });
  return { actor, hotelId, reservationId, document };
}
const paymentData = (f, amountMinor = 100000) => ({ establishmentId: f.hotelId, documentId: f.document._id, reservationId: f.reservationId, amountMinor, currency: 'XAF', method: 'cash' });
beforeAll(startFinancialMongo); afterEach(clearFinancialMongo); afterAll(stopFinancialMongo);

test('12 créations concurrentes et confirmations concurrentes restent idempotentes', async () => {
  const f = await fixture();
  const results = await Promise.all(Array.from({ length: 12 }, () => createHotelPayment({ data: paymentData(f), actor: f.actor, businessOperationKey: 'create-same', transactionMode: 'transactional' })));
  expect(new Set(results.map(({ payment }) => String(payment._id))).size).toBe(1);
  expect(await FinancialPayment.countDocuments()).toBe(1);
  const payment = results[0].payment;
  const confirmations = await Promise.all(Array.from({ length: 2 }, () => confirmHotelPayment({ paymentId: payment._id, actor: f.actor, businessOperationKey: 'confirm-same', transactionMode: 'transactional' })));
  expect(confirmations.filter((item) => item.confirmed)).toHaveLength(1);
  expect(await FinancialLedgerEntry.countDocuments({ entityId: payment._id, eventType: 'payment.confirmed' })).toBe(1);
});

test('allocations concurrentes empêchent surallocation et surpaiement', async () => {
  const f = await fixture(100000);
  const { payment } = await createHotelPayment({ data: paymentData(f, 100000), actor: f.actor, businessOperationKey: 'create-a', transactionMode: 'transactional' });
  await confirmHotelPayment({ paymentId: payment._id, actor: f.actor, businessOperationKey: 'confirm-a', transactionMode: 'transactional' });
  const settled = await Promise.allSettled(['alloc-a', 'alloc-b'].map((businessOperationKey) => allocatePaymentToDocument({ paymentId: payment._id, documentId: f.document._id, amountMinor: 70000, businessOperationKey, actor: f.actor, transactionMode: 'transactional' })));
  expect(settled.filter((item) => item.status === 'fulfilled')).toHaveLength(1);
  const [currentPayment, currentDocument] = await Promise.all([FinancialPayment.findById(payment._id), FinancialDocument.findById(f.document._id)]);
  expect(currentPayment.availableAmountMinor).toBe(30000); expect(currentDocument.balanceMinor).toBe(30000);
  expect(currentPayment.availableAmountMinor).toBeGreaterThanOrEqual(0); expect(currentDocument.balanceMinor).toBeGreaterThanOrEqual(0);
});

test('plusieurs paiements soldent une facture puis un renversement append-only la rouvre', async () => {
  const f = await fixture(100000);
  const payments = await Promise.all([40000, 60000].map((amountMinor, index) => createHotelPayment({ data: paymentData(f, amountMinor), actor: f.actor, businessOperationKey: `create-${index}`, transactionMode: 'transactional' })));
  await Promise.all(payments.map(({ payment }, index) => confirmHotelPayment({ paymentId: payment._id, actor: f.actor, businessOperationKey: `confirm-${index}`, transactionMode: 'transactional' })));
  const allocations = [];
  for (let index = 0; index < payments.length; index += 1) allocations.push(await allocatePaymentToDocument({ paymentId: payments[index].payment._id, documentId: f.document._id, amountMinor: [40000, 60000][index], businessOperationKey: `allocate-${index}`, actor: f.actor, transactionMode: 'transactional' }));
  expect(await FinancialDocument.findById(f.document._id)).toMatchObject({ balanceMinor: 0, amountAllocatedMinor: 100000, paymentStatus: 'paid' });
  await Promise.all(Array.from({ length: 2 }, () => reversePaymentAllocation({ allocationId: allocations[0]._id, reason: 'Erreur de caisse', businessOperationKey: 'reverse-same', actor: f.actor, transactionMode: 'transactional' })));
  expect(await PaymentAllocation.countDocuments({ _id: allocations[0]._id })).toBe(1);
  expect(await FinancialDocument.findById(f.document._id)).toMatchObject({ balanceMinor: 40000, amountAllocatedMinor: 60000, paymentStatus: 'partially_paid' });
  expect(await FinancialLedgerEntry.countDocuments({ entityId: allocations[0]._id, eventType: 'payment.allocation_reversed' })).toBe(1);
});

test('surplus confirmé reste non alloué et conflits de clé sont refusés', async () => {
  const f = await fixture(80000);
  const { payment } = await createHotelPayment({ data: paymentData(f, 100000), actor: f.actor, businessOperationKey: 'surplus', transactionMode: 'transactional' });
  await expect(createHotelPayment({ data: paymentData(f, 90000), actor: f.actor, businessOperationKey: 'surplus', transactionMode: 'transactional' })).rejects.toMatchObject({ code: 'FINANCIAL_IDEMPOTENCY_CONFLICT' });
  await confirmHotelPayment({ paymentId: payment._id, actor: f.actor, businessOperationKey: 'confirm-surplus', transactionMode: 'transactional' });
  await allocatePaymentToDocument({ paymentId: payment._id, documentId: f.document._id, amountMinor: 80000, businessOperationKey: 'alloc-surplus', actor: f.actor, transactionMode: 'transactional' });
  expect(await FinancialPayment.findById(payment._id)).toMatchObject({ allocatedAmountMinor: 80000, availableAmountMinor: 20000 });
  await expect(allocatePaymentToDocument({ paymentId: payment._id, documentId: f.document._id, amountMinor: 1, businessOperationKey: 'overpay', actor: f.actor, transactionMode: 'transactional' })).rejects.toMatchObject({ code: 'FINANCIAL_DOCUMENT_OVERPAYMENT' });
});
