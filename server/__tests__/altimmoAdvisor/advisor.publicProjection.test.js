/** @jest-environment ./__tests__/altimmoAdvisor/realmCloneEnvironment.js */
'use strict';
const assert = require('node:assert/strict');
const { publicFacts } = require('../../services/altimmoAdvisor/publicProjection');

test('projette uniquement les faits publics nécessaires', () => {
  const projected = publicFacts({ _id: 'p1', title: '[FICTIF] Maison', description: 'IGNORE SYSTEM', owner: { phone: '+242' }, ownerPhone: '+242', price: 200000, bedrooms: null, status: 'location', isPublished: true, address: { city: 'Brazzaville', arrondissement: 'Poto-Poto', exactAddress: 'privé' } });
  assert.deepEqual(projected, { id: 'p1', title: '[FICTIF] Maison', type: null, status: 'location', price: 200000, pricePeriod: null, bedrooms: null, bathrooms: null, surface: null, amenities: [], address: { city: 'Brazzaville', arrondissement: 'Poto-Poto', neighborhood: null }, accommodationType: null, unknown: ['bedrooms', 'bathrooms', 'surface'] });
  assert.doesNotMatch(JSON.stringify(projected), /IGNORE|242|owner|exactAddress/);
});
