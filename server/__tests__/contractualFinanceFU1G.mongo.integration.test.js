// F-U1.G — matrice d'autorisation contractuelle, autorité du propriétaire et
// de ses représentants, séparation des fonctions sur l'identité humaine,
// OWNER_DIRECT sans preuve suffisante, surface HTTP v1 (vrai replica set).
process.env.FINANCIAL_BENEFICIARY_FINGERPRINT_KEY = 'f-u1-test-fingerprint-key-0123456789abcdef';
const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const { startFinancialMongo, clearFinancialMongo, stopFinancialMongo } = require('./helpers/financialMongoEnvironment');
const { createTenantFixture, createTenantUser, tenantActor } = require('./helpers/tenantAwareFixture');
const User = require('../models/User');
const Property = require('../models/Property');
const PlatformOperator = require('../models/PlatformOperator');
const RentalMaintenanceTicket = require('../models/RentalMaintenanceTicket');
const FinancialPayment = require('../models/FinancialPayment');
const FinancialDocument = require('../models/FinancialDocument');
const PaymentAllocation = require('../models/PaymentAllocation');
const ManagementMandate = require('../models/ManagementMandate');
const ManagementMandateVersion = require('../models/ManagementMandateVersion');
const MandateExpense = require('../models/MandateExpense');
const ExpenseAuthorization = require('../models/ExpenseAuthorization');
const MandateCollection = require('../models/MandateCollection');
const OwnerFinancialObligation = require('../models/OwnerFinancialObligation');
const OwnerRepresentation = require('../models/OwnerRepresentation');
const ContractualFinanceGrant = require('../models/ContractualFinanceGrant');
const { PLATFORM_WIDE_CONTEXT_SOURCE } = require('../constants/platformOperatorConstants');
const mandates = require('../services/finance/contractual/managementMandateService');
const beneficiaries = require('../services/finance/contractual/financialBeneficiaryService');
const expenses = require('../services/finance/contractual/mandateExpenseService');
const funds = require('../services/finance/contractual/ownerFundsService');
const refunds = require('../services/finance/contractual/refundGovernanceService');
const owners = require('../services/finance/contractual/ownerAuthorityService');
const grants = require('../services/finance/contractual/contractualFinanceGrantService');
const { activeGrantFixture } = require('./helpers/contractualGrantFixture');
const { CONTRACTUAL_CAPABILITIES: CAP, SENSITIVE_CAPABILITIES } = require('../services/finance/contractual/contractualFinanceAuthorizationService');
const { errorHandler } = require('../middleware/errorMiddleware');
const routes = require('../routes/contractualFinanceRoutes');

const app = express(); app.use(express.json()); app.use('/v1', routes); app.use(errorHandler);
jest.setTimeout(180000);
const oid = () => new mongoose.Types.ObjectId();
const DAY = 86400000;
let seq = 0;
let A; let B; let admin1; let admin2; let admin3; let bareAdmin; let gestionnaire; let secretaire; let adminB; let owner; let otherOwner;

beforeAll(async () => {
  await startFinancialMongo();
  await Promise.all([ManagementMandate, ManagementMandateVersion, MandateExpense, ExpenseAuthorization, MandateCollection, OwnerFinancialObligation, OwnerRepresentation, ContractualFinanceGrant].map((model) => model.syncIndexes()));
});
afterAll(stopFinancialMongo);

async function member(fixture, businessRole, overrides = {}) {
  const { user } = await createTenantUser({ ...fixture, businessRole, overrides: { role: 'Client', ...overrides } });
  return { user, actor: tenantActor(user, fixture.tenant) };
}
async function plainUser(role = 'Proprietaire', overrides = {}) {
  seq += 1;
  return User.create({ name: `User ${seq}`, email: `fu1g-${Date.now()}-${seq}@example.test`, password: 'Password123!', passwordConfirm: 'Password123!', role, isEmailVerified: true, ...overrides });
}
async function property(tenant, ownerId) {
  const _id = oid();
  await Property.collection.insertOne({ _id, title: `Bien ${_id}`, owner: ownerId, tenant: tenant ? tenant._id : null, status: 'location' });
  return _id;
}
const ticket = (propertyId) => RentalMaintenanceTicket.create({ property: propertyId, category: 'plomberie', description: 'Fuite' });
const ownerActor = (user, tenant = null) => ({ _id: user._id, role: user.role, platformTenant: tenant });
const token = (user) => `Bearer ${jwt.sign({ id: user._id, tokenVersion: 0 }, process.env.JWT_SECRET)}`;

