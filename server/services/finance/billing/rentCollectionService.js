// F-U2.10 — Échéances, pénalité de retard, signalements et recouvrement.
//
// Source des obligations : factures de loyer ÉMISES du noyau F-U2
// (`metadata.billingKind = RENT`). Paiements retenus : allocations actives de
// paiements CONFIRMÉS. Aucun moteur parallèle, aucune écriture dans `Paiement`.
//
// Séparation stricte : la pénalité n'est jamais une ligne de facture (pas
// d'impact sur le 1 % autonome ni sur la commission de 10 %), elle n'est
// qu'évaluée (SIMULATED) tant que sa base juridique n'est pas validée.
// La mise en demeure n'est qu'un projet : aucun envoi réel.
//
// F-U2.11 — moteur CANONIQUE des pénalités locatives, actif seulement si
// RENT_PENALTY_ENGINE=CANONICAL (rentPenaltyEngine). Garde par échéance contre
// toute pénalité historique (`Paiement`). Corrections tracées. Échéances de
// SUIVI des bailleurs sans organisation (brouillons `trackingObligation`).
//
// F-U2.13 — moteur technique commun, conditions contractuelles distinctes :
// dates, pénalité, mise en demeure et suspensions proviennent EXCLUSIVEMENT
// de la politique du bail pour la période (leasePolicyService). Conditions
// Altitude Vision (gestion déléguée) : appliquées seulement après acceptation
// explicite du locataire antérieure à l'événement. Aucune politique →
// POLICY_UNRESOLVED : suivi des loyers sans pénalité ni mise en demeure.

const mongoose = require('mongoose');
const Contrat = require('../../../models/Contrat');
const Property = require('../../../models/Property');
const Locataire = require('../../../models/Locataire');
const User = require('../../../models/User');
const PlatformTenant = require('../../../models/PlatformTenant');
const FinancialDocument = require('../../../models/FinancialDocument');
const Paiement = require('../../../models/Paiement');
const Penalty = require('../../../models/RentLatePenaltyAssessment');
const Report = require('../../../models/RentPaymentDifficultyReport');
const CollectionCase = require('../../../models/RentCollectionCase');
const DirectRentReceipt = require('../../../models/DirectRentReceipt');
const { BILLING_KINDS } = require('../../../constants/billingConstants');
const { RENT_PENALTY_POLICY, FORMAL_NOTICE_POLICY } = require('../../../constants/rentCollectionConstants');
const { fail } = require('../financialError');
const authz = require('../contractual/contractualFinanceAuthorizationService');
const { notify } = require('../../notificationService');
const { resolveLocataireForUser } = require('../../tenantLinkService');
const calendar = require('./rentCalendarService');
const { allocationRentShares } = require('./rentImputationService');
const { activePenaltyEngine, ENGINES } = require('./rentPenaltyEngine');
const { policyForDocument, consentStatusAt } = require('./leasePolicyService');
const { POLICY_TYPES } = require('../../../constants/leasePolicyConstants');

const { CONTRACTUAL_CAPABILITIES: CAP, idOf } = authz;
const RENT_FILTER = { domain: 'rental', documentType: 'invoice', 'metadata.billingKind': BILLING_KINDS.RENT };
// Échéances suivies : factures émises + échéances de suivi (bailleur sans organisation).
const DUE_FILTER = { ...RENT_FILTER, $or: [{ status: 'issued' }, { status: 'draft', 'metadata.trackingObligation': true }] };
const REVISABLE_PENALTY_STATUSES = ['SIMULATED', 'NOT_APPLICABLE', 'PENDING_IMPUTATION_DECISION', 'PENDING_RECEIPT_CONFIRMATION'];
const OPEN_RECEIPT_STATUSES = ['DECLARED', 'EVIDENCE_SUBMITTED', 'UNDER_REVIEW'];
const oid = (value) => new mongoose.Types.ObjectId(String(value));

// ─── Position d'une échéance ──────────────────────────────────────────

// Loyer principal et part loyer des encaissements CONFIRMÉS avant `at`
// (date de confirmation, jamais date d'allocation). Imputation : règle
// validée F-U2.12 (rentImputationService). F-U2.13 — les encaissements
// directs simplement DÉCLARÉS ne sont jamais comptés comme payés : montants
// séparés (déclaré en attente, contesté).
async function rentPosition(document, at) {
  const { rentMinor, otherMinor, shares, imputation } = await allocationRentShares(document, { at });
  const paidMinor = shares.reduce((sum, share) => sum + share.amountMinor, 0);
  const paidRentMinor = shares.reduce((sum, share) => sum + share.rentMinor, 0);
  const unpaidRentMinor = Math.max(0, rentMinor - paidRentMinor);
  const receipts = await DirectRentReceipt.find({ document: document._id, status: { $in: [...OPEN_RECEIPT_STATUSES, 'CONTESTED'] }, receivedAt: { $lt: new Date(at) } }).select('status amountMinor').lean();
  const declaredPendingMinor = receipts.filter((r) => OPEN_RECEIPT_STATUSES.includes(r.status)).reduce((sum, r) => sum + r.amountMinor, 0);
  const contestedMinor = receipts.filter((r) => r.status === 'CONTESTED').reduce((sum, r) => sum + r.amountMinor, 0);
  const balanceMinor = Math.max(0, rentMinor + otherMinor - paidMinor);
  return {
    rentMinor, chargesMinor: otherMinor, paidMinor, paidRentMinor, imputation, unpaidRentMinor, unpaidRentMaxMinor: unpaidRentMinor,
    balanceMinor, confirmedBalanceMinor: balanceMinor, declaredPendingMinor, contestedMinor,
    declaredBalanceMinor: Math.max(0, balanceMinor - declaredPendingMinor),
    payments: shares.map((share) => ({ allocation: share.allocation, amountMinor: share.amountMinor, rentMinor: share.rentMinor, chargesMinor: share.otherMinor, rule: share.rule, confirmedAt: share.confirmedAt, allocatedAt: share.allocatedAt })),
  };
}

