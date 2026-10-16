// F-U2.12 — finalisation locative et financière : prorata conventionnel 30 j,
// sorties, changements de loyer, charges, imputation, commission hors charges,
// encaissements directs prouvés et 1 % des bailleurs sans organisation
// (vrai replica set, données fictives, aucun mouvement réel).
process.env.FINANCIAL_BENEFICIARY_FINGERPRINT_KEY = 'f-u1-test-fingerprint-key-0123456789abcdef';
process.env.RENT_PENALTY_ENGINE = 'CANONICAL';
const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const { startFinancialMongo, clearFinancialMongo, stopFinancialMongo } = require('./helpers/financialMongoEnvironment');
const { createTenantFixture, createTenantUser, tenantActor } = require('./helpers/tenantAwareFixture');
const { activeGrantFixture } = require('./helpers/contractualGrantFixture');
const { adoptLeasePolicy } = require('./helpers/leasePolicyFixture');
const User = require('../models/User');
const Property = require('../models/Property');
const RentalManagement = require('../models/RentalManagement');
const Contrat = require('../models/Contrat');
const Locataire = require('../models/Locataire');
const PlatformOperator = require('../models/PlatformOperator');
const IndividualSubscription = require('../models/IndividualSubscription');
const FinancialDocument = require('../models/FinancialDocument');
const FinancialDocumentLine = require('../models/FinancialDocumentLine');
const FinancialPayment = require('../models/FinancialPayment');
const FinancialIssuerIdentity = require('../models/FinancialIssuerIdentity');
const ManagementMandate = require('../models/ManagementMandate');
const ManagementMandateVersion = require('../models/ManagementMandateVersion');
const MandateCollection = require('../models/MandateCollection');
const Penalty = require('../models/RentLatePenaltyAssessment');
const Accrual = require('../models/AutonomousVariableFeeAccrual');
const DirectRentReceipt = require('../models/DirectRentReceipt');
const RentLeaseExit = require('../models/RentLeaseExit');
const SubscriptionTariff = require('../models/SubscriptionTariff');
const { PLATFORM_WIDE_CONTEXT_SOURCE } = require('../constants/platformOperatorConstants');
const calendar = require('../services/finance/billing/rentCalendarService');
const rent = require('../services/finance/billing/rentBillingService');
const collection = require('../services/finance/billing/rentCollectionService');
const ownerTracking = require('../services/finance/billing/ownerRentTrackingService');
const receipts = require('../services/finance/billing/directRentReceiptService');
const operations = require('../services/finance/billing/billingOperationsService');
const autonomous = require('../services/finance/billing/autonomousBillingService');
const subscription = require('../services/finance/billing/subscriptionBillingService');
const mandates = require('../services/finance/contractual/managementMandateService');
const beneficiaries = require('../services/finance/contractual/financialBeneficiaryService');
const funds = require('../services/finance/contractual/ownerFundsService');
const { allocatePaymentToDocument } = require('../services/finance/paymentAllocationService');
const { errorHandler } = require('../middleware/errorMiddleware');
const billingRoutes = require('../routes/billingRoutes');
const tenantPortalRoutes = require('../routes/tenantPortalRoutes');

const app = express(); app.use(express.json()); app.use('/billing', billingRoutes); app.use('/tenant-portal', tenantPortalRoutes); app.use(errorHandler);
jest.setTimeout(300000);
const oid = () => new mongoose.Types.ObjectId();
const wat = (iso) => new Date(`${iso}+01:00`);
const token = (user) => `Bearer ${jwt.sign({ id: user._id, tokenVersion: 0 }, process.env.JWT_SECRET)}`;
let seq = 0;
let A; let B; let adminA; let secretaireA; let adminB; let owner; let otherOwner; let tenantUser; let otherTenantUser; let platformOp; let platformOp2;

beforeAll(async () => {
  await startFinancialMongo();
  await Promise.all([Penalty, Accrual, DirectRentReceipt, RentLeaseExit, FinancialPayment, SubscriptionTariff, ManagementMandate, ManagementMandateVersion, MandateCollection].map((model) => model.syncIndexes()));
});
afterAll(stopFinancialMongo);

