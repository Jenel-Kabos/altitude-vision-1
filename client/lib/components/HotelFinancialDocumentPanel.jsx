"use client";

import React, { useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import {
  createReservationInvoiceDraft, finalizeInvoiceLines,
  getReservationFinancialDocument, issueInvoice,
  refreshInvoiceFromReservation, updateInvoiceDraftLines,
} from '../services/hotelFinancialService';
import HotelPaymentPanel from './HotelPaymentPanel';
import HotelInvoiceDeliveryPanel from './HotelInvoiceDeliveryPanel';

const money = (value, currency) => `${Number(value || 0).toLocaleString('fr-FR')} ${currency || 'XAF'}`;
const errorMessage = (error) => error.response?.data?.message || 'Opération financière impossible.';

export default function HotelFinancialDocumentPanel({ reservation, canManage = false }) {
  const [document, setDocument] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [lines, setLines] = useState([]);
  const reservationId = reservation._id;

  const load = async () => {
    setLoading(true);
    try { const value = await getReservationFinancialDocument(reservationId); setDocument(value); setLines(value?.lines || []); }
    catch (error) { if (error.response?.status !== 403) toast.error(errorMessage(error)); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, [reservationId]); // eslint-disable-line react-hooks/exhaustive-deps

  const run = async (action, success) => {
    try { const value = await action(); setDocument(value.document || value); setLines((value.document || value).lines || lines); toast.success(success); }
    catch (error) { toast.error(errorMessage(error)); }
  };
  const create = () => run(() => createReservationInvoiceDraft(reservationId), 'Brouillon financier prêt.');
  const save = () => run(async () => { const value = await updateInvoiceDraftLines(document.id, lines); setEditing(false); return value; }, 'Lignes enregistrées.');

  if (loading) return <p className="mt-2 text-xs text-gray-400">Chargement de la facture...</p>;
  if (!document) return (
    <div className="mt-2 rounded border border-dashed p-2 text-xs">
      <span>Aucun document financier</span>
      {canManage && reservation.status === 'confirmed' && <button onClick={create} className="ml-2 rounded bg-gray-800 px-2 py-1 text-white">Créer le brouillon</button>}
      {!canManage && <span className="ml-2 text-gray-500">Accès en lecture seule</span>}
    </div>
  );

  const finalized = document.metadata?.linesFinalized === true;
  const draft = document.status === 'draft';
  return (
    <>
    <div className="mt-2 rounded border bg-gray-50 p-3 text-xs" data-testid="hotel-financial-document">
      <div className="flex flex-wrap items-center gap-2">
        <strong>{document.documentNumber || 'Facture en brouillon'}</strong>
        <span>{money(document.totalMinor, document.currency)}</span>
        <span className="rounded bg-white px-2 py-1">{document.status}</span>
        <span>{finalized ? 'Lignes finalisées' : 'Brouillon non finalisé'}</span>
        {!canManage && <span className="text-gray-500">Lecture seule</span>}
      </div>
      {editing && <div className="mt-2 space-y-2">{lines.map((line, index) => <div key={line.id || index} className="flex gap-2"><input aria-label={`Description ligne ${index + 1}`} className="flex-1 border p-1" value={line.description} onChange={(e) => setLines((current) => current.map((item, i) => i === index ? { ...item, description: e.target.value } : item))} /><input aria-label={`Quantité ligne ${index + 1}`} className="w-20 border p-1" type="number" min="1" value={line.quantity} onChange={(e) => setLines((current) => current.map((item, i) => i === index ? { ...item, quantity: Number(e.target.value) } : item))} /></div>)}<button onClick={save} className="rounded bg-blue-700 px-2 py-1 text-white">Enregistrer</button></div>}
      {canManage && draft && !editing && <div className="mt-2 flex flex-wrap gap-2"><button onClick={() => setEditing(true)} className="rounded border px-2 py-1">Modifier</button><button onClick={() => run(() => refreshInvoiceFromReservation(document.id), 'Brouillon actualisé.')} className="rounded border px-2 py-1">Actualiser depuis la réservation</button><button onClick={() => run(() => finalizeInvoiceLines(document.id), 'Lignes finalisées.')} className="rounded bg-blue-700 px-2 py-1 text-white">Finaliser</button><button disabled={!finalized} title={!finalized ? 'Finalisez les lignes avant d’émettre la facture.' : ''} onClick={() => run(() => issueInvoice(document.id), 'Facture émise.')} className="rounded bg-green-700 px-2 py-1 text-white disabled:opacity-40">Émettre</button></div>}
      {draft && !finalized && <p className="mt-2 text-amber-700">Finalisez les lignes avant d’émettre la facture.</p>}
    </div>
    <HotelInvoiceDeliveryPanel document={document} canManage={canManage} />
    <HotelPaymentPanel reservation={reservation} document={document} canManage={canManage} onChanged={load} />
    </>
  );
}
