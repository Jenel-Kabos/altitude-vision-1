const mongoose = require('mongoose');
const Accommodation = require('../models/Accommodation');
const Hotel = require('../models/Hotel');
const HotelReservation = require('../models/HotelReservation');
const Room = require('../models/Room');
const HousekeepingTask = require('../models/HousekeepingTask');
const MaintenanceTicket = require('../models/MaintenanceTicket');
const AccommodationReservation = require('../models/AccommodationReservation');
const AccommodationNightLock = require('../models/AccommodationNightLock');
const FinancialDocument = require('../models/FinancialDocument');
const PaymentAllocation = require('../models/PaymentAllocation');
const FinancialRefund = require('../models/FinancialRefund');
const { ROLES_ALTIMMO, ROLES_GL } = require('../utils/roles');
const { listAccessibleHotels } = require('../services/hotel/hotelAccessScopeService');
const { getImmobilierReportData } = require('../services/reporting/immobilierReportQueryService');
const { getRentalReportData } = require('../services/reporting/rentalReportQueryService');

const dayBounds = () => { const start = new Date(); start.setHours(0, 0, 0, 0); const end = new Date(start); end.setDate(end.getDate() + 1); return { start, end }; };
const periodStarts = () => { const { start: today, end: tomorrow } = dayBounds(); const month = new Date(today.getFullYear(), today.getMonth(), 1); const year = new Date(today.getFullYear(), 0, 1); return { today, tomorrow, month, year }; };

