"use client";

// USER-TENANT-MEMBERSHIP-ARCHITECTURE-1E — Membres d'une organisation.
// Écran /dashboard/users (kept URL for continuité), désormais orienté
// membership. Rien ici ne touche User globalement : la table repose
// exclusivement sur /api/members et ses actions. Aucun fallback vers
// /users/* n'est autorisé.

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Users, RefreshCw, Loader2, AlertCircle, Search, Plus, Pencil, UserMinus,
  Pause, Play, X,
} from 'lucide-react';
import { usePlatformTenantRuntime } from '../../context/PlatformTenantRuntimeContext';
import {
  listMembers, searchGlobalUserByEmail, addMember,
  changeMemberRole, suspendMember, reactivateMember, removeMember,
} from '../../services/tenantMemberService';

const BLUE = '#2E7BB5';
const RED = '#D42B2B';
const GOLD = '#C8872A';
const GREEN = '#16A34A';
const GRAY = '#94A3B8';
const FONT = "'Outfit', sans-serif";

const BUSINESS_ROLES = [
  { role: 'Admin', label: 'Admin', desc: 'Autorité tenant', color: RED },
  { role: 'Collaborateur', label: 'Collaborateur', desc: 'Accès général', color: GOLD },
  { role: 'Secretaire', label: 'Secrétaire', desc: 'Documents & paiements', color: '#0891B2' },
  { role: 'GestionnaireImmobilier', label: 'Gestionnaire immobilier', desc: 'Biens & contrats', color: '#7C3AED' },
  { role: 'CommunityManager', label: 'Community Manager', desc: 'Communauté & annonces', color: '#059669' },
  { role: 'Communicant', label: 'Communicant', desc: 'Messages & RDV', color: '#DC2626' },
];
const BUSINESS_ROLE_LABEL = Object.fromEntries(BUSINESS_ROLES.map((r) => [r.role, r.label]));
const BUSINESS_ROLE_COLOR = Object.fromEntries(BUSINESS_ROLES.map((r) => [r.role, r.color]));

const FILTER_TABS = [
  { id: 'all', label: 'Tous' },
  { id: 'Admin', label: 'Admins' },
  { id: 'Collaborateur', label: 'Collaborateurs' },
  { id: 'Secretaire', label: 'Secrétaires' },
  { id: 'GestionnaireImmobilier', label: 'Gestionnaires' },
  { id: 'CommunityManager', label: 'Community Managers' },
  { id: 'Communicant', label: 'Communicants' },
  { id: 'suspended', label: 'Suspendus' },
];

const RoleBadge = ({ role }) => {
  const color = BUSINESS_ROLE_COLOR[role] || GRAY;
  return (
    <span
      className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full"
      style={{ color, background: `${color}15`, fontFamily: FONT }}
    >
      {BUSINESS_ROLE_LABEL[role] || role || '—'}
    </span>
  );
};

const StatusBadge = ({ status }) => {
  const map = {
    active: { bg: `${GREEN}15`, color: GREEN, label: 'Actif' },
    suspended: { bg: `${GOLD}18`, color: GOLD, label: 'Suspendu' },
    revoked: { bg: `${RED}15`, color: RED, label: 'Retiré' },
    pending: { bg: `${GRAY}20`, color: GRAY, label: 'En attente' },
  };
  const s = map[status] || map.active;
  return (
    <span
      className="text-xs font-semibold px-2 py-0.5 rounded-full"
      style={{ background: s.bg, color: s.color, fontFamily: FONT }}
    >
      {s.label}
    </span>
  );
};

const Avatar = ({ name }) => (
  <div
    className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-white text-sm font-bold"
    style={{ background: `linear-gradient(135deg,${BLUE},${GOLD})`, fontFamily: FONT }}
  >
    {name?.charAt(0).toUpperCase() || 'M'}
  </div>
);

