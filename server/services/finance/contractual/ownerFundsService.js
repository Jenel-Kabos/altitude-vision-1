// F-U1.D — Séparation des fonds et obligations propriétaires.
//
// AGENCY_COLLECTION : un loyer constaté depuis un FinancialPayment confirmé est
// ventilé en (a) commission acquise au mandataire, (b) frais à la charge de
// chaque partie, (c) fonds détenus pour le compte du propriétaire. Seule la
// commission constitue un revenu du mandataire.
//
// OWNER_DIRECT : le paiement n'a jamais transité par le mandataire. Ni une
// déclaration ni la confirmation du propriétaire ne produisent d'effet
// financier ; seul un rapprochement sur pièce tierce, par une personne
// habilitée distincte, fait naître la commission DUE par le propriétaire.
//
// Aucune exécution de paiement sortant : les obligations restent NOT_ENABLED.

const mongoose = require('mongoose');
const MandateCollection = require('../../../models/MandateCollection');
const OwnerFinancialObligation = require('../../../models/OwnerFinancialObligation');
const ManagementMandate = require('../../../models/ManagementMandate');
const ManagementMandateVersion = require('../../../models/ManagementMandateVersion');
const FinancialPayment = require('../../../models/FinancialPayment');
const FinancialDocument = require('../../../models/FinancialDocument');
const PaymentAllocation = require('../../../models/PaymentAllocation');
const Contrat = require('../../../models/Contrat');
const C = require('../../../constants/contractualFinanceConstants');
const { fail } = require('../financialError');
const { runFinancialOperation } = require('../financialTransactionService');
const { appendFinancialLedgerEntry } = require('../financialLedgerService');
const { subtractMinor, assertAmountMinor } = require('../moneyService');
const { computeManagementCommission, determineTransactionFees, computePayoutPeriod } = require('./mandateTermsService');
const { assertMandateOperableAt } = require('./managementMandateService');
const { normalizeEvidence } = require('./financialBeneficiaryService');
const authz = require('./contractualFinanceAuthorizationService');
const { resolveOwnerAuthority, authorizeMandateRead } = require('./ownerAuthorityService');
const { assertDistinctHumans } = require('./humanIdentityService');

const { CONTRACTUAL_CAPABILITIES: CAP, idOf } = authz;

function obligationPeriod({ type, terms, at, sourceKey }) {
  if (type === C.OBLIGATION_TYPES.COMMISSION_RECEIVABLE) {
    // Regroupement mensuel des sommes dues par le propriétaire (cadence de
    // facturation de la commission à confirmer en F-U2).
    return computePayoutPeriod({ frequency: C.PAYOUT_FREQUENCIES.MONTHLY, at });
  }
  return computePayoutPeriod({ frequency: terms.payoutFrequency, at, sourceId: sourceKey });
}

async function accrueObligationLine({ mandate, terms, type, at, sourceKey, line, session }) {
  const period = obligationPeriod({ type, terms, at, sourceKey });
  const filter = { mandate: mandate._id, type, periodKey: period.periodKey };
  await OwnerFinancialObligation.updateOne(filter, {
    $setOnInsert: {
      mandataryType: mandate.mandataryType, tenant: mandate.tenant || null, owner: mandate.owner, property: mandate.property,
      periodStart: period.start, periodEnd: period.end, currency: terms.currency,
      payoutFrequency: type === C.OBLIGATION_TYPES.OWNER_PAYOUT ? terms.payoutFrequency : null,
      beneficiary: type === C.OBLIGATION_TYPES.OWNER_PAYOUT ? terms.payoutBeneficiary : null,
    },
  }, { upsert: true, session });
  assertAmountMinor(line.amountMinor, { allowNegative: true });
  await OwnerFinancialObligation.updateOne(
    { ...filter, 'lines.key': { $ne: line.key } },
    { $push: { lines: { ...line, at } }, $inc: { netAmountMinor: line.amountMinor } },
    { session },
  );
  return OwnerFinancialObligation.findOne(filter).session(session);
}

function ledger(session, { mandate, eventType, entityId, actorId, amountMinor, currency, key, newState, metadata }) {
  return appendFinancialLedgerEntry({
    eventType, domain: 'rental', establishmentType: 'Property', establishmentId: mandate.property,
    entityType: 'MandateCollection', entityId, relatedEntities: [{ entityType: 'ManagementMandate', entityId: mandate._id }],
    actorType: 'user', actorId, amountMinor, currency, businessOperationKey: key, newState, metadata,
  }, { session });
}

