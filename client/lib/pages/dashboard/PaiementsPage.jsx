"use client";

import React, { useEffect, useState } from "react";
import Image from "next/image";
import {
  CreditCard, Home, Phone, Calendar, Loader2, AlertTriangle,
  CheckCircle2, ShieldOff,
} from "lucide-react";
import { getAllPayments, updatePaiementVisite } from "../../services/visiteService";

const STATUTS = ["Tous", "en_attente", "payé", "exempté"];

const STATUT_LABEL = {
  en_attente: "En attente",
  "payé":     "Payé",
  "exempté":  "Exempté",
};

const STATUT_STYLE = {
  en_attente: { bg: "bg-yellow-100", text: "text-yellow-800", dot: "bg-yellow-400" },
  "payé":     { bg: "bg-green-100",  text: "text-green-700",  dot: "bg-green-500"  },
  "exempté":  { bg: "bg-gray-100",   text: "text-gray-600",   dot: "bg-gray-400"   },
};

const formatDate = (d) => {
  if (!d) return null;
  return new Date(d).toLocaleString("fr-FR", {
    day: "2-digit", month: "long", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
};

const montantDu = (bien) => {
  if (!bien) return 0;
  const honoraires = bien.honoraires ?? (
    bien.status === 'location'
      ? Math.round((bien.price || 0) * 0.8)
      : Math.round((bien.price || 0) * 0.1)
  );
  return honoraires + (bien.fraisVisite || 0);
};

const StatutBadge = ({ statut }) => {
  const s = STATUT_STYLE[statut] || STATUT_STYLE.en_attente;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${s.bg} ${s.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
      {STATUT_LABEL[statut] || statut}
    </span>
  );
};

const PaiementsPage = () => {
  const [visites,    setVisites]    = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [filtre,     setFiltre]     = useState("Tous");
  const [notif,      setNotif]      = useState(null);
  const [refs,       setRefs]       = useState({});
  const [submitting, setSubmitting] = useState(null);

  const fetchVisites = async () => {
    try {
      const data = await getAllPayments();
      setVisites(data);
    } catch {
      showNotif("Erreur lors du chargement.", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchVisites(); }, []);

  const showNotif = (message, type = "success") => {
    setNotif({ message, type });
    setTimeout(() => setNotif(null), 4000);
  };

  const handleUpdate = async (id, data) => {
    setSubmitting(id);
    try {
      const updated = await updatePaiementVisite(id, data);
      setVisites(prev => prev.map(v => v._id === id ? { ...v, ...updated } : v));
      showNotif("Paiement mis à jour.");
    } catch (err) {
      showNotif(err.response?.data?.message || "Erreur lors de la mise à jour.", "error");
    } finally {
      setSubmitting(null);
    }
  };

  const handleMarquerPaye = (id) => {
    handleUpdate(id, { paiementStatus: 'payé', paiementRef: refs[id] || undefined });
  };

  const handleExempter = (id) => {
    handleUpdate(id, { paiementStatus: 'exempté' });
  };

  const filtered = filtre === "Tous" ? visites : visites.filter(v => v.paiementStatus === filtre);
  const countByStatut = (s) => visites.filter(v => v.paiementStatus === s).length;

  const totalEnAttente = visites
    .filter(v => v.paiementStatus === 'en_attente')
    .reduce((sum, v) => sum + montantDu(v.property), 0);

  const totalRecu = visites
    .filter(v => v.paiementStatus === 'payé')
    .reduce((sum, v) => sum + montantDu(v.property), 0);

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
            <CreditCard className="w-7 h-7 text-white" />
          </div>
          <div>
            <h1 className="text-3xl sm:text-4xl font-black text-gray-800">Paiements des visites</h1>
            <p className="text-gray-500 text-sm mt-0.5">
              {visites.length} visite{visites.length !== 1 ? "s" : ""} avec paiement requis
            </p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Total en attente</p>
            <p className="text-2xl font-black text-yellow-600">{totalEnAttente.toLocaleString('fr-FR')} FCFA</p>
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Total reçu</p>
            <p className="text-2xl font-black text-green-600">{totalRecu.toLocaleString('fr-FR')} FCFA</p>
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
              {s === "Tous" ? "Tous" : STATUT_LABEL[s]}
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
            <p className="font-semibold text-gray-500">Aucun paiement {filtre !== "Tous" ? `"${STATUT_LABEL[filtre]}"` : ""}</p>
          </div>
        ) : (
          <div className="space-y-4">
            {filtered.map(visite => {
              const bien   = visite.property || {};
              const client = visite.client   || {};
              const photo  = bien.images?.[0] || null;
              const titre  = bien.title       || "Bien immobilier";
              const isBusy = submitting === visite._id;
              const montant = montantDu(bien);

              return (
                <div key={visite._id}
                  className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
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
                        <StatutBadge statut={visite.paiementStatus} />
                      </div>

                      <p className="text-sm text-gray-600">
                        Client : <span className="font-semibold">{client.name || "—"}</span>
                        {visite.telephone && (
                          <a href={`tel:${visite.telephone}`} className="inline-flex items-center gap-1 ml-2 text-blue-600 hover:underline">
                            <Phone className="w-3 h-3" /> {visite.telephone}
                          </a>
                        )}
                      </p>

                      <p className="text-sm font-bold text-gray-800 mt-1">
                        Montant dû : {montant.toLocaleString('fr-FR')} FCFA
                      </p>

                      {visite.dateConfirmee && (
                        <span className="inline-flex items-center gap-1 text-xs text-blue-700 bg-blue-50 px-2.5 py-1 rounded-full mt-2">
                          <Calendar className="w-3 h-3" />
                          Visite : {formatDate(visite.dateConfirmee)}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Zone d'actions */}
                  {visite.paiementStatus === 'en_attente' && (
                    <div className="border-t border-gray-100 px-5 py-4 flex flex-wrap items-center gap-3">
                      <input
                        type="text"
                        placeholder="Référence paiement (YabetooPay ID)"
                        value={refs[visite._id] || ""}
                        onChange={e => setRefs(prev => ({ ...prev, [visite._id]: e.target.value }))}
                        className="flex-1 min-w-[220px] text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-400"
                      />
                      <button
                        onClick={() => handleMarquerPaye(visite._id)}
                        disabled={isBusy}
                        className="flex items-center gap-1.5 px-4 py-1.5 text-sm font-bold bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 transition shadow-sm">
                        {isBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                        Marquer payé
                      </button>
                      <button
                        onClick={() => handleExempter(visite._id)}
                        disabled={isBusy}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold bg-gray-50 text-gray-600 rounded-lg hover:bg-gray-100 disabled:opacity-50 transition">
                        <ShieldOff className="w-4 h-4" />
                        Exempter
                      </button>
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

export default PaiementsPage;
