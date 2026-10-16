// F-U1.J — sécurité documentaire KYC (vrai replica set, documents fictifs).
// Le prestataire de stockage (Cloudinary) est remplacé par un stockage mémoire
// pilotable (pannes, messages d'erreur sensibles) ; aucune donnée Mongo simulée.
process.env.FINANCIAL_BENEFICIARY_FINGERPRINT_KEY = 'f-u1-test-fingerprint-key-0123456789abcdef';
process.env.HUMAN_IDENTITY_FINGERPRINT_KEY = 'f-u1j-test-identity-key-0123456789abcdef';

const mockStore = new Map();
const mockBehaviour = { uploadError: null, readError: null, deleteError: null, deleteResult: 'ok' };
const mockCalls = { upload: [], read: [], delete: [] };
jest.mock('../services/storage/secureStorageService', () => ({
  uploadPrivateAsset: jest.fn(async (buffer, options) => {
    mockCalls.upload.push(options);
    if (mockBehaviour.uploadError) throw mockBehaviour.uploadError;
    mockStore.set(options.publicId, buffer);
    return { assetClass: 'PRIVATE_DOCUMENT', purpose: options.purpose, provider: 'cloudinary', publicId: options.publicId, resourceType: 'image', deliveryType: 'authenticated', version: '1', format: 'png', mimeType: options.mimeType, originalFilename: 'x', size: buffer.length };
  }),
  readPrivateAsset: jest.fn(async (asset) => {
    mockCalls.read.push(asset);
    if (mockBehaviour.readError) throw mockBehaviour.readError;
    if (!asset?.publicId) throw new Error('PRIVATE_ASSET_REFERENCE_INVALID');
    return mockStore.get(asset.publicId);
  }),
  deletePrivateAsset: jest.fn(async (asset) => {
    mockCalls.delete.push(asset);
    if (mockBehaviour.deleteError) throw mockBehaviour.deleteError;
    mockStore.delete(asset.publicId);
    return { result: mockBehaviour.deleteResult };
  }),
}));

const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const { startFinancialMongo, clearFinancialMongo, stopFinancialMongo } = require('./helpers/financialMongoEnvironment');
const { createTenantFixture, createTenantUser, tenantActor } = require('./helpers/tenantAwareFixture');
const { activeGrantFixture } = require('./helpers/contractualGrantFixture');
const { fakePng, fakeJpeg, fakePdf, pngFile, enableKycStorageForTests } = require('./helpers/kycFixtures');
const User = require('../models/User');
const PlatformOperator = require('../models/PlatformOperator');
const KycCase = require('../models/FinancialIdentityKycCase');
const KycAccessLog = require('../models/KycAccessLog');
const KycDocumentDisposal = require('../models/KycDocumentDisposal');
const HumanIdentityAttestation = require('../models/HumanIdentityAttestation');
const ContractualFinanceGrant = require('../models/ContractualFinanceGrant');
const ContractualGrantBootstrap = require('../models/ContractualGrantBootstrap');
const FinancialPayment = require('../models/FinancialPayment');
const FinancialRefund = require('../models/FinancialRefund');
const { PLATFORM_WIDE_CONTEXT_SOURCE } = require('../constants/platformOperatorConstants');
const { KYC_PRIVACY_NOTICE, KYC_PROCEDURE } = require('../constants/financialKycConstants');
const kyc = require('../services/finance/contractual/financialKycService');
const retention = require('../services/finance/contractual/kycRetentionService');
const storage = require('../services/storage/kycDocumentStorageService');
const { registerKycDocumentScanner } = require('../services/storage/kycDocumentScanner');
const grants = require('../services/finance/contractual/contractualFinanceGrantService');
const { CONTRACTUAL_CAPABILITIES: CAP } = require('../services/finance/contractual/contractualFinanceAuthorizationService');
const { errorHandler } = require('../middleware/errorMiddleware');
const routes = require('../routes/financialKycRoutes');

const app = express(); app.use(express.json()); app.use('/kyc', routes); app.use(errorHandler);
jest.setTimeout(180000);
const oid = () => new mongoose.Types.ObjectId();
const DAY = 86400000;
let seq = 0;
let A; let B; let preparerA; let subjectA; let preparerB; let reviewer; let bareOperator;

