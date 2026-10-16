// F-U2 — facturation financière unifiée (vrai replica set, données fictives).
process.env.FINANCIAL_BENEFICIARY_FINGERPRINT_KEY = 'f-u1-test-fingerprint-key-0123456789abcdef';
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
const Contrat = require('../models/Contrat');
const Locataire = require('../models/Locataire');
const Paiement = require('../models/Paiement');
const PlatformOperator = require('../models/PlatformOperator');
const PlatformTenant = require('../models/PlatformTenant');
const PlatformTenantSubscription = require('../models/PlatformTenantSubscription');
const IndividualSubscription = require('../models/IndividualSubscription');
const FinancialDocument = require('../models/FinancialDocument');
const FinancialDocumentLine = require('../models/FinancialDocumentLine');
const FinancialPayment = require('../models/FinancialPayment');
const FinancialRefund = require('../models/FinancialRefund');
const FinancialIssuerIdentity = require('../models/FinancialIssuerIdentity');
const ManagementMandate = require('../models/ManagementMandate');
const ManagementMandateVersion = require('../models/ManagementMandateVersion');
const MandateCollection = require('../models/MandateCollection');
const OwnerFinancialObligation = require('../models/OwnerFinancialObligation');
const SubscriptionTariff = require('../models/SubscriptionTariff');
const HotelReservation = require('../models/HotelReservation');
const { PLATFORM_WIDE_CONTEXT_SOURCE } = require('../constants/platformOperatorConstants');
const mandates = require('../services/finance/contractual/managementMandateService');
const beneficiaries = require('../services/finance/contractual/financialBeneficiaryService');
const funds = require('../services/finance/contractual/ownerFundsService');
const rent = require('../services/finance/billing/rentBillingService');
const commission = require('../services/finance/billing/commissionBillingService');
const subscription = require('../services/finance/billing/subscriptionBillingService');
const operations = require('../services/finance/billing/billingOperationsService');
const { replaceDraftLines, issueFinancialDocument } = require('../services/finance/financialDocumentService');
const { allocatePaymentToDocument } = require('../services/finance/paymentAllocationService');
const { errorHandler } = require('../middleware/errorMiddleware');
const routes = require('../routes/billingRoutes');

const app = express(); app.use(express.json()); app.use('/billing', routes); app.use(errorHandler);
jest.setTimeout(240000);
const oid = () => new mongoose.Types.ObjectId();
const DAY = 86400000;
let seq = 0;
let A; let B; let adminA; let adminA2; let secretaireA; let gestionnaireA; let adminB; let owner; let otherOwner; let platformOp; let platformOp2;

beforeAll(async () => {
  await startFinancialMongo();
  await Promise.all([ManagementMandate, ManagementMandateVersion, MandateCollection, OwnerFinancialObligation, SubscriptionTariff].map((model) => model.syncIndexes()));
});
afterAll(stopFinancialMongo);

async function member(fixture, businessRole) {
  const { user } = await createTenantUser({ ...fixture, businessRole, overrides: { role: 'Client' } });
  return { user, actor: tenantActor(user, fixture.tenant) };
}
async function plainUser(role = 'Proprietaire') {
  seq += 1;
  return User.create({ name: `Personne fictive ${seq}`, email: `fu2-${Date.now()}-${seq}@example.test`, password: 'Password123!', passwordConfirm: 'Password123!', role, isEmailVerified: true });
}
async function operator(capabilities) {
  const user = await plainUser('Client');
  await PlatformOperator.create({ user: user._id, status: 'active', capabilities, grantedBy: oid(), grantReason: 'Test F-U2' });
  return { user, actor: { _id: user._id, tenantContextSource: PLATFORM_WIDE_CONTEXT_SOURCE } };
}
const verifiedIssuer = (scope, tenant = null, version = 1, legalName = `Émetteur fictif ${scope}`) => FinancialIssuerIdentity.create({
  scope, tenant, version, legalName, rccm: `CG-FICTIF-${version}`, niu: `NIU-FICTIF-${version}`, phone: '+242 00 000 00 00', address: 'Adresse fictive',
  status: 'verified', registeredBy: oid(), verifiedBy: oid(), verifiedAt: new Date(), verificationEvidenceRef: 'fixture',
});

beforeEach(async () => {
  await clearFinancialMongo();
  A = await createTenantFixture({ label: 'FU2 A' }); B = await createTenantFixture({ label: 'FU2 B' });
  adminA = await member(A, 'Admin'); adminA2 = await member(A, 'Admin'); secretaireA = await member(A, 'Secretaire'); gestionnaireA = await member(A, 'GestionnaireImmobilier');
  adminB = await member(B, 'Admin');
  owner = await plainUser(); otherOwner = await plainUser();
  for (const capability of ['contractual.beneficiary.verify', 'contractual.financial.approve', 'contractual.collection.reconcile']) {
    await activeGrantFixture({ user: adminA.user, capability, tenant: A.tenant });
    await activeGrantFixture({ user: adminA2.user, capability, tenant: A.tenant });
  }
  platformOp = await operator(['platform.finance.manage']); platformOp2 = await operator(['platform.finance.manage']);
});

