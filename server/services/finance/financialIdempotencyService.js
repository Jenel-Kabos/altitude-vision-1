const crypto = require('crypto');
const FinancialProviderEvent = require('../../models/FinancialProviderEvent');

const hashPayload = (payload) => crypto.createHash('sha256').update(typeof payload === 'string' ? payload : JSON.stringify(payload || {})).digest('hex');
async function registerProviderEvent({ provider, providerEventId, providerPaymentId, eventType, payload, signatureVerified, businessOperationKey }) {
  try {
    const event = await FinancialProviderEvent.create({ provider, providerEventId, providerPaymentId, eventType, payloadHash: hashPayload(payload), signatureVerified, businessOperationKey });
    return { event, duplicate: false };
  } catch (error) {
    if (error.code !== 11000) throw error;
    return { event: await FinancialProviderEvent.findOne({ provider, providerEventId }), duplicate: true };
  }
}
module.exports = { hashPayload, registerProviderEvent };
