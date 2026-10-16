"use client";

// F-U2.9 — Gestion autonome : formule, coût fixe, loyers confirmés retenus,
// frais de 1 %, total estimé, devis Grand portefeuille et factures passées.
// Les montants proviennent du serveur ; la grille affichée est la grille validée.
import React, { useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import { DashboardBadge, DashboardCard, DashboardKpiCard, DashboardKpiGrid, DashboardSection } from '../dashboard/DashboardUI';
import { money } from './BillingDocumentList';
import { AUTONOMOUS_FORMULAS, GRATUIT_DISCLOSURE } from '../../constants/altimmoPricing';
import { acceptPortfolioQuote, getAutonomousSummary, rejectPortfolioQuote } from '../../services/billingService';

const REASONS = {
  COUNTING_RULE_UNDECIDED: 'Des biens clôturés (vendus, retirés, archivés) peuvent changer votre formule : règle de comptage en attente de décision.',
  FORMULA_CHANGED_DURING_PERIOD_PRORATA_UNDEFINED: 'Votre formule a changé en cours de mois : règle de prorata en attente de décision.',
  SAME_OWNER_MULTIPLE_ACCOUNTS: 'Plusieurs comptes semblent appartenir au même propriétaire : vérification nécessaire.',
  NO_MANAGED_PROPERTY: 'Aucun bien occupé en gestion autonome.',
};

export default function AutonomousBillingPanel() {
  const [summary, setSummary] = useState(null);
  const [busy, setBusy] = useState(false);
  const load = () => getAutonomousSummary().then(setSummary).catch(() => setSummary(null));
  useEffect(() => { load(); }, []);
  if (!summary) return null;

  const decide = async (fn, success) => {
    setBusy(true);
    try { await fn(); toast.success(success); await load(); } catch (error) { toast.error(error?.response?.data?.message || 'Action refusée.'); } finally { setBusy(false); }
  };

  if (!summary.subscribed) {
    return (
      <DashboardSection title="Gestion autonome" description="Aucun abonnement de gestion autonome actif.">
        <p className="text-sm text-slate-600">{GRATUIT_DISCLOSURE}</p>
      </DashboardSection>
    );
  }
  const { classification, current, accruals, invoices } = summary;
  const quote = current.quote;
  return (
    <DashboardSection title="Gestion autonome" description="Abonnement selon le nombre de biens gérés + 1 % des loyers effectivement encaissés et confirmés.">
      <div className="grid gap-4">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span>Formule :</span>
          <DashboardBadge tone="blue">{classification.label || '—'}</DashboardBadge>
          <span className="text-slate-600">{classification.counted} bien(s) géré(s) compté(s)</span>
          {classification.countingPolicyStatus === 'PROPOSED' && <span className="text-xs text-slate-500">(règle de comptage proposée)</span>}
        </div>
        {classification.ambiguous && (
          <ul role="alert" className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
            {classification.reasons.map((reason) => <li key={reason}>{REASONS[reason] || reason}</li>)}
            <li>La facture d’abonnement est suspendue jusqu’à décision ; les frais de 1 % restent tracés.</li>
          </ul>
        )}
        <DashboardKpiGrid>
          <DashboardKpiCard label="Abonnement mensuel" value={current.fixedMonthlyMinor == null ? 'Sur devis' : money(current.fixedMonthlyMinor)} tone="gold" />
          <DashboardKpiCard label="Loyers encaissés et confirmés retenus" value={money(current.confirmedRentBaseMinor)} tone="green" />
          <DashboardKpiCard label="Frais de service 1 %" value={money(current.variableFeesMinor)} tone="gold" />
          <DashboardKpiCard label="Total estimé (non facturé)" value={current.totalDueEstimateMinor == null ? '—' : money(current.totalDueEstimateMinor)} tone="green" />
        </DashboardKpiGrid>
        {classification.formula === 'GRATUIT' && <p className="text-sm text-slate-600">{GRATUIT_DISCLOSURE}</p>}
        {quote && (
          <DashboardCard>
            <p className="text-sm">Devis Grand portefeuille : <strong>{money(quote.monthlyPriceMinor)}</strong> / mois — {quote.status === 'proposed' ? 'en attente de votre décision' : quote.status === 'accepted' ? 'accepté' : quote.status === 'rejected' ? 'refusé' : quote.status}</p>
            {quote.status === 'proposed' && (
              <div className="mt-2 flex gap-2">
                <button disabled={busy} onClick={() => decide(() => acceptPortfolioQuote(quote.id), 'Devis accepté.')} className="rounded-lg bg-blue-700 px-3 py-1 font-semibold text-white">Accepter le devis</button>
                <button disabled={busy} onClick={() => decide(() => rejectPortfolioQuote(quote.id), 'Devis refusé.')} className="rounded-lg border px-3 py-1">Refuser</button>
              </div>
            )}
          </DashboardCard>
        )}
        {accruals.length > 0 && (
          <DashboardCard>
            <p className="mb-2 text-sm font-semibold">Frais de 1 % par encaissement confirmé</p>
            <ul className="grid gap-1 text-sm text-slate-700">
              {accruals.slice(0, 50).map((item, index) => (
                <li key={`${item.period}-${index}`} className="flex flex-wrap justify-between gap-2">
                  <span>{item.period} · {item.kind === 'REVERSAL' ? 'Contrepassation (décision en attente)' : `loyer de ${money(item.baseMinor)}`}</span>
                  <span>{money(item.feeMinor)} · {item.status === 'invoiced' ? 'facturé' : item.status === 'accrued' ? 'à facturer' : item.status === 'cancelled' ? 'annulé' : 'en attente'}</span>
                </li>
              ))}
            </ul>
          </DashboardCard>
        )}
        {invoices.length > 0 && (
          <DashboardCard>
            <p className="mb-2 text-sm font-semibold">Factures d’abonnement précédentes</p>
            <ul className="grid gap-1 text-sm text-slate-700">
              {invoices.map((invoice) => <li key={invoice.id} className="flex justify-between gap-2"><span>{invoice.period} {invoice.documentNumber ? `· ${invoice.documentNumber}` : '· brouillon'}</span><span>{money(invoice.totalMinor)}</span></li>)}
            </ul>
          </DashboardCard>
        )}
        <details className="text-sm text-slate-600">
          <summary className="cursor-pointer">Grille Altimmo</summary>
          <ul className="mt-2 grid gap-1">
            {AUTONOMOUS_FORMULAS.map((formula) => <li key={formula.code}>{formula.label} ({formula.range}) : {formula.price} + 1 % des loyers encaissés et confirmés</li>)}
          </ul>
        </details>
      </div>
    </DashboardSection>
  );
}
