// F-U2.10 — calendrier locatif, prorata, pénalité de 3 %, signalements et
// mise en demeure (vrai replica set, données fictives, aucun envoi réel).
process.env.FINANCIAL_BENEFICIARY_FINGERPRINT_KEY = 'f-u1-test-fingerprint-key-0123456789abcdef';
// F-U2.11 : le moteur canonique n'opère que s'il est explicitement sélectionné.
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
const Contrat = require('../models/Contrat');
const Locataire = require('../models/Locataire');
const PlatformOperator = require('../models/PlatformOperator');
const FinancialDocument = require('../models/FinancialDocument');
const FinancialDocumentLine = require('../models/FinancialDocumentLine');
const FinancialPayment = require('../models/FinancialPayment');
const FinancialIssuerIdentity = require('../models/FinancialIssuerIdentity');
const ManagementMandate = require('../models/ManagementMandate');
const ManagementMandateVersion = require('../models/ManagementMandateVersion');
const MandateCollection = require('../models/MandateCollection');
const Notification = require('../models/Notification');
const Penalty = require('../models/RentLatePenaltyAssessment');
const Report = require('../models/RentPaymentDifficultyReport');
const CollectionCase = require('../models/RentCollectionCase');
const AutonomousVariableFeeAccrual = require('../models/AutonomousVariableFeeAccrual');
const { PLATFORM_WIDE_CONTEXT_SOURCE } = require('../constants/platformOperatorConstants');
const calendar = require('../services/finance/billing/rentCalendarService');
const rent = require('../services/finance/billing/rentBillingService');
const collection = require('../services/finance/billing/rentCollectionService');
const operations = require('../services/finance/billing/billingOperationsService');
const mandates = require('../services/finance/contractual/managementMandateService');
const beneficiaries = require('../services/finance/contractual/financialBeneficiaryService');
const { allocatePaymentToDocument } = require('../services/finance/paymentAllocationService');
const { errorHandler } = require('../middleware/errorMiddleware');
const billingRoutes = require('../routes/billingRoutes');
const tenantPortalRoutes = require('../routes/tenantPortalRoutes');

const app = express(); app.use(express.json()); app.use('/billing', billingRoutes); app.use('/tenant-portal', tenantPortalRoutes); app.use(errorHandler);
jest.setTimeout(300000);
const oid = () => new mongoose.Types.ObjectId();
const wat = (iso) => new Date(`${iso}+01:00`); // heure locale de Brazzaville
let seq = 0;
let A; let B; let adminA; let secretaireA; let adminB; let owner; let otherOwner; let tenantUser; let otherTenantUser; let platformOp;

beforeAll(async () => {
  await startFinancialMongo();
  await Promise.all([Penalty, Report, CollectionCase, Notification, ManagementMandate, ManagementMandateVersion, MandateCollection].map((model) => model.syncIndexes()));
});
afterAll(stopFinancialMongo);

async function member(fixture, businessRole) {
  const { user } = await createTenantUser({ ...fixture, businessRole, overrides: { role: 'Client' } });
  return { user, actor: tenantActor(user, fixture.tenant) };
}
async function plainUser(role = 'Proprietaire') {
  seq += 1;
  return User.create({ name: `Personne fictive ${seq}`, email: `fu210-${Date.now()}-${seq}@example.test`, password: 'Password123!', passwordConfirm: 'Password123!', role, isEmailVerified: true });
}

beforeEach(async () => {
  await clearFinancialMongo();
  A = await createTenantFixture({ label: 'FU210 A' }); B = await createTenantFixture({ label: 'FU210 B' });
  adminA = await member(A, 'Admin'); secretaireA = await member(A, 'Secretaire'); adminB = await member(B, 'Admin');
  for (const capability of ['contractual.beneficiary.verify', 'contractual.financial.approve']) await activeGrantFixture({ user: adminA.user, capability, tenant: A.tenant });
  owner = await plainUser(); otherOwner = await plainUser();
  tenantUser = await plainUser('Client'); otherTenantUser = await plainUser('Client');
  const op = await plainUser('Client');
  await PlatformOperator.create({ user: op._id, status: 'active', capabilities: ['platform.finance.manage'], grantedBy: oid(), grantReason: 'Test F-U2.10' });
  platformOp = { user: op, actor: { _id: op._id, tenantContextSource: PLATFORM_WIDE_CONTEXT_SOURCE } };
  await FinancialIssuerIdentity.create({ scope: 'TENANT', tenant: A.tenant._id, version: 1, legalName: 'Agence fictive A', rccm: 'CG-FICTIF', niu: 'NIU-FICTIF', phone: '+242 00 000 00 00', address: 'Adresse fictive', status: 'verified', registeredBy: oid(), verifiedBy: oid(), verifiedAt: new Date(), verificationEvidenceRef: 'fixture' });
});

