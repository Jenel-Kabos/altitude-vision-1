const crypto = require('crypto');
const FinancialDocument = require('../../models/FinancialDocument');
const FinancialDocumentLine = require('../../models/FinancialDocumentLine');
const FinancialDocumentArtifact = require('../../models/FinancialDocumentArtifact');
const { appendFinancialLedgerEntry } = require('./financialLedgerService');
const { fail } = require('./financialError');
const renderer = require('./hotelInvoicePdfRenderer');
const defaultStorage = require('../storage/financialDocumentStorageService');

const hashKey = (value) => renderer.sha256(String(value || '').trim());
const actorId = (actor) => actor?.id || actor?._id;
const publicArtifact = (artifact) => ({ id: artifact._id, documentId: artifact.financialDocument, status: artifact.status, templateVersion: artifact.templateVersion, hash: artifact.hash, hashAlgorithm: artifact.hashAlgorithm, mimeType: artifact.mimeType, sizeBytes: artifact.sizeBytes, generatedAt: artifact.generatedAt, generatedBy: artifact.generatedBy, failureCode: artifact.failureCode });

async function loadSnapshot(documentId) {
  const [document, lines] = await Promise.all([FinancialDocument.findById(documentId), FinancialDocumentLine.find({ financialDocument: documentId }).sort('lineNumber')]);
  if (!document) fail('FINANCIAL_DOCUMENT_NOT_ISSUED', 'Facture introuvable.', 404);
  const snapshot = renderer.buildOfficialSnapshot(document, lines);
  return { document, snapshot, snapshotHash: renderer.sha256(renderer.stableJson(snapshot)) };
}

async function waitForArtifact(query, timeoutMs = 15000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const artifact = await FinancialDocumentArtifact.findOne(query).select('+storageKey +storageVersion +generationToken +idempotencyKeyHash');
    if (!artifact || artifact.status !== 'pending') return artifact;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  fail('FINANCIAL_PDF_GENERATION_FAILED', 'La génération du PDF est toujours en cours.', 503);
}

