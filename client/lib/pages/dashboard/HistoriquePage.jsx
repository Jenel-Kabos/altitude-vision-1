"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../../context/AuthContext";
import {
  getActionLogs,
  getActionLogStats,
  exportActionLogsCsv,
} from "../../services/actionLogService";

const BLUE  = "#2E7BB5";
const GOLD  = "#C8872A";
const RED   = "#D42B2B";
const GREEN = "#16A34A";
const FONT  = "'Outfit', sans-serif";

const MODULES = [
  "Altimmo", "MilaEvents", "Altcom", "GestionLocative",
  "Utilisateurs", "Actualites", "Portfolio", "Devis", "Messagerie", "Dashboard",
];

const TYPE_ACTIONS = [
  "CRÉATION", "MODIFICATION", "SUPPRESSION", "VALIDATION",
  "REJET", "CONNEXION", "DÉCONNEXION", "PAIEMENT",
  "GÉNÉRATION_PDF", "ENVOI_EMAIL", "CHANGEMENT_RÔLE", "UPLOAD_PHOTO",
];

const MODULE_COLORS = {
  Altimmo:        "#2E7BB5",
  MilaEvents:     "#C8872A",
  Altcom:         "#7C3AED",
  GestionLocative:"#16A34A",
  Utilisateurs:   "#D42B2B",
  Portfolio:      "#0891B2",
  Messagerie:     "#EA580C",
  Dashboard:      "#64748B",
  Actualites:     "#D97706",
  Devis:          "#9333EA",
};

const TYPE_COLORS = {
  CRÉATION:       "#16A34A",
  MODIFICATION:   "#2E7BB5",
  SUPPRESSION:    "#D42B2B",
  VALIDATION:     "#059669",
  REJET:          "#DC2626",
  CONNEXION:      "#0891B2",
  DÉCONNEXION:    "#64748B",
  PAIEMENT:       "#C8872A",
  GÉNÉRATION_PDF: "#7C3AED",
  ENVOI_EMAIL:    "#EA580C",
  "CHANGEMENT_RÔLE": "#D97706",
  UPLOAD_PHOTO:   "#0891B2",
};

const TYPE_ICONS = {
  CRÉATION:       "➕",
  MODIFICATION:   "✏️",
  SUPPRESSION:    "🗑️",
  VALIDATION:     "✅",
  REJET:          "❌",
  CONNEXION:      "🔓",
  DÉCONNEXION:    "🔒",
  PAIEMENT:       "💰",
  GÉNÉRATION_PDF: "📄",
  ENVOI_EMAIL:    "📧",
  "CHANGEMENT_RÔLE": "🎭",
  UPLOAD_PHOTO:   "📸",
};

const fmt = (d) => {
  if (!d) return "—";
  const dt = new Date(d);
  return dt.toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" }) +
    " " + dt.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
};

const groupByDay = (logs) => {
  const groups = {};
  logs.forEach((l) => {
    const day = new Date(l.date).toLocaleDateString("fr-FR", {
      weekday: "long", day: "numeric", month: "long", year: "numeric",
    });
    if (!groups[day]) groups[day] = [];
    groups[day].push(l);
  });
  return Object.entries(groups);
};

// ── Stat card ──────────────────────────────────────────────────
const StatCard = ({ label, value, color, icon }) => (
  <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex items-center gap-4">
    <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl"
         style={{ background: color + "18" }}>
      {icon}
    </div>
    <div>
      <p className="text-2xl font-bold text-gray-900" style={{ fontFamily: FONT }}>{value ?? "—"}</p>
      <p className="text-xs text-gray-500 mt-0.5">{label}</p>
    </div>
  </div>
);

