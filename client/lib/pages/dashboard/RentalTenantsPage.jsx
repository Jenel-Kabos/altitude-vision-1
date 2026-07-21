"use client";

// Sprint 0 — domaine Gestion Locative (préparation de navigation).
import ComingSoonPage from "../../components/dashboard/ComingSoonPage";

const RentalTenantsPage = () => (
  <ComingSoonPage
    title="Locataires"
    description="Vue dédiée aux locataires actifs, à venir. En attendant, consultez la vue d'ensemble de la Gestion Locative."
    backHref="/dashboard/gestion-locative"
    backLabel="Aller à la vue d'ensemble"
  />
);

export default RentalTenantsPage;
