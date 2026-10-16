// F-U1.H — Gouvernance des habilitations financières sensibles.
//
// Deux niveaux, jamais croisés :
//   - TENANT  : gouverneur = membre Admin actif du tenant, porteur d'une
//     habilitation TENANT `contractual.grants.govern` utilisable, agissant en
//     contexte TENANT (PATH A uniquement : un opérateur sélectionnant le tenant
//     n'en gouverne pas les habilitations). Portée limitée à ce tenant.
//   - PLATFORM : gouverneur = opérateur actif `platform.operators.manage`,
//     porteur d'une habilitation PLATFORM `contractual.grants.govern`,
//     agissant en vue plateforme. `platform.finance.manage` ne suffit jamais.
// Le périmètre d'une habilitation est TOUJOURS celui du contexte de l'acteur :
// un tenant ne peut pas créer d'habilitation PLATFORM, ni agir sur celles d'un
// autre tenant ; `tenant: null` n'est jamais assimilé à PLATFORM.
//
// Double contrôle : proposition puis approbation par un second gouverneur ;
// bénéficiaire, proposant et approbateur sont trois personnes distinctes
// (compte, téléphone, identité attestée). Si leur indépendance n'est pas
// prouvée par attestation, l'habilitation reste `pending_independence`.
// Révocation, suspension et renonciation : immédiates et unilatérales.

const mongoose = require('mongoose');
const ContractualFinanceGrant = require('../../../models/ContractualFinanceGrant');
const ContractualGrantBootstrap = require('../../../models/ContractualGrantBootstrap');
const HumanIdentityAttestation = require('../../../models/HumanIdentityAttestation');
const C = require('../../../constants/contractualFinanceConstants');
const { fail } = require('../financialError');
const { resolveTenantMembership } = require('../../tenantMembershipService');
const { resolveActiveOperator } = require('../../platformOperator/platformOperatorService');
const { deriveAdministrationScope, ADMINISTRATION_SCOPE_MODE } = require('../../administrationScopeService');
const { runFinancialOperation } = require('../financialTransactionService');
const {
  CONTRACTUAL_CAPABILITIES: CAP, SENSITIVE_ELIGIBILITY, isEligible, findUsableGrant, activeMembership, idOf,
} = require('./contractualFinanceAuthorizationService');
const { assertDistinctHumans, assessIndependence, computeIdentityFingerprint } = require('./humanIdentityService');

const S = C.GRANT_STATUSES;
const notFound = () => fail('FINANCIAL_RESOURCE_OUT_OF_SCOPE', 'Habilitation inaccessible.', 404);

// ─── Contexte et gouverneur ───────────────────────────────────────────

function actorScope(actor) {
  const scope = deriveAdministrationScope(actor);
  if (scope.mode === ADMINISTRATION_SCOPE_MODE.TENANT) return { scopeType: C.GRANT_SCOPE_TYPES.TENANT, tenantId: scope.tenantId };
  if (scope.mode === ADMINISTRATION_SCOPE_MODE.PLATFORM) return { scopeType: C.GRANT_SCOPE_TYPES.PLATFORM, tenantId: null };
  return fail('ADMINISTRATION_SCOPE_REQUIRED', 'Contexte d’administration non résolu.', 403);
}

async function resolveGovernor(actor, { now = new Date() } = {}) {
  const actorId = idOf(actor);
  if (!actorId) fail('FINANCIAL_UNAUTHORIZED', 'Authentification requise.', 401);
  const scope = actorScope(actor);
  const grant = await findUsableGrant({ userId: actorId, capability: CAP.GRANTS_GOVERN, scopeType: scope.scopeType, tenantId: scope.tenantId, now });
  if (!grant) fail('FINANCIAL_UNAUTHORIZED', 'Habilitation de gouvernance requise dans ce périmètre.', 403);
  return { ...scope, actorId };
}

