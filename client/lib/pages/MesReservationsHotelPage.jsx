"use client";

// Sprint C — espace client "Mes réservations" (hôtelières). Même
// convention que MesVisitesPage.jsx : page autonome, pas de wrapper
// dashboard dédié.

import React, { useEffect, useState } from "react";
import { toast } from "react-hot-toast";
import { Calendar } from "lucide-react";
import { getMyHotelReservations, cancelHotelReservation } from "../services/hotelReservationService";
import { RESERVATION_STATUSES, RESERVATION_STATUS_CLASSES } from "../constants/hotelReservation";
import { formatCurrencyXAF } from "../utils/normalizePropertyDetail";

const CANCELLABLE = ['pending', 'confirmed'];

const MesReservationsHotelPage = () => {
  const [reservations, setReservations] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      setLoading(true);
      const list = await getMyHotelReservations();
      setReservations(list || []);
    } catch (err) {
      toast.error("Erreur lors du chargement de vos réservations.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleCancel = async (id) => {
    if (!window.confirm("Annuler cette réservation ?")) return;
    try {
      await cancelHotelReservation(id, "Annulation à la demande du client.");
      toast.success("Réservation annulée.");
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || "Erreur lors de l'annulation.");
    }
  };

  if (loading) return <p className="text-center mt-10">Chargement...</p>;

  return (
    <div className="max-w-3xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-1">Mes réservations</h1>
      <p className="text-sm text-gray-500 mb-6">Vos demandes et réservations dans les hôtels partenaires Altimmo.</p>

      {reservations.length === 0 ? (
        <p className="text-gray-500">Vous n'avez aucune réservation pour le moment.</p>
      ) : (
        <div className="space-y-3">
          {reservations.map((r) => (
            <div key={r._id} className="border rounded-lg p-4 bg-white shadow-sm">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="font-semibold">{r.hotel?.name}</h3>
                  <p className="text-sm text-gray-500">{r.roomCategory?.name}</p>
                </div>
                <span className={`text-xs font-semibold px-2 py-1 rounded ${RESERVATION_STATUS_CLASSES[r.status]}`}>
                  {RESERVATION_STATUSES.find((s) => s.value === r.status)?.label}
                </span>
              </div>
              <p className="text-sm text-gray-600 flex items-center gap-1 mt-2">
                <Calendar size={13} /> {new Date(r.checkInDate).toLocaleDateString('fr-FR')} → {new Date(r.checkOutDate).toLocaleDateString('fr-FR')} ({r.nights} nuit(s))
              </p>
              <p className="text-sm text-gray-600 mt-1">Référence : {r.reference}</p>
              {r.status === "checked_in" && r.room?.roomNumber && (
                <p className="text-sm text-blue-700 font-medium mt-1">Chambre {r.room.roomNumber}</p>
              )}
              <p className="text-sm font-semibold mt-1">{formatCurrencyXAF(r.totalAmount)}</p>

              {CANCELLABLE.includes(r.status) && (
                <button onClick={() => handleCancel(r._id)} className="mt-3 bg-red-600 text-white px-3 py-1.5 rounded text-sm">
                  Annuler
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default MesReservationsHotelPage;
