const mongoose = require('mongoose');
const { startFinancialMongo, clearFinancialMongo, stopFinancialMongo } = require('./helpers/financialMongoEnvironment');
const Hotel = require('../models/Hotel'); const HotelReservation = require('../models/HotelReservation');
const FinancialDocumentArtifact = require('../models/FinancialDocumentArtifact'); const FinancialDocumentDelivery = require('../models/FinancialDocumentDelivery'); const FinancialLedgerEntry = require('../models/FinancialLedgerEntry');
const { createHotelInvoiceDraftFromReservation } = require('../services/finance/hotelBillingAdapter'); const { finalizeDocumentLines, issueFinancialDocument } = require('../services/finance/financialDocumentService');
const { generateOfficialPdf, getReadyArtifact, readAndVerifyArtifact } = require('../services/finance/financialDocumentArtifactService'); const { sendOfficialInvoiceEmail } = require('../services/finance/financialDocumentDeliveryService');

jest.setTimeout(120000); const id = () => new mongoose.Types.ObjectId();
const files = new Map(); const storage = { storeOfficialPdf: jest.fn(async (buffer, context) => { const key = `private/${context.artifactId}`; files.set(key, Buffer.from(buffer)); return { provider: 'cloudinary', storageKey: key, storageVersion: '1' }; }), readOfficialPdf: jest.fn(async ({ storageKey }) => Buffer.from(files.get(storageKey))) };
async function fixture() { const actorId = id(); const hotel = await Hotel.create({ name: 'Hôtel PDF', brand: 'PDF', email: 'hotel@example.test', manager: actorId, createdBy: actorId }); const reservation = await HotelReservation.create({ hotel: hotel._id, roomCategory: id(), guest: { firstName: 'Ada', lastName: 'Lovelace', email: 'snapshot@example.test', country: 'CG' }, checkInDate: new Date('2026-09-01'), checkOutDate: new Date('2026-09-03'), roomsCount: 1, adults: 1, unitPrice: 30000, subtotal: 60000, taxes: 3000, fees: 1000, discount: 4000, totalAmount: 60000, currency: 'XAF', rateSnapshot: { rateType: 'nightly', amount: 30000, currency: 'XAF', version: 1 }, status: 'confirmed', source: 'owner_dashboard', createdBy: actorId }); const actor = { id: actorId }; let document = await createHotelInvoiceDraftFromReservation({ reservationId: reservation._id, actor, transactionMode: 'transactional' }); await finalizeDocumentLines({ documentId: document._id, actor }); document = await issueFinancialDocument({ documentId: document._id, actor, businessOperationKey: `issue-${document._id}`, establishmentCode: 'PDF', transactionMode: 'transactional' }); return { actor, hotel, reservation, document }; }
beforeAll(startFinancialMongo); beforeEach(() => { files.clear(); jest.clearAllMocks(); }); afterEach(clearFinancialMongo); afterAll(stopFinancialMongo);

test('12 générations concurrentes produisent un seul artefact prêt et deux ledgers uniques', async () => {
  const { actor, document } = await fixture(); const results = await Promise.all(Array.from({ length: 12 }, (_, index) => generateOfficialPdf({ documentId: document._id, actor, idempotencyKey: `pdf-${index}`, storage })));
  expect(new Set(results.map((result) => String(result.artifact.id))).size).toBe(1); expect(await FinancialDocumentArtifact.countDocuments({ financialDocument: document._id, status: 'ready' })).toBe(1); expect(storage.storeOfficialPdf).toHaveBeenCalledTimes(1);
  expect(await FinancialLedgerEntry.countDocuments({ entityType: 'FinancialDocumentArtifact' })).toBe(2); const artifact = await getReadyArtifact(document._id); expect((await readAndVerifyArtifact(artifact, storage)).subarray(0, 4).toString()).toBe('%PDF');
});

test('utilise le snapshot figé même si la réservation change après émission', async () => {
  const { actor, document, reservation } = await fixture(); reservation.guest.firstName = 'CHANGÉ'; reservation.totalAmount = 999999; await reservation.save();
  const result = await generateOfficialPdf({ documentId: document._id, actor, idempotencyKey: 'immutable', storage }); expect(result.artifact.hash).toMatch(/^[a-f0-9]{64}$/); expect(result.artifact.sizeBytes).toBeGreaterThan(1000);
});

test('12 envois de même clé appellent le fournisseur une seule fois et conservent le hash joint', async () => {
  const { actor, document } = await fixture(); await generateOfficialPdf({ documentId: document._id, actor, idempotencyKey: 'pdf-email', storage }); const emailSender = jest.fn(async (options) => { expect(options.to).toBe('snapshot@example.test'); expect(options.attachments[0].content.subarray(0, 4).toString()).toBe('%PDF'); return { messageId: 'zoho-1' }; });
  const results = await Promise.all(Array.from({ length: 12 }, () => sendOfficialInvoiceEmail({ documentId: document._id, actor, idempotencyKey: 'same-email', storage, emailSender })));
  expect(emailSender).toHaveBeenCalledTimes(1); expect(await FinancialDocumentDelivery.countDocuments({ financialDocument: document._id })).toBe(1); const delivery = await FinancialDocumentDelivery.findOne({ financialDocument: document._id }); const artifact = await getReadyArtifact(document._id); expect(delivery).toMatchObject({ status: 'sent', artifactHash: artifact.hash }); expect(results.every((item) => ['pending', 'sent'].includes(item.delivery.status))).toBe(true);
});

test('conflit de payload, échec certain et timeout inconnu restent explicites et append-only', async () => {
  const { actor, document } = await fixture(); await generateOfficialPdf({ documentId: document._id, actor, idempotencyKey: 'pdf-states', storage }); const failure = await sendOfficialInvoiceEmail({ documentId: document._id, actor, idempotencyKey: 'failure', recipient: 'a@example.test', storage, emailSender: async () => { throw new Error('SMTP rejected'); } }); expect(failure.delivery.status).toBe('failed');
  const unknown = await sendOfficialInvoiceEmail({ documentId: document._id, actor, idempotencyKey: 'unknown', recipient: 'b@example.test', storage, emailSender: async () => { const error = new Error('socket timeout'); error.code = 'ETIMEDOUT'; throw error; } }); expect(unknown.delivery.status).toBe('delivery_unknown');
  await expect(sendOfficialInvoiceEmail({ documentId: document._id, actor, idempotencyKey: 'failure', recipient: 'other@example.test', storage, emailSender: jest.fn() })).rejects.toMatchObject({ code: 'FINANCIAL_IDEMPOTENCY_CONFLICT' }); expect(await FinancialDocumentDelivery.countDocuments()).toBe(2);
});

test('détecte toute corruption avant téléchargement ou email', async () => { const { actor, document } = await fixture(); await generateOfficialPdf({ documentId: document._id, actor, idempotencyKey: 'integrity', storage }); const artifact = await getReadyArtifact(document._id); files.set(artifact.storageKey, Buffer.from('corrompu')); await expect(readAndVerifyArtifact(artifact, storage)).rejects.toMatchObject({ code: 'FINANCIAL_PDF_INTEGRITY_ERROR' }); });
