"use client";

// F-U2.7 — liste de documents de facturation et synthèse. Les montants et
// statuts proviennent du serveur ; aucune donnée légale privée n'est affichée.
import React from 'react';
import { DashboardBadge, DashboardKpiCard, DashboardKpiGrid } from '../dashboard/DashboardUI';

export const money = (value) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'XAF', maximumFractionDigits: 0 }).format(Number(value) || 0);
const KIND = { RENT: 'Loyer', MANAGEMENT_COMMISSION: 'Commission de gestion', SUBSCRIPTION: 'Abonnement', AUTONOMOUS_SUBSCRIPTION: 'Gestion autonome (abonnement + 1 %)', CREDIT_NOTE: 'Avoir' };
const LIFECYCLE = { draft: ['Brouillon', 'neutral'], issued: ['Émise', 'info'], partially_paid: ['Partiellement payée', 'warning'], paid: ['Payée', 'success'], overdue: ['En retard', 'danger'], credited: ['Corrigée par avoir', 'neutral'], cancelled: ['Annulée', 'neutral'] };

export function BillingSummary({ summary, extra = [] }) {
  if (!summary) return null;
  return (
    <DashboardKpiGrid>
      <DashboardKpiCard label="Loyers attendus" value={money(summary.rentExpectedMinor)} />
      <DashboardKpiCard label="Loyers réglés (affectés)" value={money(summary.rentPaidAllocatedMinor)} tone="green" />
      <DashboardKpiCard label="Impayés" value={money(summary.unpaidMinor)} tone="gold" />
      <DashboardKpiCard label="En retard" value={money(summary.overdueMinor)} detail={`${summary.overdueCount} facture(s)`} tone="red" />
      <DashboardKpiCard label="Commissions facturées" value={money(summary.commissionsInvoicedMinor)} />
      <DashboardKpiCard label="Abonnements facturés" value={money(summary.subscriptionsInvoicedMinor)} />
      {extra.map((item) => <DashboardKpiCard key={item.label} label={item.label} value={money(item.value)} />)}
    </DashboardKpiGrid>
  );
}

export default function BillingDocumentList({ documents, renderActions }) {
  return (
    <ul className="grid gap-2" aria-label="Documents de facturation">
      {documents.map((doc) => {
        const [label, tone] = LIFECYCLE[doc.lifecycle] || [doc.lifecycle, 'neutral'];
        return (
          <li key={doc.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-white p-3 text-sm">
            <div>
              <p className="font-semibold text-slate-900">{KIND[doc.billingKind] || doc.billingKind} {doc.period ? `· ${doc.period}` : ''} {doc.documentNumber ? `· ${doc.documentNumber}` : ''}</p>
              <p className="text-slate-600">{doc.customer?.name || '—'} · échéance {doc.dueDate ? new Date(doc.dueDate).toLocaleDateString('fr-FR') : '—'} · solde {money(doc.balanceMinor)}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-bold text-slate-900">{money(doc.totalMinor)}</span>
              <DashboardBadge tone={tone}>{label}</DashboardBadge>
              {renderActions?.(doc)}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
