"use client";

import React, { useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import { allocateHotelPayment, confirmHotelPayment, createHotelPayment, listDocumentPayments, reverseHotelAllocation } from '../services/hotelFinancialService';

const money = (value) => `${Number(value || 0).toLocaleString('fr-FR')} XAF`;
const message = (error) => error.response?.data?.message || 'Opération d’encaissement impossible.';

export default function HotelPaymentPanel({ reservation, document, canManage = false, onChanged }) {
  const [payments, setPayments] = useState([]);
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('cash');
  const [reference, setReference] = useState('');
  const [allocationAmounts, setAllocationAmounts] = useState({});
  const load = async () => { if (!document?.id) return; try { const data = await listDocumentPayments(document.id); setPayments(data.payments || []); } catch (error) { toast.error(message(error)); } };
  useEffect(() => { load(); }, [document?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const run = async (action, success) => { try { await action(); await load(); await onChanged?.(); toast.success(success); } catch (error) { toast.error(message(error)); } };
  if (!document || document.status !== 'issued') return null;
  const create = () => run(() => createHotelPayment({ reservationId: reservation._id, financialDocumentId: document.id, amountMinor: Number(amount), method, reference }), 'Paiement créé.');
  return <div className="mt-3 rounded border bg-white p-3 text-xs" data-testid="hotel-payment-panel">
    <div className="flex flex-wrap gap-3"><strong>Encaissements</strong><span>Payé : {money(document.amountAllocatedMinor)}</span><span>Solde : {money(document.balanceMinor)}</span>{!canManage && <span className="text-gray-500">Lecture seule</span>}</div>
    {canManage && <div className="mt-2 flex flex-wrap gap-2"><input aria-label="Montant du paiement" type="number" min="1" className="w-36 border p-1" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="Montant XAF"/><select aria-label="Méthode de paiement" className="border p-1" value={method} onChange={(event) => setMethod(event.target.value)}><option value="cash">Espèces</option><option value="bank_transfer">Virement</option><option value="card">Carte manuelle</option><option value="mobile_money">Mobile Money manuel</option><option value="cheque">Chèque</option><option value="other">Autre</option></select><input aria-label="Référence du paiement" className="border p-1" value={reference} onChange={(event) => setReference(event.target.value)} placeholder="Référence"/><button disabled={!Number(amount)} onClick={create} className="rounded bg-gray-800 px-2 py-1 text-white disabled:opacity-40">Créer</button></div>}
    {!payments.length && <p className="mt-2 text-gray-500">Aucun paiement enregistré.</p>}
    <div className="mt-2 space-y-2">{payments.map((payment) => <div key={payment.id} className="rounded border p-2"><div className="flex flex-wrap gap-2"><strong>{money(payment.amountMinor)}</strong><span>{payment.status}</span><span>{payment.method}</span><span>{payment.paymentReference}</span><span>Alloué : {money(payment.allocatedAmountMinor)}</span><span>Disponible : {money(payment.availableAmountMinor)}</span></div>{canManage && payment.status === 'pending' && <button className="mt-1 rounded border px-2 py-1" onClick={() => run(() => confirmHotelPayment(payment.id), 'Paiement confirmé.')}>Confirmer</button>}{canManage && payment.status === 'succeeded' && payment.availableAmountMinor > 0 && document.balanceMinor > 0 && <div className="mt-1 flex gap-2"><input aria-label={`Allocation ${payment.id}`} type="number" min="1" max={Math.min(payment.availableAmountMinor, document.balanceMinor)} className="w-36 border p-1" value={allocationAmounts[payment.id] || ''} onChange={(event) => setAllocationAmounts((current) => ({ ...current, [payment.id]: event.target.value }))}/><button className="rounded border px-2 py-1" onClick={() => run(() => allocateHotelPayment(payment.id, document.id, Number(allocationAmounts[payment.id])), 'Allocation enregistrée.')}>Allouer</button></div>}{payment.status === 'succeeded' && payment.availableAmountMinor > 0 && <p className="mt-1 text-amber-700">Montant non alloué : {money(payment.availableAmountMinor)}</p>}<div className="mt-1 space-y-1">{payment.allocations.map((allocation) => <div key={allocation.id} className="flex flex-wrap gap-2"><span>{money(allocation.amountMinor)}</span><span>{allocation.status}</span>{allocation.reversalReason && <span>{allocation.reversalReason}</span>}{canManage && allocation.status === 'active' && <button className="underline" onClick={() => { const reason = window.prompt('Justification du renversement'); if (reason?.trim()) run(() => reverseHotelAllocation(allocation.id, reason), 'Allocation renversée.'); else toast.error('Une justification est obligatoire.'); }}>Renverser</button>}</div>)}</div></div>)}</div>
  </div>;
}
