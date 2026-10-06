// PLATFORM-ADMIN-04C2 (C2.0b, D14) — la gestion des PlatformOperators est une
// opération PLATFORM : le backend refuse toute mutation portant un en-tête de
// tenant. Le client doit donc toujours émettre ces mutations sans sélection
// de tenant (`platformScoped: true`, convention existante de api.js).
import api from '../services/api';
import { grantOperator, suspendOperator, reactivateOperator, revokeOperator } from '../services/platformOperatorService';

vi.mock('../services/api', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn().mockResolvedValue({ data: { data: { operator: { status: 'active' } } } }),
    patch: vi.fn().mockResolvedValue({ data: { data: { operator: { status: 'active' } } } }),
  },
}));

describe('PA-04C2 — mutations PlatformOperator en contexte PLATFORM uniquement', () => {
  beforeEach(() => vi.clearAllMocks());

  test('grant est émis platformScoped', async () => {
    await grantOperator({ userId: 'u1', capabilities: [], reason: 'r' });
    expect(api.post).toHaveBeenCalledWith('/platform-operators', { userId: 'u1', capabilities: [], reason: 'r' }, { platformScoped: true });
  });

  test.each([
    ['suspend', suspendOperator],
    ['reactivate', reactivateOperator],
    ['revoke', revokeOperator],
  ])('%s est émis platformScoped', async (action, fn) => {
    await fn('u2', 'motif');
    expect(api.patch).toHaveBeenCalledWith(`/platform-operators/u2/${action}`, { reason: 'motif' }, { platformScoped: true });
  });
});
