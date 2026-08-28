// SECURITY-FINAL-CLOSURE-BLOCKERS-HOTFIX-1 (FCA1-02) — reproduction
// rouge->verte PERMANENTE : `GET /api/real-estate-applications/reservations/:id`
// et `POST .../reservations/:id/cancel` (realEstateApplicationController)
// accordaient l'accès à TOUT staff, de n'importe quel tenant, sans jamais
// appeler `assertApplicationTenantAccessIfStaff` — contrairement aux
// endpoints sœurs `Application` du même fichier (RA-08/P1-D). Correctif :
// même helper canonique, appliqué UNIQUEMENT quand l'accès est accordé via
// le statut staff (jamais pour le client/propriétaire).
const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const { startFinancialMongo, clearFinancialMongo, stopFinancialMongo } = require('./helpers/financialMongoEnvironment');
const User = require('../models/User');
const Property = require('../models/Property');
const Application = require('../models/RealEstateApplication');
const Reservation = require('../models/RealEstateReservation');
const realEstateApplicationRoutes = require('../routes/realEstateApplicationRoutes');
const { errorHandler } = require('../middleware/errorMiddleware');
const organizationService = require('../services/organizationService');
const platformTenantService = require('../services/platformTenant/platformTenantService');
const { grantOperator } = require('../services/platformOperator/platformOperatorService');

jest.setTimeout(180000);

const app = express();
app.use(express.json());
app.use('/api/real-estate-applications', realEstateApplicationRoutes);
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
async function buildTenantWithReservation(label) {
  seq += 1;
  const admin = await User.create({ name: `Admin ${label}`, email: `fca102-admin-${label}-${seq}-${Date.now()}@example.com`, password: 'Password123!', passwordConfirm: 'Password123!', role: 'Admin', isEmailVerified: true });
  const owner = await User.create({ name: `Owner ${label}`, email: `fca102-owner-${label}-${seq}-${Date.now()}@example.com`, password: 'Password123!', passwordConfirm: 'Password123!', role: 'Proprietaire', isEmailVerified: true });
  const client = await User.create({ name: `Client ${label}`, email: `fca102-client-${label}-${seq}-${Date.now()}@example.com`, password: 'Password123!', passwordConfirm: 'Password123!', role: 'Client', isEmailVerified: true });
  const tenant = await platformTenantService.createTenant({ name: `FCA102-${label}-${seq}-${Date.now()}`, actor: admin });
  await Promise.all([
    organizationService.grantMembership({ userId: admin._id, orgUnitId: tenant.rootOrgUnit, actor: admin }),
    organizationService.grantMembership({ userId: owner._id, orgUnitId: tenant.rootOrgUnit, actor: admin }),
  ]);
  const property = await Property.create({
    title: `Villa FCA1-02 ${label}`, description: 'Description suffisamment longue pour la validation du modele Property.',
    pole: 'Altimmo', type: 'Villa', status: 'location', price: 300000,
    address: { arrondissement: 'Bacongo', city: 'Brazzaville' }, latitude: -4.26, longitude: 15.24,
    images: ['https://placehold.co/1200x800/png?text=Test'], surface: 90,
    statusAdmin: 'Validée', availability: 'Réservé', owner: owner._id,
  });
  const application = await Application.create({
    kind: 'rental_application', property: property._id, applicant: client._id, owner: owner._id,
    validUntil: new Date(Date.now() + 30 * 24 * 3600 * 1000),
    rentalApplication: { desiredMoveIn: new Date(), desiredDurationMonths: 12, occupants: 1 },
  });
  const reservation = await Reservation.create({
    property: property._id, client: client._id, application: application._id, type: 'rental',
    status: 'active', expiresAt: new Date(Date.now() + 24 * 3600 * 1000), idempotencyKey: `fca102-resa-${seq}-${Date.now()}`,
  });
  return { admin, owner, client, tenant, property, application, reservation };
}

