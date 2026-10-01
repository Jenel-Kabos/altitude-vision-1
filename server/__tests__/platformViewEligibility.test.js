// PLATFORM-ADMIN-04A — Groupes A (constantes) et B (primitive d'éligibilité).
// La Vue plateforme est réservée à un PlatformOperator actif détenant TOUTES
// les capabilities requises ; la liste requise est DÉRIVÉE du registre
// canonique moins une liste d'exclusions documentée — jamais une seconde
// liste manuelle.
const {
  PLATFORM_OPERATOR_CAPABILITIES,
  PLATFORM_VIEW_EXCLUDED_CAPABILITIES,
  PLATFORM_VIEW_REQUIRED_CAPABILITIES,
} = require('../constants/platformOperatorConstants');
const { isPlatformViewEligible } = require('../services/platformOperator/platformOperatorService');

describe('PA-04A — constantes Vue plateforme', () => {
  test('REQUIRED = registre − EXCLUDED, dans l’ordre du registre', () => {
    const excluded = Object.keys(PLATFORM_VIEW_EXCLUDED_CAPABILITIES);
    expect(PLATFORM_VIEW_REQUIRED_CAPABILITIES).toEqual(
      PLATFORM_OPERATOR_CAPABILITIES.filter((capability) => !excluded.includes(capability)),
    );
    expect(Object.isFrozen(PLATFORM_VIEW_REQUIRED_CAPABILITIES)).toBe(true);
    expect(Object.isFrozen(PLATFORM_VIEW_EXCLUDED_CAPABILITIES)).toBe(true);
  });

  test('seule exclusion validée (H1) : platform.support.impersonation', () => {
    expect(Object.keys(PLATFORM_VIEW_EXCLUDED_CAPABILITIES)).toEqual(['platform.support.impersonation']);
    expect(PLATFORM_VIEW_REQUIRED_CAPABILITIES).toContain('platform.operators.manage');
  });

  test.each(Object.entries(PLATFORM_VIEW_EXCLUDED_CAPABILITIES))(
    'l’exclusion %s existe dans le registre et porte une justification',
    (capability, reason) => {
      expect(PLATFORM_OPERATOR_CAPABILITIES).toContain(capability);
      expect(typeof reason).toBe('string');
      expect(reason.trim().length).toBeGreaterThan(20);
    },
  );

  // Snapshot volontairement explicite : ajouter une capability au registre
  // rend inéligibles TOUS les administrateurs existants tant qu'elle n'est
  // pas accordée. Ce test échoue alors et force une décision explicite
  // (exclusion documentée OU plan d'octroi humain avant déploiement).
  test('snapshot des capabilities requises (décision explicite à chaque ajout)', () => {
    expect([...PLATFORM_VIEW_REQUIRED_CAPABILITIES]).toEqual([
      'platform.tenants.read',
      'platform.tenants.manage',
      'platform.users.read',
      'platform.users.manage',
      'platform.properties.read',
      'platform.properties.manage',
      'platform.rentals.read',
      'platform.rentals.manage',
      'platform.hotels.read',
      'platform.hotels.manage',
      'platform.accommodations.read',
      'platform.accommodations.manage',
      'platform.crm.read',
      'platform.crm.manage',
      'platform.finance.read',
      'platform.finance.manage',
      'platform.commercial.manage',
      'platform.reporting.read',
      'platform.organization.read',
      'platform.organization.manage',
      'platform.marketing.read',
      'platform.marketing.manage',
      'platform.api.read',
      'platform.api.manage',
      'platform.audit.read',
      'platform.documents.read',
      'platform.documents.manage',
      'platform.tenant_applications.read',
      'platform.tenant_applications.review',
      'platform.tenant_applications.request_changes',
      'platform.tenant_applications.approve',
      'platform.tenant_applications.reject',
      'platform.support.read',
      'platform.operators.manage',
    ]);
  });
});

