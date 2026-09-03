jest.mock('../config/cloudinary', () => ({
  destroyFromCloudinary: jest.fn().mockResolvedValue(true),
  upload: { array: () => (req, res, next) => next(), single: () => (req, res, next) => next() },
}));

const express = require('express');
const jwt = require('jsonwebtoken');
const request = require('supertest');
const { startFinancialMongo, clearFinancialMongo, stopFinancialMongo } = require('./helpers/financialMongoEnvironment');
const User = require('../models/User');
const TenantApplication = require('../models/TenantApplication');
const PlatformOperator = require('../models/PlatformOperator');
const PlatformTenant = require('../models/PlatformTenant');
const PlatformTenantSubscription = require('../models/PlatformTenantSubscription');
const OrgUnit = require('../models/OrgUnit');
const OrgMembership = require('../models/OrgMembership');
const service = require('../services/platformTenant/tenantApplicationService');
const platformTenantService = require('../services/platformTenant/platformTenantService');
const platformTenantRoutes = require('../routes/platformTenantRoutes');
const { errorHandler } = require('../middleware/errorMiddleware');

jest.setTimeout(120000);
const app = express(); app.use(express.json()); app.use('/api/platform-tenants', platformTenantRoutes); app.use(errorHandler);
const bearer = (user) => ({ Authorization: `Bearer ${jwt.sign({ id: user._id, tokenVersion: 0 }, process.env.JWT_SECRET, { expiresIn: '1d' })}` });
let sequence = 0;
const makeUser = async (role = 'Proprietaire') => User.create({
  name: `Utilisateur ${++sequence}`, email: `tenant-app-${Date.now()}-${sequence}@example.test`,
  password: 'Password123!', passwordConfirm: 'Password123!', role, isEmailVerified: true,
});
const draftInput = (overrides = {}) => ({
  organizationName: 'Groupe Panorama', organizationType: 'Exploitant hôtelier',
  professionalContact: { email: 'instruction@example.test', city: 'Brazzaville', country: 'Congo' },
  businessDeclaration: 'Activité professionnelle déclarée pour instruction produit.',
  establishmentContext: { name: 'Premier établissement', city: 'Brazzaville' },
  ...overrides,
});
const completeEvidence = async (applicationId) => TenantApplication.updateOne({ _id: applicationId }, { $set: {
  attachmentManifest: ['responsible_person_identity', 'professional_business_existence', 'establishment_authority', 'establishment_context'].map((category) => ({
    category, revision: 1, displayName: `${category}.pdf`, deletionState: 'active',
    privateAsset: { assetClass: 'PRIVATE_DOCUMENT', purpose: 'application', provider: 'cloudinary', publicId: `test/${category}`, resourceType: 'raw', deliveryType: 'authenticated', mimeType: 'application/pdf', size: 20 },
  })),
} });

beforeAll(async () => { await startFinancialMongo(); await TenantApplication.syncIndexes(); });
afterEach(clearFinancialMongo);
afterAll(stopFinancialMongo);

