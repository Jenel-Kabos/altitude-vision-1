const mongoose = require('mongoose');
const { startFinancialMongo, clearFinancialMongo, stopFinancialMongo } = require('./helpers/financialMongoEnvironment');
const Property = require('../models/Property');
require('../models/User');
const Accommodation = require('../models/Accommodation');
const RatePlan = require('../models/RatePlan');
const Reservation = require('../models/AccommodationReservation');
const NightLock = require('../models/AccommodationNightLock');
const service = require('../services/accommodationReservationService');
const { processAccommodationReservationExpiry } = require('../services/accommodationReservationExpiryService');
const mtnProvider = require('../services/payments/providers/mtn/mtnMoMoProvider');
const mtnClient = require('../services/payments/providers/mtn/mtnMoMoClient');
const { initiateMtnAccommodationPayment, reconcileMtnAccommodationPayment } = require('../services/finance/mtnAccommodationPaymentBridge');
const FinancialPayment = require('../models/FinancialPayment');
const PaymentAllocation = require('../models/PaymentAllocation');
const FinancialLedgerEntry = require('../models/FinancialLedgerEntry');
const FinancialRefund = require('../models/FinancialRefund');
const billing = require('../services/finance/accommodationBillingService');
const refundService = require('../services/finance/accommodationRefundService');
const deductionService = require('../services/finance/accommodationDeductionService');
const FinancialDeduction = require('../models/FinancialDeduction');

jest.mock('../services/notificationService', () => ({ notify: jest.fn().mockResolvedValue(undefined) }));
jest.mock('../services/payments/providers/mtn/mtnMoMoProvider');
jest.mock('../services/payments/providers/mtn/mtnMoMoClient');
jest.setTimeout(120000);
beforeAll(startFinancialMongo); afterEach(clearFinancialMongo); afterAll(stopFinancialMongo);

async function setup() {
  const owner = new mongoose.Types.ObjectId();
  const property = await Property.create({ title: 'Maison garantie', description: 'Maison meublée de test avec une description complète.', pole: 'Altimmo', type: 'Villa', status: 'hebergement', price: 50000, address: { arrondissement: 'Bacongo', city: 'Brazzaville' }, latitude: -4.26, longitude: 15.28, images: ['https://example.test/house.jpg'], surface: 100, statusAdmin: 'Validée', availability: 'Disponible', owner });
  const accommodation = await Accommodation.create({ property: property._id, accommodationType: 'maison_meublee', publicationStatus: 'publie', capacity: { maxAdults: 4, maxChildren: 2 }, createdBy: owner });
  const rate = await RatePlan.create({ accommodation: accommodation._id, mode: 'nightly', amount: 50000, currency: 'XAF', active: true, createdBy: owner });
  return { owner, accommodation, rate };
}

const request = (accommodation, guest, from = '2027-09-10', to = '2027-09-15', now) => service.create({ input: { accommodation: accommodation._id, checkInDate: from, checkOutDate: to, adults: 1 }, user: { id: guest, role: 'Client' }, now });

test('crée snapshot, garantie et hold de deux heures, puis bloque un concurrent', async () => {
  const { accommodation } = await setup(); const now = new Date('2027-09-01T10:00:00Z');
  const first = await request(accommodation, new mongoose.Types.ObjectId(), undefined, undefined, now);
  expect(first).toMatchObject({ status: 'pending_payment', nights: 5, total: 250000, remainingAmount: 250000 });
  expect(first.paymentExpiresAt.toISOString()).toBe('2027-09-01T12:00:00.000Z');
  expect(first.pricingSnapshot).toMatchObject({ nightlyRate: 50000, total: 250000, requiredToConfirm: 50000, currency: 'XAF' });
  expect(await NightLock.countDocuments({ sourceId: first._id, lockType: 'hold' })).toBe(5);
  await expect(request(accommodation, new mongoose.Types.ObjectId(), '2027-09-12', '2027-09-14', now)).rejects.toMatchObject({ code: 'DATES_UNAVAILABLE' });
});