async function lease({ start = '2026-01-01T00:00:00+01:00', end = '2026-12-31T00:00:00+01:00', rentMinor = 150000, chargesMinor = 10000, propertyId, schedule = true, statut = 'actif', dateSortie } = {}) {
  const pid = propertyId || oid();
  if (!propertyId) await Property.collection.insertOne({ _id: pid, title: 'Bien fictif', owner: owner._id, tenant: A.tenant._id, status: 'location' });
  const tenantRecord = await Locataire.collection.insertOne({ nom: 'Locataire', prenom: 'Fictif', telephone: '+242 00 000 00 01', email: `loc-${oid()}@example.test` });
  const leaseId = oid();
  await Contrat.collection.insertOne({ _id: leaseId, type: 'location', bien: pid, locataire: tenantRecord.insertedId, statut, dateEntree: new Date(start), dateFinBail: new Date(end), ...(dateSortie ? { dateSortie: new Date(dateSortie) } : {}), montantLoyer: rentMinor, montantCharges: chargesMinor, chargesIncluses: false });
  if (schedule) {
    const rows = [];
    for (let m = 1; m <= 12; m += 1) rows.push({ contrat: leaseId, mois: m, annee: 2026, montant: rentMinor, statut: 'impayé', jourEcheance: 5 });
    await Paiement.insertMany(rows);
  }
  await adoptLeasePolicy({ actor: adminA.actor, leaseId });
  return { leaseId, propertyId: pid };
}

async function delegatedMandate({ propertyId, collectionMode = 'AGENCY_COLLECTION', feeRules } = {}) {
  const b = await beneficiaries.registerBeneficiary({ actor: secretaireA.actor, ownerId: owner._id, kind: 'MOBILE_MONEY', holderName: 'Fictif', institution: 'MTN', accountIdentifier: `2420${Math.floor(10000000 + Math.random() * 89999999)}` });
  await beneficiaries.verifyBeneficiary({ actor: adminA.actor, beneficiaryId: b._id, method: 'Appel', evidence: [{ documentRef: 'doc://fictif' }] });
  const agency = collectionMode === 'AGENCY_COLLECTION';
  const terms = {
    offer: 'DELEGATED_MANAGEMENT', currency: 'XAF', effectiveFrom: new Date('2025-12-01T00:00:00Z'), legalReference: `M-${oid()}`,
    commission: { basisPoints: 1000, base: 'CONFIRMED_COLLECTED_RENT' }, collectionMode,
    ...(agency ? { payoutFrequency: 'MONTHLY', payoutBeneficiary: b._id } : { ownerDirectAccount: b._id }),
    feeRules: feeRules || [{ feeKind: 'COLLECTION', paymentMethod: 'cash', bearer: 'OWNER', pricing: { fixedMinor: 0, basisPoints: 0, tariffSourceReference: 'FIXTURE' } }],
    expenseCaps: { perInterventionMinor: 50000, monthlyCumulativeMinor: 100000, period: 'CALENDAR_MONTH' },
  };
  const { mandate } = await mandates.createMandate({ actor: adminA.actor, propertyId, ownerId: owner._id, reference: `R-${oid()}`, terms, idempotencyKey: `m-${oid()}` });
  return mandates.activateMandate({ actor: adminA.actor, mandateId: mandate._id });
}
const rentalPayment = (propertyId, amountMinor, method = 'cash') => FinancialPayment.create({
  tenant: A.tenant._id, domain: 'rental', establishmentType: 'Property', establishmentId: propertyId, paymentReference: `P-${oid()}`, status: 'succeeded', method, provider: 'manual',
  currency: 'XAF', amountMinor, availableAmountMinor: amountMinor, confirmedAt: new Date(), createdBy: adminA.user._id,
});

