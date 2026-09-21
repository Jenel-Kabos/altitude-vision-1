const mongoose = require('mongoose');
const Accommodation = require('../models/Accommodation');
const Reservation = require('../models/AccommodationReservation');
const Block = require('../models/AccommodationAvailabilityBlock');
const NightLock = require('../models/AccommodationNightLock');
const CalendarMutex = require('../models/AccommodationCalendarMutex');
const RatePlan = require('../models/RatePlan');
const { resolveResourceTenant } = require('./platformTenant/tenantResourceAttributionService');

const HOLD_DURATION_MS = 2 * 60 * 60 * 1000;
const BLOCKING_STATUSES = ['pending_payment', 'confirmed', 'checked_in'];
const TRANSITIONS = Object.freeze({ pending: ['cancelled'], pending_payment: ['cancelled'], confirmed: ['checked_in', 'cancelled', 'no_show'], checked_in: ['checked_out', 'cancelled'], draft: ['pending_payment', 'cancelled'], expired: [], cancelled: [], checked_out: [], no_show: [] });
const fail = (message, status = 422, code = 'ACCOMMODATION_RESERVATION_INVALID') => Object.assign(new Error(message), { status, code });
const parseDate = (value) => {
  if (value instanceof Date) return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value))) throw fail('Date invalide. Format attendu : YYYY-MM-DD.');
  const date = new Date(`${value}T00:00:00.000Z`); if (Number.isNaN(date.getTime())) throw fail('Date invalide.'); return date;
};
const nightsBetween = (start, end) => { const nights = Math.round((end - start) / 86400000); if (nights < 1 || nights > 365) throw fail('La période doit contenir entre 1 et 365 nuits.'); return nights; };
const nightDates = (start, end) => { const dates = []; for (let d = new Date(start); d < end; d = new Date(d.getTime() + 86400000)) dates.push(d); return dates; };
const accommodationWithProperty = (id) => Accommodation.findById(id).populate('property');
const canManage = (user, reservation) => ['Admin', 'Collaborateur', 'GestionnaireImmobilier', 'CommunityManager'].includes(user.role) || String(reservation.owner) === String(user.id || user._id);
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function withCalendarMutex(accommodationId, operation) {
  const token = new mongoose.Types.ObjectId();
  for (let attempt = 0; attempt < 50; attempt += 1) {
    try {
      const now = new Date();
      const mutex = await CalendarMutex.findOneAndUpdate(
        { _id: accommodationId, $or: [{ expiresAt: { $lte: now } }, { token }] },
        { $set: { token, expiresAt: new Date(now.getTime() + 15000) } }, { upsert: true, new: true },
      );
      if (String(mutex.token) === String(token)) {
        try { return await operation(); } finally { await CalendarMutex.deleteOne({ _id: accommodationId, token }); }
      }
    } catch (error) { if (error.code !== 11000) throw error; }
    await delay(10);
  }
  throw fail('Le calendrier est temporairement occupé. Réessayez.', 409, 'CALENDAR_BUSY');
}

async function assertBookable(accommodation, adults, children) {
  if (!accommodation || accommodation.hotel) throw fail('Hébergement indépendant introuvable.', 404);
  if (accommodation.publicationStatus !== 'publie') throw fail('Cet hébergement n’est pas publié.', 409, 'ACCOMMODATION_NOT_PUBLISHED');
  if (accommodation.active === false || accommodation.property?.availability === 'En maintenance') throw fail('Cet hébergement est indisponible.', 409, 'ACCOMMODATION_UNAVAILABLE');
  if (Number(adults) > accommodation.capacity.maxAdults || Number(children || 0) > accommodation.capacity.maxChildren) throw fail('La capacité maximale est dépassée.', 422, 'CAPACITY_EXCEEDED');
}

async function quote(accommodation, start, end) {
  const nights = nightsBetween(start, end);
  const rate = await RatePlan.findOne({ accommodation: accommodation._id, mode: 'nightly', active: true }).sort({ createdAt: -1 });
  if (!rate) throw fail('Aucun tarif par nuit actif.', 409, 'NIGHTLY_RATE_MISSING');
  const nightlyRate = rate.amount; const cleaningFee = accommodation.cleaningFee || 0; const subtotal = nightlyRate * nights;
  const total = subtotal + cleaningFee;
  return { nightlyRate, nights, cleaningFee, serviceFee: 0, discount: 0, taxes: 0, subtotal, fees: cleaningFee, total, requiredToConfirm: Math.min(nightlyRate, total), currency: rate.currency || 'XAF' };
}

