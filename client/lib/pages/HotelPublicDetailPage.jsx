"use client";

// PHASE-HW1 — page publique "Détail hôtel" (parité avec mobile H1-H5).
// Réutilise EXACTEMENT le même backend que mobile : GET /hotels/public/:id
// (detail normalisé H1-H5), GET /hotels/public/:id/availability (H2 multi-
// catégories), GET /hotels/public/:id/reviews (H3), GET /hotels/public/:id/nearby
// (H4). Jamais une seconde projection ni un second moteur de prix/stock.

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { MapPin, Star, ChevronLeft, ChevronRight, X } from "lucide-react";
import { getPublicHotel } from "../services/hotelService";
import { searchHotelPublicAvailability, getHotelPublicReviews, getNearbyPublicHotels } from "../services/hotelReservationService";
import { HOTEL_SERVICES } from "../constants/hotel";
import { formatCurrencyXAF } from "../utils/normalizePropertyDetail";
import HotelBookingWidget from "../components/HotelBookingWidget";

const GOLD = "#C8960C";
const BLUE = "#2E7BB5";

const MEAL_PLAN_LABELS = {
  room_only: "Chambre seule", breakfast_included: "Petit-déjeuner inclus",
  half_board: "Demi-pension", full_board: "Pension complète",
};
const formatMealPlan = (mealPlan) => (mealPlan ? MEAL_PLAN_LABELS[mealPlan] || mealPlan : null);
// PHASE-H5 — jamais un libellé fabriqué à partir d'un champ absent (RatePlan
// antérieur à H5) : `null`/absent → aucun texte, jamais une valeur par défaut.
const formatCancellation = (cancellation) => {
  if (!cancellation) return null;
  if (cancellation.type === "non_refundable") return "Non remboursable";
  if (cancellation.deadlineAt) return `Annulation gratuite jusqu'au ${new Date(cancellation.deadlineAt).toLocaleDateString("fr-FR")}`;
  return "Conditions d'annulation communiquées par l'hôtel";
};
const POLICY_LABELS = {
  checkIn: "Arrivée", checkOut: "Départ", cancellation: "Annulation", pets: "Animaux", children: "Enfants",
  visitors: "Visiteurs", accessibility: "Accessibilité", smoking: "Fumeurs", minimumAge: "Âge minimum", paymentMethods: "Moyens de paiement",
};
const todayISO = () => new Date().toISOString().slice(0, 10);

const HotelGallery = ({ images, name }) => {
  const [index, setIndex] = useState(0);
  const [lightbox, setLightbox] = useState(false);
  if (!images.length) {
    return <div className="w-full h-72 rounded-lg bg-gray-100 flex items-center justify-center text-gray-400">Aucune photo disponible</div>;
  }
  const move = (delta) => setIndex((i) => (i + delta + images.length) % images.length);
  return (
    <div>
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
        <button type="button" onClick={() => { setIndex(0); setLightbox(true); }} className="sm:col-span-2 sm:row-span-2" aria-label={`Voir la photo 1 sur ${images.length}`}>
          <img src={images[0]} alt={name} className="w-full h-64 sm:h-full object-cover rounded-lg" />
        </button>
        {images.slice(1, 5).map((url, i) => (
          <button type="button" key={url + i} onClick={() => { setIndex(i + 1); setLightbox(true); }} aria-label={`Voir la photo ${i + 2} sur ${images.length}`}>
            <img src={url} alt={name} className="w-full h-32 sm:h-full object-cover rounded-lg" />
          </button>
        ))}
      </div>
      <p className="text-xs text-gray-500 mt-2">{images.length} photo(s)</p>
      {lightbox && (
        <div role="dialog" aria-modal="true" aria-label="Galerie photo" className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center">
          <button type="button" onClick={() => setLightbox(false)} aria-label="Fermer la galerie" className="absolute top-4 right-4 text-white"><X size={28} /></button>
          {images.length > 1 && <button type="button" onClick={() => move(-1)} aria-label="Photo précédente" className="absolute left-4 text-white"><ChevronLeft size={32} /></button>}
          <img src={images[index]} alt={name} className="max-h-[85vh] max-w-[90vw] object-contain" />
          {images.length > 1 && <button type="button" onClick={() => move(1)} aria-label="Photo suivante" className="absolute right-4 text-white"><ChevronRight size={32} /></button>}
        </div>
      )}
    </div>
  );
};