async function lease({ start = '2026-01-01T00:00:00', rentMinor = 150000, chargesMinor = 0, user = tenantUser, dateSortie, avenants } = {}) {
  const propertyId = oid();
  await Property.collection.insertOne({ _id: propertyId, title: 'Bien fictif', address: 'Rue fictive', owner: owner._id, tenant: A.tenant._id, status: 'location' });
  // Un dossier locataire par compte (comme en production) : réutilisé entre baux.
  const existing = user ? await Locataire.findOne({ user: user._id }).lean() : null;
  const locataire = existing ? { insertedId: existing._id } : await Locataire.collection.insertOne({ nom: 'Locataire', prenom: 'Fictif', telephone: '+242 00 000 00 01', email: `loc-${oid()}@example.test`, ...(user ? { user: user._id } : {}) });
  const leaseId = oid();
  await Contrat.collection.insertOne({
    _id: leaseId, type: 'location', bien: propertyId, locataire: locataire.insertedId, statut: 'actif', dateEntree: wat(start), dateFinBail: wat('2027-12-31T00:00:00'),
    montantLoyer: rentMinor, montantCharges: chargesMinor, chargesIncluses: chargesMinor === 0, ...(dateSortie ? { dateSortie: wat(dateSortie) } : {}), ...(avenants ? { avenants } : {}),
  });
  await adoptLeasePolicy({ actor: adminA.actor, leaseId });
  return { leaseId, propertyId, locataireId: locataire.insertedId };
}
async function issuedRent(leaseId, period = '2026-04', extra = {}) {
  const { document } = await rent.generateRentInvoice({ actor: adminA.actor, leaseId, period, now: calendar.rentCalendar(period).billingDate, ...extra });
  await operations.issueDocument({ actor: adminA.actor, documentId: document._id });
  return FinancialDocument.findById(document._id).lean();
}
async function pay(document, amountMinor, confirmedAt) {
  const payment = await FinancialPayment.create({
    tenant: A.tenant._id, domain: 'rental', establishmentType: 'Property', establishmentId: document.establishmentId, paymentReference: `P-${oid()}`, status: 'succeeded', method: 'cash', provider: 'manual',
    currency: 'XAF', amountMinor, availableAmountMinor: amountMinor, confirmedAt, createdBy: adminA.user._id,
  });
  return allocatePaymentToDocument({ paymentId: payment._id, documentId: document._id, amountMinor, businessOperationKey: `alloc-${oid()}`, actor: adminA.user, transactionMode: 'transactional' });
}
const fresh = (document) => FinancialDocument.findById(document._id).lean();
const APRIL = calendar.rentCalendar('2026-04');

