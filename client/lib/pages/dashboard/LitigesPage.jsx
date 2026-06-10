"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Scale, AlertTriangle, CheckCircle, Clock, ChevronUp,
  X, MessageSquare, Loader2, RefreshCw,
} from "lucide-react";
import { getLitiges, getLitigeStats, updateLitigeStatut, addLitigeMessage, resolveLitige } from "../../services/litigeService";

const BLUE = '#2E7BB5';
const GOLD = '#C8872A';

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
      <p className="text-2xl font-bold text-gray-900" style={{ fontFamily: "'Outfit', sans-serif" }}>{value}</p>
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
        style={{ fontFamily: "'Outfit', sans-serif" }}>

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

// ── Page principale ───────────────────────────────────────────
const LitigesPage = () => {
  const [litiges,  setLitiges]  = useState([]);
  const [stats,    setStats]    = useState({});
  const [loading,  setLoading]  = useState(true);
  const [selected, setSelected] = useState(null);
  const [filterStatut, setFilterStatut] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [l, s] = await Promise.all([
        getLitiges({ statut: filterStatut }),
        getLitigeStats(),
      ]);
      setLitiges(l.data?.litiges || []);
      setStats(s.byStatut || {});
    } catch {}
    finally { setLoading(false); }
  }, [filterStatut]);

  useEffect(() => { load(); }, [load]);

  const ouverts   = stats['Ouvert']            || 0;
  const urgents   = litiges.filter(l => l.priorité === 'Urgente').length;
  const resolus   = stats['Résolu']            || 0;
  const escalades = stats['Escaladé']          || 0;

  const FILTER_BTNS = [
    { label: 'Tous',        value: '' },
    { label: 'Ouverts',     value: 'Ouvert' },
    { label: 'En cours',    value: 'En_cours_médiation' },
    { label: 'Résolus',     value: 'Résolu' },
    { label: 'Urgents',     value: '' },
  ];

  return (
    <div style={{ fontFamily: "'Outfit', sans-serif" }}>

      {/* Modal */}
      {selected && (
        <LitigeModal
          litige={selected}
          onClose={() => setSelected(null)}
          onRefresh={load}
        />
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Scale className="w-6 h-6" style={{ color: BLUE }} />
            Gestion des Litiges
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">Médiation et résolution des conflits</p>
        </div>
        <button onClick={load}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white transition-all"
          style={{ background: `linear-gradient(135deg, #1A5A8A, ${BLUE})` }}>
          <RefreshCw className="w-4 h-4" />
          Actualiser
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard label="Ouverts"   value={ouverts}   color="#DC2626" icon={AlertTriangle} />
        <StatCard label="Urgents"   value={urgents}   color="#D97706" icon={ChevronUp}     />
        <StatCard label="Résolus"   value={resolus}   color="#059669" icon={CheckCircle}   />
        <StatCard label="Escaladés" value={escalades} color="#7C3AED" icon={Scale}         />
      </div>

      {/* Filtres */}
      <div className="flex flex-wrap gap-2 mb-5">
        {[
          { label: 'Tous',      value: '' },
          { label: 'Ouverts',   value: 'Ouvert' },
          { label: 'En cours',  value: 'En_cours_médiation' },
          { label: 'Résolus',   value: 'Résolu' },
          { label: 'Escaladés', value: 'Escaladé' },
        ].map(btn => (
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

      {/* Liste */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
        </div>
      ) : litiges.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <Scale className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p className="text-sm">Aucun litige trouvé.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {litiges.map(l => {
            const st = STATUT_STYLE[l.statut] || STATUT_STYLE['Ouvert'];
            const pr = PRIORITE_STYLE[l.priorité] || PRIORITE_STYLE['Normale'];
            return (
              <div key={l._id} className="bg-white rounded-2xl border border-gray-100 p-4 hover:shadow-sm transition-shadow">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1.5">
                      <span className="text-sm font-bold text-gray-900">{l.reference}</span>
                      <span className="text-xs px-2 py-0.5 rounded-full font-semibold"
                        style={{ background: st.bg, color: st.color }}>{st.label}</span>
                      <span className="flex items-center gap-1 text-xs font-semibold"
                        style={{ color: pr.color }}>
                        <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: pr.dot }} />
                        {l.priorité}
                      </span>
                    </div>
                    <p className="text-sm text-gray-700 font-medium">{TYPE_LABEL[l.type] || l.type}</p>
                    {l.bienConcerné?.title && (
                      <p className="text-xs text-gray-500 truncate">{l.bienConcerné.title}</p>
                    )}
                    <p className="text-xs text-gray-400 mt-1">
                      Plaignant : {l.plaignant?.nom || '—'} — {relDate(l.dateOuverture)}
                    </p>
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    <button onClick={() => setSelected(l)}
                      className="px-3 py-1.5 rounded-xl text-xs font-semibold transition-all text-white"
                      style={{ background: `linear-gradient(135deg, #1A5A8A, ${BLUE})` }}>
                      Voir détail
                    </button>
                  </div>
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