// Politique de l'échéance (figée à sa création) et calendrier contractuel.
async function policyContext(document) {
  const resolution = await policyForDocument(document);
  const terms = resolution.status === 'RESOLVED' ? resolution.terms : null;
  return { resolution, terms, pcal: calendar.policyCalendar(document.metadata.period, terms) };
}
const policyRef = (resolution) => ({ id: resolution.policy?._id || null, type: resolution.policy?.type || null, version: resolution.policy?.version || null, reason: resolution.reason || null });

async function contextOf(document) {
  const lease = document.subjectType === 'Contrat' ? await Contrat.findById(document.subjectId).select('locataire statut bien reference').lean() : null;
  const property = await Property.findById(document.establishmentId).select('owner tenant title address').lean();
  const locataire = lease?.locataire ? await Locataire.findById(lease.locataire).select('nom prenom user').lean() : null;
  return { lease, property, locataire, owner: property?.owner || document.metadata?.parties?.economicBeneficiary?.userId || null };
}

// Notification in-app/push au mieux (jamais d'e-mail ni SMS) : un échec de
// notification n'interrompt jamais le traitement financier.
async function notifyOnce(recipient, payload) {
  if (!recipient) return;
  try { await notify({ ...payload, recipient, entityType: 'FinancialDocument' }); } catch (error) { console.warn(`⚠️ [Recouvrement] notification ${payload.type} non remise : ${error.message}`); }
}

function audiences(document, ctx) {
  // Échéance de suivi : le bailleur est lui-même le gestionnaire.
  const manager = document.issuedBy || null;
  return { tenantUser: ctx.locataire?.user || null, owner: ctx.owner, manager, platformTenantId: document.tenant || null };
}

// ─── Pénalité (3 %) ───────────────────────────────────────────────────

function penaltyFigures(position, rateBasisPoints) {
  const penaltyMinor = calendar.latePenaltyMinor(position.unpaidRentMinor, rateBasisPoints);
  let status = 'NOT_APPLICABLE';
  if (position.unpaidRentMinor > 0) status = position.declaredPendingMinor >= position.unpaidRentMinor ? 'PENDING_RECEIPT_CONFIRMATION' : 'SIMULATED';
  return {
    rentPrincipalMinor: position.rentMinor, paidRentAtDeadlineMinor: position.paidRentMinor, baseMinor: position.unpaidRentMinor, penaltyMinor, status,
    imputation: position.imputation, penaltyRangeMinor: { min: penaltyMinor, max: calendar.latePenaltyMinor(position.unpaidRentMaxMinor, rateBasisPoints) },
  };
}
const zeroFigures = (position, status) => ({ rentPrincipalMinor: position.rentMinor, paidRentAtDeadlineMinor: position.paidRentMinor, baseMinor: 0, penaltyMinor: 0, status, imputation: position.imputation, penaltyRangeMinor: { min: 0, max: 0 } });

async function legacyPenaltyFor(document, cal) {
  if (document.subjectType !== 'Contrat') return null;
  return Paiement.findOne({ contrat: document.subjectId, mois: cal.month, annee: cal.year, penaliteAppliquee: true }).select('_id penaliteMontant').lean();
}

