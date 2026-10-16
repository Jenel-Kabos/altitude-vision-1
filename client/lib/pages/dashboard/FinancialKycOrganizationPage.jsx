"use client";

// F-U1.I — Niveau 1 : l'organisation prépare les dossiers KYC de ses membres
// et les soumet à Altitude Vision. Elle ne délivre jamais l'attestation.
import React, { useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import { DashboardCard, DashboardPage, DashboardPageHeader, DashboardState } from '../../components/dashboard/DashboardUI';
import KycCaseEditor, { KycStatusBadge } from '../../components/kyc/KycCaseEditor';
import { KYC_PURPOSE_LABELS } from '../../components/kyc/kycLabels';
import { useAuth } from '../../context/AuthContext';
import { createKycCase, getKycProcedure, listKycCases } from '../../services/financialKycService';
import { listMembers } from '../../services/tenantMemberService';

export default function FinancialKycOrganizationPage() {
  const { user } = useAuth();
  const [procedure, setProcedure] = useState(null);
  const [cases, setCases] = useState([]);
  const [members, setMembers] = useState([]);
  const [selected, setSelected] = useState(null);
  const [subjectUserId, setSubjectUserId] = useState('');
  const [loading, setLoading] = useState(true);
  const [denied, setDenied] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [proc, list, memberList] = await Promise.all([getKycProcedure(), listKycCases(), listMembers().catch(() => [])]);
      setProcedure(proc); setCases(list); setMembers(memberList);
    } catch (error) {
      if ([401, 403].includes(error?.response?.status)) setDenied(true);
      else toast.error(error?.response?.data?.message || 'Dossiers indisponibles.');
    } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const create = async () => {
    if (!subjectUserId) return;
    try {
      const created = await createKycCase({ purpose: 'SENSITIVE_FINANCIAL_GRANT', subjectUserId });
      toast.success('Dossier préparé.'); setSubjectUserId(''); await load(); setSelected(created.id);
    } catch (error) { toast.error(error?.response?.data?.message || 'Préparation impossible : habilitation de préparation requise.'); }
  };
  const current = cases.find((item) => item.id === selected);
  const replace = (updated) => setCases((previous) => previous.map((item) => (item.id === updated.id ? updated : item)));
  const memberName = (id) => members.find((m) => String(m.user?._id) === String(id))?.user?.name || 'Membre';

  if (denied) return <DashboardPage><DashboardState title="Accès réservé" description="La préparation des dossiers KYC exige une habilitation explicite de votre organisation." /></DashboardPage>;
  return (
    <DashboardPage>
      <DashboardPageHeader eyebrow="Organisation" title="Dossiers KYC des membres" description="Préparez, complétez et soumettez les dossiers. Seul Altitude Vision délivre l’attestation finale ; elle n’accorde aucune habilitation à elle seule." />
      {loading ? <DashboardState title="Chargement…" /> : (
        <div className="grid gap-4">
          <DashboardCard>
            <div className="flex flex-wrap items-end gap-2">
              <label className="text-sm">Membre concerné
                <select aria-label="Membre concerné" value={subjectUserId} onChange={(event) => setSubjectUserId(event.target.value)} className="mt-1 block rounded-lg border px-3 py-2">
                  <option value="">Choisir…</option>
                  {members.filter((m) => m.status === 'active' && m.user?._id).map((m) => <option key={m.user._id} value={m.user._id}>{m.user.name}</option>)}
                </select>
              </label>
              <button disabled={!subjectUserId} onClick={create} className="rounded-lg bg-blue-700 px-4 py-2 font-semibold text-white disabled:opacity-50">Préparer un dossier</button>
            </div>
          </DashboardCard>
          {!cases.length ? <DashboardState title="Aucun dossier" /> : (
            <ul className="grid gap-2" aria-label="Dossiers">
              {cases.map((item) => (
                <li key={item.id}>
                  <button onClick={() => setSelected(item.id)} className="flex w-full flex-wrap items-center justify-between gap-2 rounded-lg border bg-white p-3 text-left">
                    <span className="font-semibold text-slate-900">{String(item.subject) === String(user?._id || user?.id) ? 'Mon dossier' : memberName(item.subject)} · {KYC_PURPOSE_LABELS[item.purpose]}</span>
                    <KycStatusBadge status={item.status} />
                  </button>
                </li>
              ))}
            </ul>
          )}
          {current && <KycCaseEditor kycCase={current} procedure={procedure} isSubject={String(current.subject) === String(user?._id || user?.id)} onChange={replace} />}
        </div>
      )}
    </DashboardPage>
  );
}
