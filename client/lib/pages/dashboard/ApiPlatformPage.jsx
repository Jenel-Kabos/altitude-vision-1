'use client';
// API-PUBLIC-1 (Phase 9) — Portail développeur. Consomme exclusivement
// /api/dev-portal/* — aucune règle métier ici.
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import { Key, Plus, RotateCw, Ban, FileText, Webhook } from 'lucide-react';
import { listApiKeys, createApiKey, revokeApiKey, rotateApiKey, getCallLogs, getWebhookSubscriptions } from '../../services/apiPlatformService';
import { DashboardCard, DashboardPage, DashboardPageHeader, DashboardState } from '../../components/dashboard/DashboardUI';

const SCOPES = ['properties:read', 'hotels:read', 'accommodations:read', 'webhooks:manage'];

function RevealedKeyBanner({ rawKey, onDismiss }) {
  const copy = () => { navigator.clipboard.writeText(rawKey); toast.success('Clé copiée.'); };
  return (
    <div className="rounded-xl border border-amber-300 bg-amber-50 p-4">
      <p className="text-sm font-semibold text-amber-900">Clé API générée — copiez-la maintenant, elle ne sera plus jamais affichée.</p>
      <div className="mt-2 flex items-center gap-2">
        <code className="flex-1 overflow-x-auto rounded bg-white px-3 py-2 text-xs">{rawKey}</code>
        <button onClick={copy} className="rounded bg-amber-700 px-3 py-2 text-xs font-semibold text-white hover:bg-amber-800">Copier</button>
        <button onClick={onDismiss} className="rounded border px-3 py-2 text-xs">J&apos;ai copié la clé</button>
      </div>
    </div>
  );
}

function CreateKeyForm({ onCreated }) {
  const [name, setName] = useState('');
  const [scopes, setScopes] = useState(['properties:read', 'hotels:read', 'accommodations:read']);
  const [rateLimitPerMinute, setRateLimitPerMinute] = useState(60);
  const [submitting, setSubmitting] = useState(false);

  const toggleScope = (scope) => setScopes((prev) => (prev.includes(scope) ? prev.filter((s) => s !== scope) : [...prev, scope]));

  const submit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const { apiKey, rawKey } = await createApiKey({ name, scopes, rateLimitPerMinute: Number(rateLimitPerMinute) });
      toast.success('Clé créée.');
      setName('');
      onCreated(apiKey, rawKey);
    } catch (err) { toast.error(err.response?.data?.message || 'Création impossible.'); }
    finally { setSubmitting(false); }
  };

  return (
    <form onSubmit={submit} className="flex flex-wrap items-end gap-3 rounded-xl border bg-white p-4">
      <label className="text-sm">Nom du partenaire<input value={name} onChange={(e) => setName(e.target.value)} required className="mt-1 block rounded border px-2 py-1.5" /></label>
      <fieldset className="text-sm">
        <legend className="mb-1">Scopes</legend>
        <div className="flex flex-wrap gap-2">
          {SCOPES.map((scope) => (
            <label key={scope} className="flex items-center gap-1 rounded border px-2 py-1 text-xs">
              <input type="checkbox" checked={scopes.includes(scope)} onChange={() => toggleScope(scope)} />
              {scope}
            </label>
          ))}
        </div>
      </fieldset>
      <label className="text-sm">Requêtes/min<input type="number" value={rateLimitPerMinute} onChange={(e) => setRateLimitPerMinute(e.target.value)} className="mt-1 block w-24 rounded border px-2 py-1.5" /></label>
      <button type="submit" disabled={submitting} className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
        <Plus size={16} /> Générer
      </button>
    </form>
  );
}

