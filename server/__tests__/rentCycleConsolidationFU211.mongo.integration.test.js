// F-U2.11 — consolidation du cycle locatif : un seul moteur de pénalités,
// gardes par échéance, prorata conventionnel 30 jours, corrections tracées,
// imputation explicite, bailleurs sans organisation (vrai replica set,
// données fictives ; e-mails simulés, aucun envoi réel).
jest.mock('../services/zohoMailService', () => ({ sendEmail: jest.fn().mockResolvedValue({}) }));
process.env.FINANCIAL_BENEFICIARY_FINGERPRINT_KEY = 'f-u1-test-fingerprint-key-0123456789abcdef';
const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const { startFinancialMongo, clearFinancialMongo, stopFinancialMongo } = require('./helpers/financialMongoEnvironment');
const { createTenantFixture, createTenantUser, tenantActor } = require('./helpers/tenantAwareFixture');
const { adoptLeasePolicy } = require('./helpers/leasePolicyFixture');
const zohoMailService = require('../services/zohoMailService');
const User = require('../models/User');
const Property = require('../models/Property');
const Contrat = require('../models/Contrat');
const Locataire = require('../models/Locataire');
const Paiement = require('../models/Paiement');
const PlatformOperator = require('../models/PlatformOperator');
const IndividualSubscription = require('../models/IndividualSubscription');
const FinancialDocument = require('../models/FinancialDocument');
const FinancialPayment = require('../models/FinancialPayment');
const FinancialIssuerIdentity = require('../models/FinancialIssuerIdentity');
const Penalty = require('../models/RentLatePenaltyAssessment');
const Report = require('../models/RentPaymentDifficultyReport');
const CollectionCase = require('../models/RentCollectionCase');
const Accrual = require('../models/AutonomousVariableFeeAccrual');
const DirectRentReceipt = require('../models/DirectRentReceipt');
const receipts = require('../services/finance/billing/directRentReceiptService');
const { PLATFORM_WIDE_CONTEXT_SOURCE } = require('../constants/platformOperatorConstants');
const calendar = require('../services/finance/billing/rentCalendarService');
const rent = require('../services/finance/billing/rentBillingService');
const collection = require('../services/finance/billing/rentCollectionService');
const ownerTracking = require('../services/finance/billing/ownerRentTrackingService');
const operations = require('../services/finance/billing/billingOperationsService');
const billingDocuments = require('../services/finance/billing/billingDocumentService');
const autonomous = require('../services/finance/billing/autonomousBillingService');
const { verifierPaiementsEnRetard } = require('../services/alerteService');
const { activePenaltyEngine } = require('../services/finance/billing/rentPenaltyEngine');
const { allocatePaymentToDocument } = require('../services/finance/paymentAllocationService');
const { errorHandler } = require('../middleware/errorMiddleware');
const billingRoutes = require('../routes/billingRoutes');
const tenantPortalRoutes = require('../routes/tenantPortalRoutes');

const app = express(); app.use(express.json()); app.use('/billing', billingRoutes); app.use('/tenant-portal', tenantPortalRoutes); app.use(errorHandler);
jest.setTimeout(300000);
const oid = () => new mongoose.Types.ObjectId();
const wat = (iso) => new Date(`${iso}+01:00`);
const token = (user) => `Bearer ${jwt.sign({ id: user._id, tokenVersion: 0 }, process.env.JWT_SECRET, { expiresIn: '1h' })}`;
const engine = (value) => { if (value == null) delete process.env.RENT_PENALTY_ENGINE; else process.env.RENT_PENALTY_ENGINE = value; };
let seq = 0;
let A; let adminA; let owner; let otherOwner; let tenantUser; let platformOp;

beforeAll(async () => {
  await startFinancialMongo();
  await Promise.all([Penalty, Report, CollectionCase, FinancialPayment, Accrual].map((model) => model.syncIndexes()));
});
afterAll(stopFinancialMongo);

async function plainUser(role = 'Proprietaire') {
  seq += 1;
  return User.create({ name: `Personne fictive ${seq}`, email: `fu211-${Date.now()}-${seq}@example.test`, password: 'Password123!', passwordConfirm: 'Password123!', role, isEmailVerified: true });
}

