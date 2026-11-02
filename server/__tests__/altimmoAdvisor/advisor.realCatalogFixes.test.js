/** @jest-environment ./__tests__/altimmoAdvisor/realmCloneEnvironment.js */
'use strict';
const assert = require('node:assert/strict');
const { isGeneralCatalogRequest, filterGeneralListing } = require('../../services/altimmoAdvisor/llm/tools');
const { publicFacts } = require('../../services/altimmoAdvisor/publicProjection');
const { composeFallback } = require('../../services/altimmoAdvisor/groundedNarrator');
const { createConversationState, applyOperations, evaluateListing, describeState } = require('../../services/altimmoAdvisor/conversationState');

test('catalogue général : questions ouvertes reconnues, demandes ciblées exclues', () => {
  for (const t of ['Bonjour, quels biens immobiliers sont actuellement publiés sur Altimmo à Brazzaville ?', 'Montre-moi maintenant tous les biens disponibles, peu importe mes anciens critères.', 'Quelles annonces proposez-vous ?', 'Qu’avez-vous comme biens publiés ?'])
    assert.equal(isGeneralCatalogRequest(t), true, t);
  for (const t of ['Je cherche un terrain à vendre à Brazzaville.', 'Avez-vous un bureau à louer ?', 'Quels hôtels propose Altimmo ?', 'Je veux acheter une villa à Brazzaville.'])
    assert.equal(isGeneralCatalogRequest(t), false, t);
});

test('catalogue général : la ville demandée filtre la liste, sans exclure une ville inconnue', () => {
  const s = applyOperations(createConversationState(), [{ op: 'set', path: 'city', value: 'Brazzaville', source: 'explicit' }]);
  assert.equal(filterGeneralListing(s, { address: { city: 'Brazzaville' } }), true);
  assert.equal(filterGeneralListing(s, { address: { city: 'Pointe-Noire' } }), false);
  assert.equal(filterGeneralListing(s, { address: { city: null } }), true);
});

test('projection publique : période du prix conservée (nuit, mois, vente), valeur inconnue rejetée', () => {
  assert.equal(publicFacts({ id: 'a', price: 150000, pricePeriod: 'night' }).pricePeriod, 'night');
  assert.equal(publicFacts({ id: 'b', price: 650000, pricePeriod: 'month' }).pricePeriod, 'month');
  assert.equal(publicFacts({ id: 'c', price: 1, pricePeriod: 'quinzaine' }).pricePeriod, null);
});

test('narration de secours : tarif par nuit distingué du loyer mensuel', () => {
  const s = createConversationState();
  const villa = { id: 'v', title: 'VILLA', price: 150000, pricePeriod: 'night', bedrooms: 4, surface: 400, amenities: [], address: { city: 'Brazzaville', arrondissement: 'Moungali' }, unknown: [] };
  const office = { id: 'o', title: 'BUREAU', price: 650000, pricePeriod: 'month', bedrooms: 0, surface: 203, amenities: [], address: { city: 'Brazzaville', arrondissement: 'Poto-Poto' }, unknown: [] };
  const reply = composeFallback({ kind: 'results', state: s, summary: describeState(s), changes: [], results: [villa, office].map((l) => ({ listing: l, fit: evaluateListing(s, l) })) });
  assert.match(reply, /150 000 FCFA par nuit/);
  assert.match(reply, /650 000 FCFA par mois/);
});

const { publicCard } = require('../../services/altimmoAdvisor/llm/tools');
const { createOutputGuard } = require('../../services/altimmoAdvisor/groundedNarrator');

test('LIVE C09.2 : la fiche envoyée au modèle porte la période du prix', () => {
  const s = createConversationState();
  assert.equal(publicCard({ id: 'h', title: 'Hôtel', price: 25000, pricePeriod: 'night', amenities: [], address: {} }, s).periode_prix, 'par nuit');
  assert.equal(publicCard({ id: 'b', title: 'Bureau', price: 650000, pricePeriod: 'month', amenities: [], address: {} }, s).periode_prix, 'par mois');
  assert.equal(publicCard({ id: 'x', title: 'X', price: 1, amenities: [], address: {} }, s).periode_prix, 'non indiquée');
});

test('LIVE C09.4 : le prix d une annonce déjà présentée dans la conversation n est pas rejeté', () => {
  const s = createConversationState();
  s.lastResults = [{ id: 'h', title: 'Mila Hotel', price: 25000, pricePeriod: 'night', bedrooms: 27, surface: 1250, amenities: [], address: { city: 'Brazzaville', arrondissement: 'Moungali' } }];
  const guard = createOutputGuard({ kind: 'clarify', state: s, userText: 'Quel est le prix exact de ce bien ?', results: [] }, { coverage: false, phantomOffer: false });
  guard.push('Le Mila Hotel à Moungali est affiché à 25 000 FCFA par nuit. ');
  guard.end();
  assert.equal(guard.violation, null);
  const bad = createOutputGuard({ kind: 'clarify', state: s, userText: 'Quel est le prix ?', results: [] }, { coverage: false, phantomOffer: false });
  bad.push('Il coûte 31 000 FCFA par nuit. '); bad.end();
  assert.ok(bad.violation, 'un prix jamais présenté reste rejeté');
});

