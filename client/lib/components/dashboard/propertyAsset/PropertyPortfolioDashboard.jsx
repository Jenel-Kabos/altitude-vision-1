"use client";

// Patrimoine du tenant actif : le serveur reste autorité du périmètre et des calculs.
import React, { useEffect, useState } from "react";
import { usePlatformTenantRuntime } from "../../../context/PlatformTenantRuntimeContext";
import { getPortfolioDashboard } from "../../../services/propertyAssetService";
import { DashboardCard, DashboardState } from "../DashboardUI";

const fmtFcfa = (n) => `${Number(n || 0).toLocaleString("fr-FR")} FCFA`;
const fmtPct = (n) => (n === null || n === undefined ? "—" : `${Number(n).toFixed(1)}%`);

const PropertyPortfolioDashboard = ({ status } = {}) => {
  const { selectedTenantId, tenantLoading } = usePlatformTenantRuntime();
  const scopeKey = selectedTenantId && !tenantLoading ? `${selectedTenantId}:${status || 'all'}` : null;
  const [state, setState] = useState({ scopeKey: null, dashboard: null, loading: true, error: false });

  useEffect(() => {
    let cancelled = false;
    setState({ scopeKey, dashboard: null, loading: Boolean(scopeKey), error: false });
    if (!scopeKey) return () => { cancelled = true; };
    (async () => {
      try {
        const dashboard = await getPortfolioDashboard(status);
        if (!cancelled) setState({ scopeKey, dashboard, loading: false, error: false });
      } catch {
        if (!cancelled) setState({ scopeKey, dashboard: null, loading: false, error: true });
      }
    })();
    return () => { cancelled = true; };
  }, [scopeKey, status]);

  if (!scopeKey) return null;
  // Scope matching also suppresses old values during the render before effects run.
  if (state.scopeKey !== scopeKey || state.loading) return <DashboardState type="loading" title="Chargement du dashboard patrimoine…" />;
  if (state.error) return <DashboardState type="error" title="Erreur lors du chargement du patrimoine." />;
  const { dashboard } = state;
  if (!dashboard) return null;

  return (
    <div className="space-y-4 mb-6">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <DashboardCard><p className="text-xs text-gray-500">Valeur totale</p><p className="text-lg font-bold">{fmtFcfa(dashboard.valeurTotale)}</p></DashboardCard>
        <DashboardCard><p className="text-xs text-gray-500">Rentabilité moyenne</p><p className="text-lg font-bold">{fmtPct(dashboard.rentabiliteMoyenne)}</p></DashboardCard>
        <DashboardCard><p className="text-xs text-gray-500">Biens vacants</p><p className="text-lg font-bold text-amber-600">{dashboard.biensVacants}</p></DashboardCard>
        <DashboardCard><p className="text-xs text-gray-500">Biens occupés</p><p className="text-lg font-bold text-green-600">{dashboard.biensOccupes}</p></DashboardCard>
        <DashboardCard><p className="text-xs text-gray-500">Coût d'entretien</p><p className="text-lg font-bold">{fmtFcfa(dashboard.coutEntretienTotal)}</p></DashboardCard>
        <DashboardCard><p className="text-xs text-gray-500">Alertes critiques</p><p className="text-lg font-bold text-red-600">{dashboard.alertesCritiques}</p></DashboardCard>
        <DashboardCard><p className="text-xs text-gray-500">Alertes attention</p><p className="text-lg font-bold text-amber-600">{dashboard.alertesAttention}</p></DashboardCard>
        <DashboardCard><p className="text-xs text-gray-500">Total biens</p><p className="text-lg font-bold">{dashboard.totalBiens}</p></DashboardCard>
      </div>

      {Object.keys(dashboard.valeurParType || {}).length > 0 && (
        <DashboardCard>
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">Valeur par type</p>
          <ul className="text-sm space-y-1">
            {Object.entries(dashboard.valeurParType).map(([type, valeur]) => (
              <li key={type} className="flex justify-between"><span>{type}</span><span className="font-medium">{fmtFcfa(valeur)}</span></li>
            ))}
          </ul>
        </DashboardCard>
      )}

      {dashboard.topRentabilite?.length > 0 && (
        <DashboardCard>
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">Top rentabilité</p>
          <ul className="text-sm space-y-1">
            {dashboard.topRentabilite.map((r) => (
              <li key={r.propertyId} className="flex justify-between"><span>{r.title}</span><span className="font-medium">{fmtPct(r.rentabiliteNette)}</span></li>
            ))}
          </ul>
        </DashboardCard>
      )}

      {dashboard.historiqueRecent?.length > 0 && (
        <DashboardCard>
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">Historique récent</p>
          <ul className="text-sm space-y-1">
            {dashboard.historiqueRecent.map((h, i) => (
              <li key={i} className="flex justify-between text-gray-600">
                <span>{h.title} — {h.label}</span>
                <span className="text-xs text-gray-400">{new Date(h.at).toLocaleDateString("fr-FR")}</span>
              </li>
            ))}
          </ul>
        </DashboardCard>
      )}
    </div>
  );
};

export default PropertyPortfolioDashboard;
