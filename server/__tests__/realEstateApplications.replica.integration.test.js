const mongoose = require('mongoose');
const { startFinancialMongo, clearFinancialMongo, stopFinancialMongo } = require('./helpers/financialMongoEnvironment');
const Property = require('../models/Property');
const Application = require('../models/RealEstateApplication');
const Reservation = require('../models/RealEstateReservation');
const { acceptApplication, expireReservations } = require('../services/realEstateApplicationService');

jest.mock('../services/notificationService', () => ({ notify: jest.fn().mockResolvedValue({}) }));
jest.setTimeout(120000);
const id = () => new mongoose.Types.ObjectId();

beforeAll(async () => { await startFinancialMongo(); await Promise.all([Property.syncIndexes(), Application.syncIndexes(), Reservation.syncIndexes()]); });
afterEach(clearFinancialMongo);
afterAll(stopFinancialMongo);

async function fixture(kind = 'purchase_offer') {
  const property = id(); const owner = id(); const first = id(); const second = id();
  await Property.collection.insertOne({ _id: property, title: 'Bien IM-2', pole: 'Altimmo', description: 'Test', type: 'Maison', status: kind === 'purchase_offer' ? 'vente' : 'location', price: 1, owner, statusAdmin: 'Validée', isPublished: true, availability: 'Disponible', reservationLock: { reservation: null }, createdAt: new Date(), updatedAt: new Date() });
  const common = { kind, property, owner, validUntil: new Date(Date.now() + 60000), status: 'submitted' };
  const [a, b] = await Application.create([{ ...common, applicant: first, purchaseOffer: { amount: 10 } }, { ...common, applicant: second, purchaseOffer: { amount: 11 } }]);
  return { property, a, b };
}

test.each(['purchase_offer', 'rental_application'])('deux acceptations %s simultanées produisent une réservation', async (kind) => {
  const f = await fixture(kind);
  const results = await Promise.allSettled([
    acceptApplication({ applicationId: f.a._id, actorId: id(), idempotencyKey: `accept:${f.a._id}` }),
    acceptApplication({ applicationId: f.b._id, actorId: id(), idempotencyKey: `accept:${f.b._id}` }),
  ]);
  expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
  expect(results.filter((result) => result.status === 'rejected')[0].reason).toMatchObject({ statusCode: 409 });
  expect(await Reservation.countDocuments({ property: f.property, status: 'active' })).toBe(1);
  expect(await Property.findById(f.property)).toMatchObject({ availability: 'Réservé', hasReservationHistory: true });
  expect(await Application.countDocuments({ property: f.property, status: 'accepted' })).toBe(1);
});

test('expiration libère uniquement le verrou de sa réservation', async () => {
  const f = await fixture();
  const accepted = await acceptApplication({ applicationId: f.a._id, actorId: id(), idempotencyKey: `accept:${f.a._id}` });
  await Reservation.updateOne({ _id: accepted.reservation._id }, { expiresAt: new Date(Date.now() - 1000) });
  await expireReservations(new Date());
  expect(await Reservation.findById(accepted.reservation._id)).toMatchObject({ status: 'expired' });
  expect(await Property.findById(f.property)).toMatchObject({ availability: 'Disponible', reservationLock: { reservation: null } });
});
