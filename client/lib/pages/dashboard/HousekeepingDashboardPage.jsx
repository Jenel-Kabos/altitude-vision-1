"use client";

// Sprint E — Dashboard Housekeeping (mission §10). Vue tabulaire des tâches
// de ménage : chambre, hôtel, priorité, statut, employé, heure. Filtres
// hôtel/priorité/statut. Actions : assigner/démarrer/terminer/annuler.

import React, { useEffect, useState } from "react";
import { toast } from "react-hot-toast";
import {
  getHousekeepingTasks, assignHousekeepingTask, startHousekeepingTask,
  completeHousekeepingTask, cancelHousekeepingTask,
} from "../../services/housekeepingService";
import { createInspection, approveInspection, rejectInspection } from "../../services/inspectionService";
import {
  HOUSEKEEPING_STATUSES, HOUSEKEEPING_STATUS_CLASSES, HOUSEKEEPING_PRIORITIES, PRIORITY_CLASSES,
} from "../../constants/housekeeping";

const HousekeepingDashboardPage = () => {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ hotelId: "", status: "", priority: "" });
  const [assignInputs, setAssignInputs] = useState({});
  const [inspections, setInspections] = useState({}); // taskId -> inspection

  const load = async () => {
    setLoading(true);
    try {
      const query = {};
      if (filters.hotelId) query.hotelId = filters.hotelId;
      if (filters.status) query.status = filters.status;
      if (filters.priority) query.priority = filters.priority;
      const list = await getHousekeepingTasks(query);
      setTasks(list || []);
    } catch (err) {
      toast.error("Erreur lors du chargement des tâches de ménage.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [filters.hotelId, filters.status, filters.priority]);

  const handleAssign = async (id) => {
    const assignedToUserId = assignInputs[id];
    if (!assignedToUserId?.trim()) { toast.error("Identifiant employé requis."); return; }
    try {
      await assignHousekeepingTask(id, assignedToUserId);
      toast.success("Tâche assignée.");
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || "Erreur lors de l'affectation.");
    }
  };

  const handleStart = async (id) => {
    try { await startHousekeepingTask(id); toast.success("Ménage démarré."); load(); }
    catch (err) { toast.error(err.response?.data?.message || "Erreur."); }
  };

  const handleComplete = async (id) => {
    try { await completeHousekeepingTask(id); toast.success("Ménage terminé — chambre en attente d'inspection."); load(); }
    catch (err) { toast.error(err.response?.data?.message || "Erreur."); }
  };

  const handleCancel = async (id) => {
    if (!window.confirm("Annuler cette tâche de ménage ?")) return;
    try { await cancelHousekeepingTask(id, "Annulée depuis le tableau de bord."); toast.success("Tâche annulée."); load(); }
    catch (err) { toast.error(err.response?.data?.message || "Erreur."); }
  };

  const handleCreateInspection = async (task) => {
    try {
      const inspection = await createInspection({ roomId: task.room?._id, housekeepingTaskId: task._id });
      setInspections((p) => ({ ...p, [task._id]: inspection }));
      toast.success("Inspection créée.");
    } catch (err) {
      toast.error(err.response?.data?.message || "Erreur lors de la création de l'inspection.");
    }
  };

  const handleApproveInspection = async (task) => {
    const inspection = inspections[task._id];
    if (!inspection) return;
    try {
      await approveInspection(inspection._id);
      toast.success("Inspection approuvée — chambre disponible.");
      setInspections((p) => { const next = { ...p }; delete next[task._id]; return next; });
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || "Erreur lors de l'approbation.");
    }
  };

  const handleRejectInspection = async (task) => {
    const inspection = inspections[task._id];
    if (!inspection) return;
    try {
      await rejectInspection(inspection._id, "Inspection échouée depuis le tableau de bord.");
      toast.success("Inspection rejetée — chambre hors service.");
      setInspections((p) => { const next = { ...p }; delete next[task._id]; return next; });
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || "Erreur lors du rejet.");
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-6 bg-white rounded shadow-md">
      <h2 className="text-2xl font-bold mb-1">Ménage</h2>
      <p className="text-sm text-gray-500 mb-4">Tâches de nettoyage en cours et à venir.</p>

      <div className="flex flex-wrap gap-2 mb-4">
        <input placeholder="ID Hôtel (optionnel)" value={filters.hotelId}
          onChange={(e) => setFilters((f) => ({ ...f, hotelId: e.target.value }))} className="p-2 border rounded text-sm" />
        <select aria-label="Filtrer par statut" value={filters.status} onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))} className="p-2 border rounded text-sm">
          <option value="">Tous les statuts</option>
          {HOUSEKEEPING_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
        <select aria-label="Filtrer par priorité" value={filters.priority} onChange={(e) => setFilters((f) => ({ ...f, priority: e.target.value }))} className="p-2 border rounded text-sm">
          <option value="">Toutes les priorités</option>
          {HOUSEKEEPING_PRIORITIES.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
        </select>
      </div>

      {loading ? (
        <p className="text-center text-gray-500 py-8">Chargement...</p>
      ) : tasks.length === 0 ? (
        <p className="text-center text-gray-500 py-8">Aucune tâche de ménage pour ces critères.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 border-b">
                <th className="py-2 pr-3">Chambre</th>
                <th className="py-2 pr-3">Hôtel</th>
                <th className="py-2 pr-3">Type</th>
                <th className="py-2 pr-3">Priorité</th>
                <th className="py-2 pr-3">Statut</th>
                <th className="py-2 pr-3">Employé</th>
                <th className="py-2 pr-3">Heure</th>
                <th className="py-2 pr-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {tasks.map((task) => (
                <tr key={task._id} className="border-b hover:bg-gray-50">
                  <td className="py-2 pr-3 font-medium">{task.room?.roomNumber}</td>
                  <td className="py-2 pr-3">{task.hotel?.name}</td>
                  <td className="py-2 pr-3">{task.type}</td>
                  <td className="py-2 pr-3">
                    <span className={`text-xs font-semibold px-2 py-1 rounded ${PRIORITY_CLASSES[task.priority]}`}>
                      {HOUSEKEEPING_PRIORITIES.find((p) => p.value === task.priority)?.label}
                    </span>
                  </td>
                  <td className="py-2 pr-3">
                    <span className={`text-xs font-semibold px-2 py-1 rounded ${HOUSEKEEPING_STATUS_CLASSES[task.status]}`}>
                      {HOUSEKEEPING_STATUSES.find((s) => s.value === task.status)?.label}
                    </span>
                  </td>
                  <td className="py-2 pr-3">{task.assignedTo?.name || "—"}</td>
                  <td className="py-2 pr-3 text-xs text-gray-500">{new Date(task.createdAt).toLocaleString('fr-FR')}</td>
                  <td className="py-2 pr-3">
                    <div className="flex flex-wrap gap-1">
                      {(task.status === "pending" || task.status === "assigned") && (
                        <>
                          <input placeholder="ID employé" value={assignInputs[task._id] || ""}
                            onChange={(e) => setAssignInputs((p) => ({ ...p, [task._id]: e.target.value }))}
                            className="text-xs border rounded px-1 py-1 w-24" />
                          <button onClick={() => handleAssign(task._id)} className="bg-blue-600 text-white px-2 py-1 rounded text-xs">Assigner</button>
                        </>
                      )}
                      {(task.status === "pending" || task.status === "assigned") && (
                        <button onClick={() => handleStart(task._id)} className="bg-purple-600 text-white px-2 py-1 rounded text-xs">Démarrer</button>
                      )}
                      {task.status === "in_progress" && (
                        <button onClick={() => handleComplete(task._id)} className="bg-green-600 text-white px-2 py-1 rounded text-xs">Terminer</button>
                      )}
                      {task.status === "completed" && !inspections[task._id] && (
                        <button onClick={() => handleCreateInspection(task)} className="bg-indigo-600 text-white px-2 py-1 rounded text-xs">Inspecter</button>
                      )}
                      {task.status === "completed" && inspections[task._id] && (
                        <>
                          <button onClick={() => handleApproveInspection(task)} className="bg-green-600 text-white px-2 py-1 rounded text-xs">Approuver</button>
                          <button onClick={() => handleRejectInspection(task)} className="bg-red-600 text-white px-2 py-1 rounded text-xs">Rejeter</button>
                        </>
                      )}
                      {!["completed", "cancelled"].includes(task.status) && (
                        <button onClick={() => handleCancel(task._id)} className="bg-gray-500 text-white px-2 py-1 rounded text-xs">Annuler</button>
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

export default HousekeepingDashboardPage;
