const mongoose = require('mongoose');
const Accommodation = require('../models/Accommodation');
const Reservation = require('../models/AccommodationReservation');
const Block = require('../models/AccommodationAvailabilityBlock');
const NightLock = require('../models/AccommodationNightLock');
const CalendarMutex = require('../models/AccommodationCalendarMutex');
const RatePlan = require('../models/RatePlan');
const { resolveResourceTenant } = require('./platformTenant/tenantResourceAttributionService');

const BLOCKING_STATUSES = ['confirmed', 'checked_in'];
const TRANSITIONS = Object.freeze({ pending: ['confirmed', 'cancelled'], confirmed: ['checked_in', 'cancelled', 'no_show'], checked_in: ['checked_out'], draft: ['pending', 'cancelled'], cancelled: [], checked_out: [], no_show: [] });
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
  return { nightlyRate, nights, cleaningFee, serviceFee: 0, discount: 0, taxes: 0, subtotal, fees: cleaningFee, total: subtotal + cleaningFee, currency: rate.currency || 'XAF' };
}

async function create({ input, user }) {
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
  return Reservation.create({ tenant: attribution.status === 'resolved' ? attribution.tenantId : null, accommodation: accommodation._id, guest: user.id, owner: accommodation.property.owner, checkInDate: start, checkOutDate: end, nights,
    guestCount: Number(input.guestCount || (Number(input.adults) + Number(input.children || 0))), adults: input.adults, children: input.children || 0,
    status: 'pending', subtotal: pricing.subtotal, fees: pricing.fees, total: pricing.total, currency: pricing.currency, specialRequests: input.specialRequests || '', source: input.source || 'public_web', createdBy: user.id });
}

async function acquireLocks(reservation) {
  return withCalendarMutex(reservation.accommodation, async () => {
    const conflict = await NightLock.exists({ accommodation: reservation.accommodation, date: { $gte: reservation.checkInDate, $lt: reservation.checkOutDate } });
    if (conflict) throw fail('Ces dates ne sont plus disponibles.', 409, 'DATES_UNAVAILABLE');
    const operationToken = new mongoose.Types.ObjectId();
    const docs = nightDates(reservation.checkInDate, reservation.checkOutDate).map((date) => ({ accommodation: reservation.accommodation, date, sourceType: 'reservation', sourceId: reservation._id, operationToken }));
    try { await NightLock.insertMany(docs, { ordered: true }); return operationToken; }
    catch (error) { await NightLock.deleteMany({ operationToken }); if (error.code === 11000) throw fail('Ces dates ne sont plus disponibles.', 409, 'DATES_UNAVAILABLE'); throw error; }
  });
}

async function transition({ id, to, user, reason, authorizedReservation = null }) {
  const reservation = authorizedReservation || await Reservation.findById(id); if (!reservation) throw fail('Réservation introuvable.', 404);
  const userId = user.id || user._id; const isGuest = String(reservation.guest) === String(userId);
  if (to === 'cancelled' ? !(isGuest || canManage(user, reservation)) : !canManage(user, reservation)) throw fail('Accès refusé.', 403, 'FORBIDDEN');
  if (!TRANSITIONS[reservation.status]?.includes(to)) throw fail(`Transition ${reservation.status} → ${to} interdite.`, 409, 'INVALID_TRANSITION');
  if (to === 'confirmed') {
    const accommodation = await accommodationWithProperty(reservation.accommodation); await assertBookable(accommodation, reservation.adults, reservation.children);
    const pricing = await quote(accommodation, reservation.checkInDate, reservation.checkOutDate); await acquireLocks(reservation);
    reservation.pricingSnapshot = { ...pricing, confirmedAt: new Date() }; reservation.subtotal = pricing.subtotal; reservation.fees = pricing.fees; reservation.total = pricing.total; reservation.currency = pricing.currency;
  }
  if (to === 'cancelled') { reservation.cancelledAt = new Date(); reservation.cancelledBy = userId; reservation.cancellationReason = reason || 'Annulation sans motif détaillé'; await NightLock.deleteMany({ sourceType: 'reservation', sourceId: reservation._id }); }
  if (to === 'checked_in') { reservation.checkedInAt = new Date(); reservation.checkedInBy = userId; }
  if (to === 'checked_in') { const today = parseDate(new Date()); if (today < reservation.checkInDate || today >= reservation.checkOutDate) throw fail('Le check-in est impossible en dehors de la période du séjour.', 409, 'CHECK_IN_DATE_INVALID'); }
  if (to === 'checked_out') { reservation.checkedOutAt = new Date(); reservation.checkedOutBy = userId; }
  if (to === 'no_show') await NightLock.deleteMany({ sourceType: 'reservation', sourceId: reservation._id });
  reservation.workflowHistory.push({ from: reservation.status, to, actor: userId, reason }); reservation.status = to;
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

module.exports = { BLOCKING_STATUSES, TRANSITIONS, parseDate, nightsBetween, nightDates, create, transition, createBlock, quote, canManage, withCalendarMutex, fail };
