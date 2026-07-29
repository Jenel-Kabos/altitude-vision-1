"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, CalendarDays, Edit3, Eye, LayoutDashboard, Palmtree, PlusCircle, Search, Trash2, X } from "lucide-react";
import { toast } from "react-hot-toast";
import { deactivateAccommodation, getAccommodationsAdmin } from "../../services/accommodationService";
import { ACCOMMODATION_TYPES } from "../../constants/accommodation";
import AccommodationPropertyForm from "../../components/dashboard/AccommodationPropertyForm";
import DashboardKpis from "../../components/dashboard/DashboardKpis";
import { getDashboardAnalytics } from "../../services/dashboardAnalyticsService";
import AccommodationReservationsPanel from "../../components/dashboard/AccommodationReservationsPanel";
import { DashboardCard, DashboardPage, DashboardPageHeader, DashboardPagination, DashboardState, DashboardToolbar } from "../../components/dashboard/DashboardUI";
import PropertyManagementCard from "../../components/dashboard/PropertyManagementCard";
import { useAuth } from "../../context/AuthContext";
import { formatCurrencyXAF } from "../../utils/normalizePropertyDetail";

const PAGE_SIZE = 20;
const VIEWS = [
  ["properties", "Mes biens"],
  ["reservations", "Réservations"],
  ["new", "Nouvelle réservation"],
  ["calendar", "Calendrier et blocages"],
  ["finance", "Finances"],
  ["overview", "Vue d’ensemble"],
];

