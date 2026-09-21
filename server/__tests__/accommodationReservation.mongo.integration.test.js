const mongoose = require('mongoose');
const { startFinancialMongo, clearFinancialMongo, stopFinancialMongo } = require('./helpers/financialMongoEnvironment');
const Property = require('../models/Property');
require('../models/User');
const Accommodation = require('../models/Accommodation');
const RatePlan = require('../models/RatePlan');
const NightLock = require('../models/AccommodationNightLock');
const Reservation = require('../models/AccommodationReservation');
const service = require('../services/accommodationReservationService');
const billing = require('../services/finance/accommodationBillingService');
const PaymentAllocation = require('../models/PaymentAllocation');
const refundService = require('../services/finance/accommodationRefundService');
const FinancialPayment = require('../models/FinancialPayment');
const FinancialRefund = require('../models/FinancialRefund');

jest.setTimeout(120000);
beforeAll(startFinancialMongo); afterEach(clearFinancialMongo); afterAll(stopFinancialMongo);

const setup = async () => {
  const owner = new mongoose.Types.ObjectId(); const guest1 = new mongoose.Types.ObjectId(); const guest2 = new mongoose.Types.ObjectId();
  const property = await Property.create({ title: 'Villa Réservation Test', description: 'Description complète de la villa destinée aux tests de réservation.', pole: 'Altimmo', type: 'Villa', status: 'hebergement', price: 35000, address: { arrondissement: 'Bacongo', city: 'Brazzaville' }, latitude: -4.26, longitude: 15.28, images: ['https://example.test/villa.jpg'], surface: 100, statusAdmin: 'Validée', availability: 'Disponible', owner });
  const accommodation = await Accommodation.create({ property: property._id, accommodationType: 'villa_meublee', publicationStatus: 'publie', capacity: { maxAdults: 4, maxChildren: 2 }, cleaningFee: 5000, createdBy: owner });
  await RatePlan.create({ accommodation: accommodation._id, mode: 'nightly', amount: 35000, currency: 'XAF', active: true, createdBy: owner });
  return { owner, guest1, guest2, accommodation };
};
const request = (accommodation, guest, from, to) => service.create({ input: { accommodation: accommodation._id, checkInDate: from, checkOutDate: to, adults: 2, children: 0 }, user: { id: guest, role: 'Client' } });
const confirmPaid = async (reservation, amount = reservation.pricingSnapshot.requiredToConfirm) => {
  await Reservation.updateOne({ _id: reservation._id }, { $set: { amountPaid: amount, remainingAmount: Math.max(0, reservation.total - amount), paymentStatus: amount >= reservation.total ? 'paid' : 'partially_paid' } });
  return service.confirmFromValidatedPayment({ reservationId: reservation._id });
};

