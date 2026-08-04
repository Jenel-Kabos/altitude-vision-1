"use client";

// GL-ASSET-UX-1 — Phase 3 : cockpit patrimonial complet. Compose les
// éléments déjà construits (AssetLifecycleCard, PropertyValuationCharts,
// MaintenanceLogbookTimeline, PropertyAlertsPanel) plutôt que de dupliquer
// leur logique. L'historique complet / documents / contrats / transactions
// restent la responsabilité du Centre documentaire déjà généralisé
// (DossierPanel domain="bien", Phase 7) — ouvert ici en un clic, jamais
// réimplémenté une seconde fois.
import React, { useEffect, useState } from "react";
import { DashboardState } from "../DashboardUI";
import AssetLifecycleCard from "./AssetLifecycleCard";
import PropertyValuationCharts from "./PropertyValuationCharts";
import MaintenanceLogbookTimeline from "./MaintenanceLogbookTimeline";
import PropertyAlertsPanel from "./PropertyAlertsPanel";
import DossierPanel from "../DossierPanel";
import { getPropertyValuation, getPropertyMaintenanceLogbook, getPropertyAlerts } from "../../../services/propertyAssetService";

const fmtFcfa = (n) => (n || n === 0 ? `${Number(n).toLocaleString("fr-FR")} FCFA` : "—");
const anciennete = (createdAt) => {
  if (!createdAt) return "—";
  const jours = Math.floor((Date.now() - new Date(createdAt).getTime()) / (24 * 60 * 60 * 1000));
  if (jours < 30) return `${jours} jour(s)`;
  if (jours < 365) return `${Math.floor(jours / 30)} mois`;
  return `${(jours / 365).toFixed(1)} an(s)`;
};

const PropertyAssetCockpit = ({ property }) => {
  const [valuation, setValuation] = useState(null);
  const [logbook, setLogbook] = useState(null);
  const [alerts, setAlerts] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showDossier, setShowDossier] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [v, l, a] = await Promise.all([
        getPropertyValuation(property._id),
        getPropertyMaintenanceLogbook(property._id),
        getPropertyAlerts(property._id),
      ]);
      setValuation(v); setLogbook(l); setAlerts(a);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [property._id]);

  if (loading) return <DashboardState type="loading" title="Chargement du cockpit patrimonial…" />;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="border border-gray-100 rounded-xl p-3">
          <p className="text-xs text-gray-500">Valeur patrimoniale</p>
          <p className="text-lg font-bold">{fmtFcfa(valuation?.valeurReference)}</p>
        </div>
        <div className="border border-gray-100 rounded-xl p-3">
          <p className="text-xs text-gray-500">Rendement net</p>
          <p className="text-lg font-bold">{valuation?.rentabiliteNette !== null && valuation?.rentabiliteNette !== undefined ? `${valuation.rentabiliteNette.toFixed(1)}%` : "—"}</p>
        </div>
        <div className="border border-gray-100 rounded-xl p-3">
          <p className="text-xs text-gray-500">Occupation</p>
          <p className="text-lg font-bold">{valuation ? `${Math.round((valuation.tauxOccupation || 0) * 100)}%` : "—"}</p>
        </div>
        <div className="border border-gray-100 rounded-xl p-3">
          <p className="text-xs text-gray-500">Ancienneté</p>
          <p className="text-lg font-bold">{anciennete(property.createdAt)}</p>
        </div>
      </div>

      <AssetLifecycleCard propertyId={property._id} onChanged={load} />

      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">Alertes</p>
        <PropertyAlertsPanel alerts={alerts} />
      </div>

      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">Valorisation</p>
        <PropertyValuationCharts valuation={valuation} logbook={logbook} />
      </div>

      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">Carnet d'entretien</p>
        <MaintenanceLogbookTimeline logbook={logbook} />
      </div>

      <button onClick={() => setShowDossier(true)} className="text-sm font-medium px-4 py-2 rounded-lg border border-gray-300 hover:bg-gray-50">
        Ouvrir le dossier complet (historique, documents, contrats, transactions)
      </button>

      {showDossier && (
        <DossierPanel domain="bien" entityId={property._id} onClose={() => setShowDossier(false)} />
      )}
    </div>
  );
};

export default PropertyAssetCockpit;
