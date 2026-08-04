"use client";

// GL-UX-1 — Phase 8 : tableau de bord du cycle de vie. Purement un rendu
// des données déjà calculées par rentalLeaseDashboardService.getLeaseLifecycleDashboard()
// (server, tout dérivé, aucun stockage) — aucun calcul supplémentaire ici.
import React, { useEffect, useState } from "react";
import { getLeaseLifecycleDashboard } from "../../../services/rentalLeaseLifecycleService";
import { DashboardCard, DashboardState } from "../DashboardUI";

const SECTIONS = [
  { key: "bauxAEcheance", label: "Baux à échéance", empty: "Aucun bail à échéance." },
  { key: "renouvellementsAPreparer", label: "Renouvellements à préparer", empty: "Rien à préparer." },
  { key: "preavisEnAttente", label: "Préavis en attente", empty: "Aucun préavis en attente." },
  { key: "inspectionsAProgrammer", label: "Inspections à programmer", empty: "Aucune inspection à programmer." },
  { key: "cautionsARestituer", label: "Cautions à restituer", empty: "Aucune caution à restituer." },
  { key: "dossiersBloques", label: "Dossiers bloqués", empty: "Aucun dossier bloqué." },
];

const LeaseLifecycleDashboard = () => {
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await getLeaseLifecycleDashboard();
        if (!cancelled) setDashboard(data);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  if (loading) return <DashboardState type="loading" title="Chargement du tableau de bord…" />;
  if (!dashboard) return null;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-6">
      {SECTIONS.map(({ key, label, empty }) => {
        const items = dashboard[key] || [];
        return (
          <DashboardCard key={key}>
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1">{label}</p>
            <p className="text-2xl font-bold" style={{ fontFamily: "'Cormorant Garamond', serif" }}>{items.length}</p>
            {items.length === 0 ? (
              <p className="text-xs text-gray-400 mt-1">{empty}</p>
            ) : (
              <ul className="text-xs text-gray-600 mt-1 space-y-0.5">
                {items.slice(0, 3).map((item, i) => (
                  <li key={item.contratId || item.rentalManagementId || i}>{item.bien || "—"}</li>
                ))}
                {items.length > 3 && <li className="text-gray-400">+{items.length - 3} autre(s)</li>}
              </ul>
            )}
          </DashboardCard>
        );
      })}
    </div>
  );
};

export default LeaseLifecycleDashboard;
