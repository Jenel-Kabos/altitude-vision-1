"use client";

import { useCallback, useEffect, useRef, useState } from 'react';
import { Building2, FileCheck2, RefreshCw, Search } from 'lucide-react';
import toast from 'react-hot-toast';
import { usePlatformTenantRuntime } from '../../context/PlatformTenantRuntimeContext';
import {
  approveTenantApplication,
  getTenantApplication,
  listTenantApplications,
  openTenantApplicationDocument,
  rejectTenantApplication,
  requestTenantApplicationChanges,
  startTenantApplicationReview,
} from '../../services/tenantApplicationReviewService';
import {
  DashboardBadge,
  DashboardCard,
  DashboardPage,
  DashboardPageHeader,
  DashboardPagination,
  DashboardSection,
  DashboardState,
  DashboardTableContainer,
  DashboardToolbar,
} from '../../components/dashboard/DashboardUI';

const STATUS = {
  DRAFT: ['Brouillon', 'neutral'], SUBMITTED: ['Soumise', 'blue'], UNDER_REVIEW: ['En cours d’examen', 'gold'],
  ADDITIONAL_INFO_REQUIRED: ['Complément demandé', 'orange'], APPROVED: ['Approuvée', 'green'], REJECTED: ['Rejetée', 'red'],
};
const CATEGORIES = {
  responsible_person_identity: 'Identité du responsable',
  professional_business_existence: 'Existence professionnelle / activité',
  establishment_authority: 'Lien avec l’établissement',
  establishment_context: 'Éléments concernant l’établissement',
};
const REQUEST_FIELDS = {
  organizationName: 'Nom de l’organisation', organizationType: 'Type d’organisation',
  professionalContact: 'Coordonnées professionnelles', businessDeclaration: 'Déclaration d’activité',
  establishmentContext: 'Premier établissement',
};
const fmtDate = (value) => value ? new Date(value).toLocaleDateString('fr-FR') : '—';
const errorMessage = (error) => error.response?.data?.message || 'Une erreur est survenue. Veuillez réessayer.';

function StatusBadge({ status }) {
  const [label, tone] = STATUS[status] || [status || 'Inconnu', 'neutral'];
  return <DashboardBadge tone={tone}>{label}</DashboardBadge>;
}

function ConfirmPanel({ title, children, confirmLabel, onConfirm, onCancel, busy, danger = false }) {
  const dialogRef = useRef(null);
  useEffect(() => {
    const dialog = dialogRef.current;
    const previousFocus = document.activeElement;
    dialog?.querySelector('textarea, input, button')?.focus();
    const closeOnEscape = (event) => { if (event.key === 'Escape' && !busy) onCancel(); };
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('keydown', closeOnEscape);
      previousFocus?.focus?.();
    };
  }, [busy, onCancel]);
  return <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="decision-title" className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
    <div className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl">
      <h2 id="decision-title" className="text-xl font-semibold text-slate-900">{title}</h2>
      <div className="mt-4">{children}</div>
      <div className="mt-6 flex flex-wrap justify-end gap-3">
        <button type="button" onClick={onCancel} disabled={busy} className="rounded-lg border px-4 py-2">Annuler</button>
        <button type="button" onClick={onConfirm} disabled={busy} className={`rounded-lg px-4 py-2 text-white ${danger ? 'bg-red-700' : 'bg-slate-900'}`}>{busy ? 'Traitement…' : confirmLabel}</button>
      </div>
    </div>
  </div>;
}

