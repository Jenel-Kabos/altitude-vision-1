"use client";

// Sprint GL-B2 — page réelle "Maintenance locative" (remplace le
// placeholder Sprint 0). DISTINCTE de la maintenance hôtelière
// (/dashboard/maintenance, Sprint E) — domaine dédié RentalMaintenanceTicket.
// Création, assignation, planification, démarrage, résolution, clôture,
// coûts estimés/réels.

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "react-hot-toast";
import {
  getRentalMaintenanceTickets, createRentalMaintenanceTicket, assignRentalMaintenanceTicket, scheduleRentalMaintenanceTicket,
  startRentalMaintenanceWork, resolveRentalMaintenanceTicket, closeRentalMaintenanceTicket,
} from "../../services/rentalMaintenanceService";

const CATEGORIES = [
  { v: 'plomberie', l: 'Plomberie' }, { v: 'electricite', l: 'Électricité' }, { v: 'structure', l: 'Structure' },
  { v: 'equipement', l: 'Équipement' }, { v: 'nuisible', l: 'Nuisible' }, { v: 'serrurerie', l: 'Serrurerie' },
  { v: 'peinture', l: 'Peinture' }, { v: 'autre', l: 'Autre' },
];
const STATUS_CLASSES = {
  ouvert: 'bg-red-100 text-red-700', assigne: 'bg-blue-100 text-blue-800', planifie: 'bg-purple-100 text-purple-800',
  en_cours: 'bg-amber-100 text-amber-800', resolu: 'bg-green-100 text-green-800', cloture: 'bg-gray-100 text-gray-600',
};
const STATUS_LABELS = { ouvert: 'Ouvert', assigne: 'Assigné', planifie: 'Planifié', en_cours: 'En cours', resolu: 'Résolu', cloture: 'Clôturé' };

