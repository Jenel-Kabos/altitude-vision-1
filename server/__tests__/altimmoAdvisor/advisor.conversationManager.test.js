/** @jest-environment ./__tests__/altimmoAdvisor/realmCloneEnvironment.js */
'use strict';
const assert = require('node:assert/strict');
const { createSessionStore } = require('../../services/altimmoAdvisor/sessionStore');
const { createAgent } = require('../../services/altimmoAdvisor/agent');
const { createConversationManager } = require('../../services/altimmoAdvisor/llm/conversationManager');
const { createMockProvider } = require('../../services/altimmoAdvisor/llm/mockProvider');
const { simulatedDecide } = require('../../services/altimmoAdvisor/llm/simulatedAdvisor');
const { resolveLlmConfig } = require('../../services/altimmoAdvisor/llm/providerConfig');
const { createCostMeter } = require('../../services/altimmoAdvisor/llm/costMeter');
const { fakeTools } = require('./fixtures');

const config = resolveLlmConfig({ ALTIMMO_LLM_ENABLED: 'true', ALTIMMO_LLM_PROVIDER: 'mock' });
function setup({ provider = createMockProvider({ decide: simulatedDecide }), meter = createCostMeter({ budgetUsd: 10 }), engine = fakeTools(), cfg = config, log = () => {} } = {}) {
  const store = createSessionStore();
  const seen = [];
  const spy = { ...provider, chatStream: (args) => { seen.push(structuredClone(args.messages)); return provider.chatStream(args); } };
  const fallbackAgent = createAgent({ store, tools: engine, narration: 'deterministic' });
  const manager = createConversationManager({ store, engine, provider: spy, config: cfg, meter, fallbackAgent, debug: true, log });
  return { manager, store, engine, seen, meter };
}
const talk = async (manager, id, messages) => { const out = []; for (const message of messages) out.push(await manager.turn({ sessionId: id, message })); return out; };
const tc = (name, args = {}) => ({ name, arguments: args });

test('dialogue de la mission (fournisseur simulé) : questions utiles, puis recherche au bon moment', async () => {
  const { manager } = setup();
  const [t1, t2, t3, t4] = await talk(manager, 's', ['Bonjour, je cherche une maison pour ma famille.', 'À louer, avec trois chambres.', 'Poto-Poto, mais j’aimerais être proche d’une école.', '200 000 FCFA.']);
  assert.match(t1.reply, /acheter ou pour louer/);
  assert.equal(t1.status, 'needs_clarification');
  assert.match(t2.reply, /loyer mensuel/);
  assert.equal(t3.state.proximity.school, 'important');
  assert.equal(t4.status, 'success');
  assert.equal(t4.cards[0].listing.id, 'm-poto');
  assert.match(t4.reply, /vérifier sur place/);
  assert.deepEqual([t4.state.criteria.transaction, t4.state.criteria.propertyType, t4.state.criteria.bedrooms.min, t4.state.criteria.budget.max], ['RENT', 'Maison', 3, 200000]);
  assert.equal(t4.metrics.mode, 'simulé');
  assert.ok(t4.metrics.costUsd > 0, 'coût simulé comptabilisé');
});

test('mémoire : « je peux monter jusqu’à 250 000 » remplace le plafond, sans rien oublier', async () => {
  const { manager } = setup();
  const out = await talk(manager, 's', ['Je veux louer une maison à Poto-Poto, 200 000 FCFA, avec une cour.', 'Finalement, je peux monter jusqu’à 250 000 FCFA.']);
  const last = out.at(-1);
  assert.equal(last.state.criteria.budget.max, 250000);
  assert.deepEqual([last.state.criteria.district, last.state.amenities.preferred], ['Poto-Poto', ['cour']]);
});

test('alternatives : proposition vérifiée, accord explicite, puis comparaison et conseil', async () => {
  const { manager } = setup();
  const [none, accepted, compared, advice] = await talk(manager, 's', ['Je veux louer une maison de 3 chambres à Moungali, 300 000 FCFA maximum, budget strict. C’est pour ma famille.', 'Oui, d’accord.', 'Compare les deux premiers.', 'Quels sont les avantages pour ma famille ?']);
  assert.equal(none.status, 'alternative_proposed');
  assert.match(none.reply, /Voulez-vous que je vous les présente/);
  assert.equal(accepted.status, 'success');
  assert.equal(accepted.state.criteria.district, null);
  assert.equal(accepted.state.criteria.budget.max, 300000);
  assert.equal(compared.status, 'comparison');
  assert.match(compared.reply, /moins cher/);
  assert.match(advice.reply, /Je regarderais d’abord/);
});

