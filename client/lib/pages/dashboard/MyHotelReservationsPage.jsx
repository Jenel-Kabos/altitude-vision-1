"use client";

// Sprint C — dashboard propriétaire "Mes réservations". Vue tabulaire (pas
// de calendrier — mission §14) : liste, recherche, filtres hôtel/statut,
// détail, confirmer/rejeter/annuler, création manuelle.

import React, { useEffect, useRef, useState } from "react";
import { toast } from "react-hot-toast";
import {
  getOwnerHotelReservations, confirmHotelReservation, rejectHotelReservation, cancelHotelReservation,
  createOwnerHotelReservation,
} from "../../services/hotelReservationService";
import { RESERVATION_STATUSES, RESERVATION_STATUS_CLASSES } from "../../constants/hotelReservation";
import { formatCurrencyXAF } from "../../utils/normalizePropertyDetail";
import RoomAssignmentPanel from "../../components/RoomAssignmentPanel";
import HotelFinancialDocumentPanel from "../../components/HotelFinancialDocumentPanel";

const STATUS_TABS = [{ value: "", label: "Tous" }, ...RESERVATION_STATUSES];

const MyHotelReservationsPage = () => {
  const createRequestIdRef = useRef(null);
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState({ reservations: [], total: 0 });
  const [loading, setLoading] = useState(true);
  const [reasonInputs, setReasonInputs] = useState({});
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({
    hotelId: "", roomCategoryId: "", ratePlanId: "", checkInDate: "", checkOutDate: "",
    roomsCount: 1, adults: 1, children: 0,
    guest: { firstName: "", lastName: "", email: "", phone: "" },
  });
  const limit = 20;

  const load = async () => {
    setLoading(true);
    try {
      const res = await getOwnerHotelReservations({ status: status || undefined, search: search || undefined, page, limit });
      setData(res);
    } catch (err) {
      toast.error("Erreur lors du chargement des réservations.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [status, page]);
  useEffect(() => {
    const t = setTimeout(() => { setPage(1); load(); }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const totalPages = Math.max(1, Math.ceil((data.total || 0) / limit));

  const handleConfirm = async (id) => {
    try { await confirmHotelReservation(id); toast.success("Réservation confirmée."); load(); }
    catch (err) { toast.error(err.response?.data?.message || "Erreur."); }
  };

  const handleReject = async (id) => {
    const reason = reasonInputs[id];
    if (!reason?.trim()) { toast.error("Un motif est requis."); return; }
    try { await rejectHotelReservation(id, reason); toast.success("Réservation rejetée."); load(); }
    catch (err) { toast.error(err.response?.data?.message || "Erreur."); }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!form.guest.firstName || !form.guest.lastName || !form.guest.email) {
      toast.error("Prénom, nom et email du client sont requis.");
      return;
    }
    try {
      if (!createRequestIdRef.current) createRequestIdRef.current = globalThis.crypto?.randomUUID?.() || `reservation-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      await createOwnerHotelReservation({ ...form, reservationRequestId: createRequestIdRef.current });
      toast.success("Réservation créée.");
      createRequestIdRef.current = null;
      setCreating(false);
      load();
    } catch (err) {
      if (err.response?.status === 409) toast.error("Ces dates ne sont pas disponibles pour cette catégorie.");
      else toast.error(err.response?.data?.message || "Erreur lors de la création.");
    }
  };

  const handleCancel = async (id) => {
    const reason = reasonInputs[id] || "";
    try { await cancelHotelReservation(id, reason); toast.success("Réservation annulée."); load(); }
    catch (err) { toast.error(err.response?.data?.message || "Erreur."); }
  };

  return (
    <div className="max-w-6xl mx-auto p-6 bg-white rounded shadow-md">
      <div className="flex items-center justify-between mb-1">
        <h2 className="text-2xl font-bold">Mes réservations</h2>
        {!creating && (
          <button onClick={() => setCreating(true)} className="bg-gold text-white px-3 py-1.5 rounded text-sm">
            + Réservation manuelle
          </button>
        )}
      </div>
      <p className="text-sm text-gray-500 mb-4">Réservations reçues pour vos établissements hôteliers.</p>

      {creating && (
        <form onSubmit={handleCreate} className="bg-gray-50 border rounded p-4 mb-6 space-y-3">
          <p className="text-xs text-gray-500">Renseignez les identifiants de l'hôtel, de la catégorie et du tarif (visibles depuis la fiche établissement).</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <input placeholder="ID Hôtel" value={form.hotelId} onChange={(e) => setForm((f) => ({ ...f, hotelId: e.target.value }))} className="p-2 border rounded text-sm" />
            <input placeholder="ID Catégorie" value={form.roomCategoryId} onChange={(e) => setForm((f) => ({ ...f, roomCategoryId: e.target.value }))} className="p-2 border rounded text-sm" />
            <input placeholder="ID Tarif" value={form.ratePlanId} onChange={(e) => setForm((f) => ({ ...f, ratePlanId: e.target.value }))} className="p-2 border rounded text-sm" />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <input type="date" value={form.checkInDate} onChange={(e) => setForm((f) => ({ ...f, checkInDate: e.target.value }))} className="p-2 border rounded text-sm" />
            <input type="date" value={form.checkOutDate} onChange={(e) => setForm((f) => ({ ...f, checkOutDate: e.target.value }))} className="p-2 border rounded text-sm" />
            <input type="number" min="1" placeholder="Chambres" value={form.roomsCount} onChange={(e) => setForm((f) => ({ ...f, roomsCount: e.target.value }))} className="p-2 border rounded text-sm" />
            <input type="number" min="1" placeholder="Adultes" value={form.adults} onChange={(e) => setForm((f) => ({ ...f, adults: e.target.value }))} className="p-2 border rounded text-sm" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <input placeholder="Prénom client" value={form.guest.firstName} onChange={(e) => setForm((f) => ({ ...f, guest: { ...f.guest, firstName: e.target.value } }))} className="p-2 border rounded text-sm" />
            <input placeholder="Nom client" value={form.guest.lastName} onChange={(e) => setForm((f) => ({ ...f, guest: { ...f.guest, lastName: e.target.value } }))} className="p-2 border rounded text-sm" />
            <input placeholder="Email client" value={form.guest.email} onChange={(e) => setForm((f) => ({ ...f, guest: { ...f.guest, email: e.target.value } }))} className="p-2 border rounded text-sm" />
          </div>
          <div className="flex gap-2">
            <button type="submit" className="bg-gold text-white px-3 py-1.5 rounded text-sm">Créer</button>
            <button type="button" onClick={() => setCreating(false)} className="text-gray-600 text-sm">Annuler</button>
          </div>
        </form>
      )}

      <div className="flex flex-wrap gap-2 mb-4">
        {STATUS_TABS.map((tab) => (
          <button key={tab.value || 'tous'} onClick={() => { setStatus(tab.value); setPage(1); }}
            className={`px-3 py-1.5 rounded text-sm font-medium ${status === tab.value ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-700"}`}>
            {tab.label}
          </button>
        ))}
      </div>

      <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Rechercher une référence..."
        aria-label="Rechercher" className="w-full mb-4 px-3 py-2 border rounded text-sm" />

      {loading ? (
        <p className="text-center text-gray-500 py-8">Chargement...</p>
      ) : data.reservations.length === 0 ? (
        <p className="text-center text-gray-500 py-8">Aucune réservation pour ces critères.</p>
      ) : (
        <div className="space-y-3">
          {data.reservations.map((r) => (
            <div key={r._id} className="border rounded p-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <h3 className="font-semibold">{r.reference} — {r.hotel?.name}</h3>
                  <p className="text-xs text-gray-500">
                    {r.roomCategory?.name} · {new Date(r.checkInDate).toLocaleDateString('fr-FR')} → {new Date(r.checkOutDate).toLocaleDateString('fr-FR')} ({r.nights} nuit(s))
                  </p>
                  <p className="text-xs text-gray-500">
                    {r.guest?.firstName} {r.guest?.lastName} · {r.guest?.email} · {r.adults} adulte(s){r.children ? `, ${r.children} enfant(s)` : ''}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-semibold px-2 py-1 rounded ${RESERVATION_STATUS_CLASSES[r.status]}`}>
                    {RESERVATION_STATUSES.find((s) => s.value === r.status)?.label}
                  </span>
                  <span className="text-sm font-semibold">{formatCurrencyXAF(r.totalAmount)}</span>
                </div>
              </div>

              {r.status === "pending" && (
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <button onClick={() => handleConfirm(r._id)} className="bg-green-600 text-white px-3 py-1.5 rounded text-sm">Confirmer</button>
                  <input placeholder="Motif de rejet" value={reasonInputs[r._id] || ""}
                    onChange={(e) => setReasonInputs((p) => ({ ...p, [r._id]: e.target.value }))}
                    className="px-2 py-1.5 border rounded text-sm" />
                  <button onClick={() => handleReject(r._id)} className="bg-red-600 text-white px-3 py-1.5 rounded text-sm">Rejeter</button>
                </div>
              )}
              {(r.status === "pending" || r.status === "confirmed") && (
                <div className="mt-2">
                  <button onClick={() => handleCancel(r._id)} className="bg-gray-600 text-white px-3 py-1.5 rounded text-sm">Annuler</button>
                </div>
              )}
              {r.status === "rejected" && r.rejectionReason && <p className="text-xs text-red-600 mt-2">Motif : {r.rejectionReason}</p>}
              {r.status === "cancelled" && r.cancellationReason && <p className="text-xs text-gray-600 mt-2">Motif d'annulation : {r.cancellationReason}</p>}
              {(r.status === "confirmed" || r.status === "checked_in") && (
                <>
                  <RoomAssignmentPanel reservation={r} onChanged={load} />
                  <HotelFinancialDocumentPanel reservation={r} canManage={false} />
                </>
              )}
            </div>
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex justify-center gap-2 mt-4">
          <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="px-3 py-1.5 border rounded text-sm disabled:opacity-40">Précédent</button>
          <span className="text-sm text-gray-500 self-center">Page {page} / {totalPages}</span>
          <button disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)} className="px-3 py-1.5 border rounded text-sm disabled:opacity-40">Suivant</button>
        </div>
      )}
    </div>
  );
};

export default MyHotelReservationsPage;