beforeEach(async () => {
  await clearFinancialMongo();
  jest.clearAllMocks();
  engine('CANONICAL');
  A = await createTenantFixture({ label: 'FU211 A' });
  const { user } = await createTenantUser({ ...A, businessRole: 'Admin', overrides: { role: 'Client' } });
  adminA = { user, actor: tenantActor(user, A.tenant) };
  owner = await plainUser(); otherOwner = await plainUser(); tenantUser = await plainUser('Client');
  const op = await plainUser('Client');
  await PlatformOperator.create({ user: op._id, status: 'active', capabilities: ['platform.finance.manage'], grantedBy: oid(), grantReason: 'Test F-U2.11' });
  platformOp = { user: op, actor: { _id: op._id, tenantContextSource: PLATFORM_WIDE_CONTEXT_SOURCE } };
  await FinancialIssuerIdentity.create({ scope: 'TENANT', tenant: A.tenant._id, version: 1, legalName: 'Agence fictive A', rccm: 'CG-FICTIF', niu: 'NIU-FICTIF', phone: '+242 00 000 00 00', address: 'Adresse fictive', status: 'verified', registeredBy: oid(), verifiedBy: oid(), verifiedAt: new Date(), verificationEvidenceRef: 'fixture' });
});
afterAll(() => engine(null));

// Bail fictif ; `org: false` → bien d'un bailleur personne physique sans organisation.
async function lease({ start = '2026-01-01T00:00:00', end = '2027-12-31T00:00:00', rentMinor = 150000, chargesMinor = 0, org = true, propertyOwner = owner, dateSortie } = {}) {
  const propertyId = oid();
  await Property.collection.insertOne({ _id: propertyId, title: 'Bien fictif', owner: propertyOwner._id, tenant: org ? A.tenant._id : null, status: 'location' });
  const existing = await Locataire.findOne({ user: tenantUser._id }).lean();
  const locataireId = existing ? existing._id : (await Locataire.collection.insertOne({ nom: 'Locataire', prenom: 'Fictif', email: 'locataire-fictif@example.test', user: tenantUser._id })).insertedId;
  const leaseId = oid();
  await Contrat.collection.insertOne({ _id: leaseId, type: 'location', bien: propertyId, locataire: locataireId, statut: 'actif', dateEntree: wat(start), dateFinBail: wat(end), montantLoyer: rentMinor, montantCharges: chargesMinor, chargesIncluses: chargesMinor === 0, ...(dateSortie ? { dateSortie: wat(dateSortie) } : {}) });
  await adoptLeasePolicy({ actor: org ? adminA.actor : { _id: propertyOwner._id }, leaseId });
  return { leaseId, propertyId };
}
const generate = (leaseId, period, extra = {}) => rent.generateRentInvoice({ actor: adminA.actor, leaseId, period, now: calendar.rentCalendar(period).billingDate, ...extra });
async function issuedRent(leaseId, period = '2026-04') {
  const { document } = await generate(leaseId, period);
  await operations.issueDocument({ actor: adminA.actor, documentId: document._id });
  return FinancialDocument.findById(document._id).lean();
}
const payment = (document, amountMinor, confirmedAt, metadata = {}) => FinancialPayment.create({
  tenant: document.tenant || null, domain: 'rental', establishmentType: 'Property', establishmentId: document.establishmentId, paymentReference: `P-${oid()}`, status: 'succeeded', method: 'cash', provider: 'manual',
  currency: 'XAF', amountMinor, availableAmountMinor: amountMinor, confirmedAt, createdBy: adminA.user._id, metadata,
});
const allocate = (document, pay) => allocatePaymentToDocument({ paymentId: pay._id, documentId: document._id, amountMinor: pay.amountMinor, businessOperationKey: `alloc-${oid()}`, actor: adminA.user, transactionMode: 'transactional' });
const cycle = (iso) => collection.runRentCollectionCycle({ now: wat(iso) });
const legacySchedule = (leaseId, mois = 4, extra = {}) => Paiement.create({ contrat: leaseId, mois, annee: 2026, montant: 150000, statut: 'impayé', jourEcheance: 1, ...extra });

