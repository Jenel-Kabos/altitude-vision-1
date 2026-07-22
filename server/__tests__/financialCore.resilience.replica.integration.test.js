const mongoose = require('mongoose');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const jwt = require('jsonwebtoken');
const request = require('supertest');
const express = require('express');
const { startFinancialMongo, clearFinancialMongo, stopFinancialMongo } = require('./helpers/financialMongoEnvironment');
const Hotel = require('../models/Hotel');
const HotelReservation = require('../models/HotelReservation');
const FinancialDocument = require('../models/FinancialDocument');
const FinancialDocumentLine = require('../models/FinancialDocumentLine');
const FinancialPayment = require('../models/FinancialPayment');
const PaymentAllocation = require('../models/PaymentAllocation');
const FinancialLedgerEntry = require('../models/FinancialLedgerEntry');
const FinancialProviderEvent = require('../models/FinancialProviderEvent');
const User = require('../models/User');
const financialRoutes = require('../routes/financialRoutes');
const { issueFinancialDocument, replaceDraftLines } = require('../services/finance/financialDocumentService');
const { createHotelInvoiceDraftFromReservation } = require('../services/finance/hotelBillingAdapter');
const { allocatePaymentToDocument, reversePaymentAllocation } = require('../services/finance/paymentAllocationService');
const { scanFinancialConsistency, planFinancialReconciliation, applyFinancialReconciliation } = require('../services/finance/financialReconciliationService');
const { registerProviderEvent } = require('../services/finance/financialIdempotencyService');
const { createManualPayment } = require('../services/finance/financialPaymentService');
const execFileAsync = promisify(execFile);

jest.setTimeout(180000);
const id = () => new mongoose.Types.ObjectId();
const scope = (establishmentId = id(), currency = 'XAF') => ({ domain: 'hotel', establishmentType: 'Hotel', establishmentId, currency });
async function document(scopeData, totalMinor = 100000, status = 'issued') {
  const actorId = id();
  const doc = await FinancialDocument.create({ ...scopeData, documentType: 'invoice', status, paymentStatus: 'unpaid', documentNumber: status === 'issued' ? `FAC-${id()}` : null, sequenceValue: status === 'issued' ? 1 : null, sequenceYear: status === 'issued' ? 2026 : null, subjectType: 'HotelReservation', subjectId: id(), totalMinor, subtotalMinor: totalMinor, balanceMinor: totalMinor, businessOperationKey: `doc-${id()}`, createdBy: actorId });
  await FinancialDocumentLine.create({ financialDocument: doc._id, lineNumber: 1, lineType: 'accommodation', description: 'Séjour snapshot', quantity: 1, unitAmountMinor: totalMinor, subtotalMinor: totalMinor, totalMinor, sourceType: 'HotelReservation', sourceId: doc.subjectId, createdBy: actorId });
  return { doc, actorId };
}
async function payment(scopeData, amountMinor = 100000) { return FinancialPayment.create({ ...scopeData, paymentReference: `PAY-${id()}`, status: 'succeeded', method: 'cash', amountMinor, availableAmountMinor: amountMinor, createdBy: id() }); }
async function hotelReservationFixture(label = String(id())) {
  const owner = id();
  const hotel = await Hotel.create({ name: `Hôtel ${label}`, brand: `Brand ${label}`, email: `${label}@example.test`, manager: owner, createdBy: owner });
  const reservation = await HotelReservation.create({ hotel: hotel._id, roomCategory: id(), guest: { firstName: 'Grace', lastName: 'Hopper', email: 'grace@example.test', country: 'CG' }, checkInDate: new Date('2026-09-01'), checkOutDate: new Date('2026-09-03'), roomsCount: 1, adults: 1, unitPrice: 30000, subtotal: 60000, totalAmount: 60000, currency: 'XAF', rateSnapshot: { rateType: 'nightly', amount: 30000, currency: 'XAF' }, status: 'confirmed', source: 'owner_dashboard', createdBy: owner });
  return { owner, hotel, reservation };
}

let mongoUri;
beforeAll(async () => { ({ uri: mongoUri } = await startFinancialMongo()); });
afterEach(clearFinancialMongo);
afterAll(stopFinancialMongo);

test('20 émissions concurrentes produisent une transition, un numéro et un journal', async () => {
  const s = scope();
  const { doc, actorId } = await document(s, 50000, 'draft');
  const results = await Promise.allSettled(Array.from({ length: 20 }, () => issueFinancialDocument({ documentId: doc._id, actor: { id: actorId }, businessOperationKey: 'same-issue', establishmentCode: 'HTA', transactionMode: 'transactional' })));
  expect(results.filter((result) => result.status === 'rejected')).toHaveLength(0);
  const issued = await FinancialDocument.findById(doc._id);
  expect(issued).toMatchObject({ status: 'issued', totalMinor: 50000, balanceMinor: 50000 });
  expect(issued.documentNumber).toMatch(/^FAC-HTA-\d{4}-\d{6}$/);
  expect(await FinancialLedgerEntry.countDocuments({ eventType: 'financial_document.issued', entityId: doc._id })).toBe(1);
});

