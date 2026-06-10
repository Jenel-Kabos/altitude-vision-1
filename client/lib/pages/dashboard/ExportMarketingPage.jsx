"use client";

import React, { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../../context/AuthContext";
import { getExportStats, downloadExportCsv } from "../../services/exportMarketingService";

// ── Constantes ───────────────────────────────────────────────
const BLUE  = "#2E7BB5";
const GOLD  = "#C8872A";
const GREEN = "#16A34A";
const RED   = "#D42B2B";
const FONT  = "'Outfit', sans-serif";

const SOURCES = [
  { key: "proprietaires", label: "Propriétaires",       icon: "👤" },
  { key: "locataires",    label: "Locataires",           icon: "🏠" },
  { key: "clients",       label: "Clients inscrits",     icon: "🧑" },
  { key: "devis",         label: "Demandes de devis",    icon: "📋" },
  { key: "contacts",      label: "Formulaire contact",   icon: "📧" },
];

const FORMATS = [
  {
    key:      "standard",
    icon:     "📄",
    label:    "CSV Standard",
    sub:      "Pour Excel, Google Sheets",
    btn:      "Télécharger CSV",
    color:    BLUE,
    cols:     "Prénom · Nom · Email · Téléphone · Source · Ville · Date",
  },
  {
    key:      "facebook",
    icon:     "📘",
    label:    "Facebook / Instagram Ads",
    sub:      "Format Custom Audiences Facebook",
    btn:      "Télécharger pour Facebook",
    color:    "#1877F2",
    cols:     "email · phone · fn · ln · country · ct",
  },
  {
    key:      "google",
    icon:     "🟡",
    label:    "Google Ads",
    sub:      "Format Customer Match Google Ads",
    btn:      "Télécharger pour Google",
    color:    "#EA4335",
    cols:     "Email Address · Phone Number · First Name · Last Name",
  },
  {
    key:      "whatsapp",
    icon:     "📱",
    label:    "WhatsApp / Numéros",
    sub:      "Liste des numéros uniquement (+242…)",
    btn:      "Télécharger numéros",
    color:    "#25D366",
    cols:     "Téléphone (+242XXXXXXXXX)",
  },
];

// ── Toast ────────────────────────────────────────────────────
const Toast = ({ msg, type, onClose }) => {
  useEffect(() => { const t = setTimeout(onClose, 4000); return () => clearTimeout(t); }, [onClose]);
  const bg = type === "success" ? GREEN : type === "warn" ? GOLD : RED;
  return (
    <div style={{ position:"fixed",bottom:24,right:24,zIndex:9999,background:bg,
                  color:"#fff",padding:"12px 20px",borderRadius:12,fontFamily:FONT,
                  fontSize:14,boxShadow:"0 4px 20px rgba(0,0,0,0.15)",maxWidth:320 }}>
      {msg}
    </div>
  );
};

// ── Barre de progression ──────────────────────────────────────
const ProgressBar = ({ value, max, color }) => {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="flex items-center gap-3 w-full">
      <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all duration-500"
             style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className="text-xs text-gray-400 w-8 text-right tabular-nums">{pct}%</span>
    </div>
  );
};

