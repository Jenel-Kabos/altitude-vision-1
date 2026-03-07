import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Users, ShieldCheck, ShieldOff, UserX, RefreshCw,
  Loader2, AlertCircle, CheckCircle, Search,
} from 'lucide-react';
import axios from 'axios';

const BLUE = '#2E7BB5';
const RED  = '#D42B2B';
const GOLD = '#C8872A';

const API_URL = import.meta.env.VITE_API_URL || 'https://altitude-vision.onrender.com/api';
const ENDPOINT = `${API_URL}/admin/owners`;

// ─── Toast ────────────────────────────────────────────────────
const Toast = ({ msg, type, onDone }) => {
  useEffect(() => { const t = setTimeout(onDone, 3500); return () => clearTimeout(t); }, [onDone]);
  const bg = type === 'success' ? '#16A34A' : '#DC2626';
  return (
    <motion.div initial={{ opacity:0, y:-40 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0, y:-40 }}
      className="fixed top-5 right-5 z-[100] px-5 py-3.5 rounded-xl shadow-xl text-white text-sm font-medium"
      style={{ background: bg, fontFamily:"'Outfit', sans-serif" }}>
      {msg}
    </motion.div>
  );
};

// ─── ConfirmDialog ────────────────────────────────────────────
const ConfirmDialog = ({ message, onConfirm, onCancel, variant = 'blue' }) => {
  const accent = variant === 'red' ? RED : variant === 'gold' ? GOLD : BLUE;
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <motion.div initial={{ opacity:0, scale:0.92 }} animate={{ opacity:1, scale:1 }}
        className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6">
        <div className="w-11 h-11 rounded-full flex items-center justify-center mx-auto mb-4"
          style={{ background:`${accent}18` }}>
          <AlertCircle size={22} style={{ color: accent }} />
        </div>
        <p className="text-center text-gray-700 text-sm mb-6 leading-relaxed"
          style={{ fontFamily:"'Outfit', sans-serif" }}>{message}</p>
        <div className="flex gap-3">
          <button onClick={onCancel}
            className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-600 text-sm font-semibold hover:bg-gray-50 transition"
            style={{ fontFamily:"'Outfit', sans-serif" }}>
            Annuler
          </button>
          <button onClick={onConfirm}
            className="flex-1 py-2.5 rounded-xl text-white text-sm font-semibold transition hover:opacity-90"
            style={{ background: accent, fontFamily:"'Outfit', sans-serif" }}>
            Confirmer
          </button>
        </div>
      </motion.div>
    </div>
  );
};

// ─── Avatar initiale ──────────────────────────────────────────
const Avatar = ({ name }) => (
  <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 text-white font-bold text-sm"
    style={{ background:`linear-gradient(135deg, ${BLUE}, ${GOLD})`, fontFamily:"'Outfit', sans-serif" }}>
    {name?.charAt(0).toUpperCase() || 'U'}
  </div>
);

// ─── STATUS BADGE ─────────────────────────────────────────────
const StatusBadge = ({ status }) => {
  const s = status || 'Actif';
  const map = {
    'Actif':    { bg:'#16A34A15', color:'#16A34A' },
    'active':   { bg:'#16A34A15', color:'#16A34A' },
    'Suspendu': { bg:`${GOLD}18`,  color: GOLD      },
    'Banni':    { bg:`${RED}15`,   color: RED        },
    'Supprimé': { bg:'#64748B15', color:'#64748B'  },
  };
  const { bg, color } = map[s] || map['Actif'];
  return (
    <span className="text-xs font-semibold px-2.5 py-1 rounded-full"
      style={{ background: bg, color, fontFamily:"'Outfit', sans-serif" }}>
      {s === 'active' ? 'Actif' : s}
    </span>
  );
};

// ─── KYC BADGE ───────────────────────────────────────────────
const KycBadge = ({ verified }) => verified ? (
  <span className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full"
    style={{ background:`${BLUE}15`, color:BLUE, fontFamily:"'Outfit', sans-serif" }}>
    <CheckCircle size={11} /> Vérifié
  </span>
) : (
  <span className="text-xs font-semibold px-2.5 py-1 rounded-full"
    style={{ background:'#94A3B815', color:'#94A3B8', fontFamily:"'Outfit', sans-serif" }}>
    Non vérifié
  </span>
);

// ─── ACTION BUTTON ────────────────────────────────────────────
const ActionBtn = ({ label, color, onClick }) => (
  <button onClick={onClick}
    className="text-xs font-semibold px-3 py-1.5 rounded-lg border transition hover:opacity-80"
    style={{
      color, borderColor:`${color}40`,
      background:`${color}0A`,
      fontFamily:"'Outfit', sans-serif",
    }}>
    {label}
  </button>
);

