const mongoose = require('mongoose');
const RoomCategory = require('../models/RoomCategory');
const RoomInventory = require('../models/RoomInventory');
const Room = require('../models/Room');
const HotelReservation = require('../models/HotelReservation');
const RoomAssignment = require('../models/RoomAssignment');
const HousekeepingTask = require('../models/HousekeepingTask');
const MaintenanceTicket = require('../models/MaintenanceTicket');
const { getNightDates, ensureInventoryExists, rebuildInventory } = require('../services/hotelAvailabilityService');
const { logAction, buildAuteur } = require('../services/actionLogService');
const { acquireInventoryOperationLock, heartbeatInventoryOperationLock, releaseInventoryOperationLock } = require('../services/inventoryOperationLockService');
const logger = require('../utils/logger');

const fail = (res, statusCode, message, code) => res.status(statusCode).json({ status: 'fail', message, ...(code ? { code } : {}) });
function range(req) {
  const from = new Date(req.query.from || req.body.from); const to = new Date(req.query.to || req.body.to);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || to <= from) return null;
  const dates = getNightDates(from, to); return dates.length <= 62 ? { from, to, dates } : null;
}

exports.calendar = async (req, res) => {
  try {
    const period = range(req); if (!period) return fail(res, 422, 'La plage doit contenir entre 1 et 62 jours.');
    const categories = await RoomCategory.find({ hotel: req.params.hotelId, status: 'actif' }).select('name unitsAvailable');
    await Promise.all(categories.map((category) => ensureInventoryExists(req.params.hotelId, category._id, period.dates, category)));
    const [inventory, operationalRooms, reservations] = await Promise.all([
      RoomInventory.find({ hotel: req.params.hotelId, date: { $gte: period.from, $lt: period.to } }).sort({ date: 1 }),
      Room.find({ hotel: req.params.hotelId, active: true }).select('roomCategory roomNumber floor status'),
      HotelReservation.find({ hotel: req.params.hotelId, status: { $nin: ['cancelled', 'rejected', 'expired'] }, checkInDate: { $lt: period.to }, checkOutDate: { $gt: period.from } }).select('reference guest status roomCategory checkInDate checkOutDate roomsCount actualCheckInAt actualCheckOutAt'),
    ]);
    const categoryNames = new Map(categories.map((item) => [String(item._id), item.name]));
    const outCounts = operationalRooms.filter((room) => room.status === 'out_of_service').reduce((map, room) => map.set(String(room.roomCategory), (map.get(String(room.roomCategory)) || 0) + 1), new Map());
    const assignmentRows = reservations.length ? await RoomAssignment.find({ reservation: { $in: reservations.map((item) => item._id) }, releasedAt: null }).populate('room', 'roomNumber floor status') : [];
    const [housekeepingTasks, maintenanceTickets] = await Promise.all([
      HousekeepingTask.find({ hotel: req.params.hotelId, open: true }).select('room status type'),
      MaintenanceTicket.find({ hotel: req.params.hotelId, status: { $in: MaintenanceTicket.OPEN_MAINTENANCE_STATUSES } }).select('room status category'),
    ]);
    const assignedByReservation = assignmentRows.reduce((map, item) => { const key = String(item.reservation); map.set(key, [...(map.get(key) || []), item.room]); return map; }, new Map());
    const days = inventory.map((item) => {
      const physicalOutOfService = outCounts.get(String(item.roomCategory)) || 0;
      return { id: item._id, date: item.date, roomCategory: item.roomCategory, categoryName: categoryNames.get(String(item.roomCategory)), totalUnits: item.totalUnits, reservedUnits: item.reservedUnits, blockedUnits: item.blockedUnits, physicalOutOfService, isClosed: item.isClosed, stopSell: item.stopSell, availableUnits: Math.max(0, item.totalUnits - item.reservedUnits - item.blockedUnits - physicalOutOfService) };
    });
    return res.json({ status: 'success', data: { hotelId: req.params.hotelId, from: period.from, to: period.to, days, rooms: operationalRooms, housekeepingTasks, maintenanceTickets, reservations: reservations.map((item) => ({ ...item.toObject(), assignedRooms: assignedByReservation.get(String(item._id)) || [], assignmentState: (assignedByReservation.get(String(item._id)) || []).length === 0 ? 'unassigned' : (assignedByReservation.get(String(item._id)) || []).length < item.roomsCount ? 'partially_assigned' : 'fully_assigned' })) } });
  } catch (error) { return fail(res, 500, error.message); }
};

