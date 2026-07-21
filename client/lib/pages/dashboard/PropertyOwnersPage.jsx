"use client";

// Sprint 0 — domaine Immobilier (préparation de navigation).
import ComingSoonPage from "../../components/dashboard/ComingSoonPage";

const PropertyOwnersPage = () => (
  <ComingSoonPage
    title="Propriétaires"
    description="Vue dédiée aux propriétaires et à leur portefeuille de biens, à venir. En attendant, consultez Utilisateurs (Administration)."
    backHref="/dashboard/properties"
    backLabel="Aller à Immobilier"
  />
);

export default PropertyOwnersPage;
