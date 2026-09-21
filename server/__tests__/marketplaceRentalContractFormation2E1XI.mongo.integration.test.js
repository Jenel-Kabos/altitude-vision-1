// USER-TENANT-MEMBERSHIP-ARCHITECTURE-2E.1.X — MARKETPLACE-RENTAL-CONTRACT-
// FORMATION. Certifie l'autorité canonique sur `POST /api/real-estate-
// applications/:id/accept` (et /reject) — décision commerciale plateforme
// verrouillant le Property et disqualifiant les candidatures concurrentes.
// La conclusion contractuelle réelle (`Contrat.type='location'`) est un
// pas ultérieur via `POST /api/contrats` déjà certifié PLATFORM-only
// (Lot MRCB).
const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const { startFinancialMongo, clearFinancialMongo, stopFinancialMongo } = require('./helpers/financialMongoEnvironment');
const { createTenantFixture, addTenantMember } = require('./helpers/tenantAwareFixture');
const { grantOperator } = require('../services/platformOperator/platformOperatorService');
const User = require('../models/User');
const Property = require('../models/Property');
const RealEstateApplication = require('../models/RealEstateApplication');
const RealEstateReservation = require('../models/RealEstateReservation');
const Contrat = require('../models/Contrat');
const realEstateApplicationRoutes = require('../routes/realEstateApplicationRoutes');
const { errorHandler } = require('../middleware/errorMiddleware');

jest.setTimeout(180000);

const app = express();
app.use(express.json());
app.use('/api/real-estate-applications', realEstateApplicationRoutes);
app.use(errorHandler);

const bearer = (user, tenant) => ({
  Authorization: `Bearer ${jwt.sign({ id: user._id, tokenVersion: 0 }, process.env.JWT_SECRET, { expiresIn: '1d' })}`,
  ...(tenant ? { 'X-Platform-Tenant-Id': String(tenant._id) } : {}),
});

let seq = 0;
const makeUser = (over = {}) => {
  seq += 1;
  return User.create({
    name: `MRCF ${seq}`, email: `mrcf-${seq}-${Date.now()}@example.test`,
    password: 'Password123!', passwordConfirm: 'Password123!', role: 'Client', isEmailVerified: true, ...over,
  });
};

async function scenario() {
  const fA = await createTenantFixture({ label: `MRCF ${seq++}`, withAdminMembership: true });
  const owner = await makeUser({ role: 'Proprietaire' });
  await addTenantMember({ tenant: fA.tenant, user: owner, bootstrap: fA.bootstrap });
  const applicant = await makeUser({ role: 'Client' });
  const property = await Property.create({
    title: `MRCF Villa ${seq++}`, description: 'Description assez longue pour la validation Property.',
    pole: 'Altimmo', type: 'Villa', status: 'location', price: 400000,
    address: { city: 'Brazzaville', arrondissement: 'Centre' }, latitude: -4.26, longitude: 15.24,
    images: ['https://placehold.co/1200x800/png?text=Test'], surface: 90, statusAdmin: 'Validée', isPublished: true,
    availability: 'Disponible', owner: owner._id, tenant: fA.tenant._id,
  });
  const application = await RealEstateApplication.create({
    kind: 'rental_application', property: property._id, applicant: applicant._id, owner: owner._id,
    validUntil: new Date(Date.now() + 24 * 60 * 60 * 1000),
    rentalApplication: { monthlyIncome: 800000, guarantor: 'Guarantor' },
    history: [{ from: null, to: 'submitted', action: 'submitted', actor: applicant._id }],
  });
  return { fA, owner, applicant, property, application };
}

async function operatorWith(capabilities) {
  const op = await makeUser({ role: 'Admin' });
  const granter = await makeUser({ role: 'Admin' });
  await grantOperator({ userId: op._id, actor: granter, reason: 'MRCF fixture', capabilities });
  return op;
}

beforeAll(startFinancialMongo);
afterEach(clearFinancialMongo);
afterAll(stopFinancialMongo);

// ═══════════════════════════════════════════════════════════════════════════
// MRCF — accept authority
// ═══════════════════════════════════════════════════════════════════════════

