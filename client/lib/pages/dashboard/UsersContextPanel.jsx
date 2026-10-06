'use client';

// C2.9 (Users) — /dashboard/users change de SOURCE DE DONNÉES selon le contexte :
//   Vue plateforme → UsersPanel  (User : registre global, rôle plateforme)
//   Vue tenant     → MembersPanel (OrgMembership : membres du tenant sélectionné)
// `key={scope.key}` remonte le panneau à chaque changement de contexte : aucune
// donnée d'un contexte précédent ne peut subsister. Le serveur reste l'autorité
// (en-tête X-Platform-Tenant-Id posé par services/api.js).
import React from 'react';
import { usePlatformTenantRuntime } from '../../context/PlatformTenantRuntimeContext';
import UsersPanel from './UsersPanel';
import MembersPanel from './MembersPanel';

export default function UsersContextPanel() {
  const { scope, tenantReady } = usePlatformTenantRuntime();
  if (tenantReady === false) {
    return <div className="m-6 rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500" role="status">Chargement du contexte…</div>;
  }
  if (scope?.mode === 'platform') return <UsersPanel key={scope.key} />;
  if (scope?.mode === 'tenant') return <MembersPanel key={scope.key} />;
  return (
    <div className="m-6 rounded-2xl border border-amber-200 bg-amber-50 p-6">
      <h1 className="text-lg font-bold text-amber-900">Contexte requis</h1>
      <p className="mt-1 text-sm text-amber-800">Sélectionnez la Vue plateforme ou une organisation pour afficher ses utilisateurs ou ses membres.</p>
    </div>
  );
}
