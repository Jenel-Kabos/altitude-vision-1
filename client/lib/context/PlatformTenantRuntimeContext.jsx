"use client";

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useAuth } from './AuthContext';
import { getMyOperatorStatus } from '../services/platformOperatorService';
import { listTenants } from '../services/platformTenantService';
import { clearValidatedPlatformTenant, setValidatedPlatformTenant } from '../services/api';

const STORAGE_KEY = 'platformOperatorTenantSelection';
const LEGACY_STORAGE_KEY = 'platformOperatorTenantId';
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

export function PlatformTenantRuntimeProvider({ children }) {
  const { user, loading: authLoading } = useAuth();
  const [state, setState] = useState({ loading: true, operator: null, tenants: [], selectedTenantId: null });

  useEffect(() => {
    let cancelled = false;
    clearValidatedPlatformTenant();

    const initialize = async () => {
      const userId = userIdOf(user);
      if (authLoading) return;
      if (!userId || user?.role !== 'Admin') {
        localStorage.removeItem(STORAGE_KEY);
        localStorage.removeItem(LEGACY_STORAGE_KEY);
        if (!cancelled) setState({ loading: false, operator: null, tenants: [], selectedTenantId: null });
        return;
      }

      try {
        const operator = await getMyOperatorStatus();
        if (!operator || operator.status !== 'active') {
          localStorage.removeItem(STORAGE_KEY);
          localStorage.removeItem(LEGACY_STORAGE_KEY);
          if (!cancelled) setState({ loading: false, operator: null, tenants: [], selectedTenantId: null });
          return;
        }
        const tenants = await listTenants();
        let persisted = null;
        try { persisted = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null'); } catch { persisted = null; }
        const selectedTenantId = persisted?.userId === userId
          && (tenants || []).some((tenant) => String(tenant._id) === String(persisted.tenantId))
          ? String(persisted.tenantId)
          : null;
        localStorage.removeItem(LEGACY_STORAGE_KEY);
        if (selectedTenantId) setValidatedPlatformTenant(selectedTenantId);
        else localStorage.removeItem(STORAGE_KEY);
        if (!cancelled) setState({ loading: false, operator, tenants: tenants || [], selectedTenantId });
      } catch {
        localStorage.removeItem(STORAGE_KEY);
        localStorage.removeItem(LEGACY_STORAGE_KEY);
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
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ userId, tenantId: validId }));
      setValidatedPlatformTenant(validId);
    } else {
      localStorage.removeItem(STORAGE_KEY);
      clearValidatedPlatformTenant();
    }
    setState((current) => ({ ...current, selectedTenantId: validId }));
    window.dispatchEvent(new CustomEvent('altimmo:platform-operator:tenant-changed', { detail: { tenantId: validId } }));
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