describe('F-U2.1 — loyers', () => {
  test('facture de loyer : lignes du bail, échéance de l’échéancier, parties distinctes ; idempotente', async () => {
    const { leaseId, propertyId } = await lease();
    await delegatedMandate({ propertyId });
    const first = await rent.generateRentInvoice({ actor: secretaireA.actor, leaseId, period: '2026-02' });
    expect(first.created).toBe(true);
    expect(first.document).toMatchObject({ status: 'draft', totalMinor: 160000, balanceMinor: 160000, domain: 'rental', subjectType: 'Contrat' });
    expect(first.document.metadata.parties).toMatchObject({ payer: { role: 'LOCATAIRE' }, economicBeneficiary: { role: 'OWNER' }, issuer: { role: 'TENANT', onBehalfOfOwner: true } });
    const lines = await FinancialDocumentLine.find({ financialDocument: first.document._id }).lean();
    expect(lines.map((l) => [l.lineType, l.totalMinor])).toEqual([['rent', 150000], ['charges', 10000]]);
    // F-U2.10 : échéance validée = fin du 5 du mois suivant (Africa/Brazzaville).
    expect(new Date(first.document.dueDate).toISOString()).toBe('2026-03-05T22:59:59.999Z');
    const replay = await rent.generateRentInvoice({ actor: secretaireA.actor, leaseId, period: '2026-02' });
    expect(replay.created).toBe(false);
    expect(await FinancialDocument.countDocuments({ 'metadata.billingKind': 'RENT' })).toBe(1);
  });

  test('changement de bail : même mois non refacturable ; après annulation du brouillon, possible', async () => {
    const { leaseId, propertyId } = await lease();
    const { document } = await rent.generateRentInvoice({ actor: adminA.actor, leaseId, period: '2026-03' });
    const second = await lease({ propertyId });
    await expect(rent.generateRentInvoice({ actor: adminA.actor, leaseId: second.leaseId, period: '2026-03' })).rejects.toMatchObject({ code: 'RENT_PERIOD_ALREADY_BILLED' });
    await operations.cancelDraft({ actor: adminA.actor, documentId: document._id, reason: 'Nouveau bail' });
    expect((await rent.generateRentInvoice({ actor: adminA.actor, leaseId: second.leaseId, period: '2026-03' })).created).toBe(true);
  });

  test('mois partiel : clause de prorata exigée ; base 30 (mois de 31 jours) ; charges au prorata non décidées → refus ; hors bail refusé ; échéance sans échéancier historique', async () => {
    // F-U2.11 : base conventionnelle de 30 jours pour tous les mois ; le
    // prorata des charges reste non décidé ; l'échéance ne dépend plus de `Paiement`.
    const { leaseId } = await lease({ start: '2026-03-11T00:00:00+01:00' });
    await expect(rent.generateRentInvoice({ actor: adminA.actor, leaseId, period: '2026-03' })).rejects.toMatchObject({ code: 'RENT_PRORATION_CLAUSE_REQUIRED' });
    await expect(rent.generateRentInvoice({ actor: adminA.actor, leaseId, period: '2026-03', prorataClauseReference: 'Art. 4 du bail fictif' })).rejects.toMatchObject({ code: 'RENT_CHARGES_PRORATA_RULE_UNDECIDED' });
    const noCharges = await lease({ start: '2026-03-11T00:00:00+01:00', chargesMinor: 0 });
    const prorated = await rent.generateRentInvoice({ actor: adminA.actor, leaseId: noCharges.leaseId, period: '2026-03', prorataClauseReference: 'Art. 4 du bail fictif' });
    expect(prorated.document.totalMinor).toBe(100000);
    await expect(rent.generateRentInvoice({ actor: adminA.actor, leaseId, period: '2026-02' })).rejects.toMatchObject({ code: 'LEASE_NOT_ACTIVE_FOR_PERIOD' });
    const noSchedule = await lease({ schedule: false });
    const { document } = await rent.generateRentInvoice({ actor: adminA.actor, leaseId: noSchedule.leaseId, period: '2026-04' });
    expect(new Date(document.dueDate).toISOString()).toBe('2026-05-05T22:59:59.999Z');
    expect(document.metadata.legacySchedule).toBeNull();
  });

  test('résiliation : mois de sortie partiel, mois suivants non facturables', async () => {
    const { leaseId } = await lease({ statut: 'résilié', dateSortie: '2026-05-15T00:00:00+01:00' });
    // F-U2.12 : sortie en cours de mois → décision de sortie exigée.
    await expect(rent.generateRentInvoice({ actor: adminA.actor, leaseId, period: '2026-05' })).rejects.toMatchObject({ code: 'RENT_EXIT_DECISION_REQUIRED' });
    await expect(rent.generateRentInvoice({ actor: adminA.actor, leaseId, period: '2026-06' })).rejects.toMatchObject({ code: 'LEASE_NOT_ACTIVE_FOR_PERIOD' });
  });

  test('émission : identité vérifiée exigée ; impayé, en retard, paiement partiel par allocation ; jamais de pénalité', async () => {
    const { leaseId, propertyId } = await lease();
    await delegatedMandate({ propertyId });
    const { document } = await rent.generateRentInvoice({ actor: adminA.actor, leaseId, period: '2026-01' });
    await expect(operations.issueDocument({ actor: adminA.actor, documentId: document._id })).rejects.toMatchObject({ code: 'ISSUER_IDENTITY_NOT_VERIFIED' });
    await expect(operations.issueDocument({ actor: secretaireA.actor, documentId: document._id })).rejects.toMatchObject({ code: 'FINANCIAL_UNAUTHORIZED' });
    await verifiedIssuer('TENANT', A.tenant._id);
    const issued = await operations.issueDocument({ actor: adminA.actor, documentId: document._id });
    expect(issued).toMatchObject({ status: 'issued', lifecycle: 'overdue' });
    expect(issued.documentNumber).toMatch(/^FAC-[A-Z0-9]+-\d{4}-000001$/);
    const payment = await rentalPayment(propertyId, 100000);
    await allocatePaymentToDocument({ paymentId: payment._id, documentId: document._id, amountMinor: 100000, businessOperationKey: `alloc-${oid()}`, actor: adminA.user, transactionMode: 'transactional' });
    const view = await operations.getBillingDocument({ actor: adminA.actor, documentId: document._id });
    expect(view).toMatchObject({ balanceMinor: 60000, paymentStatus: 'partially_paid', lifecycle: 'overdue' });
    expect(view.lines.every((line) => ['rent', 'charges'].includes(line.lineType))).toBe(true);
  });

  test('OWNER_DIRECT : brouillon de suivi seulement, aucune émission au nom du bailleur', async () => {
    const { leaseId, propertyId } = await lease();
    await delegatedMandate({ propertyId, collectionMode: 'OWNER_DIRECT' });
    const { document } = await rent.generateRentInvoice({ actor: adminA.actor, leaseId, period: '2026-02' });
    expect(document.metadata.issuerPlan).toBeNull();
    await verifiedIssuer('TENANT', A.tenant._id);
    await expect(operations.issueDocument({ actor: adminA.actor, documentId: document._id })).rejects.toMatchObject({ code: 'BILLING_ISSUER_NOT_SUPPORTED' });
  });
});

