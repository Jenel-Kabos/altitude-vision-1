const RoomCategory = require('../../models/RoomCategory');
const Room = require('../../models/Room');
const RoomInventory = require('../../models/RoomInventory');
const mongoose = require('mongoose');

const activeRoomMatch = { active: true };

function summarizeCategory(category, rooms = [], inventory = []) {
  const commercialCapacity = Number(category.unitsAvailable) || 0;
  const physicalRooms = rooms.length;
  const outOfServiceRooms = rooms.filter((room) => room.status === 'out_of_service').length;
  const operationalRooms = physicalRooms - outOfServiceRooms;
  const inventorySellable = inventory.length
    ? Math.max(...inventory.map((day) => Math.max(0, day.totalUnits - day.blockedUnits - (day.physicalBlockedUnits || 0))))
    : commercialCapacity;
  const futureSellableCapacity = Math.min(inventorySellable, operationalRooms);
  return {
    roomCategoryId: category._id,
    commercialCapacity,
    physicalRooms,
    operationalRooms,
    outOfServiceRooms,
    futureSellableCapacity,
    configurationGap: commercialCapacity - operationalRooms,
    configurationConsistent: commercialCapacity === operationalRooms,
  };
}

async function getHotelRoomCapacityConsistency(hotelId, { from = new Date() } = {}) {
  const [categories, rooms, inventory] = await Promise.all([
    RoomCategory.find({ hotel: hotelId }).lean(),
    Room.find({ hotel: hotelId, ...activeRoomMatch }).select('roomCategory status').lean(),
    RoomInventory.find({ hotel: hotelId, date: { $gte: from } })
      .select('roomCategory totalUnits blockedUnits physicalBlockedUnits').lean(),
  ]);
  const byCategory = (items, field) => items.reduce((map, item) => {
    const key = String(item[field]);
    map.set(key, [...(map.get(key) || []), item]);
    return map;
  }, new Map());
  const roomsByCategory = byCategory(rooms, 'roomCategory');
  const inventoryByCategory = byCategory(inventory, 'roomCategory');
  const categorySummaries = categories.map((category) => summarizeCategory(
    category,
    roomsByCategory.get(String(category._id)) || [],
    inventoryByCategory.get(String(category._id)) || [],
  ));
  const totals = categorySummaries.reduce((sum, item) => ({
    commercialCapacity: sum.commercialCapacity + item.commercialCapacity,
    physicalRooms: sum.physicalRooms + item.physicalRooms,
    operationalRooms: sum.operationalRooms + item.operationalRooms,
    outOfServiceRooms: sum.outOfServiceRooms + item.outOfServiceRooms,
    futureSellableCapacity: sum.futureSellableCapacity + item.futureSellableCapacity,
    configurationGap: sum.configurationGap + item.configurationGap,
  }), { commercialCapacity: 0, physicalRooms: 0, operationalRooms: 0, outOfServiceRooms: 0, futureSellableCapacity: 0, configurationGap: 0 });
  return { hotelId, categories: categorySummaries, ...totals, configurationConsistent: categorySummaries.every((item) => item.configurationConsistent) };
}

async function getCategoryOperationalCapacity(roomCategoryId, { session = null, fallbackCapacity = 0 } = {}) {
  if (!mongoose.connection.readyState) return Number(fallbackCapacity) || 0;
  const query = Room.countDocuments({ roomCategory: roomCategoryId, active: true, status: { $ne: 'out_of_service' } });
  return session ? query.session(session) : query;
}

module.exports = { summarizeCategory, getHotelRoomCapacityConsistency, getCategoryOperationalCapacity };
