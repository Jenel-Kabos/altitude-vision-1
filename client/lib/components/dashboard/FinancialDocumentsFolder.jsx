"use client";

// DOC-ARCH-2 — projection en lecture seule des factures FinancialDocument
// dans le Centre documentaire (dossiers Altimmo → Hébergements / Hôtellerie).
// `FinancialDocument` reste l'unique source de vérité (ADR-FIN-003/007) :
// ce composant ne fait qu'afficher, jamais copier ni recréer ces documents.
// Classement 100% automatique — aucune saisie manuelle possible ici, ces
// factures sont déjà produites par leurs workflows (check-in hôtel,
// réservation d'hébergement).

import React, { useEffect, useState } from "react";
import { toast } from "react-hot-toast";
import { getHotelsAdmin } from "../../services/hotelService";
import { listHotelFinancialDocuments, listAccommodationFinancialDocuments, downloadInvoicePdf } from "../../services/hotelFinancialService";
import { DashboardCard, DashboardState } from "./DashboardUI";
import DossierPanel from "./DossierPanel";

const money = (minor, currency = 'XAF') => (minor == null ? '—' : new Intl.NumberFormat('fr-FR', { style: 'currency', currency, maximumFractionDigits: 0 }).format(minor / 100));

// DOC-EVO-1 — évolution 9 : navigation croisée vers le dossier métier
// (réservation) depuis chaque facture — le domaine du moteur de dossier
// (server/services/dossier/) diffère légèrement du `domain` de ce composant
// ('hotel'/'accommodation', hérité de FinancialDocument.establishmentType).
const DOSSIER_DOMAIN = { hotel: 'hotellerie', accommodation: 'hebergement' };

const FinancialDocumentsFolder = ({ domain }) => {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [openDossierId, setOpenDossierId] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        let documents = [];
        if (domain === 'hotel') {
          const { hotels } = await getHotelsAdmin({ limit: 100 }).catch(() => ({ hotels: [] }));
          const perHotel = await Promise.all((hotels || []).map((h) => listHotelFinancialDocuments(h._id, { limit: 100 }).then((d) => d.documents || []).catch(() => [])));
          documents = perHotel.flat();
        } else {
          const data = await listAccommodationFinancialDocuments({ limit: 100 }).catch(() => ({ documents: [] }));
          documents = data.documents || [];
        }
        if (!cancelled) setRows(documents.sort((a, b) => new Date(b.issueDate || 0) - new Date(a.issueDate || 0)));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [domain]);

  const handleOpen = async (documentId, number) => {
    try {
      const blob = await downloadInvoicePdf(documentId);
      const url = window.URL.createObjectURL(blob);
      window.open(url, '_blank');
    } catch {
      toast.error(`Facture ${number || ''} : PDF pas encore généré (voir le tableau de bord financier).`);
    }
  };

  if (loading) return <DashboardState type="loading" title="Chargement des factures…" />;
  if (rows.length === 0) return null;

  return (
    <DashboardCard className="overflow-x-auto mb-4">
      <p className="px-4 pt-3 text-xs font-semibold uppercase tracking-wider text-gray-400">Factures (générées automatiquement)</p>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-gray-500 border-b">
            <th className="py-2 px-4">N°</th>
            <th className="py-2 pr-3">Statut</th>
            <th className="py-2 pr-3">Montant</th>
            <th className="py-2 pr-3">Date</th>
            <th className="py-2 pr-3">Action</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((d) => (
            <tr key={d.id} className="border-b hover:bg-gray-50">
              <td className="py-2 px-4 font-medium">{d.documentNumber || '—'}</td>
              <td className="py-2 pr-3">
                <span className="text-xs font-semibold px-2 py-1 rounded bg-blue-100 text-blue-800">{d.status}</span>
              </td>
              <td className="py-2 pr-3">{money(d.totalMinor, d.currency)}</td>
              <td className="py-2 pr-3">{d.issueDate ? new Date(d.issueDate).toLocaleDateString('fr-FR') : '—'}</td>
              <td className="py-2 pr-3 flex items-center gap-3">
                <button onClick={() => handleOpen(d.id, d.documentNumber)} className="text-blue-600 underline text-xs">Ouvrir</button>
                {d.subjectId && (
                  <button onClick={() => setOpenDossierId(d.subjectId)} className="text-gray-500 underline text-xs">Dossier</button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {openDossierId && (
        <DossierPanel domain={DOSSIER_DOMAIN[domain] || domain} entityId={openDossierId} onClose={() => setOpenDossierId(null)} />
      )}
    </DashboardCard>
  );
};

export default FinancialDocumentsFolder;