describe('F-U2.2 — commission de gestion déléguée', () => {
  test('10 % des encaissements confirmés, proportionnel au paiement partiel, jamais deux fois', async () => {
    const { propertyId } = await lease();
    const mandate = await delegatedMandate({ propertyId });
    await expect(commission.generateCommissionInvoice({ actor: adminA.actor, mandateId: mandate._id })).rejects.toMatchObject({ code: 'BILLING_NOTHING_TO_INVOICE' });
    const pending = await FinancialPayment.create({ tenant: A.tenant._id, domain: 'rental', establishmentType: 'Property', establishmentId: propertyId, paymentReference: `P-${oid()}`, status: 'pending', method: 'cash', currency: 'XAF', amountMinor: 150000, availableAmountMinor: 150000, createdBy: adminA.user._id });
    await expect(funds.recognizeAgencyCollection({ actor: secretaireA.actor, mandateId: mandate._id, financialPaymentId: pending._id, rentPeriod: { month: 1, year: 2026 } })).rejects.toMatchObject({ code: 'COLLECTION_NOT_CONFIRMED' });
    for (const [amount, month] of [[150000, 1], [100000, 2]]) {
      const payment = await rentalPayment(propertyId, amount);
      await funds.recognizeAgencyCollection({ actor: secretaireA.actor, mandateId: mandate._id, financialPaymentId: payment._id, rentPeriod: { month, year: 2026 } });
    }
    const { document } = await commission.generateCommissionInvoice({ actor: adminA.actor, mandateId: mandate._id });
    const lines = await FinancialDocumentLine.find({ financialDocument: document._id }).lean();
    expect(lines.map((l) => l.totalMinor).sort()).toEqual([10000, 15000]);
    expect(lines.every((l) => l.lineType === 'commission')).toBe(true);
    expect(document.metadata.parties.payer).toMatchObject({ role: 'OWNER' });
    const version = await ManagementMandateVersion.findById(mandate.currentVersion).lean();
    expect(document.metadata.collections.every((c) => c.termsHash === version.termsHash)).toBe(true);
    await expect(commission.generateCommissionInvoice({ actor: adminA.actor, mandateId: mandate._id })).rejects.toMatchObject({ code: 'BILLING_NOTHING_TO_INVOICE' });
  });

  test('frais de transaction séparés : commission sur le brut, aucune ligne de frais', async () => {
    const { propertyId } = await lease();
    const mandate = await delegatedMandate({ propertyId, feeRules: [{ feeKind: 'COLLECTION', paymentMethod: 'mobile_money', bearer: 'SPLIT', split: [{ party: 'OWNER', basisPoints: 5000 }, { party: 'ALTITUDE_VISION', basisPoints: 5000 }], pricing: { fixedMinor: 100, basisPoints: 100, tariffSourceReference: 'FIXTURE' } }] });
    const payment = await rentalPayment(propertyId, 150000, 'mobile_money');
    const { collection } = await funds.recognizeAgencyCollection({ actor: secretaireA.actor, mandateId: mandate._id, financialPaymentId: payment._id, rentPeriod: { month: 1, year: 2026 } });
    expect(collection.breakdown.feeSnapshot.totalMinor).toBe(1600);
    const { document } = await commission.generateCommissionInvoice({ actor: adminA.actor, mandateId: mandate._id });
    expect(document.totalMinor).toBe(15000);
  });

  test('générations concurrentes : une seule facture de commission', async () => {
    const { propertyId } = await lease();
    const mandate = await delegatedMandate({ propertyId });
    const payment = await rentalPayment(propertyId, 150000);
    await funds.recognizeAgencyCollection({ actor: secretaireA.actor, mandateId: mandate._id, financialPaymentId: payment._id, rentPeriod: { month: 1, year: 2026 } });
    const results = await Promise.allSettled([commission.generateCommissionInvoice({ actor: adminA.actor, mandateId: mandate._id }), commission.generateCommissionInvoice({ actor: adminA2.actor, mandateId: mandate._id })]);
    const docs = await FinancialDocument.countDocuments({ 'metadata.billingKind': 'MANAGEMENT_COMMISSION' });
    expect(docs).toBe(1);
    expect(results.some((r) => r.status === 'fulfilled')).toBe(true);
  });

  test('OWNER_DIRECT : ni déclaration ni confirmation propriétaire ; commission après rapprochement indépendant', async () => {
    const { propertyId } = await lease();
    const mandate = await delegatedMandate({ propertyId, collectionMode: 'OWNER_DIRECT' });
    const { collection } = await funds.declareOwnerDirectCollection({ actor: secretaireA.actor, mandateId: mandate._id, amountMinor: 200000, paidAt: new Date(), rentPeriod: { month: 1, year: 2026 }, idempotencyKey: 'od' });
    await expect(commission.generateCommissionInvoice({ actor: adminA.actor, mandateId: mandate._id })).rejects.toMatchObject({ code: 'BILLING_NOTHING_TO_INVOICE' });
    await funds.confirmOwnerDirectByOwner({ actor: { _id: owner._id }, collectionId: collection._id });
    await expect(commission.generateCommissionInvoice({ actor: adminA.actor, mandateId: mandate._id })).rejects.toMatchObject({ code: 'BILLING_NOTHING_TO_INVOICE' });
    await funds.reconcileOwnerDirectCollection({ actor: adminA.actor, collectionId: collection._id, decision: 'confirm', evidence: [{ documentRef: 'doc://releve-fictif', kind: 'MOBILE_MONEY_STATEMENT' }], providerReference: 'TX-FICTIF', verifiedAmountMinor: 200000, verifiedPaidAt: new Date() });
    const { document } = await commission.generateCommissionInvoice({ actor: adminA.actor, mandateId: mandate._id });
    expect(document.totalMinor).toBe(20000);
  });
});

