// F-U2.13 — séparation contractuelle des modes de gestion : politique par bail
// et par période, conditions Altitude Vision réservées à la gestion déléguée à
// Altitude Vision et opposables après acceptation explicite, conditions
// autonomes jamais présumées ; encaissements déclarés non comptés ; biens
// clôturés ; 1 % / 10 % selon la période (vrai replica set, données fictives).
jest.mock('../services/zohoMailService', () => ({ sendEmail: jest.fn().mockResolvedValue({}) }));
process.env.FINANCIAL_BENEFICIARY_FINGERPRINT_KEY = 'f-u1-test-fingerprint-key-0123456789abcdef';
process.env.RENT_PENALTY_ENGINE = 'CANONICAL';
const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const { startFinancialMongo, clearFinancialMongo, stopFinancialMongo } = require('./helpers/financialMongoEnvironment');
const { createTenantFixture, createTenantUser, tenantActor } = require('./helpers/tenantAwareFixture');
const { activeGrantFixture } = require('./helpers/contractualGrantFixture');
const zohoMailService = require('../services/zohoMailService');
const User = require('../models/User');
const Property = require('../models/Property');
const RentalManagement = require('../models/RentalManagement');
const Contrat = require('../models/Contrat');
const Locataire = require('../models/Locataire');
const Paiement = require('../models/Paiement');
const PlatformOperator = require('../models/PlatformOperator');
const IndividualSubscription = require('../models/IndividualSubscription');
const FinancialDocument = require('../models/FinancialDocument');
const FinancialPayment = require('../models/FinancialPayment');
const PaymentAllocation = require('../models/PaymentAllocation');
const ManagementMandate = require('../models/ManagementMandate');
const ManagementMandateVersion = require('../models/ManagementMandateVersion');
const MandateCollection = require('../models/MandateCollection');
const Penalty = require('../models/RentLatePenaltyAssessment');
const CollectionCase = require('../models/RentCollectionCase');
const Accrual = require('../models/AutonomousVariableFeeAccrual');
const DirectRentReceipt = require('../models/DirectRentReceipt');
const Policy = require('../models/LeaseContractualPolicy');
const Consent = require('../models/LeasePolicyConsent');
const { PLATFORM_WIDE_CONTEXT_SOURCE } = require('../constants/platformOperatorConstants');
const { ALTITUDE_DELEGATED_POLICY, ALTIMMO_MANDATORY_LATE_PENALTY } = require('../constants/leasePolicyConstants');
const Litige = require('../models/Litige');
const calendar = require('../services/finance/billing/rentCalendarService');
const rent = require('../services/finance/billing/rentBillingService');
const collection = require('../services/finance/billing/rentCollectionService');
const policies = require('../services/finance/billing/leasePolicyService');
const ownerTracking = require('../services/finance/billing/ownerRentTrackingService');
const receipts = require('../services/finance/billing/directRentReceiptService');
const autonomous = require('../services/finance/billing/autonomousBillingService');
const mandates = require('../services/finance/contractual/managementMandateService');
const beneficiaries = require('../services/finance/contractual/financialBeneficiaryService');
const funds = require('../services/finance/contractual/ownerFundsService');
const { verifierPaiementsEnRetard } = require('../services/alerteService');
const { allocatePaymentToDocument } = require('../services/finance/paymentAllocationService');
const { errorHandler } = require('../middleware/errorMiddleware');
const billingRoutes = require('../routes/billingRoutes');
const tenantPortalRoutes = require('../routes/tenantPortalRoutes');

const app = express(); app.use(express.json()); app.use('/billing', billingRoutes); app.use('/tenant-portal', tenantPortalRoutes); app.use(errorHandler);
jest.setTimeout(300000);
const oid = () => new mongoose.Types.ObjectId();
const wat = (iso) => new Date(`${iso}+01:00`);
const token = (user) => `Bearer ${jwt.sign({ id: user._id, tokenVersion: 0 }, process.env.JWT_SECRET, { expiresIn: '1h' })}`;
const EARLY = wat('2026-01-05T00:00:00'); // « maintenant » des créations de politiques
let seq = 0;
let A; let B; let adminA; let secretaireA; let adminB; let owner; let otherOwner; let tenantUser; let otherTenantUser; let platformOp;

beforeAll(async () => {
  await startFinancialMongo();
  await Promise.all([Policy, Consent, Penalty, CollectionCase, Accrual, DirectRentReceipt, FinancialPayment, ManagementMandate, ManagementMandateVersion, MandateCollection].map((m) => m.syncIndexes()));
});
afterAll(stopFinancialMongo);

async function plainUser(role = 'Proprietaire') {
  seq += 1;
  return User.create({ name: `Personne fictive ${seq}`, email: `fu213-${Date.now()}-${seq}@example.test`, password: 'Password123!', passwordConfirm: 'Password123!', role, isEmailVerified: true });
}
async function member(fixture, businessRole) {
  const { user } = await createTenantUser({ ...fixture, businessRole, overrides: { role: 'Client' } });
  return { user, actor: tenantActor(user, fixture.tenant) };
}

beforeEach(async () => {
  await clearFinancialMongo();
  jest.clearAllMocks();
  A = await createTenantFixture({ label: 'FU213 A' }); B = await createTenantFixture({ label: 'FU213 B' });
  adminA = await member(A, 'Admin'); secretaireA = await member(A, 'Secretaire'); adminB = await member(B, 'Admin');
  for (const capability of ['contractual.beneficiary.verify', 'contractual.financial.approve']) await activeGrantFixture({ user: adminA.user, capability, tenant: A.tenant });
  owner = await plainUser(); otherOwner = await plainUser(); tenantUser = await plainUser('Client'); otherTenantUser = await plainUser('Client');
  const op = await plainUser('Client');
  await PlatformOperator.create({ user: op._id, status: 'active', capabilities: ['platform.finance.manage'], grantedBy: oid(), grantReason: 'Test F-U2.13' });
  platformOp = { user: op, actor: { _id: op._id, tenantContextSource: PLATFORM_WIDE_CONTEXT_SOURCE } };
});