beforeEach(async () => {
  await clearFinancialMongo();
  A = await createTenantFixture({ label: 'FU1G A' }); B = await createTenantFixture({ label: 'FU1G B' });
  admin1 = await member(A, 'Admin'); admin2 = await member(A, 'Admin'); admin3 = await member(A, 'Admin'); bareAdmin = await member(A, 'Admin');
  gestionnaire = await member(A, 'GestionnaireImmobilier'); secretaire = await member(A, 'Secretaire');
  adminB = await member(B, 'Admin');
  owner = await plainUser(); otherOwner = await plainUser();
  for (const capability of SENSITIVE_CAPABILITIES) {
    for (const admin of [admin1, admin2, admin3]) await activeGrantFixture({ user: admin.user, capability, tenant: A.tenant });
  }
});

const terms = (overrides = {}) => ({
  offer: 'DELEGATED_MANAGEMENT', currency: 'XAF', effectiveFrom: new Date(Date.now() - 30 * DAY), legalReference: `M-${oid()}`,
  commission: { basisPoints: 1000, base: 'CONFIRMED_COLLECTED_RENT' }, collectionMode: 'AGENCY_COLLECTION', payoutFrequency: 'MONTHLY',
  feeRules: [{ feeKind: 'COLLECTION', paymentMethod: 'cash', bearer: 'OWNER', pricing: { fixedMinor: 0, basisPoints: 0, tariffSourceReference: 'FIXTURE-TEST' } }],
  expenseCaps: { perInterventionMinor: 60000, monthlyCumulativeMinor: 100000, period: 'CALENDAR_MONTH' }, ...overrides,
});
async function activeMandate({ ownerUser = owner, collectionMode = 'AGENCY_COLLECTION' } = {}) {
  const b = await beneficiaries.registerBeneficiary({ actor: secretaire.actor, ownerId: ownerUser._id, kind: 'MOBILE_MONEY', holderName: 'O', institution: 'MTN', accountIdentifier: `2420${Math.floor(10000000 + Math.random() * 89999999)}` });
  await beneficiaries.verifyBeneficiary({ actor: admin1.actor, beneficiaryId: b._id, method: 'Appel', evidence: [{ documentRef: 'doc://rib' }] });
  const propertyId = await property(A.tenant, ownerUser._id);
  const t = collectionMode === 'AGENCY_COLLECTION' ? terms({ payoutBeneficiary: b._id }) : terms({ collectionMode, payoutFrequency: undefined, ownerDirectAccount: b._id });
  const { mandate } = await mandates.createMandate({ actor: admin1.actor, propertyId, ownerId: ownerUser._id, reference: `R-${oid()}`, terms: t, idempotencyKey: `c-${oid()}` });
  return { mandate: await mandates.activateMandate({ actor: admin1.actor, mandateId: mandate._id }), propertyId };
}
async function pendingExpense({ mandate, propertyId, requester = gestionnaire }) {
  const t = await ticket(propertyId);
  return (await expenses.requestExpense({ actor: requester.actor, mandateId: mandate._id, interventionId: t._id, category: 'p', description: 'gros œuvre', amountMinor: 90000, idempotencyKey: `e-${oid()}` })).expense;
}
const approve = (actor, expense) => expenses.decideExpenseInApp({ actor, expenseId: expense._id, decision: 'approve', maxAmountMinor: expense.requestedAmountMinor });

// ─── Matrice ──────────────────────────────────────────────────────────

