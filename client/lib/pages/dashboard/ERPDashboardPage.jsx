'use client';
// ERP-CORE-1 (Phase 8) — Centre d'Administration Global. Couche
// d'orchestration UNIQUEMENT : chaque section réutilise des données déjà
// produites par un service existant (Reporting, Organisation, CRM-
// AUTOMATION, ERP alerts/santé/décisions) et propose un lien vers le
// dashboard complet correspondant plutôt que de le dupliquer (Phase 2 : "Il
// ne remplace aucun dashboard existant").
import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  LayoutDashboard, Building2, TrendingUp, AlertTriangle, ClipboardList,
  Activity, ListChecks, KeyRound, Megaphone, Wallet,
} from 'lucide-react';
import { getExecutiveOverview, getAlerts, getDecisionCenter, getPlatformHealth } from '../../services/erpService';
import { getRecentActionLogs } from '../../services/actionLogService';
import { DashboardCard, DashboardPage, DashboardPageHeader, DashboardState, DashboardToolbar } from '../../components/dashboard/DashboardUI';

const TABS = [
  { key: 'direction', label: 'Vue Direction', Icon: LayoutDashboard },
  { key: 'organisation', label: 'Organisation', Icon: Building2 },
  { key: 'performance', label: 'Performance', Icon: TrendingUp },
  { key: 'risques', label: 'Risques', Icon: AlertTriangle },
  { key: 'audit', label: 'Audit', Icon: ClipboardList },
  { key: 'sante', label: 'Santé', Icon: Activity },
  { key: 'decisions', label: 'Décisions', Icon: ListChecks },
  { key: 'api', label: 'API', Icon: KeyRound },
  { key: 'marketing', label: 'Marketing', Icon: Megaphone },
  { key: 'finance', label: 'Finance', Icon: Wallet },
];

const SEVERITY_STYLE = {
  critical: 'bg-red-50 text-red-800 border-red-200',
  warning: 'bg-amber-50 text-amber-800 border-amber-200',
  info: 'bg-slate-50 text-slate-700 border-slate-200',
};

function AlertsList({ alerts }) {
  if (!alerts?.length) return <p className="text-sm text-slate-500">Aucune alerte active.</p>;
  return (
    <ul className="space-y-2">
      {alerts.map((a) => (
        <li key={a.key} className={`rounded-lg border p-3 text-sm ${SEVERITY_STYLE[a.severity] || SEVERITY_STYLE.info}`}>
          <p className="font-semibold">{a.label} <span className="ml-2 text-xs uppercase opacity-70">{a.severity}</span></p>
          <p className="mt-1 text-xs opacity-90">{a.detail}</p>
        </li>
      ))}
    </ul>
  );
}

function KpiRow({ label, value }) {
  return (
    <div className="flex items-center justify-between border-b py-2 text-sm last:border-b-0">
      <span className="text-slate-500">{label}</span>
      <span className="font-semibold text-slate-900">{value ?? '—'}</span>
    </div>
  );
}

function DirectionTab({ overview }) {
  if (!overview) return <DashboardState type="loading" title="Chargement de la vue Direction…" />;
  const { domains, users, organisation, growth, alerts } = overview;
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <DashboardCard>
        <h2 className="mb-2 text-sm font-semibold text-slate-700">Activité globale</h2>
        <KpiRow label="Utilisateurs actifs" value={users?.data?.utilisateursActifs} />
        <KpiRow label="Prospects" value={domains?.crm?.data?.kpis?.prospects} />
        <KpiRow label="Clients actifs" value={domains?.crm?.data?.kpis?.activeClients} />
        <KpiRow label="Unités organisationnelles" value={organisation?.totalUnits} />
      </DashboardCard>
      <DashboardCard>
        <h2 className="mb-2 text-sm font-semibold text-slate-700">Croissance (30 derniers jours)</h2>
        <KpiRow label="Nouveaux comptes" value={growth?.newUsersThisMonth} />
        <KpiRow label="Mois précédent" value={growth?.newUsersPreviousMonth} />
        <KpiRow label="Variation" value={growth?.newUsersGrowthPercent !== null && growth?.newUsersGrowthPercent !== undefined ? `${growth.newUsersGrowthPercent > 0 ? '+' : ''}${growth.newUsersGrowthPercent}%` : 'N/A (période précédente vide)'} />
      </DashboardCard>
      <DashboardCard>
        <h2 className="mb-2 text-sm font-semibold text-slate-700">Occupation & Conversion</h2>
        <KpiRow label="Occupation hôtelière" value={domains?.hotel?.data?.kpis?.occupancyRate != null ? `${domains.hotel.data.kpis.occupancyRate}%` : null} />
        <KpiRow label="Taux de conversion CRM" value={domains?.crm?.data?.commercial?.conversionRate != null ? `${domains.crm.data.commercial.conversionRate}%` : null} />
      </DashboardCard>
      <DashboardCard className="lg:col-span-3">
        <h2 className="mb-2 text-sm font-semibold text-slate-700">Alertes prioritaires ({alerts?.length || 0})</h2>
        <AlertsList alerts={(alerts || []).slice(0, 5)} />
      </DashboardCard>
    </div>
  );
}

