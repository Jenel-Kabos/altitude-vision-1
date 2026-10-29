// F-U2.9 — tarification de la gestion autonome Altimmo (vrai replica set,
// données fictives). Grille validée : GRATUIT 1 bien 0 FCFA, STANDARD 2–10
// 5 000 FCFA, ENTREPRISE 11–20 10 000 FCFA, GRAND_PORTEFEUILLE 21+ sur devis ;
// 1 % des loyers effectivement encaissés et confirmés. Délégué : 10 %, jamais cumulé.
process.env.FINANCIAL_BENEFICIARY_FINGERPRINT_KEY = 'f-u1-test-fingerprint-key-0123456789abcdef';
const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const { startFinancialMongo, clearFinancialMongo, stopFinancialMongo } = require('./helpers/financialMongoEnvironment');
const { createTenantFixture, createTenantUser, tenantActor } = require('./helpers/tenantAwareFixture');
const { activeGrantFixture } = require('./helpers/contractualGrantFixture');
const User = require('../models/User');
const Property = require('../models/Property');
const RentalManagement = require('../models/RentalManagement');
const PlatformOperator = require('../models/PlatformOperator');
const PlatformTenant = require('../models/PlatformTenant');
const PlatformTenantSubscription = require('../models/PlatformTenantSubscription');
const IndividualSubscription = require('../models/IndividualSubscription');
const FinancialDocument = require('../models/FinancialDocument');
const FinancialDocumentLine = require('../models/FinancialDocumentLine');
const FinancialPayment = require('../models/FinancialPayment');
const PaymentAllocation = require('../models/PaymentAllocation');
const FinancialIssuerIdentity = require('../models/FinancialIssuerIdentity');
const ManagementMandate = require('../models/ManagementMandate');
const ManagementMandateVersion = require('../models/ManagementMandateVersion');
const SubscriptionTariff = require('../models/SubscriptionTariff');
const Accrual = require('../models/AutonomousVariableFeeAccrual');
const PortfolioQuote = require('../models/PortfolioQuote');
const ClassificationSnapshot = require('../models/PortfolioClassificationSnapshot');
const { PLATFORM_WIDE_CONTEXT_SOURCE } = require('../constants/platformOperatorConstants');
const { ALTIMMO_AUTONOMOUS_PRICING } = require('../constants/billingConstants');
const mandates = require('../services/finance/contractual/managementMandateService');
const beneficiaries = require('../services/finance/contractual/financialBeneficiaryService');
const autonomous = require('../services/finance/billing/autonomousBillingService');
const subscription = require('../services/finance/billing/subscriptionBillingService');
const operations = require('../services/finance/billing/billingOperationsService');
const { replaceDraftLines } = require('../services/finance/financialDocumentService');
const { allocatePaymentToDocument, reversePaymentAllocation } = require('../services/finance/paymentAllocationService');
const { errorHandler } = require('../middleware/errorMiddleware');
const routes = require('../routes/billingRoutes');

const app = express(); app.use(express.json()); app.use('/billing', routes); app.use(errorHandler);
jest.setTimeout(300000);
const oid = () => new mongoose.Types.ObjectId();
const AFTER = new Date('2026-10-05T00:00:00Z');
const SEPT = (day = 15) => new Date(`2026-09-${String(day).padStart(2, '0')}T10:00:00Z`);
let seq = 0;
let A; let B; let adminA; let adminA2; let secretaireA; let adminB; let owner; let otherOwner; let platformOp; let platformOp2;

beforeAll(async () => {
  await startFinancialMongo();
  await Promise.all([ManagementMandate, ManagementMandateVersion, SubscriptionTariff, Accrual, PortfolioQuote, ClassificationSnapshot, PaymentAllocation].map((model) => model.syncIndexes()));
});
afterAll(stopFinancialMongo);

async function member(fixture, businessRole) {
  const { user } = await createTenantUser({ ...fixture, businessRole, overrides: { role: 'Client' } });
  return { user, actor: tenantActor(user, fixture.tenant) };
}
async function plainUser(role = 'Proprietaire') {
  seq += 1;
  return User.create({ name: `Personne fictive ${seq}`, email: `fu29-${Date.now()}-${seq}@example.test`, password: 'Password123!', passwordConfirm: 'Password123!', role, isEmailVerified: true });
}
async function operator(capabilities) {
  const user = await plainUser('Client');
  await PlatformOperator.create({ user: user._id, status: 'active', capabilities, grantedBy: oid(), grantReason: 'Test F-U2.9' });
  return { user, actor: { _id: user._id, tenantContextSource: PLATFORM_WIDE_CONTEXT_SOURCE } };
}
const ownerActor = (user) => ({ _id: user._id, role: user.role });
const verifiedPlatformIssuer = () => FinancialIssuerIdentity.create({
  scope: 'PLATFORM', tenant: null, version: 1, legalName: 'Émetteur plateforme fictif', rccm: 'CG-FICTIF-1', niu: 'NIU-FICTIF-1', phone: '+242 00 000 00 00', address: 'Adresse fictive',
  status: 'verified', registeredBy: oid(), verifiedBy: oid(), verifiedAt: new Date(), verificationEvidenceRef: 'fixture',
});

