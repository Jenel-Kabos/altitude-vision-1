// F-U1 — intégration sur vrai replica set MongoDB (aucun mock de modèle).
// Couvre mandats, double plafond (y compris concurrence), autorisations du
// propriétaire, séparation des fonds, gouvernance des remboursements,
// isolation multi-tenant et compatibilité des flux hôteliers existants.
process.env.FINANCIAL_BENEFICIARY_FINGERPRINT_KEY = 'f-u1-test-fingerprint-key-0123456789abcdef';
const mongoose = require('mongoose');
const { startFinancialMongo, clearFinancialMongo, stopFinancialMongo } = require('./helpers/financialMongoEnvironment');
const { createTenantFixture, createTenantUser, tenantActor } = require('./helpers/tenantAwareFixture');
const User = require('../models/User');
const Property = require('../models/Property');
const OrgMembership = require('../models/OrgMembership');
const PlatformOperator = require('../models/PlatformOperator');
const RentalMaintenanceTicket = require('../models/RentalMaintenanceTicket');
const FinancialPayment = require('../models/FinancialPayment');
const FinancialDocument = require('../models/FinancialDocument');
const PaymentAllocation = require('../models/PaymentAllocation');
const FinancialRefund = require('../models/FinancialRefund');
const FinancialRefundApproval = require('../models/FinancialRefundApproval');
const FinancialLedgerEntry = require('../models/FinancialLedgerEntry');
const ManagementMandate = require('../models/ManagementMandate');
const ManagementMandateVersion = require('../models/ManagementMandateVersion');
const MandateExpense = require('../models/MandateExpense');
const ExpenseAuthorization = require('../models/ExpenseAuthorization');
const MandateCollection = require('../models/MandateCollection');
const OwnerFinancialObligation = require('../models/OwnerFinancialObligation');
const FinancialBeneficiary = require('../models/FinancialBeneficiary');
const { PLATFORM_WIDE_CONTEXT_SOURCE } = require('../constants/platformOperatorConstants');
const mandates = require('../services/finance/contractual/managementMandateService');
const beneficiaries = require('../services/finance/contractual/financialBeneficiaryService');
const expenses = require('../services/finance/contractual/mandateExpenseService');
const funds = require('../services/finance/contractual/ownerFundsService');
const refunds = require('../services/finance/contractual/refundGovernanceService');
const issuers = require('../services/finance/contractual/financialIssuerIdentityService');
const legacyRefunds = require('../services/finance/accommodationRefundService');
const { activeGrantFixture } = require('./helpers/contractualGrantFixture');
const { SENSITIVE_CAPABILITIES } = require('../services/finance/contractual/contractualFinanceAuthorizationService');

jest.setTimeout(180000);
const oid = () => new mongoose.Types.ObjectId();
const DAY = 86400000;
let seq = 0;
let A; let B; let adminA1; let adminA2; let adminA3; let gestionnaireA; let secretaireA; let adminB; let owner; let otherOwner;

beforeAll(async () => {
  await startFinancialMongo();
  await Promise.all([ManagementMandate, ManagementMandateVersion, MandateExpense, ExpenseAuthorization, MandateCollection, OwnerFinancialObligation].map((model) => model.syncIndexes()));
});
afterAll(stopFinancialMongo);

async function member(fixture, businessRole) {
  const { user } = await createTenantUser({ ...fixture, businessRole, overrides: { role: 'Client' } });
  return { user, actor: tenantActor(user, fixture.tenant) };
}
async function plainUser(role = 'Proprietaire') {
  seq += 1;
  return User.create({ name: `Owner ${seq}`, email: `fu1-owner-${Date.now()}-${seq}@example.test`, password: 'Password123!', passwordConfirm: 'Password123!', role, isEmailVerified: true });
}
async function property({ tenant, ownerId }) {
  const _id = oid();
  await Property.collection.insertOne({ _id, title: `Bien ${_id}`, owner: ownerId, tenant: tenant ? tenant._id : null, status: 'location' });
  return _id;
}
const ticket = (propertyId) => RentalMaintenanceTicket.create({ property: propertyId, category: 'plomberie', description: 'Fuite' });
const ownerActor = (user) => ({ _id: user._id, role: user.role, platformTenant: null });

beforeEach(async () => {
  await clearFinancialMongo();
  A = await createTenantFixture({ label: 'FU1 A' });
  B = await createTenantFixture({ label: 'FU1 B' });
  adminA1 = await member(A, 'Admin'); adminA2 = await member(A, 'Admin'); adminA3 = await member(A, 'Admin');
  gestionnaireA = await member(A, 'GestionnaireImmobilier'); secretaireA = await member(A, 'Secretaire');
  adminB = await member(B, 'Admin');
  owner = await plainUser(); otherOwner = await plainUser();
  // F-U1.G : capacités sensibles uniquement par octroi explicite (quatre yeux).
  for (const capability of SENSITIVE_CAPABILITIES) {
    for (const admin of [adminA1, adminA2, adminA3]) await activeGrantFixture({ user: admin.user, capability, tenant: A.tenant });
  }
});

// Fixture de frais : valeurs fictives propres aux tests (aucun tarif réel).
const NO_CASH_FEE = { feeKind: 'COLLECTION', paymentMethod: 'cash', bearer: 'OWNER', pricing: { fixedMinor: 0, basisPoints: 0, tariffSourceReference: 'FIXTURE-TEST-CASH' } };
function delegatedTerms(overrides = {}) {
  return {
    offer: 'DELEGATED_MANAGEMENT', currency: 'XAF', effectiveFrom: new Date(Date.now() - 30 * DAY), legalReference: `MANDAT-${oid()}`,
    commission: { basisPoints: 1000, base: 'CONFIRMED_COLLECTED_RENT' },
    collectionMode: 'AGENCY_COLLECTION', payoutFrequency: 'MONTHLY',
    feeRules: [NO_CASH_FEE],
    expenseCaps: { perInterventionMinor: 60000, monthlyCumulativeMinor: 100000, period: 'CALENDAR_MONTH' },
    ...overrides,
  };
}

async function verifiedBeneficiary({ registrar = adminA1, verifier = adminA2, ownerUser = owner, identifier } = {}) {
  const beneficiary = await beneficiaries.registerBeneficiary({ actor: registrar.actor, ownerId: ownerUser._id, kind: 'MOBILE_MONEY', holderName: 'Owner', institution: 'MTN Congo', accountIdentifier: identifier || `24206${Math.floor(1000000 + Math.random() * 8999999)}` });
  return beneficiaries.verifyBeneficiary({ actor: verifier.actor, beneficiaryId: beneficiary._id, method: 'Appel de confirmation + pièce', evidence: [{ documentRef: 'doc://rib-1' }] });
}