describe('F-U2.11 — remplacement de l’ancien moteur', () => {
  test('sélection : LEGACY par défaut, CANONICAL explicite, valeur inconnue → aucun moteur', () => {
    expect([activePenaltyEngine({}), activePenaltyEngine({ RENT_PENALTY_ENGINE: 'canonical' }), activePenaltyEngine({ RENT_PENALTY_ENGINE: 'both' })]).toEqual(['LEGACY', 'CANONICAL', 'DISABLED']);
  });

  test('CANONICAL : ancien moteur neutralisé (aucune mutation de Paiement, aucun e-mail) ; historique conservé', async () => {
    const { leaseId } = await lease();
    const historical = await legacySchedule(leaseId, 3, { statut: 'en_retard', penaliteAppliquee: true, penaliteMontant: 4500, montantTotal: 154500 });
    const pending = await legacySchedule(leaseId, 4);
    expect(await verifierPaiementsEnRetard()).toMatchObject({ skipped: true, engine: 'CANONICAL', penalites: 0 });
    expect(await Paiement.findById(pending._id).lean()).toMatchObject({ penaliteAppliquee: false, statut: 'impayé' });
    expect(await Paiement.findById(historical._id).lean()).toMatchObject({ penaliteAppliquee: true, penaliteMontant: 4500 });
    expect(zohoMailService.sendEmail).not.toHaveBeenCalled();
  });

  test('LEGACY : cycle canonique inerte ; DISABLED : aucun des deux', async () => {
    const { leaseId } = await lease();
    await issuedRent(leaseId);
    engine('LEGACY');
    expect(await cycle('2026-05-06T08:00:00')).toMatchObject({ skipped: true, engine: 'LEGACY' });
    engine('OFF');
    expect(await cycle('2026-05-06T08:00:00')).toMatchObject({ skipped: true, engine: 'DISABLED' });
    expect(await verifierPaiementsEnRetard()).toMatchObject({ skipped: true, engine: 'DISABLED' });
    expect(await Penalty.countDocuments()).toBe(0);
  });

  test('garde canonique : échéance déjà pénalisée par l’ancien moteur → rattachée, jamais une seconde pénalité', async () => {
    const { leaseId } = await lease();
    const document = await issuedRent(leaseId);
    const legacy = await legacySchedule(leaseId, 4, { statut: 'en_retard', penaliteAppliquee: true, penaliteMontant: 4500 });
    await cycle('2026-05-06T08:00:00');
    expect(await Penalty.findOne({ rentDocument: document._id }).lean()).toMatchObject({ status: 'LEGACY_PENALTY_EXISTS', penaltyMinor: 0, legacyPenalty: { paiement: legacy._id, penaliteMontant: 4500 } });
    const view = await collection.collectionOverview({ actor: adminA.actor, now: wat('2026-05-06T08:00:00') });
    expect(view.summary.penaltiesEstimatedMinor).toBe(0);
  });

  test('retour arrière simulé (CANONICAL → LEGACY) : l’ancien moteur ignore une échéance déjà évaluée, sans e-mail', async () => {
    const { leaseId } = await lease();
    await issuedRent(leaseId);
    const pending = await legacySchedule(leaseId, 4);
    await cycle('2026-05-06T08:00:00');
    expect(await Penalty.countDocuments({ lease: leaseId, period: '2026-04' })).toBe(1);
    engine('LEGACY');
    await verifierPaiementsEnRetard();
    expect(await Paiement.findById(pending._id).lean()).toMatchObject({ penaliteAppliquee: false });
    expect(zohoMailService.sendEmail).not.toHaveBeenCalled();
    const other = await legacySchedule(leaseId, 6); // échéance non évaluée : comportement historique préservé (e-mail simulé)
    await verifierPaiementsEnRetard();
    expect(await Paiement.findById(other._id).lean()).toMatchObject({ penaliteAppliquee: true, penaliteMontant: 4500 });
    expect(zohoMailService.sendEmail).toHaveBeenCalledTimes(1);
  });
});

