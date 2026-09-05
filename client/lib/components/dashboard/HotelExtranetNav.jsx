"use client";

// PHASE-HX1 §4-5 — point d'entrée/navigation cohérents de l'Extranet Hôtel :
// rend le contexte (hôtel actif) explicite et évite de re-choisir l'hôtel
// à chaque sous-page. Basé sur les routes existantes (Link/usePathname),
// jamais une seconde coquille applicative (l'OwnerDashboard existant reste
// le shell global — voir mes-hotels/layout.jsx).

import Link from "next/link";
import { usePathname } from "next/navigation";
import { HOTEL_PUBLICATION_STATUSES } from "../../constants/hotel";

const TABS = [
  { key: "", label: "Vue d'ensemble" },
  { key: "establishment", label: "Établissement" },
  { key: "room-categories", label: "Chambres" },
  { key: "rates", label: "Tarifs" },
  { key: "inventory", label: "Disponibilités" },
  { key: "reservations", label: "Réservations" },
  { key: "reviews", label: "Avis clients" },
  { key: "faq", label: "FAQ" },
];

const STATUS_CLASSES = {
  brouillon: "bg-gray-100 text-gray-700", soumis: "bg-yellow-100 text-yellow-800",
  publie: "bg-green-100 text-green-800", suspendu: "bg-orange-100 text-orange-800", rejete: "bg-red-100 text-red-700",
};

export default function HotelExtranetNav({ hotelId, hotel }) {
  const pathname = usePathname();
  const base = `/mes-hotels/${hotelId}`;
  const reservationsHref = `/mes-hotels/reservations?hotelId=${hotelId}`;

  return (
    <div className="mb-4">
      {hotel && (
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <h1 className="text-lg font-bold">{hotel.name}</h1>
          {hotel.publicationStatus && (
            <span className={`text-xs font-semibold px-2 py-1 rounded ${STATUS_CLASSES[hotel.publicationStatus] || "bg-gray-100"}`}>
              {HOTEL_PUBLICATION_STATUSES.find((s) => s.value === hotel.publicationStatus)?.label || hotel.publicationStatus}
            </span>
          )}
          {hotel.starRating != null && <span className="text-xs text-gray-500">{hotel.starRating} étoile(s)</span>}
          {hotel.property?.address?.city && <span className="text-xs text-gray-500">{hotel.property.address.city}</span>}
        </div>
      )}
      <nav aria-label="Navigation de l'établissement" className="flex flex-wrap gap-1 border-b">
        {TABS.map((tab) => {
          const href = tab.key === "reservations" ? reservationsHref : `${base}${tab.key ? `/${tab.key}` : ""}`;
          const isReservations = tab.key === "reservations";
          const active = isReservations ? pathname?.startsWith("/mes-hotels/reservations") : (tab.key === "" ? pathname === base : pathname?.startsWith(`${base}/${tab.key}`));
          return (
            <Link key={tab.key || "overview"} href={href} aria-current={active ? "page" : undefined}
              className={`px-3 py-2 text-sm font-medium border-b-2 -mb-px ${active ? "border-blue-700 text-blue-700" : "border-transparent text-gray-600 hover:text-gray-900"}`}>
              {tab.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