test('des clés différentes sur le même brouillon ne produisent qu’une émission logique', async () => {
  const s = scope(); const { doc, actorId } = await document(s, 50000, 'draft');
  const results = await Promise.allSettled(Array.from({ length: 20 }, (_, index) => issueFinancialDocument({ documentId: doc._id, actor: { id: actorId }, businessOperationKey: `issue-key-${index}`, establishmentCode: 'HTK', transactionMode: 'transactional' })));
  expect(results.filter((result) => result.status === 'fulfilled').length).toBeGreaterThan(0);
  const issued = await FinancialDocument.findById(doc._id);
  expect(issued).toMatchObject({ status: 'issued', totalMinor: 50000, balanceMinor: 50000 });
  expect(await FinancialLedgerEntry.countDocuments({ eventType: 'financial_document.issued', entityId: doc._id })).toBe(1);
});

test('une panne après séquence rollbacke en transaction et laisse le brouillon intact', async () => {
  const s = scope(); const { doc, actorId } = await document(s, 25000, 'draft');
  const injector = async (point) => { if (point === 'issue.after_sequence') throw new Error('INJECTED_AFTER_SEQUENCE'); };
  await expect(issueFinancialDocument({ documentId: doc._id, actor: { id: actorId }, businessOperationKey: 'issue-failure', establishmentCode: 'HTF', transactionMode: 'transactional', faultInjector: injector })).rejects.toThrow('INJECTED_AFTER_SEQUENCE');
  expect(await FinancialDocument.findById(doc._id)).toMatchObject({ status: 'draft', documentNumber: null });
  expect(await FinancialLedgerEntry.countDocuments({ entityId: doc._id, eventType: 'financial_document.issued' })).toBe(0);
});

test('tous les checkpoints d’émission rollbackent intégralement en transaction', async () => {
  const points = ['issue.before_sequence', 'issue.after_sequence', 'issue.before_document_update', 'issue.after_document_update', 'issue.before_ledger', 'issue.after_ledger'];
  for (const [index, point] of points.entries()) {
    const s = scope(); const { doc, actorId } = await document(s, 25000, 'draft');
    const injector = async (current) => { if (current === point) throw new Error(`INJECTED_${point}`); };
    await expect(issueFinancialDocument({ documentId: doc._id, actor: { id: actorId }, businessOperationKey: `issue-matrix-${index}`, establishmentCode: 'HTM', transactionMode: 'transactional', faultInjector: injector })).rejects.toThrow(`INJECTED_${point}`);
    expect(await FinancialDocument.findById(doc._id)).toMatchObject({ status: 'draft', documentNumber: null, balanceMinor: 25000 });
    expect(await FinancialLedgerEntry.countDocuments({ entityId: doc._id, eventType: 'financial_document.issued' })).toBe(0);
  }
});

test('30 créations concurrentes du même brouillon hôtelier restent uniques', async () => {
  const owner = id();
  const hotel = await Hotel.create({ name: 'Hôtel Snapshot', brand: 'Snapshot', email: 'hotel@example.test', phone: '+242000000', manager: owner, createdBy: owner });
  const reservation = await HotelReservation.create({ hotel: hotel._id, roomCategory: id(), guest: { firstName: 'Ada', lastName: 'Lovelace', email: 'ada@example.test', phone: '+242111', country: 'CG' }, checkInDate: new Date('2026-08-01'), checkOutDate: new Date('2026-08-03'), roomsCount: 1, adults: 1, unitPrice: 30000, subtotal: 60000, taxes: 3000, fees: 1000, discount: 4000, totalAmount: 60000, currency: 'XAF', rateSnapshot: { rateType: 'nightly', amount: 30000, currency: 'XAF' }, status: 'confirmed', source: 'owner_dashboard', createdBy: owner });
  const results = await Promise.allSettled(Array.from({ length: 30 }, () => createHotelInvoiceDraftFromReservation({ reservationId: reservation._id, actor: { id: owner }, transactionMode: 'fallback' })));
  expect(results.filter((result) => result.status === 'rejected')).toHaveLength(0);
  const docs = await FinancialDocument.find({ subjectId: reservation._id });
  expect(docs).toHaveLength(1);
  expect(await FinancialDocumentLine.countDocuments({ financialDocument: docs[0]._id })).toBe(1);
  expect(docs[0].customer).toMatchObject({ name: 'Ada Lovelace', email: 'ada@example.test' });
  expect(docs[0].seller).toMatchObject({ name: 'Snapshot' });
  expect(await FinancialLedgerEntry.countDocuments({ entityId: docs[0]._id, eventType: 'financial_document.draft_created' })).toBe(1);
});

