"use client";

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Building2, ChevronLeft, ChevronRight, Pause, Play, RefreshCw, Search, ShieldCheck, Trash2, UserRound, Users, X } from 'lucide-react';
import { usePlatformTenantRuntime } from '../../context/PlatformTenantRuntimeContext';
import { activateGlobalUser, deleteGlobalUser, getGlobalUser, listGlobalUsers, suspendGlobalUser } from '../../services/userService';

const EMPTY_STATS = { total: null, active: null, suspended: null, withoutOrganization: null };
const ROLES = ['Client', 'User', 'Proprietaire', 'Collaborateur', 'Secretaire', 'GestionnaireImmobilier', 'CommunityManager', 'Communicant', 'Admin', 'Prestataire'];
const formatDate = (value) => value ? new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium' }).format(new Date(value)) : '—';
const statusClass = (status) => status === 'Suspendu' ? 'bg-amber-50 text-amber-700' : status === 'Banni' ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700';
const ACTION_ERRORS = {
  LAST_PLATFORM_OPERATOR: 'Le dernier opérateur plateforme viable doit rester actif.',
  PLATFORM_OPERATOR_HARD_DELETE_REQUIRES_HUMAN_DECISION: 'Cette identité possède un historique opérateur et ne peut pas être supprimée physiquement.',
  SELF_ACTION_FORBIDDEN: 'Vous ne pouvez pas appliquer cette action à votre propre compte.',
  PLATFORM_OPERATOR_SELF_ACTION_FORBIDDEN: 'Vous ne pouvez pas appliquer cette action à votre propre compte.',
};

function StatCard({ label, value, tone }) {
  return <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{label}</p><p data-stat={tone} className="mt-2 text-3xl font-bold text-slate-900">{value ?? '—'}</p></div>;
}

function Memberships({ user, compact = false }) {
  if (!user.memberships?.length) return <span className="text-sm text-slate-500">Aucune organisation</span>;
  return <div className={`flex ${compact ? 'max-w-md flex-wrap gap-1.5' : 'flex-col gap-2'}`}>
    {user.memberships.map((membership) => {
      const label = membership.tenant?.name || membership.organization?.name || 'Organisation indisponible';
      return compact
        ? <span key={membership._id} className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">{label}</span>
        : <div key={membership._id} className="rounded-xl border border-slate-200 p-3"><p className="font-semibold text-slate-900">{label} — {membership.businessRole || 'Rôle non défini'}</p><p className="mt-1 text-xs text-slate-500">Membership {membership.status}</p></div>;
    })}
  </div>;
}

function UserDetail({ userId, onClose }) {
  const [state, setState] = useState({ loading: true, user: null, error: null });
  useEffect(() => {
    let current = true;
    getGlobalUser(userId).then((user) => current && setState({ loading: false, user, error: null }))
      .catch(() => current && setState({ loading: false, user: null, error: 'Impossible de charger cette fiche.' }));
    return () => { current = false; };
  }, [userId]);
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4" role="presentation">
    <section role="dialog" aria-modal="true" aria-label="Fiche utilisateur" className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl">
      <div className="flex items-start justify-between"><div><p className="text-xs font-semibold uppercase tracking-wider text-blue-600">Registre plateforme</p><h2 className="mt-1 text-2xl font-bold">Fiche utilisateur</h2></div><button type="button" aria-label="Fermer la fiche" onClick={onClose} className="rounded-full p-2 hover:bg-slate-100"><X size={18} /></button></div>
      {state.loading && <p className="py-12 text-center text-slate-500">Chargement de la fiche…</p>}
      {state.error && <p className="mt-6 rounded-xl bg-red-50 p-4 text-red-700">{state.error}</p>}
      {state.user && <div className="mt-6 space-y-6">
        <div className="flex items-center gap-4"><div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-xl font-bold text-blue-700">{state.user.name?.[0] || 'U'}</div><div><p className="text-xl font-bold">{state.user.name}</p><p className="text-sm text-slate-600">{state.user.email}</p><p className="text-sm text-slate-500">{state.user.phone || 'Téléphone non renseigné'}</p></div></div>
        <dl className="grid gap-3 sm:grid-cols-3"><div className="rounded-xl bg-slate-50 p-3"><dt className="text-xs text-slate-500">Rôle compte</dt><dd className="font-semibold">{state.user.role}</dd></div><div className="rounded-xl bg-slate-50 p-3"><dt className="text-xs text-slate-500">Statut</dt><dd className="font-semibold">{state.user.status}</dd></div><div className="rounded-xl bg-slate-50 p-3"><dt className="text-xs text-slate-500">Inscription</dt><dd className="font-semibold">{formatDate(state.user.createdAt)}</dd></div></dl>
        <div><h3 className="mb-3 flex items-center gap-2 font-bold"><Building2 size={17} /> Organisations</h3><Memberships user={state.user} /></div>
        <div className="rounded-xl border border-slate-200 p-3 text-sm">{state.user.platformOperator ? `PlatformOperator : ${state.user.platformOperator.status}` : 'Aucune autorité PlatformOperator'}</div>
      </div>}
    </section>
  </div>;
}