async function lease({ org = false, start = '2026-01-01T00:00:00', rentMinor = 150000, user = tenantUser } = {}) {
  const propertyId = oid();
  await Property.collection.insertOne({ _id: propertyId, title: 'Bien fictif', owner: owner._id, tenant: org ? A.tenant._id : null, status: 'location', availability: 'Disponible' });
  const existing = await Locataire.findOne({ user: user._id }).lean();
  const locataireId = existing ? existing._id : (await Locataire.collection.insertOne({ nom: 'Locataire', prenom: 'Fictif', email: `loc-${oid()}@example.test`, user: user._id })).insertedId;
  const leaseId = oid();
  await Contrat.collection.insertOne({ _id: leaseId, type: 'location', bien: propertyId, locataire: locataireId, statut: 'actif', dateEntree: wat(start), dateFinBail: wat('2028-12-31T00:00:00'), montantLoyer: rentMinor, montantCharges: 0, chargesIncluses: true });
  return { leaseId, propertyId };
}
// Mandat de gestion déléguée À ALTITUDE VISION (fixture directe : activation hors périmètre de ce lot).
async function platformMandate(propertyId, effectiveFrom, { mandataryType = 'PLATFORM', ended = null } = {}) {
  const mandateId = oid(); const versionId = oid();
  const history = [{ from: null, to: 'draft', actor: oid(), at: wat('2025-12-01T00:00:00') }, { from: 'draft', to: 'active', actor: oid(), at: wat('2025-12-02T00:00:00') }, ...(ended ? [{ from: 'active', to: 'revoked', actor: oid(), at: wat(ended) }] : [])];
  await ManagementMandate.collection.insertOne({ _id: mandateId, mandataryType, tenant: null, owner: owner._id, property: propertyId, status: ended ? 'revoked' : 'active', currentVersion: versionId, statusHistory: history, reference: `R-${oid()}`, businessOperationKey: `fixture-${oid()}`, createdAt: new Date() });
  await ManagementMandateVersion.collection.insertOne({ _id: versionId, mandate: mandateId, versionNumber: 1, effectiveFrom: wat(effectiveFrom), terms: { offer: 'DELEGATED_MANAGEMENT', collectionMode: 'OWNER_DIRECT' }, termsHash: 'fixture' });
  return mandateId;
}
const ownerPolicy = (leaseId, terms, extra = {}) => policies.createPolicy({ actor: { _id: owner._id }, leaseId, type: 'OWNER_AUTONOMOUS', terms, effectiveFrom: wat('2026-01-01T00:00:00'), documentReference: 'Bail sous seing privé fictif', now: EARLY, ...extra });
const altitudePolicy = (leaseId, extra = {}) => policies.createPolicy({ actor: platformOp.actor, leaseId, type: 'ALTITUDE_DELEGATED', terms: { penalty: { rateBasisPoints: 9999 } }, effectiveFrom: wat('2026-01-01T00:00:00'), documentReference: 'Conditions Altitude Vision v2026-10', now: EARLY, ...extra });
const trackingDue = (leaseId, period = '2026-04', now = wat('2026-04-30T00:00:00'), extra = {}) => ownerTracking.generateOwnerTrackingRentDue({ actor: { _id: owner._id }, leaseId, period, now, ...extra }).then((r) => r.document);
const cycle = (iso) => collection.runRentCollectionCycle({ now: wat(iso) });
async function accept(policyId, user = tenantUser, now = wat('2026-02-01T10:00:00')) {
  const shown = await policies.presentPolicy({ userId: user._id, policyId, now });
  return policies.acceptPolicy({ userId: user._id, policyId, presentationToken: shown.presentationToken, documentHash: shown.documentHash, accept: true, now });
}

describe('F-U2.13.C — gestion autonome : aucune politique Altitude Vision présumée', () => {
  test('sans politique : échéance de suivi sans date d’échéance, aucun retard, aucune pénalité, aucun dossier ; mois partiel bloqué', async () => {
    const { leaseId } = await lease();
    const due = await trackingDue(leaseId, '2026-04', wat('2026-04-01T08:00:00'));
    expect(due).toMatchObject({ dueDate: null, metadata: { policy: { status: 'POLICY_UNRESOLVED', reason: 'NO_POLICY', expectedType: 'OWNER_AUTONOMOUS' } } });
    await cycle('2026-06-30T08:00:00');
    expect(await Penalty.countDocuments()).toBe(0);
    expect(await CollectionCase.countDocuments()).toBe(0);
    const partial = await lease({ start: '2026-04-21T00:00:00' });
    await expect(trackingDue(partial.leaseId, '2026-04', wat('2026-04-30T00:00:00'), { prorataClauseReference: 'Art. 3' })).rejects.toMatchObject({ code: 'RENT_PRORATA_POLICY_MISSING' });
    const view = await collection.tenantRentDues({ userId: tenantUser._id, now: wat('2026-06-30T08:00:00') });
    expect(view.items[0]).toMatchObject({ dueDate: null, formalNoticeDate: null, penalty: null, policy: { status: 'POLICY_UNRESOLVED' } });
  });

  test('conditions autonomes vides : rien n’est prérempli ; échéance au 1er sans pénalité → aucune pénalité ni mise en demeure', async () => {
    const { leaseId } = await lease();
    const empty = await ownerPolicy(leaseId, {});
    expect(empty.terms).toEqual({ due: null, grace: null, penalty: null, formalNotice: null, prorata: null, imputation: null });
    const second = await lease();
    await ownerPolicy(second.leaseId, { due: { day: 1, monthOffset: 0 } });
    const due = await trackingDue(second.leaseId, '2026-04', wat('2026-04-01T00:00:00'));
    expect(new Date(due.dueDate).toISOString()).toBe('2026-04-01T22:59:59.999Z');
    await cycle('2026-05-30T08:00:00');
    expect(await Penalty.findOne({ rentDocument: due._id }).lean()).toMatchObject({ status: 'NO_CONTRACTUAL_PENALTY', penaltyMinor: 0 });
    expect(await CollectionCase.countDocuments()).toBe(0);
  });

  test('pénalité contractuelle propre (2 %, échéance le 10, relance le 20) : appliquée selon le bail, signalement sans effet suspensif non stipulé', async () => {
    const { leaseId } = await lease();
    await ownerPolicy(leaseId, { due: { day: 10, monthOffset: 0 }, penalty: { rateBasisPoints: 200 }, formalNotice: { day: 20, monthOffset: 0 } });
    const due = await trackingDue(leaseId, '2026-04', wat('2026-04-01T00:00:00'));
    const report = await collection.reportPaymentDifficulty({ userId: tenantUser._id, documentId: due._id, now: wat('2026-04-12T10:00:00') });
    expect(report).toMatchObject({ admissibleForSuspension: false, admissibilityBasis: 'NOT_APPLICABLE' });
    await cycle('2026-04-11T08:00:00');
    expect(await Penalty.findOne({ rentDocument: due._id }).lean()).toMatchObject({ status: 'SIMULATED', rateBasisPoints: 200, penaltyMinor: 3000, policy: { type: 'OWNER_AUTONOMOUS', version: 1 }, legalBasis: { status: 'OWNER_CONTRACT_DECLARED' } });
    await cycle('2026-04-20T08:00:00');
    expect(await CollectionCase.findOne({ rentDocument: due._id }).lean()).toMatchObject({ status: 'notice_draft_prepared', noticeDraft: { sent: false } });
  });

  test('conditions non prises en charge refusées ; aucune politique Altitude Vision sur un bien autonome', async () => {
    const { leaseId } = await lease();
    await expect(ownerPolicy(leaseId, { penalty: { rateBasisPoints: 300 } })).rejects.toMatchObject({ code: 'LEASE_POLICY_TERMS_INVALID' });
    await expect(ownerPolicy(leaseId, { penaltyCompound: true })).rejects.toMatchObject({ code: 'LEASE_POLICY_TERMS_INVALID' });
    await expect(altitudePolicy(leaseId)).rejects.toMatchObject({ code: 'LEASE_POLICY_MODE_MISMATCH' });
  });
});

