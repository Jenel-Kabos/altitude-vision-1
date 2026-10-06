"use client";

// Sprint GL-B2 — page réelle "Locataires" (remplace le placeholder Sprint 0).
// Identité, bien loué, bail, dates, loyer, statut, paiements, solde,
// prochain paiement, préavis actif. Recherche + pagination + fiche +
// navigation croisée vers la Gestion Locative.

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "react-hot-toast";
import { Users } from "lucide-react";
import { createLocataire, getLocataireDossiers, updateLocataire } from "../../services/gestionLocativeService";
import { formatCurrencyXAF } from "../../utils/normalizePropertyDetail";
import TenantLinkManagement from "../../components/dashboard/TenantLinkManagement";
import { DashboardPage, DashboardPageHeader, DashboardState } from "../../components/dashboard/DashboardUI";
import { useRentalOperationContext } from "../../context/RentalOperationContext";
import { callWithRentalContext, isIndividualRentalContext, rentalBasePath } from "../../services/rentalRequestContext";

const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('fr-FR') : '—');

const RentalTenantsPage = () => {
  const rentalContext = useRentalOperationContext();
  const [data, setData] = useState({ locataires: [], total: 0 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState(null);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const emptyForm = { nom: '', prenom: '', telephone: '', email: '' };
  const [form, setForm] = useState(emptyForm);
  const limit = 20;

  const load = async () => {
    setLoading(true);
    try {
      const res = await callWithRentalContext(getLocataireDossiers, rentalContext, { search: search || undefined, page, limit });
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

  const openCreate = () => { setEditing('new'); setForm(emptyForm); };
  const openEdit = (tenant) => {
    setSelected(null); setEditing(tenant._id);
    setForm({ nom: tenant.nom || '', prenom: tenant.prenom || '', telephone: tenant.telephone || '', email: tenant.email || '' });
  };
  const saveTenant = async (event) => {
    event.preventDefault(); setSaving(true);
    try {
      if (editing === 'new') await callWithRentalContext(createLocataire, rentalContext, form);
      else await callWithRentalContext(updateLocataire, rentalContext, editing, form);
      toast.success(editing === 'new' ? 'Locataire créé.' : 'Locataire mis à jour.');
      setEditing(null); setForm(emptyForm); await load();
    } catch (error) { toast.error(error.response?.data?.message || 'Impossible d’enregistrer le locataire.'); }
    finally { setSaving(false); }
  };

  return (
    <DashboardPage>
      <DashboardPageHeader
        icon={Users}
        title="Locataires"
        description="Locataires enregistrés, bail et situation de paiement."
        actions={(
          <Link href={rentalBasePath(rentalContext)} className="text-sm text-blue-600 underline">
            Vue d'ensemble Gestion Locative
          </Link>
        )}
      />

      <button onClick={openCreate} className="mb-4 rounded-lg bg-emerald-700 px-3 py-2 text-sm font-medium text-white">+ Nouveau locataire</button>

      {editing && (
        <form onSubmit={saveTenant} className="mb-4 grid gap-2 rounded-xl border bg-white p-4 sm:grid-cols-2">
          <input required aria-label="Nom du locataire" placeholder="Nom" value={form.nom} onChange={(e) => setForm((f) => ({ ...f, nom: e.target.value }))} className="rounded-lg border px-3 py-2" />
          <input required aria-label="Prénom du locataire" placeholder="Prénom" value={form.prenom} onChange={(e) => setForm((f) => ({ ...f, prenom: e.target.value }))} className="rounded-lg border px-3 py-2" />
          <input required aria-label="Téléphone du locataire" placeholder="Téléphone" value={form.telephone} onChange={(e) => setForm((f) => ({ ...f, telephone: e.target.value }))} className="rounded-lg border px-3 py-2" />
          <input type="email" aria-label="Email du locataire" placeholder="Email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} className="rounded-lg border px-3 py-2" />
          <div className="flex gap-2"><button disabled={saving} className="rounded-lg bg-emerald-700 px-3 py-2 text-sm text-white disabled:opacity-50">Enregistrer</button><button type="button" onClick={() => setEditing(null)} className="text-sm text-gray-600">Annuler</button></div>
        </form>
      )}

      <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Rechercher un nom, email, téléphone..."
        aria-label="Rechercher" className="w-full mb-4 px-3 py-2 border rounded text-sm" />

      {loading ? (
        <DashboardState type="loading" title="Chargement des locataires…" />
      ) : data.locataires.length === 0 ? (
        <DashboardState title="Aucun locataire" description="Aucun locataire pour ces critères." />
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
              <Link href={rentalBasePath(rentalContext)} className="text-sm text-blue-600 underline">Voir dans la Gestion Locative →</Link>
              <button onClick={() => openEdit(selected)} className="text-sm text-emerald-700 underline">Modifier</button>
            </div>
          </div>
        </div>
      )}
      {!isIndividualRentalContext(rentalContext) && <TenantLinkManagement />}
    </DashboardPage>
  );
};

export default RentalTenantsPage;
