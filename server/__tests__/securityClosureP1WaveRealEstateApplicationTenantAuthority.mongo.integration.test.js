// SECURITY-CLOSURE-P1-WAVE-1 (P1-D, finding RA-08) — reproduction rouge->verte
// PERMANENTE : `realEstateApplicationController.list/getOne/review/accept/
// reject/downloadAttachment` accordaient l'accès à tout staff, de n'importe
// quel tenant, malgré le support déjà déclaré de `resourceType:
// 'RealEstateApplication'` dans tenantResourceAttributionService (jamais
// utilisé). Correctif : vérification tenant appliquée UNIQUEMENT quand
// l'accès est accordé via le statut staff (jamais pour propriétaire/candidat).
const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const { startFinancialMongo, clearFinancialMongo, stopFinancialMongo } = require('./helpers/financialMongoEnvironment');
const User = require('../models/User');
const Property = require('../models/Property');
const Application = require('../models/RealEstateApplication');
const PlatformOperator = require('../models/PlatformOperator');
const ApplicationDisclosureEvent = require('../models/ApplicationDisclosureEvent');
const { grantAuthorization, revokeAuthorization } = require('../services/contactAuthorizationService');
const realEstateApplicationRoutes = require('../routes/realEstateApplicationRoutes');
const { errorHandler } = require('../middleware/errorMiddleware');
const organizationService = require('../services/organizationService');
const platformTenantService = require('../services/platformTenant/platformTenantService');

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
async function buildTenantFixture(label) {
  seq += 1;
  const admin = await User.create({ name: `Admin ${label}`, email: `p1d-admin-${label}-${seq}-${Date.now()}@example.com`, password: 'Password123!', passwordConfirm: 'Password123!', role: 'Admin', isEmailVerified: true });
  const owner = await User.create({ name: `Owner ${label}`, email: `p1d-owner-${label}-${seq}-${Date.now()}@example.com`, password: 'Password123!', passwordConfirm: 'Password123!', role: 'Proprietaire', isEmailVerified: true });
  const applicant = await User.create({ name: `Applicant ${label}`, email: `p1d-app-${label}-${seq}-${Date.now()}@example.com`, password: 'Password123!', passwordConfirm: 'Password123!', role: 'Client', isEmailVerified: true });
  const tenant = await platformTenantService.createTenant({ name: `P1D-${label}-${seq}-${Date.now()}`, actor: admin });
  await Promise.all([
    organizationService.grantMembership({ userId: admin._id, orgUnitId: tenant.rootOrgUnit, actor: admin }),
    organizationService.grantMembership({ userId: owner._id, orgUnitId: tenant.rootOrgUnit, actor: admin }),
  ]);
  const property = await Property.create({
    title: `Villa P1D ${label}`, description: 'Description suffisamment longue pour la validation du modele Property.',
    pole: 'Altimmo', type: 'Villa', status: 'location', price: 300000,
    address: { arrondissement: 'Bacongo', city: 'Brazzaville' }, latitude: -4.26, longitude: 15.24,
    images: ['https://placehold.co/1200x800/png?text=Test'], surface: 90,
    statusAdmin: 'Validée', availability: 'Disponible', owner: owner._id,
  });
  const application = await Application.create({
    kind: 'rental_application', property: property._id, applicant: applicant._id, owner: owner._id,
    validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    rentalApplication: { desiredMoveIn: new Date(), desiredDurationMonths: 12, occupants: 1 },
  });
  return { admin, tenant, property, applicant, application };
}

