'use client';
// TENANT-CORE-1 (Phase 8) — Administration SaaS multi-tenant. Réservé Admin.
// Chaque tenant est une fine enveloppe autour d'une racine Organisation
// (ORGANIZATION-1) — ce module ne recrée ni la hiérarchie organisationnelle
// ni le RBAC, il les orchestre (voir platformTenantService.js côté serveur).
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import { Building2, Plus, Ban, RotateCcw, Archive, Globe, Palette, Settings, Boxes, CreditCard, CheckCircle2 } from 'lucide-react';
import {
  listTenants, createTenant, getTenantOverview, suspendTenant, reactivateTenant, archiveTenant,
  updateTenantSettings, updateTenantTheme, addTenantDomain, verifyTenantDomain,
  setTenantFeature, changeTenantSubscription, cancelTenantSubscription,
} from '../../services/platformTenantService';
import { DashboardCard, DashboardPage, DashboardPageHeader, DashboardState, DashboardToolbar } from '../../components/dashboard/DashboardUI';

// Mirroir des constantes serveur (constants/platformTenantConstants.js) —
// liste stable, jamais recalculée dynamiquement (même convention que
// HistoriquePage.jsx pour MODULES/TYPE_ACTIONS).
const TENANT_FEATURE_MODULES = [
  'immobilier', 'location', 'patrimoine', 'accommodation', 'hotel',
  'crm', 'finance', 'communication', 'evenementiel', 'marketing', 'erp', 'api',
];
const PLANS = ['trial', 'starter', 'pro', 'enterprise'];

function StatusBadge({ status }) {
  const colors = {
    trial: 'bg-blue-100 text-blue-800', active: 'bg-green-100 text-green-800',
    suspended: 'bg-red-100 text-red-800', archived: 'bg-slate-100 text-slate-600',
  };
  return <span className={`rounded-full px-2 py-1 text-xs font-medium ${colors[status] || 'bg-slate-100 text-slate-600'}`}>{status}</span>;
}

function CreateTenantForm({ onCreated }) {
  const [name, setName] = useState('');
  const [plan, setPlan] = useState('trial');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (!name.trim()) { toast.error('Nom requis.'); return; }
    setBusy(true);
    try {
      await createTenant({ name, plan });
      toast.success('Tenant créé (racine organisationnelle générée automatiquement).');
      setName('');
      onCreated();
    } catch (err) { toast.error(err.response?.data?.message || 'Création impossible.'); }
    finally { setBusy(false); }
  };

  return (
    <DashboardCard>
      <h2 className="mb-3 text-sm font-semibold text-slate-700">Nouveau tenant</h2>
      <form onSubmit={submit} className="flex flex-wrap items-end gap-3">
        <div>
          <label className="block text-xs text-slate-500">Nom de l'entreprise</label>
          <input value={name} onChange={(e) => setName(e.target.value)} className="rounded border px-3 py-2 text-sm" placeholder="Ex: Congo Habitat SARL" />
        </div>
        <div>
          <label className="block text-xs text-slate-500">Plan initial</label>
          <select value={plan} onChange={(e) => setPlan(e.target.value)} className="rounded border px-3 py-2 text-sm">
            {PLANS.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
        <button disabled={busy} type="submit" className="flex items-center gap-2 rounded bg-amber-600 px-3 py-2 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-60">
          <Plus size={16} /> Créer
        </button>
      </form>
    </DashboardCard>
  );
}

