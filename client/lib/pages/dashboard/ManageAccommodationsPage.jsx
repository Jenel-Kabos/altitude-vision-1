"use client";

// HOTFIX-ACCOMMODATIONS-UI-1 — alignement visuel avec ManagePropertiesPage.jsx :
// fond dégradé + keyframes locales, header avec pastille icône et titre en
// dégradé, barre d'outils "glass" (bg-white/70 backdrop-blur), formulaire de
// création/édition déplacé dans une modale (au lieu d'un bloc inline), boutons
// d'action colorés avec hover dégradé + scale, pagination numérotée avec
// flèches. Aucune logique métier modifiée (filtres, chargement, archivage).

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle, ArrowLeft, ArrowRight, CalendarDays, Edit3, Eye, Landmark,
  LayoutDashboard, Palmtree, PlusCircle, Search, SlidersHorizontal, Sparkles, Trash2, X,
} from "lucide-react";
import { toast } from "react-hot-toast";
import { deactivateAccommodation, getAccommodationsAdmin } from "../../services/accommodationService";
import { ACCOMMODATION_TYPES } from "../../constants/accommodation";
import AccommodationPropertyForm from "../../components/dashboard/AccommodationPropertyForm";
import DashboardKpis from "../../components/dashboard/DashboardKpis";
import { getDashboardAnalytics } from "../../services/dashboardAnalyticsService";
import PropertyManagementCard from "../../components/dashboard/PropertyManagementCard";
import { useAuth } from "../../context/AuthContext";
import { formatCurrencyXAF } from "../../utils/normalizePropertyDetail";

const PAGE_SIZE = 20;

const kpis = (analytics) => [
  { key: "total", label: "Hébergements", value: analytics?.kpis?.total },
  { key: "published", label: "Publiés", value: analytics?.kpis?.published },
  { key: "unavailable", label: "Indisponibles", value: analytics?.kpis?.unavailable },
  { key: "maintenance", label: "Maintenance", value: analytics?.kpis?.maintenance },
  { key: "today", label: "Réservations aujourd’hui", value: analytics?.kpis?.reservationsToday },
  { key: "checkins", label: "Arrivées du jour", value: analytics?.kpis?.checkInsToday },
  { key: "checkouts", label: "Départs du jour", value: analytics?.kpis?.checkOutsToday },
  { key: "occupancy", label: "Occupation mensuelle", value: `${analytics?.kpis?.occupancyRate || 0}%` },
];

const inputClass = "w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all bg-white text-sm";
// UX-ACCOMMODATION-SEARCH-BAR-1 — panneau "Filtres" replié par défaut : champs
// compacts (py-2.5 au lieu de py-3) qui se répartissent en flex-wrap plutôt
// que de s'empiler pleine largeur (voir _UX_DECISION.md).
const compactFieldClass = "flex-1 min-w-[9rem] px-3 py-2.5 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all bg-white text-sm";
const DEFAULT_FILTERS = { type: "tous", city: "", availability: "tous", sort: "recent", search: "" };

