"use client";

// Sprint B2 — domaine Hôtellerie. Modération dédiée : affiche galerie,
// catégories, tarifs et services AVANT toute décision (même esprit que
// AccommodationModerationPage.jsx, Sprint B1).

import React, { useEffect, useState } from "react";
import { CheckCircle2, XCircle, MapPin } from "lucide-react";
import toast from "@/lib/utils/toast";
import { getPendingHotels, reviewHotel } from "../../services/hotelService";
import { HOTEL_SERVICES, HOTEL_RATE_TYPES } from "../../constants/hotel";
import { getPublicationErrorMessage } from "../../utils/publicationError";

const HotelModerationPage = () => {
  const [hotels, setHotels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [rejectingId, setRejectingId] = useState(null);
  const [rejectReason, setRejectReason] = useState("");
  const [validatingId, setValidatingId] = useState(null);

  const fetchHotels = async () => {
    setLoading(true);
    try {
      const list = await getPendingHotels();
      setHotels(list);
    } catch (err) {
      toast.error(err.response?.data?.message || "Impossible de charger les hôtels en attente.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchHotels(); }, []);

  const handleValidate = async (id) => {
    if (validatingId) return;
    setValidatingId(id);
    try {
      await reviewHotel(id, "validate");
      setHotels((prev) => prev.filter((h) => h._id !== id));
      toast.success("Hôtel validé et publié.");
    } catch (err) {
      toast.error(getPublicationErrorMessage(err, "cet hôtel") || err.response?.data?.message || "Une erreur est survenue.");
    } finally {
      setValidatingId(null);
    }
  };

  const handleReject = async (id) => {
    if (!rejectReason.trim()) { toast.error("Un motif de rejet est requis."); return; }
    try {
      await reviewHotel(id, "reject", { reason: rejectReason.trim() });
      setHotels((prev) => prev.filter((h) => h._id !== id));
      setRejectingId(null);
      setRejectReason("");
      toast.success("Hôtel rejeté.");
    } catch (err) {
      toast.error(err.response?.data?.message || "Une erreur est survenue.");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto mb-4" />
          <p className="text-gray-600 text-lg">Chargement des hôtels en attente…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-1">Modération Hôtellerie</h1>
      <p className="text-sm text-gray-500 mb-6">{hotels.length} hôtel{hotels.length !== 1 ? "s" : ""} en attente de validation.</p>

      {hotels.length === 0 ? (
        <p className="text-gray-500">Aucun hôtel en attente.</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {hotels.map((hotel) => (
            <div key={hotel._id} className="border rounded-lg p-4 bg-white shadow-sm">
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-semibold text-lg">{hotel.property?.title || hotel.name}</h3>
                {hotel.completion && (
                  <span className={`shrink-0 text-xs font-semibold px-2 py-1 rounded ${hotel.completion.complete ? "bg-green-100 text-green-800" : "bg-amber-100 text-amber-800"}`}>
                    Complétude {hotel.completion.score}%
                  </span>
                )}
              </div>
              <p className="text-sm text-gray-500 flex items-center gap-1 mt-1">
                <MapPin size={13} /> {[hotel.property?.address?.arrondissement, hotel.property?.address?.city].filter(Boolean).join(", ") || "Adresse non renseignée"}
              </p>

              {hotel.property?.images?.length > 0 && (
                <div className="flex gap-1.5 mt-2 overflow-x-auto">
                  {hotel.property.images.slice(0, 5).map((url, i) => (
                    <img key={i} src={url} alt="" className="w-16 h-16 object-cover rounded shrink-0" />
                  ))}
                </div>
              )}

              <p className="text-sm mt-2">Catégorie : {hotel.starRating ? `${hotel.starRating} étoile(s)` : 'Non classé'}</p>

              <p className="text-sm mt-1">
                Catégories de chambres ({(hotel.categories || []).length}) : {(hotel.categories || []).map((c) => c.name).join(", ") || "aucune"}
              </p>

              {hotel.categories?.length > 0 && (
                <p className="text-sm">
                  Tarifs actifs : {hotel.categories.reduce((sum, c) => sum + (c.rates?.length || 0), 0)} / {HOTEL_RATE_TYPES.length * hotel.categories.length} possibles
                </p>
              )}

              {hotel.hotelServices && Object.values(hotel.hotelServices).some(Boolean) && (
                <p className="text-sm">
                  Services : {HOTEL_SERVICES.filter((s) => hotel.hotelServices[s.key]).map((s) => s.label).join(", ")}
                </p>
              )}

              {rejectingId === hotel._id ? (
                <div className="mt-3 space-y-2">
                  <textarea value={rejectReason} onChange={(e) => setRejectReason(e.target.value)}
                    placeholder="Motif du rejet (obligatoire)" className="w-full p-2 border rounded text-sm" rows={2} />
                  <div className="flex gap-2">
                    <button onClick={() => handleReject(hotel._id)} className="bg-red-600 text-white px-3 py-1.5 rounded text-sm">Confirmer le rejet</button>
                    <button onClick={() => { setRejectingId(null); setRejectReason(""); }} className="text-gray-600 text-sm">Annuler</button>
                  </div>
                </div>
              ) : (
                <div className="flex gap-2 mt-3">
                  <button onClick={() => handleValidate(hotel._id)} disabled={Boolean(validatingId)} className="flex items-center gap-1.5 bg-green-600 text-white px-3 py-1.5 rounded text-sm disabled:opacity-50">
                    <CheckCircle2 size={15} /> {validatingId === hotel._id ? "Publication…" : "Valider"}
                  </button>
                  <button onClick={() => setRejectingId(hotel._id)} className="flex items-center gap-1.5 bg-red-600 text-white px-3 py-1.5 rounded text-sm">
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

export default HotelModerationPage;
