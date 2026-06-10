"use client";

import React, { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../context/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Users, ShieldCheck, RefreshCw, Loader2, AlertCircle,
  Search, Plus, Pencil, Trash2, X, Check, Copy, Eye, EyeOff,
  ChevronDown, Clock,
} from 'lucide-react';
import { getAllUsers, updateUserRole, createUserByAdmin, deleteAdminUser } from '../../services/userService';
import axios from 'axios';

const BLUE = '#2E7BB5';
const RED  = '#D42B2B';
const GOLD = '#C8872A';
const GREEN = '#16A34A';
const GRAY  = '#94A3B8';
const FONT  = "'Outfit', sans-serif";

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://altitude-vision.onrender.com/api';

// ── Helpers ───────────────────────────────────────────────────
const ROLE_META = {
  Admin:         { label: 'Admin',         color: RED,    bg: `${RED}15`,   emoji: '🔴' },
  Collaborateur: { label: 'Collaborateur', color: GOLD,   bg: `${GOLD}15`,  emoji: '🟡' },
  User:          { label: 'Utilisateur',   color: GRAY,   bg: `${GRAY}15`,  emoji: '⚪' },
  Proprietaire:  { label: 'Propriétaire',  color: GREEN,  bg: `${GREEN}15`, emoji: '🏠' },
  Client:        { label: 'Client',        color: '#7C3AED', bg:'#7C3AED15', emoji: '🧑' },
  Prestataire:   { label: 'Prestataire',   color: '#0891B2', bg:'#0891B215', emoji: '🔧' },
};

const RoleBadge = ({ role }) => {
  const m = ROLE_META[role] || { label: role, color: GRAY, bg: `${GRAY}15`, emoji: '👤' };
  return (
    <span className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full"
      style={{ color: m.color, background: m.bg, fontFamily: FONT }}>
      {m.emoji} {m.label}
    </span>
  );
};

const Avatar = ({ name }) => (
  <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-white text-sm font-bold"
    style={{ background: `linear-gradient(135deg,${BLUE},${GOLD})`, fontFamily: FONT }}>
    {name?.charAt(0).toUpperCase() || 'U'}
  </div>
);

const StatusBadge = ({ status }) => {
  const map = {
    'Actif':    { bg:'#16A34A15', color:'#16A34A' },
    'active':   { bg:'#16A34A15', color:'#16A34A' },
    'Suspendu': { bg:`${GOLD}18`,  color: GOLD     },
    'Banni':    { bg:`${RED}15`,   color: RED      },
  };
  const s = status || 'Actif';
  const { bg, color } = map[s] || map['Actif'];
  return (
    <span className="text-xs font-semibold px-2 py-0.5 rounded-full"
      style={{ background: bg, color, fontFamily: FONT }}>
      {s === 'active' ? 'Actif' : s}
    </span>
  );
};

// ── Toast ─────────────────────────────────────────────────────
const Toast = ({ msg, type, onDone }) => {
  useEffect(() => { const t = setTimeout(onDone, 3500); return () => clearTimeout(t); }, [onDone]);
  return (
    <motion.div initial={{ opacity:0, y:-40 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0, y:-40 }}
      className="fixed top-5 right-5 z-[200] px-5 py-3.5 rounded-xl shadow-xl text-white text-sm font-medium"
      style={{ background: type === 'success' ? GREEN : type === 'warning' ? GOLD : RED, fontFamily: FONT }}>
      {msg}
    </motion.div>
  );
};

// ── Confirm Dialog ────────────────────────────────────────────
const ConfirmDialog = ({ user: target, onConfirm, onCancel }) => (
  <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
    <motion.div initial={{ opacity:0, scale:0.93 }} animate={{ opacity:1, scale:1 }}
      className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6">
      <div className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4"
        style={{ background:`${RED}15` }}>
        <AlertCircle size={22} style={{ color:RED }} />
      </div>
      <h3 className="font-bold text-gray-900 text-center mb-1" style={{ fontFamily:FONT }}>
        ⚠️ Supprimer ce compte ?
      </h3>
      <div className="text-sm text-gray-500 text-center mt-3 space-y-1" style={{ fontFamily:FONT }}>
        <p><strong className="text-gray-800">{target.name}</strong></p>
        <p>{target.email}</p>
        <p><RoleBadge role={target.role} /></p>
      </div>
      <p className="text-xs text-center text-gray-400 mt-3 mb-5" style={{ fontFamily:FONT }}>
        Cette action est irréversible.
      </p>
      <div className="flex gap-3">
        <button onClick={onCancel}
          className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-600 text-sm font-semibold hover:bg-gray-50 transition"
          style={{ fontFamily:FONT }}>
          Annuler
        </button>
        <button onClick={onConfirm}
          className="flex-1 py-2.5 rounded-xl text-white text-sm font-semibold transition hover:opacity-90"
          style={{ background: RED, fontFamily:FONT }}>
          Confirmer la suppression
        </button>
      </div>
    </motion.div>
  </div>
);

