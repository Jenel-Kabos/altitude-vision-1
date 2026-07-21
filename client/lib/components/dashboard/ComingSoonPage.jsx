"use client";

// client/lib/components/dashboard/ComingSoonPage.jsx — Sprint 0 (architecture
// fonctionnelle Altimmo). Page-écran générique pour préparer une route de
// navigation avant que le module correspondant ne soit implémenté — voir
// server/docs/ARCHITECTURE_ALTIMMO_V2.md. Ne porte aucune logique métier.

import Link from "next/link";
import { Construction } from "lucide-react";

const ComingSoonPage = ({
  title,
  description,
  sprintLabel = "Sprint B2",
  backHref,
  backLabel = "Retour",
}) => (
  <div className="min-h-[60vh] flex items-center justify-center p-6">
    <div className="max-w-lg w-full text-center bg-white rounded-2xl shadow-sm border border-gray-200 p-10">
      <div className="mx-auto mb-5 w-14 h-14 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center">
        <Construction className="w-7 h-7" />
      </div>
      <h1 className="text-xl font-bold text-gray-900 mb-2">{title}</h1>
      <p className="text-sm text-gray-500 mb-4">
        {description || "Cette page prépare la navigation pour un module à venir."}
      </p>
      <span className="inline-block text-xs font-semibold uppercase tracking-wide text-blue-600 bg-blue-50 px-3 py-1 rounded-full mb-6">
        Disponible dans le {sprintLabel}
      </span>
      {backHref && (
        <div>
          <Link href={backHref} className="text-sm font-medium text-blue-600 hover:underline">
            {backLabel}
          </Link>
        </div>
      )}
    </div>
  </div>
);

export default ComingSoonPage;
