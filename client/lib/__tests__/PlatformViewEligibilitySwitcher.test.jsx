// PLATFORM-ADMIN-04A — Groupe G : l'entrée « Vue plateforme » n'existe que
// lorsque le backend déclare `platformViewEligible === true`. Le client ne
// recalcule jamais l'éligibilité à partir des capabilities, du rôle ou de
// l'absence de tenant.
import { act, render, renderHook, screen, waitFor } from '@testing-library/react';
import { PlatformTenantRuntimeProvider, usePlatformTenantRuntime } from '../context/PlatformTenantRuntimeContext';
import PlatformOperatorContextSwitcher from '../components/dashboard/PlatformOperatorContextSwitcher';
import { getMyOperatorStatus } from '../services/platformOperatorService';
import { listAccessibleTenants, listTenants } from '../services/platformTenantService';
import api, { clearValidatedPlatformTenant } from '../services/api';

const authUser = { _id: 'operator-1', role: 'Admin' };
vi.mock('../context/AuthContext', () => ({ useAuth: () => ({ user: authUser, loading: false }) }));
vi.mock('../services/platformOperatorService', () => ({ getMyOperatorStatus: vi.fn() }));
vi.mock('../services/platformTenantService', () => ({ listAccessibleTenants: vi.fn(), listTenants: vi.fn() }));

const ALL_CAPABILITIES = ['platform.tenants.read', 'platform.properties.read', 'platform.operators.manage'];
const tenants = [{ _id: 'tenant-a', name: 'Tenant A' }, { _id: 'tenant-b', name: 'Tenant B' }];
const wrapper = ({ children }) => <PlatformTenantRuntimeProvider>{children}</PlatformTenantRuntimeProvider>;
const renderSwitcher = () => render(<PlatformTenantRuntimeProvider><PlatformOperatorContextSwitcher /></PlatformTenantRuntimeProvider>);
const options = () => screen.getAllByRole('option').map((option) => option.textContent);

