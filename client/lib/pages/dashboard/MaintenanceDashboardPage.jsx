"use client";

// Sprint E — Dashboard Maintenance (mission §11). Vue tabulaire des
// tickets : chambre, catégorie, priorité, technicien, statut. Filtres
// hôtel/priorité/statut/catégorie.

import React, { useEffect, useState } from "react";
import { toast } from "react-hot-toast";
import {
  getMaintenanceTickets, assignMaintenanceTicket, startMaintenanceWork,
  resolveMaintenanceTicket, closeMaintenanceTicket,
} from "../../services/maintenanceService";
import { createInspection, approveInspection, rejectInspection } from "../../services/inspectionService";
import { MAINTENANCE_CATEGORIES, MAINTENANCE_STATUSES, MAINTENANCE_STATUS_CLASSES } from "../../constants/maintenance";
import { PRIORITY_CLASSES, HOUSEKEEPING_PRIORITIES } from "../../constants/housekeeping";

const MaintenanceDashboardPage = () => {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ hotelId: "", status: "", priority: "", category: "" });
  const [assignInputs, setAssignInputs] = useState({});
  const [inspections, setInspections] = useState({}); // ticketId -> inspection

  const load = async () => {
    setLoading(true);
    try {
      const query = {};
      if (filters.hotelId) query.hotelId = filters.hotelId;
      if (filters.status) query.status = filters.status;
      if (filters.priority) query.priority = filters.priority;
      if (filters.category) query.category = filters.category;
      const list = await getMaintenanceTickets(query);
      setTickets(list || []);
    } catch (err) {
      toast.error("Erreur lors du chargement des tickets de maintenance.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [filters.hotelId, filters.status, filters.priority, filters.category]);

  const handleAssign = async (id) => {
    const assignedToUserId = assignInputs[id];
    if (!assignedToUserId?.trim()) { toast.error("Identifiant technicien requis."); return; }
    try { await assignMaintenanceTicket(id, assignedToUserId); toast.success("Ticket assigné."); load(); }
    catch (err) { toast.error(err.response?.data?.message || "Erreur."); }
  };

  const handleStart = async (id) => {
    try { await startMaintenanceWork(id); toast.success("Intervention démarrée."); load(); }
    catch (err) { toast.error(err.response?.data?.message || "Erreur."); }
  };

  const handleResolve = async (id) => {
    try { await resolveMaintenanceTicket(id); toast.success("Ticket résolu — la chambre peut être ré-inspectée."); load(); }
    catch (err) { toast.error(err.response?.data?.message || "Erreur."); }
  };

  const handleClose = async (id) => {
    try { await closeMaintenanceTicket(id); toast.success("Ticket clôturé."); load(); }
    catch (err) { toast.error(err.response?.data?.message || "Erreur."); }
  };

  const handleReinspect = async (ticket) => {
    const housekeepingTaskId = ticket.inspection?.housekeepingTask?._id;
    if (!housekeepingTaskId) { toast.error("Aucune tâche de ménage d'origine trouvée pour cette chambre."); return; }
    try {
      const inspection = await createInspection({ roomId: ticket.room?._id, housekeepingTaskId });
      setInspections((p) => ({ ...p, [ticket._id]: inspection }));
      toast.success("Ré-inspection créée.");
    } catch (err) {
      toast.error(err.response?.data?.message || "Erreur lors de la création de la ré-inspection.");
    }
  };

  const handleApprove = async (ticket) => {
    const inspection = inspections[ticket._id];
    if (!inspection) return;
    try {
      await approveInspection(inspection._id);
      toast.success("Chambre remise en service.");
      setInspections((p) => { const n = { ...p }; delete n[ticket._id]; return n; });
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || "Erreur lors de l'approbation.");
    }
  };

  const handleReject = async (ticket) => {
    const inspection = inspections[ticket._id];
    if (!inspection) return;
    try {
      await rejectInspection(inspection._id, "Nouvelle anomalie détectée.");
      toast.success("Inspection rejetée — chambre toujours hors service.");
      setInspections((p) => { const n = { ...p }; delete n[ticket._id]; return n; });
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || "Erreur lors du rejet.");
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-6 bg-white rounded shadow-md">
      <h2 className="text-2xl font-bold mb-1">Maintenance</h2>
      <p className="text-sm text-gray-500 mb-4">Tickets de maintenance ouverts sur les chambres.</p>

      <div className="flex flex-wrap gap-2 mb-4">
        <input placeholder="ID Hôtel (optionnel)" value={filters.hotelId}
          onChange={(e) => setFilters((f) => ({ ...f, hotelId: e.target.value }))} className="p-2 border rounded text-sm" />
        <select aria-label="Filtrer par statut" value={filters.status} onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))} className="p-2 border rounded text-sm">
          <option value="">Tous les statuts</option>
          {MAINTENANCE_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
        <select aria-label="Filtrer par priorité" value={filters.priority} onChange={(e) => setFilters((f) => ({ ...f, priority: e.target.value }))} className="p-2 border rounded text-sm">
          <option value="">Toutes les priorités</option>
          {HOUSEKEEPING_PRIORITIES.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
        </select>
        <select aria-label="Filtrer par catégorie" value={filters.category} onChange={(e) => setFilters((f) => ({ ...f, category: e.target.value }))} className="p-2 border rounded text-sm">
          <option value="">Toutes les catégories</option>
          {MAINTENANCE_CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
        </select>
      </div>

      {loading ? (
        <p className="text-center text-gray-500 py-8">Chargement...</p>
      ) : tickets.length === 0 ? (
        <p className="text-center text-gray-500 py-8">Aucun ticket de maintenance pour ces critères.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 border-b">
                <th className="py-2 pr-3">Chambre</th>
                <th className="py-2 pr-3">Catégorie</th>
                <th className="py-2 pr-3">Priorité</th>
                <th className="py-2 pr-3">Technicien</th>
                <th className="py-2 pr-3">Statut</th>
                <th className="py-2 pr-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {tickets.map((ticket) => (
                <tr key={ticket._id} className="border-b hover:bg-gray-50">
                  <td className="py-2 pr-3 font-medium">{ticket.room?.roomNumber}</td>
                  <td className="py-2 pr-3">{MAINTENANCE_CATEGORIES.find((c) => c.value === ticket.category)?.label}</td>
                  <td className="py-2 pr-3">
                    <span className={`text-xs font-semibold px-2 py-1 rounded ${PRIORITY_CLASSES[ticket.priority]}`}>
                      {HOUSEKEEPING_PRIORITIES.find((p) => p.value === ticket.priority)?.label}
                    </span>
                  </td>
                  <td className="py-2 pr-3">{ticket.assignedTo?.name || "—"}</td>
                  <td className="py-2 pr-3">
                    <span className={`text-xs font-semibold px-2 py-1 rounded ${MAINTENANCE_STATUS_CLASSES[ticket.status]}`}>
                      {MAINTENANCE_STATUSES.find((s) => s.value === ticket.status)?.label}
                    </span>
                  </td>
                  <td className="py-2 pr-3">
                    <div className="flex flex-wrap gap-1">
                      {["open", "assigned"].includes(ticket.status) && (
                        <>
                          <input placeholder="ID technicien" value={assignInputs[ticket._id] || ""}
                            onChange={(e) => setAssignInputs((p) => ({ ...p, [ticket._id]: e.target.value }))}
                            className="text-xs border rounded px-1 py-1 w-24" />
                          <button onClick={() => handleAssign(ticket._id)} className="bg-blue-600 text-white px-2 py-1 rounded text-xs">Assigner</button>
                          <button onClick={() => handleStart(ticket._id)} className="bg-purple-600 text-white px-2 py-1 rounded text-xs">Démarrer</button>
                        </>
                      )}
                      {ticket.status === "in_progress" && (
                        <button onClick={() => handleResolve(ticket._id)} className="bg-green-600 text-white px-2 py-1 rounded text-xs">Résoudre</button>
                      )}
                      {ticket.status === "resolved" && !inspections[ticket._id] && (
                        <>
                          <button onClick={() => handleReinspect(ticket)} className="bg-indigo-600 text-white px-2 py-1 rounded text-xs">Ré-inspecter</button>
                          <button onClick={() => handleClose(ticket._id)} className="bg-gray-500 text-white px-2 py-1 rounded text-xs">Clôturer</button>
                        </>
                      )}
                      {ticket.status === "resolved" && inspections[ticket._id] && (
                        <>
                          <button onClick={() => handleApprove(ticket)} className="bg-green-600 text-white px-2 py-1 rounded text-xs">Approuver</button>
                          <button onClick={() => handleReject(ticket)} className="bg-red-600 text-white px-2 py-1 rounded text-xs">Rejeter</button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default MaintenanceDashboardPage;