// Évaluation au 6 (une par échéance) puis RÉVISION tracée à chaque cycle : la
// pénalité reflète le loyer impayé à la fin du 5 selon les dates de
// CONFIRMATION, même si l'allocation intervient après l'évaluation.
async function assessLatePenalty(document, ctx, now, pc = null) {
  const { resolution, terms, pcal } = pc || await policyContext(document);
  // Sans échéance contractuelle (aucune politique, ou aucune date stipulée) : pas de retard au sens du bail.
  if (!pcal.lateFrom || new Date(now) < pcal.lateFrom) return null;
  const cal = pcal;
  const legacy = await legacyPenaltyFor(document, cal);
  const position = await rentPosition(document, cal.lateFrom);
  let figures;
  let reason = null;
  if (legacy) figures = zeroFigures(position, 'LEGACY_PENALTY_EXISTS');
  else if (!terms.penalty) figures = zeroFigures(position, 'NO_CONTRACTUAL_PENALTY');
  else {
    const consent = await consentStatusAt(resolution, cal.lateFrom);
    if (!consent.valid) { figures = zeroFigures(position, 'POLICY_CONSENT_MISSING'); reason = consent.reason; }
    else figures = penaltyFigures(position, terms.penalty.rateBasisPoints);
  }
  const rate = terms?.penalty?.rateBasisPoints || 0;
  const altitude = resolution.policy?.type === POLICY_TYPES.ALTITUDE_DELEGATED;
  const write = await Penalty.updateOne({ rentDocument: document._id, kind: 'LATE_PAYMENT' }, {
    $setOnInsert: {
      rentDocument: document._id, kind: 'LATE_PAYMENT', lease: ctx.lease?._id || null, property: document.establishmentId, owner: ctx.owner,
      locataire: ctx.locataire?._id || null, tenant: document.tenant || null, scope: document.metadata.scope, period: cal.period,
      assessedAt: new Date(now), lateFrom: cal.lateFrom, rateBasisPoints: rate, policyVersion: resolution.policy?.policyLabel || `politique-bail-v${resolution.policy?.version}`,
      imputationRule: RENT_PENALTY_POLICY.imputationRule, engine: ENGINES.CANONICAL, ...figures, policy: { ...policyRef(resolution), reason },
      legacyPenalty: legacy ? { paiement: legacy._id, penaliteMontant: legacy.penaliteMontant ?? null, detectedAt: new Date(now) } : { paiement: null, penaliteMontant: null, detectedAt: null },
      legalBasis: { status: altitude ? RENT_PENALTY_POLICY.legalStatus : 'OWNER_CONTRACT_DECLARED', contractClauseReference: resolution.policy?.documentReference || null },
    },
  }, { upsert: true });
  let penalty = await Penalty.findOne({ rentDocument: document._id, kind: 'LATE_PAYMENT' }).lean();
  const to = audiences(document, ctx);
  const base = { platformTenantId: to.platformTenantId, entityId: document._id, data: { rentDocumentId: document._id, period: cal.period } };
  if (write.upsertedCount) {
    if (penalty.status === 'SIMULATED' && penalty.baseMinor > 0) {
      await notifyOnce(to.tenantUser, { ...base, type: 'rent_overdue', title: `Loyer ${cal.period} en retard`, body: `Reste dû à l’échéance : ${penalty.baseMinor} FCFA.`, dedupeKey: `rent-overdue:${document._id}` });
      await notifyOnce(to.tenantUser, { ...base, type: 'rent_penalty_estimated', title: 'Pénalité de retard prévisionnelle', body: `${rate / 100} % du loyer impayé selon votre bail : ${penalty.penaltyMinor} FCFA (prévisionnel, non exigible à ce stade).`, dedupeKey: `rent-penalty:${document._id}` });
      await notifyOnce(to.owner, { ...base, type: 'rent_overdue', title: `Loyer ${cal.period} en retard`, body: `Loyer impayé à l’échéance : ${penalty.baseMinor} FCFA.`, dedupeKey: `rent-overdue-owner:${document._id}` });
      await notifyOnce(to.manager, { ...base, type: 'rent_overdue', title: `Échéance ${cal.period} en retard`, body: `Loyer impayé à l’échéance : ${penalty.baseMinor} FCFA.`, dedupeKey: `rent-overdue-manager:${document._id}` });
    }
    return penalty;
  }
  // Pénalité historique apparue après l'évaluation (ancienne instance) :
  // rattachée pour rapprochement, montants inchangés, jamais de double calcul.
  if (legacy && !penalty.legacyPenalty?.paiement) {
    await Penalty.updateOne({ _id: penalty._id, 'legacyPenalty.paiement': null }, { $set: { legacyPenalty: { paiement: legacy._id, penaliteMontant: legacy.penaliteMontant ?? null, detectedAt: new Date(now) } } });
    return Penalty.findById(penalty._id).lean();
  }
  if (penalty.status === 'LEGACY_PENALTY_EXISTS' || legacy) return penalty;
  const changed = penalty.baseMinor !== figures.baseMinor || penalty.penaltyMinor !== figures.penaltyMinor || penalty.status !== figures.status;
  if (!changed) return penalty;
  if (penalty.legalBasis?.status === 'VALIDATED' || !REVISABLE_PENALTY_STATUSES.includes(penalty.status)) {
    await Penalty.updateOne({ _id: penalty._id }, { $set: { pendingAdjustment: { at: new Date(now), baseMinor: figures.baseMinor, penaltyMinor: figures.penaltyMinor, reason: 'Écart constaté après validation : ajustement contrôlé à décider' } } });
    return Penalty.findById(penalty._id).lean();
  }
  let correctionReason = penalty.status === 'PENDING_RECEIPT_CONFIRMATION' || figures.status === 'PENDING_RECEIPT_CONFIRMATION' ? 'DIRECT_RECEIPT_STATUS_CHANGED' : 'IMPUTATION_RESOLVED';
  if (figures.baseMinor < penalty.baseMinor) correctionReason = 'TIMELY_PAYMENT_ALLOCATED_AFTER_ASSESSMENT';
  else if (figures.baseMinor > penalty.baseMinor) correctionReason = 'PAYMENT_REVERSED_OR_IMPUTATION_CHANGED';
  const updated = await Penalty.findOneAndUpdate(
    { _id: penalty._id, baseMinor: penalty.baseMinor, penaltyMinor: penalty.penaltyMinor, status: penalty.status },
    {
      $set: { baseMinor: figures.baseMinor, penaltyMinor: figures.penaltyMinor, status: figures.status, paidRentAtDeadlineMinor: figures.paidRentAtDeadlineMinor, imputation: figures.imputation, penaltyRangeMinor: figures.penaltyRangeMinor },
      $push: { corrections: { at: new Date(now), reason: correctionReason, previous: { baseMinor: penalty.baseMinor, penaltyMinor: penalty.penaltyMinor, status: penalty.status }, next: { baseMinor: figures.baseMinor, penaltyMinor: figures.penaltyMinor, status: figures.status } } },
    },
    { new: true },
  ).lean();
  if (!updated) return Penalty.findById(penalty._id).lean(); // révisé en parallèle
  penalty = updated;
  await notifyOnce(to.tenantUser, { ...base, type: 'rent_penalty_estimated', title: 'Pénalité prévisionnelle révisée', body: `Nouveau montant prévisionnel : ${penalty.penaltyMinor} FCFA.`, dedupeKey: `rent-penalty:${document._id}:c${penalty.corrections.length}` });
  return penalty;
}

// Une pénalité ne devient exigible que sur base contractuelle ET juridique
// validée : non disponible → refus systématique (aucun recouvrement réel).
function assertPenaltyEnforceable() {
  if (RENT_PENALTY_POLICY.legalStatus !== 'VALIDATED') {
    fail('RENT_PENALTY_LEGAL_BASIS_NOT_VALIDATED', 'Pénalité de retard non exigible : base contractuelle et juridique non validée (montant prévisionnel uniquement).', 409);
  }
}

// ─── Mise en demeure (projet uniquement) ──────────────────────────────

// Suspension : seulement si la politique du bail le stipule — signalement
// recevable (avant la date de mise en demeure ou exception motivée), report
// approuvé non échu.
async function suspendingReport(document, now, terms) {
  const notice = terms?.formalNotice || {};
  const reports = await Report.find({ rentDocument: document._id, status: { $ne: 'closed' } }).lean();
  const deferral = notice.suspendOnApprovedDeferral ? reports.find((r) => r.status === 'deferral_approved' && r.approvedPaymentDate && new Date(r.approvedPaymentDate) >= new Date(now)) : null;
  const admissible = notice.suspendOnDifficultyReport ? reports.find((r) => r.admissibleForSuspension && r.status !== 'deferral_approved') : null;
  return deferral || admissible || null;
}

