'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { listRealEstateApplications, submitRealEstateApplication, withdrawRealEstateApplication } from '@/lib/services/realEstateApplicationService';

const labels = { submitted: 'Soumis', under_review: 'En étude', accepted: 'Accepté', rejected: 'Rejeté', withdrawn: 'Retiré', expired: 'Expiré', not_selected: 'Non retenu' };

function RealEstateApplicationsContent() {
  const search = useSearchParams();
  const propertyId = search.get('propertyId') || '';
  const kind = search.get('kind') === 'rental_application' ? 'rental_application' : 'purchase_offer';
  const [rows, setRows] = useState([]);
  const [form, setForm] = useState({ amount: '', desiredMoveIn: '', desiredDurationMonths: 12, occupants: 1, message: '', validUntil: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const canSubmit = useMemo(() => propertyId && form.validUntil && (kind === 'rental_application' || Number(form.amount) > 0), [form, kind, propertyId]);
  const refresh = async () => { try { const result = await listRealEstateApplications(); setRows(result.applications); } catch (e) { setError(e.response?.data?.message || 'Chargement impossible.'); } };
  useEffect(() => { refresh(); }, []);

  const submit = async (event) => {
    event.preventDefault(); if (!canSubmit || busy) return;
    setBusy(true); setError('');
    try {
      await submitRealEstateApplication({ propertyId, validUntil: form.validUntil, message: form.message, ...(kind === 'purchase_offer' ? { amount: Number(form.amount), currency: 'XAF' } : { desiredMoveIn: form.desiredMoveIn, desiredDurationMonths: Number(form.desiredDurationMonths), occupants: Number(form.occupants) }) });
      await refresh();
    } catch (e) { setError(e.response?.data?.message || 'Envoi impossible.'); } finally { setBusy(false); }
  };

  return <main className="mx-auto min-h-screen max-w-4xl px-4 py-10">
    <h1 className="text-3xl font-semibold">Mes dossiers immobiliers</h1>
    {propertyId && <form onSubmit={submit} className="mt-8 grid gap-4 rounded-xl border bg-white p-5" aria-busy={busy}>
      <h2 className="text-xl font-medium">{kind === 'purchase_offer' ? 'Soumettre une offre' : 'Déposer une candidature'}</h2>
      {kind === 'purchase_offer' ? <input aria-label="Montant proposé" type="number" min="1" required placeholder="Montant proposé (XAF)" className="rounded border p-3" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} /> : <>
        <input aria-label="Date d’entrée" type="date" required className="rounded border p-3" value={form.desiredMoveIn} onChange={(e) => setForm({ ...form, desiredMoveIn: e.target.value })} />
        <input aria-label="Durée souhaitée" type="number" min="1" max="120" required className="rounded border p-3" value={form.desiredDurationMonths} onChange={(e) => setForm({ ...form, desiredDurationMonths: e.target.value })} />
        <input aria-label="Nombre d’occupants" type="number" min="1" max="20" required className="rounded border p-3" value={form.occupants} onChange={(e) => setForm({ ...form, occupants: e.target.value })} />
      </>}
      <input aria-label="Valable jusqu’au" type="datetime-local" required className="rounded border p-3" value={form.validUntil} onChange={(e) => setForm({ ...form, validUntil: e.target.value })} />
      <textarea aria-label="Message" maxLength={3000} placeholder="Message (facultatif)" className="rounded border p-3" value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} />
      <button disabled={!canSubmit || busy} className="rounded bg-blue-700 px-5 py-3 text-white disabled:opacity-50">{busy ? 'Envoi…' : 'Envoyer le dossier'}</button>
    </form>}
    {error && <p role="alert" className="mt-5 rounded bg-red-50 p-3 text-red-800">{error}</p>}
    <section className="mt-8 grid gap-3" aria-live="polite">
      {!rows.length ? <p className="rounded border p-6 text-gray-600">Aucun dossier.</p> : rows.map((row) => <article key={row._id} className="rounded-xl border bg-white p-5">
        <div className="flex flex-wrap justify-between gap-3"><h2 className="font-medium">{row.property?.title || 'Bien immobilier'}</h2><span>{labels[row.status] || row.status}</span></div>
        {['submitted', 'under_review'].includes(row.status) && <button disabled={busy} onClick={async () => { setBusy(true); try { await withdrawRealEstateApplication(row._id); await refresh(); } finally { setBusy(false); } }} className="mt-4 underline">Retirer le dossier</button>}
      </article>)}
    </section>
  </main>;
}

export default function RealEstateApplicationsPage() {
  return <Suspense fallback={<main className="mx-auto max-w-4xl px-4 py-10">Chargement…</main>}><RealEstateApplicationsContent /></Suspense>;
}
