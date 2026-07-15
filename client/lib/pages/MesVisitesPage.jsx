"use client";

import React, { useEffect, useState } from "react";
import Image from "next/image";
import {
  Calendar, Home, Loader2, AlertTriangle, Phone, Mail,
} from "lucide-react";
import { getOwnerVisites } from "../services/visiteService";

const STATUT_STYLE = {
  "En attente": { bg: "bg-yellow-100", text: "text-yellow-800", dot: "bg-yellow-400" },
  "Confirmée":  { bg: "bg-blue-100",   text: "text-blue-800",   dot: "bg-blue-500"   },
  "En cours":   { bg: "bg-purple-100", text: "text-purple-800", dot: "bg-purple-500" },
  "Terminée":   { bg: "bg-gray-100",   text: "text-gray-600",   dot: "bg-gray-400"   },
  "Annulée":    { bg: "bg-red-100",    text: "text-red-700",    dot: "bg-red-500"    },
};

const formatDate = (d) => {
  if (!d) return null;
  return new Date(d).toLocaleString("fr-FR", {
    day: "2-digit", month: "long", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
};

const StatutBadge = ({ statut }) => {
  const s = STATUT_STYLE[statut] || STATUT_STYLE["En attente"];
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${s.bg} ${s.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
      {statut}
    </span>
  );
};

const MesVisitesPage = () => {
  const [visites, setVisites] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getOwnerVisites()
      .then(setVisites)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 className="w-10 h-10 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-4 sm:p-8 font-sans">
      <div className="max-w-3xl mx-auto">

        {/* Header */}
        <div className="mb-6 flex items-center gap-4">
          <div className="p-3 bg-gradient-to-br from-blue-600 to-cyan-500 rounded-2xl shadow-lg">
            <Calendar className="w-7 h-7 text-white" />
          </div>
          <div>
            <h1 className="text-3xl sm:text-4xl font-black text-gray-800">Visites de mes biens</h1>
            <p className="text-gray-500 text-sm mt-0.5">
              {visites.length} demande{visites.length !== 1 ? "s" : ""} au total
            </p>
          </div>
        </div>

        {/* Liste */}
        {visites.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-2xl border-2 border-dashed border-gray-200">
            <AlertTriangle className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="font-semibold text-gray-500">Aucune demande de visite pour l'instant</p>
          </div>
        ) : (
          <div className="space-y-4">
            {visites.map(visite => {
              const bien    = visite.property || {};
              const client  = visite.client   || {};
              const photo   = bien.images?.[0] || null;
              const titre   = bien.title       || "Bien immobilier";
              const adresse = [bien.address?.arrondissement, bien.address?.city].filter(Boolean).join(', ');

              return (
                <div key={visite._id} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                  <div className="flex gap-4 p-5">
                    <div className="relative w-20 h-20 rounded-xl overflow-hidden flex-shrink-0 bg-gray-100">
                      {photo ? (
                        <Image src={photo} alt={titre} fill className="object-cover" sizes="80px" unoptimized />
                      ) : (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <Home className="w-8 h-8 text-gray-300" />
                        </div>
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-start justify-between gap-2 mb-1">
                        <p className="font-bold text-gray-800 text-base leading-tight truncate">{titre}</p>
                        <StatutBadge statut={visite.statut} />
                      </div>
                      {adresse && <p className="text-gray-400 text-xs mb-1">{adresse}</p>}

                      <p className="text-sm text-gray-600">
                        Client : <span className="font-semibold">{client.name || "—"}</span>
                      </p>
                      <div className="flex flex-wrap gap-3 mt-1">
                        {client.phone && (
                          <a href={`tel:${client.phone}`} className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline">
                            <Phone className="w-3 h-3" /> {client.phone}
                          </a>
                        )}
                        {client.email && (
                          <a href={`mailto:${client.email}`} className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline">
                            <Mail className="w-3 h-3" /> {client.email}
                          </a>
                        )}
                      </div>

                      {(visite.dateConfirmee || visite.dateProposee) && (
                        <span className="inline-flex items-center gap-1 text-xs text-blue-700 bg-blue-50 px-2.5 py-1 rounded-full mt-2">
                          <Calendar className="w-3 h-3" />
                          {visite.dateConfirmee ? 'Prévue' : 'Proposée'} : {formatDate(visite.dateConfirmee || visite.dateProposee)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default MesVisitesPage;