describe('F-U2.3 — abonnements de gestion autonome', () => {
  let subscriptionDoc;
  beforeEach(async () => {
    subscriptionDoc = await PlatformTenantSubscription.create({ tenant: A.tenant._id, plan: 'professionnel', status: 'active', startDate: new Date('2025-12-01T00:00:00Z') });
  });
  const generate = (actor = platformOp.actor, period = '2026-02', id = subscriptionDoc._id) => subscription.generateSubscriptionInvoice({ actor, subscriptionType: 'PlatformTenantSubscription', subscriptionId: id, period });
  async function activeTariff() {
    const tariff = await subscription.draftTariff({ actor: platformOp.actor, plan: 'professionnel', monthlyPriceMinor: 25000, paymentTermDays: 10, effectiveFrom: '2025-12-01T00:00:00Z', decisionReference: 'Tarif fictif de test' });
    await expect(subscription.activateTariff({ actor: platformOp.actor, tariffId: tariff._id })).rejects.toMatchObject({ code: 'FINANCIAL_SEGREGATION_OF_DUTIES' });
    return subscription.activateTariff({ actor: platformOp2.actor, tariffId: tariff._id });
  }

  test('sans tarif validé : refus ; facture mensuelle sans commission, renouvellement idempotent, historique', async () => {
    await expect(generate()).rejects.toMatchObject({ code: 'SUBSCRIPTION_PRICE_NOT_CONFIGURED' });
    await activeTariff();
    const first = await generate();
    expect(first.document).toMatchObject({ totalMinor: 25000, domain: 'billing', subjectType: 'PlatformTenantSubscription' });
    expect(first.document.customer.name).toMatch(/FU2 A/);
    expect(new Date(first.document.dueDate).getTime() - new Date(first.document.servicePeriodStart).getTime()).toBe(10 * DAY);
    const lines = await FinancialDocumentLine.find({ financialDocument: first.document._id }).lean();
    expect(lines.map((l) => l.lineType)).toEqual(['subscription']);
    expect((await generate()).created).toBe(false);
    await generate(platformOp.actor, '2026-03');
    expect(await FinancialDocument.countDocuments({ 'metadata.billingKind': 'SUBSCRIPTION' })).toBe(2);
    await verifiedIssuer('PLATFORM');
    expect((await operations.issueDocument({ actor: platformOp.actor, documentId: first.document._id })).status).toBe('issued');
  });

  test('essai, changement de formule en cours de mois, organisation suspendue : non facturés', async () => {
    await activeTariff();
    const trial = await PlatformTenantSubscription.create({ tenant: B.tenant._id, plan: 'professionnel', status: 'trialing', startDate: new Date('2025-12-01T00:00:00Z') });
    await expect(generate(platformOp.actor, '2026-02', trial._id)).rejects.toMatchObject({ code: 'SUBSCRIPTION_NOT_BILLABLE' });
    await PlatformTenantSubscription.updateOne({ _id: subscriptionDoc._id }, { status: 'cancelled', cancelledAt: new Date('2026-02-14T00:00:00Z') });
    await expect(generate()).rejects.toMatchObject({ code: 'SUBSCRIPTION_PARTIAL_PERIOD_RULE_NOT_CONFIGURED' });
    expect((await generate(platformOp.actor, '2026-01')).created).toBe(true);
    const individual = await IndividualSubscription.create({ user: owner._id, plan: 'professionnel', status: 'active', startDate: new Date('2025-12-01T00:00:00Z') });
    expect((await subscription.generateSubscriptionInvoice({ actor: platformOp.actor, subscriptionType: 'IndividualSubscription', subscriptionId: individual._id, period: '2026-02' })).document.customer.userId.toString()).toBe(String(owner._id));
    await PlatformTenant.updateOne({ _id: B.tenant._id }, { status: 'suspended' });
    const suspendedSub = await PlatformTenantSubscription.create({ tenant: B.tenant._id, plan: 'professionnel', status: 'active', startDate: new Date('2025-12-01T00:00:00Z') });
    await expect(generate(platformOp.actor, '2026-02', suspendedSub._id)).rejects.toMatchObject({ code: 'SUBSCRIPTION_BILLING_SUSPENDED' });
  });

  test('réservé à Altitude Vision en vue plateforme', async () => {
    await activeTariff();
    await expect(generate(adminA.actor)).rejects.toMatchObject({ code: 'FINANCIAL_UNAUTHORIZED' });
    await expect(generate({ _id: platformOp.user._id, platformTenant: A.tenant })).rejects.toMatchObject({ code: 'FINANCIAL_UNAUTHORIZED' });
  });
});

