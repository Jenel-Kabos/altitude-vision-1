const FinancialPayment = require('../../models/FinancialPayment');
const { fail } = require('./financialError');
const storage = require('../storage/secureStorageService');

function assertProofFile(file) {
  if (!file?.buffer?.length) fail('FINANCIAL_PROOF_REQUIRED', 'Un justificatif est obligatoire.');
  const b = file.buffer; const mime = file.mimetype;
  const valid = (mime === 'image/jpeg' && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff)
    || (mime === 'image/png' && b.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])))
    || (mime === 'application/pdf' && b.subarray(0, 5).toString() === '%PDF-');
  if (!valid) fail('FINANCIAL_PROOF_CONTENT_INVALID', 'Le contenu du justificatif ne correspond pas à son format.', 400);
}
async function uploadManualPaymentProof({ paymentId, actor, file, storageService = storage }) {
  assertProofFile(file);
  const payment = await FinancialPayment.findById(paymentId).select('+proof.asset');
  if (!payment || payment.domain !== 'hotel' || payment.provider !== 'manual') fail('FINANCIAL_PAYMENT_NOT_AVAILABLE', 'Paiement manuel introuvable.', 404);
  if (payment.status !== 'pending') fail('FINANCIAL_PAYMENT_INVALID_TRANSITION', 'Le justificatif ne peut être remplacé que tant que le paiement est en attente.', 409);
  const asset = await storageService.uploadPrivateAsset(file.buffer, { purpose: 'financial', ownerType: 'FinancialPayment', ownerId: payment._id, filename: file.originalname, mimeType: file.mimetype, folder: 'altitude-vision/private/payment-proofs' });
  const previous = payment.proof?.asset?.toObject?.() || payment.proof?.asset;
  const updated = await FinancialPayment.findOneAndUpdate({ _id: payment._id, status: 'pending', provider: 'manual' }, { $set: { 'proof.asset': asset, 'proof.uploadedBy': actor.id || actor._id, 'proof.uploadedAt': new Date() } }, { new: true }).select('+proof.asset');
  if (!updated) { await storageService.deletePrivateAsset(asset).catch(() => {}); fail('FINANCIAL_PAYMENT_INVALID_TRANSITION', 'Le paiement a changé pendant l’envoi du justificatif.', 409); }
  if (previous) await storageService.deletePrivateAsset(previous).catch(() => {});
  return updated;
}
async function readManualPaymentProof(paymentId, storageService = storage) {
  const payment = await FinancialPayment.findById(paymentId).select('+proof.asset');
  if (!payment?.proof?.asset) fail('FINANCIAL_PROOF_NOT_AVAILABLE', 'Aucun justificatif disponible.', 404);
  return { payment, asset: payment.proof.asset, buffer: await storageService.readPrivateAsset(payment.proof.asset.toObject()) };
}
module.exports = { assertProofFile, uploadManualPaymentProof, readManualPaymentProof };
