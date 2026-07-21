"use client";

// Sprint 0 — domaine Gestion Locative (préparation de navigation).
import ComingSoonPage from "../../components/dashboard/ComingSoonPage";

const RentalMaintenancePage = () => (
  <ComingSoonPage
    title="Maintenance"
    description="Vue dédiée aux biens en travaux/maintenance, à venir. En attendant, consultez la vue d'ensemble de la Gestion Locative."
    backHref="/dashboard/gestion-locative"
    backLabel="Aller à la vue d'ensemble"
  />
);

export default RentalMaintenancePage;
