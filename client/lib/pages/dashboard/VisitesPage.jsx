"use client";

import React, { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  Calendar, Clock, CheckCircle2, XCircle, Home,
  MessageSquare, Loader2, AlertTriangle, PlayCircle,
} from "lucide-react";
import { getAllVisites, updateVisite } from "../../services/visiteService";

const STATUTS = ["Tous", "En attente", "Confirmée", "En cours", "Terminée", "Annulée"];

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

const isVisiteImminente = (visite) => {
  if (!visite.dateConfirmee || visite.statut !== 'Confirmée') return false;
  const diff = new Date(visite.dateConfirmee) - Date.now();
  return diff <= 30 * 60 * 1000;
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

const VisitesPage = () => {
  const [visites,      setVisites]      = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [filtre,       setFiltre]       = useState("Tous");
  const [notif,        setNotif]        = useState(null);
  const [proposeDates, setProposeDates] = useState({});
  const [submitting,   setSubmitting]   = useState(null);

  const fetchVisites = async () => {
    try {
      const data = await getAllVisites();
      setVisites(data);
    } catch {
      showNotif("Erreur lors du chargement.", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchVisites(); }, []);

  useEffect(() => {
    const interval = setInterval(fetchVisites, 2 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const showNotif = (message, type = "success") => {
    setNotif({ message, type });
    setTimeout(() => setNotif(null), 4000);
  };

  const handleUpdate = async (id, data) => {
    setSubmitting(id);
    try {
      const updated = await updateVisite(id, data);
      setVisites(prev => prev.map(v => v._id === id ? { ...v, ...updated } : v));
      showNotif("Visite mise à jour.");
    } catch (err) {
      showNotif(err.response?.data?.message || "Erreur lors de la mise à jour.", "error");
    } finally {
      setSubmitting(null);
    }
  };

  const handleProposerDate = (id) => {
    const dateStr = proposeDates[id];
    if (!dateStr) return;
    handleUpdate(id, { dateConfirmee: new Date(dateStr).toISOString(), statut: "Confirmée" });
  };

  const filtered = filtre === "Tous" ? visites : visites.filter(v => v.statut === filtre);
  const countByStatut = (s) => visites.filter(v => v.statut === s).length;

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 className="w-10 h-10 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-4 sm:p-8 font-sans">

      {notif && (
        <div className={`fixed top-4 right-4 z-50 px-6 py-3 rounded-xl shadow-xl text-white text-sm font-semibold transition-all ${
          notif.type === "error"
            ? "bg-gradient-to-r from-red-500 to-pink-600"
            : "bg-gradient-to-r from-emerald-500 to-green-600"
        }`}>
          {notif.message}
        </div>
      )}

      <div className="max-w-5xl mx-auto">

        {/* Header */}
        <div className="mb-6 flex items-center gap-4">
          <div className="p-3 bg-gradient-to-br from-blue-600 to-cyan-500 rounded-2xl shadow-lg">
            <Calendar className="w-7 h-7 text-white" />
          </div>
          <div>
            <h1 className="text-3xl sm:text-4xl font-black text-gray-800">Gestion des Rendez-vous</h1>
            <p className="text-gray-500 text-sm mt-0.5">
              {visites.length} demande{visites.length !== 1 ? "s" : ""} au total
            </p>
          </div>
        </div>

        {/* Alerte visites imminentes */}
        {visites.some(isVisiteImminente) && (
          <div className="mb-5 flex items-start gap-3 p-4 rounded-2xl border border-orange-200 bg-orange-50">
            <PlayCircle className="w-5 h-5 text-orange-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-bold text-orange-800">
                {visites.filter(isVisiteImminente).length} visite(s) imminente(s) — marquez-les &quot;En cours&quot; !
              </p>
              <p className="text-xs text-orange-600 mt-0.5">
                Les visites non démarrées dans les 30 minutes suivant l&apos;heure prévue seront annulées automatiquement.
              </p>
            </div>
          </div>
        )}

        {/* Filtres */}
        <div className="flex flex-wrap gap-2 mb-6">
          {STATUTS.map(s => (
            <button key={s} onClick={() => setFiltre(s)}
              className={`px-4 py-1.5 rounded-full text-sm font-semibold border transition-all ${
                filtre === s
                  ? "bg-blue-600 text-white border-blue-600 shadow-md"
                  : "bg-white text-gray-600 border-gray-200 hover:border-blue-400"
              }`}>
              {s}
              {s !== "Tous" && (
                <span className="ml-1.5 opacity-60">({countByStatut(s)})</span>
              )}
            </button>
          ))}
        </div>

        {/* Liste */}
        {filtered.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-2xl border-2 border-dashed border-gray-200">
            <AlertTriangle className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="font-semibold text-gray-500">Aucune visite {filtre !== "Tous" ? `"${filtre}"` : ""}</p>
          </div>
        ) : (
          <div className="space-y-4">
            {filtered.map(visite => {
              const bien    = visite.property || {};
              const client  = visite.client   || {};
              const photo   = bien.images?.[0] || null;
              const titre   = bien.title       || "Bien immobilier";
              const ville   = bien.address?.city           || "";
              const arrond  = bien.address?.arrondissement || "";
              const adresse = [arrond, ville].filter(Boolean).join(", ");
              const isBusy  = submitting === visite._id;
              const imminent = isVisiteImminente(visite);

              return (
                <div key={visite._id}
                  className={`bg-white rounded-2xl shadow-sm border overflow-hidden transition-all ${
                    imminent ? 'border-orange-300 ring-2 ring-orange-100' : 'border-gray-100'
                  }`}>
                  <div className="flex gap-4 p-5">

                    {/* Photo */}
                    <div className="relative w-20 h-20 rounded-xl overflow-hidden flex-shrink-0 bg-gray-100">
                      {photo ? (
                        <Image src={photo} alt={titre} fill className="object-cover" sizes="80px" unoptimized />
                      ) : (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <Home className="w-8 h-8 text-gray-300" />
                        </div>
                      )}
                    </div>

                    {/* Infos */}
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-start justify-between gap-2 mb-1">
                        <p className="font-bold text-gray-800 text-base leading-tight truncate">{titre}</p>
                        <div className="flex items-center gap-2">
                          {imminent && (
                            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-orange-100 text-orange-700 animate-pulse">
                              ⚡ Imminent
                            </span>
                          )}
                          <StatutBadge statut={visite.statut} />
                        </div>
                      </div>

                      {adresse && <p className="text-gray-400 text-xs mb-1">{adresse}</p>}

                      <p className="text-sm text-gray-600">
                        Client : <span className="font-semibold">{client.name || "—"}</span>
                        {client.email && <span className="text-gray-400 ml-1">({client.email})</span>}
                      </p>

                      <div className="flex flex-wrap gap-3 mt-2">
                        {visite.dateProposee && (
                          <span className="flex items-center gap-1 text-xs text-blue-700 bg-blue-50 px-2.5 py-1 rounded-full">
                            <Clock className="w-3 h-3" />
                            Proposée : {formatDate(visite.dateProposee)}
                          </span>
                        )}
                        {visite.dateConfirmee && (
                          <span className={`flex items-center gap-1 text-xs px-2.5 py-1 rounded-full ${
                            imminent ? 'bg-orange-100 text-orange-700' : 'bg-green-50 text-green-700'
                          }`}>
                            <CheckCircle2 className="w-3 h-3" />
                            Prévue : {formatDate(visite.dateConfirmee)}
                          </span>
                        )}
                      </div>

                      {visite.notes?.includes('[Annulation automatique') && (
                        <p className="text-xs text-red-500 mt-1.5 italic">
                          ⚠️ Annulée automatiquement — visite non démarrée à l&apos;heure
                        </p>
                      )}

                      {visite.conversation?._id && (
                        <Link href={`/dashboard/messages?conversationId=${visite.conversation._id}`}
                          className="inline-flex items-center gap-1.5 mt-2 text-xs text-blue-600 hover:underline">
                          <MessageSquare className="w-3.5 h-3.5" />
                          Voir la conversation
                        </Link>
                      )}
                    </div>
                  </div>

                  {/* Zone d'actions */}
                  {!["Terminée", "Annulée"].includes(visite.statut) && (
                    <div className="border-t border-gray-100 px-5 py-4 flex flex-wrap items-end gap-3">

                      {/* Proposer/confirmer une date (uniquement si pas encore En cours) */}
                      {visite.statut !== 'En cours' && (
                        <div className="flex items-center gap-2 flex-1 min-w-[240px]">
                          <input type="datetime-local"
                            value={proposeDates[visite._id] || ""}
                            onChange={e => setProposeDates(prev => ({ ...prev, [visite._id]: e.target.value }))}
                            className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-400"
                          />
                          <button
                            onClick={() => handleProposerDate(visite._id)}
                            disabled={!proposeDates[visite._id] || isBusy}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition">
                            {isBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Calendar className="w-4 h-4" />}
                            Confirmer date
                          </button>
                        </div>
                      )}

                      <div className="flex gap-2 flex-wrap">
                        {visite.statut === 'Confirmée' && (
                          <button
                            onClick={() => handleUpdate(visite._id, { statut: 'En cours' })}
                            disabled={isBusy}
                            className="flex items-center gap-1.5 px-4 py-1.5 text-sm font-bold bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 transition shadow-sm">
                            {isBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <PlayCircle className="w-4 h-4" />}
                            En cours
                          </button>
                        )}

                        {visite.statut === 'En cours' && (
                          <button
                            onClick={() => handleUpdate(visite._id, { statut: 'Terminée' })}
                            disabled={isBusy}
                            className="flex items-center gap-1.5 px-4 py-1.5 text-sm font-bold bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 transition shadow-sm">
                            {isBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                            Terminée
                          </button>
                        )}

                        <button
                          onClick={() => handleUpdate(visite._id, { statut: 'Annulée' })}
                          disabled={isBusy}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold bg-red-50 text-red-600 rounded-lg hover:bg-red-100 disabled:opacity-50 transition">
                          <XCircle className="w-4 h-4" />
                          Annuler
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default VisitesPage;
