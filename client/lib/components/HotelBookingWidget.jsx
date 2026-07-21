"use client";

// client/lib/components/HotelBookingWidget.jsx — Sprint C
// Widget de demande de réservation sur la fiche hôtel publique. Le prix
// affiché est une ESTIMATION (le backend recalcule systématiquement le
// tarif réel — voir hotelReservationService.computeReservationPricing).
// Le bouton ne dit jamais "Payer" : aucun paiement n'est géré dans ce sprint.

import React, { useState } from "react";
import { toast } from "react-hot-toast";
import { getHotelAvailability, createPublicHotelReservation } from "../services/hotelReservationService";
import { HOTEL_RATE_TYPES } from "../constants/hotel";
import { formatCurrencyXAF } from "../utils/normalizePropertyDetail";

const HotelBookingWidget = ({ hotelId, categories = [] }) => {
  const bookableCategories = categories.filter((c) => c.rates?.length > 0);

  const [categoryId, setCategoryId] = useState(bookableCategories[0]?._id || "");
  const [rateId, setRateId] = useState(bookableCategories[0]?.rates?.[0]?._id || "");
  const [checkInDate, setCheckInDate] = useState("");
  const [checkOutDate, setCheckOutDate] = useState("");
  const [roomsCount, setRoomsCount] = useState(1);
  const [adults, setAdults] = useState(2);
  const [children, setChildren] = useState(0);
  const [guest, setGuest] = useState({ firstName: "", lastName: "", email: "", phone: "", country: "" });
  const [specialRequests, setSpecialRequests] = useState("");

  const [checking, setChecking] = useState(false);
  const [availability, setAvailability] = useState(null); // { available, nights }
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(null); // reference

  const selectedCategory = bookableCategories.find((c) => c._id === categoryId);
  const selectedRate = selectedCategory?.rates?.find((r) => r._id === rateId);

  const nights = checkInDate && checkOutDate
    ? Math.round((new Date(checkOutDate) - new Date(checkInDate)) / 86400000)
    : 0;
  const estimatedTotal = selectedRate && nights > 0 ? selectedRate.amount * nights * Number(roomsCount || 1) : null;

  if (bookableCategories.length === 0) {
    return (
      <section className="mt-8 border rounded-lg p-4 bg-gray-50">
        <p className="text-sm text-gray-500">Aucune catégorie n'est disponible à la réservation pour le moment.</p>
      </section>
    );
  }

  const handleCategoryChange = (id) => {
    setCategoryId(id);
    const cat = bookableCategories.find((c) => c._id === id);
    setRateId(cat?.rates?.[0]?._id || "");
    setAvailability(null);
  };

  const handleCheckAvailability = async () => {
    if (!checkInDate || !checkOutDate) { toast.error("Sélectionnez les dates d'arrivée et de départ."); return; }
    if (nights < 1) { toast.error("La date de départ doit être postérieure à la date d'arrivée."); return; }
    setChecking(true);
    setAvailability(null);
    try {
      const result = await getHotelAvailability(hotelId, { roomCategoryId: categoryId, checkInDate, checkOutDate, roomsCount });
      setAvailability(result);
      if (!result.available) toast.error("Certaines dates ne sont plus disponibles pour cette catégorie.");
    } catch (err) {
      toast.error(err.response?.data?.message || "Erreur lors de la vérification.");
    } finally {
      setChecking(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!availability?.available) { toast.error("Vérifiez d'abord la disponibilité."); return; }
    if (!guest.firstName || !guest.lastName || !guest.email) { toast.error("Prénom, nom et email sont requis."); return; }
    setSubmitting(true);
    try {
      const reservation = await createPublicHotelReservation(hotelId, {
        roomCategoryId: categoryId, ratePlanId: rateId,
        checkInDate, checkOutDate, roomsCount: Number(roomsCount), adults: Number(adults), children: Number(children),
        guest, specialRequests,
      });
      setSubmitted(reservation.reference);
      toast.success("Votre demande a bien été envoyée !");
    } catch (err) {
      if (err.response?.status === 409) {
        toast.error("Certaines dates viennent d'être réservées par quelqu'un d'autre. Veuillez choisir d'autres dates.");
        setAvailability((prev) => (prev ? { ...prev, available: false } : prev));
      } else {
        toast.error(err.response?.data?.message || "Erreur lors de l'envoi de la demande.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <section className="mt-8 border rounded-lg p-6 bg-green-50 border-green-200">
        <h3 className="font-bold text-green-800">Demande envoyée — référence {submitted}</h3>
        <p className="text-sm text-green-700 mt-1">
          Votre demande attend la confirmation de l'établissement. Vous serez averti par notification/email dès sa validation.
        </p>
      </section>
    );
  }

  return (
    <section className="mt-8 border rounded-lg p-4 sm:p-6">
      <h2 className="text-xl font-bold mb-4" style={{ color: "#2E7BB5" }}>Vérifier la disponibilité</h2>
      <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="sm:col-span-2">
          <label className="block text-sm font-medium mb-1">Catégorie</label>
          <select value={categoryId} onChange={(e) => handleCategoryChange(e.target.value)} aria-label="Catégorie" className="w-full px-3 py-2 border rounded-md">
            {bookableCategories.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Tarif</label>
          <select value={rateId} onChange={(e) => setRateId(e.target.value)} aria-label="Tarif" className="w-full px-3 py-2 border rounded-md">
            {selectedCategory?.rates.map((r) => (
              <option key={r._id} value={r._id}>{HOTEL_RATE_TYPES.find((t) => t.value === r.rateType)?.label} — {formatCurrencyXAF(r.amount)}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Chambres</label>
          <input type="number" min="1" value={roomsCount} onChange={(e) => { setRoomsCount(e.target.value); setAvailability(null); }} aria-label="Nombre de chambres" className="w-full px-3 py-2 border rounded-md" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Arrivée</label>
          <input type="date" value={checkInDate} onChange={(e) => { setCheckInDate(e.target.value); setAvailability(null); }} aria-label="Date d'arrivée" className="w-full px-3 py-2 border rounded-md" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Départ</label>
          <input type="date" value={checkOutDate} onChange={(e) => { setCheckOutDate(e.target.value); setAvailability(null); }} aria-label="Date de départ" className="w-full px-3 py-2 border rounded-md" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Adultes</label>
          <input type="number" min="1" value={adults} onChange={(e) => setAdults(e.target.value)} aria-label="Adultes" className="w-full px-3 py-2 border rounded-md" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Enfants</label>
          <input type="number" min="0" value={children} onChange={(e) => setChildren(e.target.value)} aria-label="Enfants" className="w-full px-3 py-2 border rounded-md" />
        </div>

        <div className="sm:col-span-2">
          <button type="button" onClick={handleCheckAvailability} disabled={checking}
            className="bg-blue-600 text-white px-4 py-2 rounded-md font-medium disabled:opacity-50">
            {checking ? "Vérification..." : "Vérifier la disponibilité"}
          </button>
        </div>

        {availability && (
          <div className={`sm:col-span-2 rounded-md p-3 text-sm ${availability.available ? "bg-green-50 text-green-800" : "bg-red-50 text-red-700"}`}>
            {availability.available
              ? `Disponible pour ${nights} nuit(s).${estimatedTotal ? ` Prix estimé : ${formatCurrencyXAF(estimatedTotal)}.` : ""}`
              : "Certaines dates ne sont pas disponibles pour cette catégorie."}
          </div>
        )}

        {availability?.available && (
          <>
            <div className="sm:col-span-2 border-t pt-3 mt-1">
              <h3 className="font-semibold mb-2">Vos informations</h3>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Prénom *</label>
              <input value={guest.firstName} onChange={(e) => setGuest((g) => ({ ...g, firstName: e.target.value }))} aria-label="Prénom" className="w-full px-3 py-2 border rounded-md" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Nom *</label>
              <input value={guest.lastName} onChange={(e) => setGuest((g) => ({ ...g, lastName: e.target.value }))} aria-label="Nom" className="w-full px-3 py-2 border rounded-md" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Email *</label>
              <input type="email" value={guest.email} onChange={(e) => setGuest((g) => ({ ...g, email: e.target.value }))} aria-label="Email" className="w-full px-3 py-2 border rounded-md" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Téléphone</label>
              <input value={guest.phone} onChange={(e) => setGuest((g) => ({ ...g, phone: e.target.value }))} aria-label="Téléphone" className="w-full px-3 py-2 border rounded-md" />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium mb-1">Demandes particulières</label>
              <textarea value={specialRequests} onChange={(e) => setSpecialRequests(e.target.value)} rows={2} aria-label="Demandes particulières" className="w-full px-3 py-2 border rounded-md" />
            </div>
            <div className="sm:col-span-2">
              <button type="submit" disabled={submitting} className="bg-gold text-white px-5 py-2.5 rounded-md font-semibold disabled:opacity-50">
                {submitting ? "Envoi..." : "Demander la réservation"}
              </button>
              <p className="text-xs text-gray-500 mt-1">Votre demande sera examinée par l'établissement avant confirmation. Aucun paiement n'est requis à cette étape.</p>
            </div>
          </>
        )}
      </form>
    </section>
  );
};

export default HotelBookingWidget;
