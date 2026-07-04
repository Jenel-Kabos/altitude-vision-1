"use client";

import React, { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Calendar, Loader2, AlertCircle, Clock, CheckCircle2,
  XCircle, RefreshCw, User, Phone, Mail, Home, MapPin, PlayCircle,
} from 'lucide-react';
import { getOwnerVisites } from '../../services/visiteService';

const BLUE  = '#2E7BB5';
const GOLD  = '#C8960C';
const GREEN = '#16A34A';
const RED   = '#D42B2B';
const GRAY  = '#94A3B8';
const FONT  = "'DM Sans', sans-serif";

const STATUT_CONFIG = {
  'En attente': { color: GOLD,  bg: `${GOLD}15`,  icon: Clock,        label: 'En attente' },
  'Confirmée':  { color: GREEN,     bg: `${GREEN}15`,  icon: CheckCircle2, label: 'Confirmée' },
  'En cours':   { color: '#7C3AED', bg: '#7C3AED15', icon: PlayCircle,   label: 'En cours'  },
  'Annulée':    { color: RED,       bg: `${RED}15`,   icon: XCircle,      label: 'Annulée'   },
  'Terminée':   { color: GRAY,  bg: `${GRAY}15`,  icon: CheckCircle2, label: 'Terminée'   },
};

const StatutBadge = ({ statut }) => {
  const cfg = STATUT_CONFIG[statut] || STATUT_CONFIG['En attente'];
  const Icon = cfg.icon;
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full"
      style={{ color: cfg.color, background: cfg.bg, fontFamily: FONT }}>
      <Icon size={11} />
      {cfg.label}
    </span>
  );
};

const formatDate = (d) => {
  if (!d) return null;
  return new Date(d).toLocaleDateString('fr-FR', {
    weekday: 'long', day: '2-digit', month: 'long', year: 'numeric',
  });
};

