// IM-1R — Phase 5 : realEstateLifecycleConcurrency.replica.integration.test.js
// couvre déjà la concurrence sur Contrat au niveau modèle (deux créations
// directes). Ici on couvre l'angle route HTTP : le mapping 409 du
// contrôleur sur E11000, et l'effet de bord métier (conversion de la
// réservation) après la création gagnante.

const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const { startFinancialMongo, clearFinancialMongo, stopFinancialMongo } = require('./helpers/financialMongoEnvironment');
const User = require('../models/User');
const Property = require('../models/Property');
const RealEstateApplication = require('../models/RealEstateApplication');
const RealEstateReservation = require('../models/RealEstateReservation');
const Contrat = require('../models/Contrat');
const contratRoutes = require('../routes/contratRoutes');
const { errorHandler } = require('../middleware/errorMiddleware');
const { acceptApplication } = require('../services/realEstateApplicationService');

jest.setTimeout(120000);

const app = express();
app.use(express.json());
app.use('/api/contrats', contratRoutes);
app.use(errorHandler);

const signToken = (id, tokenVersion = 0) => jwt.sign({ id, tokenVersion }, process.env.JWT_SECRET, { expiresIn: '1d' });

let counter = 0;
const makeUser = (overrides = {}) => {
  counter += 1;
  return User.create({ name: 'Utilisateur Test', email: `contratconc${counter}${Date.now()}@example.com`, password: 'Password123!', passwordConfirm: 'Password123!', role: 'Client', ...overrides });
};

// autoIndex:false côté connexion de test (voir financialMongoEnvironment.js)
// : les index déclarés dans les schémas ne sont jamais construits
// automatiquement, il faut les demander explicitement pour que les
// contraintes uniques testées ici existent réellement en base.
beforeAll(async () => { await startFinancialMongo(); await Contrat.syncIndexes(); });
afterEach(clearFinancialMongo);
afterAll(stopFinancialMongo);

async function setupActiveRentalReservation() {
  const admin = await makeUser({ role: 'Admin' });
  const owner = await makeUser({ role: 'Proprietaire' });
  const client = await makeUser({ role: 'Client' });
  const property = await Property.create({
    title: 'Maison Contrat Concurrence', description: 'Description suffisamment longue pour la validation du modèle Property.',
    pole: 'Altimmo', type: 'Maison', status: 'location', price: 400000,
    address: { arrondissement: 'Moungali', city: 'Brazzaville' }, latitude: -4.25, longitude: 15.27, images: ['https://placehold.co/1200x800/png?text=Test'], surface: 90, bedrooms: 2, bathrooms: 1,
    statusAdmin: 'Validée', isPublished: true, availability: 'Disponible', owner: owner._id,
  });
  const application = await RealEstateApplication.create({
    kind: 'rental_application', property: property._id, applicant: client._id, owner: owner._id,
    validUntil: new Date(Date.now() + 24 * 60 * 60 * 1000),
    rentalApplication: { desiredMoveIn: new Date(), desiredDurationMonths: 12, occupants: 2 },
    history: [{ from: null, to: 'submitted', action: 'submitted', actor: client._id }],
  });
  const { reservation } = await acceptApplication({ applicationId: application._id, actorId: admin._id, idempotencyKey: `test:${application._id}` });
  return { adminToken: signToken(admin._id), propertyId: property._id, reservationId: reservation._id };
}

const contractPayload = (propertyId, reservationId) => ({
  bien: propertyId, type: 'location', reservation: reservationId, statut: 'actif',
  dateEntree: '2027-02-01', dateFinBail: '2028-01-31', montantLoyer: 400000,
});

test('deux créations de contrat simultanées sur la même réservation : une seule réussit', async () => {
  const { adminToken, propertyId, reservationId } = await setupActiveRentalReservation();
  const payload = contractPayload(propertyId, reservationId);

  const [responseA, responseB] = await Promise.all([
    request(app).post('/api/contrats').set('Authorization', `Bearer ${adminToken}`).send(payload),
    request(app).post('/api/contrats').set('Authorization', `Bearer ${adminToken}`).send(payload),
  ]);
  const statuses = [responseA.status, responseB.status].sort((a, b) => a - b);
  expect(statuses[0]).toBe(201);
  expect(statuses[1]).toBe(409);

  const contracts = await Contrat.find({ reservation: reservationId });
  expect(contracts).toHaveLength(1);
  expect(contracts[0].statut).toBe('actif');

  const reservation = await RealEstateReservation.findById(reservationId);
  expect(reservation.status).toBe('converted');
});
