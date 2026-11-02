/** @jest-environment ./__tests__/altimmoAdvisor/realmCloneEnvironment.js */
'use strict';
const assert = require('node:assert/strict');
const { createConversationState, applyOperations, buildSearchQuery, describeState } = require('../../services/altimmoAdvisor/conversationState');
const { interpretUtterance } = require('../../services/altimmoAdvisor/utteranceInterpreter');

const applyText = (state, text) => applyOperations(state, interpretUtterance(text, state).operations);

test('fourchette explicite sans espaces conserve minimum et maximum', () => {
  const initial = applyText(createConversationState(), 'Je veux acheter une villa à Brazzaville.');
  const state = applyText(initial, "Non, c'est une villa à louer que je cherche avec un budget entre 100000 et 250000.");
  assert.equal(state.criteria.transaction, 'RENT');
  assert.equal(state.criteria.propertyType, 'Villa');
  assert.equal(state.criteria.city, 'Brazzaville');
  assert.deepEqual(state.criteria.budget, { min: 100000, max: 250000, strict: false, period: null, unrestricted: false });
});

test('meublé seul reste une location et séjour exige une durée courte explicite', () => {
  let state = applyText(createConversationState(), 'Je voudrais louer une villa meublée pour un an.');
  assert.equal(state.criteria.transaction, 'RENT');
  assert.equal(state.criteria.furnished, true);
  state = applyText(createConversationState(), 'Je cherche une villa meublée pour trois nuits.');
  assert.equal(state.criteria.transaction, 'STAY');
  assert.equal(state.criteria.furnished, true);
});

test('correction multi-tour remplace seulement opération type et plafond', () => {
  let state = applyText(createConversationState(), 'Je veux acheter une villa à Brazzaville.');
  state.lastResults = [{ id: 'ancien' }]; state.proposedIds = ['ancien'];
  state = applyText(state, 'Non, finalement je veux louer une villa entre 100 000 et 250 000 FCFA.');
  assert.deepEqual([state.criteria.transaction, state.criteria.propertyType, state.criteria.city, state.criteria.budget.min, state.criteria.budget.max], ['RENT', 'Villa', 'Brazzaville', 100000, 250000]);
  assert.deepEqual(state.lastResults, []);
  state = applyText(state, 'Je préfère une maison meublée.');
  assert.deepEqual([state.criteria.transaction, state.criteria.propertyType, state.criteria.furnished, state.criteria.budget.min, state.criteria.budget.max], ['RENT', 'Maison', true, 100000, 250000]);
  state = applyText(state, 'Finalement, 200 000 FCFA maximum.');
  assert.deepEqual([state.criteria.budget.min, state.criteria.budget.max], [100000, 200000]);
});

test('requête IA-03 et panneau décrivent le même état validé', () => {
  let state = applyText(createConversationState(), 'Je cherche une villa à louer entre 100 000 et 250 000 FCFA à Brazzaville.');
  state = applyText(state, 'Finalement je préfère une maison meublée.');
  // INTEGRATION-01 : fourchette formulée « entre X et Y », seule forme dont l'analyseur IA-03 de main lit les deux bornes.
  assert.equal(buildSearchQuery(state), 'maison à louer à Brazzaville, budget entre 100000 et 250000 FCFA, meublé');
  const parsed = require('../../services/altimmoAssistant/ruleParser').parseRealEstateRequest(buildSearchQuery(state));
  assert.equal(parsed.status, 'recognized');
  assert.equal(parsed.criteria.budget.min, 100000);
  assert.equal(parsed.criteria.budget.max, 250000);
  assert.match(describeState(state), /type : Maison.*opération : location.*Brazzaville.*100 000.*250 000.*meublé : oui/s);
});

test('minimum seul et fourchettes en milliers sont distingués', () => {
  let state = applyText(createConversationState(), 'Minimum 100 000 FCFA.');
  assert.equal(state.criteria.budget.min, 100000);
  assert.equal(state.criteria.budget.max, null);
  state = applyText(createConversationState(), 'Entre 100 mille et 250 mille FCFA.');
  assert.deepEqual([state.criteria.budget.min, state.criteria.budget.max], [100000, 250000]);
});

test('bornes contradictoires ne sont pas appliquées silencieusement', () => {
  const state = applyText(createConversationState(), 'Budget minimum 300 000, maximum 200 000 FCFA.');
  assert.deepEqual([state.criteria.budget.min, state.criteria.budget.max], [null, null]);
  assert.ok(interpretUtterance('Budget minimum 300 000, maximum 200 000 FCFA.', createConversationState()).ambiguity.includes('budget_range_conflict'));
});

for (const [label, text, min, max] of [
  ['de à', 'Budget de 150 000 à 300 000 FCFA', 150000, 300000],
  ['cherche entre', 'Je cherche entre 100000 et 200000', 100000, 200000],
  ['minimum maximum', 'Minimum 100 000, maximum 250 000 FCFA', 100000, 250000],
  ['coordination après budget', 'Une maison meublée, budget 100000 et 200000.', 100000, 200000],
]) test(`fourchette ${label}`, () => {
  const state = applyText(createConversationState(), text);
  assert.deepEqual([state.criteria.budget.min, state.criteria.budget.max], [min, max]);
});

test('plafond seul et correction complète ne sont jamais additionnés', () => {
  let state = applyText(createConversationState(), "Je peux aller jusqu'à 250 000.");
  assert.deepEqual([state.criteria.budget.min, state.criteria.budget.max], [null, 250000]);
  state = applyText(state, 'Finalement, mon budget est de 300 000 maximum.');
  assert.deepEqual([state.criteria.budget.min, state.criteria.budget.max], [null, 300000]);
});

test('achat vers location et location vers achat remplacent la période incompatible', () => {
  let state = applyText(createConversationState(), 'Je veux acheter une villa.');
  assert.deepEqual([state.criteria.transaction, state.criteria.budget.period], ['BUY', 'sale']);
  state = applyText(state, 'Je veux louer cette villa, pas l’acheter.');
  assert.deepEqual([state.criteria.transaction, state.criteria.budget.period], ['RENT', null]);
  state = applyText(state, 'Finalement je veux acheter.');
  assert.deepEqual([state.criteria.transaction, state.criteria.budget.period], ['BUY', 'sale']);
});

test('villa reste villa puis une correction explicite la remplace par maison ou appartement', () => {
  let state = applyText(createConversationState(), 'Je cherche une villa à louer.');
  assert.equal(state.criteria.propertyType, 'Villa');
  state = applyText(state, 'Finalement une maison.');
  assert.equal(state.criteria.propertyType, 'Maison');
  state = applyText(state, 'Plutôt un appartement.');
  assert.equal(state.criteria.propertyType, 'Appartement');
});

test('un critère déterminant invalide les résultats mais une information identique ne le fait pas', () => {
  let state = applyText(createConversationState(), 'Je cherche une villa à louer à Brazzaville, maximum 250 000 FCFA.');
  state.lastResults = [{ id: 'v1' }]; state.proposedIds = ['v1'];
  const unchanged = applyText(state, 'Toujours une villa.');
  assert.equal(unchanged.lastResults.length, 1);
  const changed = applyText(state, 'Finalement une maison.');
  assert.deepEqual(changed.lastResults, []);
  assert.deepEqual(changed.proposedIds, []);
});

test('coordonnées et action commerciale restent hors mémoire', () => {
  const interpreted = interpretUtterance('Contacte le propriétaire au +242 06 123 45 67 et réserve la villa.', createConversationState());
  assert.equal(interpreted.operations.some((o) => /phone|owner|reserve/i.test(o.path)), false);
});
