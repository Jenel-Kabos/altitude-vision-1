import api from '../services/api';
import {
  listGlobalUsers,
  getGlobalUser,
  suspendGlobalUser,
  activateGlobalUser,
  deleteGlobalUser,
} from '../services/userService';

vi.mock('../services/api', () => ({
  default: {
    get: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

describe('global user service', () => {
  beforeEach(() => vi.clearAllMocks());

  test('lists global users with supported parameters and preserves pagination metadata', async () => {
    const registry = { items: [{ _id: 'u-1' }], page: 2, limit: 10, total: 21, totalPages: 3, stats: { total: 21 } };
    api.get.mockResolvedValue({ data: { data: registry } });

    await expect(listGlobalUsers({
      page: 2, limit: 10, search: 'alice', status: 'Actif', active: true, role: 'Client',
      organization: 'without', tenantId: 'tenant-a', operator: false, sort: 'name', ignored: 'never-send',
    })).resolves.toEqual(registry);
    expect(api.get).toHaveBeenCalledWith('/users', {
      params: {
        page: 2, limit: 10, search: 'alice', status: 'Actif', active: true, role: 'Client',
        organization: 'without', tenantId: 'tenant-a', operator: false, sort: 'name',
      },
      platformScoped: true,
    });
  });

  test('detail and lifecycle mutations are explicitly platform scoped', async () => {
    api.get.mockResolvedValue({ data: { data: { user: { _id: 'u-1' } } } });
    api.patch.mockResolvedValue({ data: { data: { user: { _id: 'u-1', status: 'Suspendu' } } } });
    api.delete.mockResolvedValue({ status: 204 });

    await expect(getGlobalUser('u-1')).resolves.toEqual({ _id: 'u-1' });
    await suspendGlobalUser('u-1');
    await activateGlobalUser('u-1');
    await deleteGlobalUser('u-1');

    expect(api.get).toHaveBeenCalledWith('/users/u-1', { platformScoped: true });
    expect(api.patch).toHaveBeenNthCalledWith(1, '/users/u-1/suspend', undefined, { platformScoped: true });
    expect(api.patch).toHaveBeenNthCalledWith(2, '/users/u-1/activate', undefined, { platformScoped: true });
    expect(api.delete).toHaveBeenCalledWith('/users/u-1', { platformScoped: true });
  });

  test('does not turn a failed global registry request into an empty success', async () => {
    const failure = Object.assign(new Error('forbidden'), { response: { status: 403 } });
    api.get.mockRejectedValue(failure);
    await expect(listGlobalUsers({ page: 1 })).rejects.toBe(failure);
  });
});
