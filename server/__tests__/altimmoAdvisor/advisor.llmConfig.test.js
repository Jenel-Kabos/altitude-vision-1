/** @jest-environment ./__tests__/altimmoAdvisor/realmCloneEnvironment.js */
'use strict';
const assert = require('node:assert/strict');
const { resolveLlmConfig, publicLlmStatus } = require('../../services/altimmoAdvisor/llm/providerConfig');
const { loadPricing, priceFor, createCostMeter } = require('../../services/altimmoAdvisor/llm/costMeter');

const FAKE = 'sk-test-0000000000000000000000000000'; // valeur factice de test, jamais une vraie clé

test('configuration : désactivée par défaut, fournisseur et modèle fermés, URL officielle uniquement', () => {
  const off = resolveLlmConfig({});
  // INTEGRATION-01 : fournisseur simulé par défaut (aucune dépense sans choix explicite de DeepSeek).
  assert.deepEqual([off.enabled, off.provider, off.model, off.budgetUsd], [false, 'mock', 'deepseek-flash', 10]);
  assert.equal(resolveLlmConfig({ ALTIMMO_LLM_PROVIDER: 'deepseek' }).provider, 'deepseek');
  assert.equal(resolveLlmConfig({ ALTIMMO_LLM_ENABLED: 'true', ALTIMMO_LLM_PROVIDER: 'mock' }).provider, 'mock');
  assert.throws(() => resolveLlmConfig({ ALTIMMO_LLM_PROVIDER: 'openai' }), /fournisseur/i);
  assert.throws(() => resolveLlmConfig({ ALTIMMO_LLM_MODEL: 'gpt-4o' }), /modèle/i);
  assert.equal(resolveLlmConfig({ ALTIMMO_LLM_MODEL: 'deepseek-v4-pro' }).model, 'deepseek-v4-pro');
  assert.throws(() => resolveLlmConfig({ ALTIMMO_LLM_BASE_URL: 'https://evil.example' }), /URL/i);
  assert.throws(() => resolveLlmConfig({ ALTIMMO_LLM_MONTHLY_BUDGET_USD: '-3' }), /budget/i);
  assert.throws(() => resolveLlmConfig({ ALTIMMO_LLM_MONTHLY_BUDGET_USD: '5000' }), /budget/i);
});

test('statut public : jamais la clé, seulement sa présence', () => {
  const config = resolveLlmConfig({ ALTIMMO_LLM_PROVIDER: 'deepseek', ALTIMMO_LLM_ENABLED: 'true', DEEPSEEK_API_KEY: FAKE });
  const status = publicLlmStatus(config);
  assert.equal(status.keyConfigured, true);
  assert.doesNotMatch(JSON.stringify(status), /sk-test|0000000000/);
  assert.doesNotMatch(JSON.stringify(config), /sk-test/, 'la clé n est pas sérialisable depuis la configuration');
  assert.equal(config.apiKey(), FAKE);
  assert.equal(resolveLlmConfig({ ALTIMMO_LLM_PROVIDER: 'deepseek', ALTIMMO_LLM_ENABLED: 'true' }).ready, false, 'activé sans clé : non prêt');
});

test('tarifs : lus depuis la configuration officielle, heures pleines et creuses', () => {
  const pricing = loadPricing();
  assert.equal(pricing.source, 'https://api-docs.deepseek.com/quick_start/pricing');
  const peak = new Date('2026-11-02T07:00:00Z'); // lundi 07 h UTC
  const offPeak = new Date('2026-11-01T07:00:00Z'); // dimanche
  assert.equal(priceFor(pricing, 'deepseek-flash', peak).output, 1.2);
  assert.equal(priceFor(pricing, 'deepseek-flash', offPeak).output, 0.6);
  assert.equal(priceFor(pricing, 'deepseek-flash', new Date('2026-11-02T05:00:00Z')).inputCacheMiss, 0.15);
});

test('compteur : coût réel par usage, par conversation et total', () => {
  const meter = createCostMeter({ budgetUsd: 10, now: () => new Date('2026-11-02T07:00:00Z') });
  const cost = meter.settle(meter.reserve({ sessionId: 's1', estimatedInputTokens: 2000, maxOutputTokens: 500 }), { prompt_cache_hit_tokens: 1000, prompt_cache_miss_tokens: 1000, completion_tokens: 200 });
  assert.equal(cost, (1000 * 0.006 + 1000 * 0.3 + 200 * 1.2) / 1e6);
  assert.equal(meter.snapshot().spentUsd, cost);
  assert.equal(meter.snapshot().bySession.s1.calls, 1);
});

test('budget préventif : réservations concurrentes, marge de sécurité, arrêt avant dépassement', () => {
  const meter = createCostMeter({ budgetUsd: 0.001, safetyMargin: 0.2, now: () => new Date('2026-11-02T07:00:00Z') });
  // Estimation maximale au tarif de pointe : 1000 × 0,3 + 500 × 1,2 = 0,0009 $ ; plafond utile 0,0008 $.
  assert.throws(() => meter.reserve({ sessionId: 's', estimatedInputTokens: 1000, maxOutputTokens: 500 }), (e) => e.code === 'budget_exhausted');
  const small = createCostMeter({ budgetUsd: 0.0019, safetyMargin: 0.1, now: () => new Date('2026-11-02T07:00:00Z') });
  const a = small.reserve({ sessionId: 'a', estimatedInputTokens: 1000, maxOutputTokens: 500 });
  assert.throws(() => small.reserve({ sessionId: 'b', estimatedInputTokens: 1000, maxOutputTokens: 500 }), (e) => e.code === 'budget_exhausted', 'la réservation en cours compte');
  small.release(a);
  assert.doesNotThrow(() => small.reserve({ sessionId: 'b', estimatedInputTokens: 1000, maxOutputTokens: 500 }));
});

test('limites : par session, par IP et par minute ; alertes de consommation', () => {
  let t = 0;
  const meter = createCostMeter({ budgetUsd: 10, sessionMaxUsd: 0.0005, sessionMaxCalls: 3, ipMaxCallsPerMinute: 2, now: () => new Date(Date.UTC(2026, 10, 1, 12) + t) });
  const r1 = meter.reserve({ sessionId: 's', ip: '1', estimatedInputTokens: 10, maxOutputTokens: 10 }); meter.settle(r1, { prompt_cache_miss_tokens: 10, completion_tokens: 10 });
  meter.reserve({ sessionId: 's2', ip: '1', estimatedInputTokens: 10, maxOutputTokens: 10 });
  assert.throws(() => meter.reserve({ sessionId: 's3', ip: '1', estimatedInputTokens: 10, maxOutputTokens: 10 }), (e) => e.code === 'ip_rate_limited');
  t = 61_000;
  assert.doesNotThrow(() => meter.reserve({ sessionId: 's3', ip: '1', estimatedInputTokens: 10, maxOutputTokens: 10 }));
  assert.throws(() => meter.reserve({ sessionId: 'x', ip: '9', estimatedInputTokens: 10_000, maxOutputTokens: 10 }), (e) => e.code === 'session_budget_exhausted');
  const alerts = [];
  const watched = createCostMeter({ budgetUsd: 0.000001, safetyMargin: 0, onAlert: (level) => alerts.push(level), now: () => new Date(Date.UTC(2026, 10, 1, 12)) });
  watched.settle(watched.reserve({ sessionId: 'z', estimatedInputTokens: 1, maxOutputTokens: 1 }), { prompt_cache_miss_tokens: 1, completion_tokens: 1 });
  assert.deepEqual(alerts, [0.5]);
});
