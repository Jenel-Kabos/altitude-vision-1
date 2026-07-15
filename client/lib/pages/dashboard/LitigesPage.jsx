"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  Scale, AlertTriangle, CheckCircle, Clock, ChevronUp,
  X, MessageSquare, Loader2, RefreshCw, Flag,
} from "lucide-react";
import { getLitiges, getLitige, getLitigeStats, updateLitigeStatut, addLitigeMessage, resolveLitige } from "../../services/litigeService";
import { getAllSignalements, traiterSignalement } from "../../services/signalementService";

const BLUE = '#2E7BB5';
const GOLD = '#C8960C';

const STATUTS = ['Ouvert', 'En_cours_médiation', 'Résolu', 'Escaladé', 'Fermé'];
const PRIORITES = ['Faible', 'Normale', 'Haute', 'Urgente'];

const STATUT_STYLE = {
  Ouvert:              { bg: '#FEE2E2', color: '#DC2626', label: 'Ouvert' },
  En_cours_médiation:  { bg: '#FEF3C7', color: '#D97706', label: 'En médiation' },
  Résolu:              { bg: '#D1FAE5', color: '#059669', label: 'Résolu' },
  Escaladé:            { bg: '#EDE9FE', color: '#7C3AED', label: 'Escaladé' },
  Fermé:               { bg: '#F3F4F6', color: '#6B7280', label: 'Fermé' },
};

const PRIORITE_STYLE = {
  Faible:  { color: '#6B7280', dot: '#9CA3AF' },
  Normale: { color: '#2563EB', dot: '#60A5FA' },
  Haute:   { color: '#D97706', dot: '#FBBF24' },
  Urgente: { color: '#DC2626', dot: '#F87171' },
};

const TYPE_LABEL = {
  Information_fausse:  'Information fausse',
  Bien_inexistant:     'Bien inexistant',
  'Prix_non_respecté': 'Prix non respecté',
  Arnaque:             'Arnaque',
  Mauvaise_foi:        'Mauvaise foi',
  'Problème_paiement': 'Problème de paiement',
  Autre:               'Autre',
};

const RAISON_LABEL = {
  prix_incorrect:      'Prix incorrect ou trompeur',
  annonce_expiree:     'Annonce déjà vendue / louée',
  photos_trompeuses:   'Photos trompeuses',
  fraude:               'Fraude suspectée',
  contenu_inapproprie: 'Contenu inapproprié',
  autre:                'Autre raison',
};

const SIGNALEMENT_STATUT_STYLE = {
  en_attente: { bg: '#FEF3C7', color: '#D97706', label: 'En attente' },
  traite:     { bg: '#D1FAE5', color: '#059669', label: 'Traité' },
  rejete:     { bg: '#F3F4F6', color: '#6B7280', label: 'Rejeté' },
};

const TYPE_BADGE = {
  litige:      { bg: '#FEE2E2', color: '#DC2626', label: 'LITIGE' },
  signalement: { bg: '#FFEDD5', color: '#F97316', label: 'SIGNALEMENT' },
};

// Les deux modèles ont des enums de statut totalement différents
// (Litige: Ouvert/En_cours_médiation/Résolu/Escaladé/Fermé,
//  Signalement: en_attente/traite/rejete) — on normalise pour
// pouvoir filtrer les deux types avec les mêmes chips.
// Escaladé → "En cours", Fermé → "Traité" (approximation la plus proche).
const STATUT_NORMALISE = {
  litige: {
    Ouvert:             'en_attente',
    En_cours_médiation: 'en_cours',
    Résolu:             'traite',
    Escaladé:           'en_cours',
    Fermé:              'traite',
  },
  signalement: {
    en_attente: 'en_attente',
    traite:     'traite',
    rejete:     'rejete',
  },
};
const normStatut = (item) => STATUT_NORMALISE[item._type]?.[item.statut] || item.statut;