const Toast = ({ msg, type, onDone }) => {
  useEffect(() => { const t = setTimeout(onDone, 3500); return () => clearTimeout(t); }, [onDone]);
  return (
    <motion.div
      initial={{ opacity: 0, y: -40 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -40 }}
      className="fixed top-5 right-5 z-[200] px-5 py-3.5 rounded-xl shadow-xl text-white text-sm font-medium"
      style={{ background: type === 'success' ? GREEN : type === 'warning' ? GOLD : RED, fontFamily: FONT }}
    >
      {msg}
    </motion.div>
  );
};

const codeFromErr = (err) => err?.response?.data?.code || err?.response?.data?.error?.code || null;
const messageFromErr = (err, fallback) => {
  const code = codeFromErr(err);
  if (code === 'LAST_TENANT_ADMIN') {
    return "Impossible d'effectuer cette action : l'organisation doit conserver au moins un administrateur actif.";
  }
  if (code === 'MEMBER_ALREADY_ACTIVE') {
    return 'Cette personne est déjà membre de cette organisation.';
  }
  if (err?.response?.status === 403) {
    return "Vous n'avez pas l'autorité requise pour cette action dans cette organisation.";
  }
  return err?.response?.data?.message || fallback;
};

// ── Add Member modal ──────────────────────────────────────────
const AddMemberModal = ({ tenantName, onCancel, onAdded, showToast }) => {
  const [email, setEmail] = useState('');
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);
  const [foundUser, setFoundUser] = useState(null);
  const [role, setRole] = useState('Collaborateur');
  const [submitting, setSubmitting] = useState(false);
  const [notFound, setNotFound] = useState(false);

  const handleSearch = async (e) => {
    e?.preventDefault?.();
    if (!email.trim()) return;
    setSearching(true); setSearched(false); setFoundUser(null); setNotFound(false);
    try {
      const { found, user } = await searchGlobalUserByEmail(email.trim());
      setSearched(true);
      if (found && user) setFoundUser(user);
      else setNotFound(true);
    } catch (err) {
      showToast(messageFromErr(err, 'Recherche indisponible.'), 'error');
    } finally { setSearching(false); }
  };

  const handleAdd = async () => {
    setSubmitting(true);
    try {
      const member = await addMember({
        email: foundUser?.email || email.trim(),
        businessRole: role,
      });
      onAdded(member);
    } catch (err) {
      showToast(messageFromErr(err, "Impossible d'ajouter ce membre."), 'error');
    } finally { setSubmitting(false); }
  };

  return (
    <div className="fixed inset-0 z-[150] flex items-start justify-center p-4 bg-black/50 backdrop-blur-sm overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, scale: 0.93 }} animate={{ opacity: 1, scale: 1 }}
        className="bg-white rounded-2xl shadow-2xl max-w-md w-full my-8 p-6"
      >
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-bold text-gray-900 text-base" style={{ fontFamily: FONT }}>
            Ajouter un membre {tenantName ? `à ${tenantName}` : ''}
          </h3>
          <button onClick={onCancel} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400" aria-label="Fermer">
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSearch} className="space-y-3">
          <label className="block text-xs font-semibold text-gray-600" style={{ fontFamily: FONT }}>
            Email de la personne
          </label>
          <div className="flex gap-2">
            <input
              type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
              placeholder="prenom.nom@exemple.com"
              className="flex-1 px-3 py-2 text-sm text-gray-900 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-200 bg-gray-50"
              style={{ fontFamily: FONT }}
              aria-label="Email"
            />
            <button type="submit" disabled={searching || !email.trim()}
              className="px-4 py-2 rounded-xl text-white text-sm font-semibold disabled:opacity-50"
              style={{ background: BLUE, fontFamily: FONT }}>
              {searching ? <Loader2 size={14} className="animate-spin" /> : 'Rechercher'}
            </button>
          </div>
        </form>

        {searched && foundUser && (
          <div className="mt-5 space-y-4">
            <div className="flex items-center gap-3 p-3 rounded-xl border border-gray-100 bg-gray-50">
              <Avatar name={foundUser.name} />
              <div>
                <p className="font-semibold text-gray-900 text-sm" style={{ fontFamily: FONT }}>{foundUser.name}</p>
                <p className="text-xs text-gray-500" style={{ fontFamily: FONT }}>{foundUser.email}</p>
              </div>
            </div>

            <div>
              <p className="text-xs font-semibold text-gray-600 mb-2" style={{ fontFamily: FONT }}>
                Rôle dans {tenantName || 'cette organisation'}
              </p>
              <div className="grid grid-cols-2 gap-2">
                {BUSINESS_ROLES.map(({ role: r, label, desc, color }) => (
                  <button key={r} type="button" onClick={() => setRole(r)}
                    className="flex flex-col items-start gap-0.5 p-3 rounded-xl border-2 text-left"
                    style={{
                      borderColor: role === r ? color : '#E2E8F0',
                      background: role === r ? `${color}10` : 'white',
                    }}>
                    <span className="text-xs font-bold" style={{ color: role === r ? color : '#374151', fontFamily: FONT }}>{label}</span>
                    <span className="text-xs text-gray-400" style={{ fontFamily: FONT }}>{desc}</span>
                  </button>
                ))}
              </div>
            </div>

            <button onClick={handleAdd} disabled={submitting}
              className="w-full py-2.5 rounded-xl text-white text-sm font-semibold disabled:opacity-50"
              style={{ background: BLUE, fontFamily: FONT }}>
              {submitting ? <Loader2 size={14} className="animate-spin mx-auto" /> : `Ajouter à ${tenantName || 'cette organisation'}`}
            </button>
          </div>
        )}

        {searched && notFound && (
          <div className="mt-5 p-4 rounded-xl border" style={{ borderColor: `${GOLD}40`, background: `${GOLD}08` }}>
            <p className="text-sm font-semibold text-gray-800" style={{ fontFamily: FONT }}>
              Cette personne n'a pas encore de compte Altitude Vision.
            </p>
            <p className="text-xs text-gray-500 mt-1" style={{ fontFamily: FONT }}>
              Un workflow d'invitation sera disponible prochainement. Pour l'instant, cette personne doit d'abord créer son compte sur la plateforme.
            </p>
            <button disabled title="Bientôt disponible"
              className="mt-3 inline-flex items-center gap-2 text-xs font-semibold px-3 py-1.5 rounded-lg opacity-50 cursor-not-allowed"
              style={{ background: `${BLUE}15`, color: BLUE, fontFamily: FONT }}>
              Inviter cette personne — bientôt disponible
            </button>
          </div>
        )}
      </motion.div>
    </div>
  );
};