describe('F-U2.11 — calendrier et prorata conventionnels (base 30)', () => {
  test('entrée le 31 mai : aucune créance en mai ; 150 000 sur juin, exigible le 30 juin, tolérance au 5 juillet', async () => {
    const { leaseId } = await lease({ start: '2026-05-31T00:00:00' });
    await expect(generate(leaseId, '2026-05', { prorataClauseReference: 'Art. 3' })).rejects.toMatchObject({ code: 'RENT_PERIOD_NOT_BILLABLE_ENTRY_ON_31' });
    const { document } = await generate(leaseId, '2026-06');
    expect(document.totalMinor).toBe(150000);
    expect(new Date(document.metadata.calendar.billingDate).toISOString()).toBe('2026-06-29T23:00:00.000Z');
    expect(new Date(document.dueDate).toISOString()).toBe('2026-07-05T22:59:59.999Z');
  });

  test('mois de 31 jours occupé entièrement ou jusqu’au 30 : exactement un loyer ; décembre → échéance le 5 janvier', async () => {
    const full = await lease();
    expect((await generate(full.leaseId, '2026-05')).document.totalMinor).toBe(150000);
    const until30 = await lease({ dateSortie: '2026-05-30T00:00:00' });
    expect((await generate(until30.leaseId, '2026-05')).document.totalMinor).toBe(150000);
    const dec = await generate(full.leaseId, '2026-12');
    expect(new Date(dec.document.dueDate).toISOString()).toBe('2027-01-05T22:59:59.999Z');
  });

  test('février : clôture le 28 ou le 29 ; mois complet = un loyer ; prorata de février 10/30 (validé F-U2.12, émissible)', async () => {
    const full = await lease({ start: '2027-01-01T00:00:00', end: '2028-12-31T00:00:00' });
    await expect(rent.generateRentInvoice({ actor: adminA.actor, leaseId: full.leaseId, period: '2028-02', now: wat('2028-02-28T12:00:00') })).rejects.toMatchObject({ code: 'RENT_BILLING_DATE_NOT_REACHED' });
    expect((await rent.generateRentInvoice({ actor: adminA.actor, leaseId: full.leaseId, period: '2028-02', now: wat('2028-02-29T00:00:00') })).document.totalMinor).toBe(150000);
    const feb = await lease({ start: '2026-02-21T00:00:00' });
    const { document } = await generate(feb.leaseId, '2026-02', { prorataClauseReference: 'Art. 3 du bail fictif' });
    expect(document.totalMinor).toBe(50000);
    expect(document.metadata.proration).toMatchObject({ rule: 'FEBRUARY_CONVENTIONAL', ruleStatus: 'VALIDATED', days: 10, baseDays: 30 });
    expect((await operations.issueDocument({ actor: adminA.actor, documentId: document._id })).status).toBe('issued');
  });

  test('prorata validé : 21 avril → 50 000 ; 30 avril → 5 000 ; base, jours, période couverte et version conservés', async () => {
    const a21 = await lease({ start: '2026-04-21T00:00:00' });
    const a30 = await lease({ start: '2026-04-30T00:00:00' });
    const d21 = (await generate(a21.leaseId, '2026-04', { prorataClauseReference: 'Art. 3' })).document;
    const d30 = (await generate(a30.leaseId, '2026-04', { prorataClauseReference: 'Art. 3' })).document;
    expect([d21.totalMinor, d30.totalMinor]).toEqual([50000, 5000]);
    expect(d21.metadata.proration).toMatchObject({ rule: 'THIRTY_DAY_BASE', ruleStatus: 'VALIDATED', days: 10, baseDays: 30, ruleVersion: 'ALTIMMO-PRORATA-2026-10-B', clause: 'Art. 3' });
    expect(new Date(d21.metadata.proration.coveredTo).toISOString()).toBe('2026-04-29T23:00:00.000Z');
  });
});