async function noticeDraftContent(document, ctx, position, penalty, reference, now) {
  const issuer = document.metadata?.issuerPlan;
  const ownerUser = ctx.owner ? await User.findById(ctx.owner).select('name').lean() : null;
  const agency = issuer?.onBehalfOfOwner && issuer.tenantId ? await PlatformTenant.findById(issuer.tenantId).select('name').lean() : null;
  return {
    reference, date: now, legalValidation: FORMAL_NOTICE_POLICY.legalValidation,
    landlord: { name: ownerUser?.name || null, representedBy: issuer?.onBehalfOfOwner ? { role: issuer.role, name: agency?.name || (issuer.role === 'PLATFORM' ? 'Altitude Vision' : null) } : null },
    tenant: { name: [ctx.locataire?.prenom, ctx.locataire?.nom].filter(Boolean).join(' ') || document.customer?.name || null },
    lease: { id: ctx.lease?._id || document.subjectId, reference: ctx.lease?.reference || null },
    property: { title: ctx.property?.title || null, address: ctx.property?.address || null },
    period: document.metadata.period, rentInvoiceNumber: document.documentNumber,
    rentPrincipalMinor: position.rentMinor, unpaidRentMinor: position.unpaidRentMinor,
    penalties: { includedInClaim: false, estimatedMinor: penalty?.penaltyMinor || 0, rateBasisPoints: penalty?.rateBasisPoints || 0, status: penalty?.status || null, reason: 'Base juridique de la pénalité non validée', legacyPenaltyMinor: penalty?.legacyPenalty?.penaliteMontant ?? null },
    contractualPolicy: { type: penalty?.policy?.type || document.metadata?.policy?.type || null, version: penalty?.policy?.version || document.metadata?.policy?.version || null },
    imputation: position.imputation, unpaidRentMaxMinor: position.unpaidRentMaxMinor, trackingObligation: Boolean(document.metadata?.trackingObligation),
    paymentsTakenIntoAccount: position.payments,
    paymentTerms: null, // modalités de règlement : modèle juridique à valider
    pendingLegalChecks: ['MODELE_APPLICABLE', 'EMETTEUR_HABILITE', 'MANDAT_DE_REPRESENTATION', 'CANAL_DE_NOTIFICATION', 'DELAIS_LEGAUX', 'PREUVE_DE_REMISE', 'PROCEDURES_OBLIGATOIRES'],
  };
}

async function evaluateCollectionCase(document, ctx, now, pc = null) {
  const { resolution, terms, pcal } = pc || await policyContext(document);
  // Aucune procédure stipulée par la politique du bail : aucun dossier formel.
  if (!pcal.formalNoticeDate || new Date(now) < pcal.formalNoticeDate) return null;
  const cal = pcal;
  const reference = `REC-${cal.period}-${String(document._id).slice(-8).toUpperCase()}`;
  await CollectionCase.updateOne({ rentDocument: document._id }, {
    $setOnInsert: {
      rentDocument: document._id, reference, lease: ctx.lease?._id || null, property: document.establishmentId, owner: ctx.owner,
      locataire: ctx.locataire?._id || null, tenant: document.tenant || null, scope: document.metadata.scope, period: cal.period, policy: policyRef(resolution),
      formalNoticeDate: cal.formalNoticeDate, status: 'evaluating', history: [{ action: 'open', at: new Date(now) }],
    },
  }, { upsert: true });
  const current = await CollectionCase.findOne({ rentDocument: document._id }).lean();
  if (current.status !== 'evaluating') return reviewCollectionCase(document, ctx, current, now, terms);
  const position = await rentPosition(document, now);
  const penalty = await Penalty.findOne({ rentDocument: document._id }).lean();
  const evaluation = { at: new Date(now), rentPrincipalMinor: position.rentMinor, paidRentMinor: position.paidRentMinor, unpaidRentMinor: position.unpaidRentMinor, penaltyMinor: penalty?.penaltyMinor || 0, penaltyStatus: penalty?.status || null, leaseStatus: ctx.lease?.statut || null };
  const consent = position.unpaidRentMinor > 0 ? await consentStatusAt(resolution, cal.formalNoticeDate) : { valid: true };
  const report = position.unpaidRentMinor > 0 && consent.valid ? await suspendingReport(document, now, terms) : null;
  let set; let action; let reason;
  if (position.unpaidRentMinor === 0) { set = { status: 'settled' }; action = 'settled'; reason = 'Loyer soldé à la date de mise en demeure : aucune mise en demeure'; }
  else if (!consent.valid) { set = { status: 'blocked_policy', block: { reason: consent.reason, at: new Date(now) } }; action = 'blocked_policy'; reason = `Procédure inapplicable : ${consent.reason}`; }
  else if (report) {
    reason = suspensionReason(report);
    set = { status: 'notice_suspended', suspension: { reason, report: report._id, at: new Date(now) } }; action = 'notice_suspended';
  } else if (position.declaredPendingMinor >= position.unpaidRentMinor) {
    reason = 'Encaissement déclaré par le bailleur en attente de confirmation';
    set = { status: 'notice_suspended', suspension: { reason, report: null, at: new Date(now) } }; action = 'notice_suspended';
  } else {
    set = await draftNotice(document, ctx, position, penalty, reference, now);
    action = 'notice_draft_prepared'; reason = 'Projet non envoyé : validation juridique absente';
  }
  const updated = await CollectionCase.findOneAndUpdate(
    { _id: current._id, status: 'evaluating' },
    { $set: { ...set, evaluation }, $push: { history: { action, at: new Date(now), reason } } },
    { new: true },
  ).lean();
  if (!updated) return CollectionCase.findById(current._id).lean(); // évalué en parallèle
  await notifyCaseOutcome(document, ctx, updated, action, reason, position);
  return updated;
}

function suspensionReason(report) {
  if (report.status === 'deferral_approved') return 'Report de paiement approuvé';
  return report.admissibilityBasis === 'MANAGER_EXCEPTION' ? 'Exception accordée par le gestionnaire' : 'Impayé signalé par le locataire avant la date de mise en demeure';
}

async function draftNotice(document, ctx, position, penalty, reference, now) {
  const content = await noticeDraftContent(document, ctx, position, penalty, reference, now);
  return { status: 'notice_draft_prepared', noticeDraft: { preparedAt: new Date(now), policyVersion: FORMAL_NOTICE_POLICY.version, legalValidation: FORMAL_NOTICE_POLICY.legalValidation, sendable: false, sent: false, content } };
}