beforeEach(async () => {
  await clearFinancialMongo();
  A = await createTenantFixture({ label: 'FU29 A' }); B = await createTenantFixture({ label: 'FU29 B' });
  adminA = await member(A, 'Admin'); adminA2 = await member(A, 'Admin'); secretaireA = await member(A, 'Secretaire');
  adminB = await member(B, 'Admin');
  owner = await plainUser(); otherOwner = await plainUser();
  for (const capability of ['contractual.beneficiary.verify', 'contractual.financial.approve']) {
    await activeGrantFixture({ user: adminA.user, capability, tenant: A.tenant });
    await activeGrantFixture({ user: adminA2.user, capability, tenant: A.tenant });
  }
  platformOp = await operator(['platform.finance.manage']); platformOp2 = await operator(['platform.finance.manage']);
});

// Tarifs officiels : rédigés et activés par deux personnes distinctes.
async function officialTariffs() {
  for (const formula of ALTIMMO_AUTONOMOUS_PRICING.formulas.filter((f) => f.monthlyPriceMinor != null)) {
    const draft = await subscription.draftTariff({ actor: platformOp.actor, formula: formula.code, monthlyPriceMinor: formula.monthlyPriceMinor, variableRateBasisPoints: 100, effectiveFrom: '2026-01-01T00:00:00Z', decisionReference: 'Politique validée (fixture)' });
    await subscription.activateTariff({ actor: platformOp2.actor, tariffId: draft._id });
  }
}

// Bien géré en autonomie : occupé (compté) par défaut.
async function managedProperty({ ownerId = owner._id, tenant = null, occupied = true, active = true, createdAt = new Date('2026-01-01T00:00:00Z'), workflowHistory = [], availability = 'Disponible' } = {}) {
  const propertyId = oid();
  await Property.collection.insertOne({ _id: propertyId, title: 'Bien fictif', owner: ownerId, tenant, availability });
  await RentalManagement.collection.insertOne({ property: propertyId, owner: ownerId, tenant, active, managementActivated: active, activeLease: occupied ? oid() : null, occupancyStatus: occupied ? 'occupe' : 'vacant', workflowHistory, createdAt, updatedAt: createdAt });
  return propertyId;
}
async function portfolio(count, opts = {}) {
  const ids = [];
  for (let i = 0; i < count; i += 1) ids.push(await managedProperty(opts));
  return ids;
}

// Facture de loyer émise (fixture directe : le moteur de loyer est certifié en F-U2).
async function rentDocument(propertyId, { rentMinor, chargesMinor = 0, tenant = null, period = '2026-09' } = {}) {
  const _id = oid(); const total = rentMinor + chargesMinor; const leaseId = oid();
  await FinancialDocument.collection.insertOne({
    _id, tenant, domain: 'rental', establishmentType: 'Property', establishmentId: propertyId, documentType: 'invoice', documentNumber: `LOY-${_id}`, status: 'issued', paymentStatus: 'unpaid',
    currency: 'XAF', subjectType: 'Contrat', subjectId: leaseId, businessOperationKey: `rent:${leaseId}:${period}`, subtotalMinor: total, discountTotalMinor: 0, taxTotalMinor: 0, feesTotalMinor: 0,
    totalMinor: total, amountPaidMinor: 0, amountAllocatedMinor: 0, balanceMinor: total, createdBy: oid(), metadata: { billingKind: 'RENT', period }, createdAt: new Date(), updatedAt: new Date(),
  });
  const lines = [{ lineType: 'rent', amount: rentMinor }, ...(chargesMinor ? [{ lineType: 'charges', amount: chargesMinor }] : [])];
  await FinancialDocumentLine.insertMany(lines.map((line, index) => ({
    financialDocument: _id, lineNumber: index + 1, lineType: line.lineType, description: line.lineType, quantity: 1, unitAmountMinor: line.amount, subtotalMinor: line.amount, totalMinor: line.amount, sourceType: 'Contrat', sourceId: leaseId, createdBy: oid(),
  })));
  return { _id, leaseId };
}
async function payment(propertyId, amountMinor, { status = 'succeeded', confirmedAt = SEPT(), tenant = null } = {}) {
  return FinancialPayment.create({
    tenant, domain: 'rental', establishmentType: 'Property', establishmentId: propertyId, paymentReference: `P-${oid()}`, status, method: 'cash', provider: 'manual',
    currency: 'XAF', amountMinor, availableAmountMinor: amountMinor, confirmedAt: ['succeeded'].includes(status) ? confirmedAt : undefined, createdBy: oid(),
  });
}
// Loyer encaissé et confirmé, alloué à la facture du bien.
async function collect(propertyId, rentMinor, collectedMinor = rentMinor, opts = {}) {
  const doc = await rentDocument(propertyId, { rentMinor, chargesMinor: opts.chargesMinor || 0, tenant: opts.tenant || null, ...(opts.period ? { period: opts.period } : {}) });
  const pay = await payment(propertyId, collectedMinor, opts);
  const allocation = await allocatePaymentToDocument({ paymentId: pay._id, documentId: doc._id, amountMinor: collectedMinor, businessOperationKey: `alloc-${oid()}`, actor: { _id: oid() }, transactionMode: 'transactional' });
  return { doc, pay, allocation };
}
const individual = (user = owner, extra = {}) => IndividualSubscription.create({ user: user._id, plan: 'professionnel', status: 'active', startDate: new Date('2026-01-01T00:00:00Z'), ...extra });
const invoice = (sub, period = '2026-09', actor = platformOp.actor) => autonomous.generateAutonomousInvoice({ actor, subscriptionType: sub.constructor.modelName, subscriptionId: sub._id, period, now: AFTER });
const linesOf = (documentId) => FinancialDocumentLine.find({ financialDocument: documentId }).sort({ lineNumber: 1 }).lean();

