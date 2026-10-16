"use client";

// F-U1.I — Espace personnel : la personne concernée consulte et complète son
// propre dossier KYC (y compris sans organisation). Aucun droit plateforme
// n'est conféré par ce parcours.
import React, { useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import { DashboardPage, DashboardPageHeader, DashboardState } from '../components/dashboard/DashboardUI';
import KycCaseEditor from '../components/kyc/KycCaseEditor';
import { KYC_PURPOSE_LABELS } from '../components/kyc/kycLabels';
import { useAuth } from '../context/AuthContext';
import { createKycCase, getKycProcedure, listKycCases } from '../services/financialKycService';

export default function FinancialKycPersonalPage() {
  const { user } = useAuth();
  const [procedure, setProcedure] = useState(null);
  const [cases, setCases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [purpose, setPurpose] = useState('OWNER_FINANCIAL_OPERATIONS');
  const userId = String(user?._id || user?.id || '');

  const load = async () => {
    setLoading(true);
    try {
      const [proc, list] = await Promise.all([getKycProcedure(), listKycCases()]);
      setProcedure(proc);
      setCases(list.filter((item) => String(item.subject) === userId));
    } catch (error) {
      toast.error(error?.response?.data?.message || 'Dossiers indisponibles.');
    } finally { setLoading(false); }
  };
  useEffect(() => { if (userId) load(); }, [userId]); // eslint-disable-line react-hooks/exhaustive-deps

  const start = async () => {
    try { await createKycCase({ purpose }); toast.success('Dossier créé.'); await load(); } catch (error) { toast.error(error?.response?.data?.message || 'Création impossible.'); }
  };
  const replace = (updated) => setCases((previous) => previous.map((item) => (item.id === updated.id ? updated : item)));

  return (
    <DashboardPage className="mx-auto max-w-4xl px-4 py-8">
      <DashboardPageHeader eyebrow="Mon compte" title="Vérification d’identité" description="Votre dossier est examiné uniquement par des agents Altitude Vision habilités. Une identité attestée n’accorde, à elle seule, aucun pouvoir financier." />
      {loading ? <DashboardState title="Chargement…" /> : (
        <div className="grid gap-4">
          {!cases.some((item) => !['cancelled', 'rejected', 'revoked', 'expired'].includes(item.status)) && (
            <div className="flex flex-wrap items-end gap-2 rounded-lg border p-4">
              <label className="text-sm">Motif
                <select value={purpose} onChange={(event) => setPurpose(event.target.value)} className="mt-1 block rounded-lg border px-3 py-2">
                  {Object.entries(KYC_PURPOSE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </label>
              <button onClick={start} className="rounded-lg bg-blue-700 px-4 py-2 font-semibold text-white">Démarrer mon dossier</button>
            </div>
          )}
          {!cases.length && <DashboardState title="Aucun dossier" description="Créez un dossier si une vérification d’identité vous a été demandée." />}
          {cases.map((item) => <KycCaseEditor key={item.id} kycCase={item} procedure={procedure} isSubject onChange={replace} />)}
        </div>
      )}
    </DashboardPage>
  );
}
