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

// DOC-EVO-2 — santé du dossier : purement informatif, jamais un champ
// stocké côté serveur (voir dossierHealthEngine.js).
const HEALTH_STYLE = {
  conforme: { bg: '#F0FDF4', text: '#16A34A', icon: '✓', label: 'Conforme' },
  attention: { bg: '#FFFBEB', text: '#B45309', icon: '⚠', label: 'Attention' },
  critique: { bg: '#FEF2F2', text: '#991B1B', icon: '✕', label: 'Critique' },
};

// DOC-EVO-2 — Phase 5 : chaque action connue navigue vers la page existante
// qui porte réellement le workflow (jamais de nouvelle route/formulaire) —
// une clé sans mapping ici ne serait de toute façon jamais renvoyée par le
// serveur (voir dossierActionsEngine.js), mais on ne rend que ce qui est
// mappé, par cohérence avec RelatedLink (jamais un lien mort).
const ACTION_ROUTE = {
  generate_bail: (id) => `/dashboard/gestion-locative/documents?contratId=${id}`,
  generate_quittance: (id) => `/dashboard/gestion-locative/documents?contratId=${id}`,
  generate_preavis: (id) => `/dashboard/gestion-locative/documents?contratId=${id}`,
  generate_etat_des_lieux_entree: (id) => `/dashboard/gestion-locative/documents?contratId=${id}`,
  generate_etat_des_lieux_sortie: (id) => `/dashboard/gestion-locative/documents?contratId=${id}`,
  signaler_maintenance: () => '/dashboard/gestion-locative/maintenance',
  gerer_preavis: () => '/dashboard/gestion-locative/preavis',
  renouveler_bail: () => '/dashboard/gestion-locative',
  cloturer_bail: () => '/dashboard/gestion-locative',
};

// Navigation croisée : uniquement vers des routes qui existent réellement
// dans cette application — un entityType absent d'ici reste un simple
// libellé informatif, jamais un lien cassé.
const ROUTE_BY_ENTITY_TYPE = {
  Property: (entityId) => `/properties/edit/${entityId}`,
  Hotel: (entityId) => `/dashboard/hotels/${entityId}`,
};

const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('fr-FR') : '—');
const fmtFcfa = (n) => (n || n === 0 ? `${Number(n).toLocaleString('fr-FR')} FCFA` : '—');

// GL-UX-1 — Phase 7 : le Centre documentaire branche automatiquement les
// workflows GL-LIFE-1 (cycle de vie, avenants, caution, chaîne de
// renouvellement) — ces données existent déjà dans l'enveloppe API depuis
// DOC-EVO-2/GL-LIFE-1 (`item.meta`), seul leur AFFICHAGE était générique
// jusqu'ici. Aucune donnée supplémentaire n'est stockée : tout vient de
// `dossier.sections` déjà renvoyé par gestionLocativeDossierAdapter.js.
const CYCLE_VIE_LABELS = {
  projet: 'Projet de bail', en_preparation: 'En préparation', a_signer: 'À signer',
  actif: 'Actif', preavis: 'Préavis', inspection_sortie: 'Inspection de sortie',
  cloture_financiere: 'Clôture financière', resilie: 'Résilié', archive: 'Archivé',
};
const CAUTION_LABELS = {
  non_versee: 'Non versée', versee: 'Versée', bloquee: 'Bloquée',
  partiellement_restituee: 'Partiellement restituée', restituee: 'Restituée', retenue_totale: 'Retenue totale',
};

