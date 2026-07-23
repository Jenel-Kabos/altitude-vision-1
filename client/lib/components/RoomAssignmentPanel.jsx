"use client";

// Sprint D — panneau d'actions "chambre" pour une réservation hôtelière
// (dashboard propriétaire + admin) : affecter, changer, check-in, check-out.
//
// Correctif (post-Sprint D) : l'affectation active est désormais chargée
// depuis le backend au montage (GET /hotel-reservations/:id/room-assignment,
// voir hotelReservationController.getRoomAssignment) — elle survit donc à un
// rechargement de page, contrairement à la version précédente qui ne
// l'affichait que juste après une action effectuée dans la session React en
// cours.

import React, { useEffect, useState, useCallback } from "react";
import { toast } from "react-hot-toast";
import { getRooms, assignRoom, changeRoom } from "../services/hotelService";
import {
  checkInHotelReservation, checkOutHotelReservation, getCheckoutFinancialReadiness, getReservationRoomAssignment,
} from "../services/hotelReservationService";

const RoomAssignmentPanel = ({ reservation, onChanged, isAdmin = false }) => {
  const [open, setOpen] = useState(false);
  const [rooms, setRooms] = useState([]);
  const [selectedRoomId, setSelectedRoomId] = useState("");
  const [assignment, setAssignment] = useState(null);
  const [loadingAssignment, setLoadingAssignment] = useState(true);
  const [loadingRooms, setLoadingRooms] = useState(false);
  const [financialReadiness, setFinancialReadiness] = useState(null);
  const [loadingReadiness, setLoadingReadiness] = useState(false);

  const hotelId = reservation.hotel?._id || reservation.hotel;
  const roomCategoryId = reservation.roomCategory?._id || reservation.roomCategory;
  // Correctif — garde-fou multi-chambres (mission §3) : le backend refuse
  // déjà ces opérations, mais l'interface ne doit jamais laisser croire
  // qu'elles sont possibles pour ce type de réservation.
  const isMultiRoom = reservation.roomsCount !== undefined && reservation.roomsCount !== 1;

  const loadAssignment = useCallback(async () => {
    setLoadingAssignment(true);
    try {
      const data = await getReservationRoomAssignment(reservation._id);
      setAssignment(data);
    } catch (err) {
      // Silencieux : une 403/404 ponctuelle ne doit pas polluer l'écran de
      // liste, l'action reste tentable et remontera son propre message.
    } finally {
      setLoadingAssignment(false);
    }
  }, [reservation._id]);

  useEffect(() => { loadAssignment(); }, [loadAssignment]);
  const loadReadiness = useCallback(async () => { if (reservation.status !== 'checked_in') return; setLoadingReadiness(true); try { setFinancialReadiness(await getCheckoutFinancialReadiness(reservation._id)); } catch { setFinancialReadiness(null); } finally { setLoadingReadiness(false); } }, [reservation._id, reservation.status]);
  useEffect(() => { loadReadiness(); }, [loadReadiness]);

  const refresh = async () => {
    await loadAssignment();
    onChanged?.();
  };

  const loadRooms = async () => {
    if (!hotelId || !roomCategoryId) return;
    setLoadingRooms(true);
    try {
      const list = await getRooms(hotelId, { roomCategoryId, status: "available", active: true });
      setRooms(list || []);
    } catch (err) {
      toast.error("Erreur lors du chargement des chambres disponibles.");
    } finally {
      setLoadingRooms(false);
    }
  };

  const handleToggle = () => {
    if (isMultiRoom) {
      toast.error("Cette réservation comporte plusieurs chambres et nécessite une affectation multiple, non encore prise en charge.");
      return;
    }
    if (!open) loadRooms();
    setOpen((o) => !o);
  };

  const handleAssign = async () => {
    if (!selectedRoomId) { toast.error("Sélectionnez une chambre."); return; }
    try {
      await assignRoom({ reservationId: reservation._id, roomId: selectedRoomId });
      toast.success("Chambre affectée.");
      setOpen(false);
      await refresh();
    } catch (err) {
      toast.error(err.response?.data?.message || "Erreur lors de l'affectation.");
    }
  };

  const handleChange = async () => {
    if (!selectedRoomId) { toast.error("Sélectionnez une nouvelle chambre."); return; }
    try {
      await changeRoom({ reservationId: reservation._id, newRoomId: selectedRoomId });
      toast.success("Chambre changée.");
      setOpen(false);
      await refresh();
    } catch (err) {
      toast.error(err.response?.data?.message || "Erreur lors du changement de chambre.");
    }
  };

  const handleCheckIn = async () => {
    if (isMultiRoom) {
      toast.error("Cette réservation comporte plusieurs chambres et nécessite une affectation multiple, non encore prise en charge.");
      return;
    }
    try {
      await checkInHotelReservation(reservation._id, { roomId: selectedRoomId || undefined });
      toast.success("Check-in effectué.");
      await refresh();
    } catch (err) {
      toast.error(err.response?.data?.message || "Erreur lors du check-in.");
    }
  };

  const handleCheckOut = async () => {
    let financialOverride;
    if (financialReadiness?.status === 'blocked') {
      if (!isAdmin) return;
      if (!window.confirm("La situation financière bloque ce départ. Appliquer une dérogation administrative sans effacer la dette ?")) return;
      const overrideReason = window.prompt("Justification obligatoire de la dérogation financière :");
      if (!overrideReason?.trim()) { toast.error("Une justification est obligatoire."); return; }
      financialOverride = { requested: true, reason: overrideReason };
    } else if (!window.confirm("Confirmer le check-out de cette réservation ?")) return;
    try {
      const result = await checkOutHotelReservation(reservation._id, { financialOverride });
      toast.success(result.financialCheckout?.overrideApplied ? "Check-out effectué avec dérogation administrative." : "Check-out effectué.");
      await refresh();
    } catch (err) {
      if (err.response?.data?.code === 'CHECKOUT_BLOCKED_FINANCIAL') { setFinancialReadiness(err.response.data.financialReadiness); await loadReadiness(); }
      toast.error(err.response?.data?.message || "Erreur lors du check-out.");
    }
  };

  return (
    <div className="mt-2 border-t pt-2">
      {isMultiRoom && (
        <p className="text-xs text-amber-700 bg-amber-50 rounded px-2 py-1 mb-2">
          Réservation multi-chambres ({reservation.roomsCount} chambres) — affectation individuelle non prise en charge dans cette version.
        </p>
      )}
      <div className="flex flex-wrap items-center gap-2">
        {loadingAssignment ? (
          <span className="text-xs text-gray-400">Chargement de l'affectation...</span>
        ) : assignment ? (
          <span className="text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded font-medium">
            Chambre affectée : {assignment.room?.roomNumber}
          </span>
        ) : null}
        {reservation.status === "confirmed" && !isMultiRoom && (
          <>
            <button onClick={handleToggle} className="bg-gray-200 text-gray-800 px-3 py-1.5 rounded text-sm">
              {assignment ? "Changer chambre" : "Affecter chambre"}
            </button>
            <button onClick={handleCheckIn} className="bg-blue-600 text-white px-3 py-1.5 rounded text-sm">
              Check-in
            </button>
          </>
        )}
        {reservation.status === "checked_in" && (
          <button disabled={loadingReadiness || (financialReadiness?.status === 'blocked' && !isAdmin)} onClick={handleCheckOut} className="bg-gray-700 text-white px-3 py-1.5 rounded text-sm disabled:opacity-40">
            {financialReadiness?.status === 'blocked' && isAdmin ? 'Dérogation et check-out' : 'Check-out'}
          </button>
        )}
      </div>
      {reservation.status === 'checked_in' && <div className="mt-2 rounded bg-gray-50 p-2 text-xs" data-testid="checkout-financial-readiness">{loadingReadiness ? 'Évaluation financière...' : !financialReadiness ? 'État financier indisponible' : <><strong>{financialReadiness.status === 'ready' ? 'Prêt pour check-out' : financialReadiness.status === 'warning' ? 'Prêt avec avertissements' : 'Check-out bloqué'}</strong><div>Total : {Number(financialReadiness.financialSnapshot?.documentTotalMinor || 0).toLocaleString('fr-FR')} XAF · Alloué : {Number(financialReadiness.financialSnapshot?.allocatedMinor || 0).toLocaleString('fr-FR')} XAF · Solde : {Number(financialReadiness.financialSnapshot?.balanceMinor || 0).toLocaleString('fr-FR')} {financialReadiness.financialSnapshot?.currency || 'XAF'}</div>{financialReadiness.blockers?.map((item) => <p key={item.code} className="text-red-700">{item.code}</p>)}{financialReadiness.warnings?.map((item) => <p key={item.code} className="text-amber-700">{item.code}</p>)}</>}</div>}

      {open && (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <select aria-label="Choisir une chambre disponible" value={selectedRoomId} onChange={(e) => setSelectedRoomId(e.target.value)} className="p-2 border rounded text-sm">
            <option value="">{loadingRooms ? "Chargement..." : "Chambre disponible..."}</option>
            {rooms.map((r) => <option key={r._id} value={r._id}>{r.roomNumber}{r.roomCategory?.name ? ` — ${r.roomCategory.name}` : ""}</option>)}
          </select>
          <button onClick={assignment ? handleChange : handleAssign} className="bg-gold text-white px-3 py-1.5 rounded text-sm">
            Confirmer
          </button>
          <button onClick={() => setOpen(false)} className="text-gray-600 text-sm">Annuler</button>
        </div>
      )}
    </div>
  );
};

export default RoomAssignmentPanel;
