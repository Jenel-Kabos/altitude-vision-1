"use client";

const money = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'XAF', maximumFractionDigits: 0 });

export default function DashboardKpis({ items = [], loading = false, note = null }) {
  if (loading) return <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6" aria-label="Chargement des indicateurs">{Array.from({ length: 4 }, (_, i) => <div key={i} className="h-24 rounded-xl bg-gray-100 animate-pulse" />)}</div>;
  return <div className="mb-6">
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {items.map(({ key, label, value, format }) => <div key={key} className="rounded-xl border bg-white p-4 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{label}</p>
        <p className="mt-2 text-2xl font-black text-gray-900">{format === 'money' ? money.format(Number(value) || 0) : (value ?? 0)}</p>
      </div>)}
    </div>
    {note && <p className="mt-2 text-xs text-amber-700">{note}</p>}
  </div>;
}
