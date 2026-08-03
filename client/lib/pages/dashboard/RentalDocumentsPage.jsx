"use client";

// Sprint GL-UX1 — centre documentaire de la Gestion Locative ; sécurisé en
// GL-DEBT-1 (Phase 3). L'agrégation reste purement côté client : aucun
// nouvel endpoint de liste — Contrat.documents[] (bail, quittance, mise en
// demeure, préavis, états des lieux) est déjà renvoyé par GET /contrats
// (aucun .select() restrictif côté contratController.getAll). Chaque
// document reste stocké une seule fois ; cette page n'en fait qu'une vue
// croisée par bien/propriétaire/locataire/bail, jamais une copie physique.
// L'ouverture ne passe plus par l'URL Cloudinary directe (exposée au client)
// mais par downloadRentalDocument → GET /api/rental-documents/:id/download,
// qui vérifie authentification + relation avec le bail avant de streamer.

import React, { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { toast } from "react-hot-toast";
import { FolderOpen, Search } from "lucide-react";
import { getContrats, previewRentalDocument } from "../../services/gestionLocativeService";
import { getAllDocuments } from "../../services/documentService";
import {
  DashboardPage, DashboardPageHeader, DashboardToolbar, DashboardCard, DashboardState,
} from "../../components/dashboard/DashboardUI";
import DossierPanel from "../../components/dashboard/DossierPanel";

const TYPE_LABELS = {
  bail: 'Bail', quittance: 'Quittance', mise_en_demeure: 'Mise en demeure', preavis: 'Préavis',
  etat_entree: "État des lieux d'entrée", etat_sortie: 'État des lieux de sortie',
  piece_identite: "Pièce d'identité",
};

// DOC-ARCH-1 — `embedded` : rendu depuis le Centre documentaire unifié
// (DocumentsPage, dossier Altimmo → Gestion locative). Supprime l'en-tête et
// le lien "voir tous les documents" propres à l'ancien écran autonome
// (devenu une redirection, plus une page) — le reste (agrégation
// Contrat.documents[], filtres, téléchargement sécurisé) est identique et
// intégralement réutilisé, sans aucune duplication de logique.
const RentalDocumentsContent = ({ embedded = false }) => {
  const searchParams = useSearchParams();
  const contratIdFilter = searchParams.get('contratId') || '';

  const [contrats, setContrats] = useState([]);
  // DOC-ARCH-2 — classement automatique : les documents créés hors
  // Contrat.documents[] (ex: pièces d'identité locataire/propriétaire,
  // server/controllers/locataireController.js et proprietaireController.js)
  // sont maintenant tagués pole=Altimmo/service=gestion_locative dès leur
  // création par leur workflow — cette vue les fusionne simplement, sans
  // jamais dupliquer leur stockage (toujours la même collection `Document`).
  const [genericDocs, setGenericDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [type, setType] = useState('');
  const [search, setSearch] = useState('');
  // DOC-EVO-1 — évolution 2 : le Centre documentaire n'affiche plus
  // uniquement des documents isolés, mais aussi les dossiers métier
  // (un bail = un dossier) qu'on peut ouvrir pour voir toute sa vie
  // (documents, paiements, maintenance, préavis, timeline). Dérivé des
  // contrats déjà chargés — aucun appel réseau supplémentaire pour la liste.
  const [openDossierId, setOpenDossierId] = useState(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const [contratsData, docsData] = await Promise.all([
          getContrats({ type: 'location' }).catch(() => []),
          getAllDocuments({ pole: 'Altimmo', service: 'gestion_locative' }).catch(() => []),
        ]);
        setContrats(contratsData || []);
        setGenericDocs(docsData || []);
      } catch (err) { toast.error("Erreur lors du chargement des documents."); }
      finally { setLoading(false); }
    })();
  }, []);

  const documents = useMemo(() => {
    const rows = [];
    for (const c of contrats) {
      if (contratIdFilter && c._id !== contratIdFilter) continue;
      for (const doc of c.documents || []) {
        rows.push({
          key: `${c._id}-${doc._id || doc.url}`,
          documentId: doc._id, nom: doc.nom, type: doc.type, url: doc.url, date: doc.dateGeneration,
          contratId: c._id,
          bien: c.bien?.title || c.adresseBien || '—',
          proprietaire: c.proprietaire ? `${c.proprietaire.prenom || ''} ${c.proprietaire.nom || ''}`.trim() : '—',
          locataire: c.locataire ? `${c.locataire.prenom || ''} ${c.locataire.nom || ''}`.trim() : '—',
        });
      }
    }
    if (!contratIdFilter) {
      for (const d of genericDocs) {
        rows.push({
          key: `doc-${d._id}`,
          directUrl: d.content, nom: d.notes || d.refNom || d.type, type: 'piece_identite', date: d.issueDate || d.createdAt,
          bien: '—',
          proprietaire: d.refType === 'Proprietaire' ? d.refNom : '—',
          locataire: d.refType === 'Locataire' ? d.refNom : '—',
        });
      }
    }
    return rows
      .filter((d) => !type || d.type === type)
      .filter((d) => {
        if (!search.trim()) return true;
        const q = search.trim().toLowerCase();
        return [d.nom, d.bien, d.proprietaire, d.locataire].some((v) => (v || '').toLowerCase().includes(q));
      })
      .sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
  }, [contrats, genericDocs, type, search, contratIdFilter]);

  const availableTypes = useMemo(() => {
    const set = new Set();
    contrats.forEach((c) => (c.documents || []).forEach((d) => d.type && set.add(d.type)));
    if (genericDocs.length) set.add('piece_identite');
    return Array.from(set);
  }, [contrats, genericDocs]);

  // DOC-EVO-1 — évolution 8 : ouvrir sans téléchargement obligatoire (le
  // navigateur affiche nativement le PDF/l'image dans un nouvel onglet).
  const handleOpen = async (documentId) => {
    try { await previewRentalDocument(documentId); }
    catch (err) { toast.error(err.response?.status === 403 ? "Accès refusé à ce document." : "Impossible d'ouvrir ce document."); }
  };

  const dossiers = useMemo(() => contrats
    .filter((c) => !contratIdFilter || c._id === contratIdFilter)
    .map((c) => ({
      id: c._id,
      bien: c.bien?.title || c.adresseBien || 'Bien',
      locataire: c.locataire ? `${c.locataire.prenom || ''} ${c.locataire.nom || ''}`.trim() : '—',
      statut: c.statut,
      documentCount: (c.documents || []).length,
    })), [contrats, contratIdFilter]);

  return (
    <DashboardPage>
      {!embedded && (
        <DashboardPageHeader
          icon={FolderOpen}
          title="Documents"
          description="Centre documentaire de la gestion locative — baux, quittances, préavis, états des lieux, mises en demeure."
          actions={(
            <Link href="/dashboard/gestion-locative" className="text-sm text-blue-600 underline">
              Vue d'ensemble Gestion Locative
            </Link>
          )}
        />
      )}

      {contratIdFilter && (
        <p className="mb-3 text-xs text-gray-500">
          Filtré sur un bail précis — <Link href="/dashboard/documents?pole=Altimmo&service=gestion_locative" className="text-blue-600 underline">voir tous les documents</Link>
        </p>
      )}

      {/* DOC-EVO-1 — évolution 2 : dossiers métier (un bail = un dossier
          complet), pas seulement des documents isolés. */}
      {dossiers.length > 0 && (
        <div className="mb-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">Dossiers</p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {dossiers.map((d) => (
              <button key={d.id} onClick={() => setOpenDossierId(d.id)}
                className="text-left border border-gray-100 rounded-lg p-3 hover:bg-gray-50 transition-colors">
                <p className="text-sm font-semibold text-gray-800 truncate">{d.bien}</p>
                <p className="text-xs text-gray-500">{d.locataire} · {d.documentCount} document(s)</p>
                <span className="text-xs text-blue-600 underline">Ouvrir le dossier</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <DashboardToolbar label="Filtrer les documents">
        <div className="flex flex-wrap gap-2 items-center w-full">
          <label className="flex items-center gap-2 border rounded-lg px-2 py-1.5 flex-1 min-w-48 max-w-xs">
            <Search size={14} className="text-gray-400" />
            <span className="sr-only">Rechercher</span>
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Bien, propriétaire, locataire…"
              className="text-sm outline-none flex-1" />
          </label>
          <button onClick={() => setType('')}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${!type ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"}`}>
            Tous types
          </button>
          {availableTypes.map((t) => (
            <button key={t} onClick={() => setType(t)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${type === t ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"}`}>
              {TYPE_LABELS[t] || t}
            </button>
          ))}
        </div>
      </DashboardToolbar>

      {loading ? (
        <DashboardState type="loading" title="Chargement des documents…" />
      ) : documents.length === 0 ? (
        <DashboardState title="Aucun document" description="Aucun document ne correspond à ces critères." />
      ) : (
        <DashboardCard className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 border-b">
                <th className="py-2 pr-3">Document</th>
                <th className="py-2 pr-3">Type</th>
                <th className="py-2 pr-3">Bien</th>
                <th className="py-2 pr-3">Propriétaire</th>
                <th className="py-2 pr-3">Locataire</th>
                <th className="py-2 pr-3">Date</th>
                <th className="py-2 pr-3">Action</th>
              </tr>
            </thead>
            <tbody>
              {documents.map((d) => (
                <tr key={d.key} className="border-b hover:bg-gray-50">
                  <td className="py-2 pr-3 font-medium">{d.nom || '—'}</td>
                  <td className="py-2 pr-3">
                    <span className="text-xs font-semibold px-2 py-1 rounded bg-blue-100 text-blue-800">{TYPE_LABELS[d.type] || d.type || '—'}</span>
                  </td>
                  <td className="py-2 pr-3">{d.bien}</td>
                  <td className="py-2 pr-3">{d.proprietaire}</td>
                  <td className="py-2 pr-3">{d.locataire}</td>
                  <td className="py-2 pr-3">{d.date ? new Date(d.date).toLocaleDateString('fr-FR') : '—'}</td>
                  <td className="py-2 pr-3">
                    {d.url && d.documentId
                      ? <button onClick={() => handleOpen(d.documentId)} className="text-blue-600 underline text-xs">Ouvrir</button>
                      : d.directUrl
                        ? <a href={d.directUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline text-xs">Ouvrir</a>
                        : <span className="text-xs text-gray-400">Indisponible</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </DashboardCard>
      )}

      {openDossierId && (
        <DossierPanel domain="gestion_locative" entityId={openDossierId} onClose={() => setOpenDossierId(null)} />
      )}
    </DashboardPage>
  );
};

const RentalDocumentsPage = ({ embedded = false }) => (
  <Suspense fallback={<DashboardPage><DashboardState type="loading" title="Chargement…" /></DashboardPage>}>
    <RentalDocumentsContent embedded={embedded} />
  </Suspense>
);

export default RentalDocumentsPage;
