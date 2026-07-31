"use client";

// Sprint GL-UX1 — page réelle "Baux" (remplace le placeholder Sprint 0).
// Distincte de l'onglet "Contrats" de la vue d'ensemble Gestion Locative, qui
// reste le point d'entrée pour créer/éditer un Contrat (vente ET location) —
// cette page est le suivi du cycle de vie des baux de LOCATION uniquement :
// actifs, à échéance proche, dépôt de garantie non régularisé, documents
// liés. Aucun second modèle de bail : tout est lu depuis Contrat.
// Les transitions de statut ne sont pas exposées ici : Contrat.statut n'a
// pas de table de transitions formelle côté serveur (contrairement à
// HotelReservation/AccommodationReservation) — inventer des règles de
// transition dans l'UI serait une décision métier non déductible du code
// existant. La modification de statut reste sur l'onglet Contrats.

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "react-hot-toast";
import { FileSignature } from "lucide-react";
import { getContrats } from "../../services/gestionLocativeService";
import {
  DashboardPage, DashboardPageHeader, DashboardToolbar, DashboardCard, DashboardState,
} from "../../components/dashboard/DashboardUI";

const STATUT_CLASSES = {
  actif: 'bg-green-100 text-green-800',
  en_attente: 'bg-amber-100 text-amber-800',
  'résilié': 'bg-gray-200 text-gray-700',
  'expiré': 'bg-red-100 text-red-700',
};
const STATUT_LABELS = { actif: 'Actif', en_attente: 'En attente', 'résilié': 'Résilié', 'expiré': 'Expiré' };

const joursAvantEcheance = (dateFinBail) => {
  if (!dateFinBail) return null;
  return Math.ceil((new Date(dateFinBail).getTime() - Date.now()) / (24 * 3600 * 1000));
};

const RentalLeasesPage = () => {
  const [contrats, setContrats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statut, setStatut] = useState('actif');

  const load = async () => {
    setLoading(true);
    try {
      const rows = await getContrats({ type: 'location', ...(statut ? { statut } : {}) });
      setContrats(rows || []);
    } catch (err) {
      toast.error("Erreur lors du chargement des baux.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [statut]);

  const echeanceProche = useMemo(
    () => contrats.filter((c) => { const j = joursAvantEcheance(c.dateFinBail); return j !== null && j <= 60 && j >= 0; }).length,
    [contrats],
  );
  const depotsNonRegularises = useMemo(
    () => contrats.filter((c) => c.montantCaution > 0 && !c.cautionVersee).length,
    [contrats],
  );

  return (
    <DashboardPage>
      <DashboardPageHeader
        icon={FileSignature}
        title="Baux"
        description="Cycle de vie des baux de location — création/édition sur l'onglet Contrats de la vue d'ensemble."
        actions={(
          <Link href="/dashboard/gestion-locative" className="text-sm text-blue-600 underline">
            Vue d'ensemble Gestion Locative
          </Link>
        )}
      />

      {!loading && contrats.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
          <DashboardCard>
            <p className="text-2xl font-bold" style={{ fontFamily: "'Cormorant Garamond', serif" }}>{contrats.length}</p>
            <p className="text-xs mt-1 text-gray-500">Baux {statut ? STATUT_LABELS[statut] : 'tous statuts'}</p>
          </DashboardCard>
          <DashboardCard>
            <p className="text-2xl font-bold text-orange-600" style={{ fontFamily: "'Cormorant Garamond', serif" }}>{echeanceProche}</p>
            <p className="text-xs mt-1 text-gray-500">Échéance sous 60 jours</p>
          </DashboardCard>
          <DashboardCard>
            <p className="text-2xl font-bold text-red-600" style={{ fontFamily: "'Cormorant Garamond', serif" }}>{depotsNonRegularises}</p>
            <p className="text-xs mt-1 text-gray-500">Dépôts non régularisés</p>
          </DashboardCard>
        </div>
      )}

      <DashboardToolbar label="Filtrer les baux">
        <div className="flex flex-wrap gap-2 items-center w-full">
          {[{ v: '', l: 'Tous' }, { v: 'actif', l: 'Actif' }, { v: 'en_attente', l: 'En attente' }, { v: 'résilié', l: 'Résilié' }, { v: 'expiré', l: 'Expiré' }].map((s) => (
            <button key={s.v} onClick={() => setStatut(s.v)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${statut === s.v ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"}`}>
              {s.l}
            </button>
          ))}
        </div>
      </DashboardToolbar>

      {loading ? (
        <DashboardState type="loading" title="Chargement des baux…" />
      ) : contrats.length === 0 ? (
        <DashboardState title="Aucun bail" description="Aucun bail ne correspond à ces critères." />
      ) : (
        <DashboardCard className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 border-b">
                <th className="py-2 pr-3">Bien</th>
                <th className="py-2 pr-3">Propriétaire</th>
                <th className="py-2 pr-3">Locataire</th>
                <th className="py-2 pr-3">Loyer</th>
                <th className="py-2 pr-3">Fin de bail</th>
                <th className="py-2 pr-3">Dépôt</th>
                <th className="py-2 pr-3">Statut</th>
                <th className="py-2 pr-3">Documents</th>
              </tr>
            </thead>
            <tbody>
              {contrats.map((c) => {
                const jours = joursAvantEcheance(c.dateFinBail);
                return (
                  <tr key={c._id} className="border-b hover:bg-gray-50">
                    <td className="py-2 pr-3">{c.bien?.title || c.adresseBien || '—'}</td>
                    <td className="py-2 pr-3">{c.proprietaire ? `${c.proprietaire.prenom || ''} ${c.proprietaire.nom || ''}` : '—'}</td>
                    <td className="py-2 pr-3">{c.locataire ? `${c.locataire.prenom || ''} ${c.locataire.nom || ''}` : '—'}</td>
                    <td className="py-2 pr-3">{c.montantLoyer ? `${Number(c.montantLoyer).toLocaleString('fr-FR')} FCFA` : '—'}</td>
                    <td className="py-2 pr-3">
                      {c.dateFinBail ? new Date(c.dateFinBail).toLocaleDateString('fr-FR') : '—'}
                      {jours !== null && jours <= 60 && (
                        <span className={`ml-2 text-xs font-semibold px-2 py-0.5 rounded ${jours < 0 ? 'bg-red-100 text-red-700' : 'bg-orange-100 text-orange-800'}`}>
                          {jours < 0 ? `${Math.abs(jours)}j de retard` : `${jours}j restants`}
                        </span>
                      )}
                    </td>
                    <td className="py-2 pr-3">
                      {c.montantCaution > 0 ? (
                        c.cautionVersee
                          ? <span className="text-xs font-semibold text-green-700">Versé</span>
                          : <span className="text-xs font-semibold text-red-600">Non régularisé</span>
                      ) : '—'}
                    </td>
                    <td className="py-2 pr-3">
                      <span className={`text-xs font-semibold px-2 py-1 rounded ${STATUT_CLASSES[c.statut] || 'bg-gray-100 text-gray-700'}`}>{STATUT_LABELS[c.statut] || c.statut}</span>
                    </td>
                    <td className="py-2 pr-3">
                      <Link href={`/dashboard/gestion-locative/documents?contratId=${c._id}`} className="text-blue-600 underline text-xs">
                        {(c.documents || []).length} document(s)
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </DashboardCard>
      )}
    </DashboardPage>
  );
};

export default RentalLeasesPage;