async function activeMandate({ termsOverrides = {}, ownerUser = owner, actor = adminA1 } = {}) {
  const beneficiary = await verifiedBeneficiary({ ownerUser });
  const propertyId = await property({ tenant: A.tenant, ownerId: ownerUser._id });
  const agency = (termsOverrides.collectionMode || 'AGENCY_COLLECTION') === 'AGENCY_COLLECTION';
  const terms = delegatedTerms({
    ...(agency ? { payoutBeneficiary: beneficiary._id } : { payoutFrequency: undefined, ownerDirectAccount: beneficiary._id }),
    ...termsOverrides,
  });
  const { mandate } = await mandates.createMandate({ actor: actor.actor, propertyId, ownerId: ownerUser._id, reference: `REF-${oid()}`, terms, idempotencyKey: `create-${oid()}` });
  const activated = await mandates.activateMandate({ actor: actor.actor, mandateId: mandate._id });
  return { mandate: activated, propertyId, beneficiary };
}

async function rentalPayment({ propertyId, amountMinor = 150000, status = 'succeeded', method = 'cash' }) {
  return FinancialPayment.create({
    tenant: A.tenant._id, domain: 'rental', establishmentType: 'Property', establishmentId: propertyId, paymentReference: `PAY-${oid()}`,
    status, method, provider: 'manual', currency: 'XAF', amountMinor, availableAmountMinor: amountMinor,
    confirmedAt: status === 'succeeded' ? new Date() : undefined, createdBy: adminA1.user._id,
  });
}

// ─── F-U1.B Mandats ───────────────────────────────────────────────────

describe('F-U1.B — mandat, cycle de vie et snapshots', () => {
  test('1. actif → suspendu (dépense refusée) → réactivé → révoqué (terminal)', async () => {
    const { mandate, propertyId } = await activeMandate();
    const t = await ticket(propertyId);
    const request = (key) => expenses.requestExpense({ actor: gestionnaireA.actor, mandateId: mandate._id, interventionId: t._id, category: 'plomberie', description: 'Joint', amountMinor: 1000, idempotencyKey: key });
    await expect(request('e1')).resolves.toMatchObject({ expense: expect.objectContaining({ status: 'committed' }) });
    await expect(mandates.suspendMandate({ actor: adminA1.actor, mandateId: mandate._id })).rejects.toMatchObject({ code: 'MANDATE_REASON_REQUIRED' });
    await mandates.suspendMandate({ actor: adminA1.actor, mandateId: mandate._id, reason: 'Litige' });
    await expect(request('e2')).rejects.toMatchObject({ code: 'MANDATE_SUSPENDED' });
    await mandates.activateMandate({ actor: adminA1.actor, mandateId: mandate._id });
    await expect(request('e3')).resolves.toBeDefined();
    await mandates.revokeMandate({ actor: adminA1.actor, mandateId: mandate._id, reason: 'Fin de mandat' });
    await expect(request('e4')).rejects.toMatchObject({ code: 'MANDATE_REVOKED' });
    await expect(mandates.activateMandate({ actor: adminA1.actor, mandateId: mandate._id })).rejects.toMatchObject({ code: 'MANDATE_INVALID_TRANSITION' });
    const transitions = await FinancialLedgerEntry.countDocuments({ entityType: 'ManagementMandate', entityId: mandate._id });
    expect(transitions).toBe(4);
  });

  test('1. mandat échu par date et expiration explicite', async () => {
    const { mandate, propertyId } = await activeMandate({ termsOverrides: { effectiveFrom: new Date(Date.now() - 60 * DAY), effectiveTo: new Date(Date.now() - DAY) } });
    const t = await ticket(propertyId);
    await expect(expenses.requestExpense({ actor: gestionnaireA.actor, mandateId: mandate._id, interventionId: t._id, category: 'x', description: 'y', amountMinor: 10, idempotencyKey: 'k' }))
      .rejects.toMatchObject({ code: 'MANDATE_EXPIRED' });
    const expired = await mandates.expireMandate({ actor: adminA1.actor, mandateId: mandate._id });
    expect(expired.status).toBe('expired');
  });

  test('activation refusée sans bénéficiaire vérifié ; un seul mandat vivant par bien', async () => {
    const pending = await beneficiaries.registerBeneficiary({ actor: adminA1.actor, ownerId: owner._id, kind: 'BANK_ACCOUNT', holderName: 'Owner', institution: 'Banque', accountIdentifier: 'CG1234567890' });
    const propertyId = await property({ tenant: A.tenant, ownerId: owner._id });
    const terms = delegatedTerms({ payoutBeneficiary: pending._id });
    const { mandate } = await mandates.createMandate({ actor: adminA1.actor, propertyId, ownerId: owner._id, reference: 'R1', terms, idempotencyKey: 'c1' });
    await expect(mandates.activateMandate({ actor: adminA1.actor, mandateId: mandate._id })).rejects.toMatchObject({ code: 'BENEFICIARY_NOT_VERIFIED' });
    await expect(mandates.createMandate({ actor: adminA1.actor, propertyId, ownerId: owner._id, reference: 'R2', terms: delegatedTerms({ payoutBeneficiary: pending._id }), idempotencyKey: 'c2' })).rejects.toBeDefined();
    const replay = await mandates.createMandate({ actor: adminA1.actor, propertyId, ownerId: owner._id, reference: 'R1', terms, idempotencyKey: 'c1' });
    expect(replay.replayed).toBe(true);
    await expect(mandates.createMandate({ actor: adminA1.actor, propertyId, ownerId: owner._id, reference: 'R1', terms: { ...terms, legalReference: 'AUTRE' }, idempotencyKey: 'c1' }))
      .rejects.toMatchObject({ code: 'FINANCIAL_IDEMPOTENCY_CONFLICT' });
    await expect(mandates.createMandate({ actor: adminA1.actor, propertyId, ownerId: otherOwner._id, reference: 'R3', terms: delegatedTerms({ payoutBeneficiary: pending._id }), idempotencyKey: 'c3' })).rejects.toMatchObject({ code: 'MANDATE_OWNER_MISMATCH' });
  });

  test('5. avenant non rétroactif : snapshots conservés, version immuable', async () => {
    const { mandate, propertyId, beneficiary } = await activeMandate();
    const t = await ticket(propertyId);
    const before = await expenses.requestExpense({ actor: gestionnaireA.actor, mandateId: mandate._id, interventionId: t._id, category: 'p', description: 'avant', amountMinor: 50000, idempotencyKey: 'before' });
    const now = new Date();
    await expect(mandates.amendMandate({ actor: adminA1.actor, mandateId: mandate._id, reason: 'rétro', now, terms: delegatedTerms({ payoutBeneficiary: beneficiary._id, effectiveFrom: new Date(now.getTime() - DAY) }) }))
      .rejects.toMatchObject({ code: 'MANDATE_RETROACTIVE_AMENDMENT_FORBIDDEN' });
    const effectiveFrom = new Date(now.getTime() + DAY);
    const { version } = await mandates.amendMandate({ actor: adminA1.actor, mandateId: mandate._id, reason: 'Hausse plafonds', now, terms: delegatedTerms({ payoutBeneficiary: beneficiary._id, effectiveFrom, expenseCaps: { perInterventionMinor: 200000, monthlyCumulativeMinor: 400000, period: 'CALENDAR_MONTH' } }) });
    expect(version.versionNumber).toBe(2);
    const t2 = await ticket(propertyId);
    const after = await expenses.requestExpense({ actor: gestionnaireA.actor, mandateId: mandate._id, interventionId: t2._id, category: 'p', description: 'après', amountMinor: 150000, idempotencyKey: 'after', at: new Date(effectiveFrom.getTime() + DAY) });
    expect(after.expense.status).toBe('committed');
    expect(after.expense.capsSnapshot.perInterventionMinor).toBe(200000);
    const reloaded = await MandateExpense.findById(before.expense._id);
    expect(reloaded.capsSnapshot.perInterventionMinor).toBe(60000);
    expect(String(reloaded.mandateVersion)).not.toBe(String(version._id));
    await expect(ManagementMandateVersion.updateOne({ _id: version._id }, { $set: { termsHash: 'x' } })).rejects.toThrow('MANDATE_VERSION_IMMUTABLE');
  });
});

