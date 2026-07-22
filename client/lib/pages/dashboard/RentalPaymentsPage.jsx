"use client";

// Sprint GL-B2 — page réelle "Paiements locatifs" (remplace le placeholder
// Sprint 0). Distinct des paiements de visite (/dashboard/paiements) et des
// paiements hôteliers (réservations). Échéances, paiement partiel/complet,
// solde, retards, historique, référence, statistiques d'encaissement.
// Tous les calculs (pénalités, solde, taux d'encaissement) sont faits
// côté serveur — jamais recalculés ici.

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "react-hot-toast";
import {
  getPaiementsPage, getPaiementsStats, marquerPaiementPaye, calculerPenalites,
} from "../../services/gestionLocativeService";
import { formatCurrencyXAF } from "../../utils/normalizePropertyDetail";

const STATUT_CLASSES = {
  'payé': 'bg-green-100 text-green-800',
  'partiel': 'bg-amber-100 text-amber-800',
  'en_retard': 'bg-orange-100 text-orange-800',
  'impayé': 'bg-red-100 text-red-700',
};
const STATUT_LABELS = { 'payé': 'Payé', 'partiel': 'Partiel', 'en_retard': 'En retard', 'impayé': 'Impayé' };

const RentalPaymentsPage = () => {
  const [data, setData] = useState({ paiements: [], total: 0 });
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [statut, setStatut] = useState('');
  const [page, setPage] = useState(1);
  const [payingId, setPayingId] = useState(null);
  const [payForm, setPayForm] = useState({ montantRecu: '', modePaiement: 'espèces', reference: '' });
  const limit = 20;

  const load = async () => {
    setLoading(true);
    try {
      const [pageRes, statsRes] = await Promise.all([
        getPaiementsPage({ statut: statut || undefined, page, limit }),
        getPaiementsStats(),
      ]);
      setData(pageRes);
      setStats(statsRes);
    } catch (err) {
      toast.error("Erreur lors du chargement des paiements.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [statut, page]);

  const totalPages = Math.max(1, Math.ceil((data.total || 0) / limit));

  const handleMarquerPaye = async (id) => {
    try {
      await marquerPaiementPaye(id, {
        montantRecu: Number(payForm.montantRecu) || undefined,
        modePaiement: payForm.modePaiement,
        reference: payForm.reference,
      });
      toast.success("Paiement enregistré.");
      setPayingId(null);
      setPayForm({ montantRecu: '', modePaiement: 'espèces', reference: '' });
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || "Erreur lors de l'enregistrement.");
    }
  };

  const handleRecalculerPenalites = async () => {
    try {
      await calculerPenalites();
      toast.success("Pénalités recalculées.");
      load();
    } catch (err) {
      toast.error("Erreur lors du calcul des pénalités.");
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-6 bg-white rounded shadow-md">
      <div className="flex items-center justify-between mb-1 flex-wrap gap-2">
        <h2 className="text-2xl font-bold">Paiements locatifs</h2>
        <Link href="/dashboard/gestion-locative" className="text-sm text-blue-600 underline">Vue d'ensemble Gestion Locative</Link>
      </div>
      <p className="text-sm text-gray-500 mb-4">Loyers et échéances par bail — distinct des paiements de visite et hôteliers.</p>

      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-6">
          <div className="border rounded p-3 bg-blue-50">
            <div className="text-lg font-bold">{formatCurrencyXAF(stats.totalAttendu)}</div>
            <div className="text-xs text-gray-500">Attendu</div>
          </div>
          <div className="border rounded p-3 bg-green-50">
            <div className="text-lg font-bold">{formatCurrencyXAF(stats.totalEncaisse)}</div>
            <div className="text-xs text-gray-500">Encaissé ({stats.tauxEncaissement}%)</div>
          </div>
          <div className="border rounded p-3 bg-red-50">
            <div className="text-lg font-bold">{formatCurrencyXAF(stats.totalImpaye)}</div>
            <div className="text-xs text-gray-500">Impayé</div>
          </div>
          <div className="border rounded p-3 bg-gray-50">
            <div className="text-lg font-bold">{stats.nbImpayes}</div>
            <div className="text-xs text-gray-500">Échéances impayées</div>
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-2 mb-4">
        {[{ v: '', l: 'Tous' }, { v: 'payé', l: 'Payé' }, { v: 'partiel', l: 'Partiel' }, { v: 'en_retard', l: 'En retard' }, { v: 'impayé', l: 'Impayé' }].map((s) => (
          <button key={s.v} onClick={() => { setStatut(s.v); setPage(1); }}
            className={`px-3 py-1.5 rounded text-sm font-medium ${statut === s.v ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-700"}`}>
            {s.l}
          </button>
        ))}
        <button onClick={handleRecalculerPenalites} className="ml-auto bg-gold text-white px-3 py-1.5 rounded text-sm">
          Recalculer les pénalités
        </button>
      </div>

      {loading ? (
        <p className="text-center text-gray-500 py-8">Chargement...</p>
      ) : data.paiements.length === 0 ? (
        <p className="text-center text-gray-500 py-8">Aucun paiement pour ces critères.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 border-b">
                <th className="py-2 pr-3">Locataire</th>
                <th className="py-2 pr-3">Échéance</th>
                <th className="py-2 pr-3">Montant</th>
                <th className="py-2 pr-3">Pénalité</th>
                <th className="py-2 pr-3">Statut</th>
                <th className="py-2 pr-3">Référence</th>
                <th className="py-2 pr-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {data.paiements.map((p) => (
                <tr key={p._id} className="border-b hover:bg-gray-50">
                  <td className="py-2 pr-3">{p.contrat?.locataire ? `${p.contrat.locataire.prenom || ''} ${p.contrat.locataire.nom || ''}` : '—'}</td>
                  <td className="py-2 pr-3">{p.mois}/{p.annee}</td>
                  <td className="py-2 pr-3">{formatCurrencyXAF(p.montantTotal || p.montant)}</td>
                  <td className="py-2 pr-3">{p.penaliteAppliquee ? formatCurrencyXAF(p.penaliteMontant) : '—'}</td>
                  <td className="py-2 pr-3">
                    <span className={`text-xs font-semibold px-2 py-1 rounded ${STATUT_CLASSES[p.statut]}`}>{STATUT_LABELS[p.statut]}</span>
                  </td>
                  <td className="py-2 pr-3 text-xs text-gray-500">{p.reference || '—'}</td>
                  <td className="py-2 pr-3">
                    {p.statut !== 'payé' && (
                      payingId === p._id ? (
                        <div className="flex flex-wrap gap-1 items-center">
                          <input type="number" placeholder="Montant reçu" value={payForm.montantRecu}
                            onChange={(e) => setPayForm((f) => ({ ...f, montantRecu: e.target.value }))} className="w-24 text-xs border rounded px-1 py-1" />
                          <button onClick={() => handleMarquerPaye(p._id)} className="bg-green-600 text-white px-2 py-1 rounded text-xs">Confirmer</button>
                          <button onClick={() => setPayingId(null)} className="text-gray-500 text-xs">Annuler</button>
                        </div>
                      ) : (
                        <button onClick={() => setPayingId(p._id)} className="bg-blue-600 text-white px-2 py-1 rounded text-xs">Marquer payé</button>
                      )
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
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

export default RentalPaymentsPage;