const ContratSectionItem = ({ item, onOpenLinkedContrat }) => (
  <li className="border border-gray-100 rounded-lg px-3 py-2 space-y-1.5">
    <div className="flex items-center justify-between text-sm">
      <span className="text-gray-700">{item.label}</span>
      <span className="text-xs text-gray-400">{fmtDate(item.date)}</span>
    </div>
    <div className="flex gap-1.5 flex-wrap">
      {item.meta?.cycleVie && (
        <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700">
          {CYCLE_VIE_LABELS[item.meta.cycleVie] || item.meta.cycleVie}
        </span>
      )}
      {item.meta?.caution && (
        <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700">
          Caution : {CAUTION_LABELS[item.meta.caution.statut] || item.meta.caution.statut}
          {item.meta.caution.montantRetenu > 0 && ` (retenu ${fmtFcfa(item.meta.caution.montantRetenu)})`}
        </span>
      )}
    </div>
    {(item.meta?.renouvelleDe || item.meta?.renouvelePar) && (
      <div className="flex gap-2 flex-wrap text-xs">
        {item.meta.renouvelleDe && (
          <button onClick={() => onOpenLinkedContrat(item.meta.renouvelleDe.contratId)} className="text-blue-600 underline">
            ← Contrat précédent ({item.meta.renouvelleDe.statut})
          </button>
        )}
        {item.meta.renouvelePar && (
          <button onClick={() => onOpenLinkedContrat(item.meta.renouvelePar.contratId)} className="text-blue-600 underline">
            Contrat suivant ({item.meta.renouvelePar.statut}) →
          </button>
        )}
      </div>
    )}
  </li>
);

const AvenantSectionItem = ({ item }) => (
  <li className="border border-gray-100 rounded-lg px-3 py-2 space-y-1">
    <div className="flex items-center justify-between text-sm">
      <span className="text-gray-700">{item.label}</span>
      <span className="text-xs text-gray-400">{fmtDate(item.date)}</span>
    </div>
    {item.meta?.motif && <p className="text-xs text-gray-500">{item.meta.motif}</p>}
    {item.meta?.champsModifies?.length > 0 && (
      <ul className="space-y-0.5">
        {item.meta.champsModifies.map((c) => (
          <li key={c.champ} className="text-xs text-gray-600">
            <span className="font-medium">{c.champ}</span> : {String(c.avant ?? '—')} → {String(c.apres ?? '—')}
          </li>
        ))}
      </ul>
    )}
  </li>
);

// GL-ASSET-UX-1 — Phase 7 : le dossier "bien" (domain='bien', GL-ASSET-1)
// reçoit lui aussi un rendu riche pour ses sections 'maintenance' et
// 'transactions' — même principe que 'contrat'/'avenants' ci-dessus,
// aucune donnée supplémentaire, uniquement un affichage dédié de
// `item.meta` déjà présent dans l'enveloppe.
const MAINTENANCE_STATUS_LABELS = { ouvert: 'Ouvert', assigne: 'Assigné', planifie: 'Planifié', en_cours: 'En cours', resolu: 'Résolu', cloture: 'Clôturé' };

