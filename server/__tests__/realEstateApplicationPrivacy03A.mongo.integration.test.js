// GIT-INTEGRATION-03A — confidentialité des candidatures : cas d'accès non
// couverts par les suites de cf3fbcd1 / P1-D (candidat étranger, tiers non
// habilité, modification non autorisée, vue propriétaire masquée). Parcours
// HTTP réels, aucun contrôle désactivé.
const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const { startFinancialMongo, clearFinancialMongo, stopFinancialMongo } = require('./helpers/financialMongoEnvironment');
const User = require('../models/User');
const Property = require('../models/Property');
const Application = require('../models/RealEstateApplication');
const { errorHandler } = require('../middleware/errorMiddleware');

jest.setTimeout(180000);
const app = express();
app.use(express.json());
app.use('/api/real-estate-applications', require('../routes/realEstateApplicationRoutes'));
app.use(errorHandler);

const bearer = (value) => ({ Authorization: `Bearer ${jwt.sign({ id: value._id, tokenVersion: 0 }, process.env.JWT_SECRET, { expiresIn: '1h' })}` });
let seq = 0;
const user = (role, label) => User.create({ name: `Priv ${label} ${++seq}`, email: `priv03a-${label}-${seq}-${Date.now()}@example.test`, password: 'Password123!', passwordConfirm: 'Password123!', role, isEmailVerified: true });

let owner; let applicant; let otherApplicant; let stranger; let application; let otherApplication;
beforeAll(startFinancialMongo);
afterAll(stopFinancialMongo);
beforeEach(async () => {
  await clearFinancialMongo();
  [owner, applicant, otherApplicant, stranger] = await Promise.all([user('Proprietaire', 'owner'), user('Client', 'app'), user('Client', 'other'), user('Client', 'stranger')]);
  const property = await Property.create({
    title: 'Villa confidentialité 03A', description: 'Description suffisamment longue pour la validation du modele Property.',
    pole: 'Altimmo', type: 'Villa', status: 'location', price: 300000,
    address: { arrondissement: 'Bacongo', city: 'Brazzaville' }, latitude: -4.26, longitude: 15.24,
    images: ['https://placehold.co/1200x800/png?text=Test'], surface: 90,
    statusAdmin: 'Validée', availability: 'Disponible', owner: owner._id,
  });
  const base = { kind: 'rental_application', property: property._id, owner: owner._id, validUntil: new Date(Date.now() + 30 * 86400000), rentalApplication: { desiredMoveIn: new Date(), desiredDurationMonths: 12, occupants: 1 } };
  [application, otherApplication] = await Promise.all([
    Application.create({ ...base, applicant: applicant._id }),
    Application.create({ ...base, applicant: otherApplicant._id }),
  ]);
});

test('un candidat ne peut pas lire la candidature d’un autre candidat', async () => {
  const res = await request(app).get(`/api/real-estate-applications/${otherApplication._id}`).set(bearer(applicant));
  expect([403, 404]).toContain(res.status);
  expect(JSON.stringify(res.body)).not.toContain(otherApplicant.email);
});

test('un utilisateur sans lien avec le dossier ne le lit ni ne le liste', async () => {
  const one = await request(app).get(`/api/real-estate-applications/${application._id}`).set(bearer(stranger));
  expect([403, 404]).toContain(one.status);
  expect(JSON.stringify(one.body)).not.toContain(applicant.email);
  const list = await request(app).get('/api/real-estate-applications').set(bearer(stranger));
  expect(JSON.stringify(list.body)).not.toContain(applicant.email);
  expect(JSON.stringify(list.body)).not.toContain(String(application._id));
});

test('modifications non autorisées refusées sans effet : tiers (accept/reject/withdraw) et candidat sur sa propre décision', async () => {
  for (const action of ['accept', 'reject', 'review', 'withdraw']) {
    const res = await request(app).post(`/api/real-estate-applications/${application._id}/${action}`).set(bearer(stranger)).send({ reason: 'tentative' });
    expect(res.status).toBeGreaterThanOrEqual(400);
  }
  for (const action of ['accept', 'review']) {
    const res = await request(app).post(`/api/real-estate-applications/${application._id}/${action}`).set(bearer(applicant)).send({});
    expect(res.status).toBeGreaterThanOrEqual(400);
  }
  expect((await Application.findById(application._id).lean()).status).toBe('submitted');
});

test('le propriétaire accède au dossier sans les coordonnées du candidat (aucune divulgation autorisée)', async () => {
  const res = await request(app).get(`/api/real-estate-applications/${application._id}`).set(bearer(owner));
  expect(res.status).toBe(200);
  expect(JSON.stringify(res.body)).not.toContain(applicant.email);
  const list = await request(app).get('/api/real-estate-applications').set(bearer(owner));
  expect(list.status).toBe(200);
  expect(JSON.stringify(list.body)).not.toContain(applicant.email);
  expect(JSON.stringify(list.body)).not.toContain(otherApplicant.email);
});
