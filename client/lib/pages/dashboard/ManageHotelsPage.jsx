"use client";

// Sprint B2 — domaine Hôtellerie. Dashboard admin "Établissements" : filtres
// par statut de publication, recherche, tri, pagination, actions rapides
// (valider/rejeter/suspendre/réactiver) avec score de complétude dédié.

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "react-hot-toast";
import { getHotelsAdmin, reviewHotel } from "../../services/hotelService";
import { getPublicationErrorMessage } from "../../utils/publicationError";
import { HOTEL_PUBLICATION_STATUSES } from "../../constants/hotel";
import { Building2 } from "lucide-react";
import HotelPropertyForm from "../../components/dashboard/HotelPropertyForm";
import {
  DashboardCard, DashboardPage, DashboardPageHeader, DashboardPagination,
  DashboardState, DashboardToolbar,
} from "../../components/dashboard/DashboardUI";

const STATUS_TABS = [{ value: "tous", label: "Tous" }, ...HOTEL_PUBLICATION_STATUSES];
const SORT_OPTIONS = [
  { value: "recent", label: "Plus récent" },
  { value: "ancien", label: "Plus ancien" },
];
const STATUS_CLASSES = {
  brouillon: "bg-gray-100 text-gray-700",
  soumis: "bg-yellow-100 text-yellow-800",
  publie: "bg-green-100 text-green-800",
  suspendu: "bg-orange-100 text-orange-800",
  rejete: "bg-red-100 text-red-700",
};
const PAGE_SIZE = 20;

