'use client';
// REPORTING-1 — Centre de Pilotage. Consomme exclusivement
// GET /api/reporting/* (déjà une pure agrégation de services existants côté
// serveur) — aucun calcul KPI n'est fait ici, uniquement de l'affichage.
import { useEffect, useMemo, useState, useCallback } from 'react';
import { toast } from 'react-hot-toast';
import Link from 'next/link';
import { BarChart, Bar, LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { LayoutDashboard, Building2, KeyRound, Landmark, Palmtree, Hotel, Users, Wallet, Megaphone, PartyPopper, FileDown, FileSpreadsheet } from 'lucide-react';
import { getExecutiveReport, downloadReportExport } from '../../services/reportingService';
import { listOrgUnits } from '../../services/organizationService';
import { resolveWebDestination } from '../../navigation/navigationSdk';
import { DashboardCard, DashboardPage, DashboardPageHeader, DashboardState, DashboardToolbar } from '../../components/dashboard/DashboardUI';

const money = (minor) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'XAF', maximumFractionDigits: 0 }).format((minor || 0) / 100);
const isoDate = (d) => d.toISOString().slice(0, 10);

// Chaque domaine pointe, quand elle existe, vers une destination NAV-CORE
// déjà enregistrée (drill-down Phase 6) — jamais une route inventée.
const DOMAIN_TABS = [
  { key: 'immobilier', label: 'Immobilier', Icon: Building2, destination: null },
  { key: 'location', label: 'Gestion locative', Icon: KeyRound, destination: 'ADMIN_RENTALS' },
  { key: 'patrimoine', label: 'Patrimoine', Icon: Landmark, destination: null },
  { key: 'accommodation', label: 'Hébergements', Icon: Palmtree, destination: null },
  { key: 'hotel', label: 'Hôtellerie', Icon: Hotel, destination: null },
  { key: 'crm', label: 'CRM', Icon: Users, destination: 'CRM_PIPELINE' },
  { key: 'finance', label: 'Finance', Icon: Wallet, destination: null },
  { key: 'communication', label: 'Communication', Icon: Megaphone, destination: 'ADMIN_ALTCOM' },
  { key: 'evenementiel', label: 'Événementiel', Icon: PartyPopper, destination: null },
  // MARKETING-AUTOMATION-1 — nouveau domaine Reporting (backend déjà
  // agrégé dans DOMAINS, voir reportingService.js) ; drill-down vers le
  // module dédié Altcom Marketing plutôt qu'une destination NAV générique.
  { key: 'marketing', label: 'Marketing', Icon: Megaphone, destination: null },
];

const KPI_LABELS = {
  total: 'Total', published: 'Publiées', drafts: 'Brouillons', sold: 'Vendues', active: 'Actives',
  scheduledVisits: 'Visites programmées', pendingOffers: 'Offres en cours', salesAmount: 'Montant des ventes', commissions: 'Commissions',
  available: 'Disponibles', occupied: 'Occupés', notices: 'Préavis', activeContracts: 'Baux actifs', expiringContracts: 'Baux proches échéance',
  rentCollected: 'Loyers encaissés', unpaidRent: 'Loyers impayés', penalties: 'Pénalités', maintenance: 'Tickets maintenance',
  occupancyRate: "Taux d'occupation", reservations: 'Réservations', reservationsToday: "Réservations du jour",
  grossAmountCollected: 'Encaissements bruts', netAmountCollected: 'Encaissements nets', remainingAmount: 'Solde restant',
  totalRooms: 'Chambres totales', availableRooms: 'Chambres disponibles', occupiedRooms: 'Chambres occupées',
  prospects: 'Prospects', opportunities: 'Opportunités', activeClients: 'Clients actifs', revenueMinor: "Chiffre d'affaires",
  proprietairesImmobiliers: 'Propriétaires immobiliers', exploitantsEtablissement: "Exploitants d'établissement",
  locataires: 'Locataires', multiProfils: 'Multi-profils', utilisateursActifs: 'Utilisateurs actifs',
};

