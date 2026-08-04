"use client";

// GL-ASSET-UX-1 — Phase 6 : alertes intelligentes. Rendu pur des checks
// renvoyés par propertyAlertsService.computeAlerts (GL-ASSET-1) — aucune
// logique de détection ici, uniquement de l'affichage (même convention que
// le bloc santé de DossierPanel.jsx, DOC-EVO-2).
import React from "react";

const HEALTH_STYLE = {
  conforme: { bg: "#F0FDF4", text: "#16A34A", icon: "✓", label: "Conforme" },
  attention: { bg: "#FFFBEB", text: "#B45309", icon: "⚠", label: "Attention" },
  critique: { bg: "#FEF2F2", text: "#991B1B", icon: "✕", label: "Critique" },
};

const PropertyAlertsPanel = ({ alerts }) => {
  if (!alerts) return null;

  return (
    <div className="space-y-2">
      <span className="text-xs font-semibold px-2 py-0.5 rounded-full inline-flex items-center gap-1"
        style={{ background: HEALTH_STYLE[alerts.level]?.bg, color: HEALTH_STYLE[alerts.level]?.text }}>
        {HEALTH_STYLE[alerts.level]?.icon} {HEALTH_STYLE[alerts.level]?.label}
      </span>
      {alerts.checks?.length > 0 ? (
        <ul className="space-y-1">
          {alerts.checks.map((c) => (
            <li key={c.key} className="text-sm" style={{ color: HEALTH_STYLE[c.level]?.text }}>
              {HEALTH_STYLE[c.level]?.icon} {c.label}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-gray-400">Aucune alerte.</p>
      )}
    </div>
  );
};

export default PropertyAlertsPanel;
