const mongoose = require('mongoose');
const FinancialPaymentReceipt = require('../models/FinancialPaymentReceipt');
const { assertProofFile } = require('../services/finance/manualPaymentProofService');
const { renderReceiptPdf } = require('../services/finance/manualPaymentReceiptRenderer');

describe('PAY-6.1 — contrats preuve et reçu', () => {
  test.each([
    ['image/jpeg', Buffer.from([0xff, 0xd8, 0xff, 0x00])],
    ['image/png', Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])],
    ['application/pdf', Buffer.from('%PDF-1.7')],
  ])('accepte un vrai contenu %s', (mimetype, buffer) => expect(() => assertProofFile({ mimetype, buffer })).not.toThrow());
  test('refuse un MIME mensonger', () => expect(() => assertProofFile({ mimetype: 'application/pdf', buffer: Buffer.from('not a pdf') })).toThrow(expect.objectContaining({ code: 'FINANCIAL_PROOF_CONTENT_INVALID' })));
  test('le reçu est un PDF distinct portant les montants exacts', async () => {
    const buffer = await renderReceiptPdf({ receiptNumber: 'REC-HOTEL-2026-000001', paymentReference: 'VIR-42', amountMinor: 40000, currency: 'XAF', method: 'bank_transfer', generatedAt: '2026-08-21T00:00:00.000Z', allocations: [{ financialDocument: 'x', documentNumber: 'FAC-1', amountMinor: 30000 }, { financialDocument: 'y', documentNumber: 'FAC-2', amountMinor: 10000 }] });
    expect(buffer.subarray(0, 4).toString()).toBe('%PDF');
    expect(buffer.length).toBeGreaterThan(500);
  });
  test('le reçu est un artefact unique par paiement et immuable', async () => {
    const indexes = FinancialPaymentReceipt.schema.indexes().filter(([, options]) => options.unique).map(([keys]) => keys);
    expect(indexes).toContainEqual({ financialPayment: 1 }); expect(indexes).toContainEqual({ receiptNumber: 1 });
    await expect(FinancialPaymentReceipt.updateOne({ _id: new mongoose.Types.ObjectId() }, {})).rejects.toThrow('FINANCIAL_PAYMENT_RECEIPT_IMMUTABLE');
    await expect(FinancialPaymentReceipt.deleteOne({ _id: new mongoose.Types.ObjectId() })).rejects.toThrow('FINANCIAL_PAYMENT_RECEIPT_IMMUTABLE');
  });
});
