// F-U1 / F-U1.G — Autorité financière contractuelle.
//
// Même architecture que financialAuthorizationService (Pattern 3, service-
// level unified), sans le modifier ni modifier INVARIANTS §12. Deux familles :
//
// 1. Capacités DÉRIVÉES (non sensibles) — uniquement depuis :
//    - PATH A : OrgMembership active et non ambiguë, tenant non suspendu,
//      capacités IAM NOMMÉES du businessRole (Admin `*` = toutes les capacités
//      IAM nommées, pas davantage) ;
//    - PATH B : PlatformOperator actif (platform.finance.read/manage,
//      platform.rentals.manage).
// 2. Capacités SENSIBLES — jamais dérivées (ni Admin `*`, ni
//    platform.finance.manage) : octroi nominatif ContractualFinanceGrant,
//    accordé par une autre personne, avec éligibilité revérifiée à chaque usage.
//
// Aucune capacité ne remplace l'autorité du propriétaire : les décisions qui
// lui reviennent passent par ownerAuthorityService (relation à la ressource).
// Jamais User.role, un email, un nom d'organisation ou un paramètre client.
// Contextes : TENANT (tenant sélectionné), PLATFORM (vue plateforme, mandats
// explicitement PLATFORM), UNRESOLVED (rien).

const ContractualFinanceGrant = require('../../../models/ContractualFinanceGrant');
const { fail } = require('../financialError');
const { resolveTenantMembership } = require('../../tenantMembershipService');
const { resolveActiveOperator } = require('../../platformOperator/platformOperatorService');
const { DEFAULT_CAPABILITIES } = require('../../../utils/iamArchitecture');
const { deriveAdministrationScope, ADMINISTRATION_SCOPE_MODE } = require('../../administrationScopeService');
const { MANDATARY_TYPES } = require('../../../constants/contractualFinanceConstants');
const { isIdentityBasisUsable } = require('./humanIdentityService');

const CONTRACTUAL_CAPABILITIES = Object.freeze({
  // Dérivées
  CONTRACT_READ: 'contractual.read',
  MANDATE_MANAGE: 'contractual.mandate.manage',
  EXPENSE_REQUEST: 'contractual.expense.request',
  EXPENSE_JUSTIFY: 'contractual.expense.justify',
  COLLECTION_RECORD: 'contractual.collection.record',
  BENEFICIARY_REGISTER: 'contractual.beneficiary.register',
  REFUND_PREPARE: 'contractual.refund.prepare',
  // F-U2 — facturation : préparer des brouillons / émettre définitivement.
  BILLING_MANAGE: 'contractual.billing.manage',
  BILLING_ISSUE: 'contractual.billing.issue',
  // Sensibles (octroi explicite uniquement)
  FINANCIAL_APPROVE: 'contractual.financial.approve',
  WRITTEN_AUTHORIZATION_VERIFY: 'contractual.written_authorization.verify',
  COLLECTION_RECONCILE: 'contractual.collection.reconcile',
  BENEFICIARY_VERIFY: 'contractual.beneficiary.verify',
  REPRESENTATION_VERIFY: 'contractual.representation.verify',
  REFUND_POLICY_MANAGE: 'contractual.refund_policy.manage',
  ISSUER_IDENTITY_MANAGE: 'contractual.issuer_identity.manage',
  // F-U1.H — gouvernance des habilitations elles-mêmes (proposer, approuver,
  // suspendre, révoquer, attester une identité) dans un périmètre donné.
  GRANTS_GOVERN: 'contractual.grants.govern',
  // F-U1.I — KYC à deux niveaux : préparation par l'organisation (TENANT
  // uniquement), attestation finale par Altitude Vision (PLATFORM uniquement).
  KYC_PREPARE: 'contractual.kyc.prepare',
  KYC_ATTEST: 'contractual.kyc.attest',
});
const CAP = CONTRACTUAL_CAPABILITIES;
const ALL = Object.freeze(Object.values(CAP));

// Matrice des capacités dérivées : capacité contractuelle ← capacités IAM
// nommées qui correspondent réellement à l'action. `adminWildcard` : le
// joker Admin `*` l'ouvre (la capacité n'a pas d'équivalent IAM nommé mais
// relève de l'administration courante du tenant).
const DERIVED_MATRIX = Object.freeze([
  { capability: CAP.CONTRACT_READ, iam: ['rental.read', 'payments.read', 'payment.status'], adminWildcard: true, platform: ['platform.finance.read', 'platform.finance.manage'] },
  { capability: CAP.MANDATE_MANAGE, iam: [], adminWildcard: true, platform: ['platform.finance.manage'] },
  { capability: CAP.EXPENSE_REQUEST, iam: ['maintenance.manage'], adminWildcard: true, platform: ['platform.rentals.manage'] },
  { capability: CAP.EXPENSE_JUSTIFY, iam: ['maintenance.manage'], adminWildcard: true, platform: ['platform.rentals.manage'] },
  { capability: CAP.COLLECTION_RECORD, iam: ['payments.manage'], adminWildcard: true, platform: ['platform.finance.manage'] },
  { capability: CAP.BENEFICIARY_REGISTER, iam: ['payments.manage'], adminWildcard: true, platform: ['platform.finance.manage'] },
  { capability: CAP.REFUND_PREPARE, iam: ['payments.manage'], adminWildcard: true, platform: ['platform.finance.manage'] },
  { capability: CAP.BILLING_MANAGE, iam: ['payments.manage'], adminWildcard: true, platform: ['platform.finance.manage'] },
  // L'émission définitive n'a pas d'équivalent IAM nommé : Admin et
  // opérateur finance.manage uniquement (comme DOCUMENT_ISSUE hôtelier).
  { capability: CAP.BILLING_ISSUE, iam: [], adminWildcard: true, platform: ['platform.finance.manage'] },
]);

