"use client";

// GL-UX-1 — Phase 5 : caution. Le solde à restituer est une simple
// soustraction d'affichage (montant initial - retenues - déjà restitué),
// jamais une décision — le vrai calcul de restitution (statut résultant :
// restituee/partiellement_restituee/retenue_totale) est fait exclusivement
// par rentalLeaseCautionService.restituerCaution côté serveur.
import React, { useState } from "react";
import { toast } from "react-hot-toast";
import { useAuth } from "../../../context/AuthContext";
import { isStaffImmo } from "../../../utils/staffRoles";
import { encaisserCaution, bloquerCaution, appliquerRetenueCaution, restituerCaution } from "../../../services/rentalLeaseLifecycleService";

const CAUTION_LABELS = {
  non_versee: "Non versée", versee: "Versée", bloquee: "Bloquée",
  partiellement_restituee: "Partiellement restituée", restituee: "Restituée", retenue_totale: "Retenue totale",
};

const fmtFcfa = (n) => `${Number(n || 0).toLocaleString("fr-FR")} FCFA`;

const CautionPanel = ({ contrat, onChanged }) => {
  const { user } = useAuth();
  const [busy, setBusy] = useState(false);
  const [retenueForm, setRetenueForm] = useState(null); // { montant, motif }
  const [restitutionForm, setRestitutionForm] = useState(null); // { montant }

  const caution = contrat.caution || { statut: "non_versee", montantRetenu: 0, montantRestitue: 0 };
  const solde = Math.max(0, (contrat.montantCaution || 0) - (caution.montantRetenu || 0) - (caution.montantRestitue || 0));

  // Renvoie true seulement en cas de succès — les formulaires de retenue/
  // restitution ne doivent jamais se refermer silencieusement sur une erreur.
  const run = async (fn, successMsg) => {
    setBusy(true);
    try {
      await fn();
      toast.success(successMsg);
      onChanged?.();
      return true;
    } catch (err) {
      toast.error(err.response?.data?.message || "Action impossible.");
      return false;
    } finally {
      setBusy(false);
    }
  };

  if (!isStaffImmo(user)) return null;

  return (
    <div className="border border-gray-100 rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Caution</p>
          <p className="text-sm font-semibold text-gray-900">{CAUTION_LABELS[caution.statut] || caution.statut}</p>
        </div>
        <div className="text-right text-xs text-gray-500 space-y-0.5">
          <p>Montant initial : <span className="font-medium text-gray-700">{fmtFcfa(contrat.montantCaution)}</span></p>
          <p>Retenu : <span className="font-medium text-gray-700">{fmtFcfa(caution.montantRetenu)}</span></p>
          <p>Solde à restituer : <span className="font-medium text-gray-700">{fmtFcfa(solde)}</span></p>
        </div>
      </div>

      <div className="flex gap-2 flex-wrap">
        {caution.statut === "non_versee" && (
          <button disabled={busy} onClick={() => run(() => encaisserCaution(contrat._id), "Caution encaissée.")} className="text-xs font-medium px-3 py-1.5 rounded-lg bg-gray-900 text-white disabled:opacity-50">Encaisser</button>
        )}
        {caution.statut === "versee" && (
          <button disabled={busy} onClick={() => run(() => bloquerCaution(contrat._id), "Caution bloquée.")} className="text-xs font-medium px-3 py-1.5 rounded-lg bg-gray-900 text-white disabled:opacity-50">Bloquer</button>
        )}
        {caution.statut === "bloquee" && (
          <button disabled={busy} onClick={() => setRetenueForm({ montant: "", motif: "" })} className="text-xs font-medium px-3 py-1.5 rounded-lg border border-gray-300 disabled:opacity-50">Appliquer une retenue</button>
        )}
        {["versee", "bloquee"].includes(caution.statut) && (
          <button disabled={busy} onClick={() => setRestitutionForm({ montant: solde })} className="text-xs font-medium px-3 py-1.5 rounded-lg border border-gray-300 disabled:opacity-50">Restituer</button>
        )}
      </div>

      {retenueForm && (
        <div className="border border-gray-100 rounded-lg p-3 space-y-2">
          <p className="text-xs font-semibold">Retenue sur caution</p>
          <input type="number" placeholder="Montant" value={retenueForm.montant} onChange={(e) => setRetenueForm((f) => ({ ...f, montant: e.target.value }))} className="w-full border border-gray-200 rounded-lg p-2 text-sm" />
          <input placeholder="Motif" value={retenueForm.motif} onChange={(e) => setRetenueForm((f) => ({ ...f, motif: e.target.value }))} className="w-full border border-gray-200 rounded-lg p-2 text-sm" />
          <div className="flex gap-2 justify-end">
            <button onClick={() => setRetenueForm(null)} className="text-xs px-3 py-1.5 rounded-lg border border-gray-300">Annuler</button>
            <button
              disabled={busy || !retenueForm.montant}
              onClick={async () => {
                const ok = await run(() => appliquerRetenueCaution(contrat._id, { montant: Number(retenueForm.montant), motif: retenueForm.motif }), "Retenue appliquée.");
                if (ok) setRetenueForm(null);
              }}
              className="text-xs font-medium px-3 py-1.5 rounded-lg bg-gray-900 text-white disabled:opacity-50"
            >
              Confirmer
            </button>
          </div>
        </div>
      )}

      {restitutionForm && (
        <div className="border border-gray-100 rounded-lg p-3 space-y-2">
          <p className="text-xs font-semibold">Restitution de caution</p>
          <input type="number" placeholder="Montant à restituer" value={restitutionForm.montant} onChange={(e) => setRestitutionForm((f) => ({ ...f, montant: e.target.value }))} className="w-full border border-gray-200 rounded-lg p-2 text-sm" />
          <div className="flex gap-2 justify-end">
            <button onClick={() => setRestitutionForm(null)} className="text-xs px-3 py-1.5 rounded-lg border border-gray-300">Annuler</button>
            <button
              disabled={busy}
              onClick={async () => {
                const ok = await run(() => restituerCaution(contrat._id, { montant: Number(restitutionForm.montant) }), "Caution restituée.");
                if (ok) setRestitutionForm(null);
              }}
              className="text-xs font-medium px-3 py-1.5 rounded-lg bg-gray-900 text-white disabled:opacity-50"
            >
              Confirmer la restitution
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default CautionPanel;