describe('PA-04A — isPlatformViewEligible', () => {
  const full = () => ({ status: 'active', capabilities: [...PLATFORM_VIEW_REQUIRED_CAPABILITIES] });

  test('toutes les capabilities requises → éligible', () => {
    expect(isPlatformViewEligible(full())).toBe(true);
  });

  test('registre complet (impersonation incluse) → éligible', () => {
    expect(isPlatformViewEligible({ status: 'active', capabilities: [...PLATFORM_OPERATOR_CAPABILITIES] })).toBe(true);
  });

  test('absence de platform.support.impersonation → reste éligible', () => {
    const operator = full();
    expect(operator.capabilities).not.toContain('platform.support.impersonation');
    expect(isPlatformViewEligible(operator)).toBe(true);
  });

  test.each(PLATFORM_VIEW_REQUIRED_CAPABILITIES.map((capability) => [capability]))(
    'N−1 : sans %s → non éligible',
    (missing) => {
      const operator = full();
      operator.capabilities = operator.capabilities.filter((capability) => capability !== missing);
      expect(isPlatformViewEligible(operator)).toBe(false);
    },
  );

  test.each(['suspended', 'revoked', undefined, 'unknown'])('statut %s → non éligible', (status) => {
    expect(isPlatformViewEligible({ ...full(), status })).toBe(false);
  });

  test.each([null, undefined, {}, { status: 'active' }, { status: 'active', capabilities: null }])(
    'opérateur absent ou incomplet (%p) → non éligible',
    (operator) => {
      expect(isPlatformViewEligible(operator)).toBe(false);
    },
  );

  test('aucune dépendance au rôle User : un rôle Admin sans capabilities reste non éligible', () => {
    expect(isPlatformViewEligible({ status: 'active', capabilities: [], role: 'Admin' })).toBe(false);
  });
});

describe('PA-04A — isPlatformWideRequest (prédicat canonique, fail-closed)', () => {
  const { isPlatformWideRequest, isPlatformViewForbiddenRequest } = require('../middleware/tenantContext');
  const {
    PLATFORM_WIDE_CONTEXT_SOURCE,
    PLATFORM_VIEW_FORBIDDEN_CONTEXT_SOURCE,
  } = require('../constants/platformOperatorConstants');

  test('seule la source platform_operator_unscoped sans tenant est globale', () => {
    expect(isPlatformWideRequest({ tenantContextSource: PLATFORM_WIDE_CONTEXT_SOURCE, platformTenant: null })).toBe(true);
    expect(isPlatformWideRequest({ user: { tenantContextSource: PLATFORM_WIDE_CONTEXT_SOURCE } })).toBe(true);
  });

  test.each([
    ['requête absente', undefined],
    ['source absente', {}],
    ['source null', { tenantContextSource: null }],
    ['opérateur non éligible', { tenantContextSource: PLATFORM_VIEW_FORBIDDEN_CONTEXT_SOURCE, isPlatformOperatorContext: true }],
    ['tenant introuvable', { tenantContextSource: 'platform_operator_tenant_not_found', isPlatformOperatorContext: true }],
    ['sélection de tenant', { tenantContextSource: 'platform_operator_selection', platformTenant: { _id: 't' } }],
    ['unscoped mais tenant présent', { tenantContextSource: PLATFORM_WIDE_CONTEXT_SOURCE, platformTenant: { _id: 't' } }],
    ['ancien pattern isPlatformOperatorContext sans tenant', { isPlatformOperatorContext: true, platformTenant: null }],
    ['membership unique', { tenantContextSource: 'single_membership', platformTenant: { _id: 't' } }],
  ])('%s → jamais global', (_label, req) => {
    expect(isPlatformWideRequest(req)).toBe(false);
  });

  test('isPlatformViewForbiddenRequest ne reconnaît que la source interdite', () => {
    expect(isPlatformViewForbiddenRequest({ tenantContextSource: PLATFORM_VIEW_FORBIDDEN_CONTEXT_SOURCE })).toBe(true);
    expect(isPlatformViewForbiddenRequest({ tenantContextSource: PLATFORM_WIDE_CONTEXT_SOURCE })).toBe(false);
    expect(isPlatformViewForbiddenRequest({})).toBe(false);
    expect(isPlatformViewForbiddenRequest(undefined)).toBe(false);
  });
});
