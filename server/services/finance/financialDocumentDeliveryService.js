const crypto = require('crypto');
const FinancialDocument = require('../../models/FinancialDocument');
const FinancialDocumentDelivery = require('../../models/FinancialDocumentDelivery');
const { sendEmail } = require('../../config/email');
const { appendFinancialLedgerEntry } = require('./financialLedgerService');
const { fail } = require('./financialError');
const { generateOfficialPdf, getReadyArtifact, readAndVerifyArtifact, hashKey, publicArtifact } = require('./financialDocumentArtifactService');
const { safeFilename } = require('./hotelInvoicePdfRenderer');

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const stripControls = (value) => [...String(value || '')].map((character) => { const code = character.charCodeAt(0); return code < 32 || code === 127 ? ' ' : character; }).join('');
const cleanText = (value, max) => stripControls(value).replace(/[<>]/g, '').trim().slice(0, max);
const containsControls = (value) => [...String(value || '')].some((character) => { const code = character.charCodeAt(0); return code < 32 || code === 127; });
const publicDelivery = (delivery) => ({ id: delivery._id, documentId: delivery.financialDocument, artifactId: delivery.artifact, artifactHash: delivery.artifactHash, artifactTemplateVersion: delivery.artifactTemplateVersion, channel: delivery.channel, recipient: delivery.recipient, subject: delivery.subject, provider: delivery.provider, status: delivery.status, requestedBy: delivery.requestedBy, requestedAt: delivery.requestedAt, sentAt: delivery.sentAt, failedAt: delivery.failedAt, normalizedErrorCode: delivery.normalizedErrorCode, correlationId: delivery.correlationId });
const payloadHash = (value) => hashKey(JSON.stringify(value));
const isUnknown = (error) => /timeout|timed out|ETIMEDOUT|ECONNRESET|socket hang up/i.test(`${error?.code || ''} ${error?.message || ''}`);