// ─── F-U1.C Dépenses ──────────────────────────────────────────────────

describe('F-U1.C — double plafond et autorisations', () => {
  test('6. plafond par intervention + 9. fractionnement d’une même intervention', async () => {
    const { mandate, propertyId } = await activeMandate();
    const t = await ticket(propertyId);
    const ask = (amountMinor, key) => expenses.requestExpense({ actor: gestionnaireA.actor, mandateId: mandate._id, interventionId: t._id, category: 'p', description: 'tranche', amountMinor, idempotencyKey: key });
    expect((await ask(25000, 's1')).expense.status).toBe('committed');
    expect((await ask(25000, 's2')).expense.status).toBe('committed');
    const third = (await ask(25000, 's3')).expense;
    expect(third.status).toBe('pending_owner_authorization');
    expect(third.capBreaches).toEqual(['PER_INTERVENTION']);
    const single = await expenses.requestExpense({ actor: gestionnaireA.actor, mandateId: mandate._id, interventionId: (await ticket(propertyId))._id, category: 'p', description: 'gros', amountMinor: 70000, idempotencyKey: 'big' });
    expect(single.expense.capBreaches).toContain('PER_INTERVENTION');
  });

  test('7. plafond mensuel cumulatif sur plusieurs interventions', async () => {
    const { mandate, propertyId } = await activeMandate();
    const results = [];
    for (const key of ['m1', 'm2', 'm3']) {
      const t = await ticket(propertyId);
      results.push((await expenses.requestExpense({ actor: gestionnaireA.actor, mandateId: mandate._id, interventionId: t._id, category: 'p', description: key, amountMinor: 40000, idempotencyKey: key })).expense);
    }
    expect(results.map((e) => e.status)).toEqual(['committed', 'committed', 'pending_owner_authorization']);
    expect(results[2].capBreaches).toEqual(['MONTHLY']);
  });

  test('8. dépenses simultanées : jamais de dépassement du plafond mensuel', async () => {
    const { mandate, propertyId } = await activeMandate();
    const tickets = await Promise.all([1, 2, 3, 4, 5].map(() => ticket(propertyId)));
    const settled = await Promise.all(tickets.map((t, index) => expenses.requestExpense({ actor: gestionnaireA.actor, mandateId: mandate._id, interventionId: t._id, category: 'p', description: `c${index}`, amountMinor: 40000, idempotencyKey: `c${index}` })));
    const committed = settled.filter((r) => r.expense.status === 'committed');
    expect(committed).toHaveLength(2);
    const reserved = await MandateExpense.aggregate([{ $match: { mandate: mandate._id, status: { $in: ['committed', 'authorized'] } } }, { $group: { _id: null, total: { $sum: '$reservedAmountMinor' } } }]);
    expect(reserved[0].total).toBeLessThanOrEqual(100000);
  });

  test('10. autorisation in-app du propriétaire ; autre propriétaire et agent refusés', async () => {
    const { mandate, propertyId } = await activeMandate();
    const t = await ticket(propertyId);
    const { expense } = await expenses.requestExpense({ actor: gestionnaireA.actor, mandateId: mandate._id, interventionId: t._id, category: 'p', description: 'chaudière', amountMinor: 80000, idempotencyKey: 'x' });
    await expect(expenses.decideExpenseInApp({ actor: ownerActor(otherOwner), expenseId: expense._id, decision: 'approve', maxAmountMinor: 80000 })).rejects.toMatchObject({ code: 'FINANCIAL_OWNER_REQUIRED' });
    await expect(expenses.decideExpenseInApp({ actor: adminA1.actor, expenseId: expense._id, decision: 'approve', maxAmountMinor: 80000 })).rejects.toMatchObject({ code: 'FINANCIAL_OWNER_REQUIRED' });
    await expect(expenses.decideExpenseInApp({ actor: ownerActor(owner), expenseId: expense._id, decision: 'approve', maxAmountMinor: 79999 })).rejects.toMatchObject({ code: 'EXPENSE_AUTHORIZATION_AMOUNT_INSUFFICIENT' });
    const result = await expenses.decideExpenseInApp({ actor: ownerActor(owner), expenseId: expense._id, decision: 'approve', maxAmountMinor: 80000 });
    expect(result.expense.status).toBe('authorized');
    expect(result.authorization).toMatchObject({ mode: 'IN_APP', effective: true });
    await expect(ExpenseAuthorization.updateOne({ _id: result.authorization._id }, { decision: 'refused' })).rejects.toThrow('EXPENSE_AUTHORIZATION_IMMUTABLE');
  });

  test('11/12. autorisation écrite : hors périmètre refusée, non vérifiée sans effet, authentifiée débloque une seule intervention', async () => {
    const { mandate, propertyId } = await activeMandate();
    const t1 = await ticket(propertyId); const t2 = await ticket(propertyId);
    const one = (await expenses.requestExpense({ actor: gestionnaireA.actor, mandateId: mandate._id, interventionId: t1._id, category: 'p', description: 'toiture', amountMinor: 90000, idempotencyKey: 'w1' })).expense;
    const two = (await expenses.requestExpense({ actor: gestionnaireA.actor, mandateId: mandate._id, interventionId: t2._id, category: 'p', description: 'autre', amountMinor: 90000, idempotencyKey: 'w2' })).expense;
    const base = { expenseId: one._id, maxAmountMinor: 90000, document: { documentRef: 'doc://lettre', signedAt: new Date(Date.now() - DAY), signatoryName: 'Owner' }, scope: { mandateId: mandate._id, propertyId, interventionId: t1._id } };
    await expect(expenses.submitWrittenAuthorization({ ...base, actor: gestionnaireA.actor, scope: { ...base.scope, interventionId: t2._id } })).rejects.toMatchObject({ code: 'WRITTEN_AUTHORIZATION_SCOPE_MISMATCH' });
    const firstSubmission = await expenses.submitWrittenAuthorization({ ...base, actor: gestionnaireA.actor });
    expect(firstSubmission).toMatchObject({ phase: 'WRITTEN_SUBMISSION', effective: false });
    expect((await MandateExpense.findById(one._id)).status).toBe('pending_owner_authorization');
    const inconclusive = await expenses.authenticateWrittenAuthorization({ actor: adminA1.actor, submissionId: firstSubmission._id, verification: { result: 'inconclusive', method: 'Signature non comparable' } });
    expect(inconclusive).toMatchObject({ unlocked: false, reason: 'WRITTEN_AUTHORIZATION_NOT_VERIFIED' });
    await expect(expenses.authenticateWrittenAuthorization({ actor: adminA2.actor, submissionId: firstSubmission._id, verification: { result: 'verified', method: 'x' } })).rejects.toMatchObject({ code: 'WRITTEN_AUTHORIZATION_ALREADY_AUTHENTICATED' });
    const second = await expenses.submitWrittenAuthorization({ ...base, actor: gestionnaireA.actor });
    const ok = await expenses.authenticateWrittenAuthorization({ actor: adminA1.actor, submissionId: second._id, verification: { result: 'verified', method: 'Rappel du propriétaire au numéro du dossier' } });
    expect(ok.unlocked).toBe(true);
    expect((await MandateExpense.findById(one._id)).status).toBe('authorized');
    expect((await MandateExpense.findById(two._id)).status).toBe('pending_owner_authorization');
    const history = await ExpenseAuthorization.find({ expense: one._id }).sort({ createdAt: 1 }).lean();
    expect(history.map((h) => [h.phase, h.effective])).toEqual([['WRITTEN_SUBMISSION', false], ['WRITTEN_AUTHENTICATION', false], ['WRITTEN_SUBMISSION', false], ['WRITTEN_AUTHENTICATION', true]]);
    expect(history[3].written.verification.verifiedBy.toString()).toBe(String(adminA1.user._id));
  });

  test('l’agent ayant demandé la dépense ne peut pas authentifier l’autorisation écrite', async () => {
    const { mandate, propertyId } = await activeMandate();
    const t = await ticket(propertyId);
    const { expense } = await expenses.requestExpense({ actor: adminA2.actor, mandateId: mandate._id, interventionId: t._id, category: 'p', description: 'x', amountMinor: 90000, idempotencyKey: 'sod' });
    const submission = await expenses.submitWrittenAuthorization({ actor: gestionnaireA.actor, expenseId: expense._id, maxAmountMinor: 90000, document: { documentRef: 'd', signedAt: new Date(), signatoryName: 'O' }, scope: { mandateId: mandate._id, propertyId, interventionId: t._id } });
    await expect(expenses.authenticateWrittenAuthorization({ actor: adminA2.actor, submissionId: submission._id, verification: { result: 'verified', method: 'm' } }))
      .rejects.toMatchObject({ code: 'FINANCIAL_SEGREGATION_OF_DUTIES' });
  });

  test('justification : seules les dépenses justifiées sont déduites ; refus/annulation libèrent sans déduire', async () => {
    const { mandate, propertyId } = await activeMandate();
    const t = await ticket(propertyId);
    const committed = (await expenses.requestExpense({ actor: gestionnaireA.actor, mandateId: mandate._id, interventionId: t._id, category: 'p', description: 'a', amountMinor: 40000, idempotencyKey: 'j1' })).expense;
    await expect(expenses.justifyExpense({ actor: gestionnaireA.actor, expenseId: committed._id, actualAmountMinor: 35000, evidence: [] })).rejects.toMatchObject({ code: 'EVIDENCE_REQUIRED' });
    await expect(expenses.justifyExpense({ actor: gestionnaireA.actor, expenseId: committed._id, actualAmountMinor: 45000, evidence: [{ documentRef: 'doc://facture' }] })).rejects.toMatchObject({ code: 'EXPENSE_ACTUAL_EXCEEDS_COMMITMENT' });
    const { obligation } = await expenses.justifyExpense({ actor: gestionnaireA.actor, expenseId: committed._id, actualAmountMinor: 35000, evidence: [{ documentRef: 'doc://facture' }] });
    const t2 = await ticket(propertyId);
    const cancelled = (await expenses.requestExpense({ actor: gestionnaireA.actor, mandateId: mandate._id, interventionId: t2._id, category: 'p', description: 'b', amountMinor: 20000, idempotencyKey: 'j2' })).expense;
    await expenses.cancelExpense({ actor: gestionnaireA.actor, expenseId: cancelled._id, reason: 'Inutile' });
    const t3 = await ticket(propertyId);
    const refused = (await expenses.requestExpense({ actor: gestionnaireA.actor, mandateId: mandate._id, interventionId: t3._id, category: 'p', description: 'c', amountMinor: 90000, idempotencyKey: 'j3' })).expense;
    await expenses.decideExpenseInApp({ actor: ownerActor(owner), expenseId: refused._id, decision: 'refuse' });
    const obligations = await OwnerFinancialObligation.find({ mandate: mandate._id }).lean();
    const lines = obligations.flatMap((o) => o.lines);
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatchObject({ kind: 'EXPENSE_DEDUCTION', amountMinor: -35000 });
    expect(obligation.netAmountMinor).toBe(-35000);
    const t4 = await ticket(propertyId);
    const reuse = (await expenses.requestExpense({ actor: gestionnaireA.actor, mandateId: mandate._id, interventionId: t4._id, category: 'p', description: 'd', amountMinor: 60000, idempotencyKey: 'j4' })).expense;
    // 35000 justifiés + 60000 ≤ 100000 : passe uniquement si l'annulation (20000)
    // et le reliquat de justification (5000) ont bien été libérés.
    expect(reuse.status).toBe('committed');
  });
});