test('le snapshot ne change pas avec le RatePlan et la confirmation exige la garantie', async () => {
  const { accommodation, rate, owner } = await setup(); const now = new Date('2027-09-01T10:00:00Z');
  const reservation = await request(accommodation, new mongoose.Types.ObjectId(), undefined, undefined, now);
  rate.active = false; await rate.save(); await RatePlan.create({ accommodation: accommodation._id, mode: 'nightly', amount: 65000, currency: 'XAF', active: true, createdBy: owner });
  await expect(service.transition({ id: reservation._id, to: 'confirmed', user: { id: owner, role: 'Admin' } })).rejects.toMatchObject({ code: 'INVALID_TRANSITION' });
  await expect(service.confirmFromValidatedPayment({ reservationId: reservation._id, now: new Date('2027-09-01T11:00:00Z') })).rejects.toMatchObject({ code: 'GUARANTEE_PAYMENT_INSUFFICIENT' });
  await Reservation.updateOne({ _id: reservation._id }, { $set: { amountPaid: 50000, remainingAmount: 200000, paymentStatus: 'partially_paid' } });
  const confirmed = await service.confirmFromValidatedPayment({ reservationId: reservation._id, now: new Date('2027-09-01T11:00:00Z') });
  expect(confirmed.status).toBe('confirmed'); expect(confirmed.total).toBe(250000); expect(confirmed.pricingSnapshot.nightlyRate).toBe(50000);
  expect(await NightLock.countDocuments({ sourceId: reservation._id, lockType: 'confirmed', expiresAt: null })).toBe(5);
});

test('expiration CAS idempotente libère le hold et ne réactive pas un paiement tardif', async () => {
  const { accommodation } = await setup(); const now = new Date('2027-09-01T10:00:00Z');
  const reservation = await request(accommodation, new mongoose.Types.ObjectId(), undefined, undefined, now);
  const atDeadline = new Date('2027-09-01T12:00:00Z');
  const [a, b] = await Promise.all([processAccommodationReservationExpiry({ now: atDeadline }), processAccommodationReservationExpiry({ now: atDeadline })]);
  expect(a.expired + b.expired).toBe(1);
  expect((await Reservation.findById(reservation._id)).status).toBe('expired');
  expect(await NightLock.countDocuments({ sourceId: reservation._id })).toBe(0);
  await Reservation.updateOne({ _id: reservation._id }, { $set: { amountPaid: 50000 } });
  await expect(service.confirmFromValidatedPayment({ reservationId: reservation._id, now: new Date('2027-09-01T12:01:00Z') })).rejects.toMatchObject({ code: 'RESERVATION_NOT_PENDING_PAYMENT' });
});

test('annulation client conserve exactement la première nuit et libère les nuits', async () => {
  const { accommodation } = await setup(); const guest = new mongoose.Types.ObjectId();
  const reservation = await request(accommodation, guest, undefined, undefined, new Date('2027-09-01T10:00:00Z'));
  await Reservation.updateOne({ _id: reservation._id }, { $set: { amountPaid: 150000, remainingAmount: 100000, paymentStatus: 'partially_paid' } });
  await service.confirmFromValidatedPayment({ reservationId: reservation._id, now: new Date('2027-09-01T11:00:00Z') });
  const cancelled = await service.transition({ id: reservation._id, to: 'cancelled', user: { id: guest, role: 'Client' }, reason: 'Annulation client' });
  expect(cancelled).toMatchObject({ cancellationActor: 'client', nonRefundableAmount: 50000, refundableAmount: 100000, refundPolicyApplied: 'client_guarantee_retained' });
  expect(await NightLock.countDocuments({ sourceId: reservation._id })).toBe(0);
});

test('STAY-02/03: le check-in accepte la seule garantie et la première nuit est déjà couverte', async () => {
  const { accommodation, owner } = await setup(); const guest = new mongoose.Types.ObjectId();
  const reservation = await request(accommodation, guest, '2027-09-10', '2027-09-15', new Date('2027-09-01T10:00:00Z'));
  await Reservation.updateOne({ _id: reservation._id }, { $set: { amountPaid: 50000, remainingAmount: 200000, paymentStatus: 'partially_paid' } });
  await service.confirmFromValidatedPayment({ reservationId: reservation._id, now: new Date('2027-09-01T11:00:00Z') });
  const checkedIn = await service.transition({ id: reservation._id, to: 'checked_in', user: { id: owner, role: 'Proprietaire' }, now: new Date('2027-09-10T15:00:00Z') });
  expect(checkedIn).toMatchObject({ status: 'checked_in', amountPaid: 50000, remainingAmount: 200000 });
});

