"use client";

// GL-ASSET-UX-1 — Phase 2 : expose la machine d'état patrimoniale du bien
// (GL-ASSET-1). Aucune règle de transition n'est codée ici : les boutons
// affichés sont exactement ceux que le backend renvoie comme légaux
// (`getPropertyLifecycle`) — cliquer appelle exclusivement
// `transitionPropertyAsset`, qui délègue à propertyAssetLifecycleService.transition()
// côté serveur. Les libellés ci-dessous ne sont que du texte d'affichage,
// jamais une décision (même convention que LeaseLifecycleCard.jsx, GL-UX-1).
import React, { useCallback, useEffect, useState } from "react";
import { toast } from "react-hot-toast";
import { useAuth } from "../../../context/AuthContext";
import { isStaffImmo } from "../../../utils/staffRoles";
import { getPropertyLifecycle, transitionPropertyAsset } from "../../../services/propertyAssetService";

const STATE_LABELS = {
  disponible: "Disponible", reserve: "Réservé", en_location: "En location", preavis: "Préavis",
  inspection: "Inspection", travaux: "Travaux", vendu: "Vendu", archive: "Archivé",
};

const TRANSITION_LABELS = {
  "disponible->reserve": "Réserver le bien",
  "disponible->en_location": "Mettre en location",
  "disponible->travaux": "Démarrer des travaux",
  "disponible->vendu": "Marquer comme vendu",
  "disponible->archive": "Archiver le bien",
  "reserve->en_location": "Confirmer la mise en location",
  "reserve->vendu": "Confirmer la vente",
  "reserve->disponible": "Annuler la réservation",
  "en_location->preavis": "Démarrer le préavis",
  "preavis->inspection": "Lancer l'inspection",
  "preavis->en_location": "Annuler le préavis",
  "inspection->travaux": "Démarrer des travaux",
  "inspection->disponible": "Remettre en disponibilité",
  "travaux->disponible": "Terminer les travaux",
  "vendu->archive": "Archiver le bien",
};

const AssetLifecycleCard = ({ propertyId, onChanged }) => {
  const { user } = useAuth();
  const [state, setState] = useState(null); // { assetCycle, allowed }
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getPropertyLifecycle(propertyId);
      setState(data);
    } catch {
      setState(null);
    } finally {
      setLoading(false);
    }
  }, [propertyId]);

  useEffect(() => { load(); }, [load]);

  const handleTransition = async (target) => {
    setPending(target);
    try {
      await transitionPropertyAsset(propertyId, target);
      toast.success("Cycle de vie du bien mis à jour.");
      await load();
      onChanged?.();
    } catch (err) {
      toast.error(err.response?.data?.message || "Transition impossible.");
    } finally {
      setPending(null);
    }
  };

  if (loading) return <p className="text-sm text-gray-400">Chargement du cycle de vie…</p>;
  if (!state || !state.assetCycle) return null;

  return (
    <div className="border border-gray-100 rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Cycle de vie du bien</p>
          <p className="text-lg font-bold text-gray-900">{STATE_LABELS[state.assetCycle] || state.assetCycle}</p>
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
              {pending === target ? "…" : TRANSITION_LABELS[`${state.assetCycle}->${target}`] || `Passer à « ${STATE_LABELS[target] || target} »`}
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

export default AssetLifecycleCard;