describe('F-U2.13.B/E — gestion déléguée à Altitude Vision et consentement électronique', () => {
  test('conditions Altitude Vision imposées par la plateforme seule, termes non modifiables par le client', async () => {
    const { leaseId, propertyId } = await lease();
    await platformMandate(propertyId, '2025-12-01T00:00:00');
    await expect(policies.createPolicy({ actor: adminA.actor, leaseId, type: 'ALTITUDE_DELEGATED', effectiveFrom: wat('2026-01-01T00:00:00'), documentReference: 'x', now: EARLY })).rejects.toMatchObject({ statusCode: expect.any(Number) });
    await expect(ownerPolicy(leaseId, {})).rejects.toMatchObject({ code: 'LEASE_POLICY_MODE_MISMATCH' });
    const policy = await altitudePolicy(leaseId);
    expect(policy).toMatchObject({ type: 'ALTITUDE_DELEGATED', consentRequired: true, policyLabel: ALTITUDE_DELEGATED_POLICY.version });
    expect(policy.terms.penalty.rateBasisPoints).toBe(300);
  });

  test('sans acceptation : aucune pénalité ni mise en demeure, éléments manquants signalés ; dette suivie', async () => {
    const { leaseId, propertyId } = await lease();
    await platformMandate(propertyId, '2025-12-01T00:00:00');
    await altitudePolicy(leaseId);
    const due = await trackingDue(leaseId, '2026-04').catch(() => null);
    const document = due || (await rent.generateRentInvoice({ actor: platformOp.actor, leaseId, period: '2026-04', now: wat('2026-04-30T00:00:00') })).document;
    expect(new Date(document.dueDate).toISOString()).toBe('2026-05-05T22:59:59.999Z');
    await FinancialDocument.updateOne({ _id: document._id }, { $set: { status: 'issued', documentNumber: 'FAC-FICTIF-1' } });
    await cycle('2026-05-06T08:00:00');
    expect(await Penalty.findOne({ rentDocument: document._id }).lean()).toMatchObject({ status: 'POLICY_CONSENT_MISSING', penaltyMinor: 0, policy: { reason: 'CONSENT_MISSING' } });
    await cycle('2026-05-25T08:00:00');
    expect(await CollectionCase.findOne({ rentDocument: document._id }).lean()).toMatchObject({ status: 'blocked_policy', block: { reason: 'CONSENT_MISSING' } });
  });

  test('acceptation explicite avant l’échéance : 3 % prévisionnels et projet au 25 ; acceptation tardive : jamais rétroactive', async () => {
    const early = await lease();
    await platformMandate(early.propertyId, '2025-12-01T00:00:00');
    const p1 = await altitudePolicy(early.leaseId);
    const consent = await accept(p1._id);
    expect(consent).toMatchObject({ status: 'ACCEPTED', explicitAction: 'EXPLICIT_ACCEPT', verificationStatus: 'AUTHENTICATED_ACCEPTANCE', signatureStatus: 'SIGNATURE_PENDING' });
    const d1 = (await rent.generateRentInvoice({ actor: platformOp.actor, leaseId: early.leaseId, period: '2026-04', now: wat('2026-04-30T00:00:00') })).document;
    await FinancialDocument.updateOne({ _id: d1._id }, { $set: { status: 'issued', documentNumber: 'FAC-FICTIF-2' } });
    const late = await lease({ user: otherTenantUser });
    await platformMandate(late.propertyId, '2025-12-01T00:00:00');
    const p2 = await altitudePolicy(late.leaseId);
    await accept(p2._id, otherTenantUser, wat('2026-05-20T10:00:00')); // après le 6 mai
    const d2 = (await rent.generateRentInvoice({ actor: platformOp.actor, leaseId: late.leaseId, period: '2026-04', now: wat('2026-04-30T00:00:00') })).document;
    await FinancialDocument.updateOne({ _id: d2._id }, { $set: { status: 'issued', documentNumber: 'FAC-FICTIF-3' } });
    await cycle('2026-05-25T08:00:00');
    expect(await Penalty.findOne({ rentDocument: d1._id }).lean()).toMatchObject({ status: 'SIMULATED', penaltyMinor: 4500, policy: { type: 'ALTITUDE_DELEGATED' } });
    expect(await CollectionCase.findOne({ rentDocument: d1._id }).lean()).toMatchObject({ status: 'notice_draft_prepared' });
    expect(await Penalty.findOne({ rentDocument: d2._id }).lean()).toMatchObject({ status: 'POLICY_CONSENT_MISSING', penaltyMinor: 0 });
    expect(await CollectionCase.findOne({ rentDocument: d2._id }).lean()).toMatchObject({ status: 'notice_draft_prepared' }); // accepté avant le 25 mai
  });

  test('sécurité du consentement : autre utilisateur, sans consultation, sans action explicite, empreinte fausse, rejeu, opérateur plateforme, modification', async () => {
    const { leaseId, propertyId } = await lease();
    await platformMandate(propertyId, '2025-12-01T00:00:00');
    const policy = await altitudePolicy(leaseId);
    await expect(policies.presentPolicy({ userId: otherTenantUser._id, policyId: policy._id })).rejects.toMatchObject({ statusCode: 404 });
    await expect(policies.presentPolicy({ userId: platformOp.user._id, policyId: policy._id })).rejects.toMatchObject({ statusCode: 404 });
    await expect(policies.acceptPolicy({ userId: tenantUser._id, policyId: policy._id, presentationToken: 'x', documentHash: policy.documentHash, accept: true })).rejects.toMatchObject({ code: 'CONSENT_PRESENTATION_REQUIRED' });
    const shown = await policies.presentPolicy({ userId: tenantUser._id, policyId: policy._id });
    expect(shown.document.clauses.join(' ')).toContain('3 % du loyer principal');
    await expect(policies.acceptPolicy({ userId: tenantUser._id, policyId: policy._id, presentationToken: shown.presentationToken, documentHash: shown.documentHash, accept: 'true' })).rejects.toMatchObject({ code: 'CONSENT_EXPLICIT_ACTION_REQUIRED' });
    await expect(policies.acceptPolicy({ userId: tenantUser._id, policyId: policy._id, presentationToken: shown.presentationToken, documentHash: 'faux', accept: true })).rejects.toMatchObject({ code: 'CONSENT_DOCUMENT_MISMATCH' });
    await expect(policies.acceptPolicy({ userId: tenantUser._id, policyId: policy._id, presentationToken: 'jeton-faux', documentHash: shown.documentHash, accept: true })).rejects.toMatchObject({ code: 'CONSENT_PRESENTATION_INVALID' });
    const res = await request(app).post(`/tenant-portal/lease-policies/${policy._id}/accept`).set('Authorization', token(tenantUser)).send({ presentationToken: shown.presentationToken, documentHash: shown.documentHash, accept: true, acceptedAt: '2020-01-01' });
    expect(res.status).toBe(201);
    expect(new Date(res.body.data.consent.acceptedAt).getFullYear()).toBeGreaterThan(2020);
    await expect(policies.acceptPolicy({ userId: tenantUser._id, policyId: policy._id, presentationToken: shown.presentationToken, documentHash: shown.documentHash, accept: true })).rejects.toMatchObject({ code: 'CONSENT_ALREADY_RECORDED' });
    await expect(Consent.updateOne({ policy: policy._id, status: 'ACCEPTED' }, { $set: { acceptedAt: new Date('2020-01-01') } })).rejects.toMatchObject({ code: 'CONSENT_IMMUTABLE' });
    expect(await Consent.countDocuments()).toBe(1);
  });
});