async function assertBeneficiaryEligible({ userId, capability, scopeType, tenantId }) {
  if (scopeType === C.GRANT_SCOPE_TYPES.TENANT) {
    const membership = await resolveTenantMembership(userId, tenantId);
    if (!isEligible({ capability, scopeType, membership: activeMembership(membership) ? membership : null })) {
      fail('GRANT_GRANTEE_NOT_ELIGIBLE', 'Le bénéficiaire n’a pas de membership active d’un rôle éligible dans ce tenant.', 422);
    }
    return;
  }
  if (!isEligible({ capability, scopeType, operator: await resolveActiveOperator(userId) })) {
    fail('GRANT_GRANTEE_NOT_ELIGIBLE', 'Le bénéficiaire n’est pas un opérateur actif éligible.', 422);
  }
}

const scopeFilter = (governor) => ({ scopeType: governor.scopeType, tenant: governor.scopeType === C.GRANT_SCOPE_TYPES.TENANT ? governor.tenantId : null });

async function loadGrantInScope(grantId, governor) {
  const grant = mongoose.isValidObjectId(grantId) ? await ContractualFinanceGrant.findOne({ _id: grantId, ...scopeFilter(governor) }) : null;
  if (!grant) notFound();
  return grant;
}

async function transition({ grant, from, to, action, actor, reason, set = {}, session = null }) {
  const updated = await ContractualFinanceGrant.findOneAndUpdate(
    { _id: grant._id, status: { $in: from } },
    { $set: { status: to, ...set }, $push: { history: { action, from: grant.status, to, actor, reason, at: new Date() } } },
    { new: true, session },
  );
  if (!updated) fail('GRANT_INVALID_TRANSITION', `Transition interdite depuis « ${grant.status} » (ou modifiée simultanément).`, 409);
  return updated;
}

// ─── Cycle de vie ─────────────────────────────────────────────────────

async function proposeGrant({ actor, scopeType, userId, capability, justification, validUntil, decisionReference, idempotencyKey, now = new Date() }) {
  const governor = await resolveGovernor(actor, { now });
  if (scopeType && scopeType !== governor.scopeType) fail('GRANT_SCOPE_MISMATCH', 'Le périmètre demandé ne correspond pas au contexte d’administration.', 403);
  if (!SENSITIVE_ELIGIBILITY[capability]) fail('CONTRACTUAL_CAPABILITY_NOT_GRANTABLE', 'Capacité non octroyable.', 422);
  if (!mongoose.isValidObjectId(userId)) fail('GRANT_GRANTEE_NOT_ELIGIBLE', 'Bénéficiaire invalide.', 422);
  if (!String(justification || '').trim()) fail('GRANT_REASON_REQUIRED', 'Justification requise.', 422);
  if (!String(idempotencyKey || '').trim()) fail('FINANCIAL_IDEMPOTENCY_KEY_REQUIRED', 'Clé d’idempotence requise.', 422);
  const until = new Date(validUntil);
  if (Number.isNaN(until.getTime()) || until <= now) fail('GRANT_VALIDITY_REQUIRED', 'Une date de fin de validité future est requise.', 422);
  const existing = await ContractualFinanceGrant.findOne({ proposedBy: governor.actorId, proposalKey: String(idempotencyKey) });
  if (existing) {
    if (String(existing.user) !== String(userId) || existing.capability !== capability) fail('FINANCIAL_IDEMPOTENCY_CONFLICT', 'Clé d’idempotence déjà utilisée avec un autre contenu.', 409);
    return { grant: existing, replayed: true };
  }
  await assertDistinctHumans({ proposant: governor.actorId, bénéficiaire: userId });
  await assertBeneficiaryEligible({ userId, capability, scopeType: governor.scopeType, tenantId: governor.tenantId });
  try {
    const grant = await ContractualFinanceGrant.create({
      user: userId, ...scopeFilter(governor), capability, status: S.PROPOSED, justification: String(justification).trim(),
      decisionReference, validFrom: now, validUntil: until, proposedBy: governor.actorId, proposedAt: now, proposalKey: String(idempotencyKey),
      history: [{ action: 'propose', from: null, to: S.PROPOSED, actor: governor.actorId, reason: justification, at: now }],
    });
    return { grant, replayed: false };
  } catch (error) {
    if (error?.code === 11000) fail('GRANT_ALREADY_PENDING_OR_ACTIVE', 'Une habilitation identique est déjà proposée ou active.', 409);
    throw error;
  }
}