// F-U2.12 — assiette de la commission de 10 % : loyer principal encaissé et
// confirmé, HORS charges (règle d'imputation partagée : instruction, clause,
// loyer d'abord). Bail avec charges séparées et part loyer indéterminable :
// refus explicite plutôt qu'une commission sur les charges.
async function leaseHasSeparateCharges(leaseId) {
  if (!leaseId || !mongoose.isValidObjectId(leaseId)) return null; // inconnu
  const lease = await Contrat.findById(leaseId).select('chargesIncluses montantCharges').lean();
  if (!lease) return null;
  return !lease.chargesIncluses && Number(lease.montantCharges || 0) > 0;
}

async function commissionBaseForPayment({ payment, leaseId }) {
  const { allocationRentShares } = require('../billing/rentImputationService'); // différé : évite un cycle
  const allocations = await PaymentAllocation.find({ financialPayment: payment._id, status: 'active' }).lean();
  const separateCharges = await leaseHasSeparateCharges(leaseId);
  if (!allocations.length) {
    if (separateCharges) fail('COLLECTION_RENT_SHARE_UNDETERMINED', 'Bail avec charges séparées : affecter d’abord le paiement à la facture de loyer (la commission ne porte pas sur les charges).', 409);
    return { baseMinor: payment.amountMinor, basis: separateCharges === false ? 'GROSS_LEASE_WITHOUT_SEPARATE_CHARGES' : 'GROSS_LEASE_UNKNOWN' };
  }
  let rentMinor = 0; let allocatedMinor = 0;
  for (const allocation of allocations) {
    allocatedMinor += allocation.amountMinor;
    const document = await FinancialDocument.findById(allocation.financialDocument).lean();
    if (document?.metadata?.billingKind !== 'RENT') continue;
    const { shares } = await allocationRentShares(document);
    rentMinor += shares.find((share) => String(share.allocation) === String(allocation._id))?.rentMinor || 0;
  }
  const unallocated = Math.max(0, payment.amountMinor - allocatedMinor);
  return { baseMinor: rentMinor + (separateCharges === false ? unallocated : 0), basis: 'RENT_SHARE_OF_ALLOCATIONS' };
}

// F-U2.13 — la commission de 10 % suit la PÉRIODE du loyer : elle n'est due
// que si cette période est couverte par ce mandat de gestion déléguée (même
// règle que l'exclusion du 1 % : jamais les deux sur un même loyer).
async function assertRentPeriodCoveredByMandate(mandate, rentPeriod) {
  if (!rentPeriod || !Number.isInteger(Number(rentPeriod.month)) || !Number.isInteger(Number(rentPeriod.year))) return;
  const { delegatedCoverageAt } = require('../billing/leasePolicyService'); // différé : évite un cycle
  const { watMidnight } = require('../billing/rentCalendarService');
  const coverage = await delegatedCoverageAt(mandate.property, watMidnight(Number(rentPeriod.year), Number(rentPeriod.month), 1));
  if (coverage.mode !== 'DELEGATED' || String(coverage.mandate._id) !== String(mandate._id)) {
    fail('COLLECTION_PERIOD_OUTSIDE_MANDATE', 'Période de loyer non couverte par ce mandat de gestion déléguée : aucune commission.', 409);
  }
}

async function loadMandate(mandateId) {
  const mandate = mongoose.isValidObjectId(mandateId) ? await ManagementMandate.findById(mandateId).lean() : null;
  if (!mandate) fail('FINANCIAL_RESOURCE_OUT_OF_SCOPE', 'Mandat inaccessible.', 404);
  return mandate;
}

function assertDelegatedMode(terms, mode) {
  if (terms.offer !== C.MANAGEMENT_OFFERS.DELEGATED_MANAGEMENT) {
    fail('MANDATE_OFFER_NO_DELEGATED_COMMISSION', 'Une gestion autonome par abonnement ne déclenche aucune commission de gestion déléguée.', 409);
  }
  if (terms.collectionMode !== mode) fail('COLLECTION_MODE_MISMATCH', `Le mandat applicable impose le mode ${terms.collectionMode}.`, 409);
}

