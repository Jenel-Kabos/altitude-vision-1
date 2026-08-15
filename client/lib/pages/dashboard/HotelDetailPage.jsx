"use client";

// Sprint B2 — domaine Hôtellerie. Fiche établissement (dashboard) : score de
// complétude, liens vers Catégories/Tarifs, actions de cycle de vie.

import React, { useEffect, useState } from "react";
import { useParams, usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "react-hot-toast";
import {
  getHotelDetail, getHotelPortfolioDetail, submitHotel, deactivateHotel, reactivateHotel, duplicateHotel, deleteHotel,
} from "../../services/hotelService";
import { getDashboardAnalytics } from '../../services/dashboardAnalyticsService';
import { HOTEL_PUBLICATION_STATUSES } from "../../constants/hotel";
import { AlertTriangle, BedDouble, CalendarCheck, Hotel, LogIn, LogOut, Sparkles, Wrench } from "lucide-react";
import { DashboardCard, DashboardPage, DashboardPageHeader, DashboardState, DashboardToolbar } from "../../components/dashboard/DashboardUI";
import useHotelRealtime from '../../hooks/useHotelRealtime';

const STATUS_CLASSES = {
  brouillon: "bg-gray-100 text-gray-700",
  soumis: "bg-yellow-100 text-yellow-800",
  publie: "bg-green-100 text-green-800",
  suspendu: "bg-orange-100 text-orange-800",
  rejete: "bg-red-100 text-red-700",
};

const HotelDetailPage = () => {
  const params = useParams();
  const pathname = usePathname();
  const router = useRouter();
  const hotelId = params?.hotelId;
  const portfolioMode = pathname?.startsWith('/dashboard/etablissements/');
  const ownerMode = pathname?.startsWith('/mes-hotels/');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [operations, setOperations] = useState(null);

  const load = async () => {
    if (!hotelId) return;
    setLoading(true);
    try {
      const res = await (portfolioMode ? getHotelPortfolioDetail(hotelId) : getHotelDetail(hotelId));
      setData(res);
    } catch (err) {
      toast.error("Erreur lors du chargement de l'établissement.");
    } finally {
      setLoading(false);
    }
  };

  const loadOperations = async () => {
    if (!hotelId) return;
    try {
      setOperations(await getDashboardAnalytics('hotels', { hotelId }));
    } catch (err) {
      setOperations({ kpis: {}, unavailable: true });
    }
  };

  useEffect(() => { load(); loadOperations(); }, [hotelId]); // eslint-disable-line react-hooks/exhaustive-deps
  useHotelRealtime(hotelId, () => { load(); loadOperations(); });

  if (loading) return <DashboardState type="loading" title="Chargement de l’établissement…" />;
  if (!data?.hotel) return <DashboardState title="Établissement introuvable" description="Cet établissement n’est pas disponible ou n’existe plus." />;

  const { hotel, completion } = data;
  const kpis = operations?.kpis || {};
  const operationPath = (operation) => {
    if (ownerMode) return `/mes-hotels/${hotelId}/${operation}`;
    if (operation === 'rooms') return `/dashboard/hotels/${hotelId}/rooms`;
    return `/dashboard/${operation === 'finance' ? 'hotel-finance' : operation}?hotelId=${hotelId}`;
  };
  const reservationsHref = ownerMode ? `/mes-hotels/reservations?hotelId=${hotelId}` : `/dashboard/hotel-reservations?hotelId=${hotelId}`;
  const todayCards = [
    { label: 'Occupation', value: `${kpis.occupiedRooms || 0}/${kpis.totalRooms || 0}`, Icon: BedDouble, href: operationPath('rooms') },
    { label: 'Arrivées aujourd’hui', value: kpis.checkInsToday || 0, detail: `${kpis.pendingCheckIns || 0} check-in en attente`, Icon: LogIn, href: reservationsHref },
    { label: 'Départs aujourd’hui', value: kpis.checkOutsToday || 0, detail: `${kpis.pendingCheckOuts || 0} check-out en attente`, Icon: LogOut, href: reservationsHref },
    { label: 'À nettoyer', value: kpis.cleaningRooms || 0, detail: `${kpis.housekeeping || 0} tâche(s) ouverte(s)`, Icon: Sparkles, href: operationPath('housekeeping') },
    { label: 'À inspecter', value: kpis.inspectionRooms || 0, Icon: CalendarCheck, href: operationPath('housekeeping') },
    { label: 'Maintenance', value: kpis.maintenance || 0, detail: `${kpis.outOfServiceRooms || 0} chambre(s) hors service`, Icon: Wrench, href: operationPath('maintenance') },
    { label: 'Alertes financières', value: kpis.remainingAmount ? 1 : 0, detail: kpis.remainingAmount ? 'Solde émis restant' : 'Aucun solde émis', Icon: AlertTriangle, href: operationPath('finance') },
  ];

  const handleSubmit = async () => {
    try {
      await submitHotel(hotelId);
      toast.success("Hôtel soumis pour validation.");
      load();
    } catch (err) {
      const comp = err.response?.data?.completion;
      toast.error(comp ? `Incomplet (${comp.score}%).` : (err.response?.data?.message || "Erreur."));
    }
  };

  const handleToggleActive = async () => {
    try {
      if (hotel.active === false) { await reactivateHotel(hotelId); toast.success("Hôtel réactivé."); }
      else { await deactivateHotel(hotelId); toast.success("Hôtel désactivé."); }
      if (portfolioMode) router.push('/dashboard/etablissements');
      else load();
    } catch (err) {
      toast.error(err.response?.data?.message || "Erreur.");
    }
  };

  const handleDuplicate = async () => {
    try {
      await duplicateHotel(hotelId);
      toast.success("Hôtel dupliqué en brouillon.");
    } catch (err) {
      toast.error(err.response?.data?.message || "Erreur lors de la duplication.");
    }
  };

  const handleDelete = async () => {
    if (!window.confirm("Supprimer définitivement cet hôtel ? Cette action est irréversible.")) return;
    try {
      await deleteHotel(hotelId);
      toast.success("Hôtel supprimé.");
    } catch (err) {
      toast.error(err.response?.data?.message || "Erreur lors de la suppression.");
    }
  };

  return (
    <DashboardPage>
      <DashboardPageHeader icon={Hotel} title={hotel.name} description={hotel.property?.address?.city}
        actions={<div className="flex items-center gap-2">
          <span className={`text-xs font-semibold px-2 py-1 rounded ${STATUS_CLASSES[hotel.publicationStatus] || "bg-gray-100"}`}>
            {HOTEL_PUBLICATION_STATUSES.find((s) => s.value === hotel.publicationStatus)?.label || hotel.publicationStatus}
          </span>
          {completion && (
            <span className={`text-xs font-semibold px-2 py-1 rounded ${completion.complete ? "bg-green-100 text-green-800" : "bg-amber-100 text-amber-800"}`}>
              Complétude {completion.score}%
            </span>
          )}
          {hotel.active === false && <span className="text-xs font-semibold px-2 py-1 rounded bg-gray-200 text-gray-600">Désactivé</span>}
        </div>} />

      <section className="mb-6" aria-labelledby="today-board-title">
        <h2 id="today-board-title" className="mb-3 text-lg font-bold text-slate-900">Aujourd’hui</h2>
        {operations?.unavailable ? <DashboardState type="error" title="Indicateurs opérationnels indisponibles" description="La fiche de l’établissement reste utilisable." /> : <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{todayCards.map(({ label, value, detail, Icon, href }) => <Link key={label} href={href} className="rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"><DashboardCard className="h-full transition hover:border-blue-200 hover:shadow-md"><Icon className="mb-2 h-5 w-5 text-blue-700" aria-hidden="true"/><div className="text-2xl font-bold">{value}</div><div className="text-sm font-semibold">{label}</div>{detail && <div className="mt-1 text-xs text-slate-500">{detail}</div>}</DashboardCard></Link>)}</div>}
      </section>

      <DashboardToolbar label={portfolioMode ? "Centre opérationnel" : "Actions de l’établissement"}>
        <Link href={ownerMode ? `/mes-hotels/${hotelId}/room-categories` : `/dashboard/hotels/${hotelId}/room-categories`} className="bg-blue-600 text-white px-3 py-1.5 rounded text-sm">
          Catégories de chambres
        </Link>
        <Link href={ownerMode ? `/mes-hotels/${hotelId}/rates` : `/dashboard/hotels/${hotelId}/rates`} className="bg-blue-600 text-white px-3 py-1.5 rounded text-sm">
          Tarifs
        </Link>
        <Link href={ownerMode ? `/mes-hotels/${hotelId}/rooms` : `/dashboard/hotels/${hotelId}/rooms`} className="bg-blue-600 text-white px-3 py-1.5 rounded text-sm">
          Chambres
        </Link>
        <Link href={reservationsHref} className="bg-blue-600 text-white px-3 py-1.5 rounded text-sm">Réservations</Link>
        <Link href={ownerMode ? `/mes-hotels/${hotelId}/inventory` : `/dashboard/hotels/${hotelId}/inventory`} className="bg-blue-600 text-white px-3 py-1.5 rounded text-sm">Calendrier</Link>
        <Link href={ownerMode ? `/mes-hotels/${hotelId}/housekeeping` : `/dashboard/housekeeping?hotelId=${hotelId}`} className="bg-blue-600 text-white px-3 py-1.5 rounded text-sm">Housekeeping</Link>
        <Link href={ownerMode ? `/mes-hotels/${hotelId}/maintenance` : `/dashboard/maintenance?hotelId=${hotelId}`} className="bg-blue-600 text-white px-3 py-1.5 rounded text-sm">Maintenance</Link>
        <Link href={ownerMode ? `/mes-hotels/${hotelId}/finance` : `/dashboard/hotel-finance?hotelId=${hotelId}`} className="bg-blue-600 text-white px-3 py-1.5 rounded text-sm">Finances</Link>
        {!ownerMode && <Link href={`/dashboard/hotels/${hotelId}/staff`} className="bg-blue-600 text-white px-3 py-1.5 rounded text-sm">Personnel</Link>}
        {!portfolioMode && (hotel.publicationStatus === 'brouillon' || hotel.publicationStatus === 'rejete') && (
          <button onClick={handleSubmit} className="bg-green-600 text-white px-3 py-1.5 rounded text-sm">Soumettre pour validation</button>
        )}
        {hotel.publicationStatus === 'publie' && (
          <button onClick={handleToggleActive} className={`px-3 py-1.5 rounded text-sm text-white ${hotel.active === false ? 'bg-green-600' : 'bg-gray-600'}`}>
            {hotel.active === false ? 'Réactiver' : 'Archiver'}
          </button>
        )}
        {!portfolioMode && <button onClick={handleDuplicate} className="bg-gray-200 text-gray-800 px-3 py-1.5 rounded text-sm">Dupliquer</button>}
        {!portfolioMode && <button onClick={handleDelete} className="bg-red-600 text-white px-3 py-1.5 rounded text-sm">Supprimer</button>}
      </DashboardToolbar>

      {completion && !completion.complete && (
        <div className="bg-amber-50 border border-amber-200 rounded p-3 text-sm text-amber-800">
          Détail de la complétude : Informations {completion.breakdown.informations}/20 · Galerie {completion.breakdown.galerie}/20 ·
          Services {completion.breakdown.services}/20 · Catégories {completion.breakdown.categories}/25 · Tarifs {completion.breakdown.tarifs}/15
        </div>
      )}

      {hotel.rejectionReason && <p className="text-sm text-red-600 mt-3">Motif du rejet : {hotel.rejectionReason}</p>}
      {hotel.suspensionReason && <p className="text-sm text-orange-700 mt-3">Motif de suspension : {hotel.suspensionReason}</p>}
    </DashboardPage>
  );
};

export default HotelDetailPage;