// ─── F-U1.D Fonds, encaissements, obligations ─────────────────────────

describe('F-U1.D — séparation des fonds', () => {
  test('3. AGENCY_COLLECTION : commission 10 % sur encaissement confirmé, fonds propriétaire séparés, idempotent', async () => {
    const { mandate, propertyId, beneficiary } = await activeMandate();
    const pending = await rentalPayment({ propertyId, status: 'pending' });
    await expect(funds.recognizeAgencyCollection({ actor: secretaireA.actor, mandateId: mandate._id, financialPaymentId: pending._id, rentPeriod: { month: 10, year: 2026 } }))
      .rejects.toMatchObject({ code: 'COLLECTION_NOT_CONFIRMED' });
    const payment = await rentalPayment({ propertyId });
    const result = await funds.recognizeAgencyCollection({ actor: secretaireA.actor, mandateId: mandate._id, financialPaymentId: payment._id, rentPeriod: { month: 10, year: 2026 } });
    expect(result.collection.breakdown).toMatchObject({ commissionBasisPoints: 1000, commissionMinor: 15000, ownerShareMinor: 135000, clientMoneyHeldMinor: 135000 });
    expect(result.obligation).toMatchObject({ type: 'OWNER_PAYOUT', netAmountMinor: 135000, executionStatus: 'NOT_ENABLED' });
    expect(String(result.obligation.beneficiary)).toBe(String(beneficiary._id));
    const replay = await funds.recognizeAgencyCollection({ actor: secretaireA.actor, mandateId: mandate._id, financialPaymentId: payment._id, rentPeriod: { month: 10, year: 2026 } });
    expect(replay.replayed).toBe(true);
    const events = (await FinancialLedgerEntry.find({ entityType: 'MandateCollection' }).lean()).map((e) => [e.eventType, e.amountMinor]).sort();
    expect(events).toEqual([['mandate.collection.agency_received', 150000], ['mandate.commission.earned', 15000], ['mandate.owner_funds.held', 135000]]);
    expect(() => funds.executeOwnerPayout()).toThrow(expect.objectContaining({ code: 'PAYOUT_EXECUTION_NOT_ENABLED' }));
  });

  test('frais manquants pour le moyen de paiement → refus fermé', async () => {
    const { mandate, propertyId } = await activeMandate();
    const payment = await rentalPayment({ propertyId, method: 'mobile_money' });
    await expect(funds.recognizeAgencyCollection({ actor: secretaireA.actor, mandateId: mandate._id, financialPaymentId: payment._id, rentPeriod: { month: 10, year: 2026 } }))
      .rejects.toMatchObject({ code: 'FEE_RULE_NOT_CONFIGURED' });
  });

  test('2. OWNER_DIRECT : pas d’encaissement agence ; déclaration seule non probante ; rapprochement → commission due', async () => {
    const { mandate, propertyId } = await activeMandate({ termsOverrides: { collectionMode: 'OWNER_DIRECT' } });
    const agencyPayment = await rentalPayment({ propertyId });
    await expect(funds.recognizeAgencyCollection({ actor: secretaireA.actor, mandateId: mandate._id, financialPaymentId: agencyPayment._id, rentPeriod: { month: 10, year: 2026 } }))
      .rejects.toMatchObject({ code: 'COLLECTION_MODE_MISMATCH' });
    const { collection } = await funds.declareOwnerDirectCollection({ actor: ownerActor(owner), mandateId: mandate._id, amountMinor: 200000, paidAt: new Date(), rentPeriod: { month: 10, year: 2026 }, paymentMethod: 'mobile_money', reference: 'TX-1', idempotencyKey: 'd1' });
    expect(collection.status).toBe('declared');
    expect(await OwnerFinancialObligation.countDocuments()).toBe(0);
    await expect(funds.confirmOwnerDirectByOwner({ actor: ownerActor(owner), collectionId: collection._id })).rejects.toMatchObject({ code: 'FINANCIAL_SEGREGATION_OF_DUTIES' });
    await expect(funds.reconcileOwnerDirectCollection({ actor: adminA1.actor, collectionId: collection._id, decision: 'confirm', providerReference: 'TX-1', verifiedAmountMinor: 200000, verifiedPaidAt: new Date() }))
      .rejects.toMatchObject({ code: 'RECONCILIATION_EVIDENCE_INSUFFICIENT' });
    const { collection: reconciled, obligation } = await funds.reconcileOwnerDirectCollection({ actor: adminA1.actor, collectionId: collection._id, decision: 'confirm', evidence: [{ documentRef: 'doc://releve-mtn', kind: 'MOBILE_MONEY_STATEMENT' }], providerReference: 'TX-1', verifiedAmountMinor: 200000, verifiedPaidAt: new Date() });
    expect(reconciled.breakdown).toMatchObject({ commissionMinor: 20000, clientMoneyHeldMinor: 0 });
    expect(obligation).toMatchObject({ type: 'COMMISSION_RECEIVABLE', netAmountMinor: 20000 });
    const agencyReceived = await FinancialLedgerEntry.countDocuments({ eventType: 'mandate.collection.agency_received' });
    expect(agencyReceived).toBe(0);
  });

  test('4. gestion autonome : ni commission déléguée ni mandat de dépense', async () => {
    const propertyId = await property({ tenant: A.tenant, ownerId: owner._id });
    const { mandate } = await mandates.createMandate({ actor: adminA1.actor, propertyId, ownerId: owner._id, reference: 'AUTO', idempotencyKey: 'auto', terms: { offer: 'AUTONOMOUS_SUBSCRIPTION', currency: 'XAF', effectiveFrom: new Date(Date.now() - DAY), legalReference: 'ABO', subscriptionReference: { type: 'IndividualSubscription', id: oid() } } });
    await mandates.activateMandate({ actor: adminA1.actor, mandateId: mandate._id });
    const payment = await rentalPayment({ propertyId });
    await expect(funds.recognizeAgencyCollection({ actor: secretaireA.actor, mandateId: mandate._id, financialPaymentId: payment._id, rentPeriod: { month: 10, year: 2026 } }))
      .rejects.toMatchObject({ code: 'MANDATE_OFFER_NO_DELEGATED_COMMISSION' });
    const t = await ticket(propertyId);
    await expect(expenses.requestExpense({ actor: gestionnaireA.actor, mandateId: mandate._id, interventionId: t._id, category: 'p', description: 'x', amountMinor: 10, idempotencyKey: 'k' }))
      .rejects.toMatchObject({ code: 'MANDATE_OFFER_NO_EXPENSE_MANDATE' });
  });

  test('bénéficiaire : vérificateur distinct, données minimisées, doublon refusé', async () => {
    const created = await beneficiaries.registerBeneficiary({ actor: adminA1.actor, ownerId: owner._id, kind: 'MOBILE_MONEY', holderName: 'O', institution: 'MTN', accountIdentifier: '242 06 111 22 33' });
    expect(created.maskedIdentifier).toBe('•••2233');
    const raw = await FinancialBeneficiary.collection.findOne({ _id: created._id });
    expect(JSON.stringify(raw)).not.toContain('2420611122');
    await expect(beneficiaries.verifyBeneficiary({ actor: adminA1.actor, beneficiaryId: created._id, method: 'm', evidence: [{ documentRef: 'd' }] })).rejects.toMatchObject({ code: 'FINANCIAL_SEGREGATION_OF_DUTIES' });
    await expect(beneficiaries.registerBeneficiary({ actor: adminA2.actor, ownerId: owner._id, kind: 'MOBILE_MONEY', holderName: 'O', institution: 'MTN', accountIdentifier: '242061112233' })).rejects.toMatchObject({ code: 'BENEFICIARY_DUPLICATE' });
  });
});

