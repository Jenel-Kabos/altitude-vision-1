"use client";

// F-U2.13 — Conditions contractuelles des baux du locataire. Pour la gestion
// déléguée à Altitude Vision, acceptation EXPLICITE après consultation du
// document complet (case non cochée par défaut). L'acceptation authentifiée
// n'est pas une signature électronique qualifiée.
import React, { useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import { acceptTenantLeasePolicy, getTenantLeasePolicies, presentTenantLeasePolicy } from '../../services/tenantPortalService';

const date = (value) => (value ? new Date(value).toLocaleDateString('fr-FR', { timeZone: 'Africa/Brazzaville' }) : '—');
const TYPE_LABEL = { ALTITUDE_DELEGATED: 'Gestion déléguée à Altitude Vision', OWNER_AUTONOMOUS: 'Conditions convenues avec votre bailleur' };

export default function TenantLeasePoliciesPanel() {
  const [policies, setPolicies] = useState(null);
  const [shown, setShown] = useState(null);
  const [checked, setChecked] = useState(false);
  const [busy, setBusy] = useState(false);
  const load = () => getTenantLeasePolicies().then(setPolicies).catch(() => setPolicies([]));
  useEffect(() => { load(); }, []);

  const open = async (policyId) => {
    try { setShown({ policyId, ...(await presentTenantLeasePolicy(policyId)) }); setChecked(false); }
    catch (error) { toast.error(error?.response?.data?.message || 'Conditions indisponibles.'); }
  };
  const accept = async () => {
    setBusy(true);
    try { await acceptTenantLeasePolicy(shown.policyId, shown); toast.success('Acceptation enregistrée.'); setShown(null); await load(); }
    catch (error) { toast.error(error?.response?.data?.message || 'Acceptation refusée.'); } finally { setBusy(false); }
  };

  if (!policies) return <p className="text-slate-500">Chargement…</p>;
  if (!policies.length) return <p className="text-slate-500">Aucune condition contractuelle enregistrée pour vos baux.</p>;
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="mb-3 text-lg font-bold text-slate-900">Conditions de mes baux</h2>
      <ul className="divide-y divide-slate-100">
        {policies.map((policy) => (
          <li key={policy.id} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm">
            <span>{TYPE_LABEL[policy.type]} · version {policy.version} · en vigueur depuis le {date(policy.effectiveFrom)}{policy.consent.status === 'ACCEPTED' ? ` · acceptées le ${date(policy.consent.acceptedAt)}` : ''}</span>
            <button onClick={() => open(policy.id)} className="rounded-xl border border-blue-700 px-3 py-1 font-semibold text-blue-700">{policy.consentRequired && policy.consent.status !== 'ACCEPTED' ? 'Consulter et accepter' : 'Consulter'}</button>
          </li>
        ))}
      </ul>
      {shown && (
        <div className="mt-4 rounded-xl bg-slate-50 p-4 text-sm" role="dialog" aria-label="Conditions du bail">
          <p className="mb-2 font-semibold">{shown.document.title}</p>
          <ul className="mb-3 list-disc space-y-1 pl-5">{shown.document.clauses.map((clause) => <li key={clause}>{clause}</li>)}</ul>
          <p className="mb-3 text-xs text-slate-500">Référence : {shown.document.documentReference} · empreinte {String(shown.documentHash).slice(0, 12)}… · {shown.document.legalNotice}</p>
          {shown.presentationToken ? (
            <>
              <label className="mb-3 flex items-start gap-2"><input type="checkbox" checked={checked} onChange={(e) => setChecked(e.target.checked)} className="mt-1" /> J’ai lu l’intégralité de ces conditions et je les accepte.</label>
              <div className="flex gap-2">
                <button disabled={!checked || busy} onClick={accept} className="rounded-xl bg-blue-700 px-4 py-2 font-semibold text-white disabled:opacity-50">Accepter les conditions</button>
                <button onClick={() => setShown(null)} className="rounded-xl border px-4 py-2">Fermer</button>
              </div>
            </>
          ) : <button onClick={() => setShown(null)} className="rounded-xl border px-4 py-2">Fermer</button>}
        </div>
      )}
    </section>
  );
}
