"use client";

// F-U2.10 — Échéances de loyer du locataire : période, échéance (le 5 du mois
// suivant), payé, solde, pénalité prévisionnelle, signalement d'une
// difficulté de paiement. Le signalement n'annule ni la dette ni la pénalité.
import React, { useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import { getTenantRentDues, reportTenantPaymentDifficulty, respondToDirectReceipt } from '../../services/tenantPortalService';

const money = (value = 0) => `${Number(value || 0).toLocaleString('fr-FR')} FCFA`;
const date = (value) => (value ? new Date(value).toLocaleDateString('fr-FR', { timeZone: 'Africa/Brazzaville' }) : '—');
const REPORT_STATUS = { submitted: 'transmis, en attente d’examen', acknowledged: 'pris en compte', deferral_approved: 'report de paiement accordé', closed: 'clôturé' };

export default function TenantRentDuesPanel() {
  const [state, setState] = useState({ loading: true, items: [], error: null });
  const [openFor, setOpenFor] = useState(null);
  const [form, setForm] = useState({ reason: '', proposedPaymentDate: '' });
  const [saving, setSaving] = useState(false);
  const load = () => getTenantRentDues()
    .then(({ items }) => setState({ loading: false, items, error: null }))
    .catch((error) => setState({ loading: false, items: [], error: error?.response?.data?.message || 'Échéances indisponibles.' }));
  useEffect(() => { load(); }, []);

  const submit = async (event) => {
    event.preventDefault(); setSaving(true);
    try {
      await reportTenantPaymentDifficulty(openFor, form);
      toast.success('Signalement transmis. Le loyer reste dû.');
      setOpenFor(null); setForm({ reason: '', proposedPaymentDate: '' });
      await load();
    } catch (error) { toast.error(error?.response?.data?.message || 'Signalement refusé.'); } finally { setSaving(false); }
  };

  const respond = async (receiptId, decision) => {
    const reason = decision === 'contest' ? window.prompt('Motif de la contestation :') : null;
    if (decision === 'contest' && !reason) return;
    try { await respondToDirectReceipt(receiptId, { decision, reason }); toast.success(decision === 'confirm' ? 'Paiement confirmé.' : 'Contestation enregistrée.'); await load(); }
    catch (error) { toast.error(error?.response?.data?.message || 'Action refusée.'); }
  };

  if (state.loading) return <p className="text-slate-500">Chargement…</p>;
  if (state.error) return <p role="alert" className="text-red-700">{state.error}</p>;
  if (!state.items.length) return <p className="text-slate-500">Aucune échéance de loyer.</p>;
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="mb-1 text-lg font-bold text-slate-900">Mes échéances de loyer</h2>
      <p className="mb-4 text-sm text-slate-500">Les échéances, tolérances et éventuelles pénalités sont celles prévues par votre bail.</p>
      <ul className="divide-y divide-slate-100">
        {state.items.map((item) => (
          <li key={item.id} className="py-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-semibold text-slate-900">Loyer {item.period}{item.documentNumber ? ` · ${item.documentNumber}` : ''}{item.trackingObligation ? ' · échéance de suivi du bailleur' : ''}</p>
                <p className="text-sm text-slate-600">Échéance : {item.dueDate ? date(item.dueDate) : 'non stipulée par le bail'} · Loyer : {money(item.rentMinor)}{item.chargesMinor ? ` · Charges : ${money(item.chargesMinor)}` : ''}</p>
                <p className="text-sm text-slate-600">Déjà payé (confirmé) : {money(item.paidMinor)} · <strong>Solde : {money(item.balanceMinor)}</strong>{item.declaredPendingMinor ? ` · déclaré reçu par le bailleur, en attente de confirmation : ${money(item.declaredPendingMinor)}` : ''}</p>
                {item.penalty?.penaltyMinor > 0 && <p className="text-sm text-amber-800">Pénalité de retard prévisionnelle prévue par votre bail : {money(item.penalty.penaltyMinor)} — non exigible à ce stade.</p>}
                {item.difficultyReport && <p className="text-sm text-blue-800">Difficulté signalée le {date(item.difficultyReport.declaredAt)} : {REPORT_STATUS[item.difficultyReport.status] || item.difficultyReport.status}. Le loyer reste dû.</p>}
                {(item.directReceipts || []).map((receipt) => (
                  <div key={receipt.id} className="mt-1 flex flex-wrap items-center gap-2 text-sm text-slate-700">
                    <span>Votre bailleur déclare avoir reçu {money(receipt.amountMinor)} le {date(receipt.receivedAt)}{receipt.canRespond ? '' : ` · ${receipt.status === 'CONFIRMED' ? 'confirmé' : receipt.status === 'CONTESTED' ? 'contesté' : 'annulé'}`}</span>
                    {receipt.canRespond && <><button onClick={() => respond(receipt.id, 'confirm')} className="rounded-lg border border-blue-700 px-3 py-1 text-blue-700">Je confirme ce paiement</button><button onClick={() => respond(receipt.id, 'contest')} className="rounded-lg border px-3 py-1">Contester</button></>}
                  </div>
                ))}
                {item.payments.length > 0 && <p className="text-xs text-slate-500">Paiements confirmés : {item.payments.map((p) => `${money(p.amountMinor)} le ${date(p.confirmedAt)}`).join(' · ')}</p>}
              </div>
              {item.canReportDifficulty && openFor !== item.id && (
                <button onClick={() => setOpenFor(item.id)} className="rounded-xl border border-blue-700 px-4 py-2 text-sm font-semibold text-blue-700">Signaler une difficulté de paiement</button>
              )}
            </div>
            {openFor === item.id && (
              <form onSubmit={submit} className="mt-3 grid gap-3 rounded-xl bg-slate-50 p-4" aria-label={`Signalement ${item.period}`}>
                <label className="text-sm">Explication (facultative)<textarea maxLength={1000} value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} className="mt-1 block w-full rounded-xl border p-3" /></label>
                <label className="text-sm">Date de règlement proposée (facultative)<input type="date" value={form.proposedPaymentDate} onChange={(e) => setForm({ ...form, proposedPaymentDate: e.target.value })} className="mt-1 block rounded-xl border p-2" /></label>
                <p className="text-xs text-slate-500">Ce signalement n’annule ni le loyer ni une éventuelle pénalité et ne vaut pas report de paiement.</p>
                <div className="flex gap-2">
                  <button disabled={saving} className="rounded-xl bg-blue-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">Envoyer le signalement</button>
                  <button type="button" onClick={() => setOpenFor(null)} className="rounded-xl border px-4 py-2 text-sm">Annuler</button>
                </div>
              </form>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