async function notifyCaseOutcome(document, ctx, collectionCase, action, reason, position) {
  const to = audiences(document, ctx);
  const base = { platformTenantId: to.platformTenantId, entityId: document._id, data: { rentDocumentId: document._id, collectionCaseId: collectionCase._id, period: collectionCase.period } };
  if (action === 'notice_suspended') {
    await notifyOnce(to.manager, { ...base, type: 'rent_formal_notice_suspended', title: 'Mise en demeure suspendue', body: `${collectionCase.period} : ${reason}. Dette toujours suivie (${position.unpaidRentMinor} FCFA).`, dedupeKey: `rent-notice-suspended:${document._id}` });
    await notifyOnce(to.owner, { ...base, type: 'rent_formal_notice_suspended', title: 'Mise en demeure suspendue', body: `${collectionCase.period} : ${reason}.`, dedupeKey: `rent-notice-suspended-owner:${document._id}` });
  } else if (action === 'notice_draft_prepared') {
    await notifyOnce(to.manager, { ...base, type: 'rent_formal_notice_to_prepare', title: 'Mise en demeure à préparer', body: `${collectionCase.period} : loyer impayé de ${position.unpaidRentMinor} FCFA. Projet non envoyé (validation juridique requise).`, dedupeKey: `rent-notice-draft:${document._id}` });
    await notifyOnce(to.owner, { ...base, type: 'rent_formal_notice_to_prepare', title: 'Dossier de recouvrement ouvert', body: `${collectionCase.period} : loyer impayé de ${position.unpaidRentMinor} FCFA.`, dedupeKey: `rent-notice-draft-owner:${document._id}` });
  }
}

// F-U2.11 — suivi après le 25 (le projet n'étant jamais envoyé) : loyer
// soldé, y compris par un paiement confirmé à temps et affecté tardivement →
// dossier soldé ; report échu et impayé → projet préparé. Historique conservé.
async function reviewCollectionCase(document, ctx, current, now, terms) {
  if (!['notice_draft_prepared', 'notice_suspended', 'blocked_policy'].includes(current.status) || current.noticeDraft?.sent) return current;
  const position = await rentPosition(document, now);
  if (position.unpaidRentMinor === 0) {
    const atNotice = await rentPosition(document, current.formalNoticeDate);
    const reason = atNotice.unpaidRentMinor === 0 ? 'Paiement confirmé avant la date de mise en demeure, affecté après l’évaluation' : 'Loyer soldé après la date de mise en demeure';
    return (await CollectionCase.findOneAndUpdate({ _id: current._id, status: current.status }, { $set: { status: 'settled' }, $push: { history: { action: 'settled', at: new Date(now), reason } } }, { new: true }).lean()) || current;
  }
  if (current.status === 'notice_suspended') {
    const report = await suspendingReport(document, now, terms);
    if (!report && position.declaredPendingMinor < position.unpaidRentMinor) {
      const penalty = await Penalty.findOne({ rentDocument: document._id }).lean();
      const set = await draftNotice(document, ctx, position, penalty, current.reference, now);
      const updated = await CollectionCase.findOneAndUpdate({ _id: current._id, status: 'notice_suspended' }, { $set: set, $push: { history: { action: 'notice_draft_prepared', at: new Date(now), reason: 'Suspension levée (report échu, signalement clôturé ou encaissement déclaré non confirmé) : projet non envoyé' } } }, { new: true }).lean();
      if (updated) { await notifyCaseOutcome(document, ctx, updated, 'notice_draft_prepared', null, position); return updated; }
    }
  }
  return current;
}

// Autorité sur un dossier : gestionnaire habilité du périmètre, ou bailleur
// sans organisation sur sa propre échéance de suivi (F-U2.11).
async function authorizeCollectionActor(actor, record, capability) {
  const actorId = idOf(actor);
  const document = await FinancialDocument.findById(record.rentDocument).select('metadata.ownerSelfManaged metadata.ownerScope').lean();
  if (actorId && document?.metadata?.ownerSelfManaged && String(document.metadata.ownerScope) === actorId) return { userId: actorId, plane: 'OWNER_SELF' };
  return authz.authorizeOnResource(actor, capability, record.scope);
}

// Envoi réel interdit tant que la validation juridique manque.
async function sendFormalNotice({ actor, caseId }) {
  const collectionCase = mongoose.isValidObjectId(caseId) ? await CollectionCase.findById(caseId).lean() : null;
  if (!collectionCase) fail('FINANCIAL_RESOURCE_OUT_OF_SCOPE', 'Dossier inaccessible.', 404);
  await authorizeCollectionActor(actor, collectionCase, CAP.BILLING_ISSUE);
  if (FORMAL_NOTICE_POLICY.legalValidation !== 'VALIDATED' || !FORMAL_NOTICE_POLICY.automaticSending) {
    fail('FORMAL_NOTICE_LEGAL_VALIDATION_MISSING', 'Envoi impossible : modèle, émetteur habilité, mandat, canal, délais et preuve de remise non validés.', 409);
  }
  return collectionCase;
}

// ─── Cycle automatique (idempotent, rejouable, rattrapage) ────────────

async function processRentDocument(document, now) {
  const pc = await policyContext(document);
  const cal = pc.pcal;
  const ctx = await contextOf(document);
  const to = audiences(document, ctx);
  const base = { platformTenantId: to.platformTenantId, entityId: document._id, data: { rentDocumentId: document._id, period: cal.period } };
  const dueText = cal.dueDate ? `, à régler au plus tard le ${cal.dueDate.toISOString().slice(0, 10)}` : '';
  await notifyOnce(to.tenantUser, { ...base, type: 'rent_invoice_available', title: `Loyer ${cal.period}`, body: `Montant : ${document.totalMinor} FCFA${dueText}.`, dedupeKey: `rent-invoice:${document._id}` });
  const position = await rentPosition(document, now);
  for (const payment of position.payments) {
    await notifyOnce(to.tenantUser, { ...base, type: 'rent_payment_confirmed', title: 'Paiement de loyer confirmé', body: `${payment.amountMinor} FCFA pris en compte pour ${cal.period}.`, dedupeKey: `rent-payment:${payment.allocation}` });
  }
  if (position.balanceMinor === 0 && position.rentMinor > 0) {
    await notifyOnce(to.tenantUser, { ...base, type: 'rent_debt_settled', title: `Loyer ${cal.period} soldé`, body: 'Aucun montant restant dû sur cette échéance.', dedupeKey: `rent-settled:${document._id}` });
    await notifyOnce(to.owner, { ...base, type: 'rent_debt_settled', title: `Loyer ${cal.period} soldé`, body: 'Échéance entièrement réglée.', dedupeKey: `rent-settled-owner:${document._id}` });
  } else if (cal.dueDate && new Date(now) >= cal.billingDate && new Date(now) <= cal.dueDate) {
    await notifyOnce(to.tenantUser, { ...base, type: 'rent_due_soon', title: 'Échéance de loyer proche', body: `Reste à régler : ${position.balanceMinor} FCFA${dueText}.`, dedupeKey: `rent-due-soon:${document._id}` });
  }
  const penalty = await assessLatePenalty(document, ctx, now, pc);
  const collectionCase = await evaluateCollectionCase(document, ctx, now, pc);
  return { penalty, collectionCase, policyStatus: pc.resolution.status };
}