export default function ManageAccommodationsPage() {
  const { user, canEdit } = useAuth();
  const canCreate = ["Admin", "CommunityManager", "Collaborateur"].includes(user?.role);
  const [view, setView] = useState("properties");
  const [type, setType] = useState("tous");
  const [city, setCity] = useState("");
  const [availability, setAvailability] = useState("tous");
  const [sort, setSort] = useState("recent");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState({ accommodations: [], total: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [editing, setEditing] = useState(null);
  const [creating, setCreating] = useState(false);
  const [selectedAccommodationId, setSelectedAccommodationId] = useState("");
  const [archiveTarget, setArchiveTarget] = useState(null);
  const [analytics, setAnalytics] = useState(null);

  const loadAnalytics = () => getDashboardAnalytics("accommodations").then(setAnalytics).catch(() => setAnalytics({ kpis: {} }));
  const load = async () => {
    setLoading(true); setError(false);
    try {
      setData(await getAccommodationsAdmin({
        status: "publie", type, city: city || undefined, availability: availability === "tous" ? undefined : availability, search: search || undefined, sort, page, limit: PAGE_SIZE,
        independentOnly: true, validatedOnly: true, activeOnly: true,
      }));
    } catch {
      setError(true); toast.error("Erreur lors du chargement des hébergements.");
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [type, city, availability, sort, page]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { loadAnalytics(); }, []);
  useEffect(() => {
    const timeout = setTimeout(() => { setPage(1); load(); }, 300);
    return () => clearTimeout(timeout);
  }, [search]); // eslint-disable-line react-hooks/exhaustive-deps

  const archive = async () => {
    if (!archiveTarget) return;
    try { await deactivateAccommodation(archiveTarget._id); toast.success("Hébergement archivé."); setArchiveTarget(null); await load(); await loadAnalytics(); }
    catch (err) { toast.error(err.response?.data?.message || "Archivage impossible."); }
  };
  const totalPages = Math.max(1, Math.ceil((data.total || 0) / PAGE_SIZE));
  const operationalTab = view === "new" ? "new" : view === "calendar" ? "calendar" : view === "finance" ? "finance" : "reservations";

  return <DashboardPage>
    <DashboardPageHeader icon={Palmtree} eyebrow="Altimmo · Hébergements indépendants" title="Hébergements" description="Gérez vos hébergements indépendants validés, leurs disponibilités et leurs activités." actions={view === "properties" && canCreate && <button type="button" onClick={() => setCreating(true)} className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-emerald-500 to-green-600 px-6 py-3 font-bold text-white shadow-lg transition hover:scale-105 hover:from-emerald-600 hover:to-green-700"><PlusCircle className="h-5 w-5" /> Ajouter un hébergement</button>} />

    <nav className="dashboard-toolbar" aria-label="Sections Hébergements">
      {VIEWS.map(([key, label]) => <button type="button" key={key} onClick={() => setView(key)} aria-current={view === key ? "page" : undefined} className={view === key ? "bg-blue-700 text-white" : ""}>{label}</button>)}
    </nav>

    {(creating || editing) && <DashboardCard className="mb-6">
      <AccommodationPropertyForm accommodation={editing} onSuccess={() => { setCreating(false); setEditing(null); load(); }} onCancel={() => { setCreating(false); setEditing(null); }} />
    </DashboardCard>}

    {view === "properties" && <>
      <DashboardToolbar>
        <label className="relative flex-1 min-w-[220px]"><Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400"/><span className="sr-only">Rechercher</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Rechercher un hébergement…" className="w-full pl-10" /></label>
        <select value={type} onChange={(event) => { setType(event.target.value); setPage(1); }} aria-label="Type d’hébergement"><option value="tous">Tous les types</option>{ACCOMMODATION_TYPES.filter((item) => item.value !== "hotel").map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select>
        <input value={city} onChange={(event) => { setCity(event.target.value); setPage(1); }} placeholder="Ville" aria-label="Ville" />
        <select value={availability} onChange={(event) => { setAvailability(event.target.value); setPage(1); }} aria-label="Disponibilité"><option value="tous">Toutes disponibilités</option><option value="Disponible">Disponible</option><option value="Indisponible">Indisponible</option><option value="Maintenance">Maintenance</option></select>
        <select value={sort} onChange={(event) => { setSort(event.target.value); setPage(1); }} aria-label="Trier par"><option value="recent">Plus récent</option><option value="ancien">Plus ancien</option><option value="prix_asc">Prix croissant</option><option value="prix_desc">Prix décroissant</option></select>
      </DashboardToolbar>
      {loading ? <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4" role="status" aria-label="Chargement des hébergements">{Array.from({ length: 8 }, (_, index) => <div key={index} className="overflow-hidden rounded-xl bg-white shadow-md"><div className="h-48 animate-pulse bg-slate-200"/><div className="space-y-3 p-4"><div className="h-5 w-3/4 animate-pulse rounded bg-slate-200"/><div className="h-4 animate-pulse rounded bg-slate-100"/><div className="h-10 animate-pulse rounded bg-slate-100"/></div></div>)}</div> : error ? <DashboardState type="error" title="Chargement impossible" description="Réessayez dans quelques instants." action={<button onClick={load}>Réessayer</button>} /> : data.accommodations.length === 0 ? <DashboardState title="Aucun hébergement validé" description="Les hébergements apparaîtront ici après leur validation dans l’onglet Modération Hébergements." action={canCreate && <button onClick={() => setCreating(true)}>Ajouter un hébergement</button>} /> : <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4" data-testid="accommodation-grid">
        {data.accommodations.map((accommodation) => <PropertyManagementCard key={accommodation._id} property={accommodation.property} description={ACCOMMODATION_TYPES.find((item) => item.value === accommodation.accommodationType)?.label || accommodation.accommodationType} capacity={(accommodation.capacity?.maxAdults || 0) + (accommodation.capacity?.maxChildren || 0)} priceLabel={`${formatCurrencyXAF(accommodation.property?.price || accommodation.rates?.[0]?.amount || 0).replace("FCFA", "XAF")} / nuit`} badges={[{ label: "Publié", className: "bg-gradient-to-r from-green-600 to-emerald-600" }, ...(accommodation.property?.availability && accommodation.property.availability !== "Disponible" ? [{ label: accommodation.property.availability, className: accommodation.property.availability === "Maintenance" ? "bg-amber-600" : "bg-slate-700" }] : [])]} actions={<>
            <Link href={`/immobilier/property/${accommodation.property?._id || accommodation.property}`} className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-50 p-2 text-sm font-semibold text-blue-700 hover:bg-blue-100"><Eye className="h-4 w-4" /> Voir</Link>
            {canEdit && <button type="button" onClick={() => setEditing(accommodation)} className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-50 p-2 text-sm font-semibold text-blue-700 hover:bg-blue-100"><Edit3 className="h-4 w-4" /> Modifier</button>}
            <button type="button" onClick={() => { setSelectedAccommodationId(accommodation._id); setView("reservations"); }} className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-50 p-2 text-sm font-semibold text-blue-700 hover:bg-blue-100"><LayoutDashboard className="h-4 w-4" /> Réservations</button>
            <button type="button" onClick={() => { setSelectedAccommodationId(accommodation._id); setView("calendar"); }} className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-50 p-2 text-sm font-semibold text-blue-700 hover:bg-blue-100"><CalendarDays className="h-4 w-4" /> Calendrier</button>
            {canEdit && <button type="button" onClick={() => setArchiveTarget(accommodation)} className="inline-flex items-center justify-center gap-2 rounded-lg bg-red-50 p-2 text-sm font-semibold text-red-700 hover:bg-red-100"><Trash2 className="h-4 w-4" /> Archiver</button>}
          </>} />)}
      </div>}
      {totalPages > 1 && <DashboardPagination page={page} totalPages={totalPages} onPrevious={() => setPage((value) => value - 1)} onNext={() => setPage((value) => value + 1)} />}
    </>}

    {view === "overview" && <DashboardKpis items={[
      { key: "total", label: "Hébergements", value: analytics?.kpis?.total }, { key: "published", label: "Publiés", value: analytics?.kpis?.published }, { key: "unavailable", label: "Indisponibles", value: analytics?.kpis?.unavailable }, { key: "maintenance", label: "Maintenance", value: analytics?.kpis?.maintenance },
      { key: "today", label: "Réservations aujourd’hui", value: analytics?.kpis?.reservationsToday }, { key: "week", label: "Réservations semaine", value: analytics?.kpis?.reservationsWeek }, { key: "checkins", label: "Arrivées du jour", value: analytics?.kpis?.checkInsToday }, { key: "checkouts", label: "Départs du jour", value: analytics?.kpis?.checkOutsToday },
      { key: "occupancy", label: "Occupation mensuelle", value: `${analytics?.kpis?.occupancyRate || 0}%` }, { key: "bookedMonth", label: "Valeur réservée ce mois", value: analytics?.kpis?.bookedValueMonth, format: "money" }, { key: "grossCollected", label: "Montant brut encaissé", value: analytics?.kpis?.grossAmountCollected, format: "money" }, { key: "remaining", label: "Solde à encaisser", value: analytics?.kpis?.remainingAmount, format: "money" },
      { key: "refunded", label: "Montant remboursé", value: analytics?.kpis?.refundedAmount, format: "money" }, { key: "refundPending", label: "Remboursements en attente", value: analytics?.kpis?.pendingRefunds }, { key: "paid", label: "Réservations payées", value: analytics?.kpis?.paidReservations }, { key: "unpaid", label: "Réservations impayées", value: analytics?.kpis?.unpaidReservations },
    ]} loading={!analytics} note={analytics?.occupancyFormula} />}

    {["reservations", "new", "calendar", "finance"].includes(view) && <><>{selectedAccommodationId && <div className="mb-3 flex items-center justify-between rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900"><span>Filtre actif : {data.accommodations.find((item) => item._id === selectedAccommodationId)?.property?.title || "Hébergement sélectionné"}</span><button type="button" onClick={() => setSelectedAccommodationId("")} className="inline-flex items-center gap-1 font-semibold"><X className="h-4 w-4"/> Effacer</button></div>}</><AccommodationReservationsPanel key={`${view}-${selectedAccommodationId}`} accommodations={data.accommodations} initialAccommodationId={selectedAccommodationId} initialTab={operationalTab} onChanged={loadAnalytics} /></>}
    {archiveTarget && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true" aria-labelledby="archive-title"><div className="w-full max-w-sm rounded-xl bg-white p-6 text-center shadow-2xl"><AlertTriangle className="mx-auto mb-3 h-12 w-12 text-red-500"/><h2 id="archive-title" className="text-xl font-bold">Archiver cet hébergement ?</h2><p className="my-4 text-sm text-slate-600">« {archiveTarget.property?.title} » sera masqué. Ses réservations et données financières seront conservées.</p><div className="flex gap-3"><button autoFocus onClick={() => setArchiveTarget(null)} className="flex-1 rounded-lg bg-slate-100 px-4 py-2 font-semibold">Annuler</button><button onClick={archive} className="flex-1 rounded-lg bg-red-600 px-4 py-2 font-semibold text-white">Archiver</button></div></div></div>}
  </DashboardPage>;
}
