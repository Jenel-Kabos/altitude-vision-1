/** @jest-environment ./__tests__/altimmoAdvisor/realmCloneEnvironment.js */
'use strict';
const assert = require('node:assert/strict');
const { createSessionStore } = require('../../services/altimmoAdvisor/sessionStore');
const { applyOperations } = require('../../services/altimmoAdvisor/conversationState');

const op = (o, path, value) => ({ op: o, path, value, source: 'explicit' });
const commit = (store, id, ops, user = 'u', assistant = 'a') => {
  const draft = store.beginTurn(id);
  draft.state = applyOperations(draft.state, ops);
  return store.commitTurn(id, draft, { user, assistant });
};

test('un tour validé applique atomiquement messages et état', () => {
  const store = createSessionStore();
  commit(store, 's1', [op('set', 'propertyType', 'Maison'), op('set', 'budget.max', 200000)], 'Maison 200 000', 'Acheter ou louer ?');
  const session = store.get('s1');
  assert.deepEqual(session.messages, [{ role: 'user', content: 'Maison 200 000' }, { role: 'assistant', content: 'Acheter ou louer ?' }]);
  assert.equal(session.state.criteria.budget.max, 200000);
});

test('un brouillon annulé ne modifie ni messages ni critères', () => {
  const store = createSessionStore();
  commit(store, 's1', [op('set', 'budget.max', 200000)]);
  const before = store.get('s1');
  const draft = store.beginTurn('s1');
  draft.state = applyOperations(draft.state, [op('replace', 'budget.max', 900000)]);
  draft.messages.push({ role: 'user', content: 'partiel' });
  store.abortTurn('s1', draft.token);
  assert.deepEqual(store.get('s1').messages, before.messages);
  assert.equal(store.get('s1').state.criteria.budget.max, 200000);
  assert.equal(store.pendingDrafts(), 0);
  assert.throws(() => store.commitTurn('s1', draft, { user: 'x', assistant: 'y' }), /brouillon/i);
});

test('un brouillon remplacé par un tour plus récent ne peut plus être validé', () => {
  const store = createSessionStore();
  const stale = store.beginTurn('s1');
  const fresh = store.beginTurn('s1');
  assert.throws(() => store.commitTurn('s1', stale, { user: 'x', assistant: 'y' }), /brouillon/i);
  store.commitTurn('s1', fresh, { user: 'x', assistant: 'y' });
  assert.equal(store.get('s1').messages.length, 2);
});

test('remplacement, suppression, restauration et refus d alternative mémorisés', () => {
  const store = createSessionStore();
  commit(store, 's', [op('set', 'budget.max', 200000), op('set', 'district', 'Poto-Poto'), op('set', 'amenities.preferred', 'cour')]);
  commit(store, 's', [op('replace', 'budget.max', 250000), op('replace', 'district', 'Moungali'), op('remove', 'amenities.preferred', 'cour')]);
  commit(store, 's', [op('restore', 'amenities.preferred', 'cour')]);
  const draft = store.beginTurn('s');
  draft.state.rejectedRelaxations.push('widen_district');
  store.commitTurn('s', draft, { user: 'Non', assistant: 'Entendu.' });
  const { state } = store.get('s');
  assert.equal(state.criteria.budget.max, 250000);
  assert.equal(state.criteria.district, 'Moungali');
  assert.deepEqual(state.amenities.preferred, ['cour']);
  assert.deepEqual(state.rejectedRelaxations, ['widen_district']);
});

test('plafonds : messages, caractères, sessions, TTL et brouillons abandonnés', () => {
  let now = 1000;
  const store = createSessionStore({ maxMessages: 4, maxChars: 30, maxSessions: 2, ttlMs: 100, draftTtlMs: 50, now: () => now });
  for (let i = 0; i < 4; i += 1) commit(store, 'a', [], `u${i}`, `a${i}`);
  assert.deepEqual(store.get('a').messages.map((m) => m.content), ['u2', 'a2', 'u3', 'a3']);
  commit(store, 'b', [], 'x'.repeat(40), 'ok');
  assert.equal(store.get('b').messages.reduce((sum, m) => sum + m.content.length, 0) <= 30, true);
  now += 1; commit(store, 'c', []);
  assert.equal(store.size(), 2);
  assert.equal(store.get('a'), null, 'la session la plus ancienne est évincée');
  store.beginTurn('c'); now += 60;
  assert.equal(store.sweep() >= 1, true);
  assert.equal(store.pendingDrafts(), 0);
  now += 200;
  assert.equal(store.get('c'), null);
});

test('rejette identifiants et messages invalides, réinitialise une session', () => {
  const store = createSessionStore();
  assert.throws(() => store.beginTurn(''), /session/i);
  assert.throws(() => store.beginTurn('a/b'), /session/i);
  const draft = store.beginTurn('s');
  assert.throws(() => store.commitTurn('s', draft, { user: '', assistant: 'x' }), /message/i);
  commit(store, 's', []);
  assert.equal(store.reset('s'), true);
  assert.equal(store.get('s'), null);
});

test('aucune persistance : le module n importe ni disque ni base', async () => {
  const source = require('node:fs').readFileSync(require('node:path').join(__dirname, '../../services/altimmoAdvisor/sessionStore.js'), 'utf8');
  assert.doesNotMatch(source, /node:fs|mongoose|mongodb|writeFile|localStorage/);
});
