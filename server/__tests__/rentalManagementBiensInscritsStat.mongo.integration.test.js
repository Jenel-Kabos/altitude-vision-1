// Sprint GL-UX1 — vérifie la nouvelle distinction "biens inscrits" (toute
// Property status:'location') vs "biens sous gestion" (RentalManagement
// managementActivated:true) exposée par GET /api/rental-management/stats.
// Sans cette distinction, le tableau de bord ne pouvait pas afficher le
// Bloc Portefeuille demandé par la mission (biens inscrits par les
// propriétaires vs biens sous gestion active).

const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const { startFinancialMongo, clearFinancialMongo, stopFinancialMongo } = require('./helpers/financialMongoEnvironment');
const User = require('../models/User');
const Property = require('../models/Property');
const RentalManagement = require('../models/RentalManagement');
const OrgUnit = require('../models/OrgUnit');
const OrgMembership = require('../models/OrgMembership');
const PlatformTenant = require('../models/PlatformTenant');
const rentalManagementRoutes = require('../routes/rentalManagementRoutes');
const { errorHandler } = require('../middleware/errorMiddleware');

jest.setTimeout(120000);

const app = express();
app.use(express.json());
app.use('/api/rental-management', rentalManagementRoutes);
app.use(errorHandler);

const signToken = (id, tokenVersion = 0) => jwt.sign({ id, tokenVersion }, process.env.JWT_SECRET, { expiresIn: '1d' });

let currentTenant;
beforeAll(startFinancialMongo);
beforeEach(async () => {
  const root = await OrgUnit.create({ name: `GL stats ${Date.now()}`, type: 'organization', status: 'active' });
  currentTenant = await PlatformTenant.create({ name: root.name, slug: `gl-stats-${Date.now()}-${Math.random().toString(36).slice(2)}`, rootOrgUnit: root._id, status: 'active' });
});
afterEach(clearFinancialMongo);
afterAll(stopFinancialMongo);

const makeTenantUser = async (data) => {
  const user = await User.create(data);
  await OrgMembership.create({ user: user._id, orgUnit: currentTenant.rootOrgUnit, status: 'active' });
  return user;
};
const tenantGet = (admin) => request(app).get('/api/rental-management/stats')
  .set('Authorization', `Bearer ${signToken(admin._id)}`)
  .set('X-Platform-Tenant-Id', String(currentTenant._id));

const baseProperty = (overrides = {}) => ({
  title: 'Bien GL-UX1', description: 'Description suffisamment longue pour la validation du modèle Property.',
  pole: 'Altimmo', type: 'Maison', status: 'location', price: 300000,
  address: { arrondissement: 'Moungali', city: 'Brazzaville' }, latitude: -4.25, longitude: 15.27,
  images: ['https://placehold.co/1200x800/png?text=Test'], surface: 90, bedrooms: 2, bathrooms: 1,
  statusAdmin: 'Validée', ...overrides,
});

test('biensInscrits compte toutes les annonces location, distinct de "total" (sous gestion active)', async () => {
  const admin = await makeTenantUser({ name: 'Admin GL', email: `gluxadmin${Date.now()}@example.com`, password: 'Password123!', passwordConfirm: 'Password123!', role: 'Admin' });
  const owner = await makeTenantUser({ name: 'Proprio GL', email: `gluxowner${Date.now()}@example.com`, password: 'Password123!', passwordConfirm: 'Password123!', role: 'Proprietaire' });

  // 3 annonces "location" inscrites, mais une seule activée en gestion.
  const p1 = await Property.create(baseProperty({ owner: owner._id }));
  const p2 = await Property.create(baseProperty({ owner: owner._id }));
  await Property.create(baseProperty({ owner: owner._id })); // p3, jamais activée

  await RentalManagement.create({ property: p1._id, owner: owner._id, managementActivated: true, occupancyStatus: 'vacant', availabilityStatus: 'disponible', publicationStatus: 'brouillon' });
  // p2 a un dossier RentalManagement mais PAS activé — ne doit pas compter dans "total".
  await RentalManagement.create({ property: p2._id, owner: owner._id, managementActivated: false, occupancyStatus: 'vacant', availabilityStatus: 'disponible', publicationStatus: 'brouillon' });

  const res = await tenantGet(admin);
  expect(res.status).toBe(200);
  expect(res.body.data.stats.biensInscrits).toBe(3);
  expect(res.body.data.stats.total).toBe(1);
});

