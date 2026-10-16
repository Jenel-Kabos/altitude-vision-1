"use client";

// F-U1.I — Niveau 2 : file de vérification réservée aux agents Altitude
// Vision porteurs de l'habilitation `contractual.kyc.attest`. Un accès général
// à la plateforme ne suffit pas : sans cette habilitation, le serveur refuse
// la file et aucun justificatif n'est affiché.
import React, { useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import { DashboardCard, DashboardPage, DashboardPageHeader, DashboardState } from '../../components/dashboard/DashboardUI';
import { KycStatusBadge } from '../../components/kyc/KycCaseEditor';
import { KYC_DOCUMENT_KIND_LABELS, KYC_SLOT_LABELS } from '../../components/kyc/kycLabels';
import {
  approveKycCase, checkKycDocument, fetchKycDocumentBlob, getKycReviewCase, listKycReviewQueue, rejectKycCase,
  requestKycInformation, revokeKycAttestation, suspendKycAttestation, takeKycCase,
} from '../../services/financialKycService';

export default function FinancialKycReviewPage() {
  const [queue, setQueue] = useState([]);
  const [status, setStatus] = useState('');
  const [current, setCurrent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [denied, setDenied] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setLoading(true);
    try { setQueue(await listKycReviewQueue(status || undefined)); setDenied(false); } catch (error) {
      if ([401, 403].includes(error?.response?.status)) setDenied(true); else toast.error(error?.response?.data?.message || 'File indisponible.');
    } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, [status]); // eslint-disable-line react-hooks/exhaustive-deps

  const open = async (id) => { try { setCurrent(await getKycReviewCase(id)); } catch (error) { toast.error(error?.response?.data?.message || 'Dossier inaccessible.'); } };
  const act = async (fn, success) => {
    setBusy(true);
    try { const result = await fn(); toast.success(success); await open(current.id); await load(); return result; } catch (error) { toast.error(error?.response?.data?.message || 'Action refusée.'); return null; } finally { setBusy(false); }
  };
  const ask = (label) => { const value = window.prompt(label); return value && value.trim() ? value.trim() : null; };
  const view = async (docId) => {
    try { const blob = await fetchKycDocumentBlob(current.id, docId, { review: true }); window.open(URL.createObjectURL(blob), '_blank', 'noopener'); } catch { toast.error('Justificatif inaccessible.'); }
  };

  if (denied) return <DashboardPage><DashboardState title="Accès réservé" description="La vérification d’identité exige l’habilitation nominative de vérificateur KYC Altitude Vision." /></DashboardPage>;
  const s = current?.status;
  return (
    <DashboardPage>
      <DashboardPageHeader eyebrow="Altitude Vision" title="Vérifications d’identité" description="Chaque décision est nominative, motivée et journalisée. Une attestation n’accorde aucune habilitation financière." actions={
        <select aria-label="Filtrer par statut" value={status} onChange={(event) => setStatus(event.target.value)} className="rounded-lg border bg-white px-3 py-2">
          <option value="">À traiter</option><option value="approved">Attestés</option><option value="suspended">Suspendus</option><option value="rejected">Refusés</option>
        </select>} />
      {loading ? <DashboardState title="Chargement…" /> : (
        <div className="grid gap-4 lg:grid-cols-[1fr_2fr]">
          <ul className="grid content-start gap-2" aria-label="File de vérification">
            {!queue.length && <DashboardState title="Aucun dossier" />}
            {queue.map((item) => (
              <li key={item.id}><button onClick={() => open(item.id)} className="flex w-full items-center justify-between gap-2 rounded-lg border bg-white p-3 text-left text-sm">
                <span>{KYC_DOCUMENT_KIND_LABELS[item.documentKind] || 'Pièce'} · {item.applicantType === 'INDIVIDUAL' ? 'Individuel' : 'Organisation'}</span><KycStatusBadge status={item.status} />
              </button></li>
            ))}
          </ul>
          {current && (
            <DashboardCard>
              <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="text-lg font-bold text-slate-900">{current.personal.lastName} {current.personal.firstNames}</h2><KycStatusBadge status={current.status} /></div>
              <p className="text-sm text-slate-600">{KYC_DOCUMENT_KIND_LABELS[current.identityDocument.kind]} · {current.identityDocument.issuingCountry} · expire le {current.identityDocument.expiresAt ? new Date(current.identityDocument.expiresAt).toLocaleDateString('fr-FR') : '—'} · n° {current.identityDocument.numberHint}</p>
              <ul className="mt-4 grid gap-2">
                {current.documents.filter((doc) => doc.status === 'current').map((doc) => (
                  <li key={doc.docId} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3 text-sm">
                    <span>{KYC_SLOT_LABELS[doc.slot] || doc.slot} — {doc.review.result}</span>
                    <span className="flex gap-2">
                      <button onClick={() => view(doc.docId)} className="rounded-lg border px-3 py-1">Consulter</button>
                      {s === 'under_review' && <><button disabled={busy} onClick={() => act(() => checkKycDocument(current.id, doc.docId, 'verified'), 'Pièce vérifiée.')} className="rounded-lg border px-3 py-1">Conforme</button>
                        <button disabled={busy} onClick={() => { const notes = ask('Motif du rejet de la pièce :'); if (notes) act(() => checkKycDocument(current.id, doc.docId, 'rejected', notes), 'Pièce rejetée.'); }} className="rounded-lg border px-3 py-1">Non conforme</button></>}
                    </span>
                  </li>
                ))}
              </ul>
              <div className="mt-4 flex flex-wrap gap-2">
                {s === 'submitted' && <button disabled={busy} onClick={() => act(() => takeKycCase(current.id), 'Dossier pris en charge.')} className="rounded-lg bg-blue-700 px-4 py-2 font-semibold text-white">Prendre en charge</button>}
                {s === 'under_review' && <>
                  <button disabled={busy} onClick={() => { const m = ask('Compléments demandés :'); if (m) act(() => requestKycInformation(current.id, m), 'Compléments demandés.'); }} className="rounded-lg border px-4 py-2">Demander des compléments</button>
                  <button disabled={busy} onClick={() => { const r = ask('Motif du refus :'); if (r) act(() => rejectKycCase(current.id, r), 'Dossier refusé.'); }} className="rounded-lg border px-4 py-2">Refuser</button>
                  <button disabled={busy} onClick={() => { const r = ask('Motif de l’attestation :'); if (r) act(() => approveKycCase(current.id, r), 'Identité attestée.'); }} className="rounded-lg bg-blue-700 px-4 py-2 font-semibold text-white">Attester l’identité</button>
                </>}
                {s === 'approved' && <button disabled={busy} onClick={() => { const r = ask('Motif de la suspension :'); if (r) act(() => suspendKycAttestation(current.id, r), 'Attestation suspendue.'); }} className="rounded-lg border px-4 py-2">Suspendre l’attestation</button>}
                {['approved', 'suspended'].includes(s) && <button disabled={busy} onClick={() => { const r = ask('Motif de la révocation :'); if (r) act(() => revokeKycAttestation(current.id, r), 'Attestation révoquée.'); }} className="rounded-lg border border-red-300 px-4 py-2 text-red-700">Révoquer</button>}
              </div>
              <details className="mt-4 text-sm"><summary className="cursor-pointer font-semibold">Historique et consultations</summary>
                <ul className="mt-2 grid gap-1">{(current.history || []).map((h, i) => <li key={`h${i}`}>{new Date(h.at).toLocaleString('fr-FR')} — {h.action}{h.reason ? ` : ${h.reason}` : ''}</li>)}</ul>
                <ul className="mt-2 grid gap-1 text-slate-500">{(current.accessLog || []).map((l, i) => <li key={`l${i}`}>{new Date(l.at).toLocaleString('fr-FR')} — {l.accessorRole} {l.action}</li>)}</ul>
              </details>
            </DashboardCard>
          )}
        </div>
      )}
    </DashboardPage>
  );
}
