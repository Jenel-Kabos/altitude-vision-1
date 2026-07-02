"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useAuth } from "../../context/AuthContext";
import {
  ArrowLeft, User, Calendar, CheckCircle2,
  Clock, XCircle, TrendingUp, Receipt, RefreshCw, Loader2,
  CreditCard, Banknote, Landmark, FileText,
  Check, X, Ban, AlertCircle,
} from "lucide-react";
import Link from "next/link";
import {
  getAllTransactions, getStats, getMyTransactions, getPaiements,
  finalizeTransaction, cancelTransaction, validerVirement,
} from "../../services/transactionService";

const BLUE  = "#2E7BB5";
const GOLD  = "#C8960C";
const GREEN = "#16A34A";
const RED   = "#D42B2B";
const FONT  = "'DM Sans', sans-serif";

const STATUS_MAP = {
  "Réussie":             { color: GREEN, bg: "#F0FDF4", Icon: CheckCircle2,  label: "Réussie"             },
  "En cours":            { color: BLUE,  bg: "#EFF6FF", Icon: Clock,          label: "En cours"            },
  "Paiement en attente": { color: GOLD,  bg: "#FFFBEB", Icon: AlertCircle,    label: "Paiement en attente" },
  "Annulée":             { color: RED,   bg: "#FEF2F2", Icon: XCircle,        label: "Annulée"             },
  "Litigée":             { color: RED,   bg: "#FEF2F2", Icon: AlertCircle,    label: "Litigée"             },
};

const PAYMENT_STATUS_MAP = {
  non_initié: { color: "#94A3B8", label: "Non initié"  },
  en_attente: { color: GOLD,      label: "En attente"  },
  confirmé:   { color: GREEN,     label: "Confirmé"    },
  échoué:     { color: RED,       label: "Échoué"      },
  remboursé:  { color: "#64748B", label: "Remboursé"   },
};

const PAYMENT_METHODE_ICON = {
  cinetpay_mobile: CreditCard,
  cinetpay_carte:  CreditCard,
  virement:        Landmark,
  especes:         Banknote,
  cheque:          FileText,
};

const fmt = (n) =>
  new Intl.NumberFormat("fr-CG", { style: "currency", currency: "XAF", maximumFractionDigits: 0 }).format(n || 0);

const dateStr = (d) =>
  d ? new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" }) : "—";

function KpiCard({ label, value, color }) {
  return (
    <div style={{ background: "#fff", border: `1px solid ${color}22`, borderRadius: 12, padding: "18px 22px", flex: "1 1 140px", minWidth: 0 }}>
      <p style={{ fontFamily: FONT, fontSize: 11, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.08em", margin: "0 0 4px" }}>{label}</p>
      <p style={{ fontFamily: FONT, fontSize: 20, fontWeight: 700, color, margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{value}</p>
    </div>
  );
}

function Badge({ cfg }) {
  const { Icon } = cfg;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "3px 10px", borderRadius: 20, background: cfg.bg, color: cfg.color, fontFamily: FONT, fontSize: 11, fontWeight: 600 }}>
      {Icon && <Icon size={11} />}
      {cfg.label}
    </span>
  );
}

function InfoPill({ icon, label, color }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontFamily: FONT, fontSize: 12, color: color || "#64748B", background: "#F8FAFC", padding: "4px 10px", borderRadius: 20, border: "1px solid #F1F5F9" }}>
      {icon}{label}
    </span>
  );
}

