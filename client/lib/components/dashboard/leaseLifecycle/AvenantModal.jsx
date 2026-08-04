"use client";

// GL-UX-1 — Phase 4 : gestionnaire d'avenants. L'aperçu avant/après est un
// simple affichage de deux valeurs déjà connues (la valeur actuelle du
// contrat déjà chargé, et celle que le gestionnaire vient de saisir) —
// aucune règle métier n'est évaluée ici ; la validation réelle (rejet si
// aucun changement réel, calcul du diff historisé) est faite exclusivement
// par rentalLeaseAmendmentService.addAvenant côté serveur.
import React, { useState } from "react";
import { toast } from "react-hot-toast";
import { X } from "lucide-react";
import { addLeaseAvenant } from "../../../services/rentalLeaseLifecycleService";

const TYPE_OPTIONS = [
  { value: "loyer", label: "Loyer", champ: "montantLoyer", inputType: "number" },
  { value: "duree", label: "Durée du bail", champ: "dateFinBail", inputType: "date" },
  { value: "depot_garantie", label: "Dépôt de garantie", champ: "montantCaution", inputType: "number" },
  { value: "clauses", label: "Clauses", champ: "notes", inputType: "textarea" },
  { value: "annexes", label: "Annexes", champ: "notes", inputType: "textarea" },
  { value: "autre", label: "Autre", champ: "notes", inputType: "textarea" },
];

const fmtValue = (v) => {
  if (v === undefined || v === null || v === "") return "—";
  if (v instanceof Date) return v.toLocaleDateString("fr-FR");
  return String(v);
};

const AvenantModal = ({ contrat, onClose, onDone }) => {
  const [type, setType] = useState("loyer");
  const [value, setValue] = useState("");
  const [motif, setMotif] = useState("");
  const [loading, setLoading] = useState(false);

  const option = TYPE_OPTIONS.find((o) => o.value === type);
  const avant = contrat[option.champ];

  const changed = value !== "" && String(avant ?? "") !== String(value);

  const handleSubmit = async () => {
    if (!changed) { toast.error("Aucun changement réel à enregistrer."); return; }
    setLoading(true);
    try {
      const changes = { [option.champ]: option.inputType === "number" ? Number(value) : value };
      await addLeaseAvenant(contrat._id, { type, motif, changes });
      toast.success("Avenant enregistré.");
      onDone?.();
    } catch (err) {
      toast.error(err.response?.data?.message || "Impossible d'enregistrer cet avenant.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.55)" }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-lg font-bold text-gray-900">Nouvel avenant</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400"><X size={18} /></button>
        </div>

        <div className="overflow-y-auto flex-1 px-6 py-5 space-y-4">
          <label className="text-sm block">
            Type d&apos;avenant
            <select value={type} onChange={(e) => { setType(e.target.value); setValue(""); }} className="mt-1 w-full border border-gray-200 rounded-lg p-2">
              {TYPE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </label>

          <label className="text-sm block">
            Nouvelle valeur
            {option.inputType === "textarea" ? (
              <textarea value={value} onChange={(e) => setValue(e.target.value)} className="mt-1 w-full border border-gray-200 rounded-lg p-2" rows={3} />
            ) : (
              <input type={option.inputType} value={value} onChange={(e) => setValue(e.target.value)} className="mt-1 w-full border border-gray-200 rounded-lg p-2" />
            )}
          </label>

          <label className="text-sm block">
            Motif
            <input value={motif} onChange={(e) => setMotif(e.target.value)} className="mt-1 w-full border border-gray-200 rounded-lg p-2" />
          </label>

          <div className="border border-gray-100 rounded-lg p-3 text-xs text-gray-600">
            <span className="font-medium">{option.label}</span> : {fmtValue(avant)} → {fmtValue(value) === "—" ? <span className="text-gray-300">…</span> : fmtValue(value)}
          </div>
        </div>

        <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-2">
          <button onClick={onClose} className="text-sm px-4 py-2 rounded-lg border border-gray-300">Annuler</button>
          <button onClick={handleSubmit} disabled={loading || !changed} className="text-sm font-medium px-4 py-2 rounded-lg bg-gray-900 text-white disabled:opacity-50">
            Valider l&apos;avenant
          </button>
        </div>
      </div>
    </div>
  );
};

export default AvenantModal;
