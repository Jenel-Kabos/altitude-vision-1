"use client";

// GL-ASSET-UX-1 — variante propriétaire (modale) du même cockpit patrimonial
// que la page staff dédiée (/dashboard/properties/[id]) — réutilise
// exactement PropertyAssetCockpit, aucune duplication de contenu.
import React from "react";
import { X } from "lucide-react";
import PropertyAssetCockpit from "./PropertyAssetCockpit";

const PropertyAssetCockpitDrawer = ({ property, onClose }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.55)" }}>
    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
        <h2 className="text-lg font-bold text-gray-900">{property.title || "Cockpit patrimonial"}</h2>
        <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400"><X size={18} /></button>
      </div>
      <div className="overflow-y-auto flex-1 px-6 py-5">
        <PropertyAssetCockpit property={property} />
      </div>
    </div>
  </div>
);

export default PropertyAssetCockpitDrawer;
