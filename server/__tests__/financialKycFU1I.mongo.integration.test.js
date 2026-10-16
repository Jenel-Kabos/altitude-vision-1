// F-U1.I — KYC financier à deux niveaux (vrai replica set, documents fictifs).
// Seul le fournisseur de stockage externe (Cloudinary) est remplacé par un
// stockage mémoire ; aucune donnée Mongo n'est simulée.
process.env.FINANCIAL_BENEFICIARY_FINGERPRINT_KEY = 'f-u1-test-fingerprint-key-0123456789abcdef';
process.env.HUMAN_IDENTITY_FINGERPRINT_KEY = 'f-u1i-test-identity-key-0123456789abcdef';

const mockStore = new Map();
jest.mock('../services/storage/secureStorageService', () => ({
  uploadPrivateAsset: jest.fn(async (buffer, { purpose, publicId, mimeType }) => {
    mockStore.set(publicId, buffer);
    return { assetClass: 'PRIVATE_DOCUMENT', purpose, provider: 'cloudinary', publicId, resourceType: 'image', deliveryType: 'authenticated', version: '1', format: 'png', mimeType, originalFilename: 'x', size: buffer.length };
  }),
  readPrivateAsset: jest.fn(async (asset) => mockStore.get(asset.publicId)),
  deletePrivateAsset: jest.fn(async (asset) => mockStore.delete(asset.publicId)),
}));

const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const { startFinancialMongo, clearFinancialMongo, stopFinancialMongo } = require('./helpers/financialMongoEnvironment');
const { createTenantFixture, createTenantUser, tenantActor } = require('./helpers/tenantAwareFixture');
const { activeGrantFixture } = require('./helpers/contractualGrantFixture');
const User = require('../models/User');
const PlatformOperator = require('../models/PlatformOperator');
const KycCase = require('../models/FinancialIdentityKycCase');
const KycAccessLog = require('../models/KycAccessLog');
const HumanIdentityAttestation = require('../models/HumanIdentityAttestation');
const ContractualFinanceGrant = require('../models/ContractualFinanceGrant');
const ContractualGrantBootstrap = require('../models/ContractualGrantBootstrap');
const FinancialPayment = require('../models/FinancialPayment');
const FinancialRefund = require('../models/FinancialRefund');
const { PLATFORM_WIDE_CONTEXT_SOURCE, PLATFORM_VIEW_REQUIRED_CAPABILITIES } = require('../constants/platformOperatorConstants');
const { KYC_PRIVACY_NOTICE, KYC_PROCEDURE } = require('../constants/financialKycConstants');
const kyc = require('../services/finance/contractual/financialKycService');
const grants = require('../services/finance/contractual/contractualFinanceGrantService');
const { assertDistinctHumans } = require('../services/finance/contractual/humanIdentityService');
const { resolveContractualAuthority, CONTRACTUAL_CAPABILITIES: CAP, SENSITIVE_CAPABILITIES } = require('../services/finance/contractual/contractualFinanceAuthorizationService');
const { errorHandler } = require('../middleware/errorMiddleware');
const routes = require('../routes/financialKycRoutes');

const app = express(); app.use(express.json()); app.use('/kyc', routes); app.use(errorHandler);
jest.setTimeout(180000);
const oid = () => new mongoose.Types.ObjectId();
const DAY = 86400000;
const { fakePng: PNG, pngFile, enableKycStorageForTests } = require('./helpers/kycFixtures');
let seq = 0;
let A; let B; let preparerA; let plainAdminA; let memberA; let memberA2; let preparerB; let memberB; let owner; let reviewer1; let reviewer2; let noGrantOperator;

beforeAll(async () => {
  await startFinancialMongo();
  await Promise.all([KycCase, KycAccessLog, HumanIdentityAttestation, ContractualFinanceGrant, ContractualGrantBootstrap].map((model) => model.syncIndexes()));
});
afterAll(stopFinancialMongo);