// ─── ACTION CONFIG ────────────────────────────────────────────
const ACTION_META = {
  verify:   { label:'Vérifier KYC',         variant:'blue', color:BLUE, msg:'Marquer ce propriétaire comme vérifié ?' },
  suspend:  { label:'Suspendre le compte',   variant:'gold', color:GOLD, msg:'Suspendre le compte de cet utilisateur ?' },
  activate: { label:'Réactiver le compte',   variant:'blue', color:BLUE, msg:'Réactiver le compte de cet utilisateur ?' },
  delete:   { label:"Supprimer l'utilisateur",variant:'red', color:RED,  msg:"Supprimer définitivement cet utilisateur ? Action irréversible." },
};

// ─── MAIN ────────────────────────────────────────────────────
const UsersPanel = () => {
  const [users, setUsers]           = useState([]);
  const [filtered, setFiltered]     = useState([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [search, setSearch]         = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const [confirm, setConfirm]       = useState(null);
  const [toast, setToast]           = useState(null);

  const showToast = (msg, type = 'success') => setToast({ msg, type });

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(ENDPOINT, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = res.data.data?.owners || res.data.data?.users || [];
      setUsers(data);
      setFiltered(data);
      setError(null);
    } catch {
      setError('Impossible de charger les utilisateurs.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchUsers(); }, []);

  useEffect(() => {
    if (!search.trim()) { setFiltered(users); return; }
    const q = search.toLowerCase();
    setFiltered(users.filter(u =>
      u.name?.toLowerCase().includes(q) ||
      u.email?.toLowerCase().includes(q)
    ));
  }, [search, users]);

  const triggerAction = (user, actionType) => {
    const meta = ACTION_META[actionType];
    setConfirm({
      message: `${meta.msg}\n\nUtilisateur : ${user.name}`,
      variant: meta.variant,
      onConfirm: async () => {
        setConfirm(null);
        setActionLoading(true);
        try {
          const token = localStorage.getItem('token');
          const url = actionType === 'delete'
            ? `${ENDPOINT}/${user._id}`
            : `${ENDPOINT}/${user._id}/${actionType}`;
          await axios({
            url,
            method: actionType === 'delete' ? 'delete' : 'patch',
            data: {},
            headers: { Authorization: `Bearer ${token}` },
          });
          showToast(`Action réalisée : ${meta.label}.`);
          await fetchUsers();
        } catch (err) {
          showToast(err.response?.data?.message || "Erreur lors de l'action.", 'error');
        } finally {
          setActionLoading(false);
        }
      },
    });
  };

  if (loading) return (
    <div className="flex items-center justify-center min-h-64">
      <Loader2 size={36} className="animate-spin" style={{ color: BLUE }} />
    </div>
  );

  if (error) return (
    <div className="p-6">
      <div className="flex items-center gap-3 p-4 rounded-xl border"
        style={{ background:`${RED}08`, borderColor:`${RED}30` }}>
        <AlertCircle size={20} style={{ color: RED }} />
        <p className="text-sm" style={{ color: RED, fontFamily:"'Outfit', sans-serif" }}>{error}</p>
      </div>
    </div>
  );

  return (
    <div className="p-6 space-y-6">
      <AnimatePresence>
        {toast && <Toast msg={toast.msg} type={toast.type} onDone={() => setToast(null)} />}
      </AnimatePresence>

      {confirm && (
        <ConfirmDialog
          message={confirm.message}
          variant={confirm.variant}
          onConfirm={confirm.onConfirm}
          onCancel={() => setConfirm(null)}
        />
      )}

      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background:`${BLUE}18` }}>
            <Users size={22} style={{ color: BLUE }} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900"
              style={{ fontFamily:"'Cormorant Garamond', serif" }}>
              Gestion des Propriétaires
            </h1>
            <p className="text-xs text-gray-400" style={{ fontFamily:"'Outfit', sans-serif" }}>
              {users.length} propriétaire{users.length !== 1 ? 's' : ''} enregistré{users.length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>

        <button onClick={fetchUsers} disabled={actionLoading}
          className="flex items-center gap-2 text-sm font-semibold px-4 py-2 rounded-xl border transition hover:bg-white disabled:opacity-50"
          style={{ borderColor:`${BLUE}30`, color:BLUE, fontFamily:"'Outfit', sans-serif" }}>
          <RefreshCw size={14} className={actionLoading ? 'animate-spin' : ''} />
          Actualiser
        </button>
      </div>

      {/* Stat pills */}
      <div className="flex flex-wrap gap-3">
        {[
          { label:'Total',         value: users.length,                                     color:'#7C3AED' },
          { label:'Vérifiés',      value: users.filter(u => u.isVerified).length,            color: BLUE    },
          { label:'Actifs',        value: users.filter(u => !u.status || u.status === 'Actif' || u.status === 'active').length, color:'#16A34A' },
          { label:'Suspendus',     value: users.filter(u => u.status === 'Suspendu').length, color: GOLD    },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-white rounded-2xl border border-gray-100 shadow-sm px-5 py-3 flex items-center gap-3">
            <span className="text-2xl font-extrabold" style={{ color, fontFamily:"'Outfit', sans-serif" }}>
              {value}
            </span>
            <span className="text-xs font-semibold uppercase tracking-wide text-gray-400"
              style={{ fontFamily:"'Outfit', sans-serif" }}>{label}</span>
          </div>
        ))}
      </div>

      {/* Barre de recherche */}
      <div className="relative w-full sm:w-72">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          onFocus={() => setSearchFocused(true)}
          onBlur={() => setSearchFocused(false)}
          placeholder="Rechercher nom, email…"
          className="w-full pl-8 pr-4 py-2 text-sm rounded-xl border outline-none transition-all"
          style={{
            fontFamily:"'Outfit', sans-serif",
            borderColor: searchFocused ? BLUE : '#E2E8F0',
            boxShadow:   searchFocused ? `0 0 0 3px ${BLUE}20` : 'none',
          }} />
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <table className="min-w-full">
          <thead style={{ background:'#F8FAFC' }}>
            <tr>
              {['Nom','Email','Statut','KYC','Actions'].map(h => (
                <th key={h} className={`px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide ${
                  h === 'Nom' || h === 'Email' ? 'text-left' : 'text-center'
                }`} style={{ fontFamily:"'Outfit', sans-serif" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            <AnimatePresence>
              {filtered.map((user, i) => {
                const isActive = !user.status || user.status === 'Actif' || user.status === 'active';
                return (
                  <motion.tr key={user._id}
                    initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}
                    transition={{ delay: i * 0.03 }}
                    className="border-t border-gray-50 hover:bg-gray-50 transition-colors">

                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2.5">
                        <Avatar name={user.name} />
                        <span className="font-semibold text-gray-800 text-sm"
                          style={{ fontFamily:"'Outfit', sans-serif" }}>{user.name}</span>
                      </div>
                    </td>

                    <td className="px-5 py-3.5 text-sm text-gray-500"
                      style={{ fontFamily:"'Outfit', sans-serif" }}>{user.email}</td>

                    <td className="px-5 py-3.5 text-center">
                      <StatusBadge status={user.status} />
                    </td>

                    <td className="px-5 py-3.5 text-center">
                      <KycBadge verified={user.isVerified} />
                    </td>

                    <td className="px-5 py-3.5">
                      <div className="flex items-center justify-center gap-1.5 flex-wrap">
                        {!user.isVerified && (
                          <ActionBtn label="Vérifier" color={BLUE}
                            onClick={() => triggerAction(user, 'verify')} />
                        )}
                        {isActive ? (
                          <ActionBtn label="Suspendre" color={GOLD}
                            onClick={() => triggerAction(user, 'suspend')} />
                        ) : (
                          <ActionBtn label="Réactiver" color="#16A34A"
                            onClick={() => triggerAction(user, 'activate')} />
                        )}
                        <ActionBtn label="Supprimer" color={RED}
                          onClick={() => triggerAction(user, 'delete')} />
                      </div>
                    </td>
                  </motion.tr>
                );
              })}
            </AnimatePresence>
          </tbody>
        </table>

        {filtered.length === 0 && (
          <div className="py-16 text-center">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-3"
              style={{ background:`${BLUE}12` }}>
              <Users size={22} style={{ color:BLUE }} />
            </div>
            <p className="font-semibold text-gray-500 text-sm"
              style={{ fontFamily:"'Outfit', sans-serif" }}>
              Aucun propriétaire{search ? ' correspondant à la recherche' : ' enregistré'}
            </p>
            {search && (
              <button onClick={() => setSearch('')}
                className="mt-3 text-xs font-semibold px-4 py-1.5 rounded-full"
                style={{ background:`${BLUE}15`, color:BLUE, fontFamily:"'Outfit', sans-serif" }}>
                Réinitialiser
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default UsersPanel;