describe('F-U2.10 — calendrier (pur, fuseau Africa/Brazzaville)', () => {
  test('avril (30 j) : facture le 30, échéance fin du 5 mai, retard le 6, mise en demeure le 25', () => {
    expect(APRIL.billingDate.toISOString()).toBe('2026-04-29T23:00:00.000Z');
    expect(APRIL.dueDate.toISOString()).toBe('2026-05-05T22:59:59.999Z');
    expect(APRIL.lateFrom.toISOString()).toBe('2026-05-05T23:00:00.000Z');
    expect(APRIL.formalNoticeDate.toISOString()).toBe('2026-05-24T23:00:00.000Z');
  });
  test('mois de 31 jours : facture le 30, le 31 appartient à la période (aucun jour non facturé)', () => {
    const jan = calendar.rentCalendar('2026-01');
    expect(jan.billingDate.toISOString()).toBe('2026-01-29T23:00:00.000Z');
    expect(jan.end.toISOString()).toBe('2026-01-31T23:00:00.000Z');
    expect((jan.end - jan.start) / calendar.DAY).toBe(31);
  });
  test('février : clôture le 28, ou le 29 en année bissextile (F-U2.11)', () => {
    expect(calendar.rentCalendar('2026-02').billingDate.toISOString()).toBe('2026-02-27T23:00:00.000Z');
    const leap = calendar.rentCalendar('2028-02');
    expect(leap.billingDate.toISOString()).toBe('2028-02-28T23:00:00.000Z');
    expect(leap.decisions).toEqual([]);
  });
  test('changement d’année : décembre → échéance le 5 janvier, mise en demeure le 25 janvier', () => {
    const dec = calendar.rentCalendar('2026-12');
    expect(dec.dueDate.toISOString()).toBe('2027-01-05T22:59:59.999Z');
    expect(dec.formalNoticeDate.toISOString()).toBe('2027-01-24T23:00:00.000Z');
  });
  test('bascules exactes : 5 à 23:59 → attente, 6 à 00:00 → retard, 24 à 23:59 → retard, 25 à 00:00 → mise en demeure', () => {
    expect(calendar.phaseAt('2026-04', wat('2026-04-29T23:59:59'))).toBe('BEFORE_BILLING');
    expect(calendar.phaseAt('2026-04', wat('2026-05-05T23:59:59'))).toBe('AWAITING_PAYMENT');
    expect(calendar.phaseAt('2026-04', wat('2026-05-06T00:00:00'))).toBe('LATE');
    expect(calendar.phaseAt('2026-04', wat('2026-05-24T23:59:59'))).toBe('LATE');
    expect(calendar.phaseAt('2026-04', wat('2026-05-25T00:00:00'))).toBe('FORMAL_NOTICE');
  });
  test('indépendant du fuseau du serveur', () => {
    const previous = process.env.TZ;
    try {
      for (const tz of ['Pacific/Kiritimati', 'America/Los_Angeles', 'UTC']) {
        process.env.TZ = tz;
        expect(calendar.rentCalendar('2026-04').dueDate.toISOString()).toBe('2026-05-05T22:59:59.999Z');
        expect(calendar.localDay(wat('2026-04-21T00:00:00'))).toEqual({ year: 2026, month: 4, day: 21 });
      }
    } finally { process.env.TZ = previous; }
  });
});

describe('F-U2.10 — prorata du premier loyer (pur)', () => {
  const p = (period, entry) => calendar.firstRentProrata({ monthlyRentMinor: 150000, period, entryDate: wat(entry) });
  test('entrée le 1er : loyer plein ; 21 avril : 50 000 (validé) ; 15 avril : 80 000 ; 30 avril : 5 000', () => {
    expect(p('2026-04', '2026-04-01T00:00:00')).toMatchObject({ applicable: false, amountMinor: 150000 });
    expect(p('2026-04', '2026-04-21T00:00:00')).toMatchObject({ applicable: true, days: 10, baseDays: 30, amountMinor: 50000, ruleStatus: 'VALIDATED' });
    expect(p('2026-04', '2026-04-15T10:00:00')).toMatchObject({ days: 16, amountMinor: 80000, ruleStatus: 'VALIDATED' });
    expect(p('2026-04', '2026-04-30T00:00:00')).toMatchObject({ days: 1, amountMinor: 5000, ruleStatus: 'VALIDATED' });
  });
  test('F-U2.11 : entrée le 31 sans supplément ; février en base 30 (règle déduite)', () => {
    expect(p('2026-01', '2026-01-31T00:00:00')).toMatchObject({ rule: 'ENTRY_ON_31', ruleStatus: 'VALIDATED', days: 0, amountMinor: 0, firstFullPeriod: '2026-02' });
    // F-U2.12 : février en base 30 désormais validé.
    expect(p('2026-02', '2026-02-15T00:00:00')).toMatchObject({ rule: 'FEBRUARY_CONVENTIONAL', days: 16, baseDays: 30, ruleStatus: 'VALIDATED' });
    expect(p('2028-02', '2028-02-15T00:00:00')).toMatchObject({ rule: 'FEBRUARY_CONVENTIONAL', days: 16, baseDays: 30, ruleStatus: 'VALIDATED' });
  });
});

