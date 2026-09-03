jest.mock('../services/storage/secureStorageService', () => ({
  uploadPrivateAsset: jest.fn(), readPrivateAsset: jest.fn(), deletePrivateAsset: jest.fn(),
}));

const express = require('express');
const jwt = require('jsonwebtoken');
const request = require('supertest');
const { startFinancialMongo, clearFinancialMongo, stopFinancialMongo } = require('./helpers/financialMongoEnvironment');
const User = require('../models/User');
const TenantApplication = require('../models/TenantApplication');
const PlatformTenant = require('../models/PlatformTenant');
const OrgUnit = require('../models/OrgUnit');
const OrgMembership = require('../models/OrgMembership');
const PlatformTenantSubscription = require('../models/PlatformTenantSubscription');
const storage = require('../services/storage/secureStorageService');
const routes = require('../routes/platformTenantRoutes');
const { errorHandler } = require('../middleware/errorMiddleware');

jest.setTimeout(120000);
const app = express(); app.use(express.json()); app.use('/api/platform-tenants', routes); app.use(errorHandler);
const bearer = (user) => ({ Authorization: `Bearer ${jwt.sign({ id: user._id, tokenVersion: 0 }, process.env.JWT_SECRET, { expiresIn: '1d' })}` });
let sequence = 0;
const makeUser = (role = 'Proprietaire') => User.create({ name: `Phase2 ${++sequence}`, email: `phase2-${Date.now()}-${sequence}@example.test`, password: 'Password123!', passwordConfirm: 'Password123!', role, isEmailVerified: true });

beforeAll(async () => { await startFinancialMongo(); await TenantApplication.syncIndexes(); });
const completeInput = { organizationName: 'Groupe Phase Deux', organizationType: 'Exploitant hôtelier',
  professionalContact: { email: 'instruction@example.test' }, businessDeclaration: 'Activité à vérifier.',
  establishmentContext: { name: 'Premier établissement' } };
const pdf = Buffer.from('%PDF-1.4\npreuve');
const descriptor = (name = 'preuve.pdf') => ({ assetClass: 'PRIVATE_DOCUMENT', purpose: 'application', provider: 'cloudinary',
  publicId: `private/${name}-${sequence}`, resourceType: 'raw', deliveryType: 'authenticated', mimeType: 'application/pdf', originalFilename: name, size: pdf.length });
beforeEach(() => {
  storage.uploadPrivateAsset.mockImplementation(async (_buffer, options) => descriptor(options.filename));
  storage.readPrivateAsset.mockResolvedValue(pdf);
  storage.deletePrivateAsset.mockResolvedValue({ result: 'ok' });
});
afterEach(async () => { jest.clearAllMocks(); await clearFinancialMongo(); });
afterAll(stopFinancialMongo);

