"use client";

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useAuth } from './AuthContext';
import { getMyOperatorStatus } from '../services/platformOperatorService';
import { listAccessibleTenants, listTenants } from '../services/platformTenantService';
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
  selectedTenant: null,
  tenantMembership: null,
  tenantBusinessRole: null,
  isTenantAdmin: false,
  selectTenant: () => {},
  can: () => false,
};
const TenantRuntimeContext = createContext(DEFAULT_RUNTIME);
const userIdOf = (user) => String(user?._id || user?.id || '');

export function PlatformTenantRuntimeProvider({ children }) {
  const { user, loading: authLoading, can: roleCan } = useAuth();
  const runtimeUserId = userIdOf(user);
  const globalRole = user?.role;
  const [state, setState] = useState({ loading: true, operator: null, tenants: [], selectedTenantId: null });

  useEffect(() => {
    let cancelled = false;
    clearValidatedPlatformTenant();

    const initialize = async () => {
      const userId = runtimeUserId;
      if (authLoading) return;
      if (!userId) {
        localStorage.removeItem(STORAGE_KEY);
        localStorage.removeItem(LEGACY_STORAGE_KEY);
        if (!cancelled) setState({ loading: false, operator: null, tenants: [], selectedTenantId: null });
        return;
      }

      try {
        const [accessibleTenants, operator] = await Promise.all([
          listAccessibleTenants(),
          globalRole === 'Admin' ? getMyOperatorStatus().catch(() => null) : Promise.resolve(null),
        ]);
        const canonicalAccessibleTenants = (accessibleTenants || []).filter(
          (tenant) => tenant.membership?.status === 'active' && tenant.membership?.businessRole,
        );
        const platformTenants = operator?.status === 'active' ? await listTenants().catch(() => []) : [];
        const tenantsById = new Map((platformTenants || []).map((tenant) => [String(tenant._id), tenant]));
        canonicalAccessibleTenants.forEach((tenant) => tenantsById.set(String(tenant._id), tenant));
        const tenants = [...tenantsById.values()];
        let persisted = null;
        try { persisted = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null'); } catch { persisted = null; }
        const selectedTenantId = persisted?.userId === userId
          && (tenants || []).some((tenant) => String(tenant._id) === String(persisted.tenantId))
          ? String(persisted.tenantId)
          : null;
        localStorage.removeItem(LEGACY_STORAGE_KEY);
        if (selectedTenantId) setValidatedPlatformTenant(selectedTenantId);
        else localStorage.removeItem(STORAGE_KEY);
        if (!cancelled) setState({
          loading: false,
          operator: operator?.status === 'active' ? operator : null,
          tenants: tenants || [],
          selectedTenantId,
        });
      } catch {
        localStorage.removeItem(STORAGE_KEY);
        localStorage.removeItem(LEGACY_STORAGE_KEY);
        if (!cancelled) setState({ loading: false, operator: null, tenants: [], selectedTenantId: null });
      }
    };
    initialize();
    return () => { cancelled = true; };
  }, [authLoading, runtimeUserId, globalRole]);

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

  // PLATFORM-ADMIN-CAP-1 — seul point de composition entre les capacités de
  // rôle (RBAC-2, `getEffectiveCapabilities`) et les capacités PlatformOperator
  // (grant explicite, jamais déduites d'un rôle). `state.operator` n'est
  // jamais renseigné sauf `status === 'active'` (voir `initialize` ci-dessus),
  // mais la vérification du statut reste explicite ici par défense en
  // profondeur — fail closed si absent/suspendu/révoqué/en erreur.
  const can = useCallback((capability) => {
    // Platform capabilities are never inherited from User.role (including
    // the legacy Admin wildcard). They require an active PlatformOperator.
    if (String(capability || '').startsWith('platform.')) {
      return Boolean(state.operator?.status === 'active' && state.operator.capabilities?.includes(capability));
    }
    return roleCan?.(capability) || false;
  }, [roleCan, state.operator]);

  const selectedTenant = useMemo(
    () => state.tenants.find((tenant) => String(tenant._id) === String(state.selectedTenantId)) || null,
    [state.selectedTenantId, state.tenants],
  );
  const tenantMembership = selectedTenant?.membership?.status === 'active' ? selectedTenant.membership : null;
  const tenantBusinessRole = tenantMembership?.businessRole || null;

  const value = useMemo(() => ({
    tenantLoading: authLoading || state.loading,
    tenantReady: !authLoading && !state.loading,
    tenantRequired: state.tenants.length > 0 || state.operator?.status === 'active',
    operator: state.operator,
    tenants: state.tenants,
    selectedTenantId: state.selectedTenantId,
    selectedTenant,
    tenantMembership,
    tenantBusinessRole,
    isTenantAdmin: tenantBusinessRole === 'Admin',
    selectTenant,
    can,
  }), [authLoading, state, selectedTenant, tenantMembership, tenantBusinessRole, selectTenant, can]);

  return <TenantRuntimeContext.Provider value={value}>{children}</TenantRuntimeContext.Provider>;
}

export function usePlatformTenantRuntime() {
  return useContext(TenantRuntimeContext);
}