// ── Edit Role Modal ───────────────────────────────────────────
const EDITABLE_ROLES = [
  { role:'Admin',         emoji:'🔴', desc:'Accès complet',           color:RED  },
  { role:'Collaborateur', emoji:'🟡', desc:'Peut ajouter seulement',  color:GOLD },
  { role:'User',          emoji:'⚪', desc:'Accès limité',            color:GRAY },
];

const EditRoleModal = ({ user: target, onConfirm, onCancel, loading }) => {
  const [selected, setSelected] = useState(target.role);

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <motion.div initial={{ opacity:0, scale:0.93 }} animate={{ opacity:1, scale:1 }}
        className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-bold text-gray-900 text-base" style={{ fontFamily:FONT }}>
            Modifier le rôle de {target.name}
          </h3>
          <button onClick={onCancel} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400">
            <X size={16} />
          </button>
        </div>

        <p className="text-xs text-gray-400 mb-1" style={{ fontFamily:FONT }}>Rôle actuel</p>
        <div className="mb-4"><RoleBadge role={target.role} /></div>

        <p className="text-xs font-semibold text-gray-600 mb-3" style={{ fontFamily:FONT }}>Nouveau rôle</p>
        <div className="grid grid-cols-3 gap-2 mb-5">
          {EDITABLE_ROLES.map(({ role, emoji, desc, color }) => (
            <button key={role} onClick={() => setSelected(role)}
              className="flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-all text-center"
              style={{
                borderColor: selected === role ? color : '#E2E8F0',
                background:  selected === role ? `${color}10` : 'white',
              }}>
              <span className="text-xl">{emoji}</span>
              <span className="text-xs font-bold" style={{ color: selected===role?color:'#374151', fontFamily:FONT }}>{role}</span>
              <span className="text-xs text-gray-400" style={{ fontFamily:FONT }}>{desc}</span>
            </button>
          ))}
        </div>

        <div className="flex items-start gap-2 p-3 rounded-xl mb-4"
          style={{ background:'#FFFBEB', border:'1px solid #FCD34D' }}>
          <AlertCircle size={14} className="flex-shrink-0 mt-0.5" style={{ color:'#D97706' }}/>
          <p className="text-xs" style={{ color:'#92400E', fontFamily:FONT }}>
            Cette action prend effet immédiatement.
          </p>
        </div>

        <div className="flex gap-3">
          <button onClick={onCancel}
            className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-600 text-sm font-semibold hover:bg-gray-50 transition"
            style={{ fontFamily:FONT }}>
            Annuler
          </button>
          <button onClick={() => onConfirm(selected)} disabled={loading || selected === target.role}
            className="flex-1 py-2.5 rounded-xl text-white text-sm font-semibold transition hover:opacity-90 disabled:opacity-50"
            style={{ background: BLUE, fontFamily:FONT }}>
            {loading ? <Loader2 size={14} className="animate-spin mx-auto" /> : 'Confirmer'}
          </button>
        </div>
      </motion.div>
    </div>
  );
};

