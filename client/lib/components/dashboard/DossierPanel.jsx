"use client";

// DOC-EVO-1 — Moteur générique de "dossier métier" : un seul composant pour
// tous les domaines (gestion_locative, vente_location, hebergement,
// hotellerie, et demain Altcom/Mila Events/Administration) — il ne fait
// qu'afficher l'enveloppe déjà uniforme renvoyée par
// GET /api/dossiers/:domain/:entityId (server/services/dossier/). Aucune
// donnée n'est recalculée ici, uniquement présentée : résumé, documents
// liés, paiements, maintenance, préavis, timeline reconstruite, navigation
// croisée (uniquement vers des routes réellement existantes — jamais un
// lien mort), prévisualisation sans téléchargement forcé.

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "react-hot-toast";
import { X, Clock, FileText, ExternalLink } from "lucide-react";
import { getDossier } from "../../services/dossierService";
import { previewRentalDocument } from "../../services/gestionLocativeService";
import { DashboardState } from "./DashboardUI";

const STATUS_STYLE = {
  Actif: { bg: '#F0FDF4', text: '#16A34A' },
  'En cours': { bg: '#EFF6FF', text: '#2E7BB5' },
  Terminé: { bg: '#F3F4F6', text: '#6B7280' },
  Archivé: { bg: '#FEF2F2', text: '#991B1B' },
};

// Navigation croisée : uniquement vers des routes qui existent réellement
// dans cette application — un entityType absent d'ici reste un simple
// libellé informatif, jamais un lien cassé.
const ROUTE_BY_ENTITY_TYPE = {
  Property: (entityId) => `/properties/edit/${entityId}`,
  Hotel: (entityId) => `/dashboard/hotels/${entityId}`,
};

const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('fr-FR') : '—');

const RelatedLink = ({ link }) => {
  const buildRoute = ROUTE_BY_ENTITY_TYPE[link.entityType];
  if (!buildRoute) return <span className="text-xs text-gray-500 px-2 py-1 rounded bg-gray-100">{link.label}</span>;
  return (
    <Link href={buildRoute(link.entityId)} className="text-xs text-blue-600 underline px-2 py-1 rounded bg-blue-50 inline-flex items-center gap-1">
      {link.label} <ExternalLink size={11} />
    </Link>
  );
};

const DossierPanel = ({ domain, entityId, onClose }) => {
  const [dossier, setDossier] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await getDossier(domain, entityId);
        if (!cancelled) setDossier(data);
      } catch (err) {
        if (!cancelled) setError(err.response?.status === 403 ? "Accès refusé à ce dossier." : 'Impossible de charger ce dossier.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [domain, entityId]);

  // DOC-EVO-1 — évolution 8 : ouvrir un document (bail/quittance/EDL/pièce
  // d'identité) sans téléchargement obligatoire. Réutilise le même
  // téléchargement sécurisé proxy-streamé (jamais l'URL Cloudinary brute),
  // ouvert dans un nouvel onglet plutôt que forcé en enregistrement fichier.
  const handleOpenDocument = async (item) => {
    try {
      if (item.previewUrl?.startsWith('/api/rental-documents/')) {
        const docId = item.previewUrl.split('/')[3];
        await previewRentalDocument(docId, item.label);
      } else if (item.previewUrl) {
        window.open(item.previewUrl, '_blank', 'noopener,noreferrer');
      } else {
        toast.error('Aucun fichier associé à ce document.');
      }
    } catch {
      toast.error("Impossible d'ouvrir ce document.");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.55)' }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-lg font-bold text-gray-900">Dossier</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400"><X size={18} /></button>
        </div>

        <div className="overflow-y-auto flex-1 px-6 py-5 space-y-5">
          {loading && <DashboardState type="loading" title="Chargement du dossier…" />}
          {error && <DashboardState title="Erreur" description={error} />}

          {dossier && (
            <>
              {/* Résumé */}
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-xl font-bold text-gray-900">{dossier.summary.title}</h3>
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full"
                    style={{ background: STATUS_STYLE[dossier.status]?.bg || '#F3F4F6', color: STATUS_STYLE[dossier.status]?.text || '#6B7280' }}>
                    {dossier.status}
                  </span>
                </div>
                {dossier.summary.subtitle && <p className="text-sm text-gray-500 mt-0.5">{dossier.summary.subtitle}</p>}
                <div className="flex gap-1.5 mt-2 flex-wrap">
                  {(dossier.summary.badges || []).map((b) => <span key={b} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">{b}</span>)}
                </div>
              </div>

              {/* Navigation croisée */}
              {dossier.relatedLinks?.length > 0 && (
                <div className="flex gap-2 flex-wrap">
                  {dossier.relatedLinks.map((link) => <RelatedLink key={`${link.entityType}-${link.entityId}`} link={link} />)}
                </div>
              )}

              {/* Sections (documents, paiements, maintenance, préavis…) */}
              {dossier.sections.filter((s) => s.items.length > 0).map((section) => (
                <div key={section.key}>
                  <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">{section.label}</p>
                  <ul className="space-y-1.5">
                    {section.items.map((item) => (
                      <li key={item.id} className="flex items-center justify-between text-sm border border-gray-100 rounded-lg px-3 py-2">
                        <span className="flex items-center gap-2 text-gray-700"><FileText size={13} className="text-gray-400" />{item.label}</span>
                        <span className="flex items-center gap-3">
                          <span className="text-xs text-gray-400">{fmtDate(item.date)}</span>
                          {(item.previewUrl) && (
                            <button onClick={() => handleOpenDocument(item)} className="text-xs text-blue-600 underline">Ouvrir</button>
                          )}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}

              {/* Timeline */}
              {dossier.timeline?.length > 0 && (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2 flex items-center gap-1.5"><Clock size={12} /> Timeline</p>
                  <ol className="space-y-2 border-l-2 border-blue-100 pl-4">
                    {dossier.timeline.map((event, i) => (
                      <li key={`${event.type}-${i}`}>
                        <p className="text-sm font-medium text-gray-700">{event.label}</p>
                        <p className="text-xs text-gray-400">{fmtDate(event.date)}</p>
                      </li>
                    ))}
                  </ol>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default DossierPanel;
