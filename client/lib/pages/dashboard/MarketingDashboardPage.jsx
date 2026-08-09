'use client';
// MARKETING-AUTOMATION-1 (Phase 8) — Intégration Altcom : tableau de bord,
// bibliothèque de segments (lecture seule, dérivés côté serveur), bibliothèque
// de modèles (versionnés), campagnes (création → approbation humaine
// obligatoire → envoi), journal d'envoi. Consomme exclusivement
// /api/marketing/* et /api/reporting/domains/marketing — aucun calcul KPI
// ni aucune règle de segmentation ici, uniquement de l'affichage et des
// actions déjà validées côté serveur (ex: sendCampaign refuse tout ce qui
// n'est pas status:'approved').
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import { Megaphone, Users, FileText, Send, ClipboardList, Plus, CheckCircle2, XCircle } from 'lucide-react';
import { getDomainReport } from '../../services/reportingService';
import {
  listSegments, previewSegment,
  listTemplates, createTemplateVersion, activateTemplate,
  listCampaigns, createCampaign, approveCampaign, cancelCampaign, sendCampaign,
  listSends,
} from '../../services/marketingService';
import { useAuth } from '../../context/AuthContext';
import { DashboardCard, DashboardPage, DashboardPageHeader, DashboardState, DashboardToolbar } from '../../components/dashboard/DashboardUI';

const TABS = [
  { key: 'overview', label: "Vue d'ensemble", Icon: Megaphone },
  { key: 'segments', label: 'Segments', Icon: Users },
  { key: 'templates', label: 'Modèles', Icon: FileText },
  { key: 'campaigns', label: 'Campagnes', Icon: Send },
  { key: 'sends', label: 'Journal', Icon: ClipboardList },
];

const CHANNELS = ['email', 'push', 'notification', 'sms', 'whatsapp'];

function OverviewTab() {
  const [report, setReport] = useState(null);
  const [state, setState] = useState('loading');

  useEffect(() => {
    getDomainReport('marketing').then((r) => { setReport(r); setState('ready'); })
      .catch(() => setState('error'));
  }, []);

  if (state === 'loading') return <DashboardState type="loading" title="Chargement du reporting marketing…" />;
  if (state === 'error' || !report) return <DashboardState type="error" title="Reporting marketing indisponible." />;

  const { kpis, parCanal } = report;
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Object.entries(kpis || {}).map(([key, value]) => (
          <article key={key} className="rounded-xl border bg-white p-4 shadow-sm">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{key}</p>
            <p className="mt-2 text-xl font-bold text-slate-900">{value ?? '—'}</p>
          </article>
        ))}
      </div>
      <DashboardCard>
        <h2 className="mb-3 text-sm font-semibold text-slate-700">Envois réussis par canal</h2>
        <ul className="flex flex-wrap gap-3">
          {(parCanal || []).map((row) => (
            <li key={row._id} className="rounded-full bg-slate-100 px-3 py-1 text-sm text-slate-700">{row._id} — {row.count}</li>
          ))}
          {(!parCanal || parCanal.length === 0) && <p className="text-sm text-slate-500">Aucun envoi encore enregistré.</p>}
        </ul>
      </DashboardCard>
    </div>
  );
}

function SegmentsTab() {
  const [segments, setSegments] = useState([]);
  const [preview, setPreviewData] = useState(null);
  const [busyKey, setBusyKey] = useState(null);

  useEffect(() => { listSegments().then(setSegments).catch(() => toast.error('Segments indisponibles.')); }, []);

  const doPreview = async (key) => {
    setBusyKey(key);
    try { setPreviewData({ key, ...(await previewSegment(key)) }); }
    catch { toast.error('Aperçu du segment impossible.'); }
    finally { setBusyKey(null); }
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-500">Segments dynamiques, dérivés en temps réel des données réelles (CRM, USER-ARCH, Organisation) — jamais stockés.</p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {segments.map((seg) => (
          <DashboardCard key={seg.key}>
            <h3 className="font-semibold text-slate-900">{seg.label}</h3>
            <p className="mt-1 text-xs text-slate-500">{seg.description}</p>
            <button
              disabled={busyKey === seg.key} onClick={() => doPreview(seg.key)}
              className="mt-3 rounded bg-slate-700 px-3 py-1.5 text-xs text-white hover:bg-slate-800 disabled:opacity-60"
            >
              Aperçu
            </button>
          </DashboardCard>
        ))}
        {segments.length === 0 && <DashboardState type="empty" title="Aucun segment disponible." />}
      </div>
      {preview && (
        <DashboardCard>
          <p className="font-semibold text-slate-900">{preview.segmentKey} — {preview.count} client(s)</p>
          <pre className="mt-2 overflow-x-auto text-xs text-slate-600">{JSON.stringify(preview.sampleIds, null, 2)}</pre>
        </DashboardCard>
      )}
    </div>
  );
}