async function member(fixture, businessRole) {
  const { user } = await createTenantUser({ ...fixture, businessRole, overrides: { role: 'Client' } });
  return { user, actor: tenantActor(user, fixture.tenant) };
}
async function plainUser(role = 'Proprietaire') {
  seq += 1;
  return User.create({ name: `U ${seq}`, email: `fu1i-${Date.now()}-${seq}@example.test`, password: 'Password123!', passwordConfirm: 'Password123!', role, isEmailVerified: true });
}
async function operator(capabilities, { kycGrant = false, attested = false } = {}) {
  const user = await plainUser('Client');
  await PlatformOperator.create({ user: user._id, status: 'active', capabilities, grantedBy: oid(), grantReason: 'Test F-U1.I' });
  if (kycGrant) await activeGrantFixture({ user, capability: CAP.KYC_ATTEST });
  if (attested) await HumanIdentityAttestation.create({ user: user._id, identityKey: `reviewer-${user._id}`, documentKind: 'PASSPORT', source: 'BOOTSTRAP_OFFLINE', evidenceRef: 'fixture', verifiedBy: oid(), verifiedAt: new Date() });
  return { user, actor: { _id: user._id, tenantContextSource: PLATFORM_WIDE_CONTEXT_SOURCE } };
}
const self = (user) => ({ _id: user._id });

beforeEach(async () => {
  await clearFinancialMongo();
  mockStore.clear();
  enableKycStorageForTests();
  process.env.KYC_PROCEDURE_VALIDATED_VERSION = KYC_PROCEDURE.version;
  delete process.env.CONTRACTUAL_GRANT_BOOTSTRAP_ENABLED;
  A = await createTenantFixture({ label: 'FU1I A' }); B = await createTenantFixture({ label: 'FU1I B' });
  preparerA = await member(A, 'Secretaire'); plainAdminA = await member(A, 'Admin');
  memberA = await member(A, 'Secretaire'); memberA2 = await member(A, 'Admin');
  preparerB = await member(B, 'Admin'); memberB = await member(B, 'Secretaire');
  await activeGrantFixture({ user: preparerA.user, capability: CAP.KYC_PREPARE, tenant: A.tenant });
  await activeGrantFixture({ user: preparerB.user, capability: CAP.KYC_PREPARE, tenant: B.tenant });
  owner = await plainUser();
  reviewer1 = await operator(['platform.users.manage'], { kycGrant: true, attested: true });
  reviewer2 = await operator(['platform.users.manage'], { kycGrant: true, attested: true });
  noGrantOperator = await operator(['platform.users.manage', 'platform.finance.manage', 'platform.operators.manage'], { attested: true });
});

const fill = (actor, caseId, number = 'CG12345678') => kyc.updateCase({
  actor, caseId,
  personal: { lastName: 'Fictif', firstNames: 'Personne Test', birthDate: '1990-01-01' },
  identityDocument: { kind: 'NATIONAL_ID', issuingCountry: 'CG', expiresAt: new Date(Date.now() + 365 * DAY), number },
});
async function readyCase({ preparer = preparerA, subject = memberA, number } = {}) {
  const created = await kyc.createCase({ actor: preparer.actor, subjectUserId: subject.user._id, purpose: 'SENSITIVE_FINANCIAL_GRANT' });
  await fill(preparer.actor, created._id, number);
  await kyc.addDocument({ actor: preparer.actor, caseId: created._id, slot: 'ID_FRONT', file: pngFile('front') });
  await kyc.addDocument({ actor: preparer.actor, caseId: created._id, slot: 'ID_BACK', file: pngFile('back') });
  await kyc.acknowledgePrivacyNotice({ actor: self(subject.user), caseId: created._id, version: KYC_PRIVACY_NOTICE.version });
  return created._id;
}
async function underReview(options) {
  const caseId = await readyCase(options);
  await kyc.submitCase({ actor: (options?.preparer || preparerA).actor, caseId });
  await kyc.takeCase({ actor: reviewer1.actor, caseId });
  return caseId;
}
async function verifyAllDocuments(caseId, reviewer = reviewer1) {
  const view = await kyc.getCaseForReview({ actor: reviewer.actor, caseId });
  for (const doc of view.documents.filter((item) => item.status === 'current')) await kyc.recordDocumentCheck({ actor: reviewer.actor, caseId, docId: doc.docId, result: 'verified', notes: 'Pièce fictive conforme' });
}
async function approvedCase(options) {
  const caseId = await underReview(options);
  await verifyAllDocuments(caseId);
  return kyc.approveCase({ actor: reviewer1.actor, caseId, reason: 'Pièces cohérentes' });
}

