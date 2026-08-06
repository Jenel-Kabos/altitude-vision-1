"use client";

import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, History, Link2, PlusCircle, Search } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { DashboardPage, DashboardPageHeader, DashboardCard, DashboardState } from '../../components/dashboard/DashboardUI';
import { decideRentalRegularization, getRentalRegularizationCases, revertRentalRegularization } from '../../services/gestionLocativeService';
import { useAuth } from '../../context/AuthContext';

const formatDate = (value) => value ? new Date(value).toLocaleDateString('fr-FR') : 'Non renseignée';
const formatMoney = (value) => value ? `${Number(value).toLocaleString('fr-FR')} FCFA` : 'Non renseigné';

const RentalContractRegularizationPage = () => {
  const { user } = useAuth();
  const [cases, setCases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(null);
  const [action, setAction] = useState('link_existing');
  const [propertyId, setPropertyId] = useState('');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [property, setProperty] = useState({ title: '', type: 'Appartement', street: '', city: '', arrondissement: '', monthlyRent: '', surface: '', latitude: '', longitude: '', description: '' });

  const load = async () => {
    setLoading(true);
    try { setCases(await getRentalRegularizationCases()); }
    catch { toast.error('Impossible de charger les contrats historiques.'); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const visible = useMemo(() => cases.filter(({ contract }) => normalize(`${contract._id} ${contract.adresseBien} ${contract.villeBien} ${contract.locataire?.nom} ${contract.proprietaire?.nom}`).includes(normalize(search))), [cases, search]);
  const open = (row) => {
    setSelected(row); setReason(''); setPropertyId(row.compatibleProperties?.[0]?._id || ''); setAction('link_existing');
    setProperty((current) => ({ ...current, street: row.contract.adresseBien || '', city: row.contract.villeBien || '', monthlyRent: row.contract.montantLoyer || '' }));
  };
  const submit = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      await decideRentalRegularization(selected.contract._id, { action, reason, propertyId, ...(action === 'create_internal' ? { property } : {}) });
      toast.success('Décision enregistrée et journalisée.'); setSelected(null); await load();
    } catch (error) { toast.error(error.response?.data?.message || 'Décision refusée.'); }
    finally { setSaving(false); }
  };
  const revert = async (row) => {
    const motive = window.prompt('Motif obligatoire de réversion contrôlée :');
    if (!motive) return;
    try { await revertRentalRegularization(row.contract._id, motive); toast.success('Décision réversée.'); await load(); }
    catch (error) { toast.error(error.response?.data?.message || 'Réversion refusée.'); }
  };

  return <DashboardPage>
    <DashboardPageHeader icon={History} title="Régularisation des contrats historiques" description="Décisions individuelles, explicites et journalisées. Les suggestions ne sont jamais appliquées automatiquement." />
    <div className="mb-5 relative"><Search className="absolute left-3 top-3 h-4 w-4 text-gray-400"/><input aria-label="Rechercher un dossier" value={search} onChange={(e)=>setSearch(e.target.value)} className="w-full rounded-xl border py-2.5 pl-10 pr-3" placeholder="Adresse, ville, locataire, propriétaire ou identifiant"/></div>
    {loading ? <DashboardState title="Chargement…" /> : visible.length === 0 ? <DashboardState title="Aucun dossier à régulariser" /> : <div className="space-y-4">{visible.map((row) => {
      const c=row.contract; return <DashboardCard key={c._id}>
        <div className="flex flex-col gap-4 lg:flex-row lg:justify-between">
          <div className="min-w-0"><p className="font-semibold">{c.adresseBien}, {c.villeBien}</p><p className="text-xs text-gray-500">Contrat #{c._id}</p>
            <div className="mt-3 grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-3"><p><b>Locataire :</b> {c.locataire?.prenom} {c.locataire?.nom}</p><p><b>Propriétaire :</b> {c.proprietaire?.prenom} {c.proprietaire?.nom}</p><p><b>Type de bien :</b> {c.bien?.type || 'Non renseigné dans le contrat'}</p><p><b>Loyer :</b> {formatMoney(c.montantLoyer)}</p><p><b>Entrée :</b> {formatDate(c.dateEntree)}</p><p><b>Fin :</b> {formatDate(c.dateFinBail)}</p><p><b>Documents :</b> {c.documents?.length || 0}</p></div>
            {c.documents?.length > 0 && <ul className="mt-2 list-inside list-disc text-sm text-slate-600">{c.documents.map((document, index) => <li key={document._id || index}>{document.nom || document.name || document.type || `Document ${index + 1}`}</li>)}</ul>}
            {row.missingFields.length>0&&<p className="mt-3 text-xs text-amber-700"><AlertTriangle className="inline h-4 w-4"/> Champs manquants : {row.missingFields.join(', ')}</p>}
            <p className="mt-2 text-xs text-gray-500">{row.compatibleProperties.length} Property compatible(s) suggéré(s) · {row.ownerAssets.length} bien(s) dans la fiche Propriétaire</p>
          </div>
          <div className="flex gap-2"><button onClick={()=>open(row)} className="rounded-lg bg-amber-700 px-4 py-2 text-sm text-white">Examiner</button>{user?.role==='Admin'&&row.decision&&['resolved','anomaly'].includes(row.decision.status)&&<button onClick={()=>revert(row)} className="rounded-lg border px-3 py-2 text-sm">Réverser</button>}</div>
        </div>
      </DashboardCard>})}</div>}

    {selected&&<div role="dialog" aria-modal="true" className="fixed inset-0 z-50 overflow-y-auto bg-black/50 p-4"><div className="mx-auto my-8 max-w-3xl rounded-2xl bg-white p-6 shadow-xl">
      <h2 className="text-xl font-bold">Décider pour le contrat #{selected.contract._id}</h2>
      <div className="mt-4 grid gap-2 sm:grid-cols-2">{[
        ['link_existing','Rattacher à un Property',Link2],['create_internal','Créer un Property interne',PlusCircle],['close_historical','Marquer historique/clôturé',History],['flag_anomaly','Signaler une anomalie',AlertTriangle],
      ].map(([value,label,Icon])=><button key={value} onClick={()=>setAction(value)} className={`rounded-xl border p-3 text-left ${action===value?'border-amber-700 bg-amber-50':''}`}><Icon className="mb-1 h-4 w-4"/>{label}</button>)}</div>
      {action==='link_existing'&&<div className="mt-4"><label className="text-sm font-medium">Property sélectionné</label><select value={propertyId} onChange={(e)=>setPropertyId(e.target.value)} className="mt-1 w-full rounded-lg border p-2"><option value="">Choisir explicitement</option>{selected.compatibleProperties.map((p)=><option key={p._id} value={p._id}>{p.title} — score {p.score}/100 — {p.reasons.join(', ')}</option>)}</select></div>}
      {action==='create_internal'&&<div className="mt-4 grid gap-3 sm:grid-cols-2">{Object.entries(property).map(([key,value])=><label key={key} className="text-sm">{key}<input value={value} onChange={(e)=>setProperty({...property,[key]:e.target.value})} className="mt-1 w-full rounded-lg border p-2"/></label>)}</div>}
      <label className="mt-4 block text-sm font-medium">Motif de la décision<textarea value={reason} onChange={(e)=>setReason(e.target.value)} className="mt-1 min-h-24 w-full rounded-lg border p-2"/></label>
      <div className="mt-5 flex justify-end gap-2"><button onClick={()=>setSelected(null)} className="rounded-lg border px-4 py-2">Annuler</button><button disabled={saving} onClick={submit} className="rounded-lg bg-gray-900 px-4 py-2 text-white disabled:opacity-50">{saving?'Enregistrement…':'Confirmer la décision'}</button></div>
    </div></div>}
  </DashboardPage>;
};

const normalize = (value) => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
export default RentalContractRegularizationPage;