describe('F-U2.10 — facturation des loyers', () => {
  test('premier loyer au 21 avril : 50 000 FCFA, base conservée, échéance le 5 mai ; pas de double facture', async () => {
    const { leaseId } = await lease({ start: '2026-04-21T00:00:00' });
    const now = APRIL.billingDate;
    await expect(rent.generateRentInvoice({ actor: adminA.actor, leaseId, period: '2026-04', now })).rejects.toMatchObject({ code: 'RENT_PRORATION_CLAUSE_REQUIRED' });
    const { document } = await rent.generateRentInvoice({ actor: adminA.actor, leaseId, period: '2026-04', now, prorataClauseReference: 'Art. 3 du bail fictif' });
    expect(document.totalMinor).toBe(50000);
    expect(document.metadata.proration).toMatchObject({ days: 10, baseDays: 30, monthlyRentMinor: 150000, amountMinor: 50000, rule: 'THIRTY_DAY_BASE', ruleVersion: 'ALTIMMO-PRORATA-2026-10-B', clause: 'Art. 3 du bail fictif' });
    expect(new Date(document.metadata.proration.entryDate).toISOString()).toBe(wat('2026-04-21T00:00:00').toISOString());
    expect(new Date(document.dueDate).toISOString()).toBe('2026-05-05T22:59:59.999Z');
    expect((await rent.generateRentInvoice({ actor: adminA.actor, leaseId, period: '2026-04', now, prorataClauseReference: 'Art. 3 du bail fictif' })).created).toBe(false);
    expect(await FinancialDocument.countDocuments({ 'metadata.billingKind': 'RENT' })).toBe(1);
  });
  test('avant le 30 : refus ; février facturable le 28', async () => {
    const { leaseId } = await lease();
    await expect(rent.generateRentInvoice({ actor: adminA.actor, leaseId, period: '2026-04', now: wat('2026-04-29T23:59:59') })).rejects.toMatchObject({ code: 'RENT_BILLING_DATE_NOT_REACHED' });
    await expect(rent.generateRentInvoice({ actor: adminA.actor, leaseId, period: '2026-02', now: wat('2026-02-28T00:00:00') })).resolves.toMatchObject({ created: true });
  });
  test('entrée le 31 : aucune créance ; cas non décidés bloqués : sortie anticipée, changement de loyer, charges au prorata', async () => {
    const jan = await lease({ start: '2026-01-31T00:00:00' });
    await expect(rent.generateRentInvoice({ actor: adminA.actor, leaseId: jan.leaseId, period: '2026-01', now: wat('2026-01-30T00:00:00'), prorataClauseReference: 'Art. 3' })).rejects.toMatchObject({ code: 'RENT_PERIOD_NOT_BILLABLE_ENTRY_ON_31' });
    const exit = await lease({ dateSortie: '2026-04-15T00:00:00' });
    // F-U2.12 : sortie en cours de mois → décision de sortie exigée.
    await expect(rent.generateRentInvoice({ actor: adminA.actor, leaseId: exit.leaseId, period: '2026-04', now: APRIL.billingDate })).rejects.toMatchObject({ code: 'RENT_EXIT_DECISION_REQUIRED' });
    const change = await lease({ avenants: [{ type: 'loyer', champsModifies: [{ champ: 'montantLoyer', avant: 150000, apres: 160000 }], dateEffet: wat('2026-04-16T00:00:00') }] });
    // F-U2.12 : avenant (150 000 → 160 000) incohérent avec le loyer du bail (150 000) → bloqué.
    await expect(rent.generateRentInvoice({ actor: adminA.actor, leaseId: change.leaseId, period: '2026-04', now: APRIL.billingDate })).rejects.toMatchObject({ code: 'RENT_CHANGE_CALCULATION_AMBIGUOUS' });
    const charges = await lease({ start: '2026-04-21T00:00:00', chargesMinor: 10000 });
    await expect(rent.generateRentInvoice({ actor: adminA.actor, leaseId: charges.leaseId, period: '2026-04', now: APRIL.billingDate, prorataClauseReference: 'Art. 3' })).rejects.toMatchObject({ code: 'RENT_CHARGES_PRORATA_RULE_UNDECIDED' });
  });
});

