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
import { CreditCard, Wallet, AlertTriangle, Clock, RefreshCw } from "lucide-react";
import {
  getPaiementsPage, getPaiementsStats, marquerPaiementPaye, calculerPenalites,
} from "../../services/gestionLocativeService";
import { formatCurrencyXAF } from "../../utils/normalizePropertyDetail";
import {
  DashboardPage, DashboardPageHeader, DashboardToolbar, DashboardCard, DashboardState, DashboardPagination,
} from "../../components/dashboard/DashboardUI";

const KPI_ITEMS = [
  { key: 'totalAttendu', label: 'Attendu', Icon: Wallet, color: '#2563EB', format: (s) => formatCurrencyXAF(s.totalAttendu) },
  { key: 'totalEncaisse', label: (s) => `Encaissé (${s.tauxEncaissement}%)`, Icon: CreditCard, color: '#16A34A', format: (s) => formatCurrencyXAF(s.totalEncaisse) },
  { key: 'totalImpaye', label: 'Impayé', Icon: AlertTriangle, color: '#DC2626', format: (s) => formatCurrencyXAF(s.totalImpaye) },
  { key: 'nbImpayes', label: 'Échéances impayées', Icon: Clock, color: '#6B7280', format: (s) => s.nbImpayes },
];

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
  const [payForm, setPayForm] = useState({ montantRecu: '', datePaiement: '', modePaiement: 'espèces', reference: '', preuve: null });
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
        datePaiement: payForm.datePaiement || undefined,
        modePaiement: payForm.modePaiement,
        reference: payForm.reference,
        preuve: payForm.preuve,
      });
      toast.success("Paiement enregistré.");
      setPayingId(null);
      setPayForm({ montantRecu: '', datePaiement: '', modePaiement: 'espèces', reference: '', preuve: null });
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
    <DashboardPage>
      <DashboardPageHeader
        icon={CreditCard}
        title="Paiements locatifs"
        description="Loyers et échéances par bail — distinct des paiements de visite et hôteliers."
        actions={(
          <Link href="/dashboard/gestion-locative" className="text-sm text-blue-600 underline">
            Vue d'ensemble Gestion Locative
          </Link>
        )}
      />

      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          {KPI_ITEMS.map(({ key, label, Icon, color, format }) => (
            <DashboardCard key={key} className="flex items-center gap-3">
              <span className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: `${color}18` }}>
                <Icon size={17} style={{ color }} />
              </span>
              <div>
                <p className="text-2xl font-bold leading-none" style={{ color, fontFamily: "'Cormorant Garamond', serif" }}>{format(stats)}</p>
                <p className="text-xs mt-1 text-gray-500">{typeof label === 'function' ? label(stats) : label}</p>
              </div>
            </DashboardCard>
          ))}
        </div>
      )}

      <DashboardToolbar label="Filtrer les paiements">
        <div className="flex flex-wrap gap-2 items-center w-full">
          {[{ v: '', l: 'Tous' }, { v: 'payé', l: 'Payé' }, { v: 'partiel', l: 'Partiel' }, { v: 'en_retard', l: 'En retard' }, { v: 'impayé', l: 'Impayé' }].map((s) => (
            <button key={s.v} onClick={() => { setStatut(s.v); setPage(1); }}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${statut === s.v ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"}`}>
              {s.l}
            </button>
          ))}
          <button onClick={handleRecalculerPenalites}
            className="ml-auto inline-flex items-center gap-1.5 bg-gold text-white px-3 py-1.5 rounded-lg text-sm font-medium hover:opacity-90 transition-opacity">
            <RefreshCw size={14} />
            Recalculer les pénalités
          </button>
        </div>
      </DashboardToolbar>

      {loading ? (
        <DashboardState type="loading" title="Chargement des paiements…" />
      ) : data.paiements.length === 0 ? (
        <DashboardState title="Aucun paiement" description="Aucun paiement pour ces critères." />
      ) : (
        <DashboardCard className="overflow-x-auto">
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
                          <input type="date" value={payForm.datePaiement}
                            onChange={(e) => setPayForm((f) => ({ ...f, datePaiement: e.target.value }))} className="text-xs border rounded px-1 py-1" />
                          <input type="file" accept="image/jpeg,image/png,image/webp,application/pdf"
                            onChange={(e) => setPayForm((f) => ({ ...f, preuve: e.target.files?.[0] || null }))} className="text-xs w-32" />
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
        </DashboardCard>
      )}

      {totalPages > 1 && (
        <DashboardPagination
          page={page}
          totalPages={totalPages}
          onPrevious={() => setPage((p) => p - 1)}
          onNext={() => setPage((p) => p + 1)}
        />
      )}
    </DashboardPage>
  );
};

export default RentalPaymentsPage;
