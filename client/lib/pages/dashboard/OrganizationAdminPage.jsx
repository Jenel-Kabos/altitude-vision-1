'use client';
// ORGANIZATION-1 (Phase 8) — Administration de la couche organisationnelle.
// Consomme exclusivement /api/organization/* — aucune règle métier ici.
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import { Network, Plus, UserPlus, ChevronRight, ChevronDown } from 'lucide-react';
import { listOrgUnits, getOrgTree, createOrgUnit, grantMembership, suspendMembership, revokeMembership, getUserMemberships } from '../../services/organizationService';
import { getAllUsers } from '../../services/userService';
import { DashboardCard, DashboardPage, DashboardPageHeader, DashboardState } from '../../components/dashboard/DashboardUI';

const TYPE_LABELS = { organization: 'Organisation', business_unit: 'Filiale', establishment: 'Établissement', department: 'Département', team: 'Équipe' };
const TYPES = Object.keys(TYPE_LABELS);

function CreateUnitForm({ roots, onCreated }) {
  const [name, setName] = useState('');
  const [type, setType] = useState('organization');
  const [parentId, setParentId] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await createOrgUnit({ name, type, parentId: type === 'organization' ? undefined : parentId || undefined });
      toast.success('Unité créée.');
      setName('');
      onCreated();
    } catch (err) { toast.error(err.response?.data?.message || 'Création impossible.'); }
    finally { setSubmitting(false); }
  };

  return (
    <form onSubmit={submit} className="flex flex-wrap items-end gap-3 rounded-xl border bg-white p-4">
      <label className="text-sm">Nom<input value={name} onChange={(e) => setName(e.target.value)} required className="mt-1 block rounded border px-2 py-1.5" /></label>
      <label className="text-sm">Type
        <select value={type} onChange={(e) => setType(e.target.value)} className="mt-1 block rounded border px-2 py-1.5">
          {TYPES.map((t) => <option key={t} value={t}>{TYPE_LABELS[t]}</option>)}
        </select>
      </label>
      {type !== 'organization' && (
        <label className="text-sm">Parent
          <select value={parentId} onChange={(e) => setParentId(e.target.value)} required className="mt-1 block rounded border px-2 py-1.5">
            <option value="">— Choisir —</option>
            {roots.map((u) => <option key={u.id} value={u.id}>{TYPE_LABELS[u.type]} · {u.name}</option>)}
          </select>
        </label>
      )}
      <button type="submit" disabled={submitting} className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
        <Plus size={16} /> Créer
      </button>
    </form>
  );
}

