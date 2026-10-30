const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const { startFinancialMongo, clearFinancialMongo, stopFinancialMongo } = require('./helpers/financialMongoEnvironment');
const User = require('../models/User');
const Property = require('../models/Property');
const PlatformOperator = require('../models/PlatformOperator');
const CommercialPublicationRevision = require('../models/CommercialPublicationRevision');
const propertyRoutes = require('../routes/propertyRoutes');
const adminPropertyRoutes = require('../routes/adminPropertyRoutes');
const { PLATFORM_VIEW_REQUIRED_CAPABILITIES } = require('../constants/platformOperatorConstants');
const { errorHandler } = require('../middleware/errorMiddleware');

jest.setTimeout(180000);
const app = express();
app.use(express.json());
app.use('/api/properties', propertyRoutes);
app.use('/api/admin', adminPropertyRoutes);
app.use(errorHandler);
const bearer = (user) => ({ Authorization: `Bearer ${jwt.sign({ id: user._id, tokenVersion: 0 }, process.env.JWT_SECRET, { expiresIn: '1d' })}` });

beforeAll(startFinancialMongo);
afterEach(clearFinancialMongo);
afterAll(stopFinancialMongo);

async function fixture() {
  const createUser = (name, role) => User.create({
    name, email: `${name.replaceAll(' ', '-').toLowerCase()}-${Date.now()}-${Math.random()}@example.test`,
    password: 'Password123!', passwordConfirm: 'Password123!', role, isEmailVerified: true,
  });
  const owner = await createUser('Owner Route Lifecycle', 'Proprietaire');
  const stranger = await createUser('Stranger Route Lifecycle', 'Proprietaire');
  const operator = await createUser('Operator Route Lifecycle', 'Admin');
  const weakAdmin = await createUser('Weak Route Lifecycle', 'Admin');
  await PlatformOperator.create({
    user: operator._id, capabilities: [...PLATFORM_VIEW_REQUIRED_CAPABILITIES],
    grantedBy: operator._id, grantReason: 'TEST DATA lifecycle routes',
  });
  const property = await Property.create({
    title: 'Villa route cycle', description: 'Description route cycle', price: 100000,
    status: 'vente', type: 'Villa', pole: 'Altimmo', owner: owner._id,
    address: { arrondissement: 'Bacongo', city: 'Brazzaville' }, latitude: -4.2,
    longitude: 15.2, images: ['cycle.jpg'], surface: 120, availability: 'Disponible',
    statusAdmin: 'Validée', isPublished: true, publicationLifecycleState: 'published',
    commercialPublicationVersion: 1,
  });
  return { owner, stranger, operator, weakAdmin, property };
}

test('le propriétaire retire son annonce mais un tiers ne peut pas agir', async () => {
  const { owner, stranger, property } = await fixture();
  const forbidden = await request(app).patch(`/api/properties/${property._id}/lifecycle`)
    .set(bearer(stranger)).send({ availability: 'Vendu', reason: 'Tentative tierce' });
  expect(forbidden.status).toBe(403);
  const withdrawn = await request(app).patch(`/api/properties/${property._id}/lifecycle`)
    .set(bearer(owner)).send({ availability: 'Loué', reason: 'Bail signé hors plateforme' });
  expect(withdrawn.status).toBe(200);
  expect(withdrawn.body.data.property).toMatchObject({ availability: 'Loué', isPublished: false, publicationLifecycleState: 'owner_withdrawn' });
});

test('la réactivation reste en attente et crée une révision sans accepter de champs administratifs', async () => {
  const { owner, property } = await fixture();
  await Property.updateOne({ _id: property._id }, { publicationLifecycleState: 'owner_withdrawn', availability: 'Retiré', isPublished: false });
  const response = await request(app).post(`/api/properties/${property._id}/reactivation`)
    .set(bearer(owner)).send({ reason: 'Retour au marché', statusAdmin: 'Validée', isPublished: true });
  expect(response.status).toBe(202);
  expect(response.body.data.property).toMatchObject({ publicationLifecycleState: 'pending', isPublished: false, statusAdmin: 'Validée' });
  expect(await CommercialPublicationRevision.countDocuments({ resource: property._id, status: 'pending' })).toBe(1);
});

test('la demande de réexamen journalise sans lever la suspension', async () => {
  const { owner, property } = await fixture();
  await Property.updateOne({ _id: property._id }, { publicationLifecycleState: 'admin_suspended', isPublished: false });
  const response = await request(app).post(`/api/properties/${property._id}/suspension-review`)
    .set(bearer(owner)).send({ reason: 'Documents corrigés' });
  expect(response.status).toBe(202);
  expect(response.body.data.property).toMatchObject({ publicationLifecycleState: 'admin_suspended', isPublished: false });
  expect(response.body.data.property.publicationSuspensionReview.reason).toBe('Documents corrigés');
});

test('seule la capacité platform.commercial.manage suspend et la levée ne republie pas', async () => {
  const { operator, weakAdmin, property } = await fixture();
  const forbidden = await request(app).post(`/api/admin/properties/${property._id}/suspend`)
    .set(bearer(weakAdmin)).send({ reason: 'Tentative sans capacité' });
  expect(forbidden.status).toBe(403);
  const suspended = await request(app).post(`/api/admin/properties/${property._id}/suspend`)
    .set(bearer(operator)).send({ reason: 'Contrôle Altimmo' });
  expect(suspended.status).toBe(200);
  const lifted = await request(app).post(`/api/admin/properties/${property._id}/lift-suspension`)
    .set(bearer(operator)).send({ reason: 'Réexamen autorisé' });
  expect(lifted.status).toBe(202);
  expect(lifted.body.data.property).toMatchObject({ publicationLifecycleState: 'pending', isPublished: false });
});
