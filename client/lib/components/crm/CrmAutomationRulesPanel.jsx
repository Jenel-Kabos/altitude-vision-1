'use client';
// CRM-AUTOMATION-1 (Phase 7) — administration des règles : activer,
// désactiver, prioriser, simuler. Aucune règle codée en dur côté client —
// tout provient de GET /crm-automation/rules.
import { useCallback, useEffect, useState } from 'react';
import { getAutomationRules, setAutomationRuleEnabled, updateAutomationRule, simulateAutomation } from '../../services/crmAutomationService';

export default function CrmAutomationRulesPanel() {
  const [rules, setRules] = useState([]);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState(null);
  const [simResult, setSimResult] = useState(null);

  const load = useCallback(() => {
    getAutomationRules().then(setRules).catch((e) => setError(e.response?.data?.message || 'Règles indisponibles.'));
  }, []);
  useEffect(() => { load(); }, [load]);

  const toggle = async (rule) => {
    setBusyId(rule._id);
    try { await setAutomationRuleEnabled(rule._id, !rule.enabled); load(); }
    catch (e) { setError(e.response?.data?.message || 'Action impossible.'); }
    finally { setBusyId(null); }
  };

  const changePriority = async (rule, priority) => {
    if (Number.isNaN(priority)) return;
    setBusyId(rule._id);
    try { await updateAutomationRule(rule._id, { priority }); load(); }
    catch (e) { setError(e.response?.data?.message || 'Action impossible.'); }
    finally { setBusyId(null); }
  };

  const simulate = async (rule) => {
    setBusyId(rule._id);
    setSimResult(null);
    try {
      const results = await simulateAutomation({ type: rule.triggerEvent, recipient: rule.createdBy || rule.updatedBy, audience: 'staff' });
      setSimResult({ ruleId: rule.ruleId, results });
    } catch (e) { setError(e.response?.data?.message || 'Simulation impossible.'); }
    finally { setBusyId(null); }
  };

  return (
    <div className="space-y-4">
      {error && <p role="alert" className="rounded-lg bg-red-50 p-4 text-red-800">{error}</p>}
      <p className="text-sm text-slate-500">Chaque règle observe un événement déjà émis par la plateforme (aucun nouvel événement n'est créé par ce moteur).</p>
      <div className="overflow-x-auto rounded-xl border bg-white">
        <table className="w-full min-w-[900px] text-left text-sm">
          <thead>
            <tr className="border-b bg-slate-50 text-slate-500">
              <th className="p-3">Règle</th>
              <th className="p-3">Événement déclencheur</th>
              <th className="p-3">Actions</th>
              <th className="p-3">Priorité</th>
              <th className="p-3">Statut</th>
              <th className="p-3">Administration</th>
            </tr>
          </thead>
          <tbody>
            {rules.map((rule) => (
              <tr key={rule._id} className="border-b align-top">
                <td className="p-3">
                  <p className="font-semibold text-slate-900">{rule.label}</p>
                  <p className="text-xs text-slate-500">{rule.description}</p>
                </td>
                <td className="p-3"><code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">{rule.triggerEvent}</code></td>
                <td className="p-3">{rule.actions.map((a) => a.actionId).join(', ')}</td>
                <td className="p-3">
                  <input
                    type="number" defaultValue={rule.priority} aria-label={`Priorité de ${rule.label}`}
                    className="w-16 rounded border px-2 py-1"
                    onBlur={(e) => changePriority(rule, Number(e.target.value))}
                  />
                </td>
                <td className="p-3">
                  <span className={`rounded-full px-2 py-1 text-xs font-medium ${rule.enabled ? 'bg-green-100 text-green-800' : 'bg-slate-100 text-slate-600'}`}>
                    {rule.enabled ? 'Activée' : 'Désactivée'}
                  </span>
                </td>
                <td className="p-3">
                  <div className="flex flex-wrap gap-2">
                    <button disabled={busyId === rule._id} onClick={() => toggle(rule)} className="rounded bg-slate-700 px-2 py-1 text-xs text-white hover:bg-slate-800 disabled:opacity-60">
                      {rule.enabled ? 'Désactiver' : 'Activer'}
                    </button>
                    <button disabled={busyId === rule._id} onClick={() => simulate(rule)} className="rounded bg-teal-700 px-2 py-1 text-xs text-white hover:bg-teal-800 disabled:opacity-60">
                      Simuler
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {rules.length === 0 && <tr><td colSpan={6} className="p-6 text-center text-slate-500">Aucune règle enregistrée.</td></tr>}
          </tbody>
        </table>
      </div>
      {simResult && (
        <div className="rounded-xl border border-teal-200 bg-teal-50 p-4 text-sm text-teal-900">
          <p className="font-semibold">Simulation — {simResult.ruleId}</p>
          <pre className="mt-2 overflow-x-auto whitespace-pre-wrap text-xs">{JSON.stringify(simResult.results, null, 2)}</pre>
        </div>
      )}
    </div>
  );
}
