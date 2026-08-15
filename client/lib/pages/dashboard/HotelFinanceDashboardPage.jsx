'use client';
import { useEffect, useState, useCallback } from 'react';
import { toast } from 'react-hot-toast';
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import * as dashboardService from '../../services/hotelFinancialDashboardService';
import { getAccessibleHotels } from '../../services/hotelAccessService';
import { Landmark } from 'lucide-react';
import { DashboardCard, DashboardPage, DashboardPageHeader, DashboardPagination, DashboardState, DashboardTableContainer, DashboardToolbar } from '../../components/dashboard/DashboardUI';

const money = (minor) => `${Number(minor || 0).toLocaleString('fr-FR')} XAF`;
const SEVERITY_LABEL = { critical: 'Critique', warning: 'Avertissement', info: 'Info' };
const SEVERITY_CLASS = { critical: 'bg-red-100 text-red-800', warning: 'bg-amber-100 text-amber-800', info: 'bg-blue-100 text-blue-800' };

const isoDate = (date) => date.toISOString().slice(0, 10);
const QUICK_RANGES = [
  { key: 'today', label: "Aujourd'hui", from: () => new Date(), to: () => new Date() },
  { key: '7d', label: '7 derniers jours', from: () => new Date(Date.now() - 6 * 86400000), to: () => new Date() },
  { key: 'month', label: 'Mois en cours', from: () => new Date(new Date().getFullYear(), new Date().getMonth(), 1), to: () => new Date() },
  { key: 'prev_month', label: 'Mois précédent', from: () => new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1), to: () => new Date(new Date().getFullYear(), new Date().getMonth(), 0) },
  { key: 'year', label: 'Année en cours', from: () => new Date(new Date().getFullYear(), 0, 1), to: () => new Date() },
];

function KpiCard({ label, value, hint, tone = 'default' }) {
  const toneClass = tone === 'warning' ? 'border-amber-300 bg-amber-50' : tone === 'critical' ? 'border-red-300 bg-red-50' : 'border-gray-200 bg-white';
  return (
    <DashboardCard className={toneClass} title={hint}>
      <div className="text-[11px] uppercase tracking-wide text-gray-500">{label}</div>
      <div className="mt-1 text-lg font-semibold text-gray-900">{value}</div>
    </DashboardCard>
  );
}

