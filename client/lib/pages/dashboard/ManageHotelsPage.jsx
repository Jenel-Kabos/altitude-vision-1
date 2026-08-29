"use client";

// HOTFIX-HOTELS-UI-1 — alignement visuel avec ManagePropertiesPage.jsx /
// ManageAccommodationsPage.jsx : fond dégradé + keyframes locales, header
// avec pastille icône et titre en dégradé, barre d'outils "glass", formulaire
// de création/édition déplacé dans une modale (au lieu d'un bloc inline),
// confirmation d'archivage remplacée par un vrai dialog stylé (au lieu de
// window.confirm), pagination numérotée avec flèches. Aucune logique métier
// modifiée (filtres, chargement, archivage, blockers).

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  Archive, AlertTriangle, ArrowLeft, ArrowRight, BedDouble, Building2,
  CalendarDays, CreditCard, Edit3, ListChecks, Loader2, PlusCircle,
  Search, Sparkles, X,
} from "lucide-react";
import { toast } from "react-hot-toast";
import HotelPropertyForm from "../../components/dashboard/HotelPropertyForm";
import DashboardKpis from "../../components/dashboard/DashboardKpis";
import PropertyManagementCard from "../../components/dashboard/PropertyManagementCard";
import { DashboardActionMenu, DashboardSection } from "../../components/dashboard/DashboardUI";
import { deactivateHotel, getHotelPortfolio } from "../../services/hotelService";
import { getDashboardAnalytics } from "../../services/dashboardAnalyticsService";
import { useAuth } from "../../context/AuthContext";

const PAGE_SIZE = 12;
const money = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "XAF", maximumFractionDigits: 0 });
const inputClass = "w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all bg-white text-sm";