test.each([
  ['owner', 250000, 150000],
  ['platform', 250000, 150000],
  ['owner', 150000, 50000],
  ['platform', 100000, 0],
])('INT-03/06: interruption %s après deux nuits, payé %i → remboursement %i', async (actorKind, paid, expectedRefund) => {
  const { accommodation, owner } = await setup(); const guest = new mongoose.Types.ObjectId();
  const reservation = await request(accommodation, guest, '2027-09-10', '2027-09-15', new Date('2027-09-01T10:00:00Z'));
  await billing.ensureAccommodationInvoice({ reservationId: reservation._id, actor: { id: guest } });
  const { payment } = await billing.createAccommodationPayment({ reservationId: reservation._id, amountMinor: paid, method: 'cash', reference: `INT-${actorKind}-${paid}`, actor: { id: guest }, idempotencyKey: `int-payment-${actorKind}-${paid}` });
  await billing.confirmAndAllocateAccommodationPayment({ paymentId: payment._id, actor: { id: guest }, idempotencyKey: `int-confirm-${actorKind}-${paid}` });
  await service.transition({ id: reservation._id, to: 'checked_in', user: { id: owner, role: 'Proprietaire' }, now: new Date('2027-09-10T15:00:00Z') });
  const actor = actorKind === 'owner' ? { id: owner, role: 'Proprietaire' } : { id: new mongoose.Types.ObjectId(), role: 'Admin' };
  const interrupted = await service.transition({ id: reservation._id, to: 'cancelled', user: actor, reason: 'Interruption non imputable au client', responsibility: 'non_client', now: new Date('2027-09-12T10:00:00Z') });
  expect(interrupted).toMatchObject({ cancellationActor: actorKind, nonRefundableAmount: 100000, refundableAmount: expectedRefund });
  const refunds = await refundService.ensureCancellationRefunds({ reservationId: reservation._id, actor });
  expect(refunds.reduce((sum, refund) => sum + refund.amountMinor, 0)).toBe(expectedRefund);
});

test('INT-08/09/12/13: une interruption non qualifiee ne contourne pas la politique de faute client', async () => {
  const { accommodation, owner } = await setup(); const guest = new mongoose.Types.ObjectId();
  const reservation = await request(accommodation, guest, '2027-09-10', '2027-09-15', new Date('2027-09-01T10:00:00Z'));
  await billing.ensureAccommodationInvoice({ reservationId: reservation._id, actor: { id: guest } });
  const { payment } = await billing.createAccommodationPayment({ reservationId: reservation._id, amountMinor: 250000, method: 'cash', reference: 'INT-UNQUALIFIED', actor: { id: guest }, idempotencyKey: 'int-unqualified-payment' });
  await billing.confirmAndAllocateAccommodationPayment({ paymentId: payment._id, actor: { id: guest }, idempotencyKey: 'int-unqualified-confirm' });
  await service.transition({ id: reservation._id, to: 'checked_in', user: { id: owner, role: 'Proprietaire' }, now: new Date('2027-09-10T15:00:00Z') });
  await expect(service.transition({ id: reservation._id, to: 'cancelled', user: { id: owner, role: 'Proprietaire' }, reason: 'Motif non qualifie', now: new Date('2027-09-12T10:00:00Z'), consumedNights: 0, refundableAmount: 250000 }))
    .rejects.toMatchObject({ code: 'INTERRUPTION_RESPONSIBILITY_REQUIRED' });
  expect(await FinancialRefund.countDocuments({ subjectId: reservation._id })).toBe(0);
});

test('FAULT-RED: interruption owner imputable au client utilise les nuits consommees sans double garantie', async () => {
  const { accommodation, owner } = await setup(); const guest = new mongoose.Types.ObjectId();
  const reservation = await request(accommodation, guest, '2027-09-10', '2027-09-15', new Date('2027-09-01T10:00:00Z'));
  await billing.ensureAccommodationInvoice({ reservationId: reservation._id, actor: { id: guest } });
  const { payment } = await billing.createAccommodationPayment({ reservationId: reservation._id, amountMinor: 250000, method: 'cash', reference: 'FAULT-RED', actor: { id: guest }, idempotencyKey: 'fault-red-payment' });
  await billing.confirmAndAllocateAccommodationPayment({ paymentId: payment._id, actor: { id: guest }, idempotencyKey: 'fault-red-confirm' });
  await service.transition({ id: reservation._id, to: 'checked_in', user: { id: owner, role: 'Proprietaire' }, now: new Date('2027-09-10T15:00:00Z') });
  const interrupted = await service.transition({ id: reservation._id, to: 'cancelled', user: { id: owner, role: 'Proprietaire' }, responsibility: 'client', reason: 'Violation grave documentee', now: new Date('2027-09-12T10:00:00Z') });
  expect(interrupted).toMatchObject({ cancellationActor: 'owner', cancellationResponsibility: 'client', nonRefundableAmount: 100000, refundableAmount: 150000 });
});

