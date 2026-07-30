const crypto = require('crypto');
const FinancialProviderEvent = require('../../models/FinancialProviderEvent');
const { FinancialError } = require('./financialError');

const hashPayload = (payload) => crypto.createHash('sha256').update(typeof payload === 'string' ? payload : JSON.stringify(payload || {})).digest('hex');
const SENSITIVE_KEYS = /token|secret|signature|password|authorization/i;
const snapshotPayload = (value) => {
  if (Array.isArray(value)) return value.map(snapshotPayload);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value).filter(([key]) => !SENSITIVE_KEYS.test(key)).map(([key, item]) => [key, snapshotPayload(item)]));
};
async function registerProviderEvent({ provider, providerEventId, providerPaymentId, providerTransactionId, eventType, payload, signatureVerified, businessOperationKey }) {
  const payloadHash = hashPayload(payload);
  try {
    const event = await FinancialProviderEvent.create({ provider, providerEventId, providerPaymentId, providerTransactionId: providerTransactionId || providerPaymentId, eventType, payloadHash, payloadSnapshot: snapshotPayload(payload), signatureVerified, businessOperationKey, receivedAt: new Date() });
    return { event, duplicate: false };
  } catch (error) {
    if (error.code !== 11000) throw error;
    const existingQuery = FinancialProviderEvent.findOne({ provider, providerEventId });
    const event = typeof existingQuery?.select === 'function'
      ? await existingQuery.select('+payloadSnapshot +error +lastError')
      : await existingQuery;
    if (event?.payloadHash !== payloadHash) throw new FinancialError('FINANCIAL_PROVIDER_EVENT_CONFLICT', 'Le même identifiant fournisseur a été reçu avec un contenu différent.', 409);
    return { event, duplicate: true };
  }
}
async function claimProviderEvent(eventId) {
  const staleBefore = new Date(Date.now() - 5 * 60 * 1000);
  return FinancialProviderEvent.findOneAndUpdate(
    { _id: eventId, $or: [{ status: { $in: ['received', 'failed'] } }, { status: 'processing', processingStartedAt: { $lt: staleBefore } }] },
    { $set: { status: 'processing', processingStartedAt: new Date(), failedAt: null, error: null, lastError: null }, $inc: { attemptCount: 1, retryCount: 1 } },
    { new: true },
  );
}
async function completeProviderEvent(eventId, result = {}) {
  const now = new Date();
  const event = await FinancialProviderEvent.findById(eventId);
  if (!event) return null;
  return FinancialProviderEvent.findOneAndUpdate(
    { _id: eventId, status: 'processing' },
    { $set: { status: 'processed', processedAt: now, processingDuration: Math.max(0, now.getTime() - new Date(event.processingStartedAt || now).getTime()), result: snapshotPayload(result), error: null, lastError: null } },
    { new: true },
  );
}
async function failProviderEvent(eventId, error) {
  const now = new Date();
  const event = await FinancialProviderEvent.findById(eventId);
  const message = String(error?.message || error || 'Erreur fournisseur').slice(0, 2000);
  return FinancialProviderEvent.findOneAndUpdate(
    { _id: eventId, status: 'processing' },
    { $set: { status: 'failed', failedAt: now, processingDuration: Math.max(0, now.getTime() - new Date(event?.processingStartedAt || now).getTime()), error: { code: error?.code, message }, lastError: message } },
    { new: true },
  );
}
module.exports = { hashPayload, registerProviderEvent, claimProviderEvent, completeProviderEvent, failProviderEvent, snapshotPayload };
