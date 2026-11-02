/** @jest-environment ./__tests__/altimmoAdvisor/realmCloneEnvironment.js */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { redact } = require('../../services/altimmoAdvisor/llm/privacy');
const { createSessionStore } = require('../../services/altimmoAdvisor/sessionStore');
const { createAgent } = require('../../services/altimmoAdvisor/agent');
const { createConversationManager } = require('../../services/altimmoAdvisor/llm/conversationManager');
const { createDeepSeekProvider } = require('../../services/altimmoAdvisor/llm/deepseekProvider');
const { resolveLlmConfig } = require('../../services/altimmoAdvisor/llm/providerConfig');
const { createCostMeter } = require('../../services/altimmoAdvisor/llm/costMeter');
const { fakeTools } = require('./fixtures');

const FAKE_KEY = 'sk-test-ZZZZZZZZZZZZZZZZZZZZZZZZ'; // factice

test('masquage : coordonnées et identifiants masqués, critères immobiliers intacts', () => {
  const text = 'Maison 3 chambres à Poto-Poto, 200 000 FCFA, 120 m2. Tel +242 06 123 45 67 ou 05 444 33 22, mail a.b@ex.cg, passeport n° AB123456, IBAN CG39 3001 1000 1234 5678 9012 345, carte 4970 1012 3456 7890, mot de passe: Secret123';
  const out = redact(text);
  for (const kept of ['3 chambres', 'Poto-Poto', '200 000 FCFA', '120 m2']) assert.ok(out.includes(kept), kept);
  for (const gone of ['06 123 45 67', '05 444 33 22', 'a.b@ex.cg', 'AB123456', '3001 1000', '4970 1012', 'Secret123']) assert.ok(!out.includes(gone), gone);
});

test('aucune clé dans la santé, l usage, les réponses ni les journaux, même en cas d erreur fournisseur', async () => {
  const config = resolveLlmConfig({ ALTIMMO_LLM_PROVIDER: 'deepseek', ALTIMMO_LLM_ENABLED: 'true', DEEPSEEK_API_KEY: FAKE_KEY });
  const logs = [];
  const fetchImpl = async () => new Response(JSON.stringify({ error: { message: `Invalid key ${FAKE_KEY}` } }), { status: 401 });
  const store = createSessionStore(); const engine = fakeTools();
  const manager = createConversationManager({ store, engine, provider: createDeepSeekProvider({ config, fetchImpl }), config, meter: createCostMeter({ budgetUsd: 10 }), fallbackAgent: createAgent({ store, tools: engine, narration: 'deterministic' }), log: (e) => logs.push(e) });
  const result = await manager.turn({ sessionId: 's', message: 'Je veux louer une maison à Poto-Poto, 200 000 FCFA.' });
  assert.equal(result.metrics.fallbackReason, 'auth_failed');
  // INTEGRATION-01 : les réponses HTTP (statut, usage, tours) sont couvertes par advisorApi.mongo.integration.test.js.
  for (const body of [JSON.stringify(result), JSON.stringify(logs)]) assert.doesNotMatch(body, /sk-test|ZZZZZZZZ|Invalid key/);
});

test('aucune clé ni valeur de type clé dans le code du conseiller intégré', () => {
  const root = require('node:path').join(__dirname, '../..');
  const files = ['services/altimmoAdvisor/llm/deepseekProvider.js', 'services/altimmoAdvisor/llm/providerConfig.js', 'services/altimmoAdvisor/advisorRuntime.js', 'controllers/altimmoAdvisorController.js', 'config/altimmoAdvisor.js', 'config/altimmoAdvisorPricing.json', '../.env.example'];
  for (const f of files) assert.doesNotMatch(fs.readFileSync(require('node:path').join(root, f), 'utf8'), /sk-[A-Za-z0-9]{20,}/, f);
});
