"use client";

// Sprint 0 — domaine Gestion Locative (préparation de navigation).
// La vue d'ensemble existante (/dashboard/gestion-locative) couvre déjà les
// baux actifs de façon consolidée ; cette page prépare une vue dédiée future.
import ComingSoonPage from "../../components/dashboard/ComingSoonPage";

const RentalLeasesPage = () => (
  <ComingSoonPage
    title="Baux"
    description="Vue dédiée aux baux actifs, à venir. En attendant, consultez la vue d'ensemble de la Gestion Locative."
    backHref="/dashboard/gestion-locative"
    backLabel="Aller à la vue d'ensemble"
  />
);

export default RentalLeasesPage;
