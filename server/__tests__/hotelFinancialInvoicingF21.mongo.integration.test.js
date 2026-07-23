const mongoose = require('mongoose');
const { startFinancialMongo, clearFinancialMongo, stopFinancialMongo } = require('./helpers/financialMongoEnvironment');
const Hotel = require('../models/Hotel');
const HotelReservation = require('../models/HotelReservation');
const FinancialDocument = require('../models/FinancialDocument');
const FinancialDocumentLine = require('../models/FinancialDocumentLine');
const FinancialLedgerEntry = require('../models/FinancialLedgerEntry');
const { createHotelInvoiceDraftFromReservation } = require('../services/finance/hotelBillingAdapter');
const { finalizeDocumentLines, issueFinancialDocument, replaceDraftLines } = require('../services/finance/financialDocumentService');
const { refreshHotelInvoiceDraftFromReservation } = require('../services/finance/hotelInvoiceService');

jest.setTimeout(120000);
const id = () => new mongoose.Types.ObjectId();
async function fixture(overrides = {}) {
  const actorId = id();
  const hotel = await Hotel.create({ name: 'Hôtel F2.1', brand: 'F21', email: 'f21@example.test', manager: actorId, createdBy: actorId });
  const reservation = await HotelReservation.create({ hotel: hotel._id, roomCategory: id(), guest: { firstName: 'Ada', lastName: 'Lovelace', email: 'ada@example.test', country: 'CG' }, checkInDate: new Date('2026-09-01'), checkOutDate: new Date('2026-09-03'), roomsCount: 1, adults: 1, unitPrice: 30000, subtotal: 60000, taxes: 3000, fees: 1000, discount: 4000, totalAmount: 60000, currency: 'XAF', rateSnapshot: { rateType: 'nightly', amount: 30000, currency: 'XAF', version: 1 }, status: 'confirmed', source: 'owner_dashboard', createdBy: actorId, ...overrides });
  return { actor: { id: actorId }, hotel, reservation };
}

beforeAll(startFinancialMongo);
afterEach(clearFinancialMongo);
afterAll(stopFinancialMongo);

test('création concurrente idempotente depuis le snapshot persistant', async () => {
  const { actor, reservation } = await fixture();
  const results = await Promise.all(Array.from({ length: 12 }, () => createHotelInvoiceDraftFromReservation({ reservationId: reservation._id, actor, source: 'manual', transactionMode: 'transactional' })));
  expect(new Set(results.map((item) => String(item._id))).size).toBe(1);
  const document = await FinancialDocument.findById(results[0]._id);
  expect(document).toMatchObject({ status: 'draft', currency: 'XAF', totalMinor: 60000 });
  expect(document.metadata).toMatchObject({ linesFinalized: false, source: 'hotel_reservation' });
  expect(await FinancialDocumentLine.countDocuments({ financialDocument: document._id })).toBe(1);
  expect(await FinancialLedgerEntry.countDocuments({ entityId: document._id, eventType: 'financial_document.draft_created' })).toBe(1);
});

test('finalisation idempotente, invalidation après modification et émission immuable', async () => {
  const { actor, reservation } = await fixture();
  let document = await createHotelInvoiceDraftFromReservation({ reservationId: reservation._id, actor, transactionMode: 'transactional' });
  await expect(issueFinancialDocument({ documentId: document._id, actor, businessOperationKey: 'early-issue', establishmentCode: 'F21', transactionMode: 'transactional' })).rejects.toMatchObject({ code: 'FINANCIAL_DOCUMENT_LINES_NOT_FINALIZED' });
  const finalized = await Promise.all(Array.from({ length: 5 }, () => finalizeDocumentLines({ documentId: document._id, actor })));
  expect(finalized.every((item) => item.metadata.linesFinalized === true)).toBe(true);
  expect(await FinancialLedgerEntry.countDocuments({ entityId: document._id, eventType: 'financial_document.lines_finalized' })).toBe(1);
  const [line] = await FinancialDocumentLine.find({ financialDocument: document._id }).lean();
  document = await replaceDraftLines(document._id, [{ ...line, quantity: 2, unitAmountMinor: 30000, discountAmountMinor: 4000, taxAmountMinor: 3000, feesAmountMinor: 1000 }], actor.id);
  expect(document.metadata.linesFinalized).toBe(false);
  await finalizeDocumentLines({ documentId: document._id, actor });
  const issued = await issueFinancialDocument({ documentId: document._id, actor, businessOperationKey: 'final-issue', establishmentCode: 'F21', transactionMode: 'transactional' });
  expect(issued).toMatchObject({ status: 'issued', currency: 'XAF' });
  expect(issued.metadata.linesFinalized).toBe(true);
  await expect(replaceDraftLines(document._id, [{ ...line }], actor.id)).rejects.toMatchObject({ code: 'FINANCIAL_DOCUMENT_IMMUTABLE' });
  await expect(refreshHotelInvoiceDraftFromReservation({ documentId: document._id, actor })).rejects.toMatchObject({ code: 'FINANCIAL_DOCUMENT_IMMUTABLE' });
});

test('actualisation explicite reconstruit le brouillon et invalide la finalisation', async () => {
  const { actor, reservation } = await fixture();
  const document = await createHotelInvoiceDraftFromReservation({ reservationId: reservation._id, actor, transactionMode: 'transactional' });
  await finalizeDocumentLines({ documentId: document._id, actor });
  reservation.unitPrice = 35000; reservation.subtotal = 70000; reservation.totalAmount = 70000;
  reservation.rateSnapshot.amount = 35000; reservation.markModified('rateSnapshot'); await reservation.save();
  const refreshed = await refreshHotelInvoiceDraftFromReservation({ documentId: document._id, actor });
  expect(refreshed).toMatchObject({ totalMinor: 70000 });
  expect(refreshed.metadata.linesFinalized).toBe(false);
  expect(await FinancialLedgerEntry.countDocuments({ entityId: document._id, eventType: 'financial_document.refreshed_from_reservation' })).toBe(1);
});

test('refuse devise non XAF et snapshot incomplet sans résidu', async () => {
  const nonXaf = await fixture({ currency: 'EUR', rateSnapshot: { rateType: 'nightly', amount: 30000, currency: 'EUR' } });
  await expect(createHotelInvoiceDraftFromReservation({ reservationId: nonXaf.reservation._id, actor: nonXaf.actor })).rejects.toMatchObject({ code: 'FINANCIAL_CURRENCY_UNSUPPORTED' });
  expect(await FinancialDocument.countDocuments({ subjectId: nonXaf.reservation._id })).toBe(0);
});
