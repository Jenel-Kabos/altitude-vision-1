// server/services/hotel/hotelStaffAssignmentAudit.js — F2.6.3 (volet B)
//
// Logique de diagnostic pure (aucune écriture) — séparée du script CLI pour rester
// testable unitairement / sur Mongo réel sans jamais lancer un process séparé.

const Hotel = require('../../models/Hotel');
const User = require('../../models/User');
const HotelStaffAssignment = require('../../models/HotelStaffAssignment');

const FORMER_STAFF_ROLES = ['Collaborateur', 'GestionnaireImmobilier', 'CommunityManager'];

async function runHotelStaffAssignmentAudit() {
  const now = new Date();
  const [hotels, assignments] = await Promise.all([
    Hotel.find({}).select('_id manager name').lean(),
    HotelStaffAssignment.find({}).select('_id user hotel assignmentRole status validFrom validUntil').lean(),
  ]);

  const hotelIds = new Set(hotels.map((h) => String(h._id)));
  const userIds = new Set((await User.find({}).select('_id').lean()).map((u) => String(u._id)));

  const hotelsWithManager = hotels.filter((h) => h.manager);
  const hotelsWithoutManager = hotels.filter((h) => !h.manager);

  const activeAssignments = assignments.filter((a) => a.status === 'active');
  const activeByHotelUser = new Map(); // "hotelId:userId" -> [assignments]
  activeAssignments.forEach((a) => {
    const key = `${a.hotel}:${a.user}`;
    if (!activeByHotelUser.has(key)) activeByHotelUser.set(key, []);
    activeByHotelUser.get(key).push(a);
  });

  const legacyManagersWithoutAssignment = [];
  const managerAssignmentDivergences = [];
  hotelsWithManager.forEach((hotel) => {
    const key = `${hotel._id}:${hotel.manager}`;
    const matching = (activeByHotelUser.get(key) || []).filter((a) => a.assignmentRole === 'hotel_manager');
    if (matching.length === 0) legacyManagersWithoutAssignment.push({ hotelId: String(hotel._id), managerId: String(hotel.manager) });
    // Autre acteur avec un assignment hotel_manager actif sur ce même hôtel (manager ≠ legacy) : à revoir.
    const otherManagers = activeAssignments.filter((a) => String(a.hotel) === String(hotel._id) && a.assignmentRole === 'hotel_manager' && String(a.user) !== String(hotel.manager));
    if (otherManagers.length > 0) {
      managerAssignmentDivergences.push({ hotelId: String(hotel._id), legacyManagerId: String(hotel.manager), otherActiveManagerUserIds: otherManagers.map((a) => String(a.user)) });
    }
  });

  const activeAssignmentsWithoutHotel = activeAssignments.filter((a) => !hotelIds.has(String(a.hotel))).map((a) => ({ assignmentId: String(a._id), hotel: String(a.hotel) }));
  const activeAssignmentsWithoutUser = activeAssignments.filter((a) => !userIds.has(String(a.user))).map((a) => ({ assignmentId: String(a._id), user: String(a.user) }));

  const duplicateActiveManagerAssignments = [];
  const byHotelRole = new Map();
  activeAssignments.filter((a) => a.assignmentRole === 'hotel_manager').forEach((a) => {
    const key = String(a.hotel);
    if (!byHotelRole.has(key)) byHotelRole.set(key, []);
    byHotelRole.get(key).push(a);
  });
  byHotelRole.forEach((list, hotelId) => { if (list.length > 1) duplicateActiveManagerAssignments.push({ hotelId, count: list.length, userIds: list.map((a) => String(a.user)) }); });

  const futureAssignments = assignments.filter((a) => a.status === 'active' && a.validFrom && new Date(a.validFrom) > now).length;
  const expiredAssignments = assignments.filter((a) => a.status === 'active' && a.validUntil && new Date(a.validUntil) <= now).length;

  const formerStaffUsers = await User.find({ role: { $in: FORMER_STAFF_ROLES } }).select('_id role').lean();
  const usersWithAnyAssignment = new Set(assignments.map((a) => String(a.user)));
  const usersPotentiallyImpacted = formerStaffUsers.filter((u) => !usersWithAnyAssignment.has(String(u._id))).map((u) => ({ userId: String(u._id), role: u.role }));

  return {
    generatedAt: now.toISOString(),
    totalHotels: hotels.length,
    hotelsWithManagerCount: hotelsWithManager.length,
    hotelsWithoutManagerCount: hotelsWithoutManager.length,
    hotelsWithoutManagerIds: hotelsWithoutManager.map((h) => String(h._id)),
    legacyManagersWithoutAssignment,
    activeAssignmentsWithoutHotel,
    activeAssignmentsWithoutUser,
    duplicateActiveManagerAssignments,
    managerAssignmentDivergences,
    futureAssignmentsCount: futureAssignments,
    expiredAssignmentsCount: expiredAssignments,
    usersPotentiallyImpactedByHardening: usersPotentiallyImpacted,
    totalAssignments: assignments.length,
    totalActiveAssignments: activeAssignments.length,
  };
}

module.exports = { runHotelStaffAssignmentAudit, FORMER_STAFF_ROLES };