async function approveGrant({ actor, grantId, now = new Date() }) {
  const governor = await resolveGovernor(actor, { now });
  const grant = await loadGrantInScope(grantId, governor);
  if (grant.status !== S.PROPOSED) fail('GRANT_INVALID_TRANSITION', `Habilitation non approuvable (${grant.status}).`, 409);
  if (grant.validUntil <= now) fail('GRANT_EXPIRED', 'Proposition expirée.', 409);
  await assertDistinctHumans({ bénéficiaire: grant.user, proposant: grant.proposedBy, approbateur: governor.actorId });
  await assertBeneficiaryEligible({ userId: grant.user, capability: grant.capability, scopeType: grant.scopeType, tenantId: grant.tenant });
  const independence = await assessIndependence([grant.user, grant.proposedBy, governor.actorId]);
  const to = independence.established ? S.ACTIVE : S.PENDING_INDEPENDENCE;
  const updated = await transition({
    grant, from: [S.PROPOSED], to, action: 'approve', actor: governor.actorId,
    reason: independence.established ? null : `Indépendance non établie (comptes sans attestation : ${independence.unverified.length})`,
    set: { approvedBy: governor.actorId, approvedAt: now, ...(to === S.ACTIVE ? { activatedAt: now, identityBasis: independence.basis } : {}) },
  });
  return { grant: updated, independence };
}

// Réévalue une habilitation en attente : active seulement si l'indépendance
// des trois personnes est désormais prouvée et le bénéficiaire éligible.
async function reevaluateIndependence({ actor, grantId, now = new Date() }) {
  const governor = await resolveGovernor(actor, { now });
  const grant = await loadGrantInScope(grantId, governor);
  if (grant.status !== S.PENDING_INDEPENDENCE) fail('GRANT_INVALID_TRANSITION', 'Aucune vérification d’indépendance en attente.', 409);
  await assertDistinctHumans({ bénéficiaire: grant.user, proposant: grant.proposedBy, approbateur: grant.approvedBy });
  await assertBeneficiaryEligible({ userId: grant.user, capability: grant.capability, scopeType: grant.scopeType, tenantId: grant.tenant });
  const independence = await assessIndependence([grant.user, grant.proposedBy, grant.approvedBy]);
  if (!independence.established) return { grant, independence };
  return { grant: await transition({ grant, from: [S.PENDING_INDEPENDENCE], to: S.ACTIVE, action: 'independence_established', actor: governor.actorId, set: { activatedAt: now, identityBasis: independence.basis } }), independence };
}

async function refuseGrant({ actor, grantId, reason }) {
  const governor = await resolveGovernor(actor);
  const grant = await loadGrantInScope(grantId, governor);
  if (!String(reason || '').trim()) fail('GRANT_REASON_REQUIRED', 'Motif requis.', 422);
  if (String(grant.user) === governor.actorId) fail('FINANCIAL_SEGREGATION_OF_DUTIES', 'Le bénéficiaire ne décide pas de sa propre habilitation.', 403);
  const own = String(grant.proposedBy) === governor.actorId;
  return transition({
    grant, from: [S.PROPOSED, S.PENDING_INDEPENDENCE], to: own ? S.CANCELLED : S.REFUSED, action: own ? 'cancel' : 'refuse',
    actor: governor.actorId, reason, set: own ? {} : { refusedBy: governor.actorId, refusedAt: new Date() },
  });
}

// Suspension d'urgence : immédiate, par tout gouverneur du périmètre.
async function suspendGrant({ actor, grantId, reason }) {
  const governor = await resolveGovernor(actor);
  const grant = await loadGrantInScope(grantId, governor);
  if (!String(reason || '').trim()) fail('GRANT_REASON_REQUIRED', 'Motif requis.', 422);
  return transition({ grant, from: [S.ACTIVE, S.PENDING_INDEPENDENCE], to: S.SUSPENDED, action: 'suspend', actor: governor.actorId, reason, set: { suspendedBy: governor.actorId, suspendedAt: new Date() } });
}

