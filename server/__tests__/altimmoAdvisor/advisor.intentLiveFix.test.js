/** @jest-environment ./__tests__/altimmoAdvisor/realmCloneEnvironment.js */
'use strict';
// Défauts observés lors de la revérification DeepSeek LIVE INTENT-FIX (2026-11-02, evidence-intent/live-transcripts.jsonl).
// L1 : tour « Brazzaville. » en exploration : le modèle répond avant la recherche imposée et cite un quartier vu au tour
//      précédent, effacé de la mémoire par le changement de filtre → rejet du garde, narration de secours.
// L2 : « maison ou appartement à louer » sans résultat : le modèle cite les autres biens du catalogue sans faits vérifiés
//      dans le tour → rejet du garde (« quartier non fourni »).
const assert = require('node:assert/strict');
const { createSessionStore } = require('../../services/altimmoAdvisor/sessionStore');
const { createAgent } = require('../../services/altimmoAdvisor/agent');
const { createConversationManager } = require('../../services/altimmoAdvisor/llm/conversationManager');
const { createMockProvider } = require('../../services/altimmoAdvisor/llm/mockProvider');
const { resolveLlmConfig } = require('../../services/altimmoAdvisor/llm/providerConfig');
const { createCostMeter } = require('../../services/altimmoAdvisor/llm/costMeter');
const { fakeTools } = require('./fixtures');

const config = resolveLlmConfig({ ALTIMMO_LLM_ENABLED: 'true', ALTIMMO_LLM_PROVIDER: 'mock' });
function setup(script) {
  const store = createSessionStore(); const seen = []; const engine = fakeTools();
  const base = createMockProvider({ script });
  const provider = { ...base, chatStream: (args) => { seen.push(structuredClone(args.messages)); return base.chatStream(args); } };
  const fallbackAgent = createAgent({ store, tools: engine, narration: 'deterministic' });
  return { manager: createConversationManager({ store, engine, provider, config, meter: createCostMeter({ budgetUsd: 10 }), fallbackAgent, debug: true }), seen, engine };
}
const lastTool = (messages) => JSON.parse(messages.filter((m) => m.role === 'tool').at(-1).content);

test('L1 : recherche imposée par la politique exécutée avant le modèle, qui rédige sur des faits vérifiés', async () => {
  const { manager, seen } = setup([
    { content: 'Voici tout le catalogue publié.' },
    { content: 'À Brazzaville, la maison de Poto-Poto coûte 150 000 FCFA et la villa de Moungali 250 000 FCFA.' },
  ]);
  const t1 = await manager.turn({ sessionId: 's', message: 'Propose-moi tous les biens de ton catalogue.' });
  const t2 = await manager.turn({ sessionId: 's', message: 'Brazzaville.' });
  for (const t of [t1, t2]) {
    assert.equal(t.metrics.narration, 'model', t.metrics.narrationViolation);
    assert.equal(t.status, 'success');
  }
  assert.match(t2.reply, /Poto-Poto coûte 150 000 FCFA/);
  // Le premier appel du modèle reçoit déjà le résultat de la recherche imposée (aucun aller-retour de plus).
  assert.equal(seen.length, 2);
  assert.equal(lastTool(seen[1]).nombre, 5);
  assert.match(t2.criteria, /exploration du catalogue/);
});

test('L2 : recherche ciblée sans résultat : alternatives du catalogue fournies comme faits, citables sans rejet', async () => {
  const { manager, seen, engine } = setup([{ content: 'Aucun appartement à vendre n’est publié, même sans limite de budget. Le catalogue compte par ailleurs une maison à louer à Poto-Poto, à 150 000 FCFA par mois.' }]);
  const t = await manager.turn({ sessionId: 's', message: 'Je cherche un appartement à acheter à Brazzaville, peu importe le budget.' });
  assert.equal(t.status, 'no_results');
  assert.equal(t.metrics.narration, 'model', t.metrics.narrationViolation);
  assert.deepEqual(t.cards, [], 'les alternatives ne sont jamais présentées comme résultats');
  const result = lastTool(seen[0]);
  assert.equal(result.nombre, 0);
  assert.ok(result.alternatives_catalogue.length > 0);
  assert.match(result.alternatives_catalogue_consigne, /ne correspondent pas/);
  assert.ok(result.alternatives_catalogue.every((a) => !('description' in a)), 'projection publique uniquement');
  assert.ok(engine.calls.some(([k]) => k === 'list'));
});

test('L2 : un quartier ou un prix absent du catalogue reste rejeté (le garde n’est pas assoupli)', async () => {
  const { manager } = setup([{ content: 'Aucun appartement à vendre. Il y a une maison à Talangaï à 90 000 FCFA.' }]);
  const t = await manager.turn({ sessionId: 's', message: 'Je cherche un appartement à acheter à Brazzaville, peu importe le budget.' });
  assert.equal(t.metrics.narration, 'fallback');
  assert.match(t.metrics.narrationViolation, /quartier non fourni : Talangaï|nombre non fondé/);
});

// L3 (revérification LIVE finale, tour « Brazzaville. ») : le modèle a rappelé le budget retiré (« 100 000 ») ;
// le garde l'a coupé à juste titre. La consigne interdit désormais de citer un critère retiré ; le garde reste inchangé.
test('L3 : consigne explicite contre le rappel d’un critère retiré', async () => {
  const { manager, seen } = setup([{ content: 'Voici tout le catalogue publié.' }, { content: 'Voici les biens à Brazzaville.' }]);
  await manager.turn({ sessionId: 's', message: 'Je cherche une maison à louer budget entre 100000 et 250000.' });
  const system = seen.at(-1).find((m) => m.role === 'system').content;
  assert.match(system, /critère retiré/);
});

test('L3 : un montant d’un budget retiré reste rejeté par le garde en exploration', async () => {
  const { manager } = setup([{ content: 'Aucune maison.' }, { content: 'Voici le catalogue.' }, { content: 'À Brazzaville, toujours aucune maison entre 100 000 et 250 000 FCFA.' }]);
  await manager.turn({ sessionId: 's', message: 'Je cherche une maison à louer budget entre 100000 et 250000.' });
  await manager.turn({ sessionId: 's', message: 'Propose-moi tous les biens de ton catalogue.' });
  const t = await manager.turn({ sessionId: 's', message: 'Brazzaville.' });
  assert.equal(t.metrics.narration, 'fallback');
  assert.match(t.metrics.narrationViolation, /nombre non fondé : 100 000/);
  assert.doesNotMatch(t.reply, /100 000|250 000/);
});