beforeAll(async () => {
  await startFinancialMongo();
  await Promise.all([KycCase, KycAccessLog, KycDocumentDisposal, HumanIdentityAttestation, ContractualFinanceGrant, ContractualGrantBootstrap].map((model) => model.syncIndexes()));
});
afterAll(stopFinancialMongo);

async function member(fixture, businessRole) {
  const { user } = await createTenantUser({ ...fixture, businessRole, overrides: { role: 'Client' } });
  return { user, actor: tenantActor(user, fixture.tenant) };
}
async function plainUser(role = 'Proprietaire') {
  seq += 1;
  return User.create({ name: `U ${seq}`, email: `fu1j-${Date.now()}-${seq}@example.test`, password: 'Password123!', passwordConfirm: 'Password123!', role, isEmailVerified: true });
}
async function operator(capabilities, { kycGrant = false } = {}) {
  const user = await plainUser('Client');
  await PlatformOperator.create({ user: user._id, status: 'active', capabilities, grantedBy: oid(), grantReason: 'Test F-U1.J' });
  const grant = kycGrant ? await activeGrantFixture({ user, capability: CAP.KYC_ATTEST }) : null;
  await HumanIdentityAttestation.create({ user: user._id, identityKey: `op-${user._id}`, documentKind: 'PASSPORT', source: 'BOOTSTRAP_OFFLINE', evidenceRef: 'fixture', verifiedBy: oid(), verifiedAt: new Date() });
  return { user, grant, actor: { _id: user._id, tenantContextSource: PLATFORM_WIDE_CONTEXT_SOURCE } };
}
const self = (user) => ({ _id: user._id });
const token = (user) => `Bearer ${jwt.sign({ id: user._id, tokenVersion: 0 }, process.env.JWT_SECRET)}`;

beforeEach(async () => {
  await clearFinancialMongo();
  mockStore.clear(); Object.assign(mockBehaviour, { uploadError: null, readError: null, deleteError: null, deleteResult: 'ok' });
  Object.values(mockCalls).forEach((list) => list.splice(0));
  enableKycStorageForTests();
  process.env.KYC_PROCEDURE_VALIDATED_VERSION = KYC_PROCEDURE.version;
  ['KYC_RETENTION_DURATION_DAYS', 'KYC_RETENTION_DECISION_REFERENCE', 'KYC_PURGE_ENABLED', 'CONTRACTUAL_GRANT_BOOTSTRAP_ENABLED'].forEach((key) => delete process.env[key]);
  A = await createTenantFixture({ label: 'FU1J A' }); B = await createTenantFixture({ label: 'FU1J B' });
  preparerA = await member(A, 'Secretaire'); subjectA = await member(A, 'Secretaire'); preparerB = await member(B, 'Admin');
  await activeGrantFixture({ user: preparerA.user, capability: CAP.KYC_PREPARE, tenant: A.tenant });
  await activeGrantFixture({ user: preparerB.user, capability: CAP.KYC_PREPARE, tenant: B.tenant });
  reviewer = await operator(['platform.users.manage'], { kycGrant: true });
  bareOperator = await operator(['platform.users.manage', 'platform.finance.manage', 'platform.operators.manage']);
});

const fill = (actor, caseId, number = 'CG24681357') => kyc.updateCase({
  actor, caseId, personal: { lastName: 'Fictif', firstNames: 'Personne' },
  identityDocument: { kind: 'NATIONAL_ID', issuingCountry: 'CG', expiresAt: new Date(Date.now() + 365 * DAY), number },
});
async function preparedCase() {
  const created = await kyc.createCase({ actor: preparerA.actor, subjectUserId: subjectA.user._id, purpose: 'SENSITIVE_FINANCIAL_GRANT' });
  await fill(preparerA.actor, created._id);
  await kyc.addDocument({ actor: preparerA.actor, caseId: created._id, slot: 'ID_FRONT', file: pngFile('front') });
  const view = await kyc.addDocument({ actor: preparerA.actor, caseId: created._id, slot: 'ID_BACK', file: pngFile('back') });
  return { caseId: created._id, docId: view.documents[0].docId, view };
}
async function submittedCase() {
  const prepared = await preparedCase();
  await kyc.acknowledgePrivacyNotice({ actor: self(subjectA.user), caseId: prepared.caseId, version: KYC_PRIVACY_NOTICE.version });
  await kyc.submitCase({ actor: preparerA.actor, caseId: prepared.caseId });
  return prepared;
}
const readAs = (actor, caseId, docId) => kyc.readDocument({ actor, caseId, docId });

