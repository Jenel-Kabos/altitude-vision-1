// SECURITY-CLOSURE-P1-WAVE-1 (P1-H, finding RA-13) — reproduction rouge->verte
// PERMANENTE : `hotelStaffAssignmentController.get/update/suspend/reactivate/
// revoke` chargeaient l'assignment par `assignmentId` seul, sans jamais
// recroiser `assignment.hotel` avec le `hotelId` de l'URL (déjà autorisé par
// `requireHotelCapability`) — un manager de l'Hôtel A pouvait altérer
// (y compris révoquer) le rattachement staff d'un Hôtel B. Correctif :
// `assertAssignmentBelongsToHotel`, dérivant toujours le hotelId de la
// ressource chargée avant d'autoriser, même convention que
// roomCategoryController/roomController.
const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const { startFinancialMongo, clearFinancialMongo, stopFinancialMongo } = require('./helpers/financialMongoEnvironment');
const User = require('../models/User');
const Hotel = require('../models/Hotel');
const HotelStaffAssignment = require('../models/HotelStaffAssignment');
const hotelRoutes = require('../routes/hotelRoutes');
const { errorHandler } = require('../middleware/errorMiddleware');
const organizationService = require('../services/organizationService');
const platformTenantService = require('../services/platformTenant/platformTenantService');

jest.setTimeout(180000);

const app = express();
app.use(express.json());
app.use('/api/hotels', hotelRoutes);
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
async function buildTenantWithHotel(label) {
  seq += 1;
  const admin = await User.create({ name: `Admin ${label}`, email: `p1h-admin-${label}-${seq}-${Date.now()}@example.com`, password: 'Password123!', passwordConfirm: 'Password123!', role: 'Admin', isEmailVerified: true });
  const staffMember = await User.create({ name: `Staff ${label}`, email: `p1h-staff-${label}-${seq}-${Date.now()}@example.com`, password: 'Password123!', passwordConfirm: 'Password123!', role: 'Collaborateur', isEmailVerified: true });
  const tenant = await platformTenantService.createTenant({ name: `P1H-${label}-${seq}-${Date.now()}`, actor: admin });
  await organizationService.grantMembership({ userId: admin._id, orgUnitId: tenant.rootOrgUnit, actor: admin });
  const hotel = await Hotel.create({ name: `Hotel P1H ${label}`, tenant: tenant._id, createdBy: admin._id });
  const assignment = await HotelStaffAssignment.create({ user: staffMember._id, hotel: hotel._id, assignmentRole: 'reception', assignedBy: admin._id });
  return { admin, staffMember, tenant, hotel, assignment };
}

describe('SECURITY-CLOSURE-P1-WAVE-1 (P1-H) — GET/PATCH/POST staff-assignments', () => {
  test('1. Admin A (Hôtel A) ne peut PAS consulter un assignment de l\'Hôtel B via l\'URL de l\'Hôtel A', async () => {
    const a = await buildTenantWithHotel('A');
    const b = await buildTenantWithHotel('B');
    const res = await request(app).get(`/api/hotels/${a.hotel._id}/staff-assignments/${b.assignment._id}`).set(bearer(a.admin, a.tenant._id));
    expect(res.status).not.toBe(200);
  });

  test('2. Admin A ne peut PAS suspendre un assignment de l\'Hôtel B via l\'URL de l\'Hôtel A', async () => {
    const a = await buildTenantWithHotel('C');
    const b = await buildTenantWithHotel('D');
    const res = await request(app).post(`/api/hotels/${a.hotel._id}/staff-assignments/${b.assignment._id}/suspend`).set(bearer(a.admin, a.tenant._id)).send({ reason: 'Tentative cross-hotel' });
    expect(res.status).not.toBe(200);
    const fresh = await HotelStaffAssignment.findById(b.assignment._id);
    expect(fresh.status).toBe('active');
  });

  test('3. Admin A ne peut PAS révoquer un assignment de l\'Hôtel B via l\'URL de l\'Hôtel A', async () => {
    const a = await buildTenantWithHotel('E');
    const b = await buildTenantWithHotel('F');
    const res = await request(app).post(`/api/hotels/${a.hotel._id}/staff-assignments/${b.assignment._id}/revoke`).set(bearer(a.admin, a.tenant._id)).send({ reason: 'Tentative cross-hotel' });
    expect(res.status).not.toBe(200);
    const fresh = await HotelStaffAssignment.findById(b.assignment._id);
    expect(fresh.status).toBe('active');
  });

  test('4. Admin A PEUT consulter/suspendre un assignment de son propre Hôtel A (comportement historique préservé)', async () => {
    const a = await buildTenantWithHotel('G');
    const get = await request(app).get(`/api/hotels/${a.hotel._id}/staff-assignments/${a.assignment._id}`).set(bearer(a.admin, a.tenant._id));
    expect(get.status).toBe(200);
    const suspend = await request(app).post(`/api/hotels/${a.hotel._id}/staff-assignments/${a.assignment._id}/suspend`).set(bearer(a.admin, a.tenant._id)).send({ reason: 'Motif de suspension valide.' });
    expect(suspend.status).toBe(200);
  });
});
