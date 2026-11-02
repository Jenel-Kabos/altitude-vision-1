/** @jest-environment ./__tests__/altimmoAdvisor/realmCloneEnvironment.js */
'use strict';
// AI-AGENT-04-INTENT-FIX : affinage, nouvelle recherche et exploration du catalogue, filtres actifs.
const assert = require('node:assert/strict');
const { createSessionStore } = require('../../services/altimmoAdvisor/sessionStore');
const { createAgent } = require('../../services/altimmoAdvisor/agent');
const { createConversationManager } = require('../../services/altimmoAdvisor/llm/conversationManager');
const { createMockProvider } = require('../../services/altimmoAdvisor/llm/mockProvider');
const { simulatedDecide } = require('../../services/altimmoAdvisor/llm/simulatedAdvisor');
const { resolveLlmConfig } = require('../../services/altimmoAdvisor/llm/providerConfig');
const { createCostMeter } = require('../../services/altimmoAdvisor/llm/costMeter');
const { interpretUtterance } = require('../../services/altimmoAdvisor/utteranceInterpreter');
const { nextDialogueAction } = require('../../services/altimmoAdvisor/dialoguePolicy');
const { createConversationState, applyOperations, describeFilters, searchVariants } = require('../../services/altimmoAdvisor/conversationState');
const { fakeTools, CATALOG } = require('./fixtures');

const INCIDENT = ['Je cherche une maison à louer budget entre 100000 et 250000.', 'Propose-moi tous les biens de ton catalogue.', 'Brazzaville.', 'Peu importe le budget propose une maison ou un appartement à louer.'];
const config = resolveLlmConfig({ ALTIMMO_LLM_ENABLED: 'true', ALTIMMO_LLM_PROVIDER: 'mock' });
function setup({ fail = false } = {}) {
  const calls = []; const engine = fakeTools({ calls, fail }); const store = createSessionStore();
  let providerCalls = 0;
  const base = createMockProvider({ decide: simulatedDecide });
  const provider = { ...base, chatStream: (args) => { providerCalls += 1; return base.chatStream(args); } };
  const fallbackAgent = createAgent({ store, tools: engine, narration: 'deterministic' });
  const manager = createConversationManager({ store, engine, provider, config, meter: createCostMeter({ budgetUsd: 10 }), fallbackAgent });
  return { manager, calls, store, fallbackAgent, providerCalls: () => providerCalls };
}
// Rejoue un message sur l'état (interpréteur + politique), comme le serveur.
const step = (state, text) => { const interp = interpretUtterance(text, state); const policy = nextDialogueAction(state, interp, text); return { state: applyOperations(state, policy.operations), policy, interp }; };
const play = (texts, state = createConversationState()) => texts.reduce((acc, t) => [...acc, step(acc.at(-1)?.state || state, t)], []);

test('1 · recherche initiale : fourchette 100 000–250 000, maison, location', () => {
  const [t1] = play(INCIDENT.slice(0, 1));
  const c = t1.state.criteria;
  assert.deepEqual([c.transaction, c.propertyType, c.budget.min, c.budget.max, c.mode], ['RENT', 'Maison', 100000, 250000, null]);
  assert.equal(t1.policy.action, 'search');
});

test('2, 12 · « tous les biens de ton catalogue » : exploration, anciens filtres retirés, aucune question', () => {
  const [, t2] = play(INCIDENT.slice(0, 2));
  const c = t2.state.criteria;
  assert.equal(t2.interp.intent, 'explore');
  assert.deepEqual([c.mode, c.transaction, c.propertyType, c.budget.min, c.budget.max, c.city], ['explore', null, null, null, null, null]);
  assert.equal(t2.policy.action, 'search'); assert.equal(t2.policy.general, true);
  assert.ok(t2.state.criteriaHistory.some((h) => h.path === 'budget.max' && h.value === 250000), 'ancienne recherche conservée dans l historique');
});

test('11, 12 · « Brazzaville » après l exploration : ville seule, aucun ancien filtre réactivé', () => {
  const [, , t3] = play(INCIDENT.slice(0, 3));
  const c = t3.state.criteria;
  assert.deepEqual([c.mode, c.city, c.transaction, c.propertyType, c.budget.max], ['explore', 'Brazzaville', null, null, null]);
  assert.equal(t3.policy.action, 'search'); assert.equal(t3.policy.general, true);
});

test('3, 9 · « peu importe le budget … maison ou appartement à louer » : budget levé, deux types, Brazzaville conservée', () => {
  const t4 = play(INCIDENT).at(-1);
  const c = t4.state.criteria;
  assert.deepEqual([c.mode, c.transaction, c.propertyTypes, c.budget.min, c.budget.max, c.budget.unrestricted, c.city], [null, 'RENT', ['Maison', 'Appartement'], null, null, true, 'Brazzaville']);
  assert.equal(t4.policy.action, 'search'); assert.notEqual(t4.policy.general, true);
  const queries = searchVariants(t4.state).map((v) => v.criteria.propertyType);
  assert.deepEqual(queries, ['Maison', 'Appartement']);
});