// ─── Isolation et privilèges ──────────────────────────────────────────

describe('F-U1 — isolation multi-tenant et privilèges (13/14)', () => {
  test('autre tenant, rôle global Admin sans membership, contexte non résolu : refus fermé', async () => {
    const { mandate, propertyId } = await activeMandate();
    const t = await ticket(propertyId);
    const ask = (actor) => expenses.requestExpense({ actor, mandateId: mandate._id, interventionId: t._id, category: 'p', description: 'x', amountMinor: 10, idempotencyKey: `iso-${oid()}` });
    await expect(ask(adminB.actor)).rejects.toMatchObject({ code: 'FINANCIAL_RESOURCE_OUT_OF_SCOPE', statusCode: 404 });
    await expect(ask(tenantActor(A.bootstrap, A.tenant))).rejects.toMatchObject({ code: 'FINANCIAL_UNAUTHORIZED' });
    await expect(ask({ _id: adminA1.user._id, role: 'Admin' })).rejects.toMatchObject({ code: 'FINANCIAL_UNAUTHORIZED' });
    await expect(mandates.suspendMandate({ actor: gestionnaireA.actor, mandateId: mandate._id, reason: 'x' })).rejects.toMatchObject({ code: 'FINANCIAL_UNAUTHORIZED' });
    await OrgMembership.updateMany({ user: gestionnaireA.user._id }, { status: 'suspended' });
    await expect(ask(gestionnaireA.actor)).rejects.toMatchObject({ code: 'FINANCIAL_UNAUTHORIZED' });
  });

  test('mandat PLATFORM : explicitement plateforme, inaccessible depuis un tenant ; vue plateforme sans accès aux mandats tenant', async () => {
    const operatorUser = await plainUser('Client');
    await PlatformOperator.create({ user: operatorUser._id, status: 'active', capabilities: ['platform.finance.manage'], grantedBy: A.bootstrap._id, grantReason: 'Test F-U1' });
    const platformActor = { _id: operatorUser._id, tenantContextSource: PLATFORM_WIDE_CONTEXT_SOURCE };
    const verifier = await plainUser('Client');
    await PlatformOperator.create({ user: verifier._id, status: 'active', capabilities: ['platform.finance.manage'], grantedBy: A.bootstrap._id, grantReason: 'Test F-U1' });
    const governor = await plainUser('Client');
    await PlatformOperator.create({ user: governor._id, status: 'active', capabilities: ['platform.operators.manage'], grantedBy: A.bootstrap._id, grantReason: 'Test F-U1' });
    await activeGrantFixture({ user: verifier._id, capability: 'contractual.beneficiary.verify' });
    const benef = await beneficiaries.registerBeneficiary({ actor: platformActor, ownerId: owner._id, kind: 'MOBILE_MONEY', holderName: 'O', institution: 'MTN', accountIdentifier: '242069998877' });
    await beneficiaries.verifyBeneficiary({ actor: { _id: verifier._id, tenantContextSource: PLATFORM_WIDE_CONTEXT_SOURCE }, beneficiaryId: benef._id, method: 'm', evidence: [{ documentRef: 'd' }] });
    const independentProperty = await property({ tenant: null, ownerId: owner._id });
    const { mandate } = await mandates.createMandate({ actor: platformActor, propertyId: independentProperty, ownerId: owner._id, reference: 'AV-1', terms: delegatedTerms({ payoutBeneficiary: benef._id }), idempotencyKey: 'pf' });
    expect(mandate).toMatchObject({ mandataryType: 'PLATFORM', tenant: null });
    await expect(mandates.activateMandate({ actor: adminA1.actor, mandateId: mandate._id })).rejects.toMatchObject({ code: 'FINANCIAL_RESOURCE_OUT_OF_SCOPE' });
    await expect(mandates.activateMandate({ actor: { _id: operatorUser._id, platformTenant: A.tenant }, mandateId: mandate._id })).rejects.toMatchObject({ code: 'FINANCIAL_RESOURCE_OUT_OF_SCOPE' });
    await mandates.activateMandate({ actor: platformActor, mandateId: mandate._id });
    const tenantMandate = (await activeMandate()).mandate;
    await expect(mandates.suspendMandate({ actor: platformActor, mandateId: tenantMandate._id, reason: 'x' })).rejects.toMatchObject({ code: 'FINANCIAL_RESOURCE_OUT_OF_SCOPE' });
    // Un bien sans tenant n'est pas un bien plateforme pour un tenant.
    await expect(mandates.createMandate({ actor: adminA1.actor, propertyId: await property({ tenant: null, ownerId: owner._id }), ownerId: owner._id, reference: 'X', terms: delegatedTerms({ payoutBeneficiary: benef._id }), idempotencyKey: 'x' }))
      .rejects.toMatchObject({ code: 'FINANCIAL_RESOURCE_OUT_OF_SCOPE' });
  });

  test('propriétaire sans organisation : voit ses obligations, pas celles d’un autre', async () => {
    const { mandate } = await activeMandate();
    await expect(funds.listObligations({ actor: ownerActor(owner), mandateId: mandate._id })).resolves.toEqual([]);
    await expect(funds.listObligations({ actor: ownerActor(otherOwner), mandateId: mandate._id })).rejects.toMatchObject({ code: 'FINANCIAL_UNAUTHORIZED' });
  });
});

