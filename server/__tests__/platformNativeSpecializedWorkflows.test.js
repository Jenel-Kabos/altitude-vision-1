// PLATFORM-ADMIN-04A CLOSURE (H3) — registre fermé des workflows
// platform-native spécialisés et primitive `requirePlatformNativeCapability`.
jest.mock('../services/platformOperator/platformOperatorService', () => {
  const actual = jest.requireActual('../services/platformOperator/platformOperatorService');
  return { ...actual, resolveActiveOperator: jest.fn() };
});

const { resolveActiveOperator } = require('../services/platformOperator/platformOperatorService');
const {
  PLATFORM_NATIVE_SPECIALIZED_WORKFLOWS,
  PLATFORM_OPERATOR_CAPABILITIES,
} = require('../constants/platformOperatorConstants');
const { requirePlatformNativeCapability } = require('../middleware/platformAuthority');
const { isPlatformWideRequest } = require('../middleware/tenantContext');

const run = async (middleware, req) => {
  const res = { status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() };
  const next = jest.fn();
  await middleware(req, res, next);
  return { res, next };
};

describe('PA-04A closure — registre des workflows spécialisés', () => {
  test('liste fermée : tenant_applications et support_inbox uniquement', () => {
    expect(Object.keys(PLATFORM_NATIVE_SPECIALIZED_WORKFLOWS).sort()).toEqual(['support_inbox', 'tenant_applications']);
    expect(Object.isFrozen(PLATFORM_NATIVE_SPECIALIZED_WORKFLOWS)).toBe(true);
    expect([...PLATFORM_NATIVE_SPECIALIZED_WORKFLOWS.support_inbox]).toEqual(['platform.support.read']);
  });

  test('chaque capability déclarée existe dans le registre canonique', () => {
    Object.values(PLATFORM_NATIVE_SPECIALIZED_WORKFLOWS).flat().forEach((capability) => {
      expect(PLATFORM_OPERATOR_CAPABILITIES).toContain(capability);
    });
  });

  test('aucune capability de gouvernance ou de domaine général n’est un workflow spécialisé', () => {
    const declared = Object.values(PLATFORM_NATIVE_SPECIALIZED_WORKFLOWS).flat();
    ['platform.operators.manage', 'platform.users.read', 'platform.properties.read', 'platform.reporting.read', 'platform.tenants.read']
      .forEach((capability) => expect(declared).not.toContain(capability));
  });

  test('une route mal classée échoue au chargement', () => {
    expect(() => requirePlatformNativeCapability('platform.users.read', { workflow: 'support_inbox' })).toThrow(/non déclaré/);
    expect(() => requirePlatformNativeCapability('platform.support.read', { workflow: 'unknown' })).toThrow(/non déclaré/);
    expect(() => requirePlatformNativeCapability('platform.support.read')).toThrow(/non déclaré/);
  });
});

describe('PA-04A closure — requirePlatformNativeCapability', () => {
  beforeEach(() => resolveActiveOperator.mockReset());

  test('opérateur partiel avec la capability exacte → autorisé, sans aucun scope plateforme', async () => {
    resolveActiveOperator.mockResolvedValue({ status: 'active', capabilities: ['platform.support.read'] });
    const req = { user: { _id: 'u1', role: 'Client' } };
    const { next, res } = await run(requirePlatformNativeCapability('platform.support.read', { workflow: 'support_inbox' }), req);
    expect(next).toHaveBeenCalledWith();
    expect(res.status).not.toHaveBeenCalled();
    expect(req.platformNativeWorkflow).toEqual({ workflow: 'support_inbox', capability: 'platform.support.read' });
    expect(req.tenantContextSource).toBeUndefined();
    expect(req.isPlatformOperatorContext).toBeUndefined();
    expect(isPlatformWideRequest(req)).toBe(false);
  });

  test.each([
    ['capability voisine', { status: 'active', capabilities: ['platform.tenant_applications.read'] }],
    ['opérateur suspendu', { status: 'suspended', capabilities: ['platform.tenant_applications.approve'] }],
    ['aucun opérateur (Admin historique)', null],
  ])('%s → 403', async (_label, operator) => {
    resolveActiveOperator.mockResolvedValue(operator);
    const req = { user: { _id: 'u2', role: 'Admin' } };
    const { next, res } = await run(requirePlatformNativeCapability('platform.tenant_applications.approve', { workflow: 'tenant_applications' }), req);
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
    expect(req.platformNativeWorkflow).toBeUndefined();
  });
});
