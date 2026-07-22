"use client";
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import { cancelTenantInvitation, getTenantLinkRequests, resendTenantInvitation, reviewTenantLinkRequest } from '../../services/gestionLocativeService';

const labels = { invitation: 'Invitation', self_request: 'Demande', pending: 'En attente', accepted: 'Acceptée', approved: 'Validée', rejected: 'Refusée', expired: 'Expirée', cancelled: 'Annulée' };
const date = (value) => value ? new Date(value).toLocaleDateString('fr-FR') : '—';
export default function TenantLinkManagement() {
  const [filters, setFilters] = useState({ type: '', status: '', search: '', page: 1, limit: 10 });
  const [data, setData] = useState({ requests: [], pagination: { page: 1, pages: 1, total: 0 } });
  const [state, setState] = useState({ loading: true, error: '', actionId: '' });
  const load = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: '' }));
    try { setData(await getTenantLinkRequests({ ...filters, type: filters.type || undefined, status: filters.status || undefined, search: filters.search || undefined })); }
    catch (error) { const code = error.response?.status; setState((s) => ({ ...s, error: code === 401 ? 'Session expirée. Reconnectez-vous.' : code === 403 ? 'Vous ne disposez pas des permissions nécessaires.' : 'Impossible de charger les rattachements.' })); }
    finally { setState((s) => ({ ...s, loading: false })); }
  }, [filters]);
  useEffect(() => { const timer = setTimeout(load, filters.search ? 250 : 0); return () => clearTimeout(timer); }, [load, filters.search]);
  const action = async (item, kind) => {
    if (state.actionId) return;
    if (['reject', 'cancel'].includes(kind) && !window.confirm(kind === 'reject' ? 'Refuser cette demande ?' : 'Annuler cette invitation ?')) return;
    setState((s) => ({ ...s, actionId: item._id }));
    try {
      if (kind === 'approve') await reviewTenantLinkRequest(item._id, 'approved');
      if (kind === 'reject') await reviewTenantLinkRequest(item._id, 'rejected');
      if (kind === 'resend') await resendTenantInvitation(item._id);
      if (kind === 'cancel') await cancelTenantInvitation(item._id);
      toast.success('Action effectuée.'); await load();
    } catch (error) { toast.error(error.response?.data?.message || "L'action a échoué."); }
    finally { setState((s) => ({ ...s, actionId: '' })); }
  };
  return <section className="mt-8 rounded-xl border bg-white p-5" aria-label="Gestion des rattachements locataires">
    <div className="flex flex-wrap items-end justify-between gap-3"><div><h3 className="text-lg font-bold">Invitations et rattachements</h3><p className="text-sm text-gray-500">Suivi des accès au portail locataire.</p></div><div className="flex flex-wrap gap-2"><input aria-label="Rechercher un rattachement" value={filters.search} onChange={(e)=>setFilters((f)=>({...f,search:e.target.value,page:1}))} placeholder="Nom, email, téléphone, référence" className="rounded-lg border px-3 py-2 text-sm"/><select aria-label="Filtrer par type" value={filters.type} onChange={(e)=>setFilters((f)=>({...f,type:e.target.value,page:1}))} className="rounded-lg border px-3 py-2 text-sm"><option value="">Tous les types</option><option value="invitation">Invitations</option><option value="self_request">Demandes</option></select><select aria-label="Filtrer par statut" value={filters.status} onChange={(e)=>setFilters((f)=>({...f,status:e.target.value,page:1}))} className="rounded-lg border px-3 py-2 text-sm"><option value="">Tous les statuts</option>{['pending','accepted','approved','rejected','expired','cancelled'].map((v)=><option key={v} value={v}>{labels[v]}</option>)}</select></div></div>
    {state.loading ? <p className="py-8 text-center text-gray-500">Chargement des rattachements…</p> : state.error ? <div role="alert" className="my-5 rounded-lg bg-red-50 p-4 text-red-700">{state.error}<button onClick={load} className="ml-3 underline">Réessayer</button></div> : !data.requests.length ? <p className="py-8 text-center text-gray-500">Aucun rattachement pour ces critères.</p> : <div className="mt-4 overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr className="border-b text-gray-500"><th className="py-2">Type / statut</th><th>Locataire</th><th>Compte</th><th>Dates</th><th>Actions</th></tr></thead><tbody>{data.requests.map((item)=><tr key={item._id} className="border-b"><td className="py-3"><strong>{labels[item.type]}</strong><div>{labels[item.status]}</div><small className="text-gray-400">{item._id}</small></td><td>{item.locataire ? `${item.locataire.prenom || ''} ${item.locataire.nom || ''}` : '—'}<div className="text-xs text-gray-500">{item.locataire?.email || item.locataire?.telephone || ''}</div></td><td>{item.user?.name || '—'}<div className="text-xs text-gray-500">{item.user?.email || ''}</div></td><td>Créée {date(item.createdAt)}<div className="text-xs text-gray-500">Expiration {date(item.tokenExpiresAt)}</div></td><td><div className="flex flex-wrap gap-1">{item.type==='self_request'&&item.status==='pending'&&<><button disabled={!!state.actionId} onClick={()=>action(item,'approve')} className="rounded bg-green-600 px-2 py-1 text-white disabled:opacity-50">Valider</button><button disabled={!!state.actionId} onClick={()=>action(item,'reject')} className="rounded bg-red-600 px-2 py-1 text-white disabled:opacity-50">Refuser</button></>}{item.type==='invitation'&&['pending','expired','cancelled'].includes(item.status)&&<button disabled={!!state.actionId} onClick={()=>action(item,'resend')} className="rounded bg-blue-600 px-2 py-1 text-white disabled:opacity-50">Relancer</button>}{item.type==='invitation'&&item.status==='pending'&&<button disabled={!!state.actionId} onClick={()=>action(item,'cancel')} className="rounded border px-2 py-1 disabled:opacity-50">Annuler</button>}</div></td></tr>)}</tbody></table></div>}
    {data.pagination?.pages>1&&<div className="mt-4 flex justify-center gap-3"><button disabled={filters.page<=1} onClick={()=>setFilters((f)=>({...f,page:f.page-1}))} className="rounded border px-3 py-1 disabled:opacity-40">Précédent</button><span>Page {data.pagination.page} / {data.pagination.pages}</span><button disabled={filters.page>=data.pagination.pages} onClick={()=>setFilters((f)=>({...f,page:f.page+1}))} className="rounded border px-3 py-1 disabled:opacity-40">Suivant</button></div>}
  </section>;
}