describe('F-U2.4 — hôtellerie', () => {
  async function hotelDraft() {
    const hotelId = oid(); const reservationId = oid();
    await HotelReservation.collection.insertOne({ _id: reservationId, hotel: hotelId, tenant: A.tenant._id, status: 'checked_in', guest: { firstName: 'Client fictif' } });
    const document = await FinancialDocument.create({ tenant: A.tenant._id, domain: 'hotel', establishmentType: 'Hotel', establishmentId: hotelId, documentType: 'invoice', status: 'draft', currency: 'XAF', subjectType: 'HotelReservation', subjectId: reservationId, subtotalMinor: 40000, totalMinor: 40000, balanceMinor: 40000, businessOperationKey: `hotel-${oid()}`, metadata: { source: 'hotel_reservation', linesFinalized: true }, createdBy: adminA.user._id });
    await FinancialDocumentLine.create({ financialDocument: document._id, lineNumber: 1, lineType: 'accommodation', description: 'Nuitée fictive', quantity: 1, unitAmountMinor: 40000, subtotalMinor: 40000, totalMinor: 40000, sourceType: 'HotelReservation', sourceId: reservationId, createdBy: adminA.user._id });
    return document;
  }
  test('émetteur exigé seulement si le contrôle est activé ; facture hôtelière hors des tableaux de facturation unifiée', async () => {
    const first = await hotelDraft();
    process.env.HOTEL_INVOICE_REQUIRE_VERIFIED_ISSUER = 'true';
    await expect(issueFinancialDocument({ documentId: first._id, actor: adminA.user, businessOperationKey: `i-${oid()}`, transactionMode: 'transactional' })).rejects.toMatchObject({ code: 'HOTEL_ISSUER_IDENTITY_NOT_VERIFIED' });
    await verifiedIssuer('TENANT', A.tenant._id);
    await expect(issueFinancialDocument({ documentId: first._id, actor: adminA.user, businessOperationKey: `i-${oid()}`, transactionMode: 'transactional' })).resolves.toMatchObject({ status: 'issued' });
    delete process.env.HOTEL_INVOICE_REQUIRE_VERIFIED_ISSUER;
    const second = await hotelDraft();
    await FinancialIssuerIdentity.deleteMany({});
    await expect(issueFinancialDocument({ documentId: second._id, actor: adminA.user, businessOperationKey: `i-${oid()}`, transactionMode: 'transactional' })).resolves.toMatchObject({ status: 'issued' });
    const dashboard = await operations.administrationDashboard({ actor: adminA.actor });
    expect(dashboard.documents).toHaveLength(0);
  });
});

