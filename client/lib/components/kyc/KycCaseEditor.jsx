"use client";

// F-U1.I — Édition d'un dossier KYC (personne concernée ou organisation
// préparatrice). Les actions affichées dépendent du statut renvoyé par le
// serveur, qui reste seul juge des autorisations. Le numéro de pièce n'est
// jamais réaffiché : seuls ses trois derniers caractères le sont.
import React, { useState } from 'react';
import { toast } from 'react-hot-toast';
import { DashboardBadge, DashboardCard } from '../dashboard/DashboardUI';
import {
  acknowledgeKycNotice, cancelKycCase, submitKycCase, updateKycCase, uploadKycDocument,
} from '../../services/financialKycService';
import {
  KYC_DOCUMENT_KIND_LABELS, KYC_EDITABLE, KYC_SLOT_LABELS, KYC_STATUS_LABELS, KYC_STATUS_TONES, KYC_STEPS,
} from './kycLabels';

const toDateInput = (value) => (value ? new Date(value).toISOString().slice(0, 10) : '');
const errorMessage = (error, fallback) => error?.response?.data?.message || fallback;

export function KycStatusBadge({ status }) {
  return <DashboardBadge tone={KYC_STATUS_TONES[status] || 'neutral'}>{KYC_STATUS_LABELS[status] || status}</DashboardBadge>;
}

export function KycSteps({ status }) {
  const current = KYC_STEPS.indexOf(status === 'additional_information_required' ? 'under_review' : status);
  return (
    <ol aria-label="Étapes du dossier" className="flex flex-wrap gap-2 text-xs">
      {KYC_STEPS.map((step, index) => (
        <li key={step} className={`rounded-full px-3 py-1 ${index <= current ? 'bg-blue-100 text-blue-800 font-semibold' : 'bg-slate-100 text-slate-500'}`}>
          {KYC_STATUS_LABELS[step]}
        </li>
      ))}
    </ol>
  );
}