describe('F-U2.13.D/F — versionnement et changements de mode de gestion', () => {
  test('aucune rétroactivité ; nouvelle version pour l’avenir, ancienne conservée ; contenu immuable ; création non autorisée refusée', async () => {
    const { leaseId } = await lease();
    await expect(ownerPolicy(leaseId, {}, { effectiveFrom: wat('2025-11-01T00:00:00') })).rejects.toMatchObject({ code: 'LEASE_POLICY_RETROACTIVE' });
    const v1 = await ownerPolicy(leaseId, { due: { day: 1, monthOffset: 0 } });
    await expect(ownerPolicy(leaseId, {}, { effectiveFrom: wat('2026-01-01T00:00:00') })).rejects.toMatchObject({ code: 'LEASE_POLICY_RETROACTIVE' });
    const v2 = await ownerPolicy(leaseId, { due: { day: 5, monthOffset: 0 } }, { effectiveFrom: wat('2026-06-01T00:00:00'), now: wat('2026-05-20T00:00:00') });
    expect(v2.version).toBe(2);
    const may = await policies.resolvePolicyForPeriod({ lease: leaseId, propertyId: (await Contrat.findById(leaseId).lean()).bien, periodLabel: '2026-05' });
    const june = await policies.resolvePolicyForPeriod({ lease: leaseId, propertyId: (await Contrat.findById(leaseId).lean()).bien, periodLabel: '2026-06' });
    expect([may.policy.version, june.policy.version]).toEqual([1, 2]);
    expect(await Policy.findById(v1._id).lean()).toMatchObject({ status: 'superseded', terms: { due: { day: 1 } } });
    await expect(Policy.updateOne({ _id: v1._id }, { $set: { 'terms.penalty': { rateBasisPoints: 300 } } })).rejects.toMatchObject({ code: 'LEASE_POLICY_IMMUTABLE' });
    await expect(policies.createPolicy({ actor: { _id: otherOwner._id }, leaseId, type: 'OWNER_AUTONOMOUS', terms: {}, effectiveFrom: wat('2026-07-01T00:00:00'), documentReference: 'x', now: wat('2026-06-20T00:00:00') })).rejects.toMatchObject({ statusCode: expect.any(Number) });
    const orgLease = await lease({ org: true });
    await expect(policies.createPolicy({ actor: adminB.actor, leaseId: orgLease.leaseId, type: 'OWNER_AUTONOMOUS', terms: {}, effectiveFrom: wat('2026-01-01T00:00:00'), documentReference: 'x', now: EARLY })).rejects.toMatchObject({ statusCode: expect.any(Number) });
    expect((await policies.createPolicy({ actor: adminA.actor, leaseId: orgLease.leaseId, type: 'OWNER_AUTONOMOUS', terms: {}, effectiveFrom: wat('2026-01-01T00:00:00'), documentReference: 'x', now: EARLY })).authorityPlane).toBe('TENANT');
  });

  test('autonome janvier–juin puis délégué à Altitude Vision dès juillet : chaque période garde sa politique ; mandat révoqué → non résolu', async () => {
    const { leaseId, propertyId } = await lease();
    await ownerPolicy(leaseId, { due: { day: 1, monthOffset: 0 } });
    await platformMandate(propertyId, '2026-07-01T00:00:00');
    await altitudePolicy(leaseId, { effectiveFrom: wat('2026-07-01T00:00:00'), now: wat('2026-06-25T00:00:00') });
    const resolve = (label) => policies.resolvePolicyForPeriod({ lease: leaseId, propertyId, periodLabel: label });
    expect((await resolve('2026-06'))).toMatchObject({ status: 'RESOLVED', expectedType: 'OWNER_AUTONOMOUS', policy: { version: 1 } });
    expect((await resolve('2026-07'))).toMatchObject({ status: 'RESOLVED', expectedType: 'ALTITUDE_DELEGATED', policy: { version: 2 } });
    const revoked = await lease();
    await platformMandate(revoked.propertyId, '2025-12-01T00:00:00', { ended: '2026-03-15T00:00:00' });
    await altitudePolicy(revoked.leaseId);
    expect(await policies.resolvePolicyForPeriod({ lease: revoked.leaseId, propertyId: revoked.propertyId, periodLabel: '2026-04' })).toMatchObject({ status: 'POLICY_UNRESOLVED', reason: 'MANAGEMENT_MODE_MISMATCH', expectedType: 'OWNER_AUTONOMOUS' });
  });
});

