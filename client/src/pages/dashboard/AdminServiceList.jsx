import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Sparkles, Plus, Edit2, Trash2, Search, Loader2, AlertCircle,
  Tag, DollarSign, ChevronRight, X,
} from 'lucide-react';
import api from '../../services/api';

const BLUE = '#2E7BB5';
const GOLD = '#C8872A';
const RED  = '#D42B2B';

// ─────────────────────────────────────────────────────────────
// Dialog de confirmation
// ─────────────────────────────────────────────────────────────
const ConfirmDialog = ({ message, onConfirm, onCancel }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
    <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 text-center">
      <div className="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-4"
        style={{ background: '#FEE2E2' }}>
        <AlertCircle size={22} className="text-red-500" />
      </div>
      <h3 className="font-bold text-gray-900 mb-2"
        style={{ fontFamily: "'Outfit', sans-serif" }}>Confirmation</h3>
      <p className="text-sm text-gray-500 mb-6">{message}</p>
      <div className="flex gap-3">
        <button onClick={onCancel}
          className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 transition-all"
          style={{ fontFamily: "'Outfit', sans-serif" }}>
          Annuler
        </button>
        <button onClick={onConfirm}
          className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white transition-all hover:scale-105"
          style={{ background: 'linear-gradient(135deg,#B91C1C,#DC2626)', fontFamily: "'Outfit', sans-serif" }}>
          Supprimer
        </button>
      </div>
    </div>
  </div>
);

// ─────────────────────────────────────────────────────────────
// Notification toast inline
// ─────────────────────────────────────────────────────────────
const InlineNotif = ({ message, type, onClose }) => (
  <div className="flex items-center gap-3 px-4 py-3 rounded-xl mb-4 text-sm font-medium"
    style={{
      background: type === 'error' ? '#FEF2F2' : '#F0FDF4',
      color:      type === 'error' ? '#DC2626' : '#16A34A',
      border:     `1px solid ${type === 'error' ? '#FCA5A5' : '#86EFAC'}`,
      fontFamily: "'Outfit', sans-serif",
    }}>
    <span className="flex-1">{message}</span>
    <button onClick={onClose} className="opacity-60 hover:opacity-100 transition-opacity">
      <X size={14} />
    </button>
  </div>
);

