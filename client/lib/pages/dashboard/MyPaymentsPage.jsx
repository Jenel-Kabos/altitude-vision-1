"use client";

// Sprint 0 — domaine propriétaire (préparation de navigation uniquement).
import Link from "next/link";
import { CreditCard } from "lucide-react";
import { DashboardCard, DashboardPage, DashboardPageHeader, DashboardState } from "../../components/dashboard/DashboardUI";

const MyPaymentsPage = () => (
  <DashboardPage>
    <DashboardPageHeader icon={CreditCard} title="Mes paiements" description="Suivi de vos paiements, loyers perçus et frais de gestion." />
    <DashboardCard>
      <DashboardState title="Suivi des paiements à venir" description="Cette fonctionnalité sera bientôt disponible." action={<Link href="/mes-biens">Aller à Mes annonces</Link>} />
    </DashboardCard>
  </DashboardPage>
);

export default MyPaymentsPage;