function KpiGrid({ kpis }) {
  const entries = Object.entries(kpis || {}).filter(([, v]) => typeof v === 'number' || typeof v === 'string' || typeof v === 'boolean');
  if (!entries.length) return <p className="text-sm text-slate-500">Aucun indicateur disponible.</p>;
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {entries.map(([key, value]) => (
        <article key={key} className="rounded-xl border bg-white p-4 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{KPI_LABELS[key] || key}</p>
          <p className="mt-2 text-xl font-bold text-slate-900">{typeof value === 'number' && /minor/i.test(key) ? money(value) : String(value)}</p>
        </article>
      ))}
    </div>
  );
}

function DomainPanel({ tab, entry }) {
  if (!entry) return null;
  if (entry.status !== 'ok') {
    return <DashboardState type="error" title={`${tab.label} indisponible`} description={entry.error} />;
  }
  const data = entry.data;
  const kpis = data.kpis || data.portfolio || data;
  const destinationHref = tab.destination ? resolveWebDestination(tab.destination) : null;
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-900">{tab.label}</h2>
        {destinationHref && (
          <Link href={destinationHref} className="text-sm font-medium text-teal-700 hover:underline">
            Ouvrir le module →
          </Link>
        )}
      </div>
      {data.periodSupported === false && (
        <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          Ce domaine ne prend pas en charge de filtre de période — instantané total affiché (jamais silencieusement filtré).
        </p>
      )}
      {data.note && <p className="text-xs text-slate-500">{data.note}</p>}
      {data.revPARNote && <p className="text-xs text-slate-500">{data.revPARNote}</p>}
      {data.orgScopeNote && <p className="text-xs text-teal-700 bg-teal-50 border border-teal-200 rounded-lg px-3 py-2">{data.orgScopeNote}</p>}
      <KpiGrid kpis={kpis} />
      {tab.key === 'finance' && data.revenueByPole?.length > 0 && (
        <DashboardCard>
          <h3 className="mb-3 font-semibold">Chiffre d'affaires par pôle</h3>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={data.revenueByPole.map((r) => ({ pole: r._id || 'Non attribué', revenue: (r.revenueMinor || 0) / 100 }))}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="pole" fontSize={12} />
              <YAxis fontSize={12} />
              <Tooltip formatter={(v) => new Intl.NumberFormat('fr-FR').format(v)} />
              <Bar dataKey="revenue" fill="#0f766e" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </DashboardCard>
      )}
      {tab.key === 'patrimoine' && data.marketTrend?.length > 0 && (
        <DashboardCard>
          <h3 className="mb-3 font-semibold">Tendance du marché (prix/m²)</h3>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={data.marketTrend}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="period" fontSize={12} />
              <YAxis fontSize={12} />
              <Tooltip />
              <Line type="monotone" dataKey="average" stroke="#1A5A8A" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </DashboardCard>
      )}
      {tab.key === 'crm' && data.pipeline?.length > 0 && (
        <DashboardCard>
          <h3 className="mb-3 font-semibold">Pipeline par étape</h3>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={data.stages.map((stage) => ({ stage: stage.replaceAll('_', ' '), count: data.pipeline.filter((o) => o.stage === stage).length }))}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="stage" fontSize={10} interval={0} angle={-20} textAnchor="end" height={60} />
              <YAxis fontSize={12} allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="count" fill="#0f766e" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </DashboardCard>
      )}
    </div>
  );
}

