#!/usr/bin/env node
require('dotenv').config();
const mongoose = require('mongoose');
const HotelReservation = require('../models/HotelReservation'); const RoomAssignment = require('../models/RoomAssignment'); const Room = require('../models/Room'); const RoomInventory = require('../models/RoomInventory');

async function audit({ apply = false } = {}) {
  const [multiRoomReservations, activeAssignments, roomsWithoutCategory, inventories] = await Promise.all([
    HotelReservation.find({ roomsCount: { $gt: 1 }, status: { $in: ['pending', 'confirmed', 'checked_in'] } }).select('_id reference roomsCount status'),
    RoomAssignment.aggregate([{ $match: { releasedAt: null } }, { $group: { _id: '$reservation', count: { $sum: 1 }, rooms: { $addToSet: '$room' } } }]),
    Room.find({ roomCategory: null }).select('_id hotel roomNumber'),
    RoomInventory.find({ $expr: { $gt: [{ $add: ['$reservedUnits', '$blockedUnits', { $ifNull: ['$physicalBlockedUnits', 0] }] }, '$totalUnits'] } }).select('_id roomCategory date totalUnits reservedUnits blockedUnits physicalBlockedUnits'),
  ]);
  const assignmentOverflow = activeAssignments.filter((row) => { const reservation = multiRoomReservations.find((item) => String(item._id) === String(row._id)); return reservation ? row.count > reservation.roomsCount || row.rooms.length !== row.count : row.count > 1; });
  const report = { apply, multiRoomReservations, assignmentOverflow, roomsWithoutCategory, inconsistentInventory: inventories, safeToApplyIndexes: assignmentOverflow.length === 0 };
  if (apply) {
    if (!report.safeToApplyIndexes) throw Object.assign(new Error('ROOM_ASSIGNMENT_DUPLICATES_REQUIRE_MANUAL_REVIEW'), { report });
    await Promise.all([HotelReservation.syncIndexes(), RoomAssignment.syncIndexes(), RoomInventory.syncIndexes()]);
    report.indexesSynchronized = true;
  }
  return report;
}
async function main() { await mongoose.connect(process.env.MONGO_URI); try { const report = await audit({ apply: process.argv.includes('--apply') }); console.log(JSON.stringify(report, null, 2)); } finally { await mongoose.disconnect(); } }
if (require.main === module) main().catch((error) => { console.error(error.report || error); process.exitCode = 1; });
module.exports = { audit };