// GL-DEBT-1 — Phase 2 : couverture explicite de chaque scénario métier
// listé par la mission pour la définition de "biens inscrits".
describe('GL-DEBT-1 — définition affinée de "biens inscrits"', () => {
  test('bien de location créé/rattaché à un propriétaire externe : compte', async () => {
    const owner = await makeTenantUser({ name: 'Propriétaire Externe', email: `debt1a${Date.now()}@example.com`, password: 'Password123!', passwordConfirm: 'Password123!', role: 'Proprietaire' });
    await Property.create(baseProperty({ owner: owner._id }));
    const admin = await makeTenantUser({ name: 'Admin', email: `debt1admin${Date.now()}@example.com`, password: 'Password123!', passwordConfirm: 'Password123!', role: 'Admin' });
    const res = await tenantGet(admin);
    expect(res.body.data.stats.biensInscrits).toBe(1);
  });

  test('bien créé par un admin mais rattaché (owner) à un propriétaire externe : compte', async () => {
    const owner = await makeTenantUser({ name: 'Propriétaire Externe 2', email: `debt1b${Date.now()}@example.com`, password: 'Password123!', passwordConfirm: 'Password123!', role: 'Proprietaire' });
    const admin = await makeTenantUser({ name: 'Admin', email: `debt1admin2${Date.now()}@example.com`, password: 'Password123!', passwordConfirm: 'Password123!', role: 'Admin' });
    // Simule une création "pour le compte de" : createdBy admin, owner = propriétaire externe.
    await Property.create(baseProperty({ owner: owner._id }));
    const res = await tenantGet(admin);
    expect(res.body.data.stats.biensInscrits).toBe(1);
  });

  test('bien interne à l’agence (owner = compte staff, aucun propriétaire externe) : ne compte pas', async () => {
    const admin = await makeTenantUser({ name: 'Admin Propriétaire Interne', email: `debt1c${Date.now()}@example.com`, password: 'Password123!', passwordConfirm: 'Password123!', role: 'Admin' });
    await Property.create(baseProperty({ owner: admin._id }));
    const res = await tenantGet(admin);
    expect(res.body.data.stats.biensInscrits).toBe(0);
  });

  test('bien de vente : ne compte jamais dans biensInscrits (location uniquement)', async () => {
    const owner = await makeTenantUser({ name: 'Propriétaire Vente', email: `debt1d${Date.now()}@example.com`, password: 'Password123!', passwordConfirm: 'Password123!', role: 'Proprietaire' });
    const admin = await makeTenantUser({ name: 'Admin', email: `debt1admin3${Date.now()}@example.com`, password: 'Password123!', passwordConfirm: 'Password123!', role: 'Admin' });
    await Property.create(baseProperty({ owner: owner._id, status: 'vente' }));
    const res = await tenantGet(admin);
    expect(res.body.data.stats.biensInscrits).toBe(0);
  });

  test('bien archivé/retiré : exclu de biensInscrits', async () => {
    const owner = await makeTenantUser({ name: 'Propriétaire Retiré', email: `debt1e${Date.now()}@example.com`, password: 'Password123!', passwordConfirm: 'Password123!', role: 'Proprietaire' });
    const admin = await makeTenantUser({ name: 'Admin', email: `debt1admin4${Date.now()}@example.com`, password: 'Password123!', passwordConfirm: 'Password123!', role: 'Admin' });
    await Property.create(baseProperty({ owner: owner._id, availability: 'Retiré' }));
    const res = await tenantGet(admin);
    expect(res.body.data.stats.biensInscrits).toBe(0);
  });

  test('bien sous gestion active ET bien non encore sous gestion comptent tous deux dans biensInscrits', async () => {
    const owner = await makeTenantUser({ name: 'Propriétaire Mixte', email: `debt1f${Date.now()}@example.com`, password: 'Password123!', passwordConfirm: 'Password123!', role: 'Proprietaire' });
    const admin = await makeTenantUser({ name: 'Admin', email: `debt1admin5${Date.now()}@example.com`, password: 'Password123!', passwordConfirm: 'Password123!', role: 'Admin' });
    const managed = await Property.create(baseProperty({ owner: owner._id }));
    await Property.create(baseProperty({ owner: owner._id })); // jamais activée
    await RentalManagement.create({ property: managed._id, owner: owner._id, managementActivated: true, occupancyStatus: 'vacant', availabilityStatus: 'disponible', publicationStatus: 'brouillon' });
    const res = await tenantGet(admin);
    expect(res.body.data.stats.biensInscrits).toBe(2);
    expect(res.body.data.stats.total).toBe(1);
  });
});
