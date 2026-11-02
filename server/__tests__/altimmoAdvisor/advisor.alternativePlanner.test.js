/** @jest-environment ./__tests__/altimmoAdvisor/realmCloneEnvironment.js */
'use strict';
const assert = require('node:assert/strict');
const { proposeRelaxation, proposeMoreSpace } = require('../../services/altimmoAdvisor/alternativePlanner');
const { createConversationState, applyOperations, buildSearchQuery } = require('../../services/altimmoAdvisor/conversationState');

const op = (o, path, value) => ({ op: o, path, value, source: 'explicit' });
const base = applyOperations(createConversationState(), [op('set', 'transaction', 'RENT'), op('set', 'propertyType', 'Maison'), op('set', 'district', 'Moungali'), op('set', 'bedrooms.min', 3), op('set', 'budget.max', 300000), op('set', 'budget.strict', true)]);
const searcher = (counts) => {
  const queries = [];
  const fn = async (query) => { queries.push(query); return { items: Array.from({ length: counts(query) }, (_, i) => ({ listing: { id: `x${i}` } })) }; };
  return { fn, queries };
};

test('aucun résultat : élargit le quartier sans en nommer, en conservant budget et chambres', async () => {
  const { fn, queries } = searcher((q) => (q.includes('Moungali') ? 0 : 2));
  const proposal = await proposeRelaxation(base, fn);
  assert.equal(proposal.id, 'widen_district');
  assert.deepEqual(proposal.operations, [{ op: 'remove', path: 'district', source: 'relaxation' }]);
  assert.equal(proposal.count, 2);
  assert.match(proposal.question, /autres quartiers de Brazzaville/);
  assert.match(proposal.question, /300 000 FCFA.*3 chambres|3 chambres.*300 000 FCFA/);
  assert.doesNotMatch(proposal.question, /Poto-Poto|Bacongo|Ouenzé|Talangaï|Makélékélé|voisin/);
  assert.ok(proposal.preserved.includes('votre budget maximum de 300 000 FCFA'));
  assert.equal(queries[0], buildSearchQuery(applyOperations(base, proposal.operations)));
});

test('ne propose qu une option vérifiée et jamais le dépassement d un budget strict', async () => {
  const { fn, queries } = searcher((q) => (q.includes('500000') || q.includes('360000') ? 3 : 0));
  assert.equal(await proposeRelaxation(base, fn), null);
  assert.equal(queries.some((q) => /budget maximum 3[6-9]\d{4}|budget maximum [4-9]\d{5}/.test(q)), false);
});

test('budget non strict : hausse proposée en dernier recours, avec le montant exact', async () => {
  const flexible = applyOperations(base, [op('replace', 'budget.strict', false)]);
  const { fn } = searcher((q) => (q.includes('360000') ? 1 : 0));
  const proposal = await proposeRelaxation(flexible, fn);
  assert.equal(proposal.id, 'raise_budget');
  assert.match(proposal.question, /360 000 FCFA/);
});

test('refus mémorisé : l option refusée n est pas reproposée', async () => {
  const refused = { ...base, rejectedRelaxations: ['widen_district'] };
  const { fn } = searcher((q) => (q.includes('Moungali') && q.includes('villa') ? 1 : q.includes('Moungali') ? 0 : 5));
  const proposal = await proposeRelaxation(refused, fn);
  assert.equal(proposal.id, 'other_type');
  assert.match(proposal.question, /villa/i);
});

test('famille : réduire les chambres reste la dernière option', async () => {
  const family = { ...base, motivations: ['famille'], rejectedRelaxations: ['widen_district'] };
  const { fn, queries } = searcher((q) => (q.includes('au moins 2 chambres') || q.includes('villa') ? 1 : 0));
  const proposal = await proposeRelaxation(family, fn);
  assert.equal(proposal.id, 'other_type');
  assert.equal(queries.indexOf(queries.find((q) => q.includes('villa'))) < queries.length, true);
});

test('logement trop petit : plus d espace, éventuellement dans un autre quartier', async () => {
  const shown = { ...base, lastResults: [{ id: 'a', bedrooms: 3, surface: 80 }] };
  const { fn } = searcher((q) => (q.includes('au moins 4 chambres') && !q.includes('Moungali') ? 2 : 0));
  const proposal = await proposeMoreSpace(shown, fn);
  assert.equal(proposal.id, 'more_space');
  assert.match(proposal.question, /superficie|espace/i);
  assert.match(proposal.question, /autre quartier/i);
  assert.equal(proposal.count, 2);
});