describe('F-U1.J — ouverture du stockage (1/2)', () => {
  test('fermé par défaut ; chaque prérequis manquant est un motif, jamais une valeur', async () => {
    delete process.env.KYC_DOCUMENT_STORAGE_ENABLED;
    expect(storage.configurationStatus()).toMatchObject({ enabled: false, reasons: expect.arrayContaining(['STORAGE_NOT_APPROVED']) });
    enableKycStorageForTests();
    registerKycDocumentScanner(null);
    expect(storage.configurationStatus().reasons).toEqual(['MALWARE_SCANNER_UNAVAILABLE']);
    enableKycStorageForTests();
    const secret = process.env.CLOUDINARY_API_SECRET;
    delete process.env.CLOUDINARY_API_SECRET;
    const status = storage.configurationStatus();
    expect(status.reasons).toEqual(['PROVIDER_CONFIGURATION_INCOMPLETE']);
    expect(JSON.stringify(status)).not.toContain(process.env.CLOUDINARY_API_KEY);
    process.env.CLOUDINARY_API_SECRET = secret;
    const key = process.env.HUMAN_IDENTITY_FINGERPRINT_KEY;
    process.env.HUMAN_IDENTITY_FINGERPRINT_KEY = 'trop-courte';
    expect(storage.configurationStatus().reasons).toEqual(['IDENTITY_FINGERPRINT_KEY_MISSING']);
    process.env.HUMAN_IDENTITY_FINGERPRINT_KEY = key;
    delete process.env.KYC_DOCUMENT_STORAGE_ENABLED;
    const created = await kyc.createCase({ actor: self(subjectA.user), purpose: 'OWNER_FINANCIAL_OPERATIONS' });
    await fill(self(subjectA.user), created._id);
    await expect(kyc.addDocument({ actor: self(subjectA.user), caseId: created._id, slot: 'ID_FRONT', file: pngFile('x') })).rejects.toMatchObject({ code: 'KYC_DOCUMENT_STORAGE_NOT_APPROVED', statusCode: 503 });
    expect(mockCalls.upload).toHaveLength(0);
  });

  test('analyse : fichier infecté refusé, analyseur en panne → indisponible, jamais stocké', async () => {
    const created = await kyc.createCase({ actor: self(subjectA.user), purpose: 'OWNER_FINANCIAL_OPERATIONS' });
    await fill(self(subjectA.user), created._id);
    registerKycDocumentScanner({ scan: async () => ({ verdict: 'infected' }) });
    await expect(kyc.addDocument({ actor: self(subjectA.user), caseId: created._id, slot: 'ID_FRONT', file: pngFile('v') })).rejects.toMatchObject({ code: 'KYC_DOCUMENT_REJECTED_BY_SCAN' });
    registerKycDocumentScanner({ scan: async () => { throw new Error('moteur hors ligne'); } });
    await expect(kyc.addDocument({ actor: self(subjectA.user), caseId: created._id, slot: 'ID_FRONT', file: pngFile('w') })).rejects.toMatchObject({ code: 'KYC_DOCUMENT_SCAN_UNAVAILABLE', statusCode: 503 });
    expect(mockCalls.upload).toHaveLength(0);
  });
});

