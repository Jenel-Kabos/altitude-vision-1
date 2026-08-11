"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { Archive, BedDouble, Building2, CalendarDays, CreditCard, Edit3, ListChecks } from "lucide-react";
import { toast } from "react-hot-toast";
import HotelPropertyForm from "../../components/dashboard/HotelPropertyForm";
import DashboardKpis from "../../components/dashboard/DashboardKpis";
import PropertyManagementCard from "../../components/dashboard/PropertyManagementCard";
import { DashboardActionMenu, DashboardCard, DashboardPage, DashboardPageHeader, DashboardPagination, DashboardSection, DashboardState, DashboardToolbar } from "../../components/dashboard/DashboardUI";
import { deactivateHotel, getHotelPortfolio } from "../../services/hotelService";
import { getDashboardAnalytics } from "../../services/dashboardAnalyticsService";
import { useAuth } from "../../context/AuthContext";

const PAGE_SIZE = 12;
const money = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "XAF", maximumFractionDigits: 0 });

export default function ManageHotelsPage() {
  const { user } = useAuth();
  const [filters, setFilters] = useState({ search: "", city: "", starRating: "", sort: "recent" });
  const [page, setPage] = useState(1);
  const [data, setData] = useState({ hotels: [], total: 0 });
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState(null);
  const [analytics, setAnalytics] = useState(null);

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
  const archive = async (hotel) => {
    if (!window.confirm(`Archiver « ${hotel.name} » ?`)) return;
    try {
      await deactivateHotel(hotel._id);
      toast.success("Établissement archivé.");
      load();
    } catch (error) {
      const blockers = error.response?.data?.blockers;
      const details = blockers ? Object.entries(blockers).filter(([, count]) => count).map(([key, count]) => `${key}: ${count}`).join(" · ") : "";
      toast.error(`${error.response?.data?.message || "Archivage impossible."}${details ? ` ${details}` : ""}`);
    }
  };

  const kpis = analytics?.kpis || {};
  const totalPages = Math.max(1, Math.ceil((data.total || 0) / PAGE_SIZE));
  return <DashboardPage>
    <DashboardPageHeader icon={Building2} title="Établissements" description="Portefeuille des hôtels validés et autorisés à être exploités."
      actions={!creating && !editing && <button onClick={() => setCreating(true)} className="rounded-lg bg-gold px-4 py-2 font-semibold text-white">Ajouter un établissement</button>} />

    {(creating || editing) && <DashboardCard className="mb-6"><HotelPropertyForm scope={user?.role === 'Proprietaire' ? 'owner' : 'admin'} hotelId={editing?._id} accommodationType={editing?.accommodationType || "hotel"} initialProperty={editing?.property} initialHotel={editing} existingImages={editing?.property?.images || editing?.gallery || []}
      onSuccess={(result) => { setCreating(false); setEditing(null); toast.success(result?.proposedVersionPending ? "Les informations ordinaires sont enregistrées. Les modifications sensibles restent en attente dans Modération Hôtellerie ; la version publiée demeure active." : (editing ? "Établissement mis à jour." : "L’établissement a été soumis à la Modération Hôtellerie. Il apparaîtra ici après validation.")); load(); }}
      onCancel={() => { setCreating(false); setEditing(null); }} /></DashboardCard>}

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

    <DashboardToolbar label="Rechercher et filtrer">
      <input aria-label="Rechercher un établissement" value={filters.search} onChange={(event) => updateFilter("search", event.target.value)} placeholder="Nom de l’établissement" className="min-w-52 flex-1 rounded-lg border px-3 py-2 text-sm" />
      <input aria-label="Filtrer par ville" value={filters.city} onChange={(event) => updateFilter("city", event.target.value)} placeholder="Ville" className="rounded-lg border px-3 py-2 text-sm" />
      <select aria-label="Filtrer par catégorie" value={filters.starRating} onChange={(event) => updateFilter("starRating", event.target.value)} className="rounded-lg border px-3 py-2 text-sm">
        <option value="">Toutes les catégories</option>{[1,2,3,4,5].map((rating) => <option key={rating} value={rating}>{rating} étoile{rating > 1 ? "s" : ""}</option>)}
      </select>
      <select aria-label="Trier les établissements" value={filters.sort} onChange={(event) => updateFilter("sort", event.target.value)} className="rounded-lg border px-3 py-2 text-sm">
        <option value="recent">Plus récents</option><option value="ancien">Plus anciens</option><option value="nom">Nom</option>
      </select>
    </DashboardToolbar>

    {loading ? <DashboardState type="loading" title="Chargement des établissements…" /> : data.hotels.length === 0 ? <DashboardState title="Aucun établissement validé" description="Les nouvelles demandes apparaissent ici uniquement après validation dans Modération Hôtellerie." /> :
      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">{data.hotels.map((hotel) => {
        const stats = hotel.operationalStats || {};
        return <PropertyManagementCard key={hotel._id} property={{ ...hotel.property, title: hotel.name || hotel.property?.title }} description={hotel.description}
          badges={[{ label: `${hotel.starRating || 0} étoile${hotel.starRating > 1 ? "s" : ""}` }, { label: "Validé", className: "bg-emerald-600" }]}
          priceLabel={hotel.minNightlyRate ? `Dès ${money.format(hotel.minNightlyRate)}` : undefined} capacity={hotel.totalCapacity}
          footer={<div className="mb-4 grid grid-cols-3 gap-2 text-center text-xs text-gray-600"><span><strong className="block text-base text-gray-900">{stats.totalRooms || hotel.totalRooms || 0}</strong>chambres</span><span><strong className="block text-base text-emerald-700">{stats.availableRooms || 0}</strong>disponibles</span><span><strong className="block text-base text-blue-700">{stats.occupancyRate || 0}%</strong>occupation</span></div>}
          actions={<>
            <Link href={`/dashboard/etablissements/${hotel._id}`} className="rounded bg-blue-600 px-3 py-2 text-xs font-semibold text-white">Ouvrir</Link>
            <DashboardActionMenu label={`Actions pour ${hotel.name}`} items={[
              { label: "Modifier", icon: Edit3, onSelect: () => setEditing(hotel) },
              { label: "Chambres", icon: BedDouble, href: `/dashboard/hotels/${hotel._id}/rooms` },
              { label: "Réservations", icon: ListChecks, href: `/dashboard/hotel-reservations?hotelId=${hotel._id}` },
              { label: "Calendrier", icon: CalendarDays, href: `/dashboard/hotels/${hotel._id}/inventory` },
              { label: "Finances", icon: CreditCard, href: `/dashboard/hotel-finance?hotelId=${hotel._id}` },
              { label: "Archiver", icon: Archive, danger: true, onSelect: () => archive(hotel) },
            ]} />
          </>} />;
      })}</div>}
    {totalPages > 1 && <DashboardPagination page={page} totalPages={totalPages} onPrevious={() => setPage((value) => value - 1)} onNext={() => setPage((value) => value + 1)} />}
  </DashboardPage>;
}
