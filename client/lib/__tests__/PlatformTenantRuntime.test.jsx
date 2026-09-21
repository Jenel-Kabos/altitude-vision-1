import { act, renderHook, waitFor } from '@testing-library/react';
import { PlatformTenantRuntimeProvider, usePlatformTenantRuntime } from '../context/PlatformTenantRuntimeContext';
import { getMyOperatorStatus } from '../services/platformOperatorService';
import { listAccessibleTenants, listTenants } from '../services/platformTenantService';
import api, { clearValidatedPlatformTenant, setValidatedPlatformTenant } from '../services/api';

let authUser = { _id: 'operator-a', role: 'Admin' };
vi.mock('../context/AuthContext', () => ({ useAuth: () => ({ user: authUser, loading: false }) }));
vi.mock('../services/platformOperatorService', () => ({ getMyOperatorStatus: vi.fn() }));
vi.mock('../services/platformTenantService', () => ({ listAccessibleTenants: vi.fn(), listTenants: vi.fn() }));

const wrapper = ({ children }) => <PlatformTenantRuntimeProvider>{children}</PlatformTenantRuntimeProvider>;

describe('runtime tenant plateforme', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    clearValidatedPlatformTenant();
    authUser = { _id: 'operator-a', role: 'Admin' };
    getMyOperatorStatus.mockResolvedValue({ status: 'active' });
    listAccessibleTenants.mockResolvedValue([
      { _id: 'tenant-a', name: 'A', businessRole: 'Admin', membership: { _id: 'membership-a', status: 'active', businessRole: 'Admin' } },
      { _id: 'tenant-b', name: 'B', businessRole: 'Collaborateur', membership: { _id: 'membership-b', status: 'active', businessRole: 'Collaborateur' } },
    ]);
    listTenants.mockResolvedValue([]);
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
    expect(result.current.tenantBusinessRole).toBe('Admin');
    expect(authUser.role).toBe('Admin');
    let config = await api.interceptors.request.handlers[0].fulfilled({ headers: {} });
    expect(config.headers['X-Platform-Tenant-Id']).toBe('tenant-a');
    act(() => result.current.selectTenant('tenant-b'));
    expect(result.current.tenantBusinessRole).toBe('Collaborateur');
    config = await api.interceptors.request.handlers[0].fulfilled({ headers: {} });
    expect(config.headers['X-Platform-Tenant-Id']).toBe('tenant-b');
  });

  test('SWITCH-01..04 / UIROLE-01 : un Proprietaire découvre et sélectionne ses rôles tenant sans mutation globale', async () => {
    authUser = { _id: 'owner-a', role: 'Proprietaire' };
    getMyOperatorStatus.mockResolvedValue(null);
    const { result } = renderHook(() => usePlatformTenantRuntime(), { wrapper });
    await waitFor(() => expect(result.current.tenants).toHaveLength(2));
    expect(getMyOperatorStatus).not.toHaveBeenCalled();
    act(() => result.current.selectTenant('tenant-a'));
    expect(result.current.isTenantAdmin).toBe(true);
    expect(result.current.tenantBusinessRole).toBe('Admin');
    expect(authUser.role).toBe('Proprietaire');
    act(() => result.current.selectTenant('tenant-b'));
    expect(result.current.isTenantAdmin).toBe(false);
    expect(result.current.tenantBusinessRole).toBe('Collaborateur');
    expect(authUser.role).toBe('Proprietaire');
  });

  test.each([
    ['Admin', 'UIROLE-02'],
    ['Client', 'SWITCH-07/UIROLE-03'],
  ])('%s sans membership ne reçoit aucun rôle tenant (%s)', async (role) => {
    authUser = { _id: `empty-${role}`, role };
    listAccessibleTenants.mockResolvedValue([]);
    getMyOperatorStatus.mockResolvedValue(null);
    const { result } = renderHook(() => usePlatformTenantRuntime(), { wrapper });
    await waitFor(() => expect(result.current.tenantReady).toBe(true));
    expect(result.current.tenants).toEqual([]);
    expect(result.current.tenantBusinessRole).toBeNull();
    expect(result.current.isTenantAdmin).toBe(false);
  });

  test('SWITCH-09 : changer seulement le header validé ne synthétise jamais de businessRole', async () => {
    listAccessibleTenants.mockResolvedValue([]);
    setValidatedPlatformTenant('tenant-forged');
    const { result } = renderHook(() => usePlatformTenantRuntime(), { wrapper });
    await waitFor(() => expect(result.current.tenantReady).toBe(true));
    expect(result.current.selectedTenantId).toBeNull();
    expect(result.current.tenantBusinessRole).toBeNull();
    const config = await api.interceptors.request.handlers[0].fulfilled({ headers: {} });
    expect(config.headers['X-Platform-Tenant-Id']).toBeUndefined();
  });

  test('SWITCH-08 : une membership suspendue/révoquée n’est ni visible ni sélectionnable', async () => {
    authUser = { _id: 'owner-suspended', role: 'Proprietaire' };
    listAccessibleTenants.mockResolvedValue([
      { _id: 'tenant-a', membership: { status: 'suspended', businessRole: 'Admin' } },
      { _id: 'tenant-b', membership: { status: 'revoked', businessRole: 'Admin' } },
    ]);
    const { result } = renderHook(() => usePlatformTenantRuntime(), { wrapper });
    await waitFor(() => expect(result.current.tenantReady).toBe(true));
    expect(result.current.tenants).toEqual([]);
    act(() => result.current.selectTenant('tenant-a'));
    expect(result.current.selectedTenantId).toBeNull();
  });

  test('SWITCH-10 : un changement de session efface le rôle tenant périmé', async () => {
    const view = renderHook(() => usePlatformTenantRuntime(), { wrapper });
    await waitFor(() => expect(view.result.current.tenantReady).toBe(true));
    act(() => view.result.current.selectTenant('tenant-a'));
    expect(view.result.current.tenantBusinessRole).toBe('Admin');
    authUser = null;
    view.rerender();
    await waitFor(() => expect(view.result.current.tenantBusinessRole).toBeNull());
    expect(view.result.current.selectedTenantId).toBeNull();
    expect(localStorage.getItem('platformOperatorTenantSelection')).toBeNull();
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
