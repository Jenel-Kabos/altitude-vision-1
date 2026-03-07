import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  Home, Plus, CheckCircle, Clock, Edit2, Trash2,
  Loader2, AlertCircle, Search, Filter, X, ShieldCheck,
} from 'lucide-react';
import api from '../../services/api';

const BLUE = '#2E7BB5';
const GOLD = '#C8872A';
const RED  = '#D42B2B';

// ─────────────────────────────────────────────────────────────
// ConfirmDialog
// ─────────────────────────────────────────────────────────────
const ConfirmDialog = ({ title, message, confirmLabel = 'Confirmer', confirmStyle = 'red', onConfirm, onCancel }) => {
  const confirmBg = confirmStyle === 'red'
    ? 'linear-gradient(135deg,#B91C1C,#DC2626)'
    : `linear-gradient(135deg,#1A5A8A,${BLUE})`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 text-center">
        <div className="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-4"
          style={{ background: confirmStyle === 'red' ? '#FEE2E2' : `${BLUE}15` }}>
          <AlertCircle size={22} style={{ color: confirmStyle === 'red' ? '#DC2626' : BLUE }} />
        </div>
        <h3 className="font-bold text-gray-900 mb-2" style={{ fontFamily: "'Outfit', sans-serif" }}>
          {title}
        </h3>
        <p className="text-sm text-gray-500 mb-6" style={{ fontFamily: "'Outfit', sans-serif" }}>
          {message}
        </p>
        <div className="flex gap-3">
          <button onClick={onCancel}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 transition-all"
            style={{ fontFamily: "'Outfit', sans-serif" }}>
            Annuler
          </button>
          <button onClick={onConfirm}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white transition-all hover:scale-105"
            style={{ background: confirmBg, fontFamily: "'Outfit', sans-serif" }}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────
// InlineNotif
// ─────────────────────────────────────────────────────────────
const InlineNotif = ({ message, type, onClose }) => (
  <div className="flex items-center gap-3 px-4 py-3 rounded-xl mb-5 text-sm font-medium"
    style={{
      background: type === 'error' ? '#FEF2F2' : '#F0FDF4',
      color:      type === 'error' ? '#DC2626'  : '#16A34A',
      border:     `1px solid ${type === 'error' ? '#FCA5A5' : '#86EFAC'}`,
      fontFamily: "'Outfit', sans-serif",
    }}>
    <span className="flex-1">{message}</span>
    <button onClick={onClose} className="opacity-60 hover:opacity-100 transition-opacity"><X size={14} /></button>
  </div>
);

// ─────────────────────────────────────────────────────────────
// Badges statut
// ─────────────────────────────────────────────────────────────
const StatusBadge = ({ isApproved }) => (
  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold"
    style={{
      background: isApproved ? '#F0FDF4' : '#FFFBEB',
      color:      isApproved ? '#16A34A' : '#D97706',
      fontFamily: "'Outfit', sans-serif",
    }}>
    {isApproved
      ? <><CheckCircle size={11} /> Approuvé</>
      : <><Clock size={11} /> En attente</>}
  </span>
);

// ─────────────────────────────────────────────────────────────
// FILTRES
// ─────────────────────────────────────────────────────────────
const FILTERS = [
  { id: 'all',      label: 'Tous'         },
  { id: 'pending',  label: 'En attente'   },
  { id: 'approved', label: 'Approuvés'    },
];

// ─────────────────────────────────────────────────────────────
// MAIN
// ─────────────────────────────────────────────────────────────
const AdminPropertyList = () => {
  const [properties, setProperties]   = useState([]);
  const [filtered, setFiltered]       = useState([]);
  const [loading, setLoading]         = useState(true);
  const [search, setSearch]           = useState('');
  const [statusFilter, setStatus]     = useState('all');
  const [notif, setNotif]             = useState(null);
  const [confirm, setConfirm]         = useState(null); // { type:'delete'|'approve', id }

  const showNotif = (message, type = 'success') => {
    setNotif({ message, type });
    setTimeout(() => setNotif(null), 4000);
  };

  const fetchProperties = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/properties');
      setProperties(data);
    } catch {
      showNotif('Erreur lors du chargement des biens.', 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchProperties(); }, [fetchProperties]);

  // Filtrage réactif
  useEffect(() => {
    let list = [...properties];
    if (statusFilter === 'pending')  list = list.filter(p => !p.isApproved);
    if (statusFilter === 'approved') list = list.filter(p =>  p.isApproved);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(p =>
        p.title?.toLowerCase().includes(q) ||
        p.user?.name?.toLowerCase().includes(q) ||
        p.address?.city?.toLowerCase().includes(q)
      );
    }
    setFiltered(list);
  }, [properties, statusFilter, search]);

  const handleApprove = async () => {
    if (!confirm) return;
    try {
      await api.put(`/properties/${confirm.id}/approve`);
      showNotif('Bien approuvé et publié avec succès.');
      setProperties(prev =>
        prev.map(p => p._id === confirm.id ? { ...p, isApproved: true } : p)
      );
    } catch {
      showNotif("Erreur lors de l'approbation.", 'error');
    } finally {
      setConfirm(null);
    }
  };

  const handleDelete = async () => {
    if (!confirm) return;
    try {
      await api.delete(`/properties/${confirm.id}`);
      showNotif('Bien supprimé définitivement.');
      setProperties(prev => prev.filter(p => p._id !== confirm.id));
    } catch {
      showNotif('Erreur lors de la suppression.', 'error');
    } finally {
      setConfirm(null);
    }
  };

  // Compteurs pour les onglets
  const pendingCount  = properties.filter(p => !p.isApproved).length;
  const approvedCount = properties.filter(p =>  p.isApproved).length;

  const counts = { all: properties.length, pending: pendingCount, approved: approvedCount };

  return (
    <div className="max-w-6xl mx-auto">

      {/* ── En-tête ── */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: `${BLUE}18` }}>
            <Home size={20} style={{ color: BLUE }} />
          </div>
          <div>
            <h2 className="font-bold text-gray-900 text-lg"
              style={{ fontFamily: "'Outfit', sans-serif" }}>
              Modération des Biens
            </h2>
            <p className="text-xs text-gray-400"
              style={{ fontFamily: "'Outfit', sans-serif" }}>
              {pendingCount > 0
                ? `${pendingCount} bien${pendingCount > 1 ? 's' : ''} en attente d'approbation`
                : 'Tous les biens sont à jour'}
            </p>
          </div>
        </div>

        <Link to="/soumettre-propriete"
          className="flex items-center gap-2 px-4 py-2.5 text-white text-sm font-semibold rounded-xl transition-all hover:scale-105 no-underline"
          style={{
            background: `linear-gradient(135deg, #1A5A8A, ${BLUE})`,
            boxShadow:  `0 4px 16px ${BLUE}35`,
            fontFamily: "'Outfit', sans-serif",
          }}>
          <Plus size={16} /> Ajouter un bien
        </Link>
      </div>

      {/* ── Notification ── */}
      {notif && <InlineNotif message={notif.message} type={notif.type} onClose={() => setNotif(null)} />}

      {/* ── Filtres + Recherche ── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 mb-5">
        <div className="flex flex-col sm:flex-row gap-4">

          {/* Onglets statut */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <Filter size={14} className="text-gray-400 flex-shrink-0" />
            {FILTERS.map(({ id, label }) => (
              <button key={id} onClick={() => setStatus(id)}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all"
                style={{
                  fontFamily: "'Outfit', sans-serif",
                  background: statusFilter === id ? `linear-gradient(135deg,#1A5A8A,${BLUE})` : '#F1F5F9',
                  color:      statusFilter === id ? '#fff' : '#64748B',
                  boxShadow:  statusFilter === id ? `0 2px 8px ${BLUE}30` : 'none',
                }}>
                {label}
                <span className={`px-1.5 py-0.5 rounded-full text-xs font-bold ${
                  statusFilter === id ? 'bg-white/20 text-white' : 'bg-white text-gray-500'
                }`}>
                  {counts[id]}
                </span>
              </button>
            ))}
          </div>

          {/* Recherche */}
          <div className="relative flex-1 min-w-0">
            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Titre, propriétaire, ville…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 text-sm bg-gray-50 border border-gray-200 rounded-xl outline-none transition-all"
              style={{ fontFamily: "'Outfit', sans-serif" }}
              onFocus={e => { e.target.style.borderColor = BLUE; e.target.style.boxShadow = `0 0 0 3px ${BLUE}18`; }}
              onBlur={e  => { e.target.style.borderColor = '#E2E8F0'; e.target.style.boxShadow = 'none'; }}
            />
          </div>
        </div>
      </div>

      {/* ── Contenu ── */}
      {loading ? (
        <div className="flex items-center justify-center py-24">
          <div className="text-center">
            <Loader2 size={32} className="animate-spin mx-auto mb-3" style={{ color: BLUE }} />
            <p className="text-sm text-gray-400" style={{ fontFamily: "'Outfit', sans-serif" }}>
              Chargement des biens…
            </p>
          </div>
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 bg-white rounded-2xl border-2 border-dashed border-gray-200">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4"
            style={{ background: `${BLUE}12` }}>
            <Home size={24} style={{ color: BLUE }} />
          </div>
          <p className="font-semibold text-gray-600 mb-1"
            style={{ fontFamily: "'Outfit', sans-serif" }}>
            Aucun bien trouvé
          </p>
          <p className="text-sm text-gray-400"
            style={{ fontFamily: "'Outfit', sans-serif" }}>
            {search
              ? `Aucun résultat pour "${search}".`
              : statusFilter === 'pending'
                ? 'Aucun bien en attente — tout est approuvé !'
                : 'Aucun bien dans cette catégorie.'}
          </p>
          {(search || statusFilter !== 'all') && (
            <button onClick={() => { setSearch(''); setStatus('all'); }}
              className="mt-4 text-xs font-medium flex items-center gap-1 transition-opacity hover:opacity-70"
              style={{ color: BLUE, fontFamily: "'Outfit', sans-serif" }}>
              <X size={12} /> Réinitialiser les filtres
            </button>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">

          {/* Header colonnes */}
          <div className="grid grid-cols-12 gap-3 px-5 py-3 border-b border-gray-100"
            style={{ background: '#F8FAFC' }}>
            {[
              { label: 'Bien',          col: 'col-span-4' },
              { label: 'Propriétaire',  col: 'col-span-2' },
              { label: 'Statut',        col: 'col-span-2' },
              { label: 'Pôle',          col: 'col-span-2' },
              { label: 'Actions',       col: 'col-span-2 text-right' },
            ].map(({ label, col }) => (
              <div key={label} className={`${col} text-xs font-semibold uppercase tracking-wide text-gray-400`}
                style={{ fontFamily: "'Outfit', sans-serif" }}>
                {label}
              </div>
            ))}
          </div>

          {/* Lignes */}
          {filtered.map((property, index) => (
            <div key={property._id}
              className={`grid grid-cols-12 gap-3 px-5 py-4 items-center hover:bg-gray-50 transition-colors ${
                index < filtered.length - 1 ? 'border-b border-gray-50' : ''
              }`}>

              {/* Bien */}
              <div className="col-span-4 flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: `${BLUE}10` }}>
                  <Home size={15} style={{ color: BLUE }} />
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-gray-900 text-sm truncate"
                    style={{ fontFamily: "'Outfit', sans-serif" }}>
                    {property.title}
                  </p>
                  {property.address?.city && (
                    <p className="text-xs text-gray-400 truncate"
                      style={{ fontFamily: "'Outfit', sans-serif" }}>
                      {property.address.city}
                    </p>
                  )}
                </div>
              </div>

              {/* Propriétaire */}
              <div className="col-span-2 min-w-0">
                <p className="text-sm text-gray-600 truncate"
                  style={{ fontFamily: "'Outfit', sans-serif" }}>
                  {property.user?.name || <span className="text-gray-300">—</span>}
                </p>
              </div>

              {/* Statut */}
              <div className="col-span-2">
                <StatusBadge isApproved={property.isApproved} />
              </div>

              {/* Pôle */}
              <div className="col-span-2">
                {property.pole ? (
                  <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold"
                    style={{
                      background: `${GOLD}12`,
                      color: GOLD,
                      fontFamily: "'Outfit', sans-serif",
                    }}>
                    {property.pole}
                  </span>
                ) : (
                  <span className="text-gray-300 text-sm">—</span>
                )}
              </div>

              {/* Actions */}
              <div className="col-span-2 flex items-center justify-end gap-2">
                {/* Approuver (si en attente) */}
                {!property.isApproved && (
                  <button
                    onClick={() => setConfirm({ type: 'approve', id: property._id })}
                    className="p-2 rounded-xl transition-all hover:scale-105"
                    style={{ background: '#F0FDF4', color: '#16A34A' }}
                    title="Approuver et publier">
                    <ShieldCheck size={14} />
                  </button>
                )}
                {/* Modifier */}
                <Link
                  to={`/propriete/${property._id}/edit`}
                  className="p-2 rounded-xl transition-all hover:scale-105"
                  style={{ background: `${BLUE}12`, color: BLUE }}
                  title="Modifier">
                  <Edit2 size={14} />
                </Link>
                {/* Supprimer */}
                <button
                  onClick={() => setConfirm({ type: 'delete', id: property._id })}
                  className="p-2 rounded-xl transition-all hover:scale-105"
                  style={{ background: '#FEE2E2', color: '#DC2626' }}
                  title="Supprimer">
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}

          {/* Footer */}
          <div className="px-5 py-3 border-t border-gray-100 flex items-center justify-between"
            style={{ background: '#FAFAFA' }}>
            <p className="text-xs text-gray-400" style={{ fontFamily: "'Outfit', sans-serif" }}>
              {filtered.length} bien{filtered.length !== 1 ? 's' : ''} affiché{filtered.length !== 1 ? 's' : ''}
              {pendingCount > 0 && (
                <span style={{ color: '#D97706' }}>
                  {' '}· {pendingCount} en attente
                </span>
              )}
            </p>
            {(search || statusFilter !== 'all') && (
              <button onClick={() => { setSearch(''); setStatus('all'); }}
                className="text-xs font-medium flex items-center gap-1 transition-opacity hover:opacity-70"
                style={{ color: BLUE, fontFamily: "'Outfit', sans-serif" }}>
                <X size={12} /> Réinitialiser
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── Dialogs confirmation ── */}
      {confirm?.type === 'delete' && (
        <ConfirmDialog
          title="Supprimer ce bien ?"
          message="Cette action est irréversible. Le bien sera définitivement supprimé de la plateforme."
          confirmLabel="Supprimer"
          confirmStyle="red"
          onConfirm={handleDelete}
          onCancel={() => setConfirm(null)}
        />
      )}
      {confirm?.type === 'approve' && (
        <ConfirmDialog
          title="Approuver ce bien ?"
          message="Le bien sera publié sur la plateforme et visible par tous les visiteurs."
          confirmLabel="Approuver"
          confirmStyle="blue"
          onConfirm={handleApprove}
          onCancel={() => setConfirm(null)}
        />
      )}
    </div>
  );
};

export default AdminPropertyList;