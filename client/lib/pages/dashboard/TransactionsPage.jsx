"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useAuth } from "../../context/AuthContext";
import {
  ArrowLeft, Building2, User, Calendar, CheckCircle2,
  Clock, XCircle, TrendingUp, Receipt, RefreshCw, Loader2,
} from "lucide-react";
import Link from "next/link";
import api from "../../services/api";

const BLUE  = "#2E7BB5";
const GOLD  = "#C8960C";
const GREEN = "#16A34A";
const RED   = "#D42B2B";
const FONT  = "'DM Sans', sans-serif";

const STATUS_MAP = {
  "Réussie":  { color: GREEN,  bg: "#F0FDF4", icon: CheckCircle2, label: "Réussie"  },
  "En cours": { color: BLUE,   bg: "#EFF6FF", icon: Clock,        label: "En cours" },
  "Annulée":  { color: RED,    bg: "#FEF2F2", icon: XCircle,      label: "Annulée"  },
};

const TYPE_MAP = {
  vente:    { label: "Vente",    color: BLUE },
  location: { label: "Location", color: GOLD },
};

const fmt = (n) =>
  new Intl.NumberFormat("fr-CG", { style: "currency", currency: "XAF", maximumFractionDigits: 0 }).format(n || 0);

const dateStr = (d) =>
  new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL
  ? process.env.NEXT_PUBLIC_API_URL.replace("/api", "")
  : "https://altitude-vision.onrender.com";

const buildImgUrl = (path) => {
  if (!path) return null;
  if (path.startsWith("http")) return path;
  return `${BACKEND_URL}/${path.replace(/^\//, "")}`;
};

// ─── KPI card ────────────────────────────────────────────────────────────────
function KpiCard({ label, value, color, sub }) {
  return (
    <div style={{
      background: "#fff",
      border: `1px solid ${color}30`,
      borderRadius: 12,
      padding: "20px 24px",
      flex: "1 1 160px",
    }}>
      <p style={{ fontFamily: FONT, fontSize: 12, color: "#94A3B8", letterSpacing: "0.1em", textTransform: "uppercase", margin: "0 0 6px" }}>{label}</p>
      <p style={{ fontFamily: FONT, fontSize: 22, fontWeight: 700, color, margin: 0 }}>{value}</p>
      {sub && <p style={{ fontFamily: FONT, fontSize: 11, color: "#94A3B8", margin: "4px 0 0" }}>{sub}</p>}
    </div>
  );
}