async function delegatedMandate(propertyId, effectiveFrom = '2025-12-01T00:00:00Z') {
  const b = await beneficiaries.registerBeneficiary({ actor: secretaireA.actor, ownerId: owner._id, kind: 'MOBILE_MONEY', holderName: 'Fictif', institution: 'MTN', accountIdentifier: `2420${Math.floor(10000000 + Math.random() * 89999999)}` });
  await beneficiaries.verifyBeneficiary({ actor: adminA.actor, beneficiaryId: b._id, method: 'Appel', evidence: [{ documentRef: 'doc://fictif' }] });
  const terms = {
    offer: 'DELEGATED_MANAGEMENT', currency: 'XAF', effectiveFrom: new Date(effectiveFrom), legalReference: `M-${oid()}`,
    commission: { basisPoints: 1000, base: 'CONFIRMED_COLLECTED_RENT' }, collectionMode: 'AGENCY_COLLECTION', payoutFrequency: 'MONTHLY', payoutBeneficiary: b._id,
    feeRules: [{ feeKind: 'COLLECTION', paymentMethod: 'cash', bearer: 'OWNER', pricing: { fixedMinor: 0, basisPoints: 0, tariffSourceReference: 'FIXTURE' } }],
    expenseCaps: { perInterventionMinor: 50000, monthlyCumulativeMinor: 100000, period: 'CALENDAR_MONTH' },
  };
  const { mandate } = await mandates.createMandate({ actor: adminA.actor, propertyId, ownerId: owner._id, reference: `R-${oid()}`, terms, idempotencyKey: `m-${oid()}` });
  return mandates.activateMandate({ actor: adminA.actor, mandateId: mandate._id });
}

describe('F-U2.9 — classement et calcul (pur)', () => {
  test('bornes 1, 2, 10, 11, 20, 21 et hors domaine', () => {
    expect([1, 2, 10, 11, 20, 21, 250].map(autonomous.classifyCount)).toEqual(['GRATUIT', 'STANDARD', 'STANDARD', 'ENTREPRISE', 'ENTREPRISE', 'GRAND_PORTEFEUILLE', 'GRAND_PORTEFEUILLE']);
    expect([0, -1, 1.5, NaN].map(autonomous.classifyCount)).toEqual([null, null, null, null]);
  });
  test('1 % exact : 100 000 → 1 000, 600 000 → 6 000, 2 000 000 → 20 000, 60 000 → 600, 0 → 0', () => {
    expect([100000, 600000, 2000000, 60000, 0].map(autonomous.variableFeeMinor)).toEqual([1000, 6000, 20000, 600, 0]);
  });
  test('grille publique : montants, seuils et taux validés inchangés', () => {
    expect(autonomous.publicPricing()).toMatchObject({ variableRateBasisPoints: 100, currency: 'XAF', formulas: [
      { code: 'GRATUIT', minProperties: 1, maxProperties: 1, monthlyPriceMinor: 0 }, { code: 'STANDARD', minProperties: 2, maxProperties: 10, monthlyPriceMinor: 5000 },
      { code: 'ENTREPRISE', minProperties: 11, maxProperties: 20, monthlyPriceMinor: 10000 }, { code: 'GRAND_PORTEFEUILLE', minProperties: 21, maxProperties: null, monthlyPriceMinor: null },
    ] });
  });
});

