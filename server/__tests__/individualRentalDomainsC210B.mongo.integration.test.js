const { startFinancialMongo, stopFinancialMongo } = require('./helpers/financialMongoEnvironment');
const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Property = require('../models/Property');
const RentalManagement = require('../models/RentalManagement');
const Contrat = require('../models/Contrat');
const Locataire = require('../models/Locataire');
const Proprietaire = require('../models/Proprietaire');
const Paiement = require('../models/Paiement');
const RentalMaintenanceTicket = require('../models/RentalMaintenanceTicket');
const IndividualSubscription = require('../models/IndividualSubscription');
const { errorHandler } = require('../middleware/errorMiddleware');
const {
  assertIndividualRentalResourceAccess,
  individualRentalDomainIds,
} = require('../services/rentalIndividualResourceAccessService');

jest.setTimeout(120000);
const app = express();
app.use(express.json());
app.use('/api/contrats/location', require('../routes/rentalContratRoutes'));
app.use('/api/rental-lease-lifecycle', require('../routes/rentalLeaseLifecycleRoutes'));
app.use('/api/locataires', require('../routes/locataireRoutes'));
app.use('/api/paiements/location', require('../routes/paiementLocationRoutes'));
app.use('/api/rental-maintenance', require('../routes/rentalMaintenanceRoutes'));
app.use(errorHandler);
let seq = 0;
const makeUser = () => User.create({ name: `B3 Owner ${++seq}`, email: `b3-${seq}-${Date.now()}@example.test`, password: 'Password123!', passwordConfirm: 'Password123!', role: 'Proprietaire', isEmailVerified: true });
const as = (actor) => ({ Authorization: `Bearer ${jwt.sign({ id: actor._id, tokenVersion: 0 }, process.env.JWT_SECRET, { expiresIn: '1d' })}` });

async function seed(owner, key) {
  const property = await Property.create({
    title: `B3 ${key}`, description: 'Description suffisamment longue pour validation.', pole: 'Altimmo', type: 'Appartement', status: 'location', price: 200000,
    address: { city: 'Brazzaville', arrondissement: 'Centre' }, images: ['https://example.test/p.jpg'], surface: 60,
    statusAdmin: 'Validée', availability: 'Disponible', latitude: -4.27, longitude: 15.27, owner: owner._id, tenant: null,
  });
  const rental = await RentalManagement.create({ property: property._id, owner: owner._id, tenant: null, managementActivated: true });
  const locataire = await Locataire.create({ nom: `Loc ${key}`, prenom: 'Test', telephone: `0600${seq}${key.length}`, email: `loc-${key}-${Date.now()}@example.test` });
  const proprietaire = await Proprietaire.create({ nom: `Prop ${key}`, prenom: 'Test', telephone: `0500${seq}${key.length}` });
  const contrat = await Contrat.create({ type: 'location', bien: property._id, locataire: locataire._id, proprietaire: proprietaire._id, statut: 'actif', dateEntree: '2027-01-01', dateFinBail: '2027-12-31', montantLoyer: 200000 });
  const paiement = await Paiement.create({ contrat: contrat._id, mois: 1, annee: 2027, montant: 200000, statut: 'impayé' });
  const maintenance = await RentalMaintenanceTicket.create({ property: property._id, category: 'plomberie', description: `Fuite ${key}`, owner: owner._id });
  return { property, rental, locataire, proprietaire, contrat, paiement, maintenance };
}

beforeAll(startFinancialMongo);
afterAll(stopFinancialMongo);
beforeEach(async () => {
  await Promise.all([RentalMaintenanceTicket.deleteMany({}), Paiement.deleteMany({}), Contrat.deleteMany({}), Locataire.deleteMany({}), Proprietaire.deleteMany({}), RentalManagement.deleteMany({}), Property.deleteMany({}), IndividualSubscription.deleteMany({}), User.deleteMany({})]);
  await IndividualSubscription.syncIndexes();
});

test('B3 — RentalManagement, bail, locataire, propriétaire, paiement et maintenance héritent du scope Property', async () => {
  const [ownerA, ownerB] = await Promise.all([makeUser(), makeUser()]);
  const [a, b] = await Promise.all([seed(ownerA, 'A'), seed(ownerB, 'B')]);
  await Promise.all([ownerA, ownerB].map((owner) => IndividualSubscription.create({ user: owner._id, plan: 'premium', status: 'active', modulesIncluded: ['location'] })));
  const resources = [
    ['RentalManagement', a.rental, b.rental],
    ['Contrat', a.contrat, b.contrat],
    ['Locataire', a.locataire, b.locataire],
    ['Proprietaire', a.proprietaire, b.proprietaire],
    ['Paiement', a.paiement, b.paiement],
    ['RentalMaintenanceTicket', a.maintenance, b.maintenance],
  ];

  for (const [resourceType, own, foreign] of resources) {
    await expect(assertIndividualRentalResourceAccess({ resourceType, resource: own, userId: ownerA._id }))
      .resolves.toMatchObject({ scope: 'INDIVIDUAL', ownerId: String(ownerA._id) });
    await expect(assertIndividualRentalResourceAccess({ resourceType, resource: foreign, userId: ownerA._id }))
      .rejects.toMatchObject({ code: 'INDIVIDUAL_RENTAL_RESOURCE_NOT_FOUND', statusCode: 404 });
  }
});

