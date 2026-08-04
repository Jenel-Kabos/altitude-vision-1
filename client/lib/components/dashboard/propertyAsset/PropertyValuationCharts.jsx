"use client";

// GL-ASSET-UX-1 — Phase 4 : valorisation graphique. Tout est calculé côté
// serveur (propertyAssetValuationService.computeValuation,
// propertyMaintenanceLogbookService.getMaintenanceLogbook) — jamais stocké,
// jamais recalculé selon une règle métier ici. Le regroupement des tickets
// de maintenance par année est un simple regroupement d'AFFICHAGE (même
// principe que le diff avant/après de AvenantModal.jsx, GL-UX-1), pas une
// décision. "Valeur estimée" n'existe pas (aucun moteur d'estimation fiable
// rattaché à un bien géré, voir GL-ASSET-1) — jamais inventée : seule la
// "valeur de référence" (prix déjà saisi) est affichée.
import React from "react";
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { DashboardCard } from "../DashboardUI";

const fmtFcfa = (n) => `${Number(n || 0).toLocaleString("fr-FR")} FCFA`;
const fmtPct = (n) => (n === null || n === undefined ? "—" : `${Number(n).toFixed(1)}%`);

function groupMaintenanceCostsByYear(tickets = []) {
  const byYear = {};
  tickets.forEach((t) => {
    if (!t.createdAt) return;
    const year = new Date(t.createdAt).getFullYear();
    byYear[year] = (byYear[year] || 0) + (t.actualCost || 0);
  });
  return Object.entries(byYear).sort(([a], [b]) => a - b).map(([year, cout]) => ({ year, cout }));
}

const PropertyValuationCharts = ({ valuation, logbook }) => {
  if (!valuation) return null;

  const revenusData = Object.entries(valuation.revenusParAnnee || {})
    .sort(([a], [b]) => a - b)
    .map(([year, montant]) => ({ year, montant }));

  let cumule = 0;
  const revenusCumulesData = revenusData.map(({ year, montant }) => {
    cumule += montant;
    return { year, cumule };
  });

  const coutsData = groupMaintenanceCostsByYear(logbook?.tickets);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <DashboardCard><p className="text-xs text-gray-500">Valeur de référence</p><p className="text-lg font-bold">{fmtFcfa(valuation.valeurReference)}</p></DashboardCard>
        <DashboardCard><p className="text-xs text-gray-500">Taux d'occupation</p><p className="text-lg font-bold">{fmtPct((valuation.tauxOccupation || 0) * 100)}</p></DashboardCard>
        <DashboardCard><p className="text-xs text-gray-500">Rentabilité brute</p><p className="text-lg font-bold">{fmtPct(valuation.rentabiliteBrute)}</p></DashboardCard>
        <DashboardCard><p className="text-xs text-gray-500">Rentabilité nette</p><p className="text-lg font-bold">{fmtPct(valuation.rentabiliteNette)}</p></DashboardCard>
      </div>

      {revenusData.length > 0 && (
        <DashboardCard>
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">Revenus par année</p>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={revenusData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="year" /><YAxis />
              <Tooltip formatter={(v) => fmtFcfa(v)} />
              <Bar dataKey="montant" fill="#185FA5" />
            </BarChart>
          </ResponsiveContainer>
        </DashboardCard>
      )}

      {revenusCumulesData.length > 0 && (
        <DashboardCard>
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">Revenus cumulés</p>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={revenusCumulesData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="year" /><YAxis />
              <Tooltip formatter={(v) => fmtFcfa(v)} />
              <Line type="monotone" dataKey="cumule" stroke="#C8960C" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </DashboardCard>
      )}

      {coutsData.length > 0 && (
        <DashboardCard>
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">Coût de maintenance par année</p>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={coutsData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="year" /><YAxis />
              <Tooltip formatter={(v) => fmtFcfa(v)} />
              <Bar dataKey="cout" fill="#991B1B" />
            </BarChart>
          </ResponsiveContainer>
        </DashboardCard>
      )}
    </div>
  );
};

export default PropertyValuationCharts;
