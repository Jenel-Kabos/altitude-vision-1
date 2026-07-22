"use client";

// Sprint B2 — domaine Hôtellerie. Fiche établissement (dashboard) : score de
// complétude, liens vers Catégories/Tarifs, actions de cycle de vie.

import React, { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { toast } from "react-hot-toast";
import {
  getHotelDetail, submitHotel, deactivateHotel, reactivateHotel, duplicateHotel, deleteHotel,
} from "../../services/hotelService";
import { HOTEL_PUBLICATION_STATUSES } from "../../constants/hotel";

const STATUS_CLASSES = {
  brouillon: "bg-gray-100 text-gray-700",
  soumis: "bg-yellow-100 text-yellow-800",
  publie: "bg-green-100 text-green-800",
  suspendu: "bg-orange-100 text-orange-800",
  rejete: "bg-red-100 text-red-700",
};

const HotelDetailPage = () => {
  const params = useParams();
  const hotelId = params?.hotelId;
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    if (!hotelId) return;
    setLoading(true);
    try {
      const res = await getHotelDetail(hotelId);
      setData(res);
    } catch (err) {
      toast.error("Erreur lors du chargement de l'établissement.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [hotelId]);

  if (loading) return <p className="text-center mt-10">Chargement...</p>;
  if (!data?.hotel) return <p className="text-center mt-10 text-gray-500">Établissement introuvable.</p>;

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
      load();
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
    <div className="max-w-4xl mx-auto p-6 bg-white rounded shadow-md">
      <div className="flex items-center justify-between flex-wrap gap-2 mb-4">
        <div>
          <h2 className="text-2xl font-bold">{hotel.name}</h2>
          <p className="text-sm text-gray-500">{hotel.property?.address?.city}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-xs font-semibold px-2 py-1 rounded ${STATUS_CLASSES[hotel.publicationStatus] || "bg-gray-100"}`}>
            {HOTEL_PUBLICATION_STATUSES.find((s) => s.value === hotel.publicationStatus)?.label || hotel.publicationStatus}
          </span>
          {completion && (
            <span className={`text-xs font-semibold px-2 py-1 rounded ${completion.complete ? "bg-green-100 text-green-800" : "bg-amber-100 text-amber-800"}`}>
              Complétude {completion.score}%
            </span>
          )}
          {hotel.active === false && <span className="text-xs font-semibold px-2 py-1 rounded bg-gray-200 text-gray-600">Désactivé</span>}
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mb-6">
        <Link href={`/dashboard/hotels/${hotelId}/room-categories`} className="bg-blue-600 text-white px-3 py-1.5 rounded text-sm">
          Catégories de chambres
        </Link>
        <Link href={`/dashboard/hotels/${hotelId}/rates`} className="bg-blue-600 text-white px-3 py-1.5 rounded text-sm">
          Tarifs
        </Link>
        <Link href={`/dashboard/hotels/${hotelId}/rooms`} className="bg-blue-600 text-white px-3 py-1.5 rounded text-sm">
          Chambres
        </Link>
        {(hotel.publicationStatus === 'brouillon' || hotel.publicationStatus === 'rejete') && (
          <button onClick={handleSubmit} className="bg-green-600 text-white px-3 py-1.5 rounded text-sm">Soumettre pour validation</button>
        )}
        {hotel.publicationStatus === 'publie' && (
          <button onClick={handleToggleActive} className={`px-3 py-1.5 rounded text-sm text-white ${hotel.active === false ? 'bg-green-600' : 'bg-gray-600'}`}>
            {hotel.active === false ? 'Réactiver' : 'Désactiver'}
          </button>
        )}
        <button onClick={handleDuplicate} className="bg-gray-200 text-gray-800 px-3 py-1.5 rounded text-sm">Dupliquer</button>
        <button onClick={handleDelete} className="bg-red-600 text-white px-3 py-1.5 rounded text-sm">Supprimer</button>
      </div>

      {completion && !completion.complete && (
        <div className="bg-amber-50 border border-amber-200 rounded p-3 text-sm text-amber-800">
          Détail de la complétude : Informations {completion.breakdown.informations}/20 · Galerie {completion.breakdown.galerie}/20 ·
          Services {completion.breakdown.services}/20 · Catégories {completion.breakdown.categories}/25 · Tarifs {completion.breakdown.tarifs}/15
        </div>
      )}

      {hotel.rejectionReason && <p className="text-sm text-red-600 mt-3">Motif du rejet : {hotel.rejectionReason}</p>}
      {hotel.suspensionReason && <p className="text-sm text-orange-700 mt-3">Motif de suspension : {hotel.suspensionReason}</p>}
    </div>
  );
};

export default HotelDetailPage;