test('LIVE C01.1 : narration de secours d une liste générale sans « achat et location » ni « Les 1 autres »', () => {
  const s = createConversationState();
  const mk = (i) => ({ id: `g${i}`, title: `Bien ${i}`, price: 1000 * i, pricePeriod: 'month', bedrooms: 0, surface: 10 * i, amenities: [], address: { city: 'Brazzaville', arrondissement: 'Poto-Poto' }, unknown: [] });
  const reply = composeFallback({ kind: 'results', general: true, state: s, summary: describeState(s), changes: [], results: [1, 2, 3, 4].map((i) => ({ listing: mk(i), fit: evaluateListing(s, mk(i)) })) });
  assert.doesNotMatch(reply, /achat et location/);
  assert.doesNotMatch(reply, /Les 1 autres/);
  assert.match(reply, /L’autre annonce figure dans les fiches/);
});

const { createEngineAdapter } = require('../../services/altimmoAdvisor/engineAdapter');
const { createToolRunner } = require('../../services/altimmoAdvisor/llm/tools');

// INTEGRATION-01 : la période est déduite du statut public de l'annonce IA-03 (et non plus relue par HTTP).
test('LIVE C10.3 : un résultat de recherche IA-03 reçoit la période publique de son annonce', async () => {
  const listing = { _id: '64b000000000000000000001', title: 'BUREAU', type: 'Bureau', status: 'location', price: 650000, address: {}, amenities: [] };
  const adapter = createEngineAdapter({
    gatewayImpl: { searchAndRankRealEstate: async () => ({ status: 'success', interpretedCriteria: { transaction: 'RENT' }, rankedResults: [{ listing }], rankedCandidatesToVerify: [] }) },
    listProperties: async () => [],
  });
  const out = await adapter.searchPublished({ query: 'bureau à louer' });
  assert.equal(out.items[0].listing.pricePeriod, 'month');
});

test('LIVE C09.2 : demande générale, le modèle ne peut pas réintroduire un ancien critère', async () => {
  const draft = { state: createConversationState() };
  const runner = createToolRunner({ engine: { listPublished: async () => ({ items: [] }) }, draft, userText: 'Montre-moi tous les biens disponibles, peu importe mes anciens critères.', interp: {}, generalSearch: true });
  const { result } = await runner.run({ name: 'update_criteria', arguments: JSON.stringify({ operations: [{ op: 'set', path: 'transaction', value: 'BUY' }] }) });
  assert.equal(draft.state.criteria.transaction, null);
  assert.equal(result.refusees[0].path, 'transaction');
});

const { resetForGeneralRequest } = require('../../services/altimmoAdvisor/llm/tools');

test('LIVE C10.4 : une promesse de rappel ou de notification est rejetée par le garde', () => {
  const s = createConversationState();
  for (const text of ['Voulez-vous que je vous rappelle dès qu’un bureau se libère ?', 'Je vous préviendrai dès qu’une annonce sera publiée.', 'Je peux vous envoyer une alerte quand un bien arrive.', 'Je vous tiendrai informé dès qu’un appartement est disponible.']) {
    const g = createOutputGuard({ kind: 'no_results', state: s, userText: 'x', results: [] }, { coverage: false, phantomOffer: false });
    g.push(text); g.end();
    assert.ok(g.violation, text);
  }
  const ok = createOutputGuard({ kind: 'clarify', state: s, userText: 'x', results: [] }, { coverage: false, phantomOffer: false });
  ok.push('Je peux rappeler vos critères si vous le souhaitez.'); ok.end();
  assert.equal(ok.violation, null);
});

test('LIVE C09.2 : « peu importe mes anciens critères » efface opération, type, quartier et budget côté serveur', () => {
  let s = applyOperations(createConversationState(), ['transaction:BUY', 'propertyType:Villa', 'city:Brazzaville', 'district:Poto-Poto', 'budget.max:50000000'].map((x) => { const [path, v] = x.split(':'); return { op: 'set', path, value: Number(v) || v, source: 'explicit' }; }));
  const ops = resetForGeneralRequest(s, 'Montre-moi maintenant tous les biens disponibles, peu importe mes anciens critères.');
  s = applyOperations(s, ops);
  assert.deepEqual([s.criteria.transaction, s.criteria.propertyType, s.criteria.district, s.criteria.budget.max], [null, null, null, null]);
  assert.deepEqual(resetForGeneralRequest(s, 'Quels biens sont publiés à Brazzaville ?'), []);
});

test('LIVE navigateur : la remise à zéro générale efface aussi la périodicité du budget', () => {
  let s = applyOperations(createConversationState(), [{ op: 'set', path: 'transaction', value: 'BUY', source: 'explicit' }, { op: 'set', path: 'propertyType', value: 'Terrain', source: 'explicit' }]);
  s = applyOperations(s, [{ op: 'set', path: 'budget.period', value: 'sale', source: 'explicit' }]);
  s = applyOperations(s, resetForGeneralRequest(s, 'Montre-moi tous les biens disponibles, peu importe mes anciens critères.'));
  assert.equal(s.criteria.budget.period, null);
});