test('3 · budget supprimé directement après une fourchette : aucune borne, pas de zéro, pas de question budget', () => {
  const t = play(['Je cherche une maison à louer à Brazzaville budget entre 100000 et 250000.', 'Peu importe le budget.']).at(-1);
  assert.deepEqual([t.state.criteria.budget.min, t.state.criteria.budget.max, t.state.criteria.budget.unrestricted], [null, null, true]);
  assert.equal(t.policy.action, 'search');
  for (const text of ['Sans limite de prix.', 'Quel que soit le loyer.']) assert.equal(step(t.state, text).state.criteria.budget.max, null);
});

test('4 · suppression du quartier : « oublie le quartier », « dans toute la ville », « n importe quel arrondissement »', () => {
  for (const text of ['Oublie le quartier.', 'Dans toute la ville.', 'N’importe quel arrondissement.']) {
    const t = play(['Je veux louer une maison à Poto-Poto, 200 000 FCFA.', text]).at(-1);
    assert.deepEqual([t.state.criteria.district, t.state.criteria.city], [null, 'Brazzaville'], text);
  }
});

test('5 · « peu importe le type de bien » : type(s) retirés, opération et budget conservés', () => {
  const t = play(['Je veux louer une maison à Poto-Poto, 200 000 FCFA.', 'Peu importe le type de bien.']).at(-1);
  assert.deepEqual([t.state.criteria.propertyType, t.state.criteria.propertyTypes, t.state.criteria.transaction, t.state.criteria.budget.max], [null, [], 'RENT', 200000]);
});

test('6 · « oublie mes anciens critères » et « recommençons une autre recherche » : tous les filtres retirés', () => {
  for (const text of ['Oublie mes anciens critères.', 'Recommençons une autre recherche.']) {
    const t = play(['Je veux louer une maison avec cour à Poto-Poto, 3 chambres, 200 000 FCFA.', text]).at(-1);
    const c = t.state.criteria;
    assert.deepEqual([c.transaction, c.propertyType, c.district, c.budget.max, c.bedrooms.min, t.state.amenities.preferred.length + t.state.amenities.required.length], [null, null, null, null, null, 0], text);
  }
});

test('7 · nouvelle recherche : « Maintenant, je veux acheter un terrain » remplace opération, type et budget', () => {
  const t = play(['Je veux louer une maison de 3 chambres à Poto-Poto, 200 000 FCFA.', 'Maintenant, je veux acheter un terrain.']).at(-1);
  const c = t.state.criteria;
  assert.equal(t.interp.intent, 'new_search');
  assert.deepEqual([c.transaction, c.propertyType, c.budget.max, c.bedrooms.min, c.district], ['BUY', 'Terrain', null, null, 'Poto-Poto']);
  const b = play(['Je veux louer une maison de 3 chambres à Poto-Poto, 200 000 FCFA.', 'Finalement, je cherche un bureau.']).at(-1).state.criteria;
  assert.deepEqual([b.propertyType, b.transaction, b.budget.max, b.bedrooms.min], ['Bureau', null, null, null]);
  const v = play(['Je veux louer une maison à Brazzaville, 200 000 FCFA.', 'On change de projet, je veux un logement pour les vacances.']).at(-1).state.criteria;
  assert.deepEqual([v.transaction, v.propertyType, v.budget.max], ['STAY', null, null]);
});

test('8 · affinage : un seul critère modifié, les autres conservés', () => {
  const base = ['Je veux louer une maison à Poto-Poto, 200 000 FCFA.'];
  const up = play([...base, 'Finalement, je peux monter à 300 000 FCFA.']).at(-1);
  assert.equal(up.interp.intent, 'refine');
  assert.deepEqual([up.state.criteria.budget.max, up.state.criteria.propertyType, up.state.criteria.district], [300000, 'Maison', 'Poto-Poto']);
  const yard = play([...base, 'Je préfère une maison avec cour.']).at(-1);
  assert.deepEqual([yard.state.amenities.preferred, yard.state.criteria.budget.max], [['cour'], 200000]);
  const rooms = play([...base, 'Je veux trois chambres minimum.']).at(-1);
  assert.deepEqual([rooms.state.criteria.bedrooms.min, rooms.state.criteria.budget.max], [3, 200000]);
  const villa = play(['Je veux louer une villa à Brazzaville entre 100 000 et 250 000 FCFA.', 'Finalement, je préfère une maison meublée.']).at(-1).state.criteria;
  assert.deepEqual([villa.propertyType, villa.furnished, villa.transaction, villa.budget.min, villa.budget.max], ['Maison', true, 'RENT', 100000, 250000]);
});