describe('F-U2.9 — exemples de facturation', () => {
  beforeEach(async () => { await officialTariffs(); await verifiedPlatformIssuer(); });

  test('exemple 1 — GRATUIT, 100 000 encaissés : 0 + 1 000 = 1 000 FCFA ; émission plateforme', async () => {
    const [p] = await portfolio(1);
    const { allocation } = await collect(p, 100000);
    const sub = await individual();
    const { document, created } = await invoice(sub);
    expect(created).toBe(true);
    expect(document).toMatchObject({ totalMinor: 1000, status: 'draft', businessOperationKey: `autonomous:IndividualSubscription:${sub._id}:2026-09` });
    expect(document.metadata).toMatchObject({ billingKind: 'AUTONOMOUS_SUBSCRIPTION', pricing: { formula: 'GRATUIT', version: ALTIMMO_AUTONOMOUS_PRICING.version, variableRateBasisPoints: 100 }, issuerPlan: { role: 'PLATFORM' } });
    const lines = await linesOf(document._id);
    expect(lines.map((l) => [l.lineType, l.totalMinor])).toEqual([['subscription', 0], ['fee', 1000]]);
    expect(lines[1]).toMatchObject({ sourceType: 'PaymentAllocation', sourceId: allocation._id });
    expect(lines.some((l) => l.lineType === 'commission')).toBe(false);
    const fee = await Accrual.findOne({ allocation: allocation._id }).lean();
    expect(fee).toMatchObject({ status: 'invoiced', baseMinor: 100000, rateBasisPoints: 100, feeMinor: 1000, property: p, policyVersion: ALTIMMO_AUTONOMOUS_PRICING.version, period: '2026-09' });
    expect(String(fee.financialDocument)).toBe(String(document._id));
    const issued = await operations.issueDocument({ actor: platformOp.actor, documentId: document._id });
    expect(issued.status).toBe('issued');
    expect(issued.documentNumber).toBeTruthy();
  });

  test('exemple 2 — STANDARD, 600 000 encaissés : 5 000 + 6 000 = 11 000 FCFA', async () => {
    const props = await portfolio(3);
    await collect(props[0], 200000); await collect(props[1], 250000); await collect(props[2], 150000);
    const { document } = await invoice(await individual());
    expect(document.totalMinor).toBe(11000);
    expect(document.metadata.pricing.formula).toBe('STANDARD');
    expect(document.metadata.variableFees).toMatchObject({ count: 3, baseMinor: 600000, feeMinor: 6000 });
  });

  test('exemple 3 — ENTREPRISE (organisation), 2 000 000 encaissés : 10 000 + 20 000 = 30 000 FCFA', async () => {
    const props = await portfolio(12, { tenant: A.tenant._id });
    for (const p of props.slice(0, 10)) await collect(p, 200000, 200000, { tenant: A.tenant._id });
    const sub = await PlatformTenantSubscription.create({ tenant: A.tenant._id, plan: 'professionnel', status: 'active', startDate: new Date('2026-01-01T00:00:00Z') });
    const { document } = await invoice(sub);
    expect(document.totalMinor).toBe(30000);
    expect(document.metadata.pricing.formula).toBe('ENTREPRISE');
    expect(document.metadata.classification.counted).toBe(12);
  });

  test('exemple 4 — paiement partiel de 60 000 sur 100 000 : 600 FCFA', async () => {
    const [p] = await portfolio(1);
    await collect(p, 100000, 60000);
    const { document } = await invoice(await individual());
    expect(document.totalMinor).toBe(600);
  });

  test('exemple 5 — loyer impayé : 0 de frais variables, abonnement fixe dû (STANDARD 5 000)', async () => {
    const props = await portfolio(2);
    await rentDocument(props[0], { rentMinor: 100000 }); // facturé, jamais encaissé
    const { document } = await invoice(await individual());
    expect(document.totalMinor).toBe(5000);
    expect((await linesOf(document._id)).map((l) => l.lineType)).toEqual(['subscription']);
  });

  test('charges exclues de la base : 100 000 loyer + 10 000 charges encaissés → 1 000', async () => {
    const [p] = await portfolio(1);
    await collect(p, 100000, 110000, { chargesMinor: 10000 });
    const { document } = await invoice(await individual());
    expect(document.totalMinor).toBe(1000);
  });

  test('encaissements multiples sur un même loyer : une ligne par encaissement, total exact', async () => {
    const [p] = await portfolio(1);
    const doc = await rentDocument(p, { rentMinor: 100000 });
    for (const amount of [30000, 70000]) {
      const pay = await payment(p, amount);
      await allocatePaymentToDocument({ paymentId: pay._id, documentId: doc._id, amountMinor: amount, businessOperationKey: `alloc-${oid()}`, actor: { _id: oid() }, transactionMode: 'transactional' });
    }
    const { document } = await invoice(await individual());
    expect((await linesOf(document._id)).filter((l) => l.lineType === 'fee').map((l) => l.totalMinor)).toEqual([300, 700]);
    expect(document.totalMinor).toBe(1000);
  });
});

describe('F-U2.9 — seuls les loyers effectivement encaissés et confirmés', () => {
  beforeEach(officialTariffs);

  test('paiements déclarés, en attente ou échoués : aucun frais', async () => {
    const [p] = await portfolio(1);
    const doc = await rentDocument(p, { rentMinor: 100000 });
    for (const status of ['pending', 'processing', 'failed']) {
      const pay = await payment(p, 50000, { status });
      await PaymentAllocation.collection.insertOne({ financialPayment: pay._id, financialDocument: doc._id, amountMinor: 50000, status: 'active', businessOperationKey: `legacy-${oid()}`, createdAt: SEPT() });
    }
    const sub = await individual();
    const result = await autonomous.accrueVariableFees({ holder: { holderType: 'USER', holderId: owner._id, subscriptionType: 'IndividualSubscription', subscriptionId: sub._id }, period: { start: new Date('2026-08-31T23:00:00Z'), end: new Date('2026-09-30T23:00:00Z'), label: '2026-09' }, now: AFTER });
    expect(result).toMatchObject({ accrued: 0, notConfirmed: 3 });
    expect(await Accrual.countDocuments()).toBe(0);
  });

  test('encaissement confirmé hors période : rattaché au mois de confirmation, pas au mois du loyer', async () => {
    const [p] = await portfolio(1);
    await collect(p, 100000, 100000, { confirmedAt: new Date('2026-10-02T10:00:00Z') });
    const { document } = await invoice(await individual());
    expect(document.totalMinor).toBe(0);
    expect(await Accrual.countDocuments({ period: '2026-09' })).toBe(0);
  });
});

