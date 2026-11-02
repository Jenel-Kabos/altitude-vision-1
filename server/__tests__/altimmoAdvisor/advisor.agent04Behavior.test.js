/** @jest-environment ./__tests__/altimmoAdvisor/realmCloneEnvironment.js */
'use strict';
const assert = require('node:assert/strict');
const { createConversationState, applyOperations } = require('../../services/altimmoAdvisor/conversationState');
const { createToolRunner } = require('../../services/altimmoAdvisor/llm/tools');
const { fakeTools } = require('./fixtures');

test('maison vers appartement remplace le type et invalide les recommandations', () => {
  let state = applyOperations(createConversationState(), [{ op: 'set', path: 'propertyType', value: 'Maison', source: 'explicit' }]);
  state.lastResults = [{ id: 'old' }]; state.proposedIds = ['old']; state.certified = { type: 'Maison' }; state.pendingRelaxation = { id: 'x' };
  state = applyOperations(state, [{ op: 'replace', path: 'propertyType', value: 'Appartement', source: 'explicit' }]);
  assert.equal(state.criteria.propertyType, 'Appartement');
  assert.deepEqual(state.lastResults, []); assert.deepEqual(state.proposedIds, []); assert.equal(state.certified, null); assert.equal(state.pendingRelaxation, null);
});

test('clarification interdit une recherche prématurée côté serveur', async () => {
  const draft = { state: createConversationState() };
  const engine = fakeTools();
  const runner = createToolRunner({ engine, draft, userText: 'Pour louer', interp: {}, allowedAction: 'clarify' });
  const { result } = await runner.run({ name: 'search_properties', arguments: '{}' });
  assert.equal(result.erreur, 'recherche_non_autorisee'); assert.equal(engine.calls.length, 0);
});

test('action search permet au serveur de garantir une recherche', async () => {
  const draft = { state: applyOperations(createConversationState(), [{ op: 'set', path: 'transaction', value: 'RENT', source: 'explicit' }, { op: 'set', path: 'propertyType', value: 'Maison', source: 'explicit' }, { op: 'set', path: 'budget.max', value: 250000, source: 'explicit' }]) };
  const runner = createToolRunner({ engine: fakeTools(), draft, userText: 'Montre-moi', interp: {}, allowedAction: 'search' });
  const result = await runner.ensureSearch();
  assert.ok(result.nombre >= 1); assert.equal(runner.facts.searched, true);
});