async function runRentCollectionCycle({ now = new Date() } = {}) {
  const engine = activePenaltyEngine();
  if (engine !== ENGINES.CANONICAL) {
    console.log(`⚠️ [Recouvrement] moteur canonique inactif (moteur : ${engine}) — aucun traitement`);
    return { checked: 0, penalties: 0, cases: 0, errors: 0, skipped: true, engine };
  }
  const documents = await FinancialDocument.find({ ...DUE_FILTER, dueDate: { $lt: new Date(now.getTime() + 40 * calendar.DAY) } }).sort({ createdAt: 1 }).lean();
  const result = { checked: documents.length, penalties: 0, cases: 0, policyUnresolved: 0, errors: 0, engine };
  for (const document of documents) {
    try {
      if (!document.metadata?.period) continue;
      const { penalty, collectionCase, policyStatus } = await processRentDocument(document, now);
      if (policyStatus !== 'RESOLVED') result.policyUnresolved += 1;
      if (penalty) result.penalties += 1;
      if (collectionCase) result.cases += 1;
    } catch (error) {
      result.errors += 1;
      console.error(`❌ [Recouvrement] échéance ${document._id} : ${error.message}`);
    }
  }
  console.log(`✅ [Recouvrement] ${result.checked} échéance(s), ${result.penalties} pénalité(s) évaluée(s), ${result.cases} dossier(s), ${result.errors} erreur(s)`);
  return result;
}

// ─── Locataire ────────────────────────────────────────────────────────

async function tenantLeaseIds(userId) {
  const locataire = await resolveLocataireForUser(userId);
  if (!locataire) fail('FINANCIAL_RESOURCE_OUT_OF_SCOPE', 'Aucun dossier locataire rattaché à ce compte.', 404);
  const leases = await Contrat.find({ locataire: locataire._id, type: 'location' }).select('_id').lean();
  return { locataire, leaseIds: leases.map((lease) => lease._id) };
}

async function tenantRentDues({ userId, now = new Date() }) {
  const { locataire, leaseIds } = await tenantLeaseIds(userId);
  const documents = await FinancialDocument.find({ ...DUE_FILTER, subjectType: 'Contrat', subjectId: { $in: leaseIds } }).sort({ createdAt: -1 }).limit(36).lean();
  const items = [];
  for (const document of documents) {
    const { resolution, terms, pcal: cal } = await policyContext(document);
    const position = await rentPosition(document, now);
    const penalty = await Penalty.findOne({ rentDocument: document._id }).lean();
    const report = await Report.findOne({ rentDocument: document._id, locataire: locataire._id }).lean();
    const directReceipts = await DirectRentReceipt.find({ document: document._id, locataire: locataire._id }).sort({ createdAt: 1 }).lean();
    items.push({
      directReceipts: directReceipts.map((r) => ({ id: r._id, amountMinor: r.amountMinor, receivedAt: r.receivedAt, status: r.status, canRespond: ['DECLARED', 'EVIDENCE_SUBMITTED', 'UNDER_REVIEW'].includes(r.status) })),
      id: document._id, period: cal.period, documentNumber: document.documentNumber, lease: document.subjectId, trackingObligation: Boolean(document.metadata?.trackingObligation),
      billingDate: cal.billingDate, dueDate: cal.dueDate, lateFrom: cal.lateFrom, formalNoticeDate: cal.formalNoticeDate,
      policy: { status: resolution.status, type: resolution.policy?.type || null, version: resolution.policy?.version || null, id: resolution.policy?._id || null, hasPenalty: Boolean(terms?.penalty), hasFormalNotice: Boolean(terms?.formalNotice) },
      rentMinor: position.rentMinor, chargesMinor: position.chargesMinor, totalMinor: document.totalMinor, paidMinor: position.paidMinor, balanceMinor: position.balanceMinor,
      declaredPendingMinor: position.declaredPendingMinor, contestedMinor: position.contestedMinor,
      penalty: penalty && ['SIMULATED', 'PENDING_RECEIPT_CONFIRMATION'].includes(penalty.status) ? { penaltyMinor: penalty.penaltyMinor, baseMinor: penalty.baseMinor, status: penalty.status, enforceable: false, corrected: (penalty.corrections || []).length > 0 } : null,
      payments: position.payments.map(({ amountMinor, confirmedAt }) => ({ amountMinor, confirmedAt })),
      difficultyReport: report ? { id: report._id, status: report.status, declaredAt: report.declaredAt, admissibleForSuspension: report.admissibleForSuspension, proposedPaymentDate: report.proposedPaymentDate, approvedPaymentDate: report.approvedPaymentDate } : null,
      canReportDifficulty: !report && position.balanceMinor > 0,
    });
  }
  return { items };
}

