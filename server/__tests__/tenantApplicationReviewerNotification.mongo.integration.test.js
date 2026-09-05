// TENANT-APPLICATION-REVIEWER-NOTIFICATION-1 — preuve RED→GREEN du fan-out
// plateforme à la soumission (SUBMITTED) et du compteur "pending review".
// Volontairement séparé de tenantApplicationPhase3 (qui mocke notify()
// entièrement) : ce fichier a besoin de vraies écritures Notification pour
// prouver le contenu/la dédupe/l'absence de fuite de données privées.
const express = require('express');
const jwt = require('jsonwebtoken');
const request = require('supertest');
const { startFinancialMongo, clearFinancialMongo, stopFinancialMongo } = require('./helpers/financialMongoEnvironment');
const User = require('../models/User');
const TenantApplication = require('../models/TenantApplication');
const PlatformOperator = require('../models/PlatformOperator');
const Notification = require('../models/Notification');
const routes = require('../routes/platformTenantRoutes');
const { errorHandler } = require('../middleware/errorMiddleware');

jest.setTimeout(120000);
const app = express(); app.use(express.json()); app.use('/api/platform-tenants', routes); app.use(errorHandler);
const bearer = (user) => ({ Authorization: `Bearer ${jwt.sign({ id: user._id, tokenVersion: 0 }, process.env.JWT_SECRET, { expiresIn: '1d' })}` });

let sequence = 0;
const makeUser = (role = 'Proprietaire') => User.create({
  name: `ReviewerNotif ${++sequence}`, email: `reviewer-notif-${Date.now()}-${sequence}@example.test`,
  password: 'Password123!', passwordConfirm: 'Password123!', role, isEmailVerified: true,
});
const operator = async (capabilities, status = 'active') => {
  const user = await makeUser('Admin');
  await PlatformOperator.create({ user: user._id, status, capabilities, grantedBy: user._id, grantReason: 'Reviewer notification test' });
  return user;
};

const REQUIRED_DOCS = ['responsible_person_identity', 'professional_business_existence', 'establishment_authority', 'establishment_context'];
const completeDraft = async (owner, organizationName = 'Organisation Notifiable') => TenantApplication.create({
  applicant: owner._id, organizationName, organizationType: 'Entreprise', status: 'DRAFT', activeApplicantKey: String(owner._id),
  businessDeclaration: 'Exploitation hôtelière déclarée.',
  professionalContact: { email: 'contact@example.test' },
  establishmentContext: { name: 'Site principal' },
  attachmentManifest: REQUIRED_DOCS.map((category) => ({
    category, revision: 1, displayName: `${category}.pdf`, deletionState: 'active',
    privateAsset: { assetClass: 'PRIVATE_DOCUMENT', purpose: 'application', provider: 'cloudinary', publicId: `p/${category}`, resourceType: 'raw', deliveryType: 'authenticated', mimeType: 'application/pdf', size: 10 },
  })),
  history: [{ from: null, to: 'DRAFT', actor: owner._id }],
});
const submitApplication = (owner, applicationId) => request(app).post(`/api/platform-tenants/applications/${applicationId}/submit`).set(bearer(owner));
const reviewerNotifications = (recipientId) => Notification.find({ recipient: recipientId, type: 'tenant_application_submitted' }).lean();

beforeAll(async () => { await startFinancialMongo(); await TenantApplication.syncIndexes(); });
afterEach(clearFinancialMongo);
afterAll(stopFinancialMongo);

describe('TenantApplication SUBMITTED — fan-out reviewer', () => {
  test('un opérateur actif avec read reçoit exactement une notification', async () => {
    const owner = await makeUser();
    const application = await completeDraft(owner);
    const reader = await operator(['platform.tenant_applications.read']);

    const response = await submitApplication(owner, application._id);
    expect(response.status).toBe(200);

    const notifications = await reviewerNotifications(reader._id);
    expect(notifications).toHaveLength(1);
    expect(notifications[0].title).toBe('Nouvelle demande d’activation professionnelle');
    expect(notifications[0].body).toBe('Organisation Notifiable a soumis une demande d’activation professionnelle.');
  });

  test('tous les opérateurs actifs éligibles reçoivent une notification, chacun une seule fois', async () => {
    const owner = await makeUser();
    const application = await completeDraft(owner);
    const readerA = await operator(['platform.tenant_applications.read']);
    const readerB = await operator(['platform.tenant_applications.read', 'platform.tenant_applications.review']);

    await submitApplication(owner, application._id);

    expect(await reviewerNotifications(readerA._id)).toHaveLength(1);
    expect(await reviewerNotifications(readerB._id)).toHaveLength(1);
  });

  test('un opérateur sans la capacité read ne reçoit rien', async () => {
    const owner = await makeUser();
    const application = await completeDraft(owner);
    const noRead = await operator(['platform.tenant_applications.review']);

    await submitApplication(owner, application._id);

    expect(await reviewerNotifications(noRead._id)).toHaveLength(0);
  });

  test('un opérateur suspendu avec la capacité read ne reçoit rien', async () => {
    const owner = await makeUser();
    const application = await completeDraft(owner);
    const suspended = await operator(['platform.tenant_applications.read'], 'suspended');

    await submitApplication(owner, application._id);

    expect(await reviewerNotifications(suspended._id)).toHaveLength(0);
  });

  test('un Tenant Admin sans PlatformOperator ne reçoit rien', async () => {
    const owner = await makeUser();
    const application = await completeDraft(owner);
    const tenantAdmin = await makeUser('Admin');

    await submitApplication(owner, application._id);

    expect(await reviewerNotifications(tenantAdmin._id)).toHaveLength(0);
  });

  test('le demandeur lui-même ne reçoit pas la notification reviewer', async () => {
    const owner = await makeUser();
    const application = await completeDraft(owner);
    await operator(['platform.tenant_applications.read']);

    await submitApplication(owner, application._id);

    expect(await reviewerNotifications(owner._id)).toHaveLength(0);
  });

  test('une resoumission après échec (déjà SUBMITTED) ne duplique pas la notification', async () => {
    const owner = await makeUser();
    const application = await completeDraft(owner);
    const reader = await operator(['platform.tenant_applications.read']);

    const first = await submitApplication(owner, application._id);
    expect(first.status).toBe(200);
    const retry = await submitApplication(owner, application._id);
    expect(retry.status).toBe(409);

    expect(await reviewerNotifications(reader._id)).toHaveLength(1);
  });

  test('une course concurrente sur la même soumission ne produit qu’une seule notification par opérateur', async () => {
    const owner = await makeUser();
    const application = await completeDraft(owner);
    const reader = await operator(['platform.tenant_applications.read']);

    const [a, b] = await Promise.all([submitApplication(owner, application._id), submitApplication(owner, application._id)]);
    expect([a.status, b.status].sort()).toEqual([200, 409]);

    expect(await reviewerNotifications(reader._id)).toHaveLength(1);
  });

  test('la notification ne contient aucune donnée privée du dossier', async () => {
    const owner = await makeUser();
    const application = await completeDraft(owner);
    const reader = await operator(['platform.tenant_applications.read']);

    await submitApplication(owner, application._id);

    const [notif] = await reviewerNotifications(reader._id);
    const payload = JSON.stringify(notif.metadata || notif.data || {});
    expect(payload).not.toMatch(/privateAsset|publicId|resourceType|deliveryType|professionalContact|establishmentContext|businessDeclaration/i);
    expect(notif.metadata).toEqual(expect.objectContaining({
      applicationId: String(application._id), organizationName: 'Organisation Notifiable', status: 'SUBMITTED',
    }));
  });
});