function OrganisationTab({ overview }) {
  const organisation = overview?.organisation;
  if (!organisation) return <DashboardState type="loading" title="Chargement…" />;
  return (
    <DashboardCard>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-700">Structure organisationnelle</h2>
        <Link href="/dashboard/organization" className="text-xs font-medium text-amber-700 hover:underline">Ouvrir l'administration Organisation →</Link>
      </div>
      <KpiRow label="Unités actives" value={organisation.totalUnits} />
      <KpiRow label="Appartenances actives" value={organisation.activeMemberships} />
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {Object.entries(organisation.byType || {}).map(([type, count]) => (
          <div key={type} className="rounded-lg bg-slate-50 px-3 py-2 text-sm">
            <span className="text-slate-500">{type}</span> — <span className="font-semibold">{count}</span>
          </div>
        ))}
      </div>
    </DashboardCard>
  );
}

const DOMAIN_LABELS = {
  immobilier: 'Immobilier', location: 'Gestion locative', patrimoine: 'Patrimoine',
  accommodation: 'Hébergements', hotel: 'Hôtellerie', evenementiel: 'Événementiel',
};

function PerformanceTab({ overview }) {
  if (!overview) return <DashboardState type="loading" title="Chargement…" />;
  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Link href="/dashboard/reporting" className="text-xs font-medium text-amber-700 hover:underline">Ouvrir le Centre de Pilotage complet →</Link>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Object.entries(DOMAIN_LABELS).map(([key, label]) => {
          const entry = overview.domains?.[key];
          const kpis = entry?.data?.kpis || {};
          return (
            <DashboardCard key={key}>
              <h3 className="mb-2 text-sm font-semibold text-slate-700">{label}</h3>
              {entry?.status === 'error' ? (
                <p className="text-xs text-red-600">Indisponible : {entry.error}</p>
              ) : Object.keys(kpis).length === 0 ? (
                <p className="text-xs text-slate-400">Aucun indicateur.</p>
              ) : (
                Object.entries(kpis).slice(0, 4).map(([k, v]) => (
                  typeof v === 'number' || typeof v === 'string' ? <KpiRow key={k} label={k} value={v} /> : null
                ))
              )}
            </DashboardCard>
          );
        })}
      </div>
    </div>
  );
}

function RisquesTab({ alerts }) {
  if (!alerts) return <DashboardState type="loading" title="Chargement des alertes…" />;
  return (
    <DashboardCard>
      <h2 className="mb-3 text-sm font-semibold text-slate-700">Alertes stratégiques ({alerts.length})</h2>
      <AlertsList alerts={alerts} />
    </DashboardCard>
  );
}

function AuditTab() {
  const [logs, setLogs] = useState(null);
  useEffect(() => { getRecentActionLogs(15).then(setLogs).catch(() => setLogs([])); }, []);
  return (
    <DashboardCard>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-700">Activité récente (tous modules)</h2>
        <Link href="/dashboard/historique" className="text-xs font-medium text-amber-700 hover:underline">Ouvrir le Centre d'Audit complet →</Link>
      </div>
      {logs === null ? (
        <DashboardState type="loading" title="Chargement…" />
      ) : logs.length === 0 ? (
        <p className="text-sm text-slate-500">Aucune action récente.</p>
      ) : (
        <ul className="divide-y">
          {logs.map((log) => (
            <li key={log._id} className="py-2 text-sm">
              <span className="font-medium text-slate-900">{log.action}</span>
              <span className="ml-2 text-xs text-slate-400">{log.module} · {new Date(log.date).toLocaleString('fr-FR')}</span>
              <p className="text-xs text-slate-500">{log.description}</p>
            </li>
          ))}
        </ul>
      )}
    </DashboardCard>
  );
}

