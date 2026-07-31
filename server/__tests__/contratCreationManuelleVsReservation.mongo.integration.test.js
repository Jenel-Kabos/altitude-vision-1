// REG-GL-1 — Hotfix : POST /api/contrats sert DEUX parcours distincts.
// (1) Création manuelle staff depuis GestionLocativePage — n'a JAMAIS
// transmis de `reservation` (voir commentaire de
// real-estate-rental-activation.spec.js, Sprint IM-2.2). Ce parcours
// nécessite seulement un bien validé + disponible.
// (2) Création liée à une candidature/réservation publique acceptée
// (RealEstateApplicationsPage) — doit rester strictement verrouillée sur
// une réservation active et cohérente (IM-1R/IM-2.2).
// Le commit "Update Altimmo 1" a rendu la réservation obligatoire sans
// condition, cassant le parcours (1) : toute soumission du formulaire
// manuel renvoyait 409 ACTIVE_RESERVATION_REQUIRED alors qu'aucune
// réservation n'existe jamais pour ce parcours. Ce fichier reproduit le bug
// initial (test qui aurait échoué avant le correctif) et verrouille les
// deux parcours.

const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const { startFinancialMongo, clearFinancialMongo, stopFinancialMongo } = require('./helpers/financialMongoEnvironment');
const User = require('../models/User');
const Property = require('../models/Property');
const RealEstateApplication = require('../models/RealEstateApplication');
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
  return User.create({ name: 'Utilisateur Test', email: `contratreg${counter}${Date.now()}@example.com`, password: 'Password123!', passwordConfirm: 'Password123!', role: 'Client', ...overrides });
};

beforeAll(async () => { await startFinancialMongo(); await Contrat.syncIndexes(); });
afterEach(clearFinancialMongo);
afterAll(stopFinancialMongo);

async function makeAvailableProperty(overrides = {}) {
  const owner = await makeUser({ role: 'Proprietaire' });
  return Property.create({
    title: 'Maison Test Contrat Manuel', description: 'Description suffisamment longue pour la validation du modèle Property.',
    pole: 'Altimmo', type: 'Maison', status: 'location', price: 400000,
    address: { arrondissement: 'Moungali', city: 'Brazzaville' }, latitude: -4.25, longitude: 15.27,
    images: ['https://placehold.co/1200x800/png?text=Test'], surface: 90, bedrooms: 2, bathrooms: 1,
    statusAdmin: 'Validée', isPublished: true, availability: 'Disponible', owner: owner._id,
    ...overrides,
  });
}

test('[BUG REPRODUIT] création manuelle (payload GestionLocativePage, sans `reservation`) réussit — ne renvoie plus 409 ACTIVE_RESERVATION_REQUIRED', async () => {
  const admin = await makeUser({ role: 'Admin' });
  const property = await makeAvailableProperty();

  // Payload exact tel que construit par GestionLocativePage.jsx::handleSaveContrat
  // (aucun champ `reservation` — jamais envoyé par ce formulaire).
  const res = await request(app).post('/api/contrats').set('Authorization', `Bearer ${signToken(admin._id)}`).send({
    type: 'location', bien: property._id, proprietaire: undefined, statut: 'actif',
    adresseBien: 'Test', villeBien: 'Brazzaville',
    dateEntree: '2027-01-01', dateFinBail: '2027-12-31', montantLoyer: 300000,
  });

  expect(res.status).toBe(201);
  expect(res.body.data.contrat.reservation).toBeFalsy();
  expect(await Contrat.countDocuments({ bien: property._id })).toBe(1);
});

test('bien non disponible (availability !== "Disponible") sans réservation : 409 explicite, pas de contrat créé', async () => {
  const admin = await makeUser({ role: 'Admin' });
  const property = await makeAvailableProperty({ availability: 'Loué' });

  const res = await request(app).post('/api/contrats').set('Authorization', `Bearer ${signToken(admin._id)}`).send({
    type: 'location', bien: property._id, statut: 'actif', dateEntree: '2027-01-01', dateFinBail: '2027-12-31', montantLoyer: 300000,
  });

  expect(res.status).toBe(409);
  expect(res.body.code).toBe('PROPERTY_NOT_AVAILABLE');
  expect(await Contrat.countDocuments({ bien: property._id })).toBe(0);
});

test('double soumission (double clic) sur la création manuelle : un seul contrat créé, la seconde requête échoue proprement', async () => {
  const admin = await makeUser({ role: 'Admin' });
  const property = await makeAvailableProperty();
  const payload = {
    type: 'location', bien: property._id, statut: 'actif',
    dateEntree: '2027-01-01', dateFinBail: '2027-12-31', montantLoyer: 300000,
  };
  const token = signToken(admin._id);

  const [first, second] = await Promise.all([
    request(app).post('/api/contrats').set('Authorization', `Bearer ${token}`).send(payload),
    request(app).post('/api/contrats').set('Authorization', `Bearer ${token}`).send(payload),
  ]);

  const statuses = [first.status, second.status].sort();
  expect(statuses).toEqual([201, 409]);
  expect(await Contrat.countDocuments({ bien: property._id })).toBe(1);
});

