const crypto = require('crypto');
const FinancialPayment = require('../../models/FinancialPayment');
const { assertAmountMinor, assertCurrency } = require('./moneyService');
const { appendFinancialLedgerEntry } = require('./financialLedgerService');

async function createManualPayment({ data, actor }) {
  const amountMinor = assertAmountMinor(data.amountMinor);
  assertCurrency(data.currency);
  const actorId = actor.id || actor._id;
  const paymentReference = data.paymentReference || `PAY-${Date.now()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
  const approved = data.confirmed === true;
  const payment = await FinancialPayment.create({ domain: 'hotel', establishmentType: 'Hotel', establishmentId: data.establishmentId, paymentReference, status: approved ? 'succeeded' : 'pending', method: data.method, provider: 'manual', currency: data.currency, amountMinor, availableAmountMinor: amountMinor, payer: data.payer, subjectType: data.subjectType, subjectId: data.subjectId, receivedAt: new Date(), confirmedAt: approved ? new Date() : null, manualValidation: { status: approved ? 'approved' : 'pending', submittedBy: actorId, approvedBy: approved ? actorId : null, approvedAt: approved ? new Date() : null }, createdBy: actorId, confirmedBy: approved ? actorId : null });
  await appendFinancialLedgerEntry({ eventType: approved ? 'payment.confirmed' : 'payment.created', domain: payment.domain, establishmentType: payment.establishmentType, establishmentId: payment.establishmentId, entityType: 'FinancialPayment', entityId: payment._id, actorType: 'user', actorId, amountMinor, currency: payment.currency, businessOperationKey: `payment:${payment._id}:${payment.status}`, newState: { status: payment.status } });
  return payment;
}
module.exports = { createManualPayment };
