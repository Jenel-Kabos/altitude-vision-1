import React from 'react';
import { Text, View } from 'react-native';
import { act, render, waitFor } from '@testing-library/react-native';
import * as SecureStore from 'expo-secure-store';

let mockUser = { _id: 'admin-1', role: 'Admin' };
let mockAuthLoading = false;
jest.mock('../AuthContext', () => ({
  useAuth: () => ({ user: mockUser, loading: mockAuthLoading }),
}));

const mockGetMyOperatorStatus = jest.fn();
const mockListTenants = jest.fn();
jest.mock('../../services/platformTenantService', () => ({
  getMyOperatorStatus: (...args) => mockGetMyOperatorStatus(...args),
  listTenants: (...args) => mockListTenants(...args),
}));

const mockSetValidatedPlatformTenant = jest.fn();
const mockClearValidatedPlatformTenant = jest.fn();
jest.mock('../../services/api', () => ({
  setValidatedPlatformTenant: (...args) => mockSetValidatedPlatformTenant(...args),
  clearValidatedPlatformTenant: (...args) => mockClearValidatedPlatformTenant(...args),
}));

import { PlatformTenantRuntimeProvider, usePlatformTenantRuntime } from '../PlatformTenantRuntimeContext';

function Harness({ onSelect }) {
  const runtime = usePlatformTenantRuntime();
  return (
    <View>
      <Text testID="ready">{String(runtime.tenantReady)}</Text>
      <Text testID="selected">{runtime.selectedTenantId || ''}</Text>
      <Text testID="tenants-count">{runtime.tenants.length}</Text>
      {onSelect && onSelect(runtime.selectTenant)}
    </View>
  );
}

