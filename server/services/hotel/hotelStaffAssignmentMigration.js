// server/services/hotel/hotelStaffAssignmentMigration.js — F2.6.3 (volet B)
//
// Migration contrôlée : crée un HotelStaffAssignment actif `hotel_manager` pour un
// Hotel.manager legacy qui n'en a aucun. Ne résout JAMAIS silencieusement un cas ambigu
// (révoqué, suspendu, conflit, utilisateur/hôtel manquant) — ces cas sont uniquement
// rapportés, jamais corrigés automatiquement (mission §5.4).

const mongoose = require('mongoose');
const Hotel = require('../../models/Hotel');
const User = require('../../models/User');
const HotelStaffAssignment = require('../../models/HotelStaffAssignment');
const { logAction, buildAuteur } = require('../actionLogService');

const SYSTEM_ACTOR = { role: 'Admin', _id: null, name: 'system_migration' };

async function runLegacyHotelManagerMigration({ apply = false, actor } = {}) {
  const effectiveActor = actor || SYSTEM_ACTOR;
  const hotels = await Hotel.find({ manager: { $ne: null } }).select('_id manager name').lean();

  const summary = {
    dryRun: !apply,
    totalHotelsWithManager: hotels.length,
    created: [],
    alreadyConsistent: [],
    skippedRevoked: [],
    skippedSuspended: [],
    conflicts: [],
    anomalies: [],
  };

  for (const hotel of hotels) {
    // eslint-disable-next-line no-await-in-loop
    const managerExists = await User.exists({ _id: hotel.manager });
    if (!managerExists) {
      summary.anomalies.push({ hotelId: String(hotel._id), managerId: String(hotel.manager), reason: 'MANAGER_USER_NOT_FOUND' });
      // eslint-disable-next-line no-continue
      continue;
    }

    // eslint-disable-next-line no-await-in-loop
    const existing = await HotelStaffAssignment.findOne({ user: hotel.manager, hotel: hotel._id, assignmentRole: 'hotel_manager' }).sort({ createdAt: -1 });
    if (existing) {
      if (existing.status === 'active') {
        summary.alreadyConsistent.push({ hotelId: String(hotel._id), managerId: String(hotel.manager) });
      } else if (existing.status === 'revoked') {
        summary.skippedRevoked.push({ hotelId: String(hotel._id), managerId: String(hotel.manager), assignmentId: String(existing._id) });
      } else if (existing.status === 'suspended') {
        summary.skippedSuspended.push({ hotelId: String(hotel._id), managerId: String(hotel.manager), assignmentId: String(existing._id) });
      } else {
        summary.alreadyConsistent.push({ hotelId: String(hotel._id), managerId: String(hotel.manager), status: existing.status });
      }
      // eslint-disable-next-line no-continue
      continue;
    }

    // eslint-disable-next-line no-await-in-loop
    const otherActiveManagers = await HotelStaffAssignment.find({ hotel: hotel._id, assignmentRole: 'hotel_manager', status: 'active', user: { $ne: hotel.manager } }).select('user').lean();
    if (otherActiveManagers.length > 0) {
      summary.conflicts.push({ hotelId: String(hotel._id), legacyManagerId: String(hotel.manager), otherActiveManagerUserIds: otherActiveManagers.map((a) => String(a.user)), reason: 'OTHER_ACTIVE_MANAGER_ASSIGNMENT_EXISTS' });
      // eslint-disable-next-line no-continue
      continue;
    }

    if (!apply) {
      summary.created.push({ hotelId: String(hotel._id), managerId: String(hotel.manager), wouldCreate: true });
      // eslint-disable-next-line no-continue
      continue;
    }

    // eslint-disable-next-line no-await-in-loop
    const [assignment] = await HotelStaffAssignment.create([{
      user: hotel.manager, hotel: hotel._id, assignmentRole: 'hotel_manager', capabilities: [], status: 'active',
      validFrom: new Date(), assignedBy: effectiveActor._id, assignedAt: new Date(),
      metadata: { source: 'legacy_manager_migration' },
    }]);
    summary.created.push({ hotelId: String(hotel._id), managerId: String(hotel.manager), assignmentId: String(assignment._id) });

    // eslint-disable-next-line no-await-in-loop
    await logAction({
      action: 'hotel_staff.assignment_migrated_from_legacy_manager',
      description: `Rattachement hotel_manager créé pour l'hôtel ${hotel._id} depuis Hotel.manager legacy.`,
      module: 'Hotel',
      typeAction: 'CRÉATION',
      auteur: buildAuteur(effectiveActor),
      cible: { id: String(assignment._id), type: 'HotelStaffAssignment', nom: String(hotel._id) },
      metadata: {
        ancienneValeur: null,
        nouvelleValeur: JSON.stringify({ hotelId: String(hotel._id), userId: String(hotel.manager), assignmentRole: 'hotel_manager', source: 'legacy_manager_migration', dryRun: false }),
      },
    });
  }

  return summary;
}

module.exports = { runLegacyHotelManagerMigration };
