"use client";

// Sprint D — mission §18 : dashboard admin "vue globale des chambres",
// tous établissements confondus. Version simple : agrège les chambres de
// chaque hôtel (pas d'endpoint global dédié — hors périmètre Sprint D).

import React, { useEffect, useState } from "react";
import { toast } from "react-hot-toast";
import { getHotelsAdmin, getRooms } from "../../services/hotelService";
import { ROOM_STATUSES, ROOM_STATUS_CLASSES } from "../../constants/room";

const AdminRoomsOverviewPage = () => {
  const [rows, setRows] = useState([]); // [{ hotel, rooms }]
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const { hotels } = await getHotelsAdmin({ limit: 200 });
      const results = await Promise.all(
        (hotels || []).map(async (hotel) => {
          try {
            const rooms = await getRooms(hotel._id);
            return { hotel, rooms: rooms || [] };
          } catch (err) {
            return { hotel, rooms: [] };
          }
        }),
      );
      setRows(results.filter((r) => r.rooms.length > 0));
    } catch (err) {
      toast.error("Erreur lors du chargement de la vue globale des chambres.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const allRooms = rows.flatMap((r) => r.rooms.map((room) => ({ ...room, hotelName: r.hotel.name })));
  const counts = ROOM_STATUSES.reduce((acc, s) => ({ ...acc, [s.value]: allRooms.filter((r) => r.status === s.value).length }), {});
  const visibleRooms = statusFilter ? allRooms.filter((r) => r.status === statusFilter) : allRooms;

  if (loading) return <p className="text-center mt-10">Chargement...</p>;

  return (
    <div className="max-w-6xl mx-auto p-6 bg-white rounded shadow-md">
      <h2 className="text-2xl font-bold mb-1">Chambres — vue globale</h2>
      <p className="text-sm text-gray-500 mb-4">Toutes les chambres, tous établissements confondus.</p>

      <div className="grid grid-cols-2 sm:grid-cols-6 gap-2 mb-6">
        {ROOM_STATUSES.map((s) => (
          <button key={s.value} onClick={() => setStatusFilter(statusFilter === s.value ? "" : s.value)}
            className={`border rounded p-3 text-left ${statusFilter === s.value ? "ring-2 ring-gray-900" : ""} ${ROOM_STATUS_CLASSES[s.value]}`}>
            <div className="text-2xl font-bold">{counts[s.value] || 0}</div>
            <div className="text-xs font-medium">{s.label}</div>
          </button>
        ))}
      </div>

      {visibleRooms.length === 0 ? (
        <p className="text-center text-gray-500 py-8">Aucune chambre pour ces critères.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 border-b">
                <th className="py-2 pr-3">Hôtel</th>
                <th className="py-2 pr-3">Numéro</th>
                <th className="py-2 pr-3">Étage</th>
                <th className="py-2 pr-3">Catégorie</th>
                <th className="py-2 pr-3">Statut</th>
                <th className="py-2 pr-3">Réservation</th>
              </tr>
            </thead>
            <tbody>
              {visibleRooms.map((room) => (
                <tr key={room._id} className="border-b hover:bg-gray-50">
                  <td className="py-2 pr-3">{room.hotelName}</td>
                  <td className="py-2 pr-3 font-medium">{room.roomNumber}</td>
                  <td className="py-2 pr-3">{room.floor}</td>
                  <td className="py-2 pr-3">{room.roomCategory?.name || "—"}</td>
                  <td className="py-2 pr-3">
                    <span className={`text-xs font-semibold px-2 py-1 rounded ${ROOM_STATUS_CLASSES[room.status]}`}>
                      {ROOM_STATUSES.find((s) => s.value === room.status)?.label}
                    </span>
                  </td>
                  <td className="py-2 pr-3">{room.reservation?.reference || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default AdminRoomsOverviewPage;