function MembershipPanel({ unit, users, onChanged }) {
  const [memberships, setMemberships] = useState(null);
  const [userId, setUserId] = useState('');
  const [roleInUnit, setRoleInUnit] = useState('member');
  const [busy, setBusy] = useState(false);

  // Pas d'endpoint "membres d'une unité" dédié dans ce sprint (voir dettes) —
  // on affiche les appartenances de chaque utilisateur sélectionné plutôt
  // qu'une liste inverse ; suffisant pour l'administration ciblée.
  const loadFor = useCallback(async (uid) => {
    if (!uid) { setMemberships(null); return; }
    const list = await getUserMemberships(uid).catch(() => []);
    setMemberships(list.filter((m) => String(m.orgUnit?._id || m.orgUnit) === String(unit.id)));
  }, [unit.id]);

  const grant = async () => {
    if (!userId) return;
    setBusy(true);
    try {
      await grantMembership({ userId, orgUnitId: unit.id, roleInUnit });
      toast.success('Membre affecté.');
      await loadFor(userId);
      onChanged();
    } catch (err) { toast.error(err.response?.data?.message || 'Affectation impossible.'); }
    finally { setBusy(false); }
  };

  return (
    <div className="mt-2 space-y-2 rounded-lg bg-slate-50 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <select value={userId} onChange={(e) => { setUserId(e.target.value); loadFor(e.target.value); }} className="rounded border px-2 py-1 text-sm">
          <option value="">— Sélectionner un utilisateur —</option>
          {users.map((u) => <option key={u._id} value={u._id}>{u.name} ({u.email})</option>)}
        </select>
        <select value={roleInUnit} onChange={(e) => setRoleInUnit(e.target.value)} className="rounded border px-2 py-1 text-sm">
          {['owner', 'manager', 'lead', 'member'].map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
        <button onClick={grant} disabled={busy || !userId} className="inline-flex items-center gap-1 rounded bg-teal-700 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60">
          <UserPlus size={14} /> Affecter
        </button>
      </div>
      {memberships?.length > 0 && (
        <ul className="space-y-1 text-xs text-slate-600">
          {memberships.map((m) => (
            <li key={m._id} className="flex items-center justify-between gap-2 rounded bg-white px-2 py-1">
              <span>{m.roleInUnit} — {m.status}</span>
              {m.status === 'active' && (
                <button onClick={async () => { await suspendMembership(m._id, 'Suspension admin'); loadFor(userId); onChanged(); }} className="text-amber-700 hover:underline">Suspendre</button>
              )}
              {m.status !== 'revoked' && (
                <button onClick={async () => { await revokeMembership(m._id, 'Révocation admin'); loadFor(userId); onChanged(); }} className="text-red-700 hover:underline">Révoquer</button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function TreeNode({ node, users, depth = 0, onChanged }) {
  const [open, setOpen] = useState(depth < 1);
  const [showMembers, setShowMembers] = useState(false);
  return (
    <div style={{ marginLeft: depth * 18 }}>
      <div className="flex items-center gap-2 rounded-lg border bg-white p-2">
        {node.children?.length > 0 ? (
          <button onClick={() => setOpen((v) => !v)} aria-label="Déplier">{open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}</button>
        ) : <span className="w-4" />}
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">{TYPE_LABELS[node.type]}</span>
        <span className="font-medium text-slate-900">{node.name}</span>
        <button onClick={() => setShowMembers((v) => !v)} className="ml-auto text-xs font-medium text-teal-700 hover:underline">
          {showMembers ? 'Masquer les membres' : 'Gérer les membres'}
        </button>
      </div>
      {showMembers && <MembershipPanel unit={node} users={users} onChanged={onChanged} />}
      {open && node.children?.map((child) => <TreeNode key={child._id} node={{ ...child, id: child._id }} users={users} depth={depth + 1} onChanged={onChanged} />)}
    </div>
  );
}

export default function OrganizationAdminPage() {
  const [roots, setRoots] = useState([]);
  const [trees, setTrees] = useState({});
  const [users, setUsers] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [units, allUsers] = await Promise.all([listOrgUnits({ type: 'organization' }), getAllUsers().catch(() => [])]);
      setRoots(units);
      const treeEntries = await Promise.all(units.map(async (u) => [u.id, await getOrgTree(u.id)]));
      setTrees(Object.fromEntries(treeEntries));
      setUsers(Array.isArray(allUsers) ? allUsers : allUsers?.users || []);
    } catch (e) { setError(e.response?.data?.message || 'Organisation indisponible.'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  // Pour le formulaire de création, "roots" doit lister TOUTES les unités
  // (pas seulement les organisations racines) afin de choisir n'importe quel
  // parent — on aplatit les arbres déjà chargés.
  const allUnitsFlat = Object.values(trees).flatMap(function flatten(node) {
    return [{ id: node._id, name: node.name, type: node.type }, ...(node.children || []).flatMap(flatten)];
  });

  return (
    <DashboardPage>
      <DashboardPageHeader
        icon={Network}
        title="Organisation"
        description="Organisation → Filiale → Établissement → Département → Équipe — au-dessus de User, BusinessProfile et RBAC, sans les remplacer."
      />
      <CreateUnitForm roots={allUnitsFlat} onCreated={load} />
      {error && <DashboardState type="error" title="Erreur" description={error} />}
      {loading ? (
        <div className="h-40 animate-pulse rounded-xl bg-slate-100" />
      ) : roots.length === 0 ? (
        <DashboardState type="empty" title="Aucune organisation" description="Créez votre première organisation racine ci-dessus." />
      ) : (
        <DashboardCard className="space-y-2">
          {roots.map((root) => trees[root.id] && <TreeNode key={root.id} node={trees[root.id]} users={users} onChanged={load} />)}
        </DashboardCard>
      )}
    </DashboardPage>
  );
}
