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
import { CalendarCheck2 } from "lucide-react";
import { DashboardCard, DashboardPage, DashboardPageHeader, DashboardPagination, DashboardState, DashboardToolbar } from "../../components/dashboard/DashboardUI";

const STATUS_TABS = [{ value: "", label: "Tous" }, ...RESERVATION_STATUSES];
const isToday = (value) => value && new Date(value).toDateString() === new Date().toDateString();

const MyHotelReservationsPage = ({ initialHotelId = '' }) => {
  const createRequestIdRef = useRef(null);
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState({ reservations: [], total: 0 });
  const [loading, setLoading] = useState(true);
  const [reasonInputs, setReasonInputs] = useState({});
  const [creating, setCreating] = useState(false);
  const [dateFilter, setDateFilter] = useState(""); // '' | 'arrivals' | 'departures'
  const [form, setForm] = useState({
    hotelId: initialHotelId, roomCategoryId: "", ratePlanId: "", checkInDate: "", checkOutDate: "",
    roomsCount: 1, adults: 1, children: 0,
    guest: { firstName: "", lastName: "", email: "", phone: "" },
  });
  const limit = 20;

  const load = async () => {
    setLoading(true);
    try {
      const res = await getOwnerHotelReservations({ hotelId: initialHotelId || undefined, status: status || undefined, search: search || undefined, page, limit });
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

  const visibleReservations = data.reservations.filter((r) => (
    !dateFilter
    || (dateFilter === "arrivals" && isToday(r.checkInDate))
    || (dateFilter === "departures" && isToday(r.checkOutDate))
  ));

  return (
    <DashboardPage>
      <DashboardPageHeader
        icon={CalendarCheck2}
        title="Mes réservations"
        description="Réservations reçues pour vos établissements hôteliers."
        actions={!creating && (
          <button onClick={() => setCreating(true)} className="bg-gold text-white px-3 py-1.5 rounded text-sm">
            + Réservation manuelle
          </button>
        )}
      />

      {creating && (
        <DashboardCard className="mb-6">
        <form onSubmit={handleCreate} className="space-y-3">
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
        </DashboardCard>
      )}

      <DashboardToolbar>
      <div className="flex flex-wrap gap-2">
        {STATUS_TABS.map((tab) => (
          <button key={tab.value || 'tous'} onClick={() => { setStatus(tab.value); setPage(1); }}
            className={`px-3 py-1.5 rounded text-sm font-medium ${status === tab.value ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-700"}`}>
            {tab.label}
          </button>
        ))}
      </div>

      <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Rechercher une référence..."
        aria-label="Rechercher" className="w-full px-3 py-2 border rounded text-sm" />

      {/* PHASE-HX1 §21 — dérivé des dates canoniques, jamais une seconde collection. */}
      <div className="flex flex-wrap gap-2">
        {[["", "Toutes"], ["arrivals", "Arrivées aujourd’hui"], ["departures", "Départs aujourd’hui"]].map(([value, label]) => (
          <button key={value || 'toutes'} aria-pressed={dateFilter === value} onClick={() => setDateFilter(value)}
            className={`px-3 py-1.5 rounded text-sm font-medium ${dateFilter === value ? "bg-blue-700 text-white" : "bg-gray-100 text-gray-700"}`}>
            {label}
          </button>
        ))}
      </div>
      </DashboardToolbar>

      {loading ? (
        <DashboardState type="loading" title="Chargement des réservations" />
      ) : visibleReservations.length === 0 ? (
        <DashboardState title="Aucune réservation" description="Aucune réservation ne correspond à ces critères." />
      ) : (
        <div className="space-y-3">
          {visibleReservations.map((r) => (
            <DashboardCard key={r._id}>
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
              {/* PHASE-HX1 §22 — check-in/check-out déjà implémentés dans
                  RoomAssignmentPanel ci-dessous (garde financière incluse) ;
                  jamais une seconde logique de transition dupliquée ici. */}
              {(r.status === "confirmed" || r.status === "checked_in") && (
                <>
                  <RoomAssignmentPanel reservation={r} onChanged={load} />
                  <HotelFinancialDocumentPanel reservation={r} canManage={false} />
                </>
              )}
            </DashboardCard>
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <DashboardPagination page={page} totalPages={totalPages} onPrevious={() => setPage((p) => p - 1)} onNext={() => setPage((p) => p + 1)} />
      )}
    </DashboardPage>
  );
};

export default MyHotelReservationsPage;