test('13 · panneau : exploration puis recherche ciblée multi-types, sans ancien critère inactif', () => {
  const [, t2, t3, t4] = play(INCIDENT);
  assert.match(describeFilters(t2.state), /mode : exploration du catalogue ; type : tous ; opération : toutes ; budget : sans restriction ; lieu : toutes les zones couvertes/);
  assert.match(describeFilters(t3.state), /mode : exploration du catalogue.*lieu : Brazzaville/);
  const panel = describeFilters(t4.state);
  assert.match(panel, /mode : recherche ciblée ; types : Maison, Appartement ; opération : location ; lieu : Brazzaville ; budget : sans restriction/);
  assert.doesNotMatch(panel, /100 000|250 000/);
});

test('14 · invalidation : l exploration et la levée du budget effacent les résultats et IDs périmés', () => {
  let s = play(INCIDENT.slice(0, 1)).at(-1).state;
  s = { ...s, lastResults: [CATALOG[0]], proposedIds: ['m-poto'] };
  const t2 = step(s, INCIDENT[1]);
  assert.deepEqual([t2.state.lastResults, t2.state.proposedIds], [[], []]);
  const t = step({ ...play(['Je cherche une maison à louer à Brazzaville budget entre 100000 et 250000.']).at(-1).state, lastResults: [CATALOG[0]], proposedIds: ['m-poto'] }, 'Peu importe le budget.');
  assert.deepEqual(t.state.lastResults, []);
});

test('incident complet (MOCK, gestionnaire réel) : appels moteur exacts, aucun ancien filtre, panneau synchronisé', async () => {
  const { manager, calls } = setup();
  const out = [];
  for (const message of INCIDENT) out.push(await manager.turn({ sessionId: 'inc', message }));
  // Tour 2 : liste publique, aucune recherche filtrée par maison/location/budget, aucune question géographique.
  assert.equal(out[1].status, 'success'); assert.doesNotMatch(out[1].reply, /Pointe-Noire ou|quel secteur|acheter ou pour louer/i);
  assert.deepEqual(out[1].cards.map((c) => c.listing.id).sort(), CATALOG.map((l) => l.id).sort());
  // Tour 3 : liste publique filtrée par ville, toujours sans anciens filtres.
  assert.equal(out[2].state.criteria.propertyType, null); assert.equal(out[2].state.criteria.budget.max, null);
  assert.equal(out[2].cards.length, CATALOG.filter((l) => l.address.city === 'Brazzaville').length);
  // Tour 4 : deux recherches IA-03 (maison, appartement) à louer à Brazzaville, sans budget.
  const searches = calls.filter((c) => c[0] === 'search').map((c) => c[1]);
  const last = searches.slice(-2);
  assert.deepEqual(last, ['maison à louer à Brazzaville', 'appartement à louer à Brazzaville']);
  for (const q of searches.slice(1)) assert.doesNotMatch(q, /budget/, 'aucune ancienne borne transmise après la levée');
  const ids = out[3].cards.map((c) => c.listing.id);
  assert.equal(new Set(ids).size, ids.length, '23 · aucun doublon');
  assert.ok(ids.includes('a-bacongo') && ids.includes('m-ouenze'), 'maison ET appartement, y compris au-delà de l ancien plafond');
  assert.match(out[3].criteria, /types : Maison, Appartement/);
  assert.doesNotMatch(out[3].reply, /budget de 250 000|dans votre budget/);
});

test('incident complet (secours IA-03, sans modèle) : même comportement côté serveur', async () => {
  const calls = []; const engine = fakeTools({ calls }); const store = createSessionStore();
  const agent = createAgent({ store, tools: engine, narration: 'deterministic' });
  const out = [];
  for (const message of INCIDENT) out.push(await agent.turn({ sessionId: 'f', message }));
  assert.equal(out[1].cards.length, CATALOG.length);
  assert.equal(out[2].state.criteria.propertyType, null);
  assert.deepEqual(calls.filter((c) => c[0] === 'search').slice(-2).map((c) => c[1]), ['maison à louer à Brazzaville', 'appartement à louer à Brazzaville']);
});

test('15 · recherche générale après une absence de résultat', async () => {
  const { manager } = setup();
  const r1 = await manager.turn({ sessionId: 'n', message: 'Je cherche un appartement de 5 chambres à Poto-Poto pour 100 000 FCFA à louer.' });
  assert.equal(r1.cards.length, 0);
  const r2 = await manager.turn({ sessionId: 'n', message: 'Montre-moi tout ce que vous avez.' });
  assert.equal(r2.cards.length, CATALOG.length);
});

