// F-U2.0 — références de stockage des preuves et reçus de paiement manuel
// hôtelier (vrai replica set, fichiers fictifs, stockage instrumenté).
// Défaut F-U1.J : `select('+proof.asset')` ne charge pas les champs imbriqués
// `select:false` (publicId, resourceType…) de privateAssetSchema.
const mongoose = require('mongoose');
const { startFinancialMongo, clearFinancialMongo, stopFinancialMongo } = require('./helpers/financialMongoEnvironment');
const FinancialPayment = require('../models/FinancialPayment');
const FinancialPaymentReceipt = require('../models/FinancialPaymentReceipt');
const { uploadManualPaymentProof, readManualPaymentProof } = require('../services/finance/manualPaymentProofService');
const { readPaymentReceipt } = require('../services/finance/manualPaymentReceiptService');

jest.setTimeout(120000);
const oid = () => new mongoose.Types.ObjectId();
const png = (seed) => ({ buffer: Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), Buffer.from(`fictif-${seed}`)]), mimetype: 'image/png', originalname: `preuve-${seed}.png` });

function instrumentedStorage() {
  const calls = { read: [], delete: [] };
  let n = 0;
  return {
    calls,
    uploadPrivateAsset: async (_buffer, { purpose, mimeType }) => {
      n += 1;
      return { assetClass: 'PRIVATE_DOCUMENT', purpose, provider: 'cloudinary', publicId: `altitude-vision/private/payment-proofs/fictif-${n}`, resourceType: 'image', deliveryType: 'authenticated', version: '1', format: 'png', mimeType, originalFilename: 'x', size: 10 };
    },
    readPrivateAsset: async (asset) => { calls.read.push(asset); if (!asset?.publicId) throw new Error('PRIVATE_ASSET_REFERENCE_INVALID'); return Buffer.from('contenu-fictif'); },
    deletePrivateAsset: async (asset) => { calls.delete.push(asset); if (!asset?.publicId) throw new Error('PRIVATE_ASSET_REFERENCE_INVALID'); return { result: 'ok' }; },
  };
}

beforeAll(startFinancialMongo); afterAll(stopFinancialMongo); beforeEach(clearFinancialMongo);

const pendingPayment = () => FinancialPayment.create({
  tenant: oid(), domain: 'hotel', establishmentType: 'Hotel', establishmentId: oid(), paymentReference: `P-${oid()}`, status: 'pending', method: 'cash', provider: 'manual',
  currency: 'XAF', amountMinor: 50000, availableAmountMinor: 50000, createdBy: oid(),
});

test('lecture d’une preuve : la référence complète est transmise au stockage', async () => {
  const storage = instrumentedStorage();
  const payment = await pendingPayment();
  await uploadManualPaymentProof({ paymentId: payment._id, actor: { _id: oid() }, file: png('a'), storageService: storage });
  const result = await readManualPaymentProof(payment._id, storage);
  expect(result.buffer.toString()).toBe('contenu-fictif');
  expect(storage.calls.read[0]).toMatchObject({ publicId: 'altitude-vision/private/payment-proofs/fictif-1', resourceType: 'image', deliveryType: 'authenticated' });
});

test('remplacement d’une preuve : l’ancien objet est réellement supprimé (pas d’orphelin)', async () => {
  const storage = instrumentedStorage();
  const payment = await pendingPayment();
  await uploadManualPaymentProof({ paymentId: payment._id, actor: { _id: oid() }, file: png('a'), storageService: storage });
  await uploadManualPaymentProof({ paymentId: payment._id, actor: { _id: oid() }, file: png('b'), storageService: storage });
  expect(storage.calls.delete).toEqual([expect.objectContaining({ publicId: 'altitude-vision/private/payment-proofs/fictif-1' })]);
  const raw = await FinancialPayment.collection.findOne({ _id: payment._id });
  expect(raw.proof.asset.publicId).toBe('altitude-vision/private/payment-proofs/fictif-2');
});

test('réponse publique : aucune référence privée exposée', async () => {
  const storage = instrumentedStorage();
  const payment = await pendingPayment();
  const updated = await uploadManualPaymentProof({ paymentId: payment._id, actor: { _id: oid() }, file: png('a'), storageService: storage });
  const plain = (await FinancialPayment.findById(updated._id)).toJSON();
  expect(JSON.stringify(plain)).not.toContain('altitude-vision/private');
});

test('lecture d’un reçu : la référence complète est transmise au stockage', async () => {
  const storage = instrumentedStorage();
  const paymentId = oid();
  await FinancialPaymentReceipt.create({
    financialPayment: paymentId, domain: 'hotel', establishmentType: 'Hotel', establishmentId: oid(), receiptNumber: `REC-${oid()}`, currency: 'XAF',
    amountMinor: 50000, method: 'cash', paymentReference: 'P-1', hash: 'h', generatedAt: new Date(), generatedBy: oid(),
    asset: { assetClass: 'PRIVATE_DOCUMENT', purpose: 'financial', provider: 'cloudinary', publicId: 'altitude-vision/private/payment-receipts/fictif', resourceType: 'raw', deliveryType: 'authenticated', version: '1', format: 'pdf', mimeType: 'application/pdf' },
  });
  await readPaymentReceipt(paymentId, storage);
  expect(storage.calls.read[0]).toMatchObject({ publicId: 'altitude-vision/private/payment-receipts/fictif', resourceType: 'raw' });
});