// Levée de suspension : par un gouverneur distinct de l'auteur de la
// suspension et du bénéficiaire ; éligibilité et validité revérifiées.
async function reinstateGrant({ actor, grantId, reason, now = new Date() }) {
  const governor = await resolveGovernor(actor, { now });
  const grant = await loadGrantInScope(grantId, governor);
  if (!String(reason || '').trim()) fail('GRANT_REASON_REQUIRED', 'Motif requis.', 422);
  if (grant.status !== S.SUSPENDED) fail('GRANT_INVALID_TRANSITION', 'Habilitation non suspendue.', 409);
  if (grant.validUntil <= now) fail('GRANT_EXPIRED', 'Habilitation expirée.', 409);
  await assertDistinctHumans({ 'levée de suspension': governor.actorId, 'auteur de la suspension': grant.suspendedBy, bénéficiaire: grant.user }, { actor: 'levée de suspension' });
  await assertBeneficiaryEligible({ userId: grant.user, capability: grant.capability, scopeType: grant.scopeType, tenantId: grant.tenant });
  const independence = await assessIndependence([grant.user, grant.proposedBy, grant.approvedBy]);
  return transition({
    grant, from: [S.SUSPENDED], to: independence.established ? S.ACTIVE : S.PENDING_INDEPENDENCE, action: 'reinstate', actor: governor.actorId, reason,
    set: independence.established ? { identityBasis: independence.basis } : {},
  });
}

// Révocation : immédiate, par tout gouverneur du périmètre ou par le
// bénéficiaire lui-même (renonciation).
async function revokeGrant({ actor, grantId, reason }) {
  if (!String(reason || '').trim()) fail('GRANT_REASON_REQUIRED', 'Motif requis.', 422);
  const actorId = idOf(actor);
  const own = mongoose.isValidObjectId(grantId) ? await ContractualFinanceGrant.findOne({ _id: grantId, user: actorId }) : null;
  const grant = own || await loadGrantInScope(grantId, await resolveGovernor(actor));
  return transition({
    grant, from: C.LIVE_GRANT_STATUSES, to: S.REVOKED, action: own ? 'renounce' : 'revoke', actor: actorId, reason,
    set: { revokedBy: actorId, revokedAt: new Date() },
  });
}

// Tâche système : passage explicite en `expired` (l'usage est de toute façon
// refusé dès validUntil, sans attendre cette tâche).
async function expireDueGrants({ now = new Date() } = {}) {
  const result = await ContractualFinanceGrant.updateMany(
    { status: { $in: C.LIVE_GRANT_STATUSES }, validUntil: { $lte: now } },
    { $set: { status: S.EXPIRED }, $push: { history: { action: 'expire', to: S.EXPIRED, actor: null, at: now } } },
  );
  return { expired: result.modifiedCount };
}

async function listGrants({ actor }) {
  const actorId = idOf(actor);
  let governor = null;
  try { governor = await resolveGovernor(actor); } catch (error) { if (!['FINANCIAL_UNAUTHORIZED', 'ADMINISTRATION_SCOPE_REQUIRED'].includes(error.code)) throw error; }
  const filter = governor ? scopeFilter(governor) : { user: actorId };
  return ContractualFinanceGrant.find(filter).sort({ createdAt: -1 }).limit(200).lean();
}

// L'attestation d'identité n'est plus délivrée ici : F-U1.I la réserve aux
// agents Altitude Vision habilités, au terme d'un dossier KYC
// (financialKycService.approveCase).

// ─── Bootstrap contrôlé (hors API) ────────────────────────────────────

const BOOTSTRAP_DISABLED = () => fail('GRANT_BOOTSTRAP_DISABLED', 'Bootstrap des habilitations désactivé.', 403);

function assertBootstrapInput({ scopeType, tenantId, governorUserIds, decisionReference, validUntil, now }) {
  if (process.env.CONTRACTUAL_GRANT_BOOTSTRAP_ENABLED !== 'true') BOOTSTRAP_DISABLED();
  if (!Object.values(C.GRANT_SCOPE_TYPES).includes(scopeType)) fail('GRANT_SCOPE_MISMATCH', 'Périmètre invalide.', 422);
  if (scopeType === C.GRANT_SCOPE_TYPES.TENANT && !mongoose.isValidObjectId(tenantId)) fail('GRANT_SCOPE_MISMATCH', 'Tenant requis.', 422);
  if (scopeType === C.GRANT_SCOPE_TYPES.PLATFORM && tenantId) fail('GRANT_SCOPE_MISMATCH', 'Aucun tenant pour un périmètre PLATFORM.', 422);
  if (!String(decisionReference || '').trim()) fail('GRANT_REASON_REQUIRED', 'Référence de décision requise.', 422);
  const governors = [...new Set((governorUserIds || []).map(String))];
  if (governors.length < 2) fail('GRANT_BOOTSTRAP_TWO_GOVERNORS_REQUIRED', 'Au moins deux gouverneurs distincts sont requis.', 422);
  const until = new Date(validUntil);
  if (Number.isNaN(until.getTime()) || until <= now) fail('GRANT_VALIDITY_REQUIRED', 'Une date de fin de validité future est requise.', 422);
  return { governors, until };
}