describe('F-U2.9 — idempotence, concurrence, contrepassation', () => {
  beforeEach(async () => { await officialTariffs(); await verifiedPlatformIssuer(); });

  test('appels simultanés : une seule facture, un seul frais par encaissement', async () => {
    const props = await portfolio(2);
    await collect(props[0], 100000); await collect(props[1], 300000);
    const sub = await individual();
    const results = await Promise.allSettled([invoice(sub), invoice(sub), invoice(sub)]);
    const ok = results.filter((r) => r.status === 'fulfilled').map((r) => r.value);
    expect(ok.length).toBeGreaterThan(0);
    expect(await FinancialDocument.countDocuments({ 'metadata.billingKind': 'AUTONOMOUS_SUBSCRIPTION' })).toBe(1);
    expect(await Accrual.countDocuments({ kind: 'FEE' })).toBe(2);
    const document = await FinancialDocument.findOne({ 'metadata.billingKind': 'AUTONOMOUS_SUBSCRIPTION' }).lean();
    expect(document.totalMinor).toBe(9000);
    expect((await linesOf(document._id)).length).toBe(3);
    const replay = await invoice(sub);
    expect(replay.created).toBe(false);
  });

  test('constatation concurrente : index unique {allocation, kind}', async () => {
    const [p] = await portfolio(1);
    await collect(p, 100000);
    const sub = await individual();
    const holder = { holderType: 'USER', holderId: owner._id, subscriptionType: 'IndividualSubscription', subscriptionId: sub._id };
    const period = { start: new Date('2026-08-31T23:00:00Z'), end: new Date('2026-09-30T23:00:00Z'), label: '2026-09' };
    await Promise.all([1, 2, 3, 4].map(() => autonomous.accrueVariableFees({ holder, period, now: AFTER })));
    expect(await Accrual.countDocuments()).toBe(1);
  });

  test('contrepassation avant facturation : frais annulés, non facturés', async () => {
    const [p] = await portfolio(1);
    const { allocation } = await collect(p, 100000);
    const sub = await individual();
    const holder = { holderType: 'USER', holderId: owner._id, subscriptionType: 'IndividualSubscription', subscriptionId: sub._id };
    const period = { start: new Date('2026-08-31T23:00:00Z'), end: new Date('2026-09-30T23:00:00Z'), label: '2026-09' };
    await autonomous.accrueVariableFees({ holder, period, now: AFTER });
    await reversePaymentAllocation({ allocationId: allocation._id, reason: 'Erreur de saisie fictive', businessOperationKey: `rev-${oid()}`, actor: { _id: oid() }, transactionMode: 'transactional' });
    const { document } = await invoice(sub);
    expect(document.totalMinor).toBe(0);
    expect(await Accrual.findOne({ allocation: allocation._id }).lean()).toMatchObject({ status: 'cancelled' });
  });

  test('contrepassation après facturation : ajustement tracé en attente de décision, facture inchangée, aucun avoir automatique', async () => {
    const [p] = await portfolio(1);
    const { allocation } = await collect(p, 100000);
    const sub = await individual();
    const { document } = await invoice(sub);
    await operations.issueDocument({ actor: platformOp.actor, documentId: document._id });
    await reversePaymentAllocation({ allocationId: allocation._id, reason: 'Remboursement fictif', businessOperationKey: `rev-${oid()}`, actor: { _id: oid() }, transactionMode: 'transactional' });
    const holder = { holderType: 'USER', holderId: owner._id, subscriptionType: 'IndividualSubscription', subscriptionId: sub._id };
    const period = { start: new Date('2026-08-31T23:00:00Z'), end: new Date('2026-09-30T23:00:00Z'), label: '2026-09' };
    await autonomous.accrueVariableFees({ holder, period, now: AFTER });
    await autonomous.accrueVariableFees({ holder, period, now: AFTER });
    expect(await Accrual.find({ allocation: allocation._id }).sort({ kind: 1 }).lean()).toMatchObject([{ kind: 'FEE', status: 'invoiced' }, { kind: 'REVERSAL', status: 'reversal_pending_decision', feeMinor: 1000 }]);
    const after = await FinancialDocument.findById(document._id).lean();
    expect(after).toMatchObject({ status: 'issued', totalMinor: 1000 });
    expect(await FinancialDocument.countDocuments({ documentType: 'credit_note' })).toBe(0);
    await expect(replaceDraftLines(document._id, [{ lineType: 'fee', description: 'x', quantity: 1, unitAmountMinor: 1, sourceType: 'PaymentAllocation', sourceId: oid() }], platformOp.user._id)).rejects.toMatchObject({ code: 'FINANCIAL_DOCUMENT_IMMUTABLE' });
  });

  test('pas de double facture d’abonnement pour le même mois (formule historique / autonome)', async () => {
    const [p] = await portfolio(1);
    await collect(p, 100000);
    const sub = await individual();
    await invoice(sub);
    await expect(subscription.generateSubscriptionInvoice({ actor: platformOp.actor, subscriptionType: 'IndividualSubscription', subscriptionId: sub._id, period: '2026-09' })).rejects.toMatchObject({ code: expect.stringMatching(/BILLING_PERIOD_ALREADY_INVOICED|SUBSCRIPTION_PRICE_NOT_CONFIGURED/) });
  });
});