test.each([
  ['approved 40k', 40000, true, 110000, 40000],
  ['pending 40k', 40000, false, 150000, 0],
  ['approved 200k capped', 200000, true, 0, 150000],
])('FAULT A-F: %s', async (_label, reported, approve, expectedRefund, expectedApplied) => {
  const { accommodation, owner } = await setup(); const guest = new mongoose.Types.ObjectId(); const validator = new mongoose.Types.ObjectId();
  const reservation = await request(accommodation, guest, '2027-09-10', '2027-09-15', new Date('2027-09-01T10:00:00Z'));
  await billing.ensureAccommodationInvoice({ reservationId: reservation._id, actor: { id: guest } });
  const { payment } = await billing.createAccommodationPayment({ reservationId: reservation._id, amountMinor: 250000, method: 'cash', reference: `FAULT-${reported}-${approve}`, actor: { id: guest }, idempotencyKey: `fault-${reported}-${approve}` });
  await billing.confirmAndAllocateAccommodationPayment({ paymentId: payment._id, actor: { id: guest }, idempotencyKey: `fault-confirm-${reported}-${approve}` });
  await service.transition({ id: reservation._id, to: 'checked_in', user: { id: owner, role: 'Proprietaire' }, now: new Date('2027-09-10T15:00:00Z') });
  const deduction = await deductionService.report({ reservation: await Reservation.findById(reservation._id), category: 'damage', description: 'Constat documente', reportedAmountMinor: reported, evidence: [{ url: 'https://example.test/proof.jpg', type: 'photo' }], actor: { id: owner }, businessOperationKey: `report-${reported}-${approve}` });
  if (approve) await deductionService.validate({ deductionId: deduction._id, approved: true, actor: { id: validator }, businessOperationKey: `validate-${reported}-${approve}` });
  const interrupted = await service.transition({ id: reservation._id, to: 'cancelled', user: { id: owner, role: 'Proprietaire' }, responsibility: 'client', reason: 'Faute client documentee', now: new Date('2027-09-12T10:00:00Z') });
  expect(interrupted.refundableAmount).toBe(expectedRefund);
  expect(interrupted.refundCalculationSnapshot.appliedDeductions).toBe(expectedApplied);
  await refundService.ensureCancellationRefunds({ reservationId: reservation._id, actor: { id: owner } });
  expect((await FinancialRefund.find({ subjectId: reservation._id })).reduce((sum, row) => sum + row.amountMinor, 0)).toBe(expectedRefund);
  expect((await FinancialDeduction.findById(deduction._id)).appliedAmountMinor).toBe(expectedApplied);
});

test('FAULT-CONCURRENCY: double approval et approve/reject sont CAS, application plafonnee et idempotente', async () => {
  const { accommodation, owner } = await setup(); const guest = new mongoose.Types.ObjectId(); const validatorA = new mongoose.Types.ObjectId(); const validatorB = new mongoose.Types.ObjectId();
  const reservation = await request(accommodation, guest, '2027-09-10', '2027-09-15', new Date('2027-09-01T10:00:00Z'));
  const first = await deductionService.report({ reservation, category:'damage', description:'Course validation', reportedAmountMinor:200000, evidence:[{url:'https://example.test/a.jpg',type:'photo'}], actor:{id:owner}, businessOperationKey:'race-validation' });
  await Promise.all([
    deductionService.validate({ deductionId:first._id, approved:true, approvedAmountMinor:200000, actor:{id:validatorA}, businessOperationKey:'race-approve-a' }),
    deductionService.validate({ deductionId:first._id, approved:true, approvedAmountMinor:180000, actor:{id:validatorB}, businessOperationKey:'race-approve-b' }),
  ]);
  expect(await FinancialLedgerEntry.countDocuments({ entityId:first._id, eventType:'deduction.approved' })).toBe(1);
  const second = await deductionService.report({ reservation, category:'cleaning', description:'Course approve reject', reportedAmountMinor:40000, evidence:[{url:'https://example.test/b.jpg',type:'photo'}], actor:{id:owner}, businessOperationKey:'race-decision' });
  await Promise.all([
    deductionService.validate({ deductionId:second._id, approved:true, actor:{id:validatorA}, businessOperationKey:'race-decision-approve' }),
    deductionService.validate({ deductionId:second._id, approved:false, reason:'Rejet', actor:{id:validatorB}, businessOperationKey:'race-decision-reject' }),
  ]);
  expect(['approved','rejected']).toContain((await FinancialDeduction.findById(second._id)).status);
  expect(await FinancialLedgerEntry.countDocuments({ entityId:second._id, eventType:{ $in:['deduction.approved','deduction.rejected'] } })).toBe(1);
  const [appliedA, appliedB] = await Promise.all([deductionService.applyApproved({reservationId:reservation._id,maximumMinor:150000}), deductionService.applyApproved({reservationId:reservation._id,maximumMinor:150000})]);
  expect(appliedA).toBeLessThanOrEqual(150000); expect(appliedB).toBeLessThanOrEqual(150000);
  expect((await FinancialDeduction.find({reservation:reservation._id})).reduce((sum,row)=>sum+row.appliedAmountMinor,0)).toBeLessThanOrEqual(150000);
});