export default function HotelFinanceDashboardPage({ initialHotelId = '' }) {
  const [hotelId, setHotelId] = useState(initialHotelId);
  const [accessibleHotels, setAccessibleHotels] = useState([]);
  const [globalAccess, setGlobalAccess] = useState(false);
  const [hotelsLoaded, setHotelsLoaded] = useState(false);
  const [dateFrom, setDateFrom] = useState(isoDate(new Date(Date.now() - 29 * 86400000)));
  const [dateTo, setDateTo] = useState(isoDate(new Date()));
  const [summary, setSummary] = useState(null);
  const [trends, setTrends] = useState(null);
  const [breakdown, setBreakdown] = useState(null);
  const [aging, setAging] = useState(null);
  const [alerts, setAlerts] = useState(null);
  const [alertsPage, setAlertsPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [partial, setPartial] = useState(false);
  const [error, setError] = useState(null);

  const params = { hotelId: hotelId || undefined, dateFrom, dateTo };

  const load = useCallback(async (page) => {
    setLoading(true); setError(null);
    const results = await Promise.allSettled([
      dashboardService.getHotelFinancialDashboardSummary(params),
      dashboardService.getHotelFinancialDashboardTrends(params),
      dashboardService.getHotelFinancialDashboardBreakdown({ ...params, dimension: 'status' }),
      dashboardService.getHotelFinancialDashboardAging(params),
      dashboardService.getHotelFinancialDashboardAlerts({ ...params, page, limit: 10 }),
    ]);
    const [summaryRes, trendsRes, breakdownRes, agingRes, alertsRes] = results;
    let hadFailure = false;
    if (summaryRes.status === 'fulfilled') setSummary(summaryRes.value.summary); else { hadFailure = true; setSummary(null); }
    if (trendsRes.status === 'fulfilled') setTrends(trendsRes.value.trends); else hadFailure = true;
    if (breakdownRes.status === 'fulfilled') setBreakdown(breakdownRes.value.breakdown); else hadFailure = true;
    if (agingRes.status === 'fulfilled') setAging(agingRes.value.aging); else hadFailure = true;
    if (alertsRes.status === 'fulfilled') setAlerts(alertsRes.value); else hadFailure = true;
    if (summaryRes.status === 'rejected') {
      const status = summaryRes.reason?.response?.status;
      setError(status === 403 ? 'Accès refusé au dashboard financier.' : 'Impossible de charger le résumé financier.');
    } else if (hadFailure) {
      setPartial(true);
      toast.error('Certaines sections du dashboard sont indisponibles.');
    } else {
      setPartial(false);
    }
    setLoading(false);
  }, [hotelId, dateFrom, dateTo]);

  useEffect(() => {
    let cancelled = false;
    getAccessibleHotels().then((result) => {
      if (cancelled) return;
      setAccessibleHotels(result.hotels);
      setGlobalAccess(result.globalAccess);
      // Un seul hôtel accessible (non-Admin) : présélection automatique côté client, cohérente
      // avec la résolution serveur (§26) — l'utilisateur n'a jamais à saisir un identifiant.
      if (!initialHotelId && !result.globalAccess && result.hotels.length === 1) setHotelId(result.hotels[0].id);
      setHotelsLoaded(true);
    }).catch(() => setHotelsLoaded(true));
    return () => { cancelled = true; };
  }, [initialHotelId]);

  useEffect(() => { setAlertsPage(1); }, [hotelId, dateFrom, dateTo]);
  useEffect(() => { if (hotelsLoaded) load(alertsPage); }, [load, alertsPage, hotelsLoaded]);

  const applyQuickRange = (range) => { setDateFrom(isoDate(range.from())); setDateTo(isoDate(range.to())); };

  return (
    <DashboardPage data-testid="hotel-finance-dashboard">
      <DashboardPageHeader icon={Landmark} title="Dashboard financier hôtelier" description="Lecture du Financial Core — facturation, encaissements, allocations et anomalies." />

      <DashboardToolbar className="flex-wrap items-end">
        <div>
          <label className="block text-[11px] text-gray-500" htmlFor="hotel-finance-hotel-id">Hôtel</label>
          <select id="hotel-finance-hotel-id" className="rounded border px-2 py-1 text-xs" value={hotelId} onChange={(e) => setHotelId(e.target.value)} disabled={!hotelsLoaded || (accessibleHotels.length <= 1 && !globalAccess)}>
            {globalAccess && <option value="">Consolidation globale</option>}
            {accessibleHotels.length === 0 && !globalAccess && <option value="">Aucun hôtel accessible</option>}
            {accessibleHotels.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-[11px] text-gray-500" htmlFor="hotel-finance-from">Du</label>
          <input id="hotel-finance-from" type="date" className="rounded border px-2 py-1 text-xs" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
        </div>
        <div>
          <label className="block text-[11px] text-gray-500" htmlFor="hotel-finance-to">Au</label>
          <input id="hotel-finance-to" type="date" className="rounded border px-2 py-1 text-xs" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
        </div>
        <div className="flex flex-wrap gap-1">
          {QUICK_RANGES.map((range) => (
            <button key={range.key} type="button" className="rounded border px-2 py-1 text-[11px] hover:bg-gray-100" onClick={() => applyQuickRange(range)}>{range.label}</button>
          ))}
        </div>
        <button type="button" className="ml-auto rounded bg-gray-800 px-3 py-1 text-xs text-white" onClick={() => load(alertsPage)} disabled={loading}>
          {loading ? 'Chargement…' : 'Rafraîchir'}
        </button>
      </DashboardToolbar>

      {error && <DashboardState type="error" title="Dashboard financier indisponible" description={error} />}
      {!error && partial && <div className="mb-4 rounded border border-amber-300 bg-amber-50 p-2 text-xs text-amber-800">Données partielles : certaines sections n’ont pas pu être chargées.</div>}
      {!error && loading && !summary && <DashboardState type="loading" title="Chargement des données financières" />}

      {!error && summary && (
        <>
          <section className="mb-2 flex items-center gap-2 text-[11px] text-gray-500">
            <span>Devise : {summary.currency}</span>
            <span>·</span>
            <span>Généré à {new Date(summary.generatedAt).toLocaleString('fr-FR')}</span>
            <span>·</span>
            <span className={`rounded px-2 py-0.5 ${summary.dataStatus === 'critical' ? 'bg-red-100 text-red-800' : summary.dataStatus === 'warning' ? 'bg-amber-100 text-amber-800' : summary.dataStatus === 'unavailable' ? 'bg-gray-200 text-gray-600' : 'bg-green-100 text-green-800'}`}>
              État des données : {summary.dataStatus}
            </span>
          </section>

          <section className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4" data-testid="hotel-finance-kpis">
            <KpiCard label="CA facturé" value={money(summary.totals.invoicedMinor)} hint="Somme des FinancialDocument émis (issueDate dans la période)." />
            <KpiCard label="Encaissements confirmés" value={money(summary.totals.confirmedPaymentsMinor)} hint="Paiements succeeded (confirmedAt dans la période)." />
            <KpiCard label="Montants alloués" value={money(summary.totals.allocatedMinor)} hint="Allocations actives (allocatedAt dans la période)." />
            <KpiCard label="Solde restant à recevoir" value={money(summary.totals.outstandingMinor)} tone={summary.totals.outstandingMinor > 0 ? 'warning' : 'default'} hint="Somme des soldes positifs des documents émis." />
            <KpiCard label="Paiements confirmés non alloués" value={money(summary.totals.unallocatedConfirmedMinor)} tone={summary.totals.unallocatedConfirmedMinor > 0 ? 'warning' : 'default'} />
            <KpiCard label="Factures impayées" value={summary.documents.unpaidCount} />
            <KpiCard label="Factures partiellement payées" value={summary.documents.partiallyPaidCount} />
            <KpiCard label="Factures soldées" value={summary.documents.paidCount} />
            <KpiCard label="Documents en anomalie" value={summary.documents.anomalyCount ?? '—'} tone={summary.documents.anomalyCount ? 'critical' : 'default'} hint={summary.documents.anomalyCount == null ? 'Indisponible en vue consolidée : filtrez par hôtel.' : undefined} />
            <KpiCard label="Check-outs bloqués" value={summary.checkout.blockedCount} tone={summary.checkout.blockedCount ? 'warning' : 'default'} hint="Réservations checked-in avec facture émise et solde positif." />
            <KpiCard label="Dérogations financières" value={summary.checkout.overrideCount} />
            <KpiCard label="Emails de facture envoyés" value={summary.delivery.emailSentCount} />
            <KpiCard label="Emails échoués/incertains" value={summary.delivery.emailFailedCount + summary.delivery.emailUnknownCount} tone={summary.delivery.emailFailedCount + summary.delivery.emailUnknownCount > 0 ? 'warning' : 'default'} />
          </section>
        </>
      )}

      {!error && trends && (
        <DashboardCard className="mb-4">
          <h2 className="mb-2 text-xs font-semibold uppercase text-gray-600">Tendances ({trends.granularity})</h2>
          {trends.points.length === 0 ? (
            <p className="text-xs text-gray-500">Aucune facture émise sur cette période.</p>
          ) : (
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trends.points.map((p) => ({ name: new Date(p.periodStart).toLocaleDateString('fr-FR'), invoicedMinor: p.invoicedMinor, confirmedPaymentsMinor: p.confirmedPaymentsMinor, outstandingMinor: p.outstandingMinor }))}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip formatter={(value) => money(value)} />
                  <Line type="monotone" dataKey="invoicedMinor" name="Facturé" stroke="#2563eb" dot={false} />
                  <Line type="monotone" dataKey="confirmedPaymentsMinor" name="Encaissé" stroke="#16a34a" dot={false} />
                  <Line type="monotone" dataKey="outstandingMinor" name="Restant dû" stroke="#f59e0b" dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </DashboardCard>
      )}

      {!error && breakdown && (
        <DashboardCard className="mb-4">
          <h2 className="mb-2 text-xs font-semibold uppercase text-gray-600">Répartition par statut</h2>
          {breakdown.rows.length === 0 ? (
            <p className="text-xs text-gray-500">Aucune facture émise sur cette période.</p>
          ) : (
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={breakdown.rows.map((r) => ({ name: r.status, invoicedMinor: r.invoicedMinor }))}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip formatter={(value) => money(value)} />
                  <Bar dataKey="invoicedMinor" fill="#2563eb" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </DashboardCard>
      )}

      {!error && aging && (
        <DashboardCard className="mb-4">
          <h2 className="mb-2 text-xs font-semibold uppercase text-gray-600">Vieillissement des créances (depuis émission)</h2>
          <DashboardTableContainer label="Vieillissement des créances"><table className="w-full text-left text-xs">
            <thead><tr className="text-gray-500"><th className="py-1">Ancienneté</th><th>Factures</th><th>Solde restant</th></tr></thead>
            <tbody>
              {aging.buckets.map((bucket) => (
                <tr key={bucket.bucket} className="border-t"><td className="py-1">{bucket.bucket.replace('_', '–')} jours</td><td>{bucket.documentCount}</td><td>{money(bucket.outstandingMinor)}</td></tr>
              ))}
            </tbody>
          </table></DashboardTableContainer>
        </DashboardCard>
      )}

      {!error && alerts && (
        <DashboardCard className="mb-4">
          <h2 className="mb-2 text-xs font-semibold uppercase text-gray-600">Alertes opérationnelles</h2>
          {alerts.alerts.length === 0 ? (
            <p className="text-xs text-gray-500">Aucune anomalie financière détectée.</p>
          ) : (
            <ul className="space-y-2">
              {alerts.alerts.map((alertItem) => (
                <li key={`${alertItem.code}-${alertItem.entityId}`} className="flex items-start gap-2 rounded border p-2">
                  <span className={`rounded px-2 py-0.5 text-[10px] ${SEVERITY_CLASS[alertItem.severity] || 'bg-gray-100 text-gray-700'}`}>{SEVERITY_LABEL[alertItem.severity] || alertItem.severity}</span>
                  <div>
                    <div className="font-medium text-gray-800">{alertItem.title}</div>
                    <div className="text-gray-500">{alertItem.message}</div>
                  </div>
                </li>
              ))}
            </ul>
          )}
          <DashboardPagination page={alerts.pagination.page} totalPages={Math.max(1, Math.ceil(alerts.pagination.total / alerts.pagination.limit))} onPrevious={() => setAlertsPage((p) => Math.max(1, p - 1))} onNext={() => setAlertsPage((p) => p + 1)} />
        </DashboardCard>
      )}
    </DashboardPage>
  );
}