describe('F-U2.9 — gestion autonome vs déléguée', () => {
  beforeEach(officialTariffs);

  test('bien sous mandat délégué actif : exclu du comptage, jamais 1 % (régime 10 %) ; changement de mode selon la PÉRIODE du loyer (F-U2.13)', async () => {
    const props = await portfolio(3, { tenant: A.tenant._id });
    // Loyer de janvier (période autonome) ; mandat délégué en vigueur dès février.
    const before = await collect(props[0], 100000, 100000, { tenant: A.tenant._id, confirmedAt: new Date('2026-01-15T10:00:00Z'), period: '2026-01' });
    await delegatedMandate(props[0], '2026-02-01T00:00:00Z');
    const now = new Date();
    const after = await collect(props[0], 100000, 100000, { tenant: A.tenant._id, confirmedAt: now, period: '2026-09' });
    const sub = await PlatformTenantSubscription.create({ tenant: A.tenant._id, plan: 'professionnel', status: 'active', startDate: new Date('2026-01-01T00:00:00Z') });
    const holder = { holderType: 'TENANT', holderId: A.tenant._id, subscriptionType: 'PlatformTenantSubscription', subscriptionId: sub._id };
    const january = { start: new Date('2025-12-31T23:00:00Z'), end: new Date('2026-01-31T23:00:00Z'), label: '2026-01' };
    const current = { start: new Date(now.getTime() - 86400000), end: new Date(now.getTime() + 86400000), label: 'courant' };
    expect(await autonomous.accrueVariableFees({ holder, period: january, now })).toMatchObject({ accrued: 1, excludedDelegated: 0 });
    expect(await autonomous.accrueVariableFees({ holder, period: current, now: new Date(now.getTime() + 60000) })).toMatchObject({ accrued: 0, excludedDelegated: 1 });
    expect(await Accrual.exists({ allocation: before.allocation._id })).toBeTruthy();
    expect(await Accrual.exists({ allocation: after.allocation._id })).toBeNull();
    const classification = await autonomous.classifyHolder(holder);
    expect(classification).toMatchObject({ counted: 2, formula: 'STANDARD' });
    expect(classification.counts.DELEGATED).toBe(1);
  });
});

describe('F-U2.9 — portefeuille : comptage, ambiguïtés, changements', () => {
  beforeEach(async () => { await officialTariffs(); await verifiedPlatformIssuer(); });

  test('F-U2.12 : bien vacant compté (1 occupé + 1 vacant = STANDARD) ; bien clôturé pouvant changer la formule : facture fixe bloquée, frais 1 % conservés', async () => {
    const [p] = await portfolio(1);
    await managedProperty({ occupied: false });
    await collect(p, 100000);
    const sub = await individual();
    const { document } = await invoice(sub);
    expect(document).toMatchObject({ totalMinor: 6000, metadata: { pricing: { formula: 'STANDARD' }, classification: { counted: 2 } } });
    const other = await individual(otherOwner);
    await managedProperty({ ownerId: otherOwner._id });
    await managedProperty({ ownerId: otherOwner._id, availability: 'Vendu' });
    await expect(invoice(other)).rejects.toMatchObject({ code: 'AUTONOMOUS_CLASSIFICATION_AMBIGUOUS' });
    expect(await FinancialDocument.countDocuments({ 'metadata.billingKind': 'AUTONOMOUS_SUBSCRIPTION' })).toBe(1);
    expect(await ClassificationSnapshot.countDocuments({ holderId: otherOwner._id, ambiguous: true })).toBe(1);
  });

  test('bien vacant sans effet sur la formule : non bloquant', async () => {
    await portfolio(3);
    await managedProperty({ occupied: false });
    const { document } = await invoice(await individual());
    expect(document.totalMinor).toBe(5000);
  });

  test('changement de formule en cours de mois : bloqué (prorata non décidé), historique conservé', async () => {
    await portfolio(1);
    await managedProperty({ createdAt: SEPT(10), workflowHistory: [{ action: 'rental_management_enabled', at: SEPT(10) }] });
    const sub = await individual();
    await expect(invoice(sub)).rejects.toMatchObject({ code: 'AUTONOMOUS_CLASSIFICATION_AMBIGUOUS', message: expect.stringContaining('FORMULA_CHANGED_DURING_PERIOD_PRORATA_UNDEFINED') });
    const snapshots = await ClassificationSnapshot.find({ holderId: owner._id }).lean();
    expect(snapshots[0]).toMatchObject({ formula: 'STANDARD', countingPolicyStatus: 'VALIDATED' });
  });

  test('période non close, essai, abonnement partiel : refus explicites', async () => {
    await portfolio(1);
    const sub = await individual();
    await expect(autonomous.generateAutonomousInvoice({ actor: platformOp.actor, subscriptionType: 'IndividualSubscription', subscriptionId: sub._id, period: '2026-09', now: SEPT(20) })).rejects.toMatchObject({ code: 'BILLING_PERIOD_NOT_CLOSED' });
    const trial = await individual(otherOwner, { status: 'trialing' });
    await expect(invoice(trial)).rejects.toMatchObject({ code: 'SUBSCRIPTION_TRIAL_BILLING_RULE_UNDEFINED' });
    await IndividualSubscription.updateOne({ _id: sub._id }, { $set: { startDate: SEPT(10) } });
    await expect(invoice(await IndividualSubscription.findById(sub._id))).rejects.toMatchObject({ code: 'SUBSCRIPTION_PARTIAL_PERIOD_RULE_NOT_CONFIGURED' });
  });
});

