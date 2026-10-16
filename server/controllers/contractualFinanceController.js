// F-U1.G — Surface HTTP v1 de la finance contractuelle.
//
// N'expose que les opérations dont l'autorisation est entièrement déterminée
// (capacités dérivées non sensibles + autorité propriétaire fondée sur la
// ressource). Les opérations sensibles (octrois, vérifications,
// rapprochements, approbations, remboursements, politiques, identité légale)
// et toute exécution de fonds restent au niveau service, NON routées.
//
// L'acteur est reconstruit depuis l'identité authentifiée et le contexte
// tenant résolu par le middleware ; aucun champ d'autorité du body/query
// (tenant, rôle, capacités, propriétaire) n'est lu. Les corps sont filtrés
// par liste blanche.

const { fail } = require('../services/finance/financialError');
const mandates = require('../services/finance/contractual/managementMandateService');
const expenses = require('../services/finance/contractual/mandateExpenseService');
const funds = require('../services/finance/contractual/ownerFundsService');
const beneficiaries = require('../services/finance/contractual/financialBeneficiaryService');
const owners = require('../services/finance/contractual/ownerAuthorityService');
const { getMandateForRead } = require('../services/finance/contractual/mandateReadService');

const actorOf = (req) => ({
  _id: req.user?._id,
  role: req.user?.role,
  platformTenant: req.platformTenant || null,
  tenantContextSource: req.tenantContextSource || null,
});
const pick = (body, keys) => Object.fromEntries(keys.filter((key) => body?.[key] !== undefined).map((key) => [key, body[key]]));
const idempotencyKey = (req) => {
  const key = String(req.headers['idempotency-key'] || '').trim();
  if (!key) fail('FINANCIAL_IDEMPOTENCY_KEY_REQUIRED', 'En-tête Idempotency-Key obligatoire.', 422);
  return key;
};
const handle = (fn, status = 200) => async (req, res, next) => {
  try {
    res.status(status).json({ status: 'success', data: await fn(req) });
  } catch (error) {
    next(error);
  }
};

const publicMandate = (mandate, version) => ({
  id: mandate._id, mandataryType: mandate.mandataryType, tenant: mandate.tenant, owner: mandate.owner, property: mandate.property,
  reference: mandate.reference, status: mandate.status, currentVersionNumber: mandate.currentVersionNumber,
  effectiveStatus: version ? mandates.effectiveMandateStatus(mandate, version) : mandate.status,
  terms: version?.terms || null, termsHash: version?.termsHash || null,
});
const publicBeneficiary = (b) => ({ id: b._id, owner: b.owner, kind: b.kind, holderName: b.holderName, institution: b.institution, maskedIdentifier: b.maskedIdentifier, status: b.status });

const TERMS_KEYS = ['offer', 'currency', 'effectiveFrom', 'effectiveTo', 'legalReference', 'commission', 'collectionMode', 'payoutFrequency', 'payoutBeneficiary', 'ownerDirectAccount', 'feeRules', 'expenseCaps', 'subscriptionReference'];

exports.getMandate = handle(async (req) => {
  const { mandate, version, viewer } = await getMandateForRead({ actor: actorOf(req), mandateId: req.params.mandateId });
  return { ...publicMandate(mandate, version), viewer };
});

exports.createMandate = handle(async (req) => {
  const body = pick(req.body, ['propertyId', 'ownerId', 'reference', 'rentalManagementId', 'terms']);
  const { mandate, version, replayed } = await mandates.createMandate({
    actor: actorOf(req), ...body, terms: pick(body.terms || {}, TERMS_KEYS), idempotencyKey: idempotencyKey(req),
  });
  return { mandate: publicMandate(mandate, version), replayed };
}, 201);

exports.amendMandate = handle(async (req) => {
  const { mandate, version } = await mandates.amendMandate({ actor: actorOf(req), mandateId: req.params.mandateId, terms: pick(req.body?.terms || {}, TERMS_KEYS), reason: req.body?.reason });
  return publicMandate(mandate, version);
}, 201);

const transition = (fn) => handle(async (req) => publicMandate(await fn({ actor: actorOf(req), mandateId: req.params.mandateId, reason: req.body?.reason })));
exports.activateMandate = transition(mandates.activateMandate);
exports.suspendMandate = transition(mandates.suspendMandate);
exports.revokeMandate = transition(mandates.revokeMandate);