async function plainUser(role = 'Proprietaire') {
  seq += 1;
  return User.create({ name: `Personne fictive ${seq}`, email: `fu212-${Date.now()}-${seq}@example.test`, password: 'Password123!', passwordConfirm: 'Password123!', role, isEmailVerified: true });
}
async function member(fixture, businessRole) {
  const { user } = await createTenantUser({ ...fixture, businessRole, overrides: { role: 'Client' } });
  return { user, actor: tenantActor(user, fixture.tenant) };
}
async function operator() {
  const user = await plainUser('Client');
  await PlatformOperator.create({ user: user._id, status: 'active', capabilities: ['platform.finance.manage'], grantedBy: oid(), grantReason: 'Test F-U2.12' });
  return { user, actor: { _id: user._id, tenantContextSource: PLATFORM_WIDE_CONTEXT_SOURCE } };
}

beforeEach(async () => {
  await clearFinancialMongo();
  A = await createTenantFixture({ label: 'FU212 A' }); B = await createTenantFixture({ label: 'FU212 B' });
  adminA = await member(A, 'Admin'); secretaireA = await member(A, 'Secretaire'); adminB = await member(B, 'Admin');
  for (const capability of ['contractual.beneficiary.verify', 'contractual.financial.approve']) await activeGrantFixture({ user: adminA.user, capability, tenant: A.tenant });
  owner = await plainUser(); otherOwner = await plainUser(); tenantUser = await plainUser('Client'); otherTenantUser = await plainUser('Client');
  platformOp = await operator(); platformOp2 = await operator();
  await FinancialIssuerIdentity.create({ scope: 'TENANT', tenant: A.tenant._id, version: 1, legalName: 'Agence fictive A', rccm: 'CG-FICTIF', niu: 'NIU-FICTIF', phone: '+242 00 000 00 00', address: 'Adresse fictive', status: 'verified', registeredBy: oid(), verifiedBy: oid(), verifiedAt: new Date(), verificationEvidenceRef: 'fixture' });
});

async function lease({ start = '2026-01-01T00:00:00', end = '2027-12-31T00:00:00', rentMinor = 150000, chargesMinor = 0, natureCharges = null, ordreImputation = null, org = true, user = tenantUser, dateSortie, avenants } = {}) {
  const propertyId = oid();
  await Property.collection.insertOne({ _id: propertyId, title: 'Bien fictif', owner: owner._id, tenant: org ? A.tenant._id : null, status: 'location', availability: 'Disponible' });
  const existing = await Locataire.findOne({ user: user._id }).lean();
  const locataireId = existing ? existing._id : (await Locataire.collection.insertOne({ nom: 'Locataire', prenom: 'Fictif', email: `loc-${oid()}@example.test`, user: user._id })).insertedId;
  const leaseId = oid();
  await Contrat.collection.insertOne({
    _id: leaseId, type: 'location', bien: propertyId, locataire: locataireId, statut: 'actif', dateEntree: wat(start), dateFinBail: wat(end), montantLoyer: rentMinor,
    montantCharges: chargesMinor, chargesIncluses: chargesMinor === 0, natureCharges, ordreImputation, ...(dateSortie ? { dateSortie: wat(dateSortie) } : {}), ...(avenants ? { avenants } : {}),
  });
  if (!org) await RentalManagement.collection.insertOne({ property: propertyId, owner: owner._id, tenant: null, active: true, managementActivated: true, activeLease: leaseId, occupancyStatus: 'occupe', workflowHistory: [], createdAt: wat('2026-01-01T00:00:00'), updatedAt: new Date() });
  await adoptLeasePolicy({ actor: org ? adminA.actor : { _id: owner._id }, leaseId });
  return { leaseId, propertyId };
}
const gen = (leaseId, period, extra = {}) => rent.generateRentInvoice({ actor: adminA.actor, leaseId, period, now: calendar.rentCalendar(period).billingDate, prorataClauseReference: 'Art. 3 du bail fictif', ...extra }).then((r) => r.document);
async function issued(leaseId, period = '2026-04', extra) {
  const document = await gen(leaseId, period, extra);
  await operations.issueDocument({ actor: adminA.actor, documentId: document._id });
  return FinancialDocument.findById(document._id).lean();
}
async function pay(document, amountMinor, confirmedAt, metadata = {}) {
  const payment = await FinancialPayment.create({ tenant: document.tenant || null, domain: 'rental', establishmentType: 'Property', establishmentId: document.establishmentId, paymentReference: `P-${oid()}`, status: 'succeeded', method: 'cash', provider: 'manual', currency: 'XAF', amountMinor, availableAmountMinor: amountMinor, confirmedAt, createdBy: adminA.user._id, metadata });
  await allocatePaymentToDocument({ paymentId: payment._id, documentId: document._id, amountMinor, businessOperationKey: `alloc-${oid()}`, actor: adminA.user, transactionMode: 'transactional' });
  return payment;
}
const rentLines = async (document) => (await FinancialDocumentLine.find({ financialDocument: document._id, lineType: 'rent' }).sort({ lineNumber: 1 }).lean()).map((l) => l.totalMinor);
const amendment = (from, to, effet) => ({ type: 'loyer', champsModifies: [{ champ: 'montantLoyer', avant: from, apres: to }], motif: 'Avenant fictif', dateEffet: wat(effet), creePar: oid(), createdAt: wat('2026-03-01T00:00:00') });