async function accommodations(accommodationId = null, { tenantId = null } = {}) {
  const { today, tomorrow, month, year } = periodStarts(); const week = new Date(today.getTime() + 7 * 86400000); const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1);
  const independent = { $or: [{ hotel: null }, { hotel: { $exists: false } }], ...(accommodationId ? { _id: accommodationId } : {}), ...(tenantId ? { tenant: tenantId } : {}) };
  const publishedIds = await Accommodation.find({ ...independent, publicationStatus: 'publie' }).distinct('_id');
  const [rows, reservationRows, reservationNights, blockedNights, documents, allocations, refunds] = await Promise.all([
    Accommodation.aggregate([{ $match: independent }, { $lookup: { from: 'properties', localField: 'property', foreignField: '_id', as: 'property' } }, { $unwind: '$property' }, { $group: { _id: null, total: { $sum: 1 }, published: { $sum: { $cond: [{ $eq: ['$publicationStatus', 'publie'] }, 1, 0] } }, drafts: { $sum: { $cond: [{ $eq: ['$publicationStatus', 'brouillon'] }, 1, 0] } }, unavailable: { $sum: { $cond: [{ $ne: ['$property.availability', 'Disponible'] }, 1, 0] } }, maintenance: { $sum: { $cond: [{ $eq: ['$property.availability', 'En maintenance'] }, 1, 0] } } } }]),
    AccommodationReservation.aggregate([{ $match: { accommodation: { $in: publishedIds }, status: { $in: ['confirmed', 'checked_in', 'checked_out'] } } }, { $group: { _id: null,
      reservationsToday: { $sum: { $cond: [{ $and: [{ $lt: ['$checkInDate', tomorrow] }, { $gt: ['$checkOutDate', today] }] }, 1, 0] } },
      reservationsWeek: { $sum: { $cond: [{ $and: [{ $lt: ['$checkInDate', week] }, { $gt: ['$checkOutDate', today] }] }, 1, 0] } },
      checkInsToday: { $sum: { $cond: [{ $and: [{ $gte: ['$checkInDate', today] }, { $lt: ['$checkInDate', tomorrow] }] }, 1, 0] } },
      checkOutsToday: { $sum: { $cond: [{ $and: [{ $gte: ['$checkOutDate', today] }, { $lt: ['$checkOutDate', tomorrow] }] }, 1, 0] } },
      bookedValueToday: { $sum: { $cond: [{ $gte: ['$pricingSnapshot.confirmedAt', today] }, '$total', 0] } }, bookedValueMonth: { $sum: { $cond: [{ $gte: ['$pricingSnapshot.confirmedAt', month] }, '$total', 0] } }, bookedValueYear: { $sum: { $cond: [{ $gte: ['$pricingSnapshot.confirmedAt', year] }, '$total', 0] } },
      amountCollected: { $sum: '$amountPaid' }, reservedNights: { $sum: '$nights' },
    } }]),
    AccommodationNightLock.countDocuments({ accommodation: { $in: publishedIds }, sourceType: 'reservation', date: { $gte: month, $lt: nextMonth } }),
    AccommodationNightLock.countDocuments({ accommodation: { $in: publishedIds }, sourceType: 'block', date: { $gte: month, $lt: nextMonth } }),
    FinancialDocument.aggregate([{ $match: { domain: 'real_estate', establishmentType: 'Accommodation', establishmentId: { $in: publishedIds }, subjectType: 'AccommodationReservation', status: { $ne: 'cancelled' } } }, { $group: { _id: null, remainingAmount: { $sum: '$balanceMinor' }, paidReservations: { $sum: { $cond: [{ $eq: ['$paymentStatus', 'paid'] }, 1, 0] } }, partiallyPaidReservations: { $sum: { $cond: [{ $eq: ['$paymentStatus', 'partially_paid'] }, 1, 0] } }, unpaidReservations: { $sum: { $cond: [{ $eq: ['$paymentStatus', 'unpaid'] }, 1, 0] } } } }]),
    PaymentAllocation.aggregate([{ $match: { domain: 'real_estate', establishmentType: 'Accommodation', establishmentId: { $in: publishedIds }, status: 'active' } }, { $group: { _id: null, amountCollected: { $sum: '$amountMinor' } } }]),
    FinancialRefund.aggregate([{ $match: { domain: 'real_estate', establishmentType: 'Accommodation', establishmentId: { $in: publishedIds } } }, { $group: { _id: null, refundedAmount: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, '$amountMinor', 0] } }, pendingRefunds: { $sum: { $cond: [{ $in: ['$status', ['requested', 'approved', 'processing']] }, 1, 0] } }, failedRefunds: { $sum: { $cond: [{ $eq: ['$status', 'failed'] }, 1, 0] } } } }]),
  ]);
  const base = rows[0] || { total: 0, published: 0, drafts: 0, unavailable: 0, maintenance: 0 }; const daysInMonth = Math.round((nextMonth - month) / 86400000);
  const availableNights = Math.max(0, publishedIds.length * daysInMonth - blockedNights); const occupancyRate = availableNights ? Math.round((reservationNights / availableNights) * 10000) / 100 : 0;
  const reservationStats = reservationRows[0] || { reservationsToday: 0, reservationsWeek: 0, checkInsToday: 0, checkOutsToday: 0, bookedValueToday: 0, bookedValueMonth: 0, bookedValueYear: 0, reservedNights: 0 };
  delete reservationStats.amountCollected;
  const gross = allocations[0]?.amountCollected || 0; const refundStats = refunds[0] || { refundedAmount: 0, pendingRefunds: 0, failedRefunds: 0 };
  return { kpis: { ...base, ...reservationStats, ...(documents[0] || { remainingAmount: 0, paidReservations: 0, partiallyPaidReservations: 0, unpaidReservations: 0 }), amountCollected: gross, grossAmountCollected: gross, ...refundStats, netAmountCollected: Math.max(0, gross - refundStats.refundedAmount), occupancyRate },
    occupancyFormula: 'Nuits verrouillées par réservation sur le mois / (hébergements publiés × jours du mois − nuits bloquées manuellement) × 100.', revenueBasis: 'Valeur réservée et montant encaissé sont exposés séparément.' };
}