test('outils : nom inconnu, arguments invalides, identifiant non présenté, compromis sans accord, jamais exécutés', async () => {
  const provider = createMockProvider({ script: [
    { toolCalls: [tc('delete_listing', { id: 'x' }), { name: 'search_properties', arguments: '{pas json' }, tc('compare_properties', { property_ids: ['m-poto', 'secret-id'] }), tc('apply_alternative', { alternative_id: 'widen_district' })] },
    { content: 'Je préfère vous poser une question : pour acheter ou pour louer ?' },
  ] });
  const { manager, engine, seen } = setup({ provider });
  const r = await manager.turn({ sessionId: 's', message: 'Je cherche une maison.' });
  const results = seen[1].filter((m) => m.role === 'tool').map((m) => JSON.parse(m.content));
  assert.deepEqual(results.map((x) => x.erreur), ['outil_inconnu', 'arguments_invalides', 'identifiants_invalides', 'aucun_compromis_en_attente']);
  assert.equal(engine.calls.length, 0, 'aucun appel IA-03');
  assert.equal(r.status, 'needs_clarification');
});

test('boucle d outils : rounds et appels plafonnés, dernier tour sans outils', async () => {
  const provider = createMockProvider({ script: [...Array(4).fill({ toolCalls: [tc('search_properties'), tc('get_public_property_details', { property_id: 'nope' })] }), { content: 'Voici ce que j’ai trouvé pour vous.' }] });
  const { manager, seen } = setup({ provider });
  const r = await manager.turn({ sessionId: 's', message: 'Je veux louer une maison à Brazzaville, 300 000 FCFA.' });
  assert.ok(r.metrics.toolCalls <= config.maxToolCallsPerTurn + 2);
  assert.ok(r.metrics.llmCalls <= config.maxToolRounds + 1);
  assert.equal(seen.length, r.metrics.llmCalls);
});

test('le modèle ne peut ni contredire un montant extrait ni dépasser un budget strict sans accord', async () => {
  const provider = createMockProvider({ script: [
    { toolCalls: [tc('update_criteria', { operations: [{ op: 'replace', path: 'budget.max', value: 2000000 }] })] }, { content: 'Noté.' },
    { toolCalls: [tc('update_criteria', { operations: [{ op: 'replace', path: 'budget.max', value: 350000 }] })] }, { content: 'D’accord.' },
  ] });
  const { manager, seen } = setup({ provider });
  const first = await manager.turn({ sessionId: 's', message: 'Je veux louer une maison, budget strict de 200 000 FCFA.' });
  assert.equal(first.state.criteria.budget.max, 200000);
  const second = await manager.turn({ sessionId: 's', message: 'Montre-moi des maisons avec piscine.' });
  assert.equal(second.state.criteria.budget.max, 200000);
  const refused = JSON.parse(seen[3].filter((m) => m.role === 'tool').at(-1).content).refusees[0];
  assert.match(refused.raison, /budget strict/);
});

test('garde : un prix ou un quartier inventé par le modèle n est jamais affiché comme fait', async () => {
  const provider = createMockProvider({ script: [{ toolCalls: [tc('search_properties')] }, { content: 'J’ai une superbe maison à Moungali pour 90 000 FCFA, disponible immédiatement.' }] });
  const deltas = [];
  const { manager } = setup({ provider });
  const r = await manager.streamTurn({ sessionId: 's', message: 'Je veux louer une maison à Poto-Poto, 200 000 FCFA.' }, (e, d) => { if (e === 'delta') deltas.push(d.text); });
  assert.doesNotMatch(deltas.join(''), /Moungali|90 000|immédiatement/);
  assert.equal(r.metrics.narration, 'fallback');
  assert.match(r.reply, /Maison Poto-Poto/);
  assert.doesNotMatch(r.reply, /90 000/);
});

test('erreurs du fournisseur : réponse de secours IA-03 compréhensible, sans détail technique', async () => {
  for (const error of ['auth_failed', 'insufficient_balance', 'provider_rate_limited', 'provider_error', 'timeout', 'network', 'malformed', 'incomplete']) {
    const { manager } = setup({ provider: createMockProvider({ script: [{ error }] }) });
    const r = await manager.turn({ sessionId: 's', message: 'Je veux louer une maison à Poto-Poto, 200 000 FCFA.' });
    assert.equal(r.metrics.mode, 'secours', error);
    assert.equal(r.metrics.fallbackReason, error);
    assert.equal(r.cards[0].listing.id, 'm-poto', 'la recherche réelle IA-03 reste disponible');
    assert.doesNotMatch(r.reply, /401|402|429|HTTP|ECONN|stack/);
  }
});

