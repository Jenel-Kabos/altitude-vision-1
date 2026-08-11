const crypto = require('crypto');
const FinancialPayment = require('../../models/FinancialPayment');
const { assertAmountMinor, assertCurrency } = require('./moneyService');
const { appendFinancialLedgerEntry } = require('./financialLedgerService');
const { fail, translateMongoDuplicate } = require('./financialError');
const { hashPayload } = require('./financialIdempotencyService');
const { runFinancialOperation } = require('./financialTransactionService');

const inSession = (query, session) => (session ? query.session(session) : query);

async function createManualPaymentCore({ data, actor, businessOperationKey, session }) {
  const amountMinor = assertAmountMinor(data.amountMinor);
  assertCurrency(data.currency);
  const actorId = actor.id || actor._id;
  const requestedReference = data.paymentReference || '';
  const operationKey = businessOperationKey || `manual-payment:${requestedReference || `${Date.now()}-${crypto.randomBytes(6).toString('hex')}`}`;
  const payloadHash = hashPayload({ establishmentId: String(data.establishmentId), amountMinor, currency: data.currency, method: data.method, paymentReference: requestedReference, confirmed: data.confirmed === true, subjectType: data.subjectType, subjectId: String(data.subjectId || '') });
  const existing = await inSession(FinancialPayment.findOne({ domain: 'hotel', establishmentId: data.establishmentId, businessOperationKey: operationKey }).select('+payloadHash'), session);
  if (existing) {
    if (existing.payloadHash !== payloadHash) fail('FINANCIAL_IDEMPOTENCY_CONFLICT', 'Cette clé d’idempotence a déjà été utilisée avec des données différentes.', 409);
    return existing;
  }
  const paymentReference = requestedReference || `PAY-${Date.now()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
  const approved = data.confirmed === true;
  let payment;
  try {
    [payment] = await FinancialPayment.create([{ tenant: actor.platformTenant?._id || actor.platformTenant || null, domain: 'hotel', establishmentType: 'Hotel', establishmentId: data.establishmentId, paymentReference, status: approved ? 'succeeded' : 'pending', method: data.method, provider: 'manual', currency: data.currency, amountMinor, availableAmountMinor: amountMinor, payer: data.payer, subjectType: data.subjectType, subjectId: data.subjectId, receivedAt: new Date(), confirmedAt: approved ? new Date() : null, manualValidation: { status: approved ? 'approved' : 'pending', submittedBy: actorId, approvedBy: approved ? actorId : null, approvedAt: approved ? new Date() : null }, createdBy: actorId, confirmedBy: approved ? actorId : null, businessOperationKey: operationKey, payloadHash }], { session });
  } catch (error) {
    if (error.code !== 11000) throw error;
    const duplicate = await inSession(FinancialPayment.findOne({ domain: 'hotel', establishmentId: data.establishmentId, businessOperationKey: operationKey }).select('+payloadHash'), session);
    if (duplicate?.payloadHash === payloadHash) return duplicate;
    throw translateMongoDuplicate(error, 'FINANCIAL_IDEMPOTENCY_CONFLICT');
  }
  const commonLedger = { domain: payment.domain, establishmentType: payment.establishmentType, establishmentId: payment.establishmentId, entityType: 'FinancialPayment', entityId: payment._id, actorType: 'user', actorId, amountMinor, currency: payment.currency };
  await appendFinancialLedgerEntry({ ...commonLedger, eventType: 'payment.created', businessOperationKey: `${operationKey}:created`, newState: { status: 'pending' } }, { session });
  if (approved) await appendFinancialLedgerEntry({ ...commonLedger, eventType: 'payment.confirmed', businessOperationKey: `${operationKey}:confirmed`, previousState: { status: 'pending' }, newState: { status: 'succeeded' } }, { session });
  return payment;
}
async function createManualPayment(args) { return runFinancialOperation({ operationName: 'payment.manual.create', transactionMode: args.transactionMode || 'auto' }, ({ session }) => createManualPaymentCore({ ...args, session })); }

async function createHotelPaymentCore({ data, actor, businessOperationKey, session }) {
  const actorId = actor.id || actor._id;
  const amountMinor = assertAmountMinor(data.amountMinor);
  if (amountMinor <= 0) fail('FINANCIAL_INVALID_AMOUNT', 'Le montant doit être strictement positif.');
  if (data.currency !== 'XAF') fail('FINANCIAL_CURRENCY_UNSUPPORTED', 'Les encaissements hôteliers F2.2 sont limités au XAF.');
  assertCurrency(data.currency);
  const payloadHash = hashPayload({ documentId: String(data.documentId), reservationId: String(data.reservationId), amountMinor, method: data.method, reference: data.reference || '', notes: data.notes || '' });
  const existing = await inSession(FinancialPayment.findOne({ domain: 'hotel', establishmentId: data.establishmentId, businessOperationKey }).select('+payloadHash'), session);
  if (existing) {
    if (existing.payloadHash !== payloadHash) fail('FINANCIAL_IDEMPOTENCY_CONFLICT', 'Cette clé d’idempotence a déjà été utilisée avec des données différentes.', 409);
    return { payment: existing, created: false };
  }
  const paymentReference = data.reference || `PAY-${Date.now()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
  let payment;
  try {
    [payment] = await FinancialPayment.create([{ tenant: actor.platformTenant?._id || actor.platformTenant || null, domain: 'hotel', establishmentType: 'Hotel', establishmentId: data.establishmentId, paymentReference, status: 'pending', method: data.method, provider: 'manual', currency: 'XAF', amountMinor, availableAmountMinor: amountMinor, payer: data.payer, subjectType: 'HotelReservation', subjectId: data.reservationId, receivedAt: new Date(), manualValidation: { status: 'pending', submittedBy: actorId }, metadata: { financialDocumentId: data.documentId, notes: data.notes, source: 'hotel_manual_f2_2' }, businessOperationKey, payloadHash, createdBy: actorId }], { session });
  } catch (error) {
    if (error.code !== 11000) throw error;
    const duplicate = await inSession(FinancialPayment.findOne({ domain: 'hotel', establishmentId: data.establishmentId, businessOperationKey }).select('+payloadHash'), session);
    if (duplicate?.payloadHash === payloadHash) return { payment: duplicate, created: false };
    throw translateMongoDuplicate(error, 'FINANCIAL_IDEMPOTENCY_CONFLICT');
  }
  await appendFinancialLedgerEntry({ eventType: 'payment.created', domain: 'hotel', establishmentType: 'Hotel', establishmentId: data.establishmentId, entityType: 'FinancialPayment', entityId: payment._id, relatedEntities: [{ entityType: 'FinancialDocument', entityId: data.documentId }, { entityType: 'HotelReservation', entityId: data.reservationId }], actorType: 'user', actorId, amountMinor, currency: 'XAF', businessOperationKey, newState: { status: 'pending' }, metadata: { method: data.method, reference: paymentReference } }, { session });
  return { payment, created: true };
}

async function createHotelPayment(args) { return runFinancialOperation({ operationName: 'payment.hotel.create', transactionMode: args.transactionMode || 'auto' }, ({ session }) => createHotelPaymentCore({ ...args, session })); }

async function confirmHotelPaymentCore({ paymentId, actor, businessOperationKey, session }) {
  const actorId = actor.id || actor._id;
  let payment = await inSession(FinancialPayment.findById(paymentId), session);
  if (!payment) fail('FINANCIAL_PAYMENT_NOT_AVAILABLE', 'Paiement introuvable.', 404);
  if (payment.domain !== 'hotel' || payment.currency !== 'XAF') fail('FINANCIAL_CURRENCY_UNSUPPORTED', 'Paiement hôtelier XAF requis.', 409);
  if (payment.status === 'succeeded') return { payment, confirmed: false };
  if (payment.status !== 'pending') fail('FINANCIAL_PAYMENT_INVALID_TRANSITION', `Le paiement ${payment.status} ne peut pas être confirmé.`, 409);
  payment = await FinancialPayment.findOneAndUpdate({ _id: paymentId, status: 'pending' }, { status: 'succeeded', confirmedAt: new Date(), confirmedBy: actorId, 'manualValidation.status': 'approved', 'manualValidation.approvedBy': actorId, 'manualValidation.approvedAt': new Date() }, { new: true, session });
  if (!payment) {
    payment = await inSession(FinancialPayment.findById(paymentId), session);
    if (payment?.status === 'succeeded') return { payment, confirmed: false };
    fail('FINANCIAL_PAYMENT_INVALID_TRANSITION', 'Le paiement a changé pendant sa confirmation.', 409);
  }
  await appendFinancialLedgerEntry({ eventType: 'payment.confirmed', domain: payment.domain, establishmentType: payment.establishmentType, establishmentId: payment.establishmentId, entityType: 'FinancialPayment', entityId: payment._id, relatedEntities: [{ entityType: 'FinancialDocument', entityId: payment.metadata?.financialDocumentId }, { entityType: 'HotelReservation', entityId: payment.subjectId }].filter((item) => item.entityId), actorType: 'user', actorId, amountMinor: payment.amountMinor, currency: payment.currency, businessOperationKey, previousState: { status: 'pending' }, newState: { status: 'succeeded' }, metadata: { method: payment.method, reference: payment.paymentReference } }, { session });
  return { payment, confirmed: true };
}

async function confirmHotelPayment(args) { return runFinancialOperation({ operationName: 'payment.hotel.confirm', transactionMode: args.transactionMode || 'auto' }, ({ session }) => confirmHotelPaymentCore({ ...args, session })); }
module.exports = { createManualPayment, createHotelPayment, confirmHotelPayment };