function ActionDialog({ action, pending, error, confirmText, onConfirmText, onCancel, onConfirm }) {
  const deleting = action.type === 'delete';
  const title = deleting ? 'Confirmer la suppression' : action.type === 'suspend' ? 'Confirmer la suspension' : 'Confirmer la réactivation';
  const button = deleting ? 'Supprimer définitivement' : action.type === 'suspend' ? 'Confirmer la suspension' : 'Confirmer la réactivation';
  const confirmed = !deleting || confirmText === action.user.email;
  return <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/60 p-4" role="presentation"><section role="dialog" aria-modal="true" aria-label={title} className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl"><h2 className="text-xl font-bold">{title}</h2><p className="mt-2 text-sm text-slate-600">Compte ciblé : <strong>{action.user.name}</strong> ({action.user.email}).</p>{deleting && <label className="mt-5 block text-sm font-semibold text-slate-700">Confirmer avec l’email<input aria-label="Confirmer avec l’email" value={confirmText} onChange={(event) => onConfirmText(event.target.value)} className="mt-2 w-full rounded-xl border border-slate-300 p-2.5 font-normal" placeholder={action.user.email} /></label>}{error && <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-700">{error}</p>}<div className="mt-6 flex gap-3"><button type="button" disabled={pending} onClick={onCancel} className="flex-1 rounded-xl border border-slate-200 px-4 py-2.5 font-semibold">Annuler</button><button type="button" disabled={pending || !confirmed} onClick={onConfirm} className="flex-1 rounded-xl bg-red-600 px-4 py-2.5 font-semibold text-white disabled:opacity-40">{pending ? 'Traitement…' : button}</button></div></section></div>;
}

export default function UsersPanel() {
  const { can } = usePlatformTenantRuntime();
  const canRead = can('platform.users.read');
  const canManage = can('platform.users.manage');
  const requestSequence = useRef(0);
  const [query, setQuery] = useState({ page: 1, limit: 25, search: '', status: '', role: '', organization: '', operator: '', sort: 'newest' });
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [state, setState] = useState({ loading: true, error: null, registry: null });
  const [detailId, setDetailId] = useState(null);
  const [action, setAction] = useState(null);
  const [actionPending, setActionPending] = useState(false);
  const [actionError, setActionError] = useState(null);
  const [confirmText, setConfirmText] = useState('');
  useEffect(() => { const timeout = setTimeout(() => setDebouncedSearch(query.search.trim()), 300); return () => clearTimeout(timeout); }, [query.search]);
  const load = useCallback(async () => {
    if (!canRead) return;
    const requestId = ++requestSequence.current;
    setState((current) => ({ ...current, loading: true, error: null }));
    try {
      const registry = await listGlobalUsers({
        page: query.page,
        limit: query.limit,
        search: debouncedSearch,
        status: query.status,
        role: query.role,
        organization: query.organization,
        operator: query.operator,
        sort: query.sort,
      });
      if (requestId === requestSequence.current) setState({ loading: false, error: null, registry });
    } catch (error) {
      if (requestId === requestSequence.current) setState({ loading: false, registry: null, error: error?.response?.status === 403 ? 'forbidden' : 'error' });
    }
  }, [canRead, query.page, query.limit, query.status, query.role, query.organization, query.operator, query.sort, debouncedSearch]);
  useEffect(() => { load(); }, [load]);
  const updateQuery = (field, value) => setQuery((current) => ({ ...current, [field]: value, page: field === 'page' ? value : 1 }));
  const openAction = (type, user) => { setAction({ type, user }); setActionError(null); setConfirmText(''); };
  const closeAction = () => { if (!actionPending) { setAction(null); setActionError(null); setConfirmText(''); } };
  const confirmAction = async () => {
    if (!action || actionPending) return;
    setActionPending(true); setActionError(null);
    try {
      if (action.type === 'suspend') await suspendGlobalUser(action.user._id);
      else if (action.type === 'activate') await activateGlobalUser(action.user._id);
      else await deleteGlobalUser(action.user._id);
      const moveBack = action.type === 'delete' && state.registry?.items?.length === 1 && query.page > 1;
      setAction(null); setConfirmText('');
      if (moveBack) setQuery((current) => ({ ...current, page: current.page - 1 }));
      else await load();
    } catch (error) {
      const code = error?.response?.data?.code;
      setActionError(ACTION_ERRORS[code] || error?.response?.data?.message || 'L’action administrative a été refusée.');
    } finally { setActionPending(false); }
  };
  const registry = state.registry;
  const stats = registry?.stats || EMPTY_STATS;
  if (!canRead) return <div className="m-6 rounded-2xl border border-amber-200 bg-amber-50 p-6"><h1 className="text-lg font-bold text-amber-900">Accès interdit</h1><p className="mt-1 text-sm text-amber-800">La capability platform.users.read est requise.</p></div>;

  return <main className="space-y-6 p-4 sm:p-6">
    <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><div className="flex items-center gap-2 text-sm font-semibold text-blue-700"><ShieldCheck size={17} /> Vue plateforme</div><h1 className="mt-2 text-3xl font-bold tracking-tight">Utilisateurs de la plateforme</h1><p className="mt-1 text-sm text-slate-600">Gestion globale des comptes Altimmo et Altitude Vision, indépendamment de leurs organisations.</p></div><button type="button" onClick={load} className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold"><RefreshCw size={15} className={state.loading ? 'animate-spin' : ''} /> Actualiser</button></header>
    <section aria-label="Statistiques utilisateurs" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><StatCard label="Total utilisateurs" value={stats.total} tone="total" /><StatCard label="Actifs" value={stats.active} tone="active" /><StatCard label="Suspendus" value={stats.suspended} tone="suspended" /><StatCard label="Sans organisation" value={stats.withoutOrganization} tone="withoutOrganization" /></section>
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><div className="grid gap-3 lg:grid-cols-[minmax(240px,1fr)_repeat(4,minmax(130px,auto))]">
      <label className="relative"><span className="sr-only">Rechercher</span><Search size={16} className="absolute left-3 top-3 text-slate-400" /><input type="search" value={query.search} onChange={(e) => updateQuery('search', e.target.value)} placeholder="Nom, email ou téléphone" className="w-full rounded-xl border border-slate-200 py-2.5 pl-9 pr-3 text-sm" /></label>
      <label className="text-xs font-semibold text-slate-500">Statut<select aria-label="Statut" value={query.status} onChange={(e) => updateQuery('status', e.target.value)} className="mt-1 block w-full rounded-xl border p-2 text-sm"><option value="">Tous</option><option value="Actif">Actif</option><option value="Suspendu">Suspendu</option><option value="Banni">Banni</option><option value="Supprimé">Supprimé</option></select></label>
      <label className="text-xs font-semibold text-slate-500">Rôle<select aria-label="Rôle" value={query.role} onChange={(e) => updateQuery('role', e.target.value)} className="mt-1 block w-full rounded-xl border p-2 text-sm"><option value="">Tous</option>{ROLES.map((role) => <option key={role} value={role}>{role}</option>)}</select></label>
      <label className="text-xs font-semibold text-slate-500">Organisation<select aria-label="Organisation" value={query.organization} onChange={(e) => updateQuery('organization', e.target.value)} className="mt-1 block w-full rounded-xl border p-2 text-sm"><option value="">Toutes</option><option value="with">Avec organisation</option><option value="without">Sans organisation</option></select></label>
      <label className="text-xs font-semibold text-slate-500">Tri<select aria-label="Tri" value={query.sort} onChange={(e) => updateQuery('sort', e.target.value)} className="mt-1 block w-full rounded-xl border p-2 text-sm"><option value="newest">Plus récents</option><option value="oldest">Plus anciens</option><option value="name">Nom</option><option value="status">Statut</option></select></label>
    </div></section>
    {state.error === 'forbidden' && <section className="rounded-2xl border border-amber-200 bg-amber-50 p-6"><h2 className="font-bold text-amber-900">Accès interdit</h2><p className="text-sm text-amber-800">Votre autorité plateforme ne permet pas cette consultation.</p></section>}
    {state.error === 'error' && <section className="rounded-2xl border border-red-200 bg-red-50 p-6"><h2 className="font-bold text-red-900">Utilisateurs indisponibles</h2><p className="text-sm text-red-800">Le registre n’a pas pu être chargé.</p></section>}
    {state.loading && !registry && <section aria-label="Chargement des utilisateurs" className="rounded-2xl border bg-white p-8 text-center text-slate-500">Chargement du registre…</section>}
    {!state.loading && !state.error && registry?.items?.length === 0 && <section className="rounded-2xl border bg-white p-12 text-center"><Users size={28} className="mx-auto text-slate-400" /><h2 className="mt-3 font-bold">{debouncedSearch ? 'Aucun résultat pour cette recherche' : 'Aucun utilisateur enregistré'}</h2></section>}
    {!state.error && registry?.items?.length > 0 && <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="overflow-x-auto"><table className="min-w-full divide-y divide-slate-200"><thead className="bg-slate-50 text-left text-xs uppercase text-slate-500"><tr><th className="px-5 py-3">Utilisateur</th><th className="px-5 py-3">Compte</th><th className="px-5 py-3">Organisations</th><th className="px-5 py-3">Inscription</th><th className="px-5 py-3 text-right">Actions</th></tr></thead><tbody className="divide-y divide-slate-100">{registry.items.map((user) => <tr key={user._id} data-testid={`global-user-${user._id}`} className="align-top"><td className="px-5 py-4"><div className="flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 font-bold text-blue-700">{user.name?.[0] || 'U'}</div><div><p className="font-semibold">{user.name}</p><p className="text-sm text-slate-500">{user.email}</p>{user.platformOperator?.status === 'active' && <span className="text-xs font-semibold text-violet-700">Opérateur actif</span>}</div></div></td><td className="px-5 py-4"><p className="text-sm font-medium">{user.role}</p><span className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${statusClass(user.status)}`}>{user.status}</span></td><td className="px-5 py-4"><Memberships user={user} compact /></td><td className="px-5 py-4 text-sm">{formatDate(user.createdAt)}</td><td className="px-5 py-4"><div className="flex justify-end gap-1.5"><button type="button" aria-label={`Voir ${user.name}`} onClick={() => setDetailId(user._id)} className="rounded-lg border p-2"><UserRound size={17} /></button>{canManage && <>{user.isActive ? <button type="button" aria-label={`Suspendre ${user.name}`} onClick={() => openAction('suspend', user)} className="rounded-lg border border-amber-200 p-2 text-amber-700"><Pause size={17} /></button> : <button type="button" aria-label={`Réactiver ${user.name}`} onClick={() => openAction('activate', user)} className="rounded-lg border border-emerald-200 p-2 text-emerald-700"><Play size={17} /></button>}<button type="button" aria-label={`Supprimer ${user.name}`} onClick={() => openAction('delete', user)} className="rounded-lg border border-red-200 p-2 text-red-700"><Trash2 size={17} /></button></>}</div></td></tr>)}</tbody></table></div><footer className="flex justify-between border-t px-5 py-4 text-sm"><p>{registry.total} utilisateur{registry.total > 1 ? 's' : ''} · page {registry.page} sur {Math.max(registry.totalPages, 1)}</p><div className="flex gap-2"><button type="button" aria-label="Page précédente" disabled={query.page <= 1} onClick={() => updateQuery('page', query.page - 1)} className="rounded-lg border p-2 disabled:opacity-40"><ChevronLeft size={16} /></button><button type="button" aria-label="Page suivante" disabled={query.page >= registry.totalPages} onClick={() => updateQuery('page', query.page + 1)} className="rounded-lg border p-2 disabled:opacity-40"><ChevronRight size={16} /></button></div></footer></section>}
    {detailId && <UserDetail userId={detailId} onClose={() => setDetailId(null)} />}
    {action && <ActionDialog action={action} pending={actionPending} error={actionError} confirmText={confirmText} onConfirmText={setConfirmText} onCancel={closeAction} onConfirm={confirmAction} />}
  </main>;
}