describe('F-U1.G — matrice des capacités', () => {
  test('Admin sans octroi : aucune capacité sensible ; octroi révoqué : retrait immédiat', async () => {
    const { mandate, propertyId } = await activeMandate();
    const pending = await beneficiaries.registerBeneficiary({ actor: secretaire.actor, ownerId: owner._id, kind: 'BANK_ACCOUNT', holderName: 'O', institution: 'Banque', accountIdentifier: 'CG00011122233' });
    await expect(beneficiaries.verifyBeneficiary({ actor: bareAdmin.actor, beneficiaryId: pending._id, method: 'm', evidence: [{ documentRef: 'd' }] })).rejects.toMatchObject({ code: 'FINANCIAL_UNAUTHORIZED' });
    const expense = await pendingExpense({ mandate, propertyId });
    const submission = await expenses.submitWrittenAuthorization({ actor: gestionnaire.actor, expenseId: expense._id, maxAmountMinor: 90000, document: { documentRef: 'd', signedAt: new Date(), signatoryName: 'O' }, scope: { mandateId: mandate._id, propertyId, interventionId: expense.intervention } });
    await expect(expenses.authenticateWrittenAuthorization({ actor: bareAdmin.actor, submissionId: submission._id, verification: { result: 'verified', method: 'm' } })).rejects.toMatchObject({ code: 'FINANCIAL_UNAUTHORIZED' });
    await expect(refunds.draftRefundPolicy({ actor: bareAdmin.actor, activity: 'HOSPITALITY', currency: 'XAF', ownerConsentRequired: false })).rejects.toMatchObject({ code: 'FINANCIAL_UNAUTHORIZED' });
    const grant = await ContractualFinanceGrant.findOne({ user: admin3.user._id, capability: CAP.WRITTEN_AUTHORIZATION_VERIFY });
    await grants.revokeGrant({ actor: admin1.actor, grantId: grant._id, reason: 'Fin de mission' });
    await expect(expenses.authenticateWrittenAuthorization({ actor: admin3.actor, submissionId: submission._id, verification: { result: 'verified', method: 'm' } })).rejects.toMatchObject({ code: 'FINANCIAL_UNAUTHORIZED' });
  });

  test('Gestionnaire immobilier : dépenses dans son tenant uniquement, rien d’autre', async () => {
    const { mandate, propertyId } = await activeMandate();
    const t = await ticket(propertyId);
    await expect(expenses.requestExpense({ actor: gestionnaire.actor, mandateId: mandate._id, interventionId: t._id, category: 'p', description: 'x', amountMinor: 1000, idempotencyKey: 'g1' })).resolves.toBeDefined();
    await expect(mandates.suspendMandate({ actor: gestionnaire.actor, mandateId: mandate._id, reason: 'x' })).rejects.toMatchObject({ code: 'FINANCIAL_UNAUTHORIZED' });
    await expect(funds.declareOwnerDirectCollection({ actor: gestionnaire.actor, mandateId: mandate._id, amountMinor: 1, paidAt: new Date(), rentPeriod: { month: 1, year: 2026 }, idempotencyKey: 'x' })).rejects.toMatchObject({ code: 'FINANCIAL_UNAUTHORIZED' });
    const gestionnaireB = await member(B, 'GestionnaireImmobilier');
    await expect(expenses.requestExpense({ actor: gestionnaireB.actor, mandateId: mandate._id, interventionId: t._id, category: 'p', description: 'x', amountMinor: 1000, idempotencyKey: 'g2' })).rejects.toMatchObject({ code: 'FINANCIAL_RESOURCE_OUT_OF_SCOPE' });
  });

  test('Secrétaire : prépare un remboursement mais ne l’approuve jamais', async () => {
    const hotelId = oid(); const reservation = oid();
    const doc = await FinancialDocument.create({ tenant: A.tenant._id, domain: 'hotel', establishmentType: 'Hotel', establishmentId: hotelId, documentType: 'invoice', documentNumber: `FA-${oid()}`, status: 'issued', currency: 'XAF', subjectType: 'HotelReservation', subjectId: reservation, totalMinor: 50000, businessOperationKey: `d-${oid()}`, createdBy: admin1.user._id });
    const payment = await FinancialPayment.create({ tenant: A.tenant._id, domain: 'hotel', establishmentType: 'Hotel', establishmentId: hotelId, paymentReference: `P-${oid()}`, status: 'succeeded', method: 'cash', currency: 'XAF', amountMinor: 50000, allocatedAmountMinor: 50000, availableAmountMinor: 0, subjectType: 'HotelReservation', subjectId: reservation, createdBy: admin1.user._id });
    await PaymentAllocation.create({ tenant: A.tenant._id, financialPayment: payment._id, financialDocument: doc._id, domain: 'hotel', establishmentType: 'Hotel', establishmentId: hotelId, currency: 'XAF', amountMinor: 50000, businessOperationKey: `a-${oid()}`, allocatedBy: admin1.user._id });
    const { refund } = await refunds.requestGovernedRefund({ actor: secretaire.actor, financialPaymentId: payment._id, amountMinor: 1000, activity: 'HOSPITALITY', reason: 'Annulation', idempotencyKey: 'r1' });
    await expect(refunds.decideGovernedRefund({ actor: secretaire.actor, refundId: refund._id, decision: 'approve' })).rejects.toMatchObject({ code: 'FINANCIAL_UNAUTHORIZED' });
    await expect(refunds.decideGovernedRefund({ actor: bareAdmin.actor, refundId: refund._id, decision: 'approve' })).rejects.toMatchObject({ code: 'FINANCIAL_UNAUTHORIZED' });
    // Identité humaine : un second compte portant le téléphone du premier approbateur.
    await User.updateOne({ _id: admin1.user._id }, { phone: '+242 06 555 12 34' });
    await User.updateOne({ _id: admin3.user._id }, { phone: '242065551234' });
    await refunds.decideGovernedRefund({ actor: admin1.actor, refundId: refund._id, decision: 'approve' });
    await expect(refunds.decideGovernedRefund({ actor: admin1.actor, refundId: refund._id, decision: 'approve' })).rejects.toMatchObject({ code: 'REFUND_DUPLICATE_APPROVER' });
    await expect(refunds.decideGovernedRefund({ actor: admin3.actor, refundId: refund._id, decision: 'approve' })).rejects.toMatchObject({ code: 'FINANCIAL_SEGREGATION_OF_DUTIES' });
    expect((await refunds.decideGovernedRefund({ actor: admin2.actor, refundId: refund._id, decision: 'approve' })).status).toBe('approved');
  });

  test('opérateur plateforme : capacité insuffisante refusée ; finance.manage ne remplace jamais le propriétaire', async () => {
    const { mandate, propertyId } = await activeMandate();
    const reader = await plainUser('Client'); const manager = await plainUser('Client');
    await PlatformOperator.create({ user: reader._id, status: 'active', capabilities: ['platform.finance.read'], grantedBy: A.bootstrap._id, grantReason: 'Test' });
    await PlatformOperator.create({ user: manager._id, status: 'active', capabilities: ['platform.finance.manage', 'platform.rentals.manage'], grantedBy: A.bootstrap._id, grantReason: 'Test' });
    const readerInA = { _id: reader._id, platformTenant: A.tenant }; const managerInA = { _id: manager._id, platformTenant: A.tenant };
    await expect(mandates.suspendMandate({ actor: readerInA, mandateId: mandate._id, reason: 'x' })).rejects.toMatchObject({ code: 'FINANCIAL_UNAUTHORIZED' });
    const expense = await pendingExpense({ mandate, propertyId });
    await expect(approve(managerInA, expense)).rejects.toMatchObject({ code: 'FINANCIAL_OWNER_REQUIRED' });
    await expect(approve({ _id: manager._id, tenantContextSource: PLATFORM_WIDE_CONTEXT_SOURCE }, expense)).rejects.toMatchObject({ code: 'FINANCIAL_OWNER_REQUIRED' });
    await expect(approve(admin1.actor, expense)).rejects.toMatchObject({ code: 'FINANCIAL_OWNER_REQUIRED' });
    const submission = await expenses.submitWrittenAuthorization({ actor: gestionnaire.actor, expenseId: expense._id, maxAmountMinor: 90000, document: { documentRef: 'd', signedAt: new Date(), signatoryName: 'O' }, scope: { mandateId: mandate._id, propertyId, interventionId: expense.intervention } });
    await expect(expenses.authenticateWrittenAuthorization({ actor: managerInA, submissionId: submission._id, verification: { result: 'verified', method: 'm' } })).rejects.toMatchObject({ code: 'FINANCIAL_UNAUTHORIZED' });
    expect((await MandateExpense.findById(expense._id)).status).toBe('pending_owner_authorization');
  });
});