test('B3 — projections de listes strictement bornées aux relations métier du propriétaire', async () => {
  const [ownerA, ownerB] = await Promise.all([makeUser(), makeUser()]);
  const [a] = await Promise.all([seed(ownerA, 'A'), seed(ownerB, 'B')]);
  await IndividualSubscription.create({ user: ownerA._id, plan: 'premium', status: 'active', modulesIncluded: ['location'] });

  await expect(individualRentalDomainIds(ownerA._id)).resolves.toMatchObject({
    propertyIds: [a.property._id], contractIds: [a.contrat._id], tenantPartyIds: [a.locataire._id],
    ownerPartyIds: [a.proprietaire._id], paymentIds: [a.paiement._id], maintenanceIds: [a.maintenance._id],
  });
});

test('B3 — abonnement expiré bloque les opérations mais conserve toutes les données', async () => {
  const ownerA = await makeUser();
  const a = await seed(ownerA, 'A');
  await IndividualSubscription.create({ user: ownerA._id, plan: 'premium', status: 'past_due', modulesIncluded: ['location'] });
  await expect(assertIndividualRentalResourceAccess({ resourceType: 'Contrat', resource: a.contrat, userId: ownerA._id }))
    .rejects.toMatchObject({ code: 'INDIVIDUAL_ENTITLEMENT_REQUIRED' });
  expect(await Promise.all([
    Property.exists({ _id: a.property._id }), RentalManagement.exists({ _id: a.rental._id }), Contrat.exists({ _id: a.contrat._id }),
    Locataire.exists({ _id: a.locataire._id }), Paiement.exists({ _id: a.paiement._id }), RentalMaintenanceTicket.exists({ _id: a.maintenance._id }),
  ])).toEqual([expect.anything(), expect.anything(), expect.anything(), expect.anything(), expect.anything(), expect.anything()]);
});

test('B3 — une partie pré-bail exige une provenance individualOwner explicite', async () => {
  const [ownerA, ownerB] = await Promise.all([makeUser(), makeUser()]);
  await Promise.all([ownerA, ownerB].map((owner) => IndividualSubscription.create({ user: owner._id, plan: 'premium', status: 'active', modulesIncluded: ['location'] })));
  const attributed = await Locataire.create({ nom: 'Pré-bail', prenom: 'A', telephone: '0600999000', individualOwner: ownerA._id });
  const legacy = await Locataire.create({ nom: 'Legacy', prenom: 'Sans preuve', telephone: '0600999001' });

  await expect(assertIndividualRentalResourceAccess({ resourceType: 'Locataire', resource: attributed, userId: ownerA._id }))
    .resolves.toMatchObject({ scope: 'INDIVIDUAL', ownerId: String(ownerA._id) });
  await expect(assertIndividualRentalResourceAccess({ resourceType: 'Locataire', resource: attributed, userId: ownerB._id }))
    .rejects.toMatchObject({ statusCode: 404 });
  await expect(assertIndividualRentalResourceAccess({ resourceType: 'Locataire', resource: legacy, userId: ownerA._id }))
    .rejects.toMatchObject({ statusCode: 404 });
});

test('B3 HTTP bail — lecture/écriture owner exact et IDOR refusé', async () => {
  const [ownerA, ownerB] = await Promise.all([makeUser(), makeUser()]);
  const [a, b] = await Promise.all([seed(ownerA, 'A'), seed(ownerB, 'B')]);
  await Promise.all([ownerA, ownerB].map((owner) => IndividualSubscription.create({ user: owner._id, plan: 'premium', status: 'active', modulesIncluded: ['location'] })));

  const list = await request(app).get('/api/contrats/location?scope=individual').set(as(ownerA));
  expect(list.status).toBe(200);
  expect(list.body.data.contrats.map((row) => row._id)).toEqual([String(a.contrat._id)]);
  expect((await request(app).get(`/api/contrats/location/${a.contrat._id}?scope=individual`).set(as(ownerA))).status).toBe(200);
  expect((await request(app).get(`/api/contrats/location/${b.contrat._id}?scope=individual`).set(as(ownerA))).status).toBe(404);

  const update = await request(app).put(`/api/contrats/location/${a.contrat._id}?scope=individual`).set(as(ownerA)).send({ notes: 'autogéré' });
  expect(update.status).toBe(200);
  expect((await Contrat.findById(a.contrat._id).lean()).notes).toBe('autogéré');
  expect((await request(app).put(`/api/contrats/location/${a.contrat._id}?scope=individual`).set(as(ownerB)).send({ notes: 'pwned' })).status).toBe(404);
});