async function create({ input, user, now = new Date() }) {
  const start = parseDate(input.checkInDate); const end = parseDate(input.checkOutDate); const nights = nightsBetween(start, end);
  const accommodation = await accommodationWithProperty(input.accommodation); await assertBookable(accommodation, input.adults, input.children);
  let attribution = accommodation.tenant
    ? { status: 'resolved', tenantId: String(accommodation.tenant) }
    : { status: 'unresolved', tenantId: null };
  if (!accommodation.tenant && user.platformTenant) attribution = await resolveResourceTenant({ resourceType: 'Accommodation', resource: accommodation });
  if (user.platformTenant && (attribution.status !== 'resolved' || String(attribution.tenantId) !== String(user.platformTenant._id || user.platformTenant))) {
    throw fail('Hébergement introuvable dans ce contexte tenant.', 404, 'TENANT_RESOURCE_NOT_FOUND');
  }
  const pricing = await quote(accommodation, start, end);
  if (pricing.currency !== 'XAF') throw fail('La réservation des hébergements meublés exige la devise XAF.', 409, 'ACCOMMODATION_CURRENCY_UNSUPPORTED');
  const paymentExpiresAt = new Date(now.getTime() + HOLD_DURATION_MS);
  const reservation = await Reservation.create({ tenant: attribution.status === 'resolved' ? attribution.tenantId : null, accommodation: accommodation._id, guest: user.id, owner: accommodation.property.owner, checkInDate: start, checkOutDate: end, nights,
    guestCount: Number(input.guestCount || (Number(input.adults) + Number(input.children || 0))), adults: input.adults, children: input.children || 0,
    status: 'pending_payment', paymentExpiresAt,
    pricingSnapshot: { ...pricing, checkInDate: start, checkOutDate: end, quotedAt: now },
    subtotal: pricing.subtotal, fees: pricing.fees, total: pricing.total, currency: pricing.currency,
    remainingAmount: pricing.total, specialRequests: input.specialRequests || '', source: input.source || 'public_web', createdBy: user.id });
  try { await acquireLocks(reservation, { lockType: 'hold', expiresAt: paymentExpiresAt, now }); }
  catch (error) { await Reservation.deleteOne({ _id: reservation._id, status: 'pending_payment' }); throw error; }
  return reservation;
}

async function acquireLocks(reservation, { lockType = 'confirmed', expiresAt = null, now = new Date() } = {}) {
  return withCalendarMutex(reservation.accommodation, async () => {
    await NightLock.deleteMany({ lockType: 'hold', expiresAt: { $lte: now } });
    const conflict = await NightLock.exists({ accommodation: reservation.accommodation, date: { $gte: reservation.checkInDate, $lt: reservation.checkOutDate } });
    if (conflict) throw fail('Ces dates ne sont plus disponibles.', 409, 'DATES_UNAVAILABLE');
    const operationToken = new mongoose.Types.ObjectId();
    const docs = nightDates(reservation.checkInDate, reservation.checkOutDate).map((date) => ({ accommodation: reservation.accommodation, date, sourceType: 'reservation', sourceId: reservation._id, operationToken, lockType, expiresAt }));
    try { await NightLock.insertMany(docs, { ordered: true }); return operationToken; }
    catch (error) { await NightLock.deleteMany({ operationToken }); if (error.code === 11000) throw fail('Ces dates ne sont plus disponibles.', 409, 'DATES_UNAVAILABLE'); throw error; }
  });
}

