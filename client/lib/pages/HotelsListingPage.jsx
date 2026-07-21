"use client";

// Sprint B2 — page publique "Séjourner → Hôtels → Liste des hôtels".
// Réutilise le style GOLD/BLUE de SejournerLandingPage.jsx (Sprint 0).

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { MapPin, Star } from "lucide-react";
import { getPublicHotels } from "../services/hotelService";
import { VILLES } from "../constants/locations";
import { formatCurrencyXAF } from "../utils/normalizePropertyDetail";

const GOLD = "#C8960C";
const BLUE = "#2E7BB5";

const HotelsListingPage = () => {
  const [ville, setVille] = useState("");
  const [hotels, setHotels] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    getPublicHotels({ ville: ville || undefined })
      .then((res) => setHotels(res.hotels || []))
      .finally(() => setLoading(false));
  }, [ville]);

  return (
    <div className="max-w-6xl mx-auto px-4 py-10">
      <h1 className="text-3xl font-bold mb-2" style={{ color: BLUE }}>Nos hôtels</h1>
      <p className="text-gray-500 mb-6">Découvrez les établissements hôteliers disponibles sur Altimmo.</p>

      <div className="mb-6">
        <select value={ville} onChange={(e) => setVille(e.target.value)} aria-label="Filtrer par ville" className="px-3 py-2 border rounded-md text-sm">
          <option value="">Toutes les villes</option>
          {VILLES.map((v) => <option key={v} value={v}>{v}</option>)}
        </select>
      </div>

      {loading ? (
        <p className="text-center text-gray-500 py-10">Chargement...</p>
      ) : hotels.length === 0 ? (
        <p className="text-center text-gray-500 py-10">Aucun hôtel disponible pour le moment.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {hotels.map((hotel) => (
            <Link key={hotel._id} href={`/immobilier/hotels/${hotel._id}`} className="block border rounded-xl overflow-hidden hover:shadow-lg transition-shadow">
              {hotel.property?.images?.[0] && (
                <img src={hotel.property.images[0]} alt={hotel.name} className="w-full h-40 object-cover" />
              )}
              <div className="p-4">
                <h3 className="font-bold" style={{ color: BLUE }}>{hotel.name}</h3>
                <p className="text-sm text-gray-500 flex items-center gap-1 mt-1">
                  <MapPin size={13} /> {hotel.property?.address?.city}
                </p>
                {hotel.starRating && (
                  <p className="text-sm mt-1 flex items-center gap-1" style={{ color: GOLD }}>
                    {Array.from({ length: hotel.starRating }).map((_, i) => <Star key={i} size={13} fill={GOLD} stroke={GOLD} />)}
                  </p>
                )}
                {hotel.property?.price && <p className="text-sm text-gray-700 mt-1">À partir de {formatCurrencyXAF(hotel.property.price)}</p>}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
};

export default HotelsListingPage;