describe('F-U2.12.A — prorata conventionnel (base 30)', () => {
  test.each([
    ['2026-02', '2026-02-01T00:00:00', 150000], ['2026-02', '2026-02-15T00:00:00', 80000], ['2026-02', '2026-02-21T00:00:00', 50000],
    ['2026-02', '2026-02-28T00:00:00', 15000], ['2028-02', '2028-02-29T00:00:00', 10000], ['2026-04', '2026-04-21T00:00:00', 50000], ['2026-04', '2026-04-30T00:00:00', 5000],
  ])('%s entrée %s → %i FCFA (facture émissible)', async (period, entry, expected) => {
    const { leaseId } = await lease({ start: entry, end: '2029-12-31T00:00:00' });
    const document = await issued(leaseId, period);
    expect(document.totalMinor).toBe(expected);
    expect(document.status).toBe('issued');
    expect(document.metadata.rentPrincipalMinor).toBe(expected);
  });
  test('entrée le 31 mai : aucune créance en mai, juin complet ; jamais de double facture', async () => {
    const { leaseId } = await lease({ start: '2026-05-31T00:00:00' });
    await expect(gen(leaseId, '2026-05')).rejects.toMatchObject({ code: 'RENT_PERIOD_NOT_BILLABLE_ENTRY_ON_31' });
    expect((await gen(leaseId, '2026-06')).totalMinor).toBe(150000);
    await gen(leaseId, '2026-06');
    expect(await FinancialDocument.countDocuments({ subjectId: leaseId })).toBe(1);
  });
});

describe('F-U2.12.B — sorties anticipées', () => {
  test('sans décision : refus ; décision sans fondement (NONE) : mois dû en entier ; dates distinctes conservées', async () => {
    const { leaseId } = await lease({ dateSortie: '2026-05-15T00:00:00' });
    await expect(gen(leaseId, '2026-05')).rejects.toMatchObject({ code: 'RENT_EXIT_DECISION_REQUIRED' });
    await expect(rent.recordLeaseExit({ actor: adminA.actor, leaseId, obligationEndDate: wat('2026-05-15T00:00:00'), prorataBasis: 'LEASE_CLAUSE' })).rejects.toMatchObject({ code: 'RENT_EXIT_BASIS_REFERENCE_REQUIRED' });
    await expect(rent.recordLeaseExit({ actor: adminB.actor, leaseId, obligationEndDate: wat('2026-05-15T00:00:00'), prorataBasis: 'NONE' })).rejects.toMatchObject({ statusCode: expect.any(Number) });
    const exit = await rent.recordLeaseExit({ actor: adminA.actor, leaseId, obligationEndDate: wat('2026-05-15T00:00:00'), prorataBasis: 'NONE', physicalDepartureDate: wat('2026-05-12T00:00:00'), keysReturnedDate: wat('2026-05-15T00:00:00'), contractualEndDate: wat('2027-12-31T00:00:00') });
    expect(exit).toMatchObject({ prorataBasis: 'NONE', authorityPlane: 'TENANT' });
    expect((await gen(leaseId, '2026-05')).totalMinor).toBe(150000);
    await expect(rent.recordLeaseExit({ actor: adminA.actor, leaseId, obligationEndDate: wat('2026-05-10T00:00:00'), prorataBasis: 'NONE' })).rejects.toMatchObject({ code: 'RENT_EXIT_ALREADY_RECORDED' });
  });
  test('sortie fondée (clause) : prorata au 1, 15, 28, 29, 30, 31 mai', async () => {
    const expected = { '01': 5000, 15: 75000, 28: 140000, 29: 145000, 30: 150000, 31: 150000 };
    for (const [day, amount] of Object.entries(expected)) {
      const { leaseId } = await lease({ dateSortie: `2026-05-${String(day).padStart(2, '0')}T00:00:00` });
      await rent.recordLeaseExit({ actor: adminA.actor, leaseId, obligationEndDate: wat(`2026-05-${String(day).padStart(2, '0')}T00:00:00`), prorataBasis: 'LEASE_CLAUSE', basisReference: 'Art. 9 du bail fictif' });
      expect((await gen(leaseId, '2026-05')).totalMinor).toBe(amount);
    }
  });
  test('sortie enregistrée après émission : facture inchangée, ajustement à décider, aucun remboursement', async () => {
    const { leaseId } = await lease();
    const document = await issued(leaseId, '2026-05');
    const exit = await rent.recordLeaseExit({ actor: adminA.actor, leaseId, obligationEndDate: wat('2026-05-15T00:00:00'), prorataBasis: 'EXIT_AGREEMENT', basisReference: 'Accord fictif', agreementEffectiveDate: wat('2026-05-15T00:00:00') });
    expect(exit.adjustments).toEqual([expect.objectContaining({ period: '2026-05', billedRentMinor: 150000, recomputedRentMinor: 75000, deltaMinor: -75000, status: 'PENDING_DECISION' })]);
    expect((await FinancialDocument.findById(document._id).lean())).toMatchObject({ status: 'issued', totalMinor: 150000 });
    expect(await FinancialDocument.countDocuments({ documentType: 'credit_note' })).toBe(0);
  });
});

