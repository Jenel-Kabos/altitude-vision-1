import api from '../services/api';
import { getDashboardStats } from '../services/dashboardService';

vi.mock('../services/api', () => ({ default: { get: vi.fn() } }));

describe('Dashboard Home canonical scope transport', () => {
  beforeEach(() => vi.clearAllMocks());

  test('PLATFORM uses server global stats and strips every tenant header', async () => {
    api.get.mockResolvedValue({ data: { data: { totalProperties: 12, totalUsers: 7, totalOwners: 3, pendingProperties: 2 } } });
    const result = await getDashboardStats({ mode: 'platform', tenantId: null, key: 'platform' });
    expect(api.get).toHaveBeenCalledWith('/admin/stats', { platformScoped: true });
    expect(result).toMatchObject({
      stats: { Altimmo: 12, MilaEvents: 0, Altcom: 0, Users: 7, Owners: 3 },
      pendingProperties: 2,
    });
  });

  test('TENANT uses the selected-tenant endpoint without platformScoped', async () => {
    api.get.mockResolvedValue({ data: { data: { stats: { Altimmo: 4, MilaEvents: 1, Altcom: 2 } } } });
    const result = await getDashboardStats({ mode: 'tenant', tenantId: 'tenant-a', key: 'tenant:tenant-a' });
    expect(api.get).toHaveBeenCalledWith('/dashboard/stats');
    expect(result.stats.Altimmo).toBe(4);
  });

  test('UNRESOLVED never sends a dashboard request', async () => {
    await expect(getDashboardStats({ mode: 'unresolved', tenantId: null, key: 'unresolved' }))
      .rejects.toMatchObject({ code: 'ADMINISTRATION_SCOPE_REQUIRED' });
    expect(api.get).not.toHaveBeenCalled();
  });
});