describe('TenantApplication Phase 2 — preuve RED applicant API', () => {
  test('API-01 — un propriétaire sans dossier obtient NO_APPLICATION', async () => {
    const owner = await makeUser();
    const response = await request(app).get('/api/platform-tenants/applications/me/status').set(bearer(owner));
    expect(response.status).toBe(200);
    expect(response.body.data.state).toBe('NO_APPLICATION');
  });

  test('API-02 — un propriétaire crée son DRAFT via API', async () => {
    const owner = await makeUser();
    const response = await request(app).post('/api/platform-tenants/applications').set(bearer(owner)).send({ organizationName: 'Groupe Phase Deux' });
    expect(response.status).toBe(201);
    expect(response.body.data.application.status).toBe('DRAFT');
  });

  test('API-03/06/07/08/09 — reprise canonique, identité serveur et allowlist PATCH', async () => {
    const owner = await makeUser(); const foreign = await makeUser();
    const first = await request(app).post('/api/platform-tenants/applications').set(bearer(owner)).send({ ...completeInput, applicant: foreign._id, status: 'APPROVED', provisionedTenant: new (require('mongoose').Types.ObjectId)() });
    const second = await request(app).post('/api/platform-tenants/applications').set(bearer(owner)).send({ organizationName: 'Doublon' });
    expect(second.status).toBe(200); expect(second.body.data.application.id).toBe(first.body.data.application.id);
    const patched = await request(app).patch(`/api/platform-tenants/applications/${first.body.data.application.id}`).set(bearer(owner)).send({ organizationName: 'Nom corrigé', status: 'APPROVED', applicant: foreign._id });
    expect(patched.body.data.application.organizationName).toBe('Nom corrigé');
    const stored = await TenantApplication.findById(first.body.data.application.id);
    expect(String(stored.applicant)).toBe(String(owner._id)); expect(stored.status).toBe('DRAFT'); expect(stored.provisionedTenant).toBeNull();
  });

  test('API-04/05 — rôle et ownership pré-tenant sont appliqués', async () => {
    const owner = await makeUser(); const other = await makeUser(); const client = await makeUser('Client');
    const created = await request(app).post('/api/platform-tenants/applications').set(bearer(owner)).send(completeInput);
    expect((await request(app).post('/api/platform-tenants/applications').set(bearer(client)).send(completeInput)).status).toBe(403);
    expect((await request(app).patch(`/api/platform-tenants/applications/${created.body.data.application.id}`).set(bearer(other)).send({ organizationName: 'Vol' })).status).toBe(404);
  });

  test('DOC-01/10/11/14 — upload privé, métadonnées sûres et suppression DRAFT', async () => {
    const owner = await makeUser();
    const created = await request(app).post('/api/platform-tenants/applications').set(bearer(owner)).send(completeInput);
    const id = created.body.data.application.id;
    const uploaded = await request(app).post(`/api/platform-tenants/applications/${id}/documents`).set(bearer(owner))
      .field('category', 'responsible_person_identity').attach('document', pdf, { filename: '../preuve.pdf', contentType: 'application/pdf' });
    expect(uploaded.status).toBe(201); expect(JSON.stringify(uploaded.body)).not.toContain('publicId'); expect(JSON.stringify(uploaded.body)).not.toContain('private/');
    const stored = await TenantApplication.findById(id).select('+attachmentManifest.privateAsset +attachmentManifest.privateAsset.deliveryType');
    expect(stored.attachmentManifest).toHaveLength(1); expect(stored.attachmentManifest[0].privateAsset.deliveryType).toBe('authenticated');
    const deleted = await request(app).delete(`/api/platform-tenants/applications/${id}/documents/${uploaded.body.data.document.id}`).set(bearer(owner));
    expect(deleted.status).toBe(204); expect(storage.deletePrivateAsset).toHaveBeenCalledTimes(1);
  });

  test('DOC-02/03/04/05 — chaîne application → applicant → attachment bloque les IDOR', async () => {
    const owner = await makeUser(); const other = await makeUser();
    const a = await request(app).post('/api/platform-tenants/applications').set(bearer(owner)).send(completeInput);
    const b = await request(app).post('/api/platform-tenants/applications').set(bearer(other)).send({ ...completeInput, organizationName: 'Autre Groupe' });
    const up = await request(app).post(`/api/platform-tenants/applications/${a.body.data.application.id}/documents`).set(bearer(owner)).field('category', 'responsible_person_identity').attach('document', pdf, { filename: 'preuve.pdf', contentType: 'application/pdf' });
    const documentId = up.body.data.document.id;
    expect((await request(app).get(`/api/platform-tenants/applications/${a.body.data.application.id}/documents/${documentId}`).set(bearer(other))).status).toBe(404);
    expect((await request(app).get(`/api/platform-tenants/applications/${b.body.data.application.id}/documents/${documentId}`).set(bearer(other))).status).toBe(404);
    expect(storage.readPrivateAsset).not.toHaveBeenCalled();
  });

  test('DOC-06/07/12/13 — catégorie, contenu MIME et rollback sont fail-closed', async () => {
    const owner = await makeUser(); const created = await request(app).post('/api/platform-tenants/applications').set(bearer(owner)).send(completeInput); const id = created.body.data.application.id;
    expect((await request(app).post(`/api/platform-tenants/applications/${id}/documents`).set(bearer(owner)).field('category', 'autre').attach('document', pdf, { filename: 'x.pdf', contentType: 'application/pdf' })).status).toBe(422);
    expect((await request(app).post(`/api/platform-tenants/applications/${id}/documents`).set(bearer(owner)).field('category', 'responsible_person_identity').attach('document', Buffer.from('not pdf'), { filename: 'x.pdf', contentType: 'application/pdf' })).status).toBe(415);
    storage.uploadPrivateAsset.mockRejectedValueOnce(new Error('storage down'));
    expect((await request(app).post(`/api/platform-tenants/applications/${id}/documents`).set(bearer(owner)).field('category', 'responsible_person_identity').attach('document', pdf, { filename: 'x.pdf', contentType: 'application/pdf' })).status).toBe(500);
    expect((await TenantApplication.findById(id)).attachmentManifest).toHaveLength(0);
  });

  test('SUB/STATUS/SEC — dossier complet soumis, immuable, sans provisioning', async () => {
    const owner = await makeUser(); const created = await request(app).post('/api/platform-tenants/applications').set(bearer(owner)).send(completeInput); const id = created.body.data.application.id;
    for (const category of ['responsible_person_identity', 'professional_business_existence', 'establishment_authority', 'establishment_context']) {
      expect((await request(app).post(`/api/platform-tenants/applications/${id}/documents`).set(bearer(owner)).field('category', category).attach('document', pdf, { filename: `${category}.pdf`, contentType: 'application/pdf' })).status).toBe(201);
    }
    const submitted = await request(app).post(`/api/platform-tenants/applications/${id}/submit`).set(bearer(owner));
    expect(submitted.status).toBe(200); expect(submitted.body.data.application.status).toBe('SUBMITTED');
    expect((await request(app).get('/api/platform-tenants/applications/me/status').set(bearer(owner))).body.data.state).toBe('PENDING_REVIEW');
    expect((await request(app).patch(`/api/platform-tenants/applications/${id}`).set(bearer(owner)).send({ organizationName: 'Interdit' })).status).toBe(409);
    expect((await request(app).delete(`/api/platform-tenants/applications/${id}/documents/${submitted.body.data.application.documents[0].id}`).set(bearer(owner))).status).toBe(409);
    expect(await PlatformTenant.countDocuments()).toBe(0); expect(await OrgUnit.countDocuments()).toBe(0);
    expect(await OrgMembership.countDocuments()).toBe(0); expect(await PlatformTenantSubscription.countDocuments()).toBe(0);
  });

  test('SUB-02/STATUS-08/SEC-01 — incomplet bloqué, Client forbidden, ancien bypass absent', async () => {
    const owner = await makeUser(); const client = await makeUser('Client');
    const created = await request(app).post('/api/platform-tenants/applications').set(bearer(owner)).send({ organizationName: 'Incomplet' });
    expect((await request(app).post(`/api/platform-tenants/applications/${created.body.data.application.id}/submit`).set(bearer(owner))).status).toBe(422);
    expect((await request(app).get('/api/platform-tenants/applications/me/status').set(bearer(client))).body.data.state).toBe('FORBIDDEN');
    expect([403, 404, 405]).toContain((await request(app).post('/api/platform-tenants/onboarding/first-organization').set(bearer(owner))).status);
  });

  test('DOC-09/C-02 — limite par catégorie et uploads parallèles sans perte', async () => {
    const owner = await makeUser(); const created = await request(app).post('/api/platform-tenants/applications').set(bearer(owner)).send(completeInput); const id = created.body.data.application.id;
    const upload = (name) => request(app).post(`/api/platform-tenants/applications/${id}/documents`).set(bearer(owner))
      .field('category', 'responsible_person_identity').attach('document', pdf, { filename: name, contentType: 'application/pdf' });
    const parallel = await Promise.all([upload('a.pdf'), upload('b.pdf')]);
    expect(parallel.map((result) => result.status)).toEqual([201, 201]);
    expect((await upload('c.pdf')).status).toBe(201);
    expect((await upload('d.pdf')).status).toBe(422);
    expect((await TenantApplication.findById(id)).attachmentManifest).toHaveLength(3);
  });

  test('C-03/C-04 — soumission concurrente et course upload restent cohérentes', async () => {
    const owner = await makeUser(); const created = await request(app).post('/api/platform-tenants/applications').set(bearer(owner)).send(completeInput); const id = created.body.data.application.id;
    for (const category of ['responsible_person_identity', 'professional_business_existence', 'establishment_authority']) {
      await request(app).post(`/api/platform-tenants/applications/${id}/documents`).set(bearer(owner)).field('category', category).attach('document', pdf, { filename: `${category}.pdf`, contentType: 'application/pdf' });
    }
    const [uploadResult, submitResult] = await Promise.all([
      request(app).post(`/api/platform-tenants/applications/${id}/documents`).set(bearer(owner)).field('category', 'establishment_context').attach('document', pdf, { filename: 'context.pdf', contentType: 'application/pdf' }),
      request(app).post(`/api/platform-tenants/applications/${id}/submit`).set(bearer(owner)),
    ]);
    expect([201, 409]).toContain(uploadResult.status);
    expect([200, 422]).toContain(submitResult.status);
    const stored = await TenantApplication.findById(id);
    if (stored.status === 'SUBMITTED') expect(stored.attachmentManifest).toHaveLength(4);
    expect(stored.history.filter((entry) => entry.to === 'SUBMITTED')).toHaveLength(stored.status === 'SUBMITTED' ? 1 : 0);
  });
});