const fmtDate = d => d ? new Date(d).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';
const relDate  = d => {
  if (!d) return '';
  const diff = Date.now() - new Date(d);
  const h = Math.floor(diff / 3600000);
  if (h < 1)  return 'Il y a quelques minutes';
  if (h < 24) return `Il y a ${h}h`;
  const j = Math.floor(h / 24);
  return `Il y a ${j} jour${j > 1 ? 's' : ''}`;
};

// ── Stat card ─────────────────────────────────────────────────
const StatCard = ({ label, value, color, icon: Icon }) => (
  <div className="bg-white rounded-2xl border border-gray-100 p-5 flex items-center gap-4">
    <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
      style={{ background: `${color}15` }}>
      <Icon className="w-5 h-5" style={{ color }} />
    </div>
    <div>
      <p className="text-2xl font-bold text-gray-900" style={{ fontFamily: "'DM Sans', sans-serif" }}>{value}</p>
      <p className="text-xs text-gray-500">{label}</p>
    </div>
  </div>
);

// ── Modal détail ──────────────────────────────────────────────
const LitigeModal = ({ litige, onClose, onRefresh }) => {
  const [statut,    setStatut]    = useState(litige.statut);
  const [note,      setNote]      = useState('');
  const [message,   setMessage]   = useState('');
  const [decision,  setDecision]  = useState('');
  const [loading,   setLoading]   = useState(false);
  const [msg,       setMsg]       = useState('');

  const st = STATUT_STYLE[litige.statut] || STATUT_STYLE['Ouvert'];
  const pr = PRIORITE_STYLE[litige.priorité] || PRIORITE_STYLE['Normale'];

  const doStatut = async () => {
    if (!statut) return;
    setLoading(true); setMsg('');
    try {
      await updateLitigeStatut(litige._id, { statut, note });
      setMsg('Statut mis à jour.');
      onRefresh();
    } catch { setMsg('Erreur.'); }
    finally { setLoading(false); }
  };

  const doMessage = async () => {
    if (!message.trim()) return;
    setLoading(true); setMsg('');
    try {
      await addLitigeMessage(litige._id, message);
      setMessage(''); setMsg('Message ajouté.');
      onRefresh();
    } catch { setMsg('Erreur.'); }
    finally { setLoading(false); }
  };

  const doResolution = async () => {
    if (!decision.trim()) return;
    setLoading(true); setMsg('');
    try {
      await resolveLitige(litige._id, decision);
      setMsg('Litige clôturé.'); onRefresh(); onClose();
    } catch { setMsg('Erreur.'); }
    finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
        style={{ fontFamily: "'DM Sans', sans-serif" }}>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 sticky top-0 bg-white z-10">
          <div className="flex items-center gap-3">
            <Scale className="w-5 h-5 text-gray-400" />
            <div>
              <p className="font-bold text-gray-900 text-sm">{litige.reference}</p>
              <span className="text-xs px-2 py-0.5 rounded-full font-semibold"
                style={{ background: st.bg, color: st.color }}>{st.label}</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1.5 text-xs font-semibold"
              style={{ color: pr.color }}>
              <span className="w-2 h-2 rounded-full" style={{ background: pr.dot }} />
              {litige.priorité}
            </span>
            <button onClick={onClose} className="p-2 rounded-xl hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-all">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-5">
          {/* Infos */}
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="bg-gray-50 rounded-xl p-3">
              <p className="text-xs text-gray-400 mb-1 uppercase tracking-wider">Type</p>
              <p className="font-semibold text-gray-800">{TYPE_LABEL[litige.type] || litige.type}</p>
            </div>
            <div className="bg-gray-50 rounded-xl p-3">
              <p className="text-xs text-gray-400 mb-1 uppercase tracking-wider">Bien</p>
              <p className="font-semibold text-gray-800 truncate">{litige.bienConcerné?.title || '—'}</p>
            </div>
          </div>

          {/* Parties */}
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="border border-gray-100 rounded-xl p-3">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Plaignant</p>
              <p className="font-semibold text-gray-800">{litige.plaignant?.nom || '—'}</p>
              <p className="text-gray-500 text-xs">{litige.plaignant?.email}</p>
              {litige.plaignant?.telephone && <p className="text-gray-500 text-xs">{litige.plaignant.telephone}</p>}
              <span className="text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 font-medium mt-1 inline-block">{litige.plaignant?.type}</span>
            </div>
            <div className="border border-gray-100 rounded-xl p-3">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Accusé</p>
              <p className="font-semibold text-gray-800">{litige.accusé?.nom || '—'}</p>
              <p className="text-gray-500 text-xs">{litige.accusé?.email || '—'}</p>
              {litige.accusé?.type && <span className="text-xs px-2 py-0.5 rounded-full bg-amber-50 text-amber-600 font-medium mt-1 inline-block">{litige.accusé.type}</span>}
            </div>
          </div>

          {/* Description */}
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Description</p>
            <div className="bg-gray-50 rounded-xl p-3 text-sm text-gray-700 leading-relaxed">
              {litige.description}
            </div>
          </div>

          {/* Preuves */}
          {litige.preuves?.length > 0 && (
            <div>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Preuves</p>
              <div className="space-y-1.5">
                {litige.preuves.map((p, i) => (
                  <a key={i} href={p.url} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-xl border border-gray-100 text-sm text-blue-600 hover:bg-blue-50 transition-colors">
                    <span>📄</span>
                    <span className="flex-1 truncate">{p.nom}</span>
                    <span className="text-xs text-gray-400">Voir</span>
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Timeline */}
          {litige.timeline?.length > 0 && (
            <div>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Timeline</p>
              <div className="space-y-2">
                {litige.timeline.map((t, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
                      style={{ background: `${BLUE}15` }}>
                      <div className="w-1.5 h-1.5 rounded-full" style={{ background: BLUE }} />
                    </div>
                    <div className="flex-1">
                      <p className="text-xs font-semibold text-gray-700">{t.action}</p>
                      {t.note && <p className="text-xs text-gray-500 mt-0.5">{t.note}</p>}
                      <p className="text-xs text-gray-400 mt-0.5">{fmtDate(t.date)} — {t.auteur}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Résolution existante */}
          {litige.resolution?.decision && (
            <div className="bg-green-50 border border-green-200 rounded-xl p-4">
              <p className="text-xs font-bold text-green-700 uppercase tracking-wider mb-1">Décision finale</p>
              <p className="text-sm text-green-800">{litige.resolution.decision}</p>
            </div>
          )}

          {/* Actions admin */}
          {msg && (
            <div className="px-4 py-2 rounded-xl text-sm text-center"
              style={{ background: `${BLUE}10`, color: BLUE }}>{msg}</div>
          )}

          <div className="border-t border-gray-100 pt-5 space-y-4">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Actions Admin</p>

            {/* Statut */}
            <div>
              <label className="block text-xs text-gray-500 mb-1.5">Changer le statut</label>
              <div className="flex gap-2">
                <select value={statut} onChange={e => setStatut(e.target.value)}
                  className="flex-1 px-3 py-2 border border-gray-200 rounded-xl bg-gray-50 text-sm focus:outline-none">
                  {STATUTS.map(s => <option key={s} value={s}>{STATUT_STYLE[s]?.label || s}</option>)}
                </select>
              </div>
              <textarea rows={2} placeholder="Note (optionnel)..." value={note} onChange={e => setNote(e.target.value)}
                className="w-full mt-2 px-3 py-2 border border-gray-200 rounded-xl bg-gray-50 text-sm focus:outline-none resize-none" />
              <button onClick={doStatut} disabled={loading}
                className="mt-2 px-4 py-2 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-50"
                style={{ background: `linear-gradient(135deg, #1A5A8A, ${BLUE})` }}>
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Mettre à jour'}
              </button>
            </div>

            {/* Message */}
            <div>
              <label className="block text-xs text-gray-500 mb-1.5">Ajouter un message à la timeline</label>
              <div className="flex gap-2">
                <input type="text" placeholder="Message..." value={message} onChange={e => setMessage(e.target.value)}
                  className="flex-1 px-3 py-2 border border-gray-200 rounded-xl bg-gray-50 text-sm focus:outline-none" />
                <button onClick={doMessage} disabled={loading}
                  className="px-4 py-2 rounded-xl text-sm font-semibold text-white disabled:opacity-50"
                  style={{ background: `linear-gradient(135deg, #1A5A8A, ${BLUE})` }}>
                  <MessageSquare className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Résolution */}
            {litige.statut !== 'Résolu' && litige.statut !== 'Fermé' && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-4 space-y-2">
                <p className="text-xs font-bold text-red-700 uppercase tracking-wider">Résolution finale</p>
                <textarea rows={3} placeholder="Décision finale..." value={decision} onChange={e => setDecision(e.target.value)}
                  className="w-full px-3 py-2 border border-red-200 rounded-xl bg-white text-sm focus:outline-none resize-none" />
                <button onClick={doResolution} disabled={loading || !decision.trim()}
                  className="w-full py-2.5 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-50"
                  style={{ background: 'linear-gradient(135deg, #991B1B, #DC2626)' }}>
                  {loading ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Clore le litige'}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// ── Modal détail signalement ─────────────────────────────────
const SignalementModal = ({ signalement, onClose, onRefresh }) => {
  const [loading, setLoading] = useState(false);
  const [msg,     setMsg]     = useState('');

  const st = SIGNALEMENT_STATUT_STYLE[signalement.statut] || SIGNALEMENT_STATUT_STYLE['en_attente'];

  const doTraiter = async (statut) => {
    setLoading(true); setMsg('');
    try {
      await traiterSignalement(signalement._id, { statut });
      onRefresh();
      onClose();
    } catch { setMsg('Erreur.'); setLoading(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
        style={{ fontFamily: "'DM Sans', sans-serif" }}>

        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 sticky top-0 bg-white z-10">
          <div className="flex items-center gap-3">
            <Flag className="w-5 h-5 text-orange-500" />
            <div>
              <p className="font-bold text-gray-900 text-sm truncate max-w-[240px]">{signalement.property?.title || 'Bien supprimé'}</p>
              <span className="text-xs px-2 py-0.5 rounded-full font-semibold" style={{ background: st.bg, color: st.color }}>{st.label}</span>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-all">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          <div className="bg-gray-50 rounded-xl p-3">
            <p className="text-xs text-gray-400 mb-1 uppercase tracking-wider">Motif</p>
            <p className="font-semibold text-gray-800">{RAISON_LABEL[signalement.raison] || signalement.raison}</p>
          </div>

          {signalement.details && (
            <div>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Détails</p>
              <div className="bg-gray-50 rounded-xl p-3 text-sm text-gray-700 leading-relaxed">{signalement.details}</div>
            </div>
          )}

          {signalement.preuves?.length > 0 && (
            <div>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Preuves</p>
              <div className="space-y-1.5">
                {signalement.preuves.map((p, i) => (
                  <a key={i} href={p.url} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-xl border border-gray-100 text-sm text-blue-600 hover:bg-blue-50 transition-colors">
                    <span>📄</span>
                    <span className="flex-1 truncate">{p.nom}</span>
                    <span className="text-xs text-gray-400">Voir</span>
                  </a>
                ))}
              </div>
            </div>
          )}

          <div className="border-t border-gray-100 pt-4">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Signalé par</p>
            <p className="font-semibold text-gray-800">{signalement.signalePar?.name || '—'}</p>
            <p className="text-gray-500 text-xs">{signalement.signalePar?.email}</p>
          </div>

          {msg && (
            <div className="px-4 py-2 rounded-xl text-sm text-center" style={{ background: '#F9731615', color: '#F97316' }}>{msg}</div>
          )}

          {signalement.statut === 'en_attente' && (
            <div className="flex gap-2 pt-2 border-t border-gray-100">
              <button onClick={() => doTraiter('rejete')} disabled={loading}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold border border-gray-200 text-gray-600 hover:bg-gray-50 transition-all disabled:opacity-50">
                Rejeter
              </button>
              <button onClick={() => doTraiter('traite')} disabled={loading}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-50"
                style={{ background: 'linear-gradient(135deg, #C2410C, #F97316)' }}>
                {loading ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Marquer comme traité'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ── Page principale ───────────────────────────────────────────
const LitigesPage = () => {
  const [litiges,      setLitiges]      = useState([]);
  const [signalements, setSignalements] = useState([]);
  const [stats,        setStats]        = useState({});
  const [loading,      setLoading]      = useState(true);
  const [selected,     setSelected]     = useState(null);
  const [filterStatut, setFilterStatut] = useState('');

  // Un seul fetch (pas de re-fetch serveur par filtre) — le filtrage par
  // statut se fait ensuite côté client sur la liste fusionnée, car les
  // deux endpoints n'ont pas le même vocabulaire de statut (voir normStatut).
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [litRes, statsRes, sigRes] = await Promise.allSettled([
        getLitiges({}),
        getLitigeStats(),
        getAllSignalements(),
      ]);
      setLitiges(litRes.status === 'fulfilled' ? (litRes.value.data?.litiges || []) : []);
      setStats(statsRes.status === 'fulfilled' ? (statsRes.value.byStatut || {}) : {});
      setSignalements(sigRes.status === 'fulfilled' ? sigRes.value : []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const openLitige = async (summary) => {
    try {
      // Le détail serveur enregistre staffViewedAt ; ne pas masquer le badge
      // tant que cette écriture n'a pas réussi.
      const litige = await getLitige(summary._id);
      setSelected({ ...litige, _type: 'litige' });
      window.dispatchEvent(new CustomEvent('altitude:dashboard-badges:refresh'));
    } catch {
      // Le détail local n'est pas ouvert : le compteur reste fidèle à la base.
    }
  };

  const ouverts   = stats['Ouvert']   || 0;
  const urgents   = litiges.filter(l => l.priorité === 'Urgente').length;
  const resolus   = stats['Résolu']   || 0;
  const escalades = stats['Escaladé'] || 0;

  const tousElements = useMemo(() => [
    ...litiges.map(l => ({ ...l, _type: 'litige' })),
    ...signalements.map(s => ({ ...s, _type: 'signalement' })),
  ].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)), [litiges, signalements]);

  const elementsFiltres = useMemo(() =>
    tousElements.filter(el => !filterStatut || normStatut(el) === filterStatut),
  [tousElements, filterStatut]);

  const FILTER_BTNS = [
    { label: 'Tous',       value: '' },
    { label: 'En attente', value: 'en_attente' },
    { label: 'En cours',   value: 'en_cours' },
    { label: 'Traité',     value: 'traite' },
    { label: 'Rejeté',     value: 'rejete' },
  ];

  return (
    <div style={{ fontFamily: "'DM Sans', sans-serif" }}>

      {/* Modal */}
      {selected?._type === 'litige' && (
        <LitigeModal
          litige={selected}
          onClose={() => setSelected(null)}
          onRefresh={load}
        />
      )}
      {selected?._type === 'signalement' && (
        <SignalementModal
          signalement={selected}
          onClose={() => setSelected(null)}
          onRefresh={load}
        />
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Scale className="w-6 h-6" style={{ color: BLUE }} />
            Litiges & Signalements
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">Médiation, résolution des conflits et modération des annonces</p>
        </div>
        <button onClick={load}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white transition-all"
          style={{ background: `linear-gradient(135deg, #1A5A8A, ${BLUE})` }}>
          <RefreshCw className="w-4 h-4" />
          Actualiser
        </button>
      </div>

      {/* Stats — litiges uniquement */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard label="Ouverts"   value={ouverts}   color="#DC2626" icon={AlertTriangle} />
        <StatCard label="Urgents"   value={urgents}   color="#D97706" icon={ChevronUp}     />
        <StatCard label="Résolus"   value={resolus}   color="#059669" icon={CheckCircle}   />
        <StatCard label="Escaladés" value={escalades} color="#7C3AED" icon={Scale}         />
      </div>

      {/* Filtres — communs aux deux types (statuts normalisés) */}
      <div className="flex flex-wrap gap-2 mb-5">
        {FILTER_BTNS.map(btn => (
          <button key={btn.value}
            onClick={() => setFilterStatut(btn.value)}
            className="px-4 py-2 rounded-xl text-sm font-semibold transition-all"
            style={{
              background: filterStatut === btn.value ? `linear-gradient(135deg, #1A5A8A, ${BLUE})` : '#F9FAFB',
              color:      filterStatut === btn.value ? 'white' : '#374151',
              border:     `1px solid ${filterStatut === btn.value ? 'transparent' : '#E5E7EB'}`,
            }}>
            {btn.label}
          </button>
        ))}
      </div>

      {/* Liste fusionnée */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
        </div>
      ) : elementsFiltres.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <Scale className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p className="text-sm">Aucun élément trouvé.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {elementsFiltres.map(el => {
            const badge = TYPE_BADGE[el._type];

            if (el._type === 'litige') {
              const st = STATUT_STYLE[el.statut] || STATUT_STYLE['Ouvert'];
              const pr = PRIORITE_STYLE[el.priorité] || PRIORITE_STYLE['Normale'];
              return (
                <div key={el._id} className="bg-white rounded-2xl border border-gray-100 p-4 hover:shadow-sm transition-shadow">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1.5">
                        <span className="text-xs px-2 py-0.5 rounded-full font-bold" style={{ background: badge.bg, color: badge.color }}>{badge.label}</span>
                        <span className="text-sm font-bold text-gray-900">{el.reference}</span>
                        <span className="text-xs px-2 py-0.5 rounded-full font-semibold"
                          style={{ background: st.bg, color: st.color }}>{st.label}</span>
                        <span className="flex items-center gap-1 text-xs font-semibold"
                          style={{ color: pr.color }}>
                          <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: pr.dot }} />
                          {el.priorité}
                        </span>
                      </div>
                      <p className="text-sm text-gray-700 font-medium">{TYPE_LABEL[el.type] || el.type}</p>
                      {el.bienConcerné?.title && (
                        <p className="text-xs text-gray-500 truncate">{el.bienConcerné.title}</p>
                      )}
                      <p className="text-xs text-gray-400 mt-1">
                        Plaignant : {el.plaignant?.nom || '—'} — {relDate(el.dateOuverture)}
                      </p>
                    </div>
                    <button onClick={() => openLitige(el)}
                      className="px-3 py-1.5 rounded-xl text-xs font-semibold transition-all text-white flex-shrink-0"
                      style={{ background: `linear-gradient(135deg, #1A5A8A, ${BLUE})` }}>
                      Voir détail
                    </button>
                  </div>
                </div>
              );
            }

            // signalement
            const st = SIGNALEMENT_STATUT_STYLE[el.statut] || SIGNALEMENT_STATUT_STYLE['en_attente'];
            return (
              <div key={el._id} className="bg-white rounded-2xl border border-gray-100 p-4 hover:shadow-sm transition-shadow">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1.5">
                      <span className="text-xs px-2 py-0.5 rounded-full font-bold" style={{ background: badge.bg, color: badge.color }}>{badge.label}</span>
                      <span className="text-xs px-2 py-0.5 rounded-full font-semibold"
                        style={{ background: st.bg, color: st.color }}>{st.label}</span>
                    </div>
                    <p className="text-sm text-gray-700 font-medium truncate">{el.property?.title || 'Bien supprimé'}</p>
                    <p className="text-xs text-gray-500">{RAISON_LABEL[el.raison] || el.raison}</p>
                    <p className="text-xs text-gray-400 mt-1">
                      Signalé par : {el.signalePar?.name || '—'} — {relDate(el.createdAt)}
                    </p>
                  </div>
                  <button onClick={() => setSelected(el)}
                    className="px-3 py-1.5 rounded-xl text-xs font-semibold transition-all text-white flex-shrink-0"
                    style={{ background: 'linear-gradient(135deg, #C2410C, #F97316)' }}>
                    Voir détail
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default LitigesPage;