async function confirmFromValidatedPayment({ reservationId, now = new Date(), session = null }) {
  const reservationQuery = Reservation.findById(reservationId); const reservation = await (session ? reservationQuery.session(session) : reservationQuery);
  if (!reservation) throw fail('Réservation introuvable.', 404);
  if (reservation.status === 'confirmed') return reservation;
  if (reservation.status !== 'pending_payment') throw fail('Cette réservation ne peut plus être confirmée.', 409, 'RESERVATION_NOT_PENDING_PAYMENT');
  if (!reservation.paymentExpiresAt || reservation.paymentExpiresAt <= now) throw fail('Le délai de paiement est expiré.', 409, 'PAYMENT_HOLD_EXPIRED');
  if (reservation.currency !== 'XAF') throw fail('Devise de paiement invalide.', 409, 'PAYMENT_CURRENCY_MISMATCH');
  if (Number(reservation.amountPaid) < Number(reservation.pricingSnapshot?.requiredToConfirm || 0)) throw fail('La garantie d’une nuitée n’est pas entièrement payée.', 409, 'GUARANTEE_PAYMENT_INSUFFICIENT');
  return withCalendarMutex(reservation.accommodation, async () => {
    const heldQuery = NightLock.countDocuments({ accommodation: reservation.accommodation, sourceType: 'reservation', sourceId: reservation._id, lockType: 'hold', expiresAt: { $gt: now } });
    const held = await (session ? heldQuery.session(session) : heldQuery);
    if (held !== reservation.nights) throw fail('Le hold de réservation n’est plus actif.', 409, 'PAYMENT_HOLD_LOST');
    const updated = await Reservation.findOneAndUpdate(
      { _id: reservation._id, status: 'pending_payment', paymentExpiresAt: { $gt: now }, amountPaid: { $gte: reservation.pricingSnapshot.requiredToConfirm } },
      { $set: { status: 'confirmed', 'pricingSnapshot.confirmedAt': now }, $push: { workflowHistory: { from: 'pending_payment', to: 'confirmed', at: now, reason: 'Garantie d’une nuitée validée et allouée' } } },
      { new: true, session },
    );
    if (!updated) throw fail('Confirmation concurrente refusée.', 409, 'CONFIRMATION_RACE_LOST');
    await NightLock.updateMany({ sourceType: 'reservation', sourceId: reservation._id, lockType: 'hold' }, { $set: { lockType: 'confirmed', expiresAt: null } }, { session });
    return updated;
  });
}

async function expirePendingReservation({ reservationId, now = new Date() }) {
  const reservation = await Reservation.findOneAndUpdate(
    { _id: reservationId, status: 'pending_payment', paymentExpiresAt: { $lte: now }, $expr: { $lt: ['$amountPaid', '$pricingSnapshot.requiredToConfirm'] } },
    { $set: { status: 'expired' }, $push: { workflowHistory: { from: 'pending_payment', to: 'expired', at: now, reason: 'Délai de paiement de 2 heures expiré' } } },
    { new: true },
  );
  if (!reservation) return null;
  await NightLock.deleteMany({ sourceType: 'reservation', sourceId: reservation._id, lockType: 'hold' });
  return reservation;
}