function TemplatesTab({ canManage }) {
  const [templates, setTemplates] = useState([]);
  const [form, setForm] = useState({ family: '', name: '', channel: 'email', subject: '', body: '' });
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => { listTemplates().then(setTemplates).catch(() => toast.error('Modèles indisponibles.')); }, []);
  useEffect(() => { load(); }, [load]);

  const submit = async (e) => {
    e.preventDefault();
    if (!form.family || !form.name || !form.body) { toast.error('Famille, nom et corps du message sont requis.'); return; }
    setBusy(true);
    try {
      const created = await createTemplateVersion(form);
      await activateTemplate(created._id);
      toast.success('Modèle créé et activé.');
      setForm({ family: '', name: '', channel: 'email', subject: '', body: '' });
      load();
    } catch (err) { toast.error(err.response?.data?.message || 'Création du modèle impossible.'); }
    finally { setBusy(false); }
  };

  return (
    <div className="space-y-4">
      {canManage && (
        <DashboardCard>
          <h2 className="mb-3 text-sm font-semibold text-slate-700">Nouveau modèle (nouvelle version active)</h2>
          <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2">
            <input placeholder="Famille (ex: sequence_bienvenue_prospect)" value={form.family} onChange={(e) => setForm({ ...form, family: e.target.value })} className="rounded border px-3 py-2 text-sm" />
            <input placeholder="Nom" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="rounded border px-3 py-2 text-sm" />
            <select value={form.channel} onChange={(e) => setForm({ ...form, channel: e.target.value })} className="rounded border px-3 py-2 text-sm">
              {CHANNELS.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <input placeholder="Sujet (email)" value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} className="rounded border px-3 py-2 text-sm" />
            <textarea placeholder="Corps du message — variables {{prenom}}, {{nom}}…" value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} className="sm:col-span-2 rounded border px-3 py-2 text-sm" rows={4} />
            <button disabled={busy} type="submit" className="sm:col-span-2 flex items-center justify-center gap-2 rounded bg-amber-600 px-3 py-2 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-60">
              <Plus size={16} /> Créer et activer
            </button>
          </form>
        </DashboardCard>
      )}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {templates.map((t) => (
          <DashboardCard key={t._id}>
            <p className="font-semibold text-slate-900">{t.name}</p>
            <p className="text-xs text-slate-500">{t.family} · v{t.version} · {t.channel}</p>
            <p className="mt-2 whitespace-pre-wrap text-xs text-slate-600">{t.body}</p>
          </DashboardCard>
        ))}
        {templates.length === 0 && <DashboardState type="empty" title="Aucun modèle actif." />}
      </div>
    </div>
  );
}