describe('F-U2.12.C — changement de loyer en cours de mois', () => {
  test('16 avril 150 000 → 180 000 : 75 000 + 90 000 = 165 000 ; mars au loyer antérieur ; traçabilité', async () => {
    const { leaseId } = await lease({ rentMinor: 180000, avenants: [amendment(150000, 180000, '2026-04-16T00:00:00')] });
    const april = await gen(leaseId, '2026-04');
    expect(april.totalMinor).toBe(165000);
    expect(await rentLines(april)).toEqual([75000, 90000]);
    expect(april.metadata.proration).toMatchObject({ rule: 'RENT_CHANGE_SEGMENTS', rentChange: { previousRentMinor: 150000, newRentMinor: 180000, motif: 'Avenant fictif' } });
    expect((await gen(leaseId, '2026-03')).totalMinor).toBe(150000);
    expect((await gen(leaseId, '2026-05')).totalMinor).toBe(180000);
  });
  test('février et mois de 31 jours : base 30 sans chevauchement ; deux changements dans le mois : bloqué', async () => {
    const feb = await lease({ rentMinor: 180000, avenants: [amendment(150000, 180000, '2026-02-16T00:00:00')] });
    expect(await rentLines(await gen(feb.leaseId, '2026-02'))).toEqual([75000, 90000]);
    const may = await lease({ rentMinor: 180000, avenants: [amendment(150000, 180000, '2026-05-31T00:00:00')] });
    expect(await rentLines(await gen(may.leaseId, '2026-05'))).toEqual([150000]);
    const twice = await lease({ rentMinor: 200000, avenants: [amendment(150000, 180000, '2026-04-10T00:00:00'), amendment(180000, 200000, '2026-04-20T00:00:00')] });
    await expect(gen(twice.leaseId, '2026-04')).rejects.toMatchObject({ code: 'RENT_CHANGE_CALCULATION_AMBIGUOUS' });
  });
});

describe('F-U2.12.D — charges', () => {
  test('forfait/provision au prorata ; réel exclu ; nature inconnue sur mois partiel bloquée ; mois complet facturé', async () => {
    const forfait = await lease({ start: '2026-04-21T00:00:00', chargesMinor: 30000, natureCharges: 'forfait' });
    const d1 = await gen(forfait.leaseId, '2026-04');
    expect([d1.totalMinor, d1.metadata.charges.treatment]).toEqual([60000, 'PRORATED']);
    const reel = await lease({ start: '2026-04-21T00:00:00', chargesMinor: 30000, natureCharges: 'reel' });
    expect((await gen(reel.leaseId, '2026-04')).totalMinor).toBe(50000);
    const unknown = await lease({ start: '2026-04-21T00:00:00', chargesMinor: 30000 });
    await expect(gen(unknown.leaseId, '2026-04')).rejects.toMatchObject({ code: 'RENT_CHARGES_PRORATA_RULE_UNDECIDED' });
    expect((await gen(unknown.leaseId, '2026-05')).totalMinor).toBe(180000);
  });
});