describe('F-U2.10 — pénalité de 3 %', () => {
  const lateDay = wat('2026-05-06T08:00:00');
  test('150 000 impayés → 4 500 (prévisionnelle, non exigible)', async () => {
    const { leaseId } = await lease();
    const document = await issuedRent(leaseId);
    await collection.runRentCollectionCycle({ now: lateDay });
    expect(await Penalty.findOne({ rentDocument: document._id }).lean()).toMatchObject({ baseMinor: 150000, penaltyMinor: 4500, rateBasisPoints: 300, status: 'SIMULATED', legalBasis: { status: 'OWNER_CONTRACT_DECLARED' } }); // F-U2.13 : conditions adoptées par l’organisation
    expect(() => collection.assertPenaltyEnforceable()).toThrow(expect.objectContaining({ code: 'RENT_PENALTY_LEGAL_BASIS_NOT_VALIDATED' }));
  });
  test('100 000 confirmés avant la fin du 5 → 1 500 ; paiement confirmé le 6 non retenu', async () => {
    const { leaseId } = await lease();
    const document = await issuedRent(leaseId);
    await pay(document, 100000, wat('2026-05-05T23:59:00'));
    await pay(document, 50000, wat('2026-05-06T00:30:00'));
    await collection.runRentCollectionCycle({ now: lateDay });
    expect(await Penalty.findOne({ rentDocument: document._id }).lean()).toMatchObject({ paidRentAtDeadlineMinor: 100000, baseMinor: 50000, penaltyMinor: 1500 });
  });
  test('loyer payé intégralement dans les délais → 0', async () => {
    const { leaseId } = await lease();
    const document = await issuedRent(leaseId);
    await pay(document, 150000, wat('2026-05-02T10:00:00'));
    await collection.runRentCollectionCycle({ now: lateDay });
    expect(await Penalty.findOne({ rentDocument: document._id }).lean()).toMatchObject({ penaltyMinor: 0, status: 'NOT_APPLICABLE' });
  });
  test('relances et exécutions concurrentes : une seule pénalité, non composée, jamais en ligne de facture', async () => {
    const { leaseId } = await lease();
    const document = await issuedRent(leaseId);
    const linesBefore = await FinancialDocumentLine.countDocuments({ financialDocument: document._id });
    await Promise.all([1, 2, 3, 4].map(() => collection.runRentCollectionCycle({ now: lateDay })));
    await collection.runRentCollectionCycle({ now: wat('2026-06-20T08:00:00') });
    await collection.runRentCollectionCycle({ now: wat('2026-07-20T08:00:00') });
    const penalties = await Penalty.find({ rentDocument: document._id }).lean();
    expect(penalties).toHaveLength(1);
    expect(penalties[0].penaltyMinor).toBe(4500);
    expect(await FinancialDocumentLine.countDocuments({ financialDocument: document._id })).toBe(linesBefore);
    expect((await fresh(document)).totalMinor).toBe(150000);
    expect(await Notification.countDocuments({ recipient: tenantUser._id, type: 'rent_penalty_estimated' })).toBe(1);
  });
});

describe('F-U2.10 — signalement par le locataire', () => {
  test('avant le 25 : recevable ; le 25 et après : non recevable ; date serveur', async () => {
    const before = await lease(); const on25 = await lease(); const after = await lease();
    const docs = [await issuedRent(before.leaseId), await issuedRent(on25.leaseId), await issuedRent(after.leaseId)];
    const r1 = await collection.reportPaymentDifficulty({ userId: tenantUser._id, documentId: docs[0]._id, reason: 'Retard de salaire', proposedPaymentDate: '2026-06-02', now: wat('2026-05-24T23:59:00') });
    const r2 = await collection.reportPaymentDifficulty({ userId: tenantUser._id, documentId: docs[1]._id, now: wat('2026-05-25T00:00:00') });
    const r3 = await collection.reportPaymentDifficulty({ userId: tenantUser._id, documentId: docs[2]._id, now: wat('2026-05-28T09:00:00') });
    expect(r1).toMatchObject({ admissibleForSuspension: true, admissibilityBasis: 'DECLARED_BEFORE_25', status: 'submitted', reason: 'Retard de salaire' });
    expect([r2.admissibleForSuspension, r3.admissibleForSuspension]).toEqual([false, false]);
    expect(await Notification.countDocuments({ recipient: adminA.user._id, type: 'rent_difficulty_to_review' })).toBe(3);
  });
  test('antidatage impossible via HTTP ; bail d’un autre locataire refusé ; échéance soldée refusée ; doublon refusé', async () => {
    const mine = await lease(); const theirs = await lease({ user: otherTenantUser }); const settled = await lease();
    const myDoc = await issuedRent(mine.leaseId); const theirDoc = await issuedRent(theirs.leaseId); const paidDoc = await issuedRent(settled.leaseId);
    await pay(paidDoc, 150000, wat('2026-05-01T10:00:00'));
    const token = jwt.sign({ id: tenantUser._id, tokenVersion: 0 }, process.env.JWT_SECRET);
    const before = Date.now();
    const res = await request(app).post(`/tenant-portal/rent-dues/${myDoc._id}/difficulty-report`).set('Authorization', `Bearer ${token}`).send({ reason: 'x', declaredAt: '2026-05-01T00:00:00Z', admissibleForSuspension: true });
    expect(res.status).toBe(201);
    const stored = await Report.findById(res.body.data.report._id).lean();
    expect(new Date(stored.declaredAt).getTime()).toBeGreaterThanOrEqual(before - 1000);
    expect(stored.admissibleForSuspension).toBe(new Date(stored.declaredAt) < APRIL.formalNoticeDate);
    const cross = await request(app).post(`/tenant-portal/rent-dues/${theirDoc._id}/difficulty-report`).set('Authorization', `Bearer ${token}`).send({});
    expect(cross.status).toBe(404);
    await expect(collection.reportPaymentDifficulty({ userId: tenantUser._id, documentId: paidDoc._id, now: wat('2026-05-10T10:00:00') })).rejects.toMatchObject({ code: 'RENT_ALREADY_SETTLED' });
    await expect(collection.reportPaymentDifficulty({ userId: tenantUser._id, documentId: myDoc._id })).rejects.toMatchObject({ code: 'RENT_DIFFICULTY_ALREADY_REPORTED' });
    const dues = await request(app).get('/tenant-portal/rent-dues').set('Authorization', `Bearer ${token}`);
    expect(dues.status).toBe(200);
    expect(dues.body.data.items.map((item) => String(item.id)).sort()).toEqual([String(myDoc._id), String(paidDoc._id)].sort());
    expect(dues.body.data.items.find((item) => String(item.id) === String(myDoc._id))).toMatchObject({ rentMinor: 150000, balanceMinor: 150000, difficultyReport: { status: 'submitted' }, canReportDifficulty: false });
  });
});

