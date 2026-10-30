const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const { startFinancialMongo, clearFinancialMongo, stopFinancialMongo } = require('./helpers/financialMongoEnvironment');
const User = require('../models/User');
const Property = require('../models/Property');
const PlatformOperator = require('../models/PlatformOperator');
const CommercialPublicationRevision = require('../models/CommercialPublicationRevision');
const propertyRoutes = require('../routes/propertyRoutes');
const { listPublicProperties, getPublicPropertyById } = require('../services/publicApi/publicPropertyService');
const { PLATFORM_VIEW_REQUIRED_CAPABILITIES } = require('../constants/platformOperatorConstants');
const { errorHandler } = require('../middleware/errorMiddleware');

jest.setTimeout(180000);
const app = express(); app.use(express.json()); app.use('/api/properties', propertyRoutes); app.use(errorHandler);
const bearer = (user) => ({ Authorization: `Bearer ${jwt.sign({ id: user._id, tokenVersion: 0 }, process.env.JWT_SECRET, { expiresIn: '1d' })}` });

beforeAll(startFinancialMongo);
afterEach(clearFinancialMongo);
afterAll(stopFinancialMongo);

async function fixture() {
  const owner = await User.create({ name: 'Owner Publication', email: `owner-publication-${Date.now()}-${Math.random()}@example.test`, password: 'Password123!', passwordConfirm: 'Password123!', role: 'Proprietaire', isEmailVerified: true });
  const operator = await User.create({ name: 'Commercial Operator', email: `commercial-publication-${Date.now()}-${Math.random()}@example.test`, password: 'Password123!', passwordConfirm: 'Password123!', role: 'Admin', isEmailVerified: true });
  await PlatformOperator.create({ user: operator._id, capabilities: [...PLATFORM_VIEW_REQUIRED_CAPABILITIES], grantedBy: operator._id, grantReason: 'TEST DATA commercial publication' });
  const approved = { title: 'Villa approuvée', description: 'Description approuvée', price: 100000, status: 'vente', type: 'Villa', address: { arrondissement: 'Bacongo', city: 'Brazzaville' }, latitude: -4.2, longitude: 15.2, images: ['approved.jpg'], bedrooms: 3, bathrooms: 2, surface: 120, availability: 'Disponible' };
  const property = await Property.create({ ...approved, pole: 'Altimmo', owner: owner._id, statusAdmin: 'Validée', isPublished: true, approvedPublicSnapshot: approved, commercialPublicationVersion: 1 });
  return { owner, operator, property, approved };
}

test('liste et détail publics lisent exclusivement le snapshot approuvé', async () => {
  const { property } = await fixture();
  await Property.updateOne({ _id: property._id }, { price: 999999, description: 'BROUILLON NON APPROUVÉ', images: ['draft.jpg'] });
  const listed = await listPublicProperties({});
  const detail = await getPublicPropertyById(property._id);
  expect(listed.properties[0]).toMatchObject({ price: 100000, description: 'Description approuvée', images: ['approved.jpg'] });
  expect(detail).toMatchObject({ price: 100000, description: 'Description approuvée', images: ['approved.jpg'] });
});

test('une édition substantielle publiée crée une révision et retire immédiatement la version publique jusqu’à approbation', async () => {
  const { owner, operator, property } = await fixture();
  const edit = await request(app).put(`/api/properties/${property._id}`).set(bearer(owner)).send({ price: 125000 });
  expect(edit.status).toBe(200);
  const before = await Property.findById(property._id).lean();
  expect(before).toMatchObject({ price: 125000, statusAdmin: 'En attente', isPublished: false, publicationLifecycleState: 'change_pending', commercialPublicationVersion: 1 });
  const revision = await CommercialPublicationRevision.findOne({ resource: property._id, status: 'pending' }).lean();
  expect(revision).toMatchObject({ proposedSnapshot: { price: 125000 }, changedFields: ['price'] });
  expect(await getPublicPropertyById(property._id)).toBeNull();

  const approve = await request(app).patch(`/api/properties/admin/${property._id}/validate`).set(bearer(operator)).send({ reason: 'Prix vérifié' });
  expect(approve.status).toBe(200);
  expect((await getPublicPropertyById(property._id)).price).toBe(125000);
});

test('un rejet de révision conserve le snapshot historique sans republier l’ancienne version', async () => {
  const { owner, operator, property } = await fixture();
  expect((await request(app).put(`/api/properties/${property._id}`).set(bearer(owner)).send({ price: 130000 })).status).toBe(200);
  const reject = await request(app).patch(`/api/properties/admin/${property._id}/reject`).set(bearer(operator)).send({ reason: 'Prix non justifié' });
  expect(reject.status).toBe(200);
  expect(await Property.findById(property._id)).toMatchObject({ price: 130000, statusAdmin: 'Rejetée', isPublished: false, publicationLifecycleState: 'rejected' });
  expect((await Property.findById(property._id).lean()).approvedPublicSnapshot.price).toBe(100000);
  expect(await getPublicPropertyById(property._id)).toBeNull();
});

test('une annonce legacy validée sans snapshot reste publiquement compatible', async () => {
  const { property } = await fixture();
  await Property.collection.updateOne({ _id: property._id }, { $unset: { approvedPublicSnapshot: '', commercialPublicationVersion: '' }, $set: { price: 90000 } });
  expect((await getPublicPropertyById(property._id)).price).toBe(90000);
});

// GIT-INTEGRATION-03A — règle de main préservée : la décision commerciale ne
// publie que les annonces classiques ; un hébergement garde son cycle spécialisé.
test('la validation commerciale d’un hébergement ne le publie pas par ce raccourci', async () => {
  const { operator, property } = await fixture();
  await Property.collection.updateOne({ _id: property._id }, { $set: { status: 'hebergement', isPublished: false, statusAdmin: 'En attente' }, $unset: { approvedPublicSnapshot: '', commercialPublicationVersion: '' } });
  const res = await request(app).patch(`/api/properties/admin/${property._id}/validate`).set(bearer(operator)).send({ reason: 'Contrôle commercial' });
  expect(res.status).toBe(200);
  expect(await Property.findById(property._id).lean()).toMatchObject({ statusAdmin: 'Validée', isPublished: false });
});