describe('F-U2.5/6 — documents, numérotation, immutabilité, avoirs', () => {
  test('série continue par émetteur ; snapshot d’émetteur figé ; document émis non modifiable', async () => {
    const { leaseId, propertyId } = await lease();
    const mandate = await delegatedMandate({ propertyId });
    await verifiedIssuer('TENANT', A.tenant._id);
    const rentDoc = (await rent.generateRentInvoice({ actor: adminA.actor, leaseId, period: '2026-02' })).document;
    const payment = await rentalPayment(propertyId, 150000);
    await funds.recognizeAgencyCollection({ actor: secretaireA.actor, mandateId: mandate._id, financialPaymentId: payment._id, rentPeriod: { month: 2, year: 2026 } });
    const commDoc = (await commission.generateCommissionInvoice({ actor: adminA.actor, mandateId: mandate._id })).document;
    const a = await operations.issueDocument({ actor: adminA.actor, documentId: rentDoc._id });
    const b = await operations.issueDocument({ actor: adminA.actor, documentId: commDoc._id });
    expect([a.documentNumber.slice(-6), b.documentNumber.slice(-6)]).toEqual(['000001', '000002']);
    expect(a.documentNumber.split('-').slice(0, 2)).toEqual(b.documentNumber.split('-').slice(0, 2));
    await FinancialIssuerIdentity.updateMany({}, { $set: { status: 'retired' } });
    await verifiedIssuer('TENANT', A.tenant._id, 2, 'Nouvelle raison sociale fictive');
    expect((await FinancialDocument.findById(rentDoc._id)).seller.name).toBe('Émetteur fictif TENANT');
    expect((await FinancialDocument.findById(rentDoc._id)).metadata.issuer.version).toBe(1);
    await expect(replaceDraftLines(rentDoc._id, [{ lineType: 'rent', description: 'x', quantity: 1, unitAmountMinor: 1, sourceType: 'Contrat', sourceId: leaseId }], adminA.user._id)).rejects.toMatchObject({ code: 'FINANCIAL_DOCUMENT_IMMUTABLE' });
    await expect(operations.cancelDraft({ actor: adminA.actor, documentId: rentDoc._id, reason: 'x' })).rejects.toMatchObject({ code: 'FINANCIAL_DOCUMENT_IMMUTABLE' });
  });

  test('avoir : habilitation sensible, approbateur distinct de l’émetteur, plafonné au solde non réglé, idempotent', async () => {
    const { leaseId, propertyId } = await lease();
    await delegatedMandate({ propertyId });
    await verifiedIssuer('TENANT', A.tenant._id);
    const { document } = await rent.generateRentInvoice({ actor: adminA.actor, leaseId, period: '2026-04' });
    await operations.issueDocument({ actor: adminA.actor, documentId: document._id });
    await expect(operations.creditDocument({ actor: adminA.actor, documentId: document._id, amountMinor: 10000, reason: 'Erreur de charges', idempotencyKey: 'c1' })).rejects.toMatchObject({ code: 'FINANCIAL_SEGREGATION_OF_DUTIES' });
    const noGrant = await member(A, 'Admin');
    await expect(operations.creditDocument({ actor: noGrant.actor, documentId: document._id, amountMinor: 10000, reason: 'x', idempotencyKey: 'c0' })).rejects.toMatchObject({ code: 'FINANCIAL_UNAUTHORIZED' });
    const partial = await operations.creditDocument({ actor: adminA2.actor, documentId: document._id, amountMinor: 10000, reason: 'Erreur de charges', idempotencyKey: 'c1' });
    expect(partial.creditNote).toMatchObject({ documentType: 'credit_note', status: 'issued' });
    expect(partial.creditNote.documentNumber).toMatch(/^AVO-/);
    expect(partial.invoice).toMatchObject({ balanceMinor: 150000, creditedMinor: 10000, status: 'issued' });
    expect((await operations.creditDocument({ actor: adminA2.actor, documentId: document._id, amountMinor: 10000, reason: 'Erreur de charges', idempotencyKey: 'c1' })).replayed).toBe(true);
    const payment = await rentalPayment(propertyId, 50000);
    await allocatePaymentToDocument({ paymentId: payment._id, documentId: document._id, amountMinor: 50000, businessOperationKey: `alloc-${oid()}`, actor: adminA.user, transactionMode: 'transactional' });
    await expect(operations.creditDocument({ actor: adminA2.actor, documentId: document._id, amountMinor: 100001, reason: 'x', idempotencyKey: 'c2' })).rejects.toMatchObject({ code: 'BILLING_CREDIT_EXCEEDS_UNPAID_BALANCE' });
    const full = await operations.creditDocument({ actor: adminA2.actor, documentId: document._id, amountMinor: 100000, reason: 'Solde annulé', idempotencyKey: 'c3' });
    expect(full.invoice).toMatchObject({ balanceMinor: 0, paymentStatus: 'paid' });
  });
});