// ── Main component ─────────────────────────────────────────────
const HistoriquePage = () => {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [logs,    setLogs]    = useState([]);
  const [stats,   setStats]   = useState(null);
  const [total,   setTotal]   = useState(0);
  const [page,    setPage]    = useState(1);
  const [pages,   setPages]   = useState(1);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  const [filters, setFilters] = useState({
    module:     "",
    typeAction: "",
    dateFrom:   "",
    dateTo:     "",
    search:     "",
  });

  const LIMIT = 50;

  const fetchData = useCallback(async (pg = 1) => {
    setLoading(true);
    try {
      const [logsRes, statsRes] = await Promise.all([
        getActionLogs({ ...filters, page: pg, limit: LIMIT }),
        getActionLogStats(30),
      ]);
      setLogs(logsRes?.data?.logs || []);
      setTotal(logsRes?.total || 0);
      setPages(logsRes?.pages || 1);
      setStats(statsRes);
    } catch (err) {
      console.error("[Historique]", err.message);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    if (!authLoading && user?.role !== "Admin") {
      router.replace("/dashboard");
    }
  }, [authLoading, user, router]);

  useEffect(() => {
    if (!authLoading && user?.role === "Admin") {
      setPage(1);
      fetchData(1);
    }
  }, [authLoading, user, fetchData]);

  const handleFilter = (e) => {
    const { name, value } = e.target;
    setFilters((f) => ({ ...f, [name]: value }));
  };

  const handleSearch = (e) => {
    e.preventDefault();
    setPage(1);
    fetchData(1);
  };

  const handlePageChange = (newPage) => {
    setPage(newPage);
    fetchData(newPage);
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      await exportActionLogsCsv(filters);
    } catch (err) {
      console.error("[Export CSV]", err.message);
    } finally {
      setExporting(false);
    }
  };

  if (authLoading) return null;
  if (user?.role !== "Admin") return null;

  const grouped = groupByDay(logs);

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-8 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="mb-8 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900" style={{ fontFamily: FONT }}>
            📋 Historique des actions
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {total.toLocaleString("fr-FR")} action{total > 1 ? "s" : ""} enregistrée{total > 1 ? "s" : ""}
          </p>
        </div>
        <button
          onClick={handleExport}
          disabled={exporting}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white"
          style={{ background: exporting ? "#94A3B8" : BLUE, fontFamily: FONT }}
        >
          {exporting ? "Export…" : "⬇ Exporter CSV"}
        </button>
      </div>

      {/* Stats bar */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
          <StatCard label="Actions (30j)" value={stats.total?.toLocaleString("fr-FR")} color={BLUE}  icon="📊" />
          <StatCard label="Top module"
            value={stats.byModule?.[0]?._id || "—"}
            color={MODULE_COLORS[stats.byModule?.[0]?._id] || GOLD}
            icon="🏆" />
          <StatCard label="Top type"
            value={stats.byType?.[0]?._id || "—"}
            color={TYPE_COLORS[stats.byType?.[0]?._id] || GREEN}
            icon={TYPE_ICONS[stats.byType?.[0]?._id] || "⚡"} />
          <StatCard label="Modules actifs"
            value={stats.byModule?.length ?? "—"}
            color="#7C3AED"
            icon="🗂️" />
        </div>
      )}

      {/* Filters */}
      <form onSubmit={handleSearch}
        className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-6 flex flex-wrap gap-3 items-end">
        <div className="flex-1 min-w-[180px]">
          <label className="block text-xs font-medium text-gray-500 mb-1">Recherche</label>
          <input
            type="text"
            name="search"
            value={filters.search}
            onChange={handleFilter}
            placeholder="Action, auteur, cible…"
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-100"
          />
        </div>
        <div className="min-w-[140px]">
          <label className="block text-xs font-medium text-gray-500 mb-1">Module</label>
          <select name="module" value={filters.module} onChange={handleFilter}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-100">
            <option value="">Tous</option>
            {MODULES.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>
        <div className="min-w-[160px]">
          <label className="block text-xs font-medium text-gray-500 mb-1">Type</label>
          <select name="typeAction" value={filters.typeAction} onChange={handleFilter}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-100">
            <option value="">Tous</option>
            {TYPE_ACTIONS.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div className="min-w-[130px]">
          <label className="block text-xs font-medium text-gray-500 mb-1">Du</label>
          <input type="date" name="dateFrom" value={filters.dateFrom} onChange={handleFilter}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-100" />
        </div>
        <div className="min-w-[130px]">
          <label className="block text-xs font-medium text-gray-500 mb-1">Au</label>
          <input type="date" name="dateTo" value={filters.dateTo} onChange={handleFilter}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-100" />
        </div>
        <button type="submit"
          className="px-5 py-2 rounded-xl text-sm font-medium text-white"
          style={{ background: BLUE, fontFamily: FONT }}>
          Filtrer
        </button>
        <button type="button"
          onClick={() => { setFilters({ module: "", typeAction: "", dateFrom: "", dateTo: "", search: "" }); setTimeout(() => fetchData(1), 0); }}
          className="px-4 py-2 rounded-xl text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200">
          Réinitialiser
        </button>
      </form>

      {/* Timeline */}
      {loading ? (
        <div className="flex justify-center items-center py-20">
          <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-500 rounded-full animate-spin" />
        </div>
      ) : logs.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-12 text-center text-gray-400">
          <p className="text-4xl mb-3">📭</p>
          <p className="text-sm">Aucune action enregistrée pour ces critères.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {grouped.map(([day, dayLogs]) => (
            <div key={day}>
              <div className="flex items-center gap-3 mb-3">
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{day}</span>
                <span className="flex-1 h-px bg-gray-200" />
                <span className="text-xs text-gray-400">{dayLogs.length} action{dayLogs.length > 1 ? "s" : ""}</span>
              </div>
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm divide-y divide-gray-50">
                {dayLogs.map((log) => (
                  <div key={log._id} className="flex items-start gap-4 px-5 py-4 hover:bg-gray-50 transition-colors">
                    {/* Icon */}
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center text-lg shrink-0 mt-0.5"
                         style={{ background: (TYPE_COLORS[log.typeAction] || "#94A3B8") + "18" }}>
                      {TYPE_ICONS[log.typeAction] || "•"}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold text-gray-900">{log.action}</span>
                        {log.module && (
                          <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                                style={{ background: (MODULE_COLORS[log.module] || "#94A3B8") + "18",
                                         color: MODULE_COLORS[log.module] || "#94A3B8" }}>
                            {log.module}
                          </span>
                        )}
                        {log.typeAction && (
                          <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                                style={{ background: (TYPE_COLORS[log.typeAction] || "#94A3B8") + "18",
                                         color: TYPE_COLORS[log.typeAction] || "#94A3B8" }}>
                            {log.typeAction}
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-500 mt-0.5 truncate">{log.description}</p>
                      <div className="flex items-center gap-3 mt-1 text-xs text-gray-400 flex-wrap">
                        {log.auteur?.nom && (
                          <span className="flex items-center gap-1">
                            <span>👤</span>
                            <span>{log.auteur.nom}</span>
                            {log.auteur.role && <span className="text-gray-300">({log.auteur.role})</span>}
                          </span>
                        )}
                        {log.cible?.nom && (
                          <span className="flex items-center gap-1">
                            <span>🎯</span>
                            <span className="truncate max-w-[200px]">{log.cible.nom}</span>
                          </span>
                        )}
                        {log.metadata?.ip && (
                          <span className="flex items-center gap-1">
                            <span>🌐</span>
                            <span>{log.metadata.ip}</span>
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Timestamp */}
                    <span className="text-xs text-gray-400 shrink-0 mt-1 tabular-nums">
                      {new Date(log.date).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {pages > 1 && (
        <div className="flex justify-center items-center gap-2 mt-8">
          <button onClick={() => handlePageChange(page - 1)} disabled={page <= 1}
            className="px-4 py-2 rounded-xl text-sm font-medium border border-gray-200 bg-white disabled:opacity-40 hover:bg-gray-50">
            ← Précédent
          </button>
          <span className="text-sm text-gray-500">Page {page} / {pages}</span>
          <button onClick={() => handlePageChange(page + 1)} disabled={page >= pages}
            className="px-4 py-2 rounded-xl text-sm font-medium border border-gray-200 bg-white disabled:opacity-40 hover:bg-gray-50">
            Suivant →
          </button>
        </div>
      )}
    </div>
  );
};

export default HistoriquePage;
