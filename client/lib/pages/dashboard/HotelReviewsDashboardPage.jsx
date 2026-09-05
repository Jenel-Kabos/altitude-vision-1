"use client";

// PHASE-HX1 §24 — tableau de bord professionnel des avis, LECTURE SEULE.
// Réutilise exactement l'endpoint PUBLIC H3 (même projection sûre : aucun
// email/téléphone/ID de réservation/utilisateur — mission "Do not weaken
// public privacy projection"). Aucune réponse/modération : REVIEW_RESPONSE
// n'existe pas dans le domaine HotelReview (voir HotelReview.js), jamais
// ajoutée ici opportunément.

import React, { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { toast } from "react-hot-toast";
import { getHotelReviewsForOwner } from "../../services/hotelService";
import { Star } from "lucide-react";
import { DashboardCard, DashboardPage, DashboardPageHeader, DashboardState, DashboardPagination } from "../../components/dashboard/DashboardUI";

const HotelReviewsDashboardPage = () => {
  const { hotelId } = useParams();
  const [summary, setSummary] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });
  const [loading, setLoading] = useState(true);

  const load = async (page = 1) => {
    if (!hotelId) return;
    setLoading(true);
    try {
      const data = await getHotelReviewsForOwner(hotelId, { page, limit: 10 });
      setSummary(data.summary);
      setReviews(data.reviews || []);
      setPagination(data.pagination || { page: 1, pages: 1, total: 0 });
    } catch (err) {
      toast.error("Erreur lors du chargement des avis.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(1); }, [hotelId]); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) return <DashboardState type="loading" title="Chargement des avis…" />;

  return (
    <DashboardPage>
      <DashboardPageHeader icon={Star} title="Avis clients" description="Avis vérifiés (séjour réellement effectué) — lecture seule." />

      <DashboardCard className="mb-4">
        {summary?.reviewCount ? (
          <div className="flex items-center gap-4">
            <div className="text-3xl font-bold">{summary.averageRating}<span className="text-sm text-gray-500">/5</span></div>
            <div className="text-sm text-gray-600">{summary.reviewCount} avis vérifié{summary.reviewCount > 1 ? "s" : ""}</div>
          </div>
        ) : (
          <p className="text-sm text-gray-500">Aucun avis pour le moment.</p>
        )}
        {summary?.categories && (
          <div className="mt-2 flex flex-wrap gap-4 text-xs text-gray-600">
            {Object.entries(summary.categories).filter(([, value]) => value != null).map(([key, value]) => (
              <span key={key}>{key} : {value}/5</span>
            ))}
          </div>
        )}
      </DashboardCard>

      {reviews.length === 0 ? (
        <DashboardState title="Aucun avis publié" description="Les avis apparaîtront ici une fois publiés par des clients ayant réellement séjourné." />
      ) : (
        <div className="space-y-3">
          {reviews.map((review) => (
            <DashboardCard key={review.id}>
              <div className="flex items-center justify-between flex-wrap gap-2">
                <span className="font-semibold">{review.author}</span>
                <div className="flex items-center gap-2">
                  {review.verifiedStay && <span className="text-xs font-semibold px-2 py-1 rounded bg-green-100 text-green-800">Séjour vérifié</span>}
                  <span className="text-xs text-gray-500">{new Date(review.createdAt).toLocaleDateString("fr-FR")}</span>
                </div>
              </div>
              <div className="mt-1 flex items-center gap-0.5" aria-label={`${review.overallRating} sur 5`}>
                {Array.from({ length: 5 }, (_, i) => (
                  <Star key={i} size={14} className={i < review.overallRating ? "fill-amber-400 text-amber-400" : "text-gray-300"} />
                ))}
              </div>
              <p className="text-sm text-gray-700 mt-2">{review.comment}</p>
            </DashboardCard>
          ))}
        </div>
      )}

      {pagination.pages > 1 && (
        <DashboardPagination page={pagination.page} totalPages={pagination.pages}
          onPrevious={() => load(pagination.page - 1)} onNext={() => load(pagination.page + 1)} />
      )}
    </DashboardPage>
  );
};

export default HotelReviewsDashboardPage;