describe('F-U1.I — niveau 1 : préparation', () => {
  test('1/2. organisation habilitée crée pour un membre ; hors périmètre ou sans habilitation refusé', async () => {
    const created = await kyc.createCase({ actor: preparerA.actor, subjectUserId: memberA.user._id, purpose: 'SENSITIVE_FINANCIAL_GRANT' });
    expect(created).toMatchObject({ status: 'draft', applicantType: 'TENANT_MEMBER', preparedByTenant: true });
    expect(String(created.tenant)).toBe(String(A.tenant._id));
    await expect(kyc.createCase({ actor: preparerA.actor, subjectUserId: memberB.user._id, purpose: 'SENSITIVE_FINANCIAL_GRANT' })).rejects.toMatchObject({ code: 'KYC_CASE_NOT_FOUND' });
    await expect(kyc.createCase({ actor: plainAdminA.actor, subjectUserId: memberA2.user._id, purpose: 'SENSITIVE_FINANCIAL_GRANT' })).rejects.toMatchObject({ code: 'FINANCIAL_UNAUTHORIZED' });
    await expect(kyc.createCase({ actor: preparerA.actor, subjectUserId: memberA.user._id, purpose: 'SENSITIVE_FINANCIAL_GRANT' })).rejects.toMatchObject({ code: 'KYC_CASE_ALREADY_OPEN' });
  });

  test('3. propriétaire sans organisation : dossier personnel, aucun droit plateforme', async () => {
    const created = await kyc.createCase({ actor: self(owner), purpose: 'OWNER_FINANCIAL_OPERATIONS' });
    expect(created).toMatchObject({ applicantType: 'INDIVIDUAL', tenant: null, preparedByTenant: false });
    expect((await resolveContractualAuthority(self(owner))).capabilities.size).toBe(0);
  });

  test('4/5/6. brouillon modifiable, incomplet refusé, complet soumis', async () => {
    const created = await kyc.createCase({ actor: self(owner), purpose: 'OWNER_FINANCIAL_OPERATIONS' });
    await expect(kyc.submitCase({ actor: self(owner), caseId: created._id })).rejects.toMatchObject({ code: 'KYC_CASE_INCOMPLETE' });
    const filled = await fill(self(owner), created._id);
    expect(filled.status).toBe('pending_documents');
    await expect(kyc.submitCase({ actor: self(owner), caseId: created._id })).rejects.toMatchObject({ code: 'KYC_CASE_INCOMPLETE' });
    await kyc.addDocument({ actor: self(owner), caseId: created._id, slot: 'ID_FRONT', file: pngFile('f') });
    const ready = await kyc.addDocument({ actor: self(owner), caseId: created._id, slot: 'ID_BACK', file: pngFile('b') });
    expect(ready.status).toBe('ready_for_submission');
    await expect(kyc.submitCase({ actor: self(owner), caseId: created._id })).rejects.toMatchObject({ code: 'KYC_PRIVACY_NOTICE_REQUIRED' });
    await kyc.acknowledgePrivacyNotice({ actor: self(owner), caseId: created._id, version: KYC_PRIVACY_NOTICE.version });
    expect((await kyc.submitCase({ actor: self(owner), caseId: created._id })).status).toBe('submitted');
  });

  test('l’information est acceptée par la personne concernée seule', async () => {
    const created = await kyc.createCase({ actor: preparerA.actor, subjectUserId: memberA.user._id, purpose: 'SENSITIVE_FINANCIAL_GRANT' });
    await expect(kyc.acknowledgePrivacyNotice({ actor: preparerA.actor, caseId: created._id, version: KYC_PRIVACY_NOTICE.version })).rejects.toMatchObject({ code: 'KYC_CASE_NOT_FOUND' });
  });

  test('9/10/11. accès du demandeur ; refus pour une autre personne et inter-tenant', async () => {
    const caseId = await readyCase();
    expect((await kyc.getCase({ actor: self(memberA.user), caseId })).id).toBeDefined();
    await expect(kyc.getCase({ actor: self(owner), caseId })).rejects.toMatchObject({ code: 'KYC_CASE_NOT_FOUND', statusCode: 404 });
    await expect(kyc.getCase({ actor: memberA2.actor, caseId })).rejects.toMatchObject({ code: 'KYC_CASE_NOT_FOUND' });
    await expect(kyc.getCase({ actor: preparerB.actor, caseId })).rejects.toMatchObject({ code: 'KYC_CASE_NOT_FOUND' });
    await expect(kyc.getCase({ actor: noGrantOperator.actor, caseId })).rejects.toMatchObject({ code: 'KYC_CASE_NOT_FOUND' });
    // Un dossier non soumis n'est pas visible des vérificateurs.
    await expect(kyc.getCaseForReview({ actor: reviewer1.actor, caseId })).rejects.toMatchObject({ code: 'KYC_CASE_NOT_FOUND' });
  });
});