// ─── F-U1.E Remboursements ────────────────────────────────────────────

describe('F-U1.E — gouvernance des remboursements', () => {
  let hotelId; let payment;
  beforeEach(async () => {
    hotelId = oid();
    const reservation = oid();
    const document = await FinancialDocument.create({ tenant: A.tenant._id, domain: 'hotel', establishmentType: 'Hotel', establishmentId: hotelId, documentType: 'invoice', documentNumber: `FA-${oid()}`, status: 'issued', currency: 'XAF', subjectType: 'HotelReservation', subjectId: reservation, totalMinor: 100000, amountAllocatedMinor: 100000, balanceMinor: 0, paymentStatus: 'paid', businessOperationKey: `doc-${oid()}`, createdBy: adminA1.user._id });
    payment = await FinancialPayment.create({ tenant: A.tenant._id, domain: 'hotel', establishmentType: 'Hotel', establishmentId: hotelId, paymentReference: `P-${oid()}`, status: 'succeeded', method: 'cash', currency: 'XAF', amountMinor: 100000, allocatedAmountMinor: 100000, availableAmountMinor: 0, subjectType: 'HotelReservation', subjectId: reservation, confirmedAt: new Date(), createdBy: adminA1.user._id });
    await PaymentAllocation.create({ tenant: A.tenant._id, financialPayment: payment._id, financialDocument: document._id, domain: 'hotel', establishmentType: 'Hotel', establishmentId: hotelId, currency: 'XAF', amountMinor: 100000, businessOperationKey: `alloc-${oid()}`, allocatedBy: adminA1.user._id });
  });
  const ask = (actor, amountMinor, extra = {}) => refunds.requestGovernedRefund({ actor, financialPaymentId: payment._id, amountMinor, activity: 'HOSPITALITY', reason: 'Annulation', idempotencyKey: `r-${oid()}`, ...extra });
  async function activePolicy() {
    const policy = await refunds.draftRefundPolicy({ actor: adminA1.actor, activity: 'HOSPITALITY', currency: 'XAF', standardApprovalMaxMinor: 50000, ownerConsentRequired: false, decisionReference: 'Décision test' });
    await expect(refunds.activateRefundPolicy({ actor: adminA1.actor, policyId: policy._id })).rejects.toMatchObject({ code: 'FINANCIAL_SEGREGATION_OF_DUTIES' });
    return refunds.activateRefundPolicy({ actor: adminA2.actor, policyId: policy._id });
  }

  test('politique non configurée → double validation ; seuil non validé non activable', async () => {
    const { refund } = await ask(secretaireA.actor, 1000);
    expect(refund.governance).toMatchObject({ classification: 'DUAL_APPROVAL', requiredApprovals: 2, signals: ['POLICY_UNCONFIGURED'] });
    const draft = await refunds.draftRefundPolicy({ actor: adminA1.actor, activity: 'HOSPITALITY', currency: 'XAF', ownerConsentRequired: false });
    await expect(refunds.activateRefundPolicy({ actor: adminA2.actor, policyId: draft._id })).rejects.toMatchObject({ code: 'REFUND_POLICY_THRESHOLD_NOT_VALIDATED' });
  });

  test('15/17. sous seuil : validation simple, auto-approbation interdite', async () => {
    await activePolicy();
    const { refund } = await ask(adminA1.actor, 30000);
    expect(refund.governance.requiredApprovals).toBe(1);
    await expect(refunds.decideGovernedRefund({ actor: adminA1.actor, refundId: refund._id, decision: 'approve' })).rejects.toMatchObject({ code: 'REFUND_SELF_APPROVAL_FORBIDDEN' });
    await expect(refunds.decideGovernedRefund({ actor: gestionnaireA.actor, refundId: refund._id, decision: 'approve' })).rejects.toMatchObject({ code: 'FINANCIAL_UNAUTHORIZED' });
    const approved = await refunds.decideGovernedRefund({ actor: adminA2.actor, refundId: refund._id, decision: 'approve' });
    expect(approved.status).toBe('approved');
  });

  test('15/17. au-dessus du seuil : deux approbateurs distincts, pas de double approbation', async () => {
    await activePolicy();
    const { refund } = await ask(secretaireA.actor, 60000);
    expect(refund.governance.signals).toContain('AMOUNT_ABOVE_THRESHOLD');
    const first = await refunds.decideGovernedRefund({ actor: adminA1.actor, refundId: refund._id, decision: 'approve' });
    expect(first.status).toBe('pending_approval');
    await expect(refunds.decideGovernedRefund({ actor: adminA1.actor, refundId: refund._id, decision: 'approve' })).rejects.toMatchObject({ code: 'REFUND_DUPLICATE_APPROVER' });
    const second = await refunds.decideGovernedRefund({ actor: adminA2.actor, refundId: refund._id, decision: 'approve' });
    expect(second.status).toBe('approved');
    expect(await FinancialRefundApproval.countDocuments({ refund: refund._id })).toBe(2);
  });

  test('16. risque élevé : double validation quel que soit le montant ; fraude : blocage puis levée par un tiers', async () => {
    await activePolicy();
    const { refund: risky } = await ask(secretaireA.actor, 100, { declaredSignals: ['HIGH_RISK'] });
    expect(risky.governance.requiredApprovals).toBe(2);
    const { refund: fraud } = await ask(secretaireA.actor, 100, { declaredSignals: ['FRAUD_SUSPECTED'] });
    expect(fraud.status).toBe('blocked');
    await expect(refunds.decideGovernedRefund({ actor: adminA1.actor, refundId: fraud._id, decision: 'approve' })).rejects.toMatchObject({ code: 'FINANCIAL_REFUND_INVALID_TRANSITION' });
    const cleared = await refunds.resolveBlockedRefund({ actor: adminA3.actor, refundId: fraud._id, resolution: 'clear', reason: 'Identité confirmée' });
    expect(cleared).toMatchObject({ status: 'pending_approval' });
    expect(cleared.governance).toMatchObject({ requiredApprovals: 2, approvalRound: 2 });
    expect(cleared.governance.signals).toEqual(expect.arrayContaining(['MANUAL_OVERRIDE']));
    expect(cleared.governance.signals).not.toContain('FRAUD_SUSPECTED');
  });

  test('solde remboursable jamais dépassé, y compris en concurrence', async () => {
    await activePolicy();
    const results = await Promise.allSettled([ask(secretaireA.actor, 60000), ask(secretaireA.actor, 60000)]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(results.find((r) => r.status === 'rejected').reason).toMatchObject({ code: 'REFUND_EXCEEDS_REFUNDABLE' });
    await expect(ask(secretaireA.actor, 40001)).rejects.toMatchObject({ code: 'REFUND_EXCEEDS_REFUNDABLE' });
    await expect(ask(secretaireA.actor, 40000)).resolves.toBeDefined();
  });

  test('18. approbation ≠ exécution : revérification avant mise en attente, aucune exécution réelle', async () => {
    await activePolicy();
    const { refund } = await ask(secretaireA.actor, 60000);
    await refunds.decideGovernedRefund({ actor: adminA1.actor, refundId: refund._id, decision: 'approve' });
    await refunds.decideGovernedRefund({ actor: adminA2.actor, refundId: refund._id, decision: 'approve' });
    await OrgMembership.updateMany({ user: adminA2.user._id }, { status: 'suspended' });
    await expect(refunds.releaseForExecution({ actor: adminA3.actor, refundId: refund._id })).rejects.toMatchObject({ code: 'REFUND_APPROVER_NO_LONGER_AUTHORIZED' });
    await OrgMembership.updateMany({ user: adminA2.user._id }, { status: 'active' });
    const released = await refunds.releaseForExecution({ actor: adminA3.actor, refundId: refund._id });
    expect(released).toMatchObject({ status: 'awaiting_execution' });
    expect(released.governance.executionEnabled).toBe(false);
    expect(() => refunds.executeGovernedRefund()).toThrow(expect.objectContaining({ code: 'REFUND_EXECUTION_NOT_ENABLED' }));
    const after = await FinancialPayment.findById(payment._id);
    expect(after).toMatchObject({ refundedAmountMinor: 0, status: 'succeeded' });
  });

  test('19. compatibilité hôtelière : le flux historique ne peut ni approuver ni exécuter un remboursement gouverné', async () => {
    const { refund } = await ask(secretaireA.actor, 1000);
    await expect(legacyRefunds.approveRefund({ refundId: refund._id, actor: adminA1.user, idempotencyKey: 'legacy' })).rejects.toMatchObject({ code: 'FINANCIAL_REFUND_INVALID_TRANSITION' });
    await expect(legacyRefunds.completeManualRefund({ refundId: refund._id, reference: 'REF', method: 'cash', actor: adminA1.user, idempotencyKey: 'legacy-c', transactionMode: 'transactional' })).rejects.toMatchObject({ code: 'REFUND_EXECUTION_NOT_ENABLED' });
    await expect(legacyRefunds.cancelRefund({ refundId: refund._id, reason: 'x', actor: adminA1.user, idempotencyKey: 'legacy-x' })).rejects.toMatchObject({ code: 'FINANCIAL_REFUND_INVALID_TRANSITION' });
    expect((await FinancialRefund.findById(refund._id)).status).toBe('pending_approval');
  });

  test('20. idempotence de la demande et historique immuable des approbations', async () => {
    const key = 'stable';
    const first = await ask(secretaireA.actor, 1000, { idempotencyKey: key });
    const replay = await ask(secretaireA.actor, 1000, { idempotencyKey: key });
    expect(replay.replayed).toBe(true);
    expect(String(replay.refund._id)).toBe(String(first.refund._id));
    await expect(ask(secretaireA.actor, 2000, { idempotencyKey: key })).rejects.toMatchObject({ code: 'FINANCIAL_IDEMPOTENCY_CONFLICT' });
    await refunds.decideGovernedRefund({ actor: adminA1.actor, refundId: first.refund._id, decision: 'approve' });
    const approval = await FinancialRefundApproval.findOne({ refund: first.refund._id });
    await expect(FinancialRefundApproval.deleteOne({ _id: approval._id })).rejects.toThrow('REFUND_APPROVAL_IMMUTABLE');
  });

  test('autre tenant : demande et décision refusées, même avec un octroi explicite dans son tenant', async () => {
    await activeGrantFixture({ user: adminB.user, capability: 'contractual.financial.approve', tenant: B.tenant });
    await expect(ask(adminB.actor, 1000)).rejects.toMatchObject({ code: 'FINANCIAL_RESOURCE_OUT_OF_SCOPE' });
    const { refund } = await ask(secretaireA.actor, 1000);
    await expect(refunds.decideGovernedRefund({ actor: adminB.actor, refundId: refund._id, decision: 'approve' })).rejects.toMatchObject({ code: 'FINANCIAL_RESOURCE_OUT_OF_SCOPE' });
  });
});

describe('F-U1 §12 — identité légale de l’émetteur', () => {
  test('non utilisable avant vérification par une personne distincte', async () => {
    const provided = issuers.ALTITUDE_VISION_PROVIDED_IDENTITY;
    expect(provided.verificationStatus).toBe('UNVERIFIED');
    const identity = await issuers.registerIssuerIdentity({ actor: adminA1.actor, ...provided });
    await expect(issuers.resolveIssuerForLegalDocument({ scope: 'TENANT', tenantId: A.tenant._id })).rejects.toMatchObject({ code: 'ISSUER_IDENTITY_NOT_VERIFIED' });
    await expect(issuers.verifyIssuerIdentity({ actor: adminA1.actor, identityId: identity._id, evidenceRef: 'doc://rccm' })).rejects.toMatchObject({ code: 'FINANCIAL_SEGREGATION_OF_DUTIES' });
    await issuers.verifyIssuerIdentity({ actor: adminA2.actor, identityId: identity._id, evidenceRef: 'doc://rccm' });
    await expect(issuers.resolveIssuerForLegalDocument({ scope: 'TENANT', tenantId: A.tenant._id })).resolves.toMatchObject({ rccm: 'CG-BZV-01-2023-A10-02138' });
    await expect(issuers.resolveIssuerForLegalDocument({ scope: 'PLATFORM' })).rejects.toMatchObject({ code: 'ISSUER_IDENTITY_NOT_VERIFIED' });
  });
});
