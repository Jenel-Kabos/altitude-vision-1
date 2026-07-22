"use client";
import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import ProtectedRoute from '../components/ProtectedRoute';
import { activateTenantInvitation } from '../services/tenantPortalService';

function Activation() {
  const params = useSearchParams(); const router = useRouter(); const [status, setStatus] = useState('Activation sécurisée en cours…'); const [error, setError] = useState(false);
  useEffect(() => { const token = params.get('token'); if (!token) { setError(true); setStatus("Le lien d'invitation est incomplet."); return; } activateTenantInvitation(token).then(() => { setStatus('Votre espace est activé. Redirection…'); setTimeout(() => router.replace('/espace-locataire'), 800); }).catch((e) => { setError(true); setStatus(e.response?.data?.message || "L'invitation est invalide ou expirée."); }); }, [params, router]);
  return <main className="min-h-[70vh] grid place-items-center bg-slate-50 px-5"><div className={`max-w-lg rounded-2xl border bg-white p-8 text-center shadow-sm ${error ? 'border-red-200' : 'border-blue-200'}`}><h1 className="text-2xl font-bold">Activation du portail locataire</h1><p className="mt-4 text-slate-600">{status}</p></div></main>;
}
export default function ActivateTenantPortalPage() { return <ProtectedRoute><Activation/></ProtectedRoute>; }