describe('Réservations des hébergements indépendants', () => {
  test('calcule check-in inclus / check-out exclu et fige le tarif à la confirmation', async () => {
    const { owner, guest1, accommodation } = await setup(); const reservation = await request(accommodation, guest1, '2027-07-10', '2027-07-12');
    expect(reservation.nights).toBe(2); expect(reservation.status).toBe('pending_payment');
    const confirmed = await confirmPaid(reservation);
    expect(confirmed.pricingSnapshot.nightlyRate).toBe(35000); expect(confirmed.total).toBe(75000); expect(confirmed.pricingSnapshot.confirmedAt).toBeTruthy();
  });

  test('refuse les dates invalides et le dépassement de capacité', async () => {
    const { guest1, accommodation } = await setup();
    await expect(request(accommodation, guest1, '2027-07-12', '2027-07-12')).rejects.toMatchObject({ status: 422 });
    await expect(service.create({ input: { accommodation: accommodation._id, checkInDate: '2027-07-12', checkOutDate: '2027-07-14', adults: 5 }, user: { id: guest1, role: 'Client' } })).rejects.toMatchObject({ code: 'CAPACITY_EXCEEDED' });
  });

  test('une seule de deux demandes concurrentes qui se chevauchent obtient le hold', async () => {
    const { guest1, guest2, accommodation } = await setup();
    const results = await Promise.allSettled([request(accommodation, guest1, '2027-08-01', '2027-08-05'), request(accommodation, guest2, '2027-08-03', '2027-08-07')]);
    expect(results.filter((item) => item.status === 'fulfilled')).toHaveLength(1); expect(results.filter((item) => item.status === 'rejected')).toHaveLength(1);
    expect(await NightLock.countDocuments()).toBeGreaterThan(0);
  });

  test('les réservations adjacentes sont autorisées', async () => {
    const { owner, guest1, guest2, accommodation } = await setup();
    const a = await request(accommodation, guest1, '2027-09-10', '2027-09-12'); const b = await request(accommodation, guest2, '2027-09-12', '2027-09-14');
    await confirmPaid(a);
    await expect(confirmPaid(b)).resolves.toMatchObject({ status: 'confirmed' });
  });

  test('annuler libère les nuits et permet une nouvelle confirmation', async () => {
    const { owner, guest1, guest2, accommodation } = await setup(); const a = await request(accommodation, guest1, '2027-10-01', '2027-10-04');
    await confirmPaid(a); await service.transition({ id: a._id, to: 'cancelled', user: { id: guest1, role: 'Client' }, reason: 'Changement de programme' });
    const b = await request(accommodation, guest2, '2027-10-01', '2027-10-04'); await expect(confirmPaid(b)).resolves.toMatchObject({ status: 'confirmed' });
  });

  test('un blocage maintenance possède ses propres verrous et refuse une réservation', async () => {
    const { owner, guest1, accommodation } = await setup(); await service.createBlock({ accommodationId: accommodation._id, input: { startDate: '2027-11-01', endDate: '2027-11-03', type: 'maintenance', reason: 'Travaux' }, user: { id: owner, role: 'Proprietaire' } });
    await expect(request(accommodation, guest1, '2027-11-02', '2027-11-04')).rejects.toMatchObject({ code: 'DATES_UNAVAILABLE' });
  });

  test('un autre propriétaire ne peut pas confirmer la réservation', async () => {
    const { guest1, accommodation } = await setup(); const reservation = await request(accommodation, guest1, '2027-12-01', '2027-12-03');
    await expect(service.transition({ id: reservation._id, to: 'confirmed', user: { id: new mongoose.Types.ObjectId(), role: 'Proprietaire' } })).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  test('check-in et check-out suivent strictement les transitions et sont non répétables', async () => {
    const { owner, guest1, accommodation } = await setup(); const today = new Date(); today.setUTCHours(0, 0, 0, 0);
    const from = new Date(today.getTime() - 86400000).toISOString().slice(0, 10); const to = new Date(today.getTime() + 86400000).toISOString().slice(0, 10);
    const reservation = await request(accommodation, guest1, from, to); await confirmPaid(reservation);
    const checkedIn = await service.transition({ id: reservation._id, to: 'checked_in', user: { id: owner, role: 'Proprietaire' } }); expect(checkedIn.checkedInAt).toBeTruthy();
    await expect(service.transition({ id: reservation._id, to: 'checked_in', user: { id: owner, role: 'Proprietaire' } })).rejects.toMatchObject({ code: 'INVALID_TRANSITION' });
    const checkedOut = await service.transition({ id: reservation._id, to: 'checked_out', user: { id: owner, role: 'Proprietaire' } }); expect(checkedOut.checkedOutAt).toBeTruthy();
    await expect(service.transition({ id: reservation._id, to: 'checked_out', user: { id: owner, role: 'Proprietaire' } })).rejects.toMatchObject({ code: 'INVALID_TRANSITION' });
  });

  test('le snapshot confirmé reste immuable quand le tarif courant change', async () => {
    const { owner, guest1, accommodation } = await setup(); const reservation = await request(accommodation, guest1, '2028-01-10', '2028-01-12');
    await confirmPaid(reservation);
    await RatePlan.updateOne({ accommodation: accommodation._id, mode: 'nightly' }, { $set: { amount: 99000 } });
    const stored = await Reservation.findById(reservation._id); expect(stored.pricingSnapshot.nightlyRate).toBe(35000); expect(stored.total).toBe(75000);
  });

  test('un hébergement non publié ou en maintenance ne peut pas recevoir de demande', async () => {
    const { guest1, accommodation } = await setup(); accommodation.publicationStatus = 'brouillon'; await accommodation.save();
    await expect(request(accommodation, guest1, '2028-02-01', '2028-02-03')).rejects.toMatchObject({ code: 'ACCOMMODATION_NOT_PUBLISHED' });
    accommodation.publicationStatus = 'publie'; await accommodation.save(); await Property.updateOne({ _id: accommodation.property }, { $set: { availability: 'En maintenance' } });
    await expect(request(accommodation, guest1, '2028-02-01', '2028-02-03')).rejects.toMatchObject({ code: 'ACCOMMODATION_UNAVAILABLE' });
  });

  test('les allocations financières pilotent paiement partiel, solde puis paiement total', async () => {
    const { owner, guest1, accommodation } = await setup(); const actor = { id: owner, role: 'Admin' };
    const pending = await request(accommodation, guest1, '2028-03-01', '2028-03-03');
    const document = await billing.ensureAccommodationInvoice({ reservationId: pending._id, actor });
    expect(document.totalMinor).toBe(75000);
    const first = await billing.createAccommodationPayment({ reservationId: pending._id, amountMinor: 25000, method: 'cash', actor, idempotencyKey: 'acc-pay-1' });
    const partial = await billing.confirmAndAllocateAccommodationPayment({ paymentId: first.payment._id, actor, idempotencyKey: 'acc-confirm-1' });
    expect(partial.reservation).toMatchObject({ amountPaid: 25000, remainingAmount: 50000, paymentStatus: 'partially_paid' });
    const second = await billing.createAccommodationPayment({ reservationId: pending._id, amountMinor: 50000, method: 'mobile_money', actor, idempotencyKey: 'acc-pay-2' });
    const paid = await billing.confirmAndAllocateAccommodationPayment({ paymentId: second.payment._id, actor, idempotencyKey: 'acc-confirm-2' });
    expect(paid.reservation).toMatchObject({ amountPaid: 75000, remainingAmount: 0, paymentStatus: 'paid' });
    expect(await PaymentAllocation.countDocuments({ status: 'active' })).toBe(2);
    await expect(billing.createAccommodationPayment({ reservationId: pending._id, amountMinor: 1, method: 'cash', actor, idempotencyKey: 'acc-overpay' })).rejects.toMatchObject({ code: 'FINANCIAL_DOCUMENT_OVERPAYMENT' });
  });

  test('le remboursement calculé conserve la garantie client et produit un net rapproché', async () => {
    const { owner, guest1, accommodation } = await setup(); const actor = { id: owner, role: 'Admin' };
    const confirmed = await request(accommodation, guest1, '2028-04-01', '2028-04-03');
    await billing.ensureAccommodationInvoice({ reservationId: confirmed._id, actor }); const created = await billing.createAccommodationPayment({ reservationId: confirmed._id, amountMinor: 75000, method: 'cash', actor, idempotencyKey: 'refund-payment' });
    await billing.confirmAndAllocateAccommodationPayment({ paymentId: created.payment._id, actor, idempotencyKey: 'refund-confirm' });
    const cancelled = await service.transition({ id: confirmed._id, to: 'cancelled', user: { id: guest1, role: 'Client' }, reason: 'Annulation client' }); await refundService.ensureCancellationRefunds({ reservationId: confirmed._id, actor: { id: guest1 } });
    const requested = await FinancialRefund.findOne({ subjectId: confirmed._id });
    expect(requested.amountMinor).toBe(75000 - cancelled.pricingSnapshot.requiredToConfirm);
    await refundService.approveRefund({ refundId: requested._id, actor, idempotencyKey: 'refund-approve' });
    await refundService.completeManualRefund({ refundId: requested._id, reference: 'DEC-1', method: 'cash', amountMinor: requested.amountMinor, actor, idempotencyKey: 'refund-complete', transactionMode: 'fallback' });
    const summary = await refundService.refundableSummary(confirmed._id); const stored = await Reservation.findById(confirmed._id); const payment = await FinancialPayment.findById(created.payment._id);
    expect(summary.refundedAmount).toBe(requested.amountMinor); expect(summary.netAmountPaid).toBe(cancelled.pricingSnapshot.requiredToConfirm); expect(summary.refundableAmount).toBe(0);
    expect(stored.refundedAmount).toBe(requested.amountMinor); expect(payment.status).toBe('partially_refunded'); expect(await FinancialRefund.countDocuments({ status: 'completed' })).toBe(1);
  });

  test('un double appel concurrent ne complète le remboursement qu’une fois', async () => {
    const { owner, guest1, accommodation } = await setup(); const actor = { id: owner, role: 'Admin' };
    const confirmed = await request(accommodation, guest1, '2028-05-01', '2028-05-02');
    await billing.ensureAccommodationInvoice({ reservationId: confirmed._id, actor }); const created = await billing.createAccommodationPayment({ reservationId: confirmed._id, amountMinor: 40000, method: 'cash', actor, idempotencyKey: 'concurrent-payment' }); await billing.confirmAndAllocateAccommodationPayment({ paymentId: created.payment._id, actor, idempotencyKey: 'concurrent-confirm' });
    await service.transition({ id: confirmed._id, to: 'cancelled', user: actor, reason: 'Annulation plateforme' }); await refundService.ensureCancellationRefunds({ reservationId: confirmed._id, actor }); const requested = await FinancialRefund.findOne({ subjectId: confirmed._id }); await refundService.approveRefund({ refundId: requested._id, actor, idempotencyKey: 'concurrent-approve' });
    const complete = { refundId: requested._id, reference: 'DEC-C', method: 'cash', amountMinor: requested.amountMinor, actor, idempotencyKey: 'concurrent-complete' }; const results = await Promise.allSettled([refundService.completeManualRefund(complete), refundService.completeManualRefund(complete)]);
    expect(results.filter((item) => item.status === 'fulfilled').length).toBeGreaterThanOrEqual(1); expect((await FinancialPayment.findById(created.payment._id)).refundedAmountMinor).toBe(requested.amountMinor);
  });

  test('le fallback compense avant ledger puis reprend la même opération sans doublon', async () => {
    const { owner, guest1, accommodation } = await setup(); const actor = { id: owner, role: 'Admin' };
    const confirmed = await request(accommodation, guest1, '2028-06-01', '2028-06-02'); await billing.ensureAccommodationInvoice({ reservationId: confirmed._id, actor });
    const created = await billing.createAccommodationPayment({ reservationId: confirmed._id, amountMinor: 40000, method: 'cash', actor, idempotencyKey: 'fallback-payment' }); await billing.confirmAndAllocateAccommodationPayment({ paymentId: created.payment._id, actor, idempotencyKey: 'fallback-confirm' });
    await service.transition({ id: confirmed._id, to: 'cancelled', user: actor, reason: 'Annulation plateforme' }); await refundService.ensureCancellationRefunds({ reservationId: confirmed._id, actor }); const requested = await FinancialRefund.findOne({ subjectId: confirmed._id }); await refundService.approveRefund({ refundId: requested._id, actor, idempotencyKey: 'fallback-approve' });
    const complete = { refundId: requested._id, reference: 'DEC-F', method: 'cash', amountMinor: requested.amountMinor, actor, idempotencyKey: 'fallback-complete', transactionMode: 'fallback' };
    await expect(refundService.completeManualRefund({ ...complete, faultInjector: async (point) => { if (point === 'refund.before_ledger') throw new Error('TEST_FAILURE_BEFORE_LEDGER'); } })).rejects.toThrow('TEST_FAILURE_BEFORE_LEDGER');
    expect((await FinancialPayment.findById(created.payment._id)).refundedAmountMinor).toBe(0); expect((await FinancialRefund.findById(requested._id)).status).toBe('approved');
    await refundService.completeManualRefund(complete);
    expect((await FinancialPayment.findById(created.payment._id)).refundedAmountMinor).toBe(requested.amountMinor); expect((await FinancialRefund.findById(requested._id)).status).toBe('completed');
  });
});