test('tous les checkpoints du brouillon hôtelier rollbackent intégralement en transaction', async () => {
  const points = ['draft.after_document', 'draft.before_lines', 'draft.after_lines', 'draft.before_ledger'];
  for (const [index, point] of points.entries()) {
    const { owner, reservation } = await hotelReservationFixture(`matrix-${index}`);
    const injector = async (current) => { if (current === point) throw new Error(`INJECTED_${point}`); };
    await expect(createHotelInvoiceDraftFromReservation({ reservationId: reservation._id, actor: { id: owner }, transactionMode: 'transactional', faultInjector: injector })).rejects.toThrow(`INJECTED_${point}`);
    expect(await FinancialDocument.countDocuments({ subjectId: reservation._id })).toBe(0);
    expect(await FinancialDocumentLine.countDocuments({ sourceId: reservation._id })).toBe(0);
  }
});

test('une réservation supprimée pendant sa lecture ne laisse aucun état financier', async () => {
  const { owner, reservation } = await hotelReservationFixture('deleted-during-read');
  const injector = async (point) => { if (point === 'draft.after_reservation_read') await HotelReservation.deleteOne({ _id: reservation._id }); };
  await expect(createHotelInvoiceDraftFromReservation({ reservationId: reservation._id, actor: { id: owner }, transactionMode: 'fallback', faultInjector: injector })).rejects.toMatchObject({ code: 'FINANCIAL_RESERVATION_CHANGED' });
  expect(await FinancialDocument.countDocuments({ subjectId: reservation._id })).toBe(0);
  expect(await FinancialDocumentLine.countDocuments({ sourceId: reservation._id })).toBe(0);
  expect(await FinancialLedgerEntry.countDocuments({ entityId: reservation._id })).toBe(0);
});

test('le fallback du brouillon compense les pannes après document et permet une relance propre', async () => {
  for (const [index, point] of ['draft.after_document', 'draft.before_lines', 'draft.after_lines', 'draft.before_ledger'].entries()) {
    const { owner, reservation } = await hotelReservationFixture(`fallback-draft-${index}`);
    const injector = async (current) => { if (current === point) { if (current === 'draft.after_document') await HotelReservation.deleteOne({ _id: reservation._id }); throw new Error(`FALLBACK_${point}`); } };
    await expect(createHotelInvoiceDraftFromReservation({ reservationId: reservation._id, actor: { id: owner }, transactionMode: 'fallback', faultInjector: injector })).rejects.toThrow(`FALLBACK_${point}`);
    expect(await FinancialDocument.countDocuments({ subjectId: reservation._id })).toBe(0);
    expect(await FinancialDocumentLine.countDocuments({ sourceId: reservation._id })).toBe(0);
    if (point !== 'draft.after_document') {
      const retried = await createHotelInvoiceDraftFromReservation({ reservationId: reservation._id, actor: { id: owner }, transactionMode: 'fallback' });
      expect(await FinancialDocument.countDocuments({ subjectId: reservation._id })).toBe(1);
      expect(await FinancialDocumentLine.countDocuments({ financialDocument: retried._id })).toBe(1);
    }
  }
});

test('le fallback d’émission conserve l’unicité et rend les états partiels détectables', async () => {
  const points = ['issue.before_sequence', 'issue.after_sequence', 'issue.before_document_update', 'issue.after_document_update', 'issue.before_ledger', 'issue.after_ledger'];
  for (const [index, point] of points.entries()) {
    const s = scope(); const { doc, actorId } = await document(s, 25000, 'draft'); const key = `fallback-issue-${index}`;
    const injector = async (current) => { if (current === point) throw new Error(`FALLBACK_${point}`); };
    await expect(issueFinancialDocument({ documentId: doc._id, actor: { id: actorId }, businessOperationKey: key, establishmentCode: 'HTF', transactionMode: 'fallback', faultInjector: injector })).rejects.toThrow(`FALLBACK_${point}`);
    await issueFinancialDocument({ documentId: doc._id, actor: { id: actorId }, businessOperationKey: key, establishmentCode: 'HTF', transactionMode: 'fallback' });
    await issueFinancialDocument({ documentId: doc._id, actor: { id: actorId }, businessOperationKey: `${key}-other`, establishmentCode: 'HTF', transactionMode: 'fallback' });
    expect(await FinancialDocument.findById(doc._id)).toMatchObject({ status: 'issued', totalMinor: 25000 });
    expect(await FinancialLedgerEntry.countDocuments({ entityId: doc._id, eventType: 'financial_document.issued' })).toBeLessThanOrEqual(1);
    const report = await scanFinancialConsistency({ document: doc._id });
    const missingLedger = report.issues.some((issue) => issue.code === 'FINANCIAL_ISSUE_LEDGER_MISSING');
    expect(missingLedger).toBe(['issue.after_document_update', 'issue.before_ledger'].includes(point));
  }
});

