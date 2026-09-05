"use client";

// src/pages/dashboard/HotelModerationPage.jsx
// Sprint B2 — domaine Hôtellerie. Modération dédiée : affiche galerie,
// catégories, tarifs et services AVANT toute décision (même esprit que
// AccommodationModerationPage.jsx, Sprint B1).
//
// HOTFIX-MODERATION-HOTEL-UI-1 — alignement visuel avec
// PropertyModerationPage.jsx / AccommodationModerationPage.jsx : stats en
// cartes dégradées, filtre en pilules, grille de DashboardCard compactes +
// modal de détail pour l'action de modération (au lieu du formulaire de
// rejet inline dans chaque carte).

import React, { useCallback, useEffect, useState } from "react";
import {
  Filter, CheckCircle2, XCircle, Eye, MapPin, Tag, Star,
  BedDouble, Wallet, Sparkles, AlertTriangle, Building2,
} from "lucide-react";
import toast from "@/lib/utils/toast";
import { getPendingHotels, reviewHotel } from "../../services/hotelService";
import { HOTEL_SERVICES, HOTEL_RATE_TYPES } from "../../constants/hotel";
import { getPublicationErrorMessage } from "../../utils/publicationError";
import { DashboardCard, DashboardPage, DashboardPageHeader, DashboardState, DashboardToolbar } from "../../components/dashboard/DashboardUI";
import { usePlatformTenantRuntime } from "../../context/PlatformTenantRuntimeContext";

const FILTERS = [
  { key: "Tous", label: "Tous" },
  { key: "Complets", label: "Complets" },
  { key: "Incomplets", label: "Incomplets" },
  { key: "Modifications", label: "Modifs proposées" },
];

const starLabel = (n) => (n ? `${n} étoile${n > 1 ? "s" : ""}` : "Non classé");

