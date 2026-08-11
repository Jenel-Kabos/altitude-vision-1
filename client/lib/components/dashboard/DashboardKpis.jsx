"use client";

import { DashboardKpiCard, DashboardKpiGrid, DashboardSkeleton } from './DashboardUI';

const money = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'XAF', maximumFractionDigits: 0 });

export default function DashboardKpis({ items = [], loading = false, note = null }) {
  if (loading) return <DashboardSkeleton />;
  return <div className="mb-6">
    <DashboardKpiGrid>
      {items.map(({ key, label, value, format, icon, tone, detail }) => <DashboardKpiCard key={key} label={label}
        value={format === 'money' ? money.format(Number(value) || 0) : (value ?? 0)} icon={icon} tone={tone} detail={detail} />)}
    </DashboardKpiGrid>
    {note && <p className="mt-2 text-xs text-amber-700">{note}</p>}
  </div>;
}
