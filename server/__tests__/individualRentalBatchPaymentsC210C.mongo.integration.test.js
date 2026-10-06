jest.mock('../services/rentalTenantNotificationService', () => ({ notifyContractTenant: jest.fn().mockResolvedValue(null) }));

const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const { startFinancialMongo, stopFinancialMongo } = require('./helpers/financialMongoEnvironment');
const User = require('../models/User');
const Property = require('../models/Property');
const Contrat = require('../models/Contrat');
const Paiement = require('../models/Paiement');
const RentalPaymentReceipt = require('../models/RentalPaymentReceipt');
const IndividualSubscription = require('../models/IndividualSubscription');
const { errorHandler } = require('../middleware/errorMiddleware');

jest.setTimeout(120000);
const app = express();
app.use(express.json());
app.use('/api/paiements/location', require('../routes/paiementLocationRoutes'));
app.use(errorHandler);

let seq = 0;
const makeOwner = () => User.create({ name: `C210C Owner ${++seq}`, email: `c210c-batch-${seq}-${Date.now()}@example.test`, password: 'Password123!', passwordConfirm: 'Password123!', role: 'Proprietaire', isEmailVerified: true });
const as = (actor) => ({ Authorization: `Bearer ${jwt.sign({ id: actor._id, tokenVersion: 0 }, process.env.JWT_SECRET, { expiresIn: '1d' })}` });

async function seedLease(owner, key, tenant = null) {
  const property = await Property.create({
    title: `C210C ${key}`, description: 'Description suffisamment longue pour validation.', pole: 'Altimmo', type: 'Appartement', status: 'location', price: 150000,
    address: { city: 'Brazzaville', arrondissement: 'Centre' }, images: ['https://example.test/property.jpg'], surface: 55,
    statusAdmin: 'Validée', availability: 'Disponible', latitude: -4.27, longitude: 15.27, owner: owner._id, tenant,
  });
  const contrat = await Contrat.create({ type: 'location', bien: property._id, statut: 'actif', dateEntree: '2027-01-01', dateFinBail: '2027-12-31', montantLoyer: 150000 });
  const payments = await Paiement.create([
    { contrat: contrat._id, mois: 1, annee: 2027, montant: 150000, montantTotal: 150000, statut: 'impayé' },
    { contrat: contrat._id, mois: 2, annee: 2027, montant: 150000, montantTotal: 150000, statut: 'impayé' },
  ]);
  return { property, contrat, payments };
}

const payload = (lease, allocations = lease.payments.map((p) => ({ paiementId: p._id, montant: 50000 }))) => ({
  contrat: lease.contrat._id, allocations, datePaiement: '2027-02-10', modePaiement: 'virement', reference: 'C210C-BATCH',
});

beforeAll(async () => { await startFinancialMongo(); await IndividualSubscription.syncIndexes(); });
afterAll(stopFinancialMongo);
beforeEach(async () => {
  await Promise.all([RentalPaymentReceipt.deleteMany({}), Paiement.deleteMany({}), Contrat.deleteMany({}), Property.deleteMany({}), IndividualSubscription.deleteMany({}), User.deleteMany({})]);
});

test('Individual A + toutes les échéances A : batch autorisé et atomique', async () => {
  const ownerA = await makeOwner();
  const leaseA = await seedLease(ownerA, 'A');
  await IndividualSubscription.create({ user: ownerA._id, plan: 'premium', status: 'active', modulesIncluded: ['location'] });

  const res = await request(app).post('/api/paiements/location/encaisser-multiple?scope=individual').set(as(ownerA)).send(payload(leaseA));
  expect(res.status).toBe(200);
  expect(res.body.data.receipts).toHaveLength(2);
});

test('Individual A + échéance B : refus du batch entier sans mutation', async () => {
  const [ownerA, ownerB] = await Promise.all([makeOwner(), makeOwner()]);
  const [leaseA, leaseB] = await Promise.all([seedLease(ownerA, 'A'), seedLease(ownerB, 'B')]);
  await IndividualSubscription.create({ user: ownerA._id, plan: 'premium', status: 'active', modulesIncluded: ['location'] });

  const allocations = [
    { paiementId: leaseA.payments[0]._id, montant: 50000 },
    { paiementId: leaseB.payments[0]._id, montant: 50000 },
  ];
  const res = await request(app).post('/api/paiements/location/encaisser-multiple?scope=individual').set(as(ownerA)).send(payload(leaseA, allocations));
  expect([404, 422]).toContain(res.status);
  expect((await Paiement.findById(leaseA.payments[0]._id)).montantRecu || 0).toBe(0);
  expect(await RentalPaymentReceipt.countDocuments({})).toBe(0);
});

test('Individual A + contrat organisationnel : refus sans mutation', async () => {
  const ownerA = await makeOwner();
  const tenantId = new (require('mongoose').Types.ObjectId)();
  const organizationLease = await seedLease(ownerA, 'ORG', tenantId);
  await IndividualSubscription.create({ user: ownerA._id, plan: 'premium', status: 'active', modulesIncluded: ['location'] });

  const res = await request(app).post('/api/paiements/location/encaisser-multiple?scope=individual').set(as(ownerA)).send(payload(organizationLease));
  expect(res.status).toBe(404);
  expect(await RentalPaymentReceipt.countDocuments({})).toBe(0);
});

test('abonnement expiré : mutation refusée et données conservées', async () => {
  const ownerA = await makeOwner();
  const leaseA = await seedLease(ownerA, 'EXPIRED');
  await IndividualSubscription.create({ user: ownerA._id, plan: 'premium', status: 'past_due', modulesIncluded: ['location'] });

  const res = await request(app).post('/api/paiements/location/encaisser-multiple?scope=individual').set(as(ownerA)).send(payload(leaseA));
  expect(res.status).toBe(403);
  expect(await Paiement.countDocuments({ contrat: leaseA.contrat._id })).toBe(2);
  expect(await RentalPaymentReceipt.countDocuments({})).toBe(0);
});