describe('F-U1.J — contrôle d’accès aux pièces (3 à 8)', () => {
  test('personne concernée, préparateur et vérificateur habilité autorisés ; lecture côté serveur uniquement', async () => {
    const { caseId, docId } = await submittedCase();
    expect((await readAs(self(subjectA.user), caseId, docId)).buffer.length).toBeGreaterThan(0);
    expect((await readAs(preparerA.actor, caseId, docId)).buffer.length).toBeGreaterThan(0);
    expect((await readAs(reviewer.actor, caseId, docId)).buffer.length).toBeGreaterThan(0);
    expect(mockCalls.read.every((asset) => asset.publicId && asset.deliveryType === 'authenticated')).toBe(true);
  });

  test('autre tenant, opérateur non habilité, Admin d’organisation : refus sans révéler l’existence', async () => {
    const { caseId, docId } = await submittedCase();
    const adminA = await member(A, 'Admin');
    for (const actor of [preparerB.actor, bareOperator.actor, adminA.actor, self(await plainUser())]) {
      await expect(readAs(actor, caseId, docId)).rejects.toMatchObject({ code: 'KYC_CASE_NOT_FOUND', statusCode: 404 });
    }
    await expect(readAs(preparerB.actor, oid(), docId)).rejects.toMatchObject({ code: 'KYC_CASE_NOT_FOUND', statusCode: 404 });
  });

  test.each(['suspended', 'revoked', 'expired'])('habilitation du vérificateur %s : accès refusé immédiatement', async (state) => {
    const { caseId, docId } = await submittedCase();
    await readAs(reviewer.actor, caseId, docId);
    const update = state === 'expired' ? { validUntil: new Date(Date.now() - 1000) } : { status: state };
    await ContractualFinanceGrant.updateOne({ _id: reviewer.grant._id }, update);
    await expect(readAs(reviewer.actor, caseId, docId)).rejects.toMatchObject({ code: 'KYC_CASE_NOT_FOUND' });
  });

  test('préparateur : accès retiré avec son habilitation, et après la décision (minimisation)', async () => {
    const { caseId, docId } = await submittedCase();
    await kyc.takeCase({ actor: reviewer.actor, caseId });
    const view = await kyc.getCaseForReview({ actor: reviewer.actor, caseId });
    for (const doc of view.documents) await kyc.recordDocumentCheck({ actor: reviewer.actor, caseId, docId: doc.docId, result: 'verified' });
    await kyc.approveCase({ actor: reviewer.actor, caseId, reason: 'Conforme' });
    await expect(readAs(preparerA.actor, caseId, docId)).rejects.toMatchObject({ code: 'KYC_CASE_NOT_FOUND' });
    expect((await kyc.listMyCases({ actor: preparerA.actor })).some((item) => String(item.id) === String(caseId))).toBe(false);
    const other = await kyc.createCase({ actor: preparerA.actor, subjectUserId: (await member(A, 'Secretaire')).user._id, purpose: 'SENSITIVE_FINANCIAL_GRANT' });
    await ContractualFinanceGrant.updateMany({ user: preparerA.user._id }, { status: 'revoked' });
    await expect(kyc.getCase({ actor: preparerA.actor, caseId: other._id })).rejects.toMatchObject({ code: 'KYC_CASE_NOT_FOUND' });
  });

  test('dossier rédigé par le membre lui-même : l’organisation n’y a pas accès', async () => {
    const own = await kyc.createCase({ actor: subjectA.actor, purpose: 'SENSITIVE_FINANCIAL_GRANT' });
    expect(own.preparedByTenant).toBe(false);
    await expect(kyc.getCase({ actor: preparerA.actor, caseId: own._id })).rejects.toMatchObject({ code: 'KYC_CASE_NOT_FOUND' });
  });

  test('8/17. références falsifiées et anciennes pièces remplacées : introuvables', async () => {
    const { caseId, docId } = await preparedCase();
    await expect(readAs(self(subjectA.user), caseId, 'f0f0f0f0-0000-4000-8000-000000000000')).rejects.toMatchObject({ code: 'KYC_DOCUMENT_NOT_FOUND' });
    await expect(readAs(self(subjectA.user), caseId, { $ne: null })).rejects.toMatchObject({ code: 'KYC_DOCUMENT_NOT_FOUND' });
    await kyc.addDocument({ actor: self(subjectA.user), caseId, slot: 'ID_FRONT', file: pngFile('remplacement') });
    await expect(readAs(self(subjectA.user), caseId, docId)).rejects.toMatchObject({ code: 'KYC_DOCUMENT_NOT_FOUND' });
    await expect(readAs(preparerA.actor, caseId, docId)).rejects.toMatchObject({ code: 'KYC_DOCUMENT_NOT_FOUND' });
  });
});