// GIT-INTEGRATION-02A — décision de la direction : la pénalité de 3 % à partir
// du 6 est la politique obligatoire Altimmo ; l'absence de politique
// contractuelle n'exonère plus (remplace la règle F-U2.13.G antérieure).
describe('F-U2.13.G — moteur historique : politique de retard obligatoire Altimmo', () => {
  test('LEGACY : sans politique de bail → politique Altimmo appliquée ; politique autonome à 3 % → appliquée', async () => {
    process.env.RENT_PENALTY_ENGINE = 'LEGACY';
    try {
      const bare = await lease();
      const p1 = await Paiement.create({ contrat: bare.leaseId, mois: 4, annee: 2026, montant: 150000, statut: 'impayé', jourEcheance: 1 });
      const withPenalty = await lease();
      await ownerPolicy(withPenalty.leaseId, { due: { day: 1, monthOffset: 0 }, penalty: { rateBasisPoints: 300 } });
      const p2 = await Paiement.create({ contrat: withPenalty.leaseId, mois: 4, annee: 2026, montant: 150000, statut: 'impayé', jourEcheance: 1 });
      await verifierPaiementsEnRetard();
      expect(await Paiement.findById(p1._id).lean()).toMatchObject({ penaliteAppliquee: true, penaliteMontant: 4500 });
      expect(await Paiement.findById(p2._id).lean()).toMatchObject({ penaliteAppliquee: true, penaliteMontant: 4500 });
      expect(zohoMailService.sendEmail).toHaveBeenCalledTimes(2);
    } finally { process.env.RENT_PENALTY_ENGINE = 'CANONICAL'; }
  });
});