function assertRentPeriod(rentPeriod) {
  if (!Number.isInteger(rentPeriod?.month) || rentPeriod.month < 1 || rentPeriod.month > 12 || !Number.isInteger(rentPeriod?.year)) {
    fail('RENT_PERIOD_INVALID', 'Période de loyer invalide.', 422);
  }
}

async function recognizeAgencyCollection({ actor, mandateId, financialPaymentId, rentPeriod, leaseId = null }) {
  const mandate = await loadMandate(mandateId);
  const authority = await authz.authorizeOnResource(actor, CAP.COLLECTION_RECORD, mandate);
  assertRentPeriod(rentPeriod);
  const payment = mongoose.isValidObjectId(financialPaymentId) ? await FinancialPayment.findById(financialPaymentId).lean() : null;
  if (!payment || payment.domain !== 'rental' || payment.establishmentType !== 'Property'
    || String(payment.establishmentId) !== String(mandate.property) || idOf(payment.tenant) !== idOf(mandate.tenant)) {
    fail('FINANCIAL_RESOURCE_OUT_OF_SCOPE', 'Paiement inaccessible pour ce mandat.', 404);
  }
  if (payment.status !== 'succeeded' || !payment.confirmedAt) fail('COLLECTION_NOT_CONFIRMED', 'Seul un encaissement confirmé peut être constaté.', 409);
  const existing = await MandateCollection.findOne({ financialPayment: payment._id });
  if (existing) return { collection: existing, replayed: true };

  const { version, terms } = await assertMandateOperableAt(mandate, payment.confirmedAt);
  assertDelegatedMode(terms, C.COLLECTION_MODES.AGENCY_COLLECTION);
  await assertRentPeriodCoveredByMandate(mandate, rentPeriod);
  if (payment.currency !== terms.currency) fail('FINANCIAL_CURRENCY_MISMATCH', 'Devise du paiement différente de la devise du mandat.', 409);
  const gross = payment.amountMinor;
  const base = await commissionBaseForPayment({ payment, leaseId });
  const commission = computeManagementCommission({ terms, confirmedRentMinor: base.baseMinor });
  const fees = determineTransactionFees({ terms, feeKind: C.FEE_KINDS.COLLECTION, paymentMethod: payment.method, provider: payment.provider, amountMinor: gross });
  const ownerShare = subtractMinor(gross, commission.commissionMinor, fees.byParty.OWNER);
  if (ownerShare < 0) fail('OWNER_SHARE_NEGATIVE', 'La part propriétaire ne peut pas être négative.', 409);
  const key = `mandate.collection:${payment._id}`;

  return runFinancialOperation({ operationName: 'mandate.collection.recognize', transactionMode: 'transactional' }, async ({ session }) => {
    const [collection] = await MandateCollection.create([{
      mandataryType: mandate.mandataryType, tenant: mandate.tenant || null, mandate: mandate._id,
      mandateVersion: version._id, termsHash: version.termsHash, property: mandate.property, owner: mandate.owner,
      lease: leaseId, rentPeriod, collectionMode: C.COLLECTION_MODES.AGENCY_COLLECTION, financialPayment: payment._id,
      paymentMethod: payment.method, provider: payment.provider, currency: payment.currency, grossAmountMinor: gross,
      paidAt: payment.confirmedAt, status: C.COLLECTION_RECORD_STATUSES.CONFIRMED,
      breakdown: {
        commissionBasisPoints: commission.basisPoints, commissionMinor: commission.commissionMinor,
        clientMoneyHeldMinor: ownerShare, ownerShareMinor: ownerShare, feeSnapshot: fees,
      },
      recognizedBy: authority.userId, businessOperationKey: key,
    }], { session });
    const common = { mandate, entityId: collection._id, actorId: authority.userId, currency: payment.currency };
    await ledger(session, { ...common, eventType: 'mandate.collection.agency_received', amountMinor: gross, key, newState: { status: 'confirmed', fundsHolder: 'MANDATARY_FOR_OWNER' }, metadata: { financialPaymentId: payment._id, termsHash: version.termsHash } });
    await ledger(session, { ...common, eventType: 'mandate.commission.earned', amountMinor: commission.commissionMinor, key, metadata: { basisPoints: commission.basisPoints, baseMinor: base.baseMinor, baseRule: base.basis, grossMinor: gross } });
    await ledger(session, { ...common, eventType: 'mandate.owner_funds.held', amountMinor: ownerShare, key, metadata: { feesByParty: fees.byParty } });
    const obligation = await accrueObligationLine({
      mandate, terms, type: C.OBLIGATION_TYPES.OWNER_PAYOUT, at: payment.confirmedAt, sourceKey: String(collection._id), session,
      line: { key: `collection:${collection._id}`, kind: C.OBLIGATION_LINE_KINDS.RENT_OWNER_SHARE, sourceType: 'MandateCollection', sourceId: collection._id, amountMinor: ownerShare },
    });
    return { collection, obligation, replayed: false };
  });
}