// ── Composant principal ───────────────────────────────────────
const ExportMarketingPage = () => {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [stats,     setStats]     = useState(null);
  const [loading,   setLoading]   = useState(true);
  const [exporting, setExporting] = useState(null); // key du format en cours
  const [toast,     setToast]     = useState(null);

  // Filtres
  const [sources,       setSources]       = useState({
    proprietaires: true,
    locataires:    true,
    clients:       true,
    devis:         true,
    contacts:      true,
  });
  const [dateDebut,     setDateDebut]     = useState("");
  const [dateFin,       setDateFin]       = useState("");
  const [ville,         setVille]         = useState("");
  const [requireEmail,  setRequireEmail]  = useState(false);
  const [requirePhone,  setRequirePhone]  = useState(false);
  const [requireBoth,   setRequireBoth]   = useState(false);

  const debounceRef = useRef(null);

  const buildParams = useCallback(() => {
    const activeSources = Object.entries(sources)
      .filter(([, v]) => v)
      .map(([k]) => k)
      .join(",");
    return {
      source:       activeSources || "tous",
      dateDebut:    dateDebut   || undefined,
      dateFin:      dateFin     || undefined,
      ville:        ville       || undefined,
      requireEmail: requireBoth || requireEmail ? "1" : undefined,
      requirePhone: requireBoth || requirePhone ? "1" : undefined,
    };
  }, [sources, dateDebut, dateFin, ville, requireEmail, requirePhone, requireBoth]);

  const fetchStats = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getExportStats(buildParams());
      setStats(data);
    } catch (err) {
      console.error("[ExportMarketing]", err.message);
    } finally {
      setLoading(false);
    }
  }, [buildParams]);

  // Auth guard
  useEffect(() => {
    if (!authLoading && user?.role !== "Admin") router.replace("/dashboard");
  }, [authLoading, user, router]);

  // Chargement initial
  useEffect(() => {
    if (!authLoading && user?.role === "Admin") fetchStats();
  }, [authLoading, user]); // eslint-disable-line

  // Mise à jour automatique au changement des filtres (debounce 500ms)
  useEffect(() => {
    if (!authLoading && user?.role === "Admin") {
      clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(fetchStats, 500);
    }
    return () => clearTimeout(debounceRef.current);
  }, [sources, dateDebut, dateFin, ville, requireEmail, requirePhone, requireBoth]); // eslint-disable-line

  const handleExport = async (fmt) => {
    setExporting(fmt);
    try {
      await downloadExportCsv({ ...buildParams(), format: fmt });
      const n = stats?.total ?? 0;
      setToast({ msg: `✅ ${n} contact${n > 1 ? "s" : ""} exporté${n > 1 ? "s" : ""}`, type: "success" });
    } catch (err) {
      setToast({ msg: "❌ Erreur lors de l'export", type: "error" });
    } finally {
      setExporting(null);
    }
  };

  const toggleSource = (key) => setSources(prev => ({ ...prev, [key]: !prev[key] }));
  const selectAllSources  = () => setSources({ proprietaires:true, locataires:true, clients:true, devis:true, contacts:true });
  const clearAllSources   = () => setSources({ proprietaires:false, locataires:false, clients:false, devis:false, contacts:false });

  if (authLoading) return null;
  if (user?.role !== "Admin") return null;

  return (
    <div className="min-h-screen bg-gray-50" style={{ fontFamily: FONT }}>
      {toast && <Toast msg={toast.msg} type={toast.type} onClose={() => setToast(null)} />}

      <div className="max-w-5xl mx-auto px-4 py-8 sm:px-6 lg:px-8 space-y-6">

        {/* ── Header ─────────────────────────────────────────── */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900">📊 Export Marketing</h1>
          <p className="text-sm text-gray-500 mt-1">
            Exportez vos contacts pour vos campagnes publicitaires
          </p>
        </div>

        {/* ── Alerte RGPD ────────────────────────────────────── */}
        <div className="flex items-start gap-3 px-5 py-4 rounded-2xl border"
             style={{ background: "#EFF6FF", borderColor: "#BFDBFE" }}>
          <span className="text-lg mt-0.5">ℹ️</span>
          <p className="text-sm text-blue-700 leading-relaxed">
            Ces données sont collectées avec le consentement des utilisateurs lors de leur inscription sur le site.
            Utilisez-les uniquement pour des communications liées à vos services.
          </p>
        </div>

        {/* ── Stats ──────────────────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="font-bold text-gray-900 text-sm">STATISTIQUES DE VOS CONTACTS</h2>
          </div>

          {loading ? (
            <div className="p-8 flex justify-center">
              <div className="w-7 h-7 border-4 border-blue-200 border-t-blue-500 rounded-full animate-spin" />
            </div>
          ) : (
            <div className="p-5 space-y-5">
              {/* Chiffres clés */}
              <div className="grid grid-cols-3 gap-4">
                {[
                  { label:"TOTAL contacts",   value: stats?.total ?? 0,         color: BLUE  },
                  { label:"Avec email",        value: stats?.avecEmail ?? 0,     color: GREEN },
                  { label:"Avec téléphone",    value: stats?.avecTelephone ?? 0, color: GOLD  },
                ].map(({ label, value, color }) => (
                  <div key={label} className="rounded-xl p-4 text-center"
                       style={{ background: color + "10" }}>
                    <p className="text-2xl font-extrabold" style={{ color }}>{value}</p>
                    <p className="text-xs text-gray-500 mt-1 uppercase tracking-wide">{label}</p>
                  </div>
                ))}
              </div>

              {/* Par source */}
              {stats && (
                <div className="space-y-3">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Par source</p>
                  {SOURCES.map(({ key, label, icon }) => {
                    const count = stats.parSource?.[key] ?? 0;
                    return (
                      <div key={key} className="flex items-center gap-3">
                        <span className="text-base w-5 text-center">{icon}</span>
                        <span className="text-sm text-gray-700 w-44 shrink-0">{label}</span>
                        <ProgressBar value={count} max={stats.total || 1} color={BLUE} />
                        <span className="text-sm font-semibold text-gray-700 w-8 text-right tabular-nums">{count}</span>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Avec les deux */}
              {stats && stats.avecLesDeux > 0 && (
                <p className="text-xs text-gray-400">
                  <strong className="text-gray-600">{stats.avecLesDeux}</strong> contact{stats.avecLesDeux > 1 ? "s" : ""} ont à la fois un email et un numéro de téléphone
                </p>
              )}
            </div>
          )}
        </div>

        {/* ── Filtres ────────────────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="font-bold text-gray-900 text-sm">FILTRER LES CONTACTS</h2>
            {!loading && stats && (
              <span className="text-sm font-semibold px-3 py-1 rounded-full"
                    style={{ background: BLUE + "12", color: BLUE }}>
                {stats.total ?? 0} contact{(stats.total ?? 0) > 1 ? "s" : ""} correspondent
              </span>
            )}
          </div>

          <div className="p-5 space-y-5">
            {/* Sources */}
            <div>
              <div className="flex items-center gap-3 mb-3">
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Source</span>
                <button onClick={selectAllSources}
                  className="text-xs text-blue-600 hover:underline">Tout sélectionner</button>
                <button onClick={clearAllSources}
                  className="text-xs text-gray-400 hover:underline">Tout désélectionner</button>
              </div>
              <div className="flex flex-wrap gap-3">
                {SOURCES.map(({ key, label, icon }) => (
                  <label key={key} className="flex items-center gap-2 cursor-pointer select-none">
                    <input type="checkbox" checked={sources[key]}
                      onChange={() => toggleSource(key)}
                      className="w-4 h-4 rounded accent-blue-600" />
                    <span className="text-sm text-gray-700">{icon} {label}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Dates */}
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Période</p>
              <div className="flex flex-wrap items-center gap-3">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Du</label>
                  <input type="date" value={dateDebut} onChange={e => setDateDebut(e.target.value)}
                    className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-100" />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Au</label>
                  <input type="date" value={dateFin} onChange={e => setDateFin(e.target.value)}
                    className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-100" />
                </div>
                {(dateDebut || dateFin) && (
                  <button onClick={() => { setDateDebut(""); setDateFin(""); }}
                    className="mt-4 text-xs text-gray-400 hover:text-red-500">✕ Effacer</button>
                )}
              </div>
            </div>

            {/* Ville */}
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Ville</label>
              <input type="text" placeholder="Ex: Brazzaville" value={ville}
                onChange={e => setVille(e.target.value)}
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm w-64 focus:outline-none focus:ring-2 focus:ring-blue-100" />
            </div>

            {/* Données requises */}
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Données requises</p>
              <div className="flex flex-wrap gap-4">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input type="checkbox" checked={requireEmail}
                    onChange={e => { setRequireEmail(e.target.checked); if (e.target.checked) setRequireBoth(false); }}
                    className="w-4 h-4 rounded accent-blue-600" />
                  <span className="text-sm text-gray-700">Email obligatoire</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input type="checkbox" checked={requirePhone}
                    onChange={e => { setRequirePhone(e.target.checked); if (e.target.checked) setRequireBoth(false); }}
                    className="w-4 h-4 rounded accent-blue-600" />
                  <span className="text-sm text-gray-700">Téléphone obligatoire</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input type="checkbox" checked={requireBoth}
                    onChange={e => { setRequireBoth(e.target.checked); if (e.target.checked) { setRequireEmail(false); setRequirePhone(false); } }}
                    className="w-4 h-4 rounded accent-blue-600" />
                  <span className="text-sm text-gray-700">Les deux obligatoires</span>
                </label>
              </div>
            </div>
          </div>
        </div>

        {/* ── Formats d'export ───────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="font-bold text-gray-900 text-sm">FORMAT D'EXPORT</h2>
          </div>
          <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
            {FORMATS.map(({ key, icon, label, sub, btn, color, cols }) => (
              <div key={key} className="rounded-xl border border-gray-100 p-5 flex flex-col gap-3 hover:border-gray-200 transition-colors">
                <div className="flex items-start gap-3">
                  <span className="text-2xl">{icon}</span>
                  <div>
                    <p className="font-semibold text-gray-900 text-sm">{label}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{sub}</p>
                    <p className="text-xs text-gray-400 mt-1 font-mono">{cols}</p>
                  </div>
                </div>
                <button
                  onClick={() => handleExport(key)}
                  disabled={exporting !== null || (stats?.total ?? 0) === 0}
                  className="w-full py-2.5 px-4 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90 disabled:opacity-40"
                  style={{ background: exporting === key ? "#94A3B8" : color }}>
                  {exporting === key ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Export en cours…
                    </span>
                  ) : btn}
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* ── Guide d'utilisation ────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="font-bold text-gray-900 text-sm">ℹ️ GUIDE D'UTILISATION</h2>
          </div>
          <div className="p-5 grid grid-cols-1 md:grid-cols-3 gap-6">

            <div>
              <p className="font-semibold text-sm text-gray-900 mb-3">📘 Facebook / Instagram</p>
              <ol className="space-y-2 text-sm text-gray-600">
                <li className="flex gap-2"><span className="text-blue-500 font-bold">1.</span>Allez sur <strong>business.facebook.com</strong></li>
                <li className="flex gap-2"><span className="text-blue-500 font-bold">2.</span>Audiences → Créer → <strong>Audience personnalisée</strong></li>
                <li className="flex gap-2"><span className="text-blue-500 font-bold">3.</span>Fichier client → Importez le <strong>CSV Facebook</strong></li>
                <li className="flex gap-2"><span className="text-blue-500 font-bold">4.</span>Facebook crée une audience similaire (Lookalike)</li>
              </ol>
            </div>

            <div>
              <p className="font-semibold text-sm text-gray-900 mb-3">🟡 Google Ads</p>
              <ol className="space-y-2 text-sm text-gray-600">
                <li className="flex gap-2"><span className="text-yellow-500 font-bold">1.</span>Allez sur <strong>ads.google.com</strong></li>
                <li className="flex gap-2"><span className="text-yellow-500 font-bold">2.</span>Outils → <strong>Gestionnaire d'audiences</strong></li>
                <li className="flex gap-2"><span className="text-yellow-500 font-bold">3.</span>+ Liste de clients → Importez le <strong>CSV Google</strong></li>
                <li className="flex gap-2"><span className="text-yellow-500 font-bold">4.</span>Ciblez vos clients sur Search, YouTube, Gmail</li>
              </ol>
            </div>

            <div>
              <p className="font-semibold text-sm text-gray-900 mb-3">📱 WhatsApp Business</p>
              <ol className="space-y-2 text-sm text-gray-600">
                <li className="flex gap-2"><span className="text-green-500 font-bold">1.</span>Téléchargez le CSV des numéros</li>
                <li className="flex gap-2"><span className="text-green-500 font-bold">2.</span>Importez dans vos contacts téléphone</li>
                <li className="flex gap-2"><span className="text-green-500 font-bold">3.</span>Utilisez <strong>WhatsApp Business</strong> pour diffuser</li>
                <li className="flex gap-2"><span className="text-green-500 font-bold">4.</span>Créez des listes de diffusion par segment</li>
              </ol>
            </div>

          </div>
        </div>

      </div>
    </div>
  );
};

export default ExportMarketingPage;