export default function KycCaseEditor({ kycCase, procedure, isSubject, onChange }) {
  const editable = KYC_EDITABLE.includes(kycCase.status);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    lastName: kycCase.personal?.lastName || '', firstNames: kycCase.personal?.firstNames || '', birthDate: toDateInput(kycCase.personal?.birthDate),
    kind: kycCase.identityDocument?.kind || '', issuingCountry: kycCase.identityDocument?.issuingCountry || '', expiresAt: toDateInput(kycCase.identityDocument?.expiresAt), number: '',
  });
  const set = (key) => (event) => setForm((previous) => ({ ...previous, [key]: event.target.value }));
  const run = async (action, success, fallback) => {
    setBusy(true);
    try { const updated = await action(); toast.success(success); onChange(updated); } catch (error) { toast.error(errorMessage(error, fallback)); } finally { setBusy(false); }
  };

  const save = (event) => {
    event.preventDefault();
    const identityDocument = { ...(form.kind && { kind: form.kind }), ...(form.issuingCountry && { issuingCountry: form.issuingCountry }), ...(form.expiresAt && { expiresAt: form.expiresAt }), ...(form.number && { number: form.number }) };
    run(() => updateKycCase(kycCase.id, { personal: { lastName: form.lastName, firstNames: form.firstNames, ...(form.birthDate && { birthDate: form.birthDate }) }, identityDocument, expectedRevision: kycCase.revision }), 'Dossier enregistré.', 'Enregistrement impossible.');
    setForm((previous) => ({ ...previous, number: '' }));
  };
  const upload = (slot) => (event) => {
    const file = event.target.files?.[0];
    if (file) run(() => uploadKycDocument(kycCase.id, slot, file), 'Justificatif déposé.', 'Dépôt impossible.');
    event.target.value = '';
  };
  const slots = kycCase.requiredSlots || [];
  const notice = procedure?.privacyNotice;

  return (
    <DashboardCard>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Dossier {String(kycCase.id).slice(-6)}</p>
          <KycStatusBadge status={kycCase.status} />
        </div>
        <KycSteps status={kycCase.status} />
      </div>

      {kycCase.informationRequests?.filter((item) => !item.resolvedAt).map((item) => (
        <p key={item.requestedAt} role="alert" className="mt-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">Altitude Vision demande : {item.message}</p>
      ))}
      {kycCase.decision && (
        <p className="mt-4 rounded-lg bg-slate-50 p-3 text-sm text-slate-700">Décision : {kycCase.decision.result === 'approved' ? 'identité attestée' : 'refus'}{kycCase.decision.reason ? ` — ${kycCase.decision.reason}` : ''}</p>
      )}

      <form onSubmit={save} className="mt-5 grid gap-3 md:grid-cols-2" aria-label="Informations d’identité">
        <label className="text-sm">Nom<input disabled={!editable} value={form.lastName} onChange={set('lastName')} className="mt-1 w-full rounded-lg border px-3 py-2" /></label>
        <label className="text-sm">Prénoms<input disabled={!editable} value={form.firstNames} onChange={set('firstNames')} className="mt-1 w-full rounded-lg border px-3 py-2" /></label>
        <label className="text-sm">Date de naissance<input type="date" disabled={!editable} value={form.birthDate} onChange={set('birthDate')} className="mt-1 w-full rounded-lg border px-3 py-2" /></label>
        <label className="text-sm">Type de pièce
          <select disabled={!editable} value={form.kind} onChange={set('kind')} className="mt-1 w-full rounded-lg border px-3 py-2">
            <option value="">Choisir…</option>
            {Object.keys(procedure?.acceptedDocuments || {}).map((kind) => <option key={kind} value={kind}>{KYC_DOCUMENT_KIND_LABELS[kind] || kind}</option>)}
          </select>
        </label>
        <label className="text-sm">Pays émetteur (code ISO)<input disabled={!editable} maxLength={2} value={form.issuingCountry} onChange={set('issuingCountry')} className="mt-1 w-full rounded-lg border px-3 py-2 uppercase" /></label>
        <label className="text-sm">Date d’expiration<input type="date" disabled={!editable} value={form.expiresAt} onChange={set('expiresAt')} className="mt-1 w-full rounded-lg border px-3 py-2" /></label>
        <label className="text-sm md:col-span-2">Numéro de la pièce {kycCase.identityDocument?.numberHint && <span className="text-slate-500">(enregistré : {kycCase.identityDocument.numberHint})</span>}
          <input disabled={!editable} autoComplete="off" value={form.number} onChange={set('number')} placeholder="Saisi une seule fois, jamais réaffiché" className="mt-1 w-full rounded-lg border px-3 py-2" />
        </label>
        {editable && <button disabled={busy} type="submit" className="rounded-lg bg-blue-700 px-4 py-2 font-semibold text-white disabled:opacity-50 md:col-span-2">Enregistrer</button>}
      </form>

      {slots.length > 0 && (
        <div className="mt-6">
          <h3 className="font-semibold text-slate-900">Justificatifs</h3>
          <ul className="mt-2 grid gap-2">
            {slots.map((slot) => {
              const doc = kycCase.documents?.find((item) => item.slot === slot && item.status === 'current');
              return (
                <li key={slot} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3 text-sm">
                  <span>{KYC_SLOT_LABELS[slot] || slot} — {doc ? `déposé (${doc.review?.result === 'verified' ? 'vérifié' : doc.review?.result === 'rejected' ? 'refusé' : 'à vérifier'})` : 'manquant'}</span>
                  {editable && <label className="cursor-pointer rounded-lg border px-3 py-1">{doc ? 'Remplacer' : 'Déposer'}<input aria-label={`Fichier ${KYC_SLOT_LABELS[slot] || slot}`} type="file" accept="application/pdf,image/jpeg,image/png" className="sr-only" onChange={upload(slot)} /></label>}
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {editable && notice && (
        <div className="mt-6 rounded-lg bg-slate-50 p-4 text-sm text-slate-700">
          <h3 className="font-semibold text-slate-900">Information sur le traitement de vos données</h3>
          <p className="mt-1">{notice.purpose}</p>
          <p className="mt-1">Destinataires : {notice.recipients}</p>
          <p className="mt-1">Conservation : {notice.retention}</p>
          {kycCase.privacyNoticeAccepted
            ? <p className="mt-2 font-semibold text-green-700">Information acceptée par la personne concernée.</p>
            : isSubject
              ? <button disabled={busy} onClick={() => run(() => acknowledgeKycNotice(kycCase.id, notice.version), 'Information acceptée.', 'Action impossible.')} className="mt-2 rounded-lg border px-3 py-2">J’ai pris connaissance de cette information</button>
              : <p className="mt-2 text-amber-800">La personne concernée doit accepter cette information depuis son propre espace.</p>}
        </div>
      )}

      <div className="mt-6 flex flex-wrap gap-2">
        {['ready_for_submission', 'additional_information_required'].includes(kycCase.status) && kycCase.privacyNoticeAccepted && (
          <button disabled={busy} onClick={() => run(() => submitKycCase(kycCase.id, kycCase.revision), 'Dossier soumis à Altitude Vision.', 'Soumission impossible.')} className="rounded-lg bg-blue-700 px-4 py-2 font-semibold text-white disabled:opacity-50">Soumettre à Altitude Vision</button>
        )}
        {[...KYC_EDITABLE, 'submitted'].includes(kycCase.status) && (
          <button disabled={busy} onClick={() => run(() => cancelKycCase(kycCase.id, 'Annulé par le demandeur'), 'Dossier annulé.', 'Annulation impossible.')} className="rounded-lg border px-4 py-2">Annuler le dossier</button>
        )}
      </div>
    </DashboardCard>
  );
}
