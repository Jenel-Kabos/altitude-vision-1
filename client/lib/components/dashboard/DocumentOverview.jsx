"use client";

// Dette technique GL-B2 (Mission 9) — extrait de GestionLocativePage.jsx,
// markup et classes strictement identiques (aucun changement visuel).

import React from "react";

const DocumentOverview = ({ documents }) => {
  if (!documents || documents.length === 0) return null;
  return (
    <div className="mt-4">
      <p className="text-xs font-semibold text-gray-500 mb-2">Documents récents</p>
      <ul className="text-xs text-gray-600 space-y-1">
        {documents.map((d) => (
          <li key={d._id} className="flex justify-between">
            <span>{d.type} — {d.refNom || d.client?.name || `#${d.docNumber || ''}`}</span>
            <span className="text-gray-400">{d.createdAt ? new Date(d.createdAt).toLocaleDateString('fr-FR') : ''}</span>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default DocumentOverview;
