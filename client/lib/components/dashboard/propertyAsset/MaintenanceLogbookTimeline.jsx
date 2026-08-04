"use client";

// GL-ASSET-UX-1 — Phase 5 : carnet d'entretien visuel (timeline). Toutes les
// données viennent de propertyMaintenanceLogbookService.getMaintenanceLogbook
// (GL-ASSET-1) — aucune donnée recalculée ici. Navigation croisée : vers la
// page Maintenance existante, et vers le dossier du Contrat lié (qui expose
// déjà lui-même paiements/documents — jamais dupliqué ici), en réouvrant le
// même DossierPanel générique (même pattern que la chaîne de renouvellement,
// GL-UX-1).
import React, { useState } from "react";
import Link from "next/link";
import DossierPanel from "../DossierPanel";

const CATEGORY_LABELS = {
  plomberie: "Plomberie", electricite: "Électricité", structure: "Structure", equipement: "Équipement",
  nuisible: "Nuisible", serrurerie: "Serrurerie", peinture: "Peinture", autre: "Autre",
};
const STATUS_LABELS = { ouvert: "Ouvert", assigne: "Assigné", planifie: "Planifié", en_cours: "En cours", resolu: "Résolu", cloture: "Clôturé" };
const fmtDate = (d) => (d ? new Date(d).toLocaleDateString("fr-FR") : "—");
const fmtFcfa = (n) => (n || n === 0 ? `${Number(n).toLocaleString("fr-FR")} FCFA` : "—");

const MaintenanceLogbookTimeline = ({ logbook }) => {
  const [linkedContratId, setLinkedContratId] = useState(null);

  if (!logbook) return null;
  const { tickets = [], coutTotal, interventionsOuvertes, entreprises = [] } = logbook;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex gap-4 text-xs text-gray-500">
          <span>Coût total : <span className="font-semibold text-gray-700">{fmtFcfa(coutTotal)}</span></span>
          <span>Interventions ouvertes : <span className="font-semibold text-gray-700">{interventionsOuvertes}</span></span>
          {entreprises.length > 0 && <span>Entreprises : <span className="font-semibold text-gray-700">{entreprises.join(", ")}</span></span>}
        </div>
        <Link href="/dashboard/gestion-locative/maintenance" className="text-xs text-blue-600 underline">
          Ouvrir la page Maintenance
        </Link>
      </div>

      {tickets.length === 0 ? (
        <p className="text-sm text-gray-400">Aucune intervention enregistrée.</p>
      ) : (
        <ol className="space-y-2 border-l-2 border-blue-100 pl-4">
          {tickets.map((t) => (
            <li key={t._id} className="text-sm">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <p className="font-medium text-gray-700">{CATEGORY_LABELS[t.category] || t.category} — {t.priority}</p>
                <span className="text-xs text-gray-400">{fmtDate(t.createdAt)}</span>
              </div>
              <p className="text-xs text-gray-500">{STATUS_LABELS[t.status] || t.status} {t.actualCost ? `· ${fmtFcfa(t.actualCost)}` : ""} {t.entrepriseIntervenante ? `· ${t.entrepriseIntervenante}` : ""}</p>
              {t.garantieJusquau && <p className="text-xs text-green-600">Garantie jusqu'au {fmtDate(t.garantieJusquau)}</p>}
              {t.lease && (
                <button onClick={() => setLinkedContratId(String(t.lease))} className="text-xs text-blue-600 underline">
                  Voir le contrat lié (documents, paiements)
                </button>
              )}
            </li>
          ))}
        </ol>
      )}

      {linkedContratId && (
        <DossierPanel domain="gestion_locative" entityId={linkedContratId} onClose={() => setLinkedContratId(null)} />
      )}
    </div>
  );
};

export default MaintenanceLogbookTimeline;