async function hotels(actor, requestedHotelId = null) {
  const { today, tomorrow } = periodStarts();
  const activeReservation = ['confirmed', 'checked_in', 'checked_out'];
  let scopedIds;
  if (actor?.platformTenant?._id || actor?.platformTenant) {
    scopedIds = await Hotel.find({ tenant: actor.platformTenant._id || actor.platformTenant }).distinct('_id');
  } else if (actor?.role !== 'Admin') {
    const scoped = await listAccessibleHotels(actor);
    scopedIds = scoped.hotels.map((hotel) => hotel._id);
  }
  if (requestedHotelId) {
    if (scopedIds && !scopedIds.some((id) => String(id) === String(requestedHotelId))) {
      const error = new Error('Établissement inaccessible.'); error.statusCode = 403; throw error;
    }
    scopedIds = [requestedHotelId];
  }
  const validatedHotels = await Hotel.find({
    ...(requestedHotelId ? {} : { publicationStatus: 'publie' }),
    ...(scopedIds ? { _id: { $in: scopedIds } } : {}),
  })
    .populate({
      path: 'property',
      select: '_id',
      ...(requestedHotelId ? {} : { match: { statusAdmin: 'Validée', availability: 'Disponible' } }),
    })
    .lean();
  const eligibleHotels = validatedHotels.filter((hotel) => hotel.property);
  const activeEligibleHotels = eligibleHotels.filter((hotel) => hotel.status === 'actif' && hotel.active !== false);
  const hotelIds = activeEligibleHotels.map((hotel) => hotel._id);
  const [rooms, reservations, housekeeping, maintenance, collections, refunds, balances] = await Promise.all([
    Room.aggregate([{ $match: { hotel: { $in: hotelIds }, active: true } }, { $group: { _id: null, availableRooms: { $sum: { $cond: [{ $eq: ['$status', 'available'] }, 1, 0] } }, occupiedRooms: { $sum: { $cond: [{ $eq: ['$status', 'occupied'] }, 1, 0] } }, cleaningRooms: { $sum: { $cond: [{ $eq: ['$status', 'cleaning'] }, 1, 0] } }, inspectionRooms: { $sum: { $cond: [{ $eq: ['$status', 'inspection'] }, 1, 0] } }, outOfServiceRooms: { $sum: { $cond: [{ $eq: ['$status', 'out_of_service'] }, 1, 0] } }, totalRooms: { $sum: 1 } } }]),
    HotelReservation.aggregate([{ $match: { hotel: { $in: hotelIds } } }, { $group: { _id: null, reservations: { $sum: { $cond: [{ $in: ['$status', activeReservation] }, 1, 0] } }, reservationsToday: { $sum: { $cond: [{ $and: [{ $gte: ['$createdAt', today] }, { $lt: ['$createdAt', tomorrow] }] }, 1, 0] } }, checkInsToday: { $sum: { $cond: [{ $and: [{ $gte: ['$checkInDate', today] }, { $lt: ['$checkInDate', tomorrow] }, { $in: ['$status', activeReservation] }] }, 1, 0] } }, checkOutsToday: { $sum: { $cond: [{ $and: [{ $gte: ['$checkOutDate', today] }, { $lt: ['$checkOutDate', tomorrow] }, { $in: ['$status', activeReservation] }] }, 1, 0] } }, pendingCheckIns: { $sum: { $cond: [{ $and: [{ $gte: ['$checkInDate', today] }, { $lt: ['$checkInDate', tomorrow] }, { $eq: ['$status', 'confirmed'] }] }, 1, 0] } }, pendingCheckOuts: { $sum: { $cond: [{ $and: [{ $gte: ['$checkOutDate', today] }, { $lt: ['$checkOutDate', tomorrow] }, { $eq: ['$status', 'checked_in'] }] }, 1, 0] } } } }]),
    HousekeepingTask.countDocuments({ hotel: { $in: hotelIds }, status: { $in: ['pending', 'assigned', 'in_progress'] } }),
    MaintenanceTicket.countDocuments({ hotel: { $in: hotelIds }, status: { $in: MaintenanceTicket.OPEN_MAINTENANCE_STATUSES } }),
    PaymentAllocation.aggregate([{ $match: { domain: 'hotel', establishmentType: 'Hotel', establishmentId: { $in: hotelIds }, status: 'active' } }, { $group: { _id: null, grossAmountCollected: { $sum: '$amountMinor' } } }]),
    FinancialRefund.aggregate([{ $match: { domain: 'hotel', establishmentType: 'Hotel', establishmentId: { $in: hotelIds }, status: 'completed' } }, { $group: { _id: null, refundedAmount: { $sum: '$amountMinor' } } }]),
    FinancialDocument.aggregate([{ $match: { domain: 'hotel', establishmentType: 'Hotel', establishmentId: { $in: hotelIds }, status: { $in: ['issued', 'credited'] } } }, { $group: { _id: null, remainingAmount: { $sum: '$balanceMinor' } } }]),
  ]);
  const roomStats = rooms[0] || { availableRooms: 0, occupiedRooms: 0, cleaningRooms: 0, inspectionRooms: 0, outOfServiceRooms: 0, totalRooms: 0 };
  const gross = collections[0]?.grossAmountCollected || 0;
  const refunded = refunds[0]?.refundedAmount || 0;
  return { kpis: { activeHotels: hotelIds.length, temporarilyClosedHotels: eligibleHotels.length - hotelIds.length, ...roomStats, occupancyRate: roomStats.totalRooms ? Math.round((roomStats.occupiedRooms / roomStats.totalRooms) * 10000) / 100 : 0, ...(reservations[0] || { reservations: 0, reservationsToday: 0, checkInsToday: 0, checkOutsToday: 0 }), housekeeping, maintenance, grossAmountCollected: gross, refundedAmount: refunded, netAmountCollected: Math.max(0, gross - refunded), remainingAmount: balances[0]?.remainingAmount || 0 }, revenueBasis: 'Encaissements hôteliers confirmés, remboursements terminés et soldes de factures émis ; hôtels validés et actifs uniquement.' };
}