describe('PA-04A — éligibilité Vue plateforme côté web', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    clearValidatedPlatformTenant();
    listAccessibleTenants.mockResolvedValue([]);
    listTenants.mockResolvedValue(tenants);
  });

  test('opérateur éligible → le sélecteur propose « Vue plateforme »', async () => {
    getMyOperatorStatus.mockResolvedValue({ status: 'active', capabilities: ALL_CAPABILITIES, platformViewEligible: true });
    renderSwitcher();
    await waitFor(() => expect(screen.getByRole('combobox')).toBeInTheDocument());
    expect(options()).toEqual(['Vue plateforme', 'Tenant A', 'Tenant B']);
  });

  test('opérateur non éligible → aucune entrée « Vue plateforme », sélection de tenant requise', async () => {
    getMyOperatorStatus.mockResolvedValue({ status: 'active', capabilities: ALL_CAPABILITIES, platformViewEligible: false });
    renderSwitcher();
    await waitFor(() => expect(screen.getByRole('combobox')).toBeInTheDocument());
    expect(options()).not.toContain('Vue plateforme');
    expect(options()[0]).toBe('Sélectionner un tenant');
    expect(screen.getByText(/Sélection du tenant/)).toBeInTheDocument();
  });

  test('éligibilité absente de la réponse → jamais déduite des capabilities (fail-closed)', async () => {
    getMyOperatorStatus.mockResolvedValue({ status: 'active', capabilities: ALL_CAPABILITIES });
    const { result } = renderHook(() => usePlatformTenantRuntime(), { wrapper });
    await waitFor(() => expect(result.current.tenantReady).toBe(true));
    expect(result.current.platformViewEligible).toBe(false);
    expect(result.current.isPlatformView).toBe(false);
  });

  test('runtime éligible sans tenant → isPlatformView, aucun header tenant', async () => {
    getMyOperatorStatus.mockResolvedValue({ status: 'active', capabilities: ALL_CAPABILITIES, platformViewEligible: true });
    const { result } = renderHook(() => usePlatformTenantRuntime(), { wrapper });
    await waitFor(() => expect(result.current.tenantReady).toBe(true));
    expect(result.current.platformViewEligible).toBe(true);
    expect(result.current.isPlatformView).toBe(true);
    const config = await api.interceptors.request.handlers[0].fulfilled({ headers: {} });
    expect(config.headers['X-Platform-Tenant-Id']).toBeUndefined();
  });

  test('ancienne session en Vue plateforme + perte d’éligibilité → sortie du mode plateforme', async () => {
    // Session précédente : opérateur éligible en Vue plateforme (aucun tenant persisté).
    getMyOperatorStatus.mockResolvedValue({ status: 'active', capabilities: ALL_CAPABILITIES, platformViewEligible: true });
    const first = renderHook(() => usePlatformTenantRuntime(), { wrapper });
    await waitFor(() => expect(first.result.current.isPlatformView).toBe(true));
    first.unmount();

    // Rechargement : le backend ne le déclare plus éligible.
    getMyOperatorStatus.mockResolvedValue({ status: 'active', capabilities: ALL_CAPABILITIES, platformViewEligible: false });
    const { result } = renderHook(() => usePlatformTenantRuntime(), { wrapper });
    await waitFor(() => expect(result.current.tenantReady).toBe(true));
    expect(result.current.platformViewEligible).toBe(false);
    expect(result.current.isPlatformView).toBe(false);
    expect(result.current.selectedTenantId).toBeNull();
  });

  test('opérateur non éligible : désélectionner un tenant ne bascule jamais en Vue plateforme', async () => {
    getMyOperatorStatus.mockResolvedValue({ status: 'active', capabilities: ALL_CAPABILITIES, platformViewEligible: false });
    const { result } = renderHook(() => usePlatformTenantRuntime(), { wrapper });
    await waitFor(() => expect(result.current.tenants).toHaveLength(2));
    act(() => result.current.selectTenant('tenant-a'));
    expect(result.current.selectedTenantId).toBe('tenant-a');
    let config = await api.interceptors.request.handlers[0].fulfilled({ headers: {} });
    expect(config.headers['X-Platform-Tenant-Id']).toBe('tenant-a');
    act(() => result.current.selectTenant(null));
    expect(result.current.isPlatformView).toBe(false);
    config = await api.interceptors.request.handlers[0].fulfilled({ headers: {} });
    expect(config.headers['X-Platform-Tenant-Id']).toBeUndefined();
  });

  test('sélection persistée revalidée : un tenant persisté invalide est retiré', async () => {
    localStorage.setItem('platformOperatorTenantSelection', JSON.stringify({ userId: 'operator-1', tenantId: 'tenant-zombie' }));
    getMyOperatorStatus.mockResolvedValue({ status: 'active', capabilities: ALL_CAPABILITIES, platformViewEligible: false });
    const { result } = renderHook(() => usePlatformTenantRuntime(), { wrapper });
    await waitFor(() => expect(result.current.tenantReady).toBe(true));
    expect(result.current.selectedTenantId).toBeNull();
    expect(result.current.isPlatformView).toBe(false);
    expect(localStorage.getItem('platformOperatorTenantSelection')).toBeNull();
  });
});

describe('PA-04A — service /platform-operators/me', () => {
  test('mappe platformViewEligible du backend sur l’opérateur, false par défaut', async () => {
    const actual = await vi.importActual('../services/platformOperatorService');
    const spy = vi.spyOn(api, 'get');
    spy.mockResolvedValueOnce({ data: { data: { operator: { status: 'active' }, platformViewEligible: true } } });
    await expect(actual.getMyOperatorStatus()).resolves.toMatchObject({ status: 'active', platformViewEligible: true });
    spy.mockResolvedValueOnce({ data: { data: { operator: { status: 'active' } } } });
    await expect(actual.getMyOperatorStatus()).resolves.toMatchObject({ platformViewEligible: false });
    spy.mockResolvedValueOnce({ data: { data: { operator: null, platformViewEligible: false } } });
    await expect(actual.getMyOperatorStatus()).resolves.toBeNull();
    spy.mockRestore();
  });
});