function normalizeCollectionEvidence(evidence) {
  return normalizeEvidence(evidence, { required: false }).map((item, index) => {
    const kind = evidence[index]?.kind || C.COLLECTION_EVIDENCE_KINDS.OTHER;
    if (!Object.values(C.COLLECTION_EVIDENCE_KINDS).includes(kind)) fail('EVIDENCE_KIND_INVALID', 'Type de pièce invalide.', 422);
    return { ...item, kind };
  });
}

// Déclaration : par le propriétaire / son représentant (pouvoir
// COLLECTION_CONFIRMATION) ou par un agent COLLECTION_RECORD. Aucun effet
// financier : ni commission, ni obligation.
async function declareOwnerDirectCollection({ actor, mandateId, amountMinor, paidAt, rentPeriod, paymentMethod, reference, evidence, idempotencyKey, leaseId = null }) {
  const mandate = await loadMandate(mandateId);
  let declaredBy;
  try {
    declaredBy = (await resolveOwnerAuthority({ actor, mandate, power: C.OWNER_POWERS.COLLECTION_CONFIRMATION })).actorId;
  } catch (error) {
    if (error.code !== 'FINANCIAL_OWNER_REQUIRED') throw error;
    declaredBy = (await authz.authorizeOnResource(actor, CAP.COLLECTION_RECORD, mandate)).userId;
  }
  if (!idempotencyKey) fail('FINANCIAL_IDEMPOTENCY_KEY_REQUIRED', 'Clé d’idempotence requise.', 422);
  if (!Number.isSafeInteger(amountMinor) || amountMinor <= 0) fail('FINANCIAL_INVALID_AMOUNT', 'Montant invalide.', 422);
  assertRentPeriod(rentPeriod);
  const key = `mandate.owner_direct.declare:${mandate._id}:${idempotencyKey}`;
  const existing = await MandateCollection.findOne({ businessOperationKey: key });
  if (existing) {
    if (existing.grossAmountMinor !== amountMinor) fail('FINANCIAL_IDEMPOTENCY_CONFLICT', 'Clé d’idempotence déjà utilisée avec un autre contenu.', 409);
    return { collection: existing, replayed: true };
  }
  const date = new Date(paidAt);
  if (Number.isNaN(date.getTime()) || date > new Date()) fail('COLLECTION_DATE_INVALID', 'Date de paiement invalide.', 422);
  const { version, terms } = await assertMandateOperableAt(mandate, date);
  assertDelegatedMode(terms, C.COLLECTION_MODES.OWNER_DIRECT);
  await assertRentPeriodCoveredByMandate(mandate, rentPeriod);
  const collection = await MandateCollection.create({
    mandataryType: mandate.mandataryType, tenant: mandate.tenant || null, mandate: mandate._id,
    mandateVersion: version._id, termsHash: version.termsHash, property: mandate.property, owner: mandate.owner,
    lease: leaseId, rentPeriod, collectionMode: C.COLLECTION_MODES.OWNER_DIRECT, paymentMethod: String(paymentMethod || 'other'),
    currency: terms.currency, grossAmountMinor: amountMinor, paidAt: date, status: C.COLLECTION_RECORD_STATUSES.DECLARED,
    declaration: { declaredBy, declaredAt: new Date(), reference, evidence: normalizeCollectionEvidence(evidence || []) },
    recognizedBy: declaredBy, businessOperationKey: key,
  });
  return { collection, replayed: false };
}