describe('PlatformTenantRuntimeProvider', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUser = { _id: 'admin-1', role: 'Admin' };
    mockAuthLoading = false;
    SecureStore.getItemAsync.mockResolvedValue(null);
  });

  test("n'appelle jamais le backend tenant pour un utilisateur non-Admin (même garde que le Web)", async () => {
    mockUser = { _id: 'client-1', role: 'Client' };
    render(<PlatformTenantRuntimeProvider><Harness /></PlatformTenantRuntimeProvider>);
    await waitFor(() => expect(mockGetMyOperatorStatus).not.toHaveBeenCalled());
    expect(mockListTenants).not.toHaveBeenCalled();
    expect(mockSetValidatedPlatformTenant).not.toHaveBeenCalled();
  });

  test("n'injecte aucun tenant pour un Admin qui n'est pas un PlatformOperator actif", async () => {
    mockGetMyOperatorStatus.mockResolvedValue(null);
    const screen = render(<PlatformTenantRuntimeProvider><Harness /></PlatformTenantRuntimeProvider>);
    await waitFor(() => expect(screen.getByTestId('ready').props.children).toBe('true'));
    expect(mockListTenants).not.toHaveBeenCalled();
    expect(screen.getByTestId('selected').props.children).toBe('');
  });

  test('tenant absent : aucune sélection persistée ne pollue le runtime', async () => {
    mockGetMyOperatorStatus.mockResolvedValue({ status: 'active' });
    mockListTenants.mockResolvedValue([{ _id: 'tenant-a' }, { _id: 'tenant-b' }]);
    SecureStore.getItemAsync.mockResolvedValue(null);
    const screen = render(<PlatformTenantRuntimeProvider><Harness /></PlatformTenantRuntimeProvider>);
    await waitFor(() => expect(screen.getByTestId('tenants-count').props.children).toBe(2));
    expect(screen.getByTestId('selected').props.children).toBe('');
    expect(mockSetValidatedPlatformTenant).not.toHaveBeenCalled();
  });

  test('tenant persisté et toujours autorisé : revalidé puis injecté', async () => {
    mockGetMyOperatorStatus.mockResolvedValue({ status: 'active' });
    mockListTenants.mockResolvedValue([{ _id: 'tenant-a' }, { _id: 'tenant-b' }]);
    SecureStore.getItemAsync.mockResolvedValue(JSON.stringify({ userId: 'admin-1', tenantId: 'tenant-b' }));
    const screen = render(<PlatformTenantRuntimeProvider><Harness /></PlatformTenantRuntimeProvider>);
    await waitFor(() => expect(screen.getByTestId('selected').props.children).toBe('tenant-b'));
    expect(mockSetValidatedPlatformTenant).toHaveBeenCalledWith('tenant-b');
  });

  test('tenant persisté mais périmé (plus dans la liste autorisée) : jamais injecté, jamais fait confiance', async () => {
    mockGetMyOperatorStatus.mockResolvedValue({ status: 'active' });
    mockListTenants.mockResolvedValue([{ _id: 'tenant-a' }]);
    SecureStore.getItemAsync.mockResolvedValue(JSON.stringify({ userId: 'admin-1', tenantId: 'tenant-removed' }));
    const screen = render(<PlatformTenantRuntimeProvider><Harness /></PlatformTenantRuntimeProvider>);
    await waitFor(() => expect(screen.getByTestId('tenants-count').props.children).toBe(1));
    expect(screen.getByTestId('selected').props.children).toBe('');
    expect(mockSetValidatedPlatformTenant).not.toHaveBeenCalled();
  });

  test("tenant persisté pour un AUTRE utilisateur (userId différent) : jamais réutilisé après changement de compte", async () => {
    mockGetMyOperatorStatus.mockResolvedValue({ status: 'active' });
    mockListTenants.mockResolvedValue([{ _id: 'tenant-a' }]);
    SecureStore.getItemAsync.mockResolvedValue(JSON.stringify({ userId: 'un-autre-admin', tenantId: 'tenant-a' }));
    const screen = render(<PlatformTenantRuntimeProvider><Harness /></PlatformTenantRuntimeProvider>);
    await waitFor(() => expect(screen.getByTestId('tenants-count').props.children).toBe(1));
    expect(screen.getByTestId('selected').props.children).toBe('');
    expect(mockSetValidatedPlatformTenant).not.toHaveBeenCalled();
  });

  test('selectTenant valide contre la liste réelle avant toute injection', async () => {
    mockGetMyOperatorStatus.mockResolvedValue({ status: 'active' });
    mockListTenants.mockResolvedValue([{ _id: 'tenant-a' }]);
    let select;
    const screen = render(
      <PlatformTenantRuntimeProvider>
        <Harness onSelect={(fn) => { select = fn; return null; }} />
      </PlatformTenantRuntimeProvider>,
    );
    await waitFor(() => expect(screen.getByTestId('tenants-count').props.children).toBe(1));

    await act(async () => select('tenant-inexistant'));
    expect(screen.getByTestId('selected').props.children).toBe('');
    expect(mockSetValidatedPlatformTenant).not.toHaveBeenCalled();

    await act(async () => select('tenant-a'));
    expect(screen.getByTestId('selected').props.children).toBe('tenant-a');
    expect(mockSetValidatedPlatformTenant).toHaveBeenCalledWith('tenant-a');
  });

  test('logout (auth passe à loading) réinitialise le gate en mémoire du client API', async () => {
    mockGetMyOperatorStatus.mockResolvedValue({ status: 'active' });
    mockListTenants.mockResolvedValue([{ _id: 'tenant-a' }]);
    SecureStore.getItemAsync.mockResolvedValue(JSON.stringify({ userId: 'admin-1', tenantId: 'tenant-a' }));
    const { rerender } = render(<PlatformTenantRuntimeProvider><Harness /></PlatformTenantRuntimeProvider>);
    await waitFor(() => expect(mockSetValidatedPlatformTenant).toHaveBeenCalledWith('tenant-a'));

    mockClearValidatedPlatformTenant.mockClear();
    mockUser = null;
    rerender(<PlatformTenantRuntimeProvider><Harness /></PlatformTenantRuntimeProvider>);
    await waitFor(() => expect(mockClearValidatedPlatformTenant).toHaveBeenCalled());
  });
});