async function createBootstrapGrants({ scopeType, tenant, governors, capabilities, authorizedByUserId, decisionReference, until, now, basis, session }) {
  const [record] = await ContractualGrantBootstrap.create([{ scopeType, tenant, authorizedBy: authorizedByUserId, decisionReference, governors, executedAt: now }], { session })
    .catch((error) => { if (error?.code === 11000) fail('GRANT_BOOTSTRAP_ALREADY_EXECUTED', 'Bootstrap déjà exécuté pour ce périmètre.', 409); throw error; });
  const docs = governors.flatMap((userId) => capabilities.map((capability) => ({
    user: userId, scopeType, tenant, capability, status: S.ACTIVE,
    justification: `Bootstrap — ${decisionReference}`, decisionReference, validFrom: now, validUntil: until,
    proposedBy: authorizedByUserId, proposedAt: now, proposalKey: `bootstrap:${record._id}:${userId}:${capability}`,
    approvedBy: authorizedByUserId, approvedAt: now, activatedAt: now, bootstrap: record._id, identityBasis: basis,
    history: [{ action: 'bootstrap', from: null, to: S.ACTIVE, actor: authorizedByUserId, reason: decisionReference, at: now }],
  })));
  const grants = await ContractualFinanceGrant.create(docs, { session, ordered: true });
  record.grants = grants.map((grant) => grant._id);
  await record.save({ session });
  return { bootstrap: record, grants };
}

// RACINE DE CONFIANCE (PLATFORM) — une seule fois. Établit hors ligne
// l'identité de l'opérateur autorisant et d'au moins deux opérateurs, puis
// leur accorde `grants.govern` et `kyc.attest`. Les pièces ont été vérifiées
// physiquement dans le cadre de la décision référencée ; seules leurs
// empreintes sont enregistrées. Personne ne s'attribue rien : l'autorisant
// ne reçoit aucune habilitation.
async function bootstrapPlatformRoot({ governors: governorInputs, authorizedBy, decisionReference, validUntil, now = new Date() }) {
  const ids = (governorInputs || []).map((item) => item?.userId);
  const { governors, until } = assertBootstrapInput({ scopeType: C.GRANT_SCOPE_TYPES.PLATFORM, governorUserIds: ids, decisionReference, validUntil, now });
  const authorizer = await resolveActiveOperator(authorizedBy?.userId);
  if (!authorizer?.capabilities?.includes('platform.operators.manage')) fail('FINANCIAL_UNAUTHORIZED', 'Autorisation par un opérateur platform.operators.manage requise.', 403);
  await assertDistinctHumans({ autorisant: authorizedBy.userId, gouverneur: governors });
  for (const item of governorInputs) {
    for (const capability of [CAP.GRANTS_GOVERN, CAP.KYC_ATTEST]) await assertBeneficiaryEligible({ userId: item.userId, capability, scopeType: C.GRANT_SCOPE_TYPES.PLATFORM });
  }
  const people = [authorizedBy, ...governorInputs].map((item) => ({ ...item, ...computeIdentityFingerprint(item) }));
  if (new Set(people.map((item) => item.identityKey)).size !== people.length) fail('FINANCIAL_SEGREGATION_OF_DUTIES', 'Deux personnes du bootstrap partagent la même identité.', 403);
  if (await HumanIdentityAttestation.exists({ user: { $in: people.map((item) => item.userId) }, status: { $in: ['verified', 'suspended'] } })) {
    fail('GRANT_BOOTSTRAP_NOT_NEEDED', 'Une attestation existe déjà pour l’une de ces personnes.', 409);
  }
  if (await ContractualFinanceGrant.exists({ scopeType: C.GRANT_SCOPE_TYPES.PLATFORM, capability: CAP.GRANTS_GOVERN, status: { $in: C.LIVE_GRANT_STATUSES } })) {
    fail('GRANT_BOOTSTRAP_NOT_NEEDED', 'Des gouverneurs plateforme existent déjà.', 409);
  }
  return runFinancialOperation({ operationName: 'contractual.grants.bootstrap.platform_root', transactionMode: 'transactional' }, async ({ session }) => {
    const attestations = await HumanIdentityAttestation.create(people.map((item) => ({
      user: item.userId, identityKey: item.identityKey, fingerprintKeyVersion: item.keyVersion,
      documentKind: item.documentKind, source: 'BOOTSTRAP_OFFLINE', expiresAt: item.documentExpiresAt ? new Date(item.documentExpiresAt) : null,
      evidenceRef: String(item.evidenceRef || decisionReference), verifiedBy: authorizedBy.userId, verifiedAt: now,
    })), { session, ordered: true });
    const basis = attestations.map((attestation) => ({ user: attestation.user, attestation: attestation._id }));
    return createBootstrapGrants({
      scopeType: C.GRANT_SCOPE_TYPES.PLATFORM, tenant: null, governors, capabilities: [CAP.GRANTS_GOVERN, CAP.KYC_ATTEST],
      authorizedByUserId: authorizedBy.userId, decisionReference, until, now, basis, session,
    });
  });
}