const HotelPublicDetailPage = () => {
  const params = useParams();
  const hotelId = params?.hotelId;
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const [search, setSearch] = useState({ checkIn: "", checkOut: "", adults: 2, children: 0, rooms: 1 });
  const [availability, setAvailability] = useState({ status: "idle", data: null }); // idle|loading|success|no_availability|error
  const [locked, setLocked] = useState(null);

  const [reviews, setReviews] = useState({ loading: true, items: [], pagination: null });
  const [nearby, setNearby] = useState({ loading: true, hotels: [] });

  const load = useCallback(async (id) => {
    setLoading(true);
    try {
      const result = await getPublicHotel(id);
      if (!result?.detail) { setNotFound(true); return; }
      setData(result);
    } catch {
      setNotFound(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { if (hotelId) load(hotelId); }, [hotelId, load]);

  const loadReviews = useCallback(async (id, page = 1) => {
    setReviews((prev) => ({ ...prev, loading: true }));
    try {
      const result = await getHotelPublicReviews(id, { page, limit: 5 });
      setReviews((prev) => ({ loading: false, items: page === 1 ? result.reviews : [...prev.items, ...result.reviews], pagination: result.pagination }));
    } catch {
      setReviews((prev) => ({ ...prev, loading: false }));
    }
  }, []);

  useEffect(() => { if (hotelId) loadReviews(hotelId, 1); }, [hotelId, loadReviews]);

  useEffect(() => {
    if (!hotelId) return;
    getNearbyPublicHotels(hotelId).then((hotels) => setNearby({ loading: false, hotels })).catch(() => setNearby({ loading: false, hotels: [] }));
  }, [hotelId]);

  const runSearch = useCallback(async () => {
    if (!search.checkIn || !search.checkOut) return;
    setAvailability({ status: "loading", data: null });
    setLocked(null);
    try {
      const result = await searchHotelPublicAvailability(hotelId, search);
      const hasRooms = (result.roomCategories || []).length > 0;
      setAvailability({ status: hasRooms ? "success" : "no_availability", data: result });
    } catch {
      setAvailability({ status: "error", data: null });
    }
  }, [hotelId, search]);

  useEffect(() => {
    if (!locked) return;
    const el = document.getElementById("hotel-booking-widget");
    if (typeof el?.scrollIntoView === "function") el.scrollIntoView({ behavior: "smooth" });
  }, [locked]);

  if (loading) return <p className="text-center py-20 text-gray-500">Chargement...</p>;
  if (notFound || !data?.detail) return <p className="text-center py-20 text-gray-500">Cet hôtel n'est pas disponible.</p>;

  const { detail } = data;
  const images = detail.gallery?.length ? detail.gallery.map((g) => g.url) : [];
  const activeHighlights = HOTEL_SERVICES.filter((s) => detail.amenities?.hotelServices?.[s.key]);
  const activePolicies = Object.entries(detail.policies || {}).filter(([, value]) => value != null);
  const coordinates = detail.location?.coordinates;
  const cheapestRate = (data.categories || [])
    .flatMap((c) => c.rates || [])
    .filter((r) => r.rateType === "public")
    .sort((a, b) => a.amount - b.amount)[0];

  const chooseOffer = (category, offer) => {
    setLocked({
      roomCategoryId: category.id, ratePlanId: offer.ratePlanId,
      checkInDate: search.checkIn, checkOutDate: search.checkOut,
      roomsCount: search.rooms, adults: search.adults, children: search.children,
      categoryName: category.name, rateLabel: offer.rateType, totalAmount: offer.totalAmount, nights: offer.nights,
      onClear: () => setLocked(null),
    });
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-10">
      <HotelGallery images={images} name={detail.name} />

      <h1 className="text-3xl font-bold mt-6" style={{ color: BLUE }}>{detail.name}</h1>
      <div className="flex flex-wrap items-center gap-3 mt-1">
        {detail.location && (detail.location.city || detail.location.district) && (
          <p className="text-gray-500 flex items-center gap-1">
            <MapPin size={15} /> {[detail.location.district, detail.location.city].filter(Boolean).join(", ")}
          </p>
        )}
        {detail.starRating != null && (
          <span className="flex items-center gap-0.5" style={{ color: GOLD }}>
            {Array.from({ length: detail.starRating }).map((_, i) => <Star key={i} size={14} fill={GOLD} stroke={GOLD} />)}
          </span>
        )}
        {detail.hotelType && <span className="text-xs px-2 py-1 rounded-full bg-gray-100 capitalize">{detail.hotelType}</span>}
        {/* PHASE-H3 — jamais une note fabriquée : le résumé n'apparaît que si reviewCount > 0. */}
        {detail.reviewSummary?.reviewCount > 0 && (
          <span className="text-sm font-semibold flex items-center gap-1"><Star size={14} fill={GOLD} stroke={GOLD} /> {detail.reviewSummary.averageRating} · {detail.reviewSummary.reviewCount} avis</span>
        )}
      </div>
      {cheapestRate && (
        <p className="mt-3 font-semibold" style={{ color: BLUE }}>À partir de {formatCurrencyXAF(cheapestRate.amount)} / nuit</p>
      )}

      {activeHighlights.length > 0 && (
        <section className="mt-8">
          <h2 className="text-xl font-bold mb-2" style={{ color: BLUE }}>Points forts</h2>
          <div className="flex flex-wrap gap-2">
            {activeHighlights.map((s) => <span key={s.key} className="text-sm px-3 py-1 rounded-full bg-gray-100">{s.label}</span>)}
          </div>
        </section>
      )}

      {/* PHASE-HW1 §9 — recherche multi-catégories en direct, même moteur H2/H4/H5 que mobile. */}
      <section className="mt-8 border rounded-lg p-4 sm:p-6">
        <h2 className="text-xl font-bold mb-4" style={{ color: BLUE }}>Vérifier la disponibilité</h2>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <div><label className="block text-sm font-medium mb-1">Arrivée</label><input type="date" min={todayISO()} value={search.checkIn} onChange={(e) => setSearch((s) => ({ ...s, checkIn: e.target.value }))} aria-label="Date d'arrivée" className="w-full px-3 py-2 border rounded-md" /></div>
          <div><label className="block text-sm font-medium mb-1">Départ</label><input type="date" min={search.checkIn || todayISO()} value={search.checkOut} onChange={(e) => setSearch((s) => ({ ...s, checkOut: e.target.value }))} aria-label="Date de départ" className="w-full px-3 py-2 border rounded-md" /></div>
          <div><label className="block text-sm font-medium mb-1">Adultes</label><input type="number" min="1" value={search.adults} onChange={(e) => setSearch((s) => ({ ...s, adults: Number(e.target.value) }))} aria-label="Adultes" className="w-full px-3 py-2 border rounded-md" /></div>
          <div><label className="block text-sm font-medium mb-1">Enfants</label><input type="number" min="0" value={search.children} onChange={(e) => setSearch((s) => ({ ...s, children: Number(e.target.value) }))} aria-label="Enfants" className="w-full px-3 py-2 border rounded-md" /></div>
          <div><label className="block text-sm font-medium mb-1">Chambres</label><input type="number" min="1" value={search.rooms} onChange={(e) => setSearch((s) => ({ ...s, rooms: Number(e.target.value) }))} aria-label="Nombre de chambres" className="w-full px-3 py-2 border rounded-md" /></div>
        </div>
        <button type="button" onClick={runSearch} disabled={!search.checkIn || !search.checkOut || availability.status === "loading"}
          className="mt-3 bg-blue-600 text-white px-4 py-2 rounded-md font-medium disabled:opacity-50">
          {availability.status === "loading" ? "Recherche..." : "Rechercher"}
        </button>
      </section>

      {/* PHASE-HW1 §10 — RoomCategory + offres RatePlan réelles (mealPlan/cancellation si connus). */}
      <section className="mt-8">
        <h2 className="text-xl font-bold mb-3" style={{ color: BLUE }}>Choisissez votre chambre</h2>
        {availability.status === "idle" && (
          (detail.roomCategories || []).length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {detail.roomCategories.map((cat) => (
                <div key={cat.id} className="border rounded-lg p-4">
                  <h3 className="font-semibold">{cat.name}</h3>
                  <p className="text-sm text-gray-500">{cat.capacity?.maxAdults || 0} adulte(s) · {cat.bedCount} lit(s){cat.size ? ` · ${cat.size} m²` : ""}</p>
                  {cat.rates?.length > 0 && <p className="text-sm font-semibold mt-2" style={{ color: BLUE }}>Dès {formatCurrencyXAF(Math.min(...cat.rates.map((r) => r.amount)))} / nuit</p>}
                </div>
              ))}
            </div>
          ) : <p className="text-sm text-gray-500">Aucune catégorie de chambre publiée pour le moment.</p>
        )}
        {availability.status === "error" && <p className="text-sm text-red-600">Impossible de vérifier la disponibilité. Vérifiez votre connexion.</p>}
        {availability.status === "no_availability" && <p className="text-sm text-gray-500">Aucune chambre disponible pour ces dates.</p>}
        {availability.status === "success" && (
          <div className="grid grid-cols-1 gap-4">
            {availability.data.roomCategories.map((cat) => (
              <div key={cat.id} className="border rounded-lg p-4">
                <h3 className="font-semibold">{cat.name}</h3>
                <p className="text-sm text-gray-500">{cat.capacity?.maxAdults || 0} adulte(s) · {cat.beds} lit(s){cat.size ? ` · ${cat.size} m²` : ""} · {cat.availableQuantity} chambre(s) disponible(s)</p>
                <div className="mt-3 divide-y">
                  {cat.offers.map((offer) => (
                    <div key={offer.ratePlanId} className="py-2 flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="font-semibold">{formatCurrencyXAF(offer.amount)} <span className="text-sm font-normal text-gray-500">/ nuit</span></p>
                        <p className="text-sm text-gray-500">Total {offer.nights} nuit(s) : {formatCurrencyXAF(offer.totalAmount)}</p>
                        {formatMealPlan(offer.mealPlan) && <p className="text-xs text-gray-500">{formatMealPlan(offer.mealPlan)}</p>}
                        {formatCancellation(offer.cancellation) && <p className="text-xs text-gray-500">{formatCancellation(offer.cancellation)}</p>}
                      </div>
                      <button type="button" onClick={() => chooseOffer(cat, offer)} className="bg-gold text-white px-4 py-2 rounded-md font-medium" style={{ background: GOLD }}>Choisir</button>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* PHASE-HW1 §11 — le widget n'apparaît qu'après le choix d'une offre
          réelle issue de la recherche en direct ci-dessus (jamais une
          seconde sélection catégorie/tarif concurrente sur la même page). */}
      {locked && <HotelBookingWidget hotelId={hotelId} categories={[]} lockedSelection={locked} />}

      {detail.description && (
        <section className="mt-8">
          <h2 className="text-xl font-bold mb-2" style={{ color: BLUE }}>Présentation</h2>
          <p className="text-gray-700 whitespace-pre-line">{detail.description}</p>
        </section>
      )}

      <section className="mt-8">
        <h2 className="text-xl font-bold mb-2" style={{ color: BLUE }}>Localisation</h2>
        <p className="text-gray-700">{[detail.location?.address, detail.location?.district, detail.location?.city].filter(Boolean).join(", ") || "Adresse non communiquée."}</p>
        {Array.isArray(coordinates) && coordinates.length === 2 && (
          <iframe
            title="Localisation de l'hôtel"
            className="w-full h-64 rounded-lg mt-3 border-0"
            src={`https://www.google.com/maps?q=${coordinates[1]},${coordinates[0]}&output=embed`}
            loading="lazy"
          />
        )}
      </section>

      {activePolicies.length > 0 && (
        <section className="mt-8">
          <h2 className="text-xl font-bold mb-2" style={{ color: BLUE }}>Informations pratiques</h2>
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
            {activePolicies.map(([key, value]) => (
              <div key={key} className="flex justify-between border-b py-1">
                <dt className="text-gray-500">{POLICY_LABELS[key] || key}</dt>
                <dd className="font-medium">{key === "deposit" ? `${Number(value.amount || 0).toLocaleString("fr-FR")} ${value.currency || "XAF"}` : String(value)}</dd>
              </div>
            ))}
          </dl>
        </section>
      )}

      {/* PHASE-H3 — avis vérifiés uniquement, jamais les commentaires génériques Property (mission §8/§13). */}
      <section className="mt-8">
        <h2 className="text-xl font-bold mb-2" style={{ color: BLUE }}>Avis clients</h2>
        {reviews.items.length === 0 && !reviews.loading && <p className="text-sm text-gray-500">Aucun avis pour le moment.</p>}
        <div className="space-y-3">
          {reviews.items.map((review) => (
            <div key={review.id} className="border rounded-lg p-3">
              <div className="flex items-center justify-between">
                <span className="font-semibold">{review.author}</span>
                {review.verifiedStay && <span className="text-xs font-semibold px-2 py-1 rounded bg-green-100 text-green-800">Séjour vérifié</span>}
              </div>
              <div className="flex items-center gap-0.5 mt-1">
                {Array.from({ length: review.overallRating }).map((_, i) => <Star key={i} size={13} fill={GOLD} stroke={GOLD} />)}
              </div>
              <p className="text-sm text-gray-700 mt-1">{review.comment}</p>
            </div>
          ))}
        </div>
        {reviews.pagination && reviews.pagination.page < reviews.pagination.pages && (
          <button type="button" onClick={() => loadReviews(hotelId, reviews.pagination.page + 1)} className="mt-3 text-sm text-blue-700 underline">Voir plus d'avis</button>
        )}
      </section>

      {detail.faq?.length > 0 && (
        <section className="mt-8">
          <h2 className="text-xl font-bold mb-2" style={{ color: BLUE }}>Questions fréquentes</h2>
          <div className="space-y-2">
            {detail.faq.map((entry) => (
              <details key={entry.id} className="border rounded-lg p-3">
                <summary className="font-medium cursor-pointer">{entry.question}</summary>
                <p className="text-sm text-gray-700 mt-2">{entry.answer}</p>
              </details>
            ))}
          </div>
        </section>
      )}

      {/* PHASE-H4 — hôtels à proximité, distance calculée côté serveur. */}
      {!nearby.loading && nearby.hotels.length > 0 && (
        <section className="mt-8">
          <h2 className="text-xl font-bold mb-3" style={{ color: BLUE }}>Hôtels à proximité</h2>
          <div className="flex gap-4 overflow-x-auto pb-2">
            {nearby.hotels.map((hotel) => (
              <Link key={hotel.hotelId} href={`/immobilier/hotels/${hotel.hotelId}`} className="flex-shrink-0 w-56 border rounded-lg overflow-hidden">
                {hotel.heroImage ? <img src={hotel.heroImage} alt={hotel.name} className="w-full h-32 object-cover" /> : <div className="w-full h-32 bg-gray-100" />}
                <div className="p-3">
                  <p className="font-semibold text-sm">{hotel.name}</p>
                  <p className="text-xs text-gray-500">{hotel.distanceMeters < 1000 ? `${Math.round(hotel.distanceMeters)} m` : `${(hotel.distanceMeters / 1000).toFixed(1)} km`}</p>
                  {hotel.startingPrice != null && <p className="text-xs font-semibold mt-1" style={{ color: BLUE }}>Dès {formatCurrencyXAF(hotel.startingPrice)}</p>}
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
};

export default HotelPublicDetailPage;