describe('F-U1.J — livraison et fuites (9/10/11/22)', () => {
  test('aucune URL ni référence prestataire exposée ; type authenticated imposé', async () => {
    const { caseId, view } = await preparedCase();
    expect(mockCalls.upload.every((options) => options.purpose === 'identity' && /^altitude-vision\/private\/kyc\//.test(options.publicId) && options.filename === 'ID_FRONT' || options.filename === 'ID_BACK')).toBe(true);
    const text = JSON.stringify(view) + JSON.stringify(await kyc.getCase({ actor: self(subjectA.user), caseId }));
    ['cloudinary', 'publicId', 'altitude-vision/private', 'http', 'jean-dupont'].forEach((needle) => expect(text).not.toContain(needle));
  });

  test('erreur prestataire contenant public_id / chaîne signée : réponse et journaux neutralisés', async () => {
    const { caseId, docId } = await preparedCase();
    const leaky = Object.assign(new Error("Invalid Signature 9f8e7d. String to sign - 'public_id=altitude-vision/private/kyc/SECRET-ID&timestamp=1'"), { http_code: 401 });
    const logged = [];
    const spies = ['log', 'error', 'warn'].map((method) => jest.spyOn(console, method).mockImplementation((...args) => logged.push(args.join(' '))));
    mockBehaviour.readError = leaky;
    const response = await request(app).get(`/kyc/cases/${caseId}/documents/${docId}`).set('Authorization', token(subjectA.user));
    mockBehaviour.uploadError = leaky;
    await expect(kyc.addDocument({ actor: self(subjectA.user), caseId, slot: 'ID_FRONT', file: pngFile('fail') })).rejects.toMatchObject({ code: 'KYC_DOCUMENT_STORAGE_UNAVAILABLE', statusCode: 502 });
    spies.forEach((spy) => spy.mockRestore());
    expect(response.status).toBe(502);
    expect(response.body).toMatchObject({ code: 'KYC_DOCUMENT_STORAGE_UNAVAILABLE' });
    const everything = JSON.stringify(response.body) + logged.join('\n');
    ['SECRET-ID', 'String to sign', 'altitude-vision/private', '24681357', 'Fictif'].forEach((needle) => expect(everything).not.toContain(needle));
  });

  test('en-têtes : aucune mise en cache, document isolé (CSP sandbox, pas d’encadrement, pas de Referer)', async () => {
    const { caseId, docId } = await preparedCase();
    const anonymous = await request(app).get(`/kyc/cases/${caseId}`);
    expect(anonymous.status).toBe(401);
    expect(anonymous.headers['cache-control']).toContain('no-store');
    const json = await request(app).get(`/kyc/cases/${caseId}`).set('Authorization', token(subjectA.user));
    expect(json.headers).toMatchObject({ 'cache-control': 'private, no-store, max-age=0', pragma: 'no-cache', expires: '0', 'referrer-policy': 'no-referrer' });
    const file = await request(app).get(`/kyc/cases/${caseId}/documents/${docId}`).set('Authorization', token(subjectA.user));
    expect(file.status).toBe(200);
    expect(file.headers['content-security-policy']).toContain('sandbox');
    expect(file.headers['x-frame-options']).toBe('DENY');
    expect(file.headers['cache-control']).toBe('private, no-store, max-age=0');
    expect(file.headers['content-type']).toBe('image/png');
  });
});

describe('F-U1.J — validation des fichiers (12 à 16)', () => {
  let caseId;
  beforeEach(async () => {
    const created = await kyc.createCase({ actor: self(subjectA.user), purpose: 'OWNER_FINANCIAL_OPERATIONS' });
    await fill(self(subjectA.user), created._id);
    caseId = created._id;
  });
  const put = (buffer, mimetype, slot = 'ID_FRONT') => kyc.addDocument({ actor: self(subjectA.user), caseId, slot, file: { buffer, mimetype, originalname: 'x' } });

  test.each([
    ['PNG polyglotte (archive ajoutée)', () => Buffer.concat([fakePng('p'), Buffer.from('PK\u0003\u0004zipdata')]), 'image/png', 'KYC_DOCUMENT_TRAILING_DATA'],
    ['JPEG suivi d’un script', () => Buffer.concat([fakeJpeg('j'), Buffer.from('<script>alert(1)</script>')]), 'image/jpeg', 'KYC_DOCUMENT_TRAILING_DATA'],
    ['PNG tronqué', () => fakePng('t').subarray(0, 40), 'image/png', 'KYC_DOCUMENT_MALFORMED'],
    ['PNG sans IHDR', () => Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), Buffer.alloc(40)]), 'image/png', 'KYC_DOCUMENT_MALFORMED'],
    ['bombe de décompression', () => fakePng('b', { width: 50000, height: 50000 }), 'image/png', 'KYC_DOCUMENT_DIMENSIONS_INVALID'],
    ['JPEG sans données', () => Buffer.from([0xff, 0xd8, 0xff, 0xd9]), 'image/jpeg', 'KYC_DOCUMENT_MALFORMED'],
    ['PDF avec JavaScript', () => fakePdf('1 0 obj << /OpenAction 2 0 R >> endobj 2 0 obj << /S /JavaScript /JS (app.alert(1)) >> endobj'), 'application/pdf', 'KYC_DOCUMENT_ACTIVE_CONTENT'],
    ['PDF avec fichier incorporé', () => fakePdf('1 0 obj << /EmbeddedFiles 2 0 R >> endobj'), 'application/pdf', 'KYC_DOCUMENT_ACTIVE_CONTENT'],
    ['PDF chiffré', () => fakePdf('trailer << /Encrypt 3 0 R >>'), 'application/pdf', 'KYC_DOCUMENT_ACTIVE_CONTENT'],
    ['PDF suivi de données', () => Buffer.concat([fakePdf(), Buffer.from('MZ-executable')]), 'application/pdf', 'KYC_DOCUMENT_TRAILING_DATA'],
    ['type annoncé mensonger', () => fakePdf(), 'image/png', 'KYC_DOCUMENT_CONTENT_INVALID'],
  ])('%s → refusé', async (_label, build, mimetype, code) => {
    await expect(put(build(), mimetype)).rejects.toMatchObject({ code });
    expect(mockCalls.upload).toHaveLength(0);
  });

  test('fichiers sains acceptés (PNG, JPEG, PDF sans élément actif)', async () => {
    await expect(put(fakePng('ok'), 'image/png')).resolves.toBeDefined();
    await expect(put(fakeJpeg('ok'), 'image/jpeg', 'ID_BACK')).resolves.toBeDefined();
    await kyc.updateCase({ actor: self(subjectA.user), caseId, identityDocument: { kind: 'PASSPORT' } });
    await expect(put(fakePdf(), 'application/pdf', 'PASSPORT_DATA_PAGE')).resolves.toBeDefined();
  });

  test('14. trop volumineux (service et HTTP)', async () => {
    await expect(put(Buffer.concat([fakePng('big'), Buffer.alloc(11 * 1024 * 1024)]), 'image/png')).rejects.toMatchObject({ code: 'KYC_DOCUMENT_TOO_LARGE' });
    const response = await request(app).post(`/kyc/cases/${caseId}/documents`).set('Authorization', token(subjectA.user)).field('slot', 'ID_FRONT').attach('file', Buffer.alloc(10 * 1024 * 1024 + 1, 1), { filename: 'big.png', contentType: 'image/png' });
    expect(response.status).toBe(413);
  });

  test('15/16. doublon refusé ; remplacement sûr sans perte des références voisines', async () => {
    const same = fakePng('doublon');
    await put(same, 'image/png', 'ID_FRONT');
    await expect(put(same, 'image/png', 'ID_BACK')).rejects.toMatchObject({ code: 'KYC_DOCUMENT_DUPLICATE' });
    await expect(put(same, 'image/png', 'ID_FRONT')).rejects.toMatchObject({ code: 'KYC_DOCUMENT_DUPLICATE' });
    await put(fakePng('verso'), 'image/png', 'ID_BACK');
    await put(fakePng('recto-2'), 'image/png', 'ID_FRONT');
    const raw = await KycCase.collection.findOne({ _id: caseId });
    expect(raw.documents).toHaveLength(3);
    expect(raw.documents.every((doc) => doc.asset?.publicId && doc.asset?.resourceType)).toBe(true);
    expect(raw.documents.filter((doc) => doc.status === 'current').map((doc) => doc.slot).sort()).toEqual(['ID_BACK', 'ID_FRONT']);
  });

  test('téléversements simultanés sur un même emplacement : un seul conservé, l’autre objet supprimé', async () => {
    const results = await Promise.allSettled([put(fakePng('c1'), 'image/png'), put(fakePng('c2'), 'image/png')]);
    expect(results.filter((r) => r.status === 'fulfilled').length).toBeGreaterThanOrEqual(1);
    const raw = await KycCase.collection.findOne({ _id: caseId });
    const stored = raw.documents.map((doc) => doc.asset.publicId);
    expect(mockStore.size).toBe(stored.length);
    if (results.some((r) => r.status === 'rejected')) expect(mockCalls.delete).toHaveLength(1);
  });
});