// ── Change role modal ─────────────────────────────────────────
const ChangeRoleModal = ({ member, tenantName, onCancel, onConfirm, loading }) => {
  const [role, setRole] = useState(member.businessRole);
  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <motion.div initial={{ opacity: 0, scale: 0.93 }} animate={{ opacity: 1, scale: 1 }}
        className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-bold text-gray-900 text-base" style={{ fontFamily: FONT }}>
            Rôle de {member.user?.name} dans {tenantName || "l'organisation"}
          </h3>
          <button onClick={onCancel} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400" aria-label="Fermer">
            <X size={16} />
          </button>
        </div>
        <div className="grid grid-cols-2 gap-2 mb-5">
          {BUSINESS_ROLES.map(({ role: r, label, desc, color }) => (
            <button key={r} onClick={() => setRole(r)}
              className="flex flex-col items-start gap-0.5 p-3 rounded-xl border-2 text-left"
              style={{ borderColor: role === r ? color : '#E2E8F0', background: role === r ? `${color}10` : 'white' }}>
              <span className="text-xs font-bold" style={{ color: role === r ? color : '#374151', fontFamily: FONT }}>{label}</span>
              <span className="text-xs text-gray-400" style={{ fontFamily: FONT }}>{desc}</span>
            </button>
          ))}
        </div>
        <div className="flex gap-3">
          <button onClick={onCancel}
            className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-600 text-sm font-semibold"
            style={{ fontFamily: FONT }}>Annuler</button>
          <button onClick={() => onConfirm(role)} disabled={loading || role === member.businessRole}
            className="flex-1 py-2.5 rounded-xl text-white text-sm font-semibold disabled:opacity-50"
            style={{ background: BLUE, fontFamily: FONT }}>
            {loading ? <Loader2 size={14} className="animate-spin mx-auto" /> : 'Confirmer'}
          </button>
        </div>
      </motion.div>
    </div>
  );
};

