"use client";
import { useCallback, useEffect, useState } from 'react';
import { getTenantDashboard, getTenantDocuments, getTenantLeases, getTenantMaintenance, getTenantNotice, getTenantPayments, getTenantProfile } from '../services/tenantPortalService';

export default function useTenantPortal() {
  const [state, setState] = useState({ loading: true, error: '', dashboard: null, profile: null, leases: [], payments: { payments: [], summary: {} }, documents: { documents: [] }, notice: null, maintenance: { tickets: [] } });
  const reload = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: '' }));
    try {
      const [dashboard, profile, leases, payments, documents, notice, maintenance] = await Promise.all([getTenantDashboard(), getTenantProfile(), getTenantLeases(), getTenantPayments(), getTenantDocuments(), getTenantNotice(), getTenantMaintenance()]);
      setState({ loading: false, error: '', dashboard, profile, leases, payments, documents, notice, maintenance });
    } catch (error) { setState((s) => ({ ...s, loading: false, error: error.response?.data?.message || 'Impossible de charger votre espace locataire.' })); }
  }, []);
  useEffect(() => { reload(); }, [reload]);
  return { ...state, reload };
}