describe('GIT-INTEGRATION-02A — politique de retard obligatoire Altimmo (moteur LEGACY)', () => {
  const APRIL = { mois: 4, annee: 2026, montant: 150000, jourEcheance: 1 };
  const schedule = (leaseId, extra = {}) => Paiement.create({ contrat: leaseId, ...APRIL, statut: 'impayé', ...extra });
  const run = (iso, extra = {}) => verifierPaiementsEnRetard({ now: wat(iso), ...extra });
  const get = (paiement) => Paiement.findById(paiement._id).lean();
  beforeEach(() => { process.env.RENT_PENALTY_ENGINE = 'LEGACY'; });
  afterEach(() => { process.env.RENT_PENALTY_ENGINE = 'CANONICAL'; });

  test('politique centralisée : 3 % à partir du 6, non configurable', () => {
    expect(ALTIMMO_MANDATORY_LATE_PENALTY).toMatchObject({ rateBasisPoints: 300, lastDueDay: 5, firstPenaltyDay: 6, base: 'UNPAID_RENT_PRINCIPAL' });
    expect(Object.isFrozen(ALTIMMO_MANDATORY_LATE_PENALTY)).toBe(true);
  });

  test('cas 1/2 : payé avant le 6 ou le 5 → aucune pénalité ; impayé le 5 à 23:59 → rien ; impayé le 6 à 00:00 (Brazzaville) → 3 % une seule fois', async () => {
    const paidEarly = await schedule((await lease()).leaseId, { statut: 'payé', datePaiement: wat('2026-04-03T10:00:00') });
    const paidOnFifth = await schedule((await lease()).leaseId, { datePaiement: wat('2026-04-05T18:00:00') });
    const unpaid = await schedule((await lease()).leaseId);

    expect(await run('2026-04-05T23:59:00')).toMatchObject({ penalites: 0, aRevoir: 0 });
    expect(await get(unpaid)).toMatchObject({ statut: 'impayé', penaliteAppliquee: false, retardJours: 0 });

    expect(await run('2026-04-06T00:00:00')).toMatchObject({ penalites: 1, aRevoir: 0 });
    expect(await get(unpaid)).toMatchObject({ statut: 'en_retard', penaliteAppliquee: true, penaliteMontant: 4500, montantTotal: 154500, retardJours: 1 });
    expect(await get(paidEarly)).toMatchObject({ statut: 'payé', penaliteAppliquee: false });
    expect(await get(paidOnFifth)).toMatchObject({ statut: 'impayé', penaliteAppliquee: false });
    expect(zohoMailService.sendEmail).toHaveBeenCalledTimes(1);
  });

  test('cas 3 : bail sans politique (avec ou sans mandat Altitude Vision) et politique Altitude Vision non acceptée → politique Altimmo, taux non modifiable', async () => {
    const bare = await lease();
    const delegatedNoPolicy = await lease();
    await platformMandate(delegatedNoPolicy.propertyId, '2025-12-01T00:00:00');
    const delegated = await lease();
    await platformMandate(delegated.propertyId, '2025-12-01T00:00:00');
    await altitudePolicy(delegated.leaseId); // taux 9 999 demandé : ignoré, conditions Altitude Vision imposées
    const payments = await Promise.all([bare, delegatedNoPolicy, delegated].map((l) => schedule(l.leaseId)));
    expect(await run('2026-04-10T08:00:00')).toMatchObject({ penalites: 3, aRevoir: 0 });
    for (const payment of payments) expect(await get(payment)).toMatchObject({ penaliteAppliquee: true, penaliteMontant: 4500 });
  });

  test('cas 4 : ancienne option de bail sans pénalité ou taux différent → ni exonération ni pénalité automatique : dossier à revoir, une seule fois', async () => {
    const noPenalty = await lease();
    await ownerPolicy(noPenalty.leaseId, {});
    const otherRate = await lease();
    await ownerPolicy(otherRate.leaseId, { due: { day: 1, monthOffset: 0 }, penalty: { rateBasisPoints: 500 } });
    const p1 = await schedule(noPenalty.leaseId);
    const p2 = await schedule(otherRate.leaseId);
    expect(await run('2026-04-10T08:00:00')).toMatchObject({ penalites: 0, aRevoir: 2 });
    const first = await get(p1);
    expect(first).toMatchObject({ penaliteAppliquee: false, statut: 'en_retard', penaltyReview: { status: 'REQUIRED', reason: 'LEASE_POLICY_WITHOUT_PENALTY' } });
    expect(await get(p2)).toMatchObject({ penaliteAppliquee: false, penaltyReview: { status: 'REQUIRED', reason: 'LEASE_PENALTY_RATE_DIFFERS' } });
    expect(await run('2026-04-12T08:00:00')).toMatchObject({ penalites: 0, aRevoir: 0 });
    expect((await get(p1)).penaltyReview.flaggedAt).toEqual(first.penaltyReview.flaggedAt);
    expect(zohoMailService.sendEmail).not.toHaveBeenCalled();
  });

  test('cas 5/6 : pénalité déjà enregistrée ou traitement relancé → aucun doublon (montant, total, e-mail)', async () => {
    const already = await schedule((await lease()).leaseId, { statut: 'en_retard', penaliteAppliquee: true, penaliteMontant: 4500, montantTotal: 154500 });
    const fresh = await schedule((await lease()).leaseId);
    await run('2026-04-07T08:00:00');
    await run('2026-04-08T08:00:00');
    await run('2026-05-02T08:00:00');
    expect(await get(already)).toMatchObject({ penaliteMontant: 4500, montantTotal: 154500 });
    expect(await get(fresh)).toMatchObject({ penaliteAppliquee: true, penaliteMontant: 4500, montantTotal: 154500 });
    expect(zohoMailService.sendEmail).toHaveBeenCalledTimes(1);
  });

  test('exécution concurrente : trois traitements simultanés → une seule pénalité et un seul e-mail', async () => {
    const payment = await schedule((await lease()).leaseId);
    const results = await Promise.all([run('2026-04-06T08:00:00'), run('2026-04-06T08:00:00'), run('2026-04-06T08:00:00')]);
    expect(results.reduce((sum, r) => sum + r.penalites, 0)).toBe(1);
    expect(await get(payment)).toMatchObject({ penaliteAppliquee: true, penaliteMontant: 4500, montantTotal: 154500 });
    expect(zohoMailService.sendEmail).toHaveBeenCalledTimes(1);
  });

  test('isolation : un traitement limité aux baux d’un périmètre ne touche jamais les autres', async () => {
    const mine = await lease({ org: true });
    const theirs = await lease();
    const p1 = await schedule(mine.leaseId);
    const p2 = await schedule(theirs.leaseId);
    expect(await run('2026-04-10T08:00:00', { contratIds: [mine.leaseId] })).toMatchObject({ verifies: 1, penalites: 1 });
    expect(await get(p1)).toMatchObject({ penaliteAppliquee: true });
    expect(await get(p2)).toMatchObject({ penaliteAppliquee: false, statut: 'impayé' });
    expect(await run('2026-04-10T08:00:00', { contratIds: [] })).toMatchObject({ verifies: 0, penalites: 0 });
  });

  test('cas 7 : litige de paiement ouvert → dossier à revoir, ni pénalité ni exonération ; litige clos → politique appliquée', async () => {
    const disputed = await lease();
    const closed = await lease();
    await Litige.collection.insertMany([
      { type: 'Problème_paiement', statut: 'En_cours_médiation', bienConcerné: disputed.propertyId, description: 'Loyer contesté (fictif)' },
      { type: 'Problème_paiement', statut: 'Résolu', bienConcerné: closed.propertyId, description: 'Litige clos (fictif)' },
    ]);
    const p1 = await schedule(disputed.leaseId);
    const p2 = await schedule(closed.leaseId);
    expect(await run('2026-04-10T08:00:00')).toMatchObject({ penalites: 1, aRevoir: 1 });
    expect(await get(p1)).toMatchObject({ penaliteAppliquee: false, penaltyReview: { reason: 'PAYMENT_DISPUTE_OPEN' } });
    expect(await get(p2)).toMatchObject({ penaliteAppliquee: true, penaliteMontant: 4500 });
  });

  test('cohérence de mandat : mandat révoqué avec politique Altitude Vision → dossier à revoir, jamais appliqué d’office', async () => {
    const revoked = await lease();
    await platformMandate(revoked.propertyId, '2025-12-01T00:00:00', { ended: '2026-03-15T00:00:00' });
    await altitudePolicy(revoked.leaseId);
    const payment = await schedule(revoked.leaseId);
    expect(await run('2026-04-10T08:00:00')).toMatchObject({ penalites: 0, aRevoir: 1 });
    expect(await get(payment)).toMatchObject({ penaliteAppliquee: false, penaltyReview: { reason: 'MANAGEMENT_MODE_MISMATCH' } });
  });

  test('un seul moteur : échéance déjà évaluée par le moteur canonique, moteur CANONICAL ou DISABLED → aucune pénalité historique', async () => {
    const { leaseId } = await lease();
    const payment = await schedule(leaseId);
    await Penalty.collection.insertOne({ lease: leaseId, period: '2026-04', kind: 'LATE_PAYMENT', status: 'SIMULATED' });
    expect(await run('2026-04-10T08:00:00')).toMatchObject({ penalites: 0 });
    expect(await get(payment)).toMatchObject({ penaliteAppliquee: false });
    const other = await schedule((await lease()).leaseId);
    for (const value of ['CANONICAL', 'BOTH']) {
      process.env.RENT_PENALTY_ENGINE = value;
      expect(await run('2026-04-10T08:00:00')).toMatchObject({ skipped: true, penalites: 0 });
    }
    expect(await get(other)).toMatchObject({ penaliteAppliquee: false, statut: 'impayé' });
    expect(zohoMailService.sendEmail).not.toHaveBeenCalled();
  });
});

