"use client";

// PHASE-HX1 §7 — page "Mon établissement" de l'Extranet : réutilise
// EXACTEMENT HotelPropertyForm (jamais un second formulaire/modèle pour les
// mêmes champs) en mode édition.

import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { toast } from "react-hot-toast";
import HotelPropertyForm from "../../components/dashboard/HotelPropertyForm";
import { getHotelDetail } from "../../services/hotelService";
import { DashboardCard, DashboardPage, DashboardState } from "../../components/dashboard/DashboardUI";

const HotelEstablishmentPage = () => {
  const { hotelId } = useParams();
  const router = useRouter();
  const [hotel, setHotel] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    if (!hotelId) return;
    setLoading(true);
    try {
      const data = await getHotelDetail(hotelId);
      setHotel(data?.hotel || null);
    } catch (err) {
      toast.error("Erreur lors du chargement de l'établissement.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [hotelId]); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) return <DashboardState type="loading" title="Chargement…" />;
  if (!hotel) return <DashboardState title="Établissement introuvable" />;

  return (
    <DashboardPage>
      <DashboardCard>
        <HotelPropertyForm
          scope="owner"
          hotelId={hotel._id}
          accommodationType={hotel.accommodationType || "hotel"}
          initialProperty={hotel.property}
          initialHotel={hotel}
          existingImages={hotel.property?.images || hotel.gallery || []}
          onSuccess={() => { toast.success("Établissement mis à jour."); load(); }}
          onCancel={() => router.push(`/mes-hotels/${hotelId}`)}
        />
      </DashboardCard>
    </DashboardPage>
  );
};

export default HotelEstablishmentPage;