test('FAULT-CONCURRENCY: approval/report concurrents avec refund reserve ne changent pas le snapshot ni ne creent de dette', async () => {
  const { accommodation, owner } = await setup(); const guest = new mongoose.Types.ObjectId(); const validator = new mongoose.Types.ObjectId();
  const reservation = await request(accommodation, guest, '2027-09-10', '2027-09-15', new Date('2027-09-01T10:00:00Z'));
  await billing.ensureAccommodationInvoice({ reservationId:reservation._id, actor:{id:guest} });
  const { payment } = await billing.createAccommodationPayment({ reservationId:reservation._id, amountMinor:250000, method:'cash', reference:'FAULT-RACE-REFUND', actor:{id:guest}, idempotencyKey:'fault-race-refund-pay' });
  await billing.confirmAndAllocateAccommodationPayment({ paymentId:payment._id, actor:{id:guest}, idempotencyKey:'fault-race-refund-confirm' });
  await service.transition({ id:reservation._id, to:'checked_in', user:{id:owner,role:'Proprietaire'}, now:new Date('2027-09-10T15:00:00Z') });
  const pending = await deductionService.report({ reservation:await Reservation.findById(reservation._id), category:'damage', description:'Pending au snapshot', reportedAmountMinor:40000, evidence:[{url:'https://example.test/c.jpg',type:'photo'}], actor:{id:owner}, businessOperationKey:'race-refund-pending' });
  await service.transition({ id:reservation._id, to:'cancelled', user:{id:owner,role:'Proprietaire'}, responsibility:'client', reason:'Faute documentee', now:new Date('2027-09-12T10:00:00Z') });
  await Promise.all([
    deductionService.validate({ deductionId:pending._id, approved:true, actor:{id:validator}, businessOperationKey:'race-refund-approve' }),
    refundService.ensureCancellationRefunds({reservationId:reservation._id,actor:{id:owner}}),
    refundService.ensureCancellationRefunds({reservationId:reservation._id,actor:{id:owner}}),
    deductionService.report({ reservation:await Reservation.findById(reservation._id), category:'other', description:'Concurrent report', reportedAmountMinor:90000, evidence:[], actor:{id:owner}, businessOperationKey:'race-concurrent-report' }),
  ]);
  const refunds = await FinancialRefund.find({subjectId:reservation._id});
  expect(refunds).toHaveLength(1); expect(refunds[0].amountMinor).toBe(150000);
  expect(refunds[0].amountMinor).toBeGreaterThanOrEqual(0);
  expect(await FinancialLedgerEntry.countDocuments({entityId:refunds[0]._id,eventType:'refund.required'})).toBe(1);
});

test('INT-14/15/16: repetition et concurrence ne creent qu un remboursement', async () => {
  const { accommodation, owner } = await setup(); const guest = new mongoose.Types.ObjectId();
  const reservation = await request(accommodation, guest, '2027-09-10', '2027-09-15', new Date('2027-09-01T10:00:00Z'));
  await billing.ensureAccommodationInvoice({ reservationId: reservation._id, actor: { id: guest } });
  const { payment } = await billing.createAccommodationPayment({ reservationId: reservation._id, amountMinor: 250000, method: 'cash', reference: 'INT-IDEMPOTENT', actor: { id: guest }, idempotencyKey: 'int-idempotent-payment' });
  await billing.confirmAndAllocateAccommodationPayment({ paymentId: payment._id, actor: { id: guest }, idempotencyKey: 'int-idempotent-confirm' });
  await service.transition({ id: reservation._id, to: 'checked_in', user: { id: owner, role: 'Proprietaire' }, now: new Date('2027-09-10T15:00:00Z') });
  const args = { id: reservation._id, to: 'cancelled', user: { id: owner, role: 'Proprietaire' }, reason: 'Interruption non imputable', responsibility: 'non_client', now: new Date('2027-09-12T10:00:00Z') };
  await service.transition(args);
  await service.transition(args);
  await Promise.all([
    refundService.ensureCancellationRefunds({ reservationId: reservation._id, actor: args.user }),
    refundService.ensureCancellationRefunds({ reservationId: reservation._id, actor: args.user }),
  ]);
  expect(await FinancialRefund.countDocuments({ subjectId: reservation._id })).toBe(1);
  const refund = await FinancialRefund.findOne({ subjectId: reservation._id });
  expect(await FinancialLedgerEntry.countDocuments({ entityId: refund._id, eventType: 'refund.required' })).toBe(1);
});