// Signalement : date serveur uniquement ; échéance du locataire ; non soldée.
async function reportPaymentDifficulty({ userId, documentId, reason = null, proposedPaymentDate = null, now = new Date() }) {
  const { locataire, leaseIds } = await tenantLeaseIds(userId);
  const document = mongoose.isValidObjectId(documentId) ? await FinancialDocument.findOne({ _id: documentId, ...DUE_FILTER }).lean() : null;
  if (!document || document.subjectType !== 'Contrat' || !leaseIds.some((id) => String(id) === String(document.subjectId))) fail('FINANCIAL_RESOURCE_OUT_OF_SCOPE', 'Échéance inaccessible.', 404);
  const position = await rentPosition(document, now);
  if (position.balanceMinor === 0) fail('RENT_ALREADY_SETTLED', 'Cette échéance est déjà soldée.', 409);
  let proposed = null;
  if (proposedPaymentDate) {
    proposed = new Date(proposedPaymentDate);
    if (Number.isNaN(proposed.getTime())) fail('RENT_DIFFICULTY_INVALID_DATE', 'Date de règlement proposée invalide.', 422);
  }
  const { terms, pcal: cal } = await policyContext(document);
  const declaredAt = new Date(now);
  const suspends = Boolean(cal.formalNoticeDate && terms?.formalNotice?.suspendOnDifficultyReport);
  const beforeDeadline = suspends && declaredAt < cal.formalNoticeDate;
  const ctx = await contextOf(document);
  let report;
  try {
    report = await Report.create({
      rentDocument: document._id, lease: document.subjectId, property: document.establishmentId, owner: ctx.owner, locataire: locataire._id, reportedBy: userId,
      tenant: document.tenant || null, scope: document.metadata.scope, period: cal.period, declaredAt, formalNoticeDate: cal.formalNoticeDate,
      reason: reason ? String(reason).slice(0, 1000) : null, proposedPaymentDate: proposed,
      admissibleForSuspension: beforeDeadline, admissibilityBasis: !suspends ? 'NOT_APPLICABLE' : (beforeDeadline ? 'DECLARED_BEFORE_25' : 'LATE_DECLARATION'),
      history: [{ action: 'submitted', actor: userId, at: declaredAt }],
    });
  } catch (error) {
    if (error?.code === 11000) fail('RENT_DIFFICULTY_ALREADY_REPORTED', 'Une difficulté a déjà été signalée pour cette échéance.', 409);
    throw error;
  }
  const to = audiences(document, ctx);
  const base = { platformTenantId: to.platformTenantId, entityId: document._id, data: { rentDocumentId: document._id, difficultyReportId: report._id, period: cal.period } };
  await notifyOnce(userId, { ...base, type: 'rent_difficulty_received', title: 'Signalement enregistré', body: `Votre signalement pour ${cal.period} a été transmis. La dette reste due.`, dedupeKey: `rent-difficulty:${report._id}` });
  await notifyOnce(to.manager, { ...base, type: 'rent_difficulty_to_review', title: 'Signalement d’impayé à examiner', body: `${cal.period} : reste dû ${position.balanceMinor} FCFA.`, dedupeKey: `rent-difficulty-manager:${report._id}` });
  await notifyOnce(to.owner, { ...base, type: 'rent_difficulty_to_review', title: 'Difficulté de paiement signalée', body: `${cal.period} : votre locataire a signalé une difficulté.`, dedupeKey: `rent-difficulty-owner:${report._id}` });
  return report.toObject();
}

// ─── Gestionnaire et propriétaire ─────────────────────────────────────

function scopeFilter(authority) {
  return authority.plane === 'TENANT'
    ? { 'scope.mandataryType': 'TENANT', 'scope.tenant': oid(authority.tenantId) }
    : { 'scope.mandataryType': 'PLATFORM' };
}

async function collectionOverview({ actor, now = new Date() }) {
  const authority = await authz.assertContractualCapability(actor, CAP.CONTRACT_READ);
  const scope = scopeFilter(authority);
  const docScope = Object.fromEntries(Object.entries(scope).map(([key, value]) => [`metadata.${key}`, value]));
  const overdueDocs = await FinancialDocument.find({ ...RENT_FILTER, ...docScope, status: 'issued', balanceMinor: { $gt: 0 }, dueDate: { $lt: new Date(now) } }).sort({ dueDate: 1 }).limit(200).lean();
  const [reports, cases, penalties] = await Promise.all([
    Report.find(scope).sort({ createdAt: -1 }).limit(200).lean(),
    CollectionCase.find(scope).sort({ createdAt: -1 }).limit(200).lean(),
    Penalty.find(scope).sort({ createdAt: -1 }).limit(200).lean(),
  ]);
  return {
    plane: authority.plane,
    overdue: overdueDocs.map((doc) => ({ id: doc._id, period: doc.metadata.period, documentNumber: doc.documentNumber, customer: doc.customer?.name || null, balanceMinor: doc.balanceMinor, dueDate: doc.dueDate })),
    reportsToReview: reports.filter((report) => report.status === 'submitted').map(publicReport),
    reports: reports.map(publicReport),
    cases: cases.map(publicCase),
    penalties: penalties.map(publicPenalty),
    summary: {
      overdueCount: overdueDocs.length, overdueMinor: overdueDocs.reduce((sum, doc) => sum + doc.balanceMinor, 0),
      reportsToReview: reports.filter((report) => report.status === 'submitted').length,
      noticeDrafts: cases.filter((c) => c.status === 'notice_draft_prepared').length, suspended: cases.filter((c) => c.status === 'notice_suspended').length,
      penaltiesEstimatedMinor: penalties.filter((p) => p.status === 'SIMULATED').reduce((sum, p) => sum + p.penaltyMinor, 0),
    },
  };
}

const publicReport = (r) => ({ id: r._id, period: r.period, status: r.status, declaredAt: r.declaredAt, reason: r.reason, proposedPaymentDate: r.proposedPaymentDate, approvedPaymentDate: r.approvedPaymentDate, admissibleForSuspension: r.admissibleForSuspension, admissibilityBasis: r.admissibilityBasis, rentDocument: r.rentDocument, history: r.history });
const publicCase = (c) => ({ id: c._id, reference: c.reference, period: c.period, status: c.status, evaluation: c.evaluation, suspension: c.suspension, block: c.block, policy: c.policy, noticeDraft: c.noticeDraft ? { preparedAt: c.noticeDraft.preparedAt, legalValidation: c.noticeDraft.legalValidation, sent: c.noticeDraft.sent, sendable: c.noticeDraft.sendable } : null, rentDocument: c.rentDocument, history: c.history });
const publicPenalty = (p) => ({ id: p._id, period: p.period, baseMinor: p.baseMinor, penaltyMinor: p.penaltyMinor, status: p.status, legalStatus: p.legalBasis?.status, rentDocument: p.rentDocument, engine: p.engine, legacyPenaltyMinor: p.legacyPenalty?.penaliteMontant ?? null, corrections: p.corrections || [], penaltyRangeMinor: p.penaltyRangeMinor, rateBasisPoints: p.rateBasisPoints, policy: p.policy });