const RentalMaintenancePage = () => {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('');
  const [assignInputs, setAssignInputs] = useState({});
  const [scheduleInputs, setScheduleInputs] = useState({});
  const [costInputs, setCostInputs] = useState({});
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ propertyId: '', category: 'plomberie', description: '', estimatedCost: '' });

  const load = async () => {
    setLoading(true);
    try {
      const list = await getRentalMaintenanceTickets({ status: status || undefined });
      setTickets(list || []);
    } catch (err) {
      toast.error("Erreur lors du chargement des tickets de maintenance.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [status]);

  const handleAssign = async (id) => {
    const assignedToUserId = assignInputs[id];
    if (!assignedToUserId?.trim()) { toast.error("Identifiant technicien requis."); return; }
    try { await assignRentalMaintenanceTicket(id, assignedToUserId); toast.success("Ticket assigné."); load(); }
    catch (err) { toast.error(err.response?.data?.message || "Erreur."); }
  };

  const handleSchedule = async (id) => {
    const date = scheduleInputs[id];
    if (!date) { toast.error("Date de planification requise."); return; }
    try { await scheduleRentalMaintenanceTicket(id, date); toast.success("Intervention planifiée."); load(); }
    catch (err) { toast.error(err.response?.data?.message || "Erreur."); }
  };

  const handleStart = async (id) => {
    try { await startRentalMaintenanceWork(id); toast.success("Intervention démarrée."); load(); }
    catch (err) { toast.error(err.response?.data?.message || "Erreur."); }
  };

  const handleResolve = async (id) => {
    try {
      await resolveRentalMaintenanceTicket(id, costInputs[id] ? Number(costInputs[id]) : undefined);
      toast.success("Ticket résolu.");
      load();
    } catch (err) { toast.error(err.response?.data?.message || "Erreur."); }
  };

  const handleClose = async (id) => {
    try { await closeRentalMaintenanceTicket(id); toast.success("Ticket clôturé."); load(); }
    catch (err) { toast.error(err.response?.data?.message || "Erreur."); }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!form.propertyId.trim() || !form.description.trim()) { toast.error("Bien et description requis."); return; }
    try {
      await createRentalMaintenanceTicket({
        propertyId: form.propertyId, category: form.category, description: form.description,
        estimatedCost: form.estimatedCost ? Number(form.estimatedCost) : undefined,
      });
      toast.success("Ticket créé.");
      setCreating(false);
      setForm({ propertyId: '', category: 'plomberie', description: '', estimatedCost: '' });
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || "Erreur lors de la création.");
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-6 bg-white rounded shadow-md">
      <div className="flex items-center justify-between mb-1 flex-wrap gap-2">
        <h2 className="text-2xl font-bold">Maintenance locative</h2>
        <Link href="/dashboard/gestion-locative" className="text-sm text-blue-600 underline">Vue d'ensemble Gestion Locative</Link>
      </div>
      <p className="text-sm text-gray-500 mb-4">Tickets de maintenance sur les biens en gestion locative — distinct de la maintenance hôtelière.</p>

      {!creating ? (
        <button onClick={() => setCreating(true)} className="mb-4 bg-gold text-white px-3 py-1.5 rounded text-sm">
          + Nouveau ticket
        </button>
      ) : (
        <form onSubmit={handleCreate} className="bg-gray-50 border rounded p-4 mb-4 space-y-2">
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
            <input placeholder="ID du bien (Property)" value={form.propertyId}
              onChange={(e) => setForm((f) => ({ ...f, propertyId: e.target.value }))} className="p-2 border rounded text-sm" />
            <select value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))} className="p-2 border rounded text-sm">
              {CATEGORIES.map((c) => <option key={c.v} value={c.v}>{c.l}</option>)}
            </select>
            <input type="number" placeholder="Coût estimé" value={form.estimatedCost}
              onChange={(e) => setForm((f) => ({ ...f, estimatedCost: e.target.value }))} className="p-2 border rounded text-sm" />
          </div>
          <textarea placeholder="Description du problème" value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} className="w-full p-2 border rounded text-sm" rows={2} />
          <div className="flex gap-2">
            <button type="submit" className="bg-gold text-white px-3 py-1.5 rounded text-sm">Créer</button>
            <button type="button" onClick={() => setCreating(false)} className="text-gray-600 text-sm">Annuler</button>
          </div>
        </form>
      )}

      <div className="flex flex-wrap gap-2 mb-4">
        {[{ v: '', l: 'Tous' }, { v: 'ouvert', l: 'Ouvert' }, { v: 'assigne', l: 'Assigné' }, { v: 'planifie', l: 'Planifié' }, { v: 'en_cours', l: 'En cours' }, { v: 'resolu', l: 'Résolu' }, { v: 'cloture', l: 'Clôturé' }].map((s) => (
          <button key={s.v} onClick={() => setStatus(s.v)} className={`px-3 py-1.5 rounded text-sm font-medium ${status === s.v ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-700"}`}>
            {s.l}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-center text-gray-500 py-8">Chargement...</p>
      ) : tickets.length === 0 ? (
        <p className="text-center text-gray-500 py-8">Aucun ticket de maintenance pour ces critères.</p>
      ) : (
        <div className="space-y-3">
          {tickets.map((t) => (
            <div key={t._id} className="border rounded p-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <h3 className="font-semibold">{t.property?.title || 'Bien'}</h3>
                  <p className="text-xs text-gray-500">{CATEGORIES.find((c) => c.v === t.category)?.l} — {t.description}</p>
                  {t.tenant && <p className="text-xs text-gray-500">Locataire : {t.tenant.prenom} {t.tenant.nom}</p>}
                </div>
                <span className={`text-xs font-semibold px-2 py-1 rounded ${STATUS_CLASSES[t.status]}`}>{STATUS_LABELS[t.status]}</span>
              </div>
              <div className="mt-2 text-xs text-gray-500 flex flex-wrap gap-3">
                {t.estimatedCost != null && <span>Estimé : {t.estimatedCost.toLocaleString('fr-FR')} FCFA</span>}
                {t.actualCost != null && <span>Réel : {t.actualCost.toLocaleString('fr-FR')} FCFA</span>}
                {t.scheduledFor && <span>Planifié le {new Date(t.scheduledFor).toLocaleDateString('fr-FR')}</span>}
                {t.assignedTo && <span>Assigné à {t.assignedTo.name}</span>}
              </div>
              <div className="mt-3 flex flex-wrap gap-2 items-center">
                {['ouvert', 'assigne'].includes(t.status) && (
                  <>
                    <input placeholder="ID technicien" value={assignInputs[t._id] || ''}
                      onChange={(e) => setAssignInputs((p) => ({ ...p, [t._id]: e.target.value }))} className="text-xs border rounded px-1 py-1 w-28" />
                    <button onClick={() => handleAssign(t._id)} className="bg-blue-600 text-white px-2 py-1 rounded text-xs">Assigner</button>
                    <input type="date" value={scheduleInputs[t._id] || ''}
                      onChange={(e) => setScheduleInputs((p) => ({ ...p, [t._id]: e.target.value }))} className="text-xs border rounded px-1 py-1" />
                    <button onClick={() => handleSchedule(t._id)} className="bg-purple-600 text-white px-2 py-1 rounded text-xs">Planifier</button>
                    <button onClick={() => handleStart(t._id)} className="bg-amber-600 text-white px-2 py-1 rounded text-xs">Démarrer</button>
                  </>
                )}
                {['planifie'].includes(t.status) && (
                  <button onClick={() => handleStart(t._id)} className="bg-amber-600 text-white px-2 py-1 rounded text-xs">Démarrer</button>
                )}
                {t.status === 'en_cours' && (
                  <>
                    <input type="number" placeholder="Coût réel" value={costInputs[t._id] || ''}
                      onChange={(e) => setCostInputs((p) => ({ ...p, [t._id]: e.target.value }))} className="text-xs border rounded px-1 py-1 w-24" />
                    <button onClick={() => handleResolve(t._id)} className="bg-green-600 text-white px-2 py-1 rounded text-xs">Résoudre</button>
                  </>
                )}
                {t.status === 'resolu' && (
                  <button onClick={() => handleClose(t._id)} className="bg-gray-500 text-white px-2 py-1 rounded text-xs">Clôturer</button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default RentalMaintenancePage;