exports.listExpenses = handle((req) => expenses.listExpensesForMandate({ actor: actorOf(req), mandateId: req.params.mandateId }));

exports.requestExpense = handle(async (req) => expenses.requestExpense({
  actor: actorOf(req), mandateId: req.params.mandateId,
  ...pick(req.body, ['interventionId', 'category', 'description', 'amountMinor']), idempotencyKey: idempotencyKey(req),
}), 201);

exports.ownerExpenseDecision = handle((req) => expenses.decideExpenseInApp({
  actor: actorOf(req), expenseId: req.params.expenseId, ...pick(req.body, ['decision', 'maxAmountMinor', 'comment']),
}));

exports.justifyExpense = handle((req) => expenses.justifyExpense({
  actor: actorOf(req), expenseId: req.params.expenseId, ...pick(req.body, ['actualAmountMinor', 'evidence']),
}));

exports.cancelExpense = handle((req) => expenses.cancelExpense({ actor: actorOf(req), expenseId: req.params.expenseId, reason: req.body?.reason }));

exports.declareOwnerDirect = handle((req) => funds.declareOwnerDirectCollection({
  actor: actorOf(req), mandateId: req.params.mandateId,
  ...pick(req.body, ['amountMinor', 'paidAt', 'rentPeriod', 'paymentMethod', 'reference', 'evidence']), idempotencyKey: idempotencyKey(req),
}), 201);

exports.ownerConfirmCollection = handle((req) => funds.confirmOwnerDirectByOwner({ actor: actorOf(req), collectionId: req.params.collectionId }));

exports.listObligations = handle((req) => funds.listObligations({ actor: actorOf(req), mandateId: req.params.mandateId }));

exports.registerBeneficiary = handle(async (req) => publicBeneficiary(await beneficiaries.registerBeneficiary({
  actor: actorOf(req), ...pick(req.body, ['ownerId', 'kind', 'holderName', 'institution', 'accountIdentifier', 'evidence']),
})), 201);

exports.registerOwnBeneficiary = handle(async (req) => publicBeneficiary(await beneficiaries.registerOwnBeneficiary({
  actor: actorOf(req), mandateId: req.params.mandateId, ...pick(req.body, ['kind', 'holderName', 'institution', 'accountIdentifier', 'evidence']),
})), 201);

exports.designateRepresentative = handle((req) => owners.designateRepresentative({
  actor: actorOf(req), ...pick(req.body, ['representativeUserId', 'mandateIds', 'powers', 'validUntil']),
}), 201);

exports.revokeRepresentation = handle((req) => owners.revokeRepresentation({ actor: actorOf(req), representationId: req.params.representationId, reason: req.body?.reason }));

// ─── F-U1.H — gouvernance des habilitations ───────────────────────────
const grantGovernance = require('../services/finance/contractual/contractualFinanceGrantService');
const refunds = require('../services/finance/contractual/refundGovernanceService');
const issuers = require('../services/finance/contractual/financialIssuerIdentityService');

const publicGrant = (g) => ({
  id: g._id, user: g.user, scopeType: g.scopeType, tenant: g.tenant, capability: g.capability, status: g.status,
  justification: g.justification, decisionReference: g.decisionReference, validFrom: g.validFrom, validUntil: g.validUntil,
  proposedBy: g.proposedBy, approvedBy: g.approvedBy, suspendedBy: g.suspendedBy, revokedBy: g.revokedBy, history: g.history,
});

