"use client";

// GL-UX-1 — Phase 6 : résumé de l'inspection de sortie. La saisie de l'état
// des lieux (pièces/photos/observations) et sa validation existent déjà
// (RentalNoticesPage.jsx → validateExit, GL-B2) — jamais dupliquées ici,
// seulement résumées et reliées : valider l'inspection y déclenche déjà
// automatiquement la transition `preavis → inspection_sortie` côté serveur
// (voir rentalManagementController.validateExitInspection), ce qui ouvre à
// son tour les actions de caution (CautionPanel) — "la phase financière"
// s'enchaîne donc sans code supplémentaire ici.
import React from "react";
import Link from "next/link";

const ETAT_LABELS = { entree: "État des lieux d'entrée", sortie: "État des lieux de sortie" };

const ExitInspectionSummary = ({ contrat }) => {
  const sortie = [...(contrat.etatsDesLieux || [])].reverse().find((e) => e.type === "sortie");

  return (
    <div className="border border-gray-100 rounded-xl p-4 space-y-2">
      <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Inspection de sortie</p>
      {!sortie ? (
        <p className="text-sm text-gray-500">
          Aucun état des lieux de sortie enregistré. La saisie et la validation se font depuis{" "}
          <Link href="/dashboard/gestion-locative/preavis" className="text-blue-600 underline">Préavis &amp; inspections</Link>.
        </p>
      ) : (
        <div className="text-sm space-y-1">
          <p className="text-gray-700">{ETAT_LABELS[sortie.type]} — {new Date(sortie.date).toLocaleDateString("fr-FR")}</p>
          <p className={sortie.validatedByStaff ? "text-green-600" : "text-amber-600"}>
            {sortie.validatedByStaff ? "Validée par le staff" : "En attente de validation"}
          </p>
          {sortie.degradationReported && <p className="text-red-600">Dégradations signalées</p>}
          {sortie.blockingReason && <p className="text-xs text-gray-500">Motif : {sortie.blockingReason}</p>}
          {!sortie.validatedByStaff && (
            <Link href="/dashboard/gestion-locative/preavis" className="text-xs text-blue-600 underline">Valider depuis Préavis &amp; inspections</Link>
          )}
        </div>
      )}
    </div>
  );
};

export default ExitInspectionSummary;
