"use client";

// src/pages/dashboard/AccommodationModerationPage.jsx
import React, { useEffect, useState } from "react";
import {
  Filter, CheckCircle2, XCircle, Eye, MapPin, Tag, Users,
  BedDouble, Bath, Clock, Wallet, Sparkles, ConciergeBell,
} from "lucide-react";
import toast from "@/lib/utils/toast";
import { getPendingAccommodations, reviewAccommodation } from "../../services/accommodationService";
import { ACCOMMODATION_TYPES, INCLUDED_SERVICES } from "../../constants/accommodation";
import { getPublicationErrorMessage } from "../../utils/publicationError";
import { DashboardCard, DashboardPage, DashboardPageHeader, DashboardState, DashboardToolbar } from "../../components/dashboard/DashboardUI";

// Sprint B1 — réutilise la liste de référence partagée (constants/accommodation.js)
// au lieu d'un mapping local dupliqué et incomplet (l'ancien ne couvrait ni
// hotel/residence_hoteliere/chambre_hotes/autre, ni les valeurs legacy).
const typeLabel = (value) => ACCOMMODATION_TYPES.find((t) => t.value === value)?.label || value;

// HOTFIX-MODERATION-ACCOMMODATION-UI-1 — alignement visuel avec
// PropertyModerationPage.jsx : stats en cartes dégradées, filtre en pilules,
// grille de DashboardCard compactes + modal de détail pour l'action de
// modération (au lieu du formulaire de rejet inline dans chaque carte).
const FILTERS = [
  { key: "Tous", label: "Tous" },
  { key: "Complets", label: "Complets" },
  { key: "Incomplets", label: "Incomplets" },
];