// Propriétaire (relation directe, sans organisation requise) : lecture seule.
async function ownerCollection({ actor, now = new Date() }) {
  const userId = idOf(actor);
  if (!userId) fail('FINANCIAL_UNAUTHORIZED', 'Authentification requise.', 401);
  const owner = oid(userId);
  const overdueDocs = await FinancialDocument.find({ ...DUE_FILTER, 'metadata.parties.economicBeneficiary.userId': owner, balanceMinor: { $gt: 0 }, dueDate: { $lt: new Date(now) } }).lean();
  const partial = await FinancialDocument.countDocuments({ ...DUE_FILTER, 'metadata.parties.economicBeneficiary.userId': owner, balanceMinor: { $gt: 0 }, amountAllocatedMinor: { $gt: 0 } });
  const trackingDues = await FinancialDocument.find({ ...RENT_FILTER, status: 'draft', 'metadata.trackingObligation': true, 'metadata.ownerScope': owner }).sort({ createdAt: -1 }).limit(60).lean();
  const [reports, cases, penalties, directReceipts] = await Promise.all([Report.find({ owner }).sort({ createdAt: -1 }).lean(), CollectionCase.find({ owner }).sort({ createdAt: -1 }).lean(), Penalty.find({ owner }).sort({ createdAt: -1 }).lean(), DirectRentReceipt.find({ owner }).sort({ createdAt: -1 }).limit(200).lean()]);
  return {
    summary: {
      overdueCount: overdueDocs.length, overdueMinor: overdueDocs.reduce((sum, doc) => sum + doc.balanceMinor, 0), partialCount: partial,
      penaltiesEstimatedMinor: penalties.filter((p) => p.status === 'SIMULATED').reduce((sum, p) => sum + p.penaltyMinor, 0), reports: reports.length, cases: cases.length,
    },
    reports: reports.map(publicReport), cases: cases.map(publicCase), penalties: penalties.map(publicPenalty),
    directReceipts: directReceipts.map((r) => ({ id: r._id, document: r.document, amountMinor: r.amountMinor, receivedAt: r.receivedAt, status: r.status, evidenceCount: (r.evidence || []).length, confirmationBasis: r.confirmation?.basis || null })),
    trackingDues: trackingDues.map((doc) => ({ id: doc._id, period: doc.metadata.period, lease: doc.subjectId, totalMinor: doc.totalMinor, balanceMinor: doc.balanceMinor, dueDate: doc.dueDate, legalInvoice: false })),
  };
}

// Décisions sur un signalement : gestionnaire habilité du périmètre (jamais
// le locataire). Aucune décision n'efface la dette ni la pénalité.
async function decideDifficultyReport({ actor, reportId, decision, reason = null, approvedPaymentDate = null, now = new Date() }) {
  const report = mongoose.isValidObjectId(reportId) ? await Report.findById(reportId).lean() : null;
  if (!report) fail('FINANCIAL_RESOURCE_OUT_OF_SCOPE', 'Signalement inaccessible.', 404);
  const authority = await authorizeCollectionActor(actor, report, CAP.BILLING_MANAGE);
  const actorId = authority.userId;
  const text = String(reason || '').trim();
  let filter; let set;
  if (decision === 'acknowledge') { filter = { status: 'submitted' }; set = { status: 'acknowledged' }; }
  else if (decision === 'grant_exception') {
    if (!text) fail('RENT_DECISION_REASON_REQUIRED', 'Motif obligatoire pour une exception.', 422);
    filter = { admissibleForSuspension: false, status: { $ne: 'closed' } }; set = { admissibleForSuspension: true, admissibilityBasis: 'MANAGER_EXCEPTION' };
  } else if (decision === 'approve_deferral') {
    const date = approvedPaymentDate ? new Date(approvedPaymentDate) : null;
    if (!date || Number.isNaN(date.getTime())) fail('RENT_DIFFICULTY_INVALID_DATE', 'Date de report requise.', 422);
    filter = { status: { $in: ['submitted', 'acknowledged'] } }; set = { status: 'deferral_approved', approvedPaymentDate: date };
  } else if (decision === 'close') {
    if (!text) fail('RENT_DECISION_REASON_REQUIRED', 'Motif obligatoire.', 422);
    filter = { status: { $ne: 'closed' } }; set = { status: 'closed' };
  } else fail('BILLING_DECISION_INVALID', 'Décision invalide.', 422);
  const updated = await Report.findOneAndUpdate({ _id: report._id, ...filter }, { $set: set, $push: { history: { action: decision, actor: actorId, at: new Date(now), reason: text || null } } }, { new: true }).lean();
  if (!updated) fail('RENT_DIFFICULTY_INVALID_TRANSITION', 'Décision impossible dans l’état actuel du signalement.', 409);
  // Projet de mise en demeure jamais envoyé : une exception le suspend.
  if (decision === 'grant_exception' || decision === 'approve_deferral') {
    const why = decision === 'grant_exception' ? `Exception accordée par le gestionnaire : ${text}` : `Report de paiement approuvé jusqu’au ${set.approvedPaymentDate.toISOString().slice(0, 10)}`;
    await CollectionCase.updateOne(
      { rentDocument: report.rentDocument, status: 'notice_draft_prepared', 'noticeDraft.sent': false },
      { $set: { status: 'notice_suspended', suspension: { reason: why, report: report._id, at: new Date(now) } }, $push: { history: { action: 'notice_suspended', actor: actorId, at: new Date(now), reason: why } } },
    );
  }
  return publicReport(updated);
}

module.exports = {
  DUE_FILTER, rentPosition, policyContext, assessLatePenalty, assertPenaltyEnforceable, evaluateCollectionCase, sendFormalNotice, processRentDocument, runRentCollectionCycle,
  tenantRentDues, reportPaymentDifficulty, collectionOverview, ownerCollection, decideDifficultyReport,
};
