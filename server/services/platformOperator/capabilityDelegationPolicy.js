// PLATFORM-DELEGATION-POLICY-1 — politique CENTRALE de délégation des
// capacités PlatformOperator. Toute opération ORDINAIRE de gouvernance
// (création, remplacement, réactivation, délégation unitaire — routes
// `/api/platform-operators/*`) passe par ce module : un acteur détenant
// `platform.operators.manage` ne peut jamais faire détenir à autrui, même
// indirectement, une capacité hors de la liste fermée
// PLATFORM_DELEGABLE_CAPABILITIES (gouvernance des opérateurs, impersonation,
// finance, administration critique…).
//
// L'attribution de capacités critiques n'existe que par le provisionnement
// privilégié du service opérateur, réservé aux scripts CLI gardés
// (`scripts/bootstrapPlatformOperator.js`, `scripts/applyDataReset.js`) et
// jamais importable par une route, un contrôleur ou un middleware
// (garde statique : platformOperatorPrivilegedProvisioningBoundary.test.js).
//
// Module sans dépendance vers le service (aucun cycle) ; l'erreur porte le
// nom `PlatformOperatorError`, déjà mappé par errorMiddleware.
const {
  PLATFORM_DELEGABLE_CAPABILITIES,
  PLATFORM_OPERATOR_CAPABILITIES,
} = require('../../constants/platformOperatorConstants');

const DELEGABLE_CAPABILITIES = PLATFORM_DELEGABLE_CAPABILITIES;

function policyError(code, message, statusCode) {
  const error = new Error(message);
  error.name = 'PlatformOperatorError';
  error.code = code;
  error.statusCode = statusCode;
  return error;
}

const isDelegableCapability = (capability) => DELEGABLE_CAPABILITIES.includes(capability);

const nonDelegableCapabilities = (capabilities = []) => capabilities.filter((capability) => !isDelegableCapability(capability));

function assertDelegableCapabilities(capabilities) {
  if (!Array.isArray(capabilities) || capabilities.some((capability) => typeof capability !== 'string')) {
    throw policyError('PLATFORM_OPERATOR_INVALID_CAPABILITY', 'Liste de capacités invalide.', 422);
  }
  const unknown = capabilities.filter((capability) => !PLATFORM_OPERATOR_CAPABILITIES.includes(capability));
  if (unknown.length) {
    throw policyError('PLATFORM_OPERATOR_INVALID_CAPABILITY', `Capacité(s) inconnue(s) : ${unknown.join(', ')}`, 422);
  }
  const forbidden = nonDelegableCapabilities(capabilities);
  if (forbidden.length) {
    throw policyError(
      'PLATFORM_CAPABILITY_NOT_DELEGABLE',
      `Capacité(s) non déléguable(s) par la gestion ordinaire des habilitations : ${forbidden.join(', ')}.`,
      403,
    );
  }
}

// Un opérateur (non révoqué) détenant une capacité non déléguable est
// « privilégié » : la gestion ordinaire ne peut ni remplacer son ensemble de
// capacités, ni le réactiver (ce qui restaurerait ces capacités).
const isPrivilegedOperator = (operator) => Boolean(operator)
  && operator.status !== 'revoked'
  && nonDelegableCapabilities(operator.capabilities || []).length > 0;

function assertOrdinaryTargetNotPrivileged(operator) {
  if (isPrivilegedOperator(operator)) {
    throw policyError(
      'PLATFORM_OPERATOR_PRIVILEGED_TARGET',
      "Cet opérateur détient des capacités critiques : son ensemble de capacités ne peut pas être remplacé par la gestion ordinaire. Utilisez la gestion unitaire des habilitations.",
      409,
    );
  }
}

function assertOrdinaryReactivationAllowed(operator) {
  if (nonDelegableCapabilities(operator?.capabilities || []).length > 0) {
    throw policyError(
      'PLATFORM_OPERATOR_PRIVILEGED_REACTIVATION_FORBIDDEN',
      "Réactivation refusée : elle restaurerait des capacités critiques non déléguables. Procédure de récupération : provisionnement privilégié (CLI).",
      409,
    );
  }
}

module.exports = {
  DELEGABLE_CAPABILITIES,
  isDelegableCapability,
  nonDelegableCapabilities,
  assertDelegableCapabilities,
  isPrivilegedOperator,
  assertOrdinaryTargetNotPrivileged,
  assertOrdinaryReactivationAllowed,
};