describe('F-U2.12.E — imputation des paiements partiels', () => {
  const lateDay = '2026-05-06T08:00:00';
  test('150 000 + 20 000, 100 000 payés : loyer d’abord → 1 500 ; clause « charges d’abord » → 2 100 ; instruction « charges » → 4 500', async () => {
    const def = await lease({ chargesMinor: 20000, natureCharges: 'provision' });
    const clause = await lease({ chargesMinor: 20000, natureCharges: 'provision', ordreImputation: 'charges_d_abord' });
    const explicit = await lease({ chargesMinor: 20000, natureCharges: 'provision' });
    const [dDef, dClause, dExplicit] = [await issued(def.leaseId), await issued(clause.leaseId), await issued(explicit.leaseId)];
    await pay(dDef, 100000, wat('2026-05-02T10:00:00'));
    await pay(dClause, 100000, wat('2026-05-02T10:00:00'));
    const p = await pay(dExplicit, 20000, wat('2026-05-02T10:00:00'));
    await FinancialPayment.updateOne({ _id: p._id }, { $set: { metadata: { rentImputation: { financialDocument: dExplicit._id, rentMinor: 0 } } } });
    await collection.runRentCollectionCycle({ now: wat(lateDay) });
    expect(await Penalty.findOne({ rentDocument: dDef._id }).lean()).toMatchObject({ baseMinor: 50000, penaltyMinor: 1500, imputation: 'RENT_FIRST_DEFAULT' });
    expect(await Penalty.findOne({ rentDocument: dClause._id }).lean()).toMatchObject({ baseMinor: 70000, penaltyMinor: 2100, imputation: 'CONTRACT_CHARGES_FIRST' });
    expect(await Penalty.findOne({ rentDocument: dExplicit._id }).lean()).toMatchObject({ baseMinor: 150000, penaltyMinor: 4500, imputation: 'EXPLICIT_INSTRUCTION' });
  });
});

describe('F-U2.12 — commission de 10 % hors charges', () => {
  async function agencyMandate(propertyId) {
    const b = await beneficiaries.registerBeneficiary({ actor: secretaireA.actor, ownerId: owner._id, kind: 'MOBILE_MONEY', holderName: 'Fictif', institution: 'MTN', accountIdentifier: `2420${Math.floor(10000000 + Math.random() * 89999999)}` });
    await beneficiaries.verifyBeneficiary({ actor: adminA.actor, beneficiaryId: b._id, method: 'Appel', evidence: [{ documentRef: 'doc://fictif' }] });
    const terms = {
      offer: 'DELEGATED_MANAGEMENT', currency: 'XAF', effectiveFrom: new Date('2025-12-01T00:00:00Z'), legalReference: `M-${oid()}`, commission: { basisPoints: 1000, base: 'CONFIRMED_COLLECTED_RENT' },
      collectionMode: 'AGENCY_COLLECTION', payoutFrequency: 'MONTHLY', payoutBeneficiary: b._id,
      feeRules: [{ feeKind: 'COLLECTION', paymentMethod: 'cash', bearer: 'OWNER', pricing: { fixedMinor: 0, basisPoints: 0, tariffSourceReference: 'FIXTURE' } }],
      expenseCaps: { perInterventionMinor: 50000, monthlyCumulativeMinor: 100000, period: 'CALENDAR_MONTH' },
    };
    const { mandate } = await mandates.createMandate({ actor: adminA.actor, propertyId, ownerId: owner._id, reference: `R-${oid()}`, terms, idempotencyKey: `m-${oid()}` });
    return mandates.activateMandate({ actor: adminA.actor, mandateId: mandate._id });
  }
  test('loyer 150 000 + charges 20 000 encaissés : commission 15 000 (pas 17 000) ; non affecté avec charges : refus', async () => {
    const { leaseId, propertyId } = await lease({ chargesMinor: 20000, natureCharges: 'provision' });
    const mandate = await agencyMandate(propertyId);
    const document = await issued(leaseId);
    const payment = await pay(document, 170000, new Date());
    const { collection: recognized } = await funds.recognizeAgencyCollection({ actor: adminA.actor, mandateId: mandate._id, financialPaymentId: payment._id, rentPeriod: { month: 4, year: 2026 }, leaseId });
    expect(recognized.breakdown.commissionMinor).toBe(15000);
    const loose = await FinancialPayment.create({ tenant: A.tenant._id, domain: 'rental', establishmentType: 'Property', establishmentId: propertyId, paymentReference: `P-${oid()}`, status: 'succeeded', method: 'cash', provider: 'manual', currency: 'XAF', amountMinor: 170000, availableAmountMinor: 170000, confirmedAt: new Date(), createdBy: adminA.user._id });
    await expect(funds.recognizeAgencyCollection({ actor: adminA.actor, mandateId: mandate._id, financialPaymentId: loose._id, rentPeriod: { month: 5, year: 2026 }, leaseId })).rejects.toMatchObject({ code: 'COLLECTION_RENT_SHARE_UNDETERMINED' });
  });
});