test('annulation client crée un FinancialRefund autoritaire et la finalisation manuelle est idempotente', async () => {
  const { accommodation } = await setup(); const guest = new mongoose.Types.ObjectId(); const now = new Date();
  const reservation = await request(accommodation, guest, undefined, undefined, now);
  await billing.ensureAccommodationInvoice({ reservationId: reservation._id, actor: { id: guest } });
  const { payment } = await billing.createAccommodationPayment({ reservationId: reservation._id, amountMinor: 150000, method: 'cash', reference: 'PAY-REFUND-1', actor: { id: guest }, idempotencyKey: 'pay-refund-1' });
  await billing.confirmAndAllocateAccommodationPayment({ paymentId: payment._id, actor: { id: guest }, idempotencyKey: 'confirm-refund-1' });
  await service.transition({ id: reservation._id, to: 'cancelled', user: { id: guest, role: 'Client' }, reason: 'Annulation client' });
  await refundService.ensureCancellationRefunds({ reservationId: reservation._id, actor: { id: guest } });
  const refund = await FinancialRefund.findOne({ subjectId: reservation._id });
  expect(refund).toMatchObject({ amountMinor: 100000, currency: 'XAF', reasonCode: 'CLIENT_CANCELLATION', status: 'requested', providerRefundSupported: false });
  expect(await FinancialLedgerEntry.countDocuments({ entityId: refund._id, eventType: 'refund.required' })).toBe(1);
  await refundService.approveRefund({ refundId: refund._id, actor: { id: new mongoose.Types.ObjectId() }, idempotencyKey: 'approve-refund-1' });
  await expect(refundService.completeManualRefund({ refundId: refund._id, reference: 'BAD-AMOUNT', method: 'cash', amountMinor: 150000, actor: { id: new mongoose.Types.ObjectId() }, idempotencyKey: 'bad-amount' })).rejects.toMatchObject({ code: 'FINANCIAL_REFUND_AMOUNT_MISMATCH' });
  const args = { refundId: refund._id, reference: 'MTN-MANUAL-001', method: 'bank_transfer', amountMinor: 100000, effectiveDate: now, actor: { id: new mongoose.Types.ObjectId() }, idempotencyKey: 'complete-refund-1' };
  const [first, second] = await Promise.allSettled([refundService.completeManualRefund(args), refundService.completeManualRefund(args)]);
  expect([first.status, second.status].filter((status) => status === 'fulfilled').length).toBeGreaterThanOrEqual(1);
  expect((await FinancialRefund.findById(refund._id)).status).toBe('completed');
  expect((await FinancialPayment.findById(payment._id)).refundedAmountMinor).toBe(100000);
  expect(await FinancialLedgerEntry.countDocuments({ entityId: refund._id, eventType: 'refund.completed' })).toBe(1);
});

test.each([['owner', 'OWNER_CANCELLATION'], ['platform', 'PLATFORM_CANCELLATION']])('annulation %s rembourse la totalité sans retenir la garantie', async (actorKind, reasonCode) => {
  const { accommodation, owner } = await setup(); const guest = new mongoose.Types.ObjectId(); const now = new Date();
  const reservation = await request(accommodation, guest, undefined, undefined, now);
  await billing.ensureAccommodationInvoice({ reservationId: reservation._id, actor: { id: guest } });
  const { payment } = await billing.createAccommodationPayment({ reservationId: reservation._id, amountMinor: 150000, method: 'cash', reference: `PAY-${actorKind}`, actor: { id: guest }, idempotencyKey: `pay-${actorKind}` });
  await billing.confirmAndAllocateAccommodationPayment({ paymentId: payment._id, actor: { id: guest }, idempotencyKey: `confirm-${actorKind}` });
  const actor = actorKind === 'owner' ? { id: owner, role: 'Proprietaire' } : { id: new mongoose.Types.ObjectId(), role: 'Admin' };
  await service.transition({ id: reservation._id, to: 'cancelled', user: actor, reason: `Annulation ${actorKind}` });
  await refundService.ensureCancellationRefunds({ reservationId: reservation._id, actor });
  expect(await FinancialRefund.findOne({ subjectId: reservation._id })).toMatchObject({ amountMinor: 150000, reasonCode });
});