describe('F-U2.10 — mise en demeure (projet uniquement)', () => {
  const day25 = wat('2026-05-25T06:00:00');
  test('dette soldée : aucune ; impayé sans signalement : projet non envoyé ; signalement recevable : suspendue', async () => {
    const paid = await lease(); const unpaid = await lease(); const reported = await lease();
    const paidDoc = await issuedRent(paid.leaseId); const unpaidDoc = await issuedRent(unpaid.leaseId); const reportedDoc = await issuedRent(reported.leaseId);
    await pay(paidDoc, 150000, wat('2026-05-20T10:00:00'));
    await pay(unpaidDoc, 40000, wat('2026-05-03T10:00:00'));
    await collection.reportPaymentDifficulty({ userId: tenantUser._id, documentId: reportedDoc._id, now: wat('2026-05-20T10:00:00') });
    await collection.runRentCollectionCycle({ now: day25 });
    expect(await CollectionCase.findOne({ rentDocument: paidDoc._id }).lean()).toMatchObject({ status: 'settled', noticeDraft: { sent: false } });
    const draft = await CollectionCase.findOne({ rentDocument: unpaidDoc._id }).lean();
    expect(draft).toMatchObject({ status: 'notice_draft_prepared', evaluation: { unpaidRentMinor: 110000, penaltyMinor: 3300 }, noticeDraft: { sent: false, sendable: false, legalValidation: 'NOT_VALIDATED' } });
    expect(draft.noticeDraft.content).toMatchObject({ unpaidRentMinor: 110000, penalties: { includedInClaim: false, estimatedMinor: 3300 }, tenant: { name: 'Fictif Locataire' }, property: { title: 'Bien fictif' }, period: '2026-04' });
    expect(draft.noticeDraft.content.paymentsTakenIntoAccount).toHaveLength(1);
    const suspended = await CollectionCase.findOne({ rentDocument: reportedDoc._id }).lean();
    expect(suspended).toMatchObject({ status: 'notice_suspended', suspension: { reason: 'Impayé signalé par le locataire avant la date de mise en demeure' } });
    expect(await Notification.countDocuments({ recipient: adminA.user._id, type: 'rent_formal_notice_suspended' })).toBe(1);
    expect(await Notification.countDocuments({ recipient: adminA.user._id, type: 'rent_formal_notice_to_prepare' })).toBe(1);
    await expect(collection.sendFormalNotice({ actor: adminA.actor, caseId: draft._id })).rejects.toMatchObject({ code: 'FORMAL_NOTICE_LEGAL_VALIDATION_MISSING' });
  });
  test('avant le 25 : aucun dossier ; rejeu et concurrence : aucun doublon', async () => {
    const { leaseId } = await lease();
    const document = await issuedRent(leaseId);
    await collection.runRentCollectionCycle({ now: wat('2026-05-24T23:00:00') });
    expect(await CollectionCase.countDocuments()).toBe(0);
    await Promise.all([1, 2, 3].map(() => collection.runRentCollectionCycle({ now: day25 })));
    await collection.runRentCollectionCycle({ now: wat('2026-06-10T00:00:00') });
    const cases = await CollectionCase.find({ rentDocument: document._id }).lean();
    expect(cases).toHaveLength(1);
    expect(cases[0].history.map((h) => h.action)).toEqual(['open', 'notice_draft_prepared']);
    expect(await Notification.countDocuments({ recipient: adminA.user._id, type: 'rent_formal_notice_to_prepare' })).toBe(1);
  });
  test('signalement tardif + exception motivée du gestionnaire : projet suspendu ; dette et pénalité maintenues', async () => {
    const { leaseId } = await lease();
    const document = await issuedRent(leaseId);
    await collection.runRentCollectionCycle({ now: day25 });
    const report = await collection.reportPaymentDifficulty({ userId: tenantUser._id, documentId: document._id, now: wat('2026-05-26T10:00:00') });
    expect(report.admissibleForSuspension).toBe(false);
    await expect(collection.decideDifficultyReport({ actor: adminA.actor, reportId: report._id, decision: 'grant_exception' })).rejects.toMatchObject({ code: 'RENT_DECISION_REASON_REQUIRED' });
    await expect(collection.decideDifficultyReport({ actor: adminB.actor, reportId: report._id, decision: 'grant_exception', reason: 'x' })).rejects.toMatchObject({ statusCode: expect.any(Number) });
    const decided = await collection.decideDifficultyReport({ actor: adminA.actor, reportId: report._id, decision: 'grant_exception', reason: 'Hospitalisation justifiée (fictif)' });
    expect(decided).toMatchObject({ admissibleForSuspension: true, admissibilityBasis: 'MANAGER_EXCEPTION' });
    expect(await CollectionCase.findOne({ rentDocument: document._id }).lean()).toMatchObject({ status: 'notice_suspended', noticeDraft: { sent: false } });
    expect(await Penalty.findOne({ rentDocument: document._id }).lean()).toMatchObject({ penaltyMinor: 4500 });
    expect((await fresh(document)).balanceMinor).toBe(150000);
    const deferral = await collection.decideDifficultyReport({ actor: adminA.actor, reportId: report._id, decision: 'approve_deferral', approvedPaymentDate: '2026-06-15' });
    expect(deferral.status).toBe('deferral_approved');
  });
});