// Capacités sensibles : rôles tenant (businessRole de membership active)
// éligibles à une habilitation, revérifiés à chaque usage. Aucun nouveau rôle
// global : « responsable financier / administratif » = Admin habilité.
const SENSITIVE_ELIGIBILITY = Object.freeze({
  [CAP.FINANCIAL_APPROVE]: ['Admin'],
  [CAP.WRITTEN_AUTHORIZATION_VERIFY]: ['Admin', 'GestionnaireImmobilier'],
  [CAP.COLLECTION_RECONCILE]: ['Admin', 'Secretaire'],
  [CAP.BENEFICIARY_VERIFY]: ['Admin', 'Secretaire'],
  [CAP.REPRESENTATION_VERIFY]: ['Admin'],
  [CAP.REFUND_POLICY_MANAGE]: ['Admin'],
  [CAP.ISSUER_IDENTITY_MANAGE]: ['Admin'],
  [CAP.GRANTS_GOVERN]: ['Admin'],
  [CAP.KYC_PREPARE]: ['Admin', 'Secretaire'],
  // Aucune organisation ne peut délivrer l'attestation finale.
  [CAP.KYC_ATTEST]: [],
});
// Côté plateforme : capacité opérateur de BASE requise pour être éligible à
// une habilitation PLATFORM (jamais suffisante seule).
// `null` : capacité jamais octroyable au niveau plateforme.
const PLATFORM_BASE_OVERRIDES = Object.freeze({
  [CAP.GRANTS_GOVERN]: 'platform.operators.manage',
  [CAP.KYC_ATTEST]: 'platform.users.manage',
  [CAP.KYC_PREPARE]: null,
});
const PLATFORM_ELIGIBILITY = Object.freeze(Object.fromEntries(Object.keys(SENSITIVE_ELIGIBILITY).map((cap) => [
  cap, Object.prototype.hasOwnProperty.call(PLATFORM_BASE_OVERRIDES, cap) ? PLATFORM_BASE_OVERRIDES[cap] : 'platform.finance.manage',
])));
const SENSITIVE_CAPABILITIES = Object.freeze(Object.keys(SENSITIVE_ELIGIBILITY));

function tenantContractualCapabilities(businessRole) {
  const named = DEFAULT_CAPABILITIES[businessRole] || [];
  const wildcard = businessRole === 'Admin' && named.includes('*');
  return DERIVED_MATRIX
    .filter((row) => (wildcard && row.adminWildcard) || row.iam.some((cap) => named.includes(cap)))
    .map((row) => row.capability);
}

function platformContractualCapabilities(operator) {
  if (operator?.status !== 'active') return [];
  const granted = operator.capabilities || [];
  return DERIVED_MATRIX.filter((row) => row.platform.some((cap) => granted.includes(cap))).map((row) => row.capability);
}

const idOf = (value) => {
  const raw = value?._id ?? value?.id ?? value;
  return raw == null ? null : String(raw);
};

const activeMembership = (resolved) => Boolean(resolved && !resolved.ambiguous && resolved.status === 'active'
  && !['suspended', 'archived'].includes(resolved.tenant?.status));

// Éligibilité ACTUELLE d'un bénéficiaire (jamais mise en cache).
function isEligible({ capability, scopeType, membership, operator }) {
  if (!SENSITIVE_ELIGIBILITY[capability]) return false;
  if (scopeType === 'TENANT') return Boolean(membership && SENSITIVE_ELIGIBILITY[capability].includes(membership.businessRole));
  if (scopeType === 'PLATFORM') return Boolean(PLATFORM_ELIGIBILITY[capability] && operator?.status === 'active' && operator.capabilities?.includes(PLATFORM_ELIGIBILITY[capability]));
  return false;
}

// Une habilitation n'est utilisable que si : statut `active`, fenêtre de
// validité couvrant maintenant, bénéficiaire éligible maintenant.
const usableGrantFilter = (now) => ({ status: 'active', validFrom: { $lte: now }, validUntil: { $gt: now } });

