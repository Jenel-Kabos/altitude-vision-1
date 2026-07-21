"use client";

// Sprint B2 — domaine Hôtellerie. Dashboard admin "Établissements" : filtres
// par statut de publication, recherche, tri, pagination, actions rapides
// (valider/rejeter/suspendre/réactiver) avec score de complétude dédié.

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "react-hot-toast";
import { getHotelsAdmin, reviewHotel } from "../../services/hotelService";
import { HOTEL_PUBLICATION_STATUSES } from "../../constants/hotel";

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
  const [reasonInputs, setReasonInputs] = useState({});

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
    const reason = reasonInputs[id];
    if ((action === "reject" || action === "suspend") && !reason?.trim()) {
      toast.error("Un motif est requis pour cette action.");
      return;
    }
    try {
      await reviewHotel(id, action, reason ? { reason } : {});
      toast.success("Action effectuée.");
      load();
    } catch (err) {
      const completion = err.response?.data?.completion;
      toast.error(completion ? `Incomplet (${completion.score}%) — impossible de publier.` : (err.response?.data?.message || "Erreur lors de l'action."));
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-6 bg-white rounded shadow-md">
      <h2 className="text-2xl font-bold mb-1">Gestion hôtelière — Établissements</h2>
      <p className="text-sm text-gray-500 mb-4">Tous les établissements hôteliers, quel que soit leur statut de publication.</p>

      <div className="flex flex-wrap gap-2 mb-4">
        {STATUS_TABS.map((tab) => (
          <button key={tab.value} onClick={() => { setStatus(tab.value); setPage(1); }}
            className={`px-3 py-1.5 rounded text-sm font-medium ${status === tab.value ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-700"}`}>
            {tab.label}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-3 mb-4">
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Rechercher un titre..."
          aria-label="Rechercher" className="flex-1 min-w-[200px] px-3 py-2 border rounded text-sm" />
        <select value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Trier par" className="px-3 py-2 border rounded text-sm">
          {SORT_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
      </div>

      {loading ? (
        <p className="text-center text-gray-500 py-8">Chargement...</p>
      ) : data.hotels.length === 0 ? (
        <p className="text-center text-gray-500 py-8">Aucun établissement pour ces critères.</p>
      ) : (
        <div className="space-y-3">
          {data.hotels.map((hotel) => (
            <div key={hotel._id} className="border rounded p-4">
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
                </div>
              </div>

              {hotel.publicationStatus === "soumis" && (
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <button onClick={() => handleAction(hotel._id, "validate")} className="bg-green-600 text-white px-3 py-1.5 rounded text-sm">Valider</button>
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
            </div>
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex justify-center gap-2 mt-4">
          <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="px-3 py-1.5 border rounded text-sm disabled:opacity-40">Précédent</button>
          <span className="text-sm text-gray-500 self-center">Page {page} / {totalPages}</span>
          <button disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)} className="px-3 py-1.5 border rounded text-sm disabled:opacity-40">Suivant</button>
        </div>
      )}
    </div>
  );
};

export default ManageHotelsPage;