test('bien non validé (statusAdmin !== "Validée") sans réservation : 409, pas de contrat créé', async () => {
  const admin = await makeUser({ role: 'Admin' });
  const property = await makeAvailableProperty({ statusAdmin: 'En attente' });

  const res = await request(app).post('/api/contrats').set('Authorization', `Bearer ${signToken(admin._id)}`).send({
    type: 'location', bien: property._id, statut: 'actif', dateEntree: '2027-01-01', dateFinBail: '2027-12-31', montantLoyer: 300000,
  });

  expect(res.status).toBe(409);
  expect(res.body.code).toBe('PROPERTY_NOT_AVAILABLE');
});

test('parcours réservation (candidature acceptée) : la réservation reste strictement requise et cohérente — comportement inchangé', async () => {
  const admin = await makeUser({ role: 'Admin' });
  const owner = await makeUser({ role: 'Proprietaire' });
  const client = await makeUser({ role: 'Client' });
  const property = await Property.create({
    title: 'Maison Réservation', description: 'Description suffisamment longue pour la validation du modèle Property.',
    pole: 'Altimmo', type: 'Maison', status: 'location', price: 400000,
    address: { arrondissement: 'Moungali', city: 'Brazzaville' }, latitude: -4.25, longitude: 15.27,
    images: ['https://placehold.co/1200x800/png?text=Test'], surface: 90, bedrooms: 2, bathrooms: 1,
    statusAdmin: 'Validée', isPublished: true, availability: 'Disponible', owner: owner._id,
  });
  const application = await RealEstateApplication.create({
    kind: 'rental_application', property: property._id, applicant: client._id, owner: owner._id,
    validUntil: new Date(Date.now() + 24 * 60 * 60 * 1000),
    rentalApplication: { desiredMoveIn: new Date(), desiredDurationMonths: 12, occupants: 2 },
    history: [{ from: null, to: 'submitted', action: 'submitted', actor: client._id }],
  });
  const { reservation } = await acceptApplication({ applicationId: application._id, actorId: admin._id, idempotencyKey: `test:${application._id}` });

  // Sans reservation fournie alors que le bien est verrouillé "Réservé" (pas "Disponible") : doit échouer.
  const withoutReservation = await request(app).post('/api/contrats').set('Authorization', `Bearer ${signToken(admin._id)}`).send({
    type: 'location', bien: property._id, statut: 'actif', dateEntree: '2027-01-01', dateFinBail: '2027-12-31', montantLoyer: 300000,
  });
  expect(withoutReservation.status).toBe(409);
  expect(withoutReservation.body.code).toBe('PROPERTY_NOT_AVAILABLE');

  // Avec la réservation correcte : doit réussir, et convertir la réservation.
  const withReservation = await request(app).post('/api/contrats').set('Authorization', `Bearer ${signToken(admin._id)}`).send({
    type: 'location', bien: property._id, reservation: reservation._id, statut: 'actif',
    dateEntree: '2027-01-01', dateFinBail: '2027-12-31', montantLoyer: 300000,
  });
  expect(withReservation.status).toBe(201);
  expect(await Contrat.countDocuments({ bien: property._id })).toBe(1);

  // Réservation inexistante/incohérente : toujours rejetée (le durcissement métier reste intact).
  const property2 = await Property.create({
    title: 'Autre Maison', description: 'Description suffisamment longue pour la validation du modèle Property.',
    pole: 'Altimmo', type: 'Maison', status: 'location', price: 400000,
    address: { arrondissement: 'Moungali', city: 'Brazzaville' }, latitude: -4.25, longitude: 15.27,
    images: ['https://placehold.co/1200x800/png?text=Test'], surface: 90, bedrooms: 2, bathrooms: 1,
    statusAdmin: 'Validée', isPublished: true, availability: 'Disponible', owner: owner._id,
  });
  const bogusReservation = await request(app).post('/api/contrats').set('Authorization', `Bearer ${signToken(admin._id)}`).send({
    type: 'location', bien: property2._id, reservation: reservation._id /* déjà convertie, autre bien */, statut: 'actif',
    dateEntree: '2027-01-01', dateFinBail: '2027-12-31', montantLoyer: 300000,
  });
  expect(bogusReservation.status).toBe(409);
  expect(bogusReservation.body.code).toBe('ACTIVE_RESERVATION_REQUIRED');
});