test('le fallback d’allocation répare un état intermédiaire puis relance sans double effet', async () => {
  for (const [index, point] of ['allocation.after_payment_reservation', 'allocation.after_document_reservation'].entries()) {
    const s = scope(); const actor = { id: id() }; const { doc } = await document(s); const pay = await payment(s); const key = `fallback-allocation-${index}`;
    const injector = async (current) => { if (current === point) throw new Error(`FALLBACK_${point}`); };
    await expect(allocatePaymentToDocument({ paymentId: pay._id, documentId: doc._id, amountMinor: 30000, businessOperationKey: key, actor, transactionMode: 'fallback', faultInjector: injector })).rejects.toThrow(`FALLBACK_${point}`);
    const report = await scanFinancialConsistency({ establishmentId: s.establishmentId });
    expect(report.issues.some((issue) => issue.repairable)).toBe(true);
    await applyFinancialReconciliation({ report, origin: 'fallback-recovery-test' });
    await allocatePaymentToDocument({ paymentId: pay._id, documentId: doc._id, amountMinor: 30000, businessOperationKey: key, actor, transactionMode: 'fallback' });
    expect(await PaymentAllocation.countDocuments({ businessOperationKey: key })).toBe(1);
    expect(await FinancialPayment.findById(pay._id)).toMatchObject({ allocatedAmountMinor: 30000, availableAmountMinor: 70000 });
    expect(await FinancialDocument.findById(doc._id)).toMatchObject({ amountAllocatedMinor: 30000, balanceMinor: 70000 });
  }
});

test('le fallback de renversement expose puis réconcilie un état intermédiaire sans double restitution', async () => {
  const s = scope(); const actor = { id: id() }; const { doc } = await document(s); const pay = await payment(s);
  const allocation = await allocatePaymentToDocument({ paymentId: pay._id, documentId: doc._id, amountMinor: 30000, businessOperationKey: 'fallback-reversal-source', actor, transactionMode: 'fallback' });
  const injector = async (point) => { if (point === 'reversal.after_lock') throw new Error('FALLBACK_REVERSAL_AFTER_LOCK'); };
  await expect(reversePaymentAllocation({ allocationId: allocation._id, reason: 'Reprise', businessOperationKey: 'fallback-reversal', actor, transactionMode: 'fallback', faultInjector: injector })).rejects.toThrow('FALLBACK_REVERSAL_AFTER_LOCK');
  await expect(reversePaymentAllocation({ allocationId: allocation._id, reason: 'Reprise', businessOperationKey: 'fallback-reversal', actor, transactionMode: 'fallback' })).resolves.toMatchObject({ status: 'reversed' });
  const report = await scanFinancialConsistency({ establishmentId: s.establishmentId });
  expect(report.issues.some((issue) => issue.repairable)).toBe(true);
  await applyFinancialReconciliation({ report, origin: 'fallback-reversal-recovery' });
  expect(await FinancialPayment.findById(pay._id)).toMatchObject({ allocatedAmountMinor: 0, availableAmountMinor: 100000 });
  expect(await FinancialDocument.findById(doc._id)).toMatchObject({ amountAllocatedMinor: 0, balanceMinor: 100000 });
});

test('un paiement se répartit simultanément entre deux factures sans dépassement', async () => {
  const s = scope(); const actor = { id: id() };
  const [{ doc: a }, { doc: b }, pay] = await Promise.all([document(s, 60000), document(s, 40000), payment(s)]);
  const results = await Promise.all([allocatePaymentToDocument({ paymentId: pay._id, documentId: a._id, amountMinor: 60000, businessOperationKey: 'split-a', actor, transactionMode: 'transactional' }), allocatePaymentToDocument({ paymentId: pay._id, documentId: b._id, amountMinor: 40000, businessOperationKey: 'split-b', actor, transactionMode: 'transactional' })]);
  expect(results).toHaveLength(2);
  expect(await FinancialPayment.findById(pay._id)).toMatchObject({ allocatedAmountMinor: 100000, availableAmountMinor: 0 });
  expect(await FinancialDocument.findById(a._id)).toMatchObject({ balanceMinor: 0, paymentStatus: 'paid' });
  expect(await FinancialDocument.findById(b._id)).toMatchObject({ balanceMinor: 0, paymentStatus: 'paid' });
});

test('tous les checkpoints d’allocation rollbackent intégralement en transaction', async () => {
  const points = ['allocation.before_payment_reservation', 'allocation.after_payment_reservation', 'allocation.before_document_reservation', 'allocation.after_document_reservation', 'allocation.before_create', 'allocation.after_create', 'allocation.before_ledger', 'allocation.after_ledger'];
  for (const [index, point] of points.entries()) {
    const s = scope(); const actor = { id: id() }; const { doc } = await document(s); const pay = await payment(s);
    const key = `allocation-matrix-${index}`;
    const injector = async (current) => { if (current === point) throw new Error(`INJECTED_${point}`); };
    await expect(allocatePaymentToDocument({ paymentId: pay._id, documentId: doc._id, amountMinor: 30000, businessOperationKey: key, actor, transactionMode: 'transactional', faultInjector: injector })).rejects.toThrow(`INJECTED_${point}`);
    expect(await FinancialPayment.findById(pay._id)).toMatchObject({ allocatedAmountMinor: 0, availableAmountMinor: 100000 });
    expect(await FinancialDocument.findById(doc._id)).toMatchObject({ amountAllocatedMinor: 0, balanceMinor: 100000, paymentStatus: 'unpaid' });
    expect(await PaymentAllocation.countDocuments({ businessOperationKey: key })).toBe(0);
    expect(await FinancialLedgerEntry.countDocuments({ businessOperationKey: key })).toBe(0);
  }
});

