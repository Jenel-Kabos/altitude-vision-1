"use client";

// Sprint B2 — page publique "Détail hôtel". Présentation, galerie, services,
// catégories, tarifs indicatifs, localisation, avis (placeholder). Aucune
// réservation — voir HOTEL_V2.md.

import React, { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { MapPin, Star, Wifi } from "lucide-react";
import { getPublicHotel } from "../services/hotelService";
import { HOTEL_SERVICES, HOTEL_RATE_TYPES } from "../constants/hotel";
import { formatCurrencyXAF } from "../utils/normalizePropertyDetail";
import HotelBookingWidget from "../components/HotelBookingWidget";

const GOLD = "#C8960C";
const BLUE = "#2E7BB5";

const HotelPublicDetailPage = () => {
  const params = useParams();
  const hotelId = params?.hotelId;
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!hotelId) return;
    setLoading(true);
    getPublicHotel(hotelId)
      .then(setData)
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [hotelId]);

  if (loading) return <p className="text-center py-20 text-gray-500">Chargement...</p>;
  if (notFound || !data?.hotel) return <p className="text-center py-20 text-gray-500">Cet hôtel n'est pas disponible.</p>;

  const { hotel, categories } = data;
  const images = hotel.gallery?.length ? hotel.gallery.map((g) => g.url) : (hotel.property?.images || []);

  return (
    <div className="max-w-5xl mx-auto px-4 py-10">
      <h1 className="text-3xl font-bold" style={{ color: BLUE }}>{hotel.name}</h1>
      <p className="text-gray-500 flex items-center gap-1 mt-1">
        <MapPin size={15} /> {[hotel.property?.address?.arrondissement, hotel.property?.address?.city].filter(Boolean).join(", ")}
      </p>
      {hotel.starRating && (
        <p className="mt-1 flex items-center gap-1" style={{ color: GOLD }}>
          {Array.from({ length: hotel.starRating }).map((_, i) => <Star key={i} size={16} fill={GOLD} stroke={GOLD} />)}
        </p>
      )}
      {hotel.minNightlyRate > 0 && (
        <p className="mt-3 font-semibold" style={{ color: BLUE }}>
          {hotel.minNightlyRate === hotel.maxNightlyRate
            ? `À partir de ${formatCurrencyXAF(hotel.minNightlyRate)} / nuit`
            : `${formatCurrencyXAF(hotel.minNightlyRate)} à ${formatCurrencyXAF(hotel.maxNightlyRate)} / nuit`}
        </p>
      )}

      {images.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-6">
          {images.slice(0, 8).map((url, i) => (
            <img key={i} src={url} alt={hotel.name} className="w-full h-32 object-cover rounded-lg" />
          ))}
        </div>
      )}

      <section className="mt-8">
        <h2 className="text-xl font-bold mb-2" style={{ color: BLUE }}>Présentation</h2>
        <p className="text-gray-700 whitespace-pre-line">{hotel.description}</p>
      </section>

      {hotel.hotelServices && Object.values(hotel.hotelServices).some(Boolean) && (
        <section className="mt-8">
          <h2 className="text-xl font-bold mb-2" style={{ color: BLUE }}>Services</h2>
          <div className="flex flex-wrap gap-2">
            {HOTEL_SERVICES.filter((s) => hotel.hotelServices[s.key]).map((s) => (
              <span key={s.key} className="text-sm px-3 py-1 rounded-full bg-gray-100 flex items-center gap-1">
                <Wifi size={13} /> {s.label}
              </span>
            ))}
          </div>
        </section>
      )}

      {categories?.length > 0 && (
        <section className="mt-8">
          <h2 className="text-xl font-bold mb-3" style={{ color: BLUE }}>Catégories de chambres</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {categories.map((cat) => (
              <div key={cat._id} className="border rounded-lg p-4">
                <h3 className="font-semibold">{cat.name}</h3>
                <p className="text-sm text-gray-500">{cat.unitsAvailable} unité(s) · {cat.capacity?.maxAdults || 0} adulte(s) · {cat.beds} lit(s){cat.surface ? ` · ${cat.surface} m²` : ''}</p>
                {cat.rates?.length > 0 && (
                  <ul className="mt-2 text-sm">
                    {cat.rates.map((r) => (
                      <li key={r._id}>{HOTEL_RATE_TYPES.find((t) => t.value === r.rateType)?.label} : {formatCurrencyXAF(r.amount)}</li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      <HotelBookingWidget hotelId={hotel._id || params?.hotelId} categories={categories || []} />

      <section className="mt-8">
        <h2 className="text-xl font-bold mb-2" style={{ color: BLUE }}>Localisation</h2>
        <p className="text-gray-700">{hotel.property?.address?.city}, {hotel.property?.address?.arrondissement}</p>
      </section>

      <section className="mt-8">
        <h2 className="text-xl font-bold mb-2" style={{ color: BLUE }}>Avis</h2>
        <p className="text-gray-500 text-sm">Les avis clients seront bientôt disponibles.</p>
      </section>
    </div>
  );
};

export default HotelPublicDetailPage;
