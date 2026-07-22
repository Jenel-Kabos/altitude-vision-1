const { fail } = require('./financialError');

const DOCUMENT_TRANSITIONS = { draft: ['issued', 'cancelled', 'void'], issued: ['cancelled', 'credited', 'void'], cancelled: [], credited: [], void: [] };
const PAYMENT_TRANSITIONS = { pending: ['processing', 'cancelled'], processing: ['succeeded', 'failed', 'cancelled'], succeeded: ['partially_refunded', 'refunded'], failed: [], cancelled: [], partially_refunded: ['refunded'], refunded: [] };

function assertTransition(map, from, to) {
  if (!(map[from] || []).includes(to)) fail('FINANCIAL_INVALID_TRANSITION', `Transition financière interdite : ${from} → ${to}.`);
  return true;
}
const assertFinancialDocumentTransition = (from, to) => assertTransition(DOCUMENT_TRANSITIONS, from, to);
const assertFinancialPaymentTransition = (from, to) => assertTransition(PAYMENT_TRANSITIONS, from, to);

module.exports = { DOCUMENT_TRANSITIONS, PAYMENT_TRANSITIONS, assertFinancialDocumentTransition, assertFinancialPaymentTransition };
