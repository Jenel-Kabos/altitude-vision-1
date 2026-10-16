"use client";

// PLATFORM-ACCREDITATIONS-1 — fiche d'habilitations d'un utilisateur (Vue
// plateforme, onglet Utilisateurs). Le serveur reste l'autorité : la liste des
// capacités déléguables, l'interdiction d'auto-accréditation et chaque refus
// (capacité non déléguable, administrateur critique, opérateur suspendu…)
// proviennent de /api/platform-operators/:userId/capabilities.
import React, { useCallback, useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { changeDelegatedCapability, getDelegatedCapabilities } from '../../services/platformOperatorService';

const CAPABILITY_LABELS = {
  'platform.support.read': 'Lecture de la boîte de support',
  'platform.support.reply': 'Réponse aux prospects',
  'platform.commercial.manage': 'Gestion commerciale',
  'platform.marketing.manage': 'Gestion marketing',
};
const OPERATOR_STATUS_LABELS = { active: 'Opérateur actif', suspended: 'Opérateur suspendu', revoked: 'Opérateur révoqué' };
const ERROR_MESSAGES = {
  PLATFORM_OPERATOR_SELF_ACTION_FORBIDDEN: 'Vous ne pouvez pas modifier vos propres habilitations.',
  PLATFORM_CAPABILITY_NOT_DELEGABLE: 'Cette capacité ne peut pas être déléguée ici.',
  PLATFORM_CAPABILITY_BENEFICIARY_INELIGIBLE: 'Le compte bénéficiaire n’est pas actif.',
  PLATFORM_CRITICAL_ADMIN_PROTECTED: 'Refusé : capacité requise pour un administrateur critique de la Vue plateforme.',
  PLATFORM_OPERATOR_SUSPENDED: 'Cet opérateur est suspendu : régularisez sa situation d’abord.',
  PLATFORM_OPERATOR_REVOKED: 'Cet opérateur est révoqué : une nouvelle attribution complète est requise.',
  PLATFORM_OPERATOR_PLATFORM_SCOPE_REQUIRED: 'Action possible uniquement en Vue plateforme.',
};
const labelOf = (capability) => CAPABILITY_LABELS[capability] || capability;
const errorOf = (error) => ERROR_MESSAGES[error?.response?.data?.code] || error?.response?.data?.message || 'La modification a été refusée.';

export default function AccreditationsDialog({ userId, userName, onClose }) {
  const [profile, setProfile] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [pending, setPending] = useState(null); // { capability, action }
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState(null); // { tone, message }

  const load = useCallback(async () => {
    try {
      setProfile(await getDelegatedCapabilities(userId));
      setLoadError(null);
    } catch (error) {
      setProfile(null);
      setLoadError(error?.response?.data?.message || 'Impossible de charger les habilitations.');
    }
  }, [userId]);
  useEffect(() => { load(); }, [load]);

  const current = profile?.operator?.capabilities || [];
  const operatorStatus = profile?.operator?.status || null;
  const editable = Boolean(profile) && !profile.self && (!operatorStatus || operatorStatus === 'active');

  const start = (capability, action) => { setPending({ capability, action }); setReason(''); setFeedback(null); };
  const confirm = async () => {
    if (!pending || !reason.trim() || submitting) return;
    setSubmitting(true);
    try {
      await changeDelegatedCapability(userId, { ...pending, reason: reason.trim() });
      setFeedback({ tone: 'success', message: pending.action === 'grant' ? 'Habilitation accordée.' : 'Habilitation retirée.' });
      setPending(null);
      await load();
    } catch (error) {
      setFeedback({ tone: 'error', message: errorOf(error) });
    } finally {
      setSubmitting(false);
    }
  };

  const title = `Habilitations de ${profile?.user?.name || userName}`;
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/60 p-4" role="presentation">
      <section role="dialog" aria-modal="true" aria-label={title} className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-violet-700">Vue plateforme · Habilitations</p>
            <h2 className="mt-1 text-xl font-bold">{title}</h2>
          </div>
          <button type="button" aria-label="Fermer les habilitations" onClick={onClose} className="rounded-full p-2 hover:bg-slate-100"><X size={18} /></button>
        </div>

        {loadError && <p role="alert" className="mt-4 rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-700">{loadError}</p>}
        {!profile && !loadError && <p className="mt-4 text-sm text-slate-500">Chargement…</p>}

        {profile && (
          <>
            <div className="mt-4 rounded-2xl border border-slate-200 p-4 text-sm">
              <p className="font-semibold">{profile.user.name}</p>
              <p className="text-slate-500">{profile.user.email}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${profile.user.isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>{profile.user.isActive ? 'Compte actif' : 'Compte suspendu'}</span>
                <span className="rounded-full bg-violet-50 px-2 py-0.5 text-xs font-semibold text-violet-700">{operatorStatus ? OPERATOR_STATUS_LABELS[operatorStatus] : 'Aucune identité opérateur'}</span>
              </div>
            </div>

            <h3 className="mt-5 text-sm font-bold text-slate-700">Capacités actuelles</h3>
            {current.length === 0
              ? <p className="mt-1 text-sm text-slate-500">Aucune capacité.</p>
              : <ul aria-label="Capacités actuelles" className="mt-2 flex flex-wrap gap-1.5">{current.map((capability) => <li key={capability} className="rounded-lg bg-slate-100 px-2 py-1 font-mono text-xs">{capability}</li>)}</ul>}

            <h3 className="mt-5 text-sm font-bold text-slate-700">Capacités pouvant être attribuées</h3>
            {profile.self && <p className="mt-1 text-sm text-amber-700">Vous ne pouvez pas modifier vos propres habilitations.</p>}
            {!profile.self && operatorStatus && operatorStatus !== 'active' && <p className="mt-1 text-sm text-amber-700">Régularisez le statut de cet opérateur avant toute modification.</p>}
            <ul aria-label="Capacités pouvant être attribuées" className="mt-2 divide-y divide-slate-100 rounded-2xl border border-slate-200">
              {profile.delegableCapabilities.map((capability) => {
                const held = current.includes(capability);
                const action = held ? 'revoke' : 'grant';
                return (
                  <li key={capability} className="flex items-center justify-between gap-3 px-4 py-3">
                    <div>
                      <p className="text-sm font-semibold">{labelOf(capability)}</p>
                      <p className="font-mono text-xs text-slate-500">{capability}{held ? ' · accordée' : ''}</p>
                    </div>
                    {editable && (
                      <button type="button" aria-label={`${held ? 'Retirer' : 'Accorder'} ${labelOf(capability)}`} disabled={submitting} onClick={() => start(capability, action)}
                        className={`rounded-xl px-3 py-1.5 text-sm font-semibold ${held ? 'border border-red-200 text-red-700' : 'bg-violet-600 text-white'}`}>
                        {held ? 'Retirer' : 'Accorder'}
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>

            {pending && (
              <div className="mt-5 rounded-2xl border border-violet-200 bg-violet-50 p-4">
                <p className="text-sm font-semibold">{pending.action === 'grant' ? 'Accorder' : 'Retirer'} « {labelOf(pending.capability)} » à {profile.user.name} ?</p>
                <label className="mt-3 block text-sm font-semibold text-slate-700">Motif
                  <textarea aria-label="Motif" value={reason} onChange={(event) => setReason(event.target.value)} rows={2} className="mt-1 w-full rounded-xl border border-slate-300 p-2 font-normal" />
                </label>
                <div className="mt-3 flex gap-2">
                  <button type="button" disabled={submitting} onClick={() => setPending(null)} className="flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold">Annuler</button>
                  <button type="button" disabled={submitting || !reason.trim()} onClick={confirm} className="flex-1 rounded-xl bg-violet-700 px-3 py-2 text-sm font-semibold text-white disabled:opacity-40">{submitting ? 'Traitement…' : 'Confirmer'}</button>
                </div>
              </div>
            )}

            {feedback && (
              <p role={feedback.tone === 'success' ? 'status' : 'alert'} className={`mt-4 rounded-xl p-3 text-sm font-semibold ${feedback.tone === 'success' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>{feedback.message}</p>
            )}
          </>
        )}
      </section>
    </div>
  );
}