export default function ManageHotelsPage() {
  const { user } = useAuth();
  const [filters, setFilters] = useState({ search: "", city: "", starRating: "", sort: "recent" });
  const [page, setPage] = useState(1);
  const [data, setData] = useState({ hotels: [], total: 0 });
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [archiveTarget, setArchiveTarget] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const params = Object.fromEntries(Object.entries({ ...filters, page, limit: PAGE_SIZE }).filter(([, value]) => value !== ""));
      setData(await getHotelPortfolio(params));
    } catch (error) {
      toast.error(error.response?.data?.message || "Impossible de charger les établissements.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [page, filters.city, filters.starRating, filters.sort]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const timer = setTimeout(() => { setPage(1); load(); }, 300);
    return () => clearTimeout(timer);
  }, [filters.search]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { getDashboardAnalytics("hotels").then(setAnalytics).catch(() => setAnalytics({ kpis: {} })); }, []);

  const updateFilter = (key, value) => { setFilters((current) => ({ ...current, [key]: value })); setPage(1); };
  const closeForm = () => { setCreating(false); setEditing(null); };

  const archive = async () => {
    if (!archiveTarget) return;
    try {
      await deactivateHotel(archiveTarget._id);
      toast.success("Établissement archivé.");
      setArchiveTarget(null);
      load();
    } catch (error) {
      const blockers = error.response?.data?.blockers;
      const details = blockers ? Object.entries(blockers).filter(([, count]) => count).map(([key, count]) => `${key}: ${count}`).join(" · ") : "";
      toast.error(`${error.response?.data?.message || "Archivage impossible."}${details ? ` ${details}` : ""}`);
      setArchiveTarget(null);
    }
  };

  const kpis = analytics?.kpis || {};
  const totalPages = Math.max(1, Math.ceil((data.total || 0) / PAGE_SIZE));
  const isFirstLoad = loading && data.hotels.length === 0;

  // ── ConfirmDialog (archivage) — même structure que ManagePropertiesPage /
  // ManageAccommodationsPage (remplace l'ancien window.confirm). ─────────
  const ConfirmDialog = () => {
    if (!archiveTarget) return null;
    return (
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fadeIn" role="dialog" aria-modal="true" aria-labelledby="archive-title">
        <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm p-6 flex flex-col items-center animate-slideUp">
          <AlertTriangle className="w-12 h-12 text-red-500 mb-4" />
          <h2 id="archive-title" className="text-xl font-bold text-gray-800 mb-2">Archiver cet établissement ?</h2>
          <p className="text-gray-600 text-center mb-6">
            « {archiveTarget.name} » sera masqué. Ses réservations et données financières seront conservées.
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

  if (isFirstLoad) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-cyan-50 to-indigo-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-16 h-16 text-blue-600 animate-spin mx-auto mb-4" />
          <p className="text-xl font-bold text-gray-700">Chargement des établissements…</p>
        </div>
      </div>
    );
  }

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
        <div className="mb-6 sm:mb-8 animate-slideUp flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-4 justify-between">
          <div className="flex items-center gap-3 sm:gap-4">
            <div className="p-2.5 sm:p-3 bg-gradient-to-br from-blue-600 to-cyan-600 rounded-2xl shadow-lg flex-shrink-0">
              <Building2 className="w-6 h-6 sm:w-8 sm:h-8 text-white" />
            </div>
            <div className="min-w-0">
              <h1 className="text-2xl sm:text-4xl lg:text-5xl leading-tight font-black bg-gradient-to-r from-blue-600 via-cyan-600 to-indigo-600 bg-clip-text text-transparent">
                Établissements
              </h1>
              <p className="text-sm sm:text-lg text-gray-600 font-medium mt-1">
                Portefeuille des hôtels validés et autorisés à être exploités.
              </p>
            </div>
          </div>
          {!creating && !editing && (
            <button
              onClick={() => setCreating(true)}
              className="flex min-h-11 w-full sm:w-auto items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-emerald-500 to-green-600 text-white font-bold rounded-full shadow-lg hover:from-emerald-600 hover:to-green-700 transition-all hover:scale-105"
            >
              <PlusCircle className="w-5 h-5" /> Ajouter un établissement
            </button>
          )}
        </div>

        {/* KPIs */}
        <div className="animate-slideUp mb-6 space-y-6">
          <DashboardSection title="Pilotage opérationnel" description="Disponibilité, occupation et tâches du jour.">
            <DashboardKpis loading={!analytics} items={[
              { key: "active", label: "Établissements actifs", value: kpis.activeHotels },
              { key: "closed", label: "Temporairement fermés", value: kpis.temporarilyClosedHotels },
              { key: "available", label: "Chambres disponibles", value: kpis.availableRooms },
              { key: "occupied", label: "Chambres occupées", value: kpis.occupiedRooms },
              { key: "occupancy", label: "Taux d’occupation", value: `${kpis.occupancyRate || 0} %` },
              { key: "checkin", label: "Arrivées du jour", value: kpis.checkInsToday },
              { key: "checkout", label: "Départs du jour", value: kpis.checkOutsToday },
              { key: "housekeeping", label: "Chambres à nettoyer", value: kpis.housekeeping },
              { key: "maintenance", label: "Maintenances ouvertes", value: kpis.maintenance },
            ]} />
          </DashboardSection>
          <DashboardSection title="Situation financière" description="Montants officiels fournis par le service analytique.">
            <DashboardKpis loading={!analytics} note={analytics?.revenueBasis} items={[
              { key: "gross", label: "Montant brut encaissé", value: kpis.grossAmountCollected, format: "money" },
              { key: "refunded", label: "Montant remboursé", value: kpis.refundedAmount, format: "money" },
              { key: "net", label: "Montant net encaissé", value: kpis.netAmountCollected, format: "money" },
              { key: "balance", label: "Solde à encaisser", value: kpis.remainingAmount, format: "money" },
            ]} />
          </DashboardSection>
        </div>

        {/* Barre d'outils */}
        <div className="bg-white/70 backdrop-blur-sm rounded-2xl shadow-xl p-4 sm:p-6 border border-gray-100 mb-6">
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
            <div className="relative flex-1 w-full lg:max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                aria-label="Rechercher un établissement" value={filters.search}
                onChange={(event) => updateFilter("search", event.target.value)}
                placeholder="Nom de l’établissement" className={`${inputClass} pl-10`}
              />
            </div>
            <div className="flex flex-wrap gap-3 w-full lg:w-auto">
              <input aria-label="Filtrer par ville" value={filters.city} onChange={(event) => updateFilter("city", event.target.value)} placeholder="Ville" className={inputClass} />
              <select aria-label="Filtrer par catégorie" value={filters.starRating} onChange={(event) => updateFilter("starRating", event.target.value)} className={inputClass}>
                <option value="">Toutes les catégories</option>
                {[1, 2, 3, 4, 5].map((rating) => <option key={rating} value={rating}>{rating} étoile{rating > 1 ? "s" : ""}</option>)}
              </select>
              <select aria-label="Trier les établissements" value={filters.sort} onChange={(event) => updateFilter("sort", event.target.value)} className={inputClass}>
                <option value="recent">Plus récents</option>
                <option value="ancien">Plus anciens</option>
                <option value="nom">Nom</option>
              </select>
            </div>
          </div>
        </div>

        {/* Contenu */}
        {loading ? (
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3" role="status" aria-label="Chargement des établissements">
            {Array.from({ length: 6 }, (_, index) => (
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
        ) : data.hotels.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-2xl shadow-xl border-2 border-dashed border-blue-200 animate-slideUp">
            <div className="flex justify-center mb-4">
              <div className="p-4 bg-blue-100 rounded-full text-blue-600"><Building2 className="w-12 h-12" /></div>
            </div>
            <p className="text-lg font-bold text-gray-700 mb-1">Aucun établissement validé</p>
            <p className="text-sm text-gray-500">Les nouvelles demandes apparaissent ici uniquement après validation dans Modération Hôtellerie.</p>
          </div>
        ) : (
          <>
            <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              {data.hotels.map((hotel) => {
                const stats = hotel.operationalStats || {};
                return (
                  <PropertyManagementCard
                    key={hotel._id}
                    property={{ ...hotel.property, title: hotel.name || hotel.property?.title }}
                    description={hotel.description}
                    badges={[
                      { label: `${hotel.starRating || 0} étoile${hotel.starRating > 1 ? "s" : ""}` },
                      { label: "Validé", className: "bg-gradient-to-r from-green-600 to-emerald-600" },
                    ]}
                    priceLabel={hotel.minNightlyRate ? `Dès ${money.format(hotel.minNightlyRate)}` : undefined}
                    capacity={hotel.totalCapacity}
                    footer={
                      <div className="mb-4 grid grid-cols-3 gap-2 text-center text-xs text-gray-600">
                        <span><strong className="block text-base text-gray-900">{stats.totalRooms || hotel.totalRooms || 0}</strong>chambres</span>
                        <span><strong className="block text-base text-emerald-700">{stats.availableRooms || 0}</strong>disponibles</span>
                        <span><strong className="block text-base text-blue-700">{stats.occupancyRate || 0}%</strong>occupation</span>
                      </div>
                    }
                    actions={
                      <>
                        <Link href={`/dashboard/etablissements/${hotel._id}`}
                          className="flex-1 p-2.5 text-blue-700 bg-blue-50 hover:text-white hover:bg-gradient-to-r hover:from-blue-600 hover:to-cyan-600 rounded-xl transition-all hover:scale-110 hover:shadow-lg flex items-center justify-center font-semibold text-sm gap-2">
                          Ouvrir
                        </Link>
                        <DashboardActionMenu
                          label={`Actions pour ${hotel.name}`}
                          items={[
                            { label: "Modifier", icon: Edit3, onSelect: () => setEditing(hotel) },
                            { label: "Chambres", icon: BedDouble, href: `/dashboard/hotels/${hotel._id}/rooms` },
                            { label: "Réservations", icon: ListChecks, href: `/dashboard/hotel-reservations?hotelId=${hotel._id}` },
                            { label: "Calendrier", icon: CalendarDays, href: `/dashboard/hotels/${hotel._id}/inventory` },
                            { label: "Finances", icon: CreditCard, href: `/dashboard/hotel-finance?hotelId=${hotel._id}` },
                            { label: "Archiver", icon: Archive, danger: true, onSelect: () => setArchiveTarget(hotel) },
                          ]}
                        />
                      </>
                    }
                  />
                );
              })}
            </div>

            {totalPages > 1 && (
              <div className="flex justify-center items-center gap-2 mt-8 flex-wrap">
                <button onClick={() => setPage((value) => Math.max(1, value - 1))} disabled={page === 1}
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
                <button onClick={() => setPage((value) => Math.min(totalPages, value + 1))} disabled={page === totalPages}
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
                    {editing ? "Modifier l’établissement" : "Ajouter un établissement"}
                  </h2>
                  <button onClick={closeForm}
                    className="absolute top-4 right-4 p-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100 transition">
                    <X className="w-6 h-6" />
                  </button>
                </div>
              </div>
              <div className="p-3 sm:p-6 overflow-y-auto flex-grow">
                <HotelPropertyForm
                  scope={user?.role === "Proprietaire" ? "owner" : "admin"}
                  hotelId={editing?._id}
                  accommodationType={editing?.accommodationType || "hotel"}
                  initialProperty={editing?.property}
                  initialHotel={editing}
                  existingImages={editing?.property?.images || editing?.gallery || []}
                  onSuccess={(result) => {
                    closeForm();
                    toast.success(
                      result?.proposedVersionPending
                        ? "Les informations ordinaires sont enregistrées. Les modifications sensibles restent en attente dans Modération Hôtellerie ; la version publiée demeure active."
                        : (editing ? "Établissement mis à jour." : "Établissement créé et soumis avec succès. Il est en attente de validation administrative et apparaîtra dans le portefeuille des établissements actifs uniquement après validation.")
                    );
                    load();
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
