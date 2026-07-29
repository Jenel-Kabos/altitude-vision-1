"use client";

// Sprint B1 — Dashboard admin "Tous les hébergements" : vue dédiée au cycle
// de vie Accommodation (brouillon/soumis/publié/suspendu/rejeté), distincte
// de ManagePropertiesPage.jsx (générique Vente/Location/Hébergement, filtré
// sur Property.status uniquement — jamais sur publicationStatus).

import React, { useEffect, useState } from "react";
import { toast } from "react-hot-toast";
import { getAccommodationsAdmin, reviewAccommodation } from "../../services/accommodationService";
import { getPublicationErrorMessage } from "../../utils/publicationError";
import { ACCOMMODATION_TYPES, PUBLICATION_STATUSES } from "../../constants/accommodation";
import AccommodationPropertyForm from "../../components/dashboard/AccommodationPropertyForm";

const STATUS_TABS = [{ value: "tous", label: "Tous" }, ...PUBLICATION_STATUSES];

const SORT_OPTIONS = [
  { value: "recent", label: "Plus récent" },
  { value: "ancien", label: "Plus ancien" },
  { value: "prix_asc", label: "Prix croissant" },
  { value: "prix_desc", label: "Prix décroissant" },
];

const STATUS_CLASSES = {
  brouillon: "bg-gray-100 text-gray-700",
  soumis: "bg-yellow-100 text-yellow-800",
  publie: "bg-green-100 text-green-800",
  suspendu: "bg-orange-100 text-orange-800",
  rejete: "bg-red-100 text-red-700",
};

const PAGE_SIZE = 20;

