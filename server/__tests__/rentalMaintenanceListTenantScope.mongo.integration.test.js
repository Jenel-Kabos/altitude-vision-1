const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const { startFinancialMongo, clearFinancialMongo, stopFinancialMongo } = require('./helpers/financialMongoEnvironment');
const User = require('../models/User');
const Property = require('../models/Property');
const RentalMaintenanceTicket = require('../models/RentalMaintenanceTicket');
const rentalMaintenanceRoutes = require('../routes/rentalMaintenanceRoutes');
const { errorHandler } = require('../middleware/errorMiddleware');
const organizationService = require('../services/organizationService');
const platformTenantService = require('../services/platformTenant/platformTenantService');

jest.setTimeout(180000);

const app = express();
app.use(express.json());
app.use('/api/rental-maintenance', rentalMaintenanceRoutes);
app.use(errorHandler);

const signToken = (id) => jwt.sign({ id, tokenVersion: 0 }, process.env.JWT_SECRET, { expiresIn: '1d' });
const bearer = (user, tenantId) => ({
  Authorization: `Bearer ${signToken(user._id)}`,
  ...(tenantId ? { 'X-Platform-Tenant-Id': String(tenantId) } : {}),
});

beforeAll(startFinancialMongo);
afterEach(clearFinancialMongo);
afterAll(stopFinancialMongo);

let seq = 0;
async function buildTenantWithTicket(label) {
  seq += 1;
  const suffix = `${label}-${seq}-${Date.now()}`;
  const admin = await User.create({ name: `Admin ${label}`, email: `rm-maint-admin-${suffix}@example.com`, password: 'Password123!', passwordConfirm: 'Password123!', role: 'Admin', isEmailVerified: true });
  const owner = await User.create({ name: `Owner ${label}`, email: `rm-maint-owner-${suffix}@example.com`, password: 'Password123!', passwordConfirm: 'Password123!', role: 'Proprietaire', isEmailVerified: true });
  const tenant = await platformTenantService.createTenant({ name: `RM Maintenance ${suffix}`, actor: admin });
  await Promise.all([
    organizationService.grantMembership({ userId: admin._id, orgUnitId: tenant.rootOrgUnit, actor: admin }),
    organizationService.grantMembership({ userId: owner._id, orgUnitId: tenant.rootOrgUnit, actor: admin }),
  ]);
  const property = await Property.create({
    title: `Bien maintenance ${label}`, description: 'Description suffisamment longue pour le test de maintenance locative.',
    pole: 'Altimmo', type: 'Maison', status: 'location', price: 200000,
    address: { arrondissement: 'Bacongo', city: 'Brazzaville' }, latitude: -4.26, longitude: 15.24,
    images: ['https://placehold.co/1200x800/png?text=Test'], surface: 80, owner: owner._id,
  });
  const ticket = await RentalMaintenanceTicket.create({ property: property._id, owner: owner._id, category: 'plomberie', description: `Maintenance ${label}` });
  return { admin, tenant, property, ticket };
}

describe('HOTFIX-RM-DASHBOARD-SEMANTICS-1 — maintenance overview tenant scope', () => {
  test('sans propertyId, Admin A ne reçoit que les maintenances du Tenant A', async () => {
    const a = await buildTenantWithTicket('A');
    const b = await buildTenantWithTicket('B');

    const res = await request(app).get('/api/rental-maintenance').set(bearer(a.admin, a.tenant._id));

    expect(res.status).toBe(200);
    const ids = res.body.data.tickets.map((ticket) => String(ticket._id));
    expect(ids).toContain(String(a.ticket._id));
    expect(ids).not.toContain(String(b.ticket._id));
  });

  test('avec propertyId, le filtre explicite et son contrôle d’accès restent actifs', async () => {
    const a = await buildTenantWithTicket('C');
    const res = await request(app).get(`/api/rental-maintenance?propertyId=${a.property._id}`).set(bearer(a.admin, a.tenant._id));
    expect(res.status).toBe(200);
    expect(res.body.data.tickets).toHaveLength(1);
    expect(String(res.body.data.tickets[0]._id)).toBe(String(a.ticket._id));
  });
});