describe('SECURITY-CLOSURE-P1-WAVE-1 (P1-D) — GET /api/real-estate-applications', () => {
  test('1. Admin A ne voit QUE les dossiers du tenant A', async () => {
    const a = await buildTenantFixture('A');
    const b = await buildTenantFixture('B');
    const res = await request(app).get('/api/real-estate-applications').set(bearer(a.admin, a.tenant._id));
    expect(res.status).toBe(200);
    const ids = res.body.data.applications.map((x) => x._id);
    expect(ids).toContain(String(a.application._id));
    expect(ids).not.toContain(String(b.application._id));
  });

  test('2. GET /:id : Admin A refusé sur le dossier du tenant B', async () => {
    const a = await buildTenantFixture('C');
    const b = await buildTenantFixture('D');
    const res = await request(app).get(`/api/real-estate-applications/${b.application._id}`).set(bearer(a.admin, a.tenant._id));
    expect(res.status).not.toBe(200);
  });

  test('3. POST /:id/reject : Admin A ne peut PAS rejeter le dossier du tenant B', async () => {
    const a = await buildTenantFixture('E');
    const b = await buildTenantFixture('F');
    const res = await request(app).post(`/api/real-estate-applications/${b.application._id}/reject`).set(bearer(a.admin, a.tenant._id)).send({ reason: 'non' });
    expect(res.status).not.toBe(200);
    const fresh = await Application.findById(b.application._id);
    expect(fresh.status).toBe('submitted');
  });

  test('4. Admin A PEUT consulter/traiter le dossier de son propre tenant (comportement historique préservé)', async () => {
    const a = await buildTenantFixture('G');
    const get = await request(app).get(`/api/real-estate-applications/${a.application._id}`).set(bearer(a.admin, a.tenant._id));
    expect(get.status).toBe(200);
    const review = await request(app).post(`/api/real-estate-applications/${a.application._id}/review`).set(bearer(a.admin, a.tenant._id));
    expect(review.status).toBe(200);
  });

  test('5. Le propriétaire (owner) reste autorisé sur son propre dossier, sans tenant', async () => {
    const a = await buildTenantFixture('H');
    const ownerUser = await User.findById(a.property.owner);
    const res = await request(app).get(`/api/real-estate-applications/${a.application._id}`).set(bearer(ownerUser));
    expect(res.status).toBe(200);
  });

  test('5b. le candidat conserve sa vue privée sur son propre dossier après populate', async () => {
    const a = await buildTenantFixture('H2');
    const res = await request(app).get(`/api/real-estate-applications/${a.application._id}`).set(bearer(a.applicant));
    expect(res.status).toBe(200);
    expect(res.body.data.application.projection.audience).toBe('applicant_self');
    expect(res.body.data.application.applicant.email).toBe(a.applicant.email);
  });

  test('6. Staff multi-tenant sans en-tête → fail-closed', async () => {
    const a = await buildTenantFixture('I');
    const b = await buildTenantFixture('J');
    const staffMulti = await User.create({ name: 'Staff Multi', email: `p1d-multi-${Date.now()}@example.com`, password: 'Password123!', passwordConfirm: 'Password123!', role: 'Admin', isEmailVerified: true });
    await organizationService.grantMembership({ userId: staffMulti._id, orgUnitId: a.tenant.rootOrgUnit, actor: a.admin });
    await organizationService.grantMembership({ userId: staffMulti._id, orgUnitId: b.tenant.rootOrgUnit, actor: b.admin });
    const res = await request(app).get('/api/real-estate-applications').set(bearer(staffMulti));
    expect(res.status).toBe(403);
  });

  test('7. un PlatformOperator au rôle Client ne peut pas divulguer un autre tenant que celui sélectionné', async () => {
    const a = await buildTenantFixture('K');
    const b = await buildTenantFixture('L');
    const operator = await User.create({ name: 'Operator Client', email: `p1d-operator-client-${Date.now()}@example.com`, password: 'Password123!', passwordConfirm: 'Password123!', role: 'Client', isEmailVerified: true });
    await PlatformOperator.create({ user: operator._id, capabilities: ['platform.commercial.manage'], grantedBy: a.admin._id, grantReason: 'TEST DATA tenant isolation' });
    const res = await request(app)
      .get(`/api/real-estate-applications/${b.application._id}/contact-disclosure`)
      .query({ reason: 'Qualification du dossier' })
      .set(bearer(operator, a.tenant._id));
    expect(res.status).not.toBe(200);
    expect(JSON.stringify(res.body)).not.toContain(b.applicant.email);
  });

  test('8. une révocation concurrente pendant l’audit bloque la remise des coordonnées', async () => {
    const a = await buildTenantFixture('M');
    const platformActor = await User.create({ name: 'Platform Actor', email: `p1d-platform-${Date.now()}@example.com`, password: 'Password123!', passwordConfirm: 'Password123!', role: 'Admin', isEmailVerified: true });
    await PlatformOperator.create({ user: platformActor._id, capabilities: ['platform.commercial.manage'], grantedBy: platformActor._id, grantReason: 'TEST DATA concurrent revoke' });
    const authorization = await grantAuthorization({
      clientId: a.applicant._id, representativeId: a.property.owner, propertyId: a.property._id,
      dossierType: 'RealEstateApplication', dossierId: a.application._id, tenantId: a.tenant._id,
      scopes: ['contact_details_disclosure'], actor: platformActor, reason: 'TEST DATA initial grant',
    });
    const originalCreate = ApplicationDisclosureEvent.create.bind(ApplicationDisclosureEvent);
    const createSpy = jest.spyOn(ApplicationDisclosureEvent, 'create').mockImplementation(async (payload) => {
      const event = await originalCreate(payload);
      await revokeAuthorization({ authorizationId: authorization._id, actor: platformActor, reason: 'TEST DATA concurrent revoke' });
      return event;
    });
    try {
      const owner = await User.findById(a.property.owner);
      const res = await request(app)
        .get(`/api/real-estate-applications/${a.application._id}/contact-disclosure`)
        .query({ reason: 'Décision du propriétaire' })
        .set(bearer(owner));
      expect(res.status).toBe(403);
      expect(JSON.stringify(res.body)).not.toContain(a.applicant.email);
    } finally {
      createSpy.mockRestore();
    }
  });
});