test('MTN crée une seule intention au montant serveur et le statut distant confirmé alloue puis confirme', async () => {
  const { accommodation } = await setup(); const guest = new mongoose.Types.ObjectId();
  const reservation = await request(accommodation, guest, undefined, undefined, new Date());
  mtnClient.generateReferenceId.mockReturnValue('mtn-accommodation-reference');
  mtnProvider.normalizeMsisdn.mockReturnValue('242060000000');
  mtnProvider.initiatePayment.mockResolvedValue({ providerStatus: 'PENDING', normalizedStatus: 'pending' });
  const args = { reservationId: reservation._id, msisdn: '060000000', actor: { id: guest }, businessOperationKey: 'mtn-accommodation-init' };
  const first = await initiateMtnAccommodationPayment(args);
  const replay = await initiateMtnAccommodationPayment(args);
  expect(first.amountMinor).toBe(50000);
  expect(String(replay.payment._id)).toBe(String(first.payment._id));
  expect(mtnProvider.initiatePayment).toHaveBeenCalledTimes(1);
  expect(await FinancialPayment.countDocuments({ subjectId: reservation._id, provider: 'mtn_direct' })).toBe(1);
  mtnProvider.getStatus.mockResolvedValue({ status: 'SUCCESSFUL', normalizedStatus: 'succeeded' });
  const confirmed = await reconcileMtnAccommodationPayment({ paymentId: first.payment._id, actor: { id: guest }, businessOperationKey: 'mtn-accommodation-confirm' });
  expect(confirmed.transition).toBe('confirmed');
  expect((await Reservation.findById(reservation._id)).status).toBe('confirmed');
  expect(await FinancialPayment.countDocuments({ subjectId: reservation._id, status: 'succeeded' })).toBe(1);
  expect(await NightLock.countDocuments({ sourceId: reservation._id, lockType: 'confirmed' })).toBe(5);
  const duplicate = await reconcileMtnAccommodationPayment({ paymentId: first.payment._id, actor: { id: guest }, businessOperationKey: 'mtn-accommodation-confirm' });
  expect(duplicate.transition).toBe('none');
});

test('un succès MTN tardif reste non alloué et exige un remboursement', async () => {
  const { accommodation } = await setup(); const guest = new mongoose.Types.ObjectId(); const now = new Date();
  const reservation = await request(accommodation, guest, undefined, undefined, now);
  mtnClient.generateReferenceId.mockReturnValue('mtn-late-reference'); mtnProvider.normalizeMsisdn.mockReturnValue('242060000000'); mtnProvider.initiatePayment.mockResolvedValue({ normalizedStatus: 'pending' });
  const initiated = await initiateMtnAccommodationPayment({ reservationId: reservation._id, msisdn: '060000000', actor: { id: guest }, businessOperationKey: 'mtn-late-init', now });
  await Reservation.updateOne({ _id: reservation._id }, { $set: { status: 'expired', paymentExpiresAt: new Date(now.getTime() - 1) } });
  await NightLock.deleteMany({ sourceId: reservation._id });
  mtnProvider.getStatus.mockResolvedValue({ status: 'SUCCESSFUL', normalizedStatus: 'succeeded' });
  const late = await reconcileMtnAccommodationPayment({ paymentId: initiated.payment._id, actor: { id: null }, businessOperationKey: 'mtn-late-confirm', now });
  expect(late.transition).toBe('late_payment_refund_required');
  const payment = await FinancialPayment.findById(initiated.payment._id);
  expect(payment).toMatchObject({ status: 'succeeded', providerRefundStatus: 'refund_required', allocatedAmountMinor: 0 });
  const requiredRefund = await FinancialRefund.findOne({ financialPayment: payment._id });
  expect(requiredRefund).toMatchObject({ amountMinor: 50000, reasonCode: 'LATE_PAYMENT_AFTER_EXPIRY', status: 'requested' });
  expect(await PaymentAllocation.countDocuments({ financialPayment: initiated.payment._id })).toBe(0);
  expect(await FinancialLedgerEntry.countDocuments({ entityId: requiredRefund._id, eventType: 'refund.required' })).toBe(1);
  const replay = await reconcileMtnAccommodationPayment({ paymentId: initiated.payment._id, actor: { id: null }, businessOperationKey: 'mtn-late-confirm', now });
  expect(replay.transition).toBe('none');
  expect(await FinancialLedgerEntry.countDocuments({ entityId: requiredRefund._id, eventType: 'refund.required' })).toBe(1);
  expect((await Reservation.findById(reservation._id)).status).toBe('expired');
  const financeActor = { id: new mongoose.Types.ObjectId() }; await refundService.approveRefund({ refundId: requiredRefund._id, actor: financeActor, idempotencyKey: 'late-approve' });
  await refundService.completeManualRefund({ refundId: requiredRefund._id, reference: 'LATE-EXT-1', method: 'bank_transfer', amountMinor: 50000, actor: financeActor, idempotencyKey: 'late-complete' });
  expect(await FinancialRefund.findById(requiredRefund._id)).toMatchObject({ status: 'completed', manualReference: 'LATE-EXT-1' });
  expect(await FinancialPayment.findById(payment._id)).toMatchObject({ status: 'refunded', providerRefundStatus: 'completed', allocatedAmountMinor: 0, refundedAmountMinor: 50000 });
  expect((await Reservation.findById(reservation._id)).status).toBe('expired');
});