const OwnerVisitesPage = () => {
  const [visites, setVisites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);
  const [filter,  setFilter]  = useState('all');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getOwnerVisites();
      setVisites(data);
    } catch {
      setError('Impossible de charger les visites.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = filter === 'all' ? visites : visites.filter(v => v.statut === filter);

  const counts = {
    all:          visites.length,
    'En attente': visites.filter(v => v.statut === 'En attente').length,
    'Confirmée':  visites.filter(v => v.statut === 'Confirmée').length,
    'Annulée':    visites.filter(v => v.statut === 'Annulée').length,
    'Terminée':   visites.filter(v => v.statut === 'Terminée').length,
  };

  const TABS = [
    { id: 'all',        label: 'Toutes'     },
    { id: 'En attente', label: 'En attente' },
    { id: 'Confirmée',  label: 'Confirmées' },
    { id: 'Annulée',    label: 'Annulées'   },
    { id: 'Terminée',   label: 'Terminées'  },
  ];

  if (loading) return (
    <div className="flex items-center justify-center min-h-64">
      <Loader2 size={32} className="animate-spin" style={{ color: BLUE }} />
    </div>
  );

  if (error) return (
    <div className="p-6">
      <div className="flex items-center gap-3 p-4 rounded-xl border"
        style={{ background: `${RED}08`, borderColor: `${RED}30` }}>
        <AlertCircle size={18} style={{ color: RED }} />
        <p className="text-sm" style={{ color: RED, fontFamily: FONT }}>{error}</p>
        <button onClick={load} className="ml-auto text-xs font-semibold underline" style={{ color: RED }}>
          Réessayer
        </button>
      </div>
    </div>
  );

  return (
    <div className="p-6 space-y-5 max-w-4xl mx-auto">

      {/* En-tête */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl flex items-center justify-center"
            style={{ background: `${BLUE}18` }}>
            <Calendar size={22} style={{ color: BLUE }} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900"
              style={{ fontFamily: "'Cormorant Garamond', serif" }}>
              Demandes de Visite
            </h1>
            <p className="text-xs text-gray-400" style={{ fontFamily: FONT }}>
              {counts.all} demande{counts.all !== 1 ? 's' : ''} sur vos biens
            </p>
          </div>
        </div>
        <button onClick={load}
          className="flex items-center gap-2 text-sm font-semibold px-4 py-2 rounded-xl border transition hover:bg-white"
          style={{ borderColor: `${BLUE}30`, color: BLUE, fontFamily: FONT }}>
          <RefreshCw size={14} />
          Actualiser
        </button>
      </div>

      {/* Alerte visites en attente */}
      {counts['En attente'] > 0 && (
        <div className="flex items-start gap-3 p-4 rounded-xl border"
          style={{ background: `${GOLD}10`, borderColor: `${GOLD}40` }}>
          <Clock size={18} style={{ color: GOLD, flexShrink: 0, marginTop: 1 }} />
          <div style={{ fontFamily: FONT }}>
            <p className="text-sm font-semibold" style={{ color: '#92400E' }}>
              {counts['En attente']} visite{counts['En attente'] > 1 ? 's' : ''} en attente de confirmation
            </p>
            <p className="text-xs text-amber-700 mt-0.5">
              Le staff va contacter les visiteurs pour confirmer les dates.
            </p>
          </div>
        </div>
      )}

      {/* Onglets filtre */}
      <div className="flex flex-wrap gap-1.5">
        {TABS.map(({ id, label }) => (
          <button key={id} onClick={() => setFilter(id)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all"
            style={{
              background: filter === id ? `linear-gradient(135deg,#1A5A8A,${BLUE})` : '#F1F5F9',
              color:      filter === id ? '#fff' : '#64748B',
              fontFamily: FONT,
            }}>
            {label}
            <span className={`px-1.5 py-0.5 rounded-full text-xs font-bold ${
              filter === id ? 'bg-white/20 text-white' : 'bg-white text-gray-500'
            }`}>{counts[id]}</span>
          </button>
        ))}
      </div>

      {/* Liste */}
      {filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm py-16 text-center">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-3"
            style={{ background: `${BLUE}12` }}>
            <Calendar size={22} style={{ color: BLUE }} />
          </div>
          <p className="font-semibold text-gray-500 text-sm" style={{ fontFamily: FONT }}>
            Aucune visite {filter !== 'all' ? `"${filter}"` : ''}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          <AnimatePresence>
            {filtered.map((visite, i) => (
              <motion.div key={visite._id}
                initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
                className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">

                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    {visite.property?.images?.[0] ? (
                      <img src={visite.property.images[0]}
                        alt={visite.property.title}
                        className="w-14 h-14 rounded-xl object-cover flex-shrink-0" />
                    ) : (
                      <div className="w-14 h-14 rounded-xl flex items-center justify-center flex-shrink-0"
                        style={{ background: `${BLUE}12` }}>
                        <Home size={20} style={{ color: BLUE }} />
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="font-semibold text-gray-900 text-sm truncate" style={{ fontFamily: FONT }}>
                        {visite.property?.title || 'Bien non trouvé'}
                      </p>
                      {visite.property?.address && (
                        <p className="text-xs text-gray-400 flex items-center gap-1 mt-0.5" style={{ fontFamily: FONT }}>
                          <MapPin size={10} />
                          {visite.property.address.city || visite.property.address.street || ''}
                        </p>
                      )}
                      <p className="text-xs text-gray-400 mt-1" style={{ fontFamily: FONT }}>
                        Demande reçue le {new Date(visite.createdAt).toLocaleDateString('fr-FR')}
                      </p>
                    </div>
                  </div>
                  <StatutBadge statut={visite.statut} />
                </div>

                <div className="mt-4 pt-4 border-t border-gray-50 grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Visiteur */}
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wide text-gray-400 mb-2" style={{ fontFamily: FONT }}>
                      Visiteur
                    </p>
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2">
                        <User size={13} style={{ color: BLUE }} />
                        <span className="text-sm text-gray-700 font-medium" style={{ fontFamily: FONT }}>
                          {visite.client?.name || 'Inconnu'}
                        </span>
                      </div>
                      {visite.client?.email && (
                        <div className="flex items-center gap-2">
                          <Mail size={13} style={{ color: GRAY }} />
                          <span className="text-xs text-gray-500" style={{ fontFamily: FONT }}>
                            {visite.client.email}
                          </span>
                        </div>
                      )}
                      {visite.client?.phone && (
                        <div className="flex items-center gap-2">
                          <Phone size={13} style={{ color: GRAY }} />
                          <span className="text-xs text-gray-500" style={{ fontFamily: FONT }}>
                            {visite.client.phone}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Dates */}
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wide text-gray-400 mb-2" style={{ fontFamily: FONT }}>
                      Dates
                    </p>
                    <div className="space-y-1.5">
                      {visite.dateProposee && (
                        <div className="flex items-start gap-2">
                          <Calendar size={13} style={{ color: GOLD, marginTop: 2 }} />
                          <div>
                            <p className="text-xs text-gray-400" style={{ fontFamily: FONT }}>Date proposée</p>
                            <p className="text-sm font-semibold text-gray-700 capitalize" style={{ fontFamily: FONT }}>
                              {formatDate(visite.dateProposee)}
                            </p>
                          </div>
                        </div>
                      )}
                      {visite.dateConfirmee && (
                        <div className="flex items-start gap-2">
                          <CheckCircle2 size={13} style={{ color: GREEN, marginTop: 2 }} />
                          <div>
                            <p className="text-xs text-gray-400" style={{ fontFamily: FONT }}>Date confirmée</p>
                            <p className="text-sm font-semibold text-gray-700 capitalize" style={{ fontFamily: FONT }}>
                              {formatDate(visite.dateConfirmee)}
                            </p>
                          </div>
                        </div>
                      )}
                      {!visite.dateProposee && !visite.dateConfirmee && (
                        <p className="text-xs text-gray-400 italic" style={{ fontFamily: FONT }}>
                          Date en cours de planification…
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {visite.notes && (
                  <div className="mt-3 p-3 rounded-xl" style={{ background: '#F8FAFC', border: '1px solid #E2E8F0' }}>
                    <p className="text-xs font-semibold text-gray-500 mb-1" style={{ fontFamily: FONT }}>
                      Note du gestionnaire
                    </p>
                    <p className="text-sm text-gray-700" style={{ fontFamily: FONT }}>{visite.notes}</p>
                  </div>
                )}
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
};

export default OwnerVisitesPage;
