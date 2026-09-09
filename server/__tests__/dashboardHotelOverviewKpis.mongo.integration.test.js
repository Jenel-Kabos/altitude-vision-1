const mongoose = require('mongoose');
const { startFinancialMongo, stopFinancialMongo } = require('./helpers/financialMongoEnvironment');
const Property = require('../models/Property');
const Hotel = require('../models/Hotel');
const Room = require('../models/Room');
const RoomCategory = require('../models/RoomCategory');
const { hotels } = require('../controllers/dashboardAnalyticsController');

jest.setTimeout(180000);

const oid = () => new mongoose.Types.ObjectId();
let actor;
let hotelA;
let hotelB;
let categoriesA;

async function createHotel(label) {
  const property = await Property.collection.insertOne({
    _id: oid(), owner: actor._id, title: `Hotel ${label}`, pole: 'Altimmo', status: 'hebergement',
    statusAdmin: 'Validée', availability: 'Disponible', isPublished: true,
  });
  return Hotel.collection.insertOne({
    _id: oid(), property: property.insertedId, name: `Hotel ${label}`, manager: actor._id,
    createdBy: actor._id, publicationStatus: 'publie', status: 'actif', active: true,
  }).then(({ insertedId }) => insertedId);
}

async function createPhysicalRooms(hotel, category, count, status = 'available') {
  if (!count) return;
  await Room.collection.insertMany(Array.from({ length: count }, (_, index) => ({
    _id: oid(), hotel, roomCategory: category, roomNumber: `${String(hotel).slice(-4)}-${status}-${index}`,
    status, active: true, createdBy: actor._id,
  })));
}

beforeAll(async () => {
  await startFinancialMongo();
  actor = { _id: oid(), id: null, role: 'Admin' };
  actor.id = actor._id;
  hotelA = await createHotel('A');
  hotelB = await createHotel('B');
  categoriesA = await RoomCategory.collection.insertMany([
    { _id: oid(), hotel: hotelA, name: 'Standard', unitsAvailable: 15, status: 'actif', createdBy: actor._id },
    { _id: oid(), hotel: hotelA, name: 'Supérieure', unitsAvailable: 7, status: 'actif', createdBy: actor._id },
    { _id: oid(), hotel: hotelA, name: 'Suite familiale', unitsAvailable: 5, status: 'actif', createdBy: actor._id },
  ]).then((result) => Object.values(result.insertedIds));
  await RoomCategory.collection.insertOne({ _id: oid(), hotel: hotelB, name: 'Étrangère', unitsAvailable: 99, status: 'actif', createdBy: actor._id });
});

afterAll(stopFinancialMongo);

beforeEach(async () => {
  await Room.deleteMany({});
});

test('27 chambres physiques, aucune occupée produit 0/27', async () => {
  await createPhysicalRooms(hotelA, categoriesA[0], 27);
  const result = await hotels(actor, hotelA);
  expect(result.kpis).toMatchObject({ categoryCapacity: 27, physicalRooms: 27, operationalRooms: 27, occupiedRooms: 0, totalRooms: 27, occupancyRate: 0 });
  expect(result.kpis.checkInsToday).toBe(0);
  expect(result.kpis.checkOutsToday).toBe(0);
});

test('27 chambres physiques dont 5 occupées produit 5/27', async () => {
  await createPhysicalRooms(hotelA, categoriesA[0], 22);
  await createPhysicalRooms(hotelA, categoriesA[0], 5, 'occupied');
  const result = await hotels(actor, hotelA);
  expect(result.kpis).toMatchObject({ physicalRooms: 27, operationalRooms: 27, occupiedRooms: 5, totalRooms: 27 });
  expect(result.kpis.occupancyRate).toBeCloseTo(18.52, 2);
});

test('les chambres hors service restent physiques mais sortent de la capacité exploitable', async () => {
  await createPhysicalRooms(hotelA, categoriesA[0], 20);
  await createPhysicalRooms(hotelA, categoriesA[0], 5, 'occupied');
  await createPhysicalRooms(hotelA, categoriesA[0], 2, 'out_of_service');
  const result = await hotels(actor, hotelA);
  expect(result.kpis).toMatchObject({ physicalRooms: 27, outOfServiceRooms: 2, operationalRooms: 25, occupiedRooms: 5, totalRooms: 25 });
  expect(result.kpis.occupancyRate).toBe(20);
});

test('27 unités de catégorie sans Room restent une incohérence visible, jamais une occupation 0/27 inventée', async () => {
  const result = await hotels(actor, hotelA);
  expect(result.kpis).toMatchObject({ categoryCapacity: 27, physicalRooms: 0, operationalRooms: 0, occupiedRooms: 0, totalRooms: 0, occupancyRate: 0 });
});

test('le filtre hotelId exclut strictement les chambres et capacités des autres hôtels', async () => {
  await createPhysicalRooms(hotelA, categoriesA[0], 2, 'occupied');
  await createPhysicalRooms(hotelB, oid(), 8, 'occupied');
  const result = await hotels(actor, hotelA);
  expect(result.kpis).toMatchObject({ categoryCapacity: 27, physicalRooms: 2, occupiedRooms: 2, totalRooms: 2 });
});
