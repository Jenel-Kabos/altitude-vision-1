"use client";

import React, { useEffect, useRef, useState } from 'react';
import { toast } from 'react-hot-toast';
import { downloadInvoicePdf, generateInvoicePdf, getInvoicePdfStatus, listInvoiceDeliveries, sendInvoiceEmail } from '../services/hotelFinancialService';

const key = () => globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`;
const errorText = (error) => error.response?.data?.message || 'Action sur la facture impossible.';
const labels = { sent: 'Envoyé', failed: 'Échec d’envoi', delivery_unknown: 'Statut d’envoi incertain', pending: 'Envoi en cours' };

export default function HotelInvoiceDeliveryPanel({ document, canManage }) {
  const [artifact, setArtifact] = useState(null); const [deliveries, setDeliveries] = useState([]); const [busy, setBusy] = useState('');
  const [recipient, setRecipient] = useState(document.customer?.email || ''); const actionKey = useRef(null);
  const load = async () => {
    try { const [pdf, history] = await Promise.all([getInvoicePdfStatus(document.id), listInvoiceDeliveries(document.id)]); setArtifact(pdf); setDeliveries(history); }
    catch (error) { if (error.response?.status !== 403) toast.error(errorText(error)); }
  };
  useEffect(() => { if (document.status === 'issued') load(); }, [document.id, document.status]); // eslint-disable-line react-hooks/exhaustive-deps
  if (document.status !== 'issued') return null;
  const run = async (name, action, success) => { if (busy) return; setBusy(name); actionKey.current ||= key(); try { await action(actionKey.current); actionKey.current = null; await load(); toast.success(success); } catch (error) { toast.error(errorText(error)); } finally { setBusy(''); } };
  const generate = () => run('generate', (idempotencyKey) => generateInvoicePdf(document.id, idempotencyKey), 'PDF officiel disponible.');
  const download = async () => { if (busy) return; setBusy('download'); try { const blob = await downloadInvoicePdf(document.id); const url = URL.createObjectURL(blob); const anchor = window.document.createElement('a'); anchor.href = url; anchor.download = `facture-${document.documentNumber || 'hotel'}.pdf`; anchor.click(); URL.revokeObjectURL(url); } catch (error) { toast.error(errorText(error)); } finally { setBusy(''); } };
  const send = () => { if (!recipient || !/^\S+@\S+\.\S+$/.test(recipient)) return toast.error('Adresse email invalide.'); if (!window.confirm(`Envoyer la facture à ${recipient} ?`)) return; return run('email', (idempotencyKey) => sendInvoiceEmail(document.id, { recipient }, idempotencyKey), 'Demande d’envoi traitée.'); };
  return <div className="mt-2 rounded border border-blue-100 bg-white p-3 text-xs" data-testid="hotel-invoice-delivery">
    <div className="flex flex-wrap items-center gap-2"><strong>PDF officiel</strong><span>{artifact ? `Disponible · ${artifact.templateVersion}` : 'Non généré'}</span>
      {canManage && !artifact && <button disabled={Boolean(busy)} onClick={generate} className="rounded bg-blue-700 px-2 py-1 text-white disabled:opacity-40">{busy === 'generate' ? 'Génération en cours' : 'Générer le PDF'}</button>}
      {artifact && <button disabled={Boolean(busy)} onClick={download} className="rounded border px-2 py-1 disabled:opacity-40">Télécharger</button>}
    </div>
    {canManage && artifact && <div className="mt-2 flex flex-wrap items-center gap-2"><label htmlFor={`invoice-recipient-${document.id}`}>Destinataire</label><input id={`invoice-recipient-${document.id}`} value={recipient} onChange={(event) => setRecipient(event.target.value)} className="min-w-56 rounded border p-1" type="email" /><button disabled={Boolean(busy)} onClick={send} className="rounded bg-green-700 px-2 py-1 text-white disabled:opacity-40">{busy === 'email' ? 'Envoi en cours' : 'Envoyer par email'}</button></div>}
    {deliveries.length > 0 && <div className="mt-3"><strong>Historique des envois</strong><ul className="mt-1 space-y-1">{deliveries.map((delivery) => <li key={delivery.id}>{new Date(delivery.requestedAt).toLocaleString('fr-FR')} · {delivery.recipient} · {labels[delivery.status] || delivery.status} · {delivery.artifactTemplateVersion}</li>)}</ul></div>}
  </div>;
}
