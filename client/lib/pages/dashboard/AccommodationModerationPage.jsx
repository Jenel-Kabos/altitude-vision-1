"use client";

import React, { useEffect, useState } from "react";
import { CheckCircle2, XCircle, MapPin } from "lucide-react";
import toast from "@/lib/utils/toast";
import { getPendingAccommodations, reviewAccommodation } from "../../services/accommodationService";

const ACCOMMODATION_TYPE_LABELS = {
  villa_meublee: "Villa meublée",
  maison_meublee: "Maison meublée",
  appartement_meuble: "Appartement meublé",
  studio_meuble: "Studio meublé",
  residence_meublee: "Résidence meublée",
  bungalow: "Bungalow",
};

const AccommodationModerationPage = () => {
  const [accommodations, setAccommodations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [rejectingId, setRejectingId] = useState(null);
  const [rejectReason, setRejectReason] = useState("");

  const fetchAccommodations = async () => {
    setLoading(true);
    try {
      const list = await getPendingAccommodations();
      setAccommodations(list);
    } catch (err) {
      toast.error(err.response?.data?.message || "Impossible de charger les hébergements en attente.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAccommodations(); }, []);

  const handleValidate = async (id) => {
    try {
      await reviewAccommodation(id, "validate");
      setAccommodations((prev) => prev.filter((a) => a._id !== id));
      toast.success("Hébergement validé et publié.");
    } catch (err) {
      toast.error(err.response?.data?.message || "Une erreur est survenue.");
    }
  };

  const handleReject = async (id) => {
    if (!rejectReason.trim()) {
      toast.error("Un motif de rejet est requis.");
      return;
    }
    try {
      await reviewAccommodation(id, "reject", { reason: rejectReason.trim() });
      setAccommodations((prev) => prev.filter((a) => a._id !== id));
      setRejectingId(null);
      setRejectReason("");
      toast.success("Hébergement rejeté.");
    } catch (err) {
      toast.error(err.response?.data?.message || "Une erreur est survenue.");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto mb-4" />
          <p className="text-gray-600 text-lg">Chargement des hébergements en attente…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-1">Modération Hébergement</h1>
      <p className="text-sm text-gray-500 mb-6">
        {accommodations.length} hébergement{accommodations.length !== 1 ? "s" : ""} en attente de validation.
      </p>

      {accommodations.length === 0 ? (
        <p className="text-gray-500">Aucun hébergement en attente.</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {accommodations.map((acc) => (
            <div key={acc._id} className="border rounded-lg p-4 bg-white shadow-sm">
              <h3 className="font-semibold text-lg">{acc.property?.title || "Bien sans titre"}</h3>
              <p className="text-sm text-gray-500 flex items-center gap-1 mt-1">
                <MapPin size={13} /> {[acc.property?.address?.arrondissement, acc.property?.address?.city].filter(Boolean).join(", ") || "Adresse non renseignée"}
              </p>
              <p className="text-sm mt-2">Type : {ACCOMMODATION_TYPE_LABELS[acc.accommodationType] || acc.accommodationType}</p>
              <p className="text-sm">Capacité : {acc.capacity?.maxAdults || 0} adulte(s), {acc.capacity?.maxChildren || 0} enfant(s)</p>
              <p className="text-sm">Chambres : {acc.property?.bedrooms ?? '—'} · Salles de bain : {acc.property?.bathrooms ?? '—'}</p>
              <p className="text-sm">Arrivée / Départ : {acc.checkInTime} / {acc.checkOutTime}</p>

              {rejectingId === acc._id ? (
                <div className="mt-3 space-y-2">
                  <textarea
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    placeholder="Motif du rejet (obligatoire)"
                    className="w-full p-2 border rounded text-sm"
                    rows={2}
                  />
                  <div className="flex gap-2">
                    <button onClick={() => handleReject(acc._id)} className="bg-red-600 text-white px-3 py-1.5 rounded text-sm">
                      Confirmer le rejet
                    </button>
                    <button onClick={() => { setRejectingId(null); setRejectReason(""); }} className="text-gray-600 text-sm">
                      Annuler
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex gap-2 mt-3">
                  <button
                    onClick={() => handleValidate(acc._id)}
                    className="flex items-center gap-1.5 bg-green-600 text-white px-3 py-1.5 rounded text-sm"
                  >
                    <CheckCircle2 size={15} /> Valider
                  </button>
                  <button
                    onClick={() => setRejectingId(acc._id)}
                    className="flex items-center gap-1.5 bg-red-600 text-white px-3 py-1.5 rounded text-sm"
                  >
                    <XCircle size={15} /> Rejeter
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default AccommodationModerationPage;