const HotelModerationPage = () => {
  const [hotels, setHotels] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedFilter, setSelectedFilter] = useState("Tous");

  const [selectedHotel, setSelectedHotel] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [isRejecting, setIsRejecting] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [validatingId, setValidatingId] = useState(null);
  const [rejectingId, setRejectingId] = useState(null);
  const { selectedTenantId } = usePlatformTenantRuntime();

  const stats = {
    total: hotels.length,
    complets: hotels.filter((h) => h.completion?.complete).length,
    incomplets: hotels.filter((h) => h.completion && !h.completion.complete).length,
    modifs: hotels.filter((h) => h.proposedVersion?.status === "pending").length,
  };

  const fetchHotels = useCallback(async () => {
    setLoading(true);
    try {
      const list = await getPendingHotels({ platformScoped: !selectedTenantId });
      setHotels(list);
    } catch (err) {
      setError(err.response?.data?.message || "Impossible de charger les hôtels en attente.");
    } finally {
      setLoading(false);
    }
  }, [selectedTenantId]);

  useEffect(() => { fetchHotels(); }, [fetchHotels]);

  useEffect(() => {
    if (selectedFilter === "Complets") {
      setFiltered(hotels.filter((h) => h.completion?.complete));
    } else if (selectedFilter === "Incomplets") {
      setFiltered(hotels.filter((h) => h.completion && !h.completion.complete));
    } else if (selectedFilter === "Modifications") {
      setFiltered(hotels.filter((h) => h.proposedVersion?.status === "pending"));
    } else {
      setFiltered(hotels);
    }
  }, [selectedFilter, hotels]);

  useEffect(() => {
    if (selectedHotel) {
      const frame = requestAnimationFrame(() => setModalVisible(true));
      return () => cancelAnimationFrame(frame);
    }
    setModalVisible(false);
  }, [selectedHotel]);

  const closeModal = () => {
    setModalVisible(false);
    setIsRejecting(false);
    setRejectReason("");
    setTimeout(() => setSelectedHotel(null), 150);
  };

  const handleValidate = async (id) => {
    if (validatingId) return;
    setValidatingId(id);
    try {
      await reviewHotel(id, "validate");
      setHotels((prev) => prev.filter((h) => h._id !== id));
      toast.success("Hôtel validé et publié.");
      if (selectedHotel?._id === id) closeModal();
    } catch (err) {
      toast.error(getPublicationErrorMessage(err, "cet hôtel") || err.response?.data?.message || "Une erreur est survenue.");
    } finally {
      setValidatingId(null);
    }
  };

  const handleReject = async (id) => {
    if (!rejectReason.trim()) {
      toast.error("Un motif de rejet est requis.");
      return;
    }
    setRejectingId(id);
    try {
      await reviewHotel(id, "reject", { reason: rejectReason.trim() });
      setHotels((prev) => prev.filter((h) => h._id !== id));
      toast.success("Hôtel rejeté.");
      closeModal();
    } catch (err) {
      toast.error(err.response?.data?.message || "Une erreur est survenue.");
    } finally {
      setRejectingId(null);
    }
  };

  if (loading) return <DashboardState type="loading" title="Chargement des hôtels en attente…" />;
  if (error) return <DashboardState type="error" title="Hôtels indisponibles" description={error} />;
  if (hotels.length === 0) return <DashboardState title="Aucun hôtel en attente" description="Tous les hôtels ont été traités." />;

  return (
    <DashboardPage>
      <DashboardPageHeader
        icon={Building2}
        title="Modération Hôtellerie"
        description="Examinez et traitez les hôtels en attente de validation."
      />

      <div className="mb-6">
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {[
            { label: "Total", value: stats.total, from: "from-blue-500", to: "to-blue-600" },
            { label: "Complets", value: stats.complets, from: "from-green-500", to: "to-green-600" },
            { label: "Incomplets", value: stats.incomplets, from: "from-amber-500", to: "to-amber-600" },
            { label: "Modifs proposées", value: stats.modifs, from: "from-purple-500", to: "to-purple-600" },
          ].map(({ label, value, from, to }) => (
            <div key={label} className={`bg-gradient-to-br ${from} ${to} text-white p-4 rounded-lg shadow transition-transform duration-200 hover:-translate-y-0.5 hover:shadow-lg`}>
              <p className="text-sm opacity-90">{label}</p>
              <p className="text-3xl font-bold">{value}</p>
            </div>
          ))}
        </div>

        {/* Filtres */}
        <DashboardToolbar>
          <Filter className="text-gray-600" size={20} />
          <span className="text-gray-600 font-medium">Filtrer :</span>
          {FILTERS.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setSelectedFilter(key)}
              className={`px-4 py-2 rounded-lg font-medium transition-all duration-150 ${
                selectedFilter === key
                  ? "bg-blue-600 text-white shadow-lg"
                  : "bg-gray-200 text-gray-700 hover:bg-gray-300"
              }`}
            >
              {label}
              {key !== "Tous" && (
                <span className="ml-2 bg-white bg-opacity-30 px-2 py-0.5 rounded-full text-xs">
                  {key === "Complets" ? stats.complets : key === "Incomplets" ? stats.incomplets : stats.modifs}
                </span>
              )}
            </button>
          ))}
        </DashboardToolbar>
      </div>

      {/* Liste */}
      {filtered.length === 0 ? (
        <DashboardState title="Aucun hôtel" description={`Aucun hôtel ${selectedFilter !== "Tous" ? `« ${selectedFilter.toLowerCase()} » ` : ""}en attente.`} />
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((hotel) => {
            const cover = hotel.property?.images?.[0];
            const complete = hotel.completion?.complete;
            const hasProposedChanges = hotel.proposedVersion?.status === "pending";
            const totalRates = (hotel.categories || []).reduce((sum, c) => sum + (c.rates?.length || 0), 0);
            const maxRates = HOTEL_RATE_TYPES.length * (hotel.categories?.length || 0);
            return (
              <DashboardCard
                key={hotel._id}
                onClick={() => setSelectedHotel(hotel)}
                className="flex flex-col cursor-pointer group"
              >
                <div className="relative mb-3 h-48 overflow-hidden rounded">
                  {cover ? (
                    <img
                      src={cover}
                      alt={hotel.property?.title || hotel.name}
                      className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                  ) : (
                    <div className="w-full h-full bg-gray-100 flex items-center justify-center text-gray-400 text-sm">
                      Aucune image
                    </div>
                  )}
                  {hotel.completion && (
                    <span className={`absolute top-2 left-2 px-3 py-1 rounded-full text-xs font-bold text-white ${complete ? "bg-green-500" : "bg-amber-500"}`}>
                      Complétude {hotel.completion.score}%
                    </span>
                  )}
                  {hasProposedChanges && (
                    <span className="absolute top-2 right-2 flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold text-white bg-purple-500">
                      <AlertTriangle size={12} /> Modif. proposée
                    </span>
                  )}
                </div>

                <h2 className="text-lg font-semibold text-gray-800 mb-1">
                  {hotel.property?.title || hotel.name}
                </h2>
                {hotel.tenant?.name && (
                  <p className="text-xs font-medium text-gray-600 mb-2">Organisation : {hotel.tenant.name}</p>
                )}
                <p className="text-sm text-gray-500 flex items-center gap-1 mb-3">
                  <MapPin size={13} className="text-red-500 flex-shrink-0" />
                  {[hotel.property?.address?.arrondissement, hotel.property?.address?.city].filter(Boolean).join(", ") || "Adresse non renseignée"}
                </p>

                <div className="space-y-1 text-sm">
                  <p className="flex items-center text-gray-700">
                    <Star className="w-4 h-4 mr-2 text-blue-500" />
                    <strong>Catégorie :</strong><span className="ml-1">{starLabel(hotel.starRating)}</span>
                  </p>
                  <p className="flex items-center text-gray-700">
                    <BedDouble className="w-4 h-4 mr-2 text-blue-500" />
                    <span>{(hotel.categories || []).length} catégorie{(hotel.categories || []).length !== 1 ? "s" : ""} de chambres</span>
                  </p>
                  {hotel.categories?.length > 0 && (
                    <p className={`text-xs font-medium ${totalRates === 0 ? "text-amber-700" : "text-gray-500"}`}>
                      Tarifs actifs : {totalRates} / {maxRates} possibles
                    </p>
                  )}
                </div>

                <button className="mt-4 w-full flex items-center justify-center gap-2 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition">
                  <Eye size={18} /> Voir les détails
                </button>
              </DashboardCard>
            );
          })}
        </div>
      )}

      {/* ── Modal Détails ── */}
      {selectedHotel && (
        <div
          className={`fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 transition-opacity duration-150 ${modalVisible ? "opacity-100" : "opacity-0"}`}
          onClick={closeModal}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className={`bg-white rounded-xl w-full max-w-4xl p-6 relative max-h-[90vh] overflow-y-auto shadow-2xl transition-all duration-150 ${modalVisible ? "opacity-100 scale-100" : "opacity-0 scale-95"}`}
          >
            {/* Fermer */}
            <button
              onClick={closeModal}
              className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 text-gray-600 hover:text-red-600 transition text-xl font-bold"
            >
              &times;
            </button>

            {/* Badges */}
            <div className="flex flex-wrap gap-2 mb-4">
              {selectedHotel.completion && (
                <span className={`inline-block px-4 py-1.5 rounded-full text-sm font-bold text-white ${selectedHotel.completion.complete ? "bg-green-500" : "bg-amber-500"}`}>
                  Complétude {selectedHotel.completion.score}%
                </span>
              )}
              {selectedHotel.proposedVersion?.status === "pending" && (
                <span className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-sm font-bold text-white bg-purple-500">
                  <AlertTriangle size={14} /> Modification sensible proposée
                </span>
              )}
            </div>

            {/* Titre & adresse */}
            <h2 className="text-2xl font-bold mb-2 text-gray-900">
              {selectedHotel.property?.title || selectedHotel.name}
            </h2>
            <p className="mb-5 text-gray-700 flex items-center gap-2">
              <MapPin className="w-4 h-4 text-red-500 flex-shrink-0" />
              {[selectedHotel.property?.address?.street, selectedHotel.property?.address?.arrondissement, selectedHotel.property?.address?.city]
                .filter(Boolean).join(", ") || "Adresse non renseignée"}
            </p>
            {selectedHotel.tenant?.name && (
              <p className="mb-5 text-sm font-medium text-gray-700">Organisation : {selectedHotel.tenant.name}</p>
            )}

            {/* Images */}
            {selectedHotel.property?.images?.length > 0 && (
              <div className="mb-6">
                <h3 className="font-bold text-gray-900 text-lg mb-3">
                  Images ({selectedHotel.property.images.length})
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {selectedHotel.property.images.map((url, idx) => (
                    <div key={idx} className="relative h-36 overflow-hidden rounded-lg shadow">
                      <img
                        src={url}
                        alt={`${selectedHotel.property?.title || selectedHotel.name} ${idx + 1}`}
                        className="w-full h-full object-cover hover:scale-105 transition-transform duration-300"
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Détails */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              {/* Colonne gauche */}
              <div className="space-y-3">
                <DetailRow label="Catégorie" icon={Star} value={starLabel(selectedHotel.starRating)} />
                <div>
                  <span className="text-xs font-semibold uppercase tracking-wide text-gray-400 flex items-center gap-1">
                    <BedDouble className="w-3.5 h-3.5" /> Catégories de chambres ({(selectedHotel.categories || []).length})
                  </span>
                  <p className="text-gray-900 font-medium text-sm mt-0.5">
                    {(selectedHotel.categories || []).length > 0
                      ? selectedHotel.categories.map((c) => c.name).join(", ")
                      : <span className="text-gray-400 italic">Aucune</span>}
                  </p>
                </div>
                <div>
                  <span className="text-xs font-semibold uppercase tracking-wide text-gray-400 flex items-center gap-1">
                    <Wallet className="w-3.5 h-3.5" /> Tarifs actifs
                  </span>
                  {selectedHotel.categories?.length > 0 ? (() => {
                    const totalRates = selectedHotel.categories.reduce((sum, c) => sum + (c.rates?.length || 0), 0);
                    const maxRates = HOTEL_RATE_TYPES.length * selectedHotel.categories.length;
                    return (
                      <p className={`font-medium text-sm mt-0.5 ${totalRates === 0 ? "text-amber-700" : "text-gray-900"}`}>
                        {totalRates} / {maxRates} possibles
                      </p>
                    );
                  })() : (
                    <p className="text-gray-400 italic text-sm mt-0.5">Aucune catégorie renseignée</p>
                  )}
                </div>
              </div>

              {/* Colonne droite */}
              <div className="space-y-3">
                <div>
                  <span className="text-xs font-semibold uppercase tracking-wide text-gray-400 flex items-center gap-1">
                    <Sparkles className="w-3.5 h-3.5" /> Services
                  </span>
                  <p className="text-gray-900 font-medium text-sm mt-0.5">
                    {selectedHotel.hotelServices && Object.values(selectedHotel.hotelServices).some(Boolean)
                      ? HOTEL_SERVICES.filter((s) => selectedHotel.hotelServices[s.key]).map((s) => s.label).join(", ")
                      : <span className="text-gray-400 italic">Aucun</span>}
                  </p>
                </div>
              </div>
            </div>

            {/* Modification sensible proposée */}
            {selectedHotel.proposedVersion?.status === "pending" && (
              <div className="mb-6 p-4 rounded-xl bg-purple-50 border border-purple-100">
                <p className="flex items-center gap-2 font-semibold text-purple-900 text-sm mb-2">
                  <AlertTriangle size={16} /> Modification sensible proposée
                </p>
                <p className="text-purple-800 text-xs mb-3">
                  La version actuellement publiée reste exploitée jusqu'à la décision.
                </p>
                <dl className="space-y-1 text-sm">
                  {Object.entries(selectedHotel.proposedVersion.hotelChanges || {}).map(([field, value]) => (
                    <div key={`hotel-${field}`}>
                      <dt className="inline font-semibold text-purple-900">{field} :</dt>{" "}
                      <dd className="inline text-purple-800">{typeof value === "object" ? JSON.stringify(value) : String(value)}</dd>
                    </div>
                  ))}
                  {Object.entries(selectedHotel.proposedVersion.propertyChanges || {}).map(([field, value]) => (
                    <div key={`property-${field}`}>
                      <dt className="inline font-semibold text-purple-900">{field} :</dt>{" "}
                      <dd className="inline text-purple-800">{typeof value === "object" ? JSON.stringify(value) : String(value)}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            )}

            {/* Rejet — motif obligatoire */}
            {isRejecting && (
              <div className="mb-4 p-4 rounded-xl bg-red-50 border border-red-100">
                <label className="text-xs font-semibold uppercase tracking-wide text-red-700 mb-2 block">
                  Motif du rejet (obligatoire)
                </label>
                <textarea
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder="Expliquez pourquoi cet hôtel est rejeté…"
                  className="w-full p-2 border border-red-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-300"
                  rows={3}
                  autoFocus
                />
              </div>
            )}

            {/* Actions */}
            <div className="flex justify-end gap-3 flex-wrap border-t border-gray-100 pt-5">
              {isRejecting ? (
                <>
                  <button
                    onClick={() => handleReject(selectedHotel._id)}
                    disabled={Boolean(rejectingId)}
                    className="flex items-center gap-2 bg-red-500 hover:bg-red-600 disabled:opacity-60 text-white px-6 py-2.5 rounded-lg transition font-semibold shadow"
                  >
                    <XCircle size={18} /> {rejectingId ? "Rejet…" : "Confirmer le rejet"}
                  </button>
                  <button
                    onClick={() => { setIsRejecting(false); setRejectReason(""); }}
                    className="bg-gray-100 hover:bg-gray-200 text-gray-800 px-6 py-2.5 rounded-lg transition font-semibold"
                  >
                    Annuler
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={() => handleValidate(selectedHotel._id)}
                    disabled={Boolean(validatingId)}
                    className="flex items-center gap-2 bg-green-500 hover:bg-green-600 disabled:opacity-60 text-white px-6 py-2.5 rounded-lg transition font-semibold shadow"
                  >
                    <CheckCircle2 size={18} /> {validatingId === selectedHotel._id ? "Publication…" : "Valider"}
                  </button>
                  <button
                    onClick={() => setIsRejecting(true)}
                    className="flex items-center gap-2 bg-red-500 hover:bg-red-600 text-white px-6 py-2.5 rounded-lg transition font-semibold shadow"
                  >
                    <XCircle size={18} /> Rejeter
                  </button>
                  <button
                    onClick={closeModal}
                    className="bg-gray-100 hover:bg-gray-200 text-gray-800 px-6 py-2.5 rounded-lg transition font-semibold"
                  >
                    Fermer
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </DashboardPage>
  );
};

// ── Composant utilitaire pour une ligne de détail ────────────
const DetailRow = ({ label, value, icon: Icon }) => (
  <div>
    <span className="text-xs font-semibold uppercase tracking-wide text-gray-400 flex items-center gap-1">
      {Icon && <Icon className="w-3.5 h-3.5" />} {label}
    </span>
    <p className="text-gray-900 font-semibold text-sm mt-0.5">{value}</p>
  </div>
);

export default HotelModerationPage;