describe('MRCF — application acceptance authority (PLATFORM commercial decision)', () => {
  test('MRCF-02 (applicant cannot accept own application)', async () => {
    const { fA, applicant, application } = await scenario();
    const res = await request(app).post(`/api/real-estate-applications/${application._id}/accept`)
      .set(bearer(applicant, fA.tenant)).set('Idempotency-Key', `test-${seq++}`);
    expect(res.status).toBe(403);
    const fresh = await RealEstateApplication.findById(application._id);
    expect(fresh.status).toBe('submitted');
  });

  test('MRCF-04 (Tenant Admin cannot accept — legacy `isStaff` leak plugged)', async () => {
    const { fA, application } = await scenario();
    const admin = await makeUser({ role: 'Admin' });
    await addTenantMember({ tenant: fA.tenant, user: admin, bootstrap: fA.bootstrap, businessRole: 'Admin' });
    const res = await request(app).post(`/api/real-estate-applications/${application._id}/accept`)
      .set(bearer(admin, fA.tenant)).set('Idempotency-Key', `test-${seq++}`);
    expect(res.status).toBe(403);
    expect(await RealEstateReservation.countDocuments({ application: application._id })).toBe(0);
  });

  test('MRCF-05 (GestionnaireImmobilier cannot accept — legacy staff role no longer suffices)', async () => {
    const { fA, application } = await scenario();
    const gim = await makeUser({ role: 'GestionnaireImmobilier' });
    const res = await request(app).post(`/api/real-estate-applications/${application._id}/accept`)
      .set(bearer(gim, fA.tenant)).set('Idempotency-Key', `test-${seq++}`);
    expect(res.status).toBe(403);
  });

  test('MRCF-06 (Global Admin without PlatformOperator → DENIED)', async () => {
    const { fA, application } = await scenario();
    const orphanAdmin = await makeUser({ role: 'Admin' });
    const res = await request(app).post(`/api/real-estate-applications/${application._id}/accept`)
      .set(bearer(orphanAdmin, fA.tenant)).set('Idempotency-Key', `test-${seq++}`);
    expect(res.status).toBe(403);
  });

  test('MRCF-08 (Admin + PlatformOperator without commercial.manage → DENIED)', async () => {
    const { fA, application } = await scenario();
    const op = await operatorWith(['platform.reporting.read']);
    const res = await request(app).post(`/api/real-estate-applications/${application._id}/accept`)
      .set(bearer(op, fA.tenant)).set('Idempotency-Key', `test-${seq++}`);
    expect(res.status).toBe(403);
  });

  test('MRCF-09 (Admin + PlatformOperator + finance.manage only → DENIED — commercial.manage required)', async () => {
    const { fA, application } = await scenario();
    const op = await operatorWith(['platform.finance.manage']);
    const res = await request(app).post(`/api/real-estate-applications/${application._id}/accept`)
      .set(bearer(op, fA.tenant)).set('Idempotency-Key', `test-${seq++}`);
    expect(res.status).toBe(403);
  });

  test('MRCF-10 (Admin + PlatformOperator + commercial.manage → ALLOWED — creates reservation, locks Property)', async () => {
    const { fA, property, application } = await scenario();
    const op = await operatorWith(['platform.commercial.manage']);
    const res = await request(app).post(`/api/real-estate-applications/${application._id}/accept`)
      .set(bearer(op, fA.tenant)).set('Idempotency-Key', `test-mrcf-op-${seq++}`);
    expect([200, 201]).toContain(res.status);
    const reservation = await RealEstateReservation.findOne({ application: application._id });
    expect(reservation).toBeTruthy();
    const freshProperty = await Property.findById(property._id);
    expect(freshProperty.availability).toBe('Réservé');
  });

  test('MRCF-03 (owner self-service preserved — owner may accept their own listing)', async () => {
    const { fA, owner, application } = await scenario();
    const res = await request(app).post(`/api/real-estate-applications/${application._id}/accept`)
      .set(bearer(owner, fA.tenant)).set('Idempotency-Key', `test-mrcf-owner-${seq++}`);
    expect([200, 201]).toContain(res.status);
  });

  test('MRCF-14/15/16/17 (denied accept creates zero mutation on Contrat/Reservation/Property.availability)', async () => {
    const { fA, property, application } = await scenario();
    const stranger = await makeUser({ role: 'Admin' });
    const before = await Property.findById(property._id).lean();
    const res = await request(app).post(`/api/real-estate-applications/${application._id}/accept`)
      .set(bearer(stranger, fA.tenant)).set('Idempotency-Key', `test-${seq++}`);
    expect(res.status).toBe(403);
    expect(await Contrat.countDocuments({ bien: property._id })).toBe(0);
    expect(await RealEstateReservation.countDocuments({ application: application._id })).toBe(0);
    const after = await Property.findById(property._id).lean();
    expect(after.availability).toBe(before.availability);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// MRCF — reject authority
// ═══════════════════════════════════════════════════════════════════════════

describe('MRCF — application rejection authority', () => {
  test('MRCF-04b (Tenant Admin cannot reject either)', async () => {
    const { fA, application } = await scenario();
    const admin = await makeUser({ role: 'Admin' });
    await addTenantMember({ tenant: fA.tenant, user: admin, bootstrap: fA.bootstrap, businessRole: 'Admin' });
    const res = await request(app).post(`/api/real-estate-applications/${application._id}/reject`)
      .set(bearer(admin, fA.tenant)).send({ reason: 'test' });
    expect(res.status).toBe(403);
  });

  test('MRCF-10b (PlatformOperator + commercial.manage can reject)', async () => {
    const { fA, application } = await scenario();
    const op = await operatorWith(['platform.commercial.manage']);
    const res = await request(app).post(`/api/real-estate-applications/${application._id}/reject`)
      .set(bearer(op, fA.tenant)).send({ reason: 'MRCF test' });
    expect([200, 201]).toContain(res.status);
    const fresh = await RealEstateApplication.findById(application._id);
    expect(fresh.status).toBe('rejected');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// MRCF — capability independence + upstream contract preservation
// ═══════════════════════════════════════════════════════════════════════════

describe('MRCF — capability independence + upstream MRCB regression', () => {
  test('MRCF-26 (finance.manage does NOT imply commercial.manage on accept)', async () => {
    const { fA, application } = await scenario();
    const op = await operatorWith(['platform.finance.manage']);
    const res = await request(app).post(`/api/real-estate-applications/${application._id}/accept`)
      .set(bearer(op, fA.tenant)).set('Idempotency-Key', `test-${seq++}`);
    expect(res.status).toBe(403);
  });

  test('MRCF-24 (idempotency: repeat accept with same Idempotency-Key returns idempotent response, no duplicate reservation)', async () => {
    const { fA, application } = await scenario();
    const op = await operatorWith(['platform.commercial.manage']);
    const key = `test-mrcf-idem-${seq++}`;
    const r1 = await request(app).post(`/api/real-estate-applications/${application._id}/accept`).set(bearer(op, fA.tenant)).set('Idempotency-Key', key);
    expect([200, 201]).toContain(r1.status);
    const r2 = await request(app).post(`/api/real-estate-applications/${application._id}/accept`).set(bearer(op, fA.tenant)).set('Idempotency-Key', key);
    expect([200, 201]).toContain(r2.status);
    expect(await RealEstateReservation.countDocuments({ application: application._id })).toBe(1);
  });
});
