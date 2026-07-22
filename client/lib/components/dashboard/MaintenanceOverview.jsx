"use client";

// Dette technique GL-B2 (Mission 9) — extrait de GestionLocativePage.jsx,
// markup et classes strictement identiques (aucun changement visuel).

import React from "react";

const MaintenanceOverview = ({ ouvertes, urgentes, colors }) => (
  <>
    <div className="border border-gray-100 rounded-xl p-3 text-center">
      <p className="text-base font-extrabold" style={{ color: colors.GOLD }}>{ouvertes}</p>
      <p className="text-xs text-gray-400">Maintenances ouvertes</p>
    </div>
    <div className="border border-gray-100 rounded-xl p-3 text-center">
      <p className="text-base font-extrabold" style={{ color: colors.RED }}>{urgentes}</p>
      <p className="text-xs text-gray-400">Maintenances urgentes</p>
    </div>
  </>
);

export default MaintenanceOverview;