// ─── Transaction card ─────────────────────────────────────────────────────────
function TransactionCard({ tx }) {
  const status  = STATUS_MAP[tx.status]  || STATUS_MAP["En cours"];
  const type    = TYPE_MAP[tx.transactionType] || { label: tx.transactionType, color: "#64748B" };
  const StatusIcon = status.icon;
  const img = buildImgUrl(tx.property?.images?.[0]);

  return (
    <div style={{
      background: "#fff",
      border: "1px solid #F1F5F9",
      borderRadius: 14,
      overflow: "hidden",
      display: "flex",
      gap: 0,
      transition: "box-shadow 0.2s",
    }}
    onMouseEnter={e => e.currentTarget.style.boxShadow = "0 4px 20px rgba(0,0,0,0.08)"}
    onMouseLeave={e => e.currentTarget.style.boxShadow = "none"}
    >
      {/* Image */}
      <div style={{
        width: 120, minHeight: 120, flexShrink: 0,
        background: "#F1F5F9",
        backgroundImage: img ? `url(${img})` : undefined,
        backgroundSize: "cover", backgroundPosition: "center",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        {!img && <Building2 size={32} color="#CBD5E1" />}
      </div>

      {/* Content */}
      <div style={{ flex: 1, padding: "16px 20px", display: "flex", flexDirection: "column", gap: 8 }}>
        {/* Header row */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
          <div>
            <p style={{ fontFamily: FONT, fontWeight: 700, fontSize: 15, color: "#1E293B", margin: 0 }}>
              {tx.property?.title || "Bien immobilier"}
            </p>
            <div style={{ display: "flex", gap: 8, marginTop: 4, flexWrap: "wrap" }}>
              <span style={{
                fontFamily: FONT, fontSize: 11, fontWeight: 600,
                color: type.color, background: `${type.color}15`,
                borderRadius: 20, padding: "2px 10px",
              }}>
                {type.label}
              </span>
              <span style={{
                fontFamily: FONT, fontSize: 11, fontWeight: 600,
                color: status.color, background: status.bg,
                borderRadius: 20, padding: "2px 10px",
                display: "flex", alignItems: "center", gap: 4,
              }}>
                <StatusIcon size={11} />
                {status.label}
              </span>
            </div>
          </div>
          <div style={{ textAlign: "right", flexShrink: 0 }}>
            <p style={{ fontFamily: FONT, fontSize: 18, fontWeight: 700, color: GOLD, margin: 0 }}>
              {fmt(tx.finalAmount)}
            </p>
            {tx.commission?.total > 0 && (
              <p style={{ fontFamily: FONT, fontSize: 11, color: "#94A3B8", margin: "2px 0 0" }}>
                Commission : {fmt(tx.commission.total)}
              </p>
            )}
          </div>
        </div>

        {/* Meta row */}
        <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
          {tx.agent?.name && (
            <span style={{ display: "flex", alignItems: "center", gap: 5, fontFamily: FONT, fontSize: 12, color: "#64748B" }}>
              <User size={13} color={BLUE} />
              Agent : {tx.agent.name}
            </span>
          )}
          <span style={{ display: "flex", alignItems: "center", gap: 5, fontFamily: FONT, fontSize: 12, color: "#64748B" }}>
            <Calendar size={13} color={GOLD} />
            {dateStr(tx.transactionDate)}
          </span>
          {tx.linkedInvoice && (
            <span style={{ display: "flex", alignItems: "center", gap: 5, fontFamily: FONT, fontSize: 12, color: GREEN }}>
              <Receipt size={13} />
              Facture générée
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function TransactionsPage() {
  const { user } = useAuth();
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState(null);
  const [filter, setFilter]             = useState("all");

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.get("/transactions/my");
      setTransactions(res.data?.data?.transactions || []);
    } catch (err) {
      setError("Impossible de charger vos transactions.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = filter === "all"
    ? transactions
    : transactions.filter((t) => t.status === filter);

  const kpis = {
    total:    transactions.length,
    reussies: transactions.filter((t) => t.status === "Réussie").length,
    montant:  transactions.filter((t) => t.status === "Réussie").reduce((s, t) => s + (t.finalAmount || 0), 0),
    enCours:  transactions.filter((t) => t.status === "En cours").length,
  };

  const FILTERS = [
    { key: "all",      label: "Toutes" },
    { key: "En cours", label: "En cours" },
    { key: "Réussie",  label: "Réussies" },
    { key: "Annulée",  label: "Annulées" },
  ];

  return (
    <div style={{ fontFamily: FONT, background: "#F8FAFC", minHeight: "100vh", padding: "32px 24px" }}>
      <div style={{ maxWidth: 860, margin: "0 auto" }}>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
          <Link href="/dashboard" style={{ color: "#94A3B8", display: "flex" }}>
            <ArrowLeft size={18} />
          </Link>
          <div>
            <h1 style={{ fontFamily: FONT, fontSize: 22, fontWeight: 700, color: "#1E293B", margin: 0 }}>
              Mes transactions
            </h1>
            <p style={{ fontFamily: FONT, fontSize: 13, color: "#94A3B8", margin: "2px 0 0" }}>
              Historique de vos transactions immobilières
            </p>
          </div>
          <button
            onClick={load}
            disabled={loading}
            style={{ marginLeft: "auto", background: "none", border: "none", cursor: "pointer", color: "#94A3B8" }}
            title="Rafraîchir"
          >
            <RefreshCw size={16} style={{ animation: loading ? "spin 1s linear infinite" : "none" }} />
          </button>
        </div>

        {/* KPIs */}
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", margin: "24px 0" }}>
          <KpiCard label="Total"     value={kpis.total}             color={BLUE}  />
          <KpiCard label="Réussies"  value={kpis.reussies}          color={GREEN} />
          <KpiCard label="En cours"  value={kpis.enCours}           color={GOLD}  />
          <KpiCard label="Montant total" value={fmt(kpis.montant)}  color={GOLD}  sub="transactions réussies" />
        </div>

        {/* Filters */}
        <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
          {FILTERS.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              style={{
                fontFamily: FONT, fontSize: 13, fontWeight: 500,
                padding: "6px 16px", borderRadius: 20, cursor: "pointer",
                border: filter === key ? `1.5px solid ${BLUE}` : "1.5px solid #E2E8F0",
                background: filter === key ? `${BLUE}12` : "#fff",
                color: filter === key ? BLUE : "#64748B",
                transition: "all 0.15s",
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Body */}
        {loading ? (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: 80 }}>
            <Loader2 size={28} color={BLUE} style={{ animation: "spin 1s linear infinite" }} />
          </div>
        ) : error ? (
          <div style={{ textAlign: "center", padding: 60, color: RED }}>
            <p style={{ fontFamily: FONT, margin: 0 }}>{error}</p>
            <button onClick={load} style={{ marginTop: 12, fontFamily: FONT, color: BLUE, background: "none", border: "none", cursor: "pointer", textDecoration: "underline" }}>
              Réessayer
            </button>
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: "center", padding: 80 }}>
            <TrendingUp size={40} color="#E2E8F0" />
            <p style={{ fontFamily: FONT, fontSize: 15, color: "#94A3B8", margin: "12px 0 0" }}>
              {filter === "all" ? "Aucune transaction pour l'instant" : `Aucune transaction "${filter}"`}
            </p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {filtered.map((tx) => (
              <TransactionCard key={tx._id} tx={tx} />
            ))}
          </div>
        )}

        <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      </div>
    </div>
  );
}
