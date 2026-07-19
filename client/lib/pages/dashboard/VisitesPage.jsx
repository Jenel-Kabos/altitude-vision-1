"use client";

import React, { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  Calendar, Clock, CheckCircle2, XCircle, Home,
  MessageSquare, Loader2, AlertTriangle, PlayCircle,
  User, Phone, Mail, MapPin, Map, CreditCard,
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

const formatHeure = (d) => {
  if (!d) return null;
  return new Date(d).toLocaleTimeString('fr-FR', {
    timeZone: 'Africa/Brazzaville', hour: '2-digit', minute: '2-digit',
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
  const [endDates, setEndDates] = useState({});
  const [meetingAddresses, setMeetingAddresses] = useState({});
  const [submitting,   setSubmitting]   = useState(null);

  const fetchVisites = async () => {
    try {
      const data = await getAllVisites();
      setVisites(data);
      window.dispatchEvent(new CustomEvent('altitude:dashboard-badges:refresh'));
    } catch {
      showNotif("Erreur lors du chargement.", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchVisites(); }, []);

  useEffect(() => {
    window.addEventListener('altitude:visites:changed', fetchVisites);
    return () => window.removeEventListener('altitude:visites:changed', fetchVisites);
  }, []);

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
      window.dispatchEvent(new CustomEvent('altitude:dashboard-badges:refresh'));
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
    if (!endDates[id] || !meetingAddresses[id]?.trim()) {
      showNotif("L’heure de fin et le point de rendez-vous sont requis.", "error");
      return;
    }
    handleUpdate(id, {
      scheduledStartAt: new Date(dateStr).toISOString(),
      scheduledEndAt: new Date(endDates[id]).toISOString(),
      meetingAddressSnapshot: meetingAddresses[id].trim(),
      status: "confirmee",
    });
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
      <style>{`
        .vp-client-request, .vp-owner-section, .vp-address-section {
          margin-top: 14px; padding: 14px; background: #FAFAF8;
          border-radius: 12px; border: 1px solid #F0F0EE;
        }
        .vp-section-label {
          font-size: 12px; font-weight: 700; color: #666;
          letter-spacing: 0.08em; text-transform: uppercase;
          display: flex; align-items: center; gap: 6px;
          margin-bottom: 10px;
        }
        .vp-info-grid { display: flex; flex-direction: column; gap: 8px; }
        .vp-info-row {
          display: flex; align-items: center; gap: 8px;
          font-size: 13px; color: #1A1A1A;
        }
        .vp-info-row span { color: #666; }
        .vp-tel-link { color: #C8960C; font-weight: 600; text-decoration: none; }
        .vp-tel-link:hover { text-decoration: underline; }
        .vp-maps-btn {
          display: inline-flex; align-items: center; gap: 5px;
          padding: 5px 12px; border-radius: 8px;
          background: #E6F1FB; color: #185FA5;
          font-size: 12px; font-weight: 600;
          text-decoration: none; margin-left: auto;
        }
        .vp-maps-btn:hover { background: #185FA5; color: #fff; }
        .vp-message {
          background: #F5F5F2; border-radius: 8px;
          padding: 8px 10px; font-style: italic; color: #666 !important;
        }
        .vp-payment-banner {
          margin: 0 20px 16px; padding: 16px;
          background: linear-gradient(135deg, #FCEFD6, #FDF5E6);
          border: 1px solid rgba(200,150,12,0.3); border-radius: 14px;
          display: flex; gap: 12px; align-items: flex-start;
        }
        .vp-payment-banner > svg { color: #C8960C; flex-shrink: 0; margin-top: 2px; }
        .vp-payment-content { flex: 1; }
        .vp-payment-title { font-weight: 700; font-size: 14px; color: #1A1A1A; margin-bottom: 4px; }
        .vp-payment-desc { font-size: 13px; color: #666; margin-bottom: 12px; }
        .vp-payment-actions { display: flex; gap: 8px; flex-wrap: wrap; }
        .vp-pay-btn {
          display: inline-flex; align-items: center; gap: 6px;
          padding: 9px 16px; border-radius: 10px;
          background: #C8960C; color: #fff; font-size: 13px;
          font-weight: 700; text-decoration: none;
        }
        .vp-pay-btn:hover { background: #A07A0A; }
        .vp-agent-btn {
          display: inline-flex; align-items: center; gap: 6px;
          padding: 9px 16px; border-radius: 10px;
          background: #fff; border: 1.5px solid #F0F0EE;
          color: #666; font-size: 13px; font-weight: 600;
          text-decoration: none;
        }
        .vp-agent-btn:hover { border-color: #C8960C; color: #C8960C; }
      `}</style>

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

                      {/* Demande du client */}
                      {(visite.datePreferee || visite.heurePreferee || visite.telephone || visite.message) && (
                        <div className="vp-client-request">
                          <h4 className="vp-section-label"><User className="w-3.5 h-3.5" /> Demande du client</h4>
                          <div className="vp-info-grid">
                            {visite.datePreferee && (
                              <div className="vp-info-row">
                                <Calendar className="w-3.5 h-3.5" />
                                <span>Date souhaitée :</span>
                                <strong>{visite.datePreferee}</strong>
                              </div>
                            )}
                            {visite.heurePreferee && (
                              <div className="vp-info-row">
                                <Clock className="w-3.5 h-3.5" />
                                <span>Heure souhaitée :</span>
                                <strong>{visite.heurePreferee}</strong>
                                {visite.requestedEnd && (
                                  <strong> – {formatHeure(visite.requestedEnd)}</strong>
                                )}
                              </div>
                            )}
                            {visite.telephone && (
                              <div className="vp-info-row">
                                <Phone className="w-3.5 h-3.5" />
                                <span>Téléphone client :</span>
                                <a href={`tel:${visite.telephone}`} className="vp-tel-link">
                                  <strong>{visite.telephone}</strong>
                                </a>
                              </div>
                            )}
                            {visite.message && (
                              <div className="vp-info-row vp-message">
                                <MessageSquare className="w-3.5 h-3.5" />
                                <span>{visite.message}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Propriétaire du bien */}
                      {bien.owner && (
                        <div className="vp-owner-section">
                          <h4 className="vp-section-label"><Home className="w-3.5 h-3.5" /> Propriétaire du bien</h4>
                          <div className="vp-info-grid">
                            <div className="vp-info-row">
                              <User className="w-3.5 h-3.5" />
                              <span>{bien.owner.name}</span>
                            </div>
                            {bien.owner.phone && (
                              <div className="vp-info-row">
                                <Phone className="w-3.5 h-3.5" />
                                <a href={`tel:${bien.owner.phone}`} className="vp-tel-link">
                                  {bien.owner.phone}
                                </a>
                              </div>
                            )}
                            {bien.owner.email && (
                              <div className="vp-info-row">
                                <Mail className="w-3.5 h-3.5" />
                                <span>{bien.owner.email}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Adresse + géolocalisation du bien */}
                      {bien.address && (
                        <div className="vp-address-section">
                          <h4 className="vp-section-label"><MapPin className="w-3.5 h-3.5" /> Adresse du bien</h4>
                          <div className="vp-info-row">
                            <span>{[bien.address.arrondissement, bien.address.city].filter(Boolean).join(', ')}</span>
                            {(bien.latitude || bien.address?.coordinates?.lat) && (
                              <a
                                href={`https://www.google.com/maps?q=${
                                  bien.latitude || bien.address.coordinates.lat
                                },${
                                  bien.longitude || bien.address.coordinates.lng
                                }`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="vp-maps-btn"
                              >
                                <Map className="w-3.5 h-3.5" /> Voir sur la carte
                              </a>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Paiement des honoraires — visible une fois la visite confirmée */}
                  {visite.statut === 'Confirmée' && (
                    <div className="vp-payment-banner">
                      <CreditCard className="w-5 h-5" />
                      <div className="vp-payment-content">
                        <p className="vp-payment-title">Paiement des honoraires requis</p>
                        <p className="vp-payment-desc">
                          {visite.agencyCommissionValue != null ? <>Commission validée : <strong>{visite.agencyCommissionValue.toLocaleString('fr-FR')} {visite.visitFeeCurrency || 'XAF'}</strong></> : 'Commission non renseignée'}
                          {visite.visitFeeAmount > 0 && <> · Frais de visite : <strong>{visite.visitFeeAmount.toLocaleString('fr-FR')} {visite.visitFeeCurrency || 'XAF'}</strong></>}
                        </p>
                        <div className="vp-payment-actions">
                          <a href="/dashboard/paiements" className="vp-pay-btn">
                            <CreditCard className="w-3.5 h-3.5" />
                            Payer en ligne
                          </a>
                          <a href="/contact" className="vp-agent-btn">
                            <Phone className="w-3.5 h-3.5" />
                            Contacter un agent
                          </a>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Zone d'actions */}
                  {!["Terminée", "Annulée"].includes(visite.statut) && (
                    <div className="border-t border-gray-100 px-5 py-4 flex flex-wrap items-end gap-3">

                      {/* Proposer/confirmer une date (uniquement si pas encore En cours) */}
                      {visite.statut !== 'En cours' && (
                        <div className="grid sm:grid-cols-3 gap-2 flex-1 min-w-[240px]">
                          <input type="datetime-local"
                            value={proposeDates[visite._id] || ""}
                            onChange={e => setProposeDates(prev => ({ ...prev, [visite._id]: e.target.value }))}
                            className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-400"
                          />
                          <input type="datetime-local" aria-label="Heure de fin"
                            value={endDates[visite._id] || ""}
                            onChange={e => setEndDates(prev => ({ ...prev, [visite._id]: e.target.value }))}
                            className="text-sm border border-gray-200 rounded-lg px-3 py-1.5" />
                          <input type="text" aria-label="Point de rendez-vous" placeholder="Point de rendez-vous"
                            value={meetingAddresses[visite._id] || ""}
                            onChange={e => setMeetingAddresses(prev => ({ ...prev, [visite._id]: e.target.value }))}
                            className="text-sm border border-gray-200 rounded-lg px-3 py-1.5" />
                          <button
                            onClick={() => handleProposerDate(visite._id)}
                            disabled={!proposeDates[visite._id] || !endDates[visite._id] || !meetingAddresses[visite._id] || isBusy}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition">
                            {isBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Calendar className="w-4 h-4" />}
                            Confirmer date
                          </button>
                        </div>
                      )}

                      <div className="flex gap-2 flex-wrap">
                        {visite.statut === 'Confirmée' && (
                          <button
                            onClick={() => handleUpdate(visite._id, { status: 'en_cours' })}
                            disabled={isBusy}
                            className="flex items-center gap-1.5 px-4 py-1.5 text-sm font-bold bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 transition shadow-sm">
                            {isBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <PlayCircle className="w-4 h-4" />}
                            En cours
                          </button>
                        )}

                        {visite.statut === 'En cours' && (
                          <button
                            onClick={() => handleUpdate(visite._id, { status: 'terminee' })}
                            disabled={isBusy}
                            className="flex items-center gap-1.5 px-4 py-1.5 text-sm font-bold bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 transition shadow-sm">
                            {isBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                            Terminée
                          </button>
                        )}

                        <button
                          onClick={() => handleUpdate(visite._id, { status: 'annulee_staff' })}
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