// ─── Propriétaires et représentants ───────────────────────────────────

describe('F-U1.G — autorité du propriétaire', () => {
  test('propriétaire sans organisation : décide ; un autre propriétaire est refusé', async () => {
    const { mandate, propertyId } = await activeMandate();
    const expense = await pendingExpense({ mandate, propertyId });
    await expect(approve(ownerActor(otherOwner), expense)).rejects.toMatchObject({ code: 'FINANCIAL_OWNER_REQUIRED' });
    const result = await approve(ownerActor(owner), expense);
    expect(result.authorization).toMatchObject({ phase: 'DECISION', effective: true, representation: null });
    expect(String(result.authorization.onBehalfOf)).toBe(String(owner._id));
  });

  test('propriétaire membre d’une organisation : décide quel que soit son contexte, jamais sur sa propre demande', async () => {
    const staffOwner = await member(A, 'GestionnaireImmobilier', { role: 'Proprietaire' });
    const { mandate, propertyId } = await activeMandate({ ownerUser: staffOwner.user });
    const byColleague = await pendingExpense({ mandate, propertyId });
    expect((await approve(ownerActor(staffOwner.user, B.tenant), byColleague)).expense.status).toBe('authorized');
    const byHimself = await pendingExpense({ mandate, propertyId, requester: staffOwner });
    await expect(approve(staffOwner.actor, byHimself)).rejects.toMatchObject({ code: 'FINANCIAL_SEGREGATION_OF_DUTIES' });
  });

  test('lien rompu avec le bien ou mandat suspendu : autorité suspendue', async () => {
    const { mandate, propertyId } = await activeMandate();
    const expense = await pendingExpense({ mandate, propertyId });
    await mandates.suspendMandate({ actor: admin1.actor, mandateId: mandate._id, reason: 'Contrôle' });
    await expect(approve(ownerActor(owner), expense)).rejects.toMatchObject({ code: 'MANDATE_NOT_ACTIVE' });
    await mandates.activateMandate({ actor: admin1.actor, mandateId: mandate._id });
    await Property.collection.updateOne({ _id: propertyId }, { $set: { owner: otherOwner._id } });
    await expect(approve(ownerActor(owner), expense)).rejects.toMatchObject({ code: 'OWNER_LINK_BROKEN' });
  });

  test('représentant habilité : portée exacte, pouvoir, mandat, révocation, conflit de rôle', async () => {
    const { mandate, propertyId } = await activeMandate();
    const other = (await activeMandate()).mandate;
    const rep = await plainUser('Client');
    const representation = await owners.designateRepresentative({ actor: ownerActor(owner), representativeUserId: rep._id, mandateIds: [mandate._id], powers: ['VIEW', 'EXPENSE_DECISION'], validUntil: new Date(Date.now() + 30 * DAY) });
    const expense = await pendingExpense({ mandate, propertyId });
    const viaRep = await approve(ownerActor(rep), expense);
    expect(String(viaRep.authorization.representation)).toBe(String(representation._id));
    expect(String(viaRep.authorization.decidedBy)).toBe(String(rep._id));
    const otherExpense = await pendingExpense({ mandate: other, propertyId: other.property });
    await expect(approve(ownerActor(rep), otherExpense)).rejects.toMatchObject({ code: 'FINANCIAL_OWNER_REQUIRED' });
    const viewOnly = await plainUser('Client');
    await owners.designateRepresentative({ actor: ownerActor(owner), representativeUserId: viewOnly._id, mandateIds: [mandate._id], powers: ['VIEW'], validUntil: new Date(Date.now() + DAY) });
    const third = await pendingExpense({ mandate, propertyId });
    await expect(approve(ownerActor(viewOnly), third)).rejects.toMatchObject({ code: 'FINANCIAL_OWNER_REQUIRED' });
    await expect(owners.designateRepresentative({ actor: ownerActor(rep), representativeUserId: viewOnly._id, mandateIds: [mandate._id], powers: ['VIEW'], validUntil: new Date(Date.now() + DAY) })).rejects.toMatchObject({ code: 'REPRESENTATION_SCOPE_INVALID' });
    await expect(owners.designateRepresentative({ actor: ownerActor(owner), representativeUserId: gestionnaire.user._id, mandateIds: [mandate._id], powers: ['EXPENSE_DECISION'], validUntil: new Date(Date.now() + DAY) })).rejects.toMatchObject({ code: 'REPRESENTATION_ROLE_CONFLICT' });
    await owners.revokeRepresentation({ actor: ownerActor(owner), representationId: representation._id, reason: 'Fin' });
    await expect(approve(ownerActor(rep), third)).rejects.toMatchObject({ code: 'FINANCIAL_OWNER_REQUIRED' });
    // Le représentant devenu membre du mandataire perd son autorité.
    const rep2 = await plainUser('Client');
    await owners.designateRepresentative({ actor: ownerActor(owner), representativeUserId: rep2._id, mandateIds: [mandate._id], powers: ['EXPENSE_DECISION'], validUntil: new Date(Date.now() + DAY) });
    const organizationService = require('../services/organizationService');
    await organizationService.grantMembership({ userId: rep2._id, orgUnitId: A.tenant.rootOrgUnit, businessRole: 'Communicant', actor: A.bootstrap });
    await expect(approve(ownerActor(rep2), third)).rejects.toMatchObject({ code: 'REPRESENTATION_ROLE_CONFLICT' });
  });

  test('procuration écrite : sans effet tant qu’elle n’est pas vérifiée par une personne distincte', async () => {
    const { mandate, propertyId } = await activeMandate();
    const rep = await plainUser('Client');
    const proxy = await owners.registerWrittenProxy({ actor: secretaire.actor, ownerId: owner._id, representativeUserId: rep._id, mandateIds: [mandate._id], powers: ['EXPENSE_DECISION'], validUntil: new Date(Date.now() + DAY), document: { documentRef: 'doc://procuration', signedAt: new Date() } });
    const expense = await pendingExpense({ mandate, propertyId });
    await expect(approve(ownerActor(rep), expense)).rejects.toMatchObject({ code: 'FINANCIAL_OWNER_REQUIRED' });
    await expect(owners.verifyWrittenProxy({ actor: secretaire.actor, representationId: proxy._id, method: 'm' })).rejects.toMatchObject({ code: 'FINANCIAL_UNAUTHORIZED' });
    await owners.verifyWrittenProxy({ actor: admin1.actor, representationId: proxy._id, method: 'Rappel du propriétaire' });
    expect((await approve(ownerActor(rep), expense)).expense.status).toBe('authorized');
  });

  test('consentement propriétaire au remboursement : ni staff ni opérateur ne le remplacent', async () => {
    const { mandate, propertyId } = await activeMandate();
    const payment = await FinancialPayment.create({ tenant: A.tenant._id, domain: 'rental', establishmentType: 'Property', establishmentId: propertyId, paymentReference: `P-${oid()}`, status: 'succeeded', method: 'cash', currency: 'XAF', amountMinor: 150000, availableAmountMinor: 0, confirmedAt: new Date(), createdBy: admin1.user._id });
    await funds.recognizeAgencyCollection({ actor: secretaire.actor, mandateId: mandate._id, financialPaymentId: payment._id, rentPeriod: { month: 10, year: 2026 } });
    const doc = await FinancialDocument.create({ tenant: A.tenant._id, domain: 'rental', establishmentType: 'Property', establishmentId: propertyId, documentType: 'receipt', status: 'issued', currency: 'XAF', subjectType: 'Transaction', subjectId: oid(), totalMinor: 150000, businessOperationKey: `d-${oid()}`, createdBy: admin1.user._id });
    await PaymentAllocation.create({ tenant: A.tenant._id, financialPayment: payment._id, financialDocument: doc._id, domain: 'rental', establishmentType: 'Property', establishmentId: propertyId, currency: 'XAF', amountMinor: 150000, businessOperationKey: `a-${oid()}`, allocatedBy: admin1.user._id });
    const policy = await refunds.draftRefundPolicy({ actor: admin1.actor, activity: 'RENTAL_MANAGEMENT', currency: 'XAF', standardApprovalMaxMinor: 50000, ownerConsentRequired: true, decisionReference: 'Décision test' });
    await refunds.activateRefundPolicy({ actor: admin2.actor, policyId: policy._id });
    const { refund } = await refunds.requestGovernedRefund({ actor: secretaire.actor, financialPaymentId: payment._id, amountMinor: 10000, activity: 'RENTAL_MANAGEMENT', reason: 'Trop-perçu', idempotencyKey: 'rc' });
    expect(refund.governance.ownerConsent).toMatchObject({ isRequired: true, status: 'pending' });
    const operator = await plainUser('Client');
    await PlatformOperator.create({ user: operator._id, status: 'active', capabilities: ['platform.finance.manage'], grantedBy: A.bootstrap._id, grantReason: 'Test' });
    await expect(refunds.recordOwnerRefundConsent({ actor: { _id: operator._id, platformTenant: A.tenant }, refundId: refund._id, decision: 'give' })).rejects.toMatchObject({ code: 'FINANCIAL_OWNER_REQUIRED' });
    await expect(refunds.recordOwnerRefundConsent({ actor: admin1.actor, refundId: refund._id, decision: 'give' })).rejects.toMatchObject({ code: 'FINANCIAL_OWNER_REQUIRED' });
    const approved = await refunds.decideGovernedRefund({ actor: admin1.actor, refundId: refund._id, decision: 'approve' });
    expect(approved.status).toBe('pending_approval');
    const consented = await refunds.recordOwnerRefundConsent({ actor: ownerActor(owner), refundId: refund._id, decision: 'give' });
    expect(consented.status).toBe('approved');
  });
});