// Corroboration par le propriétaire d'une déclaration faite par un tiers :
// elle reste EN ATTENTE de vérification (aucune commission, aucune obligation).
async function confirmOwnerDirectByOwner({ actor, collectionId }) {
  const collection = mongoose.isValidObjectId(collectionId) ? await MandateCollection.findById(collectionId) : null;
  if (!collection || collection.collectionMode !== C.COLLECTION_MODES.OWNER_DIRECT) fail('FINANCIAL_RESOURCE_OUT_OF_SCOPE', 'Constatation inaccessible.', 404);
  const mandate = await ManagementMandate.findById(collection.mandate).lean();
  const owner = await resolveOwnerAuthority({ actor, mandate, power: C.OWNER_POWERS.COLLECTION_CONFIRMATION });
  await assertDistinctHumans({ déclarant: collection.declaration?.declaredBy, confirmant: owner.actorId });
  const updated = await MandateCollection.findOneAndUpdate(
    { _id: collection._id, status: C.COLLECTION_RECORD_STATUSES.DECLARED },
    { $set: { status: C.COLLECTION_RECORD_STATUSES.OWNER_CONFIRMED, ownerConfirmation: { confirmedBy: owner.actorId, representation: owner.representation, confirmedAt: new Date() } } },
    { new: true },
  );
  if (!updated) fail('COLLECTION_INVALID_TRANSITION', 'Cette constatation n’est plus confirmable.', 409);
  return { collection: updated, awaitingVerification: true };
}