exports.listGrants = handle(async (req) => (await grantGovernance.listGrants({ actor: actorOf(req) })).map(publicGrant));
exports.proposeGrant = handle(async (req) => {
  const { grant, replayed } = await grantGovernance.proposeGrant({
    actor: actorOf(req), ...pick(req.body, ['scopeType', 'userId', 'capability', 'justification', 'validUntil', 'decisionReference']),
    idempotencyKey: idempotencyKey(req),
  });
  return { grant: publicGrant(grant), replayed };
}, 201);
exports.approveGrant = handle(async (req) => {
  const { grant, independence } = await grantGovernance.approveGrant({ actor: actorOf(req), grantId: req.params.grantId });
  return { grant: publicGrant(grant), independenceEstablished: independence.established };
});
exports.reevaluateGrantIndependence = handle(async (req) => {
  const { grant, independence } = await grantGovernance.reevaluateIndependence({ actor: actorOf(req), grantId: req.params.grantId });
  return { grant: publicGrant(grant), independenceEstablished: independence.established };
});
const grantAction = (fn) => handle(async (req) => publicGrant(await fn({ actor: actorOf(req), grantId: req.params.grantId, reason: req.body?.reason })));
exports.refuseGrant = grantAction(grantGovernance.refuseGrant);
exports.suspendGrant = grantAction(grantGovernance.suspendGrant);
exports.reinstateGrant = grantAction(grantGovernance.reinstateGrant);
exports.revokeGrant = grantAction(grantGovernance.revokeGrant);

// ─── F-U1.H — opérations sensibles devenues admissibles ───────────────
exports.submitWrittenAuthorization = handle((req) => expenses.submitWrittenAuthorization({
  actor: actorOf(req), expenseId: req.params.expenseId, ...pick(req.body, ['decision', 'document', 'scope', 'maxAmountMinor', 'comment']),
}), 201);
exports.authenticateWrittenAuthorization = handle((req) => expenses.authenticateWrittenAuthorization({
  actor: actorOf(req), submissionId: req.params.submissionId, verification: pick(req.body?.verification || {}, ['result', 'method', 'notes']),
}));
exports.registerWrittenProxy = handle((req) => owners.registerWrittenProxy({
  actor: actorOf(req), ...pick(req.body, ['ownerId', 'representativeUserId', 'mandateIds', 'powers', 'validUntil', 'document']),
}), 201);
exports.verifyWrittenProxy = handle((req) => owners.verifyWrittenProxy({ actor: actorOf(req), representationId: req.params.representationId, method: req.body?.method }));
exports.verifyBeneficiary = handle(async (req) => publicBeneficiary(await beneficiaries.verifyBeneficiary({
  actor: actorOf(req), beneficiaryId: req.params.beneficiaryId, ...pick(req.body, ['method', 'evidence']),
})));
exports.reconcileCollection = handle((req) => funds.reconcileOwnerDirectCollection({
  actor: actorOf(req), collectionId: req.params.collectionId,
  ...pick(req.body, ['decision', 'evidence', 'providerReference', 'verifiedAmountMinor', 'verifiedPaidAt', 'notes', 'verifiedRentAmountMinor']),
}));
exports.recognizeAgencyCollection = handle((req) => funds.recognizeAgencyCollection({
  actor: actorOf(req), mandateId: req.params.mandateId, ...pick(req.body, ['financialPaymentId', 'rentPeriod', 'leaseId']),
}), 201);
exports.prepareRefund = handle((req) => refunds.requestGovernedRefund({
  actor: actorOf(req), ...pick(req.body, ['financialPaymentId', 'amountMinor', 'activity', 'reasonCode', 'reason', 'beneficiary', 'declaredSignals']),
  idempotencyKey: idempotencyKey(req),
}), 201);
exports.getRefund = handle((req) => refunds.getGovernedRefund({ actor: actorOf(req), refundId: req.params.refundId }));
// Politique non exécutoire : jamais de seuil via HTTP (aucun seuil validé),
// la politique reste `unconfigured` ; l'activation n'est pas routée.
exports.draftRefundPolicy = handle((req) => {
  if (req.body?.standardApprovalMaxMinor != null) fail('REFUND_POLICY_THRESHOLD_NOT_VALIDATED', 'Aucun seuil validé : la saisie d’un seuil n’est pas ouverte.', 422);
  return refunds.draftRefundPolicy({ actor: actorOf(req), ...pick(req.body, ['activity', 'currency', 'additionalDualApprovalSignals', 'ownerConsentRequired', 'decisionReference']) });
}, 201);
exports.registerIssuerIdentity = handle((req) => issuers.registerIssuerIdentity({
  actor: actorOf(req), ...pick(req.body, ['legalName', 'rccm', 'niu', 'phone', 'address', 'source']),
}), 201);
exports.verifyIssuerIdentity = handle((req) => issuers.verifyIssuerIdentity({ actor: actorOf(req), identityId: req.params.identityId, evidenceRef: req.body?.evidenceRef }));
