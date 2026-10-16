"use client";

// F-U2.12 — Revue Altitude Vision des encaissements directs déclarés par les
// bailleurs sans organisation (base des frais de 1 %). Références uniquement :
// aucun justificatif fichier n'est stocké ni affiché.
import React, { useCallback, useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import { DashboardCard } from '../dashboard/DashboardUI';
import { money } from './BillingDocumentList';
import { getDirectReceiptReviewQueue, reviewDirectReceipt } from '../../services/billingService';

export default function DirectReceiptReviewPanel() {
  const [items, setItems] = useState(null);
  const [busy, setBusy] = useState(false);
  const load = useCallback(() => getDirectReceiptReviewQueue().then(setItems).catch(() => setItems(null)), []);
  useEffect(() => { load(); }, [load]);
  if (!items) return null;
  const decide = async (id, decision) => {
    const note = decision === 'confirm' || decision === 'start' ? (decision === 'confirm' ? window.prompt('Vérification effectuée (source, référence contrôlée) :') : null) : window.prompt('Motif de la contestation :');
    if (decision !== 'start' && !note) return;
    setBusy(true);
    try { await reviewDirectReceipt(id, { decision, note }); toast.success('Décision enregistrée.'); await load(); }
    catch (error) { toast.error(error?.response?.data?.message || 'Décision refusée.'); } finally { setBusy(false); }
  };
  return (
    <DashboardCard>
      <p className="mb-2 text-sm font-semibold">Encaissements directs à vérifier ({items.length})</p>
      {!items.length ? <p className="text-sm text-slate-500">Aucun encaissement en attente de vérification.</p> : (
        <ul className="grid gap-2 text-sm">
          {items.map((item) => (
            <li key={item.id} className="flex flex-wrap items-center justify-between gap-2">
              <span>{money(item.amountMinor)} · reçu le {new Date(item.receivedAt).toLocaleDateString('fr-FR')} · {item.evidence.map((e) => `${e.kind} ${e.reference}`).join(', ') || 'sans référence'}</span>
              <span className="flex gap-2">
                {item.status === 'EVIDENCE_SUBMITTED' && <button disabled={busy} onClick={() => decide(item.id, 'start')} className="rounded-lg border px-3 py-1">Instruire</button>}
                <button disabled={busy} onClick={() => decide(item.id, 'confirm')} className="rounded-lg bg-blue-700 px-3 py-1 font-semibold text-white">Confirmer</button>
                <button disabled={busy} onClick={() => decide(item.id, 'contest')} className="rounded-lg border px-3 py-1">Contester</button>
              </span>
            </li>
          ))}
        </ul>
      )}
    </DashboardCard>
  );
}