describe('F-U1.J — conservation et purge (18/19/20)', () => {
  async function closedCase({ closedDaysAgo = 40 } = {}) {
    const { caseId } = await preparedCase();
    await kyc.cancelCase({ actor: preparerA.actor, caseId, reason: 'Test' });
    await KycCase.updateOne({ _id: caseId }, { $set: { 'retention.closedAt': new Date(Date.now() - closedDaysAgo * DAY) } });
    return caseId;
  }
  const activatePolicy = () => { process.env.KYC_RETENTION_DURATION_DAYS = '30'; process.env.KYC_RETENTION_DECISION_REFERENCE = 'Décision fictive de test'; };

  test('sans politique validée : rien d’éligible ; simulation par défaut ; exécution réelle verrouillée', async () => {
    await closedCase();
    expect((await retention.planPurge()).policy.status).toBe('UNCONFIGURED');
    expect((await retention.planPurge()).eligible).toEqual([]);
    activatePolicy();
    const dry = await retention.executePurge();
    expect(dry.mode).toBe('dry-run');
    expect(dry.plan.eligible).toHaveLength(1);
    expect(mockCalls.delete).toHaveLength(0);
    await expect(retention.executePurge({ apply: true })).rejects.toMatchObject({ code: 'KYC_PURGE_DISABLED' });
  });

  test('suppression avec preuve, puis retrait des références ; dossier récent et gel légal exclus', async () => {
    activatePolicy(); process.env.KYC_PURGE_ENABLED = 'true';
    const oldCase = await closedCase();
    const recent = await closedCase({ closedDaysAgo: 5 });
    const held = await closedCase();
    await retention.setLegalHold({ actor: reviewer.actor, caseId: held, active: true, reason: 'Contentieux fictif' });
    await expect(retention.setLegalHold({ actor: bareOperator.actor, caseId: held, active: false, reason: 'x' })).rejects.toMatchObject({ code: 'FINANCIAL_UNAUTHORIZED' });
    const result = await retention.executePurge({ apply: true });
    expect(result.plan.excluded).toEqual([expect.objectContaining({ reason: 'LEGAL_HOLD' })]);
    expect(result.results.every((r) => r.status === 'done')).toBe(true);
    const disposals = await KycDocumentDisposal.find({ kycCase: oldCase }).lean();
    expect(disposals).toHaveLength(2);
    expect(disposals.every((d) => d.status === 'done' && d.proof.providerResult === 'ok' && d.proof.cdnInvalidationRequested && !d.asset)).toBe(true);
    const raw = await KycCase.collection.findOne({ _id: oldCase });
    expect(raw.documents.every((doc) => !doc.asset && doc.purgedAt)).toBe(true);
    for (const id of [recent, held]) expect((await KycCase.collection.findOne({ _id: id })).documents.every((doc) => doc.asset?.publicId)).toBe(true);
    await expect(readAs(self(subjectA.user), oldCase, raw.documents[0].docId)).rejects.toMatchObject({ code: 'KYC_DOCUMENT_NOT_FOUND' });
  });

  test('échec de suppression : référence conservée, échec tracé ; reprise réussie ensuite', async () => {
    activatePolicy(); process.env.KYC_PURGE_ENABLED = 'true';
    const caseId = await closedCase();
    mockBehaviour.deleteError = Object.assign(new Error('timeout public_id=altitude-vision/private/kyc/x'), { http_code: 500 });
    const first = await retention.executePurge({ apply: true });
    expect(first.results.every((r) => r.status === 'failed')).toBe(true);
    let disposals = await KycDocumentDisposal.find({ kycCase: caseId }).lean();
    expect(disposals.every((d) => d.status === 'failed' && d.attempts === 1 && d.lastErrorCode === 'KYC_DOCUMENT_STORAGE_UNAVAILABLE')).toBe(true);
    expect((await KycCase.collection.findOne({ _id: caseId })).documents.every((doc) => doc.asset?.publicId)).toBe(true);
    mockBehaviour.deleteError = null;
    mockBehaviour.deleteResult = 'error';
    await retention.executePurge({ apply: true });
    disposals = await KycDocumentDisposal.find({ kycCase: caseId }).lean();
    expect(disposals.every((d) => d.status === 'failed' && d.lastErrorCode === 'PROVIDER_error')).toBe(true);
    mockBehaviour.deleteResult = 'ok';
    await retention.executePurge({ apply: true });
    disposals = await KycDocumentDisposal.find({ kycCase: caseId }).lean();
    expect(disposals.every((d) => d.status === 'done' && d.attempts === 3)).toBe(true);
  });

  test('objet orphelin : suppression immédiate tentée, sinon tracé et repris', async () => {
    const { caseId } = await preparedCase();
    mockBehaviour.deleteError = new Error('panne');
    expect(await retention.disposeOrphan({ kycCase: caseId, asset: { assetClass: 'PRIVATE_DOCUMENT', purpose: 'identity', provider: 'cloudinary', publicId: 'altitude-vision/private/kyc/orphan', resourceType: 'image', deliveryType: 'authenticated' } })).toEqual({ status: 'pending' });
    mockBehaviour.deleteError = null; process.env.KYC_PURGE_ENABLED = 'true';
    await retention.executePurge({ apply: true });
    expect((await KycDocumentDisposal.findOne({ reason: 'ORPHAN_UPLOAD' }).lean()).status).toBe('done');
  });

  test('demande d’effacement : enregistrée pour examen juridique, aucune suppression', async () => {
    const { caseId } = await preparedCase();
    expect(await retention.requestErasure({ actor: self(subjectA.user), caseId, reason: 'Je retire ma demande' })).toEqual({ status: 'pending_legal_review' });
    await expect(retention.requestErasure({ actor: preparerA.actor, caseId, reason: 'x' })).rejects.toMatchObject({ code: 'KYC_CASE_NOT_FOUND' });
    expect(mockCalls.delete).toHaveLength(0);
  });
});

describe('F-U1.J — audit, bootstrap, argent (21/27/28)', () => {
  test('consultations journalisées ; un refus ne produit aucune trace d’accès', async () => {
    const { caseId, docId } = await submittedCase();
    await readAs(reviewer.actor, caseId, docId);
    await readAs(bareOperator.actor, caseId, docId).catch(() => {});
    const logs = await KycAccessLog.find({ kycCase: caseId }).lean();
    expect(logs).toEqual([expect.objectContaining({ accessorRole: 'PLATFORM_REVIEWER', action: 'VIEW_DOCUMENT', docId })]);
  });

  test('bootstrap toujours désactivé ; aucun mouvement financier', async () => {
    await expect(grants.bootstrapPlatformRoot({ governors: [], authorizedBy: {}, decisionReference: 'x', validUntil: new Date(Date.now() + DAY) })).rejects.toMatchObject({ code: 'GRANT_BOOTSTRAP_DISABLED' });
    await submittedCase();
    expect(await FinancialPayment.countDocuments()).toBe(0);
    expect(await FinancialRefund.countDocuments()).toBe(0);
    expect(await ContractualGrantBootstrap.countDocuments()).toBe(0);
  });
});
