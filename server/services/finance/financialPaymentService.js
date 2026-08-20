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
  // PAY-4 — `provider`/`providerPaymentId` optionnels, additifs : un appel
  // existant qui ne les fournit pas obtient exactement le comportement F2.2
  // d'origine (`provider: 'manual'`, pas de manualValidation pour un
  // provider automatique). Jamais lus depuis une source non serveur — voir
  // mtnHotelPaymentBridge.js, seul appelant qui les fournit aujourd'hui.
  const provider = data.provider || 'manual';
  const isManual = provider === 'manual';
  const payloadHash = hashPayload({ documentId: String(data.documentId), reservationId: String(data.reservationId), amountMinor, method: data.method, reference: data.reference || '', notes: data.notes || '', provider });
  const existing = await inSession(FinancialPayment.findOne({ domain: 'hotel', establishmentId: data.establishmentId, businessOperationKey }).select('+payloadHash'), session);
  if (existing) {
    if (existing.payloadHash !== payloadHash) fail('FINANCIAL_IDEMPOTENCY_CONFLICT', 'Cette clé d’idempotence a déjà été utilisée avec des données différentes.', 409);
    return { payment: existing, created: false };
  }
  const paymentReference = data.reference || `PAY-${Date.now()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
  let payment;
  try {
    [payment] = await FinancialPayment.create([{ tenant: actor.platformTenant?._id || actor.platformTenant || null, domain: 'hotel', establishmentType: 'Hotel', establishmentId: data.establishmentId, paymentReference, status: 'pending', method: data.method, provider, providerPaymentId: data.providerPaymentId || undefined, currency: 'XAF', amountMinor, availableAmountMinor: amountMinor, payer: data.payer, subjectType: 'HotelReservation', subjectId: data.reservationId, receivedAt: new Date(), manualValidation: isManual ? { status: 'pending', submittedBy: actorId } : undefined, metadata: { financialDocumentId: data.documentId, notes: data.notes, source: isManual ? 'hotel_manual_f2_2' : 'hotel_provider_pay4' }, businessOperationKey, payloadHash, createdBy: actorId }], { session });
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

// PAY-4 — transition manquante avant ce sprint : aucun paiement manuel
// n'échoue de façon asynchrone (le staff choisit simplement de ne jamais le
// confirmer). Un provider automatique (mtn_direct) peut réellement échouer
// après avoir été `pending` — cette fonction miroir de
// `confirmHotelPaymentCore` couvre ce cas, jamais appelée par le flux
// manuel F2.2.
async function failHotelPaymentCore({ paymentId, actor, reason, businessOperationKey, session }) {
  const actorId = actor.id || actor._id;
  let payment = await inSession(FinancialPayment.findById(paymentId), session);
  if (!payment) fail('FINANCIAL_PAYMENT_NOT_AVAILABLE', 'Paiement introuvable.', 404);
  if (payment.status === 'failed') return { payment, failed: false };
  // PAY-4 §24 — jamais de régression depuis un état terminal réussi : un
  // FAILED tardif après un SUCCESSFUL déjà traité ne rétrograde rien.
  if (payment.status !== 'pending') fail('FINANCIAL_PAYMENT_INVALID_TRANSITION', `Le paiement ${payment.status} ne peut pas être marqué échoué.`, 409);
  payment = await FinancialPayment.findOneAndUpdate({ _id: paymentId, status: 'pending' }, { status: 'failed', failedAt: new Date() }, { new: true, session });
  if (!payment) {
    payment = await inSession(FinancialPayment.findById(paymentId), session);
    if (payment?.status === 'failed') return { payment, failed: false };
    if (payment?.status === 'succeeded') return { payment, failed: false }; // course gagnée par une confirmation entre-temps — jamais écrasée
    fail('FINANCIAL_PAYMENT_INVALID_TRANSITION', 'Le paiement a changé pendant son échec.', 409);
  }
  await appendFinancialLedgerEntry({ eventType: 'payment.failed', domain: payment.domain, establishmentType: payment.establishmentType, establishmentId: payment.establishmentId, entityType: 'FinancialPayment', entityId: payment._id, relatedEntities: [{ entityType: 'FinancialDocument', entityId: payment.metadata?.financialDocumentId }, { entityType: 'HotelReservation', entityId: payment.subjectId }].filter((item) => item.entityId), actorType: 'system', actorId, amountMinor: payment.amountMinor, currency: payment.currency, businessOperationKey, previousState: { status: 'pending' }, newState: { status: 'failed' }, metadata: { method: payment.method, provider: payment.provider, reason: String(reason || '').slice(0, 200) } }, { session });
  return { payment, failed: true };
}
async function failHotelPayment(args) { return runFinancialOperation({ operationName: 'payment.hotel.fail', transactionMode: args.transactionMode || 'auto' }, ({ session }) => failHotelPaymentCore({ ...args, session })); }

module.exports = { createManualPayment, createHotelPayment, confirmHotelPayment, failHotelPayment };