export default function ManageAccommodationsPage() {
  const router = useRouter();
  const { user, canEdit } = useAuth();
  const canCreate = ["Admin", "CommunityManager", "Collaborateur"].includes(user?.role);
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [data, setData] = useState({ accommodations: [], total: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [editing, setEditing] = useState(null);
  const [creating, setCreating] = useState(false);
  const [archiveTarget, setArchiveTarget] = useState(null);
  const [analytics, setAnalytics] = useState(null);

  const loadAnalytics = () => getDashboardAnalytics("accommodations").then(setAnalytics).catch(() => setAnalytics({ kpis: {} }));

  const load = async () => {
    setLoading(true);
    setError(false);
    try {
      setData(await getAccommodationsAdmin({
        status: "publie", type: filters.type, city: filters.city || undefined,
        availability: filters.availability === "tous" ? undefined : filters.availability,
        search: filters.search || undefined, sort: filters.sort, page, limit: PAGE_SIZE,
        independentOnly: true, validatedOnly: true, activeOnly: true,
      }));
    } catch {
      setError(true);
      toast.error("Erreur lors du chargement des hébergements.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [filters.type, filters.city, filters.availability, filters.sort, page]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { loadAnalytics(); }, []);
  useEffect(() => {
    const timeout = setTimeout(() => { setPage(1); load(); }, 300);
    return () => clearTimeout(timeout);
  }, [filters.search]); // eslint-disable-line react-hooks/exhaustive-deps

  const setFilter = (key, value) => { setFilters((current) => ({ ...current, [key]: value })); setPage(1); };
  // UX-ACCOMMODATION-SEARCH-BAR-1 — chips de filtres actifs : dérivés
  // directement de `filters`, jamais dupliqués dans un état séparé. Le tri
  // n'exclut aucun résultat (contrairement à type/ville/disponibilité) : il
  // n'apparaît jamais en chip individuel, mais compte dans `isFiltered` pour
  // l'affichage du bouton "Réinitialiser" (voir _UX_DECISION.md).
  const activeFilterEntries = useMemo(() => [
    filters.type !== "tous" && { key: "type", label: ACCOMMODATION_TYPES.find((item) => item.value === filters.type)?.label || filters.type },
    filters.city && { key: "city", label: filters.city },
    filters.availability !== "tous" && { key: "availability", label: filters.availability },
  ].filter(Boolean), [filters.type, filters.city, filters.availability]);
  const isFiltered = activeFilterEntries.length > 0 || filters.sort !== DEFAULT_FILTERS.sort;
  const removeFilterChip = (key) => setFilter(key, key === "city" ? "" : "tous");
  const resetFilters = () => {
    setFilters((current) => ({ ...current, type: DEFAULT_FILTERS.type, city: DEFAULT_FILTERS.city, availability: DEFAULT_FILTERS.availability, sort: DEFAULT_FILTERS.sort }));
    setPage(1);
  };

  const closeForm = () => { setCreating(false); setEditing(null); };

  const archive = async () => {
    if (!archiveTarget) return;
    try {
      await deactivateAccommodation(archiveTarget._id);
      toast.success("Hébergement archivé.");
      setArchiveTarget(null);
      await load();
      await loadAnalytics();
    } catch (err) {
      toast.error(err.response?.data?.message || "Archivage impossible.");
    }
  };

  const totalPages = Math.max(1, Math.ceil((data.total || 0) / PAGE_SIZE));

  // ── ConfirmDialog (archivage) — même structure que ManagePropertiesPage ──
  const ConfirmDialog = () => {
    if (!archiveTarget) return null;
    return (
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fadeIn" role="dialog" aria-modal="true" aria-labelledby="archive-title">
        <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm p-6 flex flex-col items-center animate-slideUp">
          <AlertTriangle className="w-12 h-12 text-red-500 mb-4" />
          <h2 id="archive-title" className="text-xl font-bold text-gray-800 mb-2">Archiver cet hébergement ?</h2>
          <p className="text-gray-600 text-center mb-6">
            « {archiveTarget.property?.title} » sera masqué. Ses réservations et données financières seront conservées.
          </p>
          <div className="flex gap-4 w-full">
            <button autoFocus onClick={() => setArchiveTarget(null)}
              className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 font-semibold rounded-lg hover:bg-gray-200 transition">
              Annuler
            </button>
            <button onClick={archive}
              className="flex-1 px-4 py-2 bg-red-600 text-white font-semibold rounded-lg hover:bg-red-700 transition shadow-md">
              Archiver
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-cyan-50 to-indigo-50 p-4 sm:p-10 font-sans">
      <style>{`
        @keyframes fadeIn  { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideUp { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        .animate-fadeIn  { animation: fadeIn  0.3s ease-out; }
        .animate-slideUp { animation: slideUp 0.4s ease-out; }
      `}</style>

      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6 sm:mb-8 animate-slideUp flex items-center gap-3 sm:gap-4">
          <div className="p-2.5 sm:p-3 bg-gradient-to-br from-blue-600 to-cyan-600 rounded-2xl shadow-lg flex-shrink-0">
            <Palmtree className="w-6 h-6 sm:w-8 sm:h-8 text-white" />
          </div>
          <div className="min-w-0">
            <p className="text-xs sm:text-sm font-semibold text-blue-600 uppercase tracking-wide">Altimmo · Hébergements indépendants</p>
            <h1 className="text-2xl sm:text-4xl lg:text-5xl leading-tight font-black bg-gradient-to-r from-blue-600 via-cyan-600 to-indigo-600 bg-clip-text text-transparent">
              Hébergements
            </h1>
            <p className="text-sm sm:text-lg text-gray-600 font-medium mt-1">
              Gérez vos hébergements indépendants validés, leurs disponibilités et leurs activités.
            </p>
          </div>
        </div>

        <div className="mb-6 animate-slideUp">
          <DashboardKpis items={kpis(analytics)} loading={!analytics} note={analytics?.occupancyFormula} />
        </div>

        {/* Barre d'outils — UX-ACCOMMODATION-SEARCH-BAR-1 : toolbar compacte
            harmonisée avec Sales/Rentals (recherche + Filtres + Ajouter sur
            une ligne dès `sm`, filtres avancés repliés par défaut). */}
        <div className="bg-white/70 backdrop-blur-sm rounded-2xl shadow-xl p-4 sm:p-6 border border-gray-100 mb-6">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <div className="relative flex-1 w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text" value={filters.search} onChange={(event) => setFilter("search", event.target.value)}
                placeholder="Rechercher un hébergement…" aria-label="Rechercher un hébergement"
                className={`${inputClass} pl-10`}
              />
            </div>

            <div className="flex gap-3 w-full sm:w-auto">
              <button
                type="button" onClick={() => setFiltersOpen((open) => !open)}
                aria-expanded={filtersOpen} aria-controls="accommodations-filters-panel"
                className="flex flex-1 sm:flex-none min-h-11 items-center justify-center gap-2 px-4 py-3 border-2 border-gray-200 rounded-xl bg-white text-sm font-semibold text-gray-700 hover:border-blue-500 hover:text-blue-600 transition-all"
              >
                <SlidersHorizontal className="w-5 h-5" />
                {activeFilterEntries.length > 0 ? `Filtres (${activeFilterEntries.length})` : "Filtres"}
              </button>

              {canCreate && (
                <button
                  type="button" onClick={() => setCreating(true)}
                  className="flex flex-1 sm:flex-none min-h-11 items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-emerald-500 to-green-600 text-white font-bold rounded-full shadow-lg hover:from-emerald-600 hover:to-green-700 transition-all hover:scale-105"
                >
                  <PlusCircle className="w-5 h-5" /> <span className="hidden sm:inline">Ajouter un hébergement</span><span className="sm:hidden">Ajouter</span>
                </button>
              )}
            </div>
          </div>

          {isFiltered && (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {activeFilterEntries.map((chip) => (
                <span key={chip.key} className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-xs font-semibold text-gray-700">
                  {chip.label}
                  <button
                    type="button" onClick={() => removeFilterChip(chip.key)}
                    aria-label={`Retirer le filtre ${chip.label}`}
                    className="text-gray-400 hover:text-gray-700"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </span>
              ))}
              <button type="button" onClick={resetFilters} className="text-xs font-semibold text-blue-600 hover:text-blue-800 underline underline-offset-2">
                Réinitialiser
              </button>
            </div>
          )}

          {filtersOpen && (
            <div id="accommodations-filters-panel" className="mt-4 pt-4 border-t border-gray-100 flex flex-wrap gap-3">
              <select value={filters.type} onChange={(event) => setFilter("type", event.target.value)} aria-label="Type d’hébergement" className={compactFieldClass}>
                <option value="tous">Tous les types</option>
                {ACCOMMODATION_TYPES.filter((item) => item.value !== "hotel").map((item) => (
                  <option key={item.value} value={item.value}>{item.label}</option>
                ))}
              </select>
              <input value={filters.city} onChange={(event) => setFilter("city", event.target.value)} placeholder="Ville" aria-label="Ville" className={compactFieldClass} />
              <select value={filters.availability} onChange={(event) => setFilter("availability", event.target.value)} aria-label="Disponibilité" className={compactFieldClass}>
                <option value="tous">Toutes disponibilités</option>
                <option value="Disponible">Disponible</option>
                <option value="Indisponible">Indisponible</option>
                <option value="Maintenance">Maintenance</option>
              </select>
              <select value={filters.sort} onChange={(event) => setFilter("sort", event.target.value)} aria-label="Trier par" className={compactFieldClass}>
                <option value="recent">Plus récent</option>
                <option value="ancien">Plus ancien</option>
                <option value="prix_asc">Prix croissant</option>
                <option value="prix_desc">Prix décroissant</option>
              </select>
            </div>
          )}
        </div>

        {/* Contenu */}
        {loading ? (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4" role="status" aria-label="Chargement des hébergements">
            {Array.from({ length: 8 }, (_, index) => (
              <div key={index} className="overflow-hidden rounded-2xl bg-white shadow-md">
                <div className="h-48 animate-pulse bg-slate-200" />
                <div className="space-y-3 p-4">
                  <div className="h-5 w-3/4 animate-pulse rounded bg-slate-200" />
                  <div className="h-4 animate-pulse rounded bg-slate-100" />
                  <div className="h-10 animate-pulse rounded bg-slate-100" />
                </div>
              </div>
            ))}
          </div>
        ) : error ? (
          <div role="alert" className="text-center py-20 bg-white rounded-2xl shadow-xl border-2 border-dashed border-red-200 animate-slideUp">
            <div className="flex justify-center mb-4">
              <div className="p-4 bg-red-100 rounded-full text-red-600"><AlertTriangle className="w-12 h-12" /></div>
            </div>
            <p className="text-lg font-bold text-gray-700 mb-1">Chargement impossible</p>
            <p className="text-sm text-gray-500 mb-4">Réessayez dans quelques instants.</p>
            <button onClick={load} className="px-6 py-2.5 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition">
              Réessayer
            </button>
          </div>
        ) : data.accommodations.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-2xl shadow-xl border-2 border-dashed border-blue-200 animate-slideUp">
            <div className="flex justify-center mb-4">
              <div className="p-4 bg-blue-100 rounded-full text-blue-600"><Palmtree className="w-12 h-12" /></div>
            </div>
            <p className="text-lg font-bold text-gray-700 mb-1">Aucun hébergement validé</p>
            <p className="text-sm text-gray-500 mb-4">Les hébergements apparaîtront ici après leur validation dans l’onglet Modération Hébergements.</p>
            {canCreate && (
              <button onClick={() => setCreating(true)} className="px-6 py-2.5 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition">
                Ajouter un hébergement
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6" data-testid="accommodation-grid">
              {data.accommodations.map((accommodation) => {
                const detail = `/dashboard/hebergements/${accommodation._id}`;
                return (
                  <PropertyManagementCard
                    key={accommodation._id}
                    property={accommodation.property}
                    description={ACCOMMODATION_TYPES.find((item) => item.value === accommodation.accommodationType)?.label || accommodation.accommodationType}
                    capacity={(accommodation.capacity?.maxAdults || 0) + (accommodation.capacity?.maxChildren || 0)}
                    priceLabel={`${formatCurrencyXAF(accommodation.property?.price || accommodation.rates?.[0]?.amount || 0).replace("FCFA", "XAF")} / nuit`}
                    badges={[
                      { label: "Publié", className: "bg-gradient-to-r from-green-600 to-emerald-600" },
                      ...(accommodation.property?.availability && accommodation.property.availability !== "Disponible"
                        ? [{ label: accommodation.property.availability, className: accommodation.property.availability === "Maintenance" ? "bg-amber-600" : "bg-slate-700" }]
                        : []),
                    ]}
                    actions={
                      <>
                        <Link href={detail} title="Voir"
                          className="flex-1 p-2.5 text-blue-700 bg-blue-50 hover:text-white hover:bg-gradient-to-r hover:from-blue-600 hover:to-cyan-600 rounded-xl transition-all hover:scale-110 hover:shadow-lg flex items-center justify-center">
                          <Eye className="w-5 h-5" />
                        </Link>
                        {canEdit && (
                          <button type="button" onClick={() => setEditing(accommodation)} title="Modifier"
                            className="flex-1 p-2.5 text-blue-600 hover:text-white bg-blue-50 hover:bg-gradient-to-r hover:from-blue-600 hover:to-cyan-600 rounded-xl transition-all hover:scale-110 hover:shadow-lg flex items-center justify-center">
                            <Edit3 className="w-5 h-5" />
                          </button>
                        )}
                        <Link href={`${detail}?view=reservations`} title="Réservations"
                          className="flex-1 p-2.5 text-indigo-700 bg-indigo-50 hover:text-white hover:bg-gradient-to-r hover:from-indigo-600 hover:to-blue-600 rounded-xl transition-all hover:scale-110 hover:shadow-lg flex items-center justify-center">
                          <LayoutDashboard className="w-5 h-5" />
                        </Link>
                        <Link href={`${detail}?view=calendar`} title="Calendrier"
                          className="flex-1 p-2.5 text-purple-700 bg-purple-50 hover:text-white hover:bg-gradient-to-r hover:from-purple-600 hover:to-fuchsia-600 rounded-xl transition-all hover:scale-110 hover:shadow-lg flex items-center justify-center">
                          <CalendarDays className="w-5 h-5" />
                        </Link>
                        <Link href={`${detail}?view=finance`} title="Finances"
                          className="flex-1 p-2.5 text-emerald-700 bg-emerald-50 hover:text-white hover:bg-gradient-to-r hover:from-emerald-600 hover:to-green-600 rounded-xl transition-all hover:scale-110 hover:shadow-lg flex items-center justify-center">
                          <Landmark className="w-5 h-5" />
                        </Link>
                        {canEdit && (
                          <button type="button" onClick={() => setArchiveTarget(accommodation)} title="Archiver"
                            className="flex-1 p-2.5 text-red-600 hover:text-white bg-red-50 hover:bg-gradient-to-r hover:from-red-600 hover:to-pink-600 rounded-xl transition-all hover:scale-110 hover:shadow-lg flex items-center justify-center">
                            <Trash2 className="w-5 h-5" />
                          </button>
                        )}
                      </>
                    }
                  />
                );
              })}
            </div>

            {totalPages > 1 && (
              <div className="flex justify-center items-center gap-2 mt-8 flex-wrap">
                <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
                  className="p-2 rounded-lg bg-white shadow disabled:opacity-50 hover:bg-blue-50 transition">
                  <ArrowLeft className="w-5 h-5" />
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                  <button key={p} onClick={() => setPage(p)}
                    className={`px-4 py-2 rounded-lg font-semibold transition-all ${
                      p === page ? "bg-gradient-to-r from-blue-600 to-cyan-600 text-white shadow-lg scale-105" : "bg-white text-gray-700 hover:bg-blue-50"
                    }`}>
                    {p}
                  </button>
                ))}
                <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                  className="p-2 rounded-lg bg-white shadow disabled:opacity-50 hover:bg-blue-50 transition">
                  <ArrowRight className="w-5 h-5" />
                </button>
              </div>
            )}
          </>
        )}

        {/* Modal Créer / Modifier */}
        {(creating || editing) && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 z-50 overflow-y-auto animate-fadeIn">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl my-2 sm:my-10 max-h-[calc(100dvh-1rem)] sm:max-h-[85vh] flex flex-col animate-slideUp">
              <div className="p-4 sm:p-6 border-b border-gray-200 sticky top-0 bg-white/95 z-20 rounded-t-2xl">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-gradient-to-br from-blue-500 to-cyan-600 rounded-xl text-white">
                    {editing ? <Edit3 className="w-6 h-6" /> : <Sparkles className="w-6 h-6" />}
                  </div>
                  <h2 className="pr-10 text-xl sm:text-3xl font-bold bg-gradient-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent">
                    {editing ? "Modifier l’hébergement" : "Ajouter un hébergement"}
                  </h2>
                  <button onClick={closeForm}
                    className="absolute top-4 right-4 p-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100 transition">
                    <X className="w-6 h-6" />
                  </button>
                </div>
              </div>
              <div className="p-3 sm:p-6 overflow-y-auto flex-grow">
                <AccommodationPropertyForm
                  accommodation={editing}
                  onSuccess={(result) => {
                    closeForm();
                    load();
                    loadAnalytics();
                    if (!editing && result?.lifecycle?.visibility === 'pending_moderation') {
                      router.push('/dashboard/moderation/hebergement');
                    }
                  }}
                  onCancel={closeForm}
                />
              </div>
            </div>
          </div>
        )}

        <ConfirmDialog />
      </div>
    </div>
  );
}