// ─── OWNER_DIRECT ─────────────────────────────────────────────────────

describe('F-U1.G — OWNER_DIRECT sans preuve suffisante', () => {
  test('confirmation propriétaire = attente de vérification ; reçu propriétaire insuffisant ; montant vérifié', async () => {
    const { mandate } = await activeMandate({ collectionMode: 'OWNER_DIRECT' });
    const { collection } = await funds.declareOwnerDirectCollection({ actor: secretaire.actor, mandateId: mandate._id, amountMinor: 200000, paidAt: new Date(), rentPeriod: { month: 10, year: 2026 }, paymentMethod: 'mobile_money', reference: 'TX-9', evidence: [{ documentRef: 'doc://capture', kind: 'OWNER_RECEIPT' }], idempotencyKey: 'od1' });
    await expect(funds.confirmOwnerDirectByOwner({ actor: ownerActor(otherOwner), collectionId: collection._id })).rejects.toMatchObject({ code: 'FINANCIAL_OWNER_REQUIRED' });
    const confirmed = await funds.confirmOwnerDirectByOwner({ actor: ownerActor(owner), collectionId: collection._id });
    expect(confirmed).toMatchObject({ awaitingVerification: true, collection: expect.objectContaining({ status: 'owner_confirmed' }) });
    expect(await OwnerFinancialObligation.countDocuments()).toBe(0);
    await expect(funds.reconcileOwnerDirectCollection({ actor: bareAdmin.actor, collectionId: collection._id, decision: 'confirm', evidence: [{ documentRef: 'x', kind: 'MOBILE_MONEY_STATEMENT' }], providerReference: 'TX-9', verifiedAmountMinor: 200000, verifiedPaidAt: new Date() })).rejects.toMatchObject({ code: 'FINANCIAL_UNAUTHORIZED' });
    await expect(funds.reconcileOwnerDirectCollection({ actor: admin1.actor, collectionId: collection._id, decision: 'confirm', providerReference: 'TX-9', verifiedAmountMinor: 200000, verifiedPaidAt: new Date() })).rejects.toMatchObject({ code: 'RECONCILIATION_EVIDENCE_INSUFFICIENT' });
    await expect(funds.reconcileOwnerDirectCollection({ actor: admin1.actor, collectionId: collection._id, decision: 'confirm', evidence: [{ documentRef: 'x', kind: 'MOBILE_MONEY_STATEMENT' }], verifiedAmountMinor: 200000, verifiedPaidAt: new Date() })).rejects.toMatchObject({ code: 'RECONCILIATION_EVIDENCE_INSUFFICIENT' });
    await expect(funds.reconcileOwnerDirectCollection({ actor: admin1.actor, collectionId: collection._id, decision: 'confirm', evidence: [{ documentRef: 'x', kind: 'MOBILE_MONEY_STATEMENT' }], providerReference: 'TX-9', verifiedAmountMinor: 190000, verifiedPaidAt: new Date() })).rejects.toMatchObject({ code: 'RECONCILIATION_AMOUNT_MISMATCH' });
    expect((await MandateCollection.findById(collection._id)).status).toBe('owner_confirmed');
    expect(await OwnerFinancialObligation.countDocuments()).toBe(0);
    const { obligation } = await funds.reconcileOwnerDirectCollection({ actor: admin1.actor, collectionId: collection._id, decision: 'confirm', evidence: [{ documentRef: 'doc://releve', kind: 'MOBILE_MONEY_STATEMENT' }], providerReference: 'TX-9', verifiedAmountMinor: 200000, verifiedPaidAt: new Date() });
    expect(obligation).toMatchObject({ type: 'COMMISSION_RECEIVABLE', netAmountMinor: 20000 });
  });

  test('le déclarant ne peut pas rapprocher sa propre déclaration', async () => {
    const { mandate } = await activeMandate({ collectionMode: 'OWNER_DIRECT' });
    const { collection } = await funds.declareOwnerDirectCollection({ actor: admin1.actor, mandateId: mandate._id, amountMinor: 1000, paidAt: new Date(), rentPeriod: { month: 10, year: 2026 }, idempotencyKey: 'od2' });
    await expect(funds.reconcileOwnerDirectCollection({ actor: admin1.actor, collectionId: collection._id, decision: 'confirm', evidence: [{ documentRef: 'x', kind: 'BANK_STATEMENT' }], providerReference: 'R', verifiedAmountMinor: 1000, verifiedPaidAt: new Date() })).rejects.toMatchObject({ code: 'FINANCIAL_SEGREGATION_OF_DUTIES' });
  });
});