async function sensitiveCapabilities({ userId, tenantId, membership, operator, now = new Date() }) {
  const grants = await ContractualFinanceGrant.find({ user: userId, ...usableGrantFilter(now) }).lean();
  const caps = new Set();
  for (const grant of grants) {
    if (!(await isIdentityBasisUsable(grant.identityBasis, { now }))) continue;
    if (grant.scopeType === 'TENANT' && tenantId && idOf(grant.tenant) === String(tenantId)
      && isEligible({ capability: grant.capability, scopeType: 'TENANT', membership })) caps.add(grant.capability);
    // Les habilitations PLATFORM ne donnent jamais la gouvernance d'un tenant.
    if (grant.scopeType === 'PLATFORM' && grant.capability !== CAP.GRANTS_GOVERN
      && isEligible({ capability: grant.capability, scopeType: 'PLATFORM', operator })) caps.add(grant.capability);
  }
  return caps;
}

// Habilitation utilisable pour un périmètre EXACT (gouvernance).
async function findUsableGrant({ userId, capability, scopeType, tenantId = null, now = new Date() }) {
  const grant = await ContractualFinanceGrant.findOne({
    user: userId, capability, scopeType, tenant: scopeType === 'TENANT' ? tenantId : null, ...usableGrantFilter(now),
  }).lean();
  if (!grant || !(await isIdentityBasisUsable(grant.identityBasis, { now }))) return null;
  if (scopeType === 'TENANT') {
    const membership = await resolveTenantMembership(userId, tenantId);
    return isEligible({ capability, scopeType, membership: activeMembership(membership) ? membership : null }) ? grant : null;
  }
  return isEligible({ capability, scopeType, operator: await resolveActiveOperator(userId) }) ? grant : null;
}

async function resolveContractualAuthority(actor) {
  const userId = idOf(actor);
  const none = (plane = ADMINISTRATION_SCOPE_MODE.UNRESOLVED) => ({ plane, tenantId: null, capabilities: new Set(), userId });
  if (!userId) return none();
  const scope = deriveAdministrationScope(actor);
  const operator = await resolveActiveOperator(userId);
  if (scope.mode === ADMINISTRATION_SCOPE_MODE.PLATFORM) {
    const capabilities = new Set(platformContractualCapabilities(operator));
    (await sensitiveCapabilities({ userId, tenantId: null, membership: null, operator })).forEach((cap) => capabilities.add(cap));
    return { plane: 'PLATFORM', tenantId: null, capabilities, userId };
  }
  if (scope.mode !== ADMINISTRATION_SCOPE_MODE.TENANT) return none();
  const capabilities = new Set(platformContractualCapabilities(operator));
  const resolved = await resolveTenantMembership(userId, scope.tenantId);
  const membership = activeMembership(resolved) ? resolved : null;
  if (membership) tenantContractualCapabilities(membership.businessRole).forEach((cap) => capabilities.add(cap));
  (await sensitiveCapabilities({ userId, tenantId: scope.tenantId, membership, operator })).forEach((cap) => capabilities.add(cap));
  return { plane: 'TENANT', tenantId: scope.tenantId, capabilities, userId };
}

async function assertContractualCapability(actor, capability) {
  if (!ALL.includes(capability)) fail('CONTRACTUAL_CAPABILITY_UNKNOWN', 'Capacité contractuelle inconnue.', 500);
  if (!idOf(actor)) fail('FINANCIAL_UNAUTHORIZED', 'Authentification requise.', 401);
  const authority = await resolveContractualAuthority(actor);
  if (!authority.capabilities.has(capability)) fail('FINANCIAL_UNAUTHORIZED', 'Capacité financière contractuelle requise.', 403);
  return authority;
}

function assertResourceInAuthorityScope(authority, resource, { mandataryType = resource?.mandataryType } = {}) {
  const notFound = () => fail('FINANCIAL_RESOURCE_OUT_OF_SCOPE', 'Ressource financière inaccessible.', 404);
  if (!resource) notFound();
  if (authority.plane === 'TENANT') {
    if (mandataryType !== MANDATARY_TYPES.TENANT || idOf(resource.tenant) !== String(authority.tenantId)) notFound();
    return true;
  }
  if (authority.plane === 'PLATFORM') {
    if (mandataryType !== MANDATARY_TYPES.PLATFORM || resource.tenant != null) notFound();
    return true;
  }
  return notFound();
}

async function authorizeOnResource(actor, capability, resource, options) {
  const authority = await assertContractualCapability(actor, capability);
  assertResourceInAuthorityScope(authority, resource, options);
  return authority;
}

module.exports = {
  CONTRACTUAL_CAPABILITIES, SENSITIVE_CAPABILITIES, SENSITIVE_ELIGIBILITY, PLATFORM_ELIGIBILITY, DERIVED_MATRIX,
  isEligible, findUsableGrant,
  tenantContractualCapabilities, platformContractualCapabilities, resolveContractualAuthority,
  assertContractualCapability, assertResourceInAuthorityScope, authorizeOnResource, activeMembership, idOf,
};