describe('F-U2.9 — Grand portefeuille', () => {
  beforeEach(officialTariffs);

  test('21 biens : facture refusée sans devis accepté ; devis préparé par la plateforme, accepté par le titulaire', async () => {
    const props = await portfolio(21);
    await collect(props[0], 100000);
    const sub = await individual();
    await expect(invoice(sub)).rejects.toMatchObject({ code: 'GRAND_PORTEFEUILLE_QUOTE_REQUIRED' });
    await expect(autonomous.prepareQuote({ actor: adminA.actor, subscriptionType: 'IndividualSubscription', subscriptionId: sub._id, monthlyPriceMinor: 15000, effectiveFrom: '2026-09-01T00:00:00Z', decisionReference: 'Devis fictif' })).rejects.toMatchObject({ code: 'FINANCIAL_UNAUTHORIZED' });
    const quote = await autonomous.prepareQuote({ actor: platformOp.actor, subscriptionType: 'IndividualSubscription', subscriptionId: sub._id, monthlyPriceMinor: 15000, effectiveFrom: '2026-08-31T23:00:00Z', decisionReference: 'Devis fictif' });
    expect(quote).toMatchObject({ status: 'proposed', countedPropertiesAtQuote: 21 });
    await expect(invoice(sub)).rejects.toMatchObject({ code: 'GRAND_PORTEFEUILLE_QUOTE_REQUIRED' });
    await expect(autonomous.decideQuote({ actor: ownerActor(otherOwner), quoteId: quote._id, decision: 'accept' })).rejects.toMatchObject({ code: 'FINANCIAL_RESOURCE_OUT_OF_SCOPE' });
    await expect(autonomous.decideQuote({ actor: platformOp.actor, quoteId: quote._id, decision: 'accept' })).rejects.toMatchObject({ code: 'FINANCIAL_RESOURCE_OUT_OF_SCOPE' });
    const accepted = await autonomous.decideQuote({ actor: ownerActor(owner), quoteId: quote._id, decision: 'accept' });
    expect(accepted).toMatchObject({ status: 'accepted', decisionMethod: 'IN_APP' });
    expect(accepted.history.map((h) => h.action)).toEqual(['prepare', 'accept']);
    await expect(autonomous.decideQuote({ actor: ownerActor(owner), quoteId: quote._id, decision: 'reject' })).rejects.toMatchObject({ code: 'BILLING_QUOTE_INVALID_TRANSITION' });
    const { document } = await invoice(sub);
    expect(document.totalMinor).toBe(16000);
    expect(document.metadata.pricing.fixedPriceSource).toMatchObject({ type: 'PortfolioQuote' });
  });

  test('devis non applicable sous 21 biens', async () => {
    await portfolio(5);
    const sub = await individual();
    await expect(autonomous.prepareQuote({ actor: platformOp.actor, subscriptionType: 'IndividualSubscription', subscriptionId: sub._id, monthlyPriceMinor: 1, effectiveFrom: '2026-09-01T00:00:00Z', decisionReference: 'x' })).rejects.toMatchObject({ code: 'PORTFOLIO_QUOTE_NOT_APPLICABLE' });
  });
});