// REPORTING-1 — ces trois fonctions restent temporairement exportées pour
// leurs DomainReports. La query ventes est désormais détenue par
// immobilierReportQueryService et partagée sans dépendance vers ce controller.
exports.accommodations = accommodations;
exports.hotels = hotels;

exports.getModuleAnalytics = async (req, res) => {
  try {
    const handlers = { sales: getImmobilierReportData, rentals: getRentalReportData, accommodations, hotels };
    if (!handlers[req.params.module]) return res.status(404).json({ status: 'fail', message: 'Module analytics inconnu.' });
    const allowedRoles = req.params.module === 'rentals' ? ROLES_GL : (['hotels', 'accommodations'].includes(req.params.module) ? [...ROLES_ALTIMMO, 'Proprietaire'] : ROLES_ALTIMMO);
    if (!allowedRoles.includes(req.user?.role)) return res.status(403).json({ status: 'fail', message: 'Accès refusé à ce module.' });
    const requestedAccommodationId = req.query?.accommodationId;
    const accommodationId = req.params.module === 'accommodations' && mongoose.isValidObjectId(requestedAccommodationId) ? new mongoose.Types.ObjectId(requestedAccommodationId) : null;
    const requestedHotelId = req.params.module === 'hotels' && mongoose.isValidObjectId(req.query?.hotelId) ? new mongoose.Types.ObjectId(req.query.hotelId) : null;
    const scopeUserIds = req.user?.platformTenant ? (req.tenantScopeUserIds || []) : null;
    let data;
    if (req.params.module === 'hotels') data = await handlers.hotels(req.user, requestedHotelId);
    else if (req.params.module === 'accommodations') {
      if (req.user.role === 'Proprietaire' && !accommodationId) return res.status(422).json({ status: 'fail', message: 'Sélectionnez un hébergement.' });
      if (accommodationId) {
        const selected = await Accommodation.findById(accommodationId).populate('property', 'owner').lean();
        if (!selected) return res.status(404).json({ status: 'fail', message: 'Hébergement introuvable.' });
        const isOwner = String(selected.property?.owner) === String(req.user.id || req.user._id) || String(selected.createdBy) === String(req.user.id || req.user._id);
        const actorTenantId = req.user.platformTenant?._id || req.user.platformTenant || null;
        const sameTenant = !actorTenantId || !selected.tenant || String(selected.tenant) === String(actorTenantId);
        if ((req.user.role === 'Proprietaire' && !isOwner) || (req.user.role !== 'Proprietaire' && !sameTenant)) return res.status(403).json({ status: 'fail', message: 'Hébergement inaccessible.' });
      }
      data = await handlers.accommodations(accommodationId, { tenantId: req.user.role === 'Proprietaire' ? null : (req.user.platformTenant?._id || req.user.platformTenant || null) });
    }
    else data = await handlers[req.params.module]({ scopeUserIds });
    res.json({ status: 'success', data });
  } catch (error) { res.status(error.statusCode || 500).json({ status: 'error', message: error.message }); }
};
