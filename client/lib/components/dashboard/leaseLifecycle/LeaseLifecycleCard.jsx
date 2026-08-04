"use client";

// GL-UX-1 — Phase 2 : expose la machine d'état du bail (GL-LIFE-1) sur la
// fiche contrat. Aucune règle de transition n'est codée ici : les boutons
// affichés sont exactement ceux que le backend renvoie comme légaux
// (`getAvailableTransitions`) — cliquer appelle exclusivement
// `transitionLease`, qui délègue à rentalLeaseLifecycleService.transition()
// côté serveur. Les libellés ci-dessous ne sont que du texte d'affichage,
// jamais une décision.
import React, { useCallback, useEffect, useState } from "react";
import { toast } from "react-hot-toast";
import { useAuth } from "../../../context/AuthContext";
import { isStaffImmo } from "../../../utils/staffRoles";
import { getAvailableTransitions, transitionLease } from "../../../services/rentalLeaseLifecycleService";

const STATE_LABELS = {
  projet: "Projet de bail", en_preparation: "En préparation", a_signer: "À signer",
  actif: "Actif", preavis: "Préavis", inspection_sortie: "Inspection de sortie",
  cloture_financiere: "Clôture financière", resilie: "Résilié", archive: "Archivé",
};

const TRANSITION_LABELS = {
  "projet->en_preparation": "Démarrer la préparation",
  "en_preparation->a_signer": "Passer à la signature",
  "a_signer->actif": "Activer le bail (signature)",
  "actif->preavis": "Démarrer le préavis",
  "actif->resilie": "Résilier immédiatement",
  "preavis->inspection_sortie": "Lancer l'inspection de sortie",
  "preavis->actif": "Annuler le préavis",
  "inspection_sortie->cloture_financiere": "Clôturer financièrement",
  "cloture_financiere->resilie": "Résilier",
  "resilie->archive": "Archiver",
};

const LeaseLifecycleCard = ({ contratId, onChanged }) => {
  const { user } = useAuth();
  const [state, setState] = useState(null); // { cycleVie, allowed }
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getAvailableTransitions(contratId);
      setState(data);
    } catch {
      setState(null);
    } finally {
      setLoading(false);
    }
  }, [contratId]);

  useEffect(() => { load(); }, [load]);

  const handleTransition = async (target) => {
    setPending(target);
    try {
      await transitionLease(contratId, target);
      toast.success("Étape du bail mise à jour.");
      await load();
      onChanged?.();
    } catch (err) {
      toast.error(err.response?.data?.message || "Transition impossible.");
    } finally {
      setPending(null);
    }
  };

  if (loading) return <p className="text-sm text-gray-400">Chargement du cycle de vie…</p>;
  if (!state || !state.cycleVie) return null; // contrat de vente, ou hors périmètre locatif

  return (
    <div className="border border-gray-100 rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Cycle de vie du bail</p>
          <p className="text-lg font-bold text-gray-900">{STATE_LABELS[state.cycleVie] || state.cycleVie}</p>
        </div>
      </div>

      {isStaffImmo(user) && state.allowed.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          {state.allowed.map((target) => (
            <button
              key={target}
              disabled={pending === target}
              onClick={() => handleTransition(target)}
              className="text-xs font-medium px-3 py-1.5 rounded-lg bg-gray-900 text-white hover:bg-gray-700 disabled:opacity-50"
            >
              {pending === target ? "…" : TRANSITION_LABELS[`${state.cycleVie}->${target}`] || `Passer à « ${STATE_LABELS[target] || target} »`}
            </button>
          ))}
        </div>
      )}
      {isStaffImmo(user) && state.allowed.length === 0 && (
        <p className="text-xs text-gray-400">Aucune transition disponible depuis cette étape.</p>
      )}
    </div>
  );
};

export default LeaseLifecycleCard;
