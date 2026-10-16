"use client";

// F-U2.10 — Recouvrement locatif. Mode « owner » : lecture seule (loyers en
// retard, paiements partiels, pénalités prévisionnelles, signalements,
// dossiers). Mode « manager » : signalements à examiner et décisions, projets
// de mise en demeure (jamais envoyés), dossiers suspendus, historique.
import React, { useCallback, useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import { DashboardBadge, DashboardCard, DashboardKpiCard, DashboardKpiGrid, DashboardSection } from '../dashboard/DashboardUI';
import { money } from './BillingDocumentList';
import { cancelDirectReceipt, createLeasePolicy, decideDifficultyReport, generateOwnerTrackingDue, getCollectionOverview, getOwnerCollection, recordOwnerRentReceipt, submitDirectReceiptEvidence } from '../../services/billingService';

const CASE_LABEL = {
  evaluating: ['En évaluation', 'neutral'], settled: ['Soldé', 'success'], notice_suspended: ['Mise en demeure suspendue', 'warning'],
  notice_draft_prepared: ['Projet de mise en demeure (non envoyé)', 'danger'], closed: ['Clôturé', 'neutral'],
};
const RECEIPT_LABEL = { DECLARED: 'déclaré', EVIDENCE_SUBMITTED: 'référence fournie', UNDER_REVIEW: 'en vérification', CONFIRMED: 'confirmé', CONTESTED: 'contesté', CANCELLED: 'annulé' };
const REPORT_LABEL = { submitted: 'À examiner', acknowledged: 'Pris en compte', deferral_approved: 'Report accordé', closed: 'Clôturé' };

export default function RentCollectionPanel({ mode = 'owner' }) {
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState(false);
  const [dueForm, setDueForm] = useState({ leaseId: '', period: '' });
  const [policyForm, setPolicyForm] = useState({ leaseId: '', effectiveFrom: '', documentReference: '', dueDay: '', graceDay: '', penaltyPercent: '', noticeDay: '' });
  const load = useCallback(() => (mode === 'manager' ? getCollectionOverview() : getOwnerCollection()).then(setData).catch(() => setData(null)), [mode]);
  useEffect(() => { load(); }, [load]);
  if (!data) return null;

  const decide = async (reportId, decision, extra = {}) => {
    setBusy(true);
    try { await decideDifficultyReport(reportId, { decision, ...extra }); toast.success('Décision enregistrée.'); await load(); }
    catch (error) { toast.error(error?.response?.data?.message || 'Décision refusée.'); } finally { setBusy(false); }
  };
  const act = async (fn, success) => {
    setBusy(true);
    try { await fn(); toast.success(success); await load(); } catch (error) { toast.error(error?.response?.data?.message || 'Action refusée.'); } finally { setBusy(false); }
  };
  const ask = (label) => { const value = window.prompt(label); return value && value.trim() ? value.trim() : null; };
  const { summary } = data;

  return (
    <DashboardSection title="Recouvrement des loyers" description="Chaque bail suit sa propre politique contractuelle : conditions Altitude Vision pour la gestion déléguée (acceptées par le locataire), conditions du bailleur en gestion autonome. Pénalités prévisionnelles, mises en demeure jamais envoyées automatiquement.">
      <div className="grid gap-4">
        <DashboardKpiGrid>
          <DashboardKpiCard label="Loyers en retard" value={money(summary.overdueMinor)} detail={`${summary.overdueCount} échéance(s)`} tone="red" />
          {mode === 'owner' && <DashboardKpiCard label="Paiements partiels" value={summary.partialCount} tone="gold" />}
          <DashboardKpiCard label="Pénalités prévisionnelles" value={money(summary.penaltiesEstimatedMinor)} tone="gold" />
          {mode === 'manager'
            ? <DashboardKpiCard label="Signalements à examiner" value={summary.reportsToReview} detail={`${summary.noticeDrafts} projet(s), ${summary.suspended} suspendu(s)`} tone="gold" />
            : <DashboardKpiCard label="Signalements / dossiers" value={`${summary.reports} / ${summary.cases}`} tone="green" />}
        </DashboardKpiGrid>
        {data.reports.length > 0 && (
          <DashboardCard>
            <p className="mb-2 text-sm font-semibold">Signalements d’impayés</p>
            <ul className="grid gap-3 text-sm">
              {data.reports.map((report) => (
                <li key={report.id} className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2">
                  <span>
                    {report.period} · {REPORT_LABEL[report.status] || report.status} · déclaré le {new Date(report.declaredAt).toLocaleDateString('fr-FR')}
                    {report.admissibleForSuspension ? ' · suspend la mise en demeure' : ' · après le 25'}
                    {report.reason ? ` · « ${report.reason} »` : ''}
                  </span>
                  {mode === 'manager' && report.status !== 'closed' && (
                    <span className="flex flex-wrap gap-2">
                      {report.status === 'submitted' && <button disabled={busy} onClick={() => decide(report.id, 'acknowledge')} className="rounded-lg border px-3 py-1">Prendre en compte</button>}
                      {!report.admissibleForSuspension && <button disabled={busy} onClick={() => { const reason = ask('Motif de l’exception :'); if (reason) decide(report.id, 'grant_exception', { reason }); }} className="rounded-lg border px-3 py-1">Accorder une exception</button>}
                      {['submitted', 'acknowledged'].includes(report.status) && <button disabled={busy} onClick={() => { const approvedPaymentDate = ask('Date de report (AAAA-MM-JJ) :'); if (approvedPaymentDate) decide(report.id, 'approve_deferral', { approvedPaymentDate }); }} className="rounded-lg border px-3 py-1">Accorder un report</button>}
                      <button disabled={busy} onClick={() => { const reason = ask('Motif de clôture :'); if (reason) decide(report.id, 'close', { reason }); }} className="rounded-lg border px-3 py-1">Clôturer</button>
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </DashboardCard>
        )}
        {mode === 'owner' && (
          <DashboardCard>
            <p className="mb-1 text-sm font-semibold">Conditions de mes baux (gestion autonome)</p>
            <p className="mb-3 text-xs text-slate-500">Ces conditions relèvent de votre relation contractuelle avec votre locataire. Altimmo n’applique aucune échéance, pénalité ni procédure que votre bail ne prévoit pas. Les conditions de recouvrement d’Altitude Vision ne concernent que la gestion déléguée à Altitude Vision.</p>
            <div className="flex flex-wrap items-end gap-2">
              {[['leaseId', 'Bail concerné'], ['effectiveFrom', 'Prise d’effet (AAAA-MM-JJ)'], ['documentReference', 'Référence du bail'], ['dueDay', 'Jour d’échéance (facultatif)'], ['graceDay', 'Tolérance jusqu’au (facultatif)'], ['penaltyPercent', 'Pénalité % (facultatif)'], ['noticeDay', 'Relance formelle le (facultatif)']].map(([field, label]) => (
                <label key={field} className="text-sm">{label}<input aria-label={label} value={policyForm[field]} onChange={(e) => setPolicyForm({ ...policyForm, [field]: e.target.value })} className="mt-1 block w-40 rounded-lg border px-3 py-2" /></label>
              ))}
              <button disabled={busy || !policyForm.leaseId || !policyForm.effectiveFrom || !policyForm.documentReference} onClick={() => {
                const terms = {};
                if (policyForm.dueDay) terms.due = { day: Number(policyForm.dueDay), monthOffset: 0 };
                if (policyForm.graceDay) terms.grace = { day: Number(policyForm.graceDay), monthOffset: Number(policyForm.graceDay) < Number(policyForm.dueDay || 0) ? 1 : 0 };
                if (policyForm.penaltyPercent) terms.penalty = { rateBasisPoints: Math.round(Number(policyForm.penaltyPercent) * 100) };
                if (policyForm.noticeDay) terms.formalNotice = { day: Number(policyForm.noticeDay), monthOffset: Number(policyForm.noticeDay) < Number(policyForm.dueDay || 0) ? 1 : 0 };
                act(() => createLeasePolicy({ leaseId: policyForm.leaseId, type: 'OWNER_AUTONOMOUS', terms, effectiveFrom: policyForm.effectiveFrom, documentReference: policyForm.documentReference }), 'Conditions enregistrées.');
              }} className="rounded-lg bg-blue-700 px-4 py-2 font-semibold text-white disabled:opacity-50">Enregistrer les conditions</button>
            </div>
          </DashboardCard>
        )}
        {mode === 'owner' && (
          <DashboardCard>
            <p className="mb-1 text-sm font-semibold">Mes échéances de suivi (sans organisation)</p>
            <p className="mb-3 text-xs text-slate-500">Suivi de vos loyers encaissés directement : ce n’est pas une facture légale.</p>
            <div className="mb-3 flex flex-wrap items-end gap-2">
              <label className="text-sm">Bail<input aria-label="Bail à suivre" value={dueForm.leaseId} onChange={(e) => setDueForm({ ...dueForm, leaseId: e.target.value })} className="mt-1 block rounded-lg border px-3 py-2" /></label>
              <label className="text-sm">Mois (AAAA-MM)<input aria-label="Mois à suivre" value={dueForm.period} onChange={(e) => setDueForm({ ...dueForm, period: e.target.value })} className="mt-1 block rounded-lg border px-3 py-2" /></label>
              <button disabled={busy || !dueForm.leaseId || !dueForm.period} onClick={() => act(() => generateOwnerTrackingDue(dueForm), 'Échéance de suivi créée.')} className="rounded-lg bg-blue-700 px-4 py-2 font-semibold text-white disabled:opacity-50">Créer l’échéance</button>
            </div>
            <ul className="grid gap-2 text-sm">
              {(data.trackingDues || []).map((due) => (
                <li key={due.id} className="flex flex-wrap items-center justify-between gap-2">
                  <span>{due.period} · {money(due.totalMinor)} · reste {money(due.balanceMinor)}</span>
                  {due.balanceMinor > 0 && <button disabled={busy} onClick={() => { const amount = Number(ask('Montant reçu (FCFA) :')); const receivedAt = Number.isSafeInteger(amount) && amount > 0 ? ask('Date de réception (AAAA-MM-JJ) :') : null; if (receivedAt) act(() => recordOwnerRentReceipt(due.id, { amountMinor: amount, receivedAt, method: 'cash' }), 'Loyer reçu enregistré.'); }} className="rounded-lg border px-3 py-1">Enregistrer un loyer reçu</button>}
                </li>
              ))}
            </ul>
          </DashboardCard>
        )}
        {mode === 'owner' && (data.directReceipts || []).length > 0 && (
          <DashboardCard>
            <p className="mb-1 text-sm font-semibold">Loyers reçus directement</p>
            <p className="mb-2 text-xs text-slate-500">Une déclaration sert au suivi. Les frais de 1 % ne s’appliquent qu’après confirmation indépendante (locataire ou revue Altitude Vision sur référence vérifiable).</p>
            <ul className="grid gap-2 text-sm">
              {data.directReceipts.map((receipt) => (
                <li key={receipt.id} className="flex flex-wrap items-center justify-between gap-2">
                  <span>{money(receipt.amountMinor)} reçu le {new Date(receipt.receivedAt).toLocaleDateString('fr-FR')} · {RECEIPT_LABEL[receipt.status] || receipt.status}</span>
                  {['DECLARED', 'EVIDENCE_SUBMITTED'].includes(receipt.status) && (
                    <span className="flex gap-2">
                      <button disabled={busy} onClick={() => { const reference = ask('Référence de la transaction (Mobile Money, banque…) :'); if (reference) act(() => submitDirectReceiptEvidence(receipt.id, { kind: 'MOBILE_MONEY_REFERENCE', reference }), 'Référence ajoutée.'); }} className="rounded-lg border px-3 py-1">Ajouter une référence</button>
                      <button disabled={busy} onClick={() => { const reason = ask('Motif de l’annulation :'); if (reason) act(() => cancelDirectReceipt(receipt.id, reason), 'Encaissement annulé.'); }} className="rounded-lg border px-3 py-1">Annuler</button>
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </DashboardCard>
        )}
        {data.cases.length > 0 && (
          <DashboardCard>
            <p className="mb-2 text-sm font-semibold">Dossiers de recouvrement</p>
            <ul className="grid gap-2 text-sm">
              {data.cases.map((item) => {
                const [label, tone] = CASE_LABEL[item.status] || [item.status, 'neutral'];
                return (
                  <li key={item.id} className="flex flex-wrap items-center justify-between gap-2">
                    <span>{item.reference} · {item.period}{item.evaluation?.unpaidRentMinor ? ` · reste ${money(item.evaluation.unpaidRentMinor)}` : ''}{item.suspension?.reason ? ` · ${item.suspension.reason}` : ''}</span>
                    <DashboardBadge tone={tone}>{label}</DashboardBadge>
                  </li>
                );
              })}
            </ul>
          </DashboardCard>
        )}
      </div>
    </DashboardSection>
  );
}
