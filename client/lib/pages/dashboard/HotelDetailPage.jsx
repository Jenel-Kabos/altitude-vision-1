"use client";

// Sprint B2 — domaine Hôtellerie. Fiche établissement (dashboard) : score de
// complétude, liens vers Catégories/Tarifs, actions de cycle de vie.

import React, { useEffect, useState } from "react";
import { useParams, usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "react-hot-toast";
import {
  getHotelDetail, getHotelPortfolioDetail, submitHotel, deactivateHotel, reactivateHotel, duplicateHotel, deleteHotel, getRooms,
} from "../../services/hotelService";
import { HOTEL_PUBLICATION_STATUSES } from "../../constants/hotel";
import { ROOM_STATUSES, ROOM_STATUS_CLASSES } from "../../constants/room";
import { Hotel } from "lucide-react";
import { DashboardCard, DashboardPage, DashboardPageHeader, DashboardState, DashboardToolbar } from "../../components/dashboard/DashboardUI";

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
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [roomCounts, setRoomCounts] = useState(null);

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

  // Sprint E §12 — compteurs de statut des chambres (disponibles/occupées/
  // nettoyage/inspection/hors service), calculés côté client à partir du
  // tableau des chambres existant (pas de nouvel endpoint agrégé).
  const loadRoomCounts = async () => {
    if (!hotelId) return;
    try {
      const rooms = await getRooms(hotelId);
      const counts = (rooms || []).reduce((acc, r) => ({ ...acc, [r.status]: (acc[r.status] || 0) + 1 }), {});
      setRoomCounts(counts);
    } catch (err) {
      // silencieux — les compteurs sont un complément, pas un bloquant
    }
  };

  useEffect(() => { load(); loadRoomCounts(); }, [hotelId]); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) return <DashboardState type="loading" title="Chargement de l’établissement…" />;
  if (!data?.hotel) return <DashboardState title="Établissement introuvable" description="Cet établissement n’est pas disponible ou n’existe plus." />;

  const { hotel, completion } = data;

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

      {roomCounts && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mb-6">
          {['available', 'occupied', 'cleaning', 'inspection', 'out_of_service'].map((statusValue) => (
            <DashboardCard key={statusValue} className={ROOM_STATUS_CLASSES[statusValue]}>
              <div className="text-2xl font-bold">{roomCounts[statusValue] || 0}</div>
              <div className="text-xs font-medium">{ROOM_STATUSES.find((s) => s.value === statusValue)?.label}</div>
            </DashboardCard>
          ))}
        </div>
      )}

      <DashboardToolbar label={portfolioMode ? "Centre opérationnel" : "Actions de l’établissement"}>
        <Link href={`/dashboard/hotels/${hotelId}/room-categories`} className="bg-blue-600 text-white px-3 py-1.5 rounded text-sm">
          Catégories de chambres
        </Link>
        <Link href={`/dashboard/hotels/${hotelId}/rates`} className="bg-blue-600 text-white px-3 py-1.5 rounded text-sm">
          Tarifs
        </Link>
        <Link href={`/dashboard/hotels/${hotelId}/rooms`} className="bg-blue-600 text-white px-3 py-1.5 rounded text-sm">
          Chambres
        </Link>
        <Link href={`/dashboard/hotel-reservations?hotelId=${hotelId}`} className="bg-blue-600 text-white px-3 py-1.5 rounded text-sm">Réservations</Link>
        <Link href={`/dashboard/hotels/${hotelId}/inventory`} className="bg-blue-600 text-white px-3 py-1.5 rounded text-sm">Calendrier</Link>
        <Link href={`/dashboard/housekeeping?hotelId=${hotelId}`} className="bg-blue-600 text-white px-3 py-1.5 rounded text-sm">Housekeeping</Link>
        <Link href={`/dashboard/maintenance?hotelId=${hotelId}`} className="bg-blue-600 text-white px-3 py-1.5 rounded text-sm">Maintenance</Link>
        <Link href={`/dashboard/hotel-finance?hotelId=${hotelId}`} className="bg-blue-600 text-white px-3 py-1.5 rounded text-sm">Finances</Link>
        <Link href={`/dashboard/hotels/${hotelId}/staff`} className="bg-blue-600 text-white px-3 py-1.5 rounded text-sm">Personnel</Link>
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