function CampaignsTab({ canManage }) {
  const [campaigns, setCampaigns] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [segments, setSegments] = useState([]);
  const [form, setForm] = useState({ name: '', channel: 'email', templateId: '', segmentKey: '' });
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(() => { listCampaigns().then(setCampaigns).catch(() => toast.error('Campagnes indisponibles.')); }, []);
  useEffect(() => {
    load();
    listTemplates().then(setTemplates).catch(() => {});
    listSegments().then(setSegments).catch(() => {});
  }, [load]);

  const submit = async (e) => {
    e.preventDefault();
    if (!form.name || !form.templateId || !form.segmentKey) { toast.error('Nom, modèle et segment sont requis.'); return; }
    try { await createCampaign(form); toast.success('Campagne créée (brouillon).'); setForm({ name: '', channel: 'email', templateId: '', segmentKey: '' }); load(); }
    catch (err) { toast.error(err.response?.data?.message || 'Création impossible.'); }
  };

  const act = async (id, action) => {
    setBusyId(id);
    try {
      if (action === 'approve') await approveCampaign(id);
      else if (action === 'cancel') await cancelCampaign(id, 'Annulée depuis le tableau de bord');
      else if (action === 'send') await sendCampaign(id);
      toast.success('Action effectuée.');
      load();
    } catch (err) { toast.error(err.response?.data?.message || 'Action impossible.'); }
    finally { setBusyId(null); }
  };

  return (
    <div className="space-y-4">
      {canManage && (
        <DashboardCard>
          <h2 className="mb-3 text-sm font-semibold text-slate-700">Nouvelle campagne (brouillon — approbation requise avant envoi)</h2>
          <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2">
            <input placeholder="Nom de la campagne" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="rounded border px-3 py-2 text-sm" />
            <select value={form.channel} onChange={(e) => setForm({ ...form, channel: e.target.value })} className="rounded border px-3 py-2 text-sm">
              {CHANNELS.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <select value={form.templateId} onChange={(e) => setForm({ ...form, templateId: e.target.value })} className="rounded border px-3 py-2 text-sm">
              <option value="">Modèle…</option>
              {templates.map((t) => <option key={t._id} value={t._id}>{t.name} ({t.channel})</option>)}
            </select>
            <select value={form.segmentKey} onChange={(e) => setForm({ ...form, segmentKey: e.target.value })} className="rounded border px-3 py-2 text-sm">
              <option value="">Segment…</option>
              {segments.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
            </select>
            <button type="submit" className="sm:col-span-2 flex items-center justify-center gap-2 rounded bg-amber-600 px-3 py-2 text-sm font-medium text-white hover:bg-amber-700">
              <Plus size={16} /> Créer la campagne
            </button>
          </form>
        </DashboardCard>
      )}
      <div className="overflow-x-auto rounded-xl border bg-white">
        <table className="w-full min-w-[900px] text-left text-sm">
          <thead>
            <tr className="border-b bg-slate-50 text-slate-500">
              <th className="p-3">Campagne</th>
              <th className="p-3">Canal</th>
              <th className="p-3">Segment</th>
              <th className="p-3">Statut</th>
              <th className="p-3">Résultats</th>
              {canManage && <th className="p-3">Administration</th>}
            </tr>
          </thead>
          <tbody>
            {campaigns.map((c) => (
              <tr key={c._id} className="border-b align-top">
                <td className="p-3 font-semibold text-slate-900">{c.name}</td>
                <td className="p-3">{c.channel}</td>
                <td className="p-3"><code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">{c.segmentKey}</code></td>
                <td className="p-3">
                  <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700">{c.status}</span>
                </td>
                <td className="p-3 text-xs text-slate-600">
                  {c.stats?.totalRecipients ?? 0} destinataires · {c.stats?.sentCount ?? 0} envoyés · {c.stats?.failedCount ?? 0} échecs
                </td>
                {canManage && (
                  <td className="p-3">
                    <div className="flex flex-wrap gap-2">
                      {c.status === 'draft' && (
                        <>
                          <button disabled={busyId === c._id} onClick={() => act(c._id, 'approve')} className="flex items-center gap-1 rounded bg-teal-700 px-2 py-1 text-xs text-white hover:bg-teal-800 disabled:opacity-60"><CheckCircle2 size={14} /> Approuver</button>
                          <button disabled={busyId === c._id} onClick={() => act(c._id, 'cancel')} className="flex items-center gap-1 rounded bg-red-600 px-2 py-1 text-xs text-white hover:bg-red-700 disabled:opacity-60"><XCircle size={14} /> Annuler</button>
                        </>
                      )}
                      {c.status === 'approved' && (
                        <button disabled={busyId === c._id} onClick={() => act(c._id, 'send')} className="flex items-center gap-1 rounded bg-amber-600 px-2 py-1 text-xs text-white hover:bg-amber-700 disabled:opacity-60"><Send size={14} /> Envoyer</button>
                      )}
                    </div>
                  </td>
                )}
              </tr>
            ))}
            {campaigns.length === 0 && <tr><td colSpan={canManage ? 6 : 5} className="p-6 text-center text-slate-500">Aucune campagne.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SendsTab() {
  const [sends, setSends] = useState([]);
  useEffect(() => { listSends().then(setSends).catch(() => toast.error('Journal indisponible.')); }, []);
  return (
    <div className="overflow-x-auto rounded-xl border bg-white">
      <table className="w-full min-w-[800px] text-left text-sm">
        <thead>
          <tr className="border-b bg-slate-50 text-slate-500">
            <th className="p-3">Date</th>
            <th className="p-3">Modèle</th>
            <th className="p-3">Canal</th>
            <th className="p-3">Destinataire</th>
            <th className="p-3">Statut</th>
            <th className="p-3">Erreur</th>
          </tr>
        </thead>
        <tbody>
          {sends.map((s) => (
            <tr key={s._id} className="border-b">
              <td className="p-3 text-xs text-slate-500">{new Date(s.createdAt).toLocaleString('fr-FR')}</td>
              <td className="p-3">{s.template?.name || '—'}</td>
              <td className="p-3">{s.channel}</td>
              <td className="p-3 text-xs">{s.recipientEmail || s.recipientCustomer || '—'}</td>
              <td className="p-3"><span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700">{s.status}</span></td>
              <td className="p-3 text-xs text-red-600">{s.error || ''}</td>
            </tr>
          ))}
          {sends.length === 0 && <tr><td colSpan={6} className="p-6 text-center text-slate-500">Aucun envoi enregistré.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

export default function MarketingDashboardPage() {
  const { user } = useAuth();
  const [tab, setTab] = useState('overview');
  const canManage = user?.role === 'Admin' || user?.role === 'CommunityManager';

  return (
    <DashboardPage>
      <DashboardPageHeader
        icon={Megaphone}
        eyebrow="Altcom"
        title="Marketing Automation"
        description="Segmentation, modèles, campagnes et workflows — le moteur d'automatisation CRM reste l'unique exécuteur."
      />
      <DashboardToolbar>
        <nav className="flex flex-wrap gap-2" aria-label="Sections marketing">
          {TABS.map(({ key, label, Icon }) => (
            <button
              key={key} onClick={() => setTab(key)}
              className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition ${tab === key ? 'bg-amber-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
            >
              <Icon size={14} /> {label}
            </button>
          ))}
        </nav>
      </DashboardToolbar>
      {tab === 'overview' && <OverviewTab />}
      {tab === 'segments' && <SegmentsTab />}
      {tab === 'templates' && <TemplatesTab canManage={canManage} />}
      {tab === 'campaigns' && <CampaignsTab canManage={canManage} />}
      {tab === 'sends' && <SendsTab />}
    </DashboardPage>
  );
}