const MaintenanceSectionItem = ({ item }) => (
  <li className="border border-gray-100 rounded-lg px-3 py-2 space-y-1">
    <div className="flex items-center justify-between text-sm">
      <span className="text-gray-700">{item.label}</span>
      <span className="text-xs text-gray-400">{fmtDate(item.date)}</span>
    </div>
    <p className="text-xs text-gray-500">
      {MAINTENANCE_STATUS_LABELS[item.meta?.status] || item.meta?.status}
      {item.meta?.actualCost ? ` · ${fmtFcfa(item.meta.actualCost)}` : ''}
      {item.meta?.entrepriseIntervenante ? ` · ${item.meta.entrepriseIntervenante}` : ''}
    </p>
    {item.meta?.garantieJusquau && <p className="text-xs text-green-600">Garantie jusqu'au {fmtDate(item.meta.garantieJusquau)}</p>}
  </li>
);

const TransactionSectionItem = ({ item }) => (
  <li className="flex items-center justify-between text-sm border border-gray-100 rounded-lg px-3 py-2">
    <span className="text-gray-700">{item.label}</span>
    <span className="flex items-center gap-3">
      {item.meta?.finalAmount ? <span className="text-xs font-semibold text-gray-600">{fmtFcfa(item.meta.finalAmount)}</span> : null}
      <span className="text-xs text-gray-400">{fmtDate(item.date)}</span>
    </span>
  </li>
);

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
  const [linkedContratId, setLinkedContratId] = useState(null);

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
                  {dossier.health && (
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full inline-flex items-center gap-1"
                      style={{ background: HEALTH_STYLE[dossier.health.level]?.bg, color: HEALTH_STYLE[dossier.health.level]?.text }}
                      title={dossier.health.checks.map((c) => c.label).join(' · ')}>
                      {HEALTH_STYLE[dossier.health.level]?.icon} {HEALTH_STYLE[dossier.health.level]?.label}
                    </span>
                  )}
                </div>
                {dossier.health?.checks?.length > 0 && (
                  <ul className="mt-1.5 space-y-0.5">
                    {dossier.health.checks.map((c) => (
                      <li key={c.key} className="text-xs" style={{ color: HEALTH_STYLE[c.level]?.text }}>
                        {HEALTH_STYLE[c.level]?.icon} {c.label}
                      </li>
                    ))}
                  </ul>
                )}
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

              {/* Sections (documents, paiements, maintenance, préavis…) —
                  'contrat' et 'avenants' (GL-LIFE-1) reçoivent un rendu
                  riche dédié ; toutes les autres sections restent au rendu
                  générique historique (label/date/aperçu), inchangé. */}
              {dossier.sections.filter((s) => s.items.length > 0).map((section) => (
                <div key={section.key}>
                  <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">{section.label}</p>
                  <ul className="space-y-1.5">
                    {section.items.map((item) => {
                      if (section.key === 'contrat') return <ContratSectionItem key={item.id} item={item} onOpenLinkedContrat={setLinkedContratId} />;
                      if (section.key === 'avenants') return <AvenantSectionItem key={item.id} item={item} />;
                      if (section.key === 'maintenance') return <MaintenanceSectionItem key={item.id} item={item} />;
                      if (section.key === 'transactions') return <TransactionSectionItem key={item.id} item={item} />;
                      return (
                        <li key={item.id} className="flex items-center justify-between text-sm border border-gray-100 rounded-lg px-3 py-2">
                          <span className="flex items-center gap-2 text-gray-700"><FileText size={13} className="text-gray-400" />{item.label}</span>
                          <span className="flex items-center gap-3">
                            <span className="text-xs text-gray-400">{fmtDate(item.date)}</span>
                            {(item.previewUrl) && (
                              <button onClick={() => handleOpenDocument(item)} className="text-xs text-blue-600 underline">Ouvrir</button>
                            )}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}

              {/* Actions contextuelles — DOC-EVO-2 : filtrées côté serveur par
                  rôle + état, ici on ne rend que celles pour lesquelles une
                  page réelle existe (jamais un bouton mort). */}
              {dossier.actions?.length > 0 && (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">Actions possibles</p>
                  <div className="flex gap-2 flex-wrap">
                    {dossier.actions.filter((a) => ACTION_ROUTE[a.key]).map((a) => (
                      <Link key={a.key} href={ACTION_ROUTE[a.key](dossier.entityId)}
                        className="text-xs font-medium px-3 py-1.5 rounded-lg bg-gray-900 text-white hover:bg-gray-700">
                        {a.label}
                      </Link>
                    ))}
                  </div>
                </div>
              )}

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

      {/* GL-UX-1 — Phase 7 : navigation dans la chaîne de renouvellement
          (Contrat #1 → renouvelé par → Contrat #2…) — réouvre simplement ce
          même composant générique sur l'autre contrat, jamais un nouvel
          écran dédié. */}
      {linkedContratId && (
        <DossierPanel domain="gestion_locative" entityId={linkedContratId} onClose={() => setLinkedContratId(null)} />
      )}
    </div>
  );
};

export default DossierPanel;
