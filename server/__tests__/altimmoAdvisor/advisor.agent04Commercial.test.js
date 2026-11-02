/** @jest-environment ./__tests__/altimmoAdvisor/realmCloneEnvironment.js */
'use strict';
const assert = require('node:assert/strict');
const { FORBIDDEN_COMMERCIAL } = require('../../services/altimmoAdvisor/dialoguePolicy');
const { normalize } = require('../../services/altimmoAdvisor/utteranceInterpreter');

for (const phrase of ['Préviens-moi quand un bien paraît', 'Rappelle-moi demain', 'Programme une visite', 'Contacte le propriétaire', 'Réserve ce bien']) {
  test(`action non prise en charge refusée : ${phrase}`, () => assert.match(normalize(phrase), FORBIDDEN_COMMERCIAL));
}
