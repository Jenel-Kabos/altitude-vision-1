"use client";

// Sprint D — Dashboard Hôtel → Chambres. Tableau des chambres (mission §8)
// + plan d'étage simple, groupé par étage, sans plan graphique (mission §9).

import React, { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { toast } from "react-hot-toast";
import {
  getRooms, createRoom, updateRoom, deleteRoom, getRoomCategories,
} from "../../services/hotelService";
import { ROOM_STATUSES, ROOM_STATUS_CLASSES, ROOM_STATUS_TRANSITIONS } from "../../constants/room";
import { BedDouble } from "lucide-react";
import { DashboardCard, DashboardPage, DashboardPageHeader, DashboardState, DashboardTableContainer, DashboardToolbar } from "../../components/dashboard/DashboardUI";

const emptyForm = () => ({ roomNumber: "", roomCategoryId: "", floor: 0, wing: "", notes: "" });

const RoomsPage = () => {
  const params = useParams();
  const hotelId = params?.hotelId;
  const [rooms, setRooms] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState("table"); // 'table' | 'floors'
  const [filters, setFilters] = useState({ floor: "", roomCategoryId: "", status: "" });
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState(emptyForm());

  const load = async () => {
    if (!hotelId) return;
    setLoading(true);
    try {
      const query = {};
      if (filters.floor !== "") query.floor = filters.floor;
      if (filters.roomCategoryId) query.roomCategoryId = filters.roomCategoryId;
      if (filters.status) query.status = filters.status;
      const list = await getRooms(hotelId, query);
      setRooms(list || []);
    } catch (err) {
      toast.error("Erreur lors du chargement des chambres.");
    } finally {
      setLoading(false);
    }
  };

  const loadCategories = async () => {
    if (!hotelId) return;
    try {
      const list = await getRoomCategories(hotelId);
      setCategories(list || []);
    } catch (err) {
      // silencieux — les catégories ne sont utilisées que pour le formulaire/filtre
    }
  };

  useEffect(() => { loadCategories(); }, [hotelId]);
  useEffect(() => { load(); }, [hotelId, filters.floor, filters.roomCategoryId, filters.status]);

  const handleCreate = async () => {
    if (!form.roomNumber.trim()) { toast.error("Le numéro de chambre est requis."); return; }
    if (!form.roomCategoryId) { toast.error("La catégorie de chambres est requise."); return; }
    try {
      await createRoom(hotelId, { ...form, floor: Number(form.floor) || 0 });
      toast.success("Chambre créée.");
      setCreating(false);
      setForm(emptyForm());
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || "Erreur lors de la création.");
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Supprimer définitivement cette chambre ?")) return;
    try {
      await deleteRoom(id);
      toast.success("Chambre supprimée.");
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || "Erreur lors de la suppression.");
    }
  };

  const handleStatusChange = async (room, status) => {
    try {
      await updateRoom(room._id, { status });
      toast.success("Statut mis à jour.");
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || "Transition de statut invalide.");
    }
  };

  const roomsByFloor = useMemo(() => {
    const map = new Map();
    rooms.forEach((r) => {
      const floor = r.floor ?? 0;
      if (!map.has(floor)) map.set(floor, []);
      map.get(floor).push(r);
    });
    return [...map.entries()].sort((a, b) => a[0] - b[0]);
  }, [rooms]);

  const floorOptions = useMemo(() => [...new Set(rooms.map((r) => r.floor ?? 0))].sort((a, b) => a - b), [rooms]);

  if (loading && rooms.length === 0) return <DashboardState type="loading" title="Chargement des chambres…" />;

  return (
    <DashboardPage>
      <DashboardPageHeader icon={BedDouble} title="Chambres" description="Chambres physiques de cet établissement — statut, catégorie et affectation en cours."
        actions={<Link href={`/dashboard/hotels/${hotelId}`} className="text-sm text-blue-600 underline">← Retour à l'établissement</Link>} />

      <DashboardToolbar label="Vues et actions des chambres">
        <button onClick={() => setView("table")} className={`px-3 py-1.5 rounded text-sm font-medium ${view === "table" ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-700"}`}>
          Tableau des chambres
        </button>
        <button onClick={() => setView("floors")} className={`px-3 py-1.5 rounded text-sm font-medium ${view === "floors" ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-700"}`}>
          Plan d'étage
        </button>
        <Link href={`/dashboard/hotels/${hotelId}/inventory`} className="px-3 py-1.5 rounded text-sm font-medium bg-indigo-100 text-indigo-800">Calendrier d’inventaire</Link>
        {!creating && (
          <button onClick={() => setCreating(true)} className="ml-auto bg-gold text-white px-3 py-1.5 rounded text-sm">
            + Nouvelle chambre
          </button>
        )}
      </DashboardToolbar>

      {creating && (
        <DashboardCard className="mb-4 space-y-3">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <input placeholder="Numéro" aria-label="Numéro de chambre" value={form.roomNumber}
              onChange={(e) => setForm((p) => ({ ...p, roomNumber: e.target.value }))} className="p-2 border rounded text-sm" />
            <select aria-label="Catégorie" value={form.roomCategoryId} onChange={(e) => setForm((p) => ({ ...p, roomCategoryId: e.target.value }))} className="p-2 border rounded text-sm">
              <option value="">Catégorie...</option>
              {categories.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
            </select>
            <input type="number" placeholder="Étage" aria-label="Étage" value={form.floor}
              onChange={(e) => setForm((p) => ({ ...p, floor: e.target.value }))} className="p-2 border rounded text-sm" />
            <input placeholder="Aile (optionnel)" value={form.wing}
              onChange={(e) => setForm((p) => ({ ...p, wing: e.target.value }))} className="p-2 border rounded text-sm" />
          </div>
          <div className="flex gap-2">
            <button onClick={handleCreate} className="bg-gold text-white px-3 py-1.5 rounded text-sm">Enregistrer</button>
            <button onClick={() => { setCreating(false); setForm(emptyForm()); }} className="text-gray-600 text-sm">Annuler</button>
          </div>
        </DashboardCard>
      )}

      <DashboardToolbar>
        <select aria-label="Filtrer par étage" value={filters.floor} onChange={(e) => setFilters((p) => ({ ...p, floor: e.target.value }))} className="p-2 border rounded text-sm">
          <option value="">Tous les étages</option>
          {floorOptions.map((f) => <option key={f} value={f}>Étage {f}</option>)}
        </select>
        <select aria-label="Filtrer par catégorie" value={filters.roomCategoryId} onChange={(e) => setFilters((p) => ({ ...p, roomCategoryId: e.target.value }))} className="p-2 border rounded text-sm">
          <option value="">Toutes les catégories</option>
          {categories.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
        </select>
        <select aria-label="Filtrer par statut" value={filters.status} onChange={(e) => setFilters((p) => ({ ...p, status: e.target.value }))} className="p-2 border rounded text-sm">
          <option value="">Tous les statuts</option>
          {ROOM_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
      </DashboardToolbar>

      {rooms.length === 0 ? (
        <DashboardState title="Aucune chambre" description="Aucune chambre ne correspond aux critères sélectionnés." />
      ) : view === "table" ? (
        <DashboardTableContainer label="Liste des chambres">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 border-b">
                <th className="py-2 pr-3">Numéro</th>
                <th className="py-2 pr-3">Étage</th>
                <th className="py-2 pr-3">Catégorie</th>
                <th className="py-2 pr-3">Statut</th>
                <th className="py-2 pr-3">Réservation</th>
                <th className="py-2 pr-3">Client</th>
                <th className="py-2 pr-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rooms.map((room) => (
                <tr key={room._id} className="border-b hover:bg-gray-50">
                  <td className="py-2 pr-3 font-medium">{room.roomNumber}</td>
                  <td className="py-2 pr-3">{room.floor}</td>
                  <td className="py-2 pr-3">{room.roomCategory?.name || "—"}</td>
                  <td className="py-2 pr-3">
                    <span className={`text-xs font-semibold px-2 py-1 rounded ${ROOM_STATUS_CLASSES[room.status]}`}>
                      {ROOM_STATUSES.find((s) => s.value === room.status)?.label}
                    </span>
                  </td>
                  <td className="py-2 pr-3">{room.reservation?.reference || "—"}</td>
                  <td className="py-2 pr-3">{room.reservation?.guest ? `${room.reservation.guest.firstName || ""} ${room.reservation.guest.lastName || ""}` : "—"}</td>
                  <td className="py-2 pr-3">
                    <div className="flex flex-wrap gap-1">
                      <select aria-label={`Changer le statut de la chambre ${room.roomNumber}`} value=""
                        onChange={(e) => e.target.value && handleStatusChange(room, e.target.value)}
                        className="text-xs border rounded px-1 py-1">
                        <option value="">Changer statut...</option>
                        {(ROOM_STATUS_TRANSITIONS[room.status] || []).map((s) => (
                          <option key={s} value={s}>{ROOM_STATUSES.find((x) => x.value === s)?.label}</option>
                        ))}
                      </select>
                      <button onClick={() => handleDelete(room._id)} className="bg-red-600 text-white px-2 py-1 rounded text-xs">Suppr.</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </DashboardTableContainer>
      ) : (
        <div className="space-y-6">
          {roomsByFloor.map(([floor, list]) => (
            <div key={floor}>
              <h3 className="font-semibold text-gray-700 mb-2">Étage {floor}</h3>
              <div className="flex flex-wrap gap-2">
                {list.sort((a, b) => a.roomNumber.localeCompare(b.roomNumber)).map((room) => (
                  <div key={room._id} className={`border rounded px-3 py-2 text-sm ${ROOM_STATUS_CLASSES[room.status]}`}>
                    <div className="font-semibold">{room.roomNumber}</div>
                    <div className="text-xs">{ROOM_STATUSES.find((s) => s.value === room.status)?.label}</div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </DashboardPage>
  );
};

export default RoomsPage;
