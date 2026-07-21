"use client";

// Sprint 0 — domaine Gestion Locative (préparation de navigation).
// À ne pas confondre avec "Paiements visites" (/dashboard/paiements),
// module distinct pour les frais de visite.
import ComingSoonPage from "../../components/dashboard/ComingSoonPage";

const RentalPaymentsPage = () => (
  <ComingSoonPage
    title="Paiements locatifs"
    description="Suivi des loyers et échéances par bail, à venir. Distinct des paiements de visite. En attendant, consultez la vue d'ensemble de la Gestion Locative."
    backHref="/dashboard/gestion-locative"
    backLabel="Aller à la vue d'ensemble"
  />
);

export default RentalPaymentsPage;