describe('F-U1.I — niveau 2 : décision Altitude Vision', () => {
  test('12/13. organisation et opérateur sans habilitation ne décident jamais ; l’organisation ne peut pas obtenir kyc.attest', async () => {
    const caseId = await underReview();
    await expect(kyc.approveCase({ actor: preparerA.actor, caseId, reason: 'x' })).rejects.toMatchObject({ code: 'KYC_CASE_NOT_FOUND' });
    await expect(kyc.approveCase({ actor: noGrantOperator.actor, caseId, reason: 'x' })).rejects.toMatchObject({ code: 'KYC_CASE_NOT_FOUND' });
    await expect(kyc.listReviewQueue({ actor: noGrantOperator.actor })).rejects.toMatchObject({ code: 'FINANCIAL_UNAUTHORIZED' });
    await expect(kyc.listReviewQueue({ actor: { _id: reviewer1.user._id, platformTenant: A.tenant } })).rejects.toMatchObject({ code: 'FINANCIAL_UNAUTHORIZED' });
    const gov1 = await member(A, 'Admin'); const gov2 = await member(A, 'Admin');
    for (const g of [gov1, gov2]) await activeGrantFixture({ user: g.user, capability: CAP.GRANTS_GOVERN, tenant: A.tenant });
    await expect(grants.proposeGrant({ actor: gov1.actor, userId: memberA2.user._id, capability: CAP.KYC_ATTEST, justification: 'x', validUntil: new Date(Date.now() + DAY), idempotencyKey: 'k' })).rejects.toMatchObject({ code: 'GRANT_GRANTEE_NOT_ELIGIBLE' });
  });

  test('14. auto-attestation et vérificateur non attesté refusés ; membre de l’organisation préparatrice exclu', async () => {
    const ownCase = await kyc.createCase({ actor: reviewer1.actor, purpose: 'SENSITIVE_FINANCIAL_GRANT' });
    await fill(reviewer1.actor, ownCase._id, 'PA99999999');
    await kyc.addDocument({ actor: reviewer1.actor, caseId: ownCase._id, slot: 'ID_FRONT', file: pngFile('s1') });
    await kyc.addDocument({ actor: reviewer1.actor, caseId: ownCase._id, slot: 'ID_BACK', file: pngFile('s2') });
    await kyc.acknowledgePrivacyNotice({ actor: reviewer1.actor, caseId: ownCase._id, version: KYC_PRIVACY_NOTICE.version });
    await kyc.submitCase({ actor: reviewer1.actor, caseId: ownCase._id });
    await expect(kyc.takeCase({ actor: reviewer1.actor, caseId: ownCase._id })).rejects.toMatchObject({ code: 'FINANCIAL_SEGREGATION_OF_DUTIES' });
    const unattested = await operator(['platform.users.manage'], { kycGrant: true });
    const caseId = await readyCase();
    await kyc.submitCase({ actor: preparerA.actor, caseId });
    await expect(kyc.takeCase({ actor: unattested.actor, caseId })).rejects.toMatchObject({ code: 'KYC_REVIEWER_IDENTITY_NOT_ATTESTED' });
    const insider = await operator(['platform.users.manage'], { kycGrant: true, attested: true });
    await require('../services/organizationService').grantMembership({ userId: insider.user._id, orgUnitId: A.tenant.rootOrgUnit, businessRole: 'Communicant', actor: A.bootstrap });
    await expect(kyc.takeCase({ actor: insider.actor, caseId })).rejects.toMatchObject({ code: 'FINANCIAL_SEGREGATION_OF_DUTIES' });
  });

  test('15/27. approbation par un vérificateur habilité → attestation, sans aucune habilitation financière', async () => {
    const caseId = await underReview();
    await expect(kyc.approveCase({ actor: reviewer1.actor, caseId, reason: 'x' })).rejects.toMatchObject({ code: 'KYC_DOCUMENTS_NOT_VERIFIED' });
    await verifyAllDocuments(caseId);
    delete process.env.KYC_PROCEDURE_VALIDATED_VERSION;
    await expect(kyc.approveCase({ actor: reviewer1.actor, caseId, reason: 'x' })).rejects.toMatchObject({ code: 'KYC_PROCEDURE_NOT_VALIDATED' });
    process.env.KYC_PROCEDURE_VALIDATED_VERSION = KYC_PROCEDURE.version;
    const result = await kyc.approveCase({ actor: reviewer1.actor, caseId, reason: 'Pièces cohérentes' });
    expect(result.case.status).toBe('approved');
    const attestation = await HumanIdentityAttestation.findById(result.attestationId).lean();
    expect(attestation).toMatchObject({ source: 'KYC_CASE', status: 'verified' });
    expect(String(attestation.verifiedBy)).toBe(String(reviewer1.user._id));
    expect(await ContractualFinanceGrant.countDocuments({ user: memberA.user._id })).toBe(0);
    const held = (await resolveContractualAuthority(memberA.actor)).capabilities;
    SENSITIVE_CAPABILITIES.forEach((cap) => expect(held.has(cap)).toBe(false));
    const subjectView = await kyc.getCase({ actor: self(memberA.user), caseId });
    expect(subjectView.decision).toEqual(expect.objectContaining({ result: 'approved' }));
    expect(subjectView.decision.decidedBy).toBeUndefined();
  });

  test('16. refus motivé obligatoire', async () => {
    const caseId = await underReview();
    await expect(kyc.rejectCase({ actor: reviewer1.actor, caseId, reason: '' })).rejects.toMatchObject({ code: 'KYC_REASON_REQUIRED' });
    expect((await kyc.rejectCase({ actor: reviewer1.actor, caseId, reason: 'Pièce illisible' })).status).toBe('rejected');
  });

  test('7/8/22. demande de compléments, pièce remplacée revérifiée, pièce figée après soumission', async () => {
    const caseId = await underReview();
    await expect(kyc.addDocument({ actor: preparerA.actor, caseId, slot: 'ID_FRONT', file: pngFile('late') })).rejects.toMatchObject({ code: 'KYC_CASE_LOCKED' });
    await verifyAllDocuments(caseId);
    await kyc.requestInformation({ actor: reviewer1.actor, caseId, message: 'Recto flou', items: ['ID_FRONT'] });
    const replaced = await kyc.addDocument({ actor: self(memberA.user), caseId, slot: 'ID_FRONT', file: pngFile('new') });
    expect(replaced.status).toBe('additional_information_required');
    expect(replaced.documents.find((doc) => doc.slot === 'ID_FRONT').review.result).toBe('pending');
    expect((await kyc.submitCase({ actor: self(memberA.user), caseId })).status).toBe('submitted');
    await kyc.takeCase({ actor: reviewer2.actor, caseId });
    await expect(kyc.approveCase({ actor: reviewer2.actor, caseId, reason: 'x' })).rejects.toMatchObject({ code: 'KYC_DOCUMENTS_NOT_VERIFIED' });
    const full = await KycCase.findById(caseId).lean();
    expect(full.documents.filter((doc) => doc.status === 'superseded')).toHaveLength(1);
  });

  test('17/18/19. suspension, levée par un autre agent, révocation : habilitations dépendantes coupées immédiatement', async () => {
    const { case: approved } = await approvedCase();
    const gov1 = await member(A, 'Admin'); const gov2 = await member(A, 'Admin');
    for (const g of [gov1, gov2]) {
      await activeGrantFixture({ user: g.user, capability: CAP.GRANTS_GOVERN, tenant: A.tenant });
      await HumanIdentityAttestation.create({ user: g.user._id, identityKey: `gov-${g.user._id}`, documentKind: 'PASSPORT', evidenceRef: 'fixture', verifiedBy: oid(), verifiedAt: new Date() });
    }
    const { grant } = await grants.proposeGrant({ actor: gov1.actor, userId: memberA.user._id, capability: CAP.COLLECTION_RECONCILE, justification: 'Besoin', validUntil: new Date(Date.now() + 30 * DAY), idempotencyKey: 'g' });
    expect((await grants.approveGrant({ actor: gov2.actor, grantId: grant._id })).grant.status).toBe('active');
    const has = async () => (await resolveContractualAuthority(memberA.actor)).capabilities.has(CAP.COLLECTION_RECONCILE);
    expect(await has()).toBe(true);
    await kyc.suspendAttestation({ actor: reviewer2.actor, caseId: approved.id, reason: 'Doute sur la pièce' });
    expect(await has()).toBe(false);
    await expect(kyc.reinstateAttestation({ actor: reviewer2.actor, caseId: approved.id, reason: 'Levée' })).rejects.toMatchObject({ code: 'FINANCIAL_SEGREGATION_OF_DUTIES' });
    expect((await kyc.reinstateAttestation({ actor: reviewer1.actor, caseId: approved.id, reason: 'Doute levé' })).status).toBe('approved');
    expect(await has()).toBe(true);
    await kyc.revokeAttestation({ actor: reviewer2.actor, caseId: approved.id, reason: 'Fraude avérée' });
    expect(await has()).toBe(false);
    expect((await KycCase.findById(approved.id)).status).toBe('revoked');
  });

  test('pièce invalidée après approbation : attestation suspendue dans la même transaction', async () => {
    const { case: approved } = await approvedCase();
    const docId = approved.documents[0].docId;
    const result = await kyc.invalidateDocument({ actor: reviewer2.actor, caseId: approved.id, docId, reason: 'Pièce déclarée volée' });
    expect(result.status).toBe('suspended');
    expect((await HumanIdentityAttestation.findById(approved.id ? (await KycCase.findById(approved.id)).attestation : null)).status).toBe('suspended');
  });

  test('expiration de la pièce : attestation inutilisable, dossier expiré par la tâche', async () => {
    const { case: approved, attestationId } = await approvedCase();
    await HumanIdentityAttestation.updateOne({ _id: attestationId }, { expiresAt: new Date(Date.now() - 1000) });
    expect((await require('../services/finance/contractual/humanIdentityService').assessIndependence([memberA.user._id])).established).toBe(false);
    expect((await kyc.expireDueCases()).expired).toBe(1);
    expect((await KycCase.findById(approved.id)).status).toBe('expired');
  });

  test('20/21. double soumission et double décision concurrentes : une seule réussit', async () => {
    const caseId = await readyCase();
    const submits = await Promise.allSettled([kyc.submitCase({ actor: preparerA.actor, caseId }), kyc.submitCase({ actor: self(memberA.user), caseId })]);
    expect(submits.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    await kyc.takeCase({ actor: reviewer1.actor, caseId });
    await verifyAllDocuments(caseId);
    const decisions = await Promise.allSettled([
      kyc.approveCase({ actor: reviewer1.actor, caseId, reason: 'ok' }),
      kyc.rejectCase({ actor: reviewer2.actor, caseId, reason: 'non' }),
    ]);
    expect(decisions.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    const final = await KycCase.findById(caseId);
    expect(await HumanIdentityAttestation.countDocuments({ kycCase: caseId })).toBe(final.status === 'approved' ? 1 : 0);
  });

  test('26. identités attestées comparées : deux comptes d’une même pièce = même personne', async () => {
    await approvedCase({ subject: memberA, number: 'CG55555555' });
    const second = await approvedCase({ subject: memberA2, number: 'CG 5555-5555' });
    expect(second.linkedAccountsDetected).toBe(1);
    await expect(assertDistinctHumans({ a: memberA.user._id, b: memberA2.user._id })).rejects.toMatchObject({ code: 'FINANCIAL_SEGREGATION_OF_DUTIES' });
  });
});

describe('F-U1.I — données personnelles et justificatifs', () => {
  test('23/24. ni numéro, ni empreinte, ni référence de stockage exposés ; nom de fichier d’origine non conservé', async () => {
    const caseId = await readyCase({ number: 'CG77777777' });
    const view = await kyc.getCase({ actor: self(memberA.user), caseId });
    const text = JSON.stringify(view);
    ['77777777', 'numberFingerprint', 'publicId', 'cloudinary', 'asset', 'jean-dupont'].forEach((needle) => expect(text).not.toContain(needle));
    expect(view.identityDocument.numberHint).toBe('•••777');
    const raw = await KycCase.collection.findOne({ _id: caseId });
    expect(JSON.stringify(raw)).not.toContain('77777777');
    expect(JSON.stringify(raw)).not.toContain('jean-dupont');
  });

  test('fichiers : contenu falsifié, type interdit, stockage non validé, référence forgée', async () => {
    const created = await kyc.createCase({ actor: self(owner), purpose: 'OWNER_FINANCIAL_OPERATIONS' });
    await fill(self(owner), created._id);
    await expect(kyc.addDocument({ actor: self(owner), caseId: created._id, slot: 'ID_FRONT', file: { buffer: Buffer.from('<script>alert(1)</script>'), mimetype: 'image/png', originalname: 'x.png' } })).rejects.toMatchObject({ code: 'KYC_DOCUMENT_CONTENT_INVALID' });
    await expect(kyc.addDocument({ actor: self(owner), caseId: created._id, slot: 'ID_FRONT', file: { buffer: Buffer.from('MZ'), mimetype: 'application/x-msdownload', originalname: 'x.exe' } })).rejects.toMatchObject({ code: 'KYC_DOCUMENT_CONTENT_INVALID' });
    await expect(kyc.addDocument({ actor: self(owner), caseId: created._id, slot: 'PASSPORT_DATA_PAGE', file: pngFile('p') })).rejects.toMatchObject({ code: 'KYC_DOCUMENT_SLOT_INVALID' });
    delete process.env.KYC_DOCUMENT_STORAGE_ENABLED;
    await expect(kyc.addDocument({ actor: self(owner), caseId: created._id, slot: 'ID_FRONT', file: pngFile('x') })).rejects.toMatchObject({ code: 'KYC_DOCUMENT_STORAGE_NOT_APPROVED', statusCode: 503 });
    process.env.KYC_DOCUMENT_STORAGE_ENABLED = 'true';
    const other = await readyCase();
    const otherDoc = (await kyc.getCase({ actor: self(memberA.user), caseId: other })).documents[0].docId;
    await expect(kyc.readDocument({ actor: self(owner), caseId: created._id, docId: otherDoc })).rejects.toMatchObject({ code: 'KYC_DOCUMENT_NOT_FOUND' });
    await expect(kyc.readDocument({ actor: self(owner), caseId: other, docId: otherDoc })).rejects.toMatchObject({ code: 'KYC_CASE_NOT_FOUND' });
  });

  test('25. consultations sensibles journalisées (vérificateur, préparateur, justificatifs)', async () => {
    const caseId = await underReview();
    await kyc.getCaseForReview({ actor: reviewer1.actor, caseId });
    const docId = (await kyc.getCase({ actor: preparerA.actor, caseId })).documents[0].docId;
    await kyc.readDocument({ actor: reviewer1.actor, caseId, docId });
    await kyc.readDocument({ actor: self(memberA.user), caseId, docId });
    const logs = await KycAccessLog.find({ kycCase: caseId }).lean();
    expect(logs.map((l) => `${l.accessorRole}:${l.action}`).sort()).toEqual(['PLATFORM_REVIEWER:VIEW_CASE', 'PLATFORM_REVIEWER:VIEW_DOCUMENT', 'SUBJECT:VIEW_DOCUMENT', 'TENANT_PREPARER:VIEW_CASE'].sort());
    await expect(KycAccessLog.deleteOne({ _id: logs[0]._id })).rejects.toThrow('KYC_ACCESS_LOG_IMMUTABLE');
  });
});

describe('F-U1.I — bootstrap et absence de mouvement financier', () => {
  test('28/29. bootstrap désactivé ; aucun paiement ni remboursement créé', async () => {
    await expect(grants.bootstrapPlatformRoot({ governors: [], authorizedBy: {}, decisionReference: 'x', validUntil: new Date(Date.now() + DAY) })).rejects.toMatchObject({ code: 'GRANT_BOOTSTRAP_DISABLED' });
    await expect(grants.bootstrapGrantGovernors({ scopeType: 'TENANT', tenantId: A.tenant._id, governorUserIds: [], decisionReference: 'x', validUntil: new Date(Date.now() + DAY) })).rejects.toMatchObject({ code: 'GRANT_BOOTSTRAP_DISABLED' });
    await approvedCase();
    expect(await FinancialPayment.countDocuments()).toBe(0);
    expect(await FinancialRefund.countDocuments()).toBe(0);
    expect(await ContractualGrantBootstrap.countDocuments()).toBe(0);
  });
});

describe('F-U1.I — HTTP', () => {
  const token = (user) => `Bearer ${jwt.sign({ id: user._id, tokenVersion: 0 }, process.env.JWT_SECRET)}`;

  test('parcours personnel complet en HTTP, puis décision par un agent plateforme habilité', async () => {
    const procedure = await request(app).get('/kyc/procedure').set('Authorization', token(owner));
    expect(procedure.body.data.privacyNotice.version).toBe(KYC_PRIVACY_NOTICE.version);
    const created = await request(app).post('/kyc/cases').set('Authorization', token(owner)).send({ purpose: 'OWNER_FINANCIAL_OPERATIONS', tenant: String(A.tenant._id), applicantType: 'TENANT_MEMBER' });
    expect(created.status).toBe(201);
    expect(created.body.data).toMatchObject({ applicantType: 'INDIVIDUAL', tenant: null });
    const caseId = created.body.data.id;
    const patched = await request(app).patch(`/kyc/cases/${caseId}`).set('Authorization', token(owner)).send({ personal: { lastName: 'Fictif', firstNames: 'Test' }, identityDocument: { kind: 'PASSPORT', issuingCountry: 'CG', expiresAt: new Date(Date.now() + 365 * DAY), number: 'PA12312312' } });
    expect(patched.body.data.status).toBe('pending_documents');
    const tooBig = await request(app).post(`/kyc/cases/${caseId}/documents`).set('Authorization', token(owner)).field('slot', 'PASSPORT_DATA_PAGE').attach('file', Buffer.alloc(10 * 1024 * 1024 + 10, 1), { filename: 'big.png', contentType: 'image/png' });
    expect(tooBig.status).toBe(413);
    const badType = await request(app).post(`/kyc/cases/${caseId}/documents`).set('Authorization', token(owner)).field('slot', 'PASSPORT_DATA_PAGE').attach('file', Buffer.from('hello'), { filename: 'a.txt', contentType: 'text/plain' });
    expect(badType.status).toBe(415);
    const uploaded = await request(app).post(`/kyc/cases/${caseId}/documents`).set('Authorization', token(owner)).field('slot', 'PASSPORT_DATA_PAGE').attach('file', PNG('http'), { filename: '../../etc/passwd.png', contentType: 'image/png' });
    expect(uploaded.status).toBe(201);
    await request(app).post(`/kyc/cases/${caseId}/privacy-notice`).set('Authorization', token(owner)).send({ version: KYC_PRIVACY_NOTICE.version });
    expect((await request(app).post(`/kyc/cases/${caseId}/submit`).set('Authorization', token(owner))).body.data.status).toBe('submitted');

    const docId = uploaded.body.data.documents[0].docId;
    const file = await request(app).get(`/kyc/cases/${caseId}/documents/${docId}`).set('Authorization', token(owner));
    expect(file.status).toBe(200);
    expect(file.headers['cache-control']).toBe('private, no-store, max-age=0');
    expect(file.headers['content-disposition']).not.toContain('passwd');

    const outsider = await request(app).get(`/kyc/cases/${caseId}`).set('Authorization', token(memberA.user));
    expect(outsider.status).toBe(404);
    const orgApprove = await request(app).post(`/kyc/review/cases/${caseId}/approve`).set('Authorization', token(preparerA.user)).set('X-Platform-Tenant-Id', String(A.tenant._id)).send({ reason: 'x' });
    expect(orgApprove.status).toBe(404);

    const platformReviewer = await operator([...PLATFORM_VIEW_REQUIRED_CAPABILITIES], { kycGrant: true, attested: true });
    const queue = await request(app).get('/kyc/review/cases').set('Authorization', token(platformReviewer.user));
    expect(queue.status).toBe(200);
    expect(queue.body.data.map((item) => String(item.id))).toContain(String(caseId));
    expect(JSON.stringify(queue.body)).not.toContain('Fictif');
    const viewer = await operator([...PLATFORM_VIEW_REQUIRED_CAPABILITIES], { attested: true });
    expect((await request(app).get('/kyc/review/cases').set('Authorization', token(viewer.user))).status).toBe(403);
    expect((await request(app).get(`/kyc/review/cases/${caseId}/documents/${docId}`).set('Authorization', token(viewer.user))).status).toBe(404);

    expect((await request(app).post(`/kyc/review/cases/${caseId}/take`).set('Authorization', token(platformReviewer.user))).status).toBe(200);
    expect((await request(app).post(`/kyc/review/cases/${caseId}/documents/${docId}/check`).set('Authorization', token(platformReviewer.user)).send({ result: 'verified' })).status).toBe(200);
    const approved = await request(app).post(`/kyc/review/cases/${caseId}/approve`).set('Authorization', token(platformReviewer.user)).send({ reason: 'Passeport fictif conforme' });
    expect(approved.status).toBe(200);
    expect(approved.body.data.case.status).toBe('approved');
    expect(JSON.stringify(approved.body)).not.toContain('identityKey');
  });
});
