"use client";

// GL-UX-1 — Phase 2-6 : panneau unique regroupant le pilotage complet d'un
// bail (machine d'état, renouvellement, avenants, caution, inspection de
// sortie). Le contrat affiché est celui déjà chargé par la page appelante
// (RentalLeasesPage) — un simple `refresh()` recharge la liste pour tenir
// ce panneau à jour après chaque action, sans nouvel état parallèle.
import React, { useState } from "react";
import { X } from "lucide-react";
import { useAuth } from "../../../context/AuthContext";
import { isStaffImmo } from "../../../utils/staffRoles";
import LeaseLifecycleCard from "./LeaseLifecycleCard";
import CautionPanel from "./CautionPanel";
import ExitInspectionSummary from "./ExitInspectionSummary";
import RenewalModal from "./RenewalModal";
import AvenantModal from "./AvenantModal";

const LeaseLifecycleDrawer = ({ contrat, onClose, onChanged }) => {
  const { user } = useAuth();
  const [showRenewal, setShowRenewal] = useState(false);
  const [showAvenant, setShowAvenant] = useState(false);

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.55)" }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Piloter le bail</h2>
            <p className="text-xs text-gray-500">{contrat.bien?.title || contrat.adresseBien || "Bien"}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400"><X size={18} /></button>
        </div>

        <div className="overflow-y-auto flex-1 px-6 py-5 space-y-4">
          <LeaseLifecycleCard contratId={contrat._id} onChanged={onChanged} />

          {isStaffImmo(user) && (
            <div className="flex gap-2 flex-wrap">
              <button onClick={() => setShowRenewal(true)} className="text-xs font-medium px-3 py-1.5 rounded-lg border border-gray-300 hover:bg-gray-50">Préparer un renouvellement</button>
              <button onClick={() => setShowAvenant(true)} className="text-xs font-medium px-3 py-1.5 rounded-lg border border-gray-300 hover:bg-gray-50">Créer un avenant</button>
            </div>
          )}

          <CautionPanel contrat={contrat} onChanged={onChanged} />
          <ExitInspectionSummary contrat={contrat} />
        </div>
      </div>

      {showRenewal && (
        <RenewalModal contrat={contrat} onClose={() => setShowRenewal(false)} onDone={() => { setShowRenewal(false); onChanged?.(); onClose(); }} />
      )}
      {showAvenant && (
        <AvenantModal contrat={contrat} onClose={() => setShowAvenant(false)} onDone={() => { setShowAvenant(false); onChanged?.(); }} />
      )}
    </div>
  );
};

export default LeaseLifecycleDrawer;