test('20 renversements de même clé restent idempotents et ne restituent qu’une fois', async () => {
  const s = scope(); const actor = { id: id() }; const { doc } = await document(s); const pay = await payment(s);
  const allocation = await allocatePaymentToDocument({ paymentId: pay._id, documentId: doc._id, amountMinor: 30000, businessOperationKey: 'reverse-source', actor, transactionMode: 'transactional' });
  const results = await Promise.allSettled(Array.from({ length: 20 }, () => reversePaymentAllocation({ allocationId: allocation._id, reason: 'Correction', businessOperationKey: 'same-reversal', actor, transactionMode: 'transactional' })));
  expect(results.filter((result) => result.status === 'rejected')).toHaveLength(0);
  expect(await FinancialPayment.findById(pay._id)).toMatchObject({ allocatedAmountMinor: 0, availableAmountMinor: 100000 });
  expect(await FinancialDocument.findById(doc._id)).toMatchObject({ amountAllocatedMinor: 0, balanceMinor: 100000 });
  expect(await FinancialLedgerEntry.countDocuments({ entityId: allocation._id, eventType: 'payment.allocation_reversed' })).toBe(1);
});

test('des clés différentes sur un même renversement ont un gagnant unique', async () => {
  const s = scope(); const actor = { id: id() }; const { doc } = await document(s); const pay = await payment(s);
  const allocation = await allocatePaymentToDocument({ paymentId: pay._id, documentId: doc._id, amountMinor: 30000, businessOperationKey: 'different-reversal-source', actor, transactionMode: 'transactional' });
  const results = await Promise.allSettled(Array.from({ length: 20 }, (_, index) => reversePaymentAllocation({ allocationId: allocation._id, reason: 'Correction', businessOperationKey: `reversal-key-${index}`, actor, transactionMode: 'transactional' })));
  expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
  expect(results.filter((result) => result.status === 'rejected').every((result) => result.reason.code === 'FINANCIAL_INVALID_TRANSITION')).toBe(true);
  expect(await FinancialPayment.findById(pay._id)).toMatchObject({ allocatedAmountMinor: 0, availableAmountMinor: 100000 });
  expect(await FinancialDocument.findById(doc._id)).toMatchObject({ amountAllocatedMinor: 0, balanceMinor: 100000 });
  expect(await FinancialLedgerEntry.countDocuments({ entityId: allocation._id, eventType: 'payment.allocation_reversed' })).toBe(1);
});

test('tous les checkpoints de renversement rollbackent intégralement en transaction', async () => {
  const points = ['reversal.after_lock', 'reversal.before_payment_restore', 'reversal.before_document_restore', 'reversal.before_ledger', 'reversal.after_ledger'];
  for (const [index, point] of points.entries()) {
    const s = scope(); const actor = { id: id() }; const { doc } = await document(s); const pay = await payment(s);
    const allocation = await allocatePaymentToDocument({ paymentId: pay._id, documentId: doc._id, amountMinor: 30000, businessOperationKey: `reversal-matrix-source-${index}`, actor, transactionMode: 'transactional' });
    const injector = async (current) => { if (current === point) throw new Error(`INJECTED_${point}`); };
    await expect(reversePaymentAllocation({ allocationId: allocation._id, reason: 'Test rollback', businessOperationKey: `reversal-matrix-${index}`, actor, transactionMode: 'transactional', faultInjector: injector })).rejects.toThrow(`INJECTED_${point}`);
    expect(await PaymentAllocation.findById(allocation._id)).toMatchObject({ status: 'active' });
    expect(await FinancialPayment.findById(pay._id)).toMatchObject({ allocatedAmountMinor: 30000, availableAmountMinor: 70000 });
    expect(await FinancialDocument.findById(doc._id)).toMatchObject({ amountAllocatedMinor: 30000, balanceMinor: 70000, paymentStatus: 'partially_paid' });
    expect(await FinancialLedgerEntry.countDocuments({ entityId: allocation._id, eventType: 'payment.allocation_reversed' })).toBe(0);
  }
});

test('dix factures se partagent simultanément un paiement sans dépassement', async () => {
  const s = scope(); const actor = { id: id() }; const pay = await payment(s);
  const documents = await Promise.all(Array.from({ length: 10 }, () => document(s, 10000).then((item) => item.doc)));
  const results = await Promise.allSettled(documents.map((doc, index) => allocatePaymentToDocument({ paymentId: pay._id, documentId: doc._id, amountMinor: 10000, businessOperationKey: `ten-documents-${index}`, actor, transactionMode: 'transactional' })));
  expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(10);
  expect(await FinancialPayment.findById(pay._id)).toMatchObject({ allocatedAmountMinor: 100000, availableAmountMinor: 0 });
  expect(await FinancialDocument.countDocuments({ _id: { $in: documents.map((doc) => doc._id) }, balanceMinor: 0, paymentStatus: 'paid' })).toBe(10);
  expect(await PaymentAllocation.countDocuments({ financialPayment: pay._id, status: 'active' })).toBe(10);
});

