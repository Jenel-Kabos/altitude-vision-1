"use client";

// GL-ASSET-UX-1 — Phase 2-3 : page dédiée du cockpit patrimonial staff.
// Nouvelle route (aucune page de détail patrimonial n'existait avant ce
// sprint — voir audit) — reste strictement une page d'orchestration : elle
// charge le bien puis délègue tout l'affichage à PropertyAssetCockpit.
import React, { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useAuth } from "../../context/AuthContext";
import { isStaffDocs } from "../../utils/staffRoles";
import { getPropertyById } from "../../services/propertyService";
import { DashboardPage, DashboardPageHeader, DashboardState } from "../../components/dashboard/DashboardUI";
import PropertyAssetCockpit from "../../components/dashboard/propertyAsset/PropertyAssetCockpit";
import { Building2 } from "lucide-react";

const PropertyAssetCockpitPage = () => {
  const { user } = useAuth();
  const { id } = useParams();
  const [property, setProperty] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const data = await getPropertyById(id);
        if (!cancelled) setProperty(data);
      } catch {
        if (!cancelled) setError("Impossible de charger ce bien.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [id]);

  if (!isStaffDocs(user)) {
    return <DashboardPage><DashboardState title="Accès refusé" description="Cette page est réservée au staff." /></DashboardPage>;
  }

  return (
    <DashboardPage>
      <DashboardPageHeader icon={Building2} title={property?.title || "Cockpit patrimonial"} description="Cycle de vie, valorisation, carnet d'entretien et alertes du bien." />
      {loading && <DashboardState type="loading" title="Chargement du bien…" />}
      {error && <DashboardState title="Erreur" description={error} />}
      {property && <PropertyAssetCockpit property={property} />}
    </DashboardPage>
  );
};

export default PropertyAssetCockpitPage;
