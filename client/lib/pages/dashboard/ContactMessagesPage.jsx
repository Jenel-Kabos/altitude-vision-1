"use client";

import React, { useEffect, useState } from "react";
import {
  Mail, ChevronDown, ChevronUp, Loader2, AlertTriangle,
  CheckCircle2, XCircle, PlayCircle, StickyNote, Archive,
} from "lucide-react";
import { getAllContactMessages, updateMessageStatus } from "../../services/contactService";

const STATUTS = ["Tous", "Non lu", "Lu", "En cours", "Traité", "Archivé"];

const STATUT_STYLE = {
  "Non lu":  { bg: "bg-blue-100",   text: "text-blue-800",   dot: "bg-blue-500"   },
  "Lu":      { bg: "bg-yellow-100", text: "text-yellow-800", dot: "bg-yellow-400" },
  "En cours":{ bg: "bg-purple-100", text: "text-purple-800", dot: "bg-purple-500" },
  "Traité":  { bg: "bg-green-100",  text: "text-green-700",  dot: "bg-green-500"  },
  "Archivé": { bg: "bg-gray-100",   text: "text-gray-500",   dot: "bg-gray-400"   },
};

const formatDate = (d) => {
  if (!d) return null;
  return new Date(d).toLocaleString("fr-FR", {
    day: "2-digit", month: "long", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
};

const StatutBadge = ({ statut }) => {
  const s = STATUT_STYLE[statut] || STATUT_STYLE["Non lu"];
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${s.bg} ${s.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
      {statut}
    </span>
  );
};

const ContactMessagesPage = () => {
  const [messages,   setMessages]   = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [filtre,     setFiltre]     = useState("Tous");
  const [notif,      setNotif]      = useState(null);
  const [expanded,   setExpanded]   = useState(null);
  const [notes,      setNotes]      = useState({});
  const [submitting, setSubmitting] = useState(null);

  const fetchMessages = async () => {
    try {
      const res = await getAllContactMessages();
      setMessages(res.data?.messages || []);
    } catch {
      showNotif("Erreur lors du chargement.", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchMessages(); }, []);

  const showNotif = (message, type = "success") => {
    setNotif({ message, type });
    setTimeout(() => setNotif(null), 4000);
  };

  const handleUpdate = async (id, status, responseNote) => {
    setSubmitting(id);
    try {
      const res = await updateMessageStatus(id, status, responseNote);
      const updated = res.data?.message;
      setMessages(prev => prev.map(m => m._id === id ? { ...m, ...updated } : m));
      showNotif("Message mis à jour.");
    } catch (err) {
      showNotif(err.response?.data?.message || "Erreur lors de la mise à jour.", "error");
    } finally {
      setSubmitting(null);
    }
  };

  const handleSaveNote = (id) => {
    const responseNote = notes[id];
    if (responseNote === undefined) return;
    const current = messages.find(m => m._id === id);
    handleUpdate(id, current?.status, responseNote);
  };

  const toggleExpand = (id) => setExpanded(prev => prev === id ? null : id);

  const filtered = filtre === "Tous" ? messages : messages.filter(m => m.status === filtre);
  const countByStatut = (s) => messages.filter(m => m.status === s).length;

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
            <Mail className="w-7 h-7 text-white" />
          </div>
          <div>
            <h1 className="text-3xl sm:text-4xl font-black text-gray-800">Messages de contact</h1>
            <p className="text-gray-500 text-sm mt-0.5">
              {messages.length} message{messages.length !== 1 ? "s" : ""} au total
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
            <p className="font-semibold text-gray-500">Aucun message {filtre !== "Tous" ? `"${filtre}"` : ""}</p>
          </div>
        ) : (
          <div className="space-y-4">
            {filtered.map(msg => {
              const isBusy = submitting === msg._id;
              const isOpen = expanded === msg._id;
              const noteValue = notes[msg._id] ?? msg.responseNote ?? "";

              return (
                <div key={msg._id}
                  className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                  <button
                    onClick={() => toggleExpand(msg._id)}
                    className="w-full text-left p-5 flex flex-wrap items-start justify-between gap-2"
                  >
                    <div className="min-w-0">
                      <p className="font-bold text-gray-800 text-base leading-tight">{msg.name}</p>
                      <a href={`mailto:${msg.email}`}
                        onClick={e => e.stopPropagation()}
                        className="inline-flex items-center gap-1.5 text-sm text-blue-600 hover:underline mt-0.5">
                        <Mail className="w-3.5 h-3.5" />
                        {msg.email}
                      </a>
                      <p className="text-sm text-gray-600 mt-1">
                        Sujet : <span className="font-semibold">{msg.subject}</span>
                      </p>
                      <p className="text-gray-400 text-xs mt-1">{formatDate(msg.submittedAt)}</p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <StatutBadge statut={msg.status} />
                      {isOpen ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                    </div>
                  </button>

                  {isOpen && (
                    <div className="border-t border-gray-100 px-5 py-4 space-y-4">
                      <p className="text-sm text-gray-700 whitespace-pre-wrap bg-gray-50 rounded-lg p-4">
                        {msg.message}
                      </p>

                      {msg.phone && <p className="text-sm text-gray-600">📞 {msg.phone}</p>}

                      <div className="flex gap-2 flex-wrap">
                        {msg.status !== 'En cours' && msg.status !== 'Traité' && msg.status !== 'Archivé' && (
                          <button
                            onClick={() => handleUpdate(msg._id, 'En cours')}
                            disabled={isBusy}
                            className="flex items-center gap-1.5 px-4 py-1.5 text-sm font-bold bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 transition shadow-sm">
                            {isBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <PlayCircle className="w-4 h-4" />}
                            En cours
                          </button>
                        )}

                        {msg.status !== 'Traité' && msg.status !== 'Archivé' && (
                          <button
                            onClick={() => handleUpdate(msg._id, 'Traité')}
                            disabled={isBusy}
                            className="flex items-center gap-1.5 px-4 py-1.5 text-sm font-bold bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 transition shadow-sm">
                            {isBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                            Traité
                          </button>
                        )}

                        {msg.status !== 'Archivé' && (
                          <button
                            onClick={() => handleUpdate(msg._id, 'Archivé')}
                            disabled={isBusy}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 disabled:opacity-50 transition">
                            <Archive className="w-4 h-4" />
                            Archiver
                          </button>
                        )}
                      </div>

                      <div className="flex items-start gap-2">
                        <StickyNote className="w-4 h-4 text-gray-400 mt-2 flex-shrink-0" />
                        <textarea
                          rows={2}
                          placeholder="Note de réponse (visible par l'équipe uniquement)..."
                          value={noteValue}
                          onChange={e => setNotes(prev => ({ ...prev, [msg._id]: e.target.value }))}
                          className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none"
                        />
                        <button
                          onClick={() => handleSaveNote(msg._id)}
                          disabled={isBusy || notes[msg._id] === undefined}
                          className="px-3 py-1.5 text-sm font-semibold bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition flex-shrink-0">
                          Enregistrer
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

export default ContactMessagesPage;
