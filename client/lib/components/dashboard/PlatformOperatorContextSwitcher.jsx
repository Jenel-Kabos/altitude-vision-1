"use client";
// PLATFORM-ADMIN-1 — sélecteur de contexte pour un PlatformOperator actif.
// N'affiche RIEN pour un utilisateur ordinaire (y compris un Admin sans
// capacité opérateur) : le composant s'auto-désactive dès que
// `getMyOperatorStatus()` ne retourne pas un opérateur `active` — la
// visibilité de cette UI suit exactement la même source de vérité que le
// backend (aucune déduction séparée côté client).
import React, { useCallback } from 'react';
import { Building2, Globe2 } from 'lucide-react';
import { usePlatformTenantRuntime } from '../../context/PlatformTenantRuntimeContext';

const GOLD = '#C8960C';

export default function PlatformOperatorContextSwitcher() {
  const { operator, tenants, selectedTenantId, selectTenant, tenantLoading } = usePlatformTenantRuntime();

  const handleChange = useCallback((event) => {
    const value = event.target.value || null;
    selectTenant(value);
    // Le contexte tenant affecte toutes les requêtes déjà en cache/à venir —
    // un rechargement complet évite un état d'affichage incohérent entre
    // plusieurs composants qui auraient déjà chargé des données de l'ancien
    // contexte avant le changement.
    if (typeof window !== 'undefined') window.location.reload();
  }, [selectTenant]);

  if (tenantLoading || !operator || operator.status !== 'active') return null;

  const currentTenant = tenants.find((t) => String(t._id) === String(selectedTenantId));

  return (
    <div className="px-3 py-2 mb-2 rounded-lg border" style={{ borderColor: GOLD, backgroundColor: '#FFFBEB' }}>
      <div className="flex items-center gap-2 text-xs font-semibold mb-1.5" style={{ color: GOLD }}>
        {currentTenant ? <Building2 size={14} /> : <Globe2 size={14} />}
        <span>Contexte : {currentTenant ? currentTenant.name : 'Vue plateforme'}</span>
      </div>
      <select
        value={selectedTenantId || ''}
        onChange={handleChange}
        className="w-full text-sm rounded-md border border-gray-300 px-2 py-1.5 bg-white"
        aria-label="Sélectionner le tenant à administrer"
      >
        <option value="">Vue plateforme (tous les tenants)</option>
        {tenants.map((tenant) => (
          <option key={tenant._id} value={tenant._id}>{tenant.name}</option>
        ))}
      </select>
    </div>
  );
}
