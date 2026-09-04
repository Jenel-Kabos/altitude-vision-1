"use client";

import { useCallback, useEffect, useState } from "react";
import { CreditCard, RefreshCw } from "lucide-react";
import { getOwnerRentalPayments } from "../../services/ownerRentalFinancialService";
import { DashboardCard, DashboardKpiCard, DashboardKpiGrid, DashboardPage, DashboardPageHeader, DashboardPagination, DashboardState, DashboardTableContainer } from "../../components/dashboard/DashboardUI";

const money = (value) => new Intl.NumberFormat("fr-FR", { style: "currency", currency: "XAF", maximumFractionDigits: 0 }).format(Number(value) || 0);

const MyPaymentsPage = () => {
  const [page, setPage] = useState(1);
  const [data, setData] = useState({ items: [], summary: {}, pagination: { pages: 1 } });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    setLoading(true); setError("");
    try { setData(await getOwnerRentalPayments({ page, limit: 20 })); }
    catch { setError("Veuillez réessayer dans quelques instants."); }
    finally { setLoading(false); }
  }, [page]);
  useEffect(() => { load(); }, [load]);

  return <DashboardPage>
    <DashboardPageHeader icon={CreditCard} title="Mes paiements" description="Suivi des loyers encaissés pour vos biens confiés à la gestion locative."
      actions={<button type="button" aria-label="Actualiser" onClick={load}><RefreshCw aria-hidden="true" /> Actualiser</button>} />
    {loading ? <DashboardCard><DashboardState type="loading" title="Chargement des paiements…" /></DashboardCard>
      : error ? <DashboardCard><DashboardState type="error" title="Impossible de charger les paiements" description={error} action={<button type="button" onClick={load}>Réessayer</button>} /></DashboardCard>
      : <>
        <DashboardKpiGrid>
          <DashboardKpiCard label="Loyer attendu" value={money(data.summary?.du)} />
          <DashboardKpiCard label="Montant payé" value={money(data.summary?.recu)} tone="green" />
          <DashboardKpiCard label="Reste à payer" value={money(data.summary?.restant)} tone="orange" />
        </DashboardKpiGrid>
        {!data.items.length ? <DashboardCard><DashboardState title="Aucun paiement locatif" description="Aucune échéance n'est encore enregistrée pour vos biens gérés." /></DashboardCard>
          : <DashboardCard><DashboardTableContainer label="Historique des paiements locatifs"><table className="w-full min-w-[1080px]"><thead><tr><th>Bien</th><th>Bail</th><th>Locataire</th><th>Période</th><th>Attendu</th><th>Payé</th><th>Restant</th><th>Statut</th><th>Date</th><th>Mode</th><th>Référence</th></tr></thead><tbody>{data.items.map((item) => <tr key={item._id}><td>{item.property?.title || "Bien"}</td><td>{item.lease?._id ? String(item.lease._id).slice(-8) : "—"}</td><td>{item.lease?.tenantName || "—"}</td><td>{item.period}</td><td>{money(item.expected)}</td><td>{money(item.paid)}</td><td>{money(item.remaining)}</td><td>{item.status || "—"}</td><td>{item.datePaiement ? new Date(item.datePaiement).toLocaleDateString("fr-FR") : "—"}</td><td>{item.modePaiement || "—"}</td><td>{item.reference || "—"}</td></tr>)}</tbody></table></DashboardTableContainer>
            <DashboardPagination page={page} totalPages={Math.max(1, data.pagination?.pages || 1)} previousAriaLabel="Page précédente" nextAriaLabel="Page suivante" onPrevious={() => setPage((value) => Math.max(1, value - 1))} onNext={() => setPage((value) => value + 1)} />
          </DashboardCard>}
      </>}
  </DashboardPage>;
};

export default MyPaymentsPage;
