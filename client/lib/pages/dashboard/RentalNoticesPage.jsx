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
import { Clock } from "lucide-react";
import {
  getRentalManagement, runRentalAction, acknowledgeNotice, cancelNotice, startNotice,
} from "../../services/gestionLocativeService";
import {
  DashboardPage, DashboardPageHeader, DashboardCard, DashboardState,
} from "../../components/dashboard/DashboardUI";

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
    <DashboardPage>
      <DashboardPageHeader
        icon={Clock}
        title="Préavis"
        description="Sorties programmées en cours — dates saisies manuellement, jamais de délai légal codé en dur."
        actions={(
          <Link href="/dashboard/gestion-locative" className="text-sm text-blue-600 underline">
            Vue d'ensemble Gestion Locative
          </Link>
        )}
      />

      {!creating ? (
        <button onClick={() => setCreating(true)} className="mb-4 bg-gold text-white px-3 py-1.5 rounded-lg text-sm font-medium hover:opacity-90 transition-opacity">
          + Démarrer un préavis
        </button>
      ) : (
        <DashboardCard className="mb-4 space-y-2">
          <form onSubmit={handleCreate} className="space-y-2">
          <p className="text-xs text-gray-500">ID du dossier de gestion locative (bien occupé) et date de sortie prévue.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <input placeholder="ID dossier (RentalManagement)" value={form.rentalManagementId}
              onChange={(e) => setForm((f) => ({ ...f, rentalManagementId: e.target.value }))} className="p-2 border rounded-lg text-sm" />
            <input type="date" value={form.plannedExitAt}
              onChange={(e) => setForm((f) => ({ ...f, plannedExitAt: e.target.value }))} className="p-2 border rounded-lg text-sm" />
          </div>
          <div className="flex gap-2">
            <button type="submit" className="bg-gold text-white px-3 py-1.5 rounded-lg text-sm font-medium hover:opacity-90 transition-opacity">Créer</button>
            <button type="button" onClick={() => setCreating(false)} className="text-gray-600 text-sm">Annuler</button>
          </div>
          </form>
        </DashboardCard>
      )}

      {loading ? (
        <DashboardState type="loading" title="Chargement des préavis…" />
      ) : notices.length === 0 ? (
        <DashboardState title="Aucun préavis" description="Aucun préavis en cours." />
      ) : (
        <div className="space-y-3">
          {notices.map((n) => {
            const jours = joursRestants(n.plannedExitAt);
            return (
              <DashboardCard key={n._id}>
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
              </DashboardCard>
            );
          })}
        </div>
      )}
    </DashboardPage>
  );
};

export default RentalNoticesPage;
