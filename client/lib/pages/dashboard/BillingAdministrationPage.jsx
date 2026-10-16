"use client";

// F-U2.7 — Facturation de l'organisation (contexte TENANT) ou d'Altitude
// Vision (contexte PLATFORM), selon le contexte résolu par le serveur. Les
// actions sont proposées puis autorisées ou refusées côté serveur.
import React, { useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import { DashboardCard, DashboardPage, DashboardPageHeader, DashboardState } from '../../components/dashboard/DashboardUI';
import BillingDocumentList, { BillingSummary } from '../../components/billing/BillingDocumentList';
import AutonomousBillingPanel from '../../components/billing/AutonomousBillingPanel';
import RentCollectionPanel from '../../components/billing/RentCollectionPanel';
import DirectReceiptReviewPanel from '../../components/billing/DirectReceiptReviewPanel';
import {
  cancelBillingDraft, creditBillingDocument, generateAutonomousInvoice, generateCommissionInvoice, generateRentInvoice, getAdministrationBilling,
  getIssuerReadiness, issueBillingDocument,
} from '../../services/billingService';

export default function BillingAdministrationPage() {
  const [data, setData] = useState(null);
  const [readiness, setReadiness] = useState(null);
  const [loading, setLoading] = useState(true);
  const [denied, setDenied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [rentForm, setRentForm] = useState({ leaseId: '', period: '' });
  const [mandateId, setMandateId] = useState('');
  const [autoForm, setAutoForm] = useState({ subscriptionType: 'IndividualSubscription', subscriptionId: '', period: '' });

  const load = async () => {
    setLoading(true);
    try {
      const [dashboard, issuer] = await Promise.all([getAdministrationBilling(), getIssuerReadiness().catch(() => null)]);
      setData(dashboard); setReadiness(issuer);
    } catch (error) {
      if ([401, 403].includes(error?.response?.status)) setDenied(true); else toast.error(error?.response?.data?.message || 'Facturation indisponible.');
    } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);
  const run = async (fn, success) => {
    setBusy(true);
    try { await fn(); toast.success(success); await load(); } catch (error) { toast.error(error?.response?.data?.message || 'Action refusée.'); } finally { setBusy(false); }
  };
  const ask = (label) => { const value = window.prompt(label); return value && value.trim() ? value.trim() : null; };

  if (denied) return <DashboardPage><DashboardState title="Accès réservé" description="La facturation exige une capacité financière dans le périmètre sélectionné." /></DashboardPage>;
  return (
    <DashboardPage>
      <DashboardPageHeader eyebrow={data?.plane === 'PLATFORM' ? 'Altitude Vision' : 'Organisation'} title="Facturation" description="Loyers, commissions de gestion et abonnements. Une facture émise ne se modifie plus : toute correction passe par un avoir." />
      {loading ? <DashboardState title="Chargement…" /> : data && (
        <div className="grid gap-4">
          {readiness && !readiness.ready && <p role="alert" className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">Identité légale de l’émetteur non vérifiée : seuls des brouillons peuvent être préparés.</p>}
          <BillingSummary summary={data.summary} />
          <DashboardCard>
            <div className="flex flex-wrap items-end gap-2">
              <label className="text-sm">Bail<input aria-label="Identifiant du bail" value={rentForm.leaseId} onChange={(e) => setRentForm({ ...rentForm, leaseId: e.target.value })} className="mt-1 block rounded-lg border px-3 py-2" /></label>
              <label className="text-sm">Période (AAAA-MM)<input aria-label="Période" value={rentForm.period} onChange={(e) => setRentForm({ ...rentForm, period: e.target.value })} className="mt-1 block rounded-lg border px-3 py-2" /></label>
              <button disabled={busy || !rentForm.leaseId || !rentForm.period} onClick={() => run(() => generateRentInvoice(rentForm), 'Facture de loyer préparée.')} className="rounded-lg bg-blue-700 px-4 py-2 font-semibold text-white disabled:opacity-50">Préparer le loyer</button>
              <label className="text-sm">Mandat<input aria-label="Identifiant du mandat" value={mandateId} onChange={(e) => setMandateId(e.target.value)} className="mt-1 block rounded-lg border px-3 py-2" /></label>
              <button disabled={busy || !mandateId} onClick={() => run(() => generateCommissionInvoice(mandateId), 'Facture de commission préparée.')} className="rounded-lg border px-4 py-2">Facturer les commissions acquises</button>
            </div>
          </DashboardCard>
          {data.plane === 'PLATFORM' ? (
            <DashboardCard>
              <p className="mb-2 text-sm font-semibold">Gestion autonome : abonnement + 1 % des loyers encaissés et confirmés (mois clos)</p>
              <div className="flex flex-wrap items-end gap-2">
                <label className="text-sm">Type d’abonnement<select aria-label="Type d’abonnement" value={autoForm.subscriptionType} onChange={(e) => setAutoForm({ ...autoForm, subscriptionType: e.target.value })} className="mt-1 block rounded-lg border px-3 py-2"><option value="IndividualSubscription">Propriétaire</option><option value="PlatformTenantSubscription">Organisation</option></select></label>
                <label className="text-sm">Abonnement<input aria-label="Identifiant de l’abonnement" value={autoForm.subscriptionId} onChange={(e) => setAutoForm({ ...autoForm, subscriptionId: e.target.value })} className="mt-1 block rounded-lg border px-3 py-2" /></label>
                <label className="text-sm">Mois (AAAA-MM)<input aria-label="Mois facturé" value={autoForm.period} onChange={(e) => setAutoForm({ ...autoForm, period: e.target.value })} className="mt-1 block rounded-lg border px-3 py-2" /></label>
                <button disabled={busy || !autoForm.subscriptionId || !autoForm.period} onClick={() => run(() => generateAutonomousInvoice(autoForm), 'Facture de gestion autonome préparée.')} className="rounded-lg bg-blue-700 px-4 py-2 font-semibold text-white disabled:opacity-50">Préparer la facture autonome</button>
              </div>
            </DashboardCard>
          ) : <AutonomousBillingPanel />}
          <RentCollectionPanel mode="manager" />
          {data.plane === 'PLATFORM' && <DirectReceiptReviewPanel />}
          {data.documents.length ? (
            <BillingDocumentList documents={data.documents} renderActions={(doc) => (
              <>
                {doc.status === 'draft' && readiness?.ready && <button disabled={busy} onClick={() => run(() => issueBillingDocument(doc.id), 'Facture émise.')} className="rounded-lg bg-blue-700 px-3 py-1 font-semibold text-white">Émettre</button>}
                {doc.status === 'draft' && <button disabled={busy} onClick={() => { const r = ask('Motif d’annulation du brouillon :'); if (r) run(() => cancelBillingDraft(doc.id, r), 'Brouillon annulé.'); }} className="rounded-lg border px-3 py-1">Annuler</button>}
                {doc.status === 'issued' && doc.documentType === 'invoice' && doc.balanceMinor > 0 && <button disabled={busy} onClick={() => { const amount = Number(ask('Montant de l’avoir (FCFA) :')); const reason = Number.isSafeInteger(amount) && amount > 0 ? ask('Motif de l’avoir :') : null; if (reason) run(() => creditBillingDocument(doc.id, amount, reason), 'Avoir émis.'); }} className="rounded-lg border px-3 py-1">Avoir</button>}
              </>
            )} />
          ) : <DashboardState title="Aucun document" />}
        </div>
      )}
    </DashboardPage>
  );
}