const ManageAccommodationsPage = () => {
  const [status, setStatus] = useState("tous");
  const [type, setType] = useState("tous");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("recent");
  const [page, setPage] = useState(1);
  const [data, setData] = useState({ accommodations: [], total: 0 });
  const [loading, setLoading] = useState(true);
  const [validatingId, setValidatingId] = useState(null);
  const [reasonInputs, setReasonInputs] = useState({});
  const [editing, setEditing] = useState(null);
  const [creating, setCreating] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await getAccommodationsAdmin({ status, type, search: search || undefined, sort, page, limit: PAGE_SIZE });
      setData(res);
    } catch (err) {
      toast.error("Erreur lors du chargement des hébergements.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [status, type, sort, page]);
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
      await reviewAccommodation(id, action, reason ? { reason } : {});
      toast.success("Action effectuée.");
      load();
    } catch (err) {
      const msg = getPublicationErrorMessage(err, "cet hébergement") || err.response?.data?.message || "Erreur lors de l'action.";
      toast.error(msg);
    } finally {
      if (action === "validate") setValidatingId(null);
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-6 bg-white rounded shadow-md">
      <div className="flex items-center justify-between gap-3"><h2 className="text-2xl font-bold mb-1">Gestion des hébergements</h2>
        {!creating && !editing && <button onClick={() => setCreating(true)} className="bg-blue-600 text-white px-4 py-2 rounded font-semibold">Ajouter un hébergement</button>}
      </div>
      <p className="text-sm text-gray-500 mb-4">
        Tous les hébergements indépendants (villas, appartements, studios, maisons, chambres d'hôtes,
        résidences meublées), quel que soit leur statut de publication.
      </p>

      {(creating || editing) && <div className="mb-6 border rounded-xl p-4">
        <AccommodationPropertyForm accommodation={editing} onSuccess={() => { setCreating(false); setEditing(null); load(); }} onCancel={() => { setCreating(false); setEditing(null); }} />
      </div>}

      <div className="flex flex-wrap gap-2 mb-4">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.value}
            onClick={() => { setStatus(tab.value); setPage(1); }}
            className={`px-3 py-1.5 rounded text-sm font-medium ${status === tab.value ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-700"}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-3 mb-4">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Rechercher un titre..."
          aria-label="Rechercher"
          className="flex-1 min-w-[200px] px-3 py-2 border rounded text-sm"
        />
        <select value={type} onChange={(e) => { setType(e.target.value); setPage(1); }} aria-label="Type" className="px-3 py-2 border rounded text-sm">
          <option value="tous">Tous les types</option>
          {ACCOMMODATION_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
        <select value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Trier par" className="px-3 py-2 border rounded text-sm">
          {SORT_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
      </div>

      {loading ? (
        <p className="text-center text-gray-500 py-8">Chargement...</p>
      ) : data.accommodations.length === 0 ? (
        <p className="text-center text-gray-500 py-8">Aucun hébergement pour ces critères.</p>
      ) : (
        <div className="space-y-3">
          {data.accommodations.map((acc) => (
            <div key={acc._id} className="border rounded p-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <h3 className="font-semibold">{acc.property?.title || "(sans titre)"}</h3>
                  <p className="text-xs text-gray-500">
                    {ACCOMMODATION_TYPES.find((t) => t.value === acc.accommodationType)?.label || acc.accommodationType}
                    {" · "}{acc.property?.address?.city}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-semibold px-2 py-1 rounded ${STATUS_CLASSES[acc.publicationStatus] || "bg-gray-100"}`}>
                    {PUBLICATION_STATUSES.find((s) => s.value === acc.publicationStatus)?.label || acc.publicationStatus}
                  </span>
                  {acc.completion && (
                    <span className={`text-xs font-semibold px-2 py-1 rounded ${acc.completion.complete ? "bg-green-100 text-green-800" : "bg-amber-100 text-amber-800"}`}>
                      {acc.completion.score}%
                    </span>
                  )}
                  <button onClick={() => setEditing(acc)} className="text-xs text-blue-600 underline">
                    Modifier
                  </button>
                </div>
              </div>

              {acc.publicationStatus === "soumis" && (
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <button onClick={() => handleAction(acc._id, "validate")} disabled={Boolean(validatingId)} className="bg-green-600 text-white px-3 py-1.5 rounded text-sm disabled:opacity-50">
                    {validatingId === acc._id ? "Publication…" : "Valider"}
                  </button>
                  <input
                    placeholder="Motif de rejet"
                    value={reasonInputs[acc._id] || ""}
                    onChange={(e) => setReasonInputs((prev) => ({ ...prev, [acc._id]: e.target.value }))}
                    className="px-2 py-1.5 border rounded text-sm"
                  />
                  <button onClick={() => handleAction(acc._id, "reject")} className="bg-red-600 text-white px-3 py-1.5 rounded text-sm">
                    Rejeter
                  </button>
                </div>
              )}

              {acc.publicationStatus === "publie" && (
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <input
                    placeholder="Motif de suspension"
                    value={reasonInputs[acc._id] || ""}
                    onChange={(e) => setReasonInputs((prev) => ({ ...prev, [acc._id]: e.target.value }))}
                    className="px-2 py-1.5 border rounded text-sm"
                  />
                  <button onClick={() => handleAction(acc._id, "suspend")} className="bg-orange-600 text-white px-3 py-1.5 rounded text-sm">
                    Suspendre
                  </button>
                </div>
              )}

              {acc.publicationStatus === "suspendu" && (
                <div className="mt-3">
                  <button onClick={() => handleAction(acc._id, "unsuspend")} className="bg-green-600 text-white px-3 py-1.5 rounded text-sm">
                    Réactiver
                  </button>
                  {acc.suspensionReason && <p className="text-xs text-orange-700 mt-1">Motif : {acc.suspensionReason}</p>}
                </div>
              )}

              {acc.publicationStatus === "rejete" && acc.rejectionReason && (
                <p className="text-xs text-red-600 mt-2">Motif du rejet : {acc.rejectionReason}</p>
              )}
            </div>
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex justify-center gap-2 mt-4">
          <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="px-3 py-1.5 border rounded text-sm disabled:opacity-40">
            Précédent
          </button>
          <span className="text-sm text-gray-500 self-center">Page {page} / {totalPages}</span>
          <button disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)} className="px-3 py-1.5 border rounded text-sm disabled:opacity-40">
            Suivant
          </button>
        </div>
      )}
    </div>
  );
};

export default ManageAccommodationsPage;
