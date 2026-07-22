"use client";

// Sprint GL-B2 — page réelle "Préavis" (remplace le placeholder Sprint 0).
// Création, accusé de réception, suivi, annulation, clôture (validation de
// sortie), date de départ prévue, jours restants, lien vers bail/locataire/
// bien. Les délais légaux ne sont JAMAIS codés en dur — `plannedExitAt` est
// toujours saisi explicitement par le staff (voir Contrat.dureePreavis pour
// la référence contractuelle).

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "react-hot-toast";
import {
  getRentalManagement, runRentalAction, acknowledgeNotice, cancelNotice, startNotice,
} from "../../services/gestionLocativeService";

const joursRestants = (plannedExitAt) => {
  if (!plannedExitAt) return null;
  const diff = new Date(plannedExitAt).getTime() - Date.now();
  return Math.ceil(diff / (24 * 3600 * 1000));
};

const RentalNoticesPage = () => {
  const [notices, setNotices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ rentalManagementId: '', plannedExitAt: '' });

  const load = async () => {
    setLoading(true);
    try {
      const res = await getRentalManagement({ occupancyStatus: 'sortie_programmee', limit: 100 });
      setNotices(res.rentals || []);
    } catch (err) {
      toast.error("Erreur lors du chargement des préavis.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!form.rentalManagementId || !form.plannedExitAt) { toast.error("Dossier et date de sortie requis."); return; }
    try {
      await startNotice(form.rentalManagementId, form.plannedExitAt);
      toast.success("Préavis créé.");
      setCreating(false);
      setForm({ rentalManagementId: '', plannedExitAt: '' });
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || "Erreur lors de la création du préavis.");
    }
  };

  const handleAcknowledge = async (id) => {
    try { await acknowledgeNotice(id); toast.success("Préavis accusé réception."); load(); }
    catch (err) { toast.error(err.response?.data?.message || "Erreur."); }
  };

  const handleCancel = async (id) => {
    if (!window.confirm("Annuler ce préavis ? Le locataire reste en place.")) return;
    try { await cancelNotice(id, "Annulé depuis le tableau de bord."); toast.success("Préavis annulé."); load(); }
    catch (err) { toast.error(err.response?.data?.message || "Erreur."); }
  };

  const handleValidateExit = async (id) => {
    try {
      await runRentalAction(id, 'validate-exit', {});
      toast.success("Sortie validée.");
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || "Erreur lors de la validation de sortie.");
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-6 bg-white rounded shadow-md">
      <div className="flex items-center justify-between mb-1 flex-wrap gap-2">
        <h2 className="text-2xl font-bold">Préavis</h2>
        <Link href="/dashboard/gestion-locative" className="text-sm text-blue-600 underline">Vue d'ensemble Gestion Locative</Link>
      </div>
      <p className="text-sm text-gray-500 mb-4">Sorties programmées en cours — dates saisies manuellement, jamais de délai légal codé en dur.</p>

      {!creating ? (
        <button onClick={() => setCreating(true)} className="mb-4 bg-gold text-white px-3 py-1.5 rounded text-sm">
          + Démarrer un préavis
        </button>
      ) : (
        <form onSubmit={handleCreate} className="bg-gray-50 border rounded p-4 mb-4 space-y-2">
          <p className="text-xs text-gray-500">ID du dossier de gestion locative (bien occupé) et date de sortie prévue.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <input placeholder="ID dossier (RentalManagement)" value={form.rentalManagementId}
              onChange={(e) => setForm((f) => ({ ...f, rentalManagementId: e.target.value }))} className="p-2 border rounded text-sm" />
            <input type="date" value={form.plannedExitAt}
              onChange={(e) => setForm((f) => ({ ...f, plannedExitAt: e.target.value }))} className="p-2 border rounded text-sm" />
          </div>
          <div className="flex gap-2">
            <button type="submit" className="bg-gold text-white px-3 py-1.5 rounded text-sm">Créer</button>
            <button type="button" onClick={() => setCreating(false)} className="text-gray-600 text-sm">Annuler</button>
          </div>
        </form>
      )}

      {loading ? (
        <p className="text-center text-gray-500 py-8">Chargement...</p>
      ) : notices.length === 0 ? (
        <p className="text-center text-gray-500 py-8">Aucun préavis en cours.</p>
      ) : (
        <div className="space-y-3">
          {notices.map((n) => {
            const jours = joursRestants(n.plannedExitAt);
            return (
              <div key={n._id} className="border rounded p-4">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <h3 className="font-semibold">{n.property?.title || 'Bien'}</h3>
                    <p className="text-xs text-gray-500">Locataire : {n.currentTenant ? `${n.currentTenant.prenom || ''} ${n.currentTenant.nom || ''}` : '—'}</p>
                    <p className="text-xs text-gray-500">Bail : {n.activeLease?._id || '—'}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold">Sortie prévue : {n.plannedExitAt ? new Date(n.plannedExitAt).toLocaleDateString('fr-FR') : '—'}</p>
                    {jours !== null && (
                      <span className={`text-xs font-semibold px-2 py-1 rounded ${jours < 0 ? 'bg-red-100 text-red-700' : jours <= 7 ? 'bg-orange-100 text-orange-800' : 'bg-blue-100 text-blue-800'}`}>
                        {jours < 0 ? `${Math.abs(jours)} jour(s) de retard` : `${jours} jour(s) restant(s)`}
                      </span>
                    )}
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {!n.noticeAcknowledgedAt && (
                    <button onClick={() => handleAcknowledge(n._id)} className="bg-blue-600 text-white px-3 py-1.5 rounded text-sm">Accuser réception</button>
                  )}
                  {n.noticeAcknowledgedAt && <span className="text-xs text-green-700 self-center">Réception accusée</span>}
                  <button onClick={() => handleValidateExit(n._id)} className="bg-green-600 text-white px-3 py-1.5 rounded text-sm">Valider la sortie</button>
                  <button onClick={() => handleCancel(n._id)} className="bg-gray-500 text-white px-3 py-1.5 rounded text-sm">Annuler le préavis</button>
                  <Link href="/dashboard/gestion-locative" className="text-sm text-blue-600 underline self-center">Documents →</Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default RentalNoticesPage;
