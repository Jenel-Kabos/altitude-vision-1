import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import * as SecureStore from 'expo-secure-store';
import { useAuth } from './AuthContext';
import { getMyOperatorStatus, listTenants } from '../services/platformTenantService';
import { clearValidatedPlatformTenant, setValidatedPlatformTenant } from '../services/api';

// SYNC-2A — même contrat que client/lib/context/PlatformTenantRuntimeContext.jsx
// (AUTH-1.1), adapté aux primitives Mobile (SecureStore au lieu de
// localStorage, pas d'événement `window` — le contexte React est la seule
// source de vérité consommée par les futurs écrans staff SYNC-2B/2C).
//
// Aucun utilisateur ordinaire ne se voit imposer un tenant : seul un
// PlatformOperator actif (role Admin + statut opérateur actif, résolu par le
// backend) déclenche la résolution. Une sélection persistée n'est JAMAIS
// injectée dans l'en-tête sans être revalidée contre la liste de tenants
// réellement retournée par le serveur pour l'utilisateur courant.

const STORAGE_KEY = 'platform_tenant_selection';
const DEFAULT_RUNTIME = {
  tenantLoading: false,
  tenantReady: true,
  tenantRequired: false,
  operator: null,
  tenants: [],
  selectedTenantId: null,
  selectTenant: () => {},
};
const TenantRuntimeContext = createContext(DEFAULT_RUNTIME);
const userIdOf = (user) => String(user?._id || user?.id || '');

async function readPersistedSelection() {
  try {
    const raw = await SecureStore.getItemAsync(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}
async function writePersistedSelection(userId, tenantId) {
  try {
    if (tenantId) await SecureStore.setItemAsync(STORAGE_KEY, JSON.stringify({ userId, tenantId }));
    else await SecureStore.deleteItemAsync(STORAGE_KEY);
  } catch { /* stockage indisponible : la sélection reste en mémoire pour la session en cours */ }
}

export function PlatformTenantRuntimeProvider({ children }) {
  const { user, loading: authLoading } = useAuth();
  const [state, setState] = useState({ loading: true, operator: null, tenants: [], selectedTenantId: null });

  useEffect(() => {
    let cancelled = false;
    clearValidatedPlatformTenant();

    const initialize = async () => {
      const userId = userIdOf(user);
      if (authLoading) return;
      // Même garde que le Web : seul un utilisateur role=Admin peut être un
      // PlatformOperator — aucun appel réseau superflu pour les autres.
      if (!userId || user?.role !== 'Admin') {
        await writePersistedSelection(null, null);
        if (!cancelled) setState({ loading: false, operator: null, tenants: [], selectedTenantId: null });
        return;
      }

      try {
        const operator = await getMyOperatorStatus();
        if (!operator || operator.status !== 'active') {
          await writePersistedSelection(null, null);
          if (!cancelled) setState({ loading: false, operator: null, tenants: [], selectedTenantId: null });
          return;
        }
        const tenants = await listTenants();
        const persisted = await readPersistedSelection();
        const selectedTenantId = persisted?.userId === userId
          && (tenants || []).some((tenant) => String(tenant._id) === String(persisted.tenantId))
          ? String(persisted.tenantId)
          : null;
        if (selectedTenantId) setValidatedPlatformTenant(selectedTenantId);
        else await writePersistedSelection(null, null);
        if (!cancelled) setState({ loading: false, operator, tenants: tenants || [], selectedTenantId });
      } catch {
        await writePersistedSelection(null, null);
        if (!cancelled) setState({ loading: false, operator: null, tenants: [], selectedTenantId: null });
      }
    };
    initialize();
    return () => { cancelled = true; };
  }, [authLoading, user?._id, user?.id, user?.role]);

  const selectTenant = useCallback((tenantId) => {
    const userId = userIdOf(user);
    const validId = tenantId && state.tenants.some((tenant) => String(tenant._id) === String(tenantId)) ? String(tenantId) : null;
    if (validId) {
      writePersistedSelection(userId, validId);
      setValidatedPlatformTenant(validId);
    } else {
      writePersistedSelection(null, null);
      clearValidatedPlatformTenant();
    }
    setState((current) => ({ ...current, selectedTenantId: validId }));
  }, [state.tenants, user]);

  const value = useMemo(() => ({
    tenantLoading: authLoading || state.loading,
    tenantReady: !authLoading && !state.loading,
    tenantRequired: state.operator?.status === 'active',
    operator: state.operator,
    tenants: state.tenants,
    selectedTenantId: state.selectedTenantId,
    selectTenant,
  }), [authLoading, state, selectTenant]);

  return <TenantRuntimeContext.Provider value={value}>{children}</TenantRuntimeContext.Provider>;
}

export function usePlatformTenantRuntime() {
  return useContext(TenantRuntimeContext);
}