function TransactionModal({ tx, onClose, onRefresh, isAdmin }) {
  const [paiements,        setPaiements]        = useState([]);
  const [loadingPaiements, setLoadingPaiements] = useState(false);
  const [action,           setAction]           = useState(null);
  const [validating,       setValidating]       = useState(false);
  const [cancelRaison,     setCancelRaison]     = useState('');

  useEffect(() => {
    setLoadingPaiements(true);
    getPaiements(tx._id).then(setPaiements).catch(() => {}).finally(() => setLoadingPaiements(false));
  }, [tx._id]);

  const handleFinalize = async () => {
    setValidating(true);
    try { await finalizeTransaction(tx._id); onRefresh(); onClose(); }
    catch (err) { alert(err.response?.data?.message || 'Erreur lors de la finalisation.'); }
    finally { setValidating(false); }
  };

  const handleCancel = async () => {
    if (!cancelRaison.trim()) { alert("Veuillez saisir une raison d'annulation."); return; }
    setValidating(true);
    try { await cancelTransaction(tx._id, cancelRaison); onRefresh(); onClose(); }
    catch (err) { alert(err.response?.data?.message || "Erreur lors de l'annulation."); }
    finally { setValidating(false); }
  };

  const handleValiderVirement = async (pId, virAction) => {
    setValidating(true);
    try {
      await validerVirement(tx._id, pId, { action: virAction });
      const updated = await getPaiements(tx._id);
      setPaiements(updated);
      onRefresh();
    } catch (err) { alert(err.response?.data?.message || 'Erreur.'); }
    finally { setValidating(false); }
  };

  const status    = STATUS_MAP[tx.status] || STATUS_MAP["En cours"];
  const payStatus = PAYMENT_STATUS_MAP[tx.paymentStatus] || PAYMENT_STATUS_MAP['non_initié'];
  const canFinalize = isAdmin && tx.status === 'Paiement en attente';
  const canCancel   = isAdmin && !['Réussie', 'Annulée'].includes(tx.status);

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 16 }} onClick={onClose}>
      <div style={{ background: "#fff", borderRadius: 16, width: "100%", maxWidth: 640, maxHeight: "90vh", overflow: "hidden", display: "flex", flexDirection: "column" }} onClick={e => e.stopPropagation()}>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "20px 24px", borderBottom: "1px solid #F1F5F9" }}>
          <div>
            <p style={{ fontFamily: FONT, fontWeight: 700, fontSize: 16, color: "#1E293B", margin: 0 }}>{tx.property?.title || "Transaction"}</p>
            <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
              <Badge cfg={status} />
              <span style={{ fontFamily: FONT, fontSize: 11, fontWeight: 600, color: payStatus.color, background: `${payStatus.color}18`, padding: "3px 10px", borderRadius: 20 }}>
                Paiement : {payStatus.label}
              </span>
            </div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "#94A3B8" }}><X size={20} /></button>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: "20px 24px" }}>
          <div style={{ background: "#F8FAFC", borderRadius: 12, padding: 16, marginBottom: 20 }}>
            <p style={{ fontFamily: FONT, fontSize: 11, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.08em", margin: "0 0 12px" }}>Montants</p>
            {[
              ["Montant final",            fmt(tx.finalAmount)],
              ["Commission (%)",           `${tx.commission?.taux || 10}%`],
              ["Commission totale",        fmt(tx.commission?.total)],
              ["Commission agence",        fmt(tx.commission?.agencyNet)],
              ["Reversement propriétaire", fmt(tx.commission?.ownerPayout)],
            ].map(([k, v]) => (
              <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid #F1F5F9" }}>
                <span style={{ fontFamily: FONT, fontSize: 13, color: "#64748B" }}>{k}</span>
                <span style={{ fontFamily: FONT, fontSize: 13, fontWeight: 600, color: "#1E293B" }}>{v}</span>
              </div>
            ))}
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 20 }}>
            {tx.agent?.name  && <InfoPill icon={<User size={13} color={BLUE} />} label={`Agent : ${tx.agent.name}`} />}
            {tx.client?.name && <InfoPill icon={<User size={13} color={GOLD} />} label={`Client : ${tx.client.name}`} />}
            <InfoPill icon={<Calendar size={13} color={BLUE} />} label={dateStr(tx.transactionDate)} />
            {tx.linkedInvoice && <InfoPill icon={<Receipt size={13} color={GREEN} />} label="Facture générée" color={GREEN} />}
          </div>

          {tx.notes && (
            <div style={{ background: "#FFFBEB", borderRadius: 8, padding: 12, marginBottom: 20, borderLeft: `3px solid ${GOLD}` }}>
              <p style={{ fontFamily: FONT, fontSize: 12, color: "#92400E", margin: 0 }}>{tx.notes}</p>
            </div>
          )}

          {tx.status === 'Annulée' && tx.annuleRaison && (
            <div style={{ background: "#FEF2F2", borderRadius: 8, padding: 12, marginBottom: 20, borderLeft: `3px solid ${RED}` }}>
              <p style={{ fontFamily: FONT, fontSize: 12, color: RED, margin: 0 }}><strong>Raison annulation :</strong> {tx.annuleRaison}</p>
              <p style={{ fontFamily: FONT, fontSize: 11, color: "#94A3B8", margin: "4px 0 0" }}>Le {dateStr(tx.annuleAt)}</p>
            </div>
          )}

          <div style={{ marginBottom: 20 }}>
            <p style={{ fontFamily: FONT, fontSize: 11, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.08em", margin: "0 0 12px" }}>Historique des paiements</p>
            {loadingPaiements ? (
              <p style={{ fontFamily: FONT, fontSize: 13, color: "#94A3B8" }}>Chargement…</p>
            ) : paiements.length === 0 ? (
              <p style={{ fontFamily: FONT, fontSize: 13, color: "#94A3B8" }}>Aucun paiement enregistré.</p>
            ) : paiements.map((p) => {
              const PIcon = PAYMENT_METHODE_ICON[p.methode] || CreditCard;
              const ps    = PAYMENT_STATUS_MAP[p.statut] || PAYMENT_STATUS_MAP['en_attente'];
              return (
                <div key={p._id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 0", borderBottom: "1px solid #F1F5F9" }}>
                  <div style={{ width: 36, height: 36, borderRadius: 8, background: `${ps.color}15`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <PIcon size={18} color={ps.color} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontFamily: FONT, fontSize: 13, fontWeight: 600, color: "#1E293B", margin: 0 }}>{p.provider || p.methode}</p>
                    <p style={{ fontFamily: FONT, fontSize: 11, color: "#94A3B8", margin: "2px 0 0" }}>{fmt(p.montant)} — {dateStr(p.createdAt)}</p>
                    {p.referenceBancaire && <p style={{ fontFamily: FONT, fontSize: 11, color: "#64748B", margin: "2px 0 0" }}>Réf : {p.referenceBancaire}</p>}
                    {p.preuvePaiement?.url && <a href={p.preuvePaiement.url} target="_blank" rel="noreferrer" style={{ fontFamily: FONT, fontSize: 11, color: BLUE }}>Voir justificatif</a>}
                  </div>
                  <span style={{ fontFamily: FONT, fontSize: 11, fontWeight: 600, color: ps.color, background: `${ps.color}15`, padding: "3px 10px", borderRadius: 20, flexShrink: 0 }}>{ps.label}</span>
                  {isAdmin && p.methode === 'virement' && p.statut === 'en_attente' && (
                    <div style={{ display: "flex", gap: 6 }}>
                      <button onClick={() => handleValiderVirement(p._id, 'valider')} disabled={validating} style={{ background: GREEN, color: "#fff", border: "none", borderRadius: 6, padding: "4px 10px", cursor: "pointer", fontSize: 11, fontFamily: FONT, display: "flex", alignItems: "center", gap: 4 }}>
                        <Check size={12} /> Valider
                      </button>
                      <button onClick={() => handleValiderVirement(p._id, 'rejeter')} disabled={validating} style={{ background: RED, color: "#fff", border: "none", borderRadius: 6, padding: "4px 10px", cursor: "pointer", fontSize: 11, fontFamily: FONT, display: "flex", alignItems: "center", gap: 4 }}>
                        <X size={12} /> Rejeter
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {isAdmin && (
            <div style={{ display: "flex", flexDirection: "column", gap: 12, paddingTop: 12, borderTop: "1px solid #F1F5F9" }}>
              {action === 'finalize' && (
                <div style={{ background: "#F0FDF4", borderRadius: 10, padding: 14 }}>
                  <p style={{ fontFamily: FONT, fontSize: 13, color: "#166534", margin: "0 0 10px" }}>Confirmer la finalisation de cette transaction ?</p>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button onClick={handleFinalize} disabled={validating} style={{ flex: 1, background: GREEN, color: "#fff", border: "none", borderRadius: 8, padding: 10, cursor: "pointer", fontFamily: FONT, fontWeight: 600 }}>
                      {validating ? "En cours…" : "Oui, finaliser"}
                    </button>
                    <button onClick={() => setAction(null)} style={{ flex: 1, background: "#F1F5F9", color: "#64748B", border: "none", borderRadius: 8, padding: 10, cursor: "pointer", fontFamily: FONT }}>Annuler</button>
                  </div>
                </div>
              )}
              {action === 'cancel' && (
                <div style={{ background: "#FEF2F2", borderRadius: 10, padding: 14 }}>
                  <p style={{ fontFamily: FONT, fontSize: 13, color: RED, margin: "0 0 8px" }}>Raison de l'annulation</p>
                  <textarea value={cancelRaison} onChange={e => setCancelRaison(e.target.value)} rows={2} placeholder="Motif obligatoire…" style={{ width: "100%", borderRadius: 8, border: "1px solid #FCA5A5", padding: 10, fontFamily: FONT, fontSize: 13, resize: "none", boxSizing: "border-box" }} />
                  <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                    <button onClick={handleCancel} disabled={validating || !cancelRaison.trim()} style={{ flex: 1, background: RED, color: "#fff", border: "none", borderRadius: 8, padding: 10, cursor: "pointer", fontFamily: FONT, fontWeight: 600 }}>
                      {validating ? "En cours…" : "Confirmer l'annulation"}
                    </button>
                    <button onClick={() => setAction(null)} style={{ flex: 1, background: "#F1F5F9", color: "#64748B", border: "none", borderRadius: 8, padding: 10, cursor: "pointer", fontFamily: FONT }}>Retour</button>
                  </div>
                </div>
              )}
              {!action && (
                <div style={{ display: "flex", gap: 8 }}>
                  {canFinalize && (
                    <button onClick={() => setAction('finalize')} style={{ flex: 1, background: GREEN, color: "#fff", border: "none", borderRadius: 8, padding: 11, cursor: "pointer", fontFamily: FONT, fontWeight: 600, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                      <Check size={15} /> Finaliser
                    </button>
                  )}
                  {canCancel && (
                    <button onClick={() => setAction('cancel')} style={{ flex: 1, background: "#FEF2F2", color: RED, border: `1px solid ${RED}33`, borderRadius: 8, padding: 11, cursor: "pointer", fontFamily: FONT, fontWeight: 600, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                      <Ban size={15} /> Annuler le dossier
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function TxRow({ tx, onOpen }) {
  const status  = STATUS_MAP[tx.status] || STATUS_MAP["En cours"];
  const payS    = PAYMENT_STATUS_MAP[tx.paymentStatus] || PAYMENT_STATUS_MAP['non_initié'];
  const typeLabel = tx.transactionType === 'vente' ? 'Vente' : 'Location';
  const typeColor = tx.transactionType === 'vente' ? BLUE : GOLD;

  return (
    <div
      onClick={() => onOpen(tx)}
      style={{ background: "#fff", border: "1px solid #F1F5F9", borderRadius: 12, padding: "16px 20px", cursor: "pointer", transition: "box-shadow .18s" }}
      onMouseEnter={e => e.currentTarget.style.boxShadow = "0 4px 16px rgba(0,0,0,0.07)"}
      onMouseLeave={e => e.currentTarget.style.boxShadow = "none"}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
        <div style={{ flex: 1 }}>
          <p style={{ fontFamily: FONT, fontWeight: 700, fontSize: 14, color: "#1E293B", margin: "0 0 6px" }}>
            {tx.property?.title || "Bien immobilier"}
          </p>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            <Badge cfg={status} />
            <span style={{ fontFamily: FONT, fontSize: 11, fontWeight: 600, color: payS.color, background: `${payS.color}15`, padding: "3px 10px", borderRadius: 20 }}>
              💳 {payS.label}
            </span>
            <span style={{ fontFamily: FONT, fontSize: 11, color: typeColor, background: `${typeColor}15`, padding: "3px 10px", borderRadius: 20 }}>
              {typeLabel}
            </span>
          </div>
        </div>
        <div style={{ textAlign: "right", flexShrink: 0 }}>
          <p style={{ fontFamily: FONT, fontSize: 16, fontWeight: 700, color: GOLD, margin: 0 }}>{fmt(tx.finalAmount)}</p>
          <p style={{ fontFamily: FONT, fontSize: 11, color: "#94A3B8", margin: "2px 0 0" }}>{dateStr(tx.transactionDate)}</p>
        </div>
      </div>
      {(tx.client?.name || tx.agent?.name) && (
        <div style={{ display: "flex", gap: 10, marginTop: 10, flexWrap: "wrap" }}>
          {tx.client?.name && <InfoPill icon={<User size={11} color={GOLD} />} label={tx.client.name} />}
          {tx.agent?.name  && <InfoPill icon={<User size={11} color={BLUE} />} label={tx.agent.name} />}
        </div>
      )}
    </div>
  );
}

const FILTERS = [
  { key: "all",                  label: "Toutes"           },
  { key: "En cours",             label: "En cours"         },
  { key: "Paiement en attente",  label: "Paiement reçu"    },
  { key: "Réussie",              label: "Réussies"         },
  { key: "Annulée",              label: "Annulées"         },
];

export default function TransactionsPage() {
  const { user } = useAuth();
  const isAdmin  = ['Admin', 'Collaborateur'].includes(user?.role);

  const [transactions, setTransactions] = useState([]);
  const [stats,        setStats]        = useState(null);
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState(null);
  const [filter,       setFilter]       = useState("all");
  const [selected,     setSelected]     = useState(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const [txRes, statsRes] = await Promise.allSettled([
        isAdmin ? getAllTransactions() : getMyTransactions(),
        isAdmin ? getStats() : Promise.resolve(null),
      ]);
      if (txRes.status === 'fulfilled') {
        const data = txRes.value;
        setTransactions(Array.isArray(data) ? data : (data?.data?.transactions || []));
      }
      if (statsRes.status === 'fulfilled') setStats(statsRes.value);
    } catch {
      setError("Impossible de charger les transactions.");
    } finally { setLoading(false); }
  }, [isAdmin]);

  useEffect(() => { load(); }, [load]);

  const filtered = filter === "all" ? transactions : transactions.filter(t => t.status === filter);

  return (
    <div style={{ fontFamily: FONT, background: "#F8FAFC", minHeight: "100vh", padding: "28px 20px" }}>
      <div style={{ maxWidth: 900, margin: "0 auto" }}>

        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 6 }}>
          <Link href="/dashboard" style={{ color: "#94A3B8" }}><ArrowLeft size={18} /></Link>
          <div>
            <h1 style={{ fontFamily: FONT, fontSize: 20, fontWeight: 700, color: "#1E293B", margin: 0 }}>
              {isAdmin ? "Gestion des transactions" : "Mes transactions"}
            </h1>
            <p style={{ fontFamily: FONT, fontSize: 12, color: "#94A3B8", margin: "2px 0 0" }}>
              Suivi des dossiers immobiliers et paiements
            </p>
          </div>
          <button onClick={load} style={{ marginLeft: "auto", background: "none", border: "none", cursor: "pointer", color: "#94A3B8" }} title="Rafraîchir">
            <RefreshCw size={16} />
          </button>
        </div>

        {isAdmin && stats && (
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", margin: "20px 0" }}>
            <KpiCard label="En cours"           value={stats.byStatus?.['En cours'] || 0}            color={BLUE}  />
            <KpiCard label="Paiement reçu"      value={stats.byStatus?.['Paiement en attente'] || 0} color={GOLD}  />
            <KpiCard label="Réussies"           value={stats.byStatus?.['Réussie'] || 0}             color={GREEN} />
            <KpiCard label="Volume total"       value={fmt(stats.totaux?.totalMontant)}               color={GOLD}  />
            <KpiCard label="Commissions agence" value={fmt(stats.totaux?.totalAgencyNet)}             color={GREEN} />
          </div>
        )}

        <div style={{ display: "flex", gap: 8, marginBottom: 18, flexWrap: "wrap" }}>
          {FILTERS.map(({ key, label }) => (
            <button key={key} onClick={() => setFilter(key)} style={{ fontFamily: FONT, fontSize: 12, padding: "6px 14px", borderRadius: 20, cursor: "pointer", border: filter === key ? `1.5px solid ${BLUE}` : "1.5px solid #E2E8F0", background: filter === key ? `${BLUE}10` : "#fff", color: filter === key ? BLUE : "#64748B" }}>
              {label}
            </button>
          ))}
        </div>

        {loading ? (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: 80 }}>
            <Loader2 size={28} color={BLUE} style={{ animation: "spin 1s linear infinite" }} />
          </div>
        ) : error ? (
          <div style={{ textAlign: "center", padding: 60, color: RED }}>
            <p style={{ fontFamily: FONT }}>{error}</p>
            <button onClick={load} style={{ marginTop: 10, color: BLUE, background: "none", border: "none", cursor: "pointer", fontFamily: FONT, textDecoration: "underline" }}>Réessayer</button>
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: "center", padding: 80 }}>
            <TrendingUp size={40} color="#E2E8F0" />
            <p style={{ fontFamily: FONT, fontSize: 14, color: "#94A3B8", margin: "12px 0 0" }}>Aucune transaction</p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {filtered.map(tx => <TxRow key={tx._id} tx={tx} onOpen={setSelected} />)}
          </div>
        )}
      </div>

      {selected && (
        <TransactionModal
          tx={selected}
          onClose={() => setSelected(null)}
          onRefresh={load}
          isAdmin={isAdmin}
        />
      )}
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
