// GL-ARCH-1 — Portail Propriétaire (univers 1) vs Gestion Locative (univers 2).
// Un Proprietaire qui publie librement ses annonces doit pouvoir signaler
// Loué/Retiré/Vendu sur SES biens tant qu'ils ne sont pas pris en gestion par
// le staff (RentalManagement.managementActivated). Avant ce correctif,
// `propertyController.updateProperty` supprimait silencieusement `availability`
// du payload pour tout non-admin, rendant cette action UI sans effet réel.
// Dès qu'un bien est réellement géré, le propriétaire perd ce contrôle — seul
// le staff (Admin/Gestionnaire Immobilier) le garde.

const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const { startFinancialMongo, clearFinancialMongo, stopFinancialMongo } = require('./helpers/financialMongoEnvironment');
const User = require('../models/User');
const Property = require('../models/Property');
const RentalManagement = require('../models/RentalManagement');
const propertyRoutes = require('../routes/propertyRoutes');
const { errorHandler } = require('../middleware/errorMiddleware');
// TENANT-CERT-2 — l'accès Admin (non-propriétaire) à une Property passe
// désormais par la frontière tenant canonique (voir
// __tests__/tenantCert2.adversarial.mongo.integration.test.js pour la
// vulnérabilité corrigée). Un Admin et un Proprietaire du MÊME tenant
// restent pleinement fonctionnels — fixture ajoutée ci-dessous.
const organizationService = require('../services/organizationService');
const platformTenantService = require('../services/platformTenant/platformTenantService');

jest.setTimeout(120000);

const app = express();
app.use(express.json());
app.use('/api/properties', propertyRoutes);
app.use(errorHandler);

const signToken = (id, tokenVersion = 0) => jwt.sign({ id, tokenVersion }, process.env.JWT_SECRET, { expiresIn: '1d' });

let counter = 0;
const makeUser = (overrides = {}) => {
  counter += 1;
  return User.create({
    name: 'Utilisateur Test', email: `ownerarchive${counter}${Date.now()}@example.com`,
    password: 'Password123!', passwordConfirm: 'Password123!', role: 'Client', ...overrides,
  });
};

const makeProperty = (owner, overrides = {}) => Property.create({
  title: 'Studio Test Archivage', description: 'Description suffisamment longue pour la validation du modèle Property.',
  pole: 'Altimmo', type: 'Studio', status: 'location', price: 150000,
  address: { arrondissement: 'Bacongo', city: 'Brazzaville' }, latitude: -4.26, longitude: 15.24,
  images: ['https://placehold.co/1200x800/png?text=Test'], surface: 30,
  statusAdmin: 'Validée', availability: 'Disponible', owner: owner._id,
  ...overrides,
});

beforeAll(startFinancialMongo);
afterEach(clearFinancialMongo);
afterAll(stopFinancialMongo);

describe('GL-ARCH-1 — PUT /api/properties/:id — availability (univers 1 vs univers 2)', () => {
  test('un Proprietaire peut marquer son bien non géré "Loué" — le bien quitte le portefeuille public', async () => {
    const owner = await makeUser({ role: 'Proprietaire' });
    const property = await makeProperty(owner);

    const res = await request(app)
      .put(`/api/properties/${property._id}`)
      .set('Authorization', `Bearer ${signToken(owner._id)}`)
      .send({ availability: 'Loué' });

    expect(res.status).toBe(200);
    const updated = await Property.findById(property._id);
    expect(updated.availability).toBe('Loué');
  });

  test('un Proprietaire ne peut pas se mettre lui-même "Réservé" (état réservé au staff/parcours réservation)', async () => {
    const owner = await makeUser({ role: 'Proprietaire' });
    const property = await makeProperty(owner);

    const res = await request(app)
      .put(`/api/properties/${property._id}`)
      .set('Authorization', `Bearer ${signToken(owner._id)}`)
      .send({ availability: 'Réservé' });

    expect(res.status).toBe(200);
    const updated = await Property.findById(property._id);
    expect(updated.availability).toBe('Disponible');
  });

  test('un Proprietaire perd le contrôle de availability dès que le bien est pris en gestion (managementActivated: true)', async () => {
    const owner = await makeUser({ role: 'Proprietaire' });
    const property = await makeProperty(owner);
    await RentalManagement.create({ property: property._id, owner: owner._id, managementActivated: true, monthlyRent: property.price });

    const res = await request(app)
      .put(`/api/properties/${property._id}`)
      .set('Authorization', `Bearer ${signToken(owner._id)}`)
      .send({ availability: 'Loué' });

    expect(res.status).toBe(200);
    const updated = await Property.findById(property._id);
    expect(updated.availability).toBe('Disponible');
  });

  test('un Admin garde le contrôle total de availability, même sur un bien géré', async () => {
    const admin = await makeUser({ role: 'Admin' });
    const owner = await makeUser({ role: 'Proprietaire' });
    const tenant = await platformTenantService.createTenant({ name: `GL-ARCH-1 ${Date.now()}`, actor: admin });
    await Promise.all([
      organizationService.grantMembership({ userId: admin._id, orgUnitId: tenant.rootOrgUnit, actor: admin }),
      organizationService.grantMembership({ userId: owner._id, orgUnitId: tenant.rootOrgUnit, actor: admin }),
    ]);
    const property = await makeProperty(owner);
    await RentalManagement.create({ property: property._id, owner: owner._id, managementActivated: true, monthlyRent: property.price });

    const res = await request(app)
      .put(`/api/properties/${property._id}`)
      .set('Authorization', `Bearer ${signToken(admin._id)}`)
      .send({ availability: 'Loué' });

    expect(res.status).toBe(200);
    const updated = await Property.findById(property._id);
    expect(updated.availability).toBe('Loué');
  });
});
