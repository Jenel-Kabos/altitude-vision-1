"use client";

// Dette technique GL-B2 (Mission 9) — extrait de GestionLocativePage.jsx,
// markup et classes strictement identiques (aucun changement visuel).

import React from "react";

const NoticeOverview = ({ count, colors }) => (
  <div className="border border-gray-100 rounded-xl p-3 text-center">
    <p className="text-base font-extrabold" style={{ color: colors.GOLD }}>{count}</p>
    <p className="text-xs text-gray-400">Préavis actifs</p>
  </div>
);

export default NoticeOverview;
