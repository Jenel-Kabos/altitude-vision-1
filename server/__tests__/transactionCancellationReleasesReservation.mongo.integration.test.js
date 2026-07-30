// IM-1R — Phase 2/3 : annuler une Transaction doit libérer la réservation et
// le bien dans le même mouvement. Avant correctif, transactionController.
// cancelTransaction marquait la transaction "Annulée" sans jamais toucher à
// RealEstateReservation ni à Property : comme Transaction.reservation est
// unique, la réservation restait indéfiniment attachée à une transaction
// morte (impossible d'en créer une nouvelle) et le bien restait bloqué en
// "Réservé", invisible du marché, sans seconde action distincte et non
// découvrable pour le staff.

const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const { startFinancialMongo, clearFinancialMongo, stopFinancialMongo } = require('./helpers/financialMongoEnvironment');
const User = require('../models/User');
const Property = require('../models/Property');
const RealEstateApplication = require('../models/RealEstateApplication');
const RealEstateReservation = require('../models/RealEstateReservation');
const Transaction = require('../models/Transaction');
const transactionRoutes = require('../routes/transactionRoutes');
const { errorHandler } = require('../middleware/errorMiddleware');
const { acceptApplication } = require('../services/realEstateApplicationService');

jest.setTimeout(120000);

const app = express();
app.use(express.json());
app.use('/api/transactions', transactionRoutes);
app.use(errorHandler);

const signToken = (id, tokenVersion = 0) => jwt.sign({ id, tokenVersion }, process.env.JWT_SECRET, { expiresIn: '1d' });

let counter = 0;
const makeUser = (overrides = {}) => {
  counter += 1;
  return User.create({ name: 'Utilisateur Test', email: `txcancel${counter}${Date.now()}@example.com`, password: 'Password123!', passwordConfirm: 'Password123!', role: 'Client', ...overrides });
};

beforeAll(startFinancialMongo);
afterEach(clearFinancialMongo);
afterAll(stopFinancialMongo);

async function setupActiveTransaction() {
  const admin = await makeUser({ role: 'Admin' });
  const owner = await makeUser({ role: 'Proprietaire' });
  const client = await makeUser({ role: 'Client' });
  const property = await Property.create({
    title: 'Villa Cancel Test', description: 'Description suffisamment longue pour la validation du modèle Property.',
    pole: 'Altimmo', type: 'Villa', status: 'vente', price: 50000000,
    address: { arrondissement: 'Bacongo', city: 'Brazzaville' }, latitude: -4.27, longitude: 15.28, images: ['https://placehold.co/1200x800/png?text=Test'], surface: 100, bedrooms: 3, bathrooms: 2,
    statusAdmin: 'Validée', isPublished: true, availability: 'Disponible', owner: owner._id,
  });
  const application = await RealEstateApplication.create({
    kind: 'purchase_offer', property: property._id, applicant: client._id, owner: owner._id,
    validUntil: new Date(Date.now() + 24 * 60 * 60 * 1000),
    purchaseOffer: { amount: 48000000, currency: 'XAF' },
    history: [{ from: null, to: 'submitted', action: 'submitted', actor: client._id }],
  });
  const { reservation } = await acceptApplication({ applicationId: application._id, actorId: admin._id, idempotencyKey: `test:${application._id}` });

  const adminToken = signToken(admin._id);
  const createResponse = await request(app).post('/api/transactions').set('Authorization', `Bearer ${adminToken}`).send({
    propertyId: property._id, clientId: client._id, reservationId: reservation._id, finalAmount: 48000000, transactionType: 'vente',
  });
  expect(createResponse.status).toBe(201);
  return { adminToken, transactionId: createResponse.body.data.transaction._id, propertyId: property._id, reservationId: reservation._id };
}

test('annuler une transaction libère la réservation et repasse le bien Disponible', async () => {
  const { adminToken, transactionId, propertyId, reservationId } = await setupActiveTransaction();

  const cancelResponse = await request(app).patch(`/api/transactions/${transactionId}/cancel`).set('Authorization', `Bearer ${adminToken}`).send({ raison: 'Acheteur désiste' });
  expect(cancelResponse.status).toBe(200);
  expect(cancelResponse.body.data.transaction.status).toBe('Annulée');

  const reservation = await RealEstateReservation.findById(reservationId);
  expect(reservation.status).toBe('cancelled');

  const property = await Property.findById(propertyId);
  expect(property.availability).toBe('Disponible');
  expect(property.reservationLock?.reservation).toBeNull();
});

test('après annulation, une nouvelle offre et une nouvelle réservation redeviennent possibles sur le même bien', async () => {
  const { transactionId, propertyId, adminToken } = await setupActiveTransaction();
  await request(app).patch(`/api/transactions/${transactionId}/cancel`).set('Authorization', `Bearer ${adminToken}`).send({ raison: 'Acheteur désiste' });

  const client2 = await makeUser({ role: 'Client' });
  const property = await Property.findById(propertyId);
  const application2 = await RealEstateApplication.create({
    kind: 'purchase_offer', property: property._id, applicant: client2._id, owner: property.owner,
    validUntil: new Date(Date.now() + 24 * 60 * 60 * 1000),
    purchaseOffer: { amount: 47000000, currency: 'XAF' },
    history: [{ from: null, to: 'submitted', action: 'submitted', actor: client2._id }],
  });
  const admin = await User.findOne({ role: 'Admin' });
  const { reservation } = await acceptApplication({ applicationId: application2._id, actorId: admin._id, idempotencyKey: `test:${application2._id}` });
  expect(reservation.status).toBe('active');

  const propertyAfter = await Property.findById(propertyId);
  expect(propertyAfter.availability).toBe('Réservé');
  expect(String(propertyAfter.reservationLock.reservation)).toBe(String(reservation._id));
});