describe('TenantApplication Phase 1 — domaine pré-tenant', () => {
  test('TA-P1-01/03/04/05/23 — draft propriétaire, identité serveur et mass-assignment bloqué', async () => {
    const owner = await makeUser(); const foreign = await makeUser();
    const application = await service.createDraft({ actor: owner, input: draftInput({
      applicant: foreign._id, status: 'APPROVED', reviewedBy: foreign._id,
      approvedBy: foreign._id, provisionedTenant: new (require('mongoose').Types.ObjectId)(),
    }) });
    expect(String(application.applicant)).toBe(String(owner._id));
    expect(application.status).toBe('DRAFT');
    expect(application.reviewedBy).toBeNull(); expect(application.approvedBy).toBeNull();
    expect(application.provisionedTenant).toBeNull();
    expect(application.get('tenant')).toBeUndefined();
    expect(application.history).toHaveLength(1);
  });

  test.each(['Client', 'Admin', 'Collaborateur', 'CommunityManager'])('TA-P1-02 — %s ne peut pas créer une demande', async (role) => {
    await expect(service.createDraft({ actor: await makeUser(role), input: draftInput() }))
      .rejects.toMatchObject({ code: 'TENANT_APPLICATION_ROLE_FORBIDDEN', statusCode: 403 });
  });

  test('TA-P1-06 — deux drafts concurrents donnent une seule demande active', async () => {
    const owner = await makeUser();
    const [a, b] = await Promise.all([
      service.createDraft({ actor: owner, input: draftInput() }),
      service.createDraft({ actor: owner, input: draftInput() }),
    ]);
    expect(String(a._id)).toBe(String(b._id));
    expect(await TenantApplication.countDocuments({ applicant: owner._id })).toBe(1);
  });

  test('TA-P1-07/08/09/10/12 — transitions canoniques et états verrouillés', async () => {
    const owner = await makeUser();
    const draft = await service.createDraft({ actor: owner, input: draftInput() });
    await completeEvidence(draft._id);
    await expect(service.transitionApprovedInternal()).rejects.toMatchObject({ code: 'TENANT_APPLICATION_APPROVAL_NOT_WIRED' });
    await expect(service.submitOwnApplication({ applicationId: draft._id, actor: owner })).resolves.toMatchObject({ status: 'SUBMITTED' });
    await expect(service.editOwnApplication({ applicationId: draft._id, actor: owner, input: { organizationName: 'Altéré' } }))
      .rejects.toMatchObject({ code: 'TENANT_APPLICATION_LOCKED' });
    await expect(service.submitOwnApplication({ applicationId: draft._id, actor: owner }))
      .rejects.toMatchObject({ code: 'TENANT_APPLICATION_INVALID_TRANSITION' });
    expect((await TenantApplication.findById(draft._id)).history.map((entry) => entry.to)).toEqual(['DRAFT', 'SUBMITTED']);
  });

  test('TA-P1-11/16 — reviewer habilité demande un complément et seuls les champs rouverts changent', async () => {
    const owner = await makeUser(); const reviewer = await makeUser('Admin');
    await PlatformOperator.create({ user: reviewer._id, status: 'active', capabilities: [
      'platform.tenant_applications.read', 'platform.tenant_applications.review', 'platform.tenant_applications.request_changes',
    ], grantedBy: reviewer._id, grantReason: 'Fixture revue Phase 1' });
    const draft = await service.createDraft({ actor: owner, input: draftInput() });
    await completeEvidence(draft._id);
    await service.submitOwnApplication({ applicationId: draft._id, actor: owner });
    await service.startReview({ applicationId: draft._id, actor: reviewer });
    await service.requestAdditionalInfo({ applicationId: draft._id, actor: reviewer, reason: 'Préciser la déclaration.', reopenedFields: ['businessDeclaration'] });
    const edited = await service.editOwnApplication({ applicationId: draft._id, actor: owner, input: {
      organizationName: 'Nom interdit', businessDeclaration: 'Déclaration complétée.', status: 'APPROVED',
    } });
    expect(edited.organizationName).toBe('Groupe Panorama');
    expect(edited.businessDeclaration).toBe('Déclaration complétée.');
    expect(edited.status).toBe('ADDITIONAL_INFO_REQUIRED');
  });

  test('TA-P1-13/14/15 — Admin, staff tenant et opérateur sans capacité sont bloqués', async () => {
    const owner = await makeUser(); const draft = await service.createDraft({ actor: owner, input: draftInput() });
    await completeEvidence(draft._id);
    await service.submitOwnApplication({ applicationId: draft._id, actor: owner });
    const tenantAdmin = await makeUser('Admin');
    const staff = await makeUser('Collaborateur');
    const operator = await makeUser('Admin');
    await PlatformOperator.create({ user: operator._id, status: 'active', capabilities: ['platform.tenants.read'], grantedBy: operator._id, grantReason: 'Sans capacité application' });
    for (const actor of [tenantAdmin, staff, operator]) {
      await expect(service.startReview({ applicationId: draft._id, actor })).rejects.toMatchObject({ code: 'TENANT_APPLICATION_PLATFORM_AUTHORITY_REQUIRED' });
    }
  });

  test('TA-P1-17 — autre propriétaire ne lit pas la demande', async () => {
    const owner = await makeUser(); const other = await makeUser();
    const draft = await service.createDraft({ actor: owner, input: draftInput() });
    await completeEvidence(draft._id);
    await expect(service.getOwnApplication({ applicationId: draft._id, actor: other })).rejects.toMatchObject({ statusCode: 404 });
  });

  test('TA-P1-18/19 — ancien POST direct est bloqué et ne crée aucune ressource', async () => {
    const owner = await makeUser();
    const response = await request(app).post('/api/platform-tenants/onboarding/first-organization').set(bearer(owner)).send({ organizationName: 'Bypass' });
    expect([403, 404, 405]).toContain(response.status);
    expect(await PlatformTenant.countDocuments()).toBe(0);
    expect(await OrgUnit.countDocuments()).toBe(0);
    expect(await OrgMembership.countDocuments()).toBe(0);
    expect(await PlatformTenantSubscription.countDocuments()).toBe(0);
  });

  test('TA-P1-20 — primitive transactionnelle interne reste utilisable avec session', async () => {
    const owner = await makeUser(); const session = await require('mongoose').startSession();
    let tenant;
    try { await session.withTransaction(async () => { tenant = await platformTenantService.createFirstOwnerTenant({ name: 'Fondation future', actor: owner, session }); }); }
    finally { await session.endSession(); }
    expect(await PlatformTenant.countDocuments({ _id: tenant._id })).toBe(1);
    expect(await OrgUnit.countDocuments({ _id: tenant.rootOrgUnit })).toBe(1);
    expect(await PlatformTenantSubscription.countDocuments({ tenant: tenant._id })).toBe(1);
  });

  test('TA-P1-21/22 — transition concurrente réussit une fois et history reste append-only', async () => {
    const owner = await makeUser(); const reviewer = await makeUser('Admin');
    await PlatformOperator.create({ user: reviewer._id, status: 'active', capabilities: ['platform.tenant_applications.review'], grantedBy: reviewer._id, grantReason: 'Concurrence' });
    const draft = await service.createDraft({ actor: owner, input: draftInput() });
    await completeEvidence(draft._id);
    await service.submitOwnApplication({ applicationId: draft._id, actor: owner });
    const results = await Promise.allSettled([
      service.startReview({ applicationId: draft._id, actor: reviewer }),
      service.startReview({ applicationId: draft._id, actor: reviewer }),
    ]);
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    const stored = await TenantApplication.findById(draft._id);
    expect(stored.status).toBe('UNDER_REVIEW');
    expect(stored.history.map((entry) => entry.to)).toEqual(['DRAFT', 'SUBMITTED', 'UNDER_REVIEW']);
  });
});