const ManageHotelsPage = () => {
  const [status, setStatus] = useState("tous");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("recent");
  const [page, setPage] = useState(1);
  const [data, setData] = useState({ hotels: [], total: 0 });
  const [loading, setLoading] = useState(true);
  const [validatingId, setValidatingId] = useState(null);
  const [reasonInputs, setReasonInputs] = useState({});
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await getHotelsAdmin({ status, search: search || undefined, sort, page, limit: PAGE_SIZE });
      setData(res);
    } catch (err) {
      toast.error("Erreur lors du chargement des établissements.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [status, sort, page]);
  useEffect(() => {
    const timeout = setTimeout(() => { setPage(1); load(); }, 300);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const totalPages = Math.max(1, Math.ceil((data.total || 0) / PAGE_SIZE));

  const handleAction = async (id, action) => {
    if (action === "validate" && validatingId) return;
    const reason = reasonInputs[id];
    if ((action === "reject" || action === "suspend") && !reason?.trim()) {
      toast.error("Un motif est requis pour cette action.");
      return;
    }
    try {
      if (action === "validate") setValidatingId(id);
      await reviewHotel(id, action, reason ? { reason } : {});
      toast.success("Action effectuée.");
      load();
    } catch (err) {
      const completion = err.response?.data?.completion;
      toast.error(completion
        ? `Hôtel incomplet (${completion.score}%).`
        : (getPublicationErrorMessage(err, "cet hôtel") || err.response?.data?.message || "Erreur lors de l'action."));
    } finally {
      if (action === "validate") setValidatingId(null);
    }
  };

  return (
    <DashboardPage>
      <DashboardPageHeader icon={Building2} title="Gestion hôtelière — Établissements"
        description="Tous les établissements hôteliers, quel que soit leur statut de publication."
        actions={!creating && !editing && <button onClick={() => setCreating(true)} className="bg-gold text-white px-4 py-2 rounded font-semibold">Ajouter un hôtel</button>} />

      {(creating || editing) && <DashboardCard className="mb-6"><HotelPropertyForm
        hotelId={editing?._id} accommodationType={editing?.accommodationType || 'hotel'} initialProperty={editing?.property}
        initialHotel={editing} existingImages={editing?.property?.images || editing?.gallery || []}
        onSuccess={() => { setCreating(false); setEditing(null); load(); }} onCancel={() => { setCreating(false); setEditing(null); }}
      /></DashboardCard>}

      <DashboardToolbar>
      <div className="flex flex-wrap gap-2 w-full">
        {STATUS_TABS.map((tab) => (
          <button key={tab.value} onClick={() => { setStatus(tab.value); setPage(1); }}
            className={`px-3 py-1.5 rounded text-sm font-medium ${status === tab.value ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-700"}`}>
            {tab.label}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-3 w-full">
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Rechercher un titre..."
          aria-label="Rechercher" className="flex-1 min-w-[200px] px-3 py-2 border rounded text-sm" />
        <select value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Trier par" className="px-3 py-2 border rounded text-sm">
          {SORT_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
      </div>
      </DashboardToolbar>

      {loading ? (
        <DashboardState type="loading" title="Chargement des établissements…" />
      ) : data.hotels.length === 0 ? (
        <DashboardState title="Aucun établissement" description="Aucun établissement ne correspond aux critères sélectionnés." />
      ) : (
        <div className="space-y-3">
          {data.hotels.map((hotel) => (
            <DashboardCard key={hotel._id}>
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <h3 className="font-semibold">{hotel.name}</h3>
                  <p className="text-xs text-gray-500">{hotel.property?.address?.city}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-semibold px-2 py-1 rounded ${STATUS_CLASSES[hotel.publicationStatus] || "bg-gray-100"}`}>
                    {HOTEL_PUBLICATION_STATUSES.find((s) => s.value === hotel.publicationStatus)?.label || hotel.publicationStatus}
                  </span>
                  {hotel.completion && (
                    <span className={`text-xs font-semibold px-2 py-1 rounded ${hotel.completion.complete ? "bg-green-100 text-green-800" : "bg-amber-100 text-amber-800"}`}>
                      {hotel.completion.score}%
                    </span>
                  )}
                  <Link href={`/dashboard/hotels/${hotel._id}`} className="text-xs text-blue-600 underline">Détail</Link>
                  <button onClick={() => setEditing(hotel)} className="text-xs text-blue-600 underline">Modifier</button>
                </div>
              </div>

              {hotel.publicationStatus === "soumis" && (
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <button onClick={() => handleAction(hotel._id, "validate")} disabled={Boolean(validatingId)} className="bg-green-600 text-white px-3 py-1.5 rounded text-sm disabled:opacity-50">{validatingId === hotel._id ? "Publication…" : "Valider"}</button>
                  <input placeholder="Motif de rejet" value={reasonInputs[hotel._id] || ""}
                    onChange={(e) => setReasonInputs((prev) => ({ ...prev, [hotel._id]: e.target.value }))}
                    className="px-2 py-1.5 border rounded text-sm" />
                  <button onClick={() => handleAction(hotel._id, "reject")} className="bg-red-600 text-white px-3 py-1.5 rounded text-sm">Rejeter</button>
                </div>
              )}

              {hotel.publicationStatus === "publie" && (
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <input placeholder="Motif de suspension" value={reasonInputs[hotel._id] || ""}
                    onChange={(e) => setReasonInputs((prev) => ({ ...prev, [hotel._id]: e.target.value }))}
                    className="px-2 py-1.5 border rounded text-sm" />
                  <button onClick={() => handleAction(hotel._id, "suspend")} className="bg-orange-600 text-white px-3 py-1.5 rounded text-sm">Suspendre</button>
                </div>
              )}

              {hotel.publicationStatus === "suspendu" && (
                <div className="mt-3">
                  <button onClick={() => handleAction(hotel._id, "unsuspend")} className="bg-green-600 text-white px-3 py-1.5 rounded text-sm">Réactiver</button>
                  {hotel.suspensionReason && <p className="text-xs text-orange-700 mt-1">Motif : {hotel.suspensionReason}</p>}
                </div>
              )}

              {hotel.publicationStatus === "rejete" && hotel.rejectionReason && (
                <p className="text-xs text-red-600 mt-2">Motif du rejet : {hotel.rejectionReason}</p>
              )}
            </DashboardCard>
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <DashboardPagination page={page} totalPages={totalPages}
          onPrevious={() => setPage((p) => p - 1)} onNext={() => setPage((p) => p + 1)} />
      )}
    </DashboardPage>
  );
};

export default ManageHotelsPage;