// ─────────────────────────────────────────────────────────────
const AdminServiceList = () => {
  const [services, setServices]   = useState([]);
  const [filtered, setFiltered]   = useState([]);
  const [loading, setLoading]     = useState(true);
  const [search, setSearch]       = useState('');
  const [notif, setNotif]         = useState(null);   // { message, type }
  const [confirm, setConfirm]     = useState(null);   // { id }
  const navigate = useNavigate();

  const showNotif = (message, type = 'success') => {
    setNotif({ message, type });
    setTimeout(() => setNotif(null), 4000);
  };

  const fetchServices = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/services');
      setServices(data);
      setFiltered(data);
    } catch {
      showNotif('Impossible de charger la liste des services.', 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchServices(); }, [fetchServices]);

  useEffect(() => {
    if (!search.trim()) { setFiltered(services); return; }
    const q = search.toLowerCase();
    setFiltered(services.filter(s =>
      s.name?.toLowerCase().includes(q) ||
      s.category?.toLowerCase().includes(q)
    ));
  }, [search, services]);

  const handleDelete = async () => {
    if (!confirm) return;
    try {
      await api.delete(`/services/${confirm.id}`);
      showNotif('Service supprimé avec succès.');
      setServices(prev => prev.filter(s => s._id !== confirm.id));
    } catch {
      showNotif('Erreur lors de la suppression.', 'error');
    } finally {
      setConfirm(null);
    }
  };

  const formatPrice = (price) =>
    new Intl.NumberFormat('fr-FR', {
      style: 'currency', currency: 'XAF', maximumFractionDigits: 0,
    }).format(price || 0);

  return (
    <div className="max-w-5xl mx-auto">

      {/* ── En-tête ── */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: `${GOLD}18` }}>
            <Sparkles size={20} style={{ color: GOLD }} />
          </div>
          <div>
            <h2 className="font-bold text-gray-900 text-lg"
              style={{ fontFamily: "'Outfit', sans-serif" }}>
              Gestion des Services
            </h2>
            <p className="text-xs text-gray-400"
              style={{ fontFamily: "'Outfit', sans-serif" }}>
              {services.length} service{services.length !== 1 ? 's' : ''} configuré{services.length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>

        <button onClick={() => navigate('/admin/services/creer')}
          className="flex items-center gap-2 px-4 py-2.5 text-white text-sm font-semibold rounded-xl transition-all hover:scale-105"
          style={{
            background: `linear-gradient(135deg, #A06820, ${GOLD})`,
            boxShadow:  `0 4px 16px ${GOLD}35`,
            fontFamily: "'Outfit', sans-serif",
          }}>
          <Plus size={16} /> Ajouter un service
        </button>
      </div>

      {/* ── Notification ── */}
      {notif && (
        <InlineNotif message={notif.message} type={notif.type} onClose={() => setNotif(null)} />
      )}

      {/* ── Barre de recherche ── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 mb-5">
        <div className="relative">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Rechercher par nom ou catégorie…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-xl outline-none transition-all"
            style={{ fontFamily: "'Outfit', sans-serif" }}
            onFocus={e => { e.target.style.borderColor = BLUE; e.target.style.boxShadow = `0 0 0 3px ${BLUE}18`; }}
            onBlur={e  => { e.target.style.borderColor = '#E2E8F0'; e.target.style.boxShadow = 'none'; }}
          />
        </div>
      </div>

      {/* ── Contenu ── */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="text-center">
            <Loader2 size={32} className="animate-spin mx-auto mb-3" style={{ color: GOLD }} />
            <p className="text-sm text-gray-400" style={{ fontFamily: "'Outfit', sans-serif" }}>
              Chargement des services…
            </p>
          </div>
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 bg-white rounded-2xl border-2 border-dashed border-gray-200">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4"
            style={{ background: `${GOLD}12` }}>
            <Sparkles size={24} style={{ color: GOLD }} />
          </div>
          <p className="font-semibold text-gray-600 mb-1"
            style={{ fontFamily: "'Outfit', sans-serif" }}>
            {search ? 'Aucun résultat' : 'Aucun service configuré'}
          </p>
          <p className="text-sm text-gray-400 mb-5"
            style={{ fontFamily: "'Outfit', sans-serif" }}>
            {search
              ? `Aucun service ne correspond à "${search}".`
              : 'Commencez par ajouter votre premier service.'}
          </p>
          {!search && (
            <button onClick={() => navigate('/admin/services/creer')}
              className="flex items-center gap-2 px-5 py-2.5 text-white text-sm font-semibold rounded-xl transition-all hover:scale-105"
              style={{ background: `linear-gradient(135deg, #A06820, ${GOLD})`, fontFamily: "'Outfit', sans-serif" }}>
              <Plus size={16} /> Ajouter un service
            </button>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          {/* Header tableau */}
          <div className="grid grid-cols-12 gap-4 px-5 py-3 border-b border-gray-100"
            style={{ background: '#F8FAFC' }}>
            {[
              { label: 'Nom du Service', col: 'col-span-4' },
              { label: 'Catégorie',      col: 'col-span-3' },
              { label: 'Prix de base',   col: 'col-span-3' },
              { label: 'Actions',        col: 'col-span-2 text-right' },
            ].map(({ label, col }) => (
              <div key={label} className={`${col} text-xs font-semibold uppercase tracking-wide text-gray-400`}
                style={{ fontFamily: "'Outfit', sans-serif" }}>
                {label}
              </div>
            ))}
          </div>

          {/* Lignes */}
          {filtered.map((service, index) => (
            <div key={service._id}
              className={`grid grid-cols-12 gap-4 px-5 py-4 items-center hover:bg-gray-50 transition-colors ${
                index < filtered.length - 1 ? 'border-b border-gray-50' : ''
              }`}>

              {/* Nom */}
              <div className="col-span-4 flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: `${GOLD}12` }}>
                  <Sparkles size={14} style={{ color: GOLD }} />
                </div>
                <span className="font-semibold text-gray-900 text-sm truncate"
                  style={{ fontFamily: "'Outfit', sans-serif" }}>
                  {service.name || service.title || '—'}
                </span>
              </div>

              {/* Catégorie */}
              <div className="col-span-3">
                {service.category ? (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold"
                    style={{ background: `${BLUE}12`, color: BLUE, fontFamily: "'Outfit', sans-serif" }}>
                    <Tag size={10} />
                    {service.category}
                  </span>
                ) : (
                  <span className="text-gray-400 text-sm">—</span>
                )}
              </div>

              {/* Prix */}
              <div className="col-span-3 flex items-center gap-1.5">
                <DollarSign size={13} className="text-green-500 flex-shrink-0" />
                <span className="font-bold text-sm text-gray-800"
                  style={{ fontFamily: "'Outfit', sans-serif" }}>
                  {formatPrice(service.basePrice ?? service.price)}
                </span>
              </div>

              {/* Actions */}
              <div className="col-span-2 flex items-center justify-end gap-2">
                <button
                  onClick={() => navigate(`/admin/services/${service._id}/edit`)}
                  className="p-2 rounded-xl text-xs font-semibold transition-all hover:scale-105"
                  style={{ background: `${BLUE}12`, color: BLUE }}
                  title="Modifier">
                  <Edit2 size={14} />
                </button>
                <button
                  onClick={() => setConfirm({ id: service._id })}
                  className="p-2 rounded-xl text-xs font-semibold transition-all hover:scale-105"
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
              {filtered.length} service{filtered.length !== 1 ? 's' : ''}
              {search && ` trouvé${filtered.length !== 1 ? 's' : ''} pour "${search}"`}
            </p>
            {search && (
              <button onClick={() => setSearch('')}
                className="text-xs font-medium flex items-center gap-1 transition-opacity hover:opacity-70"
                style={{ color: BLUE, fontFamily: "'Outfit', sans-serif" }}>
                <X size={12} /> Effacer la recherche
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── Dialog confirmation ── */}
      {confirm && (
        <ConfirmDialog
          message="Voulez-vous vraiment supprimer ce service ? Cette action est irréversible."
          onConfirm={handleDelete}
          onCancel={() => setConfirm(null)}
        />
      )}
    </div>
  );
};

export default AdminServiceList;