// TENANT — exige que l'autorisant (opérateur platform.operators.manage) et
// les gouverneurs portent déjà une attestation utilisable délivrée par
// Altitude Vision (KYC), avec des identités distinctes.
async function bootstrapGrantGovernors({ scopeType, tenantId = null, governorUserIds, authorizedByUserId, decisionReference, validUntil, now = new Date() }) {
  if (scopeType === C.GRANT_SCOPE_TYPES.PLATFORM) {
    if (process.env.CONTRACTUAL_GRANT_BOOTSTRAP_ENABLED !== 'true') BOOTSTRAP_DISABLED();
    fail('GRANT_BOOTSTRAP_PLATFORM_ROOT_REQUIRED', 'Le périmètre PLATFORM s’initialise par bootstrapPlatformRoot.', 422);
  }
  const { governors, until } = assertBootstrapInput({ scopeType, tenantId, governorUserIds, decisionReference, validUntil, now });
  const authorizer = await resolveActiveOperator(authorizedByUserId);
  if (!authorizer?.capabilities?.includes('platform.operators.manage')) fail('FINANCIAL_UNAUTHORIZED', 'Autorisation par un opérateur platform.operators.manage requise.', 403);
  await assertDistinctHumans({ autorisant: authorizedByUserId, gouverneur: governors });
  for (const userId of governors) await assertBeneficiaryEligible({ userId, capability: CAP.GRANTS_GOVERN, scopeType, tenantId });
  const independence = await assessIndependence([authorizedByUserId, ...governors], { now });
  if (!independence.established) fail('GRANT_BOOTSTRAP_IDENTITY_NOT_ATTESTED', 'Identités attestées et distinctes requises pour l’autorisant et chaque gouverneur.', 409);
  if (await ContractualFinanceGrant.exists({ scopeType, tenant: tenantId, capability: CAP.GRANTS_GOVERN, status: { $in: C.LIVE_GRANT_STATUSES } })) {
    fail('GRANT_BOOTSTRAP_NOT_NEEDED', 'Des gouverneurs existent déjà pour ce périmètre.', 409);
  }
  return runFinancialOperation({ operationName: 'contractual.grants.bootstrap', transactionMode: 'transactional' }, async ({ session }) => createBootstrapGrants({
    scopeType, tenant: tenantId, governors, capabilities: [CAP.GRANTS_GOVERN], authorizedByUserId, decisionReference, until, now,
    basis: independence.basis.filter((item) => governors.includes(String(item.user))), session,
  }));
}

module.exports = {
  proposeGrant, approveGrant, reevaluateIndependence, refuseGrant, suspendGrant, reinstateGrant, revokeGrant,
  expireDueGrants, listGrants, bootstrapGrantGovernors, bootstrapPlatformRoot, resolveGovernor,
};
