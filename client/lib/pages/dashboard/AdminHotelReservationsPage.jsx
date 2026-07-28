"use client";

// Sprint C — dashboard admin "Réservations hôtelières". Liste globale,
// pagination, recherche, filtres hôtel/statut, détail (hôtel/catégorie/
// propriétaire/client/source/montant/historique de statuts).

import React, { useEffect, useState } from "react";
import { getAdminHotelReservations } from "../../services/hotelReservationService";
import { RESERVATION_STATUSES, RESERVATION_STATUS_CLASSES, RESERVATION_SOURCES } from "../../constants/hotelReservation";
import { formatCurrencyXAF } from "../../utils/normalizePropertyDetail";
import { toast } from "react-hot-toast";
import RoomAssignmentPanel from "../../components/RoomAssignmentPanel";
import HotelFinancialDocumentPanel from "../../components/HotelFinancialDocumentPanel";
import { CalendarCheck2 } from "lucide-react";
import { DashboardPage, DashboardPageHeader, DashboardPagination, DashboardState, DashboardTableContainer, DashboardToolbar } from "../../components/dashboard/DashboardUI";

const STATUS_TABS = [{ value: "", label: "Tous" }, ...RESERVATION_STATUSES];

const AdminHotelReservationsPage = () => {
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState({ reservations: [], total: 0 });
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState(null);
  const limit = 20;

  const load = async () => {
    setLoading(true);
    try {
      const res = await getAdminHotelReservations({ status: status || undefined, search: search || undefined, page, limit });
      setData(res);
    } catch (err) {
      toast.error("Erreur lors du chargement des réservations.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [status, page]);
  useEffect(() => {
    const t = setTimeout(() => { setPage(1); load(); }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const totalPages = Math.max(1, Math.ceil((data.total || 0) / limit));

  return (
    <DashboardPage>
      <DashboardPageHeader icon={CalendarCheck2} title="Réservations hôtelières" description="Toutes les réservations, tous établissements confondus." />

      <DashboardToolbar>
        {STATUS_TABS.map((tab) => (
          <button key={tab.value || 'tous'} onClick={() => { setStatus(tab.value); setPage(1); }}
            className={`px-3 py-1.5 rounded text-sm font-medium ${status === tab.value ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-700"}`}>
            {tab.label}
          </button>
        ))}
      <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Rechercher une référence..."
        aria-label="Rechercher" className="w-full mb-4 px-3 py-2 border rounded text-sm" />
      </DashboardToolbar>

      {loading ? (
        <DashboardState type="loading" title="Chargement des réservations…" />
      ) : data.reservations.length === 0 ? (
        <DashboardState title="Aucune réservation" description="Aucune réservation ne correspond aux critères sélectionnés." />
      ) : (
        <DashboardTableContainer label="Liste des réservations hôtelières">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 border-b">
                <th className="py-2 pr-3">Référence</th>
                <th className="py-2 pr-3">Hôtel</th>
                <th className="py-2 pr-3">Catégorie</th>
                <th className="py-2 pr-3">Client</th>
                <th className="py-2 pr-3">Source</th>
                <th className="py-2 pr-3">Statut</th>
                <th className="py-2 pr-3">Montant</th>
              </tr>
            </thead>
            <tbody>
              {data.reservations.map((r) => (
                <React.Fragment key={r._id}>
                  <tr className="border-b hover:bg-gray-50 cursor-pointer" onClick={() => setExpandedId(expandedId === r._id ? null : r._id)}>
                    <td className="py-2 pr-3 font-medium">{r.reference}</td>
                    <td className="py-2 pr-3">{r.hotel?.name}</td>
                    <td className="py-2 pr-3">{r.roomCategory?.name}</td>
                    <td className="py-2 pr-3">{r.guest?.firstName} {r.guest?.lastName}</td>
                    <td className="py-2 pr-3">{RESERVATION_SOURCES[r.source]}</td>
                    <td className="py-2 pr-3">
                      <span className={`text-xs font-semibold px-2 py-1 rounded ${RESERVATION_STATUS_CLASSES[r.status]}`}>
                        {RESERVATION_STATUSES.find((s) => s.value === r.status)?.label}
                      </span>
                    </td>
                    <td className="py-2 pr-3">{formatCurrencyXAF(r.totalAmount)}</td>
                  </tr>
                  {expandedId === r._id && (
                    <tr className="border-b bg-gray-50">
                      <td colSpan={7} className="p-3">
                        <p className="text-xs text-gray-600">
                          {new Date(r.checkInDate).toLocaleDateString('fr-FR')} → {new Date(r.checkOutDate).toLocaleDateString('fr-FR')} ·
                          {' '}{r.roomsCount} chambre(s) · {r.adults} adulte(s){r.children ? `, ${r.children} enfant(s)` : ''} ·
                          {' '}Propriétaire : {r.hotel?.manager || 'non renseigné'}
                        </p>
                        {r.statusHistory?.length > 0 && (
                          <div className="mt-2">
                            <p className="text-xs font-semibold text-gray-500">Historique</p>
                            <ul className="text-xs text-gray-600 mt-1 space-y-0.5">
                              {r.statusHistory.map((h, i) => (
                                <li key={i}>{h.from || '—'} → {h.to} ({new Date(h.changedAt).toLocaleString('fr-FR')}){h.reason ? ` — ${h.reason}` : ''}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {(r.status === "confirmed" || r.status === "checked_in") && (
                          <>
                            <RoomAssignmentPanel reservation={r} onChanged={load} isAdmin />
                            <HotelFinancialDocumentPanel reservation={r} canManage />
                          </>
                        )}
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </DashboardTableContainer>
      )}

      {totalPages > 1 && (
        <DashboardPagination page={page} totalPages={totalPages} onPrevious={() => setPage((p) => p - 1)} onNext={() => setPage((p) => p + 1)} />
      )}
    </DashboardPage>
  );
};

export default AdminHotelReservationsPage;