describe('F-U2.10 — séparation financière, sécurité, isolement', () => {
  test('pénalité exclue du 1 % autonome et de la commission : aucune ligne, aucun encaissement de mandat', async () => {
    const { leaseId } = await lease();
    const document = await issuedRent(leaseId);
    await pay(document, 150000, wat('2026-05-10T10:00:00'));
    await collection.runRentCollectionCycle({ now: wat('2026-05-25T06:00:00') });
    const lines = await FinancialDocumentLine.find({ financialDocument: document._id }).lean();
    expect(lines.map((l) => l.lineType)).toEqual(['rent']);
    expect(await MandateCollection.countDocuments()).toBe(0);
    expect(await AutonomousVariableFeeAccrual.countDocuments()).toBe(0);
    expect(await FinancialDocument.countDocuments({ 'metadata.billingKind': { $ne: 'RENT' } })).toBe(0);
  });
  test('gestion déléguée (encaissement agence) : projet au nom du bailleur représenté par l’organisation', async () => {
    const { leaseId, propertyId } = await lease();
    const b = await beneficiaries.registerBeneficiary({ actor: secretaireA.actor, ownerId: owner._id, kind: 'MOBILE_MONEY', holderName: 'Fictif', institution: 'MTN', accountIdentifier: `2420${Math.floor(10000000 + Math.random() * 89999999)}` });
    await beneficiaries.verifyBeneficiary({ actor: adminA.actor, beneficiaryId: b._id, method: 'Appel', evidence: [{ documentRef: 'doc://fictif' }] });
    const terms = {
      offer: 'DELEGATED_MANAGEMENT', currency: 'XAF', effectiveFrom: new Date('2025-12-01T00:00:00Z'), legalReference: `M-${oid()}`, commission: { basisPoints: 1000, base: 'CONFIRMED_COLLECTED_RENT' },
      collectionMode: 'AGENCY_COLLECTION', payoutFrequency: 'MONTHLY', payoutBeneficiary: b._id,
      feeRules: [{ feeKind: 'COLLECTION', paymentMethod: 'cash', bearer: 'OWNER', pricing: { fixedMinor: 0, basisPoints: 0, tariffSourceReference: 'FIXTURE' } }],
      expenseCaps: { perInterventionMinor: 50000, monthlyCumulativeMinor: 100000, period: 'CALENDAR_MONTH' },
    };
    const { mandate } = await mandates.createMandate({ actor: adminA.actor, propertyId, ownerId: owner._id, reference: `R-${oid()}`, terms, idempotencyKey: `m-${oid()}` });
    await mandates.activateMandate({ actor: adminA.actor, mandateId: mandate._id });
    const document = await issuedRent(leaseId);
    await collection.runRentCollectionCycle({ now: wat('2026-05-25T06:00:00') });
    const draft = await CollectionCase.findOne({ rentDocument: document._id }).lean();
    expect(draft.noticeDraft.content.landlord).toMatchObject({ name: owner.name, representedBy: { role: 'TENANT' } });
  });
  test('vues : organisation A seule ; B, plateforme et contexte non résolu ne voient rien ; propriétaire sans organisation voit ses dossiers', async () => {
    const { leaseId } = await lease();
    const document = await issuedRent(leaseId);
    await collection.reportPaymentDifficulty({ userId: tenantUser._id, documentId: document._id, now: wat('2026-05-10T10:00:00') });
    await collection.runRentCollectionCycle({ now: wat('2026-05-25T06:00:00') });
    const viewA = await collection.collectionOverview({ actor: adminA.actor, now: wat('2026-05-25T06:00:00') });
    expect(viewA).toMatchObject({ plane: 'TENANT', summary: { overdueCount: 1, overdueMinor: 150000, reportsToReview: 1, suspended: 1, penaltiesEstimatedMinor: 4500 } });
    const viewB = await collection.collectionOverview({ actor: adminB.actor, now: wat('2026-05-25T06:00:00') });
    expect([viewB.overdue.length, viewB.reports.length, viewB.cases.length, viewB.penalties.length]).toEqual([0, 0, 0, 0]);
    const viewPlatform = await collection.collectionOverview({ actor: platformOp.actor, now: wat('2026-05-25T06:00:00') });
    expect([viewPlatform.plane, viewPlatform.overdue.length, viewPlatform.cases.length]).toEqual(['PLATFORM', 0, 0]);
    await expect(collection.collectionOverview({ actor: { _id: owner._id, role: owner.role } })).rejects.toMatchObject({ statusCode: expect.any(Number) });
    const mine = await collection.ownerCollection({ actor: { _id: owner._id }, now: wat('2026-05-25T06:00:00') });
    expect(mine.summary).toMatchObject({ overdueCount: 1, reports: 1, cases: 1, penaltiesEstimatedMinor: 4500 });
    const other = await collection.ownerCollection({ actor: { _id: otherOwner._id } });
    expect([other.reports.length, other.cases.length, other.penalties.length]).toEqual([0, 0, 0]);
    expect(await Notification.countDocuments({ recipient: { $in: [otherOwner._id, otherTenantUser._id, adminB.user._id] } })).toBe(0);
  });
  test('HTTP : envoi de mise en demeure refusé ; décision refusée au locataire', async () => {
    const { leaseId } = await lease();
    const document = await issuedRent(leaseId);
    const report = await collection.reportPaymentDifficulty({ userId: tenantUser._id, documentId: document._id, now: wat('2026-05-10T10:00:00') });
    await collection.runRentCollectionCycle({ now: wat('2026-05-25T06:00:00') });
    const kase = await CollectionCase.findOne({ rentDocument: document._id }).lean();
    const adminToken = jwt.sign({ id: adminA.user._id, tokenVersion: 0 }, process.env.JWT_SECRET);
    const send = await request(app).post(`/billing/collection-cases/${kase._id}/send`).set('Authorization', `Bearer ${adminToken}`).set('X-Platform-Tenant-Id', String(A.tenant._id));
    expect(send.status).toBe(409);
    const tenantToken = jwt.sign({ id: tenantUser._id, tokenVersion: 0 }, process.env.JWT_SECRET);
    const decide = await request(app).post(`/billing/difficulty-reports/${report._id}/decision`).set('Authorization', `Bearer ${tenantToken}`).send({ decision: 'close', reason: 'je ne dois rien' });
    expect([403, 404]).toContain(decide.status);
    expect((await Report.findById(report._id).lean()).status).toBe('submitted');
  });
});
