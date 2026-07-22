"use client";

// Sprint GL-B2 — page réelle "Locataires" (remplace le placeholder Sprint 0).
// Identité, bien loué, bail, dates, loyer, statut, paiements, solde,
// prochain paiement, préavis actif. Recherche + pagination + fiche +
// navigation croisée vers la Gestion Locative.

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "react-hot-toast";
import { getLocataireDossiers } from "../../services/gestionLocativeService";
import { formatCurrencyXAF } from "../../utils/normalizePropertyDetail";
import TenantLinkManagement from "../../components/dashboard/TenantLinkManagement";

const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('fr-FR') : '—');

const RentalTenantsPage = () => {
  const [data, setData] = useState({ locataires: [], total: 0 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState(null);
  const limit = 20;

  const load = async () => {
    setLoading(true);
    try {
      const res = await getLocataireDossiers({ search: search || undefined, page, limit });
      setData(res);
    } catch (err) {
      toast.error("Erreur lors du chargement des locataires.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [page]);
  useEffect(() => {
    const t = setTimeout(() => { setPage(1); load(); }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const totalPages = Math.max(1, Math.ceil((data.total || 0) / limit));

  return (
    <div className="max-w-6xl mx-auto p-6 bg-white rounded shadow-md">
      <div className="flex items-center justify-between mb-1 flex-wrap gap-2">
        <h2 className="text-2xl font-bold">Locataires</h2>
        <Link href="/dashboard/gestion-locative" className="text-sm text-blue-600 underline">
          Vue d'ensemble Gestion Locative
        </Link>
      </div>
      <p className="text-sm text-gray-500 mb-4">Locataires enregistrés, bail et situation de paiement.</p>

      <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Rechercher un nom, email, téléphone..."
        aria-label="Rechercher" className="w-full mb-4 px-3 py-2 border rounded text-sm" />

      {loading ? (
        <p className="text-center text-gray-500 py-8">Chargement...</p>
      ) : data.locataires.length === 0 ? (
        <p className="text-center text-gray-500 py-8">Aucun locataire pour ces critères.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 border-b">
                <th className="py-2 pr-3">Locataire</th>
                <th className="py-2 pr-3">Contact</th>
                <th className="py-2 pr-3">Bien loué</th>
                <th className="py-2 pr-3">Bail</th>
                <th className="py-2 pr-3">Loyer</th>
                <th className="py-2 pr-3">Solde</th>
                <th className="py-2 pr-3">Préavis</th>
                <th className="py-2 pr-3"></th>
              </tr>
            </thead>
            <tbody>
              {data.locataires.map((t) => (
                <tr key={t._id} className="border-b hover:bg-gray-50 cursor-pointer" onClick={() => setSelected(t)}>
                  <td className="py-2 pr-3 font-medium">{t.prenom} {t.nom}</td>
                  <td className="py-2 pr-3 text-xs text-gray-500">{t.telephone}{t.email ? ` · ${t.email}` : ''}</td>
                  <td className="py-2 pr-3">{t.lease?.bien?.title || '—'}</td>
                  <td className="py-2 pr-3 text-xs">
                    {t.lease ? (
                      <>
                        <span className={`px-1.5 py-0.5 rounded text-xs font-semibold ${t.lease.statut === 'actif' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>{t.lease.statut}</span>
                        <div className="text-gray-500 mt-0.5">{fmtDate(t.lease.dateEntree)} → {fmtDate(t.lease.dateFinBail)}</div>
                      </>
                    ) : '—'}
                  </td>
                  <td className="py-2 pr-3">{t.lease?.montantLoyer ? formatCurrencyXAF(t.lease.montantLoyer) : '—'}</td>
                  <td className="py-2 pr-3">
                    {t.paymentSummary ? (
                      <span className={`font-semibold ${t.paymentSummary.remaining > 0 ? 'text-red-600' : 'text-green-600'}`}>
                        {formatCurrencyXAF(t.paymentSummary.remaining)}
                      </span>
                    ) : '—'}
                  </td>
                  <td className="py-2 pr-3">
                    {t.activeNotice ? (
                      <span className="text-xs font-semibold px-2 py-1 rounded bg-orange-100 text-orange-800">
                        Sortie le {fmtDate(t.activeNotice.plannedExitAt)}
                      </span>
                    ) : '—'}
                  </td>
                  <td className="py-2 pr-3 text-blue-600 text-xs underline">Voir</td>
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

      {selected && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setSelected(null)}>
          <div className="bg-white rounded-lg max-w-lg w-full p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-start mb-4">
              <h3 className="text-lg font-bold">{selected.prenom} {selected.nom}</h3>
              <button onClick={() => setSelected(null)} className="text-gray-400">✕</button>
            </div>
            <div className="space-y-2 text-sm">
              <p><span className="text-gray-500">Téléphone :</span> {selected.telephone}</p>
              <p><span className="text-gray-500">Email :</span> {selected.email || '—'}</p>
              <p><span className="text-gray-500">Bien loué :</span> {selected.lease?.bien?.title || '—'}</p>
              <p><span className="text-gray-500">Bail :</span> {selected.lease ? `${fmtDate(selected.lease.dateEntree)} → ${fmtDate(selected.lease.dateFinBail)} (${selected.lease.statut})` : '—'}</p>
              <p><span className="text-gray-500">Loyer :</span> {selected.lease?.montantLoyer ? formatCurrencyXAF(selected.lease.montantLoyer) : '—'}</p>
              {selected.paymentSummary && (
                <>
                  <p><span className="text-gray-500">Attendu :</span> {formatCurrencyXAF(selected.paymentSummary.expected)}</p>
                  <p><span className="text-gray-500">Encaissé :</span> {formatCurrencyXAF(selected.paymentSummary.paid)}</p>
                  <p><span className="text-gray-500">Solde :</span> {formatCurrencyXAF(selected.paymentSummary.remaining)}</p>
                  <p><span className="text-gray-500">Prochain paiement :</span> {fmtDate(selected.paymentSummary.nextDueAt)}</p>
                </>
              )}
              {selected.activeNotice && (
                <p className="text-orange-700"><span className="text-gray-500">Préavis actif :</span> sortie prévue le {fmtDate(selected.activeNotice.plannedExitAt)}</p>
              )}
            </div>
            <div className="flex gap-2 mt-4">
              <Link href="/dashboard/gestion-locative" className="text-sm text-blue-600 underline">Voir dans la Gestion Locative →</Link>
            </div>
          </div>
        </div>
      )}
      <TenantLinkManagement />
    </div>
  );
};

export default RentalTenantsPage;
