import api from '../services/api';
import { listPropertyRegistry } from '../services/propertyService';

vi.mock('../services/api', () => ({ default: { get: vi.fn() } }));

describe('property registry service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.get.mockResolvedValue({
      data: { data: { properties: [{ _id: 'p-1' }], page: 2, limit: 20, total: 21, totalPages: 2 } },
    });
  });

  test('uses the canonical endpoint with platformScoped only in platform mode', async () => {
    await listPropertyRegistry({
      page: 2, limit: 20, search: ' villa ', offerType: 'vente', sort: 'newest', tenant: 'forbidden', tenantId: 'forbidden', unsupported: true,
    }, { platformScoped: true });

    expect(api.get).toHaveBeenCalledWith('/properties', {
      params: { dashboardRegistry: '1', page: 2, limit: 20, search: 'villa', offerType: 'vente', sort: 'newest' },
      platformScoped: true,
    });
    expect(api.get.mock.calls[0][1].params).not.toHaveProperty('platformScoped');
    expect(api.get.mock.calls[0][1].params).not.toHaveProperty('tenant');
    expect(api.get.mock.calls[0][1].params).not.toHaveProperty('tenantId');
  });

  test('omits platformScoped from tenant-mode Axios configuration', async () => {
    await listPropertyRegistry({ page: 1, propertyType: 'Villa', city: 'Brazzaville', arrondissement: 'Centre' });
    expect(api.get).toHaveBeenCalledWith('/properties', {
      params: {
        dashboardRegistry: '1', page: 1, propertyType: 'Villa', city: 'Brazzaville', arrondissement: 'Centre',
      },
    });
    expect(api.get.mock.calls[0][1]).not.toHaveProperty('platformScoped');
  });

  test('normalizes the administrative response', async () => {
    await expect(listPropertyRegistry()).resolves.toEqual({
      items: [{ _id: 'p-1' }], page: 2, limit: 20, total: 21, totalPages: 2,
    });
  });

  test('propagates forbidden and server errors', async () => {
    const error = Object.assign(new Error('forbidden'), { response: { status: 403 } });
    api.get.mockRejectedValueOnce(error);
    await expect(listPropertyRegistry({}, { platformScoped: true })).rejects.toBe(error);
  });
});
