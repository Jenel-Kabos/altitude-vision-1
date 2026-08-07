'use client';
// USER-ARCH-UX-1 (Phase 7) — administration des profils métiers. Réutilise
// intégralement les services USER-ARCH-1 (grant/suspend/revoke/history) —
// aucune logique métier ici, uniquement de l'affichage et des appels HTTP.
import { useCallback, useEffect, useState } from 'react';
import toast from '@/lib/utils/toast';
import { getProfileHistory, grantProfile, suspendProfile, revokeProfile } from '@/lib/services/userBusinessProfileService';

const PROFILE_LABELS = {
  proprietaire_immobilier: 'Propriétaire immobilier',
  exploitant_etablissement: "Exploitant d'établissement",
  locataire: 'Locataire',
  client: 'Client',
};
const PROFILE_TYPES = Object.keys(PROFILE_LABELS);
const STATUS_LABELS = { active: 'Actif', suspended: 'Suspendu', revoked: 'Révoqué' };
const STATUS_STYLES = {
  active: 'bg-green-100 text-green-800',
  suspended: 'bg-amber-100 text-amber-800',
  revoked: 'bg-red-100 text-red-800',
};

export default function UserBusinessProfilePanel({ userId, onClose }) {
  const [profiles, setProfiles] = useState([]);
  const [derivedOnly, setDerivedOnly] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newProfileType, setNewProfileType] = useState(PROFILE_TYPES[0]);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getProfileHistory(userId);
      setProfiles(data.profiles || []);
      setDerivedOnly(data.derivedOnly || []);
    } catch (e) {
      toast.error(e.response?.data?.message || 'Chargement des profils impossible.');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => { load(); }, [load]);

  const runAction = async (fn) => {
    setBusy(true);
    try {
      await fn();
      await load();
    } catch (e) {
      toast.error(e.response?.data?.message || 'Action impossible.');
    } finally {
      setBusy(false);
    }
  };

  const grantableTypes = PROFILE_TYPES.filter((t) => !profiles.some((p) => p.profileType === t && p.status === 'active'));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50" onClick={onClose}>
      <div className="w-11/12 max-h-[85vh] overflow-y-auto rounded-lg bg-white p-6 md:w-2/3" onClick={(e) => e.stopPropagation()}>
        <h2 className="mb-1 text-lg font-bold">Profils métiers</h2>
        <p className="mb-4 text-sm text-gray-500">
          Octroi, suspension et révocation — chaque action est journalisée (audit trail).
        </p>

        {loading ? (
          <p className="py-6 text-center text-gray-500">Chargement…</p>
        ) : (
          <>
            <table className="mb-4 min-w-full table-auto border border-gray-200">
              <thead>
                <tr className="bg-gray-100">
                  <th className="border px-3 py-2 text-left">Profil</th>
                  <th className="border px-3 py-2 text-left">Statut</th>
                  <th className="border px-3 py-2 text-left">Source</th>
                  <th className="border px-3 py-2 text-left">Actions</th>
                </tr>
              </thead>
              <tbody>
                {profiles.map((p) => (
                  <tr key={p.id}>
                    <td className="border px-3 py-2">{PROFILE_LABELS[p.profileType] || p.profileType}</td>
                    <td className="border px-3 py-2">
                      <span className={`rounded-full px-2 py-1 text-xs font-medium ${STATUS_STYLES[p.status] || 'bg-gray-100 text-gray-700'}`}>
                        {STATUS_LABELS[p.status] || p.status}
                      </span>
                    </td>
                    <td className="border px-3 py-2 text-sm text-gray-500">{p.source}</td>
                    <td className="border px-3 py-2">
                      <div className="flex flex-wrap gap-2">
                        {p.status === 'active' && (
                          <button
                            disabled={busy}
                            onClick={() => {
                              const reason = window.prompt('Motif de suspension ?');
                              if (reason) runAction(() => suspendProfile(userId, p.profileType, reason));
                            }}
                            className="rounded bg-gold px-2 py-1 text-xs text-white hover:bg-yellow-600 disabled:opacity-60"
                          >
                            Suspendre
                          </button>
                        )}
                        {p.status !== 'active' && (
                          <button
                            disabled={busy}
                            onClick={() => runAction(() => grantProfile(userId, p.profileType))}
                            className="rounded bg-blue-500 px-2 py-1 text-xs text-white hover:bg-blue-600 disabled:opacity-60"
                          >
                            Réactiver
                          </button>
                        )}
                        {p.status !== 'revoked' && (
                          <button
                            disabled={busy}
                            onClick={() => {
                              const reason = window.prompt('Motif de révocation ?');
                              if (reason) runAction(() => revokeProfile(userId, p.profileType, reason));
                            }}
                            className="rounded bg-red-500 px-2 py-1 text-xs text-white hover:bg-red-600 disabled:opacity-60"
                          >
                            Révoquer
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {profiles.length === 0 && (
                  <tr>
                    <td colSpan={4} className="border px-3 py-4 text-center text-gray-500">
                      Aucun profil accordé explicitement.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>

            {derivedOnly.length > 0 && (
              <p className="mb-4 text-sm text-gray-500">
                Dérivés automatiquement des données existantes (non stockés) : {derivedOnly.map((t) => PROFILE_LABELS[t] || t).join(', ')}.
              </p>
            )}

            {grantableTypes.length > 0 && (
              <div className="flex flex-wrap items-end gap-2 border-t pt-4">
                <label className="text-sm">
                  Accorder un profil :
                  <select
                    value={newProfileType}
                    onChange={(e) => setNewProfileType(e.target.value)}
                    className="ml-2 rounded border px-2 py-1"
                  >
                    {grantableTypes.map((t) => <option key={t} value={t}>{PROFILE_LABELS[t]}</option>)}
                  </select>
                </label>
                <button
                  disabled={busy}
                  onClick={() => runAction(() => grantProfile(userId, newProfileType))}
                  className="rounded bg-green-600 px-3 py-1.5 text-sm text-white hover:bg-green-700 disabled:opacity-60"
                >
                  Accorder
                </button>
              </div>
            )}
          </>
        )}

        <div className="mt-6 flex justify-end">
          <button onClick={onClose} className="rounded bg-gray-300 px-4 py-2 hover:bg-gray-400">
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
}