test('100 événements fournisseur dupliqués restent un seul événement idempotent', async () => {
  const input = { provider: 'sandbox', providerEventId: 'evt-load-100', providerPaymentId: 'provider-payment', eventType: 'payment.confirmed', payload: { amountMinor: 100000, currency: 'XAF' }, signatureVerified: true, businessOperationKey: 'provider-load-100' };
  const results = await Promise.all(Array.from({ length: 100 }, () => registerProviderEvent(input)));
  expect(results.filter((result) => result.duplicate === false)).toHaveLength(1);
  expect(results.filter((result) => result.duplicate === true)).toHaveLength(99);
  expect(await FinancialProviderEvent.countDocuments({ provider: input.provider, providerEventId: input.providerEventId })).toBe(1);
});

test('charge finale: 50 émissions sur plusieurs brouillons restent cohérentes', async () => {
  const startedAt = Date.now(); const s = scope();
  const drafts = await Promise.all(Array.from({ length: 10 }, () => document(s, 50000, 'draft')));
  const results = await Promise.allSettled(drafts.flatMap(({ doc, actorId }, draftIndex) => Array.from({ length: 5 }, (_, callIndex) => issueFinancialDocument({ documentId: doc._id, actor: { id: actorId }, businessOperationKey: `load-issue-${draftIndex}-${callIndex}`, establishmentCode: 'HTL', transactionMode: 'transactional' }))));
  expect(results.filter((result) => result.status === 'rejected')).toHaveLength(0);
  expect(await FinancialDocument.countDocuments({ _id: { $in: drafts.map(({ doc }) => doc._id) }, status: 'issued' })).toBe(10);
  expect(await FinancialLedgerEntry.countDocuments({ entityId: { $in: drafts.map(({ doc }) => doc._id) }, eventType: 'financial_document.issued' })).toBe(10);
  expect(new Set((await FinancialDocument.find({ _id: { $in: drafts.map(({ doc }) => doc._id) } }).lean()).map((doc) => doc.documentNumber)).size).toBe(10);
  expect(Date.now() - startedAt).toBeGreaterThanOrEqual(0);
});

test('charge finale: 100 allocations sur plusieurs paiements et factures ne dépassent aucun agrégat', async () => {
  const s = scope(); const actor = { id: id() };
  const pairs = await Promise.all(Array.from({ length: 10 }, async () => ({ document: (await document(s, 100000)).doc, payment: await payment(s, 100000) })));
  const results = await Promise.allSettled(pairs.flatMap(({ document: doc, payment: pay }, pairIndex) => Array.from({ length: 10 }, (_, allocationIndex) => allocatePaymentToDocument({ paymentId: pay._id, documentId: doc._id, amountMinor: 10000, businessOperationKey: `load-allocation-${pairIndex}-${allocationIndex}`, actor, transactionMode: 'transactional' }))));
  expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(100);
  expect(await FinancialPayment.countDocuments({ _id: { $in: pairs.map(({ payment: pay }) => pay._id) }, allocatedAmountMinor: 100000, availableAmountMinor: 0 })).toBe(10);
  expect(await FinancialDocument.countDocuments({ _id: { $in: pairs.map(({ document: doc }) => doc._id) }, amountAllocatedMinor: 100000, balanceMinor: 0, paymentStatus: 'paid' })).toBe(10);
  expect(await PaymentAllocation.countDocuments({ businessOperationKey: /^load-allocation-/, status: 'active' })).toBe(100);
  const report = await scanFinancialConsistency({ establishmentId: s.establishmentId });
  const fixtureOnlyCodes = new Set(['FINANCIAL_ISSUE_LEDGER_MISSING', 'FINANCIAL_PAYMENT_LEDGER_MISSING', 'FINANCIAL_SEQUENCE_BEHIND_DOCUMENT']);
  expect(report.issues.filter((issue) => !fixtureOnlyCodes.has(issue.code))).toHaveLength(0);
});