async function transition({ id, to, user, reason, responsibility, authorizedReservation = null, now = new Date() }) {
  const reservation = authorizedReservation || await Reservation.findById(id); if (!reservation) throw fail('Réservation introuvable.', 404);
  const userId = user.id || user._id; const isGuest = String(reservation.guest) === String(userId);
  if (to === 'cancelled' ? !(isGuest || canManage(user, reservation)) : !canManage(user, reservation)) throw fail('Accès refusé.', 403, 'FORBIDDEN');
  if (to === 'cancelled' && reservation.status === 'cancelled') return reservation;
  if (!TRANSITIONS[reservation.status]?.includes(to)) throw fail(`Transition ${reservation.status} → ${to} interdite.`, 409, 'INVALID_TRANSITION');
  if (to === 'confirmed') throw fail('La confirmation est déclenchée exclusivement par un paiement validé.', 403, 'PAYMENT_REQUIRED_FOR_CONFIRMATION');
  if (to === 'cancelled') {
    const actorKind = isGuest ? 'client' : String(reservation.owner) === String(userId) ? 'owner' : 'platform';
    if (reservation.status === 'checked_in' && actorKind !== 'client' && !['client', 'non_client'].includes(responsibility)) throw fail('La responsabilite de interruption doit etre qualifiee.', 409, 'INTERRUPTION_RESPONSIBILITY_REQUIRED');
    const cancelledAt = now; const paid = Number(reservation.amountPaid || 0);
    const { getStayFinancialSummary } = require('./finance/accommodationStayBalanceService');
    const stay = getStayFinancialSummary(reservation, { now: cancelledAt, validatedPaidAmount: paid, alreadyRefundedAmount: 0 });
    let nonRefundableAmount = actorKind === 'client'
      ? Math.min(paid, stay.nonRefundableAmount)
      : reservation.checkedInAt ? Math.min(paid, stay.consumedStayAmount) : 0;
    if (reservation.checkedInAt && actorKind !== 'client' && responsibility === 'client') {
      const { summary, calculateDeductionImpact } = require('./finance/accommodationDeductionService');
      const deductions = await summary(reservation._id);
      const impact = calculateDeductionImpact({ validatedPaidAmount: paid, consumedStayAmount: stay.consumedStayAmount, validatedDeductions: deductions.validatedDeductions });
      nonRefundableAmount = Math.min(paid, stay.consumedStayAmount + impact.appliedDeductions);
      reservation.refundCalculationSnapshot = impact;
    }
    reservation.cancelledAt = cancelledAt; reservation.cancelledBy = userId; reservation.cancellationReason = reason || 'Annulation sans motif détaillé';
    reservation.cancellationActor = actorKind; reservation.cancellationResponsibility = actorKind === 'client' ? 'client' : (responsibility || 'non_client'); reservation.nonRefundableAmount = nonRefundableAmount;
    reservation.refundableAmount = Math.max(0, paid - nonRefundableAmount);
    reservation.refundPolicyApplied = paid <= 0 ? 'none' : actorKind === 'client'
      ? (reservation.checkedInAt ? 'client_consumed_stay_retained' : 'client_guarantee_retained')
      : (reservation.checkedInAt ? (responsibility === 'client' ? 'client_fault_validated_deductions' : 'non_client_consumed_stay_retained') : 'full_refund');
    await NightLock.deleteMany({ sourceType: 'reservation', sourceId: reservation._id });
  }
  if (to === 'checked_in') {
    if (Number(reservation.amountPaid) < Number(reservation.pricingSnapshot?.requiredToConfirm || 0)) throw fail('La garantie de réservation n’est plus satisfaite.', 409, 'GUARANTEE_PAYMENT_REQUIRED');
    reservation.checkedInAt = now; reservation.checkedInBy = userId;
  }
  if (to === 'checked_in') { const today = parseDate(now); if (today < reservation.checkInDate || today >= reservation.checkOutDate) throw fail('Le check-in est impossible en dehors de la période du séjour.', 409, 'CHECK_IN_DATE_INVALID'); }
  if (to === 'checked_out') { reservation.checkedOutAt = now; reservation.checkedOutBy = userId; }
  if (to === 'no_show') await NightLock.deleteMany({ sourceType: 'reservation', sourceId: reservation._id });
  reservation.workflowHistory.push({ from: reservation.status, to, at: now, actor: userId, reason }); reservation.status = to;
  try { await reservation.save(); } catch (error) { if (to === 'confirmed') await NightLock.deleteMany({ sourceType: 'reservation', sourceId: reservation._id }); throw error; }
  return reservation;
}

async function createBlock({ accommodationId, input, user, authorizedAccommodation = null }) {
  const accommodation = authorizedAccommodation || await accommodationWithProperty(accommodationId); if (!accommodation) throw fail('Hébergement introuvable.', 404);
  if (!(['Admin', 'Collaborateur', 'GestionnaireImmobilier', 'CommunityManager'].includes(user.role) || String(accommodation.property.owner) === String(user.id))) throw fail('Accès refusé.', 403);
  const start = parseDate(input.startDate); const end = parseDate(input.endDate); nightsBetween(start, end);
  return withCalendarMutex(accommodation._id, async () => {
    if (await NightLock.exists({ accommodation: accommodation._id, date: { $gte: start, $lt: end } })) throw fail('Cette période chevauche une indisponibilité.', 409, 'DATES_UNAVAILABLE');
    const block = await Block.create({ accommodation: accommodationId, startDate: start, endDate: end, type: input.type, reason: input.reason || '', createdBy: user.id });
    const operationToken = new mongoose.Types.ObjectId();
    try { await NightLock.insertMany(nightDates(start, end).map((date) => ({ accommodation: accommodationId, date, sourceType: 'block', sourceId: block._id, operationToken }))); }
    catch (error) { await Block.findByIdAndDelete(block._id); await NightLock.deleteMany({ sourceType: 'block', sourceId: block._id }); if (error.code === 11000) throw fail('Cette période chevauche une indisponibilité.', 409, 'DATES_UNAVAILABLE'); throw error; }
    return block;
  });
}

module.exports = { HOLD_DURATION_MS, BLOCKING_STATUSES, TRANSITIONS, parseDate, nightsBetween, nightDates, create, transition, createBlock, quote, canManage, withCalendarMutex, acquireLocks, confirmFromValidatedPayment, expirePendingReservation, fail };