async function sendOfficialInvoiceEmail({ documentId, actor, idempotencyKey, recipient, message, storage, emailSender = sendEmail }) {
  if (!String(idempotencyKey || '').trim()) fail('FINANCIAL_IDEMPOTENCY_KEY_REQUIRED', 'Une clé d’idempotence est obligatoire.', 422);
  const document = await FinancialDocument.findById(documentId);
  if (!document || document.domain !== 'hotel' || document.status !== 'issued') fail('FINANCIAL_DOCUMENT_NOT_ISSUED', 'Une facture hôtelière émise est requise.', 409);
  const target = String(recipient || document.customer?.email || '').trim().toLowerCase();
  if (target.length > 254 || containsControls(target) || !EMAIL.test(target)) fail('FINANCIAL_EMAIL_RECIPIENT_INVALID', 'Le destinataire email est invalide.', 422);
  const safeMessage = cleanText(message, 500);
  let artifact;
  try { artifact = await getReadyArtifact(documentId); }
  catch (error) {
    if (error.code !== 'FINANCIAL_PDF_NOT_AVAILABLE') throw error;
    const generated = await generateOfficialPdf({ documentId, actor, idempotencyKey: `${idempotencyKey}:pdf`, storage });
    artifact = await getReadyArtifact(documentId);
    if (!generated.artifact) fail('FINANCIAL_PDF_NOT_AVAILABLE', 'Le PDF officiel est indisponible.', 404);
  }
  const keyHash = hashKey(idempotencyKey);
  const requestHash = payloadHash({ documentId: String(documentId), artifactHash: artifact.hash, recipient: target, message: safeMessage });
  let existing = await FinancialDocumentDelivery.findOne({ idempotencyKeyHash: keyHash }).select('+idempotencyKeyHash +payloadHash');
  if (existing) {
    if (existing.payloadHash !== requestHash) fail('FINANCIAL_IDEMPOTENCY_CONFLICT', 'Cette clé d’idempotence correspond à un autre envoi.', 409);
    return { delivery: publicDelivery(existing), artifact: publicArtifact(artifact), duplicate: true };
  }
  const subject = `Votre facture ${document.documentNumber} — ${cleanText(document.seller?.name || 'Altitude Vision', 100)}`;
  try {
    existing = await FinancialDocumentDelivery.create({ financialDocument: document._id, establishmentId: document.establishmentId, reservationId: document.subjectId, artifact: artifact._id, artifactHash: artifact.hash, artifactTemplateVersion: artifact.templateVersion, recipient: target, subject, attemptNumber: 1, idempotencyKeyHash: keyHash, payloadHash: requestHash, requestedBy: actor.id || actor._id, correlationId: crypto.randomUUID() });
  } catch (error) {
    if (error.code !== 11000) throw error;
    existing = await FinancialDocumentDelivery.findOne({ idempotencyKeyHash: keyHash }).select('+payloadHash');
    if (!existing || existing.payloadHash !== requestHash) fail('FINANCIAL_IDEMPOTENCY_CONFLICT', 'Cette clé d’idempotence correspond à un autre envoi.', 409);
    return { delivery: publicDelivery(existing), artifact: publicArtifact(artifact), duplicate: true };
  }
  const baseLedger = { domain: 'hotel', establishmentType: 'Hotel', establishmentId: document.establishmentId, entityType: 'FinancialDocumentDelivery', entityId: existing._id, relatedEntities: [{ entityType: 'FinancialDocument', entityId: document._id }, { entityType: 'FinancialDocumentArtifact', entityId: artifact._id }], actorType: 'user', actorId: actor.id || actor._id, currency: document.currency };
  await appendFinancialLedgerEntry({ ...baseLedger, eventType: 'financial_document.email_requested', businessOperationKey: `delivery:${existing._id}:requested`, newState: { status: 'pending', recipient: target.replace(/(^.).*(@.*$)/, '$1***$2') } });
  try {
    const buffer = await readAndVerifyArtifact(artifact, storage);
    const html = `<div style="font-family:Arial,sans-serif;max-width:600px"><h2>Votre facture ${cleanText(document.documentNumber, 80)}</h2><p>Bonjour ${cleanText(document.customer?.name || 'Client', 100)},</p><p>Veuillez trouver en pièce jointe votre facture émise le ${new Date(document.issueDate).toLocaleDateString('fr-FR', { timeZone: 'UTC' })}, d’un montant total de ${Number(document.totalMinor).toLocaleString('fr-FR')} XAF.</p><p>Réservation : ${cleanText(document.metadata?.reservationReference || document.subjectId, 100)}</p>${safeMessage ? `<p>${safeMessage}</p>` : ''}<p>Cordialement,<br>${cleanText(document.seller?.name || 'Altitude Vision', 100)}</p></div>`;
    const info = await emailSender({ to: target, subject, html, text: `Facture ${document.documentNumber} - ${document.totalMinor} XAF`, attachments: [{ filename: safeFilename(document.documentNumber), content: buffer, contentType: 'application/pdf' }], messageId: `<financial-${existing._id}@altitudevision.local>` });
    existing.status = 'sent'; existing.sentAt = new Date(); existing.providerMessageId = cleanText(info?.messageId, 300) || null; await existing.save();
    await appendFinancialLedgerEntry({ ...baseLedger, eventType: 'financial_document.email_sent', businessOperationKey: `delivery:${existing._id}:sent`, newState: { status: 'sent', artifactHash: artifact.hash, provider: 'zoho-smtp' } });
  } catch (error) {
    const unknown = isUnknown(error); existing.status = unknown ? 'delivery_unknown' : 'failed'; existing.failedAt = new Date(); existing.normalizedErrorCode = unknown ? 'FINANCIAL_EMAIL_DELIVERY_UNKNOWN' : 'FINANCIAL_EMAIL_SEND_FAILED'; existing.normalizedErrorMessage = cleanText(error?.message, 500); await existing.save();
    await appendFinancialLedgerEntry({ ...baseLedger, eventType: unknown ? 'financial_document.email_delivery_unknown' : 'financial_document.email_failed', businessOperationKey: `delivery:${existing._id}:${unknown ? 'unknown' : 'failed'}`, newState: { status: existing.status, errorCode: existing.normalizedErrorCode } });
  }
  return { delivery: publicDelivery(existing), artifact: publicArtifact(artifact), duplicate: false };
}

async function listDeliveries(documentId) {
  return (await FinancialDocumentDelivery.find({ financialDocument: documentId }).sort({ requestedAt: -1 }).limit(100)).map(publicDelivery);
}

module.exports = { sendOfficialInvoiceEmail, listDeliveries, publicDelivery };