describe('F-U2.11 — pénalités : corrections tracées et imputation', () => {
  test('paiement confirmé le 4 mai mais affecté après l’évaluation : 4 500 → 0, correction tracée, sans nouvelle correction au rejeu', async () => {
    const { leaseId } = await lease();
    const document = await issuedRent(leaseId);
    const pay = await payment(document, 150000, wat('2026-05-04T10:00:00'));
    await cycle('2026-05-06T08:00:00');
    expect(await Penalty.findOne({ rentDocument: document._id }).lean()).toMatchObject({ penaltyMinor: 4500, status: 'SIMULATED' });
    await allocate(document, pay);
    await cycle('2026-05-07T08:00:00');
    await cycle('2026-05-08T08:00:00');
    const penalty = await Penalty.findOne({ rentDocument: document._id }).lean();
    expect(penalty).toMatchObject({ penaltyMinor: 0, baseMinor: 0, status: 'NOT_APPLICABLE' });
    expect(penalty.corrections).toHaveLength(1);
    expect(penalty.corrections[0]).toMatchObject({ reason: 'TIMELY_PAYMENT_ALLOCATED_AFTER_ASSESSMENT', previous: { penaltyMinor: 4500 }, next: { penaltyMinor: 0 } });
    expect(await Penalty.countDocuments({ rentDocument: document._id })).toBe(1);
  });

  test('pénalité juridiquement validée : jamais modifiée, ajustement en attente de décision', async () => {
    const { leaseId } = await lease();
    const document = await issuedRent(leaseId);
    const pay = await payment(document, 150000, wat('2026-05-04T10:00:00'));
    await cycle('2026-05-06T08:00:00');
    await Penalty.updateOne({ rentDocument: document._id }, { $set: { 'legalBasis.status': 'VALIDATED' } });
    await allocate(document, pay);
    await cycle('2026-05-07T08:00:00');
    expect(await Penalty.findOne({ rentDocument: document._id }).lean()).toMatchObject({ penaltyMinor: 4500, corrections: [], pendingAdjustment: { penaltyMinor: 0, baseMinor: 0 } });
  });

  test('charges + paiement partiel sans instruction : loyer d’abord (validé F-U2.12) ; instruction explicite : appliquée', async () => {
    const implicit = await lease({ chargesMinor: 10000 });
    const docImplicit = await issuedRent(implicit.leaseId);
    await allocate(docImplicit, await payment(docImplicit, 100000, wat('2026-05-03T10:00:00')));
    const explicit = await lease({ chargesMinor: 10000 });
    const docExplicit = await issuedRent(explicit.leaseId);
    const pay = await payment(docExplicit, 100000, wat('2026-05-03T10:00:00'));
    await FinancialPayment.updateOne({ _id: pay._id }, { $set: { metadata: { rentImputation: { financialDocument: docExplicit._id, rentMinor: 90000 } } } });
    await allocate(docExplicit, pay);
    await cycle('2026-05-06T08:00:00');
    expect(await Penalty.findOne({ rentDocument: docImplicit._id }).lean()).toMatchObject({ status: 'SIMULATED', imputation: 'RENT_FIRST_DEFAULT', baseMinor: 50000, penaltyMinor: 1500 });
    expect(await Penalty.findOne({ rentDocument: docExplicit._id }).lean()).toMatchObject({ status: 'SIMULATED', imputation: 'EXPLICIT_INSTRUCTION', baseMinor: 60000, penaltyMinor: 1800 });
  });
});