describe('F-U2.13.H — encaissements déclarés vs confirmés', () => {
  test('déclaré : solde financier inchangé, pénalité en attente de confirmation, mise en demeure suspendue ; confirmé : soldé ; contesté : contrepassé', async () => {
    const { leaseId } = await lease();
    await ownerPolicy(leaseId, { due: { day: 'END', monthOffset: 0 }, grace: { day: 5, monthOffset: 1 }, penalty: { rateBasisPoints: 300 }, formalNotice: { day: 25, monthOffset: 1 } });
    const due = await trackingDue(leaseId);
    const { receipt } = await ownerTracking.recordOwnerRentReceipt({ actor: { _id: owner._id }, documentId: due._id, amountMinor: 150000, receivedAt: wat('2026-05-03T10:00:00'), method: 'mobile_money', idempotencyKey: 'k1' });
    expect((await FinancialDocument.findById(due._id).lean()).balanceMinor).toBe(150000);
    expect(await FinancialPayment.findById(receipt.payment).lean()).toMatchObject({ status: 'pending' });
    expect(await PaymentAllocation.countDocuments()).toBe(0);
    await cycle('2026-05-06T08:00:00');
    expect(await Penalty.findOne({ rentDocument: due._id }).lean()).toMatchObject({ status: 'PENDING_RECEIPT_CONFIRMATION', penaltyMinor: 4500 });
    await cycle('2026-05-25T08:00:00');
    expect(await CollectionCase.findOne({ rentDocument: due._id }).lean()).toMatchObject({ status: 'notice_suspended', suspension: { reason: 'Encaissement déclaré par le bailleur en attente de confirmation' } });
    const view = (await collection.tenantRentDues({ userId: tenantUser._id, now: wat('2026-05-25T09:00:00') })).items[0];
    expect(view).toMatchObject({ balanceMinor: 150000, declaredPendingMinor: 150000 });
    await expect(receipts.cancelReceipt({ actor: { _id: owner._id }, receiptId: receipt._id, reason: 'x' })).resolves.toBeTruthy();
  });

  test('confirmation indépendante : paiement daté de la réception, affecté, pénalité corrigée, dossier soldé ; contestation : contrepassation, jamais d’annulation par le bailleur', async () => {
    const { leaseId } = await lease();
    await ownerPolicy(leaseId, { due: { day: 'END', monthOffset: 0 }, grace: { day: 5, monthOffset: 1 }, penalty: { rateBasisPoints: 300 }, formalNotice: { day: 25, monthOffset: 1 } });
    const due = await trackingDue(leaseId);
    const { receipt } = await ownerTracking.recordOwnerRentReceipt({ actor: { _id: owner._id }, documentId: due._id, amountMinor: 150000, receivedAt: wat('2026-05-03T10:00:00'), method: 'mobile_money', idempotencyKey: 'k1' });
    await cycle('2026-05-06T08:00:00');
    await receipts.tenantRespond({ userId: tenantUser._id, receiptId: receipt._id, decision: 'confirm' });
    const payment = await FinancialPayment.findById(receipt.payment).lean();
    expect(payment).toMatchObject({ status: 'succeeded' });
    expect(new Date(payment.confirmedAt).toISOString()).toBe(wat('2026-05-03T10:00:00').toISOString());
    expect((await FinancialDocument.findById(due._id).lean()).balanceMinor).toBe(0);
    await cycle('2026-05-07T08:00:00');
    expect(await Penalty.findOne({ rentDocument: due._id }).lean()).toMatchObject({ status: 'NOT_APPLICABLE', penaltyMinor: 0, corrections: [expect.objectContaining({ previous: expect.objectContaining({ status: 'PENDING_RECEIPT_CONFIRMATION' }) })] });
    await expect(receipts.cancelReceipt({ actor: { _id: owner._id }, receiptId: receipt._id, reason: 'x' })).rejects.toMatchObject({ code: 'DIRECT_RECEIPT_INVALID_TRANSITION' });
    await receipts.tenantRespond({ userId: tenantUser._id, receiptId: receipt._id, decision: 'contest', reason: 'Erreur de saisie' });
    expect((await FinancialDocument.findById(due._id).lean()).balanceMinor).toBe(150000);
    expect(await PaymentAllocation.findOne({ financialPayment: receipt.payment }).lean()).toMatchObject({ status: 'reversed' });
  });
});

describe('F-U2.13.I — biens clôturés', () => {
  async function managed(extra = {}, rm = {}) {
    const propertyId = oid();
    await Property.collection.insertOne({ _id: propertyId, title: 'Bien', owner: owner._id, tenant: null, availability: 'Disponible', ...extra });
    await RentalManagement.collection.insertOne({ property: propertyId, owner: owner._id, tenant: null, active: true, managementActivated: true, activeLease: oid(), occupancyStatus: 'occupe', workflowHistory: [], createdAt: wat('2026-01-01T00:00:00'), ...rm });
    return propertyId;
  }
  const holder = (sub) => ({ holderType: 'USER', holderId: owner._id, subscriptionType: 'IndividualSubscription', subscriptionId: sub._id });
  const period = (label) => ({ ...calendar.rentCalendar(label), label });
  test('clôture effective avant la période : exclue ; pendant la période : comptée ; sans date : à décider ; réactivation : comptée', async () => {
    const sub = await IndividualSubscription.create({ user: owner._id, plan: 'professionnel', status: 'active', startDate: wat('2026-01-01T00:00:00') });
    await managed();
    await managed({ assetCycle: 'vendu', availability: 'Vendu', assetCycleHistory: [{ from: 'en_location', to: 'vendu', action: 'sale', at: wat('2026-03-10T00:00:00') }] });
    expect((await autonomous.classifyHolder(holder(sub), { period: period('2026-04') }))).toMatchObject({ counted: 1, formula: 'GRATUIT', ambiguous: false });
    expect((await autonomous.classifyHolder(holder(sub), { period: period('2026-03') }))).toMatchObject({ counted: 2, formula: 'STANDARD' });
    await managed({ assetCycle: 'archive' });
    expect((await autonomous.classifyHolder(holder(sub), { period: period('2026-04') }))).toMatchObject({ ambiguous: true, reasons: expect.arrayContaining(['COUNTING_RULE_UNDECIDED']) });
    await managed({}, { workflowHistory: [{ action: 'rental_management_deactivated', at: wat('2026-02-01T00:00:00') }, { action: 'rental_management_enabled', at: wat('2026-02-20T00:00:00') }] });
    expect((await autonomous.inventoryPortfolio(holder(sub), { period: period('2026-04') })).counts.MANAGED_OCCUPIED).toBe(2);
  });
});