// ── Confirm remove modal ──────────────────────────────────────
const ConfirmRemoveModal = ({ member, tenantName, onCancel, onConfirm, loading }) => (
  <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
    <motion.div initial={{ opacity: 0, scale: 0.93 }} animate={{ opacity: 1, scale: 1 }}
      className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6">
      <h3 className="font-bold text-gray-900 text-center mb-2" style={{ fontFamily: FONT }}>
        Retirer {member.user?.name} de {tenantName || "l'organisation"} ?
      </h3>
      <p className="text-sm text-gray-500 text-center mt-2" style={{ fontFamily: FONT }}>
        Cette action retire uniquement cette personne de {tenantName || "l'organisation"}. Son compte Altitude Vision et ses autres appartenances seront conservés.
      </p>
      <div className="flex gap-3 mt-5">
        <button onClick={onCancel} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-600 text-sm font-semibold"
          style={{ fontFamily: FONT }}>Annuler</button>
        <button onClick={onConfirm} disabled={loading}
          className="flex-1 py-2.5 rounded-xl text-white text-sm font-semibold disabled:opacity-50"
          style={{ background: RED, fontFamily: FONT }}>
          {loading ? <Loader2 size={14} className="animate-spin mx-auto" /> : `Retirer de ${tenantName || "l'organisation"}`}
        </button>
      </div>
    </motion.div>
  </div>
);

// ── Confirm suspend modal ─────────────────────────────────────
const ConfirmSuspendModal = ({ member, tenantName, onCancel, onConfirm, loading }) => (
  <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
    <motion.div initial={{ opacity: 0, scale: 0.93 }} animate={{ opacity: 1, scale: 1 }}
      className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6">
      <h3 className="font-bold text-gray-900 text-center mb-2" style={{ fontFamily: FONT }}>
        Suspendre {member.user?.name} dans {tenantName || "l'organisation"} ?
      </h3>
      <p className="text-sm text-gray-500 text-center mt-2" style={{ fontFamily: FONT }}>
        Cette personne perdra l'accès à {tenantName || "l'organisation"}, mais son compte Altitude Vision restera actif.
      </p>
      <div className="flex gap-3 mt-5">
        <button onClick={onCancel} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-600 text-sm font-semibold"
          style={{ fontFamily: FONT }}>Annuler</button>
        <button onClick={onConfirm} disabled={loading}
          className="flex-1 py-2.5 rounded-xl text-white text-sm font-semibold disabled:opacity-50"
          style={{ background: GOLD, fontFamily: FONT }}>
          {loading ? <Loader2 size={14} className="animate-spin mx-auto" /> : `Suspendre dans ${tenantName || "l'organisation"}`}
        </button>
      </div>
    </motion.div>
  </div>
);