async function generateOfficialPdf({ documentId, actor, idempotencyKey, storage = defaultStorage, render = renderer.renderOfficialInvoicePdf }) {
  if (!String(idempotencyKey || '').trim()) fail('FINANCIAL_IDEMPOTENCY_KEY_REQUIRED', 'Une clé d’idempotence est obligatoire.', 422);
  const { document, snapshot, snapshotHash } = await loadSnapshot(documentId);
  const keyHash = hashKey(idempotencyKey);
  const keyed = await FinancialDocumentArtifact.findOne({ idempotencyKeyHash: keyHash });
  if (keyed && (String(keyed.financialDocument) !== String(documentId) || keyed.snapshotHash !== snapshotHash || keyed.templateVersion !== renderer.TEMPLATE_VERSION)) fail('FINANCIAL_IDEMPOTENCY_CONFLICT', 'Cette clé d’idempotence correspond à une autre demande.', 409);
  const query = { financialDocument: document._id, artifactType: 'official_invoice_pdf', templateVersion: renderer.TEMPLATE_VERSION, snapshotHash, status: { $in: ['pending', 'ready'] } };
  let artifact = await FinancialDocumentArtifact.findOne(query).select('+storageKey +storageVersion +generationToken');
  if (artifact?.status === 'ready') return { artifact: publicArtifact(artifact), generated: false };
  let ownsGeneration = false;
  if (!artifact) {
    try {
      artifact = await FinancialDocumentArtifact.create({ financialDocument: document._id, domain: document.domain, establishmentId: document.establishmentId, reservationId: document.subjectId, artifactType: 'official_invoice_pdf', templateVersion: renderer.TEMPLATE_VERSION, snapshotHash, generatedBy: actorId(actor), generationToken: crypto.randomUUID(), idempotencyKeyHash: keyHash });
      ownsGeneration = true;
    } catch (error) {
      if (error.code !== 11000) throw error;
      const conflict = await FinancialDocumentArtifact.findOne({ idempotencyKeyHash: keyHash });
      if (conflict && String(conflict.financialDocument) !== String(documentId)) fail('FINANCIAL_IDEMPOTENCY_CONFLICT', 'Cette clé d’idempotence correspond à une autre demande.', 409);
      artifact = await FinancialDocumentArtifact.findOne(query).select('+storageKey +storageVersion +generationToken');
    }
  }
  if (!ownsGeneration) {
    artifact = await waitForArtifact(query);
    if (artifact?.status === 'ready') return { artifact: publicArtifact(artifact), generated: false };
    fail('FINANCIAL_PDF_GENERATION_FAILED', 'La génération concurrente a échoué.', 503);
  }
  const baseLedger = { domain: 'hotel', establishmentType: 'Hotel', establishmentId: document.establishmentId, entityType: 'FinancialDocumentArtifact', entityId: artifact._id, relatedEntities: [{ entityType: 'FinancialDocument', entityId: document._id }, { entityType: 'HotelReservation', entityId: document.subjectId }], actorType: 'user', actorId: actorId(actor), currency: document.currency };
  await appendFinancialLedgerEntry({ ...baseLedger, eventType: 'financial_document.pdf_generation_requested', businessOperationKey: `artifact:${artifact._id}:generation-requested`, newState: { status: 'pending', templateVersion: renderer.TEMPLATE_VERSION } });
  try {
    const buffer = await render(snapshot);
    const hash = renderer.sha256(buffer);
    const stored = await storage.storeOfficialPdf(buffer, { documentId: document._id, artifactId: artifact._id });
    artifact = await FinancialDocumentArtifact.findOneAndUpdate({ _id: artifact._id, status: 'pending' }, { $set: { status: 'ready', storageProvider: stored.provider, storageKey: stored.storageKey, storageVersion: stored.storageVersion, hash, sizeBytes: buffer.length, generatedAt: new Date() } }, { new: true }).select('+storageKey +storageVersion');
    await appendFinancialLedgerEntry({ ...baseLedger, eventType: 'financial_document.pdf_generated', businessOperationKey: `artifact:${artifact._id}:generated`, newState: { status: 'ready', hash, templateVersion: renderer.TEMPLATE_VERSION, sizeBytes: buffer.length } });
    return { artifact: publicArtifact(artifact), generated: true };
  } catch (error) {
    await FinancialDocumentArtifact.findOneAndUpdate({ _id: artifact._id, status: 'pending' }, { $set: { status: 'failed', failureCode: 'FINANCIAL_PDF_GENERATION_FAILED', failureMessage: String(error.message || '').slice(0, 500) } });
    await appendFinancialLedgerEntry({ ...baseLedger, eventType: 'financial_document.pdf_generation_failed', businessOperationKey: `artifact:${artifact._id}:generation-failed`, newState: { status: 'failed', errorCode: 'FINANCIAL_PDF_GENERATION_FAILED' } });
    fail('FINANCIAL_PDF_GENERATION_FAILED', 'La génération du PDF a échoué.', 503);
  }
}

async function getReadyArtifact(documentId) {
  const artifact = await FinancialDocumentArtifact.findOne({ financialDocument: documentId, artifactType: 'official_invoice_pdf', status: 'ready' }).sort({ generatedAt: -1 }).select('+storageKey +storageVersion');
  if (!artifact) fail('FINANCIAL_PDF_NOT_AVAILABLE', 'Aucun PDF officiel disponible.', 404);
  return artifact;
}

async function readAndVerifyArtifact(artifact, storage = defaultStorage) {
  if (artifact.status !== 'ready' || artifact.mimeType !== 'application/pdf' || !artifact.storageKey) fail('FINANCIAL_PDF_NOT_AVAILABLE', 'Le PDF officiel n’est pas disponible.', 404);
  const buffer = await storage.readOfficialPdf({ storageKey: artifact.storageKey, storageVersion: artifact.storageVersion });
  if (buffer.length !== artifact.sizeBytes || renderer.sha256(buffer) !== artifact.hash) fail('FINANCIAL_PDF_INTEGRITY_ERROR', 'L’intégrité du PDF officiel est invalide.', 409);
  return buffer;
}

module.exports = { generateOfficialPdf, getReadyArtifact, readAndVerifyArtifact, publicArtifact, loadSnapshot, hashKey };