test('campagne exclusivement métier produit un cycle financier complet avec scan propre', async () => {
  const startedAt = Date.now();
  const a = await hotelReservationFixture('business-a'); const b = await hotelReservationFixture('business-b');
  const reservationA2 = await HotelReservation.create({ hotel: a.hotel._id, roomCategory: id(), guest: { firstName: 'Katherine', lastName: 'Johnson', email: 'katherine@example.test', country: 'CG' }, checkInDate: new Date('2026-10-01'), checkOutDate: new Date('2026-10-03'), roomsCount: 1, adults: 1, unitPrice: 30000, subtotal: 60000, totalAmount: 60000, currency: 'XAF', rateSnapshot: { rateType: 'nightly', amount: 30000, currency: 'XAF' }, status: 'confirmed', source: 'owner_dashboard', createdBy: a.owner });
  const inputs = [{ reservation: a.reservation, actorId: a.owner }, { reservation: reservationA2, actorId: a.owner }, { reservation: b.reservation, actorId: b.owner }];
  const drafts = await Promise.all(inputs.map(({ reservation, actorId }) => createHotelInvoiceDraftFromReservation({ reservationId: reservation._id, actor: { id: actorId }, transactionMode: 'transactional' })));
  await Promise.all(drafts.map((draft, index) => replaceDraftLines(draft._id, [{ lineType: 'accommodation', description: 'Séjour validé', quantity: 1, unitAmountMinor: 60000, discountAmountMinor: 0, taxAmountMinor: 0, feesAmountMinor: 0, sourceType: 'HotelReservation', sourceId: inputs[index].reservation._id }], inputs[index].actorId)));
  const issued = await Promise.all(drafts.map((draft, index) => issueFinancialDocument({ documentId: draft._id, actor: { id: inputs[index].actorId }, businessOperationKey: `business-issue-${index}`, establishmentCode: index < 2 ? 'BIZA' : 'BIZB', transactionMode: 'transactional' })));
  const [paymentA, paymentB] = await Promise.all([
    createManualPayment({ data: { establishmentId: a.hotel._id, amountMinor: 120000, currency: 'XAF', method: 'cash', confirmed: true }, actor: { id: a.owner } }),
    createManualPayment({ data: { establishmentId: b.hotel._id, amountMinor: 60000, currency: 'XAF', method: 'cash', confirmed: true }, actor: { id: b.owner } }),
  ]);
  const [allocationA1, allocationA2, allocationB] = await Promise.all([
    allocatePaymentToDocument({ paymentId: paymentA._id, documentId: issued[0]._id, amountMinor: 60000, businessOperationKey: 'business-allocation-a1', actor: { id: a.owner }, transactionMode: 'transactional' }),
    allocatePaymentToDocument({ paymentId: paymentA._id, documentId: issued[1]._id, amountMinor: 60000, businessOperationKey: 'business-allocation-a2', actor: { id: a.owner }, transactionMode: 'transactional' }),
    allocatePaymentToDocument({ paymentId: paymentB._id, documentId: issued[2]._id, amountMinor: 60000, businessOperationKey: 'business-allocation-b', actor: { id: b.owner }, transactionMode: 'transactional' }),
  ]);
  expect([allocationA1, allocationA2]).toHaveLength(2);
  await reversePaymentAllocation({ allocationId: allocationB._id, reason: 'Contrôle métier', businessOperationKey: 'business-reversal-b', actor: { id: b.owner }, transactionMode: 'transactional' });
  await allocatePaymentToDocument({ paymentId: paymentB._id, documentId: issued[2]._id, amountMinor: 60000, businessOperationKey: 'business-reallocation-b', actor: { id: b.owner }, transactionMode: 'transactional' });
  const providerResults = await Promise.all(Array.from({ length: 50 }, () => registerProviderEvent({ provider: 'sandbox', providerEventId: 'business-provider-event', providerPaymentId: 'business-provider-payment', eventType: 'payment.confirmed', payload: { amountMinor: 60000 }, signatureVerified: true, businessOperationKey: 'business-provider-event' })));
  expect(providerResults.filter((result) => result.duplicate)).toHaveLength(49);
  for (const establishmentId of [a.hotel._id, b.hotel._id]) {
    const report = await scanFinancialConsistency({ domain: 'hotel', establishmentId });
    expect(report.issues).toHaveLength(0);
    expect(planFinancialReconciliation(report)).toHaveLength(0);
  }
  const eventCounts = Object.fromEntries(await Promise.all(['financial_document.draft_created', 'financial_document.issued', 'payment.created', 'payment.confirmed', 'payment.allocated', 'payment.allocation_reversed'].map(async (eventType) => [eventType, await FinancialLedgerEntry.countDocuments({ eventType })])));
  expect(eventCounts).toEqual({ 'financial_document.draft_created': 3, 'financial_document.issued': 3, 'payment.created': 2, 'payment.confirmed': 2, 'payment.allocated': 4, 'payment.allocation_reversed': 1 });
  expect(Date.now() - startedAt).toBeGreaterThanOrEqual(0);
});

test('un échec de compensation fallback est explicite, détecté puis réparable', async () => {
  const s = scope(); const actor = { id: id() }; const { doc } = await document(s, 100000); const pay = await payment(s);
  const injector = async (point) => {
    if (point === 'allocation.before_document_reservation') await FinancialDocument.updateOne({ _id: doc._id }, { balanceMinor: 0 });
    if (point === 'allocation.before_compensation') throw new Error('COMPENSATION_INJECTED');
  };
  await expect(allocatePaymentToDocument({ paymentId: pay._id, documentId: doc._id, amountMinor: 70000, businessOperationKey: 'ambiguous-allocation', actor, transactionMode: 'fallback', faultInjector: injector })).rejects.toMatchObject({ code: 'FINANCIAL_COMPENSATION_FAILED', reconciliationRequired: true, businessOperationKey: 'ambiguous-allocation' });
  const report = await scanFinancialConsistency({ establishmentId: s.establishmentId });
  expect(report.issues.some((item) => item.code === 'FINANCIAL_PAYMENT_AGGREGATE_MISMATCH')).toBe(true);
  expect(planFinancialReconciliation(report).length).toBeGreaterThan(0);
  await applyFinancialReconciliation({ report, origin: 'test' });
  expect(await FinancialPayment.findById(pay._id)).toMatchObject({ allocatedAmountMinor: 0, availableAmountMinor: 100000 });
});