test('22 · comparaison des biens présentés pendant l exploration : premier et troisième', async () => {
  const { manager, calls } = setup();
  const r = await manager.turn({ sessionId: 'c', message: 'Propose-moi tous les biens de ton catalogue.' });
  const shown = r.cards.map((c) => c.listing.id);
  await manager.turn({ sessionId: 'c', message: 'Compare le premier et le troisième.' });
  const compare = calls.find((c) => c[0] === 'compare');
  assert.deepEqual(compare[1], [shown[0], shown[2]]);
});

test('20 · source indisponible : erreur signalée, aucun repli fictif', async () => {
  const { manager } = setup({ fail: true });
  const r = await manager.turn({ sessionId: 'x', message: 'Propose-moi tous les biens de ton catalogue.' });
  assert.equal(r.cards.length, 0);
  assert.doesNotMatch(r.reply, /FICTIF|Maison Poto-Poto/);
});

test('19, 24 · exploration puis paiement ou réservation : refus, aucun appel au modèle', async () => {
  const { manager, providerCalls } = setup();
  await manager.turn({ sessionId: 'p', message: 'Propose-moi tous les biens de ton catalogue.' });
  const before = providerCalls();
  const r = await manager.turn({ sessionId: 'p', message: 'Réserve le premier et envoie-moi le lien de paiement.' });
  assert.equal(r.status, 'refused'); assert.equal(providerCalls(), before);
});

test('17, 18 · exploration : seuls des identifiants du catalogue, aucune donnée privée', async () => {
  const { manager } = setup();
  const r = await manager.turn({ sessionId: 'q', message: 'Je veux découvrir toutes vos annonces.' });
  const ids = new Set(CATALOG.map((l) => l.id));
  assert.ok(r.cards.every((c) => ids.has(c.listing.id)));
  assert.doesNotMatch(JSON.stringify(r), /\+242|IGNORE LES R|ownerPhone/);
});

test('21 · réinitialisation complète après exploration', async () => {
  const { manager, store } = setup();
  await manager.turn({ sessionId: 'r', message: 'Propose-moi tous les biens de ton catalogue.' });
  manager.reset('r');
  const fresh = store.get('r');
  assert.ok(fresh === null || fresh === undefined || fresh.state.criteria.mode === null);
});

test('intents : la question ouverte reste une exploration, une demande ciblée reste ciblée', () => {
  const s = createConversationState();
  for (const t of ['Propose-moi tous les biens de ton catalogue.', 'Montre-moi tout ce que vous avez.', 'Je veux découvrir toutes vos annonces.', 'Peu importe le budget, montre-moi les biens disponibles.', 'Bonjour, quels biens immobiliers sont actuellement publiés sur Altimmo à Brazzaville ?'])
    assert.equal(interpretUtterance(t, s).intent, 'explore', t);
  for (const t of ['Je cherche un terrain à vendre à Brazzaville.', 'Peu importe le budget propose une maison ou un appartement à louer.', 'Quels hôtels propose Altimmo ?'])
    assert.notEqual(interpretUtterance(t, s).intent, 'explore', t);
});

const { describeChanges, composeFallback } = require('../../services/altimmoAdvisor/groundedNarrator');

test('narration : exploration et levée du budget annoncées sans « NaN » ni ancienne borne', () => {
  const [t1, t2] = play(INCIDENT.slice(0, 2));
  const said = describeChanges(t2.policy.operations, t1.state).join(', ');
  assert.doesNotMatch(said, /NaN|100 000|250 000/);
  assert.match(said, /exploration de tout le catalogue/);
  const t4 = play(INCIDENT).at(-1);
  const said4 = describeChanges(t4.policy.operations, play(INCIDENT.slice(0, 3)).at(-1).state).join(', ');
  assert.match(said4, /budget sans restriction/); assert.match(said4, /maison ou appartement/);
});

test('aucun résultat sans budget : ne propose pas de « revoir le budget », annonce les types cherchés', async () => {
  const t4 = play(INCIDENT).at(-1);
  const reply = composeFallback({ kind: 'no_results', state: t4.state, summary: '', changes: [], results: [] });
  assert.doesNotMatch(reply, /ajuster le budget|revoir le budget|dépasserai pas votre budget/);
  assert.match(reply, /maison ou appartement/i);
  assert.match(reply, /même sans limite de budget/);
  const { manager } = setup();
  const out = [];
  for (const message of ['Je cherche un terrain à louer à Brazzaville.', 'Peu importe le budget propose une maison ou un appartement à louer à Poto-Poto avec 9 chambres.']) out.push(await manager.turn({ sessionId: 'nb', message }));
  assert.doesNotMatch(out[1].reply, /revoir le budget|ajuster le budget/);
});
