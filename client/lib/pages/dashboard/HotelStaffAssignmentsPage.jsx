'use client';
import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { toast } from 'react-hot-toast';
import * as staffService from '../../services/hotelAccessService';

const ROLE_LABEL = {
  hotel_manager: 'Manager hôtel', reception: 'Réception', housekeeping: 'Housekeeping',
  inspector: 'Inspecteur', maintenance: 'Maintenance', finance: 'Finance', viewer: 'Lecture seule',
};
const STATUS_LABEL = { active: 'Actif', pending: 'À venir', suspended: 'Suspendu', revoked: 'Révoqué', expired: 'Expiré' };
const STATUS_CLASS = { active: 'bg-green-100 text-green-800', pending: 'bg-blue-100 text-blue-800', suspended: 'bg-amber-100 text-amber-800', revoked: 'bg-red-100 text-red-800', expired: 'bg-gray-200 text-gray-600' };

export default function HotelStaffAssignmentsPage() {
  const params = useParams();
  const hotelId = params?.hotelId;
  const [assignments, setAssignments] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(null);
  const [form, setForm] = useState({ userId: '', assignmentRole: 'reception', validUntil: '' });

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const result = await staffService.listHotelStaffAssignments(hotelId, { page, limit: 20, status: statusFilter || undefined });
      setAssignments(result.assignments); setTotal(result.total);
    } catch (e) {
      setError(e?.response?.status === 403 ? 'Accès refusé à la gestion du personnel de cet hôtel.' : "Impossible de charger la liste du personnel.");
    } finally { setLoading(false); }
  }, [hotelId, page, statusFilter]);

  useEffect(() => { load(); }, [load]);

  const run = async (action, successMessage) => {
    try { await action(); toast.success(successMessage); await load(); }
    catch (e) { toast.error(e?.response?.data?.message || "L'opération a échoué."); }
  };

  const create = async (e) => {
    e.preventDefault();
    setBusy('create');
    await run(() => staffService.createHotelStaffAssignment(hotelId, { userId: form.userId, assignmentRole: form.assignmentRole, validUntil: form.validUntil || undefined }), 'Rattachement créé.');
    setBusy(null); setForm({ userId: '', assignmentRole: 'reception', validUntil: '' });
  };

  const suspend = async (assignment) => {
    const reason = window.prompt('Raison de la suspension (10 caractères minimum) :');
    if (!reason || reason.trim().length < 10) { toast.error('Une raison d’au moins 10 caractères est obligatoire.'); return; }
    setBusy(assignment.id);
    await run(() => staffService.suspendHotelStaffAssignment(hotelId, assignment.id, reason), 'Rattachement suspendu.');
    setBusy(null);
  };
  const reactivate = async (assignment) => {
    if (!window.confirm(`Réactiver le rattachement de ${assignment.user?.name || assignment.user?.id} ?`)) return;
    setBusy(assignment.id);
    await run(() => staffService.reactivateHotelStaffAssignment(hotelId, assignment.id), 'Rattachement réactivé.');
    setBusy(null);
  };
  const revoke = async (assignment) => {
    const reason = window.prompt(`Révoquer définitivement le rattachement de ${assignment.user?.name || assignment.user?.id} sur cet hôtel ? Raison (10 caractères minimum) :`);
    if (!reason || reason.trim().length < 10) { toast.error('Une raison d’au moins 10 caractères est obligatoire.'); return; }
    setBusy(assignment.id);
    await run(() => staffService.revokeHotelStaffAssignment(hotelId, assignment.id, reason), 'Rattachement révoqué.');
    setBusy(null);
  };

  return (
    <div className="p-4 text-sm" data-testid="hotel-staff-assignments">
      <header className="mb-4">
        <h1 className="text-xl font-semibold text-gray-900">Personnel rattaché à l’hôtel</h1>
        <p className="text-xs text-gray-500">Gouvernance des accès — rôle local, capacités et période de validité par utilisateur.</p>
      </header>

      <form onSubmit={create} className="mb-4 flex flex-wrap items-end gap-3 rounded border bg-gray-50 p-3">
        <div>
          <label className="block text-[11px] text-gray-500" htmlFor="staff-user-id">Utilisateur (identifiant)</label>
          <input id="staff-user-id" required className="rounded border px-2 py-1 text-xs" value={form.userId} onChange={(e) => setForm({ ...form, userId: e.target.value.trim() })} />
        </div>
        <div>
          <label className="block text-[11px] text-gray-500" htmlFor="staff-role">Rôle local</label>
          <select id="staff-role" className="rounded border px-2 py-1 text-xs" value={form.assignmentRole} onChange={(e) => setForm({ ...form, assignmentRole: e.target.value })}>
            {Object.entries(ROLE_LABEL).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-[11px] text-gray-500" htmlFor="staff-until">Valide jusqu’au (optionnel)</label>
          <input id="staff-until" type="date" className="rounded border px-2 py-1 text-xs" value={form.validUntil} onChange={(e) => setForm({ ...form, validUntil: e.target.value })} />
        </div>
        <button type="submit" disabled={busy === 'create'} className="rounded bg-gray-800 px-3 py-1 text-xs text-white disabled:opacity-40">Rattacher</button>
      </form>

      <div className="mb-3 flex items-center gap-2">
        <label className="text-[11px] text-gray-500" htmlFor="staff-status-filter">Statut</label>
        <select id="staff-status-filter" className="rounded border px-2 py-1 text-xs" value={statusFilter} onChange={(e) => { setPage(1); setStatusFilter(e.target.value); }}>
          <option value="">Tous</option>
          {Object.entries(STATUS_LABEL).filter(([v]) => v !== 'pending' && v !== 'expired').map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
      </div>

      {error && <div role="alert" className="rounded border border-red-300 bg-red-50 p-3 text-red-700">{error}</div>}
      {!error && loading && <p className="text-xs text-gray-500">Chargement…</p>}
      {!error && !loading && assignments.length === 0 && <p className="text-xs text-gray-500">Aucun membre du personnel rattaché.</p>}

      {!error && assignments.length > 0 && (
        <table className="w-full text-left text-xs">
          <thead><tr className="text-gray-500"><th className="py-1">Utilisateur</th><th>Rôle</th><th>Statut</th><th>Validité</th><th>Actions</th></tr></thead>
          <tbody>
            {assignments.map((assignment) => (
              <tr key={assignment.id} className="border-t">
                <td className="py-1">{assignment.user?.name} <span className="text-gray-400">{assignment.user?.email}</span></td>
                <td>{ROLE_LABEL[assignment.assignmentRole] || assignment.assignmentRole}</td>
                <td><span className={`rounded px-2 py-0.5 ${STATUS_CLASS[assignment.effectiveStatus] || ''}`}>{STATUS_LABEL[assignment.effectiveStatus] || assignment.effectiveStatus}</span></td>
                <td>{assignment.validUntil ? new Date(assignment.validUntil).toLocaleDateString('fr-FR') : '—'}</td>
                <td className="space-x-1">
                  {assignment.status === 'active' && <button type="button" disabled={busy === assignment.id} className="rounded border px-2 py-1 disabled:opacity-40" onClick={() => suspend(assignment)}>Suspendre</button>}
                  {assignment.status === 'suspended' && <button type="button" disabled={busy === assignment.id} className="rounded border px-2 py-1 disabled:opacity-40" onClick={() => reactivate(assignment)}>Réactiver</button>}
                  {assignment.status !== 'revoked' && <button type="button" disabled={busy === assignment.id} className="rounded border border-red-300 px-2 py-1 text-red-700 disabled:opacity-40" onClick={() => revoke(assignment)}>Révoquer</button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <div className="mt-2 flex items-center justify-between text-[11px] text-gray-500">
        <span>Page {page} / {Math.max(1, Math.ceil(total / 20))} ({total} rattachements)</span>
        <div className="flex gap-2">
          <button type="button" className="rounded border px-2 py-1 disabled:opacity-40" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>Précédent</button>
          <button type="button" className="rounded border px-2 py-1 disabled:opacity-40" disabled={page * 20 >= total} onClick={() => setPage((p) => p + 1)}>Suivant</button>
        </div>
      </div>
    </div>
  );
}
