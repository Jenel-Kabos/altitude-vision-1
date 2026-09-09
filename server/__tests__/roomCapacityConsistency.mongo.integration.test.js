const { startFinancialMongo, clearFinancialMongo, stopFinancialMongo } = require('./helpers/financialMongoEnvironment');
const User = require('../models/User');
const Hotel = require('../models/Hotel');
const RoomCategory = require('../models/RoomCategory');
const Room = require('../models/Room');
const RoomInventory = require('../models/RoomInventory');
const { getHotelRoomCapacityConsistency } = require('../services/hotel/roomCapacityConsistencyService');
const { getAvailability, reserveInventory, normalizeDate } = require('../services/hotelAvailabilityService');

jest.setTimeout(120000);
let sequence = 0;
beforeAll(startFinancialMongo);
afterEach(clearFinancialMongo);
afterAll(stopFinancialMongo);

async function fixture({ units = 27, rooms = 0, outOfService = 0 } = {}) {
  sequence += 1;
  const user = await User.create({ name: 'Capacity Owner', email: `capacity-${Date.now()}-${sequence}@example.test`, password: 'Password123!', passwordConfirm: 'Password123!', role: 'Proprietaire', isEmailVerified: true });
  const hotel = await Hotel.create({ name: `Capacity Hotel ${sequence}`, manager: user._id, createdBy: user._id, publicationStatus: 'publie', active: true });
  const category = await RoomCategory.create({ hotel: hotel._id, name: 'Standard', code: `CAP${sequence}`, unitsAvailable: units, createdBy: user._id });
  if (rooms) await Room.create(Array.from({ length: rooms }, (_, index) => ({ hotel: hotel._id, roomCategory: category._id, roomNumber: String(100 + index), status: index < outOfService ? 'out_of_service' : 'available', createdBy: user._id })));
  return { user, hotel, category };
}

test.each([[27, 0, 0, 0], [27, 27, 27, 0], [27, 27, 25, 2]])('résume %i commerciales, %i physiques, %i opérationnelles', async (commercial, physical, operational, outOfService) => {
  const f = await fixture({ units: commercial, rooms: physical, outOfService });
  const result = await getHotelRoomCapacityConsistency(f.hotel._id);
  expect(result).toMatchObject({ commercialCapacity: commercial, physicalRooms: physical, operationalRooms: operational, outOfServiceRooms: outOfService, configurationGap: commercial - operational, futureSellableCapacity: Math.min(commercial, operational) });
});

test('une nouvelle réservation ne peut dépasser les chambres physiques opérationnelles et le stock existant reste intact', async () => {
  const f = await fixture({ units: 27, rooms: 2 });
  const from = normalizeDate(new Date(Date.now() + 86400000)); const to = normalizeDate(new Date(Date.now() + 2 * 86400000));
  expect((await getAvailability({ roomCategoryId: f.category._id, checkInDate: from, checkOutDate: to, roomsCount: 3 })).available).toBe(false);
  expect((await reserveInventory({ hotelId: f.hotel._id, roomCategoryId: f.category._id, checkInDate: from, checkOutDate: to, roomsCount: 2 })).ok).toBe(true);
  const before = await RoomInventory.findOne({ roomCategory: f.category._id, date: from });
  expect((await reserveInventory({ hotelId: f.hotel._id, roomCategoryId: f.category._id, checkInDate: from, checkOutDate: to, roomsCount: 1 })).ok).toBe(false);
  const after = await RoomInventory.findOne({ roomCategory: f.category._id, date: from });
  expect(after.reservedUnits).toBe(before.reservedUnits);
});

test('isole strictement les capacités par hotelId et reste zéro-safe', async () => {
  const a = await fixture({ units: 27, rooms: 0 });
  await fixture({ units: 99, rooms: 4 });
  const result = await getHotelRoomCapacityConsistency(a.hotel._id);
  expect(result).toMatchObject({ commercialCapacity: 27, physicalRooms: 0, operationalRooms: 0, futureSellableCapacity: 0 });
});
