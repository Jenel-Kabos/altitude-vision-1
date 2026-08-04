"use client";

// GL-UX-1 — Phase 3 : le gestionnaire prépare un renouvellement, visualise
// EXACTEMENT ce que le backend a calculé (mode prolongation/nouveau contrat
// + différence de champs), puis confirme. Le frontend ne décide jamais s'il
// s'agit d'une prolongation ou d'un nouveau contrat lié — cette décision
// vient uniquement de `previewRenewal`/`renewLease` (rentalLeaseRenewalService.js).
import React, { useState } from "react";
import { toast } from "react-hot-toast";
import { X } from "lucide-react";
import { previewRenewal, renewLease } from "../../../services/rentalLeaseLifecycleService";

const FIELD_LABELS = {
  dateFinBail: "Date de fin de bail", montantLoyer: "Loyer", montantCaution: "Caution",
  locataire: "Locataire", proprietaire: "Propriétaire", bien: "Bien", type: "Type de contrat",
};

const RenewalModal = ({ contrat, onClose, onDone }) => {
  const [form, setForm] = useState({ dateFinBail: "", montantLoyer: "", montantCaution: "", motif: "" });
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);

  const buildPayload = () => {
    const payload = { motif: form.motif };
    if (form.dateFinBail) payload.dateFinBail = form.dateFinBail;
    if (form.montantLoyer) payload.montantLoyer = Number(form.montantLoyer);
    if (form.montantCaution) payload.montantCaution = Number(form.montantCaution);
    return payload;
  };

  const handlePreview = async () => {
    setLoading(true);
    try {
      const result = await previewRenewal(contrat._id, buildPayload());
      setPreview(result);
    } catch (err) {
      toast.error(err.response?.data?.message || "Impossible de prévisualiser ce renouvellement.");
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = async () => {
    setLoading(true);
    try {
      const result = await renewLease(contrat._id, buildPayload());
      toast.success(result.mode === "prolongation" ? "Bail prolongé." : "Nouveau bail créé pour ce renouvellement.");
      onDone?.(result);
    } catch (err) {
      toast.error(err.response?.data?.message || "Renouvellement impossible.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.55)" }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-lg font-bold text-gray-900">Préparer un renouvellement</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400"><X size={18} /></button>
        </div>

        <div className="overflow-y-auto flex-1 px-6 py-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <label className="text-sm">
              Nouvelle date de fin
              <input type="date" value={form.dateFinBail} onChange={(e) => setForm((f) => ({ ...f, dateFinBail: e.target.value }))} className="mt-1 w-full border border-gray-200 rounded-lg p-2" />
            </label>
            <label className="text-sm">
              Nouveau loyer (FCFA)
              <input type="number" value={form.montantLoyer} onChange={(e) => setForm((f) => ({ ...f, montantLoyer: e.target.value }))} className="mt-1 w-full border border-gray-200 rounded-lg p-2" />
            </label>
            <label className="text-sm col-span-2">
              Nouvelle caution (FCFA)
              <input type="number" value={form.montantCaution} onChange={(e) => setForm((f) => ({ ...f, montantCaution: e.target.value }))} className="mt-1 w-full border border-gray-200 rounded-lg p-2" />
            </label>
            <label className="text-sm col-span-2">
              Motif
              <textarea value={form.motif} onChange={(e) => setForm((f) => ({ ...f, motif: e.target.value }))} className="mt-1 w-full border border-gray-200 rounded-lg p-2" rows={2} />
            </label>
          </div>

          <button onClick={handlePreview} disabled={loading} className="text-sm font-medium px-4 py-2 rounded-lg border border-gray-300 hover:bg-gray-50 disabled:opacity-50">
            Prévisualiser
          </button>

          {preview && (
            <div className="border border-gray-100 rounded-lg p-3 space-y-2">
              <p className="text-sm font-semibold">
                {preview.mode === "prolongation" ? "→ Prolongation du bail existant" : "→ Nouveau bail lié (changement majeur détecté par le serveur)"}
              </p>
              {preview.champsModifies.length === 0 ? (
                <p className="text-xs text-gray-400">Aucun changement détecté.</p>
              ) : (
                <ul className="space-y-1">
                  {preview.champsModifies.map((c) => (
                    <li key={c.champ} className="text-xs text-gray-600">
                      <span className="font-medium">{FIELD_LABELS[c.champ] || c.champ}</span> : {String(c.avant ?? "—")} → {String(c.apres ?? "—")}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-2">
          <button onClick={onClose} className="text-sm px-4 py-2 rounded-lg border border-gray-300">Annuler</button>
          <button onClick={handleConfirm} disabled={loading || !preview} className="text-sm font-medium px-4 py-2 rounded-lg bg-gray-900 text-white disabled:opacity-50">
            Confirmer le renouvellement
          </button>
        </div>
      </div>
    </div>
  );
};

export default RenewalModal;