// Rapprochement : seule voie vers une commission due. Exige une personne
// titulaire de COLLECTION_RECONCILE (octroi explicite), distincte du
// déclarant, du propriétaire et du confirmant ; au moins une pièce émise par un
// tiers (relevé bancaire/opérateur, confirmation prestataire) ; la référence
// de transaction ; un montant vérifié identique au montant déclaré.
async function reconcileOwnerDirectCollection({ actor, collectionId, decision, evidence, providerReference, verifiedAmountMinor, verifiedPaidAt, notes, verifiedRentAmountMinor = null }) {
  const collection = mongoose.isValidObjectId(collectionId) ? await MandateCollection.findById(collectionId) : null;
  if (!collection || collection.collectionMode !== C.COLLECTION_MODES.OWNER_DIRECT) fail('FINANCIAL_RESOURCE_OUT_OF_SCOPE', 'Constatation inaccessible.', 404);
  if (!['confirm', 'reject'].includes(decision)) fail('RECONCILIATION_DECISION_INVALID', 'Décision de rapprochement invalide.', 422);
  const authority = await authz.authorizeOnResource(actor, CAP.COLLECTION_RECONCILE, collection);
  await assertDistinctHumans({
    vérificateur: authority.userId, déclarant: collection.declaration?.declaredBy, propriétaire: collection.owner,
    confirmant: collection.ownerConfirmation?.confirmedBy,
  }, { actor: 'vérificateur' });
  const openStatuses = [C.COLLECTION_RECORD_STATUSES.DECLARED, C.COLLECTION_RECORD_STATUSES.OWNER_CONFIRMED];
  if (!openStatuses.includes(collection.status)) fail('COLLECTION_INVALID_TRANSITION', 'Cette constatation est déjà traitée.', 409);
  const proofs = normalizeCollectionEvidence(evidence || []);
  const reconciliationBase = { method: 'AGENT_VERIFIED_EVIDENCE', reconciledBy: authority.userId, reconciledAt: new Date(), notes, evidence: proofs };

  if (decision === 'reject') {
    const rejected = await MandateCollection.findOneAndUpdate(
      { _id: collection._id, status: { $in: openStatuses } },
      { $set: { status: C.COLLECTION_RECORD_STATUSES.REJECTED, reconciliation: reconciliationBase } }, { new: true },
    );
    if (!rejected) fail('COLLECTION_INVALID_TRANSITION', 'Cette constatation est déjà traitée.', 409);
    return { collection: rejected };
  }

  const allProofs = [...(collection.declaration?.evidence || []), ...proofs];
  if (!allProofs.some((item) => C.RECONCILIATION_EVIDENCE_KINDS.includes(item.kind))) {
    fail('RECONCILIATION_EVIDENCE_INSUFFICIENT', 'Une pièce émise par la banque ou l’opérateur est requise ; une déclaration ou un reçu du propriétaire ne suffit pas.', 422);
  }
  if (!String(providerReference || '').trim()) fail('RECONCILIATION_EVIDENCE_INSUFFICIENT', 'La référence de transaction est requise.', 422);
  if (verifiedAmountMinor !== collection.grossAmountMinor) fail('RECONCILIATION_AMOUNT_MISMATCH', 'Le montant vérifié ne correspond pas au montant déclaré.', 409);
  const paidAt = new Date(verifiedPaidAt);
  if (Number.isNaN(paidAt.getTime()) || paidAt > new Date()) fail('RECONCILIATION_EVIDENCE_INSUFFICIENT', 'Date de paiement vérifiée requise.', 422);

  const version = await ManagementMandateVersion.findById(collection.mandateVersion).lean();
  const mandate = await ManagementMandate.findById(collection.mandate).lean();
  // F-U2.12 — commission sur la part loyer vérifiée (hors charges).
  let rentBase = collection.grossAmountMinor;
  if (await leaseHasSeparateCharges(collection.lease)) {
    if (!Number.isSafeInteger(verifiedRentAmountMinor) || verifiedRentAmountMinor < 0 || verifiedRentAmountMinor > collection.grossAmountMinor) {
      fail('COLLECTION_RENT_SHARE_UNDETERMINED', 'Bail avec charges séparées : indiquer la part loyer vérifiée (la commission ne porte pas sur les charges).', 422);
    }
    rentBase = verifiedRentAmountMinor;
  }
  const commission = computeManagementCommission({ terms: version.terms, confirmedRentMinor: rentBase });
  return runFinancialOperation({ operationName: 'mandate.owner_direct.reconcile', transactionMode: 'transactional' }, async ({ session }) => {
    const updated = await MandateCollection.findOneAndUpdate(
      { _id: collection._id, status: { $in: openStatuses } },
      { $set: {
        status: C.COLLECTION_RECORD_STATUSES.RECONCILED,
        reconciliation: { ...reconciliationBase, providerReference: String(providerReference).trim(), verifiedAmountMinor, verifiedPaidAt: paidAt },
        breakdown: { commissionBasisPoints: commission.basisPoints, commissionMinor: commission.commissionMinor, clientMoneyHeldMinor: 0, ownerShareMinor: collection.grossAmountMinor, feeSnapshot: null },
      } },
      { new: true, session },
    );
    if (!updated) fail('COLLECTION_INVALID_TRANSITION', 'Cette constatation est déjà traitée.', 409);
    const key = `mandate.owner_direct.reconcile:${collection._id}`;
    await ledger(session, { mandate, eventType: 'mandate.collection.owner_direct_reconciled', entityId: collection._id, actorId: authority.userId, amountMinor: null, currency: collection.currency, key, newState: { status: 'reconciled', fundsHolder: 'OWNER' }, metadata: { grossAmountMinor: collection.grossAmountMinor, providerReference: String(providerReference).trim() } });
    // Commission DUE par le propriétaire (créance), pas encaissée.
    await ledger(session, { mandate, eventType: 'mandate.commission.receivable', entityId: collection._id, actorId: authority.userId, amountMinor: commission.commissionMinor, currency: collection.currency, key, metadata: { basisPoints: commission.basisPoints, termsHash: version.termsHash } });
    const obligation = await accrueObligationLine({
      mandate, terms: version.terms, type: C.OBLIGATION_TYPES.COMMISSION_RECEIVABLE, at: collection.paidAt, sourceKey: String(collection._id), session,
      line: { key: `collection:${collection._id}`, kind: C.OBLIGATION_LINE_KINDS.COMMISSION, sourceType: 'MandateCollection', sourceId: collection._id, amountMinor: commission.commissionMinor },
    });
    return { collection: updated, obligation };
  });
}

async function listObligations({ actor, mandateId }) {
  const mandate = await loadMandate(mandateId);
  await authorizeMandateRead(actor, mandate);
  return OwnerFinancialObligation.find({ mandate: mandate._id }).sort({ periodStart: 1 }).lean();
}

// Les reversements et encaissements réels ne sont pas activés en F-U1.
function executeOwnerPayout() {
  fail('PAYOUT_EXECUTION_NOT_ENABLED', 'Aucun reversement réel n’est activé (F-U1).', 501);
}

module.exports = {
  recognizeAgencyCollection, declareOwnerDirectCollection, confirmOwnerDirectByOwner, reconcileOwnerDirectCollection,
  accrueObligationLine, listObligations, executeOwnerPayout,
};
