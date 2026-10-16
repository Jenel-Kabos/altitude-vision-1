// LOT D — frontière publication commerciale / exploitation hôtelière.
//   - la publication (et toute révision substantielle) relève d'Altitude
//     Vision : le gérant ne peut pas valider son propre établissement ;
//   - une fois l'hôtel approuvé, l'exploitation quotidienne (tarifs,
//     catégories de chambres) reste au gérant SANS nouvelle approbation ni
//     révision commerciale ;
//   - la réservation publique reste directe, y compris pendant qu'une
//     révision substantielle attend la modération.
// Aucun envoi réel (transport e-mail simulé), aucune mutation financière
// testée ici (suites dédiées).
jest.mock('../services/emailService', () => ({ sendEmailViaZoho: jest.fn().mockResolvedValue({ success: true }) }));
const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const { startFinancialMongo, clearFinancialMongo, stopFinancialMongo } = require('./helpers/financialMongoEnvironment');
const User = require('../models/User');
const Hotel = require('../models/Hotel');
const RoomCategory = require('../models/RoomCategory');
const Room = require('../models/Room');
const RatePlan = require('../models/RatePlan');
const HotelReservation = require('../models/HotelReservation');
const CommercialPublicationRevision = require('../models/CommercialPublicationRevision');
const { createPendingRevision, publicSnapshot } = require('../services/commercialPublicationService');
const { errorHandler } = require('../middleware/errorMiddleware');

jest.setTimeout(180000);
const app = express(); app.use(express.json());
app.use('/api/hotels', require('../routes/hotelRoutes'));
app.use(errorHandler);

let n = 0;
const makeUser = (overrides = {}) => User.create({ name: `D User ${++n}`, email: `lotd-${Date.now()}-${n}@example.test`, password: 'Password123!', passwordConfirm: 'Password123!', role: 'Proprietaire', isEmailVerified: true, ...overrides });
const bearer = (userId) => ({ Authorization: `Bearer ${jwt.sign({ id: userId, tokenVersion: 0 }, process.env.JWT_SECRET, { expiresIn: '1d' })}` });
const futureDate = (days) => new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);

async function approvedHotelWithInventory() {
  const manager = await makeUser();
  const hotel = await Hotel.create({ name: `Hôtel D ${Math.random().toString(36).slice(2)}`, manager: manager._id, createdBy: manager._id, publicationStatus: 'publie', active: true, description: 'Version approuvée par Altitude Vision.' });
  const category = await RoomCategory.create({ hotel: hotel._id, name: 'Standard', code: `D-${Date.now()}-${Math.random()}`, unitsAvailable: 2, status: 'actif', capacity: { maxAdults: 2, maxChildren: 1 }, createdBy: manager._id });
  await Room.create([{ hotel: hotel._id, roomCategory: category._id, roomNumber: `D-${category._id}-1`, createdBy: manager._id }, { hotel: hotel._id, roomCategory: category._id, roomNumber: `D-${category._id}-2`, createdBy: manager._id }]);
  const rate = await RatePlan.create({ roomCategory: category._id, rateType: 'public', amount: 40000, currency: 'XAF', active: true, createdBy: manager._id });
  return { manager, hotel, category, rate };
}

const reserve = (hotel, category, rate, email) => request(app).post(`/api/hotels/${hotel._id}/reservations`).send({
  roomCategoryId: category._id, ratePlanId: rate._id,
  checkInDate: futureDate(30), checkOutDate: futureDate(32), roomsCount: 1, adults: 1,
  guest: { firstName: 'Awa', lastName: 'Client', email },
});

beforeAll(async () => {
  await startFinancialMongo();
  await Promise.all([Hotel, RoomCategory, Room, RatePlan, HotelReservation, CommercialPublicationRevision].map((m) => m.syncIndexes()));
});
afterEach(clearFinancialMongo);
afterAll(stopFinancialMongo);

test('le gérant ne peut ni valider ni rejeter la publication de son propre hôtel', async () => {
  const manager = await makeUser();
  const hotel = await Hotel.create({ name: `Hôtel soumis ${Date.now()}`, manager: manager._id, createdBy: manager._id, publicationStatus: 'soumis', active: true });
  for (const action of ['validate', 'reject']) {
    const res = await request(app).patch(`/api/hotels/${hotel._id}/${action}`).set(bearer(manager._id)).send({ reason: 'auto' });
    expect(res.status).toBe(403);
  }
  expect((await Hotel.findById(hotel._id).lean()).publicationStatus).toBe('soumis');
});

test('après approbation, tarifs et catégories se gèrent sans approbation ni révision commerciale', async () => {
  const { manager, hotel, category } = await approvedHotelWithInventory();
  const rateRes = await request(app).post(`/api/hotels/room-categories/${category._id}/rate-plans`).set(bearer(manager._id))
    .send({ rateType: 'public', amount: 55000, mealPlan: 'breakfast_included' });
  expect(rateRes.status).toBe(201);
  const deactivate = await request(app).patch(`/api/hotels/room-categories/${category._id}/deactivate`).set(bearer(manager._id));
  expect(deactivate.status).toBe(200);
  const activate = await request(app).patch(`/api/hotels/room-categories/${category._id}/activate`).set(bearer(manager._id));
  expect(activate.status).toBe(200);
  expect((await Hotel.findById(hotel._id).lean()).publicationStatus).toBe('publie');
  expect(await CommercialPublicationRevision.countDocuments()).toBe(0);
});

test('la réservation publique reste directe, y compris pendant une révision substantielle en attente', async () => {
  const { manager, hotel, category, rate } = await approvedHotelWithInventory();
  const first = await reserve(hotel, category, rate, 'direct@example.test');
  expect(first.status).toBe(201);

  await createPendingRevision({ resourceType: 'Hotel', resource: hotel, proposedSnapshot: { ...publicSnapshot(hotel), description: 'Nouvelle description non encore approuvée.' }, actor: manager._id });
  expect(await CommercialPublicationRevision.countDocuments({ resource: hotel._id, status: 'pending' })).toBe(1);

  const during = await reserve(hotel, category, rate, 'pendant-revision@example.test');
  expect(during.status).toBe(201);
  expect(during.body.data.reservation.status).not.toBe('cancelled');
  const reloaded = await Hotel.findById(hotel._id).lean();
  expect(reloaded.publicationStatus).toBe('publie');
  expect(reloaded.description).toBe('Version approuvée par Altitude Vision.');
  expect(await HotelReservation.countDocuments({ hotel: hotel._id })).toBe(2);
});

test('un hôtel non approuvé ne prend aucune réservation publique', async () => {
  const { hotel, category, rate } = await approvedHotelWithInventory();
  await Hotel.updateOne({ _id: hotel._id }, { publicationStatus: 'soumis' });
  const res = await reserve(hotel, category, rate, 'trop-tot@example.test');
  expect(res.status).toBeGreaterThanOrEqual(400);
  expect(await HotelReservation.countDocuments({ hotel: hotel._id })).toBe(0);
});