export default function ReportingDashboardPage() {
  const [activeTab, setActiveTab] = useState('immobilier');
  const [dateFrom, setDateFrom] = useState(isoDate(new Date(Date.now() - 29 * 86400000)));
  const [dateTo, setDateTo] = useState(isoDate(new Date()));
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [exporting, setExporting] = useState(null);
  // ORGANIZATION-1 (Phase 9) — filtre Organisation/Filiale/Établissement/
  // Département/Équipe : liste toutes les unités actives, quel que soit leur
  // niveau, l'utilisateur choisit directement l'unité (pas une cascade de
  // sélecteurs par niveau, la hiérarchie reste flexible côté données).
  const [orgUnits, setOrgUnits] = useState([]);
  const [orgUnitId, setOrgUnitId] = useState('');
  useEffect(() => { listOrgUnits({}).then(setOrgUnits).catch(() => setOrgUnits([])); }, []);

  const load = useCallback(() => {
    setLoading(true);
    setError('');
    getExecutiveReport({ dateFrom, dateTo, orgUnitId: orgUnitId || undefined })
      .then(setReport)
      .catch((e) => setError(e.response?.data?.message || 'Centre de pilotage indisponible.'))
      .finally(() => setLoading(false));
  }, [dateFrom, dateTo, orgUnitId]);
  useEffect(() => { load(); }, [load]);

  const exportAs = async (format) => {
    setExporting(format);
    try { await downloadReportExport(format, { dateFrom, dateTo, orgUnitId: orgUnitId || undefined }); }
    catch (e) { toast.error(e.response?.data?.message || 'Export impossible.'); }
    finally { setExporting(null); }
  };

  const activeEntry = useMemo(() => report?.domains?.[activeTab], [report, activeTab]);

  return (
    <DashboardPage>
      <DashboardPageHeader
        icon={LayoutDashboard}
        title="Centre de Pilotage"
        description="Vue consolidée Immobilier, Gestion locative, Patrimoine, Hébergements, Hôtellerie, CRM, Finance, Communication et Événementiel — aucun calcul dupliqué, uniquement des indicateurs déjà produits par chaque module."
        actions={
          <div className="flex gap-2">
            <button onClick={() => exportAs('pdf')} disabled={exporting === 'pdf'} className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium hover:bg-slate-50 disabled:opacity-60">
              <FileDown size={16} /> {exporting === 'pdf' ? 'Export…' : 'PDF'}
            </button>
            <button onClick={() => exportAs('csv')} disabled={exporting === 'csv'} className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium hover:bg-slate-50 disabled:opacity-60">
              <FileSpreadsheet size={16} /> {exporting === 'csv' ? 'Export…' : 'CSV'}
            </button>
          </div>
        }
      />

      <DashboardToolbar>
        <label className="text-sm">Du <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="ml-1 rounded border px-2 py-1" /></label>
        <label className="text-sm">Au <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="ml-1 rounded border px-2 py-1" /></label>
        <label className="text-sm">Organisation
          <select value={orgUnitId} onChange={(e) => setOrgUnitId(e.target.value)} className="ml-1 rounded border px-2 py-1">
            <option value="">Toute la plateforme</option>
            {orgUnits.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
        </label>
        <span className="text-xs text-slate-400">Filtres appliqués uniquement aux domaines qui les prennent en charge (période : Patrimoine, Hôtellerie ; organisation : CRM, Hôtellerie — voir `orgScopeNote` par domaine).</span>
      </DashboardToolbar>

      {report?.users?.status === 'ok' && (
        <DashboardCard>
          <h2 className="mb-3 font-semibold">Utilisateurs (source unique USER-KPI-1)</h2>
          <KpiGrid kpis={report.users.data} />
        </DashboardCard>
      )}

      <nav aria-label="Domaines du Centre de Pilotage" className="flex gap-2 overflow-x-auto pb-1">
        {DOMAIN_TABS.map(({ key, label, Icon }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`inline-flex shrink-0 items-center gap-2 rounded-full px-4 py-2 text-sm font-medium ${activeTab === key ? 'bg-slate-900 text-white' : 'bg-white text-slate-700 shadow-sm ring-1 ring-slate-200'}`}
          >
            <Icon size={16} /> {label}
          </button>
        ))}
      </nav>

      {error && <DashboardState type="error" title="Erreur" description={error} />}
      {loading && !report ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{Array.from({ length: 8 }, (_, i) => <div key={i} className="h-24 animate-pulse rounded-xl bg-slate-100" />)}</div>
      ) : (
        <DomainPanel tab={DOMAIN_TABS.find((t) => t.key === activeTab)} entry={activeEntry} />
      )}
    </DashboardPage>
  );
}