export default function TenantApplicationsPage() {
  const { can } = usePlatformTenantRuntime();
  const mayRead = can('platform.tenant_applications.read');
  const [filters, setFilters] = useState({ status: '', organizationName: '', applicant: '', from: '', to: '' });
  const [query, setQuery] = useState(filters);
  const [page, setPage] = useState(1);
  const [data, setData] = useState({ applications: [], pagination: { page: 1, pages: 1, total: 0 } });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [mutation, setMutation] = useState(null);
  const [decision, setDecision] = useState(null);
  const [reason, setReason] = useState('');
  const [requestedFields, setRequestedFields] = useState([]);
  const [requestedCategories, setRequestedCategories] = useState([]);
  const mutationLock = useRef(false);

  const load = useCallback(async () => {
    if (!mayRead) return;
    setLoading(true); setError('');
    try {
      setData(await listTenantApplications({ ...query, page, limit: 20 }));
    } catch (requestError) {
      setError(errorMessage(requestError));
    } finally { setLoading(false); }
  }, [mayRead, page, query]);

  useEffect(() => { load(); }, [load]);

  const open = async (id) => {
    setDetailLoading(true); setError('');
    try { setSelected(await getTenantApplication(id)); }
    catch (requestError) { setError(errorMessage(requestError)); }
    finally { setDetailLoading(false); }
  };

  const refreshSelected = async () => {
    if (!selected?.id) return;
    setSelected(await getTenantApplication(selected.id));
    await load();
  };

  const act = async (name, operation) => {
    if (mutationLock.current) return;
    mutationLock.current = true;
    setMutation(name); setError('');
    try {
      await operation();
      await refreshSelected();
      setDecision(null); setReason(''); setRequestedFields([]); setRequestedCategories([]);
      toast.success('Dossier actualisé.');
    } catch (requestError) {
      if (requestError.response?.status === 409) {
        await refreshSelected().catch(() => undefined);
        setError('Cette demande a été modifiée par un autre opérateur. Son état actuel a été rechargé.');
      } else setError(errorMessage(requestError));
    } finally { mutationLock.current = false; setMutation(null); }
  };

  const viewDocument = async (document) => {
    try { await openTenantApplicationDocument(selected.id, document); }
    catch { setError('Ce justificatif privé ne peut pas être ouvert. Réessayez.'); }
  };

  if (!mayRead) return <DashboardPage><DashboardState type="error" title="Accès non autorisé" description="Une capacité opérateur plateforme explicite est requise." /></DashboardPage>;

  return <DashboardPage>
    <DashboardPageHeader icon={Building2} eyebrow="Plateforme" title="Demandes d’activation professionnelle" description="Examinez les organisations avant l’activation de leur espace professionnel." />
    <DashboardToolbar>
      <form className="grid w-full gap-3 md:grid-cols-3 xl:grid-cols-6" onSubmit={(event) => { event.preventDefault(); setPage(1); setQuery(filters); }}>
        <label className="text-sm">Statut<select aria-label="Statut" value={filters.status} onChange={(event) => setFilters({ ...filters, status: event.target.value })} className="mt-1 w-full rounded-lg border p-2"><option value="">Tous</option>{Object.entries(STATUS).map(([value, [label]]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <label className="text-sm">Organisation<input aria-label="Organisation" value={filters.organizationName} onChange={(event) => setFilters({ ...filters, organizationName: event.target.value })} className="mt-1 w-full rounded-lg border p-2" /></label>
        <label className="text-sm">Demandeur<input aria-label="Identifiant demandeur" value={filters.applicant} onChange={(event) => setFilters({ ...filters, applicant: event.target.value })} className="mt-1 w-full rounded-lg border p-2" placeholder="Identifiant exact" /></label>
        <label className="text-sm">Du<input aria-label="Date de début" type="date" value={filters.from} onChange={(event) => setFilters({ ...filters, from: event.target.value })} className="mt-1 w-full rounded-lg border p-2" /></label>
        <label className="text-sm">Au<input aria-label="Date de fin" type="date" value={filters.to} onChange={(event) => setFilters({ ...filters, to: event.target.value })} className="mt-1 w-full rounded-lg border p-2" /></label>
        <div className="flex items-end gap-2"><button type="submit" className="flex min-h-10 items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-white"><Search size={16} />Filtrer</button><button type="button" aria-label="Actualiser" onClick={load} className="min-h-10 rounded-lg border p-2"><RefreshCw size={16} /></button></div>
      </form>
    </DashboardToolbar>
    {error && <p role="alert" className="my-4 rounded-lg bg-red-50 p-3 text-red-800">{error}</p>}
    {loading ? <DashboardState type="loading" title="Chargement des demandes…" /> : !data.applications.length ? <DashboardState title={Object.values(query).some(Boolean) ? 'Aucune demande correspondante' : 'Aucune demande'} description="Aucun dossier ne correspond aux critères actuels." /> : <>
      <DashboardTableContainer label="Demandes d’activation professionnelle">
        <table className="w-full min-w-[760px]"><thead><tr><th>Organisation</th><th>Demandeur</th><th>Statut</th><th>Soumise</th><th>Mise à jour</th><th>Action</th></tr></thead><tbody>{data.applications.map((application) => <tr key={application.id}><td>{application.organizationName}</td><td>{application.applicant?.name || 'Demandeur enregistré'}</td><td><StatusBadge status={application.status} /></td><td>{fmtDate(application.submittedAt)}</td><td>{fmtDate(application.updatedAt)}</td><td><button type="button" aria-label={`Consulter ${application.organizationName}`} onClick={() => open(application.id)}>Consulter</button></td></tr>)}</tbody></table>
      </DashboardTableContainer>
      <DashboardPagination page={data.pagination.page || page} totalPages={data.pagination.pages || 1} onPrevious={() => setPage((value) => value - 1)} onNext={() => setPage((value) => value + 1)} />
    </>}

    {detailLoading && <DashboardState type="loading" title="Chargement du dossier…" />}
    {selected && !detailLoading && <ApplicationDetail application={selected} can={can} onClose={() => setSelected(null)} onDocument={viewDocument} onStart={() => act('review', () => startTenantApplicationReview(selected.id))} onDecision={setDecision} />}

    {decision === 'changes' && <ConfirmPanel title="Demander un complément" confirmLabel="Envoyer la demande" busy={Boolean(mutation)} onCancel={() => setDecision(null)} onConfirm={() => {
      if (!reason.trim() || (!requestedFields.length && !requestedCategories.length)) { setError('Indiquez un message et au moins un élément à compléter.'); return; }
      act('changes', () => requestTenantApplicationChanges(selected.id, { reason: reason.trim(), requestedFields, requestedDocumentCategories: requestedCategories }));
    }}><DecisionReason value={reason} onChange={setReason} label="Message communiqué au demandeur" /><ChoiceList title="Informations à corriger" values={REQUEST_FIELDS} selected={requestedFields} onChange={setRequestedFields} /><ChoiceList title="Justificatifs à compléter" values={CATEGORIES} selected={requestedCategories} onChange={setRequestedCategories} /></ConfirmPanel>}

    {decision === 'reject' && <ConfirmPanel title="Rejeter la demande" confirmLabel={reason.trim() ? 'Continuer' : 'Motif requis'} danger busy={Boolean(mutation)} onCancel={() => setDecision(null)} onConfirm={() => reason.trim() && setDecision('reject-confirm')}><DecisionReason value={reason} onChange={setReason} label="Motif communiqué au demandeur" /></ConfirmPanel>}
    {decision === 'reject-confirm' && <ConfirmPanel title="Confirmer le rejet de cette demande ?" confirmLabel="Confirmer le rejet" danger busy={Boolean(mutation)} onCancel={() => setDecision('reject')} onConfirm={() => act('reject', () => rejectTenantApplication(selected.id, reason.trim()))}><p className="rounded-lg bg-red-50 p-3 text-red-900">{reason}</p></ConfirmPanel>}
    {decision === 'approve' && <ConfirmPanel title="Approuver et activer l’organisation ?" confirmLabel="Confirmer l’approbation" busy={Boolean(mutation)} onCancel={() => setDecision(null)} onConfirm={() => act('approve', () => approveTenantApplication(selected.id))}><p>Organisation : <strong>{selected.organizationName}</strong></p><p>Demandeur : <strong>{selected.applicant?.name || 'Demandeur enregistré'}</strong></p><p className="mt-3">Cette action approuvera la demande et créera l’organisation professionnelle associée. L’hôtel conservera son propre processus de validation et de publication.</p></ConfirmPanel>}
  </DashboardPage>;
}

function DecisionReason({ value, onChange, label }) {
  return <label className="block text-sm font-medium">{label}<textarea aria-label={label} required value={value} onChange={(event) => onChange(event.target.value)} className="mt-1 min-h-28 w-full rounded-lg border p-3" /></label>;
}

function ChoiceList({ title, values, selected, onChange }) {
  return <fieldset className="mt-4"><legend className="font-medium">{title}</legend><div className="mt-2 grid gap-2 sm:grid-cols-2">{Object.entries(values).map(([value, label]) => <label key={value} className="flex gap-2 rounded-lg border p-3"><input type="checkbox" checked={selected.includes(value)} onChange={() => onChange(selected.includes(value) ? selected.filter((item) => item !== value) : [...selected, value])} />{label}</label>)}</div></fieldset>;
}

function ApplicationDetail({ application, can, onClose, onDocument, onStart, onDecision }) {
  const documentsByCategory = Object.keys(CATEGORIES).map((category) => [category, (application.documents || []).filter((document) => document.category === category)]);
  return <DashboardCard className="mt-6">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-sm text-slate-500">Dossier d’activation</p><h2 className="text-2xl font-semibold">{application.organizationName}</h2><StatusBadge status={application.status} /></div><button type="button" onClick={onClose} className="rounded-lg border px-3 py-2">Fermer</button></div>
    {application.status === 'APPROVED' && <p className="mt-4 rounded-lg bg-green-50 p-4 font-semibold text-green-800">Organisation activée</p>}
    {application.status === 'REJECTED' && <p className="mt-4 rounded-lg bg-red-50 p-4 text-red-900"><strong>Motif communiqué au demandeur :</strong> {application.rejectionReason || 'Motif indisponible.'}</p>}
    <div className="mt-6 grid gap-5 lg:grid-cols-2">
      <DashboardSection title="Organisation"><Detail label="Type" value={application.organizationType} /><Detail label="Déclaration d’activité" value={application.businessDeclaration} /></DashboardSection>
      <DashboardSection title="Demandeur"><Detail label="Nom" value={application.applicant?.name} /><Detail label="E-mail" value={application.applicant?.email} /><Detail label="Profil" value={application.applicant?.role} /></DashboardSection>
      <DashboardSection title="Coordonnées professionnelles"><Detail label="E-mail" value={application.professionalContact?.email} /><Detail label="Téléphone" value={application.professionalContact?.phone} /><Detail label="Adresse" value={[application.professionalContact?.address, application.professionalContact?.city, application.professionalContact?.country].filter(Boolean).join(', ')} /></DashboardSection>
      <DashboardSection title="Premier établissement"><Detail label="Nom" value={application.establishmentContext?.name} /><Detail label="Adresse" value={[application.establishmentContext?.address, application.establishmentContext?.city].filter(Boolean).join(', ')} /></DashboardSection>
    </div>
    <DashboardSection title="Pièces justificatives" description="Documents privés, chargés uniquement à votre demande." className="mt-6"><div className="grid gap-4 md:grid-cols-2">{documentsByCategory.map(([category, documents]) => <div key={category} className="rounded-xl border p-4"><h3 className="font-semibold">{CATEGORIES[category]}</h3>{documents.length ? documents.sort((a, b) => b.revision - a.revision).map((document) => <div key={document.id} className="mt-3 flex items-center justify-between gap-3"><div><p>{document.displayName}</p><p className="text-sm text-slate-500">Version {document.revision} · {document.mimeType}</p></div><button type="button" aria-label={`Ouvrir ${document.displayName}`} onClick={() => onDocument(document)} className="rounded-lg border px-3 py-2"><FileCheck2 size={16} /></button></div>) : <p className="mt-2 text-sm text-slate-500">Aucun justificatif.</p>}</div>)}</div></DashboardSection>
    {application.additionalInfo?.reason && <DashboardSection title="Complément demandé" className="mt-6"><p>{application.additionalInfo.reason}</p></DashboardSection>}
    <DashboardSection title="Historique" className="mt-6"><ol className="space-y-2">{(application.history || []).map((entry, index) => <li key={`${entry.at}-${index}`} className="rounded-lg bg-slate-50 p-3"><StatusBadge status={entry.to} /> <span className="text-sm text-slate-600">{fmtDate(entry.at)}</span>{entry.reason ? <p className="mt-1">{entry.reason}</p> : null}</li>)}</ol></DashboardSection>
    <div className="mt-6 flex flex-wrap gap-3">
      {application.status === 'SUBMITTED' && can('platform.tenant_applications.review') && <button type="button" onClick={onStart} className="rounded-lg bg-slate-900 px-4 py-2 text-white">Commencer l’examen</button>}
      {application.status === 'UNDER_REVIEW' && can('platform.tenant_applications.request_changes') && <button type="button" onClick={() => onDecision('changes')} className="rounded-lg border px-4 py-2">Demander un complément</button>}
      {application.status === 'UNDER_REVIEW' && can('platform.tenant_applications.reject') && <button type="button" onClick={() => onDecision('reject')} className="rounded-lg bg-red-700 px-4 py-2 text-white">Rejeter la demande</button>}
      {application.status === 'UNDER_REVIEW' && can('platform.tenant_applications.approve') && <button type="button" onClick={() => onDecision('approve')} className="rounded-lg bg-green-700 px-4 py-2 text-white">Approuver et activer l’organisation</button>}
    </div>
  </DashboardCard>;
}

function Detail({ label, value }) { return <p className="mt-2"><span className="font-medium">{label} :</span> {value || '—'}</p>; }