function SanteTab({ health }) {
  if (!health) return <DashboardState type="loading" title="Chargement de la santé plateforme…" />;
  return (
    <div className="overflow-x-auto rounded-xl border bg-white">
      <table className="w-full min-w-[800px] text-left text-sm">
        <thead>
          <tr className="border-b bg-slate-50 text-slate-500">
            <th className="p-3">Module</th>
            <th className="p-3">État</th>
            <th className="p-3">Version</th>
            <th className="p-3">Dernière synchronisation</th>
            <th className="p-3">Alertes</th>
            <th className="p-3">Tests</th>
          </tr>
        </thead>
        <tbody>
          {health.modules.map((m) => (
            <tr key={m.key} className="border-b align-top">
              <td className="p-3 font-semibold capitalize text-slate-900">{m.key}</td>
              <td className="p-3">
                <span className={`rounded-full px-2 py-1 text-xs font-medium ${m.etat === 'operationnel' ? 'bg-green-100 text-green-800' : m.etat === 'degrade' ? 'bg-red-100 text-red-800' : 'bg-slate-100 text-slate-600'}`}>
                  {m.etat}
                </span>
              </td>
              <td className="p-3 text-xs">{m.version}</td>
              <td className="p-3 text-xs">{m.derniereSynchronisation ? new Date(m.derniereSynchronisation).toLocaleString('fr-FR') : '—'}</td>
              <td className="p-3">{m.alertes ?? '—'}</td>
              <td className="p-3 max-w-xs text-xs text-slate-500">{m.note || m.tests}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DecisionsTab({ decisions }) {
  if (!decisions) return <DashboardState type="loading" title="Chargement du centre de décision…" />;
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <DashboardCard>
        <h2 className="mb-2 text-sm font-semibold text-slate-700">Actions prioritaires</h2>
        {decisions.actionsPrioritaires?.length
          ? <ul className="list-disc space-y-1 pl-4 text-sm">{decisions.actionsPrioritaires.map((a, i) => <li key={i}>{a.title || a.label || JSON.stringify(a)}</li>)}</ul>
          : <p className="text-sm text-slate-500">Aucune action prioritaire.</p>}
      </DashboardCard>
      <DashboardCard>
        <h2 className="mb-2 text-sm font-semibold text-slate-700">Risques</h2>
        <AlertsList alerts={decisions.risques} />
      </DashboardCard>
      <DashboardCard>
        <h2 className="mb-2 text-sm font-semibold text-slate-700">Points bloquants</h2>
        <KpiRow label="Opportunités bloquées" value={decisions.pointsBloquants?.opportunitesBloquees?.length} />
        <KpiRow label="Documents manquants" value={decisions.pointsBloquants?.documentsManquants?.length} />
        <KpiRow label="Visites sans suite" value={decisions.pointsBloquants?.visitesSansSuite?.length} />
      </DashboardCard>
      <DashboardCard>
        <h2 className="mb-2 text-sm font-semibold text-slate-700">Échéances & opportunités</h2>
        <KpiRow label="Contrats proches échéance" value={decisions.echeances?.contratsProchesEcheance?.length} />
        <KpiRow label="Paiements à suivre" value={decisions.echeances?.paiementsASuivre?.length} />
        <KpiRow label="Relances aujourd'hui" value={decisions.opportunites?.relancesAujourdhui?.length} />
        <KpiRow label="Prospects inactifs" value={decisions.opportunites?.prospectsInactifs?.length} />
      </DashboardCard>
    </div>
  );
}

function ApiTab({ health }) {
  const apiModule = health?.modules?.find((m) => m.key === 'api');
  return (
    <DashboardCard>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-700">API Gateway</h2>
        <Link href="/dashboard/api-platform" className="text-xs font-medium text-amber-700 hover:underline">Ouvrir le portail développeur →</Link>
      </div>
      {!apiModule ? <DashboardState type="loading" title="Chargement…" /> : (
        <>
          <KpiRow label="État" value={apiModule.etat} />
          <KpiRow label="Appels journalisés (total)" value={apiModule.volumetrie} />
          <KpiRow label="Scopes disponibles" value={apiModule.scopesDisponibles} />
          <KpiRow label="Alertes" value={apiModule.alertes} />
        </>
      )}
    </DashboardCard>
  );
}

function MarketingTab({ overview }) {
  const marketing = overview?.domains?.marketing?.data;
  return (
    <DashboardCard>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-700">Marketing Automation</h2>
        <Link href="/dashboard/altcom/marketing" className="text-xs font-medium text-amber-700 hover:underline">Ouvrir Marketing Automation →</Link>
      </div>
      {!marketing ? <DashboardState type="loading" title="Chargement…" /> : (
        <>
          <KpiRow label="Campagnes envoyées" value={marketing.kpis?.campagnesEnvoyees} />
          <KpiRow label="Envois réussis" value={marketing.kpis?.envoisReussis} />
          <KpiRow label="Taux d'ouverture" value={marketing.kpis?.tauxOuverture != null ? `${marketing.kpis.tauxOuverture}%` : null} />
          <KpiRow label="Désabonnements" value={marketing.kpis?.desabonnements} />
        </>
      )}
    </DashboardCard>
  );
}

function FinanceTab({ overview }) {
  const finance = overview?.domains?.finance?.data;
  return (
    <DashboardCard>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-700">Finance transversale</h2>
        <Link href="/dashboard/reporting" className="text-xs font-medium text-amber-700 hover:underline">Ouvrir le Centre de Pilotage (Finance) →</Link>
      </div>
      {!finance ? <DashboardState type="loading" title="Chargement…" /> : (
        <>
          <KpiRow label="Taux de conversion" value={finance.conversionRate != null ? `${finance.conversionRate}%` : null} />
          {(finance.revenueByPole || []).map((row) => (
            <KpiRow key={row._id} label={`CA — ${row._id}`} value={new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'XAF', maximumFractionDigits: 0 }).format((row.revenueMinor || 0) / 100)} />
          ))}
          {finance.note && <p className="mt-2 text-xs text-slate-400">{finance.note}</p>}
        </>
      )}
    </DashboardCard>
  );
}

export default function ERPDashboardPage() {
  const [tab, setTab] = useState('direction');
  const [overview, setOverview] = useState(null);
  const [alerts, setAlerts] = useState(null);
  const [decisions, setDecisions] = useState(null);
  const [health, setHealth] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    getExecutiveOverview().then(setOverview).catch((e) => setError(e.response?.data?.message || 'Vue exécutive indisponible.'));
    getAlerts().then(setAlerts).catch(() => setAlerts([]));
    getDecisionCenter().then(setDecisions).catch(() => {});
    getPlatformHealth().then(setHealth).catch(() => {});
  }, []);

  return (
    <DashboardPage>
      <DashboardPageHeader
        icon={LayoutDashboard}
        eyebrow="Direction"
        title="Centre d'Administration Global"
        description="Couche d'orchestration — Reporting, CRM, Organisation, Marketing et API Gateway restent les seules sources de vérité."
      />
      {error && <p role="alert" className="rounded-lg bg-red-50 p-4 text-sm text-red-800">{error}</p>}
      <DashboardToolbar>
        <nav className="flex flex-wrap gap-2" aria-label="Sections du Centre ERP">
          {TABS.map(({ key, label, Icon }) => (
            <button
              key={key} onClick={() => setTab(key)}
              className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition ${tab === key ? 'bg-amber-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
            >
              <Icon size={14} /> {label}
            </button>
          ))}
        </nav>
      </DashboardToolbar>
      {tab === 'direction' && <DirectionTab overview={overview} />}
      {tab === 'organisation' && <OrganisationTab overview={overview} />}
      {tab === 'performance' && <PerformanceTab overview={overview} />}
      {tab === 'risques' && <RisquesTab alerts={alerts} />}
      {tab === 'audit' && <AuditTab />}
      {tab === 'sante' && <SanteTab health={health} />}
      {tab === 'decisions' && <DecisionsTab decisions={decisions} />}
      {tab === 'api' && <ApiTab health={health} />}
      {tab === 'marketing' && <MarketingTab overview={overview} />}
      {tab === 'finance' && <FinanceTab overview={overview} />}
    </DashboardPage>
  );
}
