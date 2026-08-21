const FinancialPayment = require('../../models/FinancialPayment');
const FinancialPaymentReceipt = require('../../models/FinancialPaymentReceipt');
const PaymentAllocation = require('../../models/PaymentAllocation');
const FinancialDocument = require('../../models/FinancialDocument');
const { getNextFinancialDocumentNumber } = require('./financialSequenceService');
const { appendFinancialLedgerEntry } = require('./financialLedgerService');
const { fail } = require('./financialError');
const renderer = require('./manualPaymentReceiptRenderer');
const storage = require('../storage/secureStorageService');

const publicReceipt = (r) => ({ id: r._id, financialPayment: r.financialPayment, receiptNumber: r.receiptNumber, currency: r.currency, amountMinor: r.amountMinor, method: r.method, paymentReference: r.paymentReference, allocations: r.allocations, hash: r.hash, generatedAt: r.generatedAt, generatedBy: r.generatedBy });
async function generatePaymentReceipt({ paymentId, actor, storageService = storage, render = renderer.renderReceiptPdf }) {
  const existing = await FinancialPaymentReceipt.findOne({ financialPayment: paymentId });
  if (existing) return { receipt: publicReceipt(existing), generated: false };
  const payment = await FinancialPayment.findById(paymentId);
  if (!payment || payment.domain !== 'hotel') fail('FINANCIAL_PAYMENT_NOT_AVAILABLE', 'Paiement hôtelier introuvable.', 404);
  if (payment.status !== 'succeeded') fail('FINANCIAL_RECEIPT_PAYMENT_NOT_CONFIRMED', 'Un reçu exige un paiement confirmé.', 409);
  const allocations = await PaymentAllocation.find({ financialPayment: payment._id, status: 'active' }).sort('allocatedAt').lean();
  if (!allocations.length) fail('FINANCIAL_RECEIPT_ALLOCATION_REQUIRED', 'Le paiement doit être affecté avant génération du reçu.', 409);
  const documents = await FinancialDocument.find({ _id: { $in: allocations.map((a) => a.financialDocument) }, establishmentId: payment.establishmentId }).select('documentNumber').lean();
  const numbers = new Map(documents.map((d) => [String(d._id), d.documentNumber]));
  const generatedAt = new Date(); const actorId = actor.id || actor._id;
  const { formattedNumber } = await getNextFinancialDocumentNumber({ domain: payment.domain, establishmentType: payment.establishmentType, establishmentId: payment.establishmentId, documentType: 'receipt', establishmentCode: String(payment.establishmentId).slice(-6) });
  const snapshot = { receiptNumber: formattedNumber, paymentId: String(payment._id), paymentReference: payment.paymentReference, amountMinor: payment.amountMinor, currency: payment.currency, method: payment.method, generatedAt: generatedAt.toISOString(), allocations: allocations.map((a) => ({ financialDocument: String(a.financialDocument), documentNumber: numbers.get(String(a.financialDocument)) || '', amountMinor: a.amountMinor })) };
  const buffer = await render(snapshot); const hash = renderer.sha256(buffer);
  const asset = await storageService.uploadPrivateAsset(buffer, { purpose: 'financial', ownerType: 'FinancialPaymentReceipt', ownerId: payment._id, filename: renderer.safeFilename(formattedNumber), mimeType: 'application/pdf', folder: 'altitude-vision/private/payment-receipts' });
  let receipt;
  try { receipt = await FinancialPaymentReceipt.create({ tenant: payment.tenant, financialPayment: payment._id, domain: payment.domain, establishmentType: payment.establishmentType, establishmentId: payment.establishmentId, receiptNumber: formattedNumber, currency: payment.currency, amountMinor: payment.amountMinor, method: payment.method, paymentReference: payment.paymentReference, allocations: snapshot.allocations, asset, hash, generatedAt, generatedBy: actorId }); }
  catch (error) { await storageService.deletePrivateAsset(asset).catch(() => {}); if (error.code === 11000) return { receipt: publicReceipt(await FinancialPaymentReceipt.findOne({ financialPayment: paymentId })), generated: false }; throw error; }
  await appendFinancialLedgerEntry({ eventType: 'payment.receipt_generated', domain: payment.domain, establishmentType: payment.establishmentType, establishmentId: payment.establishmentId, entityType: 'FinancialPaymentReceipt', entityId: receipt._id, relatedEntities: [{ entityType: 'FinancialPayment', entityId: payment._id }, ...allocations.map((a) => ({ entityType: 'FinancialDocument', entityId: a.financialDocument }))], actorType: 'user', actorId, amountMinor: payment.amountMinor, currency: payment.currency, businessOperationKey: `payment:${payment._id}:receipt`, newState: { receiptNumber: formattedNumber, hash } });
  return { receipt: publicReceipt(receipt), generated: true };
}
async function readPaymentReceipt(paymentId, storageService = storage) { const receipt = await FinancialPaymentReceipt.findOne({ financialPayment: paymentId }).select('+asset'); if (!receipt) fail('FINANCIAL_RECEIPT_NOT_AVAILABLE', 'Aucun reçu disponible.', 404); return { receipt, buffer: await storageService.readPrivateAsset(receipt.asset.toObject()) }; }
module.exports = { generatePaymentReceipt, readPaymentReceipt, publicReceipt };