const AccommodationModerationPage = () => {
  const [accommodations, setAccommodations] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedFilter, setSelectedFilter] = useState("Tous");

  const [selectedAccommodation, setSelectedAccommodation] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [isRejecting, setIsRejecting] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [validatingId, setValidatingId] = useState(null);
  const [rejectingId, setRejectingId] = useState(null);

  const stats = {
    total: accommodations.length,
    complets: accommodations.filter((a) => a.completion?.complete).length,
    incomplets: accommodations.filter((a) => a.completion && !a.completion.complete).length,
    sansTarif: accommodations.filter((a) => !a.rates?.length).length,
  };

  const fetchAccommodations = async () => {
    setLoading(true);
    try {
      const list = await getPendingAccommodations();
      setAccommodations(list);
    } catch (err) {
      setError(err.response?.data?.message || "Impossible de charger les hébergements en attente.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAccommodations(); }, []);

  useEffect(() => {
    if (selectedFilter === "Complets") {
      setFiltered(accommodations.filter((a) => a.completion?.complete));
    } else if (selectedFilter === "Incomplets") {
      setFiltered(accommodations.filter((a) => a.completion && !a.completion.complete));
    } else {
      setFiltered(accommodations);
    }
  }, [selectedFilter, accommodations]);

  useEffect(() => {
    if (selectedAccommodation) {
      const frame = requestAnimationFrame(() => setModalVisible(true));
      return () => cancelAnimationFrame(frame);
    }
    setModalVisible(false);
  }, [selectedAccommodation]);

  const closeModal = () => {
    setModalVisible(false);
    setIsRejecting(false);
    setRejectReason("");
    setTimeout(() => setSelectedAccommodation(null), 150);
  };

  const handleValidate = async (id) => {
    if (validatingId) return;
    setValidatingId(id);
    try {
      await reviewAccommodation(id, "validate");
      setAccommodations((prev) => prev.filter((a) => a._id !== id));
      toast.success("Hébergement validé et publié.");
      if (selectedAccommodation?._id === id) closeModal();
    } catch (err) {
      toast.error(getPublicationErrorMessage(err, "cet hébergement") || err.response?.data?.message || "Une erreur est survenue.");
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
      await reviewAccommodation(id, "reject", { reason: rejectReason.trim() });
      setAccommodations((prev) => prev.filter((a) => a._id !== id));
      toast.success("Hébergement rejeté.");
      closeModal();
    } catch (err) {
      toast.error(err.response?.data?.message || "Une erreur est survenue.");
    } finally {
      setRejectingId(null);
    }
  };

  if (loading) return <DashboardState type="loading" title="Chargement des hébergements en attente…" />;
  if (error) return <DashboardState type="error" title="Hébergements indisponibles" description={error} />;
  if (accommodations.length === 0) return <DashboardState title="Aucun hébergement en attente" description="Tous les hébergements ont été traités." />;

  return (
    <DashboardPage>
      <DashboardPageHeader
        icon={ConciergeBell}
        title="Modération des hébergements"
        description="Examinez et traitez les hébergements en attente de validation."
      />

      <div className="mb-6">
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {[
            { label: "Total", value: stats.total, from: "from-blue-500", to: "to-blue-600" },
            { label: "Complets", value: stats.complets, from: "from-green-500", to: "to-green-600" },
            { label: "Incomplets", value: stats.incomplets, from: "from-amber-500", to: "to-amber-600" },
            { label: "Sans tarif", value: stats.sansTarif, from: "from-red-500", to: "to-red-600" },
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
                  {key === "Complets" ? stats.complets : stats.incomplets}
                </span>
              )}
            </button>
          ))}
        </DashboardToolbar>
      </div>

      {/* Liste */}
      {filtered.length === 0 ? (
        <DashboardState title="Aucun hébergement" description={`Aucun hébergement ${selectedFilter !== "Tous" ? `« ${selectedFilter.toLowerCase()} » ` : ""}en attente.`} />
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((acc) => {
            const cover = acc.property?.images?.[0];
            const complete = acc.completion?.complete;
            return (
              <DashboardCard
                key={acc._id}
                onClick={() => setSelectedAccommodation(acc)}
                className="flex flex-col cursor-pointer group"
              >
                <div className="relative mb-3 h-48 overflow-hidden rounded">
                  {cover ? (
                    <img
                      src={cover}
                      alt={acc.property?.title || "Hébergement"}
                      className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                  ) : (
                    <div className="w-full h-full bg-gray-100 flex items-center justify-center text-gray-400 text-sm">
                      Aucune image
                    </div>
                  )}
                  {acc.completion && (
                    <span className={`absolute top-2 left-2 px-3 py-1 rounded-full text-xs font-bold text-white ${complete ? "bg-green-500" : "bg-amber-500"}`}>
                      Complétude {acc.completion.score}%
                    </span>
                  )}
                </div>

                <h2 className="text-lg font-semibold text-gray-800 mb-1">
                  {acc.property?.title || "Bien sans titre"}
                </h2>
                <p className="text-sm text-gray-500 flex items-center gap-1 mb-3">
                  <MapPin size={13} className="text-red-500 flex-shrink-0" />
                  {[acc.property?.address?.arrondissement, acc.property?.address?.city].filter(Boolean).join(", ") || "Adresse non renseignée"}
                </p>

                <div className="space-y-1 text-sm">
                  <p className="flex items-center text-gray-700">
                    <Tag className="w-4 h-4 mr-2 text-blue-500" />
                    <strong>Type :</strong><span className="ml-1">{typeLabel(acc.accommodationType)}</span>
                  </p>
                  <p className="flex items-center text-gray-700">
                    <Users className="w-4 h-4 mr-2 text-blue-500" />
                    <span>{acc.capacity?.maxAdults || 0} adulte(s), {acc.capacity?.maxChildren || 0} enfant(s)</span>
                  </p>
                  {!acc.rates?.length && (
                    <p className="text-amber-700 text-xs font-medium">Aucun tarif actif renseigné</p>
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
      {selectedAccommodation && (
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

            {/* Badge complétude */}
            {selectedAccommodation.completion && (
              <span className={`inline-block mb-4 px-4 py-1.5 rounded-full text-sm font-bold text-white ${selectedAccommodation.completion.complete ? "bg-green-500" : "bg-amber-500"}`}>
                Complétude {selectedAccommodation.completion.score}%
              </span>
            )}

            {/* Titre & adresse */}
            <h2 className="text-2xl font-bold mb-2 text-gray-900">
              {selectedAccommodation.property?.title || "Bien sans titre"}
            </h2>
            <p className="mb-5 text-gray-700 flex items-center gap-2">
              <MapPin className="w-4 h-4 text-red-500 flex-shrink-0" />
              {[selectedAccommodation.property?.address?.street, selectedAccommodation.property?.address?.arrondissement, selectedAccommodation.property?.address?.city]
                .filter(Boolean).join(", ") || "Adresse non renseignée"}
            </p>

            {/* Images */}
            {selectedAccommodation.property?.images?.length > 0 && (
              <div className="mb-6">
                <h3 className="font-bold text-gray-900 text-lg mb-3">
                  Images ({selectedAccommodation.property.images.length})
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {selectedAccommodation.property.images.map((url, idx) => (
                    <div key={idx} className="relative h-36 overflow-hidden rounded-lg shadow">
                      <img
                        src={url}
                        alt={`${selectedAccommodation.property.title || "Hébergement"} ${idx + 1}`}
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
                <DetailRow label="Type" value={typeLabel(selectedAccommodation.accommodationType)} />
                <DetailRow
                  label="Capacité"
                  icon={Users}
                  value={`${selectedAccommodation.capacity?.maxAdults || 0} adulte(s), ${selectedAccommodation.capacity?.maxChildren || 0} enfant(s)`}
                />
                {selectedAccommodation.property?.bedrooms > 0 && (
                  <DetailRow label="Chambres" icon={BedDouble} value={selectedAccommodation.property.bedrooms} />
                )}
                {selectedAccommodation.property?.bathrooms > 0 && (
                  <DetailRow label="Salles de bain" icon={Bath} value={selectedAccommodation.property.bathrooms} />
                )}
                <DetailRow
                  label="Arrivée / Départ"
                  icon={Clock}
                  value={`${selectedAccommodation.checkInTime || "—"} / ${selectedAccommodation.checkOutTime || "—"}`}
                />
              </div>

              {/* Colonne droite */}
              <div className="space-y-3">
                <div>
                  <span className="text-xs font-semibold uppercase tracking-wide text-gray-400 flex items-center gap-1">
                    <Wallet className="w-3.5 h-3.5" /> Tarifs
                  </span>
                  {selectedAccommodation.rates?.length > 0 ? (
                    <p className="text-gray-900 font-medium text-sm mt-0.5">
                      {selectedAccommodation.rates.map((r) => `${r.amount} ${r.currency} (${r.mode})`).join(" · ")}
                    </p>
                  ) : (
                    <p className="text-amber-700 font-medium text-sm mt-0.5">Aucun tarif actif renseigné</p>
                  )}
                </div>

                <div>
                  <span className="text-xs font-semibold uppercase tracking-wide text-gray-400 flex items-center gap-1">
                    <Sparkles className="w-3.5 h-3.5" /> Équipements
                  </span>
                  <p className="text-gray-900 font-medium text-sm mt-0.5">
                    {selectedAccommodation.amenities && Object.values(selectedAccommodation.amenities).some((l) => l?.length)
                      ? Object.values(selectedAccommodation.amenities).flat().join(", ")
                      : <span className="text-gray-400 italic">Aucun</span>}
                  </p>
                </div>

                <div>
                  <span className="text-xs font-semibold uppercase tracking-wide text-gray-400">Services inclus</span>
                  <p className="text-gray-900 font-medium text-sm mt-0.5">
                    {selectedAccommodation.includedServices && Object.values(selectedAccommodation.includedServices).some(Boolean)
                      ? INCLUDED_SERVICES.filter((s) => selectedAccommodation.includedServices[s.key]).map((s) => s.label).join(", ")
                      : <span className="text-gray-400 italic">Aucun</span>}
                  </p>
                </div>
              </div>
            </div>

            {/* Rejet — motif obligatoire */}
            {isRejecting && (
              <div className="mb-4 p-4 rounded-xl bg-red-50 border border-red-100">
                <label className="text-xs font-semibold uppercase tracking-wide text-red-700 mb-2 block">
                  Motif du rejet (obligatoire)
                </label>
                <textarea
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder="Expliquez pourquoi cet hébergement est rejeté…"
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
                    onClick={() => handleReject(selectedAccommodation._id)}
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
                    onClick={() => handleValidate(selectedAccommodation._id)}
                    disabled={Boolean(validatingId)}
                    className="flex items-center gap-2 bg-green-500 hover:bg-green-600 disabled:opacity-60 text-white px-6 py-2.5 rounded-lg transition font-semibold shadow"
                  >
                    <CheckCircle2 size={18} /> {validatingId === selectedAccommodation._id ? "Publication…" : "Valider"}
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

export default AccommodationModerationPage;