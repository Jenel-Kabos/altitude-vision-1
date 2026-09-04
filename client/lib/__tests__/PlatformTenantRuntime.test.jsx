import { act, renderHook, waitFor } from '@testing-library/react';
import { PlatformTenantRuntimeProvider, usePlatformTenantRuntime } from '../context/PlatformTenantRuntimeContext';
import { getMyOperatorStatus } from '../services/platformOperatorService';
import { listTenants } from '../services/platformTenantService';
import api, { clearValidatedPlatformTenant } from '../services/api';

let authUser = { _id: 'operator-a', role: 'Admin' };
vi.mock('../context/AuthContext', () => ({ useAuth: () => ({ user: authUser, loading: false }) }));
vi.mock('../services/platformOperatorService', () => ({ getMyOperatorStatus: vi.fn() }));
vi.mock('../services/platformTenantService', () => ({ listTenants: vi.fn() }));

const wrapper = ({ children }) => <PlatformTenantRuntimeProvider>{children}</PlatformTenantRuntimeProvider>;

describe('runtime tenant plateforme', () => {
  beforeEach(() => {
    localStorage.clear();
    clearValidatedPlatformTenant();
    authUser = { _id: 'operator-a', role: 'Admin' };
    getMyOperatorStatus.mockResolvedValue({ status: 'active' });
    listTenants.mockResolvedValue([{ _id: 'tenant-a', name: 'A' }, { _id: 'tenant-b', name: 'B' }]);
  });

  test('aucun header ne part avant une sélection validée', async () => {
    const { result } = renderHook(() => usePlatformTenantRuntime(), { wrapper });
    await waitFor(() => expect(result.current.tenantReady).toBe(true));
    const config = await api.interceptors.request.handlers[0].fulfilled({ headers: {} });
    expect(config.headers['X-Platform-Tenant-Id']).toBeUndefined();
    expect(result.current.tenantRequired).toBe(true);
  });

  test('une sélection validée est injectée et un changement remplace le header', async () => {
    const { result } = renderHook(() => usePlatformTenantRuntime(), { wrapper });
    await waitFor(() => expect(result.current.tenantReady).toBe(true));
    act(() => result.current.selectTenant('tenant-a'));
    let config = await api.interceptors.request.handlers[0].fulfilled({ headers: {} });
    expect(config.headers['X-Platform-Tenant-Id']).toBe('tenant-a');
    act(() => result.current.selectTenant('tenant-b'));
    config = await api.interceptors.request.handlers[0].fulfilled({ headers: {} });
    expect(config.headers['X-Platform-Tenant-Id']).toBe('tenant-b');
  });

  test('une requête platform-scoped n’injecte jamais le tenant sélectionné', async () => {
    const { result } = renderHook(() => usePlatformTenantRuntime(), { wrapper });
    await waitFor(() => expect(result.current.tenantReady).toBe(true));
    act(() => result.current.selectTenant('tenant-a'));
    const config = await api.interceptors.request.handlers[0].fulfilled({
      headers: { 'X-Platform-Tenant-Id': 'tenant-forged' },
      platformScoped: true,
    });
    expect(config.headers['X-Platform-Tenant-Id']).toBeUndefined();
  });

  test('reload restaure seulement le tenant autorisé lié au même utilisateur', async () => {
    localStorage.setItem('platformOperatorTenantSelection', JSON.stringify({ userId: 'operator-a', tenantId: 'tenant-a' }));
    const { result } = renderHook(() => usePlatformTenantRuntime(), { wrapper });
    await waitFor(() => expect(result.current.selectedTenantId).toBe('tenant-a'));
  });

  test.each([
    [{ userId: 'operator-b', tenantId: 'tenant-a' }],
    [{ userId: 'operator-a', tenantId: 'tenant-z' }],
  ])('refuse une sélection héritée ou non autorisée : %o', async (selection) => {
    localStorage.setItem('platformOperatorTenantSelection', JSON.stringify(selection));
    const { result } = renderHook(() => usePlatformTenantRuntime(), { wrapper });
    await waitFor(() => expect(result.current.tenantReady).toBe(true));
    expect(result.current.selectedTenantId).toBeNull();
    expect(localStorage.getItem('platformOperatorTenantSelection')).toBeNull();
  });
});
