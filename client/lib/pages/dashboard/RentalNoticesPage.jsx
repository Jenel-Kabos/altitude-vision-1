"use client";

// Sprint 0 — domaine Gestion Locative (préparation de navigation).
import ComingSoonPage from "../../components/dashboard/ComingSoonPage";

const RentalNoticesPage = () => (
  <ComingSoonPage
    title="Préavis"
    description="Vue dédiée aux préavis et sorties programmées, à venir. En attendant, consultez la vue d'ensemble de la Gestion Locative."
    backHref="/dashboard/gestion-locative"
    backLabel="Aller à la vue d'ensemble"
  />
);

export default RentalNoticesPage;