describe('F-U2.11 — recouvrement', () => {
  test('dossier préparé au 25 puis paiement confirmé le 20 affecté après : dossier soldé, historique conservé', async () => {
    const { leaseId } = await lease();
    const document = await issuedRent(leaseId);
    const pay = await payment(document, 150000, wat('2026-05-20T10:00:00'));
    await cycle('2026-05-25T06:00:00');
    expect((await CollectionCase.findOne({ rentDocument: document._id }).lean()).status).toBe('notice_draft_prepared');
    await allocate(document, pay);
    await cycle('2026-05-26T06:00:00');
    const settled = await CollectionCase.findOne({ rentDocument: document._id }).lean();
    expect(settled.status).toBe('settled');
    expect(settled.history.map((h) => h.action)).toEqual(['open', 'notice_draft_prepared', 'settled']);
    expect(settled.history[2].reason).toBe('Paiement confirmé avant la date de mise en demeure, affecté après l’évaluation');
    expect(settled.noticeDraft.sent).toBe(false);
  });

  test('report approuvé : projet suspendu jusqu’à la date ; report échu et impayé : projet préparé à nouveau', async () => {
    const { leaseId } = await lease();
    const document = await issuedRent(leaseId);
    await cycle('2026-05-25T06:00:00');
    const report = await collection.reportPaymentDifficulty({ userId: tenantUser._id, documentId: document._id, now: wat('2026-05-26T09:00:00') });
    await collection.decideDifficultyReport({ actor: adminA.actor, reportId: report._id, decision: 'approve_deferral', approvedPaymentDate: '2026-06-15T23:00:00+01:00' });
    expect(await CollectionCase.findOne({ rentDocument: document._id }).lean()).toMatchObject({ status: 'notice_suspended', suspension: { reason: expect.stringContaining('Report de paiement approuvé') } });
    await cycle('2026-06-10T06:00:00');
    expect((await CollectionCase.findOne({ rentDocument: document._id }).lean()).status).toBe('notice_suspended');
    await cycle('2026-06-20T06:00:00');
    const reopened = await CollectionCase.findOne({ rentDocument: document._id }).lean();
    expect(reopened.status).toBe('notice_draft_prepared');
    expect(reopened.noticeDraft).toMatchObject({ sent: false, legalValidation: 'NOT_VALIDATED' });
  });
});