exports.updateRange = async (req, res) => {
  try {
    const period = range(req); if (!period) return fail(res, 422, 'La plage doit contenir entre 1 et 62 jours.');
    const { roomCategoryId, blockedUnits, stopSell, isClosed, reason } = req.body;
    if (!mongoose.isValidObjectId(roomCategoryId)) return fail(res, 422, 'Catégorie invalide.');
    const category = await RoomCategory.findOne({ _id: roomCategoryId, hotel: req.params.hotelId }); if (!category) return fail(res, 404, 'Catégorie introuvable.');
    await ensureInventoryExists(req.params.hotelId, category._id, period.dates, category);
    const set = { updatedBy: req.user.id, reason: String(reason || '') };
    if (blockedUnits !== undefined) { const value = Number(blockedUnits); if (!Number.isInteger(value) || value < 0 || value > category.unitsAvailable) return fail(res, 422, 'blockedUnits invalide.'); set.blockedUnits = value; }
    if (stopSell !== undefined) set.stopSell = Boolean(stopSell);
    if (isClosed !== undefined) set.isClosed = Boolean(isClosed);
    await RoomInventory.updateMany({ roomCategory: category._id, date: { $gte: period.from, $lt: period.to } }, { $set: set });
    logAction({ action: 'Inventaire hôtelier ajusté', description: `${category.name} du ${period.from.toISOString()} au ${period.to.toISOString()}`, module: 'Altimmo', typeAction: 'MODIFICATION', auteur: buildAuteur(req.user), cible: { id: String(category._id), type: 'RoomCategory', nom: category.name }, req });
    return res.json({ status: 'success', data: { updatedDays: period.dates.length } });
  } catch (error) { return fail(res, error.statusCode || 500, error.message); }
};

exports.rebuild = async (req, res) => {
  let lockHandle;
  const startedAt = Date.now();
  try {
    const period = range(req); if (!period) return fail(res, 422, 'La plage doit contenir entre 1 et 62 jours.');
    const category = await RoomCategory.findOne({ _id: req.body.roomCategoryId, hotel: req.params.hotelId });
    if (!category) return fail(res, 404, 'Catégorie introuvable.');
    lockHandle = await acquireInventoryOperationLock({ hotelId: req.params.hotelId, roomCategoryId: category._id, from: period.from, to: period.to, acquiredBy: req.user.id });
    await heartbeatInventoryOperationLock({ key: lockHandle.lock.key, ownerToken: lockHandle.ownerToken });
    const result = await rebuildInventory({ roomCategoryId: req.body.roomCategoryId, from: period.from, to: period.to });
    logAction({ action: 'Inventaire hôtelier reconstruit', description: `${result.nights} nuit(s)`, module: 'Altimmo', typeAction: 'MODIFICATION', auteur: buildAuteur(req.user), cible: { id: String(req.body.roomCategoryId), type: 'RoomCategory' }, req });
    logger.info('hotel.inventory.rebuild_completed', { hotelId: req.params.hotelId, roomCategoryId: String(category._id), operationId: lockHandle.ownerToken, strategy: 'mongodb_unique_ttl', duration: Date.now() - startedAt, result: 'success' });
    return res.json({ status: 'success', data: result });
  } catch (error) {
    logger.error('hotel.inventory.rebuild_failed', { hotelId: req.params.hotelId, operationId: lockHandle?.ownerToken, strategy: 'mongodb_unique_ttl', duration: Date.now() - startedAt, result: error.code || 'error' });
    return fail(res, error.statusCode || 500, error.message, error.code);
  } finally {
    if (lockHandle) await releaseInventoryOperationLock({ key: lockHandle.lock.key, ownerToken: lockHandle.ownerToken }).catch((error) => logger.warn('hotel.inventory.lock_release_failed', { operationId: lockHandle.ownerToken, result: error.code }));
  }
};