describe('TenantApplication — compteur pending review', () => {
  const seedStatus = async (status, extra = {}) => {
    const owner = await makeUser();
    return TenantApplication.create({
      applicant: owner._id, organizationName: `Org ${status}`, status, activeApplicantKey: String(owner._id),
      history: [{ from: null, to: 'DRAFT', actor: owner._id }], ...extra,
    });
  };

  test('DRAFT -> 0', async () => {
    await seedStatus('DRAFT');
    const reader = await operator(['platform.tenant_applications.read']);
    const response = await request(app).get('/api/platform-tenants/applications/pending-count').set(bearer(reader));
    expect(response.status).toBe(200);
    expect(response.body.data.count).toBe(0);
  });

  test('SUBMITTED -> 1', async () => {
    await seedStatus('SUBMITTED');
    const reader = await operator(['platform.tenant_applications.read']);
    const response = await request(app).get('/api/platform-tenants/applications/pending-count').set(bearer(reader));
    expect(response.body.data.count).toBe(1);
  });

  test('UNDER_REVIEW -> 1', async () => {
    await seedStatus('UNDER_REVIEW');
    const reader = await operator(['platform.tenant_applications.read']);
    const response = await request(app).get('/api/platform-tenants/applications/pending-count').set(bearer(reader));
    expect(response.body.data.count).toBe(1);
  });

  test('ADDITIONAL_INFO_REQUIRED -> 0', async () => {
    await seedStatus('ADDITIONAL_INFO_REQUIRED');
    const reader = await operator(['platform.tenant_applications.read']);
    const response = await request(app).get('/api/platform-tenants/applications/pending-count').set(bearer(reader));
    expect(response.body.data.count).toBe(0);
  });

  test('APPROVED -> 0', async () => {
    await seedStatus('APPROVED');
    const reader = await operator(['platform.tenant_applications.read']);
    const response = await request(app).get('/api/platform-tenants/applications/pending-count').set(bearer(reader));
    expect(response.body.data.count).toBe(0);
  });

  test('REJECTED -> 0', async () => {
    await seedStatus('REJECTED');
    const reader = await operator(['platform.tenant_applications.read']);
    const response = await request(app).get('/api/platform-tenants/applications/pending-count').set(bearer(reader));
    expect(response.body.data.count).toBe(0);
  });

  test('mélange de statuts ne compte que SUBMITTED + UNDER_REVIEW', async () => {
    await Promise.all(['DRAFT', 'SUBMITTED', 'SUBMITTED', 'UNDER_REVIEW', 'ADDITIONAL_INFO_REQUIRED', 'APPROVED', 'REJECTED'].map((status) => seedStatus(status)));
    const reader = await operator(['platform.tenant_applications.read']);
    const response = await request(app).get('/api/platform-tenants/applications/pending-count').set(bearer(reader));
    expect(response.body.data.count).toBe(3);
  });

  test('sans capacité read, le compteur est refusé (jamais un 0 par défaut silencieux)', async () => {
    await seedStatus('SUBMITTED');
    const tenantAdmin = await makeUser('Admin');
    const response = await request(app).get('/api/platform-tenants/applications/pending-count').set(bearer(tenantAdmin));
    expect(response.status).toBe(403);
  });

  test('aucun en-tête tenant requis (platform-scoped)', async () => {
    await seedStatus('SUBMITTED');
    const reader = await operator(['platform.tenant_applications.read']);
    const response = await request(app).get('/api/platform-tenants/applications/pending-count')
      .set({ ...bearer(reader), 'X-Platform-Tenant-Id': 'forged-tenant-id' });
    expect(response.status).toBe(200);
    expect(response.body.data.count).toBe(1);
  });
});