describe('F-U2.13.J — 1 % et 10 % selon la période du loyer', () => {
  async function agencyMandate(propertyId, effectiveFrom) {
    const b = await beneficiaries.registerBeneficiary({ actor: secretaireA.actor, ownerId: owner._id, kind: 'MOBILE_MONEY', holderName: 'Fictif', institution: 'MTN', accountIdentifier: `2420${Math.floor(10000000 + Math.random() * 89999999)}` });
    await beneficiaries.verifyBeneficiary({ actor: adminA.actor, beneficiaryId: b._id, method: 'Appel', evidence: [{ documentRef: 'doc://fictif' }] });
    const terms = {
      offer: 'DELEGATED_MANAGEMENT', currency: 'XAF', effectiveFrom: wat(effectiveFrom), legalReference: `M-${oid()}`, commission: { basisPoints: 1000, base: 'CONFIRMED_COLLECTED_RENT' },
      collectionMode: 'AGENCY_COLLECTION', payoutFrequency: 'MONTHLY', payoutBeneficiary: b._id,
      feeRules: [{ feeKind: 'COLLECTION', paymentMethod: 'cash', bearer: 'OWNER', pricing: { fixedMinor: 0, basisPoints: 0, tariffSourceReference: 'FIXTURE' } }],
      expenseCaps: { perInterventionMinor: 50000, monthlyCumulativeMinor: 100000, period: 'CALENDAR_MONTH' },
    };
    const { mandate } = await mandates.createMandate({ actor: adminA.actor, propertyId, ownerId: owner._id, reference: `R-${oid()}`, terms, idempotencyKey: `m-${oid()}` });
    return mandates.activateMandate({ actor: adminA.actor, mandateId: mandate._id });
  }
  test('loyer de juin (autonome) encaissé en juillet sous mandat : commission refusée, 1 % dû ; loyer de juillet : commission, jamais 1 %', async () => {
    const { leaseId, propertyId } = await lease({ org: true });
    const mandate = await agencyMandate(propertyId, '2026-07-01T00:00:00');
    const sub = await IndividualSubscription.create({ user: owner._id, plan: 'professionnel', status: 'active', startDate: wat('2026-01-01T00:00:00') });
    const mkDoc = async (label) => {
      const id = oid();
      await FinancialDocument.collection.insertOne({ _id: id, tenant: A.tenant._id, domain: 'rental', establishmentType: 'Property', establishmentId: propertyId, documentType: 'invoice', documentNumber: `LOY-${id}`, status: 'issued', paymentStatus: 'unpaid', currency: 'XAF', subjectType: 'Contrat', subjectId: leaseId, businessOperationKey: `rent:${leaseId}:${label}`, subtotalMinor: 150000, discountTotalMinor: 0, taxTotalMinor: 0, feesTotalMinor: 0, totalMinor: 150000, amountPaidMinor: 0, amountAllocatedMinor: 0, balanceMinor: 150000, createdBy: oid(), metadata: { billingKind: 'RENT', period: label, scope: { mandataryType: 'TENANT', tenant: A.tenant._id } }, createdAt: new Date(), updatedAt: new Date() });
      await mongoose.model('FinancialDocumentLine').create({ financialDocument: id, lineNumber: 1, lineType: 'rent', description: 'rent', quantity: 1, unitAmountMinor: 150000, subtotalMinor: 150000, totalMinor: 150000, sourceType: 'Contrat', sourceId: leaseId, createdBy: oid() });
      return FinancialDocument.findById(id).lean();
    };
    const pay = async (document) => {
      const p = await FinancialPayment.create({ tenant: A.tenant._id, domain: 'rental', establishmentType: 'Property', establishmentId: propertyId, paymentReference: `P-${oid()}`, status: 'succeeded', method: 'cash', provider: 'manual', currency: 'XAF', amountMinor: 150000, availableAmountMinor: 150000, confirmedAt: new Date(), createdBy: adminA.user._id });
      await allocatePaymentToDocument({ paymentId: p._id, documentId: document._id, amountMinor: 150000, businessOperationKey: `a-${oid()}`, actor: adminA.user, transactionMode: 'transactional' });
      return p;
    };
    const june = await mkDoc('2026-06'); const july = await mkDoc('2026-07');
    const pJune = await pay(june); const pJuly = await pay(july);
    await expect(funds.recognizeAgencyCollection({ actor: adminA.actor, mandateId: mandate._id, financialPaymentId: pJune._id, rentPeriod: { month: 6, year: 2026 }, leaseId })).rejects.toMatchObject({ code: 'COLLECTION_PERIOD_OUTSIDE_MANDATE' });
    const { collection: julyCollection } = await funds.recognizeAgencyCollection({ actor: adminA.actor, mandateId: mandate._id, financialPaymentId: pJuly._id, rentPeriod: { month: 7, year: 2026 }, leaseId });
    expect(julyCollection.breakdown.commissionMinor).toBe(15000);
    const label = (() => { const d = calendar.localDay(new Date()); return `${d.year}-${String(d.month).padStart(2, '0')}`; })();
    const orgHolder = { holderType: 'TENANT', holderId: A.tenant._id, subscriptionType: 'IndividualSubscription', subscriptionId: sub._id };
    const result = await autonomous.accrueVariableFees({ holder: orgHolder, period: { ...calendar.rentCalendar(label), label }, now: new Date(Date.now() + 1000) });
    expect(result).toMatchObject({ accrued: 1, excludedDelegated: 1 });
    expect(await Accrual.find({ kind: 'FEE' }).lean()).toEqual([expect.objectContaining({ rentDocument: june._id, feeMinor: 1500 })]);
  });
});

describe('F-U2.13.K — sécurité des API', () => {
  test('consultation des politiques : locataire et bailleur oui ; autre organisation, plateforme sans mandat, autre locataire : non', async () => {
    const { leaseId } = await lease({ org: true });
    await policies.createPolicy({ actor: adminA.actor, leaseId, type: 'OWNER_AUTONOMOUS', terms: {}, effectiveFrom: wat('2026-01-01T00:00:00'), documentReference: 'x', now: EARLY });
    expect((await request(app).get(`/tenant-portal/lease-policies`).set('Authorization', token(tenantUser))).body.data.policies).toHaveLength(1);
    expect((await request(app).get(`/tenant-portal/lease-policies`).set('Authorization', token(otherTenantUser))).status).toBe(404);
    expect((await policies.listLeasePolicies({ actor: { _id: owner._id }, leaseId })).length).toBe(1);
    await expect(policies.listLeasePolicies({ actor: adminB.actor, leaseId })).rejects.toMatchObject({ statusCode: expect.any(Number) });
    await expect(policies.listLeasePolicies({ actor: platformOp.actor, leaseId })).rejects.toMatchObject({ statusCode: expect.any(Number) });
    await expect(policies.listLeasePolicies({ actor: { _id: otherOwner._id } , leaseId })).rejects.toMatchObject({ statusCode: expect.any(Number) });
    const create = await request(app).post('/billing/lease-policies').set('Authorization', token(otherOwner)).send({ leaseId: String(leaseId), type: 'OWNER_AUTONOMOUS', terms: {}, effectiveFrom: new Date(Date.now() + 86400000).toISOString(), documentReference: 'x' });
    expect([403, 404]).toContain(create.status);
  });
});
