"use client";

// client/lib/pages/SejournerLandingPage.jsx — Sprint 0 (architecture
// Altimmo). Page d'entrée du domaine "Séjourner" (hébergement meublé),
// remplace le lien générique "Toutes les annonces" par une navigation
// publique par catégorie. Réutilise entièrement le listing existant
// (AltimmoAnnonces, filtres ?status=&type= déjà supportés) — aucune
// nouvelle logique de recherche ici, uniquement des liens.

import Link from "next/link";
import { Building2, Home, DoorOpen, Hotel } from "lucide-react";

const GOLD = "#C8960C";
const BLUE = "#2E7BB5";

const CATEGORIES = [
  { type: "appartement_meuble", label: "Appartements", Icon: Building2, description: "Appartements meublés, pour un séjour de quelques nuits ou plusieurs semaines." },
  { type: "villa_meublee", label: "Villas", Icon: Home, description: "Villas meublées avec espace et intimité, idéales en famille ou entre amis." },
  { type: "studio_meuble", label: "Studios", Icon: DoorOpen, description: "Studios meublés, pratiques pour un séjour court en solo ou en couple." },
  // Sprint B2 — "Hôtels" pointe désormais vers le domaine Hôtellerie dédié
  // (liste + fiche détail avec catégories/tarifs/services), plus vers le
  // listing générique Property filtré par type.
  { type: "hotel", label: "Hôtels", Icon: Hotel, description: "Établissements hôteliers référencés sur Altimmo.", href: "/immobilier/hotels" },
];

const SejournerLandingPage = () => (
  <div style={{ background: "#F8F8F8", minHeight: "70vh", padding: "4rem 1.5rem" }}>
    <div style={{ maxWidth: 980, margin: "0 auto" }}>
      <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: "0.75rem", letterSpacing: "0.14em", textTransform: "uppercase", color: GOLD, fontWeight: 700, marginBottom: "0.6rem" }}>
        Altimmo — Séjourner
      </p>
      <h1 style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: "2.4rem", color: "#111827", margin: "0 0 0.8rem" }}>
        Un séjour meublé, à votre mesure
      </h1>
      <p style={{ fontFamily: "'DM Sans', sans-serif", color: "#4B5563", maxWidth: 640, marginBottom: "2.5rem" }}>
        Choisissez une catégorie pour affiner votre recherche, ou consultez{" "}
        <Link href="/immobilier/annonces?status=hebergement" style={{ color: BLUE, fontWeight: 600 }}>
          tous les hébergements
        </Link>.
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "1.25rem" }}>
        {CATEGORIES.map(({ type, label, Icon, description, href }) => (
          <Link
            key={type}
            href={href || `/immobilier/annonces?status=hebergement&type=${type}`}
            style={{
              display: "flex", flexDirection: "column", gap: "0.6rem",
              background: "#FFFFFF", borderRadius: 10, padding: "1.5rem",
              border: "1px solid rgba(17,24,39,0.06)", boxShadow: "0 2px 12px rgba(0,0,0,0.05)",
              textDecoration: "none", transition: "transform 0.15s ease, box-shadow 0.15s ease",
            }}
          >
            <div style={{ width: 42, height: 42, borderRadius: 8, background: "rgba(200,150,12,0.1)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Icon size={20} color={GOLD} />
            </div>
            <h3 style={{ fontFamily: "'DM Sans', sans-serif", fontWeight: 700, color: "#111827", margin: 0 }}>{label}</h3>
            <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: "0.85rem", color: "#6B7280", margin: 0 }}>{description}</p>
          </Link>
        ))}
      </div>
    </div>
  </div>
);

export default SejournerLandingPage;