export default function ApiPlatformPage() {
  const [keys, setKeys] = useState([]);
  const [logs, setLogs] = useState([]);
  const [webhooks, setWebhooks] = useState([]);
  const [revealedKey, setRevealedKey] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [keysList, logsList, webhooksList] = await Promise.all([listApiKeys(), getCallLogs(), getWebhookSubscriptions()]);
      setKeys(keysList); setLogs(logsList); setWebhooks(webhooksList);
    } catch (e) { setError(e.response?.data?.message || 'Portail développeur indisponible.'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const handleRevoke = async (id) => {
    try { await revokeApiKey(id, 'Révocation depuis le portail'); toast.success('Clé révoquée.'); load(); }
    catch (e) { toast.error(e.response?.data?.message || 'Action impossible.'); }
  };
  const handleRotate = async (id) => {
    try {
      const { apiKey, rawKey } = await rotateApiKey(id, 'Rotation depuis le portail');
      setRevealedKey(rawKey);
      toast.success('Clé tournée.');
      load();
      void apiKey;
    } catch (e) { toast.error(e.response?.data?.message || 'Action impossible.'); }
  };

  return (
    <DashboardPage>
      <DashboardPageHeader
        icon={Key}
        title="Portail développeur"
        description="Clés API, webhooks et journal d'appels de la plateforme d'API publiques versionnée (/api/public/v1)."
        actions={
          <a href="/api/public/v1/docs" target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium hover:bg-slate-50">
            <FileText size={16} /> Documentation OpenAPI
          </a>
        }
      />
      {error && <DashboardState type="error" title="Erreur" description={error} />}
      {revealedKey && <RevealedKeyBanner rawKey={revealedKey} onDismiss={() => setRevealedKey(null)} />}

      <CreateKeyForm onCreated={(_apiKey, rawKey) => { setRevealedKey(rawKey); load(); }} />

      {loading ? (
        <div className="h-40 animate-pulse rounded-xl bg-slate-100" />
      ) : (
        <>
          <DashboardCard>
            <h2 className="mb-3 font-semibold">Clés API</h2>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[700px] text-left text-sm">
                <thead><tr className="border-b text-slate-500"><th className="p-2">Nom</th><th className="p-2">Préfixe</th><th className="p-2">Scopes</th><th className="p-2">Statut</th><th className="p-2">Dernière utilisation</th><th className="p-2">Actions</th></tr></thead>
                <tbody>
                  {keys.map((k) => (
                    <tr key={k._id} className="border-b">
                      <td className="p-2">{k.name}</td>
                      <td className="p-2"><code className="text-xs">{k.keyPrefix}…</code></td>
                      <td className="p-2 text-xs">{k.scopes.join(', ')}</td>
                      <td className="p-2"><span className={`rounded-full px-2 py-0.5 text-xs ${k.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-slate-100 text-slate-600'}`}>{k.status}</span></td>
                      <td className="p-2 text-xs">{k.lastUsedAt ? new Date(k.lastUsedAt).toLocaleString('fr-FR') : 'Jamais'}</td>
                      <td className="p-2">
                        {k.status === 'active' && (
                          <div className="flex gap-2">
                            <button onClick={() => handleRotate(k._id)} className="inline-flex items-center gap-1 text-xs text-teal-700 hover:underline"><RotateCw size={12} /> Tourner</button>
                            <button onClick={() => handleRevoke(k._id)} className="inline-flex items-center gap-1 text-xs text-red-700 hover:underline"><Ban size={12} /> Révoquer</button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                  {keys.length === 0 && <tr><td colSpan={6} className="p-4 text-center text-slate-500">Aucune clé.</td></tr>}
                </tbody>
              </table>
            </div>
          </DashboardCard>

          <DashboardCard>
            <h2 className="mb-3 flex items-center gap-2 font-semibold"><Webhook size={16} /> Abonnements webhook</h2>
            <ul className="space-y-1 text-sm">
              {webhooks.map((w) => (
                <li key={w._id} className="flex items-center justify-between rounded border px-3 py-2">
                  <span>{w.url} — {w.events.join(', ')} ({w.apiKey?.name})</span>
                  <span className={`text-xs ${w.status === 'active' ? 'text-green-700' : 'text-slate-500'}`}>{w.status}</span>
                </li>
              ))}
              {webhooks.length === 0 && <li className="text-slate-500">Aucun abonnement.</li>}
            </ul>
          </DashboardCard>

          <DashboardCard>
            <h2 className="mb-3 font-semibold">Journal d&apos;appels récents</h2>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[600px] text-left text-sm">
                <thead><tr className="border-b text-slate-500"><th className="p-2">Date</th><th className="p-2">Clé</th><th className="p-2">Méthode</th><th className="p-2">Chemin</th><th className="p-2">Statut</th><th className="p-2">Durée</th></tr></thead>
                <tbody>
                  {logs.slice(0, 50).map((log) => (
                    <tr key={log._id} className="border-b">
                      <td className="p-2 text-xs">{new Date(log.createdAt).toLocaleString('fr-FR')}</td>
                      <td className="p-2 text-xs">{log.apiKey?.name || '—'}</td>
                      <td className="p-2 text-xs">{log.method}</td>
                      <td className="p-2 text-xs">{log.path}</td>
                      <td className="p-2 text-xs"><span className={log.statusCode >= 400 ? 'text-red-700' : 'text-green-700'}>{log.statusCode}</span></td>
                      <td className="p-2 text-xs">{log.durationMs} ms</td>
                    </tr>
                  ))}
                  {logs.length === 0 && <tr><td colSpan={6} className="p-4 text-center text-slate-500">Aucun appel journalisé.</td></tr>}
                </tbody>
              </table>
            </div>
          </DashboardCard>
        </>
      )}
    </DashboardPage>
  );
}
