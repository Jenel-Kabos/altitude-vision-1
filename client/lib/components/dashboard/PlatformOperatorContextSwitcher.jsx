"use client";
// PLATFORM-ADMIN-1 — sélecteur de contexte pour un PlatformOperator actif.
// N'affiche RIEN pour un utilisateur ordinaire (y compris un Admin sans
// capacité opérateur) : le composant s'auto-désactive dès que
// `getMyOperatorStatus()` ne retourne pas un opérateur `active` — la
// visibilité de cette UI suit exactement la même source de vérité que le
// backend (aucune déduction séparée côté client).
import React, { useEffect, useState, useCallback } from 'react';
import { Building2, Globe2 } from 'lucide-react';
import {
  getMyOperatorStatus,
  getSelectedPlatformTenantId,
  setSelectedPlatformTenantId,
} from '../../services/platformOperatorService';
import { listTenants } from '../../services/platformTenantService';

const GOLD = '#C8960C';

export default function PlatformOperatorContextSwitcher() {
  const [operator, setOperator] = useState(null);
  const [tenants, setTenants] = useState([]);
  const [selectedTenantId, setSelectedTenantIdState] = useState(getSelectedPlatformTenantId());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const status = await getMyOperatorStatus();
        if (cancelled) return;
        setOperator(status);
        if (status?.status === 'active') {
          const list = await listTenants();
          if (!cancelled) setTenants(list || []);
        }
      } catch {
        if (!cancelled) setOperator(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const handleChange = useCallback((event) => {
    const value = event.target.value || null;
    setSelectedPlatformTenantId(value);
    setSelectedTenantIdState(value);
    // Le contexte tenant affecte toutes les requêtes déjà en cache/à venir —
    // un rechargement complet évite un état d'affichage incohérent entre
    // plusieurs composants qui auraient déjà chargé des données de l'ancien
    // contexte avant le changement.
    if (typeof window !== 'undefined') window.location.reload();
  }, []);

  if (loading || !operator || operator.status !== 'active') return null;

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