// ═══════════════════════════════════════════════════════════════
const MembersPanel = () => {
  const { selectedTenantId, tenants } = usePlatformTenantRuntime();
  const tenantScopeKey = selectedTenantId || 'platform';
  const tenant = useMemo(
    () => (tenants || []).find((t) => String(t._id) === String(selectedTenantId)) || null,
    [tenants, selectedTenantId],
  );
  const tenantName = tenant?.displayName || tenant?.legalName || tenant?.name || null;

  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [filterTab, setFilterTab] = useState('all');
  const [toast, setToast] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [editMember, setEditMember] = useState(null);
  const [removeTarget, setRemoveTarget] = useState(null);
  const [suspendTarget, setSuspendTarget] = useState(null);

  const membersEpochRef = useRef(0);
  const showToast = (msg, type = 'success') => setToast({ msg, type });

  const fetchMembers = useCallback(async () => {
    if (!selectedTenantId) {
      setMembers([]);
      setLoading(false);
      return;
    }
    const epoch = ++membersEpochRef.current;
    setMembers([]);
    setLoading(true);
    setError(null);
    try {
      const list = await listMembers();
      if (membersEpochRef.current !== epoch) return;
      setMembers(Array.isArray(list) ? list : []);
    } catch (err) {
      if (membersEpochRef.current !== epoch) return;
      setError(messageFromErr(err, 'Impossible de charger les membres.'));
    } finally {
      if (membersEpochRef.current === epoch) setLoading(false);
    }
  }, [selectedTenantId]);

  useEffect(() => { fetchMembers(); }, [fetchMembers, tenantScopeKey]);

  const stats = useMemo(() => {
    const s = {
      total: members.length, Admin: 0, Collaborateur: 0, Secretaire: 0,
      GestionnaireImmobilier: 0, CommunityManager: 0, Communicant: 0, suspended: 0,
    };
    members.forEach((m) => {
      if (m.status === 'suspended') s.suspended += 1;
      if (m.status === 'active' && s[m.businessRole] !== undefined) s[m.businessRole] += 1;
    });
    return s;
  }, [members]);

  const filtered = useMemo(() => {
    let list = [...members];
    if (filterTab === 'suspended') list = list.filter((m) => m.status === 'suspended');
    else if (filterTab !== 'all') list = list.filter((m) => m.status === 'active' && m.businessRole === filterTab);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((m) => m.user?.name?.toLowerCase().includes(q) || m.user?.email?.toLowerCase().includes(q));
    }
    return list;
  }, [members, filterTab, search]);

  const countByTab = (tab) => {
    if (tab === 'all') return members.length;
    if (tab === 'suspended') return members.filter((m) => m.status === 'suspended').length;
    return members.filter((m) => m.status === 'active' && m.businessRole === tab).length;
  };

  const onAdded = (member) => {
    setMembers((prev) => [member, ...prev]);
    setAddOpen(false);
    showToast(`${member.user?.name || 'Membre'} ajouté à ${tenantName || "l'organisation"}.`);
  };

  const onChangeRole = async (newRole) => {
    if (!editMember) return;
    setActionLoading(true);
    try {
      const updated = await changeMemberRole(editMember.membershipId, newRole);
      setMembers((prev) => prev.map((m) => (m.membershipId === editMember.membershipId ? updated : m)));
      setEditMember(null);
      showToast('Rôle mis à jour.');
    } catch (err) {
      showToast(messageFromErr(err, 'Erreur lors de la modification.'), 'error');
    } finally { setActionLoading(false); }
  };

  const onSuspend = async () => {
    if (!suspendTarget) return;
    setActionLoading(true);
    try {
      const updated = await suspendMember(suspendTarget.membershipId);
      setMembers((prev) => prev.map((m) => (m.membershipId === suspendTarget.membershipId ? updated : m)));
      setSuspendTarget(null);
      showToast('Membership suspendue.');
    } catch (err) {
      showToast(messageFromErr(err, 'Erreur lors de la suspension.'), 'error');
    } finally { setActionLoading(false); }
  };

  const onReactivate = async (member) => {
    setActionLoading(true);
    try {
      const updated = await reactivateMember(member.membershipId);
      setMembers((prev) => prev.map((m) => (m.membershipId === member.membershipId ? updated : m)));
      showToast('Membership réactivée.');
    } catch (err) {
      showToast(messageFromErr(err, 'Erreur lors de la réactivation.'), 'error');
    } finally { setActionLoading(false); }
  };

  const onRemove = async () => {
    if (!removeTarget) return;
    setActionLoading(true);
    try {
      await removeMember(removeTarget.membershipId);
      setMembers((prev) => prev.filter((m) => m.membershipId !== removeTarget.membershipId));
      setRemoveTarget(null);
      showToast('Membre retiré de l\'organisation.');
    } catch (err) {
      showToast(messageFromErr(err, 'Erreur lors du retrait.'), 'error');
    } finally { setActionLoading(false); }
  };

  // ── Platform view: no tenant selected ──
  if (!selectedTenantId) {
    return (
      <div className="p-6">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 text-center">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-3" style={{ background: `${BLUE}12` }}>
            <Users size={22} style={{ color: BLUE }} />
          </div>
          <p className="font-semibold text-gray-700" style={{ fontFamily: FONT }}>
            Sélectionnez une organisation pour gérer ses membres.
          </p>
          <p className="text-xs text-gray-400 mt-2" style={{ fontFamily: FONT }}>
            La gestion des membres est propre à chaque organisation.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-5">
      <AnimatePresence>
        {toast && <Toast msg={toast.msg} type={toast.type} onDone={() => setToast(null)} />}
      </AnimatePresence>

      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: `${BLUE}18` }}>
            <Users size={22} style={{ color: BLUE }} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900" style={{ fontFamily: "'Cormorant Garamond', serif" }}>
              Membres de {tenantName || "l'organisation"}
            </h1>
            <p className="text-xs text-gray-400" style={{ fontFamily: FONT }}>
              {stats.total} membre{stats.total !== 1 ? 's' : ''} de cette organisation
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={fetchMembers} disabled={loading || actionLoading}
            className="flex items-center gap-2 text-sm font-semibold px-4 py-2 rounded-xl border transition hover:bg-white disabled:opacity-50"
            style={{ borderColor: `${BLUE}30`, color: BLUE, fontFamily: FONT }}>
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            Actualiser
          </button>
          <button onClick={() => setAddOpen(true)}
            className="flex items-center gap-2 text-sm font-semibold px-4 py-2 rounded-xl text-white"
            style={{ background: `linear-gradient(135deg,#1A5A8A,${BLUE})`, fontFamily: FONT }}>
            <Plus size={14} /> Ajouter un membre
          </button>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
        <div className="flex flex-wrap gap-1.5">
          {FILTER_TABS.map(({ id, label }) => (
            <button key={id} onClick={() => setFilterTab(id)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold"
              style={{
                background: filterTab === id ? `linear-gradient(135deg,#1A5A8A,${BLUE})` : '#F1F5F9',
                color: filterTab === id ? '#fff' : '#64748B',
                fontFamily: FONT,
              }}>
              {label}
              <span className={`px-1.5 py-0.5 rounded-full text-xs font-bold ${filterTab === id ? 'bg-white/20 text-white' : 'bg-white text-gray-500'}`}>
                {countByTab(id)}
              </span>
            </button>
          ))}
        </div>
        <div className="relative sm:ml-auto">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Nom, email…" aria-label="Rechercher un membre"
            className="pl-8 pr-4 py-2 text-sm rounded-xl border outline-none"
            style={{ fontFamily: FONT, borderColor: '#E2E8F0', width: 220 }} />
        </div>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 size={36} className="animate-spin" style={{ color: BLUE }} />
        </div>
      )}

      {!loading && error && (
        <div className="flex items-center gap-3 p-4 rounded-xl border" style={{ background: `${RED}08`, borderColor: `${RED}30` }}>
          <AlertCircle size={20} style={{ color: RED }} />
          <p className="text-sm" style={{ color: RED, fontFamily: FONT }}>{error}</p>
        </div>
      )}

      {!loading && !error && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <table className="min-w-full">
            <thead style={{ background: '#F8FAFC' }}>
              <tr>
                {['Membre', 'Email', 'Rôle', 'Statut', 'Actions'].map((h) => (
                  <th key={h}
                    className={`px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide ${h === 'Membre' || h === 'Email' ? 'text-left' : 'text-center'}`}
                    style={{ fontFamily: FONT }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((m) => {
                const isActive = m.status === 'active';
                const isSuspended = m.status === 'suspended';
                return (
                  <tr key={m.membershipId} className="border-t border-gray-50 hover:bg-gray-50">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2.5">
                        <Avatar name={m.user?.name} />
                        <p className="font-semibold text-gray-800 text-sm" style={{ fontFamily: FONT }}>{m.user?.name || '—'}</p>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-sm text-gray-500" style={{ fontFamily: FONT }}>{m.user?.email || '—'}</td>
                    <td className="px-5 py-3.5 text-center"><RoleBadge role={m.businessRole} /></td>
                    <td className="px-5 py-3.5 text-center"><StatusBadge status={m.status} /></td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center justify-center gap-1.5 flex-wrap">
                        {isActive && (
                          <button onClick={() => setEditMember(m)} title="Modifier le rôle"
                            className="p-1.5 rounded-lg hover:bg-blue-50 text-gray-400 hover:text-blue-500"
                            aria-label="Modifier le rôle">
                            <Pencil size={14} />
                          </button>
                        )}
                        {isActive && (
                          <button onClick={() => setSuspendTarget(m)} disabled={actionLoading}
                            title={`Suspendre dans ${tenantName || "l'organisation"}`}
                            className="p-1.5 rounded-lg" style={{ color: GOLD, background: `${GOLD}12` }}
                            aria-label="Suspendre">
                            <Pause size={14} />
                          </button>
                        )}
                        {isSuspended && (
                          <button onClick={() => onReactivate(m)} disabled={actionLoading}
                            title={`Réactiver dans ${tenantName || "l'organisation"}`}
                            className="p-1.5 rounded-lg" style={{ color: GREEN, background: `${GREEN}12` }}
                            aria-label="Réactiver">
                            <Play size={14} />
                          </button>
                        )}
                        <button onClick={() => setRemoveTarget(m)}
                          title={`Retirer de ${tenantName || "l'organisation"}`}
                          className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500"
                          aria-label="Retirer">
                          <UserMinus size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {filtered.length === 0 && (
            <div className="py-16 text-center">
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-3" style={{ background: `${BLUE}12` }}>
                <Users size={22} style={{ color: BLUE }} />
              </div>
              <p className="font-semibold text-gray-500 text-sm" style={{ fontFamily: FONT }}>
                {search || filterTab !== 'all' ? 'Aucun membre correspondant.' : 'Aucun membre dans cette organisation.'}
              </p>
              {!search && filterTab === 'all' && (
                <button onClick={() => setAddOpen(true)}
                  className="mt-3 inline-flex items-center gap-2 text-xs font-semibold px-4 py-1.5 rounded-full"
                  style={{ background: `${BLUE}15`, color: BLUE, fontFamily: FONT }}>
                  <Plus size={12} /> Ajouter un membre
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {addOpen && (
        <AddMemberModal tenantName={tenantName} onCancel={() => setAddOpen(false)} onAdded={onAdded} showToast={showToast} />
      )}
      {editMember && (
        <ChangeRoleModal member={editMember} tenantName={tenantName}
          onCancel={() => setEditMember(null)} onConfirm={onChangeRole} loading={actionLoading} />
      )}
      {removeTarget && (
        <ConfirmRemoveModal member={removeTarget} tenantName={tenantName}
          onCancel={() => setRemoveTarget(null)} onConfirm={onRemove} loading={actionLoading} />
      )}
      {suspendTarget && (
        <ConfirmSuspendModal member={suspendTarget} tenantName={tenantName}
          onCancel={() => setSuspendTarget(null)} onConfirm={onSuspend} loading={actionLoading} />
      )}
    </div>
  );
};

export default MembersPanel;
