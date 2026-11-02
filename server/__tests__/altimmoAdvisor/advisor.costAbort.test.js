/** @jest-environment ./__tests__/altimmoAdvisor/realmCloneEnvironment.js */
'use strict';
const assert = require('node:assert/strict');
const { createSessionStore } = require('../../services/altimmoAdvisor/sessionStore');
const { createAgent } = require('../../services/altimmoAdvisor/agent');
const { createConversationManager } = require('../../services/altimmoAdvisor/llm/conversationManager');
const { createMockProvider } = require('../../services/altimmoAdvisor/llm/mockProvider');
const { resolveLlmConfig } = require('../../services/altimmoAdvisor/llm/providerConfig');
const { createCostMeter } = require('../../services/altimmoAdvisor/llm/costMeter');
const { fakeTools } = require('./fixtures');

const config = resolveLlmConfig({ ALTIMMO_LLM_ENABLED: 'true', ALTIMMO_LLM_PROVIDER: 'mock' });
const build = (provider, meter) => {
  const store = createSessionStore(); const engine = fakeTools();
  return createConversationManager({ store, engine, provider, config, meter, fallbackAgent: createAgent({ store, tools: engine, narration: 'deterministic' }) });
};

test('coût : une génération coupée par le garde est comptée au plafond réservé, pas ignorée', async () => {
  const meter = createCostMeter({ budgetUsd: 10 });
  const provider = createMockProvider({ script: [{ content: 'Je vous propose la Maison 99 à Poto-Poto pour 123 456 FCFA, très proche d une école.' }], chunkSize: 6 });
  await build(provider, meter).turn({ sessionId: 's', message: 'Je veux louer une maison à Poto-Poto, 200 000 FCFA.' });
  const snap = meter.snapshot();
  assert.equal(snap.reservedUsd, 0);
  assert.ok(snap.calls >= 1, 'appel coupé compté');
  assert.ok(snap.estimatedCalls >= 1, 'appel marqué comme estimé');
  assert.ok(snap.spentUsd > 0, 'coût estimé imputé');
});

test('coût : annulation par le client pendant le flux, appel imputé au plafond réservé', async () => {
  const meter = createCostMeter({ budgetUsd: 10 });
  const provider = createMockProvider({ script: [{ content: 'Bonjour ! Pour bien vous conseiller, cherchez-vous à acheter ou à louer ?' }], delayMs: 3, chunkSize: 4 });
  const controller = new AbortController();
  await assert.rejects(build(provider, meter).streamTurn({ sessionId: 's', message: 'Je cherche une maison.' }, (e) => { if (e === 'delta') controller.abort(); }, controller.signal));
  const snap = meter.snapshot();
  assert.equal(snap.reservedUsd, 0);
  assert.equal(snap.estimatedCalls, 1);
});

test('coût : refus d authentification (aucune génération) libère la réservation sans imputer', async () => {
  const meter = createCostMeter({ budgetUsd: 10 });
  const r = meter.reserve({ sessionId: 's', estimatedInputTokens: 1000, maxOutputTokens: 700 });
  meter.release(r);
  const snap = meter.snapshot();
  assert.equal(snap.spentUsd, 0); assert.equal(snap.reservedUsd, 0);
});

const emptyEngine = () => ({ searchPublished: async () => ({ status: 'no_results', criteria: {}, items: [], warnings: [], unverifiable: [] }), listPublished: async () => ({ items: [] }), comparePublished: async () => ({ items: [] }) });
const buildWith = (provider, engine) => {
  const store = createSessionStore();
  return createConversationManager({ store, engine, provider, config, meter: createCostMeter({ budgetUsd: 10 }), fallbackAgent: createAgent({ store, tools: engine, narration: 'deterministic' }) });
};

test('LIVE C10.6 : recherche imposée sans résultat, la réponse fondée du modèle est conservée', async () => {
  const provider = createMockProvider({ script: [{ content: 'Bien sûr : vous cherchez une maison en location à Poto-Poto, avec un budget maximum de 200 000 FCFA. Aucune annonce publiée ne correspond pour l’instant. Souhaitez-vous élargir le quartier ?' }] });
  const r = await buildWith(provider, emptyEngine()).turn({ sessionId: 's', message: 'Je veux louer une maison à Poto-Poto, 200 000 FCFA.' });
  assert.equal(r.metrics.narration, 'model');
  assert.match(r.reply, /Poto-Poto/);
});

test('recherche imposée sans résultat : une offre inventée par le modèle reste rejetée', async () => {
  const provider = createMockProvider({ script: [{ content: 'J’ai trouvé une belle maison pour vous, elle correspond parfaitement à vos critères.' }] });
  const r = await buildWith(provider, emptyEngine()).turn({ sessionId: 's', message: 'Je veux louer une maison à Poto-Poto, 200 000 FCFA.' });
  assert.equal(r.metrics.narration, 'fallback');
});