describe('F-U2.12.F/G — encaissements directs et 1 % des bailleurs sans organisation', () => {
  const currentLabel = () => { const d = calendar.localDay(new Date()); return `${d.year}-${String(d.month).padStart(2, '0')}`; };
  const holderFor = (sub) => ({ holderType: 'USER', holderId: owner._id, subscriptionType: 'IndividualSubscription', subscriptionId: sub._id });
  async function setup() {
    for (const formula of [['GRATUIT', 0], ['STANDARD', 5000], ['ENTREPRISE', 10000]]) {
      const draft = await subscription.draftTariff({ actor: platformOp.actor, formula: formula[0], monthlyPriceMinor: formula[1], variableRateBasisPoints: 100, effectiveFrom: '2020-01-01T00:00:00Z', decisionReference: 'Politique validée (fixture)' });
      await subscription.activateTariff({ actor: platformOp2.actor, tariffId: draft._id });
    }
    const { leaseId } = await lease({ org: false });
    const { document } = await ownerTracking.generateOwnerTrackingRentDue({ actor: { _id: owner._id }, leaseId, period: '2026-04', now: wat('2026-04-30T00:00:00') });
    const sub = await IndividualSubscription.create({ user: owner._id, plan: 'professionnel', status: 'active', startDate: wat('2020-01-01T00:00:00') });
    return { leaseId, document, sub };
  }
  const record = (document, key, extra = {}) => ownerTracking.recordOwnerRentReceipt({ actor: { _id: owner._id }, documentId: document._id, amountMinor: 150000, receivedAt: wat('2026-05-03T10:00:00'), method: 'mobile_money', idempotencyKey: key, ...extra });
  const accrue = (sub, label = currentLabel(), now = new Date(Date.now() + 1000)) => autonomous.accrueVariableFees({ holder: holderFor(sub), period: { ...calendar.rentCalendar(label), label }, now });

  test('déclaré ≠ confirmé : aucun 1 % ; le bailleur ne se confirme pas ; confirmation du locataire → 1 500 ; facture Gratuit 0 + 1 500 ; aucun double', async () => {
    const { document, sub } = await setup();
    const { receipt } = await record(document, 'r1');
    expect(receipt.status).toBe('DECLARED');
    // F-U2.13 : une déclaration ne solde pas la créance (paiement en attente, non affecté).
    expect((await FinancialDocument.findById(document._id).lean()).balanceMinor).toBe(150000);
    expect((await accrue(sub)).accrued).toBe(0);
    expect(await Accrual.countDocuments()).toBe(0);
    await expect(receipts.tenantRespond({ userId: owner._id, receiptId: receipt._id, decision: 'confirm' })).rejects.toMatchObject({ statusCode: 404 });
    await expect(receipts.platformReview({ actor: { _id: owner._id, role: owner.role }, receiptId: receipt._id, decision: 'confirm' })).rejects.toMatchObject({ statusCode: expect.any(Number) });
    await expect(receipts.tenantRespond({ userId: otherTenantUser._id, receiptId: receipt._id, decision: 'confirm' })).rejects.toMatchObject({ statusCode: 404 });
    const res = await request(app).post(`/tenant-portal/direct-receipts/${receipt._id}/respond`).set('Authorization', token(tenantUser)).send({ decision: 'confirm' });
    expect(res.status).toBe(200);
    expect(res.body.data.receipt).toMatchObject({ status: 'CONFIRMED', confirmation: { basis: 'TENANT_CONFIRMATION' } });
    expect((await FinancialDocument.findById(document._id).lean()).balanceMinor).toBe(0);
    await accrue(sub); await accrue(sub);
    expect(await Accrual.find({ kind: 'FEE' }).lean()).toEqual([expect.objectContaining({ baseMinor: 150000, feeMinor: 1500, status: 'accrued', holderType: 'USER' })]);
    const label = currentLabel(); const next = calendar.rentCalendar(label).end;
    const { document: invoice } = await autonomous.generateAutonomousInvoice({ actor: platformOp.actor, subscriptionType: 'IndividualSubscription', subscriptionId: sub._id, period: label, now: new Date(next.getTime() + 1000) });
    expect(invoice).toMatchObject({ totalMinor: 1500, metadata: { pricing: { formula: 'GRATUIT' } } });
    expect((await autonomous.generateAutonomousInvoice({ actor: platformOp.actor, subscriptionType: 'IndividualSubscription', subscriptionId: sub._id, period: label, now: new Date(next.getTime() + 1000) })).created).toBe(false);
  });

  test('preuve par référence : doublon de transaction refusé ; revue plateforme sans preuve refusée, avec preuve confirmée ; contestation après confirmation : frais annulés', async () => {
    const { document, sub } = await setup();
    const { receipt } = await record(document, 'r1', { amountMinor: 100000, evidence: { kind: 'MOBILE_MONEY_REFERENCE', reference: 'MTN-TX-000123' } });
    expect(receipt.status).toBe('EVIDENCE_SUBMITTED');
    const second = await record(document, 'r2', { amountMinor: 50000 });
    await expect(receipts.submitEvidence({ actor: { _id: owner._id }, receiptId: second.receipt._id, kind: 'MOBILE_MONEY_REFERENCE', reference: ' mtn-tx-000123 ' })).rejects.toMatchObject({ code: 'DIRECT_RECEIPT_EVIDENCE_ALREADY_USED' });
    await expect(receipts.platformReview({ actor: platformOp.actor, receiptId: second.receipt._id, decision: 'confirm' })).rejects.toMatchObject({ code: 'DIRECT_RECEIPT_EVIDENCE_REQUIRED' });
    await expect(receipts.platformReview({ actor: adminA.actor, receiptId: receipt._id, decision: 'confirm' })).rejects.toMatchObject({ code: 'FINANCIAL_UNAUTHORIZED' });
    await receipts.platformReview({ actor: platformOp.actor, receiptId: receipt._id, decision: 'start' });
    expect(await receipts.platformReview({ actor: platformOp.actor, receiptId: receipt._id, decision: 'confirm', note: 'Relevé opérateur vérifié' })).toMatchObject({ status: 'CONFIRMED', confirmation: { basis: 'PLATFORM_REVIEW' } });
    await accrue(sub);
    expect(await Accrual.findOne({ kind: 'FEE' }).lean()).toMatchObject({ baseMinor: 100000, feeMinor: 1000, status: 'accrued' });
    await receipts.tenantRespond({ userId: tenantUser._id, receiptId: receipt._id, decision: 'contest', reason: 'Montant non reçu par l’opérateur' });
    await accrue(sub);
    expect(await Accrual.findOne({ kind: 'FEE' }).lean()).toMatchObject({ status: 'cancelled' });
  });

  test('annulation par le bailleur : allocation contrepassée, suivi rétabli ; bien d’une autre organisation inaccessible', async () => {
    const { document } = await setup();
    const { receipt } = await record(document, 'r1');
    await expect(receipts.cancelReceipt({ actor: { _id: otherOwner._id }, receiptId: receipt._id, reason: 'x' })).rejects.toMatchObject({ statusCode: 404 });
    expect(await receipts.cancelReceipt({ actor: { _id: owner._id }, receiptId: receipt._id, reason: 'Saisie erronée' })).toMatchObject({ status: 'CANCELLED' });
    expect((await FinancialDocument.findById(document._id).lean()).balanceMinor).toBe(150000);
    const queue = await receipts.listForPlatform({ actor: platformOp.actor, status: 'CANCELLED' });
    expect(queue.map((r) => String(r.id))).toEqual([String(receipt._id)]);
    await expect(receipts.listForPlatform({ actor: adminB.actor })).rejects.toMatchObject({ code: 'FINANCIAL_UNAUTHORIZED' });
    const mine = await collection.ownerCollection({ actor: { _id: owner._id } });
    expect(mine.directReceipts).toEqual([expect.objectContaining({ status: 'CANCELLED' })]);
    expect((await collection.ownerCollection({ actor: { _id: otherOwner._id } })).directReceipts).toEqual([]);
  });
});
