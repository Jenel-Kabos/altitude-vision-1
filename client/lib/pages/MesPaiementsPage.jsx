"use client";

import React, { useEffect, useRef, useState } from "react";
import Image from "next/image";
import {
  CreditCard, Home, Calendar, Loader2, AlertTriangle,
  CheckCircle2, Phone, Smartphone,
} from "lucide-react";
import {
  getMyPayments, initierPaiementVisite, verifierPaiementVisite,
} from "../services/visiteService";

const POLL_INTERVAL_MS = 5000;
const POLL_TIMEOUT_MS  = 3 * 60 * 1000;

const STATUT_LABEL = {
  en_attente: "En attente de paiement",
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

const MesPaiementsPage = () => {
  const [visites,       setVisites]       = useState([]);
  const [loading,       setLoading]       = useState(true);
  const [payingId,      setPayingId]      = useState(null);
  const [showPayForm,   setShowPayForm]   = useState(null);
  const [phone,         setPhone]         = useState("");
  const [operator,      setOperator]      = useState("AIRTEL");
  const [pollingId,     setPollingId]     = useState(null);
  const [pollingStatus, setPollingStatus] = useState(null);
  const [payError,      setPayError]      = useState(null);

  const pollTimerRef   = useRef(null);
  const pollDeadlineRef = useRef(null);

  const fetchVisites = async () => {
    try {
      const data = await getMyPayments();
      setVisites(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchVisites(); }, []);

  useEffect(() => () => clearTimeout(pollTimerRef.current), []);

  const openPayForm = (id) => {
    setShowPayForm(id);
    setPhone("");
    setOperator("AIRTEL");
    setPayError(null);
  };

  const stopPolling = () => {
    clearTimeout(pollTimerRef.current);
    setPollingId(null);
    setPollingStatus(null);
  };

  const pollPaiement = (visiteId, intentId) => {
    pollDeadlineRef.current = Date.now() + POLL_TIMEOUT_MS;
    setPollingId(visiteId);
    setPollingStatus('en_attente');

    const tick = async () => {
      try {
        const { statut } = await verifierPaiementVisite(intentId);

        if (statut === 'payé') {
          setVisites(prev => prev.map(v => v._id === visiteId ? { ...v, paiementStatus: 'payé' } : v));
          stopPolling();
          setShowPayForm(null);
          return;
        }
        if (statut === 'échoué') {
          setPollingStatus('échoué');
          return;
        }
        if (Date.now() >= pollDeadlineRef.current) {
          setPollingStatus('timeout');
          return;
        }
        pollTimerRef.current = setTimeout(tick, POLL_INTERVAL_MS);
      } catch {
        if (Date.now() >= pollDeadlineRef.current) {
          setPollingStatus('timeout');
          return;
        }
        pollTimerRef.current = setTimeout(tick, POLL_INTERVAL_MS);
      }
    };

    tick();
  };

  const handleLancerPaiement = async (visiteId) => {
    if (!phone.trim()) {
      setPayError("Veuillez saisir votre numéro de téléphone.");
      return;
    }
    setPayError(null);
    setPayingId(visiteId);
    try {
      const { intentId } = await initierPaiementVisite(visiteId, { phone, operator });
      pollPaiement(visiteId, intentId);
    } catch (err) {
      setPayError(err.response?.data?.message || "Impossible d'initier le paiement.");
    } finally {
      setPayingId(null);
    }
  };

  const reessayer = () => {
    stopPolling();
    setPayError(null);
  };

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
          <div className="p-3 bg-gradient-to-br from-amber-500 to-yellow-500 rounded-2xl shadow-lg">
            <CreditCard className="w-7 h-7 text-white" />
          </div>
          <div>
            <h1 className="text-3xl sm:text-4xl font-black text-gray-800">Mes paiements</h1>
            <p className="text-gray-500 text-sm mt-0.5">
              {visites.length} visite{visites.length !== 1 ? "s" : ""} avec paiement requis
            </p>
          </div>
        </div>

        {/* Liste */}
        {visites.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-2xl border-2 border-dashed border-gray-200">
            <AlertTriangle className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="font-semibold text-gray-500">Aucun paiement en cours</p>
          </div>
        ) : (
          <div className="space-y-4">
            {visites.map(visite => {
              const bien    = visite.property || {};
              const photo   = bien.images?.[0] || null;
              const titre   = bien.title       || "Bien immobilier";
              const adresse = [bien.address?.arrondissement, bien.address?.city].filter(Boolean).join(', ');
              const montant = montantDu(bien);
              const isPollingThis = pollingId === visite._id;
              const isPaying = payingId === visite._id;

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
                        <StatutBadge statut={visite.paiementStatus} />
                      </div>
                      {adresse && <p className="text-gray-400 text-xs mb-1">{adresse}</p>}

                      <p className="text-sm font-bold text-gray-800 mt-1">
                        Montant dû : {montant.toLocaleString('fr-FR')} FCFA
                      </p>

                      {visite.dateConfirmee && (
                        <span className="inline-flex items-center gap-1 text-xs text-blue-700 bg-blue-50 px-2.5 py-1 rounded-full mt-2">
                          <Calendar className="w-3 h-3" />
                          Visite : {formatDate(visite.dateConfirmee)}
                        </span>
                      )}

                      {visite.paiementStatus === 'payé' && visite.paiementRef && (
                        <p className="text-xs text-gray-400 mt-2">Référence : {visite.paiementRef}</p>
                      )}
                    </div>
                  </div>

                  {/* Zone d'actions — en attente */}
                  {visite.paiementStatus === 'en_attente' && (
                    <div className="border-t border-gray-100 px-5 py-4">
                      {showPayForm !== visite._id ? (
                        <div className="flex flex-wrap gap-2">
                          <button
                            onClick={() => openPayForm(visite._id)}
                            className="flex items-center gap-1.5 px-4 py-1.5 text-sm font-bold bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition shadow-sm">
                            <CreditCard className="w-4 h-4" />
                            Payer maintenant
                          </button>
                          <a href="tel:+242068002151"
                            className="flex items-center gap-1.5 px-4 py-1.5 text-sm font-semibold bg-gray-50 text-gray-600 rounded-lg hover:bg-gray-100 transition">
                            <Phone className="w-4 h-4" />
                            Contacter un agent
                          </a>
                        </div>
                      ) : isPollingThis ? (
                        <div className="text-center py-2">
                          {pollingStatus === 'en_attente' && (
                            <>
                              <Loader2 className="w-6 h-6 animate-spin text-blue-600 mx-auto mb-2" />
                              <p className="text-sm font-semibold text-gray-700">
                                En attente de confirmation Mobile Money...
                              </p>
                              <p className="text-xs text-gray-400 mt-1">
                                Validez la demande sur votre téléphone.
                              </p>
                            </>
                          )}
                          {pollingStatus === 'échoué' && (
                            <>
                              <AlertTriangle className="w-6 h-6 text-red-500 mx-auto mb-2" />
                              <p className="text-sm font-semibold text-red-600">Le paiement a échoué.</p>
                              <button
                                onClick={reessayer}
                                className="mt-2 px-4 py-1.5 text-sm font-semibold bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition">
                                Réessayer
                              </button>
                            </>
                          )}
                          {pollingStatus === 'timeout' && (
                            <>
                              <AlertTriangle className="w-6 h-6 text-orange-500 mx-auto mb-2" />
                              <p className="text-sm font-semibold text-orange-600">
                                Délai dépassé — vérifiez votre téléphone ou réessayez.
                              </p>
                              <button
                                onClick={reessayer}
                                className="mt-2 px-4 py-1.5 text-sm font-semibold bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition">
                                Réessayer
                              </button>
                            </>
                          )}
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {payError && (
                            <p className="text-sm text-red-600 font-semibold">{payError}</p>
                          )}
                          <input
                            type="tel"
                            placeholder="+242XXXXXXXXX"
                            value={phone}
                            onChange={e => setPhone(e.target.value)}
                            className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
                          />
                          <div className="flex gap-2">
                            <button
                              onClick={() => setOperator('AIRTEL')}
                              className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-sm font-semibold rounded-lg border transition ${
                                operator === 'AIRTEL'
                                  ? 'bg-red-600 text-white border-red-600'
                                  : 'bg-white text-gray-600 border-gray-200'
                              }`}>
                              <Smartphone className="w-4 h-4" /> AIRTEL
                            </button>
                            <button
                              onClick={() => setOperator('MTN')}
                              className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-sm font-semibold rounded-lg border transition ${
                                operator === 'MTN'
                                  ? 'bg-yellow-500 text-white border-yellow-500'
                                  : 'bg-white text-gray-600 border-gray-200'
                              }`}>
                              <Smartphone className="w-4 h-4" /> MTN
                            </button>
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleLancerPaiement(visite._id)}
                              disabled={isPaying}
                              className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2 text-sm font-bold bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 transition shadow-sm">
                              {isPaying ? <Loader2 className="w-4 h-4 animate-spin" /> : <CreditCard className="w-4 h-4" />}
                              Lancer le paiement
                            </button>
                            <button
                              onClick={() => setShowPayForm(null)}
                              className="px-4 py-2 text-sm font-semibold bg-gray-50 text-gray-600 rounded-lg hover:bg-gray-100 transition">
                              Annuler
                            </button>
                          </div>
                        </div>
                      )}
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

export default MesPaiementsPage;