describe('F-U2.11 — bailleur sans organisation (échéance de suivi)', () => {
  test('échéance de suivi, loyer reçu idempotent, aucune facture légale, isolement', async () => {
    const { leaseId } = await lease({ org: false });
    const create = await request(app).post('/billing/owner/tracking-dues').set('Authorization', token(owner)).send({ leaseId: String(leaseId), period: '2026-04' });
    expect(create.status).toBe(201);
    const documentId = create.body.data.document.id;
    const document = await FinancialDocument.findById(documentId).lean();
    expect(document).toMatchObject({ status: 'draft', totalMinor: 150000, metadata: { trackingObligation: true, legalInvoice: false, issuerPlan: null } });
    await expect(billingDocuments.issueBillingDocument({ documentId, actorId: owner._id })).rejects.toMatchObject({ code: expect.stringMatching(/ISSUER|TRACKING/) });
    const other = await request(app).post('/billing/owner/tracking-dues').set('Authorization', token(otherOwner)).send({ leaseId: String(leaseId), period: '2026-05' });
    expect(other.status).toBe(404);
    const receipt = (key, body) => request(app).post(`/billing/owner/tracking-dues/${documentId}/receipts`).set('Authorization', token(owner)).set('Idempotency-Key', key).send(body);
    expect((await receipt('k1', { amountMinor: 100000, receivedAt: '2026-05-04T10:00:00+01:00', method: 'mobile_money' })).status).toBe(201);
    const replay = await receipt('k1', { amountMinor: 100000, receivedAt: '2026-05-04T10:00:00+01:00', method: 'mobile_money' });
    expect(replay.body.data.replayed).toBe(true);
    expect((await receipt('k2', { amountMinor: 10000, receivedAt: '2999-01-01T00:00:00Z' })).status).toBe(422);
    expect((await request(app).post(`/billing/owner/tracking-dues/${documentId}/receipts`).set('Authorization', token(otherOwner)).set('Idempotency-Key', 'k3').send({ amountMinor: 1000 })).status).toBe(404);
    // F-U2.13 : la déclaration ne solde rien ; la confirmation du locataire affecte le paiement.
    expect((await FinancialDocument.findById(documentId).lean()).balanceMinor).toBe(150000);
    const declared = await DirectRentReceipt.findOne({ document: documentId }).lean();
    await receipts.tenantRespond({ userId: tenantUser._id, receiptId: declared._id, decision: 'confirm' });
    expect((await FinancialDocument.findById(documentId).lean()).balanceMinor).toBe(50000);
    await expect(billingDocuments.cancelBillingDraft({ documentId, actorId: owner._id, reason: 'test' })).rejects.toMatchObject({ code: 'FINANCIAL_DOCUMENT_IMMUTABLE' });
    await cycle('2026-05-06T08:00:00');
    expect(await Penalty.findOne({ rentDocument: documentId }).lean()).toMatchObject({ baseMinor: 50000, penaltyMinor: 1500, status: 'SIMULATED' });
    // Confirmation intervenue aujourd’hui : rattachée au mois de confirmation, pas à mai.
    const sub = await IndividualSubscription.create({ user: owner._id, plan: 'professionnel', status: 'active', startDate: wat('2026-01-01T00:00:00') });
    const accrued = await autonomous.accrueVariableFees({ holder: { holderType: 'USER', holderId: owner._id, subscriptionType: 'IndividualSubscription', subscriptionId: sub._id }, period: { start: wat('2026-05-01T00:00:00'), end: wat('2026-06-01T00:00:00'), label: '2026-05' }, now: wat('2026-06-02T00:00:00') });
    expect(accrued.accrued).toBe(0);
    expect(await Accrual.countDocuments()).toBe(0);
  });

  test('bien d’une organisation : libre-service propriétaire refusé ; suivi : signalement locataire, décision du bailleur, aucun accès plateforme ni organisation', async () => {
    const orgLease = await lease();
    await expect(ownerTracking.generateOwnerTrackingRentDue({ actor: { _id: owner._id }, leaseId: orgLease.leaseId, period: '2026-04', now: wat('2026-04-30T00:00:00') })).rejects.toMatchObject({ code: 'RENT_OWNER_SELF_SERVICE_NOT_APPLICABLE' });
    const { leaseId } = await lease({ org: false });
    const { document } = await ownerTracking.generateOwnerTrackingRentDue({ actor: { _id: owner._id }, leaseId, period: '2026-04', now: wat('2026-04-30T00:00:00') });
    const dues = await request(app).get('/tenant-portal/rent-dues').set('Authorization', token(tenantUser));
    expect(dues.body.data.items.find((item) => String(item.id) === String(document._id))).toMatchObject({ trackingObligation: true, balanceMinor: 150000 });
    const report = await collection.reportPaymentDifficulty({ userId: tenantUser._id, documentId: document._id, now: wat('2026-05-10T10:00:00') });
    await cycle('2026-05-25T06:00:00');
    expect((await CollectionCase.findOne({ rentDocument: document._id }).lean()).status).toBe('notice_suspended');
    await expect(collection.decideDifficultyReport({ actor: { _id: otherOwner._id }, reportId: report._id, decision: 'acknowledge' })).rejects.toMatchObject({ statusCode: expect.any(Number) });
    await expect(collection.decideDifficultyReport({ actor: adminA.actor, reportId: report._id, decision: 'acknowledge' })).rejects.toMatchObject({ statusCode: expect.any(Number) });
    expect(await collection.decideDifficultyReport({ actor: { _id: owner._id }, reportId: report._id, decision: 'acknowledge' })).toMatchObject({ status: 'acknowledged' });
    const platformView = await collection.collectionOverview({ actor: platformOp.actor, now: wat('2026-05-25T06:00:00') });
    expect([platformView.cases.length, platformView.reports.length, platformView.penalties.length]).toEqual([0, 0, 0]);
    const orgView = await collection.collectionOverview({ actor: adminA.actor, now: wat('2026-05-25T06:00:00') });
    expect(orgView.cases.some((c) => String(c.rentDocument) === String(document._id))).toBe(false);
    const mine = await collection.ownerCollection({ actor: { _id: owner._id }, now: wat('2026-05-25T06:00:00') });
    expect(mine.trackingDues.map((d) => String(d.id))).toContain(String(document._id));
    expect((await collection.ownerCollection({ actor: { _id: otherOwner._id } })).trackingDues).toEqual([]);
  });
});