describe('F-U2 — sécurité et tableaux de bord', () => {
  test('isolation : autre tenant, contexte non résolu, vue plateforme, autre propriétaire', async () => {
    const { leaseId, propertyId } = await lease();
    await delegatedMandate({ propertyId });
    const { document } = await rent.generateRentInvoice({ actor: adminA.actor, leaseId, period: '2026-02' });
    await expect(rent.generateRentInvoice({ actor: adminB.actor, leaseId, period: '2026-03' })).rejects.toMatchObject({ code: 'FINANCIAL_RESOURCE_OUT_OF_SCOPE' });
    await expect(operations.getBillingDocument({ actor: adminB.actor, documentId: document._id })).rejects.toMatchObject({ code: 'FINANCIAL_RESOURCE_OUT_OF_SCOPE' });
    await expect(operations.administrationDashboard({ actor: { _id: adminA.user._id } })).rejects.toMatchObject({ code: 'FINANCIAL_UNAUTHORIZED' });
    expect((await operations.administrationDashboard({ actor: platformOp.actor })).documents).toHaveLength(0);
    expect((await operations.administrationDashboard({ actor: adminA.actor })).documents).toHaveLength(1);
    expect((await operations.administrationDashboard({ actor: adminB.actor })).documents).toHaveLength(0);
    expect((await operations.ownerDashboard({ actor: { _id: owner._id } })).summary.rentExpectedMinor).toBe(160000);
    expect((await operations.ownerDashboard({ actor: { _id: otherOwner._id } })).documents).toHaveLength(0);
    await expect(operations.getBillingDocument({ actor: { _id: otherOwner._id }, documentId: document._id })).rejects.toMatchObject({ code: 'FINANCIAL_UNAUTHORIZED' });
    expect((await operations.getBillingDocument({ actor: { _id: owner._id }, documentId: document._id })).totalMinor).toBe(160000);
    await expect(rent.generateRentInvoice({ actor: gestionnaireA.actor, leaseId, period: '2026-03' })).rejects.toMatchObject({ code: 'FINANCIAL_UNAUTHORIZED' });
  });

  test('aucun mouvement financier : ni paiement créé à l’émission, ni remboursement', async () => {
    const { leaseId, propertyId } = await lease();
    await delegatedMandate({ propertyId });
    await verifiedIssuer('TENANT', A.tenant._id);
    const { document } = await rent.generateRentInvoice({ actor: adminA.actor, leaseId, period: '2026-02' });
    await operations.issueDocument({ actor: adminA.actor, documentId: document._id });
    expect(await FinancialPayment.countDocuments()).toBe(0);
    expect(await FinancialRefund.countDocuments()).toBe(0);
    expect((await FinancialDocument.findById(document._id)).paymentStatus).toBe('unpaid');
  });

  test('HTTP : tableau propriétaire, génération avec tenant du corps ignoré, en-têtes no-store', async () => {
    const token = (user) => `Bearer ${jwt.sign({ id: user._id, tokenVersion: 0 }, process.env.JWT_SECRET)}`;
    const { leaseId, propertyId } = await lease();
    await delegatedMandate({ propertyId });
    const generated = await request(app).post('/billing/rent-invoices').set('Authorization', token(adminA.user)).set('X-Platform-Tenant-Id', String(A.tenant._id)).send({ leaseId: String(leaseId), period: '2026-02', tenant: String(B.tenant._id) });
    expect(generated.status).toBe(201);
    expect(generated.headers['cache-control']).toContain('no-store');
    const cross = await request(app).post('/billing/rent-invoices').set('Authorization', token(adminB.user)).set('X-Platform-Tenant-Id', String(B.tenant._id)).send({ leaseId: String(leaseId), period: '2026-03' });
    expect(cross.status).toBe(404);
    const ownerView = await request(app).get('/billing/owner/dashboard').set('Authorization', token(owner));
    expect(ownerView.status).toBe(200);
    expect(ownerView.body.data.documents).toHaveLength(1);
    expect(JSON.stringify(ownerView.body)).not.toContain('identityId');
    expect((await request(app).get('/billing/dashboard').set('Authorization', token(owner))).status).toBe(403);
    const readiness = await request(app).get('/billing/issuer-readiness').set('Authorization', token(adminA.user)).set('X-Platform-Tenant-Id', String(A.tenant._id));
    expect(readiness.body.data).toMatchObject({ ready: false, reason: 'ISSUER_IDENTITY_NOT_VERIFIED' });
  });
});