test('C2.10C HTTP création bail — une partie pré-bail étrangère ne peut pas être greffée au bien individuel', async () => {
  const [ownerA, ownerB] = await Promise.all([makeUser(), makeUser()]);
  await Promise.all([ownerA, ownerB].map((owner) => IndividualSubscription.create({ user: owner._id, plan: 'premium', status: 'active', modulesIncluded: ['location'] })));
  const property = await Property.create({
    title: 'B3 création A', description: 'Description suffisamment longue pour validation.', pole: 'Altimmo', type: 'Appartement', status: 'location', price: 200000,
    address: { city: 'Brazzaville', arrondissement: 'Centre' }, images: ['https://example.test/create.jpg'], surface: 60,
    statusAdmin: 'Validée', availability: 'Disponible', latitude: -4.27, longitude: 15.27, owner: ownerA._id, tenant: null,
  });
  await RentalManagement.create({ property: property._id, owner: ownerA._id, tenant: null, managementActivated: true });
  const [ownTenant, foreignTenant] = await Promise.all([
    Locataire.create({ nom: 'Propre', prenom: 'A', telephone: '0600777001', individualOwner: ownerA._id }),
    Locataire.create({ nom: 'Étranger', prenom: 'B', telephone: '0600777002', individualOwner: ownerB._id }),
  ]);
  const base = { bien: property._id, type: 'location', dateEntree: '2027-01-01', dateFinBail: '2027-12-31', montantLoyer: 200000 };

  const denied = await request(app).post('/api/contrats/location?scope=individual').set(as(ownerA)).send({ ...base, locataire: foreignTenant._id });
  expect(denied.status).toBe(404);
  expect(await Contrat.countDocuments({ bien: property._id })).toBe(0);

  const allowed = await request(app).post('/api/contrats/location?scope=individual').set(as(ownerA)).send({ ...base, locataire: ownTenant._id });
  expect(allowed.status).toBe(201);
  expect(String(allowed.body.data.contrat.locataire._id || allowed.body.data.contrat.locataire)).toBe(String(ownTenant._id));
});

test('B3 HTTP lifecycle/overview — propriétaire exact uniquement', async () => {
  const [ownerA, ownerB] = await Promise.all([makeUser(), makeUser()]);
  const [a, b] = await Promise.all([seed(ownerA, 'A'), seed(ownerB, 'B')]);
  await Promise.all([ownerA, ownerB].map((owner) => IndividualSubscription.create({ user: owner._id, plan: 'premium', status: 'active', modulesIncluded: ['location'] })));

  expect((await request(app).get('/api/rental-lease-lifecycle/dashboard?scope=individual').set(as(ownerA))).status).toBe(200);
  expect((await request(app).get(`/api/rental-lease-lifecycle/${a.contrat._id}/available-transitions?scope=individual`).set(as(ownerA))).status).toBe(200);
  expect((await request(app).get(`/api/rental-lease-lifecycle/${b.contrat._id}/available-transitions?scope=individual`).set(as(ownerA))).status).toBe(404);
});

test('B3 HTTP locataires/paiements/maintenance — listes et IDs owner-scoped', async () => {
  const [ownerA, ownerB] = await Promise.all([makeUser(), makeUser()]);
  const [a, b] = await Promise.all([seed(ownerA, 'A'), seed(ownerB, 'B')]);
  await Promise.all([ownerA, ownerB].map((owner) => IndividualSubscription.create({ user: owner._id, plan: 'premium', status: 'active', modulesIncluded: ['location'] })));

  const tenants = await request(app).get('/api/locataires?scope=individual').set(as(ownerA));
  expect(tenants.status).toBe(200);
  expect(tenants.body.data.locataires.map((row) => row._id)).toEqual([String(a.locataire._id)]);
  expect((await request(app).get(`/api/locataires/${b.locataire._id}?scope=individual`).set(as(ownerA))).status).toBe(404);

  const payments = await request(app).get('/api/paiements/location?scope=individual').set(as(ownerA));
  expect(payments.status).toBe(200);
  expect(payments.body.data.paiements.map((row) => row._id)).toEqual([String(a.paiement._id)]);
  expect((await request(app).get(`/api/paiements/location/${b.paiement._id}?scope=individual`).set(as(ownerA))).status).toBe(404);

  const maintenance = await request(app).get('/api/rental-maintenance?scope=individual').set(as(ownerA));
  expect(maintenance.status).toBe(200);
  expect(maintenance.body.data.tickets.map((row) => row._id)).toEqual([String(a.maintenance._id)]);
  expect((await request(app).get(`/api/rental-maintenance?scope=individual&propertyId=${b.property._id}`).set(as(ownerA))).status).toBe(404);
});
