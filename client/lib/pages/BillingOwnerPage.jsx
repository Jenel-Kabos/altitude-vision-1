"use client";

// F-U2.7 — Espace propriétaire : loyers, encaissements confirmés, impayés,
// commissions et abonnements le concernant (lecture seule).
import React, { useEffect, useState } from 'react';
import { DashboardPage, DashboardPageHeader, DashboardState } from '../components/dashboard/DashboardUI';
import BillingDocumentList, { BillingSummary } from '../components/billing/BillingDocumentList';
import AutonomousBillingPanel from '../components/billing/AutonomousBillingPanel';
import RentCollectionPanel from '../components/billing/RentCollectionPanel';
import { getOwnerBilling } from '../services/billingService';

export default function BillingOwnerPage() {
  const [state, setState] = useState({ loading: true, data: null, error: null });
  useEffect(() => {
    getOwnerBilling().then((data) => setState({ loading: false, data, error: null }))
      .catch((error) => setState({ loading: false, data: null, error: error?.response?.data?.message || 'Facturation indisponible.' }));
  }, []);
  const { loading, data, error } = state;
  return (
    <DashboardPage className="mx-auto max-w-5xl px-4 py-8">
      <DashboardPageHeader eyebrow="Mon compte" title="Mes factures" description="Loyers de vos biens, commissions de gestion et abonnements. La commission n’est due que sur les loyers effectivement encaissés et confirmés." />
      {loading ? <DashboardState title="Chargement…" /> : error ? <DashboardState type="error" title={error} /> : (
        <div className="grid gap-4">
          <BillingSummary summary={data.summary} extra={[{ label: 'Loyers encaissés et confirmés', value: data.summary.rentCollectedConfirmedMinor }, { label: 'Commissions acquises', value: data.summary.commissionsAcquiredMinor }]} />
          <RentCollectionPanel mode="owner" />
          <AutonomousBillingPanel />
          {data.documents.length ? <BillingDocumentList documents={data.documents} /> : <DashboardState title="Aucun document" />}
        </div>
      )}
    </DashboardPage>
  );
}
