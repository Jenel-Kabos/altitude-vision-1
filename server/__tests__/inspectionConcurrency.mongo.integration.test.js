// HM-1 — Phase 6/13 : "une inspection ouverte par chambre" est une règle
// métier explicite (voir header de RoomInspection.js) mais, contrairement à
// HousekeepingTask (index unique partiel {room:1, open:true}), RoomInspection
// n'a aucune contrainte DB équivalente. createInspectionCore ne fait que
// lire room.status === 'inspection' sans le transitionner atomiquement — deux
// appels concurrents peuvent donc chacun lire le même statut et créer chacun
// une RoomInspection ouverte pour la même chambre.

const mongoose = require('mongoose');
const { startFinancialMongo, clearFinancialMongo, stopFinancialMongo } = require('./helpers/financialMongoEnvironment');
const Hotel = require('../models/Hotel');
const RoomCategory = require('../models/RoomCategory');
const Room = require('../models/Room');
const RoomInspection = require('../models/RoomInspection');
const { createInspection } = require('../services/inspectionService');

jest.setTimeout(120000);
const id = () => new mongoose.Types.ObjectId();

beforeAll(async () => {
  await startFinancialMongo();
  await Promise.all([Room, RoomInspection, RoomCategory].map((model) => model.syncIndexes()));
});
afterEach(clearFinancialMongo);
afterAll(stopFinancialMongo);

async function roomAwaitingInspection() {
  const actor = { id: id(), role: 'Admin' };
  const hotel = await Hotel.create({ name: 'Hôtel Inspection Concurrence', manager: actor.id, createdBy: actor.id });
  const category = await RoomCategory.create({ hotel: hotel._id, name: 'Standard', code: 'STD', unitsAvailable: 1, createdBy: actor.id });
  const room = await Room.create({ hotel: hotel._id, roomCategory: category._id, roomNumber: '101', status: 'inspection', createdBy: actor.id });
  return { actor, room };
}

test('deux inspections concurrentes sur la même chambre : une seule reste ouverte', async () => {
  const { actor, room } = await roomAwaitingInspection();
  const inspectorA = id();
  const inspectorB = id();
  const task = id();

  const results = await Promise.allSettled([
    createInspection({ roomId: room._id, housekeepingTaskId: task, inspectorId: inspectorA, actingUser: actor, transactionMode: 'fallback' }),
    createInspection({ roomId: room._id, housekeepingTaskId: task, inspectorId: inspectorB, actingUser: actor, transactionMode: 'fallback' }),
  ]);

  const openInspections = await RoomInspection.find({ room: room._id, result: null });
  expect(openInspections).toHaveLength(1);
  expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
});
