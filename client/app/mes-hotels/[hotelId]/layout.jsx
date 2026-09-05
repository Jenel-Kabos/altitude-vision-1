"use client";

// PHASE-HX1 §4-5 — coquille de l'Extranet Hôtel : rend le contexte (hôtel
// actif) visible sur toutes les sous-pages, jamais un second shell
// applicatif (OwnerDashboard, monté par mes-hotels/layout.jsx, reste le
// shell global).

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import HotelExtranetNav from "@/lib/components/dashboard/HotelExtranetNav";
import { getHotelDetail } from "@/lib/services/hotelService";

export default function HotelExtranetLayout({ children }) {
  const { hotelId } = useParams();
  const [hotel, setHotel] = useState(null);

  useEffect(() => {
    let cancelled = false;
    if (!hotelId) return undefined;
    getHotelDetail(hotelId).then((data) => { if (!cancelled) setHotel(data?.hotel || null); }).catch(() => {});
    return () => { cancelled = true; };
  }, [hotelId]);

  return (
    <div>
      <HotelExtranetNav hotelId={hotelId} hotel={hotel} />
      {children}
    </div>
  );
}
