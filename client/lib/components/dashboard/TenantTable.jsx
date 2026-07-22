"use client";

// Dette technique GL-B2 (Mission 9) — widget "Locataires actifs" de la vue
// d'ensemble, extrait de GestionLocativePage.jsx. Le tableau CRUD complet
// des locataires reste dans l'onglet "Locataires" du monolithe (extraction
// différée — voir RENTAL_MANAGEMENT_V2.md, dette restante) ; la page dédiée
// `/dashboard/gestion-locative/locataires` (RentalTenantsPage.jsx) reste la
// référence pour la liste complète.

import React from "react";
import Link from "next/link";

const TenantTable = ({ count, colors }) => (
  <div className="border border-gray-100 rounded-xl p-3 text-center">
    <Link href="/dashboard/gestion-locative/locataires" className="block">
      <p className="text-base font-extrabold" style={{ color: colors.BLUE }}>{count}</p>
      <p className="text-xs text-gray-400">Locataires actifs</p>
    </Link>
  </div>
);

export default TenantTable;