test('STAY-04/06/08: MTN alloue le solde ou une nuit suivante sans refacturer la garantie', async () => {
  const { accommodation } = await setup(); const guest = new mongoose.Types.ObjectId(); const now = new Date();
  const reservation = await request(accommodation, guest, undefined, undefined, now);
  mtnProvider.normalizeMsisdn.mockReturnValue('242060000000'); mtnProvider.initiatePayment.mockResolvedValue({ normalizedStatus: 'pending' }); mtnProvider.getStatus.mockResolvedValue({ status: 'SUCCESSFUL', normalizedStatus: 'succeeded' });
  mtnClient.generateReferenceId.mockReturnValueOnce('stay-guarantee').mockReturnValueOnce('stay-next-night').mockReturnValueOnce('stay-balance');
  const guarantee = await initiateMtnAccommodationPayment({ reservationId: reservation._id, msisdn: '060000000', actor: { id: guest }, businessOperationKey: 'stay-guarantee', now });
  await reconcileMtnAccommodationPayment({ paymentId: guarantee.payment._id, actor: { id: guest }, businessOperationKey: 'stay-guarantee-confirm', now });
  const next = await initiateMtnAccommodationPayment({ reservationId: reservation._id, msisdn: '060000000', actor: { id: guest }, businessOperationKey: 'stay-next', paymentPurpose: 'next_night', now });
  expect(next.amountMinor).toBe(50000);
  await reconcileMtnAccommodationPayment({ paymentId: next.payment._id, actor: { id: guest }, businessOperationKey: 'stay-next-confirm', now });
  expect((await Reservation.findById(reservation._id)).amountPaid).toBe(100000);
  const balance = await initiateMtnAccommodationPayment({ reservationId: reservation._id, msisdn: '060000000', actor: { id: guest }, businessOperationKey: 'stay-balance', paymentPurpose: 'remaining_balance', now });
  expect(balance.amountMinor).toBe(150000);
  await reconcileMtnAccommodationPayment({ paymentId: balance.payment._id, actor: { id: guest }, businessOperationKey: 'stay-balance-confirm', now });
  expect(await PaymentAllocation.countDocuments({ financialDocument: (await Reservation.findById(reservation._id)).financialDocument })).toBe(3);
  expect(await Reservation.findById(reservation._id)).toMatchObject({ amountPaid: 250000, remainingAmount: 0, paymentStatus: 'paid' });
});

test('STAY-11/13/14: départ client après deux nuits retient seulement 100k et réserve 150k de remboursement', async () => {
  const { accommodation } = await setup(); const guest = new mongoose.Types.ObjectId();
  const reservation = await request(accommodation, guest, '2027-09-10', '2027-09-15', new Date('2027-09-01T10:00:00Z'));
  await billing.ensureAccommodationInvoice({ reservationId: reservation._id, actor: { id: guest } });
  const { payment } = await billing.createAccommodationPayment({ reservationId: reservation._id, amountMinor: 250000, method: 'cash', reference: 'STAY-PAID-FULL', actor: { id: guest }, idempotencyKey: 'stay-paid-full' });
  await billing.confirmAndAllocateAccommodationPayment({ paymentId: payment._id, actor: { id: guest }, idempotencyKey: 'stay-paid-full-confirm' });
  await service.transition({ id: reservation._id, to: 'checked_in', user: { id: reservation.owner, role: 'Proprietaire' }, now: new Date('2027-09-10T15:00:00Z') });
  const cancelled = await service.transition({ id: reservation._id, to: 'cancelled', user: { id: guest, role: 'Client' }, reason: 'Départ anticipé', now: new Date('2027-09-12T10:00:00Z') });
  expect(cancelled).toMatchObject({ nonRefundableAmount: 100000, refundableAmount: 150000, refundPolicyApplied: 'client_consumed_stay_retained' });
  await refundService.ensureCancellationRefunds({ reservationId: reservation._id, actor: { id: guest } });
  expect(await FinancialRefund.findOne({ subjectId: reservation._id })).toMatchObject({ amountMinor: 150000, reasonCode: 'CLIENT_CANCELLATION' });
});