// ─── HTTP v1 ──────────────────────────────────────────────────────────

describe('F-U1.G — surface HTTP v1', () => {
  const tenantHeader = (fixture) => ({ 'X-Platform-Tenant-Id': String(fixture.tenant._id) });

  test('propriétaire sans organisation : lit son mandat et décide via HTTP ; autre propriétaire 403', async () => {
    const { mandate, propertyId } = await activeMandate();
    const read = await request(app).get(`/v1/mandates/${mandate._id}`).set('Authorization', token(owner));
    expect(read.status).toBe(200);
    expect(read.body.data).toMatchObject({ viewer: 'OWNER_SIDE', status: 'active' });
    expect(JSON.stringify(read.body)).not.toContain('accountFingerprint');
    const expense = await pendingExpense({ mandate, propertyId });
    const denied = await request(app).post(`/v1/expenses/${expense._id}/owner-decision`).set('Authorization', token(otherOwner)).send({ decision: 'approve', maxAmountMinor: 90000 });
    expect(denied.status).toBe(403);
    const ok = await request(app).post(`/v1/expenses/${expense._id}/owner-decision`).set('Authorization', token(owner)).send({ decision: 'approve', maxAmountMinor: 90000, ownerId: String(otherOwner._id) });
    expect(ok.status).toBe(200);
    expect(ok.body.data.expense.status).toBe('authorized');
  });

  test('inter-tenant et en-tête de tenant usurpé : refus fermé', async () => {
    const { mandate } = await activeMandate();
    const crossRead = await request(app).get(`/v1/mandates/${mandate._id}`).set('Authorization', token(adminB.user)).set(tenantHeader(B));
    expect(crossRead.status).toBe(404);
    const spoof = await request(app).get(`/v1/mandates/${mandate._id}`).set('Authorization', token(adminB.user)).set(tenantHeader(A));
    expect([403, 404]).toContain(spoof.status);
    const staffRead = await request(app).get(`/v1/mandates/${mandate._id}`).set('Authorization', token(gestionnaire.user)).set(tenantHeader(A));
    expect(staffRead.status).toBe(200);
    expect(staffRead.body.data.viewer).toBe('STAFF');
  });

  test('création de mandat : clé d’idempotence requise, tenant du body ignoré', async () => {
    const propertyId = await property(A.tenant, owner._id);
    const b = await beneficiaries.registerBeneficiary({ actor: secretaire.actor, ownerId: owner._id, kind: 'MOBILE_MONEY', holderName: 'O', institution: 'MTN', accountIdentifier: '242061234999' });
    const body = { propertyId: String(propertyId), ownerId: String(owner._id), reference: 'HTTP-1', tenant: String(B.tenant._id), mandataryType: 'PLATFORM', terms: terms({ payoutBeneficiary: String(b._id) }) };
    const missingKey = await request(app).post('/v1/mandates').set('Authorization', token(admin1.user)).set(tenantHeader(A)).send(body);
    expect(missingKey.status).toBe(422);
    const created = await request(app).post('/v1/mandates').set('Authorization', token(admin1.user)).set(tenantHeader(A)).set('Idempotency-Key', 'http-1').send(body);
    expect(created.status).toBe(201);
    expect(created.body.data.mandate).toMatchObject({ mandataryType: 'TENANT', tenant: String(A.tenant._id) });
    const bySecretary = await request(app).post('/v1/mandates').set('Authorization', token(secretaire.user)).set(tenantHeader(A)).set('Idempotency-Key', 'http-2').send(body);
    expect(bySecretary.status).toBe(403);
  });

  test.each([
    ['post', '/v1/refunds/x/approve'], ['post', '/v1/refunds/x/execute'], ['post', '/v1/refunds/x/owner-consent'], ['post', '/v1/refunds/x/release'],
    ['post', '/v1/payouts/x/execute'], ['post', '/v1/refund-policies/x/activate'], ['post', '/v1/grants/bootstrap'], ['post', '/v1/identity-attestations'],
  ])('route volontairement non exposée : %s %s', async (method, path) => {
    const response = await request(app)[method](path).set('Authorization', token(admin1.user)).set(tenantHeader(A)).send({});
    expect(response.status).toBe(404);
  });
});