function TenantDetail({ tenantId, onChanged }) {
  const [overview, setOverview] = useState(null);
  const [domain, setDomain] = useState('');
  const [plan, setPlan] = useState('starter');

  const load = useCallback(() => { getTenantOverview(tenantId).then(setOverview).catch(() => toast.error('Tenant indisponible.')); }, [tenantId]);
  useEffect(() => { load(); }, [load]);

  if (!overview) return <DashboardState type="loading" title="Chargement du tenant…" />;
  const { tenant, userCount, orgUnits, settings, theme, domains, features, subscription } = overview;
  const featureMap = Object.fromEntries((features || []).map((f) => [f.module, f.enabled]));

  const doLifecycle = async (action) => {
    try {
      if (action === 'suspend') await suspendTenant(tenant._id, 'Suspendu depuis le tableau de bord');
      else if (action === 'reactivate') await reactivateTenant(tenant._id);
      else if (action === 'archive') await archiveTenant(tenant._id);
      toast.success('Action effectuée.');
      onChanged(); load();
    } catch (err) { toast.error(err.response?.data?.message || 'Action impossible.'); }
  };

  const saveSettings = async (e) => {
    e.preventDefault();
    const form = new FormData(e.target);
    try {
      await updateTenantSettings(tenant._id, { currency: form.get('currency'), language: form.get('language'), timezone: form.get('timezone'), contactEmail: form.get('contactEmail') });
      toast.success('Configuration mise à jour.'); load();
    } catch { toast.error('Échec de la mise à jour.'); }
  };

  const saveTheme = async (e) => {
    e.preventDefault();
    const form = new FormData(e.target);
    try {
      await updateTenantTheme(tenant._id, { brandName: form.get('brandName'), logoUrl: form.get('logoUrl'), primaryColor: form.get('primaryColor'), secondaryColor: form.get('secondaryColor') });
      toast.success('Branding mis à jour.'); load();
    } catch { toast.error('Échec de la mise à jour.'); }
  };

  const submitDomain = async (e) => {
    e.preventDefault();
    if (!domain.trim()) return;
    try { await addTenantDomain(tenant._id, { domain, isPrimary: (domains || []).length === 0 }); setDomain(''); toast.success('Domaine ajouté (statut : pending).'); load(); }
    catch (err) { toast.error(err.response?.data?.message || 'Ajout impossible.'); }
  };

  const toggleFeature = async (moduleKey) => {
    try { await setTenantFeature(tenant._id, moduleKey, !featureMap[moduleKey]); load(); }
    catch { toast.error('Action impossible.'); }
  };

  const submitPlan = async (e) => {
    e.preventDefault();
    try { await changeTenantSubscription(tenant._id, { plan }); toast.success('Abonnement changé.'); load(); }
    catch (err) { toast.error(err.response?.data?.message || 'Changement impossible.'); }
  };

  const doCancelSubscription = async () => {
    try { await cancelTenantSubscription(tenant._id, 'Annulé depuis le tableau de bord'); toast.success('Abonnement annulé.'); load(); }
    catch { toast.error('Annulation impossible.'); }
  };

  return (
    <div className="space-y-4">
      <DashboardCard>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-lg font-bold text-slate-900">{tenant.name}</h2>
            <p className="text-xs text-slate-500">/{tenant.slug} · <StatusBadge status={tenant.status} /></p>
          </div>
          <div className="flex gap-2">
            {tenant.status !== 'suspended' && tenant.status !== 'archived' && (
              <button onClick={() => doLifecycle('suspend')} className="flex items-center gap-1 rounded bg-red-600 px-2 py-1 text-xs text-white hover:bg-red-700"><Ban size={14} /> Suspendre</button>
            )}
            {tenant.status === 'suspended' && (
              <button onClick={() => doLifecycle('reactivate')} className="flex items-center gap-1 rounded bg-teal-700 px-2 py-1 text-xs text-white hover:bg-teal-800"><RotateCcw size={14} /> Réactiver</button>
            )}
            {tenant.status !== 'archived' && (
              <button onClick={() => doLifecycle('archive')} className="flex items-center gap-1 rounded bg-slate-700 px-2 py-1 text-xs text-white hover:bg-slate-800"><Archive size={14} /> Archiver</button>
            )}
          </div>
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <p className="text-sm"><span className="text-slate-500">Utilisateurs</span> — <span className="font-semibold">{userCount}</span></p>
          <p className="text-sm"><span className="text-slate-500">Unités organisationnelles</span> — <span className="font-semibold">{orgUnits?.length ?? 0}</span></p>
          <p className="text-sm"><span className="text-slate-500">Abonnement</span> — <span className="font-semibold">{subscription ? `${subscription.plan} (${subscription.status})` : 'aucun'}</span></p>
        </div>
      </DashboardCard>

      <div className="grid gap-4 lg:grid-cols-2">
        <DashboardCard>
          <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-700"><Settings size={16} /> Configuration</h3>
          <form onSubmit={saveSettings} className="grid gap-2">
            <input name="currency" defaultValue={settings?.currency} placeholder="Devise (XAF)" className="rounded border px-2 py-1.5 text-sm" />
            <input name="language" defaultValue={settings?.language} placeholder="Langue (fr)" className="rounded border px-2 py-1.5 text-sm" />
            <input name="timezone" defaultValue={settings?.timezone} placeholder="Fuseau horaire" className="rounded border px-2 py-1.5 text-sm" />
            <input name="contactEmail" defaultValue={settings?.contactEmail || ''} placeholder="Email de contact" className="rounded border px-2 py-1.5 text-sm" />
            <button type="submit" className="rounded bg-slate-700 px-3 py-1.5 text-xs text-white hover:bg-slate-800">Enregistrer</button>
          </form>
        </DashboardCard>

        <DashboardCard>
          <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-700"><Palette size={16} /> Branding</h3>
          <form onSubmit={saveTheme} className="grid gap-2">
            <input name="brandName" defaultValue={theme?.brandName || ''} placeholder="Nom de marque" className="rounded border px-2 py-1.5 text-sm" />
            <input name="logoUrl" defaultValue={theme?.logoUrl || ''} placeholder="URL du logo" className="rounded border px-2 py-1.5 text-sm" />
            <div className="flex gap-2">
              <input name="primaryColor" type="color" defaultValue={theme?.primaryColor || '#C8960C'} className="h-9 w-14 rounded border" />
              <input name="secondaryColor" type="color" defaultValue={theme?.secondaryColor || '#2E7BB5'} className="h-9 w-14 rounded border" />
            </div>
            <button type="submit" className="rounded bg-slate-700 px-3 py-1.5 text-xs text-white hover:bg-slate-800">Enregistrer</button>
          </form>
        </DashboardCard>

        <DashboardCard>
          <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-700"><Globe size={16} /> Domaines</h3>
          <form onSubmit={submitDomain} className="mb-2 flex gap-2">
            <input value={domain} onChange={(e) => setDomain(e.target.value)} placeholder="entreprise.altitudevision.agency" className="flex-1 rounded border px-2 py-1.5 text-sm" />
            <button type="submit" className="rounded bg-slate-700 px-3 py-1.5 text-xs text-white hover:bg-slate-800">Ajouter</button>
          </form>
          <ul className="space-y-1">
            {(domains || []).map((d) => (
              <li key={d._id} className="flex items-center justify-between rounded bg-slate-50 px-2 py-1 text-xs">
                <span>{d.domain} {d.isPrimary && '(principal)'}</span>
                <span className="flex items-center gap-2">
                  {d.status}
                  {d.status === 'pending' && (
                    <button onClick={() => verifyTenantDomain(d._id).then(load)} className="text-amber-700 hover:underline">Vérifier</button>
                  )}
                </span>
              </li>
            ))}
            {(!domains || domains.length === 0) && <p className="text-xs text-slate-400">Aucun domaine configuré.</p>}
          </ul>
        </DashboardCard>

        <DashboardCard>
          <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-700"><CreditCard size={16} /> Abonnement</h3>
          <form onSubmit={submitPlan} className="mb-2 flex gap-2">
            <select value={plan} onChange={(e) => setPlan(e.target.value)} className="rounded border px-2 py-1.5 text-sm">
              {PLANS.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
            <button type="submit" className="rounded bg-amber-600 px-3 py-1.5 text-xs text-white hover:bg-amber-700">Changer de plan</button>
          </form>
          {subscription && (
            <div className="text-xs text-slate-600">
              <p>Modules inclus : {subscription.modulesIncluded?.join(', ') || '—'}</p>
              <p>Quotas : {Object.entries(subscription.quotas || {}).map(([k, v]) => `${k}=${v ?? '∞'}`).join(', ')}</p>
              <button onClick={doCancelSubscription} className="mt-2 rounded bg-red-600 px-2 py-1 text-white hover:bg-red-700">Annuler l'abonnement</button>
            </div>
          )}
        </DashboardCard>
      </div>

      <DashboardCard>
        <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-700"><Boxes size={16} /> Modules activés</h3>
        <div className="flex flex-wrap gap-2">
          {TENANT_FEATURE_MODULES.map((m) => (
            <button
              key={m} onClick={() => toggleFeature(m)}
              className={`flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium ${featureMap[m] ? 'bg-green-100 text-green-800' : 'bg-slate-100 text-slate-500'}`}
            >
              {featureMap[m] && <CheckCircle2 size={12} />} {m}
            </button>
          ))}
        </div>
      </DashboardCard>
    </div>
  );
}

export default function PlatformTenantsPage() {
  const [tenants, setTenants] = useState([]);
  const [selectedId, setSelectedId] = useState(null);

  const load = useCallback(() => { listTenants().then(setTenants).catch(() => toast.error('Tenants indisponibles.')); }, []);
  useEffect(() => { load(); }, [load]);

  return (
    <DashboardPage>
      <DashboardPageHeader
        icon={Building2}
        eyebrow="SaaS"
        title="Administration Multi-Tenant"
        description="Chaque tenant est une entreprise cliente indépendante — Organisation, CRM, Reporting, Marketing et API Gateway restent les seuls moteurs métier."
      />
      <CreateTenantForm onCreated={load} />
      <DashboardToolbar>
        <nav className="flex flex-wrap gap-2" aria-label="Tenants">
          {tenants.map((t) => (
            <button
              key={t._id} onClick={() => setSelectedId(t._id)}
              className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition ${selectedId === t._id ? 'bg-amber-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
            >
              {t.name} <StatusBadge status={t.status} />
            </button>
          ))}
          {tenants.length === 0 && <p className="text-sm text-slate-500">Aucun tenant. Créez-en un ci-dessus.</p>}
        </nav>
      </DashboardToolbar>
      {selectedId && <TenantDetail tenantId={selectedId} onChanged={load} />}
    </DashboardPage>
  );
}
