"use client";

import React, { useEffect, useState } from "react";
import {
  Calculator, Mail, Home, MapPin, Maximize2, Loader2, AlertTriangle,
  CheckCircle2, XCircle, PlayCircle, StickyNote,
} from "lucide-react";
import { getAllEstimations, updateEstimation } from "../../services/estimationService";

const STATUTS = ["Tous", "En attente", "En cours", "Traitée", "Annulée"];

const STATUT_STYLE = {
  "En attente": { bg: "bg-yellow-100", text: "text-yellow-800", dot: "bg-yellow-400" },
  "En cours":   { bg: "bg-purple-100", text: "text-purple-800", dot: "bg-purple-500" },
  "Traitée":    { bg: "bg-green-100",  text: "text-green-700",  dot: "bg-green-500"  },
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

const EstimationsPage = () => {
  const [estimations, setEstimations] = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [filtre,      setFiltre]      = useState("Tous");
  const [notif,       setNotif]       = useState(null);
  const [notes,       setNotes]       = useState({});
  const [submitting,  setSubmitting]  = useState(null);

  const fetchEstimations = async () => {
    try {
      const data = await getAllEstimations();
      setEstimations(data);
    } catch {
      showNotif("Erreur lors du chargement.", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchEstimations(); }, []);

  const showNotif = (message, type = "success") => {
    setNotif({ message, type });
    setTimeout(() => setNotif(null), 4000);
  };

  const handleUpdate = async (id, data) => {
    setSubmitting(id);
    try {
      const updated = await updateEstimation(id, data);
      setEstimations(prev => prev.map(e => e._id === id ? { ...e, ...updated } : e));
      showNotif("Demande mise à jour.");
    } catch (err) {
      showNotif(err.response?.data?.message || "Erreur lors de la mise à jour.", "error");
    } finally {
      setSubmitting(null);
    }
  };

  const handleSaveNote = (id) => {
    const noteInterne = notes[id];
    if (noteInterne === undefined) return;
    handleUpdate(id, { noteInterne });
  };

  const filtered = filtre === "Tous" ? estimations : estimations.filter(e => e.statut === filtre);
  const countByStatut = (s) => estimations.filter(e => e.statut === s).length;

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
          <div className="p-3 bg-gradient-to-br from-amber-500 to-yellow-500 rounded-2xl shadow-lg">
            <Calculator className="w-7 h-7 text-white" />
          </div>
          <div>
            <h1 className="text-3xl sm:text-4xl font-black text-gray-800">Demandes d&apos;estimation</h1>
            <p className="text-gray-500 text-sm mt-0.5">
              {estimations.length} demande{estimations.length !== 1 ? "s" : ""} au total
            </p>
          </div>
        </div>

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
            <p className="font-semibold text-gray-500">Aucune demande {filtre !== "Tous" ? `"${filtre}"` : ""}</p>
          </div>
        ) : (
          <div className="space-y-4">
            {filtered.map(estimation => {
              const isBusy = submitting === estimation._id;
              const noteValue = notes[estimation._id] ?? estimation.noteInterne ?? "";

              return (
                <div key={estimation._id}
                  className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                  <div className="p-5">
                    <div className="flex flex-wrap items-start justify-between gap-2 mb-2">
                      <p className="font-bold text-gray-800 text-base leading-tight">
                        {estimation.nom}
                      </p>
                      <StatutBadge statut={estimation.statut} />
                    </div>

                    <a href={`mailto:${estimation.email}`}
                      className="inline-flex items-center gap-1.5 text-sm text-blue-600 hover:underline mb-2">
                      <Mail className="w-3.5 h-3.5" />
                      {estimation.email}
                    </a>

                    <div className="flex flex-wrap gap-3 mt-1 text-xs text-gray-600">
                      <span className="flex items-center gap-1 bg-gray-50 px-2.5 py-1 rounded-full">
                        <Home className="w-3 h-3" />
                        {estimation.typeBien} · {estimation.transaction === 'vente' ? 'Vente' : 'Location'}
                      </span>
                      <span className="flex items-center gap-1 bg-gray-50 px-2.5 py-1 rounded-full">
                        <MapPin className="w-3 h-3" />
                        {estimation.adresse}
                      </span>
                      <span className="flex items-center gap-1 bg-gray-50 px-2.5 py-1 rounded-full">
                        <Maximize2 className="w-3 h-3" />
                        {estimation.surface} m²
                      </span>
                    </div>

                    <p className="text-gray-400 text-xs mt-2">
                      Reçue le {formatDate(estimation.createdAt)}
                      {estimation.traitePar?.name && <span> · Traitée par {estimation.traitePar.name}</span>}
                    </p>
                  </div>

                  {/* Zone d'actions */}
                  <div className="border-t border-gray-100 px-5 py-4 space-y-3">
                    <div className="flex gap-2 flex-wrap">
                      {estimation.statut === 'En attente' && (
                        <button
                          onClick={() => handleUpdate(estimation._id, { statut: 'En cours' })}
                          disabled={isBusy}
                          className="flex items-center gap-1.5 px-4 py-1.5 text-sm font-bold bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 transition shadow-sm">
                          {isBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <PlayCircle className="w-4 h-4" />}
                          En cours
                        </button>
                      )}

                      {estimation.statut !== 'Traitée' && estimation.statut !== 'Annulée' && (
                        <button
                          onClick={() => handleUpdate(estimation._id, { statut: 'Traitée' })}
                          disabled={isBusy}
                          className="flex items-center gap-1.5 px-4 py-1.5 text-sm font-bold bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 transition shadow-sm">
                          {isBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                          Traitée
                        </button>
                      )}

                      {estimation.statut !== 'Annulée' && (
                        <button
                          onClick={() => handleUpdate(estimation._id, { statut: 'Annulée' })}
                          disabled={isBusy}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold bg-red-50 text-red-600 rounded-lg hover:bg-red-100 disabled:opacity-50 transition">
                          <XCircle className="w-4 h-4" />
                          Annuler
                        </button>
                      )}
                    </div>

                    <div className="flex items-start gap-2">
                      <StickyNote className="w-4 h-4 text-gray-400 mt-2 flex-shrink-0" />
                      <textarea
                        rows={2}
                        placeholder="Note interne (visible par l'équipe uniquement)..."
                        value={noteValue}
                        onChange={e => setNotes(prev => ({ ...prev, [estimation._id]: e.target.value }))}
                        className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none"
                      />
                      <button
                        onClick={() => handleSaveNote(estimation._id)}
                        disabled={isBusy || notes[estimation._id] === undefined}
                        className="px-3 py-1.5 text-sm font-semibold bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition flex-shrink-0">
                        Enregistrer
                      </button>
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

export default EstimationsPage;