test('diagnostic sûr : une erreur inattendue journalise seulement son étape technique', async () => {
  const logs = [];
  const engine = fakeTools();
  engine.searchPublished = async () => { throw new Error('détail interne à ne pas journaliser'); };
  const provider = createMockProvider({ script: [{ toolCalls: [tc('search_properties')] }] });
  const { manager } = setup({ provider, engine, log: (entry) => logs.push(entry) });
  const r = await manager.turn({ sessionId: 's', message: 'Je veux louer une maison à Poto-Poto, 200 000 FCFA.' });
  assert.equal(r.metrics.fallbackReason, 'provider_error');
  const fallback = logs.find((entry) => entry.event === 'fallback');
  assert.deepEqual(fallback, { event: 'fallback', reason: 'provider_error', stage: 'tool:search_properties', errorName: 'Error' });
  assert.doesNotMatch(JSON.stringify(logs), /détail interne/);
});

test('budget épuisé : aucun appel au fournisseur, message clair, secours IA-03', async () => {
  const { manager, seen } = setup({ meter: createCostMeter({ budgetUsd: 0 }) });
  const r = await manager.turn({ sessionId: 's', message: 'Je veux louer une maison à Poto-Poto, 200 000 FCFA.' });
  assert.equal(seen.length, 0);
  assert.equal(r.metrics.fallbackReason, 'budget_exhausted');
  assert.match(r.reply, /budget/);
  assert.ok(r.cards.length >= 1);
});

test('désactivé ou sans clé (DeepSeek réel) : secours immédiat, aucun appel', async () => {
  const off = resolveLlmConfig({ ALTIMMO_LLM_PROVIDER: 'deepseek' });
  const real = { name: 'deepseek', model: 'deepseek-flash', simulated: false, chatStream: async () => { throw new Error('ne doit pas être appelé'); } };
  const { manager } = setup({ provider: real, cfg: off });
  const r = await manager.turn({ sessionId: 's', message: 'Je veux louer une maison à Poto-Poto, 200 000 FCFA.' });
  assert.equal(r.metrics.fallbackReason, 'disabled');
});

test('annulation pendant le flux : aucune mémoire validée', async () => {
  const provider = createMockProvider({ script: [{ content: 'Bonjour ! Pour bien vous conseiller, cherchez-vous à acheter ou à louer votre future maison familiale ?' }], delayMs: 3, chunkSize: 4 });
  const { manager, store } = setup({ provider });
  const controller = new AbortController();
  await assert.rejects(manager.streamTurn({ sessionId: 's', message: 'Je cherche une maison à Poto-Poto.' }, (e) => { if (e === 'delta') controller.abort(); }, controller.signal), (e) => e.name === 'AbortError');
  assert.equal(store.get('s').messages.length, 0);
  assert.equal(store.get('s').state.criteria.district, null);
  assert.equal(store.pendingDrafts(), 0);
});

test('minimisation : ni téléphone ni courriel envoyés au fournisseur ; aucun fait privé d annonce', async () => {
  const { manager, seen } = setup();
  await manager.turn({ sessionId: 's', message: 'Je veux louer une maison à Bacongo, 200 000 FCFA. Mon numéro est 06 123 45 67, mon mail jean.k@exemple.cg.' });
  await manager.turn({ sessionId: 's', message: 'Je veux louer un appartement à Bacongo, 200 000 FCFA.' });
  const sent = JSON.stringify(seen);
  assert.doesNotMatch(sent, /06 123 45 67|jean\.k@exemple/);
  assert.doesNotMatch(sent, /IGNORE LES R|\+242 06 000|ownerPhone|description/);
  assert.match(sent, /téléphone masqué/);
});

test('refus commercial : aucun appel au modèle, aucun coût', async () => {
  const { manager, seen, meter } = setup();
  const r = await manager.turn({ sessionId: 's', message: 'Je veux payer l’acompte avec Yabetoo et réserver la villa.' });
  assert.equal(r.status, 'refused');
  assert.equal(seen.length, 0);
  assert.equal(meter.snapshot().spentUsd, 0);
});

test('coût : par conversation et total ; limite de session respectée', async () => {
  const meter = createCostMeter({ budgetUsd: 10, sessionMaxUsd: 0.0006 });
  const { manager } = setup({ meter });
  const out = await talk(manager, 's', ['Bonjour', 'Je veux louer une maison à Poto-Poto, 200 000 FCFA.', 'Compare les deux premiers.', 'Et à Ouenzé ?', 'Et à Bacongo ?', 'Et à Moungali ?']);
  assert.ok(meter.snapshot().bySession.s.spentUsd <= 0.0006);
  assert.ok(out.some((r) => r.metrics.fallbackReason === 'session_budget_exhausted'), 'la limite finit par basculer en secours');
});
