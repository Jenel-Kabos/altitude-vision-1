jest.mock('../services/storage/secureStorageService', () => ({
  uploadPrivateAsset: jest.fn(), readPrivateAsset: jest.fn().mockResolvedValue(Buffer.from('%PDF-test')), deletePrivateAsset: jest.fn(),
}));
jest.mock('../services/notificationService', () => ({ notify: jest.fn().mockResolvedValue({}) }));

const express = require('express');
const jwt = require('jsonwebtoken');
const request = require('supertest');
const { startFinancialMongo, clearFinancialMongo, stopFinancialMongo } = require('./helpers/financialMongoEnvironment');
const User = require('../models/User');
const TenantApplication = require('../models/TenantApplication');
const PlatformOperator = require('../models/PlatformOperator');
const PlatformTenant = require('../models/PlatformTenant');
const PlatformTenantSettings = require('../models/PlatformTenantSettings');
const PlatformTenantTheme = require('../models/PlatformTenantTheme');
const PlatformTenantSubscription = require('../models/PlatformTenantSubscription');
const OrgUnit = require('../models/OrgUnit');
const OrgMembership = require('../models/OrgMembership');
const ActionLog = require('../models/ActionLog');
const service = require('../services/platformTenant/tenantApplicationService');
const { resolveEffectiveTenantContext } = require('../services/platformTenant/tenantContextService');
const organizationService = require('../services/organizationService');
const crypto = require('crypto');
const routes = require('../routes/platformTenantRoutes');
const { errorHandler } = require('../middleware/errorMiddleware');

jest.setTimeout(120000);
const app = express(); app.use(express.json()); app.use('/api/platform-tenants', routes); app.use(errorHandler);
const bearer = (user) => ({ Authorization: `Bearer ${jwt.sign({ id: user._id, tokenVersion: 0 }, process.env.JWT_SECRET, { expiresIn: '1d' })}` });
let sequence = 0;
const makeUser = (role = 'Proprietaire') => User.create({ name: `Phase3 ${++sequence}`, email: `phase3-${Date.now()}-${sequence}@example.test`, password: 'Password123!', passwordConfirm: 'Password123!', role, isEmailVerified: true });
const submitted = async (owner) => TenantApplication.create({ applicant: owner._id, organizationName: 'Organisation à instruire', status: 'SUBMITTED', activeApplicantKey: String(owner._id), history: [{ from: null, to: 'DRAFT', actor: owner._id }, { from: 'DRAFT', to: 'SUBMITTED', actor: owner._id }] });
const underReview = async (owner, reviewer) => { const item = await submitted(owner); return service.startReview({ applicationId: item._id, actor: reviewer }); };
const operator = async (capabilities) => { const user = await makeUser('Admin'); await PlatformOperator.create({ user: user._id, status: 'active', capabilities, grantedBy: user._id, grantReason: 'Phase 3 test' }); return user; };

beforeAll(async () => { await startFinancialMongo(); await TenantApplication.syncIndexes(); });
afterEach(clearFinancialMongo);
afterAll(stopFinancialMongo);