describe('F-U2.9 — tarifs officiels, droits, émetteur, isolement', () => {
  test('tarif divergent refusé ; Admin d’organisation ne peut pas créer de tarif ; activation par une seconde personne ; historique versionné', async () => {
    await expect(subscription.draftTariff({ actor: platformOp.actor, formula: 'STANDARD', monthlyPriceMinor: 6000, variableRateBasisPoints: 100, effectiveFrom: '2026-01-01T00:00:00Z', decisionReference: 'x' })).rejects.toMatchObject({ code: 'TARIFF_DIFFERS_FROM_VALIDATED_POLICY' });
    await expect(subscription.draftTariff({ actor: platformOp.actor, formula: 'STANDARD', monthlyPriceMinor: 5000, variableRateBasisPoints: 70, effectiveFrom: '2026-01-01T00:00:00Z', decisionReference: 'x' })).rejects.toMatchObject({ code: 'TARIFF_DIFFERS_FROM_VALIDATED_POLICY' });
    await expect(subscription.draftTariff({ actor: adminA.actor, formula: 'STANDARD', monthlyPriceMinor: 5000, variableRateBasisPoints: 100, effectiveFrom: '2026-01-01T00:00:00Z', decisionReference: 'x' })).rejects.toMatchObject({ code: 'FINANCIAL_UNAUTHORIZED' });
    const v1 = await subscription.draftTariff({ actor: platformOp.actor, formula: 'STANDARD', monthlyPriceMinor: 5000, variableRateBasisPoints: 100, effectiveFrom: '2026-01-01T00:00:00Z', decisionReference: 'x' });
    await expect(subscription.activateTariff({ actor: platformOp.actor, tariffId: v1._id })).rejects.toMatchObject({ code: 'FINANCIAL_SEGREGATION_OF_DUTIES' });
    await subscription.activateTariff({ actor: platformOp2.actor, tariffId: v1._id });
    const v2 = await subscription.draftTariff({ actor: platformOp.actor, formula: 'STANDARD', monthlyPriceMinor: 5000, variableRateBasisPoints: 100, effectiveFrom: '2027-01-01T00:00:00Z', decisionReference: 'y' });
    expect([v1.version, v2.version]).toEqual([1, 2]);
    expect(await SubscriptionTariff.countDocuments({ formula: 'STANDARD' })).toBe(2);
  });

  test('sans tarif activé : refus explicite, jamais un prix supposé', async () => {
    await portfolio(2);
    await expect(invoice(await individual())).rejects.toMatchObject({ code: 'SUBSCRIPTION_PRICE_NOT_CONFIGURED' });
  });

  test('génération et émission réservées à la plateforme ; émetteur vérifié obligatoire', async () => {
    await officialTariffs();
    await portfolio(1);
    const sub = await individual();
    await expect(invoice(sub, '2026-09', adminA.actor)).rejects.toMatchObject({ code: 'FINANCIAL_UNAUTHORIZED' });
    await expect(invoice(sub, '2026-09', ownerActor(owner))).rejects.toMatchObject({ statusCode: expect.any(Number) });
    const { document } = await invoice(sub);
    await expect(operations.issueDocument({ actor: platformOp.actor, documentId: document._id })).rejects.toMatchObject({ code: 'ISSUER_IDENTITY_NOT_VERIFIED' });
    await expect(operations.issueDocument({ actor: adminA.actor, documentId: document._id })).rejects.toMatchObject({ statusCode: 404 });
  });

  test('synthèse : propriétaire sans organisation voit ses données ; isolement entre titulaires et organisations', async () => {
    await officialTariffs();
    const props = await portfolio(2);
    await collect(props[0], 100000);
    const sub = await individual();
    await autonomous.accrueVariableFees({ holder: { holderType: 'USER', holderId: owner._id, subscriptionType: 'IndividualSubscription', subscriptionId: sub._id }, period: { start: new Date('2026-08-31T23:00:00Z'), end: new Date('2026-09-30T23:00:00Z'), label: '2026-09' }, now: AFTER });
    const mine = await autonomous.autonomousSummary({ actor: ownerActor(owner) });
    expect(mine).toMatchObject({ subscribed: true, holderType: 'USER', classification: { formula: 'STANDARD', counted: 2 }, current: { fixedMonthlyMinor: 5000, confirmedRentBaseMinor: 100000, variableFeesMinor: 1000, totalDueEstimateMinor: 6000 } });
    const other = await autonomous.autonomousSummary({ actor: ownerActor(otherOwner) });
    expect(other).toMatchObject({ subscribed: false });
    const orgB = await autonomous.autonomousSummary({ actor: adminB.actor });
    // L'organisation B ne voit que son propre abonnement (fixture), jamais celui du propriétaire.
    if (orgB.subscribed) expect(orgB).toMatchObject({ holderType: 'TENANT', accruals: [], current: { variableFeesMinor: 0 } });
    expect(JSON.stringify(orgB)).not.toContain(String(props[0]));
  });

  test('HTTP : grille publique ; génération refusée à un Admin d’organisation ; tenant:null sans contexte PLATFORM ≠ plateforme', async () => {
    const token = (user) => jwt.sign({ id: user._id, tokenVersion: 0 }, process.env.JWT_SECRET, { expiresIn: '1h' });
    const pricing = await request(app).get('/billing/autonomous/pricing').set('Authorization', `Bearer ${token(owner)}`);
    expect(pricing.status).toBe(200);
    expect(pricing.body.data.formulas.map((f) => f.code)).toEqual(['GRATUIT', 'STANDARD', 'ENTREPRISE', 'GRAND_PORTEFEUILLE']);
    const sub = await individual();
    const refused = await request(app).post('/billing/autonomous-invoices').set('Authorization', `Bearer ${token(adminA.user)}`).set('X-Platform-Tenant-Id', String(A.tenant._id)).send({ subscriptionType: 'IndividualSubscription', subscriptionId: String(sub._id), period: '2026-09' });
    expect(refused.status).toBe(403);
    const noContext = await request(app).post('/billing/autonomous-invoices').set('Authorization', `Bearer ${token(platformOp.user)}`).send({ subscriptionType: 'IndividualSubscription', subscriptionId: String(sub._id), period: '2026-09' });
    expect([401, 403]).toContain(noContext.status);
    const summary = await request(app).get('/billing/autonomous/summary').set('Authorization', `Bearer ${token(owner)}`);
    expect(summary.status).toBe(200);
    expect(summary.body.data.subscribed).toBe(true);
  });
});

// Garde-fou : PlatformTenant suspendu → facturation suspendue (règle de suspension pour impayés NON décidée : non implémentée).
describe('F-U2.9 — organisation suspendue', () => {
  test('organisation suspendue : facture refusée', async () => {
    await officialTariffs();
    await portfolio(2, { tenant: B.tenant._id });
    const sub = await PlatformTenantSubscription.create({ tenant: B.tenant._id, plan: 'professionnel', status: 'active', startDate: new Date('2026-01-01T00:00:00Z') });
    await PlatformTenant.updateOne({ _id: B.tenant._id }, { $set: { status: 'suspended' } });
    await expect(invoice(sub)).rejects.toMatchObject({ code: 'SUBSCRIPTION_BILLING_SUSPENDED' });
  });
});