// ── Create User Modal ─────────────────────────────────────────
const generatePassword = () => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%';
  return Array.from({ length: 10 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
};

const CreateUserModal = ({ onConfirm, onCancel, loading }) => {
  const [form, setForm] = useState({
    prenom:'', nom:'', email:'', telephone:'', password:'', role:'Admin', sendWelcomeEmail:true,
  });
  const [showPass, setShowPass] = useState(false);
  const [copied, setCopied] = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const copyPassword = () => {
    navigator.clipboard.writeText(form.password).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const inputCls = "w-full px-3 py-2 text-sm text-gray-900 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-200 bg-gray-50";

  return (
    <div className="fixed inset-0 z-[150] flex items-start justify-center p-4 bg-black/50 backdrop-blur-sm overflow-y-auto">
      <motion.div initial={{ opacity:0, scale:0.93 }} animate={{ opacity:1, scale:1 }}
        className="bg-white rounded-2xl shadow-2xl max-w-md w-full my-8 p-6">
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-bold text-gray-900 text-base" style={{ fontFamily:FONT }}>
            Créer un nouveau compte
          </h3>
          <button onClick={onCancel} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400">
            <X size={16} />
          </button>
        </div>

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1" style={{ fontFamily:FONT }}>
                Prénom <span className="text-red-400">*</span>
              </label>
              <input className={inputCls} value={form.prenom} onChange={e => set('prenom', e.target.value)}
                placeholder="Jean" style={{ fontFamily:FONT }} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1" style={{ fontFamily:FONT }}>
                Nom <span className="text-red-400">*</span>
              </label>
              <input className={inputCls} value={form.nom} onChange={e => set('nom', e.target.value)}
                placeholder="Dupont" style={{ fontFamily:FONT }} />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1" style={{ fontFamily:FONT }}>
              Email <span className="text-red-400">*</span>
            </label>
            <input className={inputCls} type="email" value={form.email}
              onChange={e => set('email', e.target.value)} placeholder="jean@email.com"
              style={{ fontFamily:FONT }} />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1" style={{ fontFamily:FONT }}>
              Téléphone
            </label>
            <input className={inputCls} value={form.telephone}
              onChange={e => set('telephone', e.target.value)} placeholder="+242 06 123 4567"
              style={{ fontFamily:FONT }} />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-semibold text-gray-600" style={{ fontFamily:FONT }}>
                Mot de passe <span className="text-red-400">*</span>
              </label>
              <button type="button" onClick={() => set('password', generatePassword())}
                className="text-xs font-semibold hover:underline"
                style={{ color:BLUE, fontFamily:FONT }}>
                ⚡ Générer
              </button>
            </div>
            <div className="relative flex items-center">
              <input className={`${inputCls} pr-20`}
                type={showPass ? 'text' : 'password'}
                value={form.password}
                onChange={e => set('password', e.target.value)}
                placeholder="Min. 8 caractères"
                style={{ fontFamily:FONT }} />
              <div className="absolute right-2 flex items-center gap-1">
                {form.password && (
                  <button type="button" onClick={copyPassword}
                    className="p-1 rounded text-gray-400 hover:text-green-600 transition-colors">
                    {copied ? <Check size={13} style={{ color:GREEN }}/> : <Copy size={13}/>}
                  </button>
                )}
                <button type="button" onClick={() => setShowPass(s => !s)}
                  className="p-1 rounded text-gray-400 hover:text-gray-600 transition-colors">
                  {showPass ? <EyeOff size={13}/> : <Eye size={13}/>}
                </button>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-2" style={{ fontFamily:FONT }}>
              Rôle <span className="text-red-400">*</span>
            </label>
            <div className="grid grid-cols-2 gap-2">
              {[
                { role:'Admin',         emoji:'🔴', desc:'Accès complet',          color:RED  },
                { role:'Collaborateur', emoji:'🟡', desc:'Peut ajouter seulement', color:GOLD },
              ].map(({ role, emoji, desc, color }) => (
                <button key={role} type="button" onClick={() => set('role', role)}
                  className="flex flex-col items-center gap-1 p-3 rounded-xl border-2 transition-all"
                  style={{
                    borderColor: form.role === role ? color : '#E2E8F0',
                    background:  form.role === role ? `${color}10` : 'white',
                  }}>
                  <span className="text-xl">{emoji}</span>
                  <span className="text-xs font-bold" style={{ color: form.role===role?color:'#374151', fontFamily:FONT }}>{role}</span>
                  <span className="text-xs text-gray-400" style={{ fontFamily:FONT }}>{desc}</span>
                </button>
              ))}
            </div>
          </div>

          <label className="flex items-center gap-2.5 cursor-pointer select-none">
            <input type="checkbox" checked={form.sendWelcomeEmail}
              onChange={e => set('sendWelcomeEmail', e.target.checked)}
              className="rounded accent-blue-500 w-4 h-4" />
            <span className="text-sm text-gray-700" style={{ fontFamily:FONT }}>
              ☑️ Envoyer les identifiants par email
            </span>
          </label>
        </div>

        <div className="flex gap-3 mt-6">
          <button onClick={onCancel}
            className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-600 text-sm font-semibold hover:bg-gray-50 transition"
            style={{ fontFamily:FONT }}>
            Annuler
          </button>
          <button onClick={() => onConfirm(form)} disabled={loading}
            className="flex-1 py-2.5 rounded-xl text-white text-sm font-semibold transition hover:opacity-90 disabled:opacity-50"
            style={{ background: BLUE, fontFamily:FONT }}>
            {loading ? <Loader2 size={14} className="animate-spin mx-auto" /> : 'Créer le compte'}
          </button>
        </div>
      </motion.div>
    </div>
  );
};

// ── User Detail Modal ─────────────────────────────────────────
const UserDetailModal = ({ user: target, onClose }) => {
  const historique = target.historiqueRoles || [];
  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <motion.div initial={{ opacity:0, scale:0.93 }} animate={{ opacity:1, scale:1 }}
        className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <Avatar name={target.name} />
            <div>
              <p className="font-bold text-gray-900 text-sm" style={{ fontFamily:FONT }}>{target.name}</p>
              <p className="text-xs text-gray-400" style={{ fontFamily:FONT }}>{target.email}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400">
            <X size={16} />
          </button>
        </div>

        <div className="flex gap-2 mb-4">
          <RoleBadge role={target.role} />
          <StatusBadge status={target.status} />
        </div>

        <div className="flex-1 overflow-y-auto">
          <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3"
            style={{ fontFamily:FONT }}>
            Historique des accès
          </p>
          {historique.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-6" style={{ fontFamily:FONT }}>
              Aucun historique disponible.
            </p>
          ) : (
            <div className="space-y-2">
              {[...historique].reverse().map((h, i) => (
                <div key={i} className="flex items-start gap-3 p-3 rounded-xl bg-gray-50">
                  <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0"
                    style={{ background:`${BLUE}15` }}>
                    <Clock size={12} style={{ color:BLUE }}/>
                  </div>
                  <div>
                    <p className="text-sm text-gray-800" style={{ fontFamily:FONT }}>
                      {h.note || `Rôle changé : ${h.ancienRole} → ${h.nouveauRole}`}
                    </p>
                    {h.changedBy?.name && (
                      <p className="text-xs text-gray-400" style={{ fontFamily:FONT }}>
                        par {h.changedBy.name}
                      </p>
                    )}
                    {h.date && (
                      <p className="text-xs text-gray-400" style={{ fontFamily:FONT }}>
                        {new Date(h.date).toLocaleDateString('fr-FR', { day:'2-digit', month:'2-digit', year:'numeric' })}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════
// COMPOSANT PRINCIPAL
// ═══════════════════════════════════════════════════════════════
const FILTER_TABS = [
  { id:'all',           label:'Tous'          },
  { id:'Admin',         label:'Admins'        },
  { id:'Collaborateur', label:'Collaborateurs'},
  { id:'User',          label:'Utilisateurs'  },
  { id:'Proprietaire',  label:'Propriétaires' },
];

const UsersPanel = () => {
  const { isAdmin, user: me } = useAuth();
  const router = useRouter();

  const [users,         setUsers]         = useState([]);
  const [filtered,      setFiltered]      = useState([]);
  const [loading,       setLoading]       = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error,         setError]         = useState(null);
  const [search,        setSearch]        = useState('');
  const [filterTab,     setFilterTab]     = useState('all');
  const [toast,         setToast]         = useState(null);
  const [confirm,       setConfirm]       = useState(null); // user to delete
  const [editRole,      setEditRole]      = useState(null); // user to edit role
  const [createModal,   setCreateModal]   = useState(false);
  const [detailUser,    setDetailUser]    = useState(null);

  const showToast = (msg, type = 'success') => setToast({ msg, type });

  useEffect(() => {
    if (isAdmin === false) {
      setTimeout(() => router.push('/dashboard'), 1500);
    }
  }, [isAdmin, router]);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getAllUsers();
      setUsers(Array.isArray(data) ? data : []);
      setError(null);
    } catch {
      setError('Impossible de charger les utilisateurs.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  useEffect(() => {
    let list = [...users];
    if (filterTab !== 'all') {
      if (filterTab === 'User') {
        list = list.filter(u => u.role === 'User' || u.role === 'Client');
      } else {
        list = list.filter(u => u.role === filterTab);
      }
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(u =>
        u.name?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q)
      );
    }
    setFiltered(list);
  }, [users, filterTab, search]);

  // ── Actions ────────────────────────────────────────────────
  const handleVerify = async (user) => {
    setActionLoading(true);
    try {
      const token = localStorage.getItem('token');
      await axios.patch(`${API_URL}/admin/owners/${user._id}/verify`, {}, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setUsers(prev => prev.map(u => u._id === user._id ? { ...u, isVerified: true } : u));
      showToast('Propriétaire vérifié.');
    } catch (err) {
      showToast(err.response?.data?.message || 'Erreur', 'error');
    } finally { setActionLoading(false); }
  };

  const handleSuspendActivate = async (user) => {
    setActionLoading(true);
    const isActive = !user.status || user.status === 'Actif' || user.status === 'active';
    try {
      const token = localStorage.getItem('token');
      await axios.patch(`${API_URL}/admin/owners/${user._id}/${isActive ? 'suspend' : 'activate'}`, {}, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setUsers(prev => prev.map(u => u._id === user._id ? { ...u, status: isActive ? 'Suspendu' : 'Actif' } : u));
      showToast(isActive ? 'Compte suspendu.' : 'Compte réactivé.');
    } catch (err) {
      showToast(err.response?.data?.message || 'Erreur', 'error');
    } finally { setActionLoading(false); }
  };

  const handleConfirmDelete = async () => {
    if (!confirm) return;
    setActionLoading(true);
    try {
      await deleteAdminUser(confirm._id);
      setUsers(prev => prev.filter(u => u._id !== confirm._id));
      showToast('Compte supprimé.');
      setConfirm(null);
    } catch (err) {
      showToast(err.response?.data?.message || 'Erreur lors de la suppression', 'error');
    } finally { setActionLoading(false); }
  };

  const handleConfirmEditRole = async (newRole) => {
    if (!editRole) return;
    setActionLoading(true);
    try {
      const { user: updated, emailSent } = await updateUserRole(editRole._id, newRole);
      setUsers(prev => prev.map(u => u._id === editRole._id ? { ...u, ...updated } : u));
      if (emailSent) {
        showToast(`✅ Rôle mis à jour. Un email a été envoyé à ${editRole.email}.`);
      } else {
        showToast(`✅ Rôle mis à jour mais l'email de notification n'a pas pu être envoyé.`, 'warning');
      }
      setEditRole(null);
    } catch (err) {
      showToast(err.response?.data?.message || 'Erreur', 'error');
    } finally { setActionLoading(false); }
  };

  const handleCreateUser = async (formData) => {
    if (!formData.prenom || !formData.nom || !formData.email || !formData.password) {
      return showToast('Prénom, nom, email et mot de passe requis.', 'error');
    }
    if (formData.password.length < 8) {
      return showToast('Mot de passe : minimum 8 caractères.', 'error');
    }
    setActionLoading(true);
    try {
      const newUser = await createUserByAdmin(formData);
      setUsers(prev => [newUser, ...prev]);
      showToast('Compte créé avec succès.');
      setCreateModal(false);
    } catch (err) {
      showToast(err.response?.data?.message || 'Erreur lors de la création', 'error');
    } finally { setActionLoading(false); }
  };

  // ── Stats ──────────────────────────────────────────────────
  const stats = {
    total:         users.length,
    admins:        users.filter(u => u.role === 'Admin').length,
    collaborateurs:users.filter(u => u.role === 'Collaborateur').length,
    users:         users.filter(u => u.role === 'User' || u.role === 'Client').length,
  };

  const countByTab = (tab) => {
    if (tab === 'all') return users.length;
    if (tab === 'User') return users.filter(u => u.role === 'User' || u.role === 'Client').length;
    return users.filter(u => u.role === tab).length;
  };

  if (loading) return (
    <div className="flex items-center justify-center min-h-64">
      <Loader2 size={36} className="animate-spin" style={{ color:BLUE }} />
    </div>
  );

  if (error) return (
    <div className="p-6">
      <div className="flex items-center gap-3 p-4 rounded-xl border"
        style={{ background:`${RED}08`, borderColor:`${RED}30` }}>
        <AlertCircle size={20} style={{ color:RED }} />
        <p className="text-sm" style={{ color:RED, fontFamily:FONT }}>{error}</p>
      </div>
    </div>
  );

  return (
    <div className="p-6 space-y-5">
      <AnimatePresence>
        {toast && <Toast msg={toast.msg} type={toast.type} onDone={() => setToast(null)} />}
      </AnimatePresence>

      {/* ── Header ── */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background:`${BLUE}18` }}>
            <Users size={22} style={{ color:BLUE }} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900"
              style={{ fontFamily:"'Cormorant Garamond', serif" }}>
              Gestion des Utilisateurs
            </h1>
            <p className="text-xs text-gray-400" style={{ fontFamily:FONT }}>
              {stats.total} compte{stats.total !== 1 ? 's' : ''} enregistré{stats.total !== 1 ? 's' : ''}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={fetchUsers} disabled={actionLoading}
            className="flex items-center gap-2 text-sm font-semibold px-4 py-2 rounded-xl border transition hover:bg-white disabled:opacity-50"
            style={{ borderColor:`${BLUE}30`, color:BLUE, fontFamily:FONT }}>
            <RefreshCw size={14} className={actionLoading ? 'animate-spin' : ''} />
            Actualiser
          </button>
          <button onClick={() => setCreateModal(true)}
            className="flex items-center gap-2 text-sm font-semibold px-4 py-2 rounded-xl text-white transition hover:opacity-90"
            style={{ background:`linear-gradient(135deg,#1A5A8A,${BLUE})`, fontFamily:FONT }}>
            <Plus size={14} /> Créer un compte
          </button>
        </div>
      </div>

      {/* ── Stats Pills ── */}
      <div className="flex flex-wrap gap-3">
        {[
          { label:'Total',           value:stats.total,          color:'#7C3AED' },
          { label:'Admins',          value:stats.admins,         color:RED       },
          { label:'Collaborateurs',  value:stats.collaborateurs, color:GOLD      },
          { label:'Utilisateurs',    value:stats.users,          color:GRAY      },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-white rounded-2xl border border-gray-100 shadow-sm px-5 py-3 flex items-center gap-3">
            <span className="text-2xl font-extrabold" style={{ color, fontFamily:FONT }}>{value}</span>
            <span className="text-xs font-semibold uppercase tracking-wide text-gray-400"
              style={{ fontFamily:FONT }}>{label}</span>
          </div>
        ))}
      </div>

      {/* ── Filters + Search ── */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
        <div className="flex flex-wrap gap-1.5">
          {FILTER_TABS.map(({ id, label }) => (
            <button key={id} onClick={() => setFilterTab(id)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all"
              style={{
                background: filterTab===id ? `linear-gradient(135deg,#1A5A8A,${BLUE})` : '#F1F5F9',
                color:      filterTab===id ? '#fff' : '#64748B',
                fontFamily: FONT,
              }}>
              {label}
              <span className={`px-1.5 py-0.5 rounded-full text-xs font-bold ${
                filterTab===id ? 'bg-white/20 text-white' : 'bg-white text-gray-500'
              }`}>{countByTab(id)}</span>
            </button>
          ))}
        </div>
        <div className="relative sm:ml-auto">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Nom, email…"
            aria-label="Rechercher un utilisateur"
            className="pl-8 pr-4 py-2 text-sm rounded-xl border outline-none transition-all"
            style={{ fontFamily:FONT, borderColor:'#E2E8F0', width:220 }}
            onFocus={e  => { e.target.style.borderColor=BLUE; e.target.style.boxShadow=`0 0 0 3px ${BLUE}20`; }}
            onBlur={e   => { e.target.style.borderColor='#E2E8F0'; e.target.style.boxShadow='none'; }} />
        </div>
      </div>

      {/* ── Table ── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <table className="min-w-full">
          <thead style={{ background:'#F8FAFC' }}>
            <tr>
              {['Utilisateur','Email','Rôle','Statut','Actions'].map(h => (
                <th key={h}
                  className={`px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide ${
                    h === 'Utilisateur' || h === 'Email' ? 'text-left' : 'text-center'
                  }`}
                  style={{ fontFamily:FONT }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            <AnimatePresence>
              {filtered.map((u, i) => {
                const isSelf = u._id === me?._id || u.email === me?.email;
                const isActive = !u.status || u.status === 'Actif' || u.status === 'active';
                return (
                  <motion.tr key={u._id}
                    initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}
                    transition={{ delay: i * 0.02 }}
                    className="border-t border-gray-50 hover:bg-gray-50 transition-colors">

                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2.5">
                        <Avatar name={u.name} />
                        <div>
                          <p className="font-semibold text-gray-800 text-sm"
                            style={{ fontFamily:FONT }}>{u.name}</p>
                          {isSelf && (
                            <span className="text-xs text-gray-400" style={{ fontFamily:FONT }}>(vous)</span>
                          )}
                        </div>
                      </div>
                    </td>

                    <td className="px-5 py-3.5 text-sm text-gray-500"
                      style={{ fontFamily:FONT }}>{u.email}</td>

                    <td className="px-5 py-3.5 text-center">
                      <RoleBadge role={u.role} />
                    </td>

                    <td className="px-5 py-3.5 text-center">
                      <StatusBadge status={u.status} />
                    </td>

                    <td className="px-5 py-3.5">
                      <div className="flex items-center justify-center gap-1.5 flex-wrap">
                        {/* Voir historique */}
                        <button onClick={() => setDetailUser(u)}
                          className="p-1.5 rounded-lg hover:bg-blue-50 text-gray-400 hover:text-blue-500 transition-all"
                          title="Voir l'historique">
                          <Clock size={14} />
                        </button>

                        {/* Modifier rôle */}
                        {!isSelf && (
                          <button onClick={() => setEditRole(u)}
                            className="p-1.5 rounded-lg hover:bg-blue-50 text-gray-400 hover:text-blue-500 transition-all"
                            title="Modifier le rôle">
                            <Pencil size={14} />
                          </button>
                        )}

                        {/* KYC pour Proprietaire */}
                        {u.role === 'Proprietaire' && !u.isVerified && !isSelf && (
                          <button onClick={() => handleVerify(u)} disabled={actionLoading}
                            className="p-1.5 rounded-lg hover:bg-green-50 text-gray-400 hover:text-green-600 transition-all"
                            title="Vérifier KYC">
                            <ShieldCheck size={14} />
                          </button>
                        )}

                        {/* Suspendre / Réactiver */}
                        {!isSelf && u.role !== 'Admin' && (
                          <button onClick={() => handleSuspendActivate(u)} disabled={actionLoading}
                            className="p-1.5 rounded-lg transition-all"
                            style={{
                              color: isActive ? GOLD : GREEN,
                              background: isActive ? `${GOLD}12` : `${GREEN}12`,
                            }}
                            title={isActive ? 'Suspendre' : 'Réactiver'}>
                            {isActive ? '⏸' : '▶'}
                          </button>
                        )}

                        {/* Supprimer */}
                        {!isSelf && (
                          <button onClick={() => setConfirm(u)}
                            className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition-all"
                            title="Supprimer">
                            <Trash2 size={14} />
                          </button>
                        )}
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
            <p className="font-semibold text-gray-500 text-sm" style={{ fontFamily:FONT }}>
              Aucun utilisateur{search ? ' correspondant' : ''}
            </p>
            {search && (
              <button onClick={() => setSearch('')}
                className="mt-3 text-xs font-semibold px-4 py-1.5 rounded-full"
                style={{ background:`${BLUE}15`, color:BLUE, fontFamily:FONT }}>
                Réinitialiser
              </button>
            )}
          </div>
        )}
      </div>

      {/* ── Modals ── */}
      {confirm && (
        <ConfirmDialog
          user={confirm}
          onConfirm={handleConfirmDelete}
          onCancel={() => setConfirm(null)}
        />
      )}
      {editRole && (
        <EditRoleModal
          user={editRole}
          onConfirm={handleConfirmEditRole}
          onCancel={() => setEditRole(null)}
          loading={actionLoading}
        />
      )}
      {createModal && (
        <CreateUserModal
          onConfirm={handleCreateUser}
          onCancel={() => setCreateModal(false)}
          loading={actionLoading}
        />
      )}
      {detailUser && (
        <UserDetailModal
          user={detailUser}
          onClose={() => setDetailUser(null)}
        />
      )}
    </div>
  );
};

export default UsersPanel;
