import { renderHook, waitFor } from '@testing-library/react';
import { PlatformTenantRuntimeProvider, usePlatformTenantRuntime } from '../context/PlatformTenantRuntimeContext';
import { getMyOperatorStatus } from '../services/platformOperatorService';
import { listAccessibleTenants, listTenants } from '../services/platformTenantService';
import { clearValidatedPlatformTenant } from '../services/api';

let authUser = { _id: 'operator-a', role: 'Admin' };
let roleCapabilities = [];
vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({
    user: authUser,
    loading: false,
    can: (capability) => roleCapabilities.includes(capability),
  }),
}));
vi.mock('../services/platformOperatorService', () => ({ getMyOperatorStatus: vi.fn() }));
vi.mock('../services/platformTenantService', () => ({ listAccessibleTenants: vi.fn(), listTenants: vi.fn() }));

const wrapper = ({ children }) => <PlatformTenantRuntimeProvider>{children}</PlatformTenantRuntimeProvider>;
const CAPABILITY = 'platform.tenant_applications.read';

describe('propagation des capacités PlatformOperator vers can()', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    clearValidatedPlatformTenant();
    authUser = { _id: 'operator-a', role: 'Admin' };
    roleCapabilities = [];
    // La découverte des memberships précède la composition des capacités.
    listAccessibleTenants.mockResolvedValue([]);
    listTenants.mockResolvedValue([]);
  });

  test('CAP-02 — un opérateur actif avec la capacité rend can() vrai', async () => {
    getMyOperatorStatus.mockResolvedValue({ status: 'active', capabilities: [CAPABILITY] });
    const { result } = renderHook(() => usePlatformTenantRuntime(), { wrapper });
    await waitFor(() => expect(result.current.tenantReady).toBe(true));
    expect(result.current.can(CAPABILITY)).toBe(true);
    expect(listAccessibleTenants).toHaveBeenCalledOnce();
    expect(result.current.tenantMembership).toBeNull();
    expect(result.current.tenantBusinessRole).toBeNull();
    expect(result.current.isTenantAdmin).toBe(false);
  });

  test('CAP-03 — un opérateur suspendu avec la capacité ne débloque rien', async () => {
    getMyOperatorStatus.mockResolvedValue({ status: 'suspended', capabilities: [CAPABILITY] });
    const { result } = renderHook(() => usePlatformTenantRuntime(), { wrapper });
    await waitFor(() => expect(result.current.tenantReady).toBe(true));
    expect(result.current.can(CAPABILITY)).toBe(false);
  });

  test('CAP-04 — aucun PlatformOperator associé au compte', async () => {
    getMyOperatorStatus.mockResolvedValue(null);
    const { result } = renderHook(() => usePlatformTenantRuntime(), { wrapper });
    await waitFor(() => expect(result.current.tenantReady).toBe(true));
    expect(result.current.can(CAPABILITY)).toBe(false);
  });

  test('CAP-05 — un Admin sans PlatformOperator ne reçoit jamais la capacité par le rôle', async () => {
    roleCapabilities = [CAPABILITY];
    getMyOperatorStatus.mockResolvedValue({ status: 'active', capabilities: [] });
    const { result } = renderHook(() => usePlatformTenantRuntime(), { wrapper });
    await waitFor(() => expect(result.current.tenantReady).toBe(true));
    expect(result.current.can(CAPABILITY)).toBe(false);
  });

  test('CAP-06 — un Tenant Admin (compte non Admin) reste bloqué même avec un enregistrement fantôme', async () => {
    authUser = { _id: 'tenant-admin-1', role: 'Admin' };
    getMyOperatorStatus.mockRejectedValue(new Error('réseau indisponible'));
    const { result } = renderHook(() => usePlatformTenantRuntime(), { wrapper });
    await waitFor(() => expect(result.current.tenantReady).toBe(true));
    expect(result.current.can(CAPABILITY)).toBe(false);
  });

  test('CAP-01 — une capacité de rôle classique continue de fonctionner sans opérateur', async () => {
    roleCapabilities = ['documents.read'];
    getMyOperatorStatus.mockResolvedValue(null);
    const { result } = renderHook(() => usePlatformTenantRuntime(), { wrapper });
    await waitFor(() => expect(result.current.tenantReady).toBe(true));
    expect(result.current.can('documents.read')).toBe(true);
  });
});