describe('TenantApplication Phase 3 — preuve RED review API', () => {
  test('REV-01 — opérateur read liste les demandes', async () => {
    await submitted(await makeUser()); const reviewer = await operator(['platform.tenant_applications.read']);
    const response = await request(app).get('/api/platform-tenants/applications?status=SUBMITTED').set(bearer(reviewer));
    expect(response.status).toBe(200); expect(response.body.data.applications).toHaveLength(1);
  });
  test('REV-04 — opérateur review démarre instruction', async () => {
    const application = await submitted(await makeUser()); const reviewer = await operator(['platform.tenant_applications.review']);
    const response = await request(app).post(`/api/platform-tenants/applications/${application._id}/start-review`).set(bearer(reviewer));
    expect(response.status).toBe(200); expect(response.body.data.application.status).toBe('UNDER_REVIEW');
  });
  test('REV-02/03/32 — rôles tenant et opérateur sans read ne listent pas', async () => {
    await submitted(await makeUser()); const admin = await makeUser('Admin'); const owner = await makeUser();
    const noRead = await operator(['platform.tenant_applications.review']);
    for (const user of [admin, owner, noRead]) expect((await request(app).get('/api/platform-tenants/applications').set(bearer(user))).status).toBe(403);
  });
  test('REV-05 — start-review concurrent n’ajoute qu’une transition', async () => {
    const item = await submitted(await makeUser()); const a = await operator(['platform.tenant_applications.review']); const b = await operator(['platform.tenant_applications.review']);
    const results = await Promise.all([a, b].map((reviewer) => request(app).post(`/api/platform-tenants/applications/${item._id}/start-review`).set(bearer(reviewer))));
    expect(results.filter((result) => result.status === 200)).toHaveLength(1);
    expect((await TenantApplication.findById(item._id)).history.filter((entry) => entry.to === 'UNDER_REVIEW')).toHaveLength(1);
  });
  test('REV-06..13 — complément strict, édition limitée, révision et resoumission', async () => {
    const owner = await makeUser(); const review = await operator(['platform.tenant_applications.review']); const changes = await operator(['platform.tenant_applications.request_changes']);
    const item = await underReview(owner, review);
    expect((await request(app).post(`/api/platform-tenants/applications/${item._id}/request-changes`).set(bearer(changes)).send({})).status).toBe(422);
    expect((await request(app).post(`/api/platform-tenants/applications/${item._id}/request-changes`).set(bearer(changes)).send({ reason: 'Compléter', requestedFields: ['status'] })).status).toBe(422);
    const changed = await request(app).post(`/api/platform-tenants/applications/${item._id}/request-changes`).set(bearer(changes)).send({ reason: 'Compléter la déclaration et la preuve.', requestedFields: ['businessDeclaration'], requestedDocumentCategories: ['establishment_context'] });
    expect(changed.status).toBe(200); expect(changed.body.data.application.status).toBe('ADDITIONAL_INFO_REQUIRED');
    const edited = await request(app).patch(`/api/platform-tenants/applications/${item._id}`).set(bearer(owner)).send({ organizationName: 'Interdit', businessDeclaration: 'Complément fourni' });
    expect(edited.body.data.application.organizationName).toBe('Organisation à instruire'); expect(edited.body.data.application.businessDeclaration).toBe('Complément fourni');
    await TenantApplication.updateOne({ _id: item._id }, { $set: { organizationType: 'Entreprise', professionalContact: { email: 'x@example.test' }, establishmentContext: { name: 'Site' },
      attachmentManifest: ['responsible_person_identity', 'professional_business_existence', 'establishment_authority', 'establishment_context'].map((category) => ({ category, revision: 1, displayName: `${category}.pdf`, deletionState: 'active', privateAsset: { assetClass: 'PRIVATE_DOCUMENT', purpose: 'application', provider: 'cloudinary', publicId: `p/${category}`, resourceType: 'raw', deliveryType: 'authenticated', mimeType: 'application/pdf', size: 10 } })) } });
    expect((await request(app).post(`/api/platform-tenants/applications/${item._id}/submit`).set(bearer(owner))).status).toBe(200);
  });
  test('REJ-01..04 — rejet motivé terminal sans ressources', async () => {
    const owner = await makeUser(); const review = await operator(['platform.tenant_applications.review']); const rejecter = await operator(['platform.tenant_applications.reject']);
    const item = await underReview(owner, review);
    expect((await request(app).post(`/api/platform-tenants/applications/${item._id}/reject`).set(bearer(rejecter)).send({})).status).toBe(422);
    expect((await request(app).post(`/api/platform-tenants/applications/${item._id}/reject`).set(bearer(rejecter)).send({ reason: 'Dossier non vérifiable.' })).status).toBe(200);
    expect((await TenantApplication.findById(item._id)).status).toBe('REJECTED');
    expect(await PlatformTenant.countDocuments()).toBe(0); expect(await OrgUnit.countDocuments()).toBe(0); expect(await OrgMembership.countDocuments()).toBe(0); expect(await PlatformTenantSubscription.countDocuments()).toBe(0);
  });
  test('RR-01..15 — seul le propriétaire reçoit le motif de rejet applicant-safe', async () => {
    const owner = await makeUser();
    const otherOwner = await makeUser();
    const tenantAdmin = await makeUser('Admin');
    const client = await makeUser('Client');
    const review = await operator(['platform.tenant_applications.review']);
    const rejecter = await operator(['platform.tenant_applications.reject']);
    const item = await underReview(owner, review);
    const reason = 'Les justificatifs transmis ne permettent pas de vérifier l’activité.';

    const rejected = await request(app)
      .post(`/api/platform-tenants/applications/${item._id}/reject`)
      .set(bearer(rejecter))
      .send({ reason });
    expect(rejected.status).toBe(200);

    const stored = await TenantApplication.findById(item._id);
    expect(stored.status).toBe('REJECTED');
    expect(stored.rejectionReason).toBe(reason);

    const ownRead = await request(app).get('/api/platform-tenants/applications/me').set(bearer(owner));
    expect(ownRead.status).toBe(200);
    expect(ownRead.body.data.application).toMatchObject({ status: 'REJECTED', rejectionReason: reason });
    expect(ownRead.body.data.application).not.toHaveProperty('rejectedBy');
    expect(ownRead.body.data.application).not.toHaveProperty('reviewedBy');
    expect(ownRead.body.data.application).not.toHaveProperty('history');
    expect(ownRead.body.data.application).not.toHaveProperty('provisionedTenant');

    const forbiddenPatch = await request(app)
      .patch(`/api/platform-tenants/applications/${item._id}`)
      .set(bearer(owner))
      .send({ rejectionReason: 'Motif forgé par le demandeur.' });
    expect(forbiddenPatch.status).toBe(409);
    expect((await TenantApplication.findById(item._id)).rejectionReason).toBe(reason);

    for (const actor of [otherOwner, tenantAdmin, client]) {
      const response = await request(app).get(`/api/platform-tenants/applications/${item._id}`).set(bearer(actor));
      expect(response.status).toBe(403);
      expect(JSON.stringify(response.body)).not.toContain(reason);
    }

    expect((await request(app).get('/api/platform-tenants/applications/me/status').set(bearer(owner))).body.data.state).toBe('REJECTED');
    expect(await PlatformTenant.countDocuments()).toBe(0);
    expect(await OrgMembership.countDocuments()).toBe(0);
  });
  test('RR-10 — le serializer applicant ne publie le motif que pour REJECTED', async () => {
    const owner = await makeUser();
    const item = await submitted(owner);
    await TenantApplication.updateOne({ _id: item._id }, { $set: { rejectionReason: 'Valeur historique non applicable.' } });
    const response = await request(app).get('/api/platform-tenants/applications/me').set(bearer(owner));
    expect(response.status).toBe(200);
    expect(response.body.data.application.status).toBe('SUBMITTED');
    expect(response.body.data.application).not.toHaveProperty('rejectionReason');
  });
  test('APP-01..16 — approbation atomique crée le graphe canonique et résout le tenant', async () => {
    const owner = await makeUser(); const review = await operator(['platform.tenant_applications.review']); const approver = await operator(['platform.tenant_applications.approve']);
    const item = await underReview(owner, review);
    expect((await request(app).post(`/api/platform-tenants/applications/${item._id}/approve`).set(bearer(await makeUser('Admin')))).status).toBe(403);
    const approved = await request(app).post(`/api/platform-tenants/applications/${item._id}/approve`).set(bearer(approver)).send({ tenantId: new (require('mongoose').Types.ObjectId)(), applicant: approver._id });
    expect(approved.status).toBe(200);
    const stored = await TenantApplication.findById(item._id);
    expect(stored.status).toBe('APPROVED'); expect(stored.provisionedTenant).toBeTruthy(); expect(stored.provisionedMembership).toBeTruthy();
    expect(await PlatformTenant.countDocuments()).toBe(1); expect(await OrgUnit.countDocuments({ type: 'organization' })).toBe(1);
    expect(await OrgMembership.countDocuments({ user: owner._id, status: 'active' })).toBe(1);
    expect(await PlatformTenantSettings.countDocuments()).toBe(1); expect(await PlatformTenantTheme.countDocuments()).toBe(1); expect(await PlatformTenantSubscription.countDocuments({ status: 'trialing' })).toBe(1);
    expect(String((await resolveEffectiveTenantContext(owner._id)).tenant._id)).toBe(String(stored.provisionedTenant));
    expect((await request(app).get('/api/platform-tenants/applications/me/status').set(bearer(owner))).body.data.state).toBe('ALREADY_ONBOARDED');
    expect(await ActionLog.countDocuments({ action: 'tenant_application.approved' })).toBe(1);
  });
  test('APP-17/18 — approbations parallèles créent un seul graphe', async () => {
    const owner = await makeUser(); const review = await operator(['platform.tenant_applications.review']); const approver = await operator(['platform.tenant_applications.approve']); const item = await underReview(owner, review);
    const outcomes = await Promise.allSettled([service.approveApplication({ applicationId: item._id, actor: approver }), service.approveApplication({ applicationId: item._id, actor: approver })]);
    expect(outcomes.filter((outcome) => outcome.status === 'fulfilled').length).toBeGreaterThanOrEqual(1);
    expect(await PlatformTenant.countDocuments()).toBe(1); expect(await OrgUnit.countDocuments({ type: 'organization' })).toBe(1); expect(await OrgMembership.countDocuments()).toBe(1); expect(await PlatformTenantSubscription.countDocuments()).toBe(1);
  });
  test.each(['after_tenant', 'after_membership', 'before_commit'])('ROLL — %s annule tout le graphe', async (failurePoint) => {
    const owner = await makeUser(); const review = await operator(['platform.tenant_applications.review']); const approver = await operator(['platform.tenant_applications.approve']); const item = await underReview(owner, review);
    await expect(service.approveApplication({ applicationId: item._id, actor: approver, failurePoint })).rejects.toThrow();
    expect((await TenantApplication.findById(item._id)).status).toBe('UNDER_REVIEW'); expect(await PlatformTenant.countDocuments()).toBe(0); expect(await OrgUnit.countDocuments()).toBe(0); expect(await OrgMembership.countDocuments()).toBe(0); expect(await PlatformTenantSubscription.countDocuments()).toBe(0);
  });
  test('DOC-R-01..04 — reviewer read accède par application, les autres sont bloqués', async () => {
    const owner = await makeUser(); const reviewer = await operator(['platform.tenant_applications.read']); const admin = await makeUser('Admin');
    const item = await submitted(owner); const documentId = new (require('mongoose').Types.ObjectId)();
    await TenantApplication.updateOne({ _id: item._id }, { $push: { attachmentManifest: { _id: documentId, category: 'responsible_person_identity', revision: 1, displayName: 'preuve.pdf', deletionState: 'active', privateAsset: { assetClass: 'PRIVATE_DOCUMENT', purpose: 'application', provider: 'cloudinary', publicId: 'private/proof', resourceType: 'raw', deliveryType: 'authenticated', mimeType: 'application/pdf', size: 10 } } } });
    expect((await request(app).get(`/api/platform-tenants/applications/${item._id}/review-documents/${documentId}`).set(bearer(reviewer))).status).toBe(200);
    expect((await request(app).get(`/api/platform-tenants/applications/${item._id}/review-documents/${documentId}`).set(bearer(admin))).status).toBe(403);
    expect((await request(app).get(`/api/platform-tenants/applications/${item._id}/review-documents/${documentId}`).set(bearer(owner))).status).toBe(403);
  });
  test('APP-20/21 — membership inactive ou ambiguë bloque le provisioning', async () => {
    for (const membershipCount of [1, 2]) {
      const owner = await makeUser(); const review = await operator(['platform.tenant_applications.review']); const approver = await operator(['platform.tenant_applications.approve']); const item = await underReview(owner, review);
      for (let index = 0; index < membershipCount; index += 1) {
        const root = await organizationService.createOrgUnit({ name: `Legacy ${sequence}-${index}`, type: 'organization', actor: approver });
        await OrgMembership.create({ user: owner._id, orgUnit: root._id, roleInUnit: 'owner', status: index ? 'active' : 'suspended' });
      }
      await expect(service.approveApplication({ applicationId: item._id, actor: approver })).rejects.toMatchObject({ code: 'TENANT_APPLICATION_MEMBERSHIP_CONFLICT' });
      expect((await TenantApplication.findById(item._id)).status).toBe('UNDER_REVIEW');
      await clearFinancialMongo();
    }
  });
  test('APP-19 — collision déterministe étrangère n’est jamais adoptée', async () => {
    const owner = await makeUser(); const foreign = await makeUser(); const review = await operator(['platform.tenant_applications.review']); const approver = await operator(['platform.tenant_applications.approve']); const item = await underReview(owner, review);
    const root = await organizationService.createOrgUnit({ name: 'Organisation étrangère', type: 'organization', actor: foreign });
    const slug = `first-owner-${crypto.createHash('sha256').update(String(owner._id)).digest('hex').slice(0, 40)}`;
    const foreignTenant = await PlatformTenant.create({ name: 'Étrangère', slug, rootOrgUnit: root._id, createdBy: foreign._id });
    await expect(service.approveApplication({ applicationId: item._id, actor: approver })).rejects.toThrow();
    const stored = await TenantApplication.findById(item._id); expect(stored.status).toBe('UNDER_REVIEW'); expect(stored.provisionedTenant).toBeNull();
    expect(await PlatformTenant.countDocuments()).toBe(1); expect(String((await PlatformTenant.findOne())._id)).toBe(String(foreignTenant._id));
  });
  test('RACE — approve/reject et approve/request-changes ont un seul état cohérent', async () => {
    for (const competing of ['reject', 'changes']) {
      const owner = await makeUser(); const review = await operator(['platform.tenant_applications.review']); const approver = await operator(['platform.tenant_applications.approve']);
      const rival = await operator([competing === 'reject' ? 'platform.tenant_applications.reject' : 'platform.tenant_applications.request_changes']); const item = await underReview(owner, review);
      await Promise.allSettled([
        service.approveApplication({ applicationId: item._id, actor: approver }),
        competing === 'reject' ? service.rejectApplication({ applicationId: item._id, actor: rival, reason: 'Refus concurrent.' })
          : service.requestAdditionalInfo({ applicationId: item._id, actor: rival, reason: 'Complément concurrent.', reopenedFields: ['businessDeclaration'] }),
      ]);
      const final = await TenantApplication.findById(item._id); const tenantCount = await PlatformTenant.countDocuments();
      expect(['APPROVED', competing === 'reject' ? 'REJECTED' : 'ADDITIONAL_INFO_REQUIRED']).toContain(final.status);
      expect(tenantCount).toBe(final.status === 'APPROVED' ? 1 : 0);
      await clearFinancialMongo();
    }
  });
});
