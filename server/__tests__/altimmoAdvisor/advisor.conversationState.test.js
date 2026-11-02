/** @jest-environment ./__tests__/altimmoAdvisor/realmCloneEnvironment.js */
'use strict';
const assert = require('node:assert/strict');
const { createConversationState, applyOperations, buildSearchQuery, describeState, evaluateListing, LIMITS } = require('../../services/altimmoAdvisor/conversationState');

const op = (o, path, value) => ({ op: o, path, value, source: 'explicit' });

test('remplace le budget sans addition et conserve le reste', () => {
  let state = applyOperations(createConversationState(), [op('set', 'propertyType', 'Maison'), op('set', 'district', 'Poto-Poto'), op('set', 'city', 'Brazzaville'), op('set', 'budget.max', 200000)]);
  state = applyOperations(state, [op('replace', 'budget.max', 250000)]);
  state = applyOperations(state, [op('set', 'amenities.preferred', 'cour')]);
  assert.deepEqual(state.criteria, { mode: null, transaction: null, propertyType: 'Maison', propertyTypes: [], city: 'Brazzaville', district: 'Poto-Poto', budget: { min: null, max: 250000, strict: false, period: null, unrestricted: false }, furnished: null, bedrooms: { min: null }, surface: { min: null } });
  assert.deepEqual(state.amenities, { required: [], preferred: ['cour'] });
  assert.deepEqual(state.criteriaHistory.at(-2), { path: 'budget.max', value: 200000 });
});

test('change de quartier, supprime puis restaure la cour, ne mute jamais l entrée', () => {
  const base = applyOperations(createConversationState(), [op('set', 'district', 'Poto-Poto'), op('set', 'amenities.preferred', 'cour')]);
  const frozen = structuredClone(base);
  const moved = applyOperations(base, [op('replace', 'district', 'Moungali')]);
  assert.equal(moved.criteria.district, 'Moungali');
  const removed = applyOperations(moved, [op('remove', 'amenities.preferred', 'cour')]);
  assert.deepEqual(removed.amenities.preferred, []);
  const restored = applyOperations(removed, [op('restore', 'amenities.preferred', 'cour')]);
  assert.deepEqual(restored.amenities.preferred, ['cour']);
  const back = applyOperations(restored, [op('restore', 'district')]);
  assert.equal(back.criteria.district, 'Poto-Poto');
  assert.deepEqual(base, frozen);
});

test('rejette chemins et valeurs hors catalogue fermé', () => {
  const state = createConversationState();
  assert.throws(() => applyOperations(state, [op('set', 'ownerPhone', '+242')]), /chemin/i);
  assert.throws(() => applyOperations(state, [op('set', 'budget.max', -1)]), /valeur/i);
  assert.throws(() => applyOperations(state, [op('set', 'transaction', 'PAY')]), /valeur/i);
  assert.throws(() => applyOperations(state, [op('set', 'amenities.preferred', 'piscine olympique privée')]), /valeur/i);
  assert.throws(() => applyOperations(state, [{ op: 'drop', path: 'district' }]), /opération/i);
});

test('historique et listes bornés', () => {
  let state = createConversationState();
  for (let i = 1; i <= LIMITS.history + 10; i += 1) state = applyOperations(state, [op('set', 'budget.max', 100000 + i)]);
  assert.equal(state.criteriaHistory.length, LIMITS.history);
  for (const amenity of ['cour', 'parking', 'jardin', 'piscine', 'climatisation', 'garage', 'balcon', 'terrasse', 'forage', 'groupe électrogène', 'cour']) state = applyOperations(state, [op('set', 'amenities.preferred', amenity)]);
  assert.equal(state.amenities.preferred.length <= LIMITS.amenities, true);
  assert.equal(new Set(state.amenities.preferred).size, state.amenities.preferred.length);
});

test('requête IA-03 canonique sans critère strict ni préférence non vérifiable', () => {
  const state = applyOperations(createConversationState(), [op('set', 'transaction', 'RENT'), op('set', 'propertyType', 'Maison'), op('set', 'district', 'Poto-Poto'), op('set', 'city', 'Brazzaville'), op('set', 'bedrooms.min', 3), op('set', 'budget.max', 250000), op('set', 'budget.strict', true), op('set', 'amenities.preferred', 'cour')]);
  assert.equal(buildSearchQuery(state), 'maison à louer à Poto-Poto, Brazzaville, au moins 3 chambres, budget maximum 250000 FCFA');
  assert.equal(buildSearchQuery(applyOperations(state, [op('remove', 'transaction')])), 'maison à Poto-Poto, Brazzaville, au moins 3 chambres, budget maximum 250000 FCFA');
  assert.match(describeState(state), /Maison.*location.*Poto-Poto.*250 000 FCFA.*strict.*cour/s);
});

test('évalue une annonce projetée : budget, chambres, équipements, école inconnue', () => {
  const state = applyOperations(createConversationState(), [op('set', 'budget.max', 200000), op('set', 'bedrooms.min', 3), op('set', 'amenities.preferred', 'cour'), op('set', 'proximity.school', 'important')]);
  const fit = evaluateListing(state, { id: 'p', price: 150000, bedrooms: 4, amenities: ['wifi'], address: { arrondissement: 'Poto-Poto' }, unknown: [] });
  assert.deepEqual(fit.strengths, ['prix de 150 000 FCFA, sous votre budget de 200 000 FCFA', '4 chambres, au-delà des 3 demandées']);
  assert.deepEqual(fit.limits, ['cour non indiquée dans l’annonce']);
  assert.deepEqual(fit.toVerify, ['proximité d’une école (non vérifiable dans les annonces)']);
  const unknownPrice = evaluateListing(state, { id: 'q', price: null, bedrooms: null, amenities: ['cour'], address: {}, unknown: ['price', 'bedrooms'] });
  assert.ok(unknownPrice.toVerify.includes('prix non publié'));
  assert.ok(unknownPrice.strengths.includes('cour indiquée'));
});