describe('SECURITY-FINAL-CLOSURE-BLOCKERS-HOTFIX-1 (FCA1-02) — GET reservations/:id', () => {
  test('1. Staff A + Reservation A -> OK', async () => {
    const a = await buildTenantWithReservation('A1');
    const res = await request(app).get(`/api/real-estate-applications/reservations/${a.reservation._id}`).set(bearer(a.admin, a.tenant._id));
    expect(res.status).toBe(200);
  });

  test('2. Staff A + Reservation B -> refuse', async () => {
    const a = await buildTenantWithReservation('A2');
    const b = await buildTenantWithReservation('B2');
    const res = await request(app).get(`/api/real-estate-applications/reservations/${b.reservation._id}`).set(bearer(a.admin, a.tenant._id));
    expect(res.status).not.toBe(200);
  });

  test('3. Staff B + Reservation A -> refuse symetrique', async () => {
    const a = await buildTenantWithReservation('A3');
    const b = await buildTenantWithReservation('B3');
    const res = await request(app).get(`/api/real-estate-applications/reservations/${a.reservation._id}`).set(bearer(b.admin, b.tenant._id));
    expect(res.status).not.toBe(200);
  });

  test('4. Client proprietaire de sa reservation -> OK sans tenant', async () => {
    const a = await buildTenantWithReservation('A4');
    const res = await request(app).get(`/api/real-estate-applications/reservations/${a.reservation._id}`).set(bearer(a.client));
    expect(res.status).toBe(200);
  });
});

describe('SECURITY-FINAL-CLOSURE-BLOCKERS-HOTFIX-1 (FCA1-02) — POST reservations/:id/cancel', () => {
  test('5. Staff A + Reservation A -> annulation historique OK', async () => {
    const a = await buildTenantWithReservation('A5');
    const res = await request(app).post(`/api/real-estate-applications/reservations/${a.reservation._id}/cancel`).set(bearer(a.admin, a.tenant._id)).send({ reason: 'test' });
    expect(res.status).toBe(200);
    const after = await Reservation.findById(a.reservation._id);
    expect(after.status).toBe('cancelled');
  });

  test('6. Staff A + Reservation B -> refuse, zero side effect', async () => {
    const a = await buildTenantWithReservation('A6');
    const b = await buildTenantWithReservation('B6');
    const res = await request(app).post(`/api/real-estate-applications/reservations/${b.reservation._id}/cancel`).set(bearer(a.admin, a.tenant._id)).send({ reason: 'test cross-tenant' });
    expect(res.status).not.toBe(200);
    const after = await Reservation.findById(b.reservation._id);
    expect(after.status).toBe('active');
    const property = await Property.findById(b.property._id);
    expect(property.availability).toBe('Réservé');
  });

  test('7. Staff sans tenant resolu -> refuse (fail-closed)', async () => {
    const b = await buildTenantWithReservation('B7');
    const orphanStaff = await User.create({ name: 'Orphan Admin', email: `fca102-orphan-${Date.now()}@example.com`, password: 'Password123!', passwordConfirm: 'Password123!', role: 'Admin', isEmailVerified: true });
    const res = await request(app).post(`/api/real-estate-applications/reservations/${b.reservation._id}/cancel`).set(bearer(orphanStaff)).send({ reason: 'test' });
    expect(res.status).not.toBe(200);
    const after = await Reservation.findById(b.reservation._id);
    expect(after.status).toBe('active');
  });

  test('8. Invalid tenant header -> fail-closed', async () => {
    const a = await buildTenantWithReservation('A8');
    const res = await request(app).post(`/api/real-estate-applications/reservations/${a.reservation._id}/cancel`).set(bearer(a.admin, '000000000000000000000000')).send({ reason: 'test' });
    expect(res.status).not.toBe(200);
  });

  test('9. PlatformOperator global -> annulation autorisee (contrat historique)', async () => {
    const a = await buildTenantWithReservation('A9');
    const operator = await User.create({ name: 'PO Global', email: `fca102-po-${Date.now()}@example.com`, password: 'Password123!', passwordConfirm: 'Password123!', role: 'Admin', isEmailVerified: true });
    await grantOperator({ userId: operator._id, actor: a.admin, reason: 'FCA1-02 certification', capabilities: [] });
    const res = await request(app).post(`/api/real-estate-applications/reservations/${a.reservation._id}/cancel`).set(bearer(operator, a.tenant._id)).send({ reason: 'test' });
    expect(res.status).toBe(200);
  });

  test('10. PlatformOperator scoped sur A -> refuse sur B', async () => {
    const a = await buildTenantWithReservation('A10');
    const b = await buildTenantWithReservation('B10');
    const operator = await User.create({ name: 'PO Scoped', email: `fca102-po-scoped-${Date.now()}@example.com`, password: 'Password123!', passwordConfirm: 'Password123!', role: 'Admin', isEmailVerified: true });
    await grantOperator({ userId: operator._id, actor: a.admin, reason: 'FCA1-02 certification scoped', capabilities: [] });
    const res = await request(app).post(`/api/real-estate-applications/reservations/${b.reservation._id}/cancel`).set(bearer(operator, a.tenant._id)).send({ reason: 'test' });
    expect(res.status).not.toBe(200);
  });
});