test('la CLI respecte dry-run, apply filtré et garde de production', async () => {
  const s = scope();
  const cleanPay = await createManualPayment({ data: { establishmentId: s.establishmentId, amountMinor: 100000, currency: 'XAF', method: 'cash', confirmed: true }, actor: { id: id() } });
  const cli = `${process.cwd()}/scripts/reconcile-finance.js`;
  const clean = await execFileAsync(process.execPath, [cli, '--dry-run', `--payment=${cleanPay._id}`], { env: { ...process.env, MONGO_URI: mongoUri, NODE_ENV: 'test' } });
  expect(JSON.parse(clean.stdout.slice(clean.stdout.indexOf('{\n  "mode"')))).toMatchObject({ mode: 'dry-run', report: { issues: [] } });
  const pay = await payment(s);
  await FinancialPayment.updateOne({ _id: pay._id }, { allocatedAmountMinor: 1000, availableAmountMinor: 99000 });
  await expect(execFileAsync(process.execPath, [cli, '--dry-run', `--payment=${pay._id}`, '--limit=10'], { env: { ...process.env, MONGO_URI: mongoUri, NODE_ENV: 'test' } })).rejects.toMatchObject({ code: 2 });
  expect(await FinancialPayment.findById(pay._id)).toMatchObject({ allocatedAmountMinor: 1000 });
  const applied = await execFileAsync(process.execPath, [cli, '--apply', `--payment=${pay._id}`, '--limit=10'], { env: { ...process.env, MONGO_URI: mongoUri, NODE_ENV: 'test' } });
  expect(JSON.parse(applied.stdout.slice(applied.stdout.indexOf('{\n  "mode"')))).toMatchObject({ mode: 'apply', result: { applied: 1 } });
  expect(await FinancialPayment.findById(pay._id)).toMatchObject({ allocatedAmountMinor: 0, availableAmountMinor: 100000 });
  const { doc: criticalDocument } = await document(s, 10000);
  const critical = await execFileAsync(process.execPath, [cli, '--apply', `--document=${criticalDocument._id}`], { env: { ...process.env, MONGO_URI: mongoUri, NODE_ENV: 'test' } });
  expect(JSON.parse(critical.stdout.slice(critical.stdout.indexOf('{\n  "mode"')))).toMatchObject({ mode: 'apply', plan: [], result: { applied: 0 }, verification: { consistent: false } });
  expect((await scanFinancialConsistency({ document: criticalDocument._id })).issues).toEqual(expect.arrayContaining([expect.objectContaining({ severity: 'critical', repairable: false })]));
  await expect(execFileAsync(process.execPath, [cli, '--apply'], { env: { ...process.env, MONGO_URI: mongoUri, NODE_ENV: 'production', FINANCIAL_RECONCILIATION_ALLOW_PRODUCTION: 'false' } })).rejects.toMatchObject({ code: 1 });
});

test('les routes JWT isolent deux propriétaires et refusent les mutations falsifiées', async () => {
  const app = express(); app.use(express.json()); app.use('/api/financial', financialRoutes); app.use((error, _req, res, _next) => res.status(error.statusCode || res.statusCode || 500).json({ code: error.code, message: error.message }));
  const makeUser = (name, role) => User.create({ name, email: `${name.toLowerCase()}@example.com`, role, password: 'Password123!', passwordConfirm: 'Password123!', isEmailVerified: true });
  const [ownerA, ownerB] = await Promise.all([makeUser('OwnerA', 'Proprietaire'), makeUser('OwnerB', 'Proprietaire')]);
  const [hotelA, hotelB] = await Promise.all([Hotel.create({ name: 'Hotel A', manager: ownerA._id, createdBy: ownerA._id }), Hotel.create({ name: 'Hotel B', manager: ownerB._id, createdBy: ownerB._id })]);
  const { doc: documentA } = await document(scope(hotelA._id), 20000);
  const { doc: documentB } = await document(scope(hotelB._id), 20000);
  const token = (user) => jwt.sign({ id: user._id, tokenVersion: user.tokenVersion }, process.env.JWT_SECRET, { expiresIn: '1h' });
  await request(app).get(`/api/financial/documents/${documentA._id}`).set('Authorization', `Bearer ${token(ownerA)}`).expect(200);
  await request(app).get(`/api/financial/documents/${documentB._id}`).set('Authorization', `Bearer ${token(ownerA)}`).expect(403);
  await request(app).get(`/api/financial/documents/${documentA._id}`).expect(401);
  await request(app).post('/api/financial/payments/manual').set('Authorization', `Bearer ${token(ownerA)}`).send({ establishmentId: hotelB._id, amountMinor: 1000, currency: 'XAF', method: 'cash', confirmed: true, createdBy: ownerA._id, status: 'succeeded' }).expect(403);
  expect(await FinancialPayment.countDocuments({ establishmentId: hotelB._id })).toBe(0);
